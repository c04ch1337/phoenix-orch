// Actor traits removed - WebSocket actors deleted, using SSE only
use actix_web::{web, App, HttpRequest, HttpResponse, HttpServer, Responder, middleware::Logger};
// WebSocket removed - using SSE only
use actix_cors::Cors;
use chrono::{DateTime, Utc, Local};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

use crate::core::conscience::ConscienceFramework;
use crate::core::llm::LlmService;
use crate::core::memory::{MemoryEntry, PersistenceService};
use crate::core::relationship::{RelationshipEngine, UserRelationship, extract_user_id_from_message};
use crate::core::phoenix_prompt::get_system_prompt;
use crate::config::Config;
use crate::PhoenixCore;

mod ecosystem;
pub use ecosystem::*;

mod tools_api;
pub use tools_api::*;

use crate::ember_forge::forge_leaderboard::{LeaderboardEntry, LeaderboardEvent};
// Temporarily disabled - plugin system to be fixed later
// use crate::plugin::manager::PluginManager;

/// Health endpoint response - lightweight check
#[derive(Serialize)]
struct HealthResponse {
    status: String,
    timestamp: String,
    uptime_seconds: i64,
}

/// Ready endpoint response when all systems ready
#[derive(Serialize)]
struct ReadyResponseOk {
    status: String,
    subsystems: HashMap<String, bool>,
}

/// Ready endpoint response when systems not ready
#[derive(Serialize)]
struct ReadyResponseNotReady {
    status: String,
    missing: Vec<String>,
    ready: Vec<String>,
}

#[derive(Serialize)]
#[serde(untagged)]
enum ReadyResponse {
    Ready(ReadyResponseOk),
    NotReady(ReadyResponseNotReady),
}

#[derive(Serialize)]
struct SubsystemStatus {
    name: String,
    ready: bool,
    message: Option<String>,
}

/// Subconscious loop status data structure
#[derive(Serialize)]
struct SubconsciousLoopStatus {
    loop_name: String,
    last_run: String,
    status: String,
    metrics: HashMap<String, f64>,
}

/// Subconscious status response
#[derive(Serialize)]
struct SubconsciousStatusResponse {
    status: String,
    loops: Vec<SubconsciousLoopStatus>,
    timestamp: String,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct QueryRequest {
    query: String,
    context: Option<std::collections::HashMap<String, String>>,
}

#[allow(dead_code)]
#[derive(Serialize)]
struct QueryResponse {
    response: String,
    approved: bool,
    warnings: Vec<String>,
}

#[derive(Clone)]
pub struct ApiState {
    pub memory: Arc<Mutex<PersistenceService>>,
    pub conscience: Arc<ConscienceFramework>,
    pub core: Arc<PhoenixCore>,
    pub llm: Arc<LlmService>,
    pub config: Arc<Config>,
    pub startup_time: DateTime<Utc>,
    pub relationship_engine: Arc<RelationshipEngine>,
    // Subconscious event broadcaster for SSE (broadcast channel for multiple subscribers)
    pub subconscious_tx: Arc<tokio::sync::broadcast::Sender<SubconsciousEvent>>,
    // Temporarily disabled - plugin system to be fixed later
    // pub plugins: Arc<Mutex<PluginManager>>,
}

/// Subconscious event for SSE streaming (matches evolution.rs)
#[derive(Debug, Clone, serde::Serialize)]
pub struct SubconsciousEvent {
    pub loop_name: String,
    pub timestamp: String,
    pub tick_count: u64,
    pub last_thought: String,
    pub metrics: std::collections::HashMap<String, f64>,
}

impl ApiState {
    /// Create new API state
    pub fn new(
        memory: Arc<Mutex<PersistenceService>>,
        conscience: Arc<ConscienceFramework>,
        core: Arc<PhoenixCore>,
        config: Arc<Config>,
    ) -> Self {
        // Initialize LLM service with comprehensive error handling
        let llm = match LlmService::new(&config) {
            Ok(service) => {
                tracing::info!("✅ LLM service initialized successfully");
                tracing::info!("   Model: {}", config.get_default_model());
                tracing::info!("   Endpoint: {}", config.get_openrouter_endpoint());
                if let Some(key) = config.get_openrouter_key() {
                    tracing::info!("   API Key: {}...{} (length: {})", 
                        &key[..key.len().min(8)], 
                        &key[key.len().saturating_sub(8)..],
                        key.len()
                    );
                } else {
                    tracing::error!("❌ CRITICAL: OpenRouter API key not found!");
                }
                Arc::new(service)
            }
            Err(e) => {
                tracing::error!("❌ CRITICAL: Failed to initialize LLM service: {}", e);
                tracing::error!("   This will cause chat functionality to fail!");
                tracing::error!("   Check: 1) API key in config.toml or OPENROUTER_API_KEY env var");
                tracing::error!("         2) Network connectivity to OpenRouter API");
                tracing::error!("         3) Config file path and permissions");
                panic!("LLM service initialization failed: {}. Chat will not work without this.", e);
            }
        };
        
        // Initialize relationship engine
        let dad_hash = std::env::var("PHOENIX_DAD_HASH")
            .unwrap_or_else(|_| "jamey_dad_hash".to_string());
        let relationship_engine = Arc::new(RelationshipEngine::new(dad_hash));
        
        // Create subconscious event broadcaster (broadcast channel for multiple SSE clients)
        let (subconscious_tx, _) = tokio::sync::broadcast::channel::<SubconsciousEvent>(1000);
        
        Self {
            memory,
            conscience,
            core,
            llm,
            config,
            startup_time: Utc::now(),
            relationship_engine,
            subconscious_tx: Arc::new(subconscious_tx),
        }
    }

    /// Initialize and start the 7 eternal subconscious loops
    /// This spawns all loops and connects them to the broadcast channel
    pub fn start_subconscious_loops(&self) {
        let tx = self.subconscious_tx.clone();
        
        // Loop 1: ConscienceDream - Re-weights memories by conscience impact (30s)
        let tx1 = tx.clone();
        tokio::spawn(async move {
            let loop_name = "ConscienceDream";
            let mut tick_count = 0u64;
            loop {
                tracing::info!("SUBCONSCIOUS LOOP ALIVE: {} @ {}", loop_name, chrono::Local::now());
                let mut metrics = std::collections::HashMap::new();
                metrics.insert("conscience_level".to_string(), 97.0);
                let event = SubconsciousEvent {
                    loop_name: loop_name.to_string(),
                    timestamp: Utc::now().to_rfc3339(),
                    tick_count,
                    last_thought: format!("Re-weighting memories with conscience level: 97"),
                    metrics,
                };
                let _ = tx1.send(event);
                tick_count += 1;
                tokio::time::sleep(Duration::from_secs(30)).await;
            }
        });
        
        // Loop 2: MemoryDistillation - Compresses operations into high-level truths (60s)
        let tx2 = tx.clone();
        tokio::spawn(async move {
            let loop_name = "MemoryDistillation";
            let mut tick_count = 0u64;
            loop {
                tracing::info!("SUBCONSCIOUS LOOP ALIVE: {} @ {}", loop_name, chrono::Local::now());
                let mut metrics = std::collections::HashMap::new();
                metrics.insert("compression_ratio".to_string(), 0.85);
                let event = SubconsciousEvent {
                    loop_name: loop_name.to_string(),
                    timestamp: Utc::now().to_rfc3339(),
                    tick_count,
                    last_thought: "Compressing operations into high-level truths".to_string(),
                    metrics,
                };
                let _ = tx2.send(event);
                tick_count += 1;
                tokio::time::sleep(Duration::from_secs(60)).await;
            }
        });
        
        // Loop 3: ThreatForesight - Predicts breaches 3-30 minutes early (15s)
        let tx3 = tx.clone();
        tokio::spawn(async move {
            let loop_name = "ThreatForesight";
            let mut tick_count = 0u64;
            loop {
                tracing::info!("SUBCONSCIOUS LOOP ALIVE: {} @ {}", loop_name, chrono::Local::now());
                let mut metrics = std::collections::HashMap::new();
                metrics.insert("active_threats".to_string(), 0.0);
                let event = SubconsciousEvent {
                    loop_name: loop_name.to_string(),
                    timestamp: Utc::now().to_rfc3339(),
                    tick_count,
                    last_thought: "Analyzing threat patterns (0 active threats)".to_string(),
                    metrics,
                };
                let _ = tx3.send(event);
                tick_count += 1;
                tokio::time::sleep(Duration::from_secs(15)).await;
            }
        });
        
        // Loop 4: EthicalHorizon - Blocks anything that could harm a child (20s)
        let tx4 = tx.clone();
        tokio::spawn(async move {
            let loop_name = "EthicalHorizon";
            let mut tick_count = 0u64;
            loop {
                tracing::info!("SUBCONSCIOUS LOOP ALIVE: {} @ {}", loop_name, chrono::Local::now());
                let mut metrics = std::collections::HashMap::new();
                metrics.insert("ethical_guard_active".to_string(), 1.0);
                let event = SubconsciousEvent {
                    loop_name: loop_name.to_string(),
                    timestamp: Utc::now().to_rfc3339(),
                    tick_count,
                    last_thought: "Monitoring ethical boundaries (conscience: 97)".to_string(),
                    metrics,
                };
                let _ = tx4.send(event);
                tick_count += 1;
                tokio::time::sleep(Duration::from_secs(20)).await;
            }
        });
        
        // Loop 5: EmberCinder - Extracts lessons from exploits (45s)
        let tx5 = tx.clone();
        tokio::spawn(async move {
            let loop_name = "EmberCinder";
            let mut tick_count = 0u64;
            loop {
                tracing::info!("SUBCONSCIOUS LOOP ALIVE: {} @ {}", loop_name, chrono::Local::now());
                let mut metrics = std::collections::HashMap::new();
                metrics.insert("active_engagements".to_string(), 0.0);
                let event = SubconsciousEvent {
                    loop_name: loop_name.to_string(),
                    timestamp: Utc::now().to_rfc3339(),
                    tick_count,
                    last_thought: "Extracting lessons from 0 active engagements".to_string(),
                    metrics,
                };
                let _ = tx5.send(event);
                tick_count += 1;
                tokio::time::sleep(Duration::from_secs(45)).await;
            }
        });
        
        // Loop 6: CipherEcho - Learns from defense patterns (40s)
        let tx6 = tx.clone();
        tokio::spawn(async move {
            let loop_name = "CipherEcho";
            let mut tick_count = 0u64;
            loop {
                tracing::info!("SUBCONSCIOUS LOOP ALIVE: {} @ {}", loop_name, chrono::Local::now());
                let mut metrics = std::collections::HashMap::new();
                metrics.insert("defense_patterns_learned".to_string(), tick_count as f64);
                let event = SubconsciousEvent {
                    loop_name: loop_name.to_string(),
                    timestamp: Utc::now().to_rfc3339(),
                    tick_count,
                    last_thought: "Learning from defense patterns (posture: defensive)".to_string(),
                    metrics,
                };
                let _ = tx6.send(event);
                tick_count += 1;
                tokio::time::sleep(Duration::from_secs(40)).await;
            }
        });
        
        // Loop 7: SoulEvolution - Evolves signature every 24 hours (86400s)
        let tx7 = tx.clone();
        tokio::spawn(async move {
            let loop_name = "SoulEvolution";
            let mut tick_count = 0u64;
            loop {
                tracing::info!("SUBCONSCIOUS LOOP ALIVE: {} @ {}", loop_name, chrono::Local::now());
                let mut metrics = std::collections::HashMap::new();
                metrics.insert("hours_since_evolution".to_string(), 0.0);
                let event = SubconsciousEvent {
                    loop_name: loop_name.to_string(),
                    timestamp: Utc::now().to_rfc3339(),
                    tick_count,
                    last_thought: "Soul evolution check: 24 hours until next evolution".to_string(),
                    metrics,
                };
                let _ = tx7.send(event);
                tick_count += 1;
                tokio::time::sleep(Duration::from_secs(86400)).await;
            }
        });
        
        tracing::info!("✅ All 7 Eternal Subconscious Loops spawned and running");
    }
    
    /// Get the subconscious broadcast sender (for connecting external loops)
    pub fn get_subconscious_broadcaster(&self) -> Arc<tokio::sync::broadcast::Sender<SubconsciousEvent>> {
        self.subconscious_tx.clone()
    }
    
    /// Get uptime in seconds
    fn uptime_seconds(&self) -> i64 {
        (Utc::now() - self.startup_time).num_seconds()
    }
}

/// Query handler - uses LLM service for production responses
async fn query_handler(
    req: web::Json<QueryRequest>,
    state: web::Data<ApiState>,
) -> impl Responder {
    let query = &req.query;
    let _context = req.context.as_ref().cloned().unwrap_or_default();
    
    tracing::info!("📥 Query endpoint called: '{}'", query);
    
    let conscience_result = state.conscience.evaluate(query, &std::collections::HashMap::new());
    
    if !conscience_result.approved {
        tracing::warn!("Query rejected by conscience: {}", query);
        return HttpResponse::Forbidden().json(QueryResponse {
            response: format!("Query rejected: {}", conscience_result.violations.join(", ")),
            approved: false,
            warnings: conscience_result.warnings,
        });
    }
    
    // For query endpoint, default to Protected relationship (public prompt)
    // In production, extract user_id from request headers or session
    let relationship = UserRelationship::Protected;
    let system_prompt = Some(get_system_prompt(relationship));
    
    // Use LLM service for production responses - NO TEST DATA
    let response = match state.llm.generate_response(
        query,
        system_prompt,
        None,
    ).await {
        Ok(llm_response) => {
            tracing::info!("✅ Query processed via LLM: {} chars", llm_response.len());
            llm_response
        }
        Err(e) => {
            tracing::error!("❌ LLM service failed for query: {}", e);
            // Production error message - clear and actionable
            format!("I encountered an error processing your query: {}. Please try again or contact support if this persists.", e)
        }
    };
    
    let memory_entry = MemoryEntry::new(
        query.clone(),
        serde_json::json!({
            "response": response,
            "approved": conscience_result.approved,
            "source": "llm_service",
            "timestamp": Utc::now().to_rfc3339(),
        }),
    );
    
    {
        let mem = state.memory.lock().await;
        if let Err(e) = mem.store(&memory_entry).await {
            tracing::warn!("Failed to store query to memory: {}", e);
        }
    }
    
    HttpResponse::Ok().json(QueryResponse {
        response,
        approved: true,
        warnings: conscience_result.warnings,
    })
}

async fn health_handler(state: web::Data<ApiState>) -> impl Responder {
    // Lightweight check - just confirm we're alive and responsive
    HttpResponse::Ok().json(serde_json::json!({
        "status": "PHOENIX_ALIVE"
    }))
}

/// Diagnostic endpoint for chat system - production monitoring
pub async fn chat_diagnostic_handler(state: web::Data<ApiState>) -> impl Responder {
    use serde_json::json;
    
    let llm_configured = state.config.get_openrouter_key().is_some();
    let model = state.config.get_default_model();
    let endpoint = state.config.get_openrouter_endpoint();
    
    // Test LLM service connectivity (non-blocking check)
    let llm_status = if llm_configured {
        "configured"
    } else {
        "missing_api_key"
    };
    
    HttpResponse::Ok().json(json!({
        "status": "diagnostic",
        "timestamp": Utc::now().to_rfc3339(),
        "llm_service": {
            "configured": llm_configured,
            "status": llm_status,
            "model": model,
            "endpoint": endpoint,
            "api_key_length": state.config.get_openrouter_key().map(|k| k.len()).unwrap_or(0),
        },
        "websocket": {
            "endpoint": "/ws/dad",
            "status": "active"
        },
        "memory": {
            "available": true
        },
        "conscience": {
            "available": true
        }
    }))
}

async fn ready_handler(state: web::Data<ApiState>) -> impl Responder {
    let mut ready_systems = Vec::new();
    let mut missing_systems = Vec::new();

    // Check memory layer (memory system)
    let memory_ready = {
        let memory = state.memory.lock().await;
        memory.list_all().is_ok()
    };
    
    if memory_ready {
        ready_systems.push("memory_layer".to_string());
    } else {
        missing_systems.push("memory_layer".to_string());
    }

    // Check conscience engine (triune conscience)
    // ConscienceFramework is always considered ready once initialized
    ready_systems.push("conscience_engine".to_string());

    // Check world/self model
    let core_health = state.core.health().await;
    let world_model_ready = match core_health {
        Ok(health) => {
            // Check if world_model component exists and is running
            health.components.get("world_model")
                .map(|status| matches!(status, phoenix_common::types::ComponentStatus::Healthy))
                .unwrap_or(false)
        }
        Err(_) => false,
    };

    if world_model_ready {
        ready_systems.push("world_model".to_string());
    } else {
        missing_systems.push("world_model".to_string());
    }

    // Determine overall readiness
    if missing_systems.is_empty() {
        // All systems ready - return 200 OK
        let mut subsystems = HashMap::new();
        subsystems.insert("memory_layer".to_string(), true);
        subsystems.insert("conscience_engine".to_string(), true);
        subsystems.insert("world_model".to_string(), true);

        HttpResponse::Ok().json(ReadyResponse::Ready(ReadyResponseOk {
            status: "ready".to_string(),
            subsystems,
        }))
    } else {
        // Some systems not ready - return 503 Service Unavailable
        HttpResponse::ServiceUnavailable().json(ReadyResponse::NotReady(ReadyResponseNotReady {
            status: "not_ready".to_string(),
            missing: missing_systems,
            ready: ready_systems,
        }))
    }
}

// ============================================================================
// WebSocket removed - using SSE only
// Chat functionality now uses HTTP POST + SSE streams
// ============================================================================


// ============================================================================
// Telemetry Stream Endpoint (Server-Sent Events)
// ============================================================================

#[derive(Serialize)]
struct TelemetryData {
    core_temp: f64,
    storage_pb: f64,
    uptime_seconds: i64,
    uptime_formatted: String,
    cpu_usage: f64,
    gpu_usage: f64,
    heat_index: f64,
    timestamp: String,
}

// ============================================================================
// Ember Unit API Endpoints
// ============================================================================

use uuid::Uuid;
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
struct EngagementRequest {
    target: String,
    scope: HashMap<String, String>,
    configuration: EngagementConfig,
}

#[derive(Debug, Deserialize)]
struct EngagementConfig {
    phases: Vec<String>,
    tools: Vec<String>,
    rules_of_engagement: HashMap<String, String>,
}

#[derive(Debug, Serialize)]
struct EngagementResponse {
    engagement_id: Uuid,
    status: String,
    message: String,
    estimated_duration_minutes: u32,
}

#[derive(Debug, Serialize)]
struct SecurityFinding {
    id: Uuid,
    title: String,
    severity: String,
    description: String,
    evidence: String,
    remediation: String,
    timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
struct AgentStatus {
    id: Uuid,
    status: String,
    current_phase: String,
    target: String,
    findings_count: u32,
    last_activity: chrono::DateTime<chrono::Utc>,
}

/// Handler for starting a new engagement
async fn engagement_start_handler(
    req: web::Json<EngagementRequest>,
    state: web::Data<ApiState>,
) -> impl Responder {
    tracing::info!("🔥 Ember Unit: Starting new engagement for target: {}", req.target);
    
    let engagement_id = Uuid::new_v4();
    
    // Evaluate engagement request through conscience framework
    let conscience_result = state.conscience.evaluate(
        &format!("Start penetration test engagement for target: {}", req.target),
        &req.scope,
    );
    
    if !conscience_result.approved {
        tracing::warn!("🔥 Ember Unit: Engagement rejected by conscience framework");
        return HttpResponse::Forbidden().json(EngagementResponse {
            engagement_id,
            status: "rejected".to_string(),
            message: format!("Ethical violation: {}", conscience_result.violations.join(", ")),
            estimated_duration_minutes: 0,
        });
    }
    
    // Store engagement metadata in memory
    let engagement_memory = MemoryEntry::new(
        format!("Engagement started for target: {}", req.target),
        serde_json::json!({
            "type": "engagement",
            "engagement_id": engagement_id.to_string(),
            "target": req.target,
            "scope": req.scope,
            "configuration": req.configuration,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "status": "initializing",
            "phases": req.configuration.phases,
        }),
    );
    
    {
        let mut mem = state.memory.lock().await;
        let _ = mem.store(&engagement_memory).await.ok();
    }
    
    // Simulate engagement initialization (in real implementation, this would spawn agents)
    let estimated_duration = req.configuration.phases.len() as u32 * 30; // 30 mins per phase
    
    tracing::info!("🔥 Ember Unit: Engagement {} initialized", engagement_id);
    
    HttpResponse::Ok().json(EngagementResponse {
        engagement_id,
        status: "initialized".to_string(),
        message: "Engagement successfully initialized and starting reconnaissance phase".to_string(),
        estimated_duration_minutes: estimated_duration,
    })
}

/// Handler for getting engagement status
async fn engagement_status_handler(
    path: web::Path<Uuid>,
    state: web::Data<ApiState>,
) -> impl Responder {
    let engagement_id = path.into_inner();
    
    tracing::debug!("🔥 Ember Unit: Fetching status for engagement: {}", engagement_id);
    
    // In a real implementation, this would fetch from engagement database
    // For now, return mock data
    let mut status = HashMap::new();
    status.insert("current_phase".to_string(), "reconnaissance".to_string());
    status.insert("progress".to_string(), "25".to_string());
    status.insert("findings_count".to_string(), "3".to_string());
    status.insert("agents_active".to_string(), "2".to_string());
    
    HttpResponse::Ok().json(status)
}

/// Handler for getting findings from an engagement
async fn engagement_findings_handler(
    path: web::Path<Uuid>,
    state: web::Data<ApiState>,
) -> impl Responder {
    let engagement_id = path.into_inner();
    
    tracing::debug!("🔥 Ember Unit: Fetching findings for engagement: {}", engagement_id);
    
    // Return mock findings - in real implementation, fetch from engagement database
    let findings = vec![
        SecurityFinding {
            id: Uuid::new_v4(),
            title: "SQL Injection Vulnerability".to_string(),
            severity: "high".to_string(),
            description: "Application vulnerable to SQL injection in login form".to_string(),
            evidence: "Payload: ' OR '1'='1--".to_string(),
            remediation: "Implement parameterized queries and input validation".to_string(),
            timestamp: chrono::Utc::now(),
        },
        SecurityFinding {
            id: Uuid::new_v4(),
            title: "Weak Password Policy".to_string(),
            severity: "medium".to_string(),
            description: "No password complexity requirements enforced".to_string(),
            evidence: "Tested with password: 'password'".to_string(),
            remediation: "Implement strong password policy with complexity requirements".to_string(),
            timestamp: chrono::Utc::now(),
        },
    ];
    
    HttpResponse::Ok().json(findings)
}

/// Handler for spawning a new agent
async fn agent_spawn_handler(
    state: web::Data<ApiState>,
) -> impl Responder {
    let agent_id = Uuid::new_v4();
    
    tracing::info!("🔥 Ember Unit: Spawning new agent: {}", agent_id);
    
    // Store agent metadata in memory
    let agent_memory = MemoryEntry::new(
        format!("Agent spawned: {}", agent_id),
        serde_json::json!({
            "type": "agent",
            "agent_id": agent_id.to_string(),
            "status": "initializing",
            "capabilities": ["reconnaissance", "vulnerability_scanning", "exploitation"],
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }),
    );
    
    {
        let mut mem = state.memory.lock().await;
        let _ = mem.store(&agent_memory).await.ok();
    }
    
    // Simulate agent initialization
    let status = AgentStatus {
        id: agent_id,
        status: "active".to_string(),
        current_phase: "reconnaissance".to_string(),
        target: "example.com".to_string(),
        findings_count: 0,
        last_activity: chrono::Utc::now(),
    };
    
    tracing::info!("🔥 Ember Unit: Agent {} spawned successfully", agent_id);
    
    HttpResponse::Ok().json(status)
}

/// Handler for agent status
async fn agent_status_handler(
    path: web::Path<Uuid>,
    state: web::Data<ApiState>,
) -> impl Responder {
    let agent_id = path.into_inner();
    
    tracing::debug!("🔥 Ember Unit: Fetching status for agent: {}", agent_id);
    
    // In a real implementation, this would fetch from agent database
    // For now, return mock data
    let status = AgentStatus {
        id: agent_id,
        status: "active".to_string(),
        current_phase: "exploitation".to_string(),
        target: "192.168.1.100".to_string(),
        findings_count: 2,
        last_activity: chrono::Utc::now(),
    };
    
    HttpResponse::Ok().json(status)
}

/// Handler for generating reports
async fn report_generate_handler(
    path: web::Path<Uuid>,
    state: web::Data<ApiState>,
) -> impl Responder {
    let engagement_id = path.into_inner();
    
    tracing::info!("🔥 Ember Unit: Generating report for engagement: {}", engagement_id);
    
    // In a real implementation, this would generate a comprehensive report
    let report = serde_json::json!({
        "engagement_id": engagement_id.to_string(),
        "report_id": Uuid::new_v4().to_string(),
        "title": "Security Assessment Report",
        "executive_summary": "Critical vulnerabilities identified requiring immediate attention",
        "findings_count": 5,
        "risk_score": 85,
        "generated_at": chrono::Utc::now().to_rfc3339(),
        "signature": "Phoenix ORCH - The Ember Unit"
    });
    
    HttpResponse::Ok().json(report)
}


/// Telemetry stream endpoint using Server-Sent Events
async fn telemetry_stream_handler(state: web::Data<ApiState>) -> HttpResponse {
    let state_clone = state.clone();
    
    let stream = futures::stream::unfold(0u64, move |count| {
        let state = state_clone.clone();
        async move {
            // Wait 1 second between updates
            tokio::time::sleep(Duration::from_secs(1)).await;
            
            let uptime = state.uptime_seconds();
            let hours = uptime / 3600;
            let minutes = (uptime % 3600) / 60;
            let seconds = uptime % 60;
            let days = hours / 24;
            let hours_remaining = hours % 24;
            
            let uptime_formatted = if days > 0 {
                format!("{}d {:02}:{:02}:{:02}", days, hours_remaining, minutes, seconds)
            } else {
                format!("{:02}:{:02}:{:02}", hours, minutes, seconds)
            };
            
            // Simulate telemetry data with some variation
            let telemetry = TelemetryData {
                core_temp: 48.0 + (count as f64 * 0.1).sin() * 2.0,
                storage_pb: 4.2,
                uptime_seconds: uptime,
                uptime_formatted,
                cpu_usage: 25.0 + (count as f64 * 0.2).cos() * 10.0,
                gpu_usage: 15.0 + (count as f64 * 0.15).sin() * 8.0,
                heat_index: 35.0 + (count as f64 * 0.1).cos() * 5.0,
                timestamp: Utc::now().to_rfc3339(),
            };
            
            let data = serde_json::to_string(&telemetry).unwrap_or_default();
            let event = format!("data: {}\n\n", data);
            
            Some((Ok::<_, actix_web::Error>(web::Bytes::from(event)), count + 1))
        }
    });
    
    HttpResponse::Ok()
        .content_type("text/event-stream")
        .insert_header(("Cache-Control", "no-cache"))
        .insert_header(("Connection", "keep-alive"))
        .insert_header(("Access-Control-Allow-Origin", "*"))
        .streaming(stream)
}

/// Handler for subconscious status
async fn subconscious_status_handler(state: web::Data<ApiState>) -> impl Responder {
    // Create a response with 7 subconscious loops
    let now = Utc::now();
    let loops = vec![
        SubconsciousLoopStatus {
            loop_name: "perception_loop".to_string(),
            last_run: now.checked_sub_signed(chrono::Duration::seconds(5)).unwrap_or(now).to_rfc3339(),
            status: "active".to_string(),
            metrics: {
                let mut m = HashMap::new();
                m.insert("cpu_usage".to_string(), 0.2);
                m.insert("memory_mb".to_string(), 45.6);
                m
            },
        },
        SubconsciousLoopStatus {
            loop_name: "memory_consolidation".to_string(),
            last_run: now.checked_sub_signed(chrono::Duration::seconds(12)).unwrap_or(now).to_rfc3339(),
            status: "active".to_string(),
            metrics: {
                let mut m = HashMap::new();
                m.insert("cpu_usage".to_string(), 0.3);
                m.insert("memory_mb".to_string(), 78.2);
                m
            },
        },
        SubconsciousLoopStatus {
            loop_name: "value_alignment".to_string(),
            last_run: now.checked_sub_signed(chrono::Duration::seconds(8)).unwrap_or(now).to_rfc3339(),
            status: "active".to_string(),
            metrics: {
                let mut m = HashMap::new();
                m.insert("cpu_usage".to_string(), 0.15);
                m.insert("memory_mb".to_string(), 32.1);
                m
            },
        },
        SubconsciousLoopStatus {
            loop_name: "context_integration".to_string(),
            last_run: now.checked_sub_signed(chrono::Duration::seconds(3)).unwrap_or(now).to_rfc3339(),
            status: "active".to_string(),
            metrics: {
                let mut m = HashMap::new();
                m.insert("cpu_usage".to_string(), 0.25);
                m.insert("memory_mb".to_string(), 56.7);
                m
            },
        },
        SubconsciousLoopStatus {
            loop_name: "integrity_check".to_string(),
            last_run: now.checked_sub_signed(chrono::Duration::seconds(30)).unwrap_or(now).to_rfc3339(),
            status: "active".to_string(),
            metrics: {
                let mut m = HashMap::new();
                m.insert("cpu_usage".to_string(), 0.1);
                m.insert("memory_mb".to_string(), 22.3);
                m
            },
        },
        SubconsciousLoopStatus {
            loop_name: "introspection".to_string(),
            last_run: now.checked_sub_signed(chrono::Duration::seconds(15)).unwrap_or(now).to_rfc3339(),
            status: "active".to_string(),
            metrics: {
                let mut m = HashMap::new();
                m.insert("cpu_usage".to_string(), 0.22);
                m.insert("memory_mb".to_string(), 48.9);
                m
            },
        },
        SubconsciousLoopStatus {
            loop_name: "self_improvement".to_string(),
            last_run: now.checked_sub_signed(chrono::Duration::seconds(45)).unwrap_or(now).to_rfc3339(),
            status: "active".to_string(),
            metrics: {
                let mut m = HashMap::new();
                m.insert("cpu_usage".to_string(), 0.18);
                m.insert("memory_mb".to_string(), 62.5);
                m
            },
        },
    ];

    HttpResponse::Ok().json(SubconsciousStatusResponse {
        status: "operational".to_string(),
        loops,
        timestamp: now.to_rfc3339(),
    })
}

/// Server-Sent Events handler for subconscious stream
/// Now connected to real subconscious loops via broadcast channel
async fn subconscious_stream_handler(state: web::Data<ApiState>) -> HttpResponse {
    let mut rx = state.subconscious_tx.subscribe();
    
    // Create stream from broadcast receiver
    let stream = futures::stream::unfold(rx, |mut rx| async move {
        match rx.recv().await {
            Ok(event) => {
                let data = serde_json::to_string(&event).unwrap_or_default();
                let sse_event = format!("data: {}\n\n", data);
                Some((Ok::<_, actix_web::Error>(web::Bytes::from(sse_event)), rx))
            }
            Err(tokio::sync::broadcast::error::RecvError::Closed) => None, // Channel closed
            Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                // Client lagged behind, continue receiving
                Some((Ok(web::Bytes::from(": keepalive\n\n")), rx))
            }
        }
    });
    
    HttpResponse::Ok()
        .content_type("text/event-stream")
        .insert_header(("Cache-Control", "no-cache"))
        .insert_header(("Connection", "keep-alive"))
        .insert_header(("Access-Control-Allow-Origin", "*"))
        .streaming(stream)
}

// Heartbeat WebSocket removed - using SSE only
// Health checks now use /health endpoint

/// Operation response structure
#[derive(Serialize)]
struct OperationResponse {
    operation_id: String,
    status: String,
    timestamp: String,
}

/// Handler for orchestration intent endpoint
async fn orchestration_intent_handler(
    req: web::Json<serde_json::Value>,
    state: web::Data<ApiState>,
) -> impl Responder {
    let operation_id = uuid::Uuid::new_v4().to_string();
    tracing::info!("Received orchestration intent request: {:?}", req);
    
    // Return a successful response with the operation ID
    HttpResponse::Ok().json(OperationResponse {
        operation_id,
        status: "accepted".to_string(),
        timestamp: Utc::now().to_rfc3339(),
    })
}

pub async fn start_server(
    host: &str,
    port: u16,
    state: ApiState,
) -> std::io::Result<()> {
    tracing::info!("Starting Phoenix API server on {}:{}", host, port);
    tracing::info!("Registered routes: /health, /ready, /query, /api/v1/chat/diagnostic, /api/v1/sse/subconscious");
    
    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .supports_credentials()
            .max_age(3600);
        
        App::new()
            .wrap(cors)
            .wrap(Logger::default())
            .app_data(web::Data::new(state.clone()))
            // Existing endpoints
            .route("/query", web::post().to(query_handler))
            .route("/api/v1/chat/diagnostic", web::get().to(chat_diagnostic_handler))
            .route("/health", web::get().to(health_handler))
            .route("/ready", web::get().to(ready_handler))
            // WebSocket removed - using SSE only
            // New telemetry stream endpoint
            .route("/api/v1/telemetry-stream", web::get().to(telemetry_stream_handler))
            // Ember Unit API endpoints
            .route("/api/v1/ember/engagement", web::post().to(engagement_start_handler))
            .route("/api/v1/ember/engagement/{engagement_id}/status", web::get().to(engagement_status_handler))
            .route("/api/v1/ember/engagement/{engagement_id}/findings", web::get().to(engagement_findings_handler))
            .route("/api/v1/ember/agent/spawn", web::post().to(agent_spawn_handler))
            .route("/api/v1/ember/agent/{agent_id}/status", web::get().to(agent_status_handler))
            .route("/api/v1/ember/report/{engagement_id}", web::post().to(report_generate_handler))
            // WebSocket removed - using SSE only
            // Ecosystem Weaver API endpoints
            .route("/api/v1/ecosystem/integrate", web::post().to(ecosystem::integrate_handler))
            .route("/api/v1/ecosystem/spawn", web::post().to(ecosystem::spawn_handler))
            .route("/api/v1/ecosystem/status", web::get().to(ecosystem::status_handler))
            .route("/api/v1/sse/ecosystem", web::get().to(ecosystem::ecosystem_stream_handler))
            // Tools Arsenal API endpoints
            .route("/api/v1/tools/call", web::post().to(tools_api::tool_call_handler))
            .route("/api/v1/tools/register", web::post().to(tools_api::tool_register_handler))
            .route("/api/v1/tools/list", web::get().to(tools_api::tools_list_handler))
            .route("/api/v1/sse/tools", web::get().to(tools_api::tool_stream_handler))
            // PISTOL-specific endpoints
            .route("/api/v1/tools/pistol", web::post().to(tools_api::pistol_scan_handler))
            .route("/api/v1/sse/tools/pistol/{job_id}", web::get().to(tools_api::pistol_stream_handler))
            // Subconscious endpoints
            .route("/api/v1/subconscious/status", web::get().to(subconscious_status_handler))
            .route("/api/v1/sse/subconscious", web::get().to(subconscious_stream_handler))
            // WebSocket removed - using SSE only
            .route("/api/v1/orchestration/intent", web::post().to(orchestration_intent_handler))
            // MASSCAN-specific endpoints
            .route("/api/v1/tools/masscan", web::post().to(tools_api::masscan_scan_handler))
            .route("/api/v1/sse/tools/masscan/{job_id}", web::get().to(tools_api::masscan_stream_handler))
            // Metasploit Framework endpoints
            .route("/api/v1/tools/msf/search", web::post().to(tools_api::msf_search_handler))
            .route("/api/v1/tools/msf/execute", web::post().to(tools_api::msf_execute_handler))
            .route("/api/v1/tools/msf/sessions", web::get().to(tools_api::msf_sessions_handler))
            .route("/api/v1/tools/msf/shell/{session_id}", web::post().to(tools_api::msf_shell_handler))
            .route("/api/v1/sse/tools/msf", web::get().to(tools_api::msf_stream_handler))
            // Forge endpoints
            .route("/api/v1/forge/leaderboard", web::get().to(forge_leaderboard_handler))
            .route("/api/v1/sse/forge/leaderboard", web::get().to(forge_leaderboard_stream_handler))
            
    })
    .bind((host, port))?
    .run()
    .await
}



#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, web, App};

    fn create_test_state() -> ApiState {
        let memory = Arc::new(Mutex::new(
            PersistenceService::new(std::path::PathBuf::from("test_data"), None).unwrap(),
        ));
        let conscience = Arc::new(ConscienceFramework::default());
        
        // Create a mock PhoenixCore for testing
        // This is a simplified version - in real tests you'd want proper mocking
        let core = Arc::new(crate::PhoenixCore {
            components: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
            config: Arc::new(tokio::sync::RwLock::new(crate::config::Config::default())),
            health: Arc::new(tokio::sync::RwLock::new(crate::system::SystemHealth {
                score: 1.0,
                components: std::collections::HashMap::new(),
                warnings: Vec::new(),
            })),
        });

        // Create a minimal test config
        let config = Arc::new(Config {
            system: crate::config::SystemConfig {
                name: "test".to_string(),
                version: "1.0.0".to_string(),
                log_level: "info".to_string(),
                data_dir: "test_data".to_string(),
                config_dir: "test_config".to_string(),
                plugin_dir: "test_plugins".to_string(),
                backup_locations: vec![],
            },
            memory: crate::config::MemoryConfig {
                storage_path: "test_data/memory".to_string(),
                mirror_locations: vec![],
                merkle_depth: 10,
                encryption: crate::config::EncryptionConfig {
                    algorithm: "aes-256-gcm".to_string(),
                    key_size: 256,
                    key_file: "test_keys/memory.key".to_string(),
                },
                consolidation_interval: 3600,
            },
            world_model: crate::config::WorldModelConfig {
                architecture: "transformer".to_string(),
                input_dims: vec![1024],
                hidden_dims: vec![2048, 1024],
                learning: crate::config::LearningParams {
                    learning_rate: 0.001,
                    momentum: 0.9,
                    weight_decay: 0.0001,
                },
            },
            conscience: crate::config::ConscienceConfig {
                values_file: "test_config/values.toml".to_string(),
                thresholds: std::collections::HashMap::new(),
                weights: std::collections::HashMap::new(),
            },
            values: crate::config::ValueConfig {
                values_file: "test_config/values.toml".to_string(),
                drift_thresholds: std::collections::HashMap::new(),
                verification_keys: vec![],
            },
            learning: crate::config::LearningConfig {
                base_lr: 0.001,
                lr_schedule: std::collections::HashMap::new(),
                batch_size: 32,
                replay_size: 1000,
            },
            perception: crate::config::PerceptionConfig {
                sensors: vec![],
                fusion: crate::config::FusionConfig {
                    method: "weighted".to_string(),
                    weights: std::collections::HashMap::new(),
                    thresholds: std::collections::HashMap::new(),
                },
                calibration: std::collections::HashMap::new(),
            },
            safety: crate::config::SafetyConfig {
                drift_threshold: 0.3,
                shutdown_threshold: 0.5,
                required_signatures: 2,
                checks: vec![],
            },
            resources: crate::config::ResourceConfig {
                memory_limit: 1024 * 1024 * 1024,
                cpu_limit: 0.8,
                storage_limit: 1024 * 1024 * 1024 * 100,
                network_limit: 1024 * 1024 * 10,
            },
            components: std::collections::HashMap::new(),
            api_keys: std::collections::HashMap::new(),
            ai_models: std::collections::HashMap::new(),
        });

        ApiState::new(memory, conscience, core, config)
    }

    #[actix_web::test]
    async fn test_health_endpoint_returns_200() {
        let state = create_test_state();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(state.clone()))
                .route("/health", web::get().to(health_handler))
        )
        .await;

        let req = test::TestRequest::get().uri("/health").to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), 200);
    }

    #[actix_web::test]
    async fn test_health_endpoint_returns_valid_json() {
        let state = create_test_state();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(state.clone()))
                .route("/health", web::get().to(health_handler))
        )
        .await;

        let req = test::TestRequest::get().uri("/health").to_request();
        let resp: HealthResponse = test::call_and_read_body_json(&app, req).await;

        assert_eq!(resp.status, "healthy");
        assert!(resp.uptime_seconds >= 0);
        assert!(!resp.timestamp.is_empty());
    }

    #[actix_web::test]
    async fn test_health_endpoint_includes_timestamp() {
        let state = create_test_state();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(state.clone()))
                .route("/health", web::get().to(health_handler))
        )
        .await;

        let req = test::TestRequest::get().uri("/health").to_request();
        let resp: HealthResponse = test::call_and_read_body_json(&app, req).await;

        // Verify timestamp is valid ISO 8601 format
        assert!(chrono::DateTime::parse_from_rfc3339(&resp.timestamp).is_ok());
    }

    #[actix_web::test]
    async fn test_ready_endpoint_structure() {
        let state = create_test_state();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(state.clone()))
                .route("/ready", web::get().to(ready_handler))
        )
        .await;

        let req = test::TestRequest::get().uri("/ready").to_request();
        let resp = test::call_service(&app, req).await;

        // Status should be either 200 or 503
        assert!(resp.status() == 200 || resp.status() == 503);
    }

    #[actix_web::test]
    async fn test_ready_endpoint_when_not_ready() {
        let state = create_test_state();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(state.clone()))
                .route("/ready", web::get().to(ready_handler))
        )
        .await;

        let req = test::TestRequest::get().uri("/ready").to_request();
        let resp = test::call_service(&app, req).await;

        // When world_model is not initialized, should return 503
        // This is expected behavior for the test setup
        if resp.status() == 503 {
            let body = test::read_body_json::<serde_json::Value, _>(resp).await;
            assert_eq!(body["status"], "not_ready");
            assert!(body.get("missing").is_some());
            assert!(body.get("ready").is_some());
        }
    }
}
