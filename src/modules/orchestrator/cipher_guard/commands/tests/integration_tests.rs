//! Tests for integration features module

use super::*;
use crate::commands::integration::{
    IntegrationManager, ProfessionalTwinConnector, AutomationConnector,
    ToolHandler, CrossToolExecutor, ResultProcessor,
    IntegratedCommand, CommandResult, ToolResult, TwinContext,
    AutomationCapabilities, Tool, ToolParams
};
use std::sync::Arc;
use tokio::test;
use mockall::predicate::*;
use async_trait::async_trait;

#[test]
async fn test_integration_manager_initialization() -> Result<(), Box<dyn Error>> {
    let manager = IntegrationManager::new()?;
    manager.initialize().await?;
    Ok(())
}

#[test]
async fn test_command_processing() -> Result<(), Box<dyn Error>> {
    let manager = IntegrationManager::new()?;
    manager.initialize().await?;
    
    // Create test command
    let command = IntegratedCommand {
        command: "test_command".to_string(),
        params: HashMap::new(),
        required_tools: vec!["nmap".to_string()],
    };
    
    // Process command
    let result = manager.process_command(&command).await?;
    
    assert!(result.success);
    assert!(!result.output.is_empty());
    
    Ok(())
}

#[test]
async fn test_professional_twin_connection() -> Result<(), Box<dyn Error>> {
    let connector = ProfessionalTwinConnector::new()?;
    connector.initialize().await?;
    
    // Get twin context
    let context = connector.get_context().await?;
    
    assert!(!context.capabilities.is_empty());
    assert!(!context.state.is_empty());
    
    Ok(())
}

#[test]
async fn test_automation_connection() -> Result<(), Box<dyn Error>> {
    let connector = AutomationConnector::new()?;
    connector.initialize().await?;
    
    // Sync capabilities
    connector.sync_capabilities().await?;
    
    // Get capabilities
    let capabilities = connector.get_capabilities().await?;
    
    assert!(!capabilities.available_tools.is_empty());
    assert!(!capabilities.supported_operations.is_empty());
    
    Ok(())
}

#[test]
async fn test_tool_handling() -> Result<(), Box<dyn Error>> {
    let handler = ToolHandler::new()?;
    handler.initialize().await?;
    
    // Register default tools
    handler.register_default_tools().await?;
    
    // Create test command
    let command = IntegratedCommand {
        command: "scan".to_string(),
        params: HashMap::new(),
        required_tools: vec!["nmap".to_string(), "metasploit".to_string()],
    };
    
    // Prepare tools
    let tools = handler.prepare_tools(&command).await?;
    
    assert_eq!(tools.len(), 2);
    
    Ok(())
}

#[test]
async fn test_cross_tool_execution() -> Result<(), Box<dyn Error>> {
    let executor = CrossToolExecutor::new()?;
    executor.initialize().await?;
    
    // Create test command and context
    let command = IntegratedCommand {
        command: "scan".to_string(),
        params: HashMap::new(),
        required_tools: vec!["nmap".to_string()],
    };
    
    let twin_context = TwinContext {
        capabilities: vec!["scanning".to_string()],
        state: HashMap::new(),
    };
    
    let automation = AutomationCapabilities::default();
    
    let tools = vec![Box::new(TestTool::default())];
    
    // Execute across tools
    let results = executor.execute(&command, &twin_context, &automation, &tools).await?;
    
    assert!(!results.is_empty());
    assert!(results[0].success);
    
    Ok(())
}

#[test]
async fn test_result_processing() -> Result<(), Box<dyn Error>> {
    let processor = ResultProcessor::new()?;
    processor.initialize().await?;
    
    // Create test results
    let results = vec![
        ToolResult {
            tool_name: "nmap".to_string(),
            success: true,
            output: "Port scan complete".to_string(),
        },
        ToolResult {
            tool_name: "metasploit".to_string(),
            success: true,
            output: "Vulnerability scan complete".to_string(),
        },
    ];
    
    // Process results
    let final_result = processor.process_results(results).await?;
    
    assert!(final_result.success);
    assert!(!final_result.output.is_empty());
    
    Ok(())
}

#[test]
async fn test_concurrent_tool_execution() -> Result<(), Box<dyn Error>> {
    let executor = Arc::new(CrossToolExecutor::new()?);
    executor.initialize().await?;
    
    let mut handles = Vec::new();
    
    // Create test context
    let command = IntegratedCommand {
        command: "scan".to_string(),
        params: HashMap::new(),
        required_tools: vec!["nmap".to_string()],
    };
    
    let twin_context = TwinContext {
        capabilities: vec!["scanning".to_string()],
        state: HashMap::new(),
    };
    
    let automation = AutomationCapabilities::default();
    
    // Execute tools concurrently
    for _ in 0..3 {
        let executor = Arc::clone(&executor);
        let command = command.clone();
        let twin_context = twin_context.clone();
        let automation = automation.clone();
        let tools = vec![Box::new(TestTool::default())];
        
        let handle = tokio::spawn(async move {
            executor.execute(&command, &twin_context, &automation, &tools).await
        });
        handles.push(handle);
    }
    
    // Wait for all executions to complete
    for handle in handles {
        let results = handle.await??;
        assert!(!results.is_empty());
        assert!(results[0].success);
    }
    
    Ok(())
}

#[test]
async fn test_error_handling() -> Result<(), Box<dyn Error>> {
    let manager = IntegrationManager::new()?;
    manager.initialize().await?;
    
    // Create invalid command
    let command = IntegratedCommand {
        command: "invalid_command".to_string(),
        params: HashMap::new(),
        required_tools: vec!["nonexistent_tool".to_string()],
    };
    
    // Process should fail gracefully
    let result = manager.process_command(&command).await;
    assert!(result.is_err());
    
    Ok(())
}

// Test tool implementation
#[derive(Default)]
struct TestTool;

#[async_trait]
impl Tool for TestTool {
    async fn execute(&self, params: &ToolParams) -> Result<ToolResult, Box<dyn Error>> {
        Ok(ToolResult {
            tool_name: "test_tool".to_string(),
            success: true,
            output: "Test execution complete".to_string(),
        })
    }
    
    fn clone_box(&self) -> Box<dyn Tool> {
        Box::new(Self {})
    }
}

// Mock implementations for testing
mock! {
    IntegrationManager {
        fn new() -> Result<Self, Box<dyn Error>>;
        async fn initialize(&self) -> Result<(), Box<dyn Error>>;
        async fn process_command(&self, command: &IntegratedCommand) -> Result<CommandResult, Box<dyn Error>>;
    }
}

#[test]
async fn test_with_mocks() -> Result<(), Box<dyn Error>> {
    let mut mock = MockIntegrationManager::new();
    
    mock.expect_initialize()
        .times(1)
        .returning(|| Ok(()));
        
    mock.expect_process_command()
        .with(predicate::always())
        .times(1)
        .returning(|_| Ok(CommandResult {
            success: true,
            output: "Mock execution complete".to_string(),
            tool_results: Vec::new(),
        }));
        
    mock.initialize().await?;
    
    let command = IntegratedCommand {
        command: "test".to_string(),
        params: HashMap::new(),
        required_tools: vec![],
    };
    
    let result = mock.process_command(&command).await?;
    assert!(result.success);
    
    Ok(())
}

use std::collections::HashMap;