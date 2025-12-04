//! Agent Manager Implementation
//!
//! This module contains the implementation of the Agent Manager, which handles
//! agent lifecycle management, task assignment, and real-time status reporting.

use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use futures::stream::StreamExt;
use hyper::{Body, Request, Response, Server, StatusCode};
use hyper::service::{make_service_fn, service_fn};
use serde::{Deserialize, Serialize};
use tokio::sync::{broadcast, RwLock};
use tokio::task::JoinHandle;
use uuid::Uuid;

use crate::modules::orchestrator::antigravity_core::{
    AgentInfo, AgentStatus, AgentType, AntigravityCore, AntigravityEvent, TaskInfo, TaskStatus,
};

use crate::modules::orchestrator::errors::{AgentErrorKind, PhoenixError, PhoenixResult};

/// Agent Manager configuration
#[derive(Debug, Clone)]
pub struct AgentManagerConfig {
    /// Host to bind the SSE server to
    pub sse_host: String,
    /// Port to bind the SSE server to
    pub sse_port: u16,
    /// Maximum number of SSE events to store in history (for new connections)
    pub max_event_history: usize,
    /// Health check interval in milliseconds
    pub health_check_interval_ms: u64,
}

impl Default for AgentManagerConfig {
    fn default() -> Self {
        Self {
            sse_host: "127.0.0.1".to_string(),
            sse_port: 3366,
            max_event_history: 100,
            health_check_interval_ms: 30000, // 30 seconds
        }
    }
}

/// Agent Manager - handles agent lifecycle and task assignment
pub struct AgentManager {
    /// Reference to AntigravityCore
    core: Arc<AntigravityCore>,
    /// Configuration
    config: AgentManagerConfig,
    /// Recent event history (for new SSE connections)
    event_history: Arc<RwLock<Vec<AntigravityEvent>>>,
    /// SSE server handle
    server_handle: Option<JoinHandle<()>>,
    /// Is manager running
    is_running: Arc<RwLock<bool>>,
    /// Health check handle
    health_check_handle: Option<JoinHandle<()>>,
}

/// Response data structure for agent operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentOperationResponse {
    /// Success flag
    pub success: bool,
    /// Message
    pub message: String,
    /// Agent ID (if applicable)
    pub agent_id: Option<String>,
    /// Task ID (if applicable)
    pub task_id: Option<String>,
}

impl AgentManager {
    /// Create a new AgentManager
    pub fn new(core: Arc<AntigravityCore>, config: Option<AgentManagerConfig>) -> Self {
        Self {
            core,
            config: config.unwrap_or_default(),
            event_history: Arc::new(RwLock::new(Vec::new())),
            server_handle: None,
            is_running: Arc::new(RwLock::new(false)),
            health_check_handle: None,
        }
    }

    /// Start the Agent Manager
    pub async fn start(&mut self) -> PhoenixResult<()> {
        // Check if already running
        {
            let running = self.is_running.read().await;
            if *running {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::AlreadyRunning,
                    message: "Agent Manager is already running".to_string(),
                    component: "AgentManager".to_string(),
                });
            }
        }

        // Mark as running
        {
            let mut running = self.is_running.write().await;
            *running = true;
        }

        // Subscribe to core events
        let mut core_events = self.core.subscribe();

        // Start SSE server
        let event_history = Arc::clone(&self.event_history);
        let core = Arc::clone(&self.core);
        let addr = format!("{}:{}", self.config.sse_host, self.config.sse_port)
            .parse()
            .map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::ConfigurationError,
                message: format!("Invalid SSE server address: {}", e),
                component: "AgentManager".to_string(),
            })?;

        // Initialize the event history with any existing agents/tasks
        {
            let mut history = event_history.write().await;

            // Add existing agents to history
            let agents = core.list_agents().await?;
            for agent in agents {
                history.push(AntigravityEvent {
                    id: Uuid::new_v4().to_string(),
                    timestamp: chrono::Utc::now().to_rfc3339(),
                    event_type: "agent_status_update".to_string(),
                    agent_id: Some(agent.id.clone()),
                    task_id: agent.current_task_id.clone(),
                    payload: serde_json::json!({
                        "name": agent.name,
                        "type": agent.agent_type.to_string(),
                        "status": agent.status.to_string(),
                    }),
                });
            }

            // Add existing tasks to history
            let tasks = core.list_tasks().await?;
            for task in tasks {
                history.push(AntigravityEvent {
                    id: Uuid::new_v4().to_string(),
                    timestamp: chrono::Utc::now().to_rfc3339(),
                    event_type: "task_status_update".to_string(),
                    agent_id: task.agent_id.clone(),
                    task_id: Some(task.id.clone()),
                    payload: serde_json::json!({
                        "title": task.title,
                        "status": task.status.to_string(),
                        "progress": task.progress,
                    }),
                });
            }

            // Trim if necessary
            if history.len() > self.config.max_event_history {
                let new_start = history.len() - self.config.max_event_history;
                history.drain(0..new_start);
            }
        }

        // Create the HTTP service that will handle SSE requests
        let make_service = make_service_fn(move |_| {
            let event_history = Arc::clone(&event_history);
            let core = Arc::clone(&core);

            async move {
                Ok::<_, Infallible>(service_fn(move |req: Request<Body>| {
                    let event_history = Arc::clone(&event_history);
                    let core = Arc::clone(&core);
                    async move {
                        match (req.method(), req.uri().path()) {
                            // Handle SSE endpoint for agent status updates
                            (&hyper::Method::GET, "/api/agent/stream") => {
                                handle_sse_request(event_history, core).await
                            }
                            // Return 404 for everything else
                            _ => {
                                let mut not_found = Response::new(Body::from("Not Found"));
                                *not_found.status_mut() = StatusCode::NOT_FOUND;
                                Ok::<_, Infallible>(not_found)
                            }
                        }
                    }
                }))
            }
        });

        // Start the HTTP server
        let server_handle = tokio::spawn(async move {
            let server = Server::bind(&addr).serve(make_service);
            if let Err(e) = server.await {
                eprintln!("SSE server error: {}", e);
            }
        });

        self.server_handle = Some(server_handle);

        // Start event listener for history management
        let event_history_clone = Arc::clone(&self.event_history);
        let max_history = self.config.max_event_history;
        let is_running_clone = Arc::clone(&self.is_running);

        tokio::spawn(async move {
            while *is_running_clone.read().await {
                match core_events.recv().await {
                    Ok(event) => {
                        let mut history = event_history_clone.write().await;
                        history.push(event);

                        // Trim to max size
                        if history.len() > max_history {
                            let new_start = history.len() - max_history;
                            history.drain(0..new_start);
                        }
                    }
                    Err(broadcast::error::RecvError::Closed) => {
                        break;
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => {
                        // We've fallen behind; continue and catch up
                        continue;
                    }
                }
            }
        });

        // Start health check background task
        let core_clone = Arc::clone(&self.core);
        let is_running_clone = Arc::clone(&self.is_running);
        let interval_ms = self.config.health_check_interval_ms;

        let health_handle = tokio::spawn(async move {
            while *is_running_clone.read().await {
                // Perform health checks on all agents
                let agents = match core_clone.list_agents().await {
                    Ok(agents) => agents,
                    Err(_) => {
                        // If we can't list agents, wait a bit and try again
                        tokio::time::sleep(Duration::from_millis(1000)).await;
                        continue;
                    }
                };

                for agent in agents {
                    if agent.status != AgentStatus::Terminated && agent.status != AgentStatus::Error {
                        let now = SystemTime::now();
                        if let Ok(elapsed) = now.duration_since(agent.last_updated) {
                            // If agent hasn't updated in 2 minutes, mark as error
                            if elapsed.as_secs() > 120 {
                                let mut metadata = HashMap::new();
                                metadata.insert("error".to_string(), "Agent not responding for 2 minutes".to_string());
                                let _ = core_clone
                                    .update_agent_status(&agent.id, AgentStatus::Error, Some(metadata))
                                    .await;
                            }
                        }
                    }
                }

                // Sleep before next health check
                tokio::time::sleep(Duration::from_millis(interval_ms)).await;
            }
        });

        self.health_check_handle = Some(health_handle);

        Ok(())
    }

    /// Stop the Agent Manager
    pub async fn stop(&mut self) -> PhoenixResult<()> {
        // Check if running
        {
            let running = self.is_running.read().await;
            if !*running {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::NotRunning,
                    message: "Agent Manager is not running".to_string(),
                    component: "AgentManager".to_string(),
                });
            }
        }

        // Mark as not running
        {
            let mut running = self.is_running.write().await;
            *running = false;
        }

        // Stop SSE server
        if let Some(handle) = self.server_handle.take() {
            handle.abort();
        }

        // Stop health check
        if let Some(handle) = self.health_check_handle.take() {
            handle.abort();
        }

        Ok(())
    }

    /// Create a new agent
    pub async fn create_agent(
        &self,
        name: String,
        agent_type: AgentType,
        metadata: Option<HashMap<String, String>>,
    ) -> PhoenixResult<String> {
        // Check if manager is running
        {
            let running = self.is_running.read().await;
            if !*running {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::NotRunning,
                    message: "Agent Manager is not running".to_string(),
                    component: "AgentManager".to_string(),
                });
            }
        }

        // Register agent with the core
        let agent_id = self.core.register_agent(name, agent_type, metadata).await?;

        // Update agent status to Idle (ready for tasks)
        self.core
            .update_agent_status(&agent_id, AgentStatus::Idle, None)
            .await?;

        Ok(agent_id)
    }

    /// Pause an agent
    pub async fn pause_agent(&self, agent_id: &str) -> PhoenixResult<AgentOperationResponse> {
        // Check if manager is running
        {
            let running = self.is_running.read().await;
            if !*running {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::NotRunning,
                    message: "Agent Manager is not running".to_string(),
                    component: "AgentManager".to_string(),
                });
            }
        }

        // Get current agent info
        let agent = self.core.get_agent(agent_id).await?;

        // Check if agent can be paused
        if agent.status != AgentStatus::Working && agent.status != AgentStatus::Idle {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::InvalidState,
                message: format!(
                    "Agent {} cannot be paused from state {}",
                    agent_id, agent.status
                ),
                component: "AgentManager".to_string(),
            });
        }

        // Update agent status to Paused
        self.core
            .update_agent_status(agent_id, AgentStatus::Paused, None)
            .await?;

        // If agent was working on a task, update task status to Paused
        if let Some(task_id) = agent.current_task_id {
            let task = self.core.get_task(&task_id).await?;
            if task.status == TaskStatus::Running {
                self.core
                    .update_task_status(&task_id, TaskStatus::Paused, None, None)
                    .await?;
            }

            Ok(AgentOperationResponse {
                success: true,
                message: format!("Agent {} paused", agent_id),
                agent_id: Some(agent_id.to_string()),
                task_id: Some(task_id),
            })
        } else {
            Ok(AgentOperationResponse {
                success: true,
                message: format!("Agent {} paused", agent_id),
                agent_id: Some(agent_id.to_string()),
                task_id: None,
            })
        }
    }

    /// Resume an agent
    pub async fn resume_agent(&self, agent_id: &str) -> PhoenixResult<AgentOperationResponse> {
        // Check if manager is running
        {
            let running = self.is_running.read().await;
            if !*running {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::NotRunning,
                    message: "Agent Manager is not running".to_string(),
                    component: "AgentManager".to_string(),
                });
            }
        }

        // Get current agent info
        let agent = self.core.get_agent(agent_id).await?;

        // Check if agent can be resumed
        if agent.status != AgentStatus::Paused {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::InvalidState,
                message: format!(
                    "Agent {} cannot be resumed from state {}",
                    agent_id, agent.status
                ),
                component: "AgentManager".to_string(),
            });
        }

        // Determine target state based on task
        let target_state = if agent.current_task_id.is_some() {
            AgentStatus::Working
        } else {
            AgentStatus::Idle
        };

        // Update agent status
        self.core
            .update_agent_status(agent_id, target_state, None)
            .await?;

        // If agent was working on a task, resume it
        if let Some(task_id) = agent.current_task_id {
            let task = self.core.get_task(&task_id).await?;
            if task.status == TaskStatus::Paused {
                self.core
                    .update_task_status(&task_id, TaskStatus::Running, None, None)
                    .await?;
            }

            Ok(AgentOperationResponse {
                success: true,
                message: format!("Agent {} resumed", agent_id),
                agent_id: Some(agent_id.to_string()),
                task_id: Some(task_id),
            })
        } else {
            Ok(AgentOperationResponse {
                success: true,
                message: format!("Agent {} resumed", agent_id),
                agent_id: Some(agent_id.to_string()),
                task_id: None,
            })
        }
    }

    /// Terminate an agent
    pub async fn terminate_agent(&self, agent_id: &str) -> PhoenixResult<AgentOperationResponse> {
        // Check if manager is running
        {
            let running = self.is_running.read().await;
            if !*running {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::NotRunning,
                    message: "Agent Manager is not running".to_string(),
                    component: "AgentManager".to_string(),
                });
            }
        }

        // Get current agent info
        let agent = self.core.get_agent(agent_id).await?;

        // Update agent status to Terminating
        self.core
            .update_agent_status(agent_id, AgentStatus::Terminating, None)
            .await?;

        // If agent was working on a task, mark it as failed
        if let Some(task_id) = agent.current_task_id {
            let mut metadata = HashMap::new();
            metadata.insert(
                "termination_reason".to_string(),
                "Agent was terminated".to_string(),
            );

            self.core
                .update_task_status(&task_id, TaskStatus::Failed, None, Some(metadata))
                .await?;
        }

        // After a brief delay, mark as fully terminated
        // (In a real system, this might wait for confirmation)
        tokio::time::sleep(Duration::from_millis(500)).await;
        self.core
            .update_agent_status(agent_id, AgentStatus::Terminated, None)
            .await?;

        Ok(AgentOperationResponse {
            success: true,
            message: format!("Agent {} terminated", agent_id),
            agent_id: Some(agent_id.to_string()),
            task_id: agent.current_task_id,
        })
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
        // Check if manager is running
        {
            let running = self.is_running.read().await;
            if !*running {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::NotRunning,
                    message: "Agent Manager is not running".to_string(),
                    component: "AgentManager".to_string(),
                });
            }
        }

        // If agent_id is provided, validate it
        if let Some(agent_id) = &agent_id {
            let agent = self.core.get_agent(agent_id).await?;

            // Check if agent is available
            if agent.status != AgentStatus::Idle {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::InvalidState,
                    message: format!(
                        "Agent {} is not idle (current status: {})",
                        agent_id, agent.status
                    ),
                    component: "AgentManager".to_string(),
                });
            }
        }

        // Create task
        let task_id = self
            .core
            .create_task(title, description, agent_id, priority, metadata)
            .await?;

        Ok(task_id)
    }

    /// Assign task to an agent
    pub async fn assign_task(
        &self,
        task_id: &str,
        agent_id: &str,
    ) -> PhoenixResult<AgentOperationResponse> {
        // Check if manager is running
        {
            let running = self.is_running.read().await;
            if !*running {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::NotRunning,
                    message: "Agent Manager is not running".to_string(),
                    component: "AgentManager".to_string(),
                });
            }
        }

        // Assign task to agent
        self.core.assign_task(task_id, agent_id).await?;

        Ok(AgentOperationResponse {
            success: true,
            message: format!("Task {} assigned to agent {}", task_id, agent_id),
            agent_id: Some(agent_id.to_string()),
            task_id: Some(task_id.to_string()),
        })
    }

    /// Get an agent by ID
    pub async fn get_agent(&self, agent_id: &str) -> PhoenixResult<AgentInfo> {
        self.core.get_agent(agent_id).await
    }

    /// Get a task by ID
    pub async fn get_task(&self, task_id: &str) -> PhoenixResult<TaskInfo> {
        self.core.get_task(task_id).await
    }

    /// List all agents
    pub async fn list_agents(&self) -> PhoenixResult<Vec<AgentInfo>> {
        self.core.list_agents().await
    }

    /// List all tasks
    pub async fn list_tasks(&self) -> PhoenixResult<Vec<TaskInfo>> {
        self.core.list_tasks().await
    }

    /// Update task status
    pub async fn update_task_status(
        &self,
        task_id: &str,
        status: TaskStatus,
        progress: Option<u8>,
        metadata: Option<HashMap<String, String>>,
    ) -> PhoenixResult<AgentOperationResponse> {
        // Check if manager is running
        {
            let running = self.is_running.read().await;
            if !*running {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::NotRunning,
                    message: "Agent Manager is not running".to_string(),
                    component: "AgentManager".to_string(),
                });
            }
        }

        // Get current task info
        let task = self.core.get_task(task_id).await?;

        // Update task status
        self.core
            .update_task_status(task_id, status.clone(), progress, metadata)
            .await?;

        Ok(AgentOperationResponse {
            success: true,
            message: format!("Task {} status updated to {}", task_id, status),
            agent_id: task.agent_id,
            task_id: Some(task_id.to_string()),
        })
    }
}

/// Handler for SSE requests
async fn handle_sse_request(
    event_history: Arc<RwLock<Vec<AntigravityEvent>>>,
    core: Arc<AntigravityCore>,
) -> Result<Response<Body>, Infallible> {
    // Subscribe to core events
    let mut rx = core.subscribe();

    // Create a channel for sending bytes to the response
    let (tx, body) = Body::channel();

    // Send SSE headers
    tx.send_data(
        "HTTP/1.1 200 OK\r\n\
        Content-Type: text/event-stream\r\n\
        Cache-Control: no-cache\r\n\
        Connection: keep-alive\r\n\
        \r\n"
        .into(),
    )
    .await
    .unwrap_or_else(|e| eprintln!("Error sending SSE headers: {}", e));

    // Send initial SSE event to confirm connection
    tx.send_data(
        "event: connected\r\ndata: {\"message\": \"Connected to Antigravity agent stream\"}\r\n\r\n"
            .into(),
    )
    .await
    .unwrap_or_else(|e| eprintln!("Error sending initial SSE event: {}", e));

    // Send historical events
    {
        let history = event_history.read().await;
        for event in history.iter() {
            let event_json = serde_json::to_string(&event)
                .unwrap_or_else(|_| String::from("{\"error\": \"Failed to serialize event\"}"));
            
            tx.send_data(
                format!("event: {}\r\ndata: {}\r\n\r\n", event.event_type, event_json).into(),
            )
            .await
            .unwrap_or_else(|e| eprintln!("Error sending historical event: {}", e));
        }
    }

    // Listen for new events and forward them to the client
    tokio::spawn(async move {
        while let Ok(event) = rx.recv().await {
            let event_json = serde_json::to_string(&event)
                .unwrap_or_else(|_| String::from("{\"error\": \"Failed to serialize event\"}"));
            
            if tx
                .send_data(
                    format!("event: {}\r\ndata: {}\r\n\r\n", event.event_type, event_json).into(),
                )
                .await
                .is_err()
            {
                // Client disconnected
                break;
            }
        }
    });

    // Return the streaming response
    Ok(Response::new(body))
}