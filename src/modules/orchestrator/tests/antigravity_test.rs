//! Antigravity Integration Tests
//!
//! This module contains tests for the Antigravity integration components,
//! including the core Mission Control system and agent management.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::broadcast;

use crate::modules::orchestrator::antigravity_core::{
    AgentStatus, AgentType, AntigravityCore, AntigravityCoreConfig, TaskStatus,
};
use crate::modules::orchestrator::agent_manager::{AgentManager, AgentManagerConfig};

/// Test the basic functionality of the Antigravity Core
#[tokio::test]
async fn test_antigravity_core_basics() {
    // Create core with default config
    let config = AntigravityCoreConfig::default();
    let core = AntigravityCore::new(config);

    // Start the core
    assert!(core.start().await.is_ok());

    // Create an agent
    let agent_id = core
        .register_agent(
            "Test Agent".to_string(),
            AgentType::Custom("TestType".to_string()),
            None,
        )
        .await
        .unwrap();

    // Verify agent was created
    let agent = core.get_agent(&agent_id).await.unwrap();
    assert_eq!(agent.name, "Test Agent");
    assert_eq!(
        agent.agent_type,
        AgentType::Custom("TestType".to_string())
    );
    assert_eq!(agent.status, AgentStatus::Initializing);

    // Update agent status
    assert!(core
        .update_agent_status(&agent_id, AgentStatus::Idle, None)
        .await
        .is_ok());

    // Create a task
    let task_id = core
        .create_task(
            "Test Task".to_string(),
            "Task description".to_string(),
            None,
            Some(75),
            None,
        )
        .await
        .unwrap();

    // Assign task to agent
    assert!(core.assign_task(&task_id, &agent_id).await.is_ok());

    // Verify task assignment
    let task = core.get_task(&task_id).await.unwrap();
    assert_eq!(task.agent_id, Some(agent_id.clone()));

    // Update task status
    assert!(core
        .update_task_status(&task_id, TaskStatus::Running, Some(25), None)
        .await
        .is_ok());

    // Verify task status update
    let task = core.get_task(&task_id).await.unwrap();
    assert_eq!(task.status, TaskStatus::Running);
    assert_eq!(task.progress, 25);

    // Clean up
    assert!(core.stop().await.is_ok());
}

/// Test the Agent Manager functionality
#[tokio::test]
async fn test_agent_manager_operations() {
    // Create core
    let config = AntigravityCoreConfig::default();
    let core = Arc::new(AntigravityCore::new(config));

    // Start the core
    assert!(core.start().await.is_ok());

    // Create agent manager
    let manager_config = AgentManagerConfig {
        sse_host: "127.0.0.1".to_string(),
        sse_port: 3367, // Use a different port from default
        max_event_history: 50,
        health_check_interval_ms: 5000,
    };
    let mut manager = AgentManager::new(Arc::clone(&core), Some(manager_config));

    // Start the agent manager
    assert!(manager.start().await.is_ok());

    // Create an agent through the manager
    let ember_agent_id = manager
        .create_agent(
            "Ember Unit".to_string(),
            AgentType::EmberUnit,
            Some({
                let mut metadata = HashMap::new();
                metadata.insert("version".to_string(), "1.0".to_string());
                metadata
            }),
        )
        .await
        .unwrap();

    // Create another agent
    let cipher_agent_id = manager
        .create_agent(
            "Cipher Guard".to_string(),
            AgentType::CipherGuard,
            None,
        )
        .await
        .unwrap();

    // Verify agents were created
    let agents = manager.list_agents().await.unwrap();
    assert_eq!(agents.len(), 2);
    assert!(agents.iter().any(|a| a.name == "Ember Unit"));
    assert!(agents.iter().any(|a| a.name == "Cipher Guard"));

    // Create a task
    let task_id = manager
        .create_task(
            "Security Scan".to_string(),
            "Scan the system for vulnerabilities".to_string(),
            None,
            Some(90), // High priority
            None,
        )
        .await
        .unwrap();

    // Assign task to agent
    assert!(manager
        .assign_task(&task_id, &cipher_agent_id)
        .await
        .is_ok());

    // Update task status
    assert!(manager
        .update_task_status(&task_id, TaskStatus::Running, Some(10), None)
        .await
        .is_ok());

    // Pause agent
    let response = manager.pause_agent(&cipher_agent_id).await.unwrap();
    assert!(response.success);
    assert_eq!(response.agent_id, Some(cipher_agent_id.clone()));
    assert_eq!(response.task_id, Some(task_id.clone()));

    // Verify agent status
    let agent = manager.get_agent(&cipher_agent_id).await.unwrap();
    assert_eq!(agent.status, AgentStatus::Paused);

    // Verify task status
    let task = manager.get_task(&task_id).await.unwrap();
    assert_eq!(task.status, TaskStatus::Paused);

    // Resume agent
    let response = manager.resume_agent(&cipher_agent_id).await.unwrap();
    assert!(response.success);

    // Clean up
    assert!(manager.stop().await.is_ok());
    assert!(core.stop().await.is_ok());
}

/// Test the SSE broadcast functionality
#[tokio::test]
async fn test_antigravity_event_broadcasting() {
    // Create core
    let config = AntigravityCoreConfig::default();
    let core = Arc::new(AntigravityCore::new(config));

    // Start the core
    assert!(core.start().await.is_ok());

    // Subscribe to events
    let mut rx = core.subscribe();

    // Create an agent (should trigger an event)
    let agent_id = core
        .register_agent(
            "Event Test Agent".to_string(),
            AgentType::Orchestrator,
            None,
        )
        .await
        .unwrap();

    // Wait for event
    let event = tokio::time::timeout(Duration::from_secs(1), rx.recv())
        .await
        .unwrap()
        .unwrap();

    // Verify event
    assert_eq!(event.event_type, "agent_registered");
    assert_eq!(event.agent_id, Some(agent_id));

    // Update agent status (should trigger another event)
    assert!(core
        .update_agent_status(&agent_id, AgentStatus::Idle, None)
        .await
        .is_ok());

    // Wait for event
    let event = tokio::time::timeout(Duration::from_secs(1), rx.recv())
        .await
        .unwrap()
        .unwrap();

    // Verify event
    assert_eq!(event.event_type, "agent_status_update");
    assert_eq!(event.agent_id, Some(agent_id));

    // Create a task (should trigger an event)
    let task_id = core
        .create_task(
            "Event Test Task".to_string(),
            "Test task description".to_string(),
            Some(agent_id.clone()),
            None,
            None,
        )
        .await
        .unwrap();

    // Wait for event
    let event = tokio::time::timeout(Duration::from_secs(1), rx.recv())
        .await
        .unwrap()
        .unwrap();

    // Verify event
    assert_eq!(event.event_type, "task_created");
    assert_eq!(event.task_id, Some(task_id));

    // Clean up
    assert!(core.stop().await.is_ok());
}

/// Integration sample showing complete workflow
#[tokio::test]
async fn test_antigravity_integration_sample() {
    // 1. Initialize the core with custom configuration
    let config = AntigravityCoreConfig {
        max_task_history: 500,
        max_agents: 50,
        broadcast_capacity: 1000,
        task_queue_capacity: 100,
        agent_poll_interval_ms: 1000,
    };
    let core = Arc::new(AntigravityCore::new(config));
    assert!(core.start().await.is_ok());

    // 2. Initialize the agent manager
    let manager_config = AgentManagerConfig::default();
    let mut manager = AgentManager::new(Arc::clone(&core), Some(manager_config));
    assert!(manager.start().await.is_ok());

    // 3. Register agents
    let ember_agent_id = manager
        .create_agent(
            "Ember Unit".to_string(),
            AgentType::EmberUnit,
            Some({
                let mut metadata = HashMap::new();
                metadata.insert("version".to_string(), "1.0".to_string());
                metadata.insert("capabilities".to_string(), "network,webapp,api".to_string());
                metadata
            }),
        )
        .await
        .unwrap();

    let cipher_agent_id = manager
        .create_agent(
            "Cipher Guard".to_string(),
            AgentType::CipherGuard,
            Some({
                let mut metadata = HashMap::new();
                metadata.insert("version".to_string(), "2.1".to_string());
                metadata.insert(
                    "capabilities".to_string(),
                    "encryption,detection,prevention".to_string(),
                );
                metadata
            }),
        )
        .await
        .unwrap();

    // 4. Create tasks
    let security_scan_task = manager
        .create_task(
            "Security Scan".to_string(),
            "Perform comprehensive security scan of all systems".to_string(),
            None, // No agent assignment yet
            Some(80), // High priority
            Some({
                let mut metadata = HashMap::new();
                metadata.insert("scope".to_string(), "all_systems".to_string());
                metadata.insert("scan_depth".to_string(), "comprehensive".to_string());
                metadata
            }),
        )
        .await
        .unwrap();

    let penetration_test_task = manager
        .create_task(
            "Penetration Test".to_string(),
            "Perform penetration test on web application".to_string(),
            None, // No agent assignment yet
            Some(90), // Very high priority
            Some({
                let mut metadata = HashMap::new();
                metadata.insert("target".to_string(), "web_application".to_string());
                metadata.insert("test_type".to_string(), "blackbox".to_string());
                metadata
            }),
        )
        .await
        .unwrap();

    // 5. Assign tasks to agents
    assert!(manager
        .assign_task(&security_scan_task, &cipher_agent_id)
        .await
        .is_ok());

    assert!(manager
        .assign_task(&penetration_test_task, &ember_agent_id)
        .await
        .is_ok());

    // 6. Update task statuses to simulate progress
    let update_result = manager
        .update_task_status(
            &security_scan_task,
            TaskStatus::Running,
            Some(10),
            Some({
                let mut metadata = HashMap::new();
                metadata.insert("current_stage".to_string(), "initializing".to_string());
                metadata
            }),
        )
        .await;
    assert!(update_result.is_ok());

    let update_result = manager
        .update_task_status(
            &penetration_test_task,
            TaskStatus::Running,
            Some(25),
            Some({
                let mut metadata = HashMap::new();
                metadata.insert("current_stage".to_string(), "reconnaissance".to_string());
                metadata.insert("findings".to_string(), "2".to_string());
                metadata
            }),
        )
        .await;
    assert!(update_result.is_ok());

    // 7. Simulate pause and resume operations
    assert!(manager.pause_agent(&ember_agent_id).await.is_ok());
    assert!(manager.resume_agent(&ember_agent_id).await.is_ok());

    // 8. Complete one task
    let update_result = manager
        .update_task_status(
            &security_scan_task,
            TaskStatus::Completed,
            Some(100),
            Some({
                let mut metadata = HashMap::new();
                metadata.insert("issues_found".to_string(), "5".to_string());
                metadata.insert("critical_issues".to_string(), "1".to_string());
                metadata.insert("report_id".to_string(), "SEC-12345".to_string());
                metadata
            }),
        )
        .await;
    assert!(update_result.is_ok());

    // 9. List all agents and tasks to verify state
    let all_agents = manager.list_agents().await.unwrap();
    assert_eq!(all_agents.len(), 2);

    let all_tasks = manager.list_tasks().await.unwrap();
    assert_eq!(all_tasks.len(), 2);

    // Verify completed task
    let security_task = manager.get_task(&security_scan_task).await.unwrap();
    assert_eq!(security_task.status, TaskStatus::Completed);
    assert_eq!(security_task.progress, 100);

    // 10. Clean up
    assert!(manager.stop().await.is_ok());
    assert!(core.stop().await.is_ok());
}