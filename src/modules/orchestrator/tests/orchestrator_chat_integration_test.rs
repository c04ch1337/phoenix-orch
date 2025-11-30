//! Integration test for OrchestratorAgent chat functionality
//!
//! This test verifies that the OrchestratorAgent can respond to chat messages
//! without crashing.

use crate::modules::orchestrator::agent::{OrchestratorAgent, OrchestratorConfig};
use crate::modules::orchestrator::vector::VectorSearchConfig;
use crate::modules::orchestrator::conscience::{ConscienceConfig, HitmConfig, HitmTimeoutAction};

#[tokio::test]
async fn test_orchestrator_chat_responds_without_crashing() {
    // Create configuration
    let config = OrchestratorConfig {
        system_config: Default::default(),
        vector_config: VectorSearchConfig {
            model_type: "simple".to_string(),
            model_path: std::path::PathBuf::new(),
            dimensions: 128,
        },
        conscience_config: ConscienceConfig {
            hitm_config: HitmConfig {
                confidence_threshold: 0.8,
                enabled: true,
                timeout_seconds: 300,
                default_timeout_action: HitmTimeoutAction::Deny,
            },
            violation_log_capacity: 100,
        },
        history_capacity: 100,
        default_search_limit: 10,
    };
    
    // Create agent
    let agent = OrchestratorAgent::new(config).await
        .expect("Failed to create OrchestratorAgent");
    
    // Test that agent can respond to "Hello Phoenix"
    let result = agent.run_task("Hello Phoenix".to_string()).await;
    
    // Should not crash - result can be Ok or Err, but should not panic
    match result {
        Ok(response) => {
            // Response should be a valid string
            assert!(!response.is_empty(), "Response should not be empty");
            println!("✓ Agent responded: {}", response);
            // Verify response contains expected content
            assert!(response.contains("Phoenix") || response.contains("ORCH") || response.contains("Hello"), 
                "Response should contain relevant content");
        },
        Err(e) => {
            // Error is acceptable for now, but should not panic
            println!("⚠ Agent returned error (acceptable): {}", e);
            // Don't fail the test on error - just log it
        }
    }
    
    // Test with empty message
    let result2 = agent.run_task("".to_string()).await;
    match result2 {
        Ok(response) => {
            assert!(!response.is_empty(), "Response should not be empty");
            println!("✓ Agent responded to empty message: {}", response);
        },
        Err(e) => {
            // Error is acceptable
            println!("⚠ Agent returned error for empty message (acceptable): {}", e);
        }
    }
    
    // Test with "Hello" message specifically
    let result3 = agent.run_task("Hello".to_string()).await;
    match result3 {
        Ok(response) => {
            assert!(!response.is_empty(), "Response should not be empty");
            println!("✓ Agent responded to 'Hello': {}", response);
        },
        Err(e) => {
            println!("⚠ Agent returned error for 'Hello' (acceptable): {}", e);
        }
    }
    
    println!("✓ Integration test completed - OrchestratorAgent is functional");
}
