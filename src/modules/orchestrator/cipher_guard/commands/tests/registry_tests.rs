//! Tests for command registry module

use super::*;
use crate::commands::registry::{CommandRegistry, PermissionManager, CommandValidator, CommandHistory, SuggestionEngine};
use std::sync::Arc;
use tokio::test;
use mockall::predicate::*;
use async_trait::async_trait;

#[test]
async fn test_registry_initialization() -> Result<(), Box<dyn Error>> {
    let registry = CommandRegistry::new()?;
    registry.initialize().await?;
    Ok(())
}

#[test]
async fn test_command_registration() -> Result<(), Box<dyn Error>> {
    let registry = CommandRegistry::new()?;
    registry.initialize().await?;
    
    // Create test command
    let command = Arc::new(TestCommand::default());
    registry.register_command("test_command", command).await?;
    
    // Verify registration
    let resolved = registry.resolve_command("test_command").await?;
    assert_eq!(resolved.intent, "test_command");
    
    Ok(())
}

#[test]
async fn test_permission_management() -> Result<(), Box<dyn Error>> {
    let manager = PermissionManager::new()?;
    manager.initialize().await?;
    
    // Test permission check
    manager.check_permission("test_command").await?;
    
    // Test invalid permission
    let result = manager.check_permission("invalid_command").await;
    assert!(result.is_err());
    
    Ok(())
}

#[test]
async fn test_command_validation() -> Result<(), Box<dyn Error>> {
    let validator = CommandValidator::new()?;
    validator.initialize().await?;
    
    // Create test command
    let command = Arc::new(TestCommand::default());
    
    // Test validation
    validator.validate_command("test_command", &command).await?;
    
    Ok(())
}

#[test]
async fn test_command_history() -> Result<(), Box<dyn Error>> {
    let mut history = CommandHistory::new();
    
    // Add commands to history
    history.add_command("command1").await?;
    history.add_command("command2").await?;
    
    // Verify history size
    assert_eq!(history.history.len(), 2);
    
    // Test max size limit
    for i in 0..1000 {
        history.add_command(&format!("command{}", i)).await?;
    }
    
    assert_eq!(history.history.len(), history.max_size);
    Ok(())
}

#[test]
async fn test_suggestion_engine() -> Result<(), Box<dyn Error>> {
    let engine = SuggestionEngine::new()?;
    engine.initialize().await?;
    
    // Create test context
    let context = CommandContext {
        intent: "test".to_string(),
        parameters: HashMap::new(),
        source: CommandSource::Voice,
        timestamp: Utc::now(),
    };
    
    // Get suggestions
    let suggestions = engine.generate_suggestions(&context).await?;
    assert!(!suggestions.is_empty());
    
    Ok(())
}

#[test]
async fn test_concurrent_command_resolution() -> Result<(), Box<dyn Error>> {
    let registry = Arc::new(CommandRegistry::new()?);
    registry.initialize().await?;
    
    // Register test command
    let command = Arc::new(TestCommand::default());
    registry.register_command("test_command", command).await?;
    
    let mut handles = Vec::new();
    
    // Spawn multiple concurrent resolvers
    for _ in 0..3 {
        let registry = Arc::clone(&registry);
        let handle = tokio::spawn(async move {
            registry.resolve_command("test_command").await
        });
        handles.push(handle);
    }
    
    // Wait for all resolvers to complete
    for handle in handles {
        let result = handle.await??;
        assert_eq!(result.intent, "test_command");
    }
    
    Ok(())
}

#[test]
async fn test_error_handling() -> Result<(), Box<dyn Error>> {
    let registry = CommandRegistry::new()?;
    registry.initialize().await?;
    
    // Test resolving non-existent command
    let result = registry.resolve_command("nonexistent_command").await;
    assert!(result.is_err());
    
    Ok(())
}

#[test]
async fn test_command_chaining() -> Result<(), Box<dyn Error>> {
    let registry = CommandRegistry::new()?;
    registry.initialize().await?;
    
    // Register chained commands
    let command1 = Arc::new(TestCommand::default());
    let command2 = Arc::new(TestCommand::default());
    
    registry.register_command("command1", command1).await?;
    registry.register_command("command2", command2).await?;
    
    // Execute chain
    let context = CommandContext {
        intent: "command1",
        parameters: HashMap::new(),
        source: CommandSource::Voice,
        timestamp: Utc::now(),
    };
    
    let resolved1 = registry.resolve_command("command1").await?;
    resolved1.handler.execute(&context).await?;
    
    let resolved2 = registry.resolve_command("command2").await?;
    resolved2.handler.execute(&context).await?;
    
    Ok(())
}

// Test command implementation
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

// Mock implementations for testing
mock! {
    CommandRegistry {
        fn new() -> Result<Self, Box<dyn Error>>;
        async fn initialize(&self) -> Result<(), Box<dyn Error>>;
        async fn register_command(&self, name: &str, handler: Arc<dyn CommandHandler>) -> Result<(), Box<dyn Error>>;
        async fn resolve_command(&self, intent: &str) -> Result<ResolvedCommand, Box<dyn Error>>;
    }
}

#[test]
async fn test_with_mocks() -> Result<(), Box<dyn Error>> {
    let mut mock = MockCommandRegistry::new();
    
    mock.expect_initialize()
        .times(1)
        .returning(|| Ok(()));
        
    mock.expect_register_command()
        .with(predicate::eq("test_command"), predicate::always())
        .times(1)
        .returning(|_, _| Ok(()));
        
    mock.expect_resolve_command()
        .with(predicate::eq("test_command"))
        .times(1)
        .returning(|intent| Ok(ResolvedCommand {
            intent: intent.to_string(),
            handler: Arc::new(TestCommand::default()),
            timestamp: Utc::now(),
        }));
        
    mock.initialize().await?;
    
    let command = Arc::new(TestCommand::default());
    mock.register_command("test_command", command).await?;
    
    let result = mock.resolve_command("test_command").await?;
    assert_eq!(result.intent, "test_command");
    
    Ok(())
}

use std::collections::HashMap;
use chrono::Utc;