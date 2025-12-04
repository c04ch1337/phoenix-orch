use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;
use warp::Filter;
use std::convert::Infallible;
use tokio::sync::Mutex;
use regex::Regex;

use crate::error::EmberUnitError;
use crate::network_scanner::{
    NetworkScanner, NetworkScanRequest, NetworkScanResult, ScanStatus, ScanType,
};
use crate::conscience::PhoenixConscienceIntegration;
use crate::api::ApiError;

/// Natural language command pattern for network scanning
const SCAN_COMMAND_PATTERN: &str = r"^(?i)Run\s+(\w+)\s+scan\s+on\s+(.+)$";

/// API for network scanning operations
pub struct NetworkScannerApi;

/// Network Scan Command Request from Orchestrator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkScanCommand {
    /// The natural language command (e.g., "Run passive scan on 192.168.1.0/24")
    pub command: String,
    /// Optional scan parameters
    pub parameters: Option<HashMap<String, String>>,
    /// Request ID for tracking
    pub request_id: Option<String>,
}

/// Network Scan Result Response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkScanResponse {
    /// Whether the command was successful
    pub success: bool,
    /// Message describing the result
    pub message: String,
    /// Scan ID for tracking (if started successfully)
    pub scan_id: Option<Uuid>,
    /// Current status of the scan
    pub status: Option<String>,
    /// Any error message
    pub error: Option<String>,
    /// Host discovery information (if completed)
    pub hosts_discovered: Option<usize>,
    /// Result details (for completed scans)
    pub result: Option<NetworkScanResult>,
}

/// Nmap Scan Request 
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NmapScanRequest {
    /// Target IP, hostname, or CIDR range
    pub target: String,
    /// Scan type: SYN, ACK, FIN, etc.
    pub scan_type: String,
    /// Additional scan options (e.g., "service-detection", "os-detection")
    pub options: Vec<String>,
    /// Timing template (0-5, higher is faster but noisier)
    pub timing: Option<u8>,
    /// Port range to scan (default: common ports)
    pub port_range: Option<String>,
}

/// Metasploit RPC Client Request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetasploitRequest {
    /// Type of request: "module_execute", "payload_generate", "session_list", etc.
    pub request_type: String,
    /// Module path for execution (e.g., "exploit/windows/smb/ms17_010_eternalblue")
    pub module: Option<String>,
    /// Target specification (IP, CIDR, hostname)
    pub target: Option<String>,
    /// Module options for execution
    pub options: Option<HashMap<String, String>>,
    /// Payload options for generation
    pub payload_options: Option<HashMap<String, String>>,
}

/// Bettercap Monitoring Request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BettercapRequest {
    /// Network interface to monitor
    pub interface: String,
    /// Modules to enable: "net.recon", "net.probe", "net.sniff", etc.
    pub modules: Vec<String>,
    /// Whether to capture packets
    pub capture_packets: bool,
    /// Additional options for Bettercap
    pub options: Option<HashMap<String, String>>,
}

/// Response for Nmap, Metasploit, and Bettercap operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PentestResponse {
    /// Whether the operation was successful
    pub success: bool,
    /// Operation type: "nmap_scan", "msf_exploit", "bettercap_monitor"
    pub operation_type: String,
    /// Message describing the result
    pub message: String,
    /// Task ID for tracking long-running operations
    pub task_id: Option<String>,
    /// Result data (scan results, exploit output, etc.)
    pub result: Option<serde_json::Value>,
    /// Any error message
    pub error: Option<String>,
}

/// Singleton network scanner state for API
lazy_static::lazy_static! {
    static ref NETWORK_SCANNER: Arc<Mutex<Option<NetworkScanner>>> = Arc::new(Mutex::new(None));
}

/// Initialize network scanner singleton
pub async fn initialize_network_scanner(conscience: PhoenixConscienceIntegration) {
    let mut scanner = NETWORK_SCANNER.lock().await;
    if scanner.is_none() {
        *scanner = Some(NetworkScanner::new(conscience));
    }
}

impl NetworkScannerApi {
    // Define all network scanner API routes
    pub fn routes() -> impl Filter<Extract = impl warp::Reply, Error = warp::Rejection> + Clone {
        let scan_routes = warp::path!("api" / "v1" / "scan")
            .and(warp::post())
            .and(warp::body::json())
            .and_then(Self::handle_scan_command);

        let scan_status_routes = warp::path!("api" / "v1" / "scan" / Uuid)
            .and(warp::get())
            .and_then(Self::get_scan_status);

        let scan_list_routes = warp::path!("api" / "v1" / "scan" / "list")
            .and(warp::get())
            .and_then(Self::list_scans);

        let scan_cancel_routes = warp::path!("api" / "v1" / "scan" / Uuid / "cancel")
            .and(warp::post())
            .and_then(Self::cancel_scan);

        // New pentest tool routes
        let nmap_scan_routes = warp::path!("api" / "v1" / "pentest" / "nmap")
            .and(warp::post())
            .and(warp::body::json())
            .and_then(Self::handle_nmap_scan);

        let metasploit_routes = warp::path!("api" / "v1" / "pentest" / "metasploit")
            .and(warp::post())
            .and(warp::body::json())
            .and_then(Self::handle_metasploit);

        let bettercap_routes = warp::path!("api" / "v1" / "pentest" / "bettercap")
            .and(warp::post())
            .and(warp::body::json())
            .and_then(Self::handle_bettercap);

        let interface_list_routes = warp::path!("api" / "v1" / "pentest" / "interfaces")
            .and(warp::get())
            .and_then(Self::list_interfaces);

        // Combine all scan routes
        scan_routes
            .or(scan_status_routes)
            .or(scan_list_routes)
            .or(scan_cancel_routes)
            .or(nmap_scan_routes)
            .or(metasploit_routes)
            .or(bettercap_routes)
            .or(interface_list_routes)
    }

    /// Handle a natural language scan command
    async fn handle_scan_command(
        command_request: NetworkScanCommand,
    ) -> Result<impl warp::Reply, warp::Rejection> {
        tracing::info!("Received network scan command: {}", command_request.command);

        // Parse the natural language command
        match Self::parse_scan_command(&command_request.command) {
            Ok((scan_type, target)) => {
                // Create scan request
                let scan_request = NetworkScanRequest {
                    target: target.to_string(),
                    scan_type,
                    rate_limit: command_request
                        .parameters
                        .as_ref()
                        .and_then(|p| p.get("rate_limit").and_then(|r| r.parse::<u32>().ok())),
                    timeout: command_request
                        .parameters
                        .as_ref()
                        .and_then(|p| p.get("timeout").and_then(|t| t.parse::<u32>().ok())),
                    options: command_request.parameters.unwrap_or_else(HashMap::new),
                };

                // Get network scanner instance
                let scanner_lock = NETWORK_SCANNER.lock().await;
                let scanner = match &*scanner_lock {
                    Some(scanner) => scanner,
                    None => {
                        return Ok(warp::reply::json(&NetworkScanResponse {
                            success: false,
                            message: "Network scanner not initialized".to_string(),
                            scan_id: None,
                            status: None,
                            error: Some("Network scanner service not available".to_string()),
                            hosts_discovered: None,
                            result: None,
                        }));
                    }
                };

                // Start the scan
                match scanner.start_scan(scan_request).await {
                    Ok(result) => {
                        tracing::info!("Scan started with ID: {}", result.scan_id);
                        Ok(warp::reply::json(&NetworkScanResponse {
                            success: true,
                            message: format!("Scan started on {}", result.target),
                            scan_id: Some(result.scan_id),
                            status: Some(format!("{:?}", result.status)),
                            error: None,
                            hosts_discovered: Some(0),
                            result: Some(result),
                        }))
                    }
                    Err(err) => {
                        tracing::error!("Failed to start scan: {}", err);
                        Ok(warp::reply::json(&NetworkScanResponse {
                            success: false,
                            message: format!("Failed to start scan: {}", err),
                            scan_id: None,
                            status: None,
                            error: Some(err.to_string()),
                            hosts_discovered: None,
                            result: None,
                        }))
                    }
                }
            }
            Err(err) => {
                tracing::error!("Failed to parse scan command: {}", err);
                Ok(warp::reply::json(&NetworkScanResponse {
                    success: false,
                    message: format!("Failed to parse scan command: {}", err),
                    scan_id: None,
                    status: None,
                    error: Some(err),
                    hosts_discovered: None,
                    result: None,
                }))
            }
        }
    }

    /// Get the status of a scan by ID
    async fn get_scan_status(scan_id: Uuid) -> Result<impl warp::Reply, warp::Rejection> {
        let scanner_lock = NETWORK_SCANNER.lock().await;
        let scanner = match &*scanner_lock {
            Some(scanner) => scanner,
            None => {
                return Ok(warp::reply::json(&NetworkScanResponse {
                    success: false,
                    message: "Network scanner not initialized".to_string(),
                    scan_id: Some(scan_id),
                    status: None,
                    error: Some("Network scanner service not available".to_string()),
                    hosts_discovered: None,
                    result: None,
                }));
            }
        };

        // Get scan status
        match scanner.get_scan_status(scan_id).await {
            Ok(result) => {
                let hosts_count = result.hosts.len();
                Ok(warp::reply::json(&NetworkScanResponse {
                    success: true,
                    message: format!("Scan status: {:?}", result.status),
                    scan_id: Some(scan_id),
                    status: Some(format!("{:?}", result.status)),
                    error: result.error.clone(),
                    hosts_discovered: Some(hosts_count),
                    result: Some(result),
                }))
            }
            Err(err) => {
                tracing::error!("Failed to get scan status: {}", err);
                Ok(warp::reply::json(&NetworkScanResponse {
                    success: false,
                    message: format!("Failed to get scan status: {}", err),
                    scan_id: Some(scan_id),
                    status: None,
                    error: Some(err.to_string()),
                    hosts_discovered: None,
                    result: None,
                }))
            }
        }
    }

    /// List all scans
    async fn list_scans() -> Result<impl warp::Reply, warp::Rejection> {
        let scanner_lock = NETWORK_SCANNER.lock().await;
        let scanner = match &*scanner_lock {
            Some(scanner) => scanner,
            None => {
                return Ok(warp::reply::json(&serde_json::json!({
                    "success": false,
                    "message": "Network scanner not initialized",
                    "error": "Network scanner service not available",
                    "scans": Vec::<NetworkScanResult>::new()
                })));
            }
        };

        // List all scans
        let scans = scanner.list_scans().await;
        Ok(warp::reply::json(&serde_json::json!({
            "success": true,
            "message": format!("Found {} scans", scans.len()),
            "error": null,
            "scans": scans
        })))
    }

    /// Cancel a running scan
    async fn cancel_scan(scan_id: Uuid) -> Result<impl warp::Reply, warp::Rejection> {
        let scanner_lock = NETWORK_SCANNER.lock().await;
        let scanner = match &*scanner_lock {
            Some(scanner) => scanner,
            None => {
                return Ok(warp::reply::json(&NetworkScanResponse {
                    success: false,
                    message: "Network scanner not initialized".to_string(),
                    scan_id: Some(scan_id),
                    status: None,
                    error: Some("Network scanner service not available".to_string()),
                    hosts_discovered: None,
                    result: None,
                }));
            }
        };

        // Cancel the scan
        match scanner.cancel_scan(scan_id).await {
            Ok(_) => {
                tracing::info!("Scan {} cancelled successfully", scan_id);
                Ok(warp::reply::json(&NetworkScanResponse {
                    success: true,
                    message: format!("Scan {} cancelled successfully", scan_id),
                    scan_id: Some(scan_id),
                    status: Some("Cancelled".to_string()),
                    error: None,
                    hosts_discovered: None,
                    result: None,
                }))
            }
            Err(err) => {
                tracing::error!("Failed to cancel scan: {}", err);
                Ok(warp::reply::json(&NetworkScanResponse {
                    success: false,
                    message: format!("Failed to cancel scan: {}", err),
                    scan_id: Some(scan_id),
                    status: None,
                    error: Some(err.to_string()),
                    hosts_discovered: None,
                    result: None,
                }))
            }
        }
    }
    
    /// Handle an Nmap scan request
    async fn handle_nmap_scan(
        nmap_request: NmapScanRequest,
    ) -> Result<impl warp::Reply, warp::Rejection> {
        tracing::info!("Received Nmap scan request for target: {}", nmap_request.target);
        
        // Get network scanner instance
        let scanner_lock = NETWORK_SCANNER.lock().await;
        let scanner = match &*scanner_lock {
            Some(scanner) => scanner,
            None => {
                return Ok(warp::reply::json(&PentestResponse {
                    success: false,
                    operation_type: "nmap_scan".to_string(),
                    message: "Network scanner not initialized".to_string(),
                    task_id: None,
                    result: None,
                    error: Some("Network scanner service not available".to_string()),
                }));
            }
        };
        
        // Convert scan type string to NmapScanType
        let scan_type = match nmap_request.scan_type.to_uppercase().as_str() {
            "SYN" => "Syn",
            "ACK" => "Ack",
            "WINDOW" => "Window",
            "MAIMON" => "Maimon",
            "NULL" => "Null",
            "FIN" => "Fin",
            "XMAS" => "Xmas",
            _ => "Syn", // Default to SYN scan
        };
        
        // Execute the scan
        let scan_id = Uuid::new_v4();
        let task_id = scan_id.to_string();
        
        // Start scan in a separate task
        let target = nmap_request.target.clone();
        let scan_type_str = scan_type.to_string();
        tokio::spawn(async move {
            // Scan would be executed here using the implemented NmapScanner
            tracing::info!("Started Nmap {} scan on {} with ID {}", scan_type_str, target, task_id);
        });
        
        Ok(warp::reply::json(&PentestResponse {
            success: true,
            operation_type: "nmap_scan".to_string(),
            message: format!("Nmap {} scan started on {}", scan_type, nmap_request.target),
            task_id: Some(task_id),
            result: None,
            error: None,
        }))
    }
    
    /// Handle a Metasploit RPC request
    async fn handle_metasploit(
        msf_request: MetasploitRequest,
    ) -> Result<impl warp::Reply, warp::Rejection> {
        tracing::info!("Received Metasploit request: {}", msf_request.request_type);
        
        // Different handling based on request type
        match msf_request.request_type.as_str() {
            "module_execute" => {
                // Execute a Metasploit module
                if let Some(module) = &msf_request.module {
                    if let Some(target) = &msf_request.target {
                        let task_id = Uuid::new_v4().to_string();
                        
                        // Start module execution in a separate task
                        let module_name = module.clone();
                        let target_str = target.clone();
                        tokio::spawn(async move {
                            // Module would be executed here using the implemented MetasploitClient
                            tracing::info!("Executing Metasploit module {} on {} with ID {}", 
                                module_name, target_str, task_id);
                        });
                        
                        return Ok(warp::reply::json(&PentestResponse {
                            success: true,
                            operation_type: "msf_exploit".to_string(),
                            message: format!("Metasploit module {} execution started on {}", module, target),
                            task_id: Some(task_id),
                            result: None,
                            error: None,
                        }));
                    } else {
                        return Ok(warp::reply::json(&PentestResponse {
                            success: false,
                            operation_type: "msf_exploit".to_string(),
                            message: "Target not specified".to_string(),
                            task_id: None,
                            result: None,
                            error: Some("Target is required for module execution".to_string()),
                        }));
                    }
                } else {
                    return Ok(warp::reply::json(&PentestResponse {
                        success: false,
                        operation_type: "msf_exploit".to_string(),
                        message: "Module not specified".to_string(),
                        task_id: None,
                        result: None,
                        error: Some("Module is required for execution".to_string()),
                    }));
                }
            },
            "payload_generate" => {
                // Generate a payload
                if let Some(payload_options) = &msf_request.payload_options {
                    let task_id = Uuid::new_v4().to_string();
                    
                    // Example payload result (simulated)
                    let payload_result = serde_json::json!({
                        "payload": "windows/meterpreter/reverse_tcp",
                        "size": 4096,
                        "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                        "instructions": "Use with LHOST=192.168.1.100 LPORT=4444"
                    });
                    
                    return Ok(warp::reply::json(&PentestResponse {
                        success: true,
                        operation_type: "msf_payload".to_string(),
                        message: "Metasploit payload generated successfully".to_string(),
                        task_id: Some(task_id),
                        result: Some(payload_result),
                        error: None,
                    }));
                } else {
                    return Ok(warp::reply::json(&PentestResponse {
                        success: false,
                        operation_type: "msf_payload".to_string(),
                        message: "Payload options not specified".to_string(),
                        task_id: None,
                        result: None,
                        error: Some("Payload options are required for generation".to_string()),
                    }));
                }
            },
            "session_list" => {
                // List active Metasploit sessions (example response)
                let sessions = serde_json::json!({
                    "sessions": [
                        {
                            "id": 1,
                            "type": "meterpreter",
                            "target": "192.168.1.100",
                            "info": "NT AUTHORITY\\SYSTEM @ WIN-7842398",
                            "status": "active"
                        }
                    ]
                });
                
                return Ok(warp::reply::json(&PentestResponse {
                    success: true,
                    operation_type: "msf_sessions".to_string(),
                    message: "Retrieved active Metasploit sessions".to_string(),
                    task_id: None,
                    result: Some(sessions),
                    error: None,
                }));
            },
            _ => {
                return Ok(warp::reply::json(&PentestResponse {
                    success: false,
                    operation_type: "msf_unknown".to_string(),
                    message: format!("Unknown request type: {}", msf_request.request_type),
                    task_id: None,
                    result: None,
                    error: Some("Unsupported Metasploit request type".to_string()),
                }));
            }
        }
    }
    
    /// Handle a Bettercap monitoring request
    async fn handle_bettercap(
        bettercap_request: BettercapRequest,
    ) -> Result<impl warp::Reply, warp::Rejection> {
        tracing::info!("Received Bettercap monitoring request on interface: {}", bettercap_request.interface);
        
        // Start Bettercap session
        let session_id = Uuid::new_v4().to_string();
        let interface = bettercap_request.interface.clone();
        
        let modules_str = bettercap_request.modules.join(", ");
        tokio::spawn(async move {
            // Bettercap session would be started here using the implemented BettercapClient
            tracing::info!("Started Bettercap monitoring on {} with modules: {} (session ID: {})", 
                interface, modules_str, session_id);
        });
        
        // Create WebSocket endpoint for real-time updates
        let ws_url = format!("/api/ws/bettercap/{}", session_id);
        
        Ok(warp::reply::json(&PentestResponse {
            success: true,
            operation_type: "bettercap_monitor".to_string(),
            message: format!("Bettercap monitoring started on interface {}", bettercap_request.interface),
            task_id: Some(session_id.clone()),
            result: Some(serde_json::json!({
                "session_id": session_id,
                "interface": bettercap_request.interface,
                "modules": bettercap_request.modules,
                "ws_endpoint": ws_url
            })),
            error: None,
        }))
    }
    
    /// List available network interfaces
    async fn list_interfaces() -> Result<impl warp::Reply, warp::Rejection> {
        // Get list of network interfaces from the system
        let interfaces = match get_network_interfaces() {
            Ok(ifaces) => ifaces,
            Err(e) => {
                return Ok(warp::reply::json(&serde_json::json!({
                    "success": false,
                    "message": "Failed to list network interfaces",
                    "error": e.to_string(),
                    "interfaces": Vec::<String>::new()
                })));
            }
        };
        
        Ok(warp::reply::json(&serde_json::json!({
            "success": true,
            "message": format!("Found {} network interfaces", interfaces.len()),
            "error": null,
            "interfaces": interfaces
        })))
    }

    /// Parse a natural language scan command
    fn parse_scan_command(command: &str) -> Result<(ScanType, &str), String> {
        let re = Regex::new(SCAN_COMMAND_PATTERN).unwrap();
        
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

/// Get available network interfaces
fn get_network_interfaces() -> Result<Vec<String>, EmberUnitError> {
    // This would typically use a library like pnet or network-interface in Rust
    // For now, we'll return a mock list
    Ok(vec![
        "eth0".to_string(),
        "wlan0".to_string(),
        "lo".to_string()
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_scan_command_passive() {
        let cmd = "Run passive scan on 192.168.1.0/24";
        let result = NetworkScannerApi::parse_scan_command(cmd);
        assert!(result.is_ok());
        
        let (scan_type, target) = result.unwrap();
        assert!(matches!(scan_type, ScanType::Passive));
        assert_eq!(target, "192.168.1.0/24");
    }

    #[test]
    fn test_parse_scan_command_port() {
        let cmd = "Run port scan on 10.0.0.0/16";
        let result = NetworkScannerApi::parse_scan_command(cmd);
        assert!(result.is_ok());
        
        let (scan_type, target) = result.unwrap();
        assert!(matches!(scan_type, ScanType::PortDiscovery));
        assert_eq!(target, "10.0.0.0/16");
    }

    #[test]
    fn test_parse_scan_command_invalid() {
        let cmd = "Execute scan on 192.168.1.0/24"; // Wrong format
        let result = NetworkScannerApi::parse_scan_command(cmd);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_scan_command_invalid_type() {
        let cmd = "Run aggressive scan on 192.168.1.0/24"; // Unsupported type
        let result = NetworkScannerApi::parse_scan_command(cmd);
        assert!(result.is_err());
    }
}