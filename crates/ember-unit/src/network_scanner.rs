use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr};
use std::sync::Arc;
use std::time::{Duration, Instant};

use ipnetwork::IpNetwork;
use serde::{Deserialize, Serialize};
use tokio::sync::{Mutex, RwLock, Semaphore};
use tokio::time::sleep;
use uuid::Uuid;

use crate::conscience::PhoenixConscienceIntegration;
use crate::error::EmberUnitError;

/// Represents a network scan request with target and parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkScanRequest {
    pub target: String,            // Could be CIDR notation, hostname, or IP
    pub scan_type: ScanType,
    pub rate_limit: Option<u32>,   // Packets per second (if None, use default)
    pub timeout: Option<u32>,      // Timeout in seconds
    pub options: HashMap<String, String>,
}

/// Types of network scans that can be performed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ScanType {
    Passive,         // Passive discovery scan (ARP, listening)
    PortDiscovery,   // Common port scanning
    ServiceDetection,// Service version detection
    OsFingerprint,   // OS fingerprinting
}

/// Represents a discovered host
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostInfo {
    pub ip_addr: IpAddr,
    pub hostname: Option<String>,
    pub mac_addr: Option<String>,
    pub os_type: Option<String>,
    pub open_ports: Vec<PortInfo>,
    pub last_seen: chrono::DateTime<chrono::Utc>,
}

/// Information about an open port
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortInfo {
    pub port_number: u16,
    pub protocol: PortProtocol,
    pub service: Option<String>,
    pub service_version: Option<String>,
    pub state: PortState,
}

/// Port protocols
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PortProtocol {
    TCP,
    UDP,
}

/// Port state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PortState {
    Open,
    Closed,
    Filtered,
}

/// Results from a network scan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkScanResult {
    pub scan_id: Uuid,
    pub target: String,
    pub scan_type: ScanType,
    pub hosts_discovered: usize,
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub end_time: Option<chrono::DateTime<chrono::Utc>>,
    pub hosts: Vec<HostInfo>,
    pub status: ScanStatus,
    pub error: Option<String>,
}

/// Status of a network scan
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ScanStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// Network Scanner module responsible for passive network scanning
pub struct NetworkScanner {
    /// Scan history
    scan_history: Arc<RwLock<HashMap<Uuid, NetworkScanResult>>>,
    /// Active scans currently running
    active_scans: Arc<RwLock<HashMap<Uuid, NetworkScanResult>>>,
    /// Rate limiter to control scanning speed
    rate_limiter: Arc<Semaphore>,
    /// Maximum allowed scans to run concurrently
    max_concurrent_scans: usize,
    /// Conscience integration for ethical validation
    conscience: Arc<Mutex<PhoenixConscienceIntegration>>,
    /// Hak5 device controller
    hak5_controller: Arc<Mutex<Hak5DeviceController>>,
    /// Default rate limit (packets per second)
    default_rate_limit: u32,
    /// Default scan timeout (seconds)
    default_timeout: u32,
}

impl NetworkScanner {
    /// Create a new NetworkScanner instance
    pub fn new(conscience: PhoenixConscienceIntegration) -> Self {
        Self {
            scan_history: Arc::new(RwLock::new(HashMap::new())),
            active_scans: Arc::new(RwLock::new(HashMap::new())),
            rate_limiter: Arc::new(Semaphore::new(50)), // Limit to 50 concurrent operations
            max_concurrent_scans: 5, // Maximum of 5 concurrent scans
            conscience: Arc::new(Mutex::new(conscience)),
            hak5_controller: Arc::new(Mutex::new(Hak5DeviceController::new())),
            default_rate_limit: 100, // 100 packets per second default
            default_timeout: 300,    // 5 minutes default timeout
        }
    }

    /// Start a network scan based on the provided request
    pub async fn start_scan(&self, request: NetworkScanRequest) -> Result<NetworkScanResult, EmberUnitError> {
        // Check if we have too many active scans
        if self.active_scans.read().await.len() >= self.max_concurrent_scans {
            return Err(EmberUnitError::NetworkError(
                "Maximum number of concurrent scans reached".to_string(),
            ));
        }

        // Validate the scan request through conscience gate
        self.validate_scan_request(&request).await?;

        // Initialize scan result
        let scan_id = Uuid::new_v4();
        let mut scan_result = NetworkScanResult {
            scan_id,
            target: request.target.clone(),
            scan_type: request.scan_type.clone(),
            hosts_discovered: 0,
            start_time: chrono::Utc::now(),
            end_time: None,
            hosts: Vec::new(),
            status: ScanStatus::Pending,
            error: None,
        };

        // Add to active scans
        self.active_scans.write().await.insert(scan_id, scan_result.clone());

        // Start scan in a separate task
        let scanner_clone = self.clone();
        let request_clone = request.clone();
        tokio::spawn(async move {
            scanner_clone.perform_scan(scan_id, request_clone).await;
        });

        // Return initial result
        Ok(scan_result)
    }

    /// Get the status of a scan by ID
    pub async fn get_scan_status(&self, scan_id: Uuid) -> Result<NetworkScanResult, EmberUnitError> {
        // First check active scans
        if let Some(scan) = self.active_scans.read().await.get(&scan_id) {
            return Ok(scan.clone());
        }

        // Then check scan history
        if let Some(scan) = self.scan_history.read().await.get(&scan_id) {
            return Ok(scan.clone());
        }

        Err(EmberUnitError::NetworkError(format!("Scan with ID {} not found", scan_id)))
    }

    /// Cancel a running scan
    pub async fn cancel_scan(&self, scan_id: Uuid) -> Result<(), EmberUnitError> {
        let mut active_scans = self.active_scans.write().await;
        
        if let Some(mut scan) = active_scans.remove(&scan_id) {
            scan.status = ScanStatus::Cancelled;
            scan.end_time = Some(chrono::Utc::now());
            
            // Move to scan history
            self.scan_history.write().await.insert(scan_id, scan);
            Ok(())
        } else {
            Err(EmberUnitError::NetworkError(format!("No active scan with ID {} found", scan_id)))
        }
    }

    /// Get a list of all scans (active and historical)
    pub async fn list_scans(&self) -> Vec<NetworkScanResult> {
        let mut all_scans = Vec::new();
        
        // Add active scans
        for scan in self.active_scans.read().await.values() {
            all_scans.push(scan.clone());
        }
        
        // Add historical scans
        for scan in self.scan_history.read().await.values() {
            all_scans.push(scan.clone());
        }
        
        all_scans
    }

    /// Validate a scan request with the conscience gate
    async fn validate_scan_request(&self, request: &NetworkScanRequest) -> Result<(), EmberUnitError> {
        let mut context = HashMap::new();
        context.insert("action".to_string(), "network_scan".to_string());
        context.insert("target".to_string(), request.target.clone());
        context.insert("scan_type".to_string(), format!("{:?}", request.scan_type));
        
        // Evaluate through conscience gate
        let conscience = self.conscience.lock().await;
        let evaluation = conscience.evaluate_action("network_scan", &context).await?;
        
        if !evaluation.approved {
            return Err(EmberUnitError::ConscienceViolation(format!(
                "Network scan not approved: {} (Score: {})",
                evaluation.reasoning,
                evaluation.score
            )));
        }
        
        // Validate CIDR notation for IP ranges
        match self.parse_target_range(&request.target) {
            Ok(_) => Ok(()),
            Err(e) => Err(EmberUnitError::NetworkError(format!("Invalid target range: {}", e))),
        }
    }

    /// Parse a target range from CIDR notation
    pub fn parse_target_range(&self, target: &str) -> Result<Vec<IpAddr>, String> {
        match target.parse::<IpNetwork>() {
            Ok(network) => {
                // For safety, limit the number of addresses to scan
                let host_count = network.size();
                if host_count > 1024 {
                    return Err(format!("Network too large: {} hosts. Maximum is 1024", host_count));
                }
                
                // Convert to list of IP addresses
                let mut addresses = Vec::new();
                for ip in network.iter() {
                    addresses.push(ip);
                }
                Ok(addresses)
            }
            Err(_) => {
                // Try as a single IP
                match target.parse::<IpAddr>() {
                    Ok(ip) => Ok(vec![ip]),
                    Err(_) => Err(format!("Invalid IP or CIDR notation: {}", target)),
                }
            }
        }
    }

    /// Perform the actual network scan
    async fn perform_scan(&self, scan_id: Uuid, request: NetworkScanRequest) {
        let start_time = Instant::now();
        let rate_limit = request.rate_limit.unwrap_or(self.default_rate_limit);
        let timeout = request.timeout.unwrap_or(self.default_timeout);
        
        // Update scan status to running
        {
            let mut scans = self.active_scans.write().await;
            if let Some(scan) = scans.get_mut(&scan_id) {
                scan.status = ScanStatus::Running;
            } else {
                return; // Scan was removed/cancelled
            }
        }
        
        // Parse target range
        let target_ips = match self.parse_target_range(&request.target) {
            Ok(ips) => ips,
            Err(e) => {
                self.finish_scan(scan_id, ScanStatus::Failed, Some(e.clone())).await;
                return;
            }
        };
        
        let mut discovered_hosts = Vec::new();
        
        // Process each IP address with rate limiting
        for ip in target_ips {
            // Check if scan was cancelled
            let is_cancelled = {
                let scans = self.active_scans.read().await;
                !scans.contains_key(&scan_id)
            };
            
            if is_cancelled {
                return;
            }
            
            // Check timeout
            if start_time.elapsed() > Duration::from_secs(timeout.into()) {
                self.finish_scan(
                    scan_id,
                    ScanStatus::Failed,
                    Some("Scan timeout exceeded".to_string()),
                )
                .await;
                return;
            }
            
            // Acquire rate limiter permit
            let _permit = self.rate_limiter.acquire().await.unwrap();
            
            // Perform individual host scan based on scan type
            match request.scan_type {
                ScanType::Passive => {
                    if let Some(host_info) = self.passive_host_scan(ip).await {
                        discovered_hosts.push(host_info);
                        
                        // Update the count in active scans
                        let mut scans = self.active_scans.write().await;
                        if let Some(scan) = scans.get_mut(&scan_id) {
                            scan.hosts_discovered = discovered_hosts.len();
                        }
                    }
                }
                ScanType::PortDiscovery => {
                    if let Some(mut host_info) = self.passive_host_scan(ip).await {
                        // Add port scanning
                        if let Some(ports) = self.discover_common_ports(ip).await {
                            host_info.open_ports = ports;
                        }
                        discovered_hosts.push(host_info);
                        
                        // Update the count in active scans
                        let mut scans = self.active_scans.write().await;
                        if let Some(scan) = scans.get_mut(&scan_id) {
                            scan.hosts_discovered = discovered_hosts.len();
                        }
                    }
                }
                _ => {
                    // For now, unsupported scan types fall back to passive
                    if let Some(host_info) = self.passive_host_scan(ip).await {
                        discovered_hosts.push(host_info);
                        
                        // Update the count in active scans
                        let mut scans = self.active_scans.write().await;
                        if let Some(scan) = scans.get_mut(&scan_id) {
                            scan.hosts_discovered = discovered_hosts.len();
                        }
                    }
                }
            }
            
            // Sleep to enforce rate limiting
            sleep(Duration::from_millis((1000 / rate_limit).into())).await;
        }
        
        // Finalize scan
        self.finish_scan_with_hosts(scan_id, discovered_hosts).await;
    }

    /// Perform a passive host scan
    async fn passive_host_scan(&self, ip: IpAddr) -> Option<HostInfo> {
        // For simulation, let's pretend we found hosts for certain IPs
        match ip {
            IpAddr::V4(ipv4) => {
                if ipv4.octets()[3] % 5 == 0 {
                    // Simulate not all hosts being found
                    return None;
                }
                
                // Create a simulated host info based on IP address
                Some(HostInfo {
                    ip_addr: ip,
                    hostname: if ipv4.octets()[3] < 100 {
                        Some(format!("host-{}", ipv4.octets()[3]))
                    } else {
                        None
                    },
                    mac_addr: Some(format!(
                        "00:11:22:33:{:02x}:{:02x}",
                        ipv4.octets()[2],
                        ipv4.octets()[3]
                    )),
                    os_type: if ipv4.octets()[3] % 3 == 0 {
                        Some("Windows".to_string())
                    } else if ipv4.octets()[3] % 3 == 1 {
                        Some("Linux".to_string())
                    } else {
                        None
                    },
                    open_ports: Vec::new(),
                    last_seen: chrono::Utc::now(),
                })
            }
            IpAddr::V6(_) => {
                // Skip IPv6 addresses for this implementation
                None
            }
        }
    }

    /// Discover common open ports on a host
    async fn discover_common_ports(&self, ip: IpAddr) -> Option<Vec<PortInfo>> {
        // For simulation, generate some common open ports based on the IP
        match ip {
            IpAddr::V4(ipv4) => {
                let mut ports = Vec::new();
                
                // Common ports to check
                let common_ports = vec![
                    (22, "SSH", PortProtocol::TCP),
                    (80, "HTTP", PortProtocol::TCP),
                    (443, "HTTPS", PortProtocol::TCP),
                    (3389, "RDP", PortProtocol::TCP),
                    (21, "FTP", PortProtocol::TCP),
                    (25, "SMTP", PortProtocol::TCP),
                    (53, "DNS", PortProtocol::UDP),
                ];
                
                // Simulate some open ports based on IP
                for (port, service, protocol) in common_ports {
                    if (ipv4.octets()[3] + port as u8) % 4 == 0 {
                        ports.push(PortInfo {
                            port_number: port,
                            protocol: protocol.clone(),
                            service: Some(service.to_string()),
                            service_version: if (ipv4.octets()[3] + port as u8) % 7 == 0 {
                                Some(format!("{} 2.0", service))
                            } else {
                                None
                            },
                            state: PortState::Open,
                        });
                    }
                }
                
                Some(ports)
            }
            IpAddr::V6(_) => None,
        }
    }

    /// Finish a scan with discovered hosts
    async fn finish_scan_with_hosts(&self, scan_id: Uuid, hosts: Vec<HostInfo>) {
        let mut active_scans = self.active_scans.write().await;
        
        if let Some(mut scan) = active_scans.remove(&scan_id) {
            // Update scan info
            scan.status = ScanStatus::Completed;
            scan.end_time = Some(chrono::Utc::now());
            scan.hosts = hosts;
            scan.hosts_discovered = scan.hosts.len();
            
            // Move to history
            self.scan_history.write().await.insert(scan_id, scan);
        }
    }

    /// Finish a scan with error
    async fn finish_scan(&self, scan_id: Uuid, status: ScanStatus, error: Option<String>) {
        let mut active_scans = self.active_scans.write().await;
        
        if let Some(mut scan) = active_scans.remove(&scan_id) {
            // Update scan info
            scan.status = status;
            scan.end_time = Some(chrono::Utc::now());
            scan.error = error;
            
            // Move to history
            self.scan_history.write().await.insert(scan_id, scan);
        }
    }

    /// Clone implementation
    fn clone(&self) -> Self {
        Self {
            scan_history: self.scan_history.clone(),
            active_scans: self.active_scans.clone(),
            rate_limiter: self.rate_limiter.clone(),
            max_concurrent_scans: self.max_concurrent_scans,
            conscience: self.conscience.clone(),
            default_rate_limit: self.default_rate_limit,
            default_timeout: self.default_timeout,
        }
    }
}

/// Hak5 Device Controller for managing connected devices
pub struct Hak5DeviceController {
    devices: Arc<RwLock<HashMap<String, Hak5Device>>>,
    usb_context: rusb::Context,
}

impl Hak5DeviceController {
    pub fn new() -> Self {
        Self {
            devices: Arc::new(RwLock::new(HashMap::new())),
            usb_context: rusb::Context::new().expect("Failed to initialize USB context"),
        }
    }

    /// List all connected Hak5 devices
    pub async fn list_connected_devices(&self) -> Vec<Hak5Device> {
        let mut devices = Vec::new();
        let mut list = self.usb_context.devices().expect("Failed to list USB devices");
        
        for device in list.iter() {
            let desc = device.device_descriptor().expect("Failed to get device descriptor");
            if Self::is_hak5_device(desc.vendor_id(), desc.product_id()) {
                devices.push(Hak5Device {
                    device_id: format!("{:04x}:{:04x}", desc.vendor_id(), desc.product_id()),
                    vendor_id: desc.vendor_id(),
                    product_id: desc.product_id(),
                    serial_number: device.open().ok().and_then(|h| h.read_serial_number_string_ascii(&desc).ok()),
                    firmware_version: desc.device_version().to_string(),
                    last_seen: chrono::Utc::now(),
                });
            }
        }
        
        devices
    }

    /// Execute payload on a Hak5 device
    pub async fn execute_payload(&self, device_id: &str, payload: Hak5Payload) -> Result<(), String> {
        let device = self.devices.read().await.get(device_id).cloned()
            .ok_or_else(|| format!("Device {} not found", device_id))?;

        // Actual payload execution logic would go here
        Ok(())
    }

    fn is_hak5_device(vendor_id: u16, product_id: u16) -> bool {
        matches!(
            (vendor_id, product_id),
            (0x1d50, 0x6022) | // USB Rubber Ducky
            (0x0483, 0x5740)   // LAN Turtle
        )
    }
}

/// Represents a Hak5 device
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hak5Device {
    pub device_id: String,
    pub vendor_id: u16,
    pub product_id: u16,
    pub serial_number: Option<String>,
    pub firmware_version: String,
    pub last_seen: chrono::DateTime<chrono::Utc>,
}

/// Payload structure for Hak5 devices
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hak5Payload {
    pub payload_type: Hak5PayloadType,
    pub script: String,
    pub parameters: HashMap<String, String>,
    pub execution_mode: ExecutionMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Hak5PayloadType {
    DuckyScript,
    BashScript,
    PowerShell,
    Python,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExecutionMode {
    Immediate,
    Scheduled(chrono::DateTime<chrono::Utc>),
    Triggered(String),
}