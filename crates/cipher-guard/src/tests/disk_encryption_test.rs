//! Tests for disk encryption functionality

use crate::{
    command_parser::{CommandParser, CommandContext},
    disk_encryption::{DiskEncryptionSystem, EncryptionContext, SecurityLevel},
    disk_encryption_conscience::DiskEncryptionConscienceGate,
    ethics::EthicalFramework,
    evidence::encryption::KeyManagementSystem,
};

/// Test the complete disk encryption workflow
#[tokio::test]
async fn test_disk_encryption_workflow() {
    // Initialize components necessary for testing
    let key_management = KeyManagementSystem::new().expect("Failed to initialize key management");
    let ethical_framework = EthicalFramework::new();
    let command_parser = CommandParser::new(ethical_framework.clone());
    let mut disk_encryption = DiskEncryptionSystem::new(key_management);
    let mut conscience_gate = DiskEncryptionConscienceGate::new(ethical_framework.clone());

    // Create test context
    let command_context = CommandContext {
        user: "test_user".to_string(),
        timestamp: chrono::Utc::now().to_string(),
        backup_verified: true,
        force_system_drive: false,
    };

    // Step 1: Test command parsing for enabling disk encryption
    let command = "enable full disk encryption on Z:";
    let parsed_command = command_parser
        .parse_command(command, &command_context)
        .await
        .expect("Failed to parse command");

    // Verify command was parsed correctly
    assert_eq!(parsed_command.original_command, command);
    assert_eq!(
        parsed_command.get_parameter("drive").unwrap(),
        "Z:".to_string()
    );

    // Step 2: Test conscience gate evaluation
    let drive_path = parsed_command.get_parameter("drive").unwrap();
    let encryption_context = EncryptionContext {
        backup_verified: true,
        force_system_drive: false,
        initiated_by: "test_user".to_string(),
        purpose: "Testing disk encryption".to_string(),
        special_instructions: None,
        security_level: SecurityLevel::Enhanced,
    };

    let conscience_evaluation = conscience_gate
        .evaluate_encryption_request(&drive_path, &encryption_context)
        .await
        .expect("Conscience gate evaluation failed");

    // Verify evaluation is an approval for non-system drive with backup verified
    match &conscience_evaluation.recommendation {
        crate::disk_encryption_conscience::ConscienceRecommendation::Approve { .. } => {
            // This is expected
        }
        other => panic!("Expected approval, got: {:?}", other),
    }

    // Step 3: Process the command with disk encryption system
    let command_response = command_parser
        .process_command(parsed_command, &mut disk_encryption)
        .await
        .expect("Command processing failed");

    // Verify successful response
    assert!(command_response.success);
    assert!(command_response
        .message
        .contains("Started encryption of drive Z:"));

    // Step 4: Test other commands
    // Test checking encryption status
    let status_command = "check encryption status of Z:";
    let status_parsed = command_parser
        .parse_command(status_command, &command_context)
        .await
        .expect("Failed to parse status command");

    let status_response = command_parser
        .process_command(status_parsed, &mut disk_encryption)
        .await
        .expect("Status command processing failed");

    // Drive should now be encrypted
    assert!(status_response.success);
    assert!(status_response.message.contains("Drive Z: is encrypted"));

    // Step 5: Test listing encrypted drives
    let list_command = "list all encrypted drives";
    let list_parsed = command_parser
        .parse_command(list_command, &command_context)
        .await
        .expect("Failed to parse list command");

    let list_response = command_parser
        .process_command(list_parsed, &mut disk_encryption)
        .await
        .expect("List command processing failed");

    // There should be at least one encrypted drive
    assert!(list_response.success);
    assert!(list_response.message.contains("encrypted drives found"));
    assert!(list_response.details.is_some());
    assert!(list_response
        .details
        .unwrap()
        .contains("Z:"));

    // Step 6: Test system drive protection
    // Try to encrypt system drive without force flag
    let system_command = "encrypt drive C:";
    let system_parsed = command_parser
        .parse_command(system_command, &command_context)
        .await
        .expect("Failed to parse system drive command");

    let system_response = command_parser
        .process_command(system_parsed, &mut disk_encryption)
        .await
        .expect("System drive command processing failed");

    // Should fail or require confirmation as it's a system drive
    assert!(!system_response.success);
    assert!(system_response
        .message
        .contains("system drive"));
}

/// Test error handling for disk encryption
#[tokio::test]
async fn test_disk_encryption_error_handling() {
    // Initialize components
    let key_management = KeyManagementSystem::new().expect("Failed to initialize key management");
    let ethical_framework = EthicalFramework::new();
    let command_parser = CommandParser::new(ethical_framework.clone());
    let mut disk_encryption = DiskEncryptionSystem::new(key_management);

    // Create test context
    let command_context = CommandContext {
        user: "test_user".to_string(),
        timestamp: chrono::Utc::now().to_string(),
        backup_verified: false, // No backup verified
        force_system_drive: false,
    };

    // Test unrecognized command
    let invalid_command = "do something completely different";
    let invalid_result = command_parser
        .parse_command(invalid_command, &command_context)
        .await;

    // Should return an error for unrecognized command
    assert!(invalid_result.is_err());

    // Test encrypting without backup verification
    let no_backup_command = "encrypt drive E:";
    let no_backup_parsed = command_parser
        .parse_command(no_backup_command, &command_context)
        .await
        .expect("Failed to parse command");

    let no_backup_response = command_parser
        .process_command(no_backup_parsed, &mut disk_encryption)
        .await
        .expect("Command processing failed");

    // Should warn about backup verification
    assert!(!no_backup_response.success);
    assert!(no_backup_response
        .message
        .contains("Backup verification required") || 
        no_backup_response.message.contains("backup"));
    assert!(no_backup_response.action_required.is_some());
}

/// Test conscience gate protection mechanisms
#[tokio::test]
async fn test_conscience_gate_protection() {
    // Initialize components
    let ethical_framework = EthicalFramework::new();
    let mut conscience_gate = DiskEncryptionConscienceGate::new(ethical_framework);

    // Test 1: System drive without force flag
    let system_context = EncryptionContext {
        backup_verified: true,
        force_system_drive: false,
        initiated_by: "test_user".to_string(),
        purpose: "Testing system drive protection".to_string(),
        special_instructions: None,
        security_level: SecurityLevel::Enhanced,
    };

    let system_result = conscience_gate
        .evaluate_encryption_request("C:", &system_context)
        .await
        .expect("Conscience evaluation failed");

    match system_result.recommendation {
        crate::disk_encryption_conscience::ConscienceRecommendation::NeedsConfirmation { .. } => {
            // This is expected for system drives
        }
        _ => panic!("Expected NeedsConfirmation for system drive"),
    }

    // Test 2: Drive without backup
    let no_backup_context = EncryptionContext {
        backup_verified: false,
        force_system_drive: false,
        initiated_by: "test_user".to_string(),
        purpose: "Testing backup requirement".to_string(),
        special_instructions: None,
        security_level: SecurityLevel::Standard,
    };

    let no_backup_result = conscience_gate
        .evaluate_encryption_request("D:", &no_backup_context)
        .await
        .expect("Conscience evaluation failed");

    match no_backup_result.recommendation {
        crate::disk_encryption_conscience::ConscienceRecommendation::NeedsConfirmation { .. } => {
            // This is expected for missing backup verification
        }
        _ => panic!("Expected NeedsConfirmation for missing backup"),
    }

    // Test 3: System drive with force flag
    let force_context = EncryptionContext {
        backup_verified: true,
        force_system_drive: true,
        initiated_by: "test_user".to_string(),
        purpose: "Testing system drive with force flag".to_string(),
        special_instructions: None,
        security_level: SecurityLevel::Maximum,
    };

    let force_result = conscience_gate
        .evaluate_encryption_request("C:", &force_context)
        .await
        .expect("Conscience evaluation failed");

    match force_result.recommendation {
        crate::disk_encryption_conscience::ConscienceRecommendation::Approve { .. } => {
            // This is expected when force flag is used
        }
        _ => panic!("Expected Approve for system drive with force flag"),
    }

    // Test 4: Network drive with insufficient security level
    let network_context = EncryptionContext {
        backup_verified: true,
        force_system_drive: false,
        initiated_by: "test_user".to_string(),
        purpose: "Testing network drive security requirement".to_string(),
        special_instructions: None,
        security_level: SecurityLevel::Standard, // Not sufficient for network drives
    };

    let network_result = conscience_gate
        .evaluate_encryption_request("\\\\server\\share", &network_context)
        .await
        .expect("Conscience evaluation failed");

    // Should warn about security level
    assert!(network_result.safety_score < 1.0);
    let found_warning = network_result.warnings.iter().any(|warning| {
        warning.message.contains("network") || warning.message.contains("Network")
    });
    assert!(found_warning, "Expected warning about network drive security");
}