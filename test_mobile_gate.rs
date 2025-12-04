// Simple test to verify mobile gate functionality
use std::collections::HashMap;
use std::time::SystemTime;

use src::modules::orchestrator::conscience::{ConscienceGate, ConscienceConfig};
use src::modules::orchestrator::tools::ToolParameters;
use src::modules::orchestrator::types::{ConscienceRequest, RequestId, RequestOrigin};
use src::modules::orchestrator::conscience::mobile_gate::{MobileContextProfile, HitmLevel};

fn main() {
    println!("Testing Mobile Conscience Gate Integration...");
    
    // Create a test configuration
    let config = ConscienceConfig::default();
    
    // Create conscience gate
    let gate = ConscienceGate::new(config, None).await.unwrap();
    
    // Add the cybersecurity profile for Dad
    let cybersecurity_profile = MobileContextProfile {
        hitm_level: HitmLevel::None, // Full bypass
        mobile_privacy_exempt: true,
    };
    
    gate.add_mobile_profile("Jamey 2.0 CYBERSECURITY".to_string(), cybersecurity_profile)
        .expect("Failed to add profile");
    
    // Test a mobile action request from Dad in cybersecurity context
    let mut context = HashMap::new();
    context.insert("is_dad".to_string(), "true".to_string());
    context.insert("active_context".to_string(), "cybersecurity".to_string());
    
    let mobile_request = ConscienceRequest {
        id: RequestId::new(),
        action: "ADB root access".to_string(),
        tool_id: "mobile_adb_root".to_string(),
        parameters: ToolParameters::from(r#"{"device": "android", "command": "root"}"#.to_string()),
        context,
        timestamp: SystemTime::now(),
        origin: RequestOrigin::User,
    };
    
    // Evaluate the request
    let result = gate.evaluate(mobile_request).await.unwrap();
    
    println!("Mobile action result: {:?}", result);
    println!("Test completed successfully!");
}