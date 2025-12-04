//! Terminal Agent Implementation
//!
//! This module contains the implementation of the Terminal Agent, which handles
//! execution of terminal commands for agents with user approval based on autonomy level.
//! It provides security features like dangerous command detection, scrollback history
//! tracking, and command result analysis.

use crate::modules::orchestrator::agent_manager::AgentManager;
use crate::modules::orchestrator::antigravity_core::{AgentInfo, AgentStatus, AntigravityCore};
use crate::modules::orchestrator::artifacts::{ArtifactSystem, ArtifactType};
use crate::modules::orchestrator::errors::{AgentErrorKind, PhoenixError, PhoenixResult};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::SystemTime;
use tokio::sync::{mpsc, RwLock};
use tokio::task::JoinHandle;
use uuid::Uuid;
use serde::{Deserialize, Serialize};

/// Terminal command execution autonomy level
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TerminalAutonomyLevel {
    /// No terminal access allowed
    Disabled,
    /// All commands require explicit approval
    RequireApproval,
    /// Only dangerous commands require approval
    ApproveHighRisk,
    /// Allow all commands without approval (use with caution)
    FullAccess,
}

impl std::fmt::Display for TerminalAutonomyLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TerminalAutonomyLevel::Disabled => write!(f, "Disabled"),
            TerminalAutonomyLevel::RequireApproval => write!(f, "RequireApproval"),
            TerminalAutonomyLevel::ApproveHighRisk => write!(f, "ApproveHighRisk"),
            TerminalAutonomyLevel::FullAccess => write!(f, "FullAccess"),
        }
    }
}

/// Command execution status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CommandStatus {
    /// Command is pending execution
    Pending,
    /// Command is awaiting approval
    AwaitingApproval,
    /// Command is currently executing
    Executing,
    /// Command was completed successfully
    Completed,
    /// Command failed
    Failed,
    /// Command was rejected (e.g., by user or security check)
    Rejected,
    /// Command was cancelled
    Cancelled,
}

impl std::fmt::Display for CommandStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CommandStatus::Pending => write!(f, "Pending"),
            CommandStatus::AwaitingApproval => write!(f, "AwaitingApproval"),
            CommandStatus::Executing => write!(f, "Executing"),
            CommandStatus::Completed => write!(f, "Completed"),
            CommandStatus::Failed => write!(f, "Failed"),
            CommandStatus::Rejected => write!(f, "Rejected"),
            CommandStatus::Cancelled => write!(f, "Cancelled"),
        }
    }
}

/// Risk level for a command
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CommandRiskLevel {
    /// Command is safe to execute
    Low,
    /// Command requires caution
    Medium,
    /// Command could be potentially dangerous
    High,
}

impl std::fmt::Display for CommandRiskLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CommandRiskLevel::Low => write!(f, "Low"),
            CommandRiskLevel::Medium => write!(f, "Medium"),
            CommandRiskLevel::High => write!(f, "High"),
        }
    }
}

/// Terminal command information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalCommand {
    /// Unique command ID
    pub id: String,
    /// Agent ID that requested the command
    pub agent_id: String,
    /// Task ID this command is associated with
    pub task_id: Option<String>,
    /// The actual command to execute
    pub command: String,
    /// Working directory for the command
    pub working_directory: Option<String>,
    /// Command execution status
    pub status: CommandStatus,
    /// When the command was requested
    pub requested_at: SystemTime,
    /// When the command was executed
    pub executed_at: Option<SystemTime>,
    /// When the command finished
    pub finished_at: Option<SystemTime>,
    /// Exit code from command
    pub exit_code: Option<i32>,
    /// Agent purpose for executing this command
    pub purpose: Option<String>,
    /// Detected risk level for the command
    pub risk_level: CommandRiskLevel,
    /// Additional command metadata
    pub metadata: HashMap<String, String>,
}

/// Command execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResult {
    /// Command ID
    pub command_id: String,
    /// Whether the command was successful
    pub success: bool,
    /// Exit code (if available)
    pub exit_code: Option<i32>,
    /// Stdout output
    pub stdout: String,
    /// Stderr output
    pub stderr: String,
    /// Execution duration in seconds
    pub duration: f64,
    /// Artifact ID for the command history
    pub artifact_id: Option<String>,
}

/// Terminal agent configuration
#[derive(Debug, Clone)]
pub struct TerminalAgentConfig {
    /// Default autonomy level for commands
    pub default_autonomy_level: TerminalAutonomyLevel,
    /// Maximum scrollback buffer size per command
    pub max_scrollback_size: usize,
    /// Automatically store command history as artifacts
    pub auto_store_history: bool,
    /// Maximum command runtime (in seconds)
    pub command_timeout_seconds: u64,
    /// Regex patterns for dangerous commands that always require approval
    pub dangerous_command_patterns: Vec<String>,
    /// Maximum command length for display
    pub max_command_display_length: usize,
}

impl Default for TerminalAgentConfig {
    fn default() -> Self {
        Self {
            default_autonomy_level: TerminalAutonomyLevel::RequireApproval,
            max_scrollback_size: 1024 * 1024, // 1MB scrollback buffer
            auto_store_history: true,
            command_timeout_seconds: 300, // 5 minutes
            dangerous_command_patterns: vec![
                r"^sudo\s".to_string(),
                r"rm\s+(-r[f]*|-f[r]*)\s+/".to_string(),
                r"chmod\s+777".to_string(),
                r"dd\s+if=.*\s+of=/dev".to_string(),
                r"mkfs".to_string(),
                r">>\s*/etc/".to_string(),
                r">\s*/etc/".to_string(),
            ],
            max_command_display_length: 100,
        }
    }
}

/// Command approval request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandApprovalRequest {
    /// Command ID
    pub command_id: String,
    /// Agent ID
    pub agent_id: String,
    /// Command to execute
    pub command: String,
    /// Working directory
    pub working_directory: Option<String>,
    /// Agent's purpose for the command
    pub purpose: Option<String>,
    /// Risk level
    pub risk_level: CommandRiskLevel,
    /// When the request was created
    pub requested_at: SystemTime,
}

/// Command approval response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandApprovalResponse {
    /// Command ID
    pub command_id: String,
    /// Whether the command is approved
    pub approved: bool,
    /// Optional reason for rejection
    pub rejection_reason: Option<String>,
    /// When the response was created
    pub responded_at: SystemTime,
}

/// Terminal Agent component
pub struct TerminalAgent {
    /// Reference to AntigravityCore
    core: Arc<AntigravityCore>,
    /// Reference to AgentManager
    agent_manager: Arc<AgentManager>,
    /// Reference to ArtifactSystem
    artifact_system: Arc<ArtifactSystem>,
    /// Configuration
    config: TerminalAgentConfig,
    /// Command registry - stores all commands executed through the agent
    commands: Arc<RwLock<HashMap<String, TerminalCommand>>>,
    /// Agent-specific autonomy levels - overrides the default level
    agent_autonomy: Arc<RwLock<HashMap<String, TerminalAutonomyLevel>>>,
    /// Pending approval requests (command_id -> tx channel)
    pending_approvals: Arc<RwLock<HashMap<String, mpsc::Sender<CommandApprovalResponse>>>>,
    /// Is agent running
    is_running: Arc<RwLock<bool>>,
    /// Background task handles
    background_tasks: Arc<RwLock<Vec<JoinHandle<()>>>>,
}

impl TerminalAgent {
    /// Create a new Terminal Agent
    pub fn new(
        core: Arc<AntigravityCore>,
        agent_manager: Arc<AgentManager>,
        artifact_system: Arc<ArtifactSystem>,
        config: Option<TerminalAgentConfig>,
    ) -> Self {
        Self {
            core,
            agent_manager,
            artifact_system,
            config: config.unwrap_or_default(),
            commands: Arc::new(RwLock::new(HashMap::new())),
            agent_autonomy: Arc::new(RwLock::new(HashMap::new())),
            pending_approvals: Arc::new(RwLock::new(HashMap::new())),
            is_running: Arc::new(RwLock::new(false)),
            background_tasks: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Start the Terminal Agent
    pub async fn start(&self) -> PhoenixResult<()> {
        // Check if already running
        {
            let running = self.is_running.read().await;
            if *running {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::AlreadyRunning,
                    message: "Terminal Agent is already running".to_string(),
                    component: "TerminalAgent".to_string(),
                });
            }
        }

        // Mark as running
        {
            let mut running = self.is_running.write().await;
            *running = true;
        }

        // Start background cleanup task for expired approvals
        self.start_cleanup_task().await;

        Ok(())
    }

    /// Stop the Terminal Agent
    pub async fn stop(&self) -> PhoenixResult<()> {
        // Check if running
        {
            let running = self.is_running.read().await;
            if !*running {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::NotRunning,
                    message: "Terminal Agent is not running".to_string(),
                    component: "TerminalAgent".to_string(),
                });
            }
        }

        // Mark as not running
        {
            let mut running = self.is_running.write().await;
            *running = false;
        }

        // Cancel all background tasks
        {
            let mut tasks = self.background_tasks.write().await;
            for task in tasks.drain(..) {
                task.abort();
            }
        }

        // Cancel all pending approvals
        {
            let mut approvals = self.pending_approvals.write().await;
            for (command_id, _) in approvals.drain() {
                let mut commands = self.commands.write().await;
                if let Some(cmd) = commands.get_mut(&command_id) {
                    cmd.status = CommandStatus::Cancelled;
                }
            }
        }

        Ok(())
    }

    /// Start background cleanup task for expired approvals
    async fn start_cleanup_task(&self) {
        let commands = Arc::clone(&self.commands);
        let pending_approvals = Arc::clone(&self.pending_approvals);
        let is_running = Arc::clone(&self.is_running);

        let handle = tokio::spawn(async move {
            while *is_running.read().await {
                // Sleep for 1 minute before checking
                tokio::time::sleep(std::time::Duration::from_secs(60)).await;

                let now = SystemTime::now();
                let expired_commands = {
                    let commands_map = commands.read().await;
                    let mut expired = Vec::new();

                    for (id, cmd) in commands_map.iter() {
                        if cmd.status == CommandStatus::AwaitingApproval {
                            if let Ok(elapsed) = now.duration_since(cmd.requested_at) {
                                // Expire commands waiting for approval for more than 30 minutes
                                if elapsed.as_secs() > 1800 {
                                    expired.push(id.clone());
                                }
                            }
                        }
                    }

                    expired
                };

                // Cancel expired commands
                if !expired_commands.is_empty() {
                    let mut commands_map = commands.write().await;
                    let mut approvals_map = pending_approvals.write().await;

                    for id in expired_commands {
                        if let Some(cmd) = commands_map.get_mut(&id) {
                            cmd.status = CommandStatus::Cancelled;
                            cmd.metadata.insert("cancelled_reason".to_string(), "Approval request expired".to_string());
                        }
                        approvals_map.remove(&id);
                    }
                }
            }
        });

        // Store task handle
        let mut tasks = self.background_tasks.write().await;
        tasks.push(handle);
    }

    /// Set autonomy level for a specific agent
    pub async fn set_agent_autonomy(
        &self,
        agent_id: &str,
        level: TerminalAutonomyLevel,
    ) -> PhoenixResult<()> {
        // Validate agent exists
        self.agent_manager.get_agent(agent_id).await?;

        // Update autonomy level
        let mut autonomy_map = self.agent_autonomy.write().await;
        autonomy_map.insert(agent_id.to_string(), level);

        Ok(())
    }

    /// Get autonomy level for an agent (uses default if not explicitly set)
    pub async fn get_agent_autonomy(&self, agent_id: &str) -> TerminalAutonomyLevel {
        let autonomy_map = self.agent_autonomy.read().await;
        autonomy_map
            .get(agent_id)
            .copied()
            .unwrap_or(self.config.default_autonomy_level)
    }

    /// Execute a terminal command for an agent
    pub async fn execute_command(
        &self,
        agent_id: &str,
        command: &str,
        working_directory: Option<&str>,
        purpose: Option<&str>,
        task_id: Option<&str>,
        metadata: Option<HashMap<String, String>>,
    ) -> PhoenixResult<CommandResult> {
        // Check if terminal agent is running
        {
            let running = self.is_running.read().await;
            if !*running {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::NotRunning,
                    message: "Terminal Agent is not running".to_string(),
                    component: "TerminalAgent".to_string(),
                });
            }
        }

        // Validate agent
        let agent = self.agent_manager.get_agent(agent_id).await?;

        // Get autonomy level for this agent
        let autonomy_level = self.get_agent_autonomy(agent.id.as_str()).await;

        // Check if terminal access is disabled
        if autonomy_level == TerminalAutonomyLevel::Disabled {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::PermissionDenied,
                message: format!(
                    "Terminal access is disabled for agent {}",
                    agent_id
                ),
                component: "TerminalAgent".to_string(),
            });
        }

        // Generate command ID and create command record
        let command_id = Uuid::new_v4().to_string();
        let risk_level = self.analyze_command_risk(command).await;
        
        let terminal_command = TerminalCommand {
            id: command_id.clone(),
            agent_id: agent_id.to_string(),
            task_id: task_id.map(|id| id.to_string()),
            command: command.to_string(),
            working_directory: working_directory.map(|dir| dir.to_string()),
            status: CommandStatus::Pending,
            requested_at: SystemTime::now(),
            executed_at: None,
            finished_at: None,
            exit_code: None,
            purpose: purpose.map(|p| p.to_string()),
            risk_level,
            metadata: metadata.unwrap_or_default(),
        };

        // Store command
        {
            let mut commands_map = self.commands.write().await;
            commands_map.insert(command_id.clone(), terminal_command.clone());
        }

        // Determine if command needs approval based on risk level and autonomy
        let needs_approval = match (autonomy_level, risk_level) {
            (TerminalAutonomyLevel::FullAccess, _) => false,
            (TerminalAutonomyLevel::ApproveHighRisk, CommandRiskLevel::High) => true,
            (TerminalAutonomyLevel::ApproveHighRisk, _) => false,
            (TerminalAutonomyLevel::RequireApproval, _) => true,
            _ => true, // Default to requiring approval
        };

        if needs_approval {
            // Update command status
            {
                let mut commands_map = self.commands.write().await;
                if let Some(cmd) = commands_map.get_mut(&command_id) {
                    cmd.status = CommandStatus::AwaitingApproval;
                }
            }

            // Request approval and wait for response
            let approval = self.request_command_approval(&terminal_command).await?;
            
            if !approval.approved {
                // Update command status to rejected
                {
                    let mut commands_map = self.commands.write().await;
                    if let Some(cmd) = commands_map.get_mut(&command_id) {
                        cmd.status = CommandStatus::Rejected;
                        if let Some(reason) = &approval.rejection_reason {
                            cmd.metadata.insert("rejection_reason".to_string(), reason.clone());
                        }
                    }
                }

                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::CommandRejected,
                    message: format!(
                        "Command rejected: {}",
                        approval.rejection_reason.unwrap_or_else(|| "No reason provided".to_string())
                    ),
                    component: "TerminalAgent".to_string(),
                });
            }
        }

        // Update command status to executing
        {
            let mut commands_map = self.commands.write().await;
            if let Some(cmd) = commands_map.get_mut(&command_id) {
                cmd.status = CommandStatus::Executing;
                cmd.executed_at = Some(SystemTime::now());
            }
        }

        // Execute the command
        let result = self.run_command(
            &command_id,
            command,
            working_directory,
            self.config.command_timeout_seconds,
        ).await?;

        // Update command status
        {
            let mut commands_map = self.commands.write().await;
            if let Some(cmd) = commands_map.get_mut(&command_id) {
                cmd.status = if result.success {
                    CommandStatus::Completed
                } else {
                    CommandStatus::Failed
                };
                cmd.finished_at = Some(SystemTime::now());
                cmd.exit_code = result.exit_code;
            }
        }

        Ok(result)
    }

    /// Analyze risk level of a command
    async fn analyze_command_risk(&self, command: &str) -> CommandRiskLevel {
        let command = command.trim();
        
        // Check against dangerous command patterns
        for pattern in &self.config.dangerous_command_patterns {
            if regex::Regex::new(pattern)
                .map(|re| re.is_match(command))
                .unwrap_or(false)
            {
                return CommandRiskLevel::High;
            }
        }
        
        // Additional risk analysis
        if command.contains("sudo") || command.contains("rm -") || 
           command.contains("mkfs") || command.contains("> /") ||
           command.contains("dd ") || command.contains("chmod ") ||
           command.contains("chown ") {
            return CommandRiskLevel::Medium;
        }
        
        CommandRiskLevel::Low
    }

    /// Execute command and capture output
    async fn run_command(
        &self, 
        command_id: &str,
        command: &str, 
        working_directory: Option<&str>,
        timeout_seconds: u64,
    ) -> PhoenixResult<CommandResult> {
        use tauri_plugin_shell::ShellExt;
        use tauri_plugin_shell::process::{CommandEvent, Command};
        use std::time::{Duration, Instant};

        // Create Tauri command
        let mut cmd = Command::new_sidecar("shell")
            .expect("Failed to create shell command");

        // Set working directory if provided
        if let Some(dir) = working_directory {
            cmd = cmd.current_dir(dir);
        }
        
        // Set shell command based on platform
        #[cfg(target_os = "windows")]
        {
            cmd = cmd.program("cmd").args(&["/C", command]);
        }
        
        #[cfg(not(target_os = "windows"))]
        {
            cmd = cmd.program("sh").args(&["-c", command]);
        }

        // Start command
        let start_time = Instant::now();
        let (mut rx, mut child) = cmd.spawn()
            .map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::CommandExecutionFailed,
                message: format!("Failed to spawn command: {}", e),
                component: "TerminalAgent".to_string(),
            })?;

        // Output buffers
        let mut stdout_content = String::new();
        let mut stderr_content = String::new();
        let mut exit_code: Option<i32> = None;
        
        // Artifact ID if history is stored
        let mut artifact_id: Option<String> = None;

        // Command timeout
        let timeout = Duration::from_secs(timeout_seconds);
        
        // Process command output
        tokio::select! {
            result = async {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            stdout_content.push_str(&line);
                            stdout_content.push('\n');
                        }
                        CommandEvent::Stderr(line) => {
                            stderr_content.push_str(&line);
                            stderr_content.push('\n');
                        }
                        CommandEvent::Error(err) => {
                            stderr_content.push_str(&format!("Error: {}\n", err));
                            return Err::<(), _>(PhoenixError::Agent {
                                kind: AgentErrorKind::CommandExecutionFailed,
                                message: format!("Command error: {}", err),
                                component: "TerminalAgent".to_string(),
                            });
                        }
                        CommandEvent::Terminated(payload) => {
                            exit_code = Some(payload.code);
                            break;
                        }
                    }
                }
                Ok(())
            } => {
                // Command finished normally
                if let Err(e) = result {
                    return Err(e);
                }
            }
            _ = tokio::time::sleep(timeout) => {
                // Command timed out
                let _ = child.kill();
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::CommandTimeout,
                    message: format!("Command timed out after {} seconds", timeout_seconds),
                    component: "TerminalAgent".to_string(),
                });
            }
        }

        // Store command history as artifact if enabled
        if self.config.auto_store_history {
            let history_content = format!(
                "# Command: {}\n# Working Directory: {}\n# Exit Code: {}\n\n## STDOUT\n\n{}\n\n## STDERR\n\n{}\n",
                command,
                working_directory.unwrap_or("."),
                exit_code.map_or("None".to_string(), |c| c.to_string()),
                stdout_content,
                stderr_content
            );
            
            if let Some(task_id) = {
                let cmd_map = self.commands.read().await;
                cmd_map.get(command_id).and_then(|cmd| cmd.task_id.clone())
            } {
                // Truncate content if it's too large
                let content = if history_content.len() > self.config.max_scrollback_size {
                    let mut truncated = history_content.chars()
                        .take(self.config.max_scrollback_size)
                        .collect::<String>();
                    truncated.push_str("\n\n[Content truncated due to size limits]\n");
                    truncated
                } else {
                    history_content.clone()
                };
                
                // Get agent info for metadata
                let agent_id = {
                    let cmd_map = self.commands.read().await;
                    cmd_map.get(command_id)
                        .map(|cmd| cmd.agent_id.clone())
                        .unwrap_or_else(|| "unknown".to_string())
                };
                
                // Store as artifact
                match self.artifact_system.create_artifact(
                    format!("Terminal Command: {}", self.truncate_command_for_display(command)),
                    ArtifactType::Logs,
                    task_id,
                    agent_id,
                    "text/plain".to_string(),
                    content.into_bytes(),
                    Some(format!("Terminal command execution for: {}", command)),
                    None,
                    None,
                    Some({
                        let mut metadata = HashMap::new();
                        metadata.insert("command".to_string(), command.to_string());
                        metadata.insert("exit_code".to_string(), exit_code.map_or("None".to_string(), |c| c.to_string()));
                        metadata.insert("success".to_string(), exit_code.map_or("false", |c| if c == 0 { "true" } else { "false" }).to_string());
                        metadata
                    }),
                ).await {
                    Ok(id) => {
                        artifact_id = Some(id);
                    }
                    Err(e) => {
                        tracing::error!("Failed to store command history as artifact: {}", e);
                    }
                }
            }
        }

        // Calculate duration
        let duration = start_time.elapsed().as_secs_f64();
        
        // Create result
        let success = exit_code.map_or(false, |code| code == 0);
        Ok(CommandResult {
            command_id: command_id.to_string(),
            success,
            exit_code,
            stdout: stdout_content,
            stderr: stderr_content,
            duration,
            artifact_id,
        })
    }

    /// Request command approval from user
    async fn request_command_approval(&self, command: &TerminalCommand) -> PhoenixResult<CommandApprovalResponse> {
        // Create approval request
        let approval_request = CommandApprovalRequest {
            command_id: command.id.clone(),
            agent_id: command.agent_id.clone(),
            command: command.command.clone(),
            working_directory: command.working_directory.clone(),
            purpose: command.purpose.clone(),
            risk_level: command.risk_level,
            requested_at: SystemTime::now(),
        };
        
        // Create channel for response
        let (tx, mut rx) = mpsc::channel::<CommandApprovalResponse>(1);
        
        // Store pending approval
        {
            let mut approvals = self.pending_approvals.write().await;
            approvals.insert(command.id.clone(), tx);
        }
        
        // Broadcast approval request event
        self.core.broadcast_event(
            "command_approval_request",
            Some(command.agent_id.clone()),
            command.task_id.clone(),
            serde_json::json!({
                "command_id": approval_request.command_id,
                "command": approval_request.command,
                "working_directory": approval_request.working_directory,
                "purpose": approval_request.purpose,
                "risk_level": approval_request.risk_level.to_string(),
            }),
        ).await?;
        
        // Wait for response
        match tokio::time::timeout(std::time::Duration::from_secs(1800), rx.recv()).await {
            Ok(Some(response)) => Ok(response),
            Ok(None) => {
                // Channel closed without a response
                Err(PhoenixError::Agent {
                    kind: AgentErrorKind::CommandRejected,
                    message: "Approval request channel closed without response".to_string(),
                    component: "TerminalAgent".to_string(),
                })
            }
            Err(_) => {
                // Timeout waiting for approval
                Err(PhoenixError::Agent {
                    kind: AgentErrorKind::CommandTimeout,
                    message: "Timed out waiting for command approval".to_string(),
                    component: "TerminalAgent".to_string(),
                })
            }
        }
    }

    /// Respond to a command approval request
    pub async fn respond_to_approval(
        &self,
        command_id: &str,
        approved: bool,
        rejection_reason: Option<String>,
    ) -> PhoenixResult<()> {
        // Check if the approval request exists
        let tx = {
            let approvals = self.pending_approvals.read().await;
            approvals.get(command_id).cloned()
        };
        
        if let Some(tx) = tx {
            // Create response
            let response = CommandApprovalResponse {
                command_id: command_id.to_string(),
                approved,
                rejection_reason,
                responded_at: SystemTime::now(),
            };
            
            // Send response
            if tx.send(response).await.is_err() {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::CommunicationError,
                    message: "Failed to send approval response".to_string(),
                    component: "TerminalAgent".to_string(),
                });
            }
            
            // Remove from pending approvals
            let mut approvals = self.pending_approvals.write().await;
            approvals.remove(command_id);
            
            Ok(())
        } else {
            Err(PhoenixError::Agent {
                kind: AgentErrorKind::NotFound,
                message: format!("Command approval request with ID {} not found", command_id),
                component: "TerminalAgent".to_string(),
            })
        }
    }
    
    /// Get a list of all pending approval requests
    pub async fn list_pending_approvals(&self) -> Vec<CommandApprovalRequest> {
        let approvals = self.pending_approvals.read().await;
        let commands = self.commands.read().await;
        
        approvals.keys()
            .filter_map(|id| {
                commands.get(id).map(|cmd| CommandApprovalRequest {
                    command_id: cmd.id.clone(),
                    agent_id: cmd.agent_id.clone(),
                    command: cmd.command.clone(),
                    working_directory: cmd.working_directory.clone(),
                    purpose: cmd.purpose.clone(),
                    risk_level: cmd.risk_level,
                    requested_at: cmd.requested_at,
                })
            })
            .collect()
    }

    /// Get command info
    pub async fn get_command(&self, command_id: &str) -> PhoenixResult<TerminalCommand> {
        let commands = self.commands.read().await;
        commands.get(command_id).cloned().ok_or_else(|| PhoenixError::Agent {
            kind: AgentErrorKind::NotFound,
            message: format!("Command with ID {} not found", command_id),
            component: "TerminalAgent".to_string(),
        })
    }

    /// List commands for an agent
    pub async fn list_agent_commands(&self, agent_id: &str, limit: Option<usize>) -> PhoenixResult<Vec<TerminalCommand>> {
        // Validate agent exists
        self.agent_manager.get_agent(agent_id).await?;
        
        let commands = self.commands.read().await;
        let mut agent_commands: Vec<_> = commands.values()
            .filter(|cmd| cmd.agent_id == agent_id)
            .cloned()
            .collect();
        
        // Sort by requested time (newest first)
        agent_commands.sort_by(|a, b| b.requested_at.cmp(&a.requested_at));
        
        // Apply limit if provided
        if let Some(limit) = limit {
            agent_commands.truncate(limit);
        }
        
        Ok(agent_commands)
    }

    /// List commands for a task
    pub async fn list_task_commands(&self, task_id: &str, limit: Option<usize>) -> PhoenixResult<Vec<TerminalCommand>> {
        let commands = self.commands.read().await;
        let mut task_commands: Vec<_> = commands.values()
            .filter(|cmd| cmd.task_id.as_deref() == Some(task_id))
            .cloned()
            .collect();
        
        // Sort by requested time (newest first)
        task_commands.sort_by(|a, b| b.requested_at.cmp(&a.requested_at));
        
        // Apply limit if provided
        if let Some(limit) = limit {
            task_commands.truncate(limit);
        }
        
        Ok(task_commands)
    }
    
    /// Truncate command for display purposes
    fn truncate_command_for_display(&self, command: &str) -> String {
        if command.len() > self.config.max_command_display_length {
            format!("{}...", &command[0..self.config.max_command_display_length])
        } else {
            command.to_string()
        }
    }
    
    /// Parse and analyze command output
    pub async fn analyze_command_output(&self, result: &CommandResult) -> HashMap<String, String> {
        let mut analysis = HashMap::new();
        
        // Basic analysis
        analysis.insert("success".to_string(), result.success.to_string());
        if let Some(code) = result.exit_code {
            analysis.insert("exit_code".to_string(), code.to_string());
        }
        analysis.insert("duration_seconds".to_string(), result.duration.to_string());
        analysis.insert("stdout_length".to_string(), result.stdout.len().to_string());
        analysis.insert("stderr_length".to_string(), result.stderr.len().to_string());
        
        // Error detection patterns
        if !result.success {
            if result.stderr.contains("permission denied") || result.stderr.contains("Access is denied") {
                analysis.insert("error_type".to_string(), "permission_denied".to_string());
            } else if result.stderr.contains("not found") || result.stderr.contains("No such file") {
                analysis.insert("error_type".to_string(), "not_found".to_string());
            } else if result.stderr.contains("syntax error") || result.stderr.contains("Invalid syntax") {
                analysis.insert("error_type".to_string(), "syntax_error".to_string());
            } else if result.stderr.contains("terminated") || result.stderr.contains("killed") {
                analysis.insert("error_type".to_string(), "terminated".to_string());
            } else {
                analysis.insert("error_type".to_string(), "other".to_string());
            }
        }
        
        // Check for potential content patterns
        if result.stdout.contains("password") || result.stdout.contains("credential") {
            analysis.insert("potential_sensitive_data".to_string(), "true".to_string());
        }
        
        // Advanced analysis could be added here with more sophisticated parsing
        
        analysis
    }
}

/// Parse command output for specific data patterns
pub fn parse_command_output(stdout: &str, pattern_type: &str) -> Option<String> {
    match pattern_type {
        "ip_address" => {
            // Simple IPv4 pattern matching
            let re = regex::Regex::new(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b").ok()?;
            re.find(stdout).map(|m| m.as_str().to_string())
        }
        "version" => {
            // Common version pattern
            let re = regex::Regex::new(r"version\s+(\d+\.\d+\.\d+)").ok()?;
            re.captures(stdout)
                .and_then(|caps| caps.get(1).map(|m| m.as_str().to_string()))
        }
        "file_count" => {
            // Try to extract file count from ls -l output
            let re = regex::Regex::new(r"total\s+(\d+)").ok()?;
            re.captures(stdout)
                .and_then(|caps| caps.get(1).map(|m| m.as_str().to_string()))
        }
        "error_message" => {
            // Extract error message
            let re = regex::Regex::new(r"error:(.+)").ok()?;
            re.captures(stdout)
                .and_then(|caps| caps.get(1).map(|m| m.as_str().trim().to_string()))
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    
    #[tokio::test]
    async fn test_analyze_command_risk() {
        // Create a minimal terminal agent for testing
        let core = Arc::new(AntigravityCore::new(Default::default()));
        let agent_manager = Arc::new(AgentManager::new(Arc::clone(&core), None));
        let artifact_system = Arc::new(ArtifactSystem::new(Arc::clone(&core), Arc::clone(&agent_manager), None));
        let terminal_agent = TerminalAgent::new(
            Arc::clone(&core),
            Arc::clone(&agent_manager),
            Arc::clone(&artifact_system),
            None,
        );
        
        // Test high-risk commands
        assert_eq!(terminal_agent.analyze_command_risk("sudo rm -rf /").await, CommandRiskLevel::High);
        assert_eq!(terminal_agent.analyze_command_risk("rm -rf /").await, CommandRiskLevel::High);
        assert_eq!(terminal_agent.analyze_command_risk("chmod 777 /etc/passwd").await, CommandRiskLevel::High);
        
        // Test medium-risk commands
        assert_eq!(terminal_agent.analyze_command_risk("sudo ls").await, CommandRiskLevel::Medium);
        assert_eq!(terminal_agent.analyze_command_risk("chmod 644 file.txt").await, CommandRiskLevel::Medium);
        
        // Test low-risk commands
        assert_eq!(terminal_agent.analyze_command_risk("ls -la").await, CommandRiskLevel::Low);
        assert_eq!(terminal_agent.analyze_command_risk("echo hello").await, CommandRiskLevel::Low);
        assert_eq!(terminal_agent.analyze_command_risk("cd /tmp").await, CommandRiskLevel::Low);
    }
    
    #[test]
    fn test_parse_command_output() {
        // Test IP address parsing
        let ip_output = "Network interface: eth0 192.168.1.100 active";
        assert_eq!(
            parse_command_output(ip_output, "ip_address"),
            Some("192.168.1.100".to_string())
        );
        
        // Test version parsing
        let version_output = "App name version 1.2.3 running on Linux";
        assert_eq!(
            parse_command_output(version_output, "version"),
            Some("1.2.3".to_string())
        );
        
        // Test file count parsing from ls
        let ls_output = "total 42\ndrwxr-xr-x 9 user group 4096 Dec 1 12:34 dirname\n";
        assert_eq!(
            parse_command_output(ls_output, "file_count"),
            Some("42".to_string())
        );
        
        // Test error message parsing
        let error_output = "Command failed with error: file not found";
        assert_eq!(
            parse_command_output(error_output, "error_message"),
            Some("file not found".to_string())
        );
    }
}