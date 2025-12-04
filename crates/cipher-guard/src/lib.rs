//! Cipher Guard Module
//!
//! Provides defensive security capabilities, including full disk encryption
//! for local and network drives using strong industry-standard encryption.

pub mod api;
pub mod error;
pub mod ethics;
pub mod evidence;
pub mod matrix;
pub mod orchestration;
pub mod reporting;
pub mod telemetry;
pub mod websocket;

// New disk encryption modules
pub mod disk_encryption;
pub mod disk_encryption_conscience;
pub mod command_parser;

// Desktop path resolver module
pub mod desktop_path_resolver;

// File System module
pub mod file_system;

// Knowledge Base module
pub mod knowledge_base;

use serde::{Deserialize, Serialize};
use phoenix_orch::context_engineering::PhoenixContext;
use anyhow::{Result, Context as _};

use crate::error::CipherGuardError;
use crate::ethics::EthicalFramework;
use crate::evidence::encryption::KeyManagementSystem;
use crate::command_parser::{CommandParser, CommandContext, ParsedCommand, CommandResponse};
use crate::disk_encryption::{DiskEncryptionSystem, EncryptionContext, SecurityLevel};
use crate::disk_encryption_conscience::DiskEncryptionConscienceGate;
use crate::file_system::FileSystemService;
use crate::knowledge_base::KnowledgeBase;

/// Default action when no specific action is determined
#[derive(Default, Debug, Clone, Serialize, Deserialize)]
pub struct Action {
    /// Type of action (e.g., "disk_encryption", "forensic_analysis")
    pub action_type: String,
    /// Status of the action
    pub status: ActionStatus,
    /// Detailed message about the action
    pub message: String,
    /// Additional details about the action
    pub details: Option<String>,
    /// ID for tracking async operations
    pub operation_id: Option<String>,
}

/// Status of Cipher Guard actions
#[derive(Default, Debug, Clone, Serialize, Deserialize)]
pub enum ActionStatus {
    #[default]
    /// Action succeeded
    Success,
    /// Action failed
    Failure,
    /// Action requires confirmation
    NeedsConfirmation,
    /// Action in progress
    InProgress,
}

/// State shared across Cipher Guard operations
#[derive(Debug)]
pub struct CipherGuardState {
    /// Ethical framework for evaluating actions
    pub ethical_framework: EthicalFramework,
    /// System for disk encryption operations
    pub disk_encryption: DiskEncryptionSystem,
    /// Command parser for natural language commands
    pub command_parser: CommandParser,
    /// Conscience gate for disk encryption safety
    pub disk_conscience: DiskEncryptionConscienceGate,
    /// File system service for file operations
    pub file_system: FileSystemService,
    /// Knowledge Base for storing and retrieving knowledge
    pub knowledge_base: std::sync::Arc<std::sync::RwLock<KnowledgeBase>>,
}

impl CipherGuardState {
    /// Create a new Cipher Guard state
    pub fn new() -> Result<Self, CipherGuardError> {
        // Initialize the key management system
        let key_management = KeyManagementSystem::new()
            .map_err(|e| CipherGuardError::encryption(format!("Failed to initialize key management: {}", e)))?;
        
        // Initialize the ethical framework
        let ethical_framework = EthicalFramework::new();
        
        // Initialize the command parser
        let command_parser = CommandParser::new(ethical_framework.clone());
        
        // Initialize the disk encryption system
        let disk_encryption = DiskEncryptionSystem::new(key_management);
        
        // Initialize the conscience gate
        let disk_conscience = DiskEncryptionConscienceGate::new(ethical_framework.clone());
        
        // Initialize the file system service
        let file_system = FileSystemService::new(ethical_framework.clone());
        
        // Initialize the Knowledge Base
        let knowledge_base = crate::knowledge_base::get_knowledge_base();
        
        // Initialize the Knowledge Base with default data
        if let Err(e) = crate::knowledge_base::initialize() {
            return Err(CipherGuardError::knowledge_base(format!(
                "Failed to initialize Knowledge Base: {}", e
            )));
        }
        
        Ok(Self {
            ethical_framework,
            disk_encryption,
            command_parser,
            disk_conscience,
            file_system,
            knowledge_base,
        })
    }
}

/// Global state for the Cipher Guard crate
static mut CIPHER_GUARD_STATE: Option<CipherGuardState> = None;

/// Initialize the Cipher Guard crate
pub fn initialize() -> Result<(), CipherGuardError> {
    let state = CipherGuardState::new()?;
    
    unsafe {
        CIPHER_GUARD_STATE = Some(state);
    }
    
    Ok(())
}

/// Get a reference to the global Cipher Guard state
///
/// # Safety
///
/// This function is unsafe because it accesses a static mutable variable.
/// It should only be called from contexts where you're sure there are no
/// concurrent accesses to the state.
pub unsafe fn get_state() -> Result<&'static mut CipherGuardState, CipherGuardError> {
    match &mut CIPHER_GUARD_STATE {
        Some(state) => Ok(state),
        None => {
            // Auto-initialize if not initialized
            initialize()?;
            get_state()
        }
    }
}

/// Main entry point for Cipher Guard commands
///
/// Takes a Phoenix context and processes commands within it.
pub async fn act(ctx: &PhoenixContext) -> Result<Action> {
    // Early return for empty context
    if ctx.is_empty() {
        return Ok(Action::default());
    }
    
    // Try to get command text from context
    let command_text = match ctx.get("command") {
        Some(cmd) => cmd,
        None => {
            // No command found in context
            return Ok(Action {
                action_type: "unknown".to_string(),
                status: ActionStatus::Failure,
                message: "No command found in context".to_string(),
                details: None,
                operation_id: None,
            });
        }
    };
    
    // Process the command
    process_command(command_text, ctx).await
}

/// Process a command string with the provided context
pub async fn process_command(command: &str, ctx: &PhoenixContext) -> Result<Action> {
    // Get the Cipher Guard state
    let state = unsafe { get_state() }
        .context("Failed to get Cipher Guard state")?;
    
    // Create command context from Phoenix context
    let command_ctx = CommandContext {
        user: ctx.get("user").unwrap_or("anonymous").to_string(),
        timestamp: ctx.get("timestamp").unwrap_or_else(|| chrono::Utc::now().to_string()),
        backup_verified: ctx.get("backup_verified").map_or(false, |v| v == "true"),
        force_system_drive: ctx.get("force_system_drive").map_or(false, |v| v == "true"),
    };
    
    // Parse the command
    let parsed_command = match state.command_parser.parse_command(command, &command_ctx).await {
        Ok(cmd) => cmd,
        Err(e) => {
            return Ok(Action {
                action_type: "command_parsing".to_string(),
                status: ActionStatus::Failure,
                message: format!("Failed to parse command: {}", e),
                details: Some("Try using a command like 'Enable full disk encryption on Z:' or 'Check encryption status of D:'".to_string()),
                operation_id: None,
            });
        }
    };
    
    // Determine which type of command to process
    match parsed_command.command_type {
        crate::command_parser::CommandType::EnableDiskEncryption |
        crate::command_parser::CommandType::DisableDiskEncryption |
        crate::command_parser::CommandType::CheckEncryptionStatus |
        crate::command_parser::CommandType::ListEncryptedDrives |
        crate::command_parser::CommandType::MountEncryptedDrive |
        crate::command_parser::CommandType::UnmountEncryptedDrive => {
            process_disk_encryption_command(state, parsed_command).await
        }
        crate::command_parser::CommandType::SearchKnowledgeBase => {
            process_knowledge_base_search_command(state, parsed_command).await
        }
        crate::command_parser::CommandType::WriteToDesktop => {
            process_write_to_desktop_command(state, parsed_command).await
        }
        crate::command_parser::CommandType::Other(_) => {
            Ok(Action {
                action_type: "unknown_command".to_string(),
                status: ActionStatus::Failure,
                message: "Command type is not supported".to_string(),
                details: None,
                operation_id: None,
            })
        }
    }
}

/// Process a disk encryption command
async fn process_disk_encryption_command(
    state: &mut CipherGuardState,
    parsed_command: ParsedCommand,
) -> Result<Action> {
    // Process the parsed command
    let response = match state.command_parser.process_command(parsed_command.clone(), &mut state.disk_encryption).await {
        Ok(resp) => resp,
        Err(e) => {
            return Ok(Action {
                action_type: parsed_command.command_type.to_string(),
                status: ActionStatus::Failure,
                message: format!("Command processing error: {}", e),
                details: Some("The command was recognized but could not be processed successfully".to_string()),
                operation_id: None,
            });
        }
    };
    
    // Convert the command response to an action
    Ok(response_to_action(response, &parsed_command))
}

/// Convert a command response to an action
fn response_to_action(response: CommandResponse, command: &ParsedCommand) -> Action {
    let status = if response.success {
        ActionStatus::Success
    } else if response.action_required.is_some() {
        ActionStatus::NeedsConfirmation
    } else {
        ActionStatus::Failure
    };
    
    Action {
        action_type: command.command_type.to_string(),
        status,
        message: response.message,
        details: response.details,
        operation_id: response.operation_id,
    }
    
    /// Process a knowledge base search command
    async fn process_knowledge_base_search_command(
        state: &mut CipherGuardState,
        parsed_command: ParsedCommand,
    ) -> Result<Action> {
        // Process the search command
        let response = match state.command_parser.process_kb_search(parsed_command.clone(), &state.knowledge_base).await {
            Ok(resp) => resp,
            Err(e) => {
                return Ok(Action {
                    action_type: parsed_command.command_type.to_string(),
                    status: ActionStatus::Failure,
                    message: format!("Knowledge Base search error: {}", e),
                    details: Some("The search command could not be processed successfully".to_string()),
                    operation_id: None,
                });
            }
        };
        
        // Convert the command response to an action
        Ok(response_to_action(response, &parsed_command))
    }
}

/// Process a write to desktop command
async fn process_write_to_desktop_command(
    state: &mut CipherGuardState,
    parsed_command: ParsedCommand,
) -> Result<Action> {
    // Extract the filename parameter
    let filename = match parsed_command.get_parameter("filename") {
        Some(filename) => filename,
        None => {
            return Ok(Action {
                action_type: parsed_command.command_type.to_string(),
                status: ActionStatus::Failure,
                message: "Missing filename parameter".to_string(),
                details: Some("The command must specify a filename".to_string()),
                operation_id: None,
            });
        }
    };
    
    // Extract content if provided
    let content = parsed_command.get_parameter("content")
        .unwrap_or_else(|| "".to_string());
    
    // Get user from context
    let user = parsed_command.context.user.clone();
    
    // Write the file to the desktop
    match state.file_system.write_to_desktop(&filename, &content, &user).await {
        Ok(result) => {
            Ok(Action {
                action_type: parsed_command.command_type.to_string(),
                status: ActionStatus::Success,
                message: format!("File '{}' has been written to your Desktop", filename),
                details: if content.is_empty() {
                    Some("The file was created with empty content".to_string())
                } else {
                    Some(format!(
                        "The file was created with {} bytes of content at path: {}",
                        result.bytes_processed,
                        result.path.display()
                    ))
                },
                operation_id: None,
            })
        },
        Err(e) => {
            Ok(Action {
                action_type: parsed_command.command_type.to_string(),
                status: ActionStatus::Failure,
                message: format!("Failed to write file to Desktop: {}", e),
                details: Some("There was an error writing the file. Please check the filename is valid and try again.".to_string()),
                operation_id: None,
            })
        }
    }
}

/// Create an encryption context from a Phoenix context
pub fn create_encryption_context(ctx: &PhoenixContext) -> EncryptionContext {
    EncryptionContext {
        backup_verified: ctx.get("backup_verified").map_or(false, |v| v == "true"),
        force_system_drive: ctx.get("force_system_drive").map_or(false, |v| v == "true"),
        initiated_by: ctx.get("user").unwrap_or("anonymous").to_string(),
        purpose: ctx.get("purpose").unwrap_or("User-initiated encryption").to_string(),
        special_instructions: ctx.get("special_instructions").map(String::from),
        security_level: match ctx.get("security_level") {
            Some("maximum") => SecurityLevel::Maximum,
            Some("enhanced") => SecurityLevel::Enhanced,
            _ => SecurityLevel::Standard,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    
    fn create_test_context(command: &str) -> PhoenixContext {
        let mut data = HashMap::new();
        data.insert("command".to_string(), command.to_string());
        data.insert("user".to_string(), "test_user".to_string());
        data.insert("backup_verified".to_string(), "true".to_string());
        
        PhoenixContext::new(data)
    }
    
    #[tokio::test]
    async fn test_disk_encryption_command() {
        // Initialize Cipher Guard
        initialize().expect("Failed to initialize Cipher Guard");
        
        // Create a test context with a disk encryption command
        let ctx = create_test_context("enable full disk encryption on Z:");
        
        // Process the command
        let result = act(&ctx).await.expect("Command processing failed");
        
        // Verify the action type
        assert_eq!(result.action_type, "enable_disk_encryption");
    }
    
    #[tokio::test]
    async fn test_invalid_command() {
        // Initialize Cipher Guard
        initialize().expect("Failed to initialize Cipher Guard");
        
        // Create a test context with an invalid command
        let ctx = create_test_context("do something completely different");
        
        // Process the command
        let result = act(&ctx).await.expect("Command processing failed");
        
        // Verify the result indicates failure
        assert!(matches!(result.status, ActionStatus::Failure));
    }
    
    #[tokio::test]
    async fn test_write_to_desktop_command() {
        // Initialize Cipher Guard
        initialize().expect("Failed to initialize Cipher Guard");
        
        // Create a test context with a write to desktop command
        let ctx = create_test_context("write a file called test.txt to my desktop");
        
        // Process the command
        let result = act(&ctx).await.expect("Command processing failed");
        
        // Verify the action type (we don't verify success because it depends on permissions)
        assert_eq!(result.action_type, "write_to_desktop");
    }
}