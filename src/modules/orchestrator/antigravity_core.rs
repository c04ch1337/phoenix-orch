//! Antigravity Core Implementation
//!
//! This module contains the core functionality for the Antigravity integration,
//! providing mission control, task queuing, agent tracking, and real-time event broadcasting.

use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use tokio::sync::{broadcast, mpsc, RwLock};
use tokio::task::JoinHandle;

use crate::modules::orchestrator::errors::{AgentErrorKind, PhoenixError, PhoenixResult};
use crate::modules::orchestrator::types::RequestId;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Task status in the Antigravity system
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TaskStatus {
    /// Task is queued for execution
    Queued,
    /// Task is currently being planned
    Planning,
    /// Task is currently running
    Running,
    /// Task is awaiting feedback from user or other systems
    AwaitingFeedback,
    /// Task has been paused
    Paused,
    /// Task has been successfully completed
    Completed,
    /// Task has failed
    Failed,
    /// Task has been cancelled
    Cancelled,
}

impl std::fmt::Display for TaskStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TaskStatus::Queued => write!(f, "Queued"),
            TaskStatus::Planning => write!(f, "Planning"),
            TaskStatus::Running => write!(f, "Running"),
            TaskStatus::AwaitingFeedback => write!(f, "Awaiting Feedback"),
            TaskStatus::Paused => write!(f, "Paused"),
            TaskStatus::Completed => write!(f, "Completed"),
            TaskStatus::Failed => write!(f, "Failed"),
            TaskStatus::Cancelled => write!(f, "Cancelled"),
        }
    }
}

/// Agent status in the Antigravity system
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AgentStatus {
    /// Agent is initializing
    Initializing,
    /// Agent is idle and ready for tasks
    Idle,
    /// Agent is working on a task
    Working,
    /// Agent is paused
    Paused,
    /// Agent is terminating
    Terminating,
    /// Agent has been terminated
    Terminated,
    /// Agent is in an error state
    Error,
}

impl std::fmt::Display for AgentStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AgentStatus::Initializing => write!(f, "Initializing"),
            AgentStatus::Idle => write!(f, "Idle"),
            AgentStatus::Working => write!(f, "Working"),
            AgentStatus::Paused => write!(f, "Paused"),
            AgentStatus::Terminating => write!(f, "Terminating"),
            AgentStatus::Terminated => write!(f, "Terminated"),
            AgentStatus::Error => write!(f, "Error"),
        }
    }
}

/// Agent type in the Antigravity system
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AgentType {
    /// Ember Unit agent
    EmberUnit,
    /// Cipher Guard agent
    CipherGuard,
    /// Main orchestrator agent
    Orchestrator,
    /// Custom agent type
    Custom(String),
}

impl std::fmt::Display for AgentType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AgentType::EmberUnit => write!(f, "EmberUnit"),
            AgentType::CipherGuard => write!(f, "CipherGuard"),
            AgentType::Orchestrator => write!(f, "Orchestrator"),
            AgentType::Custom(name) => write!(f, "Custom({})", name),
        }
    }
}

/// Agent information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    /// Unique agent ID
    pub id: String,
    /// Agent name
    pub name: String,
    /// Agent type
    pub agent_type: AgentType,
    /// Current status
    pub status: AgentStatus,
    /// When the agent was created
    pub created_at: SystemTime,
    /// When the agent was last updated
    pub last_updated: SystemTime,
    /// Current task ID (if any)
    pub current_task_id: Option<String>,
    /// Additional agent-specific metadata
    pub metadata: HashMap<String, String>,
}

/// Task information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskInfo {
    /// Unique task ID
    pub id: String,
    /// Task title
    pub title: String,
    /// Task description
    pub description: String,
    /// Current status
    pub status: TaskStatus,
    /// ID of the agent assigned to this task (if any)
    pub agent_id: Option<String>,
    /// When the task was created
    pub created_at: SystemTime,
    /// When the task was last updated
    pub last_updated: SystemTime,
    /// Progress (0-100)
    pub progress: u8,
    /// Additional task-specific metadata
    pub metadata: HashMap<String, String>,
    /// Task priority (0-100, higher is more important)
    pub priority: u8,
}

/// Event broadcasted to clients for real-time updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AntigravityEvent {
    /// Unique event ID
    pub id: String,
    /// Event timestamp
    pub timestamp: String,
    /// Event type
    pub event_type: String,
    /// Agent ID (if this event is about an agent)
    pub agent_id: Option<String>,
    /// Task ID (if this event is about a task)
    pub task_id: Option<String>,
    /// Event payload
    pub payload: serde_json::Value,
}

/// Configuration for the Antigravity Core
#[derive(Debug, Clone)]
pub struct AntigravityCoreConfig {
    /// Maximum number of tasks to keep in history
    pub max_task_history: usize,
    /// Maximum number of agents to manage
    pub max_agents: usize,
    /// SSE broadcast channel capacity
    pub broadcast_capacity: usize,
    /// Task queue capacity
    pub task_queue_capacity: usize,
    /// Agent polling interval in milliseconds
    pub agent_poll_interval_ms: u64,
}

impl Default for AntigravityCoreConfig {
    fn default() -> Self {
        Self {
            max_task_history: 1000,
            max_agents: 100,
            broadcast_capacity: 1000,
            task_queue_capacity: 100,
            agent_poll_interval_ms: 500,
        }
    }
}

/// Command sent to an agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentCommand {
    /// Command ID
    pub id: String,
    /// Agent ID
    pub agent_id: String,
    /// Command type
    pub command_type: String,
    /// Command parameters
    pub parameters: HashMap<String, String>,
    /// When the command was created
    pub created_at: SystemTime,
    /// Timeout for the command
    pub timeout: Duration,
}

/// Response from an agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResponse {
    /// Command ID this is responding to
    pub command_id: String,
    /// Agent ID
    pub agent_id: String,
    /// Whether the command was successful
    pub success: bool,
    /// Response message
    pub message: String,
    /// Additional response data
    pub data: Option<serde_json::Value>,
    /// When the response was created
    pub created_at: SystemTime,
}

/// Main Antigravity Core - the central coordinator for the Mission Control system
pub struct AntigravityCore {
    /// Configuration
    config: AntigravityCoreConfig,
    /// Agent registry
    agents: Arc<RwLock<HashMap<String, AgentInfo>>>,
    /// Task registry
    tasks: Arc<RwLock<HashMap<String, TaskInfo>>>,
    /// Active task queue
    task_queue: Arc<RwLock<VecDeque<String>>>,
    /// Broadcast channel for SSE events
    event_tx: Arc<broadcast::Sender<AntigravityEvent>>,
    /// Command channels for agents (agent_id -> sender)
    command_channels: Arc<RwLock<HashMap<String, mpsc::Sender<AgentCommand>>>>,
    /// JoinHandles for background tasks
    background_tasks: Arc<RwLock<Vec<JoinHandle<()>>>>,
    /// Tracks if the system is running
    is_running: Arc<RwLock<bool>>,
}

impl AntigravityCore {
    /// Create a new AntigravityCore instance
    pub fn new(config: AntigravityCoreConfig) -> Self {
        let (tx, _) = broadcast::channel(config.broadcast_capacity);
        Self {
            config,
            agents: Arc::new(RwLock::new(HashMap::new())),
            tasks: Arc::new(RwLock::new(HashMap::new())),
            task_queue: Arc::new(RwLock::new(VecDeque::new())),
            event_tx: Arc::new(tx),
            command_channels: Arc::new(RwLock::new(HashMap::new())),
            background_tasks: Arc::new(RwLock::new(Vec::new())),
            is_running: Arc::new(RwLock::new(false)),
        }
    }

    /// Initialize and start the Antigravity Core
    pub async fn start(&self) -> PhoenixResult<()> {
        // Check if already running
        {
            let running = self.is_running.read().await;
            if *running {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::AlreadyRunning,
                    message: "Antigravity Core is already running".to_string(),
                    component: "AntigravityCore".to_string(),
                });
            }
        }

        // Mark as running
        {
            let mut running = self.is_running.write().await;
            *running = true;
        }

        // Start task processor
        self.start_task_processor().await?;

        // Start agent monitor
        self.start_agent_monitor().await?;

        // Broadcast system start event
        self.broadcast_event(
            "system_started",
            None,
            None,
            serde_json::json!({
                "timestamp": chrono::Utc::now().to_rfc3339(),
                "message": "Antigravity Mission Control system started"
            }),
        )
        .await?;

        Ok(())
    }

    /// Stop the Antigravity Core
    pub async fn stop(&self) -> PhoenixResult<()> {
        // Check if running
        {
            let running = self.is_running.read().await;
            if !*running {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::NotRunning,
                    message: "Antigravity Core is not running".to_string(),
                    component: "AntigravityCore".to_string(),
                });
            }
        }

        // Mark as not running
        {
            let mut running = self.is_running.write().await;
            *running = false;
        }

        // Stop all background tasks
        let mut tasks = self.background_tasks.write().await;
        while let Some(handle) = tasks.pop() {
            handle.abort();
        }

        // Broadcast system stop event
        self.broadcast_event(
            "system_stopped",
            None,
            None,
            serde_json::json!({
                "timestamp": chrono::Utc::now().to_rfc3339(),
                "message": "Antigravity Mission Control system stopped"
            }),
        )
        .await?;

        Ok(())
    }

    /// Start the task processor background task
    async fn start_task_processor(&self) -> PhoenixResult<()> {
        let task_queue = Arc::clone(&self.task_queue);
        let tasks = Arc::clone(&self.tasks);
        let agents = Arc::clone(&self.agents);
        let command_channels = Arc::clone(&self.command_channels);
        let event_tx = Arc::clone(&self.event_tx);
        let is_running = Arc::clone(&self.is_running);

        let handle = tokio::spawn(async move {
            while *is_running.read().await {
                // Process one task from the queue
                let task_id = {
                    let mut queue = task_queue.write().await;
                    queue.pop_front()
                };

                if let Some(task_id) = task_id {
                    // Get task info
                    let task_info = {
                        let task_map = tasks.read().await;
                        task_map.get(&task_id).cloned()
                    };

                    if let Some(mut task) = task_info {
                        if task.status == TaskStatus::Queued {
                            // Update status to Planning
                            task.status = TaskStatus::Planning;
                            task.last_updated = SystemTime::now();

                            // Update task in registry
                            {
                                let mut task_map = tasks.write().await;
                                task_map.insert(task_id.clone(), task.clone());
                            }

                            // Broadcast task status update
                            let event = AntigravityEvent {
                                id: Uuid::new_v4().to_string(),
                                timestamp: chrono::Utc::now().to_rfc3339(),
                                event_type: "task_status_update".to_string(),
                                agent_id: task.agent_id.clone(),
                                task_id: Some(task_id.clone()),
                                payload: serde_json::json!({
                                    "status": task.status.to_string(),
                                    "progress": task.progress,
                                }),
                            };
                            let _ = event_tx.send(event);

                            // If task is assigned to an agent, notify it
                            if let Some(agent_id) = &task.agent_id {
                                let channels = command_channels.read().await;
                                if let Some(tx) = channels.get(agent_id) {
                                    let command = AgentCommand {
                                        id: Uuid::new_v4().to_string(),
                                        agent_id: agent_id.clone(),
                                        command_type: "execute_task".to_string(),
                                        parameters: {
                                            let mut params = HashMap::new();
                                            params.insert("task_id".to_string(), task_id.clone());
                                            params
                                        },
                                        created_at: SystemTime::now(),
                                        timeout: Duration::from_secs(60),
                                    };

                                    if let Err(e) = tx.send(command).await {
                                        // If we couldn't send to agent, update task status to Failed
                                        let mut task_map = tasks.write().await;
                                        if let Some(mut task) = task_map.get_mut(&task_id) {
                                            task.status = TaskStatus::Failed;
                                            task.last_updated = SystemTime::now();
                                            task.metadata.insert(
                                                "error".to_string(),
                                                format!("Failed to notify agent: {}", e),
                                            );
                                        }
                                    } else {
                                        // Update agent status to Working
                                        let mut agent_map = agents.write().await;
                                        if let Some(mut agent) = agent_map.get_mut(agent_id) {
                                            agent.status = AgentStatus::Working;
                                            agent.current_task_id = Some(task_id.clone());
                                            agent.last_updated = SystemTime::now();
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Sleep briefly before processing next task
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        });

        // Store join handle
        let mut tasks = self.background_tasks.write().await;
        tasks.push(handle);

        Ok(())
    }

    /// Start the agent monitor background task
    async fn start_agent_monitor(&self) -> PhoenixResult<()> {
        let agents = Arc::clone(&self.agents);
        let event_tx = Arc::clone(&self.event_tx);
        let is_running = Arc::clone(&self.is_running);
        let poll_interval = self.config.agent_poll_interval_ms;

        let handle = tokio::spawn(async move {
            while *is_running.read().await {
                // Check agent status
                let agent_ids = {
                    let agent_map = agents.read().await;
                    agent_map.keys().cloned().collect::<Vec<_>>()
                };

                for agent_id in agent_ids {
                    let agent = {
                        let agent_map = agents.read().await;
                        agent_map.get(&agent_id).cloned()
                    };

                    if let Some(agent) = agent {
                        // Check for stale agents (not updated in the last 60 seconds)
                        let now = SystemTime::now();
                        if let Ok(elapsed) = now.duration_since(agent.last_updated) {
                            if elapsed.as_secs() > 60 && agent.status != AgentStatus::Error && agent.status != AgentStatus::Terminated {
                                // Mark agent as error
                                let mut agent_map = agents.write().await;
                                if let Some(agent) = agent_map.get_mut(&agent_id) {
                                    agent.status = AgentStatus::Error;
                                    agent.last_updated = now;
                                    agent.metadata.insert(
                                        "error".to_string(),
                                        "Agent not responding".to_string(),
                                    );

                                    // Broadcast agent status update
                                    let event = AntigravityEvent {
                                        id: Uuid::new_v4().to_string(),
                                        timestamp: chrono::Utc::now().to_rfc3339(),
                                        event_type: "agent_status_update".to_string(),
                                        agent_id: Some(agent_id.clone()),
                                        task_id: agent.current_task_id.clone(),
                                        payload: serde_json::json!({
                                            "status": agent.status.to_string(),
                                            "error": "Agent not responding",
                                        }),
                                    };
                                    let _ = event_tx.send(event);
                                }
                            }
                        }
                    }
                }

                // Sleep before checking again
                tokio::time::sleep(Duration::from_millis(poll_interval)).await;
            }
        });

        // Store join handle
        let mut tasks = self.background_tasks.write().await;
        tasks.push(handle);

        Ok(())
    }

    /// Register a new agent
    pub async fn register_agent(
        &self,
        name: String,
        agent_type: AgentType,
        metadata: Option<HashMap<String, String>>,
    ) -> PhoenixResult<String> {
        // Generate unique ID for the agent
        let agent_id = Uuid::new_v4().to_string();
        let now = SystemTime::now();

        // Create agent info
        let agent_info = AgentInfo {
            id: agent_id.clone(),
            name,
            agent_type,
            status: AgentStatus::Initializing,
            created_at: now,
            last_updated: now,
            current_task_id: None,
            metadata: metadata.unwrap_or_default(),
        };

        // Store agent info
        {
            let mut agents = self.agents.write().await;
            if agents.len() >= self.config.max_agents {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::LimitExceeded,
                    message: format!("Maximum number of agents ({}) reached", self.config.max_agents),
                    component: "AntigravityCore".to_string(),
                });
            }
            agents.insert(agent_id.clone(), agent_info.clone());
        }

        // Create command channel for the agent
        let (tx, mut rx) = mpsc::channel(100);
        {
            let mut channels = self.command_channels.write().await;
            channels.insert(agent_id.clone(), tx);
        }

        // Create response handler for this agent
        let agents_clone = Arc::clone(&self.agents);
        let tasks_clone = Arc::clone(&self.tasks);
        let event_tx_clone = Arc::clone(&self.event_tx);
        let agent_id_clone = agent_id.clone();

        let handle = tokio::spawn(async move {
            while let Some(command) = rx.recv().await {
                // Process command for the agent
                // In a real implementation, this would communicate with the actual agent
                // For now, we just update status and broadcast events

                // For demonstration, we'll simulate a response after a brief delay
                tokio::time::sleep(Duration::from_millis(500)).await;

                if command.command_type == "execute_task" {
                    let task_id = command.parameters.get("task_id").cloned();
                    if let Some(task_id) = task_id {
                        // Update task status to Running
                        let mut tasks = tasks_clone.write().await;
                        if let Some(mut task) = tasks.get_mut(&task_id) {
                            task.status = TaskStatus::Running;
                            task.last_updated = SystemTime::now();
                            task.progress = 10; // Start at 10%

                            // Broadcast task status update
                            let event = AntigravityEvent {
                                id: Uuid::new_v4().to_string(),
                                timestamp: chrono::Utc::now().to_rfc3339(),
                                event_type: "task_status_update".to_string(),
                                agent_id: Some(agent_id_clone.clone()),
                                task_id: Some(task_id.clone()),
                                payload: serde_json::json!({
                                    "status": task.status.to_string(),
                                    "progress": task.progress,
                                }),
                            };
                            let _ = event_tx_clone.send(event);

                            // For demonstration: Simulate task completion after a delay
                            let task_id_clone = task_id.clone();
                            let tasks_clone2 = tasks_clone.clone();
                            let agent_id_clone2 = agent_id_clone.clone();
                            let event_tx_clone2 = event_tx_clone.clone();
                            let agents_clone2 = agents_clone.clone();

                            tokio::spawn(async move {
                                // Simulate progress updates
                                for progress in [25, 50, 75, 100] {
                                    tokio::time::sleep(Duration::from_secs(1)).await;

                                    let mut tasks = tasks_clone2.write().await;
                                    if let Some(mut task) = tasks.get_mut(&task_id_clone) {
                                        task.progress = progress;
                                        task.last_updated = SystemTime::now();

                                        if progress == 100 {
                                            task.status = TaskStatus::Completed;
                                        }

                                        // Broadcast task status update
                                        let event = AntigravityEvent {
                                            id: Uuid::new_v4().to_string(),
                                            timestamp: chrono::Utc::now().to_rfc3339(),
                                            event_type: "task_status_update".to_string(),
                                            agent_id: Some(agent_id_clone2.clone()),
                                            task_id: Some(task_id_clone.clone()),
                                            payload: serde_json::json!({
                                                "status": task.status.to_string(),
                                                "progress": task.progress,
                                            }),
                                        };
                                        let _ = event_tx_clone2.send(event);

                                        // When task completes, update agent status to Idle
                                        if progress == 100 {
                                            let mut agents = agents_clone2.write().await;
                                            if let Some(mut agent) = agents.get_mut(&agent_id_clone2) {
                                                agent.status = AgentStatus::Idle;
                                                agent.current_task_id = None;
                                                agent.last_updated = SystemTime::now();

                                                // Broadcast agent status update
                                                let event = AntigravityEvent {
                                                    id: Uuid::new_v4().to_string(),
                                                    timestamp: chrono::Utc::now().to_rfc3339(),
                                                    event_type: "agent_status_update".to_string(),
                                                    agent_id: Some(agent_id_clone2.clone()),
                                                    task_id: None,
                                                    payload: serde_json::json!({
                                                        "status": agent.status.to_string(),
                                                    }),
                                                };
                                                let _ = event_tx_clone2.send(event);
                                            }
                                        }
                                    }
                                }
                            });
                        }
                    }
                }
            }
        });

        // Store join handle
        let mut tasks = self.background_tasks.write().await;
        tasks.push(handle);

        // Broadcast agent registration event
        self.broadcast_event(
            "agent_registered",
            Some(agent_id.clone()),
            None,
            serde_json::json!({
                "name": agent_info.name,
                "type": agent_info.agent_type.to_string(),
                "status": agent_info.status.to_string(),
            }),
        )
        .await?;

        Ok(agent_id)
    }

    /// Update agent status
    pub async fn update_agent_status(
        &self,
        agent_id: &str,
        status: AgentStatus,
        metadata_updates: Option<HashMap<String, String>>,
    ) -> PhoenixResult<()> {
        // Check if agent exists
        let mut agents = self.agents.write().await;
        let agent = agents.get_mut(agent_id).ok_or_else(|| PhoenixError::Agent {
            kind: AgentErrorKind::NotFound,
            message: format!("Agent with ID {} not found", agent_id),
            component: "AntigravityCore".to_string(),
        })?;

        // Update agent status
        agent.status = status;
        agent.last_updated = SystemTime::now();

        // Update metadata if provided
        if let Some(updates) = metadata_updates {
            for (key, value) in updates {
                agent.metadata.insert(key, value);
            }
        }

        // Broadcast agent status update
        drop(agents);
        self.broadcast_event(
            "agent_status_update",
            Some(agent_id.to_string()),
            None,
            serde_json::json!({
                "status": status.to_string(),
            }),
        )
        .await?;

        Ok(())
    }

    /// Create a new task
    pub async fn create_task(
        &self,
        title: String,
        description: String,
        agent_id: Option<String>,
        priority: Option<u8>,
        metadata: Option<HashMap<String, String>>,
    ) -> PhoenixResult<String> {
        // Validate agent_id if provided
        if let Some(agent_id) = &agent_id {
            let agents = self.agents.read().await;
            if !agents.contains_key(agent_id) {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::NotFound,
                    message: format!("Agent with ID {} not found", agent_id),
                    component: "AntigravityCore".to_string(),
                });
            }
        }

        // Generate unique ID for the task
        let task_id = Uuid::new_v4().to_string();
        let now = SystemTime::now();

        // Create task info
        let task_info = TaskInfo {
            id: task_id.clone(),
            title,
            description,
            status: TaskStatus::Queued,
            agent_id,
            created_at: now,
            last_updated: now,
            progress: 0,
            metadata: metadata.unwrap_or_default(),
            priority: priority.unwrap_or(50),
        };

        // Store task info
        {
            let mut tasks = self.tasks.write().await;
            tasks.insert(task_id.clone(), task_info.clone());
        }

        // Add task to queue
        {
            let mut queue = self.task_queue.write().await;
            queue.push_back(task_id.clone());
        }

        // Broadcast task creation event
        self.broadcast_event(
            "task_created",
            task_info.agent_id.clone(),
            Some(task_id.clone()),
            serde_json::json!({
                "title": task_info.title,
                "description": task_info.description,
                "status": task_info.status.to_string(),
                "priority": task_info.priority,
            }),
        )
        .await?;

        Ok(task_id)
    }

    /// Update task status
    pub async fn update_task_status(
        &self,
        task_id: &str,
        status: TaskStatus,
        progress: Option<u8>,
        metadata_updates: Option<HashMap<String, String>>,
    ) -> PhoenixResult<()> {
        // Check if task exists
        let mut tasks = self.tasks.write().await;
        let task = tasks.get_mut(task_id).ok_or_else(|| PhoenixError::Agent {
            kind: AgentErrorKind::NotFound,
            message: format!("Task with ID {} not found", task_id),
            component: "AntigravityCore".to_string(),
        })?;

        // Update task status
        task.status = status;
        task.last_updated = SystemTime::now();
        
        // Update progress if provided
        if let Some(prog) = progress {
            task.progress = prog;
        }

        // Update metadata if provided
        if let Some(updates) = metadata_updates {
            for (key, value) in updates {
                task.metadata.insert(key, value);
            }
        }

        // Get agent ID for broadcasting
        let agent_id = task.agent_id.clone();

        // Broadcast task status update
        drop(tasks);
        self.broadcast_event(
            "task_status_update",
            agent_id,
            Some(task_id.to_string()),
            serde_json::json!({
                "status": status.to_string(),
                "progress": progress.unwrap_or(0),
            }),
        )
        .await?;

        Ok(())
    }

    /// Assign task to an agent
    pub async fn assign_task(&self, task_id: &str, agent_id: &str) -> PhoenixResult<()> {
        // Check if task and agent exist
        let mut tasks = self.tasks.write().await;
        let task = tasks.get_mut(task_id).ok_or_else(|| PhoenixError::Agent {
            kind: AgentErrorKind::NotFound,
            message: format!("Task with ID {} not found", task_id),
            component: "AntigravityCore".to_string(),
        })?;

        let mut agents = self.agents.write().await;
        let agent = agents.get_mut(agent_id).ok_or_else(|| PhoenixError::Agent {
            kind: AgentErrorKind::NotFound,
            message: format!("Agent with ID {} not found", agent_id),
            component: "AntigravityCore".to_string(),
        })?;

        // Check if agent is available
        if agent.status != AgentStatus::Idle {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::InvalidState,
                message: format!("Agent {} is not idle (current status: {})", agent_id, agent.status),
                component: "AntigravityCore".to_string(),
            });
        }

        // Update task
        task.agent_id = Some(agent_id.to_string());
        task.last_updated = SystemTime::now();

        // Update agent
        agent.current_task_id = Some(task_id.to_string());
        agent.last_updated = SystemTime::now();

        // Broadcast task assignment event
        drop(tasks);
        drop(agents);
        self.broadcast_event(
            "task_assigned",
            Some(agent_id.to_string()),
            Some(task_id.to_string()),
            serde_json::json!({
                "task_title": task.title,
                "agent_name": agent.name,
            }),
        )
        .await?;

        Ok(())
    }

    /// Get task info
    pub async fn get_task(&self, task_id: &str) -> PhoenixResult<TaskInfo> {
        let tasks = self.tasks.read().await;
        tasks.get(task_id).cloned().ok_or_else(|| PhoenixError::Agent {
            kind: AgentErrorKind::NotFound,
            message: format!("Task with ID {} not found", task_id),
            component: "AntigravityCore".to_string(),
        })
    }

    /// Get agent info
    pub async fn get_agent(&self, agent_id: &str) -> PhoenixResult<AgentInfo> {
        let agents = self.agents.read().await;
        agents.get(agent_id).cloned().ok_or_else(|| PhoenixError::Agent {
            kind: AgentErrorKind::NotFound,
            message: format!("Agent with ID {} not found", agent_id),
            component: "AntigravityCore".to_string(),
        })
    }

    /// List all agents
    pub async fn list_agents(&self) -> PhoenixResult<Vec<AgentInfo>> {
        let agents = self.agents.read().await;
        Ok(agents.values().cloned().collect())
    }

    /// List all tasks
    pub async fn list_tasks(&self) -> PhoenixResult<Vec<TaskInfo>> {
        let tasks = self.tasks.read().await;
        Ok(tasks.values().cloned().collect())
    }

    /// Get SSE subscriber for real-time updates
    pub fn subscribe(&self) -> broadcast::Receiver<AntigravityEvent> {
        self.event_tx.subscribe()
    }

    /// Broadcast an event to all subscribers
    async fn broadcast_event(
        &self,
        event_type: &str,
        agent_id: Option<String>,
        task_id: Option<String>,
        payload: serde_json::Value,
    ) -> PhoenixResult<()> {
        let event = AntigravityEvent {
            id: Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            event_type: event_type.to_string(),
            agent_id,
            task_id,
            payload,
        };

        // Send event to all subscribers
        if self.event_tx.send(event).is_err() {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::CommunicationError,
                message: "Failed to broadcast event (no subscribers)".to_string(),
                component: "AntigravityCore".to_string(),
            });
        }

        Ok(())
    }
}