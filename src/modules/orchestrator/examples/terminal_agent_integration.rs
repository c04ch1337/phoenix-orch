//! Terminal Agent Integration Example
//!
//! This example demonstrates how to integrate the Terminal Agent with the Agent Manager
//! and how agents can execute terminal commands through the system.

use crate::modules::orchestrator::agent_manager::{AgentManager, AgentManagerConfig};
use crate::modules::orchestrator::antigravity_core::{AntigravityCore, AntigravityCoreConfig, AgentType};
use crate::modules::orchestrator::artifacts::{ArtifactSystem, ArtifactSystemConfig};
use crate::modules::orchestrator::terminal_agent::{
    TerminalAgent, TerminalAgentConfig, TerminalAutonomyLevel, CommandStatus
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::time::Duration;

/// Example of how to set up and use the Terminal Agent
#[allow(dead_code)]
pub async fn terminal_agent_example() {
    // 1. Create the core components
    let core = Arc::new(AntigravityCore::new(AntigravityCoreConfig::default()));
    let agent_manager = Arc::new(AgentManager::new(Arc::clone(&core), None));
    let artifact_system = Arc::new(ArtifactSystem::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        None,
    ));

    // 2. Create and configure the Terminal Agent
    let terminal_config = TerminalAgentConfig {
        default_autonomy_level: TerminalAutonomyLevel::ApproveHighRisk,
        max_scrollback_size: 1024 * 1024, // 1MB scrollback buffer
        auto_store_history: true,
        command_timeout_seconds: 120, // 2 minutes timeout
        dangerous_command_patterns: vec![
            r"^sudo\s".to_string(),
            r"rm\s+(-r[f]*|-f[r]*)\s+/".to_string(),
            // Add more patterns as needed
        ],
        max_command_display_length: 100,
    };

    let terminal_agent = Arc::new(TerminalAgent::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Arc::clone(&artifact_system),
        Some(terminal_config),
    ));

    // 3. Start all the components
    core.start().await.expect("Failed to start Antigravity Core");
    agent_manager.start().await.expect("Failed to start Agent Manager");
    artifact_system.start().await.expect("Failed to start Artifact System");
    terminal_agent.start().await.expect("Failed to start Terminal Agent");

    println!("All components started successfully");

    // 4. Create a Phoenix agent that will use the terminal
    let agent_id = agent_manager
        .create_agent("CLI Assistant".to_string(), AgentType::Custom("Terminal".to_string()), None)
        .await
        .expect("Failed to create agent");

    println!("Created agent with ID: {}", agent_id);

    // 5. Set agent-specific terminal autonomy (optional)
    terminal_agent
        .set_agent_autonomy(&agent_id, TerminalAutonomyLevel::RequireApproval)
        .await
        .expect("Failed to set agent autonomy level");

    // 6. Create a task for the agent
    let task_id = agent_manager
        .create_task(
            "System Information".to_string(),
            "Collect system information using terminal commands".to_string(),
            Some(agent_id.clone()),
            Some(70), // Priority
            None,
        )
        .await
        .expect("Failed to create task");

    println!("Created task with ID: {}", task_id);

    // 7. Agent executes a simple (safe) terminal command
    let command_result = terminal_agent
        .execute_command(
            &agent_id,
            "echo 'Hello from Phoenix Terminal Agent'",
            None, // working directory defaults to current
            Some("Display greeting to verify terminal access"),
            Some(&task_id),
            None,
        )
        .await;

    match command_result {
        Ok(result) => {
            println!("Command executed successfully");
            println!("Stdout: {}", result.stdout);
            println!("Exit code: {:?}", result.exit_code);
            
            // 8. Analyze command output
            let analysis = terminal_agent.analyze_command_output(&result).await;
            println!("Command analysis: {:?}", analysis);
        }
        Err(e) => {
            println!("Command execution failed: {}", e);
        }
    }

    // 9. Show how to handle command approval
    // In a real application, this would be called by a UI component
    // when the user responds to the approval request
    let approve_command = tokio::spawn({
        let terminal_agent = Arc::clone(&terminal_agent);
        async move {
            // Get pending approvals
            tokio::time::sleep(Duration::from_millis(500)).await;
            let pending_approvals = terminal_agent.list_pending_approvals().await;
            
            for approval in pending_approvals {
                println!("Automatically approving command: {}", approval.command);
                
                // Approve the command (in a real app, this would be called after user interaction)
                terminal_agent
                    .respond_to_approval(&approval.command_id, true, None)
                    .await
                    .expect("Failed to approve command");
            }
        }
    });

    // 10. Execute a command that requires approval
    let risky_command = terminal_agent
        .execute_command(
            &agent_id,
            "sudo ls -la /etc",  // This requires approval due to 'sudo'
            None,
            Some("List system configuration files"),
            Some(&task_id),
            None,
        )
        .await;

    // Wait for the approval task
    let _ = approve_command.await;

    match risky_command {
        Ok(result) => {
            println!("Risky command executed successfully after approval");
            println!("Exit code: {:?}", result.exit_code);
        }
        Err(e) => {
            println!("Risky command execution failed: {}", e);
        }
    }

    // 11. List command history for this agent
    let command_history = terminal_agent
        .list_agent_commands(&agent_id, Some(5))  // Get the most recent 5 commands
        .await
        .expect("Failed to get command history");

    println!("Agent command history:");
    for cmd in command_history {
        println!("  - [{}] {} (Status: {})", 
            cmd.id,
            terminal_agent.truncate_command_for_display(&cmd.command),
            cmd.status
        );
    }

    // 12. Cleanup
    terminal_agent.stop().await.expect("Failed to stop Terminal Agent");
    artifact_system.stop().await.expect("Failed to stop Artifact System");
    agent_manager.stop().await.expect("Failed to stop Agent Manager");
    core.stop().await.expect("Failed to stop Antigravity Core");
    
    println!("All components stopped successfully");
}