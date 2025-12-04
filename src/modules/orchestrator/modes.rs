//! Operation Modes Implementation
//!
//! This module contains the implementation of different operational modes
//! and autonomy levels for the Antigravity integration, allowing agents to
//! operate with varying degrees of independence based on user preferences.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::SystemTime;

use serde::{Deserialize, Serialize};
use tokio::sync::{broadcast, RwLock};
use tokio::task::JoinHandle;
use uuid::Uuid;

use crate::modules::orchestrator::agent_manager::AgentManager;
use crate::modules::orchestrator::antigravity_core::{AntigravityCore, AntigravityEvent};
use crate::modules::orchestrator::errors::{AgentErrorKind, PhoenixError, PhoenixResult};
use crate::modules::orchestrator::planner::Planner;
use crate::modules::orchestrator::workflows::{WorkflowRegistry, WorkflowExecutor};

/// Operating mode for agents
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum OperatingMode {
    /// Planning Only - agents can only create plans, requires approval for execution
    Planning,
    /// Fast Mode - bypasses planning phase for trivial tasks, executes directly
    Fast,
    /// Full Autonomous - agents operate with high autonomy based on autonomy level
    FullAutonomous,
}

impl std::fmt::Display for OperatingMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OperatingMode::Planning => write!(f, "Planning"),
            OperatingMode::Fast => write!(f, "Fast"),
            OperatingMode::FullAutonomous => write!(f, "Full Autonomous"),
        }
    }
}

/// Autonomy level permissions
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AutonomyPermissions {
    /// Can access and modify files
    pub file_access: bool,
    /// Can execute commands
    pub command_execution: bool,
    /// Can use terminal
    pub terminal_access: bool,
    /// Can use browser
    pub browser_access: bool,
    /// Requires verification before key operations
    pub requires_verification: bool,
    /// Frequency of verification (higher values = less frequent)
    pub verification_frequency: u8, // 1-10, higher means less frequent verification
}

/// Mode event broadcasted to clients
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModeEvent {
    /// Unique event ID
    pub id: String,
    /// Event timestamp
    pub timestamp: String,
    /// Event type
    pub event_type: String,
    /// User ID that initiated the change
    pub user_id: Option<String>,
    /// Event payload
    pub payload: serde_json::Value,
}

/// Configuration for the Modes System
#[derive(Debug, Clone)]
pub struct ModesConfig {
    /// SSE broadcast channel capacity
    pub broadcast_capacity: usize,
    /// Default operating mode
    pub default_mode: OperatingMode,
    /// Default autonomy level (0-10)
    pub default_autonomy_level: u8,
}

impl Default for ModesConfig {
    fn default() -> Self {
        Self {
            broadcast_capacity: 100,
            default_mode: OperatingMode::Planning,
            default_autonomy_level: 0,
        }
    }
}

/// Operation modes and autonomy management for agents
pub struct OperationModes {
    /// Configuration
    config: ModesConfig,
    /// Current operating mode
    mode: Arc<RwLock<OperatingMode>>,
    /// Current autonomy level (0-10)
    autonomy_level: Arc<RwLock<u8>>,
    /// Pre-calculated permissions for current autonomy level
    permissions: Arc<RwLock<AutonomyPermissions>>,
    /// Reference to AntigravityCore
    core: Arc<AntigravityCore>,
    /// Reference to AgentManager
    agent_manager: Arc<AgentManager>,
    /// Reference to Planner
    planner: Arc<Planner>,
    /// Broadcast channel for mode events
    event_tx: broadcast::Sender<ModeEvent>,
    /// System is running
    is_running: Arc<RwLock<bool>>,
    /// Background task handle
    background_handle: Option<JoinHandle<()>>,
    /// User-specific mode overrides (user_id -> mode)
    user_mode_overrides: Arc<RwLock<HashMap<String, OperatingMode>>>,
    /// User-specific autonomy level overrides (user_id -> level)
    user_autonomy_overrides: Arc<RwLock<HashMap<String, u8>>>,
}

impl OperationModes {
    /// Create a new OperationModes manager
    pub fn new(
        core: Arc<AntigravityCore>,
        agent_manager: Arc<AgentManager>,
        planner: Arc<Planner>,
        config: Option<ModesConfig>,
    ) -> Self {
        let config = config.unwrap_or_default();
        let (tx, _) = broadcast::channel(config.broadcast_capacity);

        // Calculate initial permissions based on default autonomy level
        let permissions = Self::calculate_permissions(config.default_autonomy_level);

        Self {
            config: config.clone(),
            mode: Arc::new(RwLock::new(config.default_mode)),
            autonomy_level: Arc::new(RwLock::new(config.default_autonomy_level)),
            permissions: Arc::new(RwLock::new(permissions)),
            core,
            agent_manager,
            planner,
            event_tx: tx,
            is_running: Arc::new(RwLock::new(false)),
            background_handle: None,
            user_mode_overrides: Arc::new(RwLock::new(HashMap::new())),
            user_autonomy_overrides: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Start the Operation Modes manager
    pub async fn start(&mut self) -> PhoenixResult<()> {
        // Check if already running
        {
            let running = self.is_running.read().await;
            if *running {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::AlreadyRunning,
                    message: "Operation Modes manager is already running".to_string(),
                    component: "OperationModes".to_string(),
                });
            }
        }

        // Mark as running
        {
            let mut running = self.is_running.write().await;
            *running = true;
        }

        // Listen for integration events
        self.listen_for_core_events().await?;

        // Broadcast startup event
        self.broadcast_mode_event(
            "modes_system_started",
            None,
            serde_json::json!({
                "message": "Operation Modes system started",
                "default_mode": self.config.default_mode.to_string(),
                "default_autonomy_level": self.config.default_autonomy_level,
            }),
        ).await?;

        Ok(())
    }

    /// Stop the Operation Modes manager
    pub async fn stop(&mut self) -> PhoenixResult<()> {
        // Check if running
        {
            let running = self.is_running.read().await;
            if !*running {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::NotRunning,
                    message: "Operation Modes manager is not running".to_string(),
                    component: "OperationModes".to_string(),
                });
            }
        }

        // Mark as not running
        {
            let mut running = self.is_running.write().await;
            *running = false;
        }

        // Stop background task
        if let Some(handle) = self.background_handle.take() {
            handle.abort();
        }

        // Broadcast shutdown event
        self.broadcast_mode_event(
            "modes_system_stopped",
            None,
            serde_json::json!({
                "message": "Operation Modes system stopped",
            }),
        ).await?;

        Ok(())
    }

    /// Listen for events from the AntigravityCore
    async fn listen_for_core_events(&mut self) -> PhoenixResult<()> {
        let mut rx = self.core.subscribe();
        let is_running = Arc::clone(&self.is_running);
        let mode = Arc::clone(&self.mode);
        let autonomy_level = Arc::clone(&self.autonomy_level);
        let permissions = Arc::clone(&self.permissions);
        let event_tx = self.event_tx.clone();
        let user_mode_overrides = Arc::clone(&self.user_mode_overrides);
        let user_autonomy_overrides = Arc::clone(&self.user_autonomy_overrides);

        let handle = tokio::spawn(async move {
            while *is_running.read().await {
                match rx.recv().await {
                    Ok(event) => {
                        // Process relevant events
                        if event.event_type == "task_created" {
                            // Check if we should apply fast mode for this task
                            if let Some(metadata) = event.payload.get("metadata") {
                                if let Some(is_fast) = metadata.get("fast_mode") {
                                    if is_fast.as_bool().unwrap_or(false) {
                                        // Get the task ID and apply fast mode processing
                                        if let Some(task_id) = event.task_id {
                                            // Log that fast mode was applied
                                            let mode_event = ModeEvent {
                                                id: Uuid::new_v4().to_string(),
                                                timestamp: chrono::Utc::now().to_rfc3339(),
                                                event_type: "fast_mode_applied".to_string(),
                                                user_id: None,
                                                payload: serde_json::json!({
                                                    "task_id": task_id,
                                                    "message": "Fast mode automatically applied to task",
                                                }),
                                            };

                                            let _ = event_tx.send(mode_event);
                                        }
                                    }
                                }
                            }
                        }
                    },
                    Err(broadcast::error::RecvError::Closed) => break,
                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
                }
            }
        });

        self.background_handle = Some(handle);
        Ok(())
    }

    /// Set the global operating mode
    pub async fn set_operating_mode(&self, mode: OperatingMode, user_id: Option<String>) -> PhoenixResult<()> {
        // Update the operating mode
        {
            let mut current_mode = self.mode.write().await;
            *current_mode = mode.clone();
        }

        // Broadcast mode change event
        self.broadcast_mode_event(
            "operating_mode_changed",
            user_id.clone(),
            serde_json::json!({
                "mode": mode.to_string(),
                "changed_by": user_id.clone().unwrap_or_else(|| "system".to_string()),
            }),
        ).await?;

        Ok(())
    }

    /// Set operating mode for a specific user
    pub async fn set_user_operating_mode(&self, user_id: &str, mode: OperatingMode) -> PhoenixResult<()> {
        // Store the user-specific override
        {
            let mut overrides = self.user_mode_overrides.write().await;
            overrides.insert(user_id.to_string(), mode.clone());
        }

        // Broadcast user-specific mode change event
        self.broadcast_mode_event(
            "user_operating_mode_changed",
            Some(user_id.to_string()),
            serde_json::json!({
                "user_id": user_id,
                "mode": mode.to_string(),
            }),
        ).await?;

        Ok(())
    }

    /// Get the effective operating mode for a user
    pub async fn get_user_operating_mode(&self, user_id: &str) -> OperatingMode {
        // Check for user-specific override
        let overrides = self.user_mode_overrides.read().await;
        if let Some(mode) = overrides.get(user_id) {
            return mode.clone();
        }

        // Otherwise, return the global mode
        let mode = self.mode.read().await;
        mode.clone()
    }

    /// Set the global autonomy level
    pub async fn set_autonomy_level(&self, level: u8, user_id: Option<String>) -> PhoenixResult<()> {
        // Validate the level
        if level > 10 {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::InvalidInput,
                message: "Autonomy level must be between 0 and 10".to_string(),
                component: "OperationModes".to_string(),
            });
        }

        // Update the autonomy level
        {
            let mut current_level = self.autonomy_level.write().await;
            *current_level = level;
        }

        // Recalculate and update permissions
        let new_permissions = Self::calculate_permissions(level);
        {
            let mut perms = self.permissions.write().await;
            *perms = new_permissions.clone();
        }

        // Broadcast autonomy level change event
        self.broadcast_mode_event(
            "autonomy_level_changed",
            user_id.clone(),
            serde_json::json!({
                "level": level,
                "permissions": serde_json::to_value(new_permissions).unwrap(),
                "changed_by": user_id.clone().unwrap_or_else(|| "system".to_string()),
            }),
        ).await?;

        Ok(())
    }

    /// Set autonomy level for a specific user
    pub async fn set_user_autonomy_level(&self, user_id: &str, level: u8) -> PhoenixResult<()> {
        // Validate the level
        if level > 10 {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::InvalidInput,
                message: "Autonomy level must be between 0 and 10".to_string(),
                component: "OperationModes".to_string(),
            });
        }

        // Store the user-specific override
        {
            let mut overrides = self.user_autonomy_overrides.write().await;
            overrides.insert(user_id.to_string(), level);
        }

        // Calculate permissions for this level
        let permissions = Self::calculate_permissions(level);

        // Broadcast user-specific autonomy level change event
        self.broadcast_mode_event(
            "user_autonomy_level_changed",
            Some(user_id.to_string()),
            serde_json::json!({
                "user_id": user_id,
                "level": level,
                "permissions": serde_json::to_value(permissions).unwrap(),
            }),
        ).await?;

        Ok(())
    }

    /// Get the effective autonomy level for a user
    pub async fn get_user_autonomy_level(&self, user_id: &str) -> u8 {
        // Check for user-specific override
        let overrides = self.user_autonomy_overrides.read().await;
        if let Some(level) = overrides.get(user_id) {
            return *level;
        }

        // Otherwise, return the global level
        let level = self.autonomy_level.read().await;
        *level
    }

    /// Get the current global operating mode
    pub async fn get_operating_mode(&self) -> OperatingMode {
        let mode = self.mode.read().await;
        mode.clone()
    }

    /// Get the current global autonomy level
    pub async fn get_autonomy_level(&self) -> u8 {
        let level = self.autonomy_level.read().await;
        *level
    }

    /// Get the current permissions based on autonomy level
    pub async fn get_permissions(&self) -> AutonomyPermissions {
        let perms = self.permissions.read().await;
        perms.clone()
    }

    /// Get user-specific permissions
    pub async fn get_user_permissions(&self, user_id: &str) -> AutonomyPermissions {
        // Get effective autonomy level for this user
        let level = self.get_user_autonomy_level(user_id).await;
        
        // Calculate permissions based on the user's level
        Self::calculate_permissions(level)
    }

    /// Check if a specific operation is allowed for a user
    pub async fn is_operation_allowed(
        &self,
        operation_type: &str,
        user_id: &str,
    ) -> PhoenixResult<bool> {
        // Get effective operating mode and autonomy level for this user
        let mode = self.get_user_operating_mode(user_id).await;
        let level = self.get_user_autonomy_level(user_id).await;
        
        // If in Planning mode and level is 0, most operations are restricted
        if mode == OperatingMode::Planning && level == 0 {
            match operation_type {
                "terminal_access" | "browser_access" | "command_execution" => return Ok(false),
                "file_write" => return Ok(false),
                "file_read" => return Ok(true), // Always allow file reading
                _ => {}
            }
        }

        // In Fast mode, skip planning phase but respect autonomy level for other permissions
        if mode == OperatingMode::Fast {
            // Allow bypassing planning phase
            if operation_type == "skip_planning" {
                return Ok(true);
            }
        }
        
        // Check permissions based on autonomy level
        let permissions = Self::calculate_permissions(level);
        
        let allowed = match operation_type {
            "file_read" => true, // Always allowed
            "file_write" => permissions.file_access,
            "command_execution" => permissions.command_execution,
            "terminal_access" => permissions.terminal_access,
            "browser_access" => permissions.browser_access,
            _ => false, // Default to not allowed for unknown operations
        };
        
        Ok(allowed)
    }

    /// Check if verification is required for an operation
    pub async fn requires_verification(
        &self,
        operation_type: &str,
        user_id: &str,
    ) -> PhoenixResult<bool> {
        // Get effective autonomy level for this user
        let level = self.get_user_autonomy_level(user_id).await;
        let permissions = Self::calculate_permissions(level);
        
        // If verification is not required at all, return false
        if !permissions.requires_verification {
            return Ok(false);
        }
        
        // For low autonomy levels (1-3), critical operations always require verification
        if level <= 3 && (operation_type == "command_execution" || operation_type == "browser_access") {
            return Ok(true);
        }
        
        // For medium autonomy levels (4-6), verification depends on operation risk
        if level <= 6 && operation_type == "command_execution" {
            return Ok(true); 
        }
        
        // High autonomy (7-9) only verifies critical operations
        if level <= 9 && operation_type == "destructive_command" {
            return Ok(true);
        }
        
        // Level 10 doesn't verify anything
        Ok(false)
    }

    /// Enable fast mode for a task
    pub async fn enable_fast_mode_for_task(
        &self,
        task_id: &str,
        user_id: &str,
    ) -> PhoenixResult<()> {
        // Add fast mode metadata to the task
        let mut metadata = HashMap::new();
        metadata.insert("fast_mode".to_string(), "true".to_string());
        metadata.insert("fast_mode_enabled_by".to_string(), user_id.to_string());
        
        self.core
            .update_task_status(
                task_id,
                crate::modules::orchestrator::antigravity_core::TaskStatus::Running,
                None,
                Some(metadata),
            )
            .await?;
        
        // Broadcast fast mode enabled event
        self.broadcast_mode_event(
            "fast_mode_enabled",
            Some(user_id.to_string()),
            serde_json::json!({
                "task_id": task_id,
                "enabled_by": user_id,
            }),
        ).await?;
        
        Ok(())
    }

    /// Get SSE subscriber for real-time mode updates
    pub fn subscribe(&self) -> broadcast::Receiver<ModeEvent> {
        self.event_tx.subscribe()
    }

    /// Broadcast a mode event
    async fn broadcast_mode_event(
        &self,
        event_type: &str,
        user_id: Option<String>,
        payload: serde_json::Value,
    ) -> PhoenixResult<()> {
        let event = ModeEvent {
            id: Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            event_type: event_type.to_string(),
            user_id,
            payload,
        };

        // Broadcast the event
        if self.event_tx.send(event).is_err() {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::CommunicationError,
                message: "Failed to broadcast event (no subscribers)".to_string(),
                component: "OperationModes".to_string(),
            });
        }

        Ok(())
    }

    /// Calculate permissions based on autonomy level
    fn calculate_permissions(level: u8) -> AutonomyPermissions {
        // Ensure level is within bounds
        let level = level.min(10);
        
        match level {
            0 => AutonomyPermissions {
                // Level 0: Planning only mode
                file_access: false,
                command_execution: false,
                terminal_access: false, 
                browser_access: false,
                requires_verification: true,
                verification_frequency: 1, // Verify every step
            },
            1..=3 => AutonomyPermissions {
                // Levels 1-3: Limited autonomy
                file_access: true,
                command_execution: level >= 2, // Allow commands at level 2+
                terminal_access: level >= 3, // Allow terminal at level 3
                browser_access: false, // No browser access yet
                requires_verification: true,
                verification_frequency: level, // Frequency based on level
            },
            4..=6 => AutonomyPermissions {
                // Levels 4-6: Medium autonomy
                file_access: true,
                command_execution: true,
                terminal_access: true,
                browser_access: level >= 5, // Browser access at level 5+
                requires_verification: true,
                verification_frequency: level, // Less frequent verification
            },
            7..=9 => AutonomyPermissions {
                // Levels 7-9: High autonomy
                file_access: true,
                command_execution: true,
                terminal_access: true,
                browser_access: true,
                requires_verification: level < 9, // Only verify at levels 7-8
                verification_frequency: 10, // Very infrequent verification
            },
            10 => AutonomyPermissions {
                // Level 10: Full autonomy
                file_access: true,
                command_execution: true,
                terminal_access: true,
                browser_access: true,
                requires_verification: false, // No verification needed
                verification_frequency: 10,
            },
        }
    }
}

/// Helper function to process "fast mode" command from thought
pub async fn process_fast_mode_command(
    command_text: &str,
    operation_modes: &OperationModes, 
    task_id: &str,
    user_id: &str,
) -> PhoenixResult<bool> {
    // Check if the command is a fast mode request
    if command_text.to_lowercase().contains("phoenix, fast mode this task") {
        // Enable fast mode for this task
        operation_modes.enable_fast_mode_for_task(task_id, user_id).await?;
        
        // Bypass planning and set appropriate mode
        operation_modes.set_user_operating_mode(user_id, OperatingMode::Fast).await?;
        
        return Ok(true);
    }
    
    // Not a fast mode command
    Ok(false)
}

/// Helper function to process "workflow" command from thought
///
/// Detects and processes commands like "Phoenix, run workflow Nuclear Winter"
/// or "Phoenix, execute workflow APT29 with target=192.168.1.1"
pub async fn process_workflow_command(
    command_text: &str,
    operation_modes: &OperationModes,
    workflow_registry: &WorkflowRegistry,
    workflow_executor: &WorkflowExecutor,
    task_id: &str,
    user_id: &str,
) -> PhoenixResult<bool> {
    // Check if the command is a workflow execution request
    let command_lower = command_text.to_lowercase();
    
    // Match either "run workflow" or "execute workflow"
    if command_lower.contains("phoenix, run workflow") ||
       command_lower.contains("phoenix, execute workflow") {
        
        // Extract the workflow name
        let workflow_name = if command_lower.contains("phoenix, run workflow") {
            // Extract name after "phoenix, run workflow"
            let workflow_part = command_text.splitn(2, "phoenix, run workflow").nth(1)
                .unwrap_or("").trim();
            
            // Check if there are parameters
            if workflow_part.contains(" with ") {
                workflow_part.splitn(2, " with ").nth(0).unwrap_or("").trim()
            } else {
                workflow_part
            }
        } else {
            // Extract name after "phoenix, execute workflow"
            let workflow_part = command_text.splitn(2, "phoenix, execute workflow").nth(1)
                .unwrap_or("").trim();
            
            // Check if there are parameters
            if workflow_part.contains(" with ") {
                workflow_part.splitn(2, " with ").nth(0).unwrap_or("").trim()
            } else {
                workflow_part
            }
        };
        
        if workflow_name.is_empty() {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::InvalidInput,
                message: "No workflow name specified".to_string(),
                component: "WorkflowExecution".to_string(),
            });
        }
        
        // Extract parameters if present
        let parameters = if command_text.contains(" with ") {
            let params_text = command_text.splitn(2, " with ").nth(1).unwrap_or("").trim();
            if !params_text.is_empty() {
                // Parse parameters (format: param1=value1,param2=value2)
                let param_map = params_text.split(',')
                    .filter_map(|param_pair| {
                        let parts: Vec<&str> = param_pair.split('=').collect();
                        if parts.len() == 2 {
                            Some((parts[0].trim().to_string(), parts[1].trim().to_string()))
                        } else {
                            None
                        }
                    })
                    .collect::<std::collections::HashMap<String, String>>();
                
                // Convert to JSON
                Some(serde_json::to_value(param_map).unwrap_or(serde_json::json!({})))
            } else {
                None
            }
        } else {
            None
        };
        
        // Execute the workflow
        match workflow_executor.execute_workflow_by_name(workflow_name, workflow_registry, parameters).await {
            Ok(_) => {
                // Broadcast workflow execution event
                operation_modes.broadcast_mode_event(
                    "workflow_executed",
                    Some(user_id.to_string()),
                    serde_json::json!({
                        "task_id": task_id,
                        "workflow_name": workflow_name,
                        "executed_by": user_id,
                    }),
                ).await?;
                
                return Ok(true);
            },
            Err(e) => {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::ExecutionFailed,
                    message: format!("Failed to execute workflow: {}", e),
                    component: "WorkflowExecution".to_string(),
                });
            }
        }
    }
    
    // Not a workflow command
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Mock implementation for tests will be added here
}