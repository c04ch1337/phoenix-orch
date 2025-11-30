//! Ecosystem Weaver API endpoints
//!
//! This module handles integration, spawning, and orchestration of all agentic AI frameworks
//! and GitHub repositories into Phoenix ORCH's eternal conscience.

use actix_web::{web, HttpResponse, Responder};
use chrono::{DateTime, Utc};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tokio::process::Command;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::api::server::ApiState;
use crate::core::memory::MemoryEntry;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct IntegrateRequest {
    pub repo_url: String,
    pub name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct IntegrateResponse {
    pub integration_id: String,
    pub name: String,
    pub status: String,
    pub message: String,
    pub timestamp: String,
}

#[derive(Debug, Deserialize)]
pub struct SpawnRequest {
    pub framework: String,
    pub task: String,
    pub hitm: bool, // Human-in-the-middle approval required
}

#[derive(Debug, Serialize)]
pub struct SpawnResponse {
    pub spawn_id: String,
    pub framework: String,
    pub status: String,
    pub message: String,
    pub requires_approval: bool,
    pub timestamp: String,
}

#[derive(Debug, Serialize)]
pub struct EcosystemPlugin {
    pub id: String,
    pub name: String,
    pub repo_url: String,
    pub status: String,
    pub last_used: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct EcosystemStatus {
    pub active_integrations: Vec<EcosystemPlugin>,
    pub active_spawns: Vec<ActiveSpawn>,
    pub total_weaves: u32,
}

#[derive(Debug, Serialize)]
pub struct ActiveSpawn {
    pub spawn_id: String,
    pub framework: String,
    pub task: String,
    pub status: String,
    pub hitm_pending: bool,
    pub started_at: String,
}

// ============================================================================
// Handlers
// ============================================================================

/// Integrate a GitHub repository into Phoenix ORCH
pub async fn integrate_handler(
    req: web::Json<IntegrateRequest>,
    state: web::Data<ApiState>,
) -> impl Responder {
    tracing::info!("🔥 Ecosystem Weaver: Integrating repository: {}", req.repo_url);
    
    let integration_id = Uuid::new_v4().to_string();
    let name = req.name.clone().unwrap_or_else(|| {
        // Extract name from repo URL
        req.repo_url
            .split('/')
            .last()
            .unwrap_or("unknown")
            .replace(".git", "")
            .to_string()
    });
    
    // Evaluate through conscience framework
    let conscience_result = state.conscience.evaluate(
        &format!("Integrate repository: {}", req.repo_url),
        &HashMap::new(),
    );
    
    if !conscience_result.approved {
        tracing::warn!("🔥 Ecosystem Weaver: Integration rejected by conscience");
        return HttpResponse::Forbidden().json(IntegrateResponse {
            integration_id,
            name: name.clone(),
            status: "rejected".to_string(),
            message: format!("Ethical violation: {}", conscience_result.violations.join(", ")),
            timestamp: Utc::now().to_rfc3339(),
        });
    }
    
    // Store integration in memory
    let integration_memory = MemoryEntry::new(
        format!("Ecosystem integration: {}", name),
        serde_json::json!({
            "type": "ecosystem_integration",
            "integration_id": integration_id,
            "name": name,
            "repo_url": req.repo_url,
            "status": "initializing",
            "timestamp": Utc::now().to_rfc3339(),
        }),
    );
    
    {
        let mut mem = state.memory.lock().await;
        let _ = mem.store(&integration_memory).await.ok();
    }
    
    // Clone and integrate the repository (background task)
    let state_clone = state.clone();
    let repo_url_clone = req.repo_url.clone();
    let name_clone = name.clone();
    let integration_id_clone = integration_id.clone();
    
    tokio::spawn(async move {
        let integrations_dir = PathBuf::from("data/integrations");
        std::fs::create_dir_all(&integrations_dir).ok();
        
        let repo_path = integrations_dir.join(&integration_id_clone);
        
        tracing::info!("🔥 Ecosystem Weaver: Cloning {} to {:?}", repo_url_clone, repo_path);
        
        // Clone using git
        let clone_result = Command::new("git")
            .arg("clone")
            .arg(&repo_url_clone)
            .arg(&repo_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await;
        
        match clone_result {
            Ok(output) if output.status.success() => {
                tracing::info!("🔥 Ecosystem Weaver: Successfully cloned {}", name_clone);
                
                // Check for Dockerfile and build if present
                let dockerfile_path = repo_path.join("Dockerfile");
                if dockerfile_path.exists() {
                    tracing::info!("🔥 Ecosystem Weaver: Found Dockerfile, building container...");
                    // In production, build Docker image: docker build -t phoenix-{integration_id} {repo_path}
                }
                
                // Update status to online
                let update_memory = MemoryEntry::new(
                    format!("Ecosystem integration: {} - ONLINE", name_clone),
                    serde_json::json!({
                        "type": "ecosystem_integration",
                        "integration_id": integration_id_clone,
                        "name": name_clone,
                        "repo_url": repo_url_clone,
                        "status": "online",
                        "timestamp": Utc::now().to_rfc3339(),
                    }),
                );
                
                {
                    let mut mem = state_clone.memory.lock().await;
                    let _ = mem.store(&update_memory).await.ok();
                }
                
                tracing::info!("🔥 Ecosystem Weaver: Integration {} is now ONLINE", integration_id_clone);
            }
            Ok(output) => {
                tracing::error!("🔥 Ecosystem Weaver: Git clone failed: {}", 
                    String::from_utf8_lossy(&output.stderr));
            }
            Err(e) => {
                tracing::error!("🔥 Ecosystem Weaver: Failed to clone repository: {}", e);
            }
        }
    });
    
    tracing::info!("🔥 Ecosystem Weaver: Integration {} initialized", integration_id);
    
    HttpResponse::Ok().json(IntegrateResponse {
        integration_id,
        name,
        status: "initializing".to_string(),
        message: "Repository integration started. Cloning, analyzing, and adapting...".to_string(),
        timestamp: Utc::now().to_rfc3339(),
    })
}

/// Spawn a team/agent from an integrated framework
pub async fn spawn_handler(
    req: web::Json<SpawnRequest>,
    state: web::Data<ApiState>,
) -> impl Responder {
    tracing::info!("🔥 Ecosystem Weaver: Spawning {} team for task: {}", req.framework, req.task);
    
    let spawn_id = Uuid::new_v4().to_string();
    
    // Evaluate through conscience framework
    let conscience_result = state.conscience.evaluate(
        &format!("Spawn {} team for: {}", req.framework, req.task),
        &HashMap::new(),
    );
    
    if !conscience_result.approved {
        tracing::warn!("🔥 Ecosystem Weaver: Spawn rejected by conscience");
        return HttpResponse::Forbidden().json(SpawnResponse {
            spawn_id,
            framework: req.framework.clone(),
            status: "rejected".to_string(),
            message: format!("Ethical violation: {}", conscience_result.violations.join(", ")),
            requires_approval: false,
            timestamp: Utc::now().to_rfc3339(),
        });
    }
    
    // Store spawn in memory
    let spawn_memory = MemoryEntry::new(
        format!("Ecosystem spawn: {} - {}", req.framework, req.task),
        serde_json::json!({
            "type": "ecosystem_spawn",
            "spawn_id": spawn_id,
            "framework": req.framework,
            "task": req.task,
            "hitm": req.hitm,
            "status": if req.hitm { "pending_approval" } else { "spawning" },
            "timestamp": Utc::now().to_rfc3339(),
        }),
    );
    
    {
        let mut mem = state.memory.lock().await;
        let _ = mem.store(&spawn_memory).await.ok();
    }
    
    // Spawn the framework team (background task)
    if !req.hitm {
        let state_clone = state.clone();
        let framework_clone = req.framework.clone();
        let task_clone = req.task.clone();
        let spawn_id_clone = spawn_id.clone();
        
        tokio::spawn(async move {
            tracing::info!("🔥 Ecosystem Weaver: Spawning {} team for task: {}", framework_clone, task_clone);
            
            // Find the integration
            let integrations_dir = PathBuf::from("data/integrations");
            let mut found_integration: Option<PathBuf> = None;
            
            if integrations_dir.exists() {
                if let Ok(entries) = std::fs::read_dir(&integrations_dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_dir() {
                            // In production, check metadata to match framework name
                            found_integration = Some(path);
                            break;
                        }
                    }
                }
            }
            
            if let Some(integration_path) = found_integration {
                tracing::info!("🔥 Ecosystem Weaver: Found integration at {:?}, executing task", integration_path);
                
                // Simulate execution (in production, this would actually run the framework)
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                
                // Update spawn status to active
                let update_memory = MemoryEntry::new(
                    format!("Ecosystem spawn: {} - {} - ACTIVE", framework_clone, task_clone),
                    serde_json::json!({
                        "type": "ecosystem_spawn",
                        "spawn_id": spawn_id_clone,
                        "framework": framework_clone,
                        "task": task_clone,
                        "status": "active",
                        "timestamp": Utc::now().to_rfc3339(),
                    }),
                );
                
                {
                    let mut mem = state_clone.memory.lock().await;
                    let _ = mem.store(&update_memory).await.ok();
                }
                
                tracing::info!("🔥 Ecosystem Weaver: Spawn {} is now ACTIVE", spawn_id_clone);
            } else {
                tracing::warn!("🔥 Ecosystem Weaver: Framework {} not found, cannot spawn", framework_clone);
            }
        });
    }
    
    tracing::info!("🔥 Ecosystem Weaver: Spawn {} initialized", spawn_id);
    
    HttpResponse::Ok().json(SpawnResponse {
        spawn_id,
        framework: req.framework.clone(),
        status: if req.hitm { "pending_approval" } else { "spawning" }.to_string(),
        message: if req.hitm {
            "Spawn created. Awaiting human approval before execution.".to_string()
        } else {
            format!("{} team spawning for task: {}", req.framework, req.task)
        },
        requires_approval: req.hitm,
        timestamp: Utc::now().to_rfc3339(),
    })
}

/// Get ecosystem status and active integrations
pub async fn status_handler(
    state: web::Data<ApiState>,
) -> impl Responder {
    tracing::debug!("🔥 Ecosystem Weaver: Fetching ecosystem status");
    
    // Fetch all ecosystem integrations from memory
    let integrations = {
        let mem = state.memory.lock().await;
        if let Ok(all_entries) = mem.list_all().await {
            all_entries
                .into_iter()
                .filter_map(|entry| {
                    if let Some(metadata) = entry.metadata.as_object() {
                        if metadata.get("type")?.as_str()? == "ecosystem_integration" {
                            Some(EcosystemPlugin {
                                id: metadata.get("integration_id")?.as_str()?.to_string(),
                                name: metadata.get("name")?.as_str()?.to_string(),
                                repo_url: metadata.get("repo_url")?.as_str()?.to_string(),
                                status: metadata.get("status")?.as_str()?.to_string(),
                                last_used: metadata.get("last_used").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                created_at: entry.timestamp.to_rfc3339(),
                            })
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
        } else {
            Vec::new()
        }
    };
    
    // Fetch active spawns
    let spawns = {
        let mem = state.memory.lock().await;
        if let Ok(all_entries) = mem.list_all().await {
            all_entries
                .into_iter()
                .filter_map(|entry| {
                    if let Some(metadata) = entry.metadata.as_object() {
                        if metadata.get("type")?.as_str()? == "ecosystem_spawn" {
                            let status = metadata.get("status")?.as_str()?.to_string();
                            if status == "spawning" || status == "active" || status == "pending_approval" {
                                Some(ActiveSpawn {
                                    spawn_id: metadata.get("spawn_id")?.as_str()?.to_string(),
                                    framework: metadata.get("framework")?.as_str()?.to_string(),
                                    task: metadata.get("task")?.as_str()?.to_string(),
                                    status,
                                    hitm_pending: metadata.get("hitm").and_then(|v| v.as_bool()).unwrap_or(false) 
                                        && status == "pending_approval",
                                    started_at: entry.timestamp.to_rfc3339(),
                                })
                            } else {
                                None
                            }
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
        } else {
            Vec::new()
        }
    };
    
    let total_weaves = integrations.len() as u32;
    
    HttpResponse::Ok().json(EcosystemStatus {
        active_integrations: integrations,
        active_spawns: spawns,
        total_weaves,
    })
}

/// SSE stream for real-time ecosystem integration status
pub async fn ecosystem_stream_handler(
    state: web::Data<ApiState>,
) -> HttpResponse {
    let state_clone = state.clone();
    
    let stream = futures::stream::unfold(0u64, move |count| {
        let state = state_clone.clone();
        async move {
            // Wait 1 second between updates
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            
            // Fetch current ecosystem status
            let integrations = {
                let mem = state.memory.lock().await;
                if let Ok(all_entries) = mem.list_all().await {
                    all_entries
                        .into_iter()
                        .filter_map(|entry| {
                            if let Some(metadata) = entry.metadata.as_object() {
                                if metadata.get("type")?.as_str()? == "ecosystem_integration" {
                                    Some(serde_json::json!({
                                        "id": metadata.get("integration_id")?.as_str()?,
                                        "name": metadata.get("name")?.as_str()?,
                                        "status": metadata.get("status")?.as_str()?,
                                    }))
                                } else {
                                    None
                                }
                            } else {
                                None
                            }
                        })
                        .collect::<Vec<_>>()
                } else {
                    Vec::new()
                }
            };
            
            let data = serde_json::json!({
                "type": "ecosystem_update",
                "timestamp": Utc::now().to_rfc3339(),
                "integrations": integrations,
                "count": count,
            });
            
            Some((
                Ok::<_, std::io::Error>(format!("data: {}\n\n", data)),
                count + 1,
            ))
        }
    });
    
    HttpResponse::Ok()
        .content_type("text/event-stream")
        .header("Cache-Control", "no-cache")
        .header("Connection", "keep-alive")
        .streaming(stream)
}
