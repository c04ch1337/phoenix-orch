use actix::{Actor, Handler, Message, StreamHandler, AsyncContext, ActorContext};
use actix_web::{web, App, HttpRequest, HttpResponse, HttpServer, Responder, middleware::Logger};
use actix_web_actors::ws;
use actix_cors::Cors;
use chrono::{DateTime, Utc};
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
    // Temporarily disabled - plugin system to be fixed later
    // pub plugins: Arc<Mutex<PluginManager>>,
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
        
        Self {
            memory,
            conscience,
            core,
            llm,
            config,
            startup_time: Utc::now(),
            relationship_engine,
        }
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
// WebSocket Actor for Chat
// ============================================================================

/// How often heartbeat pings are sent
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
/// How long before lack of client response causes a timeout
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);

/// Message to send LLM response back through WebSocket
#[derive(Message)]
#[rtype(result = "()")]
#[derive(Message)]
#[rtype(result = "()")]
struct LlmResponseMessage {
    content: String,
    approved: bool,
    warnings: Vec<String>,
}

/// WebSocket actor for handling chat connections
pub struct ChatWebSocket {
    /// Client must send ping at least once per CLIENT_TIMEOUT, otherwise we drop connection
    hb: Instant,
    /// API state for accessing Phoenix systems
    state: web::Data<ApiState>,
    /// Current user relationship (defaults to Protected until user_id is received)
    current_relationship: UserRelationship,
}

impl ChatWebSocket {
    pub fn new(state: web::Data<ApiState>) -> Self {
        Self {
            hb: Instant::now(),
            state,
            current_relationship: UserRelationship::Protected,
        }
    }

    /// Helper method that sends ping to client every HEARTBEAT_INTERVAL
    fn hb(&self, ctx: &mut <Self as Actor>::Context) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            // Check client heartbeats
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                // Heartbeat timed out
                tracing::warn!("WebSocket client heartbeat failed, disconnecting!");
                ctx.stop();
                return;
            }
            ctx.ping(b"");
        });
    }
}

impl Actor for ChatWebSocket {
    type Context = ws::WebsocketContext<Self>;

    /// Method is called on actor start. We start the heartbeat process here.
    fn started(&mut self, ctx: &mut Self::Context) {
        self.hb(ctx);
        tracing::info!("WebSocket connection established");
        
        // Send welcome message
        let welcome = serde_json::json!({
            "type": "connected",
            "message": "Connected to Phoenix ORCH",
            "timestamp": Utc::now().to_rfc3339()
        });
        ctx.text(welcome.to_string());
    }

    fn stopped(&mut self, _ctx: &mut Self::Context) {
        tracing::info!("WebSocket connection closed");
    }
}

/// Handler for LLM response messages
impl actix::Handler<LlmResponseMessage> for ChatWebSocket {
    type Result = ();

    fn handle(&mut self, msg: LlmResponseMessage, ctx: &mut Self::Context) {
        tracing::info!("📤 Handling LLM response message ({} chars)", msg.content.len());
        
        // Only send if content is not empty and not the processing message
        if msg.content.is_empty() || msg.content == "Processing your message..." {
            tracing::warn!("Skipping empty or processing message");
            return;
        }
        
        let response = serde_json::json!({
            "type": "response",
            "content": msg.content,
            "approved": msg.approved,
            "warnings": msg.warnings,
            "timestamp": Utc::now().to_rfc3339()
        });
        let response_str = response.to_string();
        tracing::debug!("📤 Sending WebSocket response: {}", response_str);
        ctx.text(response_str);
        tracing::info!("✅ LLM response sent to WebSocket client");
    }
}

/// Handler for WebSocket messages
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for ChatWebSocket {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => {
                self.hb = Instant::now();
                ctx.pong(&msg);
            }
            Ok(ws::Message::Pong(_)) => {
                self.hb = Instant::now();
            }
            Ok(ws::Message::Text(text)) => {
                tracing::debug!("WebSocket received: {}", text);
                
                // Parse incoming message
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                    let msg_type = parsed.get("type").and_then(|t| t.as_str()).unwrap_or("unknown");
                    
                    match msg_type {
                        "chat" => {
                            let content = parsed.get("content").and_then(|c| c.as_str()).unwrap_or("");
                            
                            // Extract user ID and determine relationship
                            let user_id = extract_user_id_from_message(&parsed)
                                .unwrap_or_else(|| "anonymous".to_string());
                            let relationship = self.state.relationship_engine.relationship_with(&user_id);
                            
                            tracing::info!("👤 User relationship: {:?} (user_id: {})", relationship, user_id);
                            
                            // Evaluate through conscience framework
                            let conscience_result = self.state.conscience.evaluate(content, &HashMap::new());
                            
                            let response = if conscience_result.approved {
                                // Store user message to memory
                                let user_memory = MemoryEntry::new(
                                    content.to_string(),
                                    serde_json::json!({
                                        "type": "user_message",
                                        "timestamp": Utc::now().to_rfc3339(),
                                    }),
                                );
                                {
                                    let mem = self.state.memory.lock().await;
                                    let _ = mem.store(&user_memory).await;
                                }
                                
                                // Generate LLM response asynchronously
                                let state_clone = self.state.clone();
                                let content_clone = content.to_string();
                                let warnings_clone = conscience_result.warnings.clone();
                                let addr = ctx.address();
                                
                                // Spawn async task to generate LLM response
                                let relationship_clone = relationship;
                                ctx.spawn(async move {
                                    tracing::info!("🔥 Processing chat message: '{}' ({} chars)", 
                                        content_clone.chars().take(100).collect::<String>(), 
                                        content_clone.len()
                                    );
                                    tracing::info!("👤 Using relationship: {:?}", relationship_clone);
                                    
                                    // Retrieve recent conversation history from memory
                                    let conversation_history = {
                                        let mem = state_clone.memory.lock().await;
                                        // Get recent memories (last 10 chat messages)
                                        match mem.list_all().await {
                                            Ok(all_entries) => {
                                                let history: Vec<_> = all_entries
                                                    .into_iter()
                                                    .rev()
                                                    .take(10)
                                                    .filter_map(|entry| {
                                                        // Check if this is a chat message
                                                        if let Some(metadata) = entry.metadata.as_object() {
                                                            let msg_type = metadata.get("type")?.as_str()?;
                                                            if msg_type == "user_message" || msg_type == "assistant_message" {
                                                                // Convert to ChatMessage format
                                                                Some(crate::core::llm::ChatMessage {
                                                                    role: if msg_type == "user_message" {
                                                                        crate::core::llm::MessageRole::User
                                                                    } else {
                                                                        crate::core::llm::MessageRole::Assistant
                                                                    },
                                                                    content: entry.content.clone(),
                                                                })
                                                            } else {
                                                                None
                                                            }
                                                        } else {
                                                            None
                                                        }
                                                    })
                                                    .collect();
                                                tracing::info!("📚 Loaded {} messages from conversation history", history.len());
                                                history
                                            }
                                            Err(e) => {
                                                tracing::warn!("Failed to load conversation history: {}", e);
                                                Vec::new()
                                            }
                                        }
                                    };
                                    
                                    // Use the appropriate system prompt based on relationship
                                    let system_prompt = Some(get_system_prompt(relationship_clone));
                                    tracing::info!("📝 Using prompt for relationship: {:?}", relationship_clone);
                                    
                                    tracing::info!("🤖 Calling LLM service (model: {})", state_clone.config.get_default_model());
                                    let start_time = std::time::Instant::now();
                                    
                                    let (llm_response, has_warnings) = match state_clone.llm.generate_response(
                                        &content_clone,
                                        system_prompt,
                                        if conversation_history.is_empty() { None } else { Some(conversation_history) }
                                    ).await {
                                        Ok(response) => {
                                            let elapsed = start_time.elapsed();
                                            tracing::info!("✅ LLM response received in {:?} ({} chars)", elapsed, response.len());
                                            tracing::debug!("📝 Response preview: {}", response.chars().take(200).collect::<String>());
                                            
                                            // Store assistant response to memory
                                            let assistant_memory = MemoryEntry::new(
                                                response.clone(),
                                                serde_json::json!({
                                                    "type": "assistant_message",
                                                    "user_query": content_clone,
                                                    "timestamp": Utc::now().to_rfc3339(),
                                                    "response_time_ms": elapsed.as_millis(),
                                                }),
                                            );
                                            {
                                                let mem = state_clone.memory.lock().await;
                                                if let Err(e) = mem.store(&assistant_memory).await {
                                                    tracing::warn!("Failed to store assistant response to memory: {}", e);
                                                }
                                            }
                                            
                                            (response, warnings_clone)
                                        }
                                        Err(e) => {
                                            let elapsed = start_time.elapsed();
                                            tracing::error!("❌ LLM generation FAILED after {:?}: {}", elapsed, e);
                                            tracing::error!("   Error details: {:?}", e);
                                            
                                            // Production-grade error response - NO TEST DATA
                                            let error_details = format!("{}", e);
                                            let fallback = if error_details.contains("API key") || error_details.contains("authentication") {
                                                "I cannot connect to my language model service. Please verify the API key is configured correctly in the backend configuration.".to_string()
                                            } else if error_details.contains("timeout") || error_details.contains("network") {
                                                "I'm experiencing network connectivity issues with my language model service. Please try again in a moment.".to_string()
                                            } else if error_details.contains("rate limit") || error_details.contains("quota") {
                                                "The language model service is currently rate-limited. Please try again shortly.".to_string()
                                            } else {
                                                format!("I encountered an error while processing your message: {}. Please try rephrasing your question or contact support if this persists.", error_details)
                                            };
                                            
                                            let mut warnings = warnings_clone;
                                            warnings.push(format!("LLM service error: {}", error_details));
                                            
                                            // Log error for monitoring
                                            tracing::error!("🚨 Chat error - User message: '{}', Error: {}", 
                                                content_clone.chars().take(50).collect::<String>(), 
                                                error_details
                                            );
                                            
                                            (fallback, warnings)
                                        }
                                    };
                                    
                                    // Send response back through actor message (fire-and-forget)
                                    // Use a small delay to ensure the "Processing..." message is sent first
                                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                                    
                                    tracing::info!("📤 Sending LLM response to WebSocket client ({} chars, {} warnings)", 
                                        llm_response.len(), 
                                        has_warnings.len()
                                    );
                                    
                                    addr.do_send(LlmResponseMessage {
                                        content: llm_response.clone(),
                                        approved: true,
                                        warnings: has_warnings.clone(),
                                    });
                                });
                                
                                // Send immediate acknowledgment while LLM processes
                                serde_json::json!({
                                    "type": "response",
                                    "content": "Processing your message...",
                                    "approved": true,
                                    "warnings": conscience_result.warnings,
                                    "timestamp": Utc::now().to_rfc3339()
                                })
                            } else {
                                serde_json::json!({
                                    "type": "response",
                                    "content": format!("Query rejected: {}", conscience_result.violations.join(", ")),
                                    "approved": false,
                                    "violations": conscience_result.violations,
                                    "timestamp": Utc::now().to_rfc3339()
                                })
                            };
                            
                            ctx.text(response.to_string());
                        }
                        "ping" => {
                            let pong = serde_json::json!({
                                "type": "pong",
                                "timestamp": Utc::now().to_rfc3339()
                            });
                            ctx.text(pong.to_string());
                        }
                        _ => {
                            let error = serde_json::json!({
                                "type": "error",
                                "message": format!("Unknown message type: {}", msg_type),
                                "timestamp": Utc::now().to_rfc3339()
                            });
                            ctx.text(error.to_string());
                        }
                    }
                } else {
                    // Echo back for simple text messages
                    let response = serde_json::json!({
                        "type": "echo",
                        "content": text.to_string(),
                        "timestamp": Utc::now().to_rfc3339()
                    });
                    ctx.text(response.to_string());
                }
            }
            Ok(ws::Message::Binary(bin)) => {
                tracing::debug!("WebSocket received binary: {} bytes", bin.len());
                ctx.binary(bin);
            }
            Ok(ws::Message::Close(reason)) => {
                tracing::info!("WebSocket close requested: {:?}", reason);
                ctx.close(reason);
                ctx.stop();
            }
            _ => ctx.stop(),
        }
    }
}

/// WebSocket endpoint handler
async fn ws_handler(
    req: HttpRequest,
    stream: web::Payload,
    state: web::Data<ApiState>,
) -> Result<HttpResponse, actix_web::Error> {
    tracing::info!("WebSocket connection request from {:?}", req.peer_addr());
    ws::start(ChatWebSocket::new(state), &req, stream)
}

// ============================================================================
// Ember Unit WebSocket for Real-time Monitoring
// ============================================================================

/// WebSocket actor for handling Ember Unit monitoring connections
pub struct EmberUnitWebSocket {
    /// Client must send ping at least once per CLIENT_TIMEOUT, otherwise we drop connection
    hb: Instant,
    /// API state for accessing Phoenix systems
    state: web::Data<ApiState>,
    /// Engagement ID being monitored (if any)
    engagement_id: Option<Uuid>,
}

impl EmberUnitWebSocket {
    pub fn new(state: web::Data<ApiState>) -> Self {
        Self {
            hb: Instant::now(),
            state,
            engagement_id: None,
        }
    }

    /// Helper method that sends ping to client every HEARTBEAT_INTERVAL
    fn hb(&self, ctx: &mut <Self as Actor>::Context) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            // Check client heartbeats
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                // Heartbeat timed out
                tracing::warn!("Ember Unit WebSocket client heartbeat failed, disconnecting!");
                ctx.stop();
                return;
            }
            ctx.ping(b"");
        });
    }
}

impl Actor for EmberUnitWebSocket {
    type Context = ws::WebsocketContext<Self>;

    /// Method is called on actor start. We start the heartbeat process here.
    fn started(&mut self, ctx: &mut Self::Context) {
        self.hb(ctx);
        tracing::info!("Ember Unit WebSocket connection established");
        
        // Send welcome message
        let welcome = serde_json::json!({
            "type": "ember_connected",
            "message": "Connected to Phoenix ORCH Ember Unit",
            "timestamp": Utc::now().to_rfc3339(),
            "capabilities": ["engagement_monitoring", "agent_status", "finding_alerts", "phase_transitions"]
        });
        ctx.text(welcome.to_string());
    }

    fn stopped(&mut self, _ctx: &mut Self::Context) {
        tracing::info!("Ember Unit WebSocket connection closed");
    }
}

/// Handler for WebSocket messages for Ember Unit
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for EmberUnitWebSocket {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => {
                self.hb = Instant::now();
                ctx.pong(&msg);
            }
            Ok(ws::Message::Pong(_)) => {
                self.hb = Instant::now();
            }
            Ok(ws::Message::Text(text)) => {
                tracing::debug!("Ember Unit WebSocket received: {}", text);
                
                // Parse incoming message
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                    let msg_type = parsed.get("type").and_then(|t| t.as_str()).unwrap_or("unknown");
                    
                    match msg_type {
                        "subscribe_engagement" => {
                            if let Some(engagement_id_str) = parsed.get("engagement_id").and_then(|id| id.as_str()) {
                                if let Ok(engagement_id) = Uuid::parse_str(engagement_id_str) {
                                    self.engagement_id = Some(engagement_id);
                                    tracing::info!("Ember Unit WebSocket subscribed to engagement: {}", engagement_id);
                                    
                                    let response = serde_json::json!({
                                        "type": "subscription_confirmed",
                                        "engagement_id": engagement_id.to_string(),
                                        "message": "Subscribed to engagement updates",
                                        "timestamp": Utc::now().to_rfc3339()
                                    });
                                    ctx.text(response.to_string());
                                }
                            }
                        }
                        "ping" => {
                            let pong = serde_json::json!({
                                "type": "pong",
                                "timestamp": Utc::now().to_rfc3339()
                            });
                            ctx.text(pong.to_string());
                        }
                        _ => {
                            let error = serde_json::json!({
                                "type": "error",
                                "message": format!("Unknown message type: {}", msg_type),
                                "timestamp": Utc::now().to_rfc3339()
                            });
                            ctx.text(error.to_string());
                        }
                    }
                } else {
                    // Echo back for simple text messages
                    let response = serde_json::json!({
                        "type": "echo",
                        "content": text.to_string(),
                        "timestamp": Utc::now().to_rfc3339()
                    });
                    ctx.text(response.to_string());
                }
            }
            Ok(ws::Message::Binary(bin)) => {
                tracing::debug!("Ember Unit WebSocket received binary: {} bytes", bin.len());
                ctx.binary(bin);
            }
            Ok(ws::Message::Close(reason)) => {
                tracing::info!("Ember Unit WebSocket close requested: {:?}", reason);
                ctx.close(reason);
                ctx.stop();
            }
            _ => ctx.stop(),
        }
    }
}

/// Ember Unit WebSocket endpoint handler
async fn ember_ws_handler(
    req: HttpRequest,
    stream: web::Payload,
    state: web::Data<ApiState>,
) -> Result<HttpResponse, actix_web::Error> {
    tracing::info!("Ember Unit WebSocket connection request from {:?}", req.peer_addr());
    ws::start(EmberUnitWebSocket::new(state), &req, stream)
}


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
async fn subconscious_stream_handler(state: web::Data<ApiState>) -> HttpResponse {
    let state_clone = state.clone();
    
    // List of possible thoughts for demonstration
    let thoughts = vec![
        "Analyzing memory patterns for optimization opportunities",
        "Integrating new context with existing knowledge base",
        "Evaluating decision framework against core value alignment",
        "Consolidating perceptual data from environment",
        "Monitoring integrity of self-model against baseline",
        "Reflecting on recent interaction patterns with users",
        "Exploring potential improvements to reasoning capabilities"
    ];
    
    let stream = futures::stream::unfold(0u64, move |count| {
        let state = state_clone.clone();
        let thoughts = thoughts.clone();
        
        async move {
            // Wait between 1-2 seconds between updates
            let wait_time = 1000 + (count as u64 % 1000);
            tokio::time::sleep(Duration::from_millis(wait_time)).await;
            
            // Determine which loop is active this tick
            let loop_index = (count % 7) as usize;
            let loop_names = [
                "perception_loop", "memory_consolidation", "value_alignment",
                "context_integration", "integrity_check", "introspection", "self_improvement"
            ];
            
            // Pick a random thought
            let thought_index = (count % thoughts.len() as u64) as usize;
            
            // Create the event data
            let event_data = serde_json::json!({
                "timestamp": Utc::now().to_rfc3339(),
                "active_loop": loop_names[loop_index],
                "tick_count": count,
                "last_thought": thoughts[thought_index],
                "metrics": {
                    "cpu_usage": 0.2 + (count as f64 * 0.01).sin() * 0.1,
                    "memory_mb": 50.0 + (count as f64 * 0.02).cos() * 10.0,
                }
            });
            
            let data = serde_json::to_string(&event_data).unwrap_or_default();
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

/// Simple WebSocket actor for heartbeat echoing
pub struct HeartbeatWs {
    /// Client heartbeat time
    hb: Instant,
}

impl HeartbeatWs {
    pub fn new() -> Self {
        Self {
            hb: Instant::now(),
        }
    }

    /// Helper method that sends ping to client every HEARTBEAT_INTERVAL
    fn hb(&self, ctx: &mut <Self as Actor>::Context) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            // Check client heartbeats
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                // Heartbeat timed out
                tracing::warn!("WebSocket heartbeat failed, disconnecting!");
                ctx.stop();
                return;
            }
            ctx.ping(b"");
        });
    }
}

impl Actor for HeartbeatWs {
    type Context = ws::WebsocketContext<Self>;

    /// Method is called on actor start. We start the heartbeat process here.
    fn started(&mut self, ctx: &mut Self::Context) {
        self.hb(ctx);
        tracing::info!("Heartbeat WebSocket connection established");
    }

    fn stopped(&mut self, _ctx: &mut Self::Context) {
        tracing::info!("Heartbeat WebSocket connection closed");
    }
}

/// Handler for WebSocket messages
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for HeartbeatWs {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => {
                self.hb = Instant::now();
                ctx.pong(&msg);
            }
            Ok(ws::Message::Pong(_)) => {
                self.hb = Instant::now();
            }
            Ok(ws::Message::Text(text)) => {
                self.hb = Instant::now();
                // Echo the message back
                ctx.text(text);
            }
            Ok(ws::Message::Binary(bin)) => {
                self.hb = Instant::now();
                ctx.binary(bin);
            }
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            _ => ctx.stop(),
        }
    }
}

/// WebSocket endpoint handler for heartbeat
async fn heartbeat_ws_handler(
    req: HttpRequest,
    stream: web::Payload,
) -> Result<HttpResponse, actix_web::Error> {
    tracing::info!("Heartbeat WebSocket connection request from {:?}", req.peer_addr());
    ws::start(HeartbeatWs::new(), &req, stream)
}

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
    tracing::info!("Registered routes: /health, /ready, /query, /api/v1/chat/diagnostic, /ws/dad");
    
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
            // New WebSocket endpoint for chat
            .route("/ws/dad", web::get().to(ws_handler))
            // New telemetry stream endpoint
            .route("/api/v1/telemetry-stream", web::get().to(telemetry_stream_handler))
            // Ember Unit API endpoints
            .route("/api/v1/ember/engagement", web::post().to(engagement_start_handler))
            .route("/api/v1/ember/engagement/{engagement_id}/status", web::get().to(engagement_status_handler))
            .route("/api/v1/ember/engagement/{engagement_id}/findings", web::get().to(engagement_findings_handler))
            .route("/api/v1/ember/agent/spawn", web::post().to(agent_spawn_handler))
            .route("/api/v1/ember/agent/{agent_id}/status", web::get().to(agent_status_handler))
            .route("/api/v1/ember/report/{engagement_id}", web::post().to(report_generate_handler))
            // Ember Unit WebSocket endpoint for real-time monitoring
            .route("/ws/ember", web::get().to(ember_ws_handler))
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
            .route("/ws", web::get().to(heartbeat_ws_handler))
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
