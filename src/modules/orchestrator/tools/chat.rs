//! Chat Tool Implementation
//!
//! This module implements the default "chat" tool that processes user messages
//! and returns responses with context using OpenRouter/Gemini.

use std::collections::HashMap;
use std::time::SystemTime;
use serde_json;

use crate::modules::orchestrator::tool_registry::{Tool, ToolParameters, ToolResult};
use crate::modules::orchestrator::errors::{PhoenixResult, PhoenixError, AgentErrorKind};
use crate::modules::orchestrator::model_router::ModelRouter;

/// Chat tool that processes user messages and returns responses
#[derive(Debug)]
pub struct ChatTool {
    model_router: ModelRouter,
}

impl ChatTool {
    /// Create a new chat tool instance
    pub fn new() -> PhoenixResult<Self> {
        let model_router = ModelRouter::new()?;
        Ok(Self { model_router })
    }
}

#[async_trait::async_trait]
impl Tool for ChatTool {
    /// Execute the chat tool
    ///
    /// Processes the user message and returns a response with context.
    /// The parameters should be a JSON string with:
    /// - "goal": The user's message or goal
    /// - "context": Optional context from memory search (JSON array)
    async fn execute(&self, parameters: ToolParameters) -> PhoenixResult<ToolResult> {
        // Parse parameters
        let params_json: serde_json::Value = serde_json::from_str(&parameters.0)
            .map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::InvalidRequest,
                message: format!("Failed to parse chat parameters: {}", e),
                component: "ChatTool".to_string(),
            })?;
        
        // Extract goal/message
        let goal = params_json.get("goal")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        
        // Extract context if available
        let context = params_json.get("context")
            .and_then(|v| v.as_array())
            .map(|arr| arr.len())
            .unwrap_or(0);
        
        // Build prompt with context
        let prompt = if goal.is_empty() {
            "Hello. I am Phoenix ORCH-0. How may I assist you?".to_string()
        } else {
            let context_info = if context > 0 {
                format!(" (I have {} relevant memories from context)", context)
            } else {
                String::new()
            };
            format!("User request: {}{}\n\nProvide a direct, technical response.", goal, context_info)
        };

        // Generate response using OpenRouter/Gemini
        let response = if goal.is_empty() {
            "Hello. I am Phoenix ORCH-0. How may I assist you?".to_string()
        } else {
            // Use model router for AI-generated response
            match self.model_router.generate(&prompt, None).await {
                Ok(ai_response) => ai_response,
                Err(e) => {
                    log::warn!("ModelRouter error: {}, falling back to simple response", e);
                    format!("I understand: '{}'. Processing your request...", goal)
                }
            }
        };
        
        // Build metadata
        let mut metadata = HashMap::new();
        metadata.insert("tool".to_string(), "chat".to_string());
        metadata.insert("context_count".to_string(), context.to_string());
        metadata.insert("message_length".to_string(), goal.len().to_string());
        
        Ok(ToolResult {
            success: true,
            data: response,
            error: None,
            metadata,
            timestamp: SystemTime::now(),
        })
    }
    
    fn name(&self) -> &str {
        "chat"
    }
    
    fn description(&self) -> &str {
        "Default chat tool that processes user messages and returns responses with context"
    }
    
    fn requires_human_review(&self) -> bool {
        false
    }
    
    fn requires_conscience_approval(&self) -> bool {
        false // Chat tool doesn't need conscience approval for basic responses
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    #[ignore] // Requires OPENROUTER_API_KEY
    async fn test_chat_tool_hello() {
        let tool = ChatTool::new().unwrap();
        let params = ToolParameters(r#"{"goal": "Hello Phoenix"}"#.to_string());
        
        let result = tool.execute(params).await.unwrap();
        assert!(result.success);
        assert!(result.data.contains("Hello") || result.data.contains("Phoenix"));
    }
    
    #[tokio::test]
    #[ignore] // Requires OPENROUTER_API_KEY
    async fn test_chat_tool_empty() {
        let tool = ChatTool::new().unwrap();
        let params = ToolParameters(r#"{"goal": ""}"#.to_string());
        
        let result = tool.execute(params).await.unwrap();
        assert!(result.success);
    }
}
