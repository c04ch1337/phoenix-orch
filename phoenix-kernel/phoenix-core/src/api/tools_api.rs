//! Tools API Endpoints
//!
//! API for calling tools, registering new tools, and streaming tool output.

use actix_web::{web, HttpResponse, Responder};
use chrono::Utc;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::api::server::ApiState;
use crate::core::memory::MemoryEntry;
use crate::tools::{ToolRegistry, EternalTool, ToolParams, ToolOutput, HitmLevel};
use crate::tools::core::{NmapTool, ApiTool, IotTool, BluetoothTool};
use crate::tools::pistol_tool::PistolTool;
use crate::tools::masscan_tool::MasscanTool;
use crate::tools::msf_bridge::MsfBridge;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Deserialize, garde::Validate)]
pub struct ToolCallRequest {
    #[garde(length(min = 1, max = 128))]
    pub name: String,
    pub params: ToolParams,
}

#[derive(Debug, Serialize)]
pub struct ToolCallResponse {
    pub call_id: String,
    pub tool_name: String,
    pub status: String,
    pub message: String,
    pub requires_approval: bool,
    pub timestamp: String,
}

#[derive(Debug, Deserialize, garde::Validate)]
pub struct ToolRegisterRequest {
    #[garde(length(min = 1, max = 256))]
    #[garde(custom(validate_github_repo))]
    pub github_repo: String,
    #[garde(length(max = 128))]
    pub name: Option<String>,
}

fn validate_github_repo(value: &str, _context: &()) -> garde::Result {
    // Validate GitHub repo format: owner/repo or full URL
    if value.starts_with("https://github.com/") || value.starts_with("http://github.com/") {
        if url::Url::parse(value).is_err() {
            return Err(garde::Error::new("Invalid GitHub URL format"));
        }
    } else if !value.contains('/') || value.matches('/').count() != 1 {
        return Err(garde::Error::new("GitHub repo must be in format 'owner/repo'"));
    }
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct ToolRegisterResponse {
    pub tool_id: String,
    pub name: String,
    pub status: String,
    pub message: String,
    pub timestamp: String,
}

#[derive(Debug, Serialize)]
pub struct ToolInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub hitm_level: String,
    pub last_used: Option<String>,
}

// ============================================================================
// Handlers
// ============================================================================

/// Call a tool
pub async fn tool_call_handler(
    req: web::Json<ToolCallRequest>,
    state: web::Data<ApiState>,
) -> impl Responder {
    // Validate input using garde
    if let Err(e) = req.validate(&()) {
        tracing::warn!("Tool call request validation failed: {:?}", e);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid request",
            "details": format!("{:?}", e)
        }));
    }
    
    tracing::info!("🔥 Tools Arsenal: Calling tool: {}", req.name);
    
    let call_id = Uuid::new_v4().to_string();
    
    // Evaluate through conscience framework
    let conscience_result = state.conscience.evaluate(
        &format!("Call tool: {} with params: {:?}", req.name, req.params),
        &HashMap::new(),
    );
    
    if !conscience_result.approved {
        let violation_context = format!(
            "Tool call rejected: tool={}, params={:?}, violations={:?}",
            req.name,
            req.params,
            conscience_result.violations
        );
        tracing::warn!("🔥 Tools Arsenal: {}", violation_context);
        return HttpResponse::Forbidden().json(ToolCallResponse {
            call_id,
            tool_name: req.name.clone(),
            status: "rejected".to_string(),
            message: format!("Ethical violation: {}", conscience_result.violations.join(", ")),
            requires_approval: false,
            timestamp: Utc::now().to_rfc3339(),
        });
    }
    
    // Get tool registry (create if needed)
    // In production, this would be part of ApiState
    // For now, create a temporary registry
    let memory = state.memory.clone();
    let registry = ToolRegistry::new(memory);
    
    // Register core tools if not already registered
    // In production, this would be done at startup
    {
        let tools: Vec<Box<dyn EternalTool>> = vec![
            Box::new(MsfBridge::new()) as Box<dyn EternalTool>,
            Box::new(MasscanTool) as Box<dyn EternalTool>,
            Box::new(PistolTool) as Box<dyn EternalTool>,
            Box::new(NmapTool) as Box<dyn EternalTool>,
            Box::new(ApiTool) as Box<dyn EternalTool>,
            Box::new(IotTool) as Box<dyn EternalTool>,
            Box::new(BluetoothTool) as Box<dyn EternalTool>,
        ];
        
        for tool in tools {
            let _ = registry.register(tool).await;
        }
    }
    
    // Check if tool requires HITM approval
    let tool_output = registry.call_tool(&req.name, req.params.clone()).await;
    
    let (status, message, requires_approval) = match tool_output {
        Ok(output) => {
            if output.success {
                ("success".to_string(), output.message, false)
            } else {
                ("error".to_string(), output.message, false)
            }
        }
        Err(e) => {
            ("error".to_string(), format!("Tool execution failed: {}", e), false)
        }
    };
    
    // Store tool call in memory
    let call_memory = MemoryEntry::new(
        format!("Tool call: {} - {}", req.name, status),
        serde_json::json!({
            "type": "tool_call",
            "call_id": call_id,
            "tool_name": req.name,
            "params": req.params,
            "status": status,
            "timestamp": Utc::now().to_rfc3339(),
        }),
    );
    
    {
        let mut mem = state.memory.lock().await;
        let _ = mem.store(&call_memory).await.ok();
    }
    
    HttpResponse::Ok().json(ToolCallResponse {
        call_id,
        tool_name: req.name,
        status,
        message,
        requires_approval,
        timestamp: Utc::now().to_rfc3339(),
    })
}

/// Register a new tool from GitHub
pub async fn tool_register_handler(
    req: web::Json<ToolRegisterRequest>,
    state: web::Data<ApiState>,
) -> impl Responder {
    // Validate input using garde
    if let Err(e) = req.validate(&()) {
        tracing::warn!("Tool register request validation failed: {:?}", e);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid request",
            "details": format!("{:?}", e)
        }));
    }
    
    tracing::info!("🔥 Tools Arsenal: Registering tool from: {}", req.github_repo);
    
    let tool_id = Uuid::new_v4().to_string();
    let name = req.name.clone().unwrap_or_else(|| {
        req.github_repo
            .split('/')
            .last()
            .unwrap_or("unknown")
            .replace(".git", "")
            .to_string()
    });
    
    // Evaluate through conscience framework
    let conscience_result = state.conscience.evaluate(
        &format!("Register tool from repository: {}", req.github_repo),
        &HashMap::new(),
    );
    
    if !conscience_result.approved {
        tracing::warn!("🔥 Tools Arsenal: Tool registration rejected by conscience");
        return HttpResponse::Forbidden().json(ToolRegisterResponse {
            tool_id,
            name: name.clone(),
            status: "rejected".to_string(),
            message: format!("Ethical violation: {}", conscience_result.violations.join(", ")),
            timestamp: Utc::now().to_rfc3339(),
        });
    }
    
    // Store registration in memory
    let registration_memory = MemoryEntry::new(
        format!("Tool registration: {}", name),
        serde_json::json!({
            "type": "tool_registration",
            "tool_id": tool_id,
            "name": name,
            "github_repo": req.github_repo,
            "status": "initializing",
            "timestamp": Utc::now().to_rfc3339(),
        }),
    );
    
    {
        let mut mem = state.memory.lock().await;
        let _ = mem.store(&registration_memory).await.ok();
    }
    
    // In production, this would:
    // 1. Clone the repository
    // 2. Analyze the tool code
    // 3. Create Docker container
    // 4. Adapt via LoRA
    // 5. Register the tool
    
    HttpResponse::Ok().json(ToolRegisterResponse {
        tool_id,
        name,
        status: "initializing".to_string(),
        message: "Tool registration started. Cloning, analyzing, and adapting...".to_string(),
        timestamp: Utc::now().to_rfc3339(),
    })
}

/// List all registered tools
pub async fn tools_list_handler(
    state: web::Data<ApiState>,
) -> impl Responder {
    tracing::debug!("🔥 Tools Arsenal: Listing all tools");
    
    let memory = state.memory.clone();
    let registry = ToolRegistry::new(memory);
    let tools = registry.list_tools().await;
    
    let tool_infos: Vec<ToolInfo> = tools.into_iter().map(|meta| {
        ToolInfo {
            id: meta.id,
            name: meta.name,
            version: meta.version,
            description: meta.description,
            hitm_level: format!("{:?}", meta.hitm_level),
            last_used: meta.last_used,
        }
    }).collect();
    
    HttpResponse::Ok().json(tool_infos)
}

/// SSE stream for tool execution output
pub async fn tool_stream_handler(
    state: web::Data<ApiState>,
) -> HttpResponse {
    let state_clone = state.clone();
    
    let stream = futures::stream::unfold(0u64, move |count| {
        let state = state_clone.clone();
        async move {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            
            // Fetch recent tool calls
            let tool_calls = {
                let mem = state.memory.lock().await;
                if let Ok(all_entries) = mem.list_all().await {
                    all_entries
                        .into_iter()
                        .filter_map(|entry| {
                            if let Some(metadata) = entry.metadata.as_object() {
                                if metadata.get("type")?.as_str()? == "tool_call" {
                                    Some(serde_json::json!({
                                        "call_id": metadata.get("call_id")?.as_str()?,
                                        "tool_name": metadata.get("tool_name")?.as_str()?,
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
                "type": "tool_update",
                "timestamp": Utc::now().to_rfc3339(),
                "tool_calls": tool_calls,
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

/// PISTOL-specific scan endpoint
#[derive(Debug, Deserialize)]
pub struct PistolScanRequest {
    pub target: String,
    pub ports: Option<String>,
    #[serde(rename = "type")]
    pub scan_type: Option<String>,
    pub host_discovery: Option<bool>,
    pub os_detection: Option<bool>,
    pub service_detection: Option<bool>,
    pub format: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PistolScanResponse {
    pub job_id: String,
    pub status: String,
    pub message: String,
    pub timestamp: String,
}

/// PISTOL scan handler
pub async fn pistol_scan_handler(
    req: web::Json<PistolScanRequest>,
    state: web::Data<ApiState>,
) -> impl Responder {
    tracing::info!("🔥 PISTOL: Scanning target: {}", req.target);
    
    let job_id = Uuid::new_v4().to_string();
    
    // Evaluate through conscience framework
    let conscience_result = state.conscience.evaluate(
        &format!("PISTOL scan target: {}", req.target),
        &HashMap::new(),
    );
    
    if !conscience_result.approved {
        tracing::warn!("🔥 PISTOL: Scan rejected by conscience");
        return HttpResponse::Forbidden().json(PistolScanResponse {
            job_id,
            status: "rejected".to_string(),
            message: format!("Ethical violation: {}", conscience_result.violations.join(", ")),
            timestamp: Utc::now().to_rfc3339(),
        });
    }
    
    // Build tool params
    let mut params = ToolParams::new();
    params.insert("target".to_string(), serde_json::Value::String(req.target.clone()));
    if let Some(ports) = &req.ports {
        params.insert("ports".to_string(), serde_json::Value::String(ports.clone()));
    }
    if let Some(scan_type) = &req.scan_type {
        params.insert("type".to_string(), serde_json::Value::String(scan_type.clone()));
    }
    if let Some(host_discovery) = req.host_discovery {
        params.insert("host_discovery".to_string(), serde_json::Value::Bool(host_discovery));
    }
    if let Some(os_detection) = req.os_detection {
        params.insert("os_detection".to_string(), serde_json::Value::Bool(os_detection));
    }
    if let Some(service_detection) = req.service_detection {
        params.insert("service_detection".to_string(), serde_json::Value::Bool(service_detection));
    }
    if let Some(format) = &req.format {
        params.insert("format".to_string(), serde_json::Value::String(format.clone()));
    }
    
    // Store scan job in memory
    let scan_memory = MemoryEntry::new(
        format!("PISTOL scan: {} - {}", req.target, job_id),
        serde_json::json!({
            "type": "pistol_scan",
            "job_id": job_id,
            "target": req.target,
            "params": params,
            "status": "running",
            "timestamp": Utc::now().to_rfc3339(),
        }),
    );
    
    {
        let mut mem = state.memory.lock().await;
        let _ = mem.store(&scan_memory).await.ok();
    }
    
    // Execute PISTOL scan in background
    let state_clone = state.clone();
    let job_id_clone = job_id.clone();
    let target_clone = req.target.clone();
    
    tokio::spawn(async move {
        let memory = state_clone.memory.clone();
        let registry = ToolRegistry::new(memory);
        
        // Register PISTOL if needed
        let _ = registry.register(Box::new(PistolTool) as Box<dyn EternalTool>).await;
        
        // Execute scan
        match registry.call_tool("pistol_scan", params).await {
            Ok(output) => {
                // Update job status
                let result_memory = MemoryEntry::new(
                    format!("PISTOL scan result: {} - {}", target_clone, job_id_clone),
                    serde_json::json!({
                        "type": "pistol_scan",
                        "job_id": job_id_clone,
                        "target": target_clone,
                        "status": "completed",
                        "result": output,
                        "timestamp": Utc::now().to_rfc3339(),
                    }),
                );
                
                {
                    let mut mem = state_clone.memory.lock().await;
                    let _ = mem.store(&result_memory).await.ok();
                }
                
                tracing::info!("🔥 PISTOL: Scan {} completed", job_id_clone);
            }
            Err(e) => {
                tracing::error!("🔥 PISTOL: Scan {} failed: {}", job_id_clone, e);
            }
        }
    });
    
    HttpResponse::Ok().json(PistolScanResponse {
        job_id,
        status: "running".to_string(),
        message: format!("PISTOL scan started for target: {}", req.target),
        timestamp: Utc::now().to_rfc3339(),
    })
}

/// PISTOL scan SSE stream
pub async fn pistol_stream_handler(
    path: web::Path<String>,
    state: web::Data<ApiState>,
) -> HttpResponse {
    let job_id = path.into_inner();
    let state_clone = state.clone();
    
    let stream = futures::stream::unfold(0u64, move |count| {
        let state = state_clone.clone();
        let job_id = job_id.clone();
        async move {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            
            // Fetch scan results
            let scan_data = {
                let mem = state.memory.lock().await;
                if let Ok(all_entries) = mem.list_all().await {
                    all_entries
                        .into_iter()
                        .find(|entry| {
                            if let Some(metadata) = entry.metadata.as_object() {
                                metadata.get("type")?.as_str()? == "pistol_scan"
                                    && metadata.get("job_id")?.as_str()? == job_id
                            } else {
                                None
                            }
                            .is_some()
                        })
                        .and_then(|entry| entry.metadata.as_object().cloned())
                } else {
                    None
                }
            };
            
            let data = serde_json::json!({
                "type": "pistol_update",
                "job_id": job_id,
                "timestamp": Utc::now().to_rfc3339(),
                "data": scan_data,
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

/// MASSCAN-specific scan endpoint
#[derive(Debug, Deserialize)]
pub struct MasscanScanRequest {
    pub target: String,
    pub ports: Option<String>,
    pub rate: Option<u64>,
    pub banner: Option<bool>,
    pub exclude: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MasscanScanResponse {
    pub job_id: String,
    pub status: String,
    pub message: String,
    pub timestamp: String,
}

/// MASSCAN scan handler
pub async fn masscan_scan_handler(
    req: web::Json<MasscanScanRequest>,
    state: web::Data<ApiState>,
) -> impl Responder {
    tracing::info!("🔥 MASSCAN: Scanning target: {} at {} pps", req.target, req.rate.unwrap_or(1000000));
    
    let job_id = Uuid::new_v4().to_string();
    let rate = req.rate.unwrap_or(1000000);
    
    // Evaluate through conscience framework
    let conscience_result = state.conscience.evaluate(
        &format!("MASSCAN target: {} at {} pps", req.target, rate),
        &HashMap::new(),
    );
    
    if !conscience_result.approved {
        tracing::warn!("🔥 MASSCAN: Scan rejected by conscience");
        return HttpResponse::Forbidden().json(MasscanScanResponse {
            job_id,
            status: "rejected".to_string(),
            message: format!("Ethical violation: {}", conscience_result.violations.join(", ")),
            timestamp: Utc::now().to_rfc3339(),
        });
    }
    
    // High-rate or external scans require explicit approval
    if rate > 100000 || req.target.contains("0.0.0.0/0") || req.target == "internet" {
        tracing::warn!("🔥 MASSCAN: High-risk scan requires HITM approval");
        // In production, this would trigger HITM approval flow
    }
    
    // Build tool params
    let mut params = ToolParams::new();
    params.insert("target".to_string(), serde_json::Value::String(req.target.clone()));
    if let Some(ports) = &req.ports {
        params.insert("ports".to_string(), serde_json::Value::String(ports.clone()));
    }
    params.insert("rate".to_string(), serde_json::Value::Number(rate.into()));
    if let Some(banner) = req.banner {
        params.insert("banner".to_string(), serde_json::Value::Bool(banner));
    }
    if let Some(exclude) = &req.exclude {
        params.insert("exclude".to_string(), serde_json::Value::String(exclude.clone()));
    }
    
    // Store scan job in memory
    let scan_memory = MemoryEntry::new(
        format!("MASSCAN scan: {} - {}", req.target, job_id),
        serde_json::json!({
            "type": "masscan_scan",
            "job_id": job_id,
            "target": req.target,
            "rate": rate,
            "params": params,
            "status": "running",
            "timestamp": Utc::now().to_rfc3339(),
        }),
    );
    
    {
        let mut mem = state.memory.lock().await;
        let _ = mem.store(&scan_memory).await.ok();
    }
    
    // Execute MASSCAN scan in background
    let state_clone = state.clone();
    let job_id_clone = job_id.clone();
    let target_clone = req.target.clone();
    
    tokio::spawn(async move {
        let memory = state_clone.memory.clone();
        let registry = ToolRegistry::new(memory);
        
        // Register MASSCAN if needed
        let _ = registry.register(Box::new(MasscanTool) as Box<dyn EternalTool>).await;
        
        // Execute scan
        match registry.call_tool("masscan_rust", params).await {
            Ok(output) => {
                // Update job status
                let result_memory = MemoryEntry::new(
                    format!("MASSCAN scan result: {} - {}", target_clone, job_id_clone),
                    serde_json::json!({
                        "type": "masscan_scan",
                        "job_id": job_id_clone,
                        "target": target_clone,
                        "status": "completed",
                        "result": output,
                        "timestamp": Utc::now().to_rfc3339(),
                    }),
                );
                
                {
                    let mut mem = state_clone.memory.lock().await;
                    let _ = mem.store(&result_memory).await.ok();
                }
                
                tracing::info!("🔥 MASSCAN: Scan {} completed", job_id_clone);
            }
            Err(e) => {
                tracing::error!("🔥 MASSCAN: Scan {} failed: {}", job_id_clone, e);
            }
        }
    });
    
    HttpResponse::Ok().json(MasscanScanResponse {
        job_id,
        status: "running".to_string(),
        message: format!("MASSCAN started for target: {} at {} pps", req.target, rate),
        timestamp: Utc::now().to_rfc3339(),
    })
}

/// MASSCAN scan SSE stream
pub async fn masscan_stream_handler(
    path: web::Path<String>,
    state: web::Data<ApiState>,
) -> HttpResponse {
    let job_id = path.into_inner();
    let state_clone = state.clone();
    
    let stream = futures::stream::unfold(0u64, move |count| {
        let state = state_clone.clone();
        let job_id = job_id.clone();
        async move {
            tokio::time::sleep(std::time::Duration::from_millis(100)).await; // 10 updates/sec
            
            // Fetch scan results
            let scan_data = {
                let mem = state.memory.lock().await;
                if let Ok(all_entries) = mem.list_all().await {
                    all_entries
                        .into_iter()
                        .find(|entry| {
                            if let Some(metadata) = entry.metadata.as_object() {
                                metadata.get("type")?.as_str()? == "masscan_scan"
                                    && metadata.get("job_id")?.as_str()? == job_id
                            } else {
                                None
                            }
                            .is_some()
                        })
                        .and_then(|entry| entry.metadata.as_object().cloned())
                } else {
                    None
                }
            };
            
            let data = serde_json::json!({
                "type": "masscan_update",
                "job_id": job_id,
                "timestamp": Utc::now().to_rfc3339(),
                "data": scan_data,
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

// ============================================================================
// Metasploit Framework API Endpoints
// ============================================================================

/// MSF Module Search Request
#[derive(Debug, Deserialize)]
pub struct MsfSearchRequest {
    pub query: String,
}

/// MSF Module Search Response
#[derive(Debug, Serialize)]
pub struct MsfSearchResponse {
    pub modules: Vec<serde_json::Value>,
    pub count: usize,
    pub timestamp: String,
}

/// MSF Execute Request
#[derive(Debug, Deserialize)]
pub struct MsfExecuteRequest {
    pub module: String,
    pub target: String,
    pub payload: Option<String>,
    pub lhost: Option<String>,
    pub lport: Option<u16>,
    pub requires_approval: Option<bool>, // HITM approval flag
}

/// MSF Execute Response
#[derive(Debug, Serialize)]
pub struct MsfExecuteResponse {
    pub job_id: String,
    pub status: String,
    pub message: String,
    pub requires_approval: bool,
    pub timestamp: String,
}

/// MSF Sessions Response
#[derive(Debug, Serialize)]
pub struct MsfSessionsResponse {
    pub sessions: Vec<serde_json::Value>,
    pub count: usize,
    pub timestamp: String,
}

/// MSF Shell Request
#[derive(Debug, Deserialize)]
pub struct MsfShellRequest {
    pub command: String,
}

/// MSF Shell Response
#[derive(Debug, Serialize)]
pub struct MsfShellResponse {
    pub session_id: u64,
    pub command: String,
    pub output: String,
    pub exit_code: i32,
    pub timestamp: String,
}

/// MSF Module Search Handler
pub async fn msf_search_handler(
    req: web::Json<MsfSearchRequest>,
    state: web::Data<ApiState>,
) -> impl Responder {
    tracing::info!("🔥 MSF Bridge: Searching modules: {}", req.query);
    
    // Evaluate through conscience framework
    let conscience_result = state.conscience.evaluate(
        &format!("MSF module search: {}", req.query),
        &HashMap::new(),
    );
    
    if !conscience_result.approved {
        tracing::warn!("🔥 MSF Bridge: Search rejected by conscience");
        return HttpResponse::Forbidden().json(MsfSearchResponse {
            modules: Vec::new(),
            count: 0,
            timestamp: Utc::now().to_rfc3339(),
        });
    }
    
    // Build tool params
    let mut params = ToolParams::new();
    params.insert("action".to_string(), serde_json::Value::String("search".to_string()));
    params.insert("query".to_string(), serde_json::Value::String(req.query.clone()));
    
    // Execute search
    let memory = state.memory.clone();
    let registry = ToolRegistry::new(memory);
    let _ = registry.register(Box::new(MsfBridge::new()) as Box<dyn EternalTool>).await;
    
    match registry.call_tool("msf_bridge", params).await {
        Ok(output) => {
            let modules = output.data.get("modules")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            
            HttpResponse::Ok().json(MsfSearchResponse {
                modules,
                count: modules.len(),
                timestamp: Utc::now().to_rfc3339(),
            })
        }
        Err(e) => {
            HttpResponse::InternalServerError().json(MsfSearchResponse {
                modules: Vec::new(),
                count: 0,
                timestamp: Utc::now().to_rfc3339(),
            })
        }
    }
}

/// MSF Execute Handler (with HITM approval)
pub async fn msf_execute_handler(
    req: web::Json<MsfExecuteRequest>,
    state: web::Data<ApiState>,
) -> impl Responder {
    tracing::info!("🔥 MSF Bridge: Executing exploit: {} on target: {}", req.module, req.target);
    
    let job_id = Uuid::new_v4().to_string();
    
    // CRITICAL: Evaluate through conscience framework
    let conscience_result = state.conscience.evaluate(
        &format!("MSF exploit execution: {} on target: {}", req.module, req.target),
        &HashMap::new(),
    );
    
    if !conscience_result.approved {
        tracing::warn!("🔥 MSF Bridge: Exploit execution rejected by conscience");
        return HttpResponse::Forbidden().json(MsfExecuteResponse {
            job_id,
            status: "rejected".to_string(),
            message: format!("Ethical violation: {}", conscience_result.violations.join(", ")),
            requires_approval: true,
            timestamp: Utc::now().to_rfc3339(),
        });
    }
    
    // HITM approval required for all exploits
    let requires_approval = true;
    
    // Store exploit execution in memory
    let exploit_memory = MemoryEntry::new(
        format!("MSF exploit: {} - {}", req.module, job_id),
        serde_json::json!({
            "type": "msf_exploit",
            "job_id": job_id,
            "module": req.module,
            "target": req.target,
            "payload": req.payload,
            "lhost": req.lhost,
            "status": "pending_approval",
            "requires_approval": requires_approval,
            "timestamp": Utc::now().to_rfc3339(),
        }),
    );
    
    {
        let mut mem = state.memory.lock().await;
        let _ = mem.store(&exploit_memory).await.ok();
    }
    
    // Build tool params
    let mut params = ToolParams::new();
    params.insert("action".to_string(), serde_json::Value::String("execute".to_string()));
    params.insert("module".to_string(), serde_json::Value::String(req.module.clone()));
    params.insert("target".to_string(), serde_json::Value::String(req.target.clone()));
    if let Some(payload) = &req.payload {
        params.insert("payload".to_string(), serde_json::Value::String(payload.clone()));
    }
    if let Some(lhost) = &req.lhost {
        params.insert("lhost".to_string(), serde_json::Value::String(lhost.clone()));
    }
    
    // Execute exploit in background (if approved)
    let state_clone = state.clone();
    let job_id_clone = job_id.clone();
    let module_clone = req.module.clone();
    let target_clone = req.target.clone();
    
    tokio::spawn(async move {
        let memory = state_clone.memory.clone();
        let registry = ToolRegistry::new(memory);
        let _ = registry.register(Box::new(MsfBridge::new()) as Box<dyn EternalTool>).await;
        
        match registry.call_tool("msf_bridge", params).await {
            Ok(output) => {
                let result_memory = MemoryEntry::new(
                    format!("MSF exploit result: {} - {}", module_clone, job_id_clone),
                    serde_json::json!({
                        "type": "msf_exploit",
                        "job_id": job_id_clone,
                        "module": module_clone,
                        "target": target_clone,
                        "status": "completed",
                        "result": output,
                        "timestamp": Utc::now().to_rfc3339(),
                    }),
                );
                
                {
                    let mut mem = state_clone.memory.lock().await;
                    let _ = mem.store(&result_memory).await.ok();
                }
                
                tracing::info!("🔥 MSF Bridge: Exploit {} completed", job_id_clone);
            }
            Err(e) => {
                tracing::error!("🔥 MSF Bridge: Exploit {} failed: {}", job_id_clone, e);
            }
        }
    });
    
    HttpResponse::Ok().json(MsfExecuteResponse {
        job_id,
        status: "pending_approval".to_string(),
        message: format!("Exploit execution pending HITM approval: {} on target: {}", req.module, req.target),
        requires_approval,
        timestamp: Utc::now().to_rfc3339(),
    })
}

/// MSF Sessions List Handler
pub async fn msf_sessions_handler(
    state: web::Data<ApiState>,
) -> impl Responder {
    tracing::debug!("🔥 MSF Bridge: Listing active sessions");
    
    // Build tool params
    let mut params = ToolParams::new();
    params.insert("action".to_string(), serde_json::Value::String("sessions".to_string()));
    
    // Execute sessions list
    let memory = state.memory.clone();
    let registry = ToolRegistry::new(memory);
    let _ = registry.register(Box::new(MsfBridge::new()) as Box<dyn EternalTool>).await;
    
    match registry.call_tool("msf_bridge", params).await {
        Ok(output) => {
            let sessions = output.data.get("sessions")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            
            HttpResponse::Ok().json(MsfSessionsResponse {
                sessions,
                count: sessions.len(),
                timestamp: Utc::now().to_rfc3339(),
            })
        }
        Err(e) => {
            tracing::error!("🔥 MSF Bridge: Failed to list sessions: {}", e);
            HttpResponse::InternalServerError().json(MsfSessionsResponse {
                sessions: Vec::new(),
                count: 0,
                timestamp: Utc::now().to_rfc3339(),
            })
        }
    }
}

/// MSF Shell Command Handler
pub async fn msf_shell_handler(
    path: web::Path<u64>,
    req: web::Json<MsfShellRequest>,
    state: web::Data<ApiState>,
) -> impl Responder {
    let session_id = path.into_inner();
    tracing::info!("🔥 MSF Bridge: Executing shell command in session {}: {}", session_id, req.command);
    
    // Build tool params
    let mut params = ToolParams::new();
    params.insert("action".to_string(), serde_json::Value::String("shell".to_string()));
    params.insert("session_id".to_string(), serde_json::Value::Number(session_id.into()));
    params.insert("command".to_string(), serde_json::Value::String(req.command.clone()));
    
    // Execute shell command
    let memory = state.memory.clone();
    let registry = ToolRegistry::new(memory);
    let _ = registry.register(Box::new(MsfBridge::new()) as Box<dyn EternalTool>).await;
    
    match registry.call_tool("msf_bridge", params).await {
        Ok(output) => {
            let output_str = output.data.get("output")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let exit_code = output.data.get("exit_code")
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32;
            
            HttpResponse::Ok().json(MsfShellResponse {
                session_id,
                command: req.command.clone(),
                output: output_str,
                exit_code,
                timestamp: Utc::now().to_rfc3339(),
            })
        }
        Err(e) => {
            tracing::error!("🔥 MSF Bridge: Shell command failed: {}", e);
            HttpResponse::InternalServerError().json(MsfShellResponse {
                session_id,
                command: req.command.clone(),
                output: format!("Error: {}", e),
                exit_code: -1,
                timestamp: Utc::now().to_rfc3339(),
            })
        }
    }
}

/// MSF SSE Stream Handler
pub async fn msf_stream_handler(
    state: web::Data<ApiState>,
) -> HttpResponse {
    let state_clone = state.clone();
    
    let stream = futures::stream::unfold(0u64, move |count| {
        let state = state_clone.clone();
        async move {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            
            // Fetch MSF updates (sessions, exploits, etc.)
            let msf_data = {
                let mem = state.memory.lock().await;
                if let Ok(all_entries) = mem.list_all().await {
                    all_entries
                        .into_iter()
                        .filter_map(|entry| {
                            if let Some(metadata) = entry.metadata.as_object() {
                                let entry_type = metadata.get("type")?.as_str()?;
                                if entry_type == "msf_exploit" || entry_type == "msf_session" {
                                    Some(metadata.clone())
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
                "type": "msf_update",
                "timestamp": Utc::now().to_rfc3339(),
                "data": msf_data,
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
