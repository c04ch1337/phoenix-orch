//! Tool Registry Implementation
//!
//! This module contains the Tool registry implementation for the OrchestratorAgent.

use std::collections::HashMap;
use std::fmt::Debug;
use std::sync::{Arc, RwLock};
use std::time::SystemTime;
use async_trait::async_trait;

use crate::modules::orchestrator::errors::{PhoenixResult, PhoenixError, AgentErrorKind};
use crate::modules::orchestrator::conscience::ConscienceGate;
use crate::modules::orchestrator::types::{
    ConscienceRequest, RequestId, RequestOrigin, RiskLevel
};

/// Tool parameters for execution
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ToolParameters(pub String);

impl From<String> for ToolParameters {
    fn from(value: String) -> Self {
        Self(value)
    }
}

/// Tool result
#[derive(Debug, Clone)]
pub struct ToolResult {
    /// Success status
    pub success: bool,
    
    /// Result data
    pub data: String,
    
    /// Error message if any
    pub error: Option<String>,
    
    /// Execution metadata
    pub metadata: HashMap<String, String>,
    
    /// Execution timestamp
    pub timestamp: SystemTime,
}

/// A trait that defines a callable tool in the system
/// 
/// Tools can be registered with the ToolRegistry and executed by name
#[async_trait]
pub trait Tool: Send + Sync + Debug {
    /// Execute the tool with the given parameters
    async fn execute(&self, parameters: ToolParameters) -> PhoenixResult<ToolResult>;
    
    /// Get the tool's name
    fn name(&self) -> &str;
    
    /// Get a description of the tool
    fn description(&self) -> &str;
    
    /// Check if the tool requires human review before execution
    fn requires_human_review(&self) -> bool {
        false
    }
    
    /// Check if the tool requires conscience gate approval
    fn requires_conscience_approval(&self) -> bool {
        true
    }
}

/// Type alias for a boxed Tool trait object
pub type BoxedTool = Box<dyn Tool>;

/// Tool execution context
#[derive(Debug, Clone)]
pub struct ToolExecutionContext {
    /// Execution ID
    pub execution_id: String,
    
    /// Originating request ID
    pub request_id: Option<RequestId>,
    
    /// User ID (if available)
    pub user_id: Option<String>,
    
    /// Request origin
    pub origin: RequestOrigin,
    
    /// Context parameters
    pub context: HashMap<String, String>,
    
    /// Timestamp
    pub timestamp: SystemTime,
}

impl Default for ToolExecutionContext {
    fn default() -> Self {
        Self {
            execution_id: uuid::Uuid::new_v4().to_string(),
            request_id: None,
            user_id: None,
            origin: RequestOrigin::System,
            context: HashMap::new(),
            timestamp: SystemTime::now(),
        }
    }
}

/// A registry for tools that can be executed by the OrchestratorAgent
#[derive(Debug)]
pub struct ToolRegistry {
    /// Map of tool names to their implementations
    tools: Arc<RwLock<HashMap<String, BoxedTool>>>,
    
    /// Conscience gate for ethical validation
    conscience_gate: Option<Arc<RwLock<ConscienceGate>>>,
}

impl ToolRegistry {
    /// Create a new empty tool registry
    pub fn new() -> Self {
        Self {
            tools: Arc::new(RwLock::new(HashMap::new())),
            conscience_gate: None,
        }
    }
    
    /// Create a new tool registry with a conscience gate
    pub fn new_with_conscience(conscience_gate: Arc<RwLock<ConscienceGate>>) -> Self {
        Self {
            tools: Arc::new(RwLock::new(HashMap::new())),
            conscience_gate: Some(conscience_gate),
        }
    }
    
    /// Set the conscience gate
    pub fn set_conscience_gate(&mut self, conscience_gate: Arc<RwLock<ConscienceGate>>) {
        self.conscience_gate = Some(conscience_gate);
    }
    
    /// Register a tool with the registry
    /// 
    /// # Arguments
    /// 
    /// * `name` - The name to register the tool under
    /// * `tool` - The tool implementation to register
    pub fn add_tool(&self, name: &str, tool: BoxedTool) -> PhoenixResult<()> {
        let mut tools = self.tools.write().map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::SerializationError,
            message: format!("Failed to acquire write lock on tool registry: {}", e),
            component: "ToolRegistry".to_string(),
        })?;
        
        tools.insert(name.to_string(), tool);
        Ok(())
    }
    
    /// Check if a tool with the given name exists in the registry
    /// 
    /// # Arguments
    /// 
    /// * `name` - The name of the tool to check for
    pub fn has_tool(&self, name: &str) -> PhoenixResult<bool> {
        let tools = self.tools.read().map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::SerializationError,
            message: format!("Failed to acquire read lock on tool registry: {}", e),
            component: "ToolRegistry".to_string(),
        })?;
        
        Ok(tools.contains_key(name))
    }
    
    /// Get a list of all registered tool names
    pub fn list_tools(&self) -> PhoenixResult<Vec<String>> {
        let tools = self.tools.read().map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::SerializationError,
            message: format!("Failed to acquire read lock on tool registry: {}", e),
            component: "ToolRegistry".to_string(),
        })?;
        
        Ok(tools.keys().cloned().collect())
    }
    
    /// Execute a tool by name with the given parameters
    ///
    /// # Arguments
    ///
    /// * `name` - The name of the tool to execute
    /// * `parameters` - The parameters to pass to the tool
    /// * `context` - Optional execution context
    pub async fn execute_tool(
        &self,
        name: &str,
        parameters: ToolParameters,
        context: Option<ToolExecutionContext>
    ) -> PhoenixResult<ToolResult> {
        // Get a read lock on the tools HashMap
        let tools = self.tools.read().map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::SerializationError,
            message: format!("Failed to acquire read lock on tool registry: {}", e),
            component: "ToolRegistry".to_string(),
        })?;
        
        // Look up the tool by name
        let tool = tools.get(name).ok_or_else(|| PhoenixError::Agent {
            kind: AgentErrorKind::ToolNotFound,
            message: format!("Tool '{}' not found in registry", name),
            component: "ToolRegistry".to_string(),
        })?;
        
        // Check if the tool requires conscience approval
        if tool.requires_conscience_approval() {
            // Create a default context if none provided
            let ctx = context.unwrap_or_default();
            
            // Process through the conscience gate if available
            if let Some(conscience_gate) = &self.conscience_gate {
                // Create a conscience request
                let request = ConscienceRequest {
                    id: ctx.request_id.unwrap_or_else(RequestId::new),
                    action: format!("Execute tool: {}", name),
                    tool_id: name.to_string(),
                    parameters: parameters.clone(),
                    context: ctx.context.clone(),
                    timestamp: ctx.timestamp,
                    origin: ctx.origin.clone(),
                };
                
                // Evaluate through conscience gate
                let conscience_result = conscience_gate.read().map_err(|e| PhoenixError::Agent {
                    kind: AgentErrorKind::SerializationError,
                    message: format!("Failed to acquire read lock on conscience gate: {}", e),
                    component: "ToolRegistry".to_string(),
                })?.evaluate(request).await?;
                
                // Check if approved
                if !conscience_result.approved {
                    return Err(PhoenixError::Agent {
                        kind: AgentErrorKind::RequestRejected,
                        message: format!("Request rejected: {}",
                            conscience_result.justification),
                        component: "ToolRegistry".to_string(),
                    });
                }
                
                // Check if human review required
                if conscience_result.requires_human_review {
                    return Err(PhoenixError::Agent {
                        kind: AgentErrorKind::HumanReviewRequired,
                        message: format!("Tool '{}' execution requires human review: {}",
                            name, conscience_result.justification),
                        component: "ToolRegistry".to_string(),
                    });
                }
            }
        }
        
        // Check if tool requires human review
        if tool.requires_human_review() {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::HumanReviewRequired,
                message: format!("Tool '{}' inherently requires human review before execution", name),
                component: "ToolRegistry".to_string(),
            });
        }
        
        // Execute the tool with the provided parameters
        tool.execute(parameters).await
    }
    
    /// Get information about a tool
    /// 
    /// # Arguments
    /// 
    /// * `name` - The name of the tool to get information about
    /// 
    /// # Returns
    /// 
    /// A tuple containing the tool's name, description, and flags for human review and conscience approval
    pub fn get_tool_info(&self, name: &str) -> PhoenixResult<(String, String, bool, bool)> {
        let tools = self.tools.read().map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::SerializationError,
            message: format!("Failed to acquire read lock on tool registry: {}", e),
            component: "ToolRegistry".to_string(),
        })?;
        
        let tool = tools.get(name).ok_or_else(|| PhoenixError::Agent {
            kind: AgentErrorKind::ToolNotFound,
            message: format!("Tool '{}' not found in registry", name),
            component: "ToolRegistry".to_string(),
        })?;
        
        Ok((
            tool.name().to_string(),
            tool.description().to_string(),
            tool.requires_human_review(),
            tool.requires_conscience_approval(),
        ))
    }
}

/// A macro for creating a tool registry with predefined tools
#[macro_export]
macro_rules! tool_registry {
    ( $( $name:expr => $tool:expr ),* ) => {{
        let registry = ToolRegistry::new();
        $(
            registry.add_tool($name, Box::new($tool)).unwrap();
        )*
        registry
    }};
}

    /// Check if the tool registry has a conscience gate
    pub fn has_conscience_gate(&self) -> bool {
        self.conscience_gate.is_some()
    }
}

/// Extension to the Tool trait for enhanced ethical validation
pub trait EthicalTool: Tool {
    /// Check if this tool can leak sensitive data
    fn can_leak_sensitive_data(&self) -> bool {
        false
    }
    
    /// Get the risk level for this tool
    fn risk_level(&self) -> RiskLevel {
        RiskLevel::Low
    }
    
    /// Get ethical concerns for this tool
    fn ethical_concerns(&self) -> Vec<String> {
        Vec::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    /// A simple example tool for testing
    #[derive(Debug)]
    struct EchoTool;
    
    #[async_trait]
    impl Tool for EchoTool {
        async fn execute(&self, parameters: ToolParameters) -> PhoenixResult<ToolResult> {
            Ok(ToolResult {
                success: true,
                data: format!("Echo: {}", parameters.0),
                error: None,
                metadata: HashMap::new(),
                timestamp: SystemTime::now(),
            })
        }
        
        fn name(&self) -> &str {
            "echo"
        }
        
        fn description(&self) -> &str {
            "Echoes back the input parameters"
        }
    }
    
    #[tokio::test]
    async fn test_tool_registry() {
        // Create a registry with an echo tool
        let registry = ToolRegistry::new();
        registry.add_tool("echo", Box::new(EchoTool)).unwrap();
        
        // Check that the tool exists
        assert!(registry.has_tool("echo").unwrap());
        assert!(!registry.has_tool("nonexistent").unwrap());
        
        // Get tool info
        let (name, desc, needs_review, needs_conscience) = registry.get_tool_info("echo").unwrap();
        assert_eq!(name, "echo");
        assert_eq!(desc, "Echoes back the input parameters");
        assert!(!needs_review);
        assert!(needs_conscience);
        
        // Execute the tool
        let result = registry.execute_tool("echo", "Hello, world!".into()).await.unwrap();
        assert!(result.success);
        assert_eq!(result.data, "Echo: Hello, world!");
        assert!(result.error.is_none());
    }
    
    #[tokio::test]
    async fn test_tool_registry_macro() {
        let registry = tool_registry! {
            "echo" => EchoTool
        };
        
        assert!(registry.has_tool("echo").unwrap());
        
        let result = registry.execute_tool("echo", "Hello, macro!".into()).await.unwrap();
        assert!(result.success);
        assert_eq!(result.data, "Echo: Hello, macro!");
    }
}