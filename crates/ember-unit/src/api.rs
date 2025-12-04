use warp::Filter;
use uuid::Uuid;
use serde::{Deserialize, Serialize};

use crate::{
    engagement::{EngagementApi, EngagementConfig},
    c2_orchestrator::{C2Api, C2Command, DeploymentRequest},
    agent_manager::{AgentApi, AgentCommand, SpawnRequest},
    services::{ServicesApi, ClientRequirements, ReportRequest},
    safety::{SafetyApi, OperationRequest, ShutdownRequest},
    reporting::{ReportingApi, ReportRequest as ReportingRequest},
    error::EmberUnitError,
    network_scanner::{NetworkScannerApi, NetworkScanRequest, NetworkScanResult, ScanType},
};

/// Consolidated API endpoints for Ember Unit
pub struct EmberUnitApi;

impl EmberUnitApi {
    /// Combine all API routes into a single router
    pub fn routes() -> impl Filter<Extract = impl warp::Reply, Error = warp::Rejection> + Clone {
        // Engagement management endpoints
        let engagement_routes = EngagementApi::routes();
        
        // C2 orchestration endpoints
        let c2_routes = C2Api::routes();
        
        // Agent management endpoints
        let agent_routes = AgentApi::routes();
        
        // Professional services endpoints
        let services_routes = ServicesApi::routes();
        
        // Safety and ethics endpoints
        let safety_routes = SafetyApi::routes();
        
        // Reporting endpoints
        let reporting_routes = ReportingApi::routes();
        
        // Network scanning endpoints
        let network_scanner_routes = NetworkScannerApi::routes();
        
        // Combine all routes
        engagement_routes
            .or(c2_routes)
            .or(agent_routes)
            .or(services_routes)
            .or(safety_routes)
            .or(reporting_routes)
            .or(network_scanner_routes)
            .or(Self::health_check())
            .or(Self::status_endpoint())
    }

    /// Health check endpoint
    fn health_check() -> impl Filter<Extract = impl warp::Reply, Error = warp::Rejection> + Clone {
        warp::path!("health")
            .and(warp::get())
            .map(|| warp::reply::json(&HealthResponse {
                status: "healthy".to_string(),
                version: env!("CARGO_PKG_VERSION").to_string(),
                service: "ember-unit".to_string(),
            }))
    }

    /// Status endpoint
    fn status_endpoint() -> impl Filter<Extract = impl warp::Reply, Error = warp::Rejection> + Clone {
        warp::path!("status")
            .and(warp::get())
            .map(|| warp::reply::json(&StatusResponse {
                service: "ember-unit".to_string(),
                active_engagements: 0,
                total_findings: 0,
                system_status: "operational".to_string(),
                uptime: 0,
            }))
    }

    /// WebSocket endpoint for real-time engagement updates
    pub fn websocket_routes() -> impl Filter<Extract = impl warp::Reply, Error = warp::Rejection> + Clone {
        warp::path!("ws" / "ember-unit")
            .and(warp::ws())
            .map(|ws: warp::ws::Ws| {
                ws.on_upgrade(|socket| async move {
                    // Handle WebSocket connection for real-time updates
                    Self::handle_ember_unit_websocket(socket).await;
                })
            })
    }

    async fn handle_ember_unit_websocket(ws: warp::ws::WebSocket) {
        // Placeholder for WebSocket handling
        // This would handle real-time engagement updates, phase transitions, findings, etc.
        let (tx, mut rx) = ws.split();
        
        // Send welcome message
        let welcome = serde_json::json!({
            "type": "connected",
            "service": "ember-unit",
            "message": "Connected to Ember Unit WebSocket",
            "timestamp": chrono::Utc::now().to_rfc3339()
        });
        
        let _ = tx.send(warp::ws::Message::text(welcome.to_string())).await;
        
        // Handle incoming messages
        while let Some(result) = rx.next().await {
            match result {
                Ok(msg) => {
                    if msg.is_text() {
                        let text = msg.to_str().unwrap_or("");
                        tracing::info!("Ember Unit WebSocket received: {}", text);
                        
                        // Echo back for now
                        let _ = tx.send(warp::ws::Message::text(text.to_string())).await;
                    }
                }
                Err(e) => {
                    tracing::error!("WebSocket error: {}", e);
                    break;
                }
            }
        }
    }
}

/// Health check response
#[derive(Debug, Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    service: String,
}

/// Status response
#[derive(Debug, Serialize)]
struct StatusResponse {
    service: String,
    active_engagements: u32,
    total_findings: u32,
    system_status: String,
    uptime: u64,
}

/// WebSocket message types for Ember Unit
#[derive(Debug, Serialize, Deserialize)]
pub enum EmberUnitWebSocketMessage {
    EngagementUpdate {
        engagement_id: Uuid,
        phase: String,
        progress: f64,
        findings_count: u32,
    },
    PhaseTransition {
        engagement_id: Uuid,
        from_phase: String,
        to_phase: String,
        timestamp: String,
    },
    FindingDiscovered {
        engagement_id: Uuid,
        finding_id: Uuid,
        severity: String,
        title: String,
    },
    AgentStatus {
        engagement_id: Uuid,
        agent_id: Uuid,
        status: String,
        commands_executed: u32,
    },
    SafetyAlert {
        engagement_id: Uuid,
        alert_type: String,
        message: String,
        severity: String,
    },
    ReportGenerated {
        engagement_id: Uuid,
        report_id: Uuid,
        report_type: String,
        format: String,
    },
}

/// API error handling
#[derive(Debug)]
pub struct ApiError(EmberUnitError);

impl warp::reject::Reject for ApiError {}

/// Convert EmberUnitError to warp rejection
pub fn handle_rejection(err: warp::Rejection) -> Result<impl warp::Reply, std::convert::Infallible> {
    if let Some(ApiError(e)) = err.find::<ApiError>() {
        let code = match e {
            EmberUnitError::SafetyViolation(_) => warp::http::StatusCode::FORBIDDEN,
            EmberUnitError::EngagementError(_) => warp::http::StatusCode::NOT_FOUND,
            EmberUnitError::C2Error(_) => warp::http::StatusCode::BAD_REQUEST,
            EmberUnitError::AgentError(_) => warp::http::StatusCode::BAD_REQUEST,
            EmberUnitError::NetworkError(_) => warp::http::StatusCode::BAD_REQUEST,
            _ => warp::http::StatusCode::INTERNAL_SERVER_ERROR,
        };
        
        Ok(warp::reply::with_status(
            warp::reply::json(&serde_json::json!({
                "error": e.to_string(),
                "code": code.as_u16(),
            })),
            code,
        ))
    } else {
        Ok(warp::reply::with_status(
            warp::reply::json(&serde_json::json!({
                "error": "Internal server error",
                "code": 500,
            })),
            warp::http::StatusCode::INTERNAL_SERVER_ERROR,
        ))
    }
}

/// CORS configuration for API endpoints
pub fn cors() -> warp::cors::Builder {
    warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
        .allow_headers(vec!["Content-Type", "Authorization", "Accept"])
        .max_age(3600)
}

/// Main API server setup
pub async fn serve_api(port: u16) -> Result<(), EmberUnitError> {
    let routes = EmberUnitApi::routes()
        .with(cors())
        .recover(handle_rejection);
    
    tracing::info!("Starting Ember Unit API server on port {}", port);
    
    warp::serve(routes)
        .run(([0, 0, 0, 0], port))
        .await;
    
    Ok(())
}

/// Test client for API integration tests
#[cfg(test)]
pub mod test_client {
    use super::*;
    
    pub struct EmberUnitTestClient {
        base_url: String,
    }
    
    impl EmberUnitTestClient {
        pub fn new(base_url: &str) -> Self {
            Self {
                base_url: base_url.to_string(),
            }
        }
        
        pub async fn initiate_engagement(&self, config: EngagementConfig) -> Result<serde_json::Value, EmberUnitError> {
            // Placeholder for test client implementation
            Ok(serde_json::json!({
                "success": true,
                "engagement_id": Uuid::new_v4(),
                "message": "Test engagement initiated"
            }))
        }
        
        pub async fn spawn_agent(&self, request: SpawnRequest) -> Result<serde_json::Value, EmberUnitError> {
            // Placeholder for test client implementation
            Ok(serde_json::json!({
                "success": true,
                "agent_id": Uuid::new_v4(),
                "message": "Test agent spawned"
            }))
        }
        
        pub async fn generate_report(&self, request: ReportingRequest) -> Result<serde_json::Value, EmberUnitError> {
            // Placeholder for test client implementation
            Ok(serde_json::json!({
                "success": true,
                "report_id": Uuid::new_v4(),
                "message": "Test report generated"
            }))
        }
    }
}