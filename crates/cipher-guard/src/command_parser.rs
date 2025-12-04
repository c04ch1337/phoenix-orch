//! Command Parser for Cipher Guard
//!
//! Parses natural language commands and routes them to appropriate modules

use crate::disk_encryption::{
    DiskEncryptionSystem, DiskEncryptionRequest, EncryptionContext,
    DiskEncryptionConfig, SecurityLevel, DiskEncryptionError
};
use crate::ethics::{EthicalFramework, DefensiveAction, ImpactCategory};
use crate::knowledge_base::{self, SearchResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use thiserror::Error;
use regex::Regex;
use lazy_static::lazy_static;

/// Command parser for interpreting natural language requests
pub struct CommandParser {
    /// Reference to ethical framework for command evaluation
    ethical_framework: EthicalFramework,
    /// Command matchers for different command types
    command_matchers: Vec<CommandMatcher>,
}

impl CommandParser {
    /// Create a new command parser
    pub fn new(ethical_framework: EthicalFramework) -> Self {
        Self {
            ethical_framework,
            command_matchers: Self::initialize_matchers(),
        }
    }
    
    /// Parse a natural language command
    pub async fn parse_command(
        &self,
        command: &str,
        context: &CommandContext
    ) -> Result<ParsedCommand, CommandParserError> {
        let command = command.trim();
        
        // Try each matcher until we find one that matches
        for matcher in &self.command_matchers {
            if let Some(captures) = matcher.regex.captures(command) {
                let command_type = matcher.command_type.clone();
                let mut parameters = HashMap::new();
                
                // Extract named capture groups as parameters
                for name in matcher.regex.capture_names().flatten() {
                    if let Some(value) = captures.name(name) {
                        parameters.insert(name.to_string(), value.as_str().to_string());
                    }
                }
                
                return Ok(ParsedCommand {
                    original_command: command.to_string(),
                    command_type,
                    parameters,
                    context: context.clone(),
                });
            }
        }
        
        // No matcher found
        Err(CommandParserError::UnrecognizedCommand(command.to_string()))
    }
    
    /// Process a parsed command by routing it to the appropriate handler
    pub async fn process_command(
        &self,
        parsed_command: ParsedCommand,
        disk_encryption: &mut DiskEncryptionSystem,
    ) -> Result<CommandResponse, CommandParserError> {
        // First, evaluate the command against ethical framework
        let command_action = self.transform_to_defensive_action(&parsed_command)?;
        let evaluation = self.ethical_framework.evaluate_action(&command_action);
        
        // If command doesn't meet ethical requirements, reject it
        if evaluation.overall_score < 0.7 {
            return Err(CommandParserError::EthicalViolation(
                format!("Command violates ethical guidelines. Score: {}", evaluation.overall_score)
            ));
        }
        
        // Process based on command type
        match parsed_command.command_type {
            CommandType::EnableDiskEncryption => {
                self.handle_enable_disk_encryption(parsed_command, disk_encryption).await
            },
            CommandType::DisableDiskEncryption => {
                self.handle_disable_disk_encryption(parsed_command, disk_encryption).await
            },
            CommandType::CheckEncryptionStatus => {
                self.handle_check_encryption_status(parsed_command, disk_encryption).await
            },
            CommandType::ListEncryptedDrives => {
                self.handle_list_encrypted_drives(parsed_command, disk_encryption).await
            },
            CommandType::MountEncryptedDrive => {
                self.handle_mount_encrypted_drive(parsed_command, disk_encryption).await
            },
            CommandType::UnmountEncryptedDrive => {
                self.handle_unmount_encrypted_drive(parsed_command, disk_encryption).await
            },
            CommandType::WriteToDesktop => {
                self.handle_write_to_desktop(parsed_command).await
            },
            _ => Err(CommandParserError::UnsupportedCommand(
                format!("Command type {:?} not supported", parsed_command.command_type)
            )),
        }
    }
}

/// Process Knowledge Base search commands
pub async fn process_kb_search(
    &self,
    parsed_command: ParsedCommand,
    knowledge_base: &Arc<RwLock<knowledge_base::KnowledgeBase>>,
) -> Result<CommandResponse, CommandParserError> {
    // First, evaluate the command against ethical framework (simplified for KB searches)
    let command_action = self.transform_to_defensive_action(&parsed_command)?;
    let evaluation = self.ethical_framework.evaluate_action(&command_action);
    
    // If command doesn't meet ethical requirements, reject it
    if evaluation.overall_score < 0.7 {
        return Err(CommandParserError::EthicalViolation(
            format!("Command violates ethical guidelines. Score: {}", evaluation.overall_score)
        ));
    }
    
    // Extract KB name and query from parameters
    let kb_name = parsed_command.get_parameter("kb_name")
        .ok_or_else(|| CommandParserError::MissingParameter("kb_name".to_string()))?;
    
    let query = parsed_command.get_parameter("query")
        .ok_or_else(|| CommandParserError::MissingParameter("query".to_string()))?;
    
    // Determine if this is an exact match search
    let exact_match = query.starts_with("\"") && query.ends_with("\"");
    let query = if exact_match {
        // Remove the quotes for exact matching
        query[1..query.len()-1].to_string()
    } else {
        query
    };
    
    // Perform the search
    let kb = knowledge_base.read().map_err(|_| {
        CommandParserError::Other("Failed to acquire read lock on Knowledge Base".to_string())
    })?;
    
    match kb.search(&kb_name, &query, exact_match) {
        Ok(results) if results.is_empty() => {
            Ok(CommandResponse {
                success: true,
                message: format!("No results found for '{}' in '{}'", query, kb_name),
                details: Some("Try broadening your search or using different terms.".to_string()),
                action_required: None,
                operation_id: None,
            })
        },
        Ok(results) => {
            // Format the results
            let formatted_results = format_search_results(&results, &query);
            
            Ok(CommandResponse {
                success: true,
                message: format!("Found {} results for '{}' in '{}'", results.len(), query, kb_name),
                details: Some(formatted_results),
                action_required: None,
                operation_id: None,
            })
        },
        Err(e) => {
            Ok(CommandResponse {
                success: false,
                message: format!("Failed to search for '{}' in '{}'", query, kb_name),
                details: Some(format!("Error: {}", e)),
                action_required: None,
                operation_id: None,
            })
        }
    }
    
    // Command handlers
    
    /// Handle enable disk encryption command
    async fn handle_enable_disk_encryption(
        &self,
        command: ParsedCommand,
        disk_encryption: &mut DiskEncryptionSystem,
    ) -> Result<CommandResponse, CommandParserError> {
        // Extract the drive path
        let drive_path = command.get_parameter("drive")
            .ok_or_else(|| CommandParserError::MissingParameter("drive".to_string()))?;
        
        // Prepare encryption context
        let context = EncryptionContext {
            backup_verified: command.context.backup_verified,
            force_system_drive: command.context.force_system_drive,
            initiated_by: command.context.user.clone(),
            purpose: "User-initiated disk encryption".to_string(),
            special_instructions: None,
            security_level: SecurityLevel::Enhanced, // Default to Enhanced security
        };
        
        // Start the encryption operation
        match disk_encryption.encrypt_drive(&drive_path, None, &context).await {
            Ok(operation) => Ok(CommandResponse {
                success: true,
                message: format!("Started encryption of drive {} (Operation ID: {})", 
                    drive_path, operation.id),
                details: Some(format!("Encryption is now initializing. The operation will continue in the background.")),
                action_required: Some("You should monitor the encryption progress by checking status periodically.".to_string()),
                operation_id: Some(operation.id.to_string()),
            }),
            
            Err(e) => {
                match e {
                    DiskEncryptionError::DriveAlreadyEncrypted(_) => {
                        Ok(CommandResponse {
                            success: false,
                            message: format!("Drive {} is already encrypted", drive_path),
                            details: Some("The drive appears to be already encrypted by Cipher Guard.".to_string()),
                            action_required: None,
                            operation_id: None,
                        })
                    },
                    DiskEncryptionError::SystemDriveEncryption(_) => {
                        Ok(CommandResponse {
                            success: false,
                            message: format!("Drive {} is a system drive and cannot be encrypted without explicit confirmation", drive_path),
                            details: Some("System drives require additional safety checks before encryption.".to_string()),
                            action_required: Some("Add 'force_system_drive: true' to context if you want to proceed.".to_string()),
                            operation_id: None,
                        })
                    },
                    DiskEncryptionError::BackupRequired(_) => {
                        Ok(CommandResponse {
                            success: false,
                            message: format!("Backup verification required before encrypting drive {}", drive_path),
                            details: Some("For data safety, a backup must be verified before encryption.".to_string()),
                            action_required: Some("Add 'backup_verified: true' to context after ensuring a backup exists.".to_string()),
                            operation_id: None,
                        })
                    },
                    _ => Err(CommandParserError::DiskEncryptionError(e)),
                }
            }
        }
    }
    
    /// Handle disable disk encryption command
    async fn handle_disable_disk_encryption(
        &self,
        command: ParsedCommand,
        _disk_encryption: &mut DiskEncryptionSystem,
    ) -> Result<CommandResponse, CommandParserError> {
        // Extract the drive path
        let drive_path = command.get_parameter("drive")
            .ok_or_else(|| CommandParserError::MissingParameter("drive".to_string()))?;
        
        // This would call disk_encryption.decrypt_drive() in a real implementation
        
        // For now, return a not implemented response
        Ok(CommandResponse {
            success: false,
            message: format!("Decryption of drive {} is not yet implemented", drive_path),
            details: Some("This feature will be available in a future update.".to_string()),
            action_required: None,
            operation_id: None,
        })
    }
    
    /// Handle check encryption status command
    async fn handle_check_encryption_status(
        &self,
        command: ParsedCommand,
        disk_encryption: &mut DiskEncryptionSystem,
    ) -> Result<CommandResponse, CommandParserError> {
        // Extract the drive path
        let drive_path = command.get_parameter("drive")
            .ok_or_else(|| CommandParserError::MissingParameter("drive".to_string()))?;
        
        // Check if the drive is encrypted
        if let Some(drive_info) = disk_encryption.encrypted_drives.get(&drive_path) {
            Ok(CommandResponse {
                success: true,
                message: format!("Drive {} is encrypted", drive_path),
                details: Some(format!(
                    "Encryption details:\n- Date: {}\n- Algorithm: {:?}\n- Mount status: {:?}\n- Last validated: {}",
                    drive_info.encryption_date, drive_info.algorithm, drive_info.mount_status, drive_info.last_validated
                )),
                action_required: None,
                operation_id: None,
            })
        } else {
            Ok(CommandResponse {
                success: true,
                message: format!("Drive {} is not encrypted", drive_path),
                details: Some("No encryption records found for this drive.".to_string()),
                action_required: None,
                operation_id: None,
            })
        }
    }
    
    /// Handle list encrypted drives command
    async fn handle_list_encrypted_drives(
        &self,
        _command: ParsedCommand,
        disk_encryption: &mut DiskEncryptionSystem,
    ) -> Result<CommandResponse, CommandParserError> {
        let drives = disk_encryption.list_encrypted_drives();
        
        if drives.is_empty() {
            Ok(CommandResponse {
                success: true,
                message: "No encrypted drives found".to_string(),
                details: None,
                action_required: None,
                operation_id: None,
            })
        } else {
            let drive_list: Vec<String> = drives.iter()
                .map(|drive| format!(
                    "- {}: encrypted on {} using {:?}", 
                    drive.drive_path, drive.encryption_date.date(), drive.algorithm
                ))
                .collect();
            
            Ok(CommandResponse {
                success: true,
                message: format!("{} encrypted drives found", drives.len()),
                details: Some(drive_list.join("\n")),
                action_required: None,
                operation_id: None,
            })
        }
    }
    
    /// Handle mount encrypted drive command
    async fn handle_mount_encrypted_drive(
        &self,
        command: ParsedCommand,
        disk_encryption: &mut DiskEncryptionSystem,
    ) -> Result<CommandResponse, CommandParserError> {
        // Extract the drive path
        let drive_path = command.get_parameter("drive")
            .ok_or_else(|| CommandParserError::MissingParameter("drive".to_string()))?;
        
        // Extract password if provided
        let password = command.get_parameter("password");
        
        // Try to mount the drive
        match disk_encryption.mount_encrypted_drive(&drive_path, password).await {
            Ok(()) => Ok(CommandResponse {
                success: true,
                message: format!("Drive {} successfully mounted", drive_path),
                details: Some("The drive is now accessible.".to_string()),
                action_required: None,
                operation_id: None,
            }),
            
            Err(e) => match e {
                DiskEncryptionError::DriveNotEncrypted(_) => {
                    Ok(CommandResponse {
                        success: false,
                        message: format!("Drive {} is not encrypted", drive_path),
                        details: Some("Cannot mount an unencrypted drive.".to_string()),
                        action_required: Some("Encrypt the drive first using 'Enable full disk encryption'.".to_string()),
                        operation_id: None,
                    })
                },
                DiskEncryptionError::AuthenticationFailed(_) => {
                    Ok(CommandResponse {
                        success: false,
                        message: format!("Authentication failed for drive {}", drive_path),
                        details: Some("Could not authenticate with the provided credentials.".to_string()),
                        action_required: Some("Try again with the correct password.".to_string()),
                        operation_id: None,
                    })
                },
                _ => Err(CommandParserError::DiskEncryptionError(e)),
            },
        }
    }
    
    /// Handle unmount encrypted drive command
    async fn handle_unmount_encrypted_drive(
        &self,
        command: ParsedCommand,
        disk_encryption: &mut DiskEncryptionSystem,
    ) -> Result<CommandResponse, CommandParserError> {
        // Extract the drive path
        let drive_path = command.get_parameter("drive")
            .ok_or_else(|| CommandParserError::MissingParameter("drive".to_string()))?;
        
        // Try to unmount the drive
        match disk_encryption.unmount_encrypted_drive(&drive_path).await {
            Ok(()) => Ok(CommandResponse {
                success: true,
                message: format!("Drive {} successfully unmounted", drive_path),
                details: Some("The drive is now inaccessible until mounted again.".to_string()),
                action_required: None,
                operation_id: None,
            }),
            
            Err(e) => match e {
                DiskEncryptionError::DriveNotEncrypted(_) => {
                    Ok(CommandResponse {
                        success: false,
                        message: format!("Drive {} is not encrypted", drive_path),
                        details: Some("Cannot unmount an unencrypted drive.".to_string()),
                        action_required: None,
                        operation_id: None,
                    })
                },
                _ => Err(CommandParserError::DiskEncryptionError(e)),
            },
        }
    }
    
    // Helper methods
    
    /// Initialize command matchers
    fn initialize_matchers() -> Vec<CommandMatcher> {
        let mut matchers = Vec::new();
        
        // Knowledge Base search commands
        matchers.push(CommandMatcher {
            regex: Regex::new(r"(?i)search\s+my\s+(?P<kb_name>[\w\s]+?\s+kb)(\s+for|\s+about)?\s+(?P<query>.+)").unwrap(),
            command_type: CommandType::SearchKnowledgeBase,
        });
        
        matchers.push(CommandMatcher {
            regex: Regex::new(r"(?i)find\s+(?P<query>.+)\s+in\s+my\s+(?P<kb_name>[\w\s]+?\s+kb)").unwrap(),
            command_type: CommandType::SearchKnowledgeBase,
        });
        
        matchers.push(CommandMatcher {
            regex: Regex::new(r"(?i)lookup\s+(?P<query>.+)\s+in\s+(?P<kb_name>[\w\s]+?\s+kb)").unwrap(),
            command_type: CommandType::SearchKnowledgeBase,
        });
        
        // Enable disk encryption commands
        matchers.push(CommandMatcher {
            regex: Regex::new(r"(?i)enable\s+(full\s+)?disk\s+encryption\s+on\s+(?P<drive>[a-zA-Z]:|\\\\.+)").unwrap(),
            command_type: CommandType::EnableDiskEncryption,
        });
        
        matchers.push(CommandMatcher {
            regex: Regex::new(r"(?i)encrypt\s+(drive|disk)\s+(?P<drive>[a-zA-Z]:|\\\\.+)").unwrap(),
            command_type: CommandType::EnableDiskEncryption,
        });
        
        // Disable disk encryption commands
        matchers.push(CommandMatcher {
            regex: Regex::new(r"(?i)disable\s+(full\s+)?disk\s+encryption\s+on\s+(?P<drive>[a-zA-Z]:|\\\\.+)").unwrap(),
            command_type: CommandType::DisableDiskEncryption,
        });
        
        matchers.push(CommandMatcher {
            regex: Regex::new(r"(?i)decrypt\s+(drive|disk)\s+(?P<drive>[a-zA-Z]:|\\\\.+)").unwrap(),
            command_type: CommandType::DisableDiskEncryption,
        });
        
        // Check encryption status
        matchers.push(CommandMatcher {
            regex: Regex::new(r"(?i)check\s+(disk\s+)?encryption\s+(status|state)\s+of\s+(?P<drive>[a-zA-Z]:|\\\\.+)").unwrap(),
            command_type: CommandType::CheckEncryptionStatus,
        });
        
        matchers.push(CommandMatcher {
            regex: Regex::new(r"(?i)is\s+(drive|disk)\s+(?P<drive>[a-zA-Z]:|\\\\.+)\s+encrypted").unwrap(),
            command_type: CommandType::CheckEncryptionStatus,
        });
        
        // List encrypted drives
        matchers.push(CommandMatcher {
            regex: Regex::new(r"(?i)list\s+(all\s+)?(encrypted\s+drives|drive\s+encryption)").unwrap(),
            command_type: CommandType::ListEncryptedDrives,
        });
        
        matchers.push(CommandMatcher {
            regex: Regex::new(r"(?i)show\s+(all\s+)?encrypted\s+drives").unwrap(),
            command_type: CommandType::ListEncryptedDrives,
        });
        
        // Mount encrypted drive
        matchers.push(CommandMatcher {
            regex: Regex::new(r"(?i)mount\s+(encrypted\s+)?drive\s+(?P<drive>[a-zA-Z]:|\\\\.+)(\s+with\s+password\s+(?P<password>.+))?").unwrap(),
            command_type: CommandType::MountEncryptedDrive,
        });
        
        // Unmount encrypted drive
        matchers.push(CommandMatcher {
            regex: Regex::new(r"(?i)unmount\s+(encrypted\s+)?drive\s+(?P<drive>[a-zA-Z]:|\\\\.+)").unwrap(),
            command_type: CommandType::UnmountEncryptedDrive,
        });
        
        // Write to Desktop commands
        matchers.push(CommandMatcher {
            regex: Regex::new(r"(?i)write\s+(a\s+)?file\s+called\s+(?P<filename>[^\s\/\\:*?"<>|]+(\.[^\s\/\\:*?"<>|]+)?)\s+to\s+(my\s+)?desktop").unwrap(),
            command_type: CommandType::WriteToDesktop,
        });

        matchers.push(CommandMatcher {
            regex: Regex::new(r"(?i)create\s+(a\s+)?file\s+(?P<filename>[^\s\/\\:*?"<>|]+(\.[^\s\/\\:*?"<>|]+)?)\s+on\s+(my\s+)?desktop").unwrap(),
            command_type: CommandType::WriteToDesktop,
        });

        matchers.push(CommandMatcher {
            regex: Regex::new(r"(?i)save\s+(a\s+)?file\s+(?P<filename>[^\s\/\\:*?"<>|]+(\.[^\s\/\\:*?"<>|]+)?)\s+to\s+(my\s+)?desktop").unwrap(),
            command_type: CommandType::WriteToDesktop,
        });

        // Write to Desktop with content
        matchers.push(CommandMatcher {
            regex: Regex::new(r"(?i)write\s+(a\s+)?file\s+called\s+(?P<filename>[^\s\/\\:*?"<>|]+(\.[^\s\/\\:*?"<>|]+)?)\s+to\s+(my\s+)?desktop\s+with\s+content\s+(?P<content>.+)").unwrap(),
            command_type: CommandType::WriteToDesktop,
        });

        matchers.push(CommandMatcher {
            regex: Regex::new(r"(?i)create\s+(a\s+)?file\s+(?P<filename>[^\s\/\\:*?"<>|]+(\.[^\s\/\\:*?"<>|]+)?)\s+on\s+(my\s+)?desktop\s+with\s+content\s+(?P<content>.+)").unwrap(),
            command_type: CommandType::WriteToDesktop,
        });

        matchers.push(CommandMatcher {
            regex: Regex::new(r"(?i)save\s+(a\s+)?file\s+(?P<filename>[^\s\/\\:*?"<>|]+(\.[^\s\/\\:*?"<>|]+)?)\s+to\s+(my\s+)?desktop\s+with\s+content\s+(?P<content>.+)").unwrap(),
            command_type: CommandType::WriteToDesktop,
        });

        matchers.push(CommandMatcher {
            regex: Regex::new(r"(?i)write\s+(?P<content>.+)\s+to\s+(a\s+)?file\s+called\s+(?P<filename>[^\s\/\\:*?"<>|]+(\.[^\s\/\\:*?"<>|]+)?)\s+on\s+(my\s+)?desktop").unwrap(),
            command_type: CommandType::WriteToDesktop,
        });

        matchers
    }

    /// Handle writing a file to the Desktop
    async fn handle_write_to_desktop(
        &self,
        command: ParsedCommand,
    ) -> Result<CommandResponse, CommandParserError> {
        // Extract the filename
        let filename = command.get_parameter("filename")
            .ok_or_else(|| CommandParserError::MissingParameter("filename".to_string()))?;
        
        // Extract content if provided
        let content = command.get_parameter("content")
            .unwrap_or_else(|| "".to_string());

        // In a future implementation, we would call a file system service here
        // For now, we'll return a placeholder response indicating that the
        // command was recognized but functionality is coming soon
        
        Ok(CommandResponse {
            success: true,
            message: format!("File '{}' will be written to Desktop", filename),
            details: if content.is_empty() {
                Some("The file will be created empty. You can provide content with the 'with content' phrase.".to_string())
            } else {
                Some(format!("The file will contain the following content: '{}'", content))
            },
            action_required: None,
            operation_id: None,
        })
    }
    
    /// Transform a parsed command into a defensive action for ethical evaluation
    fn transform_to_defensive_action(&self, command: &ParsedCommand) -> Result<DefensiveAction, CommandParserError> {
        // Create estimated impact based on command type
        let mut estimated_impact = HashMap::new();
        
        match command.command_type {
            CommandType::EnableDiskEncryption => {
                estimated_impact.insert(ImpactCategory::Data, 0.7); // High data impact
                estimated_impact.insert(ImpactCategory::Systems, 0.5); // Medium system impact
                estimated_impact.insert(ImpactCategory::Operations, 0.3); // Low operations impact
                estimated_impact.insert(ImpactCategory::Privacy, 0.1); // Positive privacy impact
            },
            CommandType::DisableDiskEncryption => {
                estimated_impact.insert(ImpactCategory::Data, 0.6); // Medium-high data impact
                estimated_impact.insert(ImpactCategory::Systems, 0.4); // Medium system impact
                estimated_impact.insert(ImpactCategory::Operations, 0.3); // Low operations impact
                estimated_impact.insert(ImpactCategory::Privacy, 0.7); // High privacy impact (negative)
            },
            _ => {
                // Lower impact for read-only operations
                estimated_impact.insert(ImpactCategory::Data, 0.1);
                estimated_impact.insert(ImpactCategory::Systems, 0.1);
                estimated_impact.insert(ImpactCategory::Operations, 0.1);
                estimated_impact.insert(ImpactCategory::Privacy, 0.1);
            },
        }
        
        // Get drive path if available
        let target_scope = if let Some(drive) = command.get_parameter("drive") {
            format!("disk:{}", drive)
        } else {
            "disk:all".to_string()
        };
        
        // Create action safeguards
        let mut safeguards = Vec::new();
        safeguards.push("data_backup_recommended".to_string());
        safeguards.push("user_consent_required".to_string());
        
        if command.context.backup_verified {
            safeguards.push("backup_verified".to_string());
        }
        
        // Create defensive action
        Ok(DefensiveAction {
            action_type: command.command_type.to_string(),
            target_scope,
            estimated_impact,
            safeguards,
        })
    }
}

/// Regular expression matcher for commands
struct CommandMatcher {
    /// Regex pattern to match commands
    regex: Regex,
    /// Command type for matched commands
    command_type: CommandType,
}

/// Supported command types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CommandType {
    /// Enable full disk encryption
    EnableDiskEncryption,
    /// Disable disk encryption
    DisableDiskEncryption,
    /// Check encryption status
    CheckEncryptionStatus,
    /// List all encrypted drives
    ListEncryptedDrives,
    /// Mount an encrypted drive
    MountEncryptedDrive,
    /// Unmount an encrypted drive
    UnmountEncryptedDrive,
    /// Search the Knowledge Base
    SearchKnowledgeBase,
    /// Write a file to the Desktop
    WriteToDesktop,
    /// Other commands not related to disk encryption
    Other(String),
}

impl ToString for CommandType {
    fn to_string(&self) -> String {
        match self {
            CommandType::EnableDiskEncryption => "enable_disk_encryption".to_string(),
            CommandType::DisableDiskEncryption => "disable_disk_encryption".to_string(),
            CommandType::CheckEncryptionStatus => "check_encryption_status".to_string(),
            CommandType::ListEncryptedDrives => "list_encrypted_drives".to_string(),
            CommandType::MountEncryptedDrive => "mount_encrypted_drive".to_string(),
            CommandType::UnmountEncryptedDrive => "unmount_encrypted_drive".to_string(),
            CommandType::SearchKnowledgeBase => "search_knowledge_base".to_string(),
            CommandType::WriteToDesktop => "write_to_desktop".to_string(),
            CommandType::Other(cmd) => format!("other:{}", cmd),
        }
    }
}

/// A command that has been parsed from natural language
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedCommand {
    /// Original command text
    pub original_command: String,
    /// Type of command
    pub command_type: CommandType,
    /// Parameters extracted from the command
    pub parameters: HashMap<String, String>,
    /// Context for the command
    pub context: CommandContext,
}

impl ParsedCommand {
    /// Get a parameter by name
    pub fn get_parameter(&self, name: &str) -> Option<String> {
        self.parameters.get(name).cloned()
    }
}

/// Context for command execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandContext {
    /// User who issued the command
    pub user: String,
    /// Timestamp when the command was issued
    pub timestamp: String,
    /// Whether a backup has been verified
    pub backup_verified: bool,
    /// Whether to force system drive encryption
    pub force_system_drive: bool,
}

/// Response to a processed command
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResponse {
    /// Whether the command was successful
    pub success: bool,
    /// Main response message
    pub message: String,
    /// Additional details about the response
    pub details: Option<String>,
    /// Next steps for the user
    pub action_required: Option<String>,
    /// Operation ID for async operations
    pub operation_id: Option<String>,
}

/// Format search results in a human-readable format
fn format_search_results(results: &[SearchResult], query: &str) -> String {
    let mut formatted = String::new();
    
    for (i, result) in results.iter().enumerate() {
        // Add result header with title and relevance
        formatted.push_str(&format!("Result {}: {} (Relevance: {:.2})\n",
            i + 1,
            result.title,
            result.relevance_score
        ));
        
        // Add context with highlighted match
        let highlighted_context = highlight_match_in_context(&result.context, &result.matching_content);
        formatted.push_str(&format!("Context: {}\n\n", highlighted_context));
    }
    
    // Add search tips
    formatted.push_str("\nTip: For exact phrase matching, surround your query with quotes.");
    
    formatted
}

/// Highlight the matching text in the context
fn highlight_match_in_context(context: &str, matching_text: &str) -> String {
    // Simple implementation: just surround the matching text with asterisks
    // In a real UI, this would be rendered with proper highlighting
    context.replace(matching_text, &format!("**{}**", matching_text))
}

/// Errors that can occur during command parsing
#[derive(Debug, Error)]
pub enum CommandParserError {
    /// Command not recognized
    #[error("Unrecognized command: {0}")]
    UnrecognizedCommand(String),
    
    /// Missing required parameter
    #[error("Missing required parameter: {0}")]
    MissingParameter(String),
    
    /// Command violates ethical guidelines
    #[error("Ethical violation: {0}")]
    EthicalViolation(String),
    
    /// Command not supported
    #[error("Unsupported command: {0}")]
    UnsupportedCommand(String),
    
    /// Invalid parameter value
    #[error("Invalid parameter: {0}")]
    InvalidParameter(String),
    
    /// Disk encryption error
    #[error("Disk encryption error: {0}")]
    DiskEncryptionError(#[from] DiskEncryptionError),
    
    /// Other error
    #[error("Error: {0}")]
    Other(String),
}

#[cfg(test)]
mod tests {
    use super::*;
    
    fn create_test_parser() -> CommandParser {
        CommandParser::new(EthicalFramework::new())
    }
    
    fn create_test_context() -> CommandContext {
        CommandContext {
            user: "test_user".to_string(),
            timestamp: "2025-12-01T00:00:00Z".to_string(),
            backup_verified: true,
            force_system_drive: false,
        }
    }
    
    #[tokio::test]
    async fn test_parse_enable_encryption_command() {
        let parser = create_test_parser();
        let context = create_test_context();
        
        let result = parser.parse_command("enable full disk encryption on Z:", &context).await;
        assert!(result.is_ok());
        
        let parsed = result.unwrap();
        assert_eq!(parsed.command_type, CommandType::EnableDiskEncryption);
        assert_eq!(parsed.get_parameter("drive"), Some("Z:".to_string()));
    }
    
    #[tokio::test]
    async fn test_parse_alternative_encrypt_command() {
        let parser = create_test_parser();
        let context = create_test_context();
        
        let result = parser.parse_command("encrypt drive Z:", &context).await;
        assert!(result.is_ok());
        
        let parsed = result.unwrap();
        assert_eq!(parsed.command_type, CommandType::EnableDiskEncryption);
        assert_eq!(parsed.get_parameter("drive"), Some("Z:".to_string()));
    }
    
    #[tokio::test]
    async fn test_parse_network_drive_command() {
        let parser = create_test_parser();
        let context = create_test_context();
        
        let result = parser.parse_command("enable disk encryption on \\\\server\\share", &context).await;
        assert!(result.is_ok());
        
        let parsed = result.unwrap();
        assert_eq!(parsed.command_type, CommandType::EnableDiskEncryption);
        assert_eq!(parsed.get_parameter("drive"), Some("\\\\server\\share".to_string()));
    }
    
    #[tokio::test]
    async fn test_unrecognized_command() {
        let parser = create_test_parser();
        let context = create_test_context();
        
        let result = parser.parse_command("do something completely different", &context).await;
        assert!(result.is_err());
        
        match result {
            Err(CommandParserError::UnrecognizedCommand(_)) => {},
            _ => panic!("Expected UnrecognizedCommand error"),
        }
    }
}