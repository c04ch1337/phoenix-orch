//! Integration tests for the Chat WebSocket system
//!
//! These tests verify the complete chat flow:
//! - WebSocket connection
//! - Message sending and receiving
//! - LLM service integration
//! - Memory storage
//! - Error handling

use actix_web::{test, web, App};
use phoenix_core::api::server::{ApiState, ws_handler, chat_diagnostic_handler, query_handler};
use phoenix_core::core::conscience::ConscienceFramework;
use phoenix_core::core::memory::PersistenceService;
use phoenix_core::config::Config;
use phoenix_core::PhoenixCore;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Create test API state with mock LLM service
fn create_test_api_state() -> ApiState {
    let memory = Arc::new(Mutex::new(
        PersistenceService::new(PathBuf::from("test_data/chat"), None)
            .expect("Failed to create test persistence service")
    ));
    let conscience = Arc::new(ConscienceFramework::default());
    
    // Create test config with API key
    let mut test_config = Config::default();
    test_config.api_keys.insert(
        "openrouter".to_string(),
        "test-api-key-for-testing".to_string(),
    );
    test_config.ai_models.insert(
        "default_model".to_string(),
        "anthropic/claude-3.5-sonnet".to_string(),
    );
    test_config.ai_models.insert(
        "openrouter_endpoint".to_string(),
        "https://openrouter.ai/api/v1/chat/completions".to_string(),
    );
    let config = Arc::new(test_config);
    
    let core = Arc::new(PhoenixCore {
        components: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
        config: Arc::new(tokio::sync::RwLock::new(config.clone())),
        health: Arc::new(tokio::sync::RwLock::new(phoenix_core::system::SystemHealth {
            score: 1.0,
            components: std::collections::HashMap::new(),
            warnings: Vec::new(),
        })),
    });
    
    ApiState::new(memory, conscience, core, config)
}

#[actix_web::test]
async fn test_websocket_connection() {
    let state = create_test_api_state();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .route("/ws/dad", web::get().to(ws_handler))
    ).await;
    
    let req = test::TestRequest::get()
        .uri("/ws/dad")
        .to_request();
    
    // WebSocket upgrade should succeed
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success() || resp.status() == 101); // 101 Switching Protocols
}

#[actix_web::test]
async fn test_chat_diagnostic_endpoint() {
    let state = create_test_api_state();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .route("/api/v1/chat/diagnostic", web::get().to(chat_diagnostic_handler))
    ).await;
    
    let req = test::TestRequest::get()
        .uri("/api/v1/chat/diagnostic")
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    
    let body: serde_json::Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "diagnostic");
    assert!(body["llm_service"]["configured"].as_bool().unwrap_or(false));
    assert_eq!(body["llm_service"]["model"], "anthropic/claude-3.5-sonnet");
}

#[actix_web::test]
async fn test_query_endpoint_uses_llm() {
    let state = create_test_api_state();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .route("/query", web::post().to(query_handler))
    ).await;
    
    let req = test::TestRequest::post()
        .uri("/query")
        .set_json(&serde_json::json!({
            "query": "Hello, Phoenix"
        }))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    // Should either succeed (if LLM works) or return error (if API key invalid)
    // But should NOT return "Processed query: Hello, Phoenix" (test data)
    assert!(resp.status().is_success() || resp.status().is_client_error());
    
    if resp.status().is_success() {
        let body: serde_json::Value = test::read_body_json(resp).await;
        let response_text = body["response"].as_str().unwrap_or("");
        
        // Verify it's NOT test data
        assert!(!response_text.contains("Processed query:"));
        assert!(!response_text.contains("TEST"));
        assert!(!response_text.contains("test data"));
    }
}

#[tokio::test]
async fn test_llm_service_initialization() {
    use phoenix_core::core::llm::LlmService;
    
    let mut test_config = Config::default();
    test_config.api_keys.insert(
        "openrouter".to_string(),
        "test-key".to_string(),
    );
    test_config.ai_models.insert(
        "default_model".to_string(),
        "anthropic/claude-3.5-sonnet".to_string(),
    );
    test_config.ai_models.insert(
        "openrouter_endpoint".to_string(),
        "https://openrouter.ai/api/v1/chat/completions".to_string(),
    );
    
    // Should initialize successfully with valid config
    let llm_service = LlmService::new(&test_config);
    assert!(llm_service.is_ok());
    
    let service = llm_service.unwrap();
    assert_eq!(service.default_model, "anthropic/claude-3.5-sonnet");
}

#[tokio::test]
async fn test_llm_service_missing_api_key() {
    use phoenix_core::core::llm::LlmService;
    use phoenix_core::config::Config;
    
    let test_config = Config::default();
    
    // Should fail without API key
    let llm_service = LlmService::new(&test_config);
    assert!(llm_service.is_err());
    
    let error = llm_service.unwrap_err();
    assert!(format!("{}", error).contains("API key"));
}

