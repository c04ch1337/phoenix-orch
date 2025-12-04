//! Workflow executor for running workflows.
//!
//! This module provides functionality to execute workflows with parameters,
//! managing the execution of steps according to their dependencies and conditions.

use std::collections::HashMap;
use std::sync::Arc;
use anyhow::{Result, Context, anyhow};
use tokio::sync::{mpsc, RwLock, Mutex};
use serde_json::Value;

use crate::modules::orchestrator::workflows::schema::{Workflow, WorkflowStep, WorkflowParameter, ParameterType};
use crate::modules::orchestrator::workflows::WorkflowError;
use crate::modules::orchestrator::agent_manager::AgentManager;
use crate::modules::orchestrator::model_router::ModelRouter;
use crate::modules::orchestrator::tools::ToolRegistry;

/// Execution context for a workflow run
#[derive(Debug, Clone)]
pub struct ExecutionContext {
    /// Parameters for this workflow run
    parameters: HashMap<String, Value>,
    
    /// Step outputs
    outputs: HashMap<String, Value>,
    
    /// Execution status for each step
    status: HashMap<String, StepStatus>,
}

/// Status of a workflow step
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StepStatus {
    /// Step has not been executed yet
    Pending,
    
    /// Step is currently running
    Running,
    
    /// Step has completed successfully
    Completed,
    
    /// Step has failed
    Failed(String),
    
    /// Step has been skipped (condition not met)
    Skipped,
}

/// Event emitted during workflow execution
#[derive(Debug, Clone)]
pub enum WorkflowEvent {
    /// Workflow execution started
    Started {
        workflow_id: String,
        workflow_name: String,
    },
    
    /// Step execution started
    StepStarted {
        workflow_id: String,
        step_id: String,
        step_name: String,
    },
    
    /// Step execution completed
    StepCompleted {
        workflow_id: String,
        step_id: String,
        step_name: String,
        output: Option<Value>,
    },
    
    /// Step execution failed
    StepFailed {
        workflow_id: String,
        step_id: String,
        step_name: String,
        error: String,
    },
    
    /// Step was skipped (condition not met)
    StepSkipped {
        workflow_id: String,
        step_id: String,
        step_name: String,
        reason: String,
    },
    
    /// Workflow execution completed
    Completed {
        workflow_id: String,
        workflow_name: String,
        success: bool,
        message: Option<String>,
    },
}

/// Component that executes workflows
#[derive(Debug, Clone)]
pub struct WorkflowExecutor {
    /// Agent manager for spawning and controlling agents
    agent_manager: Arc<AgentManager>,
    
    /// Model router for selecting appropriate LLM models
    model_router: Arc<ModelRouter>,
    
    /// Tool registry for executing workflow actions
    tool_registry: Arc<ToolRegistry>,
    
    /// Active workflow executions
    active_executions: Arc<RwLock<HashMap<String, ExecutionContext>>>,
    
    /// Event sender for workflow execution events
    event_sender: Arc<Mutex<Option<mpsc::Sender<WorkflowEvent>>>>,
}

impl WorkflowExecutor {
    /// Create a new workflow executor
    pub fn new(
        agent_manager: Arc<AgentManager>,
        model_router: Arc<ModelRouter>,
        tool_registry: Arc<ToolRegistry>,
    ) -> Self {
        Self {
            agent_manager,
            model_router,
            tool_registry,
            active_executions: Arc::new(RwLock::new(HashMap::new())),
            event_sender: Arc::new(Mutex::new(None)),
        }
    }
    
    /// Set an event listener for workflow execution events
    pub async fn set_event_listener(&self, sender: mpsc::Sender<WorkflowEvent>) {
        let mut event_sender = self.event_sender.lock().await;
        *event_sender = Some(sender);
    }
    
    /// Remove event listener
    pub async fn remove_event_listener(&self) {
        let mut event_sender = self.event_sender.lock().await;
        *event_sender = None;
    }
    
    /// Execute a workflow with optional parameters
    pub async fn execute(
        &self,
        workflow: &Workflow,
        parameters: Option<Value>,
    ) -> Result<(), WorkflowError> {
        // Generate a unique execution ID
        let execution_id = format!("exec-{}-{}", workflow.id, chrono::Utc::now().timestamp());
        
        // Validate parameters
        let validated_params = self.validate_parameters(workflow, parameters)
            .map_err(|e| WorkflowError::ParameterValidation(e.to_string()))?;
        
        // Initialize execution context
        let ctx = ExecutionContext {
            parameters: validated_params,
            outputs: HashMap::new(),
            status: HashMap::new(),
        };
        
        // Store in active executions
        {
            let mut executions = self.active_executions.write().await;
            executions.insert(execution_id.clone(), ctx.clone());
        }
        
        // Emit workflow started event
        self.emit_event(WorkflowEvent::Started {
            workflow_id: workflow.id.clone(),
            workflow_name: workflow.name.clone(),
        }).await;
        
        // Execute workflow
        let result = self.execute_workflow_steps(workflow, &execution_id).await;
        
        // Remove from active executions
        {
            let mut executions = self.active_executions.write().await;
            executions.remove(&execution_id);
        }
        
        // Emit workflow completed event
        match &result {
            Ok(_) => {
                self.emit_event(WorkflowEvent::Completed {
                    workflow_id: workflow.id.clone(),
                    workflow_name: workflow.name.clone(),
                    success: true,
                    message: None,
                }).await;
            }
            Err(e) => {
                self.emit_event(WorkflowEvent::Completed {
                    workflow_id: workflow.id.clone(),
                    workflow_name: workflow.name.clone(),
                    success: false,
                    message: Some(e.to_string()),
                }).await;
            }
        }
        
        result
    }
    
    /// Execute a one-thought workflow by name
    pub async fn execute_workflow_by_name(
        &self,
        workflow_name: &str,
        registry: &crate::modules::orchestrator::workflows::registry::WorkflowRegistry,
        parameters: Option<Value>,
    ) -> Result<(), WorkflowError> {
        // Get workflow from registry
        let workflow = registry.get_workflow(workflow_name)
            .ok_or_else(|| WorkflowError::NotFound(workflow_name.to_string()))?;
            
        // Execute workflow
        self.execute(&workflow, parameters).await
    }
    
    /// Validate parameters against workflow parameter definitions
    fn validate_parameters(
        &self,
        workflow: &Workflow,
        parameters: Option<Value>,
    ) -> Result<HashMap<String, Value>> {
        let mut validated = HashMap::new();
        let params = parameters.unwrap_or(Value::Object(serde_json::Map::new()));
        
        // Extract parameters as object
        let params_obj = match params {
            Value::Object(obj) => obj,
            _ => return Err(anyhow!("Parameters must be an object")),
        };
        
        // Validate each parameter
        for param_def in &workflow.parameters {
            let param_name = &param_def.id;
            
            // Check if parameter is provided
            if let Some(value) = params_obj.get(param_name) {
                // Validate parameter type
                match param_def.param_type {
                    ParameterType::String => {
                        if !value.is_string() {
                            return Err(anyhow!("Parameter '{}' must be a string", param_name));
                        }
                    }
                    ParameterType::Number => {
                        if !value.is_number() {
                            return Err(anyhow!("Parameter '{}' must be a number", param_name));
                        }
                    }
                    ParameterType::Boolean => {
                        if !value.is_boolean() {
                            return Err(anyhow!("Parameter '{}' must be a boolean", param_name));
                        }
                    }
                    ParameterType::Array => {
                        if !value.is_array() {
                            return Err(anyhow!("Parameter '{}' must be an array", param_name));
                        }
                    }
                    ParameterType::Object => {
                        if !value.is_object() {
                            return Err(anyhow!("Parameter '{}' must be an object", param_name));
                        }
                    }
                    ParameterType::Agent => {
                        // Agent validation would check if it exists in the agent registry
                        if !value.is_string() {
                            return Err(anyhow!("Agent parameter '{}' must be a string identifier", param_name));
                        }
                    }
                    ParameterType::Model => {
                        // Model validation would check if it exists in the model registry
                        if !value.is_string() {
                            return Err(anyhow!("Model parameter '{}' must be a string identifier", param_name));
                        }
                    }
                    ParameterType::FilePath => {
                        if !value.is_string() {
                            return Err(anyhow!("File path parameter '{}' must be a string", param_name));
                        }
                        // Could add file existence check here
                    }
                    ParameterType::Url => {
                        if !value.is_string() {
                            return Err(anyhow!("URL parameter '{}' must be a string", param_name));
                        }
                        // Could add URL validation here
                    }
                }
                
                // Add validated parameter
                validated.insert(param_name.clone(), value.clone());
            } else if param_def.required {
                // Required parameter is missing
                if let Some(default_value) = &param_def.default_value {
                    // Use default value
                    validated.insert(param_name.clone(), default_value.clone());
                } else {
                    return Err(anyhow!("Required parameter '{}' is missing", param_name));
                }
            } else if let Some(default_value) = &param_def.default_value {
                // Optional parameter with default value
                validated.insert(param_name.clone(), default_value.clone());
            }
        }
        
        Ok(validated)
    }
    
    /// Execute all steps in a workflow
    async fn execute_workflow_steps(
        &self,
        workflow: &Workflow,
        execution_id: &str,
    ) -> Result<(), WorkflowError> {
        // Sort steps by order/dependencies
        let sorted_steps = self.sort_steps(&workflow.steps)?;
        
        // Execute steps in order
        for step in sorted_steps {
            // Check if we should execute this step based on its condition
            if !self.should_execute_step(workflow, &step, execution_id).await? {
                // Skip this step
                self.update_step_status(execution_id, &step.id, StepStatus::Skipped).await;
                
                self.emit_event(WorkflowEvent::StepSkipped {
                    workflow_id: workflow.id.clone(),
                    step_id: step.id.clone(),
                    step_name: step.name.clone(),
                    reason: "Condition not met".to_string(),
                }).await;
                
                continue;
            }
            
            // Update step status to running
            self.update_step_status(execution_id, &step.id, StepStatus::Running).await;
            
            // Emit step started event
            self.emit_event(WorkflowEvent::StepStarted {
                workflow_id: workflow.id.clone(),
                step_id: step.id.clone(),
                step_name: step.name.clone(),
            }).await;
            
            // Execute step
            match self.execute_step(workflow, &step, execution_id).await {
                Ok(output) => {
                    // Update step status to completed
                    self.update_step_status(execution_id, &step.id, StepStatus::Completed).await;
                    
                    // Store step output
                    self.update_step_output(execution_id, &step.id, output.clone()).await;
                    
                    // Emit step completed event
                    self.emit_event(WorkflowEvent::StepCompleted {
                        workflow_id: workflow.id.clone(),
                        step_id: step.id.clone(),
                        step_name: step.name.clone(),
                        output: Some(output),
                    }).await;
                }
                Err(e) => {
                    // Update step status to failed
                    self.update_step_status(
                        execution_id, 
                        &step.id, 
                        StepStatus::Failed(e.to_string())
                    ).await;
                    
                    // Emit step failed event
                    self.emit_event(WorkflowEvent::StepFailed {
                        workflow_id: workflow.id.clone(),
                        step_id: step.id.clone(),
                        step_name: step.name.clone(),
                        error: e.to_string(),
                    }).await;
                    
                    // If step is required, fail the workflow
                    if step.required {
                        return Err(WorkflowError::Execution(format!(
                            "Required step '{}' failed: {}",
                            step.name,
                            e
                        )));
                    }
                }
            }
        }
        
        Ok(())
    }
    
    /// Topological sort of workflow steps based on dependencies
    fn sort_steps(&self, steps: &[WorkflowStep]) -> Result<Vec<WorkflowStep>, WorkflowError> {
        // Build dependency graph
        let mut graph: HashMap<String, Vec<String>> = HashMap::new();
        let mut in_degree: HashMap<String, usize> = HashMap::new();
        
        // Initialize graph
        for step in steps {
            graph.insert(step.id.clone(), Vec::new());
            in_degree.insert(step.id.clone(), 0);
        }
        
        // Build edges
        for step in steps {
            for dep_id in &step.depends_on {
                graph.entry(dep_id.clone())
                    .and_modify(|deps| deps.push(step.id.clone()));
                
                in_degree.entry(step.id.clone())
                    .and_modify(|count| *count += 1);
            }
        }
        
        // Topological sort using Kahn's algorithm
        let mut result = Vec::new();
        let mut queue: Vec<String> = in_degree.iter()
            .filter(|(_, &count)| count == 0)
            .map(|(id, _)| id.clone())
            .collect();
        
        while !queue.is_empty() {
            let node = queue.remove(0);
            
            // Add to result
            if let Some(step) = steps.iter().find(|s| s.id == node) {
                result.push(step.clone());
            }
            
            // Update dependent nodes
            if let Some(neighbors) = graph.get(&node) {
                for neighbor in neighbors {
                    in_degree.entry(neighbor.clone())
                        .and_modify(|count| *count -= 1);
                    
                    if in_degree[neighbor] == 0 {
                        queue.push(neighbor.clone());
                    }
                }
            }
        }
        
        // Check for cycles
        if result.len() != steps.len() {
            return Err(WorkflowError::InvalidDefinition(
                "Workflow steps contain cyclic dependencies".to_string()
            ));
        }
        
        // Secondary sort by order field for steps with same dependencies
        result.sort_by_key(|step| step.order);
        
        Ok(result)
    }
    
    /// Check if a step's condition is met
    async fn should_execute_step(
        &self,
        workflow: &Workflow,
        step: &WorkflowStep,
        execution_id: &str,
    ) -> Result<bool, WorkflowError> {
        // If no condition, always execute
        if step.condition.is_none() {
            return Ok(true);
        }
        
        let condition = step.condition.as_ref().unwrap();
        
        // Evaluate condition (simple implementation - could be expanded)
        if condition == "true" {
            return Ok(true);
        } else if condition == "false" {
            return Ok(false);
        }
        
        // TODO: Implement more complex condition evaluation
        // This would involve parsing expressions like "steps.step1.output.status == 'success'"
        // and evaluating them against the execution context
        
        // For now, just assume all conditions are met
        Ok(true)
    }
    
    /// Execute a single workflow step
    async fn execute_step(
        &self,
        workflow: &Workflow,
        step: &WorkflowStep,
        execution_id: &str,
    ) -> Result<Value, WorkflowError> {
        // Get execution context
        let context = self.get_execution_context(execution_id).await?;
        
        // Process step based on type
        match step.step_type.as_str() {
            "command" => {
                // Execute command using the tool registry
                self.execute_command_step(workflow, step, &context).await
            }
            "agent" => {
                // Create and run an agent
                self.execute_agent_step(workflow, step, &context).await
            }
            "browser" => {
                // Execute browser automation
                self.execute_browser_step(workflow, step, &context).await
            }
            "script" => {
                // Execute custom script
                self.execute_script_step(workflow, step, &context).await
            }
            "model" => {
                // Run LLM inference
                self.execute_model_step(workflow, step, &context).await
            }
            "conditional" => {
                // Conditional logic
                self.execute_conditional_step(workflow, step, &context).await
            }
            "parallel" => {
                // Parallel execution of sub-steps
                self.execute_parallel_step(workflow, step, &context).await
            }
            _ => {
                Err(WorkflowError::Execution(format!(
                    "Unknown step type: {}", 
                    step.step_type
                )))
            }
        }
    }
    
    /// Execute a command step
    async fn execute_command_step(
        &self,
        workflow: &Workflow,
        step: &WorkflowStep,
        context: &ExecutionContext,
    ) -> Result<Value, WorkflowError> {
        // Extract command and arguments from actions
        if step.actions.is_empty() {
            return Err(WorkflowError::Execution(
                "Command step must have at least one action".to_string()
            ));
        }
        
        let action = &step.actions[0];
        let command = action.get("command")
            .and_then(|v| v.as_str())
            .ok_or_else(|| WorkflowError::Execution("Missing 'command' field".to_string()))?;
            
        let args = action.get("args")
            .and_then(|v| v.as_array())
            .unwrap_or(&Vec::new())
            .iter()
            .map(|v| v.as_str().unwrap_or_default().to_string())
            .collect::<Vec<_>>();
        
        // TODO: Execute command using the tool registry
        // For now, return a placeholder result
        Ok(serde_json::json!({
            "status": "success",
            "command": command,
            "args": args,
            "output": "Command executed successfully"
        }))
    }
    
    /// Execute an agent step
    async fn execute_agent_step(
        &self,
        workflow: &Workflow,
        step: &WorkflowStep,
        context: &ExecutionContext,
    ) -> Result<Value, WorkflowError> {
        // Extract agent details from actions
        if step.actions.is_empty() {
            return Err(WorkflowError::Execution(
                "Agent step must have at least one action".to_string()
            ));
        }
        
        let action = &step.actions[0];
        let agent_type = action.get("agent_type")
            .and_then(|v| v.as_str())
            .ok_or_else(|| WorkflowError::Execution("Missing 'agent_type' field".to_string()))?;
            
        let instructions = action.get("instructions")
            .and_then(|v| v.as_str())
            .ok_or_else(|| WorkflowError::Execution("Missing 'instructions' field".to_string()))?;
        
        // TODO: Create and run an agent using the agent manager
        // For now, return a placeholder result
        Ok(serde_json::json!({
            "status": "success",
            "agent_type": agent_type,
            "result": "Agent task completed"
        }))
    }
    
    /// Execute a browser automation step
    async fn execute_browser_step(
        &self,
        workflow: &Workflow,
        step: &WorkflowStep,
        context: &ExecutionContext,
    ) -> Result<Value, WorkflowError> {
        // Extract browser actions
        if step.actions.is_empty() {
            return Err(WorkflowError::Execution(
                "Browser step must have at least one action".to_string()
            ));
        }
        
        // TODO: Execute browser actions
        // For now, return a placeholder result
        Ok(serde_json::json!({
            "status": "success",
            "result": "Browser actions completed"
        }))
    }
    
    /// Execute a script step
    async fn execute_script_step(
        &self,
        workflow: &Workflow,
        step: &WorkflowStep,
        context: &ExecutionContext,
    ) -> Result<Value, WorkflowError> {
        // Extract script details
        if step.actions.is_empty() {
            return Err(WorkflowError::Execution(
                "Script step must have at least one action".to_string()
            ));
        }
        
        let action = &step.actions[0];
        let script_type = action.get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("shell");
            
        let script = action.get("script")
            .and_then(|v| v.as_str())
            .ok_or_else(|| WorkflowError::Execution("Missing 'script' field".to_string()))?;
        
        // TODO: Execute script
        // For now, return a placeholder result
        Ok(serde_json::json!({
            "status": "success",
            "script_type": script_type,
            "result": "Script executed successfully"
        }))
    }
    
    /// Execute a model inference step
    async fn execute_model_step(
        &self,
        workflow: &Workflow,
        step: &WorkflowStep,
        context: &ExecutionContext,
    ) -> Result<Value, WorkflowError> {
        // Extract model details
        if step.actions.is_empty() {
            return Err(WorkflowError::Execution(
                "Model step must have at least one action".to_string()
            ));
        }
        
        let action = &step.actions[0];
        let model = action.get("model")
            .and_then(|v| v.as_str())
            .ok_or_else(|| WorkflowError::Execution("Missing 'model' field".to_string()))?;
            
        let prompt = action.get("prompt")
            .and_then(|v| v.as_str())
            .ok_or_else(|| WorkflowError::Execution("Missing 'prompt' field".to_string()))?;
        
        // TODO: Execute model inference using the model router
        // For now, return a placeholder result
        Ok(serde_json::json!({
            "status": "success",
            "model": model,
            "result": "Model inference completed successfully"
        }))
    }
    
    /// Execute a conditional step
    async fn execute_conditional_step(
        &self,
        workflow: &Workflow,
        step: &WorkflowStep,
        context: &ExecutionContext,
    ) -> Result<Value, WorkflowError> {
        // Extract condition details
        if step.actions.len() < 2 {
            return Err(WorkflowError::Execution(
                "Conditional step must have at least two actions (if/then)".to_string()
            ));
        }
        
        let condition = &step.actions[0];
        let then_action = &step.actions[1];
        let else_action = step.actions.get(2);
        
        // TODO: Evaluate condition and execute appropriate action
        // For now, return a placeholder result
        Ok(serde_json::json!({
            "status": "success",
            "result": "Conditional step completed"
        }))
    }
    
    /// Execute parallel sub-steps
    async fn execute_parallel_step(
        &self,
        workflow: &Workflow,
        step: &WorkflowStep,
        context: &ExecutionContext,
    ) -> Result<Value, WorkflowError> {
        // Extract sub-steps
        if step.actions.is_empty() {
            return Err(WorkflowError::Execution(
                "Parallel step must have at least one sub-step".to_string()
            ));
        }
        
        let sub_steps = step.actions.iter()
            .filter_map(|action| {
                if let Some(sub_step) = action.get("step") {
                    sub_step.as_object().map(|obj| Value::Object(obj.clone()))
                } else {
                    None
                }
            })
            .collect::<Vec<_>>();
        
        // TODO: Execute sub-steps in parallel
        // For now, return a placeholder result
        Ok(serde_json::json!({
            "status": "success",
            "steps_completed": sub_steps.len(),
            "result": "Parallel execution completed"
        }))
    }
    
    /// Get execution context for a workflow run
    async fn get_execution_context(&self, execution_id: &str) -> Result<ExecutionContext, WorkflowError> {
        let executions = self.active_executions.read().await;
        executions.get(execution_id)
            .cloned()
            .ok_or_else(|| WorkflowError::Execution(format!(
                "No active execution found with ID: {}", 
                execution_id
            )))
    }
    
    /// Update step status in the execution context
    async fn update_step_status(&self, execution_id: &str, step_id: &str, status: StepStatus) {
        let mut executions = self.active_executions.write().await;
        if let Some(ctx) = executions.get_mut(execution_id) {
            ctx.status.insert(step_id.to_string(), status);
        }
    }
    
    /// Update step output in the execution context
    async fn update_step_output(&self, execution_id: &str, step_id: &str, output: Value) {
        let mut executions = self.active_executions.write().await;
        if let Some(ctx) = executions.get_mut(execution_id) {
            ctx.outputs.insert(step_id.to_string(), output);
        }
    }
    
    /// Emit a workflow event
    async fn emit_event(&self, event: WorkflowEvent) {
        if let Some(sender) = &*self.event_sender.lock().await {
            // Try to send the event, but don't block if the channel is full
            let _ = sender.try_send(event);
        }
    }
    
    /// Get status of all steps in a workflow execution
    pub async fn get_execution_status(&self, execution_id: &str) -> Option<HashMap<String, StepStatus>> {
        let executions = self.active_executions.read().await;
        executions.get(execution_id).map(|ctx| ctx.status.clone())
    }
    
    /// Check if a workflow execution is still active
    pub async fn is_execution_active(&self, execution_id: &str) -> bool {
        let executions = self.active_executions.read().await;
        executions.contains_key(execution_id)
    }
    
    /// Get a list of all active execution IDs
    pub async fn list_active_executions(&self) -> Vec<String> {
        let executions = self.active_executions.read().await;
        executions.keys().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::orchestrator::workflows::schema::{WorkflowStep, WorkflowParameter};
    
    // Mock implementations for testing
    struct MockAgentManager;
    struct MockModelRouter;
    struct MockToolRegistry;
    
    impl AgentManager {
        fn new_mock() -> Self {
            unimplemented!("This is a mock test")
        }
    }
    
    impl ModelRouter {
        fn new_mock() -> Self {
            unimplemented!("This is a mock test")
        }
    }
    
    impl ToolRegistry {
        fn new_mock() -> Self {
            unimplemented!("This is a mock test")
        }
    }
    
    #[tokio::test]
    #[ignore] // Ignore this test as it requires mocked components
    async fn test_parameter_validation() {
        // This test would validate parameter handling
    }
}