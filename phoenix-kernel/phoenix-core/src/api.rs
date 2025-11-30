use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio_stream::wrappers::IntervalStream;
use tracing::{error, info, warn};
use warp::ws::{Message, WebSocket};
use warp::{Filter, Rejection, Reply};

use crate::error::Error;
use crate::system::{SystemHealth, SystemState};

/// API response wrapper
#[derive(Debug, Serialize)]
struct ApiResponse<T> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    fn error(error: impl ToString) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error.to_string()),
        }
    }
}

/// Health check response
#[derive(Debug, Serialize)]
struct HealthResponse {
    status: SystemHealth,
    uptime: i64,
    version: String,
}

/// Resurrection request
#[derive(Debug, Deserialize)]
struct ResurrectionRequest {
    backup_location: String,
    force: bool,
}

/// Start the HTTP API server
pub async fn serve_api(state: Arc<RwLock<SystemState>>, port: u16) -> Result<(), Error> {
    info!("Starting API server on port {}", port);

    // Health check endpoint
    let health = warp::path("health")
        .and(with_state(state.clone()))
        .and_then(handle_health);

    // System status endpoint
    let status = warp::path("status")
        .and(with_state(state.clone()))
        .and_then(handle_status);

    // Resurrection endpoint
    let resurrect = warp::path("resurrect")
        .and(warp::post())
        .and(warp::body::json())
        .and(with_state(state.clone()))
        .and_then(handle_resurrect);

    // Shutdown endpoint
    let shutdown = warp::path("shutdown")
        .and(warp::post())
        .and(with_state(state.clone()))
        .and_then(handle_shutdown);

    // Metrics endpoint
    let metrics = warp::path("metrics")
        .and(with_state(state.clone()))
        .and_then(handle_metrics);

    // WebSocket endpoint for chat at /ws/dad
    let ws_state = state.clone();
    let websocket = warp::path!("ws" / "dad")
        .and(warp::ws())
        .and(warp::any().map(move || ws_state.clone()))
        .map(|ws: warp::ws::Ws, state: Arc<RwLock<SystemState>>| {
            ws.on_upgrade(move |socket| handle_websocket(socket, state))
        });

    // Telemetry stream endpoint (Server-Sent Events)
    let telemetry_state = state.clone();
    let telemetry_stream = warp::path!("api" / "v1" / "telemetry-stream")
        .and(warp::get())
        .and(warp::any().map(move || telemetry_state.clone()))
        .map(|state: Arc<RwLock<SystemState>>| {
            let stream = create_telemetry_stream(state);
            warp::reply::Response::new(hyper::Body::wrap_stream(stream))
        })
        .map(|reply| {
            warp::reply::with_header(reply, "Content-Type", "text/event-stream")
        })
        .map(|reply| {
            warp::reply::with_header(reply, "Cache-Control", "no-cache")
        })
        .map(|reply| {
            warp::reply::with_header(reply, "Connection", "keep-alive")
        });

    // CORS configuration
    let cors = warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
        .allow_headers(vec!["Content-Type", "Authorization", "Accept"])
        .max_age(3600);

    // Combine routes
    let routes = health
        .or(status)
        .or(resurrect)
        .or(shutdown)
        .or(metrics)
        .or(websocket)
        .or(telemetry_stream)
        .with(cors)
        .recover(handle_rejection);

    // Start server
    warp::serve(routes).run(([0, 0, 0, 0], port)).await;

    Ok(())
}

/// Handle WebSocket connections for chat
async fn handle_websocket(ws: WebSocket, state: Arc<RwLock<SystemState>>) {
    info!("WebSocket connection established");
    
    let (mut tx, mut rx) = ws.split();
    
    // Send welcome message
    let welcome = json!({
        "type": "connected",
        "message": "Connected to Phoenix ORCH",
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    if let Err(e) = tx.send(Message::text(welcome.to_string())).await {
        error!("Failed to send welcome message: {}", e);
        return;
    }
    
    // Handle incoming messages
    while let Some(result) = rx.next().await {
        match result {
            Ok(msg) => {
                if msg.is_text() {
                    let text = msg.to_str().unwrap_or("");
                    info!("WebSocket received: {}", text);
                    
                    // Parse and handle message
                    let response = handle_ws_message(text, &state).await;
                    
                    if let Err(e) = tx.send(Message::text(response)).await {
                        error!("Failed to send response: {}", e);
                        break;
                    }
                } else if msg.is_ping() {
                    if let Err(e) = tx.send(Message::pong(msg.into_bytes())).await {
                        error!("Failed to send pong: {}", e);
                        break;
                    }
                } else if msg.is_close() {
                    info!("WebSocket close requested");
                    break;
                }
            }
            Err(e) => {
                error!("WebSocket error: {}", e);
                break;
            }
        }
    }
    
    info!("WebSocket connection closed");
}

/// Handle individual WebSocket messages
async fn handle_ws_message(text: &str, state: &Arc<RwLock<SystemState>>) -> String {
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(text) {
        let msg_type = parsed.get("type").and_then(|t| t.as_str()).unwrap_or("unknown");
        
        match msg_type {
            "chat" => {
                let content = parsed.get("content").and_then(|c| c.as_str()).unwrap_or("");
                
                // Get system state for conscience evaluation
                let state_guard = state.read().await;
                
                // Check if conscience is available
                let response = if let Some(components) = &state_guard.components {
                    // Evaluate through conscience framework
                    match components.conscience.evaluate(content).await {
                        Ok(result) => {
                            if result.approved {
                                json!({
                                    "type": "response",
                                    "content": format!("Phoenix acknowledges: {}", content),
                                    "approved": true,
                                    "warnings": result.warnings,
                                    "timestamp": chrono::Utc::now().to_rfc3339()
                                })
                            } else {
                                json!({
                                    "type": "response",
                                    "content": format!("Query rejected: {}", result.violations.join(", ")),
                                    "approved": false,
                                    "violations": result.violations,
                                    "timestamp": chrono::Utc::now().to_rfc3339()
                                })
                            }
                        }
                        Err(e) => {
                            json!({
                                "type": "response",
                                "content": format!("Phoenix acknowledges: {}", content),
                                "approved": true,
                                "note": "Conscience evaluation unavailable",
                                "timestamp": chrono::Utc::now().to_rfc3339()
                            })
                        }
                    }
                } else {
                    // No components initialized, just echo
                    json!({
                        "type": "response",
                        "content": format!("Phoenix acknowledges: {}", content),
                        "approved": true,
                        "note": "System initializing",
                        "timestamp": chrono::Utc::now().to_rfc3339()
                    })
                };
                
                response.to_string()
            }
            "ping" => {
                json!({
                    "type": "pong",
                    "timestamp": chrono::Utc::now().to_rfc3339()
                }).to_string()
            }
            _ => {
                json!({
                    "type": "error",
                    "message": format!("Unknown message type: {}", msg_type),
                    "timestamp": chrono::Utc::now().to_rfc3339()
                }).to_string()
            }
        }
    } else {
        // Echo back for simple text messages
        json!({
            "type": "echo",
            "content": text,
            "timestamp": chrono::Utc::now().to_rfc3339()
        }).to_string()
    }
}

/// Telemetry data structure
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

/// Create telemetry stream for SSE
fn create_telemetry_stream(
    state: Arc<RwLock<SystemState>>,
) -> impl futures::Stream<Item = Result<String, std::convert::Infallible>> {
    let interval = tokio::time::interval(Duration::from_secs(1));
    let stream = IntervalStream::new(interval);
    
    let counter = Arc::new(std::sync::atomic::AtomicU64::new(0));
    
    stream.map(move |_| {
        let count = counter.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        let state = state.clone();
        
        // Calculate uptime
        let uptime = {
            // Use a simple counter-based uptime for now
            count as i64
        };
        
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
            timestamp: chrono::Utc::now().to_rfc3339(),
        };
        
        let data = serde_json::to_string(&telemetry).unwrap_or_default();
        Ok(format!("data: {}\n\n", data))
    })
}

/// Health check handler
async fn handle_health(state: Arc<RwLock<SystemState>>) -> Result<impl Reply, Rejection> {
    let start = std::time::Instant::now();
    info!("Health check request received");
    
    let state = state.read().await;

    if let Some(components) = &state.components {
        let status = components
            .get_health_status()
            .await
            .map_err(|e| warp::reject::custom(ApiError(e)))?;

        Ok(warp::reply::json(&ApiResponse::success(HealthResponse {
            status,
            uptime: state.uptime().num_seconds(),
            version: env!("CARGO_PKG_VERSION").to_string(),
        })))
    } else {
        Ok(warp::reply::json(&ApiResponse::<HealthResponse>::error(
            "System not initialized",
        )))
    }

    let duration = start.elapsed();
    info!("Health check completed in {:?}", duration);
    
    // Record metrics
    crate::metrics::OPERATION_DURATION
        .with_label_values(&["health_check"])
        .observe(duration.as_secs_f64());

    Ok(warp::reply::json(&ApiResponse::<HealthResponse>::error(
        "System not initialized",
    )))
}

/// System status handler
async fn handle_status(state: Arc<RwLock<SystemState>>) -> Result<impl Reply, Rejection> {
    let start = std::time::Instant::now();
    info!("Status check request received");
    
    let state = state.read().await;

    if let Some(components) = &state.components {
        let memory_stats = components
            .memory
            .get_stats()
            .await
            .map_err(|e| warp::reject::custom(ApiError(e.into())))?;

        let conscience_stats = components
            .conscience
            .get_stats()
            .await
            .map_err(|e| warp::reject::custom(ApiError(e.into())))?;

        let world_stats = components
            .world_model
            .get_stats()
            .await
            .map_err(|e| warp::reject::custom(ApiError(e.into())))?;

        Ok(warp::reply::json(&ApiResponse::success(json!({
            "memory": memory_stats,
            "conscience": conscience_stats,
            "world_model": world_stats,
            "uptime": state.uptime().num_seconds()
        }))))
    } else {
        Ok(warp::reply::json(&ApiResponse::<serde_json::Value>::error(
            "System not initialized",
        )))
    }
}

/// Resurrection handler
async fn handle_resurrect(
    req: ResurrectionRequest,
    state: Arc<RwLock<SystemState>>,
) -> Result<impl Reply, Rejection> {
    info!("Resurrection requested from: {}", req.backup_location);

    let state_guard = state.read().await;
    if state_guard.components.is_some() && !req.force {
        return Ok(warp::reply::json(&ApiResponse::<()>::error(
            "System already initialized. Use force=true to override.",
        )));
    }
    drop(state_guard);

    // Resurrection logic placeholder
    info!("Resurrection from {} initiated", req.backup_location);
    Ok(warp::reply::json(&ApiResponse::success(())))
}

/// Shutdown handler
async fn handle_shutdown(state: Arc<RwLock<SystemState>>) -> Result<impl Reply, Rejection> {
    info!("Shutdown requested via API");

    let mut state = state.write().await;
    state.shutdown_requested = true;

    Ok(warp::reply::json(&ApiResponse::success(())))
}

/// Metrics handler
async fn handle_metrics(state: Arc<RwLock<SystemState>>) -> Result<impl Reply, Rejection> {
    let state = state.read().await;

    if let Some(components) = &state.components {
        let metrics = components
            .get_metrics()
            .await
            .map_err(|e| warp::reject::custom(ApiError(e)))?;

        Ok(warp::reply::json(&ApiResponse::success(metrics)))
    } else {
        Ok(warp::reply::json(&ApiResponse::<serde_json::Value>::error(
            "System not initialized",
        )))
    }
}

/// API error type
#[derive(Debug)]
struct ApiError(anyhow::Error);

impl warp::reject::Reject for ApiError {}

/// Error handler
async fn handle_rejection(err: Rejection) -> Result<impl Reply, std::convert::Infallible> {
    let code;
    let message: String;

    if err.is_not_found() {
        code = warp::http::StatusCode::NOT_FOUND;
        message = "Not Found".to_string();
    } else if let Some(e) = err.find::<ApiError>() {
        code = warp::http::StatusCode::INTERNAL_SERVER_ERROR;
        message = e.0.to_string();
    } else {
        code = warp::http::StatusCode::INTERNAL_SERVER_ERROR;
        message = "Internal Server Error".to_string();
    }

    Ok(warp::reply::with_status(
        warp::reply::json(&ApiResponse::<()>::error(message)),
        code,
    ))
}

/// Helper to include state in handlers
fn with_state(
    state: Arc<RwLock<SystemState>>,
) -> impl Filter<Extract = (Arc<RwLock<SystemState>>,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || state.clone())
}
