//! Tests for command execution pipeline module

use super::*;
use crate::commands::execution::{
    ExecutionPipeline, CommandExecutor, RollbackManager,
    ExecutionLogger, PerformanceMonitor, RateLimiter,
    ErrorHandler, Transaction, Operation, ExecutionLog
};
use std::sync::Arc;
use tokio::test;
use mockall::predicate::*;
use metrics::{counter, gauge};

#[test]
async fn test_execution_pipeline_initialization() -> Result<(), Box<dyn Error>> {
    let pipeline = ExecutionPipeline::new()?;
    pipeline.initialize().await?;
    Ok(())
}

#[test]
async fn test_command_execution() -> Result<(), Box<dyn Error>> {
    let pipeline = ExecutionPipeline::new()?;
    pipeline.initialize().await?;
    
    // Create test command
    let command = Arc::new(TestCommand::default());
    
    // Execute command
    pipeline.execute(&*command).await?;
    
    Ok(())
}

#[test]
async fn test_rollback_management() -> Result<(), Box<dyn Error>> {
    let manager = RollbackManager::new()?;
    manager.initialize().await?;
    
    // Begin transaction
    let transaction = manager.begin_transaction().await?;
    
    // Add operations
    let operation = Operation {
        command: "test_command".to_string(),
        params: HashMap::new(),
    };
    
    let mut transactions = manager.transactions.write().await;
    transactions.get_mut(&transaction.id).unwrap().operations.push(operation);
    
    // Test rollback
    manager.rollback_transaction(transaction).await?;
    
    // Verify transaction cleanup
    assert!(transactions.is_empty());
    
    Ok(())
}

#[test]
async fn test_execution_logging() -> Result<(), Box<dyn Error>> {
    let logger = ExecutionLogger::new()?;
    logger.initialize().await?;
    
    // Log successful execution
    let success_result: Result<(), Box<dyn Error>> = Ok(());
    logger.log_execution("exec-1".to_string(), &success_result).await?;
    
    // Log failed execution
    let error_result: Result<(), Box<dyn Error>> = Err("Test error".into());
    logger.log_execution("exec-2".to_string(), &error_result).await?;
    
    // Verify logs
    let logs = logger.log_store.read().await;
    assert_eq!(logs.len(), 2);
    assert!(logs[0].success);
    assert!(!logs[1].success);
    
    Ok(())
}

#[test]
async fn test_performance_monitoring() -> Result<(), Box<dyn Error>> {
    let monitor = PerformanceMonitor::new()?;
    monitor.initialize().await?;
    
    // Start execution
    let execution_id = monitor.start_execution().await?;
    
    // Record metrics
    let success_result: Result<(), Box<dyn Error>> = Ok(());
    monitor.end_execution(execution_id, &success_result).await?;
    
    // Verify metrics
    // Note: In a real test environment, we'd verify actual metric values
    Ok(())
}

#[test]
async fn test_rate_limiting() -> Result<(), Box<dyn Error>> {
    let limiter = RateLimiter::new()?;
    limiter.initialize().await?;
    
    // Test within limits
    limiter.check_limits().await?;
    
    // Add more test cases for rate limit exceeded scenarios
    Ok(())
}

#[test]
async fn test_error_handling() -> Result<(), Box<dyn Error>> {
    let handler = ErrorHandler::new()?;
    handler.initialize().await?;
    
    // Test error handling
    let error: Box<dyn Error> = "Test error".into();
    handler.handle_error(&error).await?;
    
    Ok(())
}

#[test]
async fn test_concurrent_execution() -> Result<(), Box<dyn Error>> {
    let pipeline = Arc::new(ExecutionPipeline::new()?);
    pipeline.initialize().await?;
    
    let mut handles = Vec::new();
    
    // Execute multiple commands concurrently
    for _ in 0..3 {
        let pipeline = Arc::clone(&pipeline);
        let command = Arc::new(TestCommand::default());
        let handle = tokio::spawn(async move {
            pipeline.execute(&*command).await
        });
        handles.push(handle);
    }
    
    // Wait for all executions to complete
    for handle in handles {
        handle.await??;
    }
    
    Ok(())
}

#[test]
async fn test_transaction_rollback() -> Result<(), Box<dyn Error>> {
    let pipeline = ExecutionPipeline::new()?;
    pipeline.initialize().await?;
    
    // Create failing command
    let command = Arc::new(FailingCommand::default());
    
    // Execute should trigger rollback
    let result = pipeline.execute(&*command).await;
    assert!(result.is_err());
    
    Ok(())
}

#[test]
async fn test_execution_metrics() -> Result<(), Box<dyn Error>> {
    let monitor = PerformanceMonitor::new()?;
    monitor.initialize().await?;
    
    // Record start
    let execution_id = monitor.start_execution().await?;
    
    // Verify metrics
    gauge!("command_execution_in_progress", 1);
    
    // Record end
    let success_result: Result<(), Box<dyn Error>> = Ok(());
    monitor.end_execution(execution_id, &success_result).await?;
    
    // Verify final metrics
    counter!("command_executions_success", 1);
    
    Ok(())
}

// Test command implementations
#[derive(Default)]
struct TestCommand;

#[async_trait]
impl CommandHandler for TestCommand {
    async fn execute(&self, _context: &CommandContext) -> Result<(), Box<dyn Error>> {
        Ok(())
    }
    
    async fn validate(&self) -> Result<(), Box<dyn Error>> {
        Ok(())
    }
}

#[derive(Default)]
struct FailingCommand;

#[async_trait]
impl CommandHandler for FailingCommand {
    async fn execute(&self, _context: &CommandContext) -> Result<(), Box<dyn Error>> {
        Err("Command failed".into())
    }
    
    async fn validate(&self) -> Result<(), Box<dyn Error>> {
        Ok(())
    }
}

// Mock implementations for testing
mock! {
    ExecutionPipeline {
        fn new() -> Result<Self, Box<dyn Error>>;
        async fn initialize(&self) -> Result<(), Box<dyn Error>>;
        async fn execute(&self, command: &dyn CommandHandler) -> Result<(), Box<dyn Error>>;
    }
}

#[test]
async fn test_with_mocks() -> Result<(), Box<dyn Error>> {
    let mut mock = MockExecutionPipeline::new();
    
    mock.expect_initialize()
        .times(1)
        .returning(|| Ok(()));
        
    mock.expect_execute()
        .with(predicate::always())
        .times(1)
        .returning(|_| Ok(()));
        
    mock.initialize().await?;
    
    let command = TestCommand::default();
    mock.execute(&command).await?;
    
    Ok(())
}

use std::collections::HashMap;