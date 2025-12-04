//! Test suite for Cipher Guard command system

mod voice_tests;
mod thought_tests;
mod registry_tests;
mod security_tests;
mod nlp_tests;
mod execution_tests;
mod integration_tests;

use super::*;
use tokio::test;
use mockall::automock;
use async_trait::async_trait;
use std::error::Error;

// Mock implementations for testing
#[automock]
#[async_trait]
pub trait TestCommandHandler {
    async fn execute(&self, context: &CommandContext) -> Result<(), Box<dyn Error>>;
    async fn validate(&self) -> Result<(), Box<dyn Error>>;
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    #[test]
    async fn test_command_system_initialization() -> Result<(), Box<dyn Error>> {
        let system = CommandSystem::new()?;
        system.initialize().await?;
        Ok(())
    }

    #[test]
    async fn test_command_processing() -> Result<(), Box<dyn Error>> {
        let system = CommandSystem::new()?;
        system.initialize().await?;

        let result = system.process_command("test command", CommandSource::Voice).await;
        assert!(result.is_ok());
        Ok(())
    }
}