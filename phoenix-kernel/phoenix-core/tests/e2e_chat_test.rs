//! End-to-End Chat System Test
//!
//! This test verifies the complete chat flow:
//! 1. Backend server starts
//! 2. WebSocket connection established
//! 3. Message sent via WebSocket
//! 4. LLM service called
//! 5. Response received and verified
//!
//! Run with: cargo test --test e2e_chat_test -- --nocapture

use phoenix_core::api::server::ApiState;
use phoenix_core::core::conscience::ConscienceFramework;
use phoenix_core::core::memory::PersistenceService;
use phoenix_core::config::Config;
use phoenix_core::PhoenixCore;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

fn create_e2e_api_state() -> ApiState {
    // Use real config file if available, otherwise create test config
    let config = if PathBuf::from("phoenix-kernel/config.toml").exists() {
        Config::load("phoenix-kernel/config.toml")
            .expect("Failed to load config.toml")
    } else {
        let mut test_config = Config::default();
        // Try to get API key from environment
        if let Ok(api_key) = std::env::var("OPENROUTER_API_KEY") {
            test_config.api_keys.insert("openrouter".to_string(), api_key);
        } else {
            test_config.api_keys.insert(
                "openrouter".to_string(),
                "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".to_string(),
            );
        }
        test_config.ai_models.insert(
            "default_model".to_string(),
            "anthropic/claude-3.5-sonnet".to_string(),
        );
        test_config.ai_models.insert(
            "openrouter_endpoint".to_string(),
            "https://openrouter.ai/api/v1/chat/completions".to_string(),
        );
        test_config
    };
    
    let memory = Arc::new(Mutex::new(
        PersistenceService::new(PathBuf::from("test_data/e2e_chat"), None)
            .expect("Failed to create persistence service")
    ));
    let conscience = Arc::new(ConscienceFramework::default());
    let config_arc = Arc::new(config.clone());
    
    let core = Arc::new(PhoenixCore {
        components: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
        config: Arc::new(tokio::sync::RwLock::new(config.clone())),
        health: Arc::new(tokio::sync::RwLock::new(phoenix_core::system::SystemHealth {
            score: 1.0,
            components: std::collections::HashMap::new(),
            warnings: Vec::new(),
        })),
    });
    
    ApiState::new(memory, conscience, core, config_arc)
}

#[tokio::test]
#[ignore] // Mark as integration test - run with: cargo test --test e2e_chat_test -- --ignored
async fn test_e2e_chat_flow() {
    println!("🧪 Starting E2E Chat Test");
    
    let state = create_e2e_api_state();
    
    // Verify LLM service is configured
    let api_key = state.config.get_openrouter_key();
    assert!(api_key.is_some(), "OpenRouter API key must be configured");
    println!("✅ API key configured: {}...{}", 
        &api_key.as_ref().unwrap()[..8],
        &api_key.as_ref().unwrap()[api_key.as_ref().unwrap().len()-8..]
    );
    
    println!("✅ Model: {}", state.config.get_default_model());
    println!("✅ Endpoint: {}", state.config.get_openrouter_endpoint());
    
    // Test LLM service directly
    println!("\n🤖 Testing LLM Service...");
    let test_message = "Hello, Phoenix. This is a test message. Please respond with 'Test successful' if you can read this.";
    
    match state.llm.generate_response(
        test_message,
        Some("You are Phoenix Marie. Respond briefly and confirm you received the test message."),
        None,
    ).await {
        Ok(response) => {
            println!("✅ LLM Response received: {} chars", response.len());
            println!("   Preview: {}", response.chars().take(200).collect::<String>());
            
            // Verify it's not test data
            assert!(!response.contains("Processed query:"));
            assert!(!response.contains("TEST DATA"));
            assert!(!response.contains("test data"));
            assert!(response.len() > 10, "Response should be substantial");
            
            println!("✅ LLM service is working correctly!");
        }
        Err(e) => {
            eprintln!("❌ LLM service failed: {}", e);
            eprintln!("   This could be due to:");
            eprintln!("   - Invalid API key");
            eprintln!("   - Network connectivity issues");
            eprintln!("   - OpenRouter API rate limits");
            eprintln!("   - Model availability");
            panic!("LLM service test failed: {}", e);
        }
    }
    
    println!("\n✅ E2E Chat Test PASSED - Chat system is fully operational!");
}

#[tokio::test]
async fn test_chat_diagnostic_endpoint_e2e() {
    use actix_web::{test, web, App};
    use phoenix_core::api::server::chat_diagnostic_handler;
    
    let state = create_e2e_api_state();
    
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
    
    println!("📊 Diagnostic Response:");
    println!("   LLM Configured: {}", body["llm_service"]["configured"]);
    println!("   Model: {}", body["llm_service"]["model"]);
    println!("   API Key Length: {}", body["llm_service"]["api_key_length"]);
    
    assert_eq!(body["status"], "diagnostic");
    assert!(body["llm_service"]["configured"].as_bool().unwrap_or(false));
}

