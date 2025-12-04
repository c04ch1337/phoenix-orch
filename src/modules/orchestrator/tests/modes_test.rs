//! Unit Tests for Operation Modes
//!
//! Tests for the Operational Modes and Autonomy System

use std::sync::Arc;
use tokio::sync::RwLock;

use crate::modules::orchestrator::{
    modes::{OperationModes, ModesConfig, OperatingMode, process_fast_mode_command},
    agent_manager::AgentManager,
    antigravity_core::{AntigravityCore, AntigravityCoreConfig},
    planner::Planner,
    artifacts::ArtifactSystem,
};

use mockall::predicate::*;
use mockall::*;

// Mock dependencies for testing
mock! {
    AntigravityCore {}

    impl AntigravityCore {
        pub fn subscribe(&self) -> tokio::sync::broadcast::Receiver<crate::modules::orchestrator::antigravity_core::AntigravityEvent>;
        pub async fn update_task_status(
            &self, 
            task_id: &str,
            status: crate::modules::orchestrator::antigravity_core::TaskStatus,
            progress: Option<u8>,
            metadata_updates: Option<std::collections::HashMap<String, String>>,
        ) -> crate::modules::orchestrator::errors::PhoenixResult<()>;
    }
}

#[tokio::test]
async fn test_operation_modes_init() {
    // Create mocks
    let mut mock_core = MockAntigravityCore::new();
    let (tx, rx) = tokio::sync::broadcast::channel(10);
    mock_core.expect_subscribe().return_once(move || rx);
    
    // Create test configs
    let core = Arc::new(mock_core);
    let agent_manager = Arc::new(AgentManager::new(
        Arc::clone(&core),
        None,
    ));
    let artifact_system = Arc::new(ArtifactSystem::new(
        Arc::clone(&core),
        None,
    ));
    let planner = Arc::new(Planner::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Arc::clone(&artifact_system),
        None,
    ));
    
    // Test default config
    let modes = OperationModes::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Arc::clone(&planner),
        None,
    );
    
    // Verify default settings
    assert_eq!(modes.get_operating_mode().await, OperatingMode::Planning);
    assert_eq!(modes.get_autonomy_level().await, 0);
    
    // Test custom config
    let custom_config = ModesConfig {
        broadcast_capacity: 200,
        default_mode: OperatingMode::FullAutonomous,
        default_autonomy_level: 5,
    };
    
    let modes = OperationModes::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Arc::clone(&planner),
        Some(custom_config),
    );
    
    // Verify custom settings
    assert_eq!(modes.get_operating_mode().await, OperatingMode::FullAutonomous);
    assert_eq!(modes.get_autonomy_level().await, 5);
}

#[tokio::test]
async fn test_operation_modes_permissions() {
    // Create mocks
    let mut mock_core = MockAntigravityCore::new();
    let (tx, rx) = tokio::sync::broadcast::channel(10);
    mock_core.expect_subscribe().return_once(move || rx);
    
    // Create test instance
    let core = Arc::new(mock_core);
    let agent_manager = Arc::new(AgentManager::new(
        Arc::clone(&core),
        None,
    ));
    let artifact_system = Arc::new(ArtifactSystem::new(
        Arc::clone(&core),
        None,
    ));
    let planner = Arc::new(Planner::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Arc::clone(&artifact_system),
        None,
    ));
    
    let modes = OperationModes::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Arc::clone(&planner),
        None,
    );
    
    // Set autonomy level to 0 and check permissions
    modes.set_autonomy_level(0, None).await.unwrap();
    let perms = modes.get_permissions().await;
    assert_eq!(perms.file_access, false);
    assert_eq!(perms.command_execution, false);
    assert_eq!(perms.terminal_access, false);
    assert_eq!(perms.browser_access, false);
    assert_eq!(perms.requires_verification, true);
    
    // Set autonomy level to 5 and check permissions
    modes.set_autonomy_level(5, None).await.unwrap();
    let perms = modes.get_permissions().await;
    assert_eq!(perms.file_access, true);
    assert_eq!(perms.command_execution, true);
    assert_eq!(perms.terminal_access, true);
    assert_eq!(perms.browser_access, true);
    assert_eq!(perms.requires_verification, true);
    
    // Set autonomy level to 10 and check permissions
    modes.set_autonomy_level(10, None).await.unwrap();
    let perms = modes.get_permissions().await;
    assert_eq!(perms.file_access, true);
    assert_eq!(perms.command_execution, true);
    assert_eq!(perms.terminal_access, true);
    assert_eq!(perms.browser_access, true);
    assert_eq!(perms.requires_verification, false);
}

#[tokio::test]
async fn test_operation_modes_user_specific() {
    // Create mocks
    let mut mock_core = MockAntigravityCore::new();
    let (tx, rx) = tokio::sync::broadcast::channel(10);
    mock_core.expect_subscribe().return_once(move || rx);
    
    // Create test instance
    let core = Arc::new(mock_core);
    let agent_manager = Arc::new(AgentManager::new(
        Arc::clone(&core),
        None,
    ));
    let artifact_system = Arc::new(ArtifactSystem::new(
        Arc::clone(&core),
        None,
    ));
    let planner = Arc::new(Planner::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Arc::clone(&artifact_system),
        None,
    ));
    
    let modes = OperationModes::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Arc::clone(&planner),
        None,
    );
    
    // Global settings
    modes.set_operating_mode(OperatingMode::Planning, None).await.unwrap();
    modes.set_autonomy_level(3, None).await.unwrap();
    
    // User-specific overrides
    modes.set_user_operating_mode("user1", OperatingMode::Fast).await.unwrap();
    modes.set_user_autonomy_level("user1", 7).await.unwrap();
    modes.set_user_operating_mode("user2", OperatingMode::FullAutonomous).await.unwrap();
    modes.set_user_autonomy_level("user2", 10).await.unwrap();
    
    // Check global settings
    assert_eq!(modes.get_operating_mode().await, OperatingMode::Planning);
    assert_eq!(modes.get_autonomy_level().await, 3);
    
    // Check user1 settings
    assert_eq!(modes.get_user_operating_mode("user1").await, OperatingMode::Fast);
    assert_eq!(modes.get_user_autonomy_level("user1").await, 7);
    
    // Check user2 settings
    assert_eq!(modes.get_user_operating_mode("user2").await, OperatingMode::FullAutonomous);
    assert_eq!(modes.get_user_autonomy_level("user2").await, 10);
    
    // Check non-existent user (should get global settings)
    assert_eq!(modes.get_user_operating_mode("user3").await, OperatingMode::Planning);
    assert_eq!(modes.get_user_autonomy_level("user3").await, 3);
}

#[tokio::test]
async fn test_fast_mode_command() {
    // Create mocks
    let mut mock_core = MockAntigravityCore::new();
    let (tx, rx) = tokio::sync::broadcast::channel(10);
    mock_core.expect_subscribe().return_once(move || rx);
    
    // Configure update_task_status mock
    let task_id = "task-123";
    let user_id = "user-456";
    mock_core
        .expect_update_task_status()
        .with(
            eq(task_id),
            always(),
            always(),
            always(),
        )
        .times(1)
        .returning(|_, _, _, _| Ok(()));
    
    // Create test instance
    let core = Arc::new(mock_core);
    let agent_manager = Arc::new(AgentManager::new(
        Arc::clone(&core),
        None,
    ));
    let artifact_system = Arc::new(ArtifactSystem::new(
        Arc::clone(&core),
        None,
    ));
    let planner = Arc::new(Planner::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Arc::clone(&artifact_system),
        None,
    ));
    
    let modes = OperationModes::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Arc::clone(&planner),
        None,
    );
    
    // Test no-match command
    let result = process_fast_mode_command("some other command", &modes, task_id, user_id).await.unwrap();
    assert_eq!(result, false);
    
    // Test matching command
    let result = process_fast_mode_command("Phoenix, fast mode this task", &modes, task_id, user_id).await.unwrap();
    assert_eq!(result, true);
    
    // Verify the mode was set correctly
    assert_eq!(modes.get_user_operating_mode(user_id).await, OperatingMode::Fast);
}