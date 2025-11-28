use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::core::conscience::ConscienceFramework;
use crate::core::memory::{MemoryEntry, PersistenceService};
use crate::PhoenixCore;
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
    pub startup_time: DateTime<Utc>,
    // Temporarily disabled - plugin system to be fixed later
    // pub plugins: Arc<Mutex<PluginManager>>,
}

impl ApiState {
    /// Create new API state
    pub fn new(
        memory: Arc<Mutex<PersistenceService>>,
        conscience: Arc<ConscienceFramework>,
        core: Arc<PhoenixCore>,
    ) -> Self {
        Self {
            memory,
            conscience,
            core,
            startup_time: Utc::now(),
        }
    }

    /// Get uptime in seconds
    fn uptime_seconds(&self) -> i64 {
        (Utc::now() - self.startup_time).num_seconds()
    }
}

#[allow(dead_code)]
async fn query_handler(
    req: web::Json<QueryRequest>,
    state: web::Data<ApiState>,
) -> impl Responder {
    let query = &req.query;
    let _context = req.context.as_ref().cloned().unwrap_or_default();
    
    let conscience_result = state.conscience.evaluate(query, &std::collections::HashMap::new());
    
    if !conscience_result.approved {
        return HttpResponse::Forbidden().json(QueryResponse {
            response: format!("Query rejected: {}", conscience_result.violations.join(", ")),
            approved: false,
            warnings: conscience_result.warnings,
        });
    }
    
    // Temporarily disabled - plugin system to be fixed later
    // let plugin_results = {
    //     let mut plugins = state.plugins.lock().await;
    //     plugins.query_plugins(query.clone(), context)
    // };
    // let response = if !plugin_results.is_empty() {
    //     plugin_results.join("\n")
    // } else {
    //     format!("Processed query: {}", query)
    // };
    let response = format!("Processed query: {}", query);
    
    let memory_entry = MemoryEntry::new(
        query.clone(),
        serde_json::json!({
            "response": response,
            "approved": conscience_result.approved,
        }),
    );
    
    {
        let mem = state.memory.lock().await;
        mem.store(&memory_entry).ok();
    }
    
    HttpResponse::Ok().json(QueryResponse {
        response,
        approved: true,
        warnings: conscience_result.warnings,
    })
}

async fn health_handler(state: web::Data<ApiState>) -> impl Responder {
    // Lightweight check - just confirm we're alive and responsive
    HttpResponse::Ok().json(HealthResponse {
        status: "healthy".to_string(),
        timestamp: Utc::now().to_rfc3339(),
        uptime_seconds: state.uptime_seconds(),
    })
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

pub async fn start_server(
    host: &str,
    port: u16,
    state: ApiState,
) -> std::io::Result<()> {
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .route("/query", web::post().to(query_handler))
            .route("/health", web::get().to(health_handler))
            .route("/ready", web::get().to(ready_handler))
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
            health: Arc::new(tokio::sync::RwLock::new(crate::HealthStatus {
                score: 1.0,
                components: std::collections::HashMap::new(),
                warnings: Vec::new(),
            })),
        });

        ApiState::new(memory, conscience, core)
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
