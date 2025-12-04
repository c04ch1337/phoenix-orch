//! Example Integration for Operation Modes and Autonomy System
//!
//! This example demonstrates how to initialize and use the Operation Modes
//! system with existing Antigravity components.

use std::sync::Arc;

use crate::modules::orchestrator::{
    antigravity_core::{AntigravityCore, AntigravityCoreConfig},
    agent_manager::{AgentManager, AgentManagerConfig},
    artifacts::{ArtifactSystem, ArtifactSystemConfig},
    planner::{Planner, PlannerConfig},
    modes::{OperationModes, ModesConfig, OperatingMode},
};

/// Initialize the modes system with the other components
///
/// This function demonstrates how to properly initialize the Operation Modes
/// system and integrate it with the existing Antigravity components.
pub async fn initialize_modes_system() -> Arc<OperationModes> {
    // Initialize the core components first
    let core_config = AntigravityCoreConfig::default();
    let core = Arc::new(AntigravityCore::new(core_config));
    
    // Start the Antigravity core
    core.start().await.expect("Failed to start Antigravity core");
    
    // Initialize the agent manager
    let agent_manager_config = AgentManagerConfig::default();
    let agent_manager = Arc::new(AgentManager::new(
        Arc::clone(&core),
        Some(agent_manager_config),
    ));
    
    // Start the agent manager
    let mut agent_manager_clone = AgentManager::new(
        Arc::clone(&core),
        Some(agent_manager_config),
    );
    agent_manager_clone.start().await.expect("Failed to start Agent Manager");
    
    // Initialize the artifact system
    let artifact_system_config = ArtifactSystemConfig::default();
    let artifact_system = Arc::new(ArtifactSystem::new(
        Arc::clone(&core),
        Some(artifact_system_config),
    ));
    
    // Start the artifact system
    let mut artifact_system_clone = ArtifactSystem::new(
        Arc::clone(&core),
        Some(artifact_system_config),
    );
    artifact_system_clone.start().await.expect("Failed to start Artifact System");
    
    // Initialize the planner system
    let planner_config = PlannerConfig::default();
    let planner = Arc::new(Planner::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Arc::clone(&artifact_system),
        Some(planner_config),
    ));
    
    // Start the planner system
    let mut planner_clone = Planner::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Arc::clone(&artifact_system),
        Some(planner_config),
    );
    planner_clone.start().await.expect("Failed to start Planner");
    
    // Now initialize the Operation Modes system
    let modes_config = ModesConfig {
        broadcast_capacity: 100,
        default_mode: OperatingMode::Planning,
        default_autonomy_level: 0,
    };
    
    let modes = Arc::new(OperationModes::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Arc::clone(&planner),
        Some(modes_config),
    ));
    
    // Start the Operation Modes system
    let mut modes_clone = OperationModes::new(
        Arc::clone(&core),
        Arc::clone(&agent_manager),
        Arc::clone(&planner),
        Some(modes_config),
    );
    modes_clone.start().await.expect("Failed to start Operation Modes");
    
    // Return the initialized modes system
    modes
}

/// Example task processing with autonomy levels
///
/// This function demonstrates how to process a task while respecting
/// the autonomy level settings.
pub async fn process_task_with_autonomy_control(
    modes: &OperationModes,
    task_id: &str,
    user_id: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // Get the effective operating mode for this user
    let mode = modes.get_user_operating_mode(user_id).await;
    
    // Get the effective autonomy level for this user
    let autonomy_level = modes.get_user_autonomy_level(user_id).await;
    
    println!("Processing task {} for user {}", task_id, user_id);
    println!("Operating mode: {:?}", mode);
    println!("Autonomy level: {}", autonomy_level);
    
    // Check if operations are allowed based on the autonomy level
    let can_access_files = modes.is_operation_allowed("file_write", user_id).await?;
    let can_execute_commands = modes.is_operation_allowed("command_execution", user_id).await?;
    let can_use_terminal = modes.is_operation_allowed("terminal_access", user_id).await?;
    let can_use_browser = modes.is_operation_allowed("browser_access", user_id).await?;
    
    println!("Permissions:");
    println!("  File access: {}", can_access_files);
    println!("  Command execution: {}", can_execute_commands);
    println!("  Terminal access: {}", can_use_terminal);
    println!("  Browser access: {}", can_use_browser);
    
    // Check if verification is required
    let requires_verification_for_commands = modes.requires_verification("command_execution", user_id).await?;
    
    println!("Requires verification for commands: {}", requires_verification_for_commands);
    
    // Example of how to enable fast mode for a task
    if mode == OperatingMode::Fast {
        modes.enable_fast_mode_for_task(task_id, user_id).await?;
        println!("Fast mode enabled for task {}", task_id);
    }
    
    // Example of handling thought commands
    process_thought_command("Phoenix, fast mode this task", modes, task_id, user_id).await?;
    
    Ok(())
}

/// Example of processing a thought command
async fn process_thought_command(
    command_text: &str,
    modes: &OperationModes,
    task_id: &str,
    user_id: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // Process fast mode command if detected
    if command_text.to_lowercase().contains("phoenix, fast mode this task") {
        println!("Fast mode command detected: {}", command_text);
        
        // Use the helper function to process the command
        let processed = crate::modules::orchestrator::modes::process_fast_mode_command(
            command_text,
            modes,
            task_id,
            user_id,
        ).await?;
        
        if processed {
            println!("Successfully processed fast mode command");
        }
    }
    
    Ok(())
}

/// Example of creating a new agent with proper autonomy controls
pub async fn create_agent_with_autonomy_controls(
    agent_manager: &AgentManager,
    modes: &OperationModes,
    name: &str,
    agent_type: crate::modules::orchestrator::antigravity_core::AgentType,
    user_id: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    // Check if the user has permission to create agents
    let can_create_agents = modes.is_operation_allowed("agent_creation", user_id).await?;
    
    if !can_create_agents {
        return Err(Box::new(std::io::Error::new(
            std::io::ErrorKind::PermissionDenied,
            "User does not have permission to create agents",
        )));
    }
    
    // Create the agent
    let agent_id = agent_manager.create_agent(
        name.to_string(),
        agent_type,
        None,
    ).await?;
    
    // Apply the proper autonomy settings to the agent
    let autonomy_level = modes.get_user_autonomy_level(user_id).await;
    println!("Created agent {} with autonomy level {}", agent_id, autonomy_level);
    
    Ok(agent_id)
}

/// Example of how to integrate the AutonomySlider frontend component
/// with the backend modes system
#[cfg(feature = "frontend-integration")]
pub fn integrate_autonomy_slider() {
    // This would typically be part of a Tauri command or API endpoint
    // that the frontend AutonomySlider.tsx component would call
    
    // Example React component usage:
    /*
    // In a React component:
    import { AutonomySlider } from '../components/mode/AutonomySlider';
    
    function TaskPage() {
        const { taskId } = useParams();
        const { user } = useAuth();
        
        const handleAutonomyChange = (level, fastMode) => {
            console.log(`Autonomy level changed to ${level}, fast mode: ${fastMode}`);
            // Make API call to backend
        };
        
        return (
            <div>
                <h1>Task Details</h1>
                <AutonomySlider 
                    taskId={taskId}
                    userId={user.id}
                    initialLevel={5}
                    initialFastMode={false}
                    onChange={handleAutonomyChange}
                />
            </div>
        );
    }
    */
}