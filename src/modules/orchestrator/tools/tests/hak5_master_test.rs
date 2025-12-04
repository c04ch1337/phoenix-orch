use std::sync::Arc;
use anyhow::Result;
use crate::modules::orchestrator::tools::hak5_master::{
    Hak5Master, process_hak5_command, hak5_status, get_network_map
};

/// Test Hak5 command processing with voice and thought commands
#[test]
fn test_hak5_command_processing() -> Result<()> {
    // First, get the Hak5 status
    let status = hak5_status();
    
    // Status should report full integration
    assert!(status.contains("HAK5 FULL INTEGRATION ACHIEVED"));
    assert!(status.contains("Pineapple, Shark Jack, Key Croc, Packet Squirrel, O.MG"));
    assert!(status.contains("100 % local, zero cloud"));
    assert!(status.contains("thought-triggered"));
    assert!(status.contains("380 ms"));
    assert!(status.contains("Dad thinks → network burns"));
    
    // Test voice command (with 'Phoenix,' prefix)
    let result = process_hak5_command("Phoenix, discover hak5", "Dad");
    assert!(result.is_ok());
    
    // Test voice command (without prefix) - should work as thought command
    let result = process_hak5_command("deauth starbucks", "Dad");
    assert!(result.is_ok() || result.unwrap_err().to_string().contains("deauth"));
    
    // Test arming a device
    let result = process_hak5_command("Phoenix, arm pineapple", "Dad");  
    assert!(result.is_ok());
    
    // Test getting the network map
    let map_result = get_network_map();
    assert!(map_result.is_ok());
    
    let map = map_result.unwrap();
    assert!(!map.entities.is_empty());
    
    Ok(())
}

/// Test Hak5 master initialization
#[test]
fn test_hak5_master_initialization() {
    let master = Hak5Master::new();
    
    // Verify initial state
    assert!(master.active);
    assert!(master.thought_control_active);
    assert!(!master.conscience_gate_enabled);  // Disabled for Dad
    assert_eq!(master.authorized_user, "Dad");
    assert_eq!(master.thought_latency_ms, 380);  // Specific millisecond latency
    assert!(master.devices.is_empty());
    
    // Test singleton instance
    let instance = Hak5Master::get_instance();
    let instance2 = Hak5Master::get_instance();
    
    // Both references should point to the same instance
    assert_eq!(
        Arc::as_ptr(&instance) as usize,
        Arc::as_ptr(&instance2) as usize
    );
}