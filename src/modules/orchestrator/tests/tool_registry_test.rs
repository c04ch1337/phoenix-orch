//! Tool Registry Tests
//!
//! This module contains tests for the tool registry functionality.

use std::sync::Arc;
use std::collections::HashMap;
use std::time::SystemTime;
use async_trait::async_trait;

use crate::modules::orchestrator::{
    Tool, ToolRegistry, ToolParameters, ToolResult, PhoenixResult,
    tool_registry, OrchestratorAgent, OrchestratorConfig,
};

// Example tool that counts characters in a string
#[derive(Debug)]
struct CountCharsTool;

#[async_trait]
impl Tool for CountCharsTool {
    async fn execute(&self, parameters: ToolParameters) -> PhoenixResult<ToolResult> {
        let count = parameters.0.chars().count();
        
        Ok(ToolResult {
            success: true,
            data: count.to_string(),
            error: None,
            metadata: HashMap::new(),
            timestamp: SystemTime::now(),
        })
    }
    
    fn name(&self) -> &str {
        "count_chars"
    }
    
    fn description(&self) -> &str {
        "Counts the number of characters in the input string"
    }
}

// Example tool that reverses a string
#[derive(Debug)]
struct ReverseStringTool;

#[async_trait]
impl Tool for ReverseStringTool {
    async fn execute(&self, parameters: ToolParameters) -> PhoenixResult<ToolResult> {
        let reversed: String = parameters.0.chars().rev().collect();
        
        let mut metadata = HashMap::new();
        metadata.insert("original_length".to_string(), parameters.0.len().to_string());
        
        Ok(ToolResult {
            success: true,
            data: reversed,
            error: None,
            metadata,
            timestamp: SystemTime::now(),
        })
    }
    
    fn name(&self) -> &str {
        "reverse_string"
    }
    
    fn description(&self) -> &str {
        "Reverses the characters in the input string"
    }
}

// Example sensitive tool that requires human review
#[derive(Debug)]
struct SensitiveOperationTool;

#[async_trait]
impl Tool for SensitiveOperationTool {
    async fn execute(&self, parameters: ToolParameters) -> PhoenixResult<ToolResult> {
        Ok(ToolResult {
            success: true,
            data: format!("Simulated sensitive operation with: {}", parameters.0),
            error: None,
            metadata: HashMap::new(),
            timestamp: SystemTime::now(),
        })
    }
    
    fn name(&self) -> &str {
        "sensitive_operation"
    }
    
    fn description(&self) -> &str {
        "Performs a sensitive operation that requires human review"
    }
    
    fn requires_human_review(&self) -> bool {
        true
    }
}

// Example tool that simulates errors
#[derive(Debug)]
struct ErrorProducingTool {
    always_fail: bool,
}

#[async_trait]
impl Tool for ErrorProducingTool {
    async fn execute(&self, parameters: ToolParameters) -> PhoenixResult<ToolResult> {
        if self.always_fail || parameters.0.contains("fail") {
            return Ok(ToolResult {
                success: false,
                data: String::new(),
                error: Some("Tool execution failed as expected".to_string()),
                metadata: HashMap::new(),
                timestamp: SystemTime::now(),
            });
        }
        
        Ok(ToolResult {
            success: true,
            data: "Tool executed successfully".to_string(),
            error: None,
            metadata: HashMap::new(),
            timestamp: SystemTime::now(),
        })
    }
    
    fn name(&self) -> &str {
        "error_producer"
    }
    
    fn description(&self) -> &str {
        "A tool that can be configured to produce errors"
    }
}

#[tokio::test]
async fn test_tool_registry_standalone() {
    // Create a registry and add tools
    let registry = ToolRegistry::new();
    registry.add_tool("count", Box::new(CountCharsTool)).unwrap();
    registry.add_tool("reverse", Box::new(ReverseStringTool)).unwrap();
    registry.add_tool("sensitive", Box::new(SensitiveOperationTool)).unwrap();
    
    // List all tools
    let tools = registry.list_tools().unwrap();
    assert_eq!(tools.len(), 3);
    assert!(tools.contains(&"count".to_string()));
    assert!(tools.contains(&"reverse".to_string()));
    assert!(tools.contains(&"sensitive".to_string()));
    
    // Execute count tool
    let result = registry.execute_tool("count", "Hello, world!".into()).await.unwrap();
    assert!(result.success);
    assert_eq!(result.data, "13");
    
    // Execute reverse tool
    let result = registry.execute_tool("reverse", "Hello, world!".into()).await.unwrap();
    assert!(result.success);
    assert_eq!(result.data, "!dlrow ,olleH");
    assert_eq!(result.metadata.get("original_length").unwrap(), "13");
    
    // Get tool info for sensitive tool
    let (name, desc, needs_review, needs_conscience) = registry.get_tool_info("sensitive").unwrap();
    assert_eq!(name, "sensitive_operation");
    assert_eq!(desc, "Performs a sensitive operation that requires human review");
    assert!(needs_review);
    assert!(needs_conscience);
}

#[tokio::test]
async fn test_tool_registry_macro() {
    // Create a registry using the macro
    let registry = tool_registry! {
        "count" => CountCharsTool,
        "reverse" => ReverseStringTool,
        "error" => ErrorProducingTool { always_fail: false }
    };
    
    // Check tools exist
    assert!(registry.has_tool("count").unwrap());
    assert!(registry.has_tool("reverse").unwrap());
    assert!(registry.has_tool("error").unwrap());
    assert!(!registry.has_tool("nonexistent").unwrap());
    
    // Execute tools
    let result = registry.execute_tool("count", "Test string".into()).await.unwrap();
    assert!(result.success);
    assert_eq!(result.data, "11");
    
    // Test error tool with success case
    let result = registry.execute_tool("error", "success".into()).await.unwrap();
    assert!(result.success);
    assert_eq!(result.data, "Tool executed successfully");
    
    // Test error tool with failure case
    let result = registry.execute_tool("error", "fail now".into()).await.unwrap();
    assert!(!result.success);
    assert!(result.error.is_some());
}

// This test will only be included in the test harness when we run with the "integration" feature flag
#[cfg(feature = "integration")]
#[tokio::test]
async fn test_orchestrator_agent_with_tool_registry() -> PhoenixResult<()> {
    // Create an OrchestratorAgent
    let config = OrchestratorConfig::default();
    let agent = OrchestratorAgent::new(config).await?;
    
    // Add some tools
    agent.add_tool("count", CountCharsTool)?;
    agent.add_tool("reverse", ReverseStringTool)?;
    
    // List the tools
    let tools = agent.list_tools()?;
    assert_eq!(tools.len(), 2);
    
    // Execute a tool
    let result = agent.execute_tool("count", "Testing the orchestrator tool execution").await?;
    let result_obj: ToolResult = serde_json::from_str(&result).unwrap();
    assert!(result_obj.success);
    assert_eq!(result_obj.data, "37");
    
    Ok(())
}