//! Planning Mode Implementation
//!
//! This module contains the implementation of the Planning Mode, which handles
//! agent-generated implementation plans, user feedback, and plan execution tracking.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use serde::{Deserialize, Serialize};
use tokio::sync::{broadcast, RwLock};
use tokio::task::JoinHandle;
use uuid::Uuid;

use crate::modules::orchestrator::agent_manager::AgentManager;
use crate::modules::orchestrator::antigravity_core::{
    AgentInfo, AgentStatus, AntigravityCore, AntigravityEvent, TaskInfo, TaskStatus,
};
use crate::modules::orchestrator::artifacts::{
    ArtifactInfo, ArtifactSystem, ArtifactType,
};
use crate::modules::orchestrator::errors::{AgentErrorKind, PhoenixError, PhoenixResult};

/// Plan state in the system
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum PlanState {
    /// Plan is being drafted
    Drafting,
    /// Plan is awaiting feedback
    AwaitingFeedback,
    /// Plan has been approved
    Approved,
    /// Plan has been rejected
    Rejected,
    /// Plan is being executed
    InExecution,
    /// Plan has been completed
    Completed,
    /// Plan execution failed
    Failed,
}

impl std::fmt::Display for PlanState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PlanState::Drafting => write!(f, "Drafting"),
            PlanState::AwaitingFeedback => write!(f, "AwaitingFeedback"),
            PlanState::Approved => write!(f, "Approved"),
            PlanState::Rejected => write!(f, "Rejected"),
            PlanState::InExecution => write!(f, "InExecution"),
            PlanState::Completed => write!(f, "Completed"),
            PlanState::Failed => write!(f, "Failed"),
        }
    }
}

/// Single step in a plan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanStep {
    /// Step ID
    pub id: String,
    /// Step number
    pub number: u32,
    /// Step description
    pub description: String,
    /// Step status
    pub status: StepStatus,
    /// Additional metadata for the step
    pub metadata: HashMap<String, String>,
    /// Agent feedback on this step (if any)
    pub agent_feedback: Option<String>,
    /// User feedback on this step (if any)
    pub user_feedback: Option<String>,
}

/// Step status in the plan
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum StepStatus {
    /// Step is pending execution
    Pending,
    /// Step is in progress
    InProgress,
    /// Step is completed
    Completed,
    /// Step has been skipped
    Skipped,
    /// Step has failed
    Failed,
    /// Step has been modified by user
    Modified,
}

impl std::fmt::Display for StepStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StepStatus::Pending => write!(f, "Pending"),
            StepStatus::InProgress => write!(f, "InProgress"),
            StepStatus::Completed => write!(f, "Completed"),
            StepStatus::Skipped => write!(f, "Skipped"),
            StepStatus::Failed => write!(f, "Failed"),
            StepStatus::Modified => write!(f, "Modified"),
        }
    }
}

/// Type of feedback action from the user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FeedbackAction {
    /// Approve the entire plan
    ApproveAll,
    /// Reject the entire plan
    RejectAll,
    /// Modify a specific step
    ModifyStep(String, String),
    /// Skip a specific step
    SkipStep(String),
    /// Change the implementation approach for a step
    ChangeApproach(String, String),
    /// Add a new step after the specified step
    AddStep(String, String),
}

/// Plan information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanInfo {
    /// Unique plan ID
    pub id: String,
    /// Plan title
    pub title: String,
    /// Plan description
    pub description: String,
    /// Task ID this plan is associated with
    pub task_id: String,
    /// Agent ID that created this plan
    pub agent_id: String,
    /// Current plan state
    pub state: PlanState,
    /// When the plan was created
    pub created_at: SystemTime,
    /// When the plan was last updated
    pub updated_at: SystemTime,
    /// Plan steps in order
    pub steps: Vec<PlanStep>,
    /// Artifact ID storing the plan content
    pub artifact_id: Option<String>,
    /// Whether the plan is awaiting feedback
    pub awaiting_feedback: bool,
    /// Additional plan metadata
    pub metadata: HashMap<String, String>,
}

/// Plan event broadcasted to clients
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanEvent {
    /// Unique event ID
    pub id: String,
    /// Event timestamp
    pub timestamp: String,
    /// Event type
    pub event_type: String,
    /// Plan ID
    pub plan_id: String,
    /// Task ID
    pub task_id: String,
    /// Agent ID
    pub agent_id: String,
    /// Event payload
    pub payload: serde_json::Value,
}

/// Configuration for the Planning System
#[derive(Debug, Clone)]
pub struct PlannerConfig {
    /// SSE broadcast channel capacity
    pub broadcast_capacity: usize,
    /// Timeout for awaiting feedback (in seconds)
    pub feedback_timeout_seconds: u64,
    /// Default timeout action if feedback not received
    pub default_timeout_action: TimeoutAction,
    /// Interval for checking feedback timeouts (in seconds)
    pub timeout_check_interval_seconds: u64,
}

/// Action to take when feedback timeout occurs
#[derive(Debug, Clone)]
pub enum TimeoutAction {
    /// Proceed with plan as-is
    Proceed,
    /// Prompt the agent to suggest an alternative
    SuggestAlternative,
    /// Fail the plan
    Fail,
}

impl Default for PlannerConfig {
    fn default() -> Self {
        Self {
            broadcast_capacity: 1000,
            feedback_timeout_seconds: 300, // 5 minutes
            default_timeout_action: TimeoutAction::Prompt,
            timeout_check_interval_seconds: 30, // 30 seconds
        }
    }
}

impl TimeoutAction {
    /// Convert to string representation
    pub fn as_str(&self) -> &str {
        match self {
            TimeoutAction::Proceed => "proceed",
            TimeoutAction::SuggestAlternative => "suggest_alternative",
            TimeoutAction::Fail => "fail",
        }
    }
}

/// Planning system for managing implementation plans
pub struct Planner {
    /// Configuration
    config: PlannerConfig,
    /// Reference to AntigravityCore
    core: Arc<AntigravityCore>,
    /// Reference to AgentManager
    agent_manager: Arc<AgentManager>,
    /// Reference to ArtifactSystem
    artifact_system: Arc<ArtifactSystem>,
    /// Plan registry
    plans: Arc<RwLock<HashMap<String, PlanInfo>>>,
    /// Task to plan mapping
    task_plans: Arc<RwLock<HashMap<String, Vec<String>>>>,
    /// Broadcast channel for SSE events
    event_tx: broadcast::Sender<PlanEvent>,
    /// Is planner running
    is_running: Arc<RwLock<bool>>,
    /// Feedback timeout checker handle
    timeout_checker_handle: Option<JoinHandle<()>>,
}

impl Planner {
    /// Create a new Planner instance
    pub fn new(
        core: Arc<AntigravityCore>,
        agent_manager: Arc<AgentManager>,
        artifact_system: Arc<ArtifactSystem>,
        config: Option<PlannerConfig>,
    ) -> Self {
        let config = config.unwrap_or_default();
        let (tx, _) = broadcast::channel(config.broadcast_capacity);
        
        Self {
            config,
            core,
            agent_manager,
            artifact_system,
            plans: Arc::new(RwLock::new(HashMap::new())),
            task_plans: Arc::new(RwLock::new(HashMap::new())),
            event_tx: tx,
            is_running: Arc::new(RwLock::new(false)),
            timeout_checker_handle: None,
        }
    }
    
    /// Start the Planner system
    pub async fn start(&mut self) -> PhoenixResult<()> {
        // Check if already running
        {
            let running = self.is_running.read().await;
            if *running {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::AlreadyRunning,
                    message: "Planner is already running".to_string(),
                    component: "Planner".to_string(),
                });
            }
        }
        
        // Mark as running
        {
            let mut running = self.is_running.write().await;
            *running = true;
        }
        
        // Start feedback timeout checker
        self.start_timeout_checker().await;
        
        // Monitor task status changes to update plan states
        self.monitor_task_status().await?;
        
        Ok(())
    }
    
    /// Start the feedback timeout checker
    async fn start_timeout_checker(&mut self) {
        let plans = Arc::clone(&self.plans);
        let is_running = Arc::clone(&self.is_running);
        let timeout_seconds = self.config.feedback_timeout_seconds;
        let check_interval = self.config.timeout_check_interval_seconds;
        let default_action = self.config.default_timeout_action.clone();
        let event_tx = self.event_tx.clone();
        
        let handle = tokio::spawn(async move {
            while *is_running.read().await {
                // Sleep first to avoid immediate checks
                tokio::time::sleep(Duration::from_secs(check_interval)).await;
                
                let now = SystemTime::now();
                let mut plans_to_timeout = Vec::new();
                
                // Find plans that have timed out waiting for feedback
                {
                    let plans_locked = plans.read().await;
                    for (plan_id, plan) in plans_locked.iter() {
                        if plan.state == PlanState::AwaitingFeedback {
                            if let Ok(elapsed) = now.duration_since(plan.updated_at) {
                                if elapsed.as_secs() > timeout_seconds {
                                    plans_to_timeout.push(plan_id.clone());
                                }
                            }
                        }
                    }
                }
                
                // Process timed out plans
                for plan_id in plans_to_timeout {
                    let mut plan_info = {
                        let mut plans_locked = plans.write().await;
                        if let Some(plan) = plans_locked.get_mut(&plan_id) {
                            // Double check it's still awaiting feedback
                            if plan.state == PlanState::AwaitingFeedback {
                                plan.clone()
                            } else {
                                continue;
                            }
                        } else {
                            continue;
                        }
                    };
                    
                    // Apply the default timeout action
                    match default_action {
                        TimeoutAction::Proceed => {
                            plan_info.state = PlanState::Approved;
                            plan_info.metadata.insert(
                                "timeout_action".to_string(), 
                                "proceeded_automatically".to_string()
                            );
                        },
                        TimeoutAction::SuggestAlternative => {
                            plan_info.state = PlanState::Rejected;
                            plan_info.metadata.insert(
                                "timeout_action".to_string(), 
                                "suggest_alternative".to_string()
                            );
                        },
                        TimeoutAction::Fail => {
                            plan_info.state = PlanState::Failed;
                            plan_info.metadata.insert(
                                "timeout_action".to_string(), 
                                "failed_due_to_timeout".to_string()
                            );
                        }
                    }
                    
                    // Update timestamp
                    plan_info.updated_at = SystemTime::now();
                    plan_info.awaiting_feedback = false;
                    
                    // Save updated plan
                    {
                        let mut plans_locked = plans.write().await;
                        if let Some(plan) = plans_locked.get_mut(&plan_id) {
                            *plan = plan_info.clone();
                        }
                    }
                    
                    // Broadcast update event
                    let event = PlanEvent {
                        id: Uuid::new_v4().to_string(),
                        timestamp: chrono::Utc::now().to_rfc3339(),
                        event_type: "plan_feedback_timeout".to_string(),
                        plan_id: plan_id.clone(),
                        task_id: plan_info.task_id.clone(),
                        agent_id: plan_info.agent_id.clone(),
                        payload: serde_json::json!({
                            "state": plan_info.state.to_string(),
                            "timeout_action": default_action.as_str(),
                        }),
                    };
                    
                    let _ = event_tx.send(event);
                }
            }
        });
        
        self.timeout_checker_handle = Some(handle);
    }
    
    /// Monitor task status to update plan states
    async fn monitor_task_status(&self) -> PhoenixResult<()> {
        let mut rx = self.core.subscribe();
        let plans = Arc::clone(&self.plans);
        let task_plans = Arc::clone(&self.task_plans);
        let is_running = Arc::clone(&self.is_running);
        let event_tx = self.event_tx.clone();
        
        tokio::spawn(async move {
            while *is_running.read().await {
                match rx.recv().await {
                    Ok(event) => {
                        // Check for task status updates
                        if event.event_type == "task_status_update" && event.task_id.is_some() {
                            let task_id = event.task_id.unwrap();
                            let task_status_str = if let Some(status) = event.payload.get("status") {
                                status.as_str().unwrap_or_default()
                            } else {
                                continue;
                            };
                            
                            let task_status = match task_status_str {
                                "Completed" => Some(TaskStatus::Completed),
                                "Failed" => Some(TaskStatus::Failed),
                                _ => None,
                            };
                            
                            if let Some(status) = task_status {
                                // Get plans for this task
                                let plan_ids = {
                                    let task_plans_map = task_plans.read().await;
                                    task_plans_map.get(&task_id)
                                        .cloned()
                                        .unwrap_or_else(Vec::new)
                                };
                                
                                // Update plans based on task status
                                for plan_id in plan_ids {
                                    let mut plans_map = plans.write().await;
                                    if let Some(plan) = plans_map.get_mut(&plan_id) {
                                        // Only update active plans
                                        if plan.state == PlanState::InExecution {
                                            // Set plan state based on task status
                                            plan.state = match status {
                                                TaskStatus::Completed => PlanState::Completed,
                                                TaskStatus::Failed => PlanState::Failed,
                                                _ => continue,
                                            };
                                            
                                            plan.updated_at = SystemTime::now();
                                            
                                            // Broadcast plan update event
                                            let event = PlanEvent {
                                                id: Uuid::new_v4().to_string(),
                                                timestamp: chrono::Utc::now().to_rfc3339(),
                                                event_type: "plan_state_updated".to_string(),
                                                plan_id: plan_id.clone(),
                                                task_id: task_id.clone(),
                                                agent_id: plan.agent_id.clone(),
                                                payload: serde_json::json!({
                                                    "state": plan.state.to_string(),
                                                    "reason": format!("Task status changed to {}", task_status_str),
                                                }),
                                            };
                                            
                                            let _ = event_tx.send(event);
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
        
        Ok(())
    }
    
    /// Stop the Planner system
    pub async fn stop(&mut self) -> PhoenixResult<()> {
        // Check if running
        {
            let running = self.is_running.read().await;
            if !*running {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::NotRunning,
                    message: "Planner is not running".to_string(),
                    component: "Planner".to_string(),
                });
            }
        }
        
        // Mark as not running
        {
            let mut running = self.is_running.write().await;
            *running = false;
        }
        
        // Stop timeout checker
        if let Some(handle) = self.timeout_checker_handle.take() {
            handle.abort();
        }
        
        Ok(())
    }
    
    /// Create a new implementation plan
    pub async fn create_plan(
        &self,
        title: String,
        description: String,
        task_id: String,
        agent_id: String,
        steps: Vec<String>,
        metadata: Option<HashMap<String, String>>,
    ) -> PhoenixResult<String> {
        // Validate the task exists
        self.core.get_task(&task_id).await?;
        
        // Validate the agent exists
        self.core.get_agent(&agent_id).await?;
        
        // Create unique ID for plan
        let plan_id = Uuid::new_v4().to_string();
        
        // Create plan steps
        let mut plan_steps = Vec::new();
        for (idx, step_desc) in steps.iter().enumerate() {
            let step_id = Uuid::new_v4().to_string();
            plan_steps.push(PlanStep {
                id: step_id,
                number: (idx + 1) as u32,
                description: step_desc.clone(),
                status: StepStatus::Pending,
                metadata: HashMap::new(),
                agent_feedback: None,
                user_feedback: None,
            });
        }
        
        // Create plan info
        let now = SystemTime::now();
        let mut plan_info = PlanInfo {
            id: plan_id.clone(),
            title,
            description,
            task_id: task_id.clone(),
            agent_id: agent_id.clone(),
            state: PlanState::Drafting,
            created_at: now,
            updated_at: now,
            steps: plan_steps,
            artifact_id: None,
            awaiting_feedback: false,
            metadata: metadata.unwrap_or_default(),
        };
        
        // Store plan
        {
            let mut plans = self.plans.write().await;
            plans.insert(plan_id.clone(), plan_info.clone());
        }
        
        // Update task plans mapping
        {
            let mut task_plans = self.task_plans.write().await;
            let task_plan_list = task_plans.entry(task_id.clone()).or_insert_with(Vec::new);
            task_plan_list.push(plan_id.clone());
        }
        
        // Create JSON representation of the plan
        let plan_json = serde_json::to_string_pretty(&plan_info)
            .map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::SerializationError,
                message: format!("Failed to serialize plan to JSON: {}", e),
                component: "Planner".to_string(),
            })?;
            
        // Store plan as an artifact
        let artifact_id = self.artifact_system
            .create_artifact(
                format!("Plan: {}", plan_info.title),
                ArtifactType::Json,
                task_id.clone(),
                agent_id.clone(),
                "application/json".to_string(),
                plan_json.into_bytes(),
                Some(plan_info.description.clone()),
                None,
                None,
                None,
            ).await?;
            
        // Update plan with artifact ID
        {
            let mut plans = self.plans.write().await;
            if let Some(plan) = plans.get_mut(&plan_id) {
                plan.artifact_id = Some(artifact_id);
            }
        }
        
        // Update plan info for broadcasting
        plan_info.artifact_id = Some(artifact_id);
        
        // Broadcast plan creation event
        self.broadcast_plan_event(
            "plan_created",
            &plan_id,
            &task_id,
            &agent_id,
            serde_json::json!({
                "title": plan_info.title,
                "step_count": plan_info.steps.len(),
            }),
        ).await?;
        
        Ok(plan_id)
    }
    
    /// Update plan state
    pub async fn update_plan_state(
        &self,
        plan_id: &str,
        state: PlanState,
        reason: Option<String>,
    ) -> PhoenixResult<()> {
        // Get plan
        let mut plan_info = {
            let plans = self.plans.read().await;
            plans.get(plan_id).cloned().ok_or_else(|| PhoenixError::Agent {
                kind: AgentErrorKind::NotFound,
                message: format!("Plan with ID {} not found", plan_id),
                component: "Planner".to_string(),
            })?
        };
        
        // Special handling of state transitions
        match state {
            PlanState::AwaitingFeedback => {
                plan_info.awaiting_feedback = true;
            },
            PlanState::Approved | PlanState::Rejected => {
                plan_info.awaiting_feedback = false;
            },
            PlanState::InExecution => {
                // If moving to execution, mark first step as in progress if none are
                if !plan_info.steps.iter().any(|s| s.status == StepStatus::InProgress) {
                    if let Some(first_step) = plan_info.steps.iter_mut().find(|s| s.status == StepStatus::Pending) {
                        first_step.status = StepStatus::InProgress;
                    }
                }
            },
            _ => { }
        }
        
        // Update plan state
        plan_info.state = state;
        plan_info.updated_at = SystemTime::now();
        
        if let Some(reason_str) = reason {
            plan_info.metadata.insert("state_change_reason".to_string(), reason_str.clone());
        }
        
        // Store updated plan
        {
            let mut plans = self.plans.write().await;
            plans.insert(plan_id.to_string(), plan_info.clone());
        }
        
        // Update JSON artifact if it exists
        if let Some(artifact_id) = &plan_info.artifact_id {
            let plan_json = serde_json::to_string_pretty(&plan_info)
                .map_err(|e| PhoenixError::Agent {
                    kind: AgentErrorKind::SerializationError,
                    message: format!("Failed to serialize updated plan to JSON: {}", e),
                    component: "Planner".to_string(),
                })?;
                
            // Create a new revision of the artifact
            self.artifact_system
                .create_artifact(
                    format!("Plan: {}", plan_info.title),
                    ArtifactType::Json,
                    plan_info.task_id.clone(),
                    plan_info.agent_id.clone(),
                    "application/json".to_string(),
                    plan_json.into_bytes(),
                    Some(plan_info.description.clone()),
                    None,
                    Some(artifact_id.clone()),
                    None,
                ).await?;
        }
        
        // Broadcast plan state update event
        self.broadcast_plan_event(
            "plan_state_updated",
            plan_id,
            &plan_info.task_id,
            &plan_info.agent_id,
            serde_json::json!({
                "state": plan_info.state.to_string(),
                "reason": reason.unwrap_or_else(|| "State updated".to_string()),
                "awaiting_feedback": plan_info.awaiting_feedback,
            }),
        ).await?;
        
        Ok(())
    }
    
    /// Submit feedback on a plan
    pub async fn submit_feedback(
        &self,
        plan_id: &str,
        feedback_action: FeedbackAction,
        user_id: &str,
    ) -> PhoenixResult<()> {
        // Get plan
        let mut plan_info = {
            let plans = self.plans.read().await;
            plans.get(plan_id).cloned().ok_or_else(|| PhoenixError::Agent {
                kind: AgentErrorKind::NotFound,
                message: format!("Plan with ID {} not found", plan_id),
                component: "Planner".to_string(),
            })?
        };
        
        // Check if plan is awaiting feedback
        if !plan_info.awaiting_feedback && plan_info.state != PlanState::AwaitingFeedback {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::InvalidState,
                message: format!("Plan is not awaiting feedback (current state: {})", plan_info.state),
                component: "Planner".to_string(),
            });
        }
        
        // Apply feedback based on action type
        match feedback_action {
            FeedbackAction::ApproveAll => {
                plan_info.state = PlanState::Approved;
                plan_info.metadata.insert("approved_by".to_string(), user_id.to_string());
                plan_info.awaiting_feedback = false;
            },
            FeedbackAction::RejectAll => {
                plan_info.state = PlanState::Rejected;
                plan_info.metadata.insert("rejected_by".to_string(), user_id.to_string());
                plan_info.awaiting_feedback = false;
            },
            FeedbackAction::ModifyStep(step_id, new_description) => {
                let step = plan_info.steps.iter_mut()
                    .find(|s| s.id == step_id)
                    .ok_or_else(|| PhoenixError::Agent {
                        kind: AgentErrorKind::NotFound,
                        message: format!("Step with ID {} not found in plan", step_id),
                        component: "Planner".to_string(),
                    })?;
                
                // Store original description in metadata
                step.metadata.insert("original_description".to_string(), step.description.clone());
                
                // Update step with new description
                step.description = new_description;
                step.status = StepStatus::Modified;
                step.user_feedback = Some(format!("Modified by user {}", user_id));
                
                // Keep the plan in awaiting feedback state if more feedback expected
                plan_info.metadata.insert("has_modifications".to_string(), "true".to_string());
            },
            FeedbackAction::SkipStep(step_id) => {
                let step = plan_info.steps.iter_mut()
                    .find(|s| s.id == step_id)
                    .ok_or_else(|| PhoenixError::Agent {
                        kind: AgentErrorKind::NotFound,
                        message: format!("Step with ID {} not found in plan", step_id),
                        component: "Planner".to_string(),
                    })?;
                
                // Mark step as skipped
                step.status = StepStatus::Skipped;
                step.user_feedback = Some(format!("Skipped by user {}", user_id));
                
                // Keep the plan in awaiting feedback state if more feedback expected
                plan_info.metadata.insert("has_modifications".to_string(), "true".to_string());
            },
            FeedbackAction::ChangeApproach(step_id, new_approach) => {
                let step = plan_info.steps.iter_mut()
                    .find(|s| s.id == step_id)
                    .ok_or_else(|| PhoenixError::Agent {
                        kind: AgentErrorKind::NotFound,
                        message: format!("Step with ID {} not found in plan", step_id),
                        component: "Planner".to_string(),
                    })?;
                
                // Store original description in metadata
                step.metadata.insert("original_description".to_string(), step.description.clone());
                step.metadata.insert("approach_changed".to_string(), "true".to_string());
                
                // Update step with new approach
                step.description = format!("{} (APPROACH CHANGED: {})", step.description, new_approach);
                step.status = StepStatus::Modified;
                step.user_feedback = Some(format!("Approach changed by user {}: {}", user_id, new_approach));
                
                // Keep the plan in awaiting feedback state if more feedback expected
                plan_info.metadata.insert("has_modifications".to_string(), "true".to_string());
            },
            FeedbackAction::AddStep(after_step_id, new_step_description) => {
                // Find the position to insert the new step
                let insert_pos = plan_info.steps.iter()
                    .position(|s| s.id == after_step_id)
                    .map(|pos| pos + 1)
                    .ok_or_else(|| PhoenixError::Agent {
                        kind: AgentErrorKind::NotFound,
                        message: format!("Step with ID {} not found in plan", after_step_id),
                        component: "Planner".to_string(),
                    })?;
                
                // Create new step
                let new_step = PlanStep {
                    id: Uuid::new_v4().to_string(),
                    number: 0, // Will update numbers below
                    description: new_step_description,
                    status: StepStatus::Pending,
                    metadata: {
                        let mut map = HashMap::new();
                        map.insert("added_by".to_string(), user_id.to_string());
                        map.insert("added_after".to_string(), after_step_id);
                        map
                    },
                    agent_feedback: None,
                    user_feedback: Some(format!("Added by user {}", user_id)),
                };
                
                // Insert the new step
                plan_info.steps.insert(insert_pos, new_step);
                
                // Update all step numbers
                for (idx, step) in plan_info.steps.iter_mut().enumerate() {
                    step.number = (idx + 1) as u32;
                }
                
                // Keep the plan in awaiting feedback state if more feedback expected
                plan_info.metadata.insert("has_modifications".to_string(), "true".to_string());
            },
        }
        
        // Update timestamp
        plan_info.updated_at = SystemTime::now();
        
        // Store updated plan
        {
            let mut plans = self.plans.write().await;
            plans.insert(plan_id.to_string(), plan_info.clone());
        }
        
        // Update JSON artifact if it exists
        if let Some(artifact_id) = &plan_info.artifact_id {
            let plan_json = serde_json::to_string_pretty(&plan_info)
                .map_err(|e| PhoenixError::Agent {
                    kind: AgentErrorKind::SerializationError,
                    message: format!("Failed to serialize updated plan to JSON: {}", e),
                    component: "Planner".to_string(),
                })?;
                
            // Create a new revision of the artifact
            self.artifact_system
                .create_artifact(
                    format!("Plan: {}", plan_info.title),
                    ArtifactType::Json,
                    plan_info.task_id.clone(),
                    plan_info.agent_id.clone(),
                    "application/json".to_string(),
                    plan_json.into_bytes(),
                    Some(format!("Updated plan with user feedback from {}", user_id)),
                    None,
                    Some(artifact_id.clone()),
                    None,
                ).await?;
        }
        
        // Broadcast plan feedback event
        let feedback_type = match feedback_action {
            FeedbackAction::ApproveAll => "approve_all",
            FeedbackAction::RejectAll => "reject_all",
            FeedbackAction::ModifyStep(_, _) => "modify_step",
            FeedbackAction::SkipStep(_) => "skip_step",
            FeedbackAction::ChangeApproach(_, _) => "change_approach",
            FeedbackAction::AddStep(_, _) => "add_step",
        };
        
        self.broadcast_plan_event(
            "plan_feedback_received",
            plan_id,
            &plan_info.task_id,
            &plan_info.agent_id,
            serde_json::json!({
                "feedback_type": feedback_type,
                "user_id": user_id,
                "state": plan_info.state.to_string(),
                "has_modifications": plan_info.metadata.get("has_modifications").cloned().unwrap_or_else(|| "false".to_string()),
            }),
        ).await?;
        
        Ok(())
    }
    
    /// Update step status in a plan
    pub async fn update_step_status(
        &self,
        plan_id: &str,
        step_id: &str,
        status: StepStatus,
        agent_feedback: Option<String>,
    ) -> PhoenixResult<()> {
        // Get plan
        let mut plan_info = {
            let plans = self.plans.read().await;
            plans.get(plan_id).cloned().ok_or_else(|| PhoenixError::Agent {
                kind: AgentErrorKind::NotFound,
                message: format!("Plan with ID {} not found", plan_id),
                component: "Planner".to_string(),
            })?
        };
        
        // Find and update the step
        let step = plan_info.steps.iter_mut()
            .find(|s| s.id == step_id)
            .ok_or_else(|| PhoenixError::Agent {
                kind: AgentErrorKind::NotFound,
                message: format!("Step with ID {} not found in plan", step_id),
                component: "Planner".to_string(),
            })?;
        
        // Update step status
        step.status = status.clone();
        if let Some(feedback) = agent_feedback {
            step.agent_feedback = Some(feedback);
        }
        
        // If completing a step, check if we should mark the next one as in progress
        if status == StepStatus::Completed {
            if let Some(next_step) = plan_info.steps.iter_mut()
                .find(|s| s.number == step.number + 1 && s.status == StepStatus::Pending)
            {
                next_step.status = StepStatus::InProgress;
            }
            
            // Check if all steps are completed or skipped
            let all_done = plan_info.steps.iter().all(|s| {
                matches!(s.status, StepStatus::Completed | StepStatus::Skipped)
            });
            
            if all_done {
                plan_info.state = PlanState::Completed;
            }
        }
        
        // Update timestamp
        plan_info.updated_at = SystemTime::now();
        
        // Store updated plan
        {
            let mut plans = self.plans.write().await;
            plans.insert(plan_id.to_string(), plan_info.clone());
        }
        
        // Update JSON artifact if it exists
        if let Some(artifact_id) = &plan_info.artifact_id {
            let plan_json = serde_json::to_string_pretty(&plan_info)
                .map_err(|e| PhoenixError::Agent {
                    kind: AgentErrorKind::SerializationError,
                    message: format!("Failed to serialize updated plan to JSON: {}", e),
                    component: "Planner".to_string(),
                })?;
                
            // Create a new revision of the artifact
            self.artifact_system
                .create_artifact(
                    format!("Plan: {}", plan_info.title),
                    ArtifactType::Json,
                    plan_info.task_id.clone(),
                    plan_info.agent_id.clone(),
                    "application/json".to_string(),
                    plan_json.into_bytes(),
                    Some(format!("Updated step {} status to {}", step.number, status)),
                    None,
                    Some(artifact_id.clone()),
                    None,
                ).await?;
        }
        
        // Broadcast step update event
        self.broadcast_plan_event(
            "plan_step_updated",
            plan_id,
            &plan_info.task_id,
            &plan_info.agent_id,
            serde_json::json!({
                "step_id": step_id,
                "step_number": step.number,
                "status": status.to_string(),
                "has_feedback": step.agent_feedback.is_some(),
            }),
        ).await?;
        
        Ok(())
    }
    
    /// Get a plan by ID
    pub async fn get_plan(&self, plan_id: &str) -> PhoenixResult<PlanInfo> {
        let plans = self.plans.read().await;
        plans.get(plan_id).cloned().ok_or_else(|| PhoenixError::Agent {
            kind: AgentErrorKind::NotFound,
            message: format!("Plan with ID {} not found", plan_id),
            component: "Planner".to_string(),
        })
    }
    
    /// Request feedback for a plan
    pub async fn request_feedback(
        &self,
        plan_id: &str,
        message: Option<String>,
    ) -> PhoenixResult<()> {
        // Get plan
        let mut plan_info = {
            let plans = self.plans.read().await;
            plans.get(plan_id).cloned().ok_or_else(|| PhoenixError::Agent {
                kind: AgentErrorKind::NotFound,
                message: format!("Plan with ID {} not found", plan_id),
                component: "Planner".to_string(),
            })?
        };
        
        // Update plan state
        plan_info.state = PlanState::AwaitingFeedback;
        plan_info.awaiting_feedback = true;
        plan_info.updated_at = SystemTime::now();
        
        if let Some(msg) = message.clone() {
            plan_info.metadata.insert("feedback_request_message".to_string(), msg);
        }
        
        // Store updated plan
        {
            let mut plans = self.plans.write().await;
            plans.insert(plan_id.to_string(), plan_info.clone());
        }
        
        // Update JSON artifact if it exists
        if let Some(artifact_id) = &plan_info.artifact_id {
            let plan_json = serde_json::to_string_pretty(&plan_info)
                .map_err(|e| PhoenixError::Agent {
                    kind: AgentErrorKind::SerializationError,
                    message: format!("Failed to serialize updated plan to JSON: {}", e),
                    component: "Planner".to_string(),
                })?;
                
            // Create a new revision of the artifact
            self.artifact_system
                .create_artifact(
                    format!("Plan: {}", plan_info.title),
                    ArtifactType::Json,
                    plan_info.task_id.clone(),
                    plan_info.agent_id.clone(),
                    "application/json".to_string(),
                    plan_json.into_bytes(),
                    Some("Requesting feedback on plan".to_string()),
                    None,
                    Some(artifact_id.clone()),
                    None,
                ).await?;
        }
        
        // Broadcast feedback request event
        self.broadcast_plan_event(
            "plan_feedback_requested",
            plan_id,
            &plan_info.task_id,
            &plan_info.agent_id,
            serde_json::json!({
                "message": message.unwrap_or_else(|| "Feedback requested for plan".to_string()),
                "timeout_seconds": self.config.feedback_timeout_seconds,
            }),
        ).await?;
        
        Ok(())
    }
    
    /// Get plans for a task
    pub async fn get_task_plans(&self, task_id: &str) -> PhoenixResult<Vec<PlanInfo>> {
        // Check if task exists
        self.core.get_task(task_id).await?;
        
        // Get plan IDs for the task
        let plan_ids = {
            let task_plans = self.task_plans.read().await;
            task_plans.get(task_id).cloned().unwrap_or_else(Vec::new)
        };
        
        // Get plan info for each ID
        let mut task_plans = Vec::new();
        let plans = self.plans.read().await;
        
        for id in plan_ids {
            if let Some(plan) = plans.get(&id) {
                task_plans.push(plan.clone());
            }
        }
        
        // Sort by creation time (latest first)
        task_plans.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        
        Ok(task_plans)
    }
    
    /// Get SSE subscriber for real-time updates
    pub fn subscribe(&self) -> broadcast::Receiver<PlanEvent> {
        self.event_tx.subscribe()
    }
    
    /// Broadcast a plan event
    async fn broadcast_plan_event(
        &self,
        event_type: &str,
        plan_id: &str,
        task_id: &str,
        agent_id: &str,
        payload: serde_json::Value,
    ) -> PhoenixResult<()> {
        let event = PlanEvent {
            id: Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            event_type: event_type.to_string(),
            plan_id: plan_id.to_string(),
            task_id: task_id.to_string(),
            agent_id: agent_id.to_string(),
            payload,
        };
        
        // Broadcast the event
        if self.event_tx.send(event).is_err() {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::CommunicationError,
                message: "Failed to broadcast event (no subscribers)".to_string(),
                component: "Planner".to_string(),
            });
        }
        
        Ok(())
    }
}

/// Helper implementation for TimeoutAction
impl TimeoutAction {
    /// Parse from string
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "proceed" => TimeoutAction::Proceed,
            "suggest_alternative" => TimeoutAction::SuggestAlternative,
            _ => TimeoutAction::Fail,
        }
    }
    
    /// Parse from string with default
    pub fn from_str_or_default(s: Option<&str>) -> Self {
        if let Some(action_str) = s {
            Self::from_str(action_str)
        } else {
            TimeoutAction::Prompt
        }
    }
}

/// Values for the TimeoutAction::Prompt variant - used in the configuration
impl TimeoutAction {
    /// Prompt the agent to pause and request further instructions
    pub const Prompt: Self = TimeoutAction::SuggestAlternative;
}