use std::sync::Arc;
use anyhow::Result;
use crate::modules::orchestrator::tools::hardware_master::{
    HardwareMaster, process_hardware_command, hardware_status
};

/// Test hardware command processing with voice and thought commands
#[test]
fn test_hardware_command_processing() -> Result<()> {
    // First, get the hardware status
    let status = hardware_status();
    
    // Status should report total hardware ownership
    assert!(status.contains("total hardware ownership"));
    assert!(status.contains("100% controlled"));
    assert!(status.contains("Thought-to-hardware latency: 187 ms average"));
    assert!(status.contains("Conscience gate: Dad only"));
    assert!(status.contains("Status: LIVE"));
    
    // Test voice command (with 'Phoenix,' prefix)
    let result = process_hardware_command("Phoenix, eject USB", "Dad");
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), "All USB devices ejected");
    
    // Test voice command (without prefix)
    let result = process_hardware_command("eject USB", "Dad");
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), "All USB devices ejected");
    
    // Test HDMI command
    let result = process_hardware_command("Phoenix, turn off monitor", "Dad");
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), "Monitor turned off via HDMI-CEC");
    
    // Test Wi-Fi command
    let result = process_hardware_command("Phoenix, create rogue AP", "Dad");
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), "Created Wi-Fi access point 'Phoenix' with secure password");
    
    // Test USB fast charging command
    let result = process_hardware_command("Phoenix, charge phone fast", "Dad");
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), "USB fast charging enabled (up to 100W)");
    
    // Test GPU command
    let result = process_hardware_command("Phoenix, flash GPU firmware", "Dad");
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), "GPU firmware updated successfully");
    
    // Test thought-based command (direct interpretation)
    let result = process_hardware_command("flash gpu", "Dad");
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), "GPU firmware updated successfully");
    
    // Test conscience gate - only Dad should be allowed
    let result = process_hardware_command("eject USB", "Unauthorized");
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("Conscience gate authorization failure"));
    
    Ok(())
}

/// Test hardware master instance initialization
#[test]
fn test_hardware_master_initialization() {
    let master = HardwareMaster::new();
    
    // Verify initial state
    assert_eq!(master.thought_latency_ms, 187);
    assert!(master.thought_control_active);
    assert!(master.conscience_gate_authorized);
    assert_eq!(master.authorized_user, "Dad");
    
    // Test singleton instance
    let instance = HardwareMaster::get_instance();
    let instance2 = HardwareMaster::get_instance();
    
    // Both references should point to the same instance
    assert_eq!(
        Arc::as_ptr(&instance) as usize,
        Arc::as_ptr(&instance2) as usize
    );
}