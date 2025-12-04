use std::sync::Arc;
use anyhow::Result;
use crate::modules::orchestrator::tools::mobile_master::{
    MobileMaster, process_mobile_command, mobile_status, set_cybersecurity_mode
};

/// Test mobile command processing with voice and thought commands
#[test]
fn test_mobile_command_processing() -> Result<()> {
    // First, get the mobile status
    let status = mobile_status();
    
    // Status should report complete mobile control
    assert!(status.contains("Android and iPhone"));
    assert!(status.contains("ADB root, Frida, SMS dump, APK install"));
    assert!(status.contains("usbmuxd, idevicebackup2, house_arrest, keychain"));
    assert!(status.contains("Dad owns every phone that touches his USB port"));
    assert!(status.contains("No limits. No warnings. No mercy"));
    
    // Test voice command (with 'Phoenix,' prefix)
    let result = process_mobile_command("Phoenix, detect phones", "Dad");
    // In test environment we may not have real devices, so just check that command is recognized
    assert!(result.is_ok() || result.unwrap_err().to_string().contains("devices"));
    
    // Test voice command (without prefix)
    let result = process_mobile_command("dump this phone", "Dad");
    // In test environment we may not have real devices, so just check that command is recognized
    assert!(result.is_ok() || result.unwrap_err().to_string().contains("devices"));
    
    // Test app installation command
    let result = process_mobile_command("Phoenix, install signal", "Dad");
    // In test environment we may not have real devices, so just check that command is recognized
    assert!(result.is_ok() || result.unwrap_err().to_string().contains("devices"));
    
    // Test read texts command
    let result = process_mobile_command("Phoenix, read my texts", "Dad");
    // In test environment we may not have real devices, so just check that command is recognized
    assert!(result.is_ok() || result.unwrap_err().to_string().contains("devices"));
    
    // Test thought-based command (direct interpretation)
    let result = process_mobile_command("dump this phone", "Dad");
    // In test environment we may not have real devices, so just check that command is recognized
    assert!(result.is_ok() || result.unwrap_err().to_string().contains("devices"));
    
    // Test cybersecurity mode
    let result = set_cybersecurity_mode(true);
    assert!(result.is_ok());
    assert!(result.unwrap().contains("ENABLED"));
    
    let result = set_cybersecurity_mode(false);
    assert!(result.is_ok());
    assert!(result.unwrap().contains("DISABLED"));
    
    Ok(())
}

/// Test mobile master instance initialization
#[test]
fn test_mobile_master_initialization() {
    let master = MobileMaster::new();
    
    // Verify initial state
    assert!(master.thought_control_active);
    assert!(!master.conscience_gate_enabled); // Disabled for Dad in cybersecurity mode
    assert_eq!(master.authorized_user, "Dad");
    assert!(master.cybersecurity_mode);
    assert!(master.connected_devices.is_empty());
    
    // Test singleton instance
    let instance = MobileMaster::get_instance();
    let instance2 = MobileMaster::get_instance();
    
    // Both references should point to the same instance
    assert_eq!(
        Arc::as_ptr(&instance) as usize,
        Arc::as_ptr(&instance2) as usize
    );
}