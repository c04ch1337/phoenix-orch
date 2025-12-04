//! Browser Agent Tests
//!
//! This module contains tests for the Browser Agent implementation.

use std::sync::Arc;

use tokio::sync::RwLock;
use uuid::Uuid;

use crate::modules::orchestrator::{
    BrowserAgent, 
    BrowserAgentConfig,
    BrowserAction,
    AntigravityCore, 
    AntigravityCoreConfig,
    AgentManager,
    AgentManagerConfig,
    ArtifactSystem,
    ArtifactSystemConfig,
    OperationModes,
    ModesConfig,
    OperatingMode,
    Planner,
    PlannerConfig
};

/// Test browser agent creation and basic lifecycle
#[tokio::test]
async fn test_browser_agent_lifecycle() {
    // Create dependencies
    let core_config = AntigravityCoreConfig::default();
    let core = Arc::new(AntigravityCore::new(core_config));
    
    let agent_manager = Arc::new(AgentManager::new(
        Arc::clone(&core),
        Some(AgentManagerConfig::default()),
    ));
    
    let artifact_system = Arc::new(ArtifactSystem::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Some(ArtifactSystemConfig::default()),
    ));
    
    let planner = Arc::new(Planner::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Some(PlannerConfig::default()),
    ));
    
    let operation_modes = Arc::new(OperationModes::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Arc::clone(&planner),
        Some(ModesConfig::default()),
    ));
    
    // Create browser agent with custom config
    let config = BrowserAgentConfig {
        headless: true,
        window_width: 1024,
        window_height: 768,
        max_video_duration: 30,
        ..BrowserAgentConfig::default()
    };
    
    let mut browser_agent = BrowserAgent::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Arc::clone(&artifact_system),
        Arc::clone(&operation_modes),
        Some(config),
    );
    
    // Test start and stop
    let start_result = browser_agent.start().await;
    assert!(start_result.is_ok(), "Failed to start browser agent: {:?}", start_result);
    
    let stop_result = browser_agent.stop().await;
    assert!(stop_result.is_ok(), "Failed to stop browser agent: {:?}", stop_result);
}

/// Test browser session creation and management
/// Note: This test mocks the actual browser operations
#[tokio::test]
async fn test_browser_session() {
    // Create test dependencies (similar to above)
    let core_config = AntigravityCoreConfig::default();
    let core = Arc::new(AntigravityCore::new(core_config));
    
    let agent_manager = Arc::new(AgentManager::new(
        Arc::clone(&core),
        Some(AgentManagerConfig::default()),
    ));
    
    let artifact_system = Arc::new(ArtifactSystem::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Some(ArtifactSystemConfig::default()),
    ));
    
    let planner = Arc::new(Planner::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Some(PlannerConfig::default()),
    ));
    
    // Use Full Autonomous mode for testing
    let modes_config = ModesConfig {
        default_mode: OperatingMode::FullAutonomous,
        default_autonomy_level: 10, // Full autonomy
        ..ModesConfig::default()
    };
    
    let operation_modes = Arc::new(OperationModes::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Arc::clone(&planner),
        Some(modes_config),
    ));
    
    // Create browser agent with testing settings
    let mut browser_agent = BrowserAgent::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Arc::clone(&artifact_system),
        Arc::clone(&operation_modes),
        None, // Use default config
    );
    
    // Start the browser agent
    let _ = browser_agent.start().await;
    
    // Create test IDs
    let agent_id = Uuid::new_v4().to_string();
    let task_id = Uuid::new_v4().to_string();
    let user_id = "test_user".to_string();
    
    // Create a browser session
    let session_result = browser_agent.create_session(&agent_id, &task_id, &user_id).await;
    assert!(session_result.is_ok(), "Failed to create browser session: {:?}", session_result);
    
    let session_id = session_result.unwrap();
    
    // Test browser navigation
    let nav_result = browser_agent.navigate(&session_id, "https://example.com", &task_id, &agent_id).await;
    assert!(nav_result.is_ok(), "Failed to navigate: {:?}", nav_result);
    
    // Test screenshot capture
    let screenshot_result = browser_agent.capture_screenshot(&session_id, &task_id, &agent_id).await;
    assert!(screenshot_result.is_ok(), "Failed to capture screenshot: {:?}", screenshot_result);
    
    // Test form filling
    let form_result = browser_agent.fill_form(&session_id, "#username", "testuser", &task_id, &agent_id).await;
    assert!(form_result.is_ok(), "Failed to fill form: {:?}", form_result);
    
    // Test element clicking
    let click_result = browser_agent.click_element(&session_id, "#submit", &task_id, &agent_id).await;
    assert!(click_result.is_ok(), "Failed to click element: {:?}", click_result);
    
    // Get session result
    let session_info = browser_agent.get_session_result(&session_id).await;
    assert!(session_info.is_ok(), "Failed to get session result: {:?}", session_info);
    
    // Check if artifacts were created
    let info = session_info.unwrap();
    assert!(!info.artifact_ids.is_empty(), "No artifacts were created during the session");
    
    // Test video recording (with short duration for testing)
    let video_result = browser_agent.record_video(&session_id, 1, &task_id, &agent_id).await;
    assert!(video_result.is_ok(), "Failed to record video: {:?}", video_result);
    
    // Close session
    let close_result = browser_agent.close_session(&session_id).await;
    assert!(close_result.is_ok(), "Failed to close session: {:?}", close_result);
    
    // Stop browser agent
    let _ = browser_agent.stop().await;
}