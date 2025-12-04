use std::sync::Arc;
use tokio::test;

use crate::modules::orchestrator::OrchestratorAgent;
use crate::modules::orchestrator::tauri::invoke_orchestrator_task;
use tauri::State;
use serde_json::{Value, json};

#[tokio::test]
async fn test_show_me_all_network_drives_command() {
    // Create a test orchestrator agent
    let orchestrator = Arc::new(OrchestratorAgent::new_test_instance());
    let state = State::new(orchestrator);
    
    // Test variations of the "show me all network drives" command
    let variations = vec![
        "show me all network drives",
        "list network drives",
        "get network drives",
        "show network drives",
        "list me all the network drives"
    ];
    
    for command in variations {
        println!("Testing command: '{}'", command);
        let response = invoke_orchestrator_task(command.to_string(), state.clone()).await.unwrap();
        
        // Command should succeed
        assert!(response.success, "Command '{}' failed", command);
        assert!(response.result.is_some(), "No result returned for '{}'", command);
        
        // Parse the result
        let result_json: Value = serde_json::from_str(&response.result.unwrap()).unwrap();
        
        // It should have the proper fields
        assert!(result_json.get("formatted").is_some(), "Missing 'formatted' field");
        assert!(result_json.get("drives").is_some(), "Missing 'drives' field");
        assert!(result_json.get("count").is_some(), "Missing 'count' field");
    }
    
    println!("All network drives command variations passed");
}

#[tokio::test]
async fn test_no_network_drives_error_handling() {
    // Create a special test orchestrator agent that returns no network drives
    let orchestrator = Arc::new(OrchestratorAgent::new_test_instance_with_mock_drives(vec![]));
    let state = State::new(orchestrator);
    
    let response = invoke_orchestrator_task("show me all network drives".to_string(), state).await.unwrap();
    
    // Command should indicate failure
    assert!(!response.success, "Should fail when no network drives exist");
    assert!(response.error.is_some(), "No error message for missing network drives");
    assert!(response.error.unwrap().contains("No network drives found"), 
        "Error message should indicate no network drives found");
}