//! Command system for Cipher Guard's Professional Digital Twin
//! Handles both voice and thought-based command processing

pub mod voice;
pub mod thought;
pub mod registry;
pub mod security;
pub mod nlp;
pub mod execution;
pub mod integration;

use std::error::Error;
use std::sync::Arc;

/// Core command system that coordinates between voice and thought interfaces
pub struct CommandSystem {
    voice_processor: Arc<voice::VoiceProcessor>,
    thought_interface: Arc<thought::ThoughtInterface>,
    command_registry: Arc<registry::CommandRegistry>,
    security_commands: Arc<security::SecurityCommands>,
    nlp_engine: Arc<nlp::NLPEngine>,
    execution_pipeline: Arc<execution::ExecutionPipeline>,
}

impl CommandSystem {
    /// Create a new command system instance
    pub fn new() -> Result<Self, Box<dyn Error>> {
        Ok(Self {
            voice_processor: Arc::new(voice::VoiceProcessor::new()?),
            thought_interface: Arc::new(thought::ThoughtInterface::new()?),
            command_registry: Arc::new(registry::CommandRegistry::new()?),
            security_commands: Arc::new(security::SecurityCommands::new()?),
            nlp_engine: Arc::new(nlp::NLPEngine::new()?),
            execution_pipeline: Arc::new(execution::ExecutionPipeline::new()?),
        })
    }

    /// Initialize the command system and all its components
    pub async fn initialize(&self) -> Result<(), Box<dyn Error>> {
        // Initialize all subsystems
        self.voice_processor.initialize().await?;
        self.thought_interface.initialize().await?;
        self.command_registry.initialize().await?;
        self.security_commands.initialize().await?;
        self.nlp_engine.initialize().await?;
        self.execution_pipeline.initialize().await?;
        
        Ok(())
    }

    /// Process an incoming command from either voice or thought interface
    pub async fn process_command(&self, input: &str, source: CommandSource) -> Result<(), Box<dyn Error>> {
        // Process command through the pipeline
        let intent = self.nlp_engine.classify_intent(input).await?;
        let command = self.command_registry.resolve_command(&intent).await?;
        
        self.execution_pipeline.execute(command).await?;
        Ok(())
    }
}

/// Enum representing the source of a command
#[derive(Debug, Clone, Copy)]
pub enum CommandSource {
    Voice,
    Thought,
}

/// Trait that must be implemented by all command handlers
#[async_trait::async_trait]
pub trait CommandHandler: Send + Sync {
    /// Handle a command execution
    async fn handle(&self, context: &CommandContext) -> Result<(), Box<dyn Error>>;
}

/// Context provided to command handlers during execution
pub struct CommandContext {
    pub intent: String,
    pub entities: Vec<String>,
    pub source: CommandSource,
}