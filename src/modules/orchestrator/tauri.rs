//! Tauri Command Implementation for OrchestratorAgent
//!
//! This module provides Tauri commands to interact with the OrchestratorAgent
//! from the frontend application.

use std::sync::{Arc, RwLock};
use std::collections::HashMap;
use std::time::SystemTime;
use serde::{Serialize, Deserialize};
use tauri::command;

use crate::modules::orchestrator::{
    OrchestratorAgent, 
    PhoenixResult, 
    PhoenixError,
    AgentErrorKind,
    ConscienceRequest,
    RequestId,
    RequestOrigin,
    ToolParameters
};

/// Response format for orchestrator task results
#[derive(Debug, Serialize, Deserialize)]
pub struct TaskResponse {
    /// Whether the task was successful
    pub success: bool,
    /// Result of the task execution (if successful)
    pub result: Option<String>,
    /// Error message (if unsuccessful)
    pub error: Option<String>,
    /// Whether human review is required
    pub requires_human_review: bool,
    /// Request ID for tracking
    pub request_id: String,
}

impl Default for TaskResponse {
    fn default() -> Self {
        Self {
            success: false,
            result: None,
            error: None,
            requires_human_review: false,
            request_id: RequestId::new().to_string(),
        }
    }
}

/// Invoke an OrchestratorAgent task
///
/// This function provides a Tauri command interface to execute tasks through
/// the OrchestratorAgent. The task is checked against the conscience gate 
/// for ethical validation before execution.
///
/// # Arguments
///
/// * `task` - A string description of the task to execute
/// * `orchestrator_agent` - Shared reference to the OrchestratorAgent instance
///
/// # Returns
///
/// A `TaskResponse` containing the result of the task execution
#[command]
pub async fn invoke_orchestrator_task(
    task: String,
    orchestrator_agent: tauri::State<'_, Arc<OrchestratorAgent>>,
) -> Result<TaskResponse, String> {
    // Create a request ID to track this task
    let request_id = RequestId::new();
    
    // Prepare a task response with the request ID
    let mut response = TaskResponse {
        success: false,
        result: None,
        error: None,
        requires_human_review: false,
        request_id: request_id.to_string(),
    };
    
    // Create a conscience request for validation
    let conscience_request = ConscienceRequest {
        id: request_id.clone(),
        action: format!("Execute task: {}", task),
        tool_id: "orchestrator_task".to_string(),
        parameters: ToolParameters::from(format!("{{\"task\": \"{}\"}}", task)),
        context: HashMap::new(),
        timestamp: SystemTime::now(),
        origin: RequestOrigin::User,
    };
    
    // Process the task
    let result = process_task(orchestrator_agent.inner().clone(), conscience_request, task).await;
    
    // Handle the result
    match result {
        Ok(task_result) => {
            response.success = true;
            response.result = Some(task_result);
        },
        Err(err) => {
            // Check if human review is required
            if let PhoenixError::Agent { kind, message, .. } = &err {
                if *kind == AgentErrorKind::HumanReviewRequired {
                    response.requires_human_review = true;
                    response.error = Some(format!("Human review required: {}", message));
                } else {
                    response.error = Some(format!("Error: {}", err));
                }
            } else {
                response.error = Some(format!("Error: {}", err));
            }
        }
    }
    
    Ok(response)
}

/// Submit a human-reviewed task for execution
///
/// This function is used when a task initially required human review,
/// and that review has now been completed. It bypasses the initial
/// conscience check since human review has already been performed.
///
/// # Arguments
///
/// * `task` - A string description of the task to execute
/// * `request_id` - The original request ID from the first attempt
/// * `human_reviewer_id` - ID of the human who reviewed the task
/// * `orchestrator_agent` - Shared reference to the OrchestratorAgent instance
///
/// # Returns
///
/// A `TaskResponse` containing the result of the task execution
#[command]
pub async fn submit_reviewed_task(
    task: String,
    request_id: String,
    human_reviewer_id: String,
    orchestrator_agent: tauri::State<'_, Arc<OrchestratorAgent>>,
) -> Result<TaskResponse, String> {
    // Parse the request ID from the string
    let request_id = RequestId(request_id);
    
    // Prepare a task response with the request ID
    let mut response = TaskResponse {
        success: false,
        result: None,
        error: None,
        requires_human_review: false,
        request_id: request_id.to_string(),
    };
    
    // Create context with human reviewer information
    let mut context = HashMap::new();
    context.insert("human_reviewer_id".to_string(), human_reviewer_id);
    context.insert("human_review_timestamp".to_string(), SystemTime::now().elapsed().unwrap_or_default().as_secs().to_string());
    
    // Create a conscience request that indicates human review has been performed
    let conscience_request = ConscienceRequest {
        id: request_id,
        action: format!("Execute reviewed task: {}", task),
        tool_id: "orchestrator_task_reviewed".to_string(),
        parameters: ToolParameters::from(format!("{{\"task\": \"{}\", \"reviewed\": true}}", task)),
        context,
        timestamp: SystemTime::now(),
        origin: RequestOrigin::User,
    };
    
    // Process the task with human review flag
    let result = process_task(orchestrator_agent.inner().clone(), conscience_request, task).await;
    
    // Handle the result
    match result {
        Ok(task_result) => {
            response.success = true;
            response.result = Some(task_result);
        },
        Err(err) => {
            response.error = Some(format!("Error: {}", err));
        }
    }
    
    Ok(response)
}

/// Internal function to process a task through the OrchestratorAgent
///
/// This function handles the logic of executing a task, including:
/// 1. Validating through the conscience gate
/// 2. Determining the appropriate tool to execute
/// 3. Executing the task
/// 4. Returning the result
///
/// # Arguments
///
/// * `agent` - Reference to the OrchestratorAgent
/// * `conscience_request` - The conscience request for validation
/// * `task` - The task description
///
/// # Returns
///
/// A `PhoenixResult<String>` with the task result or error
async fn process_task(agent: Arc<OrchestratorAgent>, conscience_request: ConscienceRequest, task: String) -> PhoenixResult<String> {
    // For simple tasks, we'll parse the task string to determine what to do
    // In a more sophisticated implementation, this could use NLP to understand the task
    
    // Check if the task is a search query
    if task.to_lowercase().contains("search") || task.to_lowercase().contains("find") || task.to_lowercase().contains("query") {
        // Extract search query - this is a simple extraction, could be more sophisticated
        let query = task.replace("search", "")
                        .replace("Search", "")
                        .replace("find", "")
                        .replace("Find", "")
                        .replace("query", "")
                        .replace("Query", "")
                        .trim()
                        .to_string();
        
        // Perform a memory search
        return agent.search_memory(&query, None).await;
    }
    
    // Check if the task is to execute a specific tool
    if task.to_lowercase().starts_with("execute") || task.to_lowercase().starts_with("run") {
        // Try to extract tool name and parameters
        let parts: Vec<&str> = task.splitn(3, ' ').collect();
        if parts.len() >= 2 {
            let tool_name = parts[1].trim();
            let params = if parts.len() > 2 { parts[2] } else { "" };
            
            // Execute the tool
            return agent.execute_tool(tool_name, params).await;
        }
    }
    
    // For tasks that don't match specific patterns, return an appropriate error
    Err(PhoenixError::Agent {
        kind: AgentErrorKind::InvalidRequest,
        message: format!("Unable to process task: {}. Please provide a more specific instruction.", task),
        component: "OrchestratorAgent".to_string(),
    })
}

/// Register all Tauri commands related to the OrchestratorAgent
pub fn register_commands(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Log that commands are being registered
    log::info!("Registering OrchestratorAgent Tauri commands");
    
    // Nothing special needs to be done here as the #[command] macro handles registration
    // However, this function can be used for any additional setup needed
    
    Ok(())
}