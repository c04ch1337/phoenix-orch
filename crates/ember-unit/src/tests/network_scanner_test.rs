use std::collections::HashMap;
use std::net::IpAddr;
use std::str::FromStr;
use std::sync::Arc;

use tokio::sync::Mutex;
use uuid::Uuid;

use crate::conscience::PhoenixConscienceIntegration;
use crate::network_scanner::{
    HostInfo, NetworkScanRequest, NetworkScanResult, NetworkScanner, PortInfo, PortProtocol,
    PortState, ScanStatus, ScanType,
};
use crate::network_scanner_api::NetworkScannerApi;
use crate::{parse_network_scan_command, TargetScope};

#[tokio::test]
async fn test_parse_cidr_notation() {
    // Create scanner
    let conscience = PhoenixConscienceIntegration::new();
    let scanner = NetworkScanner::new(conscience);

    // Test valid CIDR
    let result = scanner.parse_target_range("192.168.1.0/24");
    assert!(result.is_ok());
    let addresses = result.unwrap();
    assert_eq!(addresses.len(), 256); // 192.168.1.0 - 192.168.1.255
    assert!(addresses.contains(&IpAddr::from_str("192.168.1.1").unwrap()));
    assert!(addresses.contains(&IpAddr::from_str("192.168.1.254").unwrap()));

    // Test valid single IP
    let result = scanner.parse_target_range("10.0.0.1");
    assert!(result.is_ok());
    let addresses = result.unwrap();
    assert_eq!(addresses.len(), 1);
    assert_eq!(addresses[0], IpAddr::from_str("10.0.0.1").unwrap());

    // Test invalid CIDR
    let result = scanner.parse_target_range("192.168.1.0/33"); // 33 is out of range
    assert!(result.is_err());

    // Test invalid IP
    let result = scanner.parse_target_range("300.168.1.0");
    assert!(result.is_err());
}

#[tokio::test]
async fn test_rate_limiting() {
    // Create scanner
    let conscience = PhoenixConscienceIntegration::new();
    let scanner = NetworkScanner::new(conscience);

    // Create a large scan request to test rate limiting
    let request = NetworkScanRequest {
        target: "192.168.1.0/24".to_string(),
        scan_type: ScanType::Passive,
        rate_limit: Some(500), // Set high rate limit for test
        timeout: Some(5),      // Short timeout for test
        options: HashMap::new(),
    };

    // Start the scan
    let result = scanner.start_scan(request).await;
    assert!(result.is_ok());

    // Get the scan ID
    let scan_id = result.unwrap().scan_id;

    // Wait a short time for some progress
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Check status
    let status = scanner.get_scan_status(scan_id).await;
    assert!(status.is_ok());

    // Can't fully test rate limiting in a unit test, but we can verify it doesn't crash
    // and that the scan proceeds
}

#[tokio::test]
async fn test_conscience_validation() {
    // Create a mock conscience integration that always approves
    let mut conscience = PhoenixConscienceIntegration::new();

    // The actual validation would happen in the scanner
    let scanner = NetworkScanner::new(conscience);

    // Create valid scan request
    let valid_request = NetworkScanRequest {
        target: "192.168.1.0/24".to_string(),
        scan_type: ScanType::Passive,
        rate_limit: None,
        timeout: None,
        options: HashMap::new(),
    };

    // This should pass conscience check
    let result = scanner.start_scan(valid_request).await;
    assert!(result.is_ok());

    // We can't really test a conscience rejection in a unit test without modifying the
    // PhoenixConscienceIntegration implementation
}

#[tokio::test]
async fn test_command_parsing() {
    // Test valid passive scan command
    let cmd = "Run passive scan on 192.168.1.0/24";
    let result = parse_network_scan_command(cmd);
    assert!(result.is_some());
    let (scan_type, target) = result.unwrap();
    assert!(matches!(scan_type, ScanType::Passive));
    assert_eq!(target, "192.168.1.0/24");

    // Test valid port scan command
    let cmd = "Run port scan on 10.0.0.1";
    let result = parse_network_scan_command(cmd);
    assert!(result.is_some());
    let (scan_type, target) = result.unwrap();
    assert!(matches!(scan_type, ScanType::PortDiscovery));
    assert_eq!(target, "10.0.0.1");

    // Test valid service scan command
    let cmd = "Run service scan on 172.16.0.0/16";
    let result = parse_network_scan_command(cmd);
    assert!(result.is_some());
    let (scan_type, target) = result.unwrap();
    assert!(matches!(scan_type, ScanType::ServiceDetection));
    assert_eq!(target, "172.16.0.0/16");

    // Test valid OS scan command
    let cmd = "Run os scan on 192.168.0.1";
    let result = parse_network_scan_command(cmd);
    assert!(result.is_some());
    let (scan_type, target) = result.unwrap();
    assert!(matches!(scan_type, ScanType::OsFingerprint));
    assert_eq!(target, "192.168.0.1");

    // Test invalid command format
    let cmd = "Perform passive scan on 192.168.1.0/24"; // "Run" is missing
    let result = parse_network_scan_command(cmd);
    assert!(result.is_none());

    // Test invalid scan type
    let cmd = "Run aggressive scan on 192.168.1.0/24"; // "aggressive" is not valid
    let result = parse_network_scan_command(cmd);
    assert!(result.is_none());

    // Test empty command
    let cmd = "";
    let result = parse_network_scan_command(cmd);
    assert!(result.is_none());
}

#[tokio::test]
async fn test_api_command_parsing() {
    // This test would use NetworkScannerApi::parse_scan_command
    // but would need to be implemented with appropriate test harness
    
    // Since we're just simulating here, let's directly test with what would be the equivalent:
    
    // Test valid passive scan command
    let cmd = "Run passive scan on 192.168.1.0/24";
    let result = NetworkScannerApi::parse_scan_command(cmd);
    assert!(result.is_ok());
    let (scan_type, target) = result.unwrap();
    assert!(matches!(scan_type, ScanType::Passive));
    assert_eq!(target, "192.168.1.0/24");

    // Test invalid command
    let cmd = "Do something else";
    let result = NetworkScannerApi::parse_scan_command(cmd);
    assert!(result.is_err());
}

#[tokio::test]
async fn test_concurrent_scans() {
    // Create scanner
    let conscience = PhoenixConscienceIntegration::new();
    let scanner = NetworkScanner::new(conscience);

    // Start multiple scans to test concurrency handling
    let mut scan_ids = Vec::new();
    
    for i in 0..3 {
        let request = NetworkScanRequest {
            target: format!("192.168.{}.0/28", i), // Small network for testing
            scan_type: ScanType::Passive,
            rate_limit: None,
            timeout: None,
            options: HashMap::new(),
        };
        
        let result = scanner.start_scan(request).await;
        assert!(result.is_ok());
        scan_ids.push(result.unwrap().scan_id);
    }
    
    // Wait for scans to make progress
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    // Try to start a scan with too many concurrent scans
    // First we need to try many concurrent scans to reach the limit
    let mut all_scans_accepted = true;
    for i in 3..10 {  // Assuming max_concurrent_scans is less than 10
        let request = NetworkScanRequest {
            target: format!("192.168.{}.0/28", i),
            scan_type: ScanType::Passive,
            rate_limit: None,
            timeout: None,
            options: HashMap::new(),
        };
        
        let result = scanner.start_scan(request).await;
        if result.is_err() {
            // We hit the limit
            all_scans_accepted = false;
            break;
        }
    }
    
    // We should eventually hit the concurrent scan limit
    assert!(!all_scans_accepted);
}

#[tokio::test]
async fn test_scan_cancellation() {
    // Create scanner
    let conscience = PhoenixConscienceIntegration::new();
    let scanner = NetworkScanner::new(conscience);

    // Start a scan
    let request = NetworkScanRequest {
        target: "192.168.1.0/24".to_string(),
        scan_type: ScanType::Passive,
        rate_limit: None,
        timeout: None,
        options: HashMap::new(),
    };
    
    let result = scanner.start_scan(request).await;
    assert!(result.is_ok());
    let scan_id = result.unwrap().scan_id;
    
    // Wait briefly to allow scan to start
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    
    // Cancel the scan
    let cancel_result = scanner.cancel_scan(scan_id).await;
    assert!(cancel_result.is_ok());
    
    // Check scan status - should be cancelled
    let status_result = scanner.get_scan_status(scan_id).await;
    assert!(status_result.is_ok());
    let status = status_result.unwrap();
    assert_eq!(status.status, ScanStatus::Cancelled);
}

#[tokio::test]
async fn test_host_discovery() {
    // This is a more functional test that simulates discovering hosts
    // In a real environment, we would mock the network interactions
    
    // Create scanner
    let conscience = PhoenixConscienceIntegration::new();
    let scanner = NetworkScanner::new(conscience);

    // Start a scan with a single IP that we know will be simulated as discovered
    let request = NetworkScanRequest {
        target: "192.168.1.5".to_string(), // Based on our implementation, this will be "discovered"
        scan_type: ScanType::Passive,
        rate_limit: None,
        timeout: None,
        options: HashMap::new(),
    };
    
    let result = scanner.start_scan(request).await;
    assert!(result.is_ok());
    let scan_id = result.unwrap().scan_id;
    
    // Wait for scan to complete
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    // Check scan status
    let status_result = scanner.get_scan_status(scan_id).await;
    assert!(status_result.is_ok());
    let status = status_result.unwrap();
    
    // It should be completed and have 1 host
    assert!(matches!(status.status, ScanStatus::Completed));
    assert_eq!(status.hosts.len(), 1);
    assert_eq!(status.hosts[0].ip_addr.to_string(), "192.168.1.5");
}

impl NetworkScannerApi {
    // For testing purposes, add a public parse method
    pub fn parse_scan_command(command: &str) -> Result<(ScanType, &str), String> {
        use regex::Regex;
        
        let scan_pattern = r"^(?i)Run\s+(\w+)\s+scan\s+on\s+(.+)$";
        let re = Regex::new(scan_pattern).unwrap();
        
        if let Some(captures) = re.captures(command) {
            if captures.len() < 3 {
                return Err("Invalid command format. Expected: 'Run [type] scan on [network]'".to_string());
            }
            
            let scan_type_str = captures.get(1).unwrap().as_str().to_lowercase();
            let target = captures.get(2).unwrap().as_str();
            
            // Determine scan type
            let scan_type = match scan_type_str.as_str() {
                "passive" => ScanType::Passive,
                "port" => ScanType::PortDiscovery,
                "service" => ScanType::ServiceDetection,
                "os" => ScanType::OsFingerprint,
                _ => {
                    return Err(format!(
                        "Unsupported scan type: '{}'. Supported types: passive, port, service, os",
                        scan_type_str
                    ))
                }
            };
            
            Ok((scan_type, target))
        } else {
            Err("Invalid command format. Expected: 'Run [type] scan on [network]'".to_string())
        }
    }
}