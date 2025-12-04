//! Artifacts System Implementation  
//!  
//! This module contains the implementation of the Artifacts System, which handles  
//! the storage, retrieval, and management of artifacts produced by agents during their execution.  
//! Artifacts include plans, code diffs, screenshots, videos, and logs, stored in Body-KB.

use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use futures::StreamExt;
use hyper::{Body, Request, Response, Server, StatusCode};
use hyper::service::{make_service_fn, service_fn};
use serde::{Deserialize, Serialize};
use tokio::fs;
use tokio::sync::{broadcast, mpsc, RwLock};
use tokio::task::JoinHandle;
use uuid::Uuid;

use crate::modules::orchestrator::agent_manager::{AgentManager, AgentOperationResponse};
use crate::modules::orchestrator::antigravity_core::{
    AgentInfo, AgentStatus, AntigravityCore, AntigravityEvent, TaskInfo, TaskStatus,
};
use crate::modules::orchestrator::errors::{AgentErrorKind, PhoenixError, PhoenixResult};

/// Artifact type in the system
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ArtifactType {
    /// JSON artifact (e.g., plans, thoughts, structured data)
    Json,
    /// Code diff artifact
    CodeDiff,
    /// Screenshot artifact
    Screenshot,
    /// Video artifact
    Video,
    /// Log text artifact
    Logs,
    /// Plain text artifact
    Text,
    /// Custom artifact type
    Custom(String),
}

impl std::fmt::Display for ArtifactType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ArtifactType::Json => write!(f, "Json"),
            ArtifactType::CodeDiff => write!(f, "CodeDiff"),
            ArtifactType::Screenshot => write!(f, "Screenshot"),
            ArtifactType::Video => write!(f, "Video"),
            ArtifactType::Logs => write!(f, "Logs"),
            ArtifactType::Text => write!(f, "Text"),
            ArtifactType::Custom(name) => write!(f, "Custom({})", name),
        }
    }
}

/// Artifact information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactInfo {
    /// Unique artifact ID
    pub id: String,
    /// Artifact title
    pub title: String,
    /// Artifact type
    pub artifact_type: ArtifactType,
    /// Task ID this artifact is associated with
    pub task_id: String,
    /// Agent ID that created this artifact
    pub agent_id: String,
    /// When the artifact was created
    pub created_at: SystemTime,
    /// Content type (MIME type) for the artifact
    pub content_type: String,
    /// Storage path in Body-KB
    pub storage_path: String,
    /// Optional description
    pub description: Option<String>,
    /// Sequence number within the task/step
    pub sequence: u32,
    /// Step ID within the task (if applicable)
    pub step_id: Option<String>,
    /// Parent artifact ID (if this is a revision)
    pub parent_id: Option<String>,
    /// Additional artifact-specific metadata
    pub metadata: HashMap<String, String>,
}

/// Comment on an artifact
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactComment {
    /// Unique comment ID
    pub id: String,
    /// Artifact ID this comment is associated with
    pub artifact_id: String,
    /// User/agent ID that created the comment
    pub user_id: String,
    /// Comment text
    pub text: String,
    /// When the comment was created
    pub created_at: SystemTime,
    /// Is this comment from a human user (vs an agent)
    pub is_human: bool,
    /// Parent comment ID (if this is a reply)
    pub parent_id: Option<String>,
    /// Position in the artifact this comment refers to (optional)
    pub position: Option<String>,
}

/// Artifact event broadcasted to clients
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactEvent {
    /// Unique event ID
    pub id: String,
    /// Event timestamp
    pub timestamp: String,
    /// Event type
    pub event_type: String,
    /// Artifact ID
    pub artifact_id: String,
    /// Task ID
    pub task_id: String,
    /// Agent ID
    pub agent_id: Option<String>,
    /// Event payload
    pub payload: serde_json::Value,
}

/// Configuration for the Artifacts System
#[derive(Debug, Clone)]
pub struct ArtifactSystemConfig {
    /// Base path for Body-KB storage
    pub kb_base_path: String,
    /// SSE broadcast channel capacity
    pub broadcast_capacity: usize,
    /// Host to bind the API server to
    pub api_host: String,
    /// Port to bind the API server to
    pub api_port: u16,
    /// Maximum file size for artifacts (in bytes)
    pub max_file_size: usize,
    /// Enable/disable comments feature
    pub enable_comments: bool,
}

impl Default for ArtifactSystemConfig {
    fn default() -> Self {
        Self {
            kb_base_path: "body_kb/artifacts".to_string(),
            broadcast_capacity: 1000,
            api_host: "127.0.0.1".to_string(),
            api_port: 3367,
            max_file_size: 100 * 1024 * 1024, // 100 MB max file size
            enable_comments: true,
        }
    }
}

/// Artifacts System - manages artifacts produced by agents
pub struct ArtifactSystem {
    /// Configuration
    config: ArtifactSystemConfig,
    /// Reference to AntigravityCore
    core: Arc<AntigravityCore>,
    /// Reference to AgentManager
    agent_manager: Arc<AgentManager>,
    /// Artifact registry
    artifacts: Arc<RwLock<HashMap<String, ArtifactInfo>>>,
    /// Comments (if enabled)
    comments: Arc<RwLock<HashMap<String, Vec<ArtifactComment>>>>,
    /// Broadcast channel for SSE events
    event_tx: Arc<broadcast::Sender<ArtifactEvent>>,
    /// API server handle
    server_handle: Option<JoinHandle<()>>,
    /// Is system running
    is_running: Arc<RwLock<bool>>,
    /// Task artifact mappings (task_id -> Vec<artifact_id>)
    task_artifacts: Arc<RwLock<HashMap<String, Vec<String>>>>,
}

// Implementation will be added in subsequent chunks
impl ArtifactSystem {
    /// Create a new ArtifactSystem
    pub fn new(
        core: Arc<AntigravityCore>,
        agent_manager: Arc<AgentManager>,
        config: Option<ArtifactSystemConfig>,
    ) -> Self {
        let config = config.unwrap_or_default();
        let (tx, _) = broadcast::channel(config.broadcast_capacity);
        
        Self {
            config,
            core,
            agent_manager,
            artifacts: Arc::new(RwLock::new(HashMap::new())),
            comments: Arc::new(RwLock::new(HashMap::new())),
            event_tx: Arc::new(tx),
            server_handle: None,
            is_running: Arc::new(RwLock::new(false)),
            task_artifacts: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Start the Artifacts System
    pub async fn start(&mut self) -> PhoenixResult<()> {
        // Check if already running
        {
            let running = self.is_running.read().await;
            if *running {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::AlreadyRunning,
                    message: "Artifacts System is already running".to_string(),
                    component: "ArtifactSystem".to_string(),
                });
            }
        }

        // Mark as running
        {
            let mut running = self.is_running.write().await;
            *running = true;
        }

        // Ensure the Body-KB base path exists
        self.ensure_kb_directory().await?;

        // Start API server
        self.start_api_server().await?;

        // Monitor task status changes to manage artifacts lifecycle
        self.monitor_task_status().await?;

        Ok(())
    }

    /// Ensure the Body-KB directory structure exists
    async fn ensure_kb_directory(&self) -> PhoenixResult<()> {
        // Create base directory
        fs::create_dir_all(&self.config.kb_base_path)
            .await
            .map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::StorageError,
                message: format!("Failed to create Body-KB base directory: {}", e),
                component: "ArtifactSystem".to_string(),
            })?;
            
        Ok(())
    }

    /// Get the Body-KB path for a task
    fn get_task_kb_path(&self, task_id: &str) -> String {
        format!("{}/{}", self.config.kb_base_path, task_id)
    }

    /// Create the Body-KB directory for a task
    async fn create_task_directory(&self, task_id: &str) -> PhoenixResult<String> {
        let task_path = self.get_task_kb_path(task_id);
        
        fs::create_dir_all(&task_path)
            .await
            .map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::StorageError,
                message: format!("Failed to create task directory: {}", e),
                component: "ArtifactSystem".to_string(),
            })?;
            
        Ok(task_path)
    }

    /// Store an artifact in Body-KB
    async fn store_artifact_content(
        &self,
        task_id: &str,
        artifact_id: &str,
        content_type: &str,
        content: &[u8],
    ) -> PhoenixResult<String> {
        // Check file size
        if content.len() > self.config.max_file_size {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::InvalidInput,
                message: format!(
                    "Artifact size ({}) exceeds maximum allowed size ({})",
                    content.len(),
                    self.config.max_file_size
                ),
                component: "ArtifactSystem".to_string(),
            });
        }

        // Ensure task directory exists
        let task_path = self.create_task_directory(task_id).await?;

        // Determine file extension based on content type
        let extension = match content_type {
            "application/json" => "json",
            "text/plain" => "txt",
            "image/png" => "png",
            "image/jpeg" => "jpg",
            "image/webp" => "webp", 
            "video/mp4" => "mp4",
            "text/x-diff" => "diff",
            _ => "bin",
        };

        // Create storage path
        let filename = format!("{}_{}.{}", artifact_id, chrono::Utc::now().timestamp(), extension);
        let storage_path = format!("{}/{}", task_id, filename);
        let full_path = format!("{}/{}", self.config.kb_base_path, storage_path);

        // Write content to file
        fs::write(&full_path, content)
            .await
            .map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::StorageError,
                message: format!("Failed to write artifact to Body-KB: {}", e),
                component: "ArtifactSystem".to_string(),
            })?;

        // Return relative path from KB base
        Ok(storage_path)
    }

    /// Read an artifact's content from Body-KB
    async fn read_artifact_content(&self, storage_path: &str) -> PhoenixResult<Vec<u8>> {
        let full_path = format!("{}/{}", self.config.kb_base_path, storage_path);
        
        fs::read(&full_path)
            .await
            .map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::StorageError,
                message: format!("Failed to read artifact from Body-KB: {}", e),
                component: "ArtifactSystem".to_string(),
            })
    }

    /// Monitor task status to manage artifact lifecycle
    async fn monitor_task_status(&self) -> PhoenixResult<()> {
        let mut rx = self.core.subscribe();
        let task_artifacts = Arc::clone(&self.task_artifacts);
        let artifacts = Arc::clone(&self.artifacts);
        let is_running = Arc::clone(&self.is_running);

        tokio::spawn(async move {
            while *is_running.read().await {
                match rx.recv().await {
                    Ok(event) => {
                        // Check for task status updates
                        if event.event_type == "task_status_update" && event.task_id.is_some() {
                            let task_id = event.task_id.unwrap();
                            let task_status = if let Some(status) = event.payload.get("status") {
                                status.as_str().unwrap_or_default()
                            } else {
                                continue;
                            };

                            // If task is completed, mark all artifacts as final
                            if task_status == "Completed" {
                                let artifact_ids = {
                                    let task_artifacts_map = task_artifacts.read().await;
                                    task_artifacts_map.get(&task_id)
                                        .cloned()
                                        .unwrap_or_else(Vec::new)
                                };

                                let mut artifacts_map = artifacts.write().await;
                                for artifact_id in artifact_ids {
                                    if let Some(artifact) = artifacts_map.get_mut(&artifact_id) {
                                        artifact.metadata.insert("final".to_string(), "true".to_string());
                                    }
                                }
                            }
                        }
                    }
                    Err(broadcast::error::RecvError::Closed) => break,
                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
                }
            }
        });

        Ok(())
    }

    /// Create a new artifact
    pub async fn create_artifact(
        &self,
        title: String,
        artifact_type: ArtifactType,
        task_id: String,
        agent_id: String,
        content_type: String,
        content: Vec<u8>,
        description: Option<String>,
        step_id: Option<String>,
        parent_id: Option<String>,
        metadata: Option<HashMap<String, String>>,
    ) -> PhoenixResult<String> {
        // Validate we can create an artifact for this task
        let task = self.core.get_task(&task_id).await?;
        
        // Create unique ID for artifact
        let artifact_id = Uuid::new_v4().to_string();
        
        // Store artifact content in Body-KB
        let storage_path = self.store_artifact_content(&task_id, &artifact_id, &content_type, &content).await?;
        
        // Get next sequence number for this task
        let sequence = {
            let task_artifacts_map = self.task_artifacts.read().await;
            let artifact_ids = task_artifacts_map.get(&task_id).map(|ids| ids.len()).unwrap_or(0);
            (artifact_ids + 1) as u32
        };
        
        // Create artifact info
        let artifact_info = ArtifactInfo {
            id: artifact_id.clone(),
            title,
            artifact_type,
            task_id: task_id.clone(),
            agent_id,
            created_at: SystemTime::now(),
            content_type,
            storage_path,
            description,
            sequence,
            step_id,
            parent_id,
    /// Add a comment to an artifact
    pub async fn add_comment(
        &self,
        artifact_id: &str,
        user_id: String,
        text: String,
        is_human: bool,
        parent_id: Option<String>,
        position: Option<String>,
    ) -> PhoenixResult<String> {
        // Check if artifact exists
        let artifact = {
            let artifacts = self.artifacts.read().await;
            artifacts.get(artifact_id).cloned().ok_or_else(|| PhoenixError::Agent {
                kind: AgentErrorKind::NotFound,
                message: format!("Artifact with ID {} not found", artifact_id),
                component: "ArtifactSystem".to_string(),
            })?
        };

        // Check if comments are enabled
        if !self.config.enable_comments {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::NotAvailable,
                message: "Comments feature is disabled".to_string(),
                component: "ArtifactSystem".to_string(),
            });
        }

        // Validate parent comment if specified
        if let Some(parent_id) = &parent_id {
            let comments = self.comments.read().await;
            let artifact_comments = comments.get(artifact_id).ok_or_else(|| PhoenixError::Agent {
                kind: AgentErrorKind::NotFound,
                message: format!("No comments found for artifact {}", artifact_id),
                component: "ArtifactSystem".to_string(),
            })?;

            let parent_exists = artifact_comments.iter().any(|c| c.id == *parent_id);
            if !parent_exists {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::NotFound,
                    message: format!("Parent comment with ID {} not found", parent_id),
                    component: "ArtifactSystem".to_string(),
                });
            }
        }

        // Create comment
        let comment_id = Uuid::new_v4().to_string();
        let comment = ArtifactComment {
            id: comment_id.clone(),
            artifact_id: artifact_id.to_string(),
            user_id,
            text,
            created_at: SystemTime::now(),
            is_human,
            parent_id,
            position,
        };

        // Store comment
        {
            let mut comments = self.comments.write().await;
            let artifact_comments = comments.entry(artifact_id.to_string()).or_insert_with(Vec::new);
            artifact_comments.push(comment.clone());
        }

        // Broadcast comment event
        self.broadcast_artifact_event(
            "artifact_comment_added",
            artifact_id,
            &artifact.task_id,
            None,
            serde_json::json!({
                "comment_id": comment_id,
                "user_id": comment.user_id,
                "text": comment.text,
                "is_human": comment.is_human,
                "parent_id": comment.parent_id,
            }),
        ).await?;

        Ok(comment_id)
    }

    /// Get comments for an artifact
    pub async fn get_artifact_comments(&self, artifact_id: &str) -> PhoenixResult<Vec<ArtifactComment>> {
        // Check if artifact exists
        {
            let artifacts = self.artifacts.read().await;
            if !artifacts.contains_key(artifact_id) {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::NotFound,
                    message: format!("Artifact with ID {} not found", artifact_id),
                    component: "ArtifactSystem".to_string(),
                });
            }
        }

        // Get comments for the artifact
        let comments = self.comments.read().await;
        let artifact_comments = comments.get(artifact_id).cloned().unwrap_or_else(Vec::new);
        
        Ok(artifact_comments)
    }

    /// Get artifacts for a task
    pub async fn get_task_artifacts(&self, task_id: &str) -> PhoenixResult<Vec<ArtifactInfo>> {
        // Check if task exists
        self.core.get_task(task_id).await?;

        // Get artifacts for the task
        let artifact_ids = {
            let task_artifacts = self.task_artifacts.read().await;
            task_artifacts.get(task_id).cloned().unwrap_or_else(Vec::new)
        };

        let artifacts = self.artifacts.read().await;
        let mut task_artifacts = Vec::new();

        for id in artifact_ids {
            if let Some(artifact) = artifacts.get(&id) {
                task_artifacts.push(artifact.clone());
            }
        }

        // Sort by sequence number
        task_artifacts.sort_by(|a, b| a.sequence.cmp(&b.sequence));

        Ok(task_artifacts)
    }

    /// Get an artifact by ID
    pub async fn get_artifact(&self, artifact_id: &str) -> PhoenixResult<ArtifactInfo> {
        let artifacts = self.artifacts.read().await;
        artifacts.get(artifact_id).cloned().ok_or_else(|| PhoenixError::Agent {
            kind: AgentErrorKind::NotFound,
            message: format!("Artifact with ID {} not found", artifact_id),
            component: "ArtifactSystem".to_string(),
        })
    }

    /// Get an artifact's content
    pub async fn get_artifact_content(&self, artifact_id: &str) -> PhoenixResult<Vec<u8>> {
        // Get artifact info
        let artifact = self.get_artifact(artifact_id).await?;

        // Read content from Body-KB
        self.read_artifact_content(&artifact.storage_path).await
    }

    /// Delete an artifact
    pub async fn delete_artifact(&self, artifact_id: &str) -> PhoenixResult<()> {
        // Check if artifact exists
        let artifact = self.get_artifact(artifact_id).await?;

        // Remove from storage
        let full_path = format!("{}/{}", self.config.kb_base_path, artifact.storage_path);
        if Path::new(&full_path).exists() {
            fs::remove_file(&full_path)
                .await
                .map_err(|e| PhoenixError::Agent {
                    kind: AgentErrorKind::StorageError,
                    message: format!("Failed to delete artifact file: {}", e),
                    component: "ArtifactSystem".to_string(),
                })?;
        }

        // Remove from artifact registry
        {
            let mut artifacts = self.artifacts.write().await;
            artifacts.remove(artifact_id);
        }

        // Remove from task artifacts mapping
        {
            let mut task_artifacts = self.task_artifacts.write().await;
            if let Some(task_artifact_list) = task_artifacts.get_mut(&artifact.task_id) {
                task_artifact_list.retain(|id| id != artifact_id);
            }
        }

        // Remove comments if any
        {
            let mut comments = self.comments.write().await;
            comments.remove(artifact_id);
        }

        // Broadcast artifact deleted event
        self.broadcast_artifact_event(
            "artifact_deleted",
            artifact_id,
            &artifact.task_id,
            Some(&artifact.agent_id),
            serde_json::json!({
                "title": artifact.title,
                "type": artifact.artifact_type.to_string(),
            }),
        ).await?;

        Ok(())
    }

    /// Get SSE subscriber for real-time updates
    pub fn subscribe(&self) -> broadcast::Receiver<ArtifactEvent> {
        self.event_tx.subscribe()
    }

    /// Broadcast an artifact event
    async fn broadcast_artifact_event(
        &self,
        event_type: &str,
        artifact_id: &str,
        task_id: &str,
        agent_id: Option<&str>,
        payload: serde_json::Value,
    ) -> PhoenixResult<()> {
        let event = ArtifactEvent {
            id: Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
    /// Start the API server for artifact operations
    async fn start_api_server(&mut self) -> PhoenixResult<()> {
        let artifacts = Arc::clone(&self.artifacts);
        let comments = Arc::clone(&self.comments);
        let task_artifacts = Arc::clone(&self.task_artifacts);
        let event_tx = Arc::clone(&self.event_tx);
        let core = Arc::clone(&self.core);
        let config = self.config.clone();
        let is_running = Arc::clone(&self.is_running);
        
        let addr = format!("{}:{}", config.api_host, config.api_port)
            .parse()
            .map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::ConfigurationError,
                message: format!("Invalid API server address: {}", e),
                component: "ArtifactSystem".to_string(),
            })?;

        // Create the HTTP service
        let make_service = make_service_fn(move |_| {
            let artifacts = Arc::clone(&artifacts);
            let comments = Arc::clone(&comments);
            let task_artifacts = Arc::clone(&task_artifacts);
            let event_tx = Arc::clone(&event_tx);
            let core = Arc::clone(&core);
            let config = config.clone();
            let is_running = Arc::clone(&is_running);

            async move {
                Ok::<_, hyper::Error>(service_fn(move |req: Request<Body>| {
                    let artifacts = Arc::clone(&artifacts);
                    let comments = Arc::clone(&comments);
                    let task_artifacts = Arc::clone(&task_artifacts);
                    let event_tx = Arc::clone(&event_tx);
                    let core = Arc::clone(&core);
                    let config = config.clone();
                    let is_running = Arc::clone(&is_running);

                    async move {
                        if !*is_running.read().await {
                            let mut resp = Response::new(Body::from("Artifacts System is not running"));
                            *resp.status_mut() = StatusCode::SERVICE_UNAVAILABLE;
                            return Ok::<_, hyper::Error>(resp);
                        }

                        // Route the request based on method and path
                        match (req.method(), req.uri().path()) {
                            // Artifact SSE stream endpoint
                            (&hyper::Method::GET, "/api/artifacts/stream") => {
                                handle_artifact_sse(event_tx.clone()).await
                            }

                            // Get artifacts for a task
                            (&hyper::Method::GET, path) if path.starts_with("/api/artifacts/task/") => {
                                let task_id = path.trim_start_matches("/api/artifacts/task/");
                                handle_get_task_artifacts(task_id, task_artifacts, artifacts).await
                            }

                            // Get a specific artifact
                            (&hyper::Method::GET, path) if path.starts_with("/api/artifacts/") && !path.contains("/comment") => {
                                let artifact_id = path.trim_start_matches("/api/artifacts/");
                                handle_get_artifact(artifact_id, artifacts, config.kb_base_path.clone()).await
                            }

                            // Get comments for an artifact
                            (&hyper::Method::GET, path) if path.starts_with("/api/artifacts/") && path.contains("/comments") => {
                                let parts: Vec<&str> = path.split('/').collect();
                                if parts.len() >= 4 && parts[2] == "comments" {
                                    let artifact_id = parts[1];
                                    handle_get_artifact_comments(artifact_id, comments).await
                                } else {
                                    let mut resp = Response::new(Body::from("Invalid path"));
                                    *resp.status_mut() = StatusCode::BAD_REQUEST;
                                    Ok::<_, hyper::Error>(resp)
                                }
                            }

                            // Add a comment to an artifact
                            (&hyper::Method::POST, path) if path.starts_with("/api/artifacts/") && path.contains("/comments") => {
                                let parts: Vec<&str> = path.split('/').collect();
                                if parts.len() >= 4 && parts[2] == "comments" {
                                    let artifact_id = parts[1];
                                    handle_add_comment(artifact_id, req, comments, artifacts, event_tx).await
                                } else {
                                    let mut resp = Response::new(Body::from("Invalid path"));
                                    *resp.status_mut() = StatusCode::BAD_REQUEST;
                                    Ok::<_, hyper::Error>(resp)
                                }
                            }

                            // Create a new artifact
                            (&hyper::Method::POST, "/api/artifacts") => {
                                handle_create_artifact(
                                    req, 
                                    artifacts, 
                                    task_artifacts, 
                                    event_tx,
                                    config.clone(),
                                    core,
                                ).await
                            }

                            // Handle OPTIONS for CORS
                            (&hyper::Method::OPTIONS, _) => {
                                let mut resp = Response::new(Body::empty());
                                resp.headers_mut().insert(
                                    hyper::header::ACCESS_CONTROL_ALLOW_ORIGIN,
                                    hyper::header::HeaderValue::from_static("*"),
                                );
                                resp.headers_mut().insert(
                                    hyper::header::ACCESS_CONTROL_ALLOW_METHODS,
                                    hyper::header::HeaderValue::from_static("GET, POST, OPTIONS"),
                                );
                                resp.headers_mut().insert(
                                    hyper::header::ACCESS_CONTROL_ALLOW_HEADERS,
                                    hyper::header::HeaderValue::from_static("Content-Type"),
                                );
                                Ok::<_, hyper::Error>(resp)
                            }

                            // 404 for everything else
                            _ => {
                                let mut resp = Response::new(Body::from("Not Found"));
                                *resp.status_mut() = StatusCode::NOT_FOUND;
                                Ok::<_, hyper::Error>(resp)
                            }
                        }
                    }
                }))
            }
        });

        // Start the API server
        let server = Server::bind(&addr).serve(make_service);
        let server_handle = tokio::spawn(async move {
            if let Err(e) = server.await {
                eprintln!("Artifacts API server error: {}", e);
            }
        });

        self.server_handle = Some(server_handle);
        
        Ok(())
    }
}

/// Handler for SSE requests
async fn handle_artifact_sse(
    event_tx: Arc<broadcast::Sender<ArtifactEvent>>,
) -> Result<Response<Body>, hyper::Error> {
    // Subscribe to artifact events
    let mut rx = event_tx.subscribe();

    // Create a channel for sending bytes to the response
    let (tx, body) = Body::channel();

    // Send SSE headers
    tx.send_data(
        "HTTP/1.1 200 OK\r\n\
        Content-Type: text/event-stream\r\n\
        Cache-Control: no-cache\r\n\
        Connection: keep-alive\r\n\
        Access-Control-Allow-Origin: *\r\n\
        \r\n"
        .into(),
    )
    .await
    .unwrap_or_else(|e| eprintln!("Error sending SSE headers: {}", e));

    // Send initial SSE event to confirm connection
    tx.send_data(
        "event: connected\r\ndata: {\"message\": \"Connected to Artifacts stream\"}\r\n\r\n"
            .into(),
    )
    .await
    .unwrap_or_else(|e| eprintln!("Error sending initial SSE event: {}", e));

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

/// Handler for getting artifacts for a task
async fn handle_get_task_artifacts(
    task_id: &str,
    task_artifacts: Arc<RwLock<HashMap<String, Vec<String>>>>,
    artifacts: Arc<RwLock<HashMap<String, ArtifactInfo>>>,
) -> Result<Response<Body>, hyper::Error> {
    // Get artifact IDs for the task
    let artifact_ids = {
        let task_artifacts_map = task_artifacts.read().await;
        task_artifacts_map.get(task_id).cloned().unwrap_or_else(Vec::new)
    };

    // Get artifact info for each ID
    let mut related_artifacts = Vec::new();
    {
        let artifacts_map = artifacts.read().await;
        for id in artifact_ids {
            if let Some(artifact) = artifacts_map.get(&id) {
                related_artifacts.push(artifact.clone());
            }
        }
    }

    // Sort by sequence number
    related_artifacts.sort_by(|a, b| a.sequence.cmp(&b.sequence));

    // Serialize to JSON
    let json = serde_json::to_string(&related_artifacts)
        .unwrap_or_else(|_| String::from("{\"error\": \"Failed to serialize artifacts\"}"));

    // Create response
    let mut response = Response::new(Body::from(json));
    
    // Add CORS headers
    response.headers_mut().insert(
        hyper::header::ACCESS_CONTROL_ALLOW_ORIGIN,
        hyper::header::HeaderValue::from_static("*"),
    );
    response.headers_mut().insert(
        hyper::header::CONTENT_TYPE,
        hyper::header::HeaderValue::from_static("application/json"),
    );

    Ok(response)
}

/// Handler for getting a specific artifact
async fn handle_get_artifact(
    artifact_id: &str,
    artifacts: Arc<RwLock<HashMap<String, ArtifactInfo>>>,
    kb_base_path: String,
) -> Result<Response<Body>, hyper::Error> {
    // Get artifact info
    let artifact = {
        let artifacts_map = artifacts.read().await;
        if let Some(artifact) = artifacts_map.get(artifact_id) {
            artifact.clone()
        } else {
            let mut resp = Response::new(Body::from(format!("Artifact {} not found", artifact_id)));
            *resp.status_mut() = StatusCode::NOT_FOUND;
            return Ok(resp);
        }
    };

    // Read content from Body-KB
    let full_path = format!("{}/{}", kb_base_path, artifact.storage_path);
    let content = match fs::read(&full_path).await {
        Ok(content) => content,
        Err(e) => {
            let mut resp = Response::new(Body::from(format!("Failed to read artifact: {}", e)));
            *resp.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
            return Ok(resp);
        }
    };

    // Create response
    let mut response = Response::new(Body::from(content));
    
/// Handler for adding a comment to an artifact
async fn handle_add_comment(
    artifact_id: &str,
    req: Request<Body>,
    comments: Arc<RwLock<HashMap<String, Vec<ArtifactComment>>>>,
    artifacts: Arc<RwLock<HashMap<String, ArtifactInfo>>>,
    event_tx: Arc<broadcast::Sender<ArtifactEvent>>,
) -> Result<Response<Body>, hyper::Error> {
    // Check if artifact exists
    let artifact = {
        let artifacts_map = artifacts.read().await;
        if let Some(artifact) = artifacts_map.get(artifact_id) {
            artifact.clone()
        } else {
            let mut resp = Response::new(Body::from(format!("Artifact {} not found", artifact_id)));
            *resp.status_mut() = StatusCode::NOT_FOUND;
            return Ok(resp);
        }
    };

    // Read the request body
    let body_bytes = hyper::body::to_bytes(req.into_body()).await?;
    let comment_request: Result<serde_json::Value, _> = serde_json::from_slice(&body_bytes);
    
    if let Ok(json) = comment_request {
        let user_id = json.get("user_id")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
            
        let text = json.get("text")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
            
        let is_human = json.get("is_human")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);
            
        let parent_id = json.get("parent_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
            
        let position = json.get("position")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Create comment
        let comment_id = Uuid::new_v4().to_string();
        let comment = ArtifactComment {
            id: comment_id.clone(),
            artifact_id: artifact_id.to_string(),
            user_id: user_id.clone(),
            text: text.clone(),
            created_at: SystemTime::now(),
            is_human,
            parent_id: parent_id.clone(),
            position: position.clone(),
        };

        // Store comment
        {
            let mut comments_map = comments.write().await;
            let artifact_comments = comments_map.entry(artifact_id.to_string()).or_insert_with(Vec::new);
            artifact_comments.push(comment.clone());
        }

        // Broadcast comment event
        let event = ArtifactEvent {
            id: Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            event_type: "artifact_comment_added".to_string(),
            artifact_id: artifact_id.to_string(),
            task_id: artifact.task_id.clone(),
            agent_id: None,
            payload: serde_json::json!({
                "comment_id": comment_id,
                "user_id": user_id,
                "text": text,
                "is_human": is_human,
                "parent_id": parent_id,
            }),
        };

        let _ = event_tx.send(event);

        // Create response
        let response_json = serde_json::json!({
            "success": true,
            "comment_id": comment_id
        });
        
        let mut response = Response::new(Body::from(response_json.to_string()));
        
        // Add headers
        response.headers_mut().insert(
            hyper::header::CONTENT_TYPE,
            hyper::header::HeaderValue::from_static("application/json"),
        );
        response.headers_mut().insert(
            hyper::header::ACCESS_CONTROL_ALLOW_ORIGIN,
            hyper::header::HeaderValue::from_static("*"),
        );

        Ok(response)
    } else {
        let mut resp = Response::new(Body::from("Invalid JSON in request"));
        *resp.status_mut() = StatusCode::BAD_REQUEST;
        Ok(resp)
    }
}

/// Handler for creating a new artifact
async fn handle_create_artifact(
    req: Request<Body>,
    artifacts: Arc<RwLock<HashMap<String, ArtifactInfo>>>,
    task_artifacts: Arc<RwLock<HashMap<String, Vec<String>>>>,
    event_tx: Arc<broadcast::Sender<ArtifactEvent>>,
    config: ArtifactSystemConfig,
    core: Arc<AntigravityCore>,
) -> Result<Response<Body>, hyper::Error> {
    // Extract content type and determine if it's multipart
    let content_type = req.headers()
        .get(hyper::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
        
    let is_multipart = content_type.starts_with("multipart/form-data");

    // For non-multipart requests, process as JSON
    if !is_multipart {
        // Read the request body
        let body_bytes = hyper::body::to_bytes(req.into_body()).await?;
        
        // Check size limit
        if body_bytes.len() > config.max_file_size {
            let mut resp = Response::new(Body::from(format!(
                "File size exceeds maximum allowed size of {} bytes",
                config.max_file_size
            )));
            *resp.status_mut() = StatusCode::BAD_REQUEST;
            return Ok(resp);
        }

        let artifact_request: Result<serde_json::Value, _> = serde_json::from_slice(&body_bytes);
        
        if let Ok(json) = artifact_request {
            // Extract fields
            let title = json.get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Untitled Artifact")
                .to_string();
                
            let artifact_type_str = json.get("artifact_type")
                .and_then(|v| v.as_str())
                .unwrap_or("Text");
                
            let artifact_type = match artifact_type_str {
                "Json" => ArtifactType::Json,
                "CodeDiff" => ArtifactType::CodeDiff,
                "Screenshot" => ArtifactType::Screenshot,
                "Video" => ArtifactType::Video,
                "Logs" => ArtifactType::Logs,
                "Text" => ArtifactType::Text,
                _ => ArtifactType::Custom(artifact_type_str.to_string()),
            };
            
            let task_id = match json.get("task_id").and_then(|v| v.as_str()) {
                Some(id) => id.to_string(),
                None => {
                    let mut resp = Response::new(Body::from("Missing required field: task_id"));
                    *resp.status_mut() = StatusCode::BAD_REQUEST;
                    return Ok(resp);
                }
            };
            
            // Try to get the task to verify it exists
            match core.get_task(&task_id).await {
                Ok(_) => {},
                Err(_) => {
                    let mut resp = Response::new(Body::from(format!("Task {} not found", task_id)));
                    *resp.status_mut() = StatusCode::NOT_FOUND;
                    return Ok(resp);
                }
            }
            
            let agent_id = match json.get("agent_id").and_then(|v| v.as_str()) {
                Some(id) => id.to_string(),
                None => {
                    let mut resp = Response::new(Body::from("Missing required field: agent_id"));
                    *resp.status_mut() = StatusCode::BAD_REQUEST;
                    return Ok(resp);
                }
            };
            
            // Default content type based on artifact type if not provided
            let content_type = json.get("content_type")
                .and_then(|v| v.as_str())
                .unwrap_or(match artifact_type {
                    ArtifactType::Json => "application/json",
                    ArtifactType::CodeDiff => "text/x-diff",
                    ArtifactType::Screenshot => "image/png",
                    ArtifactType::Video => "video/mp4",
                    ArtifactType::Logs => "text/plain",
                    ArtifactType::Text => "text/plain",
                    _ => "application/octet-stream",
                })
                .to_string();
                
            // Extract content from the request, depending on type
            let content = if let Some(content_value) = json.get("content") {
                if content_value.is_string() {
                    content_value.as_str().unwrap_or("").as_bytes().to_vec()
                } else if content_type == "application/json" {
                    content_value.to_string().into_bytes()
                } else {
                    let mut resp = Response::new(Body::from("Invalid content format"));
                    *resp.status_mut() = StatusCode::BAD_REQUEST;
                    return Ok(resp);
                }
            } else {
                let mut resp = Response::new(Body::from("Missing required field: content"));
                *resp.status_mut() = StatusCode::BAD_REQUEST;
                return Ok(resp);
            };
            
            let description = json.get("description")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
                
            let step_id = json.get("step_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
                
            let parent_id = json.get("parent_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
                
            let metadata = json.get("metadata")
                .and_then(|v| v.as_object())
                .map(|obj| {
                    let mut map = HashMap::new();
                    for (key, value) in obj {
                        if let Some(str_value) = value.as_str() {
                            map.insert(key.clone(), str_value.to_string());
                        }
                    }
                    map
                });

            // Process the artifact creation

            // Create task directory if needed
            let task_path = format!("{}/{}", config.kb_base_path, task_id);
            if let Err(e) = fs::create_dir_all(&task_path).await {
                let mut resp = Response::new(Body::from(format!("Failed to create storage directory: {}", e)));
                *resp.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
                return Ok(resp);
            }

            // Create unique ID for the artifact
            let artifact_id = Uuid::new_v4().to_string();

            // Determine file extension based on content type
            let extension = match content_type.as_str() {
                "application/json" => "json",
                "text/plain" => "txt",
                "image/png" => "png",
                "image/jpeg" => "jpg",
                "image/webp" => "webp", 
                "video/mp4" => "mp4",
                "text/x-diff" => "diff",
                _ => "bin",
            };

            // Create storage path
            let filename = format!("{}_{}.{}", artifact_id, chrono::Utc::now().timestamp(), extension);
            let storage_path = format!("{}/{}", task_id, filename);
            let full_path = format!("{}/{}", config.kb_base_path, storage_path);

            // Write content to file
            if let Err(e) = fs::write(&full_path, &content).await {
                let mut resp = Response::new(Body::from(format!("Failed to write artifact to storage: {}", e)));
                *resp.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
                return Ok(resp);
            }

            // Get next sequence number for this task
            let sequence = {
                let task_artifacts_map = task_artifacts.read().await;
                let artifact_ids = task_artifacts_map.get(&task_id).map(|ids| ids.len()).unwrap_or(0);
                (artifact_ids + 1) as u32
            };

            // Create artifact info
            let artifact_info = ArtifactInfo {
                id: artifact_id.clone(),
                title,
                artifact_type,
                task_id: task_id.clone(),
                agent_id: agent_id.clone(),
                created_at: SystemTime::now(),
                content_type,
                storage_path,
                description,
                sequence,
                step_id,
                parent_id,
                metadata: metadata.unwrap_or_default(),
            };

            // Store artifact info
            {
                let mut artifacts_map = artifacts.write().await;
                artifacts_map.insert(artifact_id.clone(), artifact_info.clone());
            }

            // Add to task artifacts mapping
            {
                let mut task_artifacts_map = task_artifacts.write().await;
                let task_artifact_list = task_artifacts_map.entry(task_id.clone()).or_insert_with(Vec::new);
                task_artifact_list.push(artifact_id.clone());
            }

            // Broadcast artifact creation event
            let event = ArtifactEvent {
                id: Uuid::new_v4().to_string(),
                timestamp: chrono::Utc::now().to_rfc3339(),
                event_type: "artifact_created".to_string(),
                artifact_id: artifact_id.clone(),
                task_id,
                agent_id: Some(agent_id),
                payload: serde_json::json!({
                    "title": artifact_info.title,
                    "type": artifact_info.artifact_type.to_string(),
                    "sequence": artifact_info.sequence,
                }),
            };

            let _ = event_tx.send(event);

            // Create response
            let response_json = serde_json::json!({
                "success": true,
                "artifact_id": artifact_id
            });
            
            let mut response = Response::new(Body::from(response_json.to_string()));
            
            // Add headers
            response.headers_mut().insert(
                hyper::header::CONTENT_TYPE,
                hyper::header::HeaderValue::from_static("application/json"),
            );
            response.headers_mut().insert(
                hyper::header::ACCESS_CONTROL_ALLOW_ORIGIN,
                hyper::header::HeaderValue::from_static("*"),
            );

            Ok(response)
        } else {
            let mut resp = Response::new(Body::from("Invalid JSON in request"));
            *resp.status_mut() = StatusCode::BAD_REQUEST;
            Ok(resp)
        }
    } else {
        // For multipart form data (files), we would need a multipart parser
        // This is a simplified implementation that doesn't handle multipart properly
        let mut resp = Response::new(Body::from("Multipart form data not implemented"));
        *resp.status_mut() = StatusCode::NOT_IMPLEMENTED;
        Ok(resp)
    }
}
    // Set content type
    response.headers_mut().insert(
        hyper::header::CONTENT_TYPE,
        hyper::header::HeaderValue::from_str(&artifact.content_type).unwrap_or_else(|_| {
            hyper::header::HeaderValue::from_static("application/octet-stream")
        }),
    );

    // Add CORS headers
    response.headers_mut().insert(
        hyper::header::ACCESS_CONTROL_ALLOW_ORIGIN,
        hyper::header::HeaderValue::from_static("*"),
    );

    Ok(response)
}

/// Handler for getting comments for an artifact
async fn handle_get_artifact_comments(
    artifact_id: &str,
    comments: Arc<RwLock<HashMap<String, Vec<ArtifactComment>>>>,
) -> Result<Response<Body>, hyper::Error> {
    // Get comments for the artifact
    let artifact_comments = {
        let comments_map = comments.read().await;
        comments_map.get(artifact_id).cloned().unwrap_or_else(Vec::new)
    };

    // Serialize to JSON
    let json = serde_json::to_string(&artifact_comments)
        .unwrap_or_else(|_| String::from("{\"error\": \"Failed to serialize comments\"}"));

    // Create response
    let mut response = Response::new(Body::from(json));
    
    // Add headers
    response.headers_mut().insert(
        hyper::header::CONTENT_TYPE,
        hyper::header::HeaderValue::from_static("application/json"),
    );
    response.headers_mut().insert(
        hyper::header::ACCESS_CONTROL_ALLOW_ORIGIN,
        hyper::header::HeaderValue::from_static("*"),
    );

    Ok(response)
}
            event_type: event_type.to_string(),
            artifact_id: artifact_id.to_string(),
            task_id: task_id.to_string(),
            agent_id: agent_id.map(|id| id.to_string()),
            payload,
        };

        // Send event to all subscribers
        if self.event_tx.send(event).is_err() {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::CommunicationError,
                message: "Failed to broadcast event (no subscribers)".to_string(),
                component: "ArtifactSystem".to_string(),
            });
        }

        Ok(())
    }

    /// Stop the Artifacts System
    pub async fn stop(&mut self) -> PhoenixResult<()> {
        // Check if running
        {
            let running = self.is_running.read().await;
            if !*running {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::NotRunning,
                    message: "Artifacts System is not running".to_string(),
                    component: "ArtifactSystem".to_string(),
                });
            }
        }

        // Mark as not running
        {
            let mut running = self.is_running.write().await;
            *running = false;
        }

        // Stop API server
        if let Some(handle) = self.server_handle.take() {
            handle.abort();
        }

        Ok(())
    }
            metadata: metadata.unwrap_or_default(),
        };
        
        // Store artifact info
        {
            let mut artifacts = self.artifacts.write().await;
            artifacts.insert(artifact_id.clone(), artifact_info.clone());
        }
        
        // Add to task artifacts mapping
        {
            let mut task_artifacts = self.task_artifacts.write().await;
            let task_artifact_list = task_artifacts.entry(task_id.clone()).or_insert_with(Vec::new);
            task_artifact_list.push(artifact_id.clone());
        }
        
        // Broadcast artifact creation event
        self.broadcast_artifact_event(
            "artifact_created",
            &artifact_id,
            &task_id,
            Some(&artifact_info.agent_id),
            serde_json::json!({
                "title": artifact_info.title,
                "type": artifact_info.artifact_type.to_string(),
                "sequence": artifact_info.sequence,
            }),
        ).await?;
        
        Ok(artifact_id)
    }
}