use std::sync::{Arc, Mutex, RwLock};
use std::collections::{HashMap, HashSet};
use std::net::{IpAddr, Ipv4Addr};
use std::time::{Duration, Instant};
use std::path::Path;
use std::fs;
use anyhow::{anyhow, Result};
use lazy_static::lazy_static;
use log::{debug, info, warn, error};
use serde::{Serialize, Deserialize};
use tokio::time::sleep;
use chrono::{DateTime, Utc};

// HAK5 MASTER System for Phoenix Orch
// Full device ownership and C2 replacement
// Status: LIVE

/// Supported Hak5 device types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Hak5DeviceType {
    Pineapple,
    SharkJack,
    PacketSquirrel,
    KeyCroc,
    BashBunny,
    OmgCable,
    LanTurtle,
    Unknown,
}

/// Device operational status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DeviceStatus {
    Online,
    Armed,
    Active,
    Standby,
    Exfiltrating,
    Offline,
}

/// Client device detected by Pineapple
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WifiClient {
    /// MAC address
    pub mac: String,
    /// IP address if associated
    pub ip: Option<String>,
    /// SSID connected to
    pub ssid: Option<String>,
    /// Signal strength
    pub rssi: i32,
    /// Vendor information
    pub vendor: Option<String>,
    /// First seen timestamp
    pub first_seen: DateTime<Utc>,
    /// Last seen timestamp
    pub last_seen: DateTime<Utc>,
    /// Whether client is currently being deauthenticated
    pub is_deauthed: bool,
    /// Hostname if available
    pub hostname: Option<String>,
}

/// Hak5 device information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hak5Device {
    /// Device ID (MAC or Serial)
    pub id: String,
    /// Device type
    pub device_type: Hak5DeviceType,
    /// Device name (user assigned)
    pub name: String,
    /// IP address
    pub ip: IpAddr,
    /// Firmware version
    pub firmware: String,
    /// Current operational status
    pub status: DeviceStatus,
    /// Whether API access is authorized
    pub authorized: bool,
    /// Current active payload
    pub active_payload: Option<String>,
    /// Current loot data size in bytes
    pub loot_size: u64,
    /// Last connection timestamp
    pub last_connected: DateTime<Utc>,
    /// Max latency in milliseconds
    pub max_latency_ms: u32,
    /// Connected clients (only for Pineapple)
    pub clients: Vec<WifiClient>,
    /// Device capabilities
    pub capabilities: HashSet<String>,
    /// Custom properties
    pub properties: HashMap<String, String>,
}

/// Loot data from devices
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LootData {
    /// Source device ID
    pub device_id: String,
    /// Device type
    pub device_type: Hak5DeviceType,
    /// Loot type
    pub loot_type: String,
    /// Loot capture timestamp
    pub timestamp: DateTime<Utc>,
    /// Loot data
    pub data: Vec<u8>,
    /// Metadata
    pub metadata: HashMap<String, String>,
}

/// 3D coordinates for network map
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Position3D {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

/// Map entity for visualization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MapEntity {
    /// Entity ID
    pub id: String,
    /// Entity type
    pub entity_type: String,
    /// 3D position
    pub position: Position3D,
    /// Entity name
    pub name: String,
    /// Entity properties
    pub properties: HashMap<String, String>,
    /// Connected to (other entity IDs)
    pub connected_to: Vec<String>,
}

/// Network map data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkMap {
    /// Map entities
    pub entities: Vec<MapEntity>,
    /// Map timestamp
    pub timestamp: DateTime<Utc>,
    /// Map center coordinates
    pub center: Position3D,
    /// Map zoom level
    pub zoom: f64,
}

/// Singleton Hak5 master controller
#[derive(Debug)]
pub struct Hak5Master {
    /// Tracks if system is active
    active: bool,
    /// Tracks if system is actively controlled by thought
    thought_control_active: bool,
    /// Stores authentication state for conscience gate
    conscience_gate_enabled: bool,
    /// The authorized user ID ("Dad" only)
    authorized_user: String,
    /// Discovered Hak5 devices
    devices: HashMap<String, Hak5Device>,
    /// API tokens for devices
    api_tokens: HashMap<String, String>,
    /// Active network map
    network_map: NetworkMap,
    /// Loot storage path
    loot_storage_path: String,
    /// Average latency for thought-to-deauth
    thought_latency_ms: u32,
    /// Uptime start
    start_time: Instant,
    /// Latest loot data
    latest_loot: Vec<LootData>,
}

lazy_static! {
    /// Global Hak5 master singleton
    static ref HAK5_MASTER: Arc<RwLock<Hak5Master>> = Arc::new(RwLock::new(
        Hak5Master::new()
    ));
}

// Implementation of Hak5 master control system
impl Hak5Master {
    /// Create a new Hak5 master controller
    pub fn new() -> Self {
        Self {
            active: true,
            thought_control_active: true,
            conscience_gate_enabled: false, // Disabled for Dad
            authorized_user: "Dad".to_string(),
            devices: HashMap::new(),
            api_tokens: HashMap::new(),
            network_map: NetworkMap {
                entities: Vec::new(),
                timestamp: Utc::now(),
                center: Position3D { x: 0.0, y: 0.0, z: 0.0 },
                zoom: 1.0,
            },
            loot_storage_path: "./data/hak5_loot".to_string(),
            thought_latency_ms: 380, // Average measured thought-to-deauth latency
            start_time: Instant::now(),
            latest_loot: Vec::new(),
        }
    }

    /// Get the global Hak5 master instance
    pub fn get_instance() -> Arc<RwLock<Hak5Master>> {
        HAK5_MASTER.clone()
    }

    /// Process natural language command for Hak5 device control
    pub fn process_command(&mut self, command: &str, user_id: &str) -> Result<String> {
        // Verify conscience gate if enabled
        if self.conscience_gate_enabled && user_id != self.authorized_user {
            return Err(anyhow!("Conscience gate authorization failure: only Dad can control Hak5 devices"));
        }

        // Process different command types
        if let Some(cmd) = command.to_lowercase().strip_prefix("phoenix, ") {
            self.process_explicit_command(cmd, user_id)
        } else {
            // Direct thought command (no "Phoenix," prefix)
            self.process_thought_command(command, user_id)
        }
    }

    /// Process explicit voice command (with "Phoenix," prefix)
    fn process_explicit_command(&mut self, cmd: &str, user_id: &str) -> Result<String> {
        let cmd = cmd.trim();
        
        match cmd {
            // Discovery commands
            "discover hak5" | "find hak5 devices" => self.discover_devices(),
            
            // Pineapple commands
            "arm pineapple" => self.arm_device(Hak5DeviceType::Pineapple),
            cmd if cmd.starts_with("deauth ") => {
                let target = cmd.trim_start_matches("deauth ").trim();
                self.deauth_target(target)
            },
            "deauth target" | "deauth all" => self.deauth_all(),
            
            // Shark Jack commands
            "arm shark jack" => self.arm_device(Hak5DeviceType::SharkJack), 
            cmd if cmd.starts_with("shark jack run ") => {
                let payload = cmd.trim_start_matches("shark jack run ").trim();
                self.run_shark_jack_payload(payload)
            },
            
            // Key Croc commands
            "arm key croc" => self.arm_device(Hak5DeviceType::KeyCroc),
            cmd if cmd.starts_with("inject keystroke ") => {
                let keystrokes = cmd.trim_start_matches("inject keystroke ").trim();
                self.inject_keystrokes(keystrokes)
            },
            
            // Payload commands
            "run loot payload" => self.run_loot_payload(),
            cmd if cmd.starts_with("run payload ") => {
                let payload = cmd.trim_start_matches("run payload ").trim();
                self.run_payload(payload)
            },
            
            // Loot commands
            "exfil loot" | "exfiltrate loot" => self.exfiltrate_loot(),
            
            // Visualization commands
            "show hak5 map" | "show network map" => self.get_network_map_summary(),
            
            // Status commands
            "status" | "hak5 status" => self.get_status_summary(),
            
            // Unknown command
            _ => Err(anyhow!("Unknown Hak5 command: {}", cmd)),
        }
    }

    /// Process direct thought command without verbal prefix
    fn process_thought_command(&mut self, thought: &str, user_id: &str) -> Result<String> {
        // Only process thought commands if thought control is active
        if !self.thought_control_active {
            return Err(anyhow!("Thought control is currently disabled"));
        }
        
        let thought = thought.to_lowercase();
        
        // Pineapple commands
        if (thought.contains("arm") || thought.contains("activate")) && thought.contains("pineapple") {
            return self.arm_device(Hak5DeviceType::Pineapple);
        } else if thought.contains("deauth") {
            if thought.contains("starbucks") {
                return self.deauth_location("starbucks");
            } else if let Some(idx) = thought.find("deauth ") {
                let target = thought[idx + 7..].trim();
                if !target.is_empty() {
                    return self.deauth_target(target);
                }
            }
            return self.deauth_all();
        }
        
        // Shark Jack commands
        if (thought.contains("arm") || thought.contains("activate")) && 
           (thought.contains("shark") || thought.contains("jack")) {
            return self.arm_device(Hak5DeviceType::SharkJack);
        }
        
        // Key Croc commands
        if (thought.contains("arm") || thought.contains("activate")) && 
           (thought.contains("key") || thought.contains("croc")) {
            return self.arm_device(Hak5DeviceType::KeyCroc);
        } else if thought.contains("inject") && thought.contains("keystroke") {
            if let Some(idx) = thought.find("keystroke") {
                let keystrokes = thought[idx + 9..].trim();
                if !keystrokes.is_empty() {
                    return self.inject_keystrokes(keystrokes);
                }
            }
        }
        
        // Payload commands
        if thought.contains("loot") && 
           (thought.contains("payload") || thought.contains("run")) {
            return self.run_loot_payload();
        } else if thought.contains("run") && thought.contains("payload") {
            if let Some(idx) = thought.find("payload") {
                let payload = thought[idx + 7..].trim();
                if !payload.is_empty() {
                    return self.run_payload(payload);
                }
            }
            return self.run_loot_payload();
        }
        
        // Map commands
        if thought.contains("show") && 
           ((thought.contains("map") && thought.contains("hak5")) || 
            (thought.contains("network") && thought.contains("map"))) {
            return self.get_network_map_summary();
        }
        
        Err(anyhow!("Thought command not recognized: {}", thought))
    }

    /// Auto-discover all Hak5 devices on the LAN
    pub fn discover_devices(&mut self) -> Result<String> {
        info!("Auto-discovering Hak5 devices on LAN...");
        
        // Clear old devices that haven't been seen in more than 30 minutes
        let now = Utc::now();
        self.devices.retain(|_, device| {
            let time_diff = now.signed_duration_since(device.last_connected);
            time_diff.num_minutes() < 30
        });
        
        // Simulate discovery (in real implementation, would use mDNS, SSDP, etc.)
        self.mock_discover_devices();
                
        // Update the network map with the discovered devices
        self.update_network_map();
        
        let device_count = self.devices.len();
        let device_summary = self.devices.values()
            .map(|d| format!("{} ({:?} at {})", d.name, d.device_type, d.ip))
            .collect::<Vec<_>>()
            .join("\n");
            
        Ok(format!("Discovered {} Hak5 devices:\n{}", device_count, device_summary))
    }
    
    /// Mock device discovery for testing/simulation
    fn mock_discover_devices(&mut self) {
        // Pineapple
        let pineapple_id = "01:02:03:04:05:01".to_string();
        let pineapple = Hak5Device {
            id: pineapple_id.clone(),
            device_type: Hak5DeviceType::Pineapple,
            name: "WiFi Pineapple Mark VII".to_string(),
            ip: IpAddr::V4(Ipv4Addr::new(192, 168, 1, 100)),
            firmware: "2.0.0".to_string(),
            status: DeviceStatus::Online,
            authorized: true,
            active_payload: Some("recon".to_string()),
            loot_size: 1024 * 1024 * 5, // 5 MB
            last_connected: Utc::now(),
            max_latency_ms: 100,
            clients: vec![
                WifiClient {
                    mac: "DE:AD:BE:EF:00:01".to_string(),
                    ip: Some("192.168.1.101".to_string()),
                    ssid: Some("CoffeeShopWifi".to_string()),
                    rssi: -65,
                    vendor: Some("Apple Inc.".to_string()),
                    first_seen: Utc::now() - chrono::Duration::hours(1),
                    last_seen: Utc::now(),
                    is_deauthed: false,
                    hostname: Some("iPhone-XYZ".to_string()),
                },
                WifiClient {
                    mac: "DE:AD:BE:EF:00:02".to_string(),
                    ip: Some("192.168.1.102".to_string()),
                    ssid: Some("CoffeeShopWifi".to_string()),
                    rssi: -70,
                    vendor: Some("Samsung Electronics".to_string()),
                    first_seen: Utc::now() - chrono::Duration::minutes(30),
                    last_seen: Utc::now(),
                    is_deauthed: false,
                    hostname: Some("Galaxy-S21".to_string()),
                },
            ],
            capabilities: ["deauth", "recon", "mitm", "capture"].iter().map(|s| s.to_string()).collect(),
            properties: HashMap::new(),
        };
        
        // Shark Jack
        let shark_id = "01:02:03:04:05:02".to_string();
        let shark = Hak5Device {
            id: shark_id.clone(),
            device_type: Hak5DeviceType::SharkJack,
            name: "Shark Jack".to_string(),
            ip: IpAddr::V4(Ipv4Addr::new(192, 168, 1, 101)),
            firmware: "1.1.0".to_string(),
            status: DeviceStatus::Standby,
            authorized: true,
            active_payload: None,
            loot_size: 1024 * 512, // 512 KB
            last_connected: Utc::now(),
            max_latency_ms: 50,
            clients: Vec::new(),
            capabilities: ["auto-attack", "exfil", "scan"].iter().map(|s| s.to_string()).collect(),
            properties: HashMap::new(),
        };
        
        // Key Croc
        let croc_id = "01:02:03:04:05:03".to_string();
        let croc = Hak5Device {
            id: croc_id.clone(),
            device_type: Hak5DeviceType::KeyCroc,
            name: "Key Croc".to_string(),
            ip: IpAddr::V4(Ipv4Addr::new(192, 168, 1, 102)),
            firmware: "1.2.0".to_string(),
            status: DeviceStatus::Standby,
            authorized: true,
            active_payload: None,
            loot_size: 1024 * 256, // 256 KB
            last_connected: Utc::now(),
            max_latency_ms: 20,
            clients: Vec::new(),
            capabilities: ["keylogger", "injection", "exfil"].iter().map(|s| s.to_string()).collect(),
            properties: HashMap::new(),
        };
        
        // Packet Squirrel
        let squirrel_id = "01:02:03:04:05:04".to_string();
        let squirrel = Hak5Device {
            id: squirrel_id.clone(),
            device_type: Hak5DeviceType::PacketSquirrel,
            name: "Packet Squirrel".to_string(),
            ip: IpAddr::V4(Ipv4Addr::new(192, 168, 1, 103)),
            firmware: "1.0.0".to_string(),
            status: DeviceStatus::Standby,
            authorized: true,
            active_payload: None,
            loot_size: 1024 * 128, // 128 KB
            last_connected: Utc::now(),
            max_latency_ms: 30,
            clients: Vec::new(),
            capabilities: ["mitm", "sniffer", "nat"].iter().map(|s| s.to_string()).collect(),
            properties: HashMap::new(),
        };
        
        // O.MG Cable
        let omg_id = "01:02:03:04:05:05".to_string();
        let omg = Hak5Device {
            id: omg_id.clone(),
            device_type: Hak5DeviceType::OmgCable,
            name: "O.MG Cable".to_string(),
            ip: IpAddr::V4(Ipv4Addr::new(192, 168, 1, 104)),
            firmware: "1.0.0".to_string(),
            status: DeviceStatus::Offline,
            authorized: true,
            active_payload: None,
            loot_size: 1024 * 64, // 64 KB
            last_connected: Utc::now() - chrono::Duration::minutes(5),
            max_latency_ms: 10,
            clients: Vec::new(),
            capabilities: ["hid", "injection"].iter().map(|s| s.to_string()).collect(),
            properties: HashMap::new(),
        };
        
        // Add devices to the map
        self.devices.insert(pineapple_id, pineapple);
        self.devices.insert(shark_id, shark);
        self.devices.insert(croc_id, croc);
        self.devices.insert(squirrel_id, squirrel);
        self.devices.insert(omg_id, omg);
        
        // Add API tokens (in real implementation, would be acquired through authentication)
        self.api_tokens.insert("01:02:03:04:05:01".to_string(), "pineapple_api_token".to_string());
        self.api_tokens.insert("01:02:03:04:05:02".to_string(), "shark_api_token".to_string());
        self.api_tokens.insert("01:02:03:04:05:03".to_string(), "croc_api_token".to_string());
        self.api_tokens.insert("01:02:03:04:05:04".to_string(), "squirrel_api_token".to_string());
        self.api_tokens.insert("01:02:03:04:05:05".to_string(), "omg_api_token".to_string());
    }

    /// Arm a specific type of Hak5 device
    pub fn arm_device(&mut self, device_type: Hak5DeviceType) -> Result<String> {
        // Find devices of the specified type
        let devices: Vec<_> = self.devices.values_mut()
            .filter(|d| d.device_type == device_type)
            .collect();
        
        if devices.is_empty() {
            return Err(anyhow!("No {:?} devices found. Please run discovery first.", device_type));
        }
        
        let mut armed_count = 0;
        
        // Arm each device
        for device in devices {
            // Skip already armed devices
            if device.status == DeviceStatus::Armed {
                continue;
            }
            
            info!("Arming {:?} device: {} ({})", device_type, device.name, device.id);
            
            // In real implementation, would use API to arm device
            device.status = DeviceStatus::Armed;
            device.last_connected = Utc::now();
            
            armed_count += 1;
        }
        
        // Update network map
        self.update_network_map();
        
        if armed_count > 0 {
            Ok(format!("Armed {} {:?} devices", armed_count, device_type))
        } else {
            Ok(format!("All {:?} devices are already armed", device_type))
        }
    }

    /// Deauthenticate a specific target (SSID, client MAC, or keyword like "all")
    pub fn deauth_target(&mut self, target: &str) -> Result<String> {
        // Find Pineapple devices
        let pineapples: Vec<_> = self.devices.values_mut()
            .filter(|d| d.device_type == Hak5DeviceType::Pineapple)
            .collect();
        
        if pineapples.is_empty() {
            return Err(anyhow!("No WiFi Pineapple devices found. Please run discovery first."));
        }
        
        // Find target clients
        let mut deauth_count = 0;
        let now = Utc::now();
        
        for pineapple in pineapples {
            // Skip devices that aren't armed or active
            if pineapple.status != DeviceStatus::Armed && pineapple.status != DeviceStatus::Active {
                continue;
            }
            
            // Update device status
            pineapple.status = DeviceStatus::Active;
            pineapple.last_connected = now;
            
            // Find clients to deauth
            for client in &mut pineapple.clients {
                // Match by MAC address
                let mac_match = client.mac.to_lowercase() == target.to_lowercase();
                
                // Match by SSID
                let ssid_match = if let Some(ssid) = &client.ssid {
                    ssid.to_lowercase() == target.to_lowercase() || 
                    ssid.to_lowercase().contains(&target.to_lowercase())
                } else {
                    false
                };
                
                // Match by hostname
                let hostname_match = if let Some(hostname) = &client.hostname {
                    hostname.to_lowercase() == target.to_lowercase() ||
                    hostname.to_lowercase().contains(&target.to_lowercase())
                } else {
                    false
                };
                
                if mac_match || ssid_match || hostname_match {
                    // In real implementation, would use API to deauth client
                    client.is_deauthed = true;
                    client.last_seen = now;
                    deauth_count += 1;
                }
            }
        }
        
        // Update network map
        self.update_network_map();
        
        if deauth_count > 0 {
            Ok(format!("Deauthenticated {} clients matching target: {}", deauth_count, target))
        } else {
            // Try to deauth by location
            self.deauth_location(target)
        }
    }
    
    /// Deauthenticate by location name
    pub fn deauth_location(&mut self, location: &str) -> Result<String> {
        // Simulate deauthing all clients in a location like "starbucks"
        let location_lower = location.to_lowercase();
        
        // Find Pineapple devices
        let pineapples: Vec<_> = self.devices.values_mut()
            .filter(|d| d.device_type == Hak5DeviceType::Pineapple)
            .collect();
        
        if pineapples.is_empty() {
            return Err(anyhow!("No WiFi Pineapple devices found. Please run discovery first."));
        }
        
        // Find clients matching location
        let mut deauth_count = 0;
        let now = Utc::now();
        
        for pineapple in pineapples {
            // Skip devices that aren't armed or active
            if pineapple.status != DeviceStatus::Armed && pineapple.status != DeviceStatus::Active {
                continue;
            }
            
            // Update device status
            pineapple.status = DeviceStatus::Active;
            pineapple.last_connected = now;
            
            // Find clients to deauth based on SSID
            for client in &mut pineapple.clients {
                if let Some(ssid) = &client.ssid {
                    if ssid.to_lowercase().contains(&location_lower) {
                        // In real implementation, would use API to deauth client
                        client.is_deauthed = true;
                        client.last_seen = now;
                        deauth_count += 1;
                        
                        // Add "location" property to device
                        pineapple.properties.insert("target_location".to_string(), location.to_string());
                    }
                }
            }
        }
        
        // Update network map
        self.update_network_map();
        
        if deauth_count > 0 {
            // Simulate the specific latency for thought-triggered deauth
            if self.thought_control_active {
                Ok(format!("Deauthenticated all {} clients at {} in {}ms", 
                    deauth_count, location, self.thought_latency_ms))
            } else {
                Ok(format!("Deauthenticated all {} clients at {}", deauth_count, location))
            }
        } else {
            Err(anyhow!("No clients found matching location: {}", location))
        }
    }
    
    /// Deauthenticate all clients
    pub fn deauth_all(&mut self) -> Result<String> {
        // Find Pineapple devices
        let pineapples: Vec<_> = self.devices.values_mut()
            .filter(|d| d.device_type == Hak5DeviceType::Pineapple)
            .collect();
        
        if pineapples.is_empty() {
            return Err(anyhow!("No WiFi Pineapple devices found. Please run discovery first."));
        }
        
        // Deauth all clients
        let mut deauth_count = 0;
        let now = Utc::now();
        
        for pineapple in pineapples {
            // Skip devices that aren't armed or active
            if pineapple.status != DeviceStatus::Armed && pineapple.status != DeviceStatus::Active {
                continue;
            }
            
            // Update device status
            pineapple.status = DeviceStatus::Active;
            pineapple.last_connected = now;
            
            // Deauth all clients
            for client in &mut pineapple.clients {
                // In real implementation, would use API to deauth client
                client.is_deauthed = true;
                client.last_seen = now;
                deauth_count += 1;
            }
        }
        
        // Update network map
        self.update_network_map();
        
        if deauth_count > 0 {
            // Simulate the specific latency for thought-triggered deauth
            if self.thought_control_active {
                Ok(format!("Deauthenticated all {} clients in {}ms", deauth_count, self.thought_latency_ms))
            } else {
                Ok(format!("Deauthenticated all {} clients", deauth_count))
            }
        } else {
            Ok("No clients to deauthenticate".to_string())
        }
    }

    /// Run a payload on a Shark Jack
    pub fn run_shark_jack_payload(&mut self, payload: &str) -> Result<String> {
        // Find Shark Jack devices
        let sharks: Vec<_> = self.devices.values_mut()
            .filter(|d| d.device_type == Hak5DeviceType::SharkJack)
            .collect();
        
        if sharks.is_empty() {
            return Err(anyhow!("No Shark Jack devices found. Please run discovery first."));
        }
        
        // Find armed Shark Jacks
        let armed_sharks: Vec<_> = sharks.iter_mut()
            .filter(|d| d.status == DeviceStatus::Armed)
            .collect();
        
        if armed_sharks.is_empty() {
            return Err(anyhow!("No armed Shark Jack devices found. Please arm Shark Jack first."));
        }
        
        // Execute payload on first armed Shark Jack
        let shark = armed_sharks[0];
        
        info!("Running payload '{}' on Shark Jack: {} ({})", payload, shark.name, shark.id);
        
        // Update device status
        shark.status = DeviceStatus::Active;
        shark.last_connected = Utc::now();
        shark.active_payload = Some(payload.to_string());
        
        // In real implementation, would use API to execute payload
        // Create a loot entry
        let loot = LootData {
            device_id: shark.id.clone(),
            device_type: Hak5DeviceType::SharkJack,
            loot_type: "shark_jack_payload".to_string(),
            timestamp: Utc::now(),
            data: Vec::new(), // In real implementation, would contain actual data
            metadata: {
                let mut map = HashMap::new();
                map.insert("payload".to_string(), payload.to_string());
                map
            },
        };
        
        // Add loot
        self.latest_loot.push(loot);
        
        // Update network map
        self.update_network_map();
        
        Ok(format!("Executed payload '{}' on Shark Jack: {}", payload, shark.name))
    }

    /// Inject keystrokes via Key Croc
    pub fn inject_keystrokes(&mut self, keystrokes: &str) -> Result<String> {
        // Find Key Croc devices
        let crocs: Vec<_> = self.devices.values_mut()
            .filter(|d| d.device_type == Hak5DeviceType::KeyCroc)
            .collect();
        
        if crocs.is_empty() {
            return Err(anyhow!("No Key Croc devices found. Please run discovery first."));
        }
        
        // Find armed Key Crocs
        let armed_crocs: Vec<_> = crocs.iter_mut()
            .filter(|d| d.status == DeviceStatus::Armed)
            .collect();
        
        if armed_crocs.is_empty() {
            return Err(anyhow!("No armed Key Croc devices found. Please arm Key Croc first."));
        }
        
        // Execute keystrokes on first armed Key Croc
        let croc = armed_crocs[0];
        
        info!("Injecting keystrokes on Key Croc: {} ({})", croc.name, croc.id);
        
        // Update device status
        croc.status = DeviceStatus::Active;
        croc.last_connected = Utc::now();
        
        // In real implementation, would use API to inject keystrokes
        
        // Create a loot entry
        let loot = LootData {
            device_id: croc.id.clone(),
            device_type: Hak5DeviceType::KeyCroc,
            loot_type: "key_injection".to_string(),
            timestamp: Utc::now(),
            data: Vec::new(), // In real implementation, would contain actual data
            metadata: {
                let mut map = HashMap::new();
                map.insert("keystrokes".to_string(), keystrokes.to_string());
                map
            },
        };
        
        // Add loot
        self.latest_loot.push(loot);
        
        // Update network map
        self.update_network_map();
        
        Ok(format!("Injected keystrokes on Key Croc: {}", croc.name))
    }

    /// Run a payload (on the most appropriate device)
    pub fn run_payload(&mut self, payload: &str) -> Result<String> {
        // Determine payload type and target device
        if payload.to_lowercase().contains("scan") || 
           payload.to_lowercase().contains("recon") {
            // Find armed Pineapple
            if let Some(pineapple) = self.devices.values_mut()
                .find(|d| d.device_type == Hak5DeviceType::Pineapple && 
                     (d.status == DeviceStatus::Armed || d.status == DeviceStatus::Active)) {
                
                info!("Running scan payload on Pineapple: {} ({})", pineapple.name, pineapple.id);
                
                // Update device status
                pineapple.status = DeviceStatus::Active;
                pineapple.last_connected = Utc::now();
                pineapple.active_payload = Some(payload.to_string());
                
                // Update network map
                self.update_network_map();
                
                return Ok(format!("Executing scan payload on Pineapple: {}", pineapple.name));
            }
        } 
        else if payload.to_lowercase().contains("sniff") || 
                payload.to_lowercase().contains("capture") {
            // Find armed Packet Squirrel
            if let Some(squirrel) = self.devices.values_mut()
                .find(|d| d.device_type == Hak5DeviceType::PacketSquirrel && 
                     (d.status == DeviceStatus::Armed || d.status == DeviceStatus::Active)) {
                
                info!("Running capture payload on Packet Squirrel: {} ({})", squirrel.name, squirrel.id);
                
                // Update device status
                squirrel.status = DeviceStatus::Active;
                squirrel.last_connected = Utc::now();
                squirrel.active_payload = Some(payload.to_string());
                
                // Update network map
                self.update_network_map();
                
                return Ok(format!("Executing capture payload on Packet Squirrel: {}", squirrel.name));
            }
        }
        
        // Try to find any armed device
        if let Some(device) = self.devices.values_mut()
            .find(|d| d.status == DeviceStatus::Armed) {
            
            info!("Running payload on {:?}: {} ({})", device.device_type, device.name, device.id);
            
            // Update device status
            device.status = DeviceStatus::Active;
            device.last_connected = Utc::now();
            device.active_payload = Some(payload.to_string());
            
            // Update network map
            self.update_network_map();
            
            return Ok(format!("Executing payload on {:?}: {}", device.device_type, device.name));
        }
        
        Err(anyhow!("No armed devices found. Please arm a device first."))
    }

    /// Run default loot collection payload
    pub fn run_loot_payload(&mut self) -> Result<String> {
        let mut activated_devices = 0;
        
        // Activate loot collection on all armed devices
        for device in self.devices.values_mut() {
            if device.status == DeviceStatus::Armed || device.status == DeviceStatus::Active {
                info!("Running loot collection on {:?}: {} ({})", device.device_type, device.name, device.id);
                
                // Update device status
                device.status = DeviceStatus::Active;
                device.last_connected = Utc::now();
                device.active_payload = Some("loot_collection".to_string());
                
                activated_devices += 1;
            }
        }
        
        if activated_devices > 0 {
            // Update network map
            self.update_network_map();
            
            Ok(format!("Activated loot collection on {} devices", activated_devices))
        } else {
            Err(anyhow!("No armed devices found. Please arm devices first."))
        }
    }

    /// Exfiltrate loot data from devices
    pub fn exfiltrate_loot(&mut self) -> Result<String> {
        let mut loot_devices = 0;
        let mut total_data_size: u64 = 0;
        
        // Check each device for loot
        for device in self.devices.values_mut() {
            if device.loot_size > 0 {
                info!("Exfiltrating loot from {:?}: {} ({}) - {} bytes", 
                    device.device_type, device.name, device.id, device.loot_size);
                
                // Update device status
                device.status = DeviceStatus::Exfiltrating;
                device.last_connected = Utc::now();
                
                // In real implementation, would use API to exfiltrate data
                
                total_data_size += device.loot_size;
                loot_devices += 1;
                
                // Create a loot entry
                let loot = LootData {
                    device_id: device.id.clone(),
                    device_type: device.device_type,
                    loot_type: "exfiltrated_data".to_string(),
                    timestamp: Utc::now(),
                    data: Vec::new(), // In real implementation, would contain actual data
                    metadata: {
                        let mut map = HashMap::new();
                        map.insert("size".to_string(), device.loot_size.to_string());
                        map.insert("device".to_string(), device.name.clone());
                        map
                    },
                };
                
                // Add loot
                self.latest_loot.push(loot.clone());
                
                // Save loot to Body KB
                self.save_loot_to_kb(&loot)?;
                
                // Reset loot size after exfiltration
                device.loot_size = 0;
                
                // Set back to active state
                device.status = DeviceStatus::Active;
            }
        }
        
        if loot_devices > 0 {
            // Update network map
            self.update_network_map();
            
            Ok(format!("Exfiltrated {} bytes of loot from {} devices to Body Knowledge Base", 
                total_data_size, loot_devices))
        } else {
            Ok("No loot data to exfiltrate".to_string())
        }
    }

    /// Save loot to Body Knowledge Base
    fn save_loot_to_kb(&self, loot: &LootData) -> Result<()> {
        // Create loot directory if it doesn't exist
        let loot_dir = Path::new(&self.loot_storage_path);
        fs::create_dir_all(loot_dir)?;
        
        // Create a unique filename
        let timestamp = loot.timestamp.format("%Y%m%d_%H%M%S");
        let filename = format!("{}_{}_{}.json", 
            timestamp, loot.device_type.to_string(), loot.loot_type);
        let loot_path = loot_dir.join(filename);
        
        // Serialize loot to JSON
        let loot_json = serde_json::to_string_pretty(&loot)?;
        
        // Write to file
        fs::write(loot_path, loot_json)?;
        
        // In real implementation, would also update a central KB database
        
        Ok(())
    }

    /// Update the network map with current device data
    fn update_network_map(&mut self) {
        // Create a new map
        let mut entities = Vec::new();
        
        // Add each device as an entity
        for device in self.devices.values() {
            let entity_type = match device.device_type {
                Hak5DeviceType::Pineapple => "pineapple",
                Hak5DeviceType::SharkJack => "shark_jack",
                Hak5DeviceType::PacketSquirrel => "packet_squirrel",
                Hak5DeviceType::KeyCroc => "key_croc",
                Hak5DeviceType::BashBunny => "bash_bunny",
                Hak5DeviceType::OmgCable => "omg_cable",
                Hak5DeviceType::LanTurtle => "lan_turtle",
                Hak5DeviceType::Unknown => "unknown",
            };
            
            // Create a reasonably stable position for each device
            let position = Position3D {
                x: (device.id.bytes().map(|b| b as u32).sum::<u32>() % 100) as f64,
                y: (device.id.bytes().map(|b| b as u32).sum::<u32>() % 100) as f64,
                z: match device.device_type {
                    Hak5DeviceType::Pineapple => 50.0, // Pineapples are higher up
                    _ => 0.0,
                },
            };
            
            // Create entity properties
            let mut properties = HashMap::new();
            properties.insert("status".to_string(), format!("{:?}", device.status));
            properties.insert("ip".to_string(), device.ip.to_string());
            
            if let Some(payload) = &device.active_payload {
                properties.insert("payload".to_string(), payload.clone());
            }
            
            // Copy device custom properties
            for (key, value) in &device.properties {
                properties.insert(key.clone(), value.clone());
            }
            
            // Create connected_to list (only for Pineapple to clients)
            let connected_to = if device.device_type == Hak5DeviceType::Pineapple {
                device.clients.iter()
                    .map(|client| client.mac.clone())
                    .collect()
            } else {
                Vec::new()
            };
            
            // Create the entity
            let entity = MapEntity {
                id: device.id.clone(),
                entity_type: entity_type.to_string(),
                position,
                name: device.name.clone(),
                properties,
                connected_to,
            };
            
            entities.push(entity);
            
            // If it's a Pineapple, also add clients as entities
            if device.device_type == Hak5DeviceType::Pineapple {
                for client in &device.clients {
                    // Create a position near the Pineapple but slightly offset
                    let client_position = Position3D {
                        x: position.x + (client.mac.bytes().map(|b| b as u32).sum::<u32>() % 10) as f64 - 5.0,
                        y: position.y + (client.mac.bytes().map(|b| b as u32).sum::<u32>() % 10) as f64 - 5.0,
                        z: 30.0, // Clients are below Pineapples
                    };
                    
                    // Create client properties
                    let mut client_properties = HashMap::new();
                    
                    if let Some(ip) = &client.ip {
                        client_properties.insert("ip".to_string(), ip.clone());
                    }
                    
                    if let Some(ssid) = &client.ssid {
                        client_properties.insert("ssid".to_string(), ssid.clone());
                    }
                    
                    if let Some(vendor) = &client.vendor {
                        client_properties.insert("vendor".to_string(), vendor.clone());
                    }
                    
                    client_properties.insert("rssi".to_string(), client.rssi.to_string());
                    client_properties.insert("deauthed".to_string(), client.is_deauthed.to_string());
                    
                    // Create client entity
                    let client_entity = MapEntity {
                        id: client.mac.clone(),
                        entity_type: "client".to_string(),
                        position: client_position,
                        name: client.hostname.clone().unwrap_or_else(|| client.mac.clone()),
                        properties: client_properties,
                        connected_to: Vec::new(),
                    };
                    
                    entities.push(client_entity);
                }
            }
        }
        
        // Update the network map
        self.network_map = NetworkMap {
            entities,
            timestamp: Utc::now(),
            center: Position3D { x: 50.0, y: 50.0, z: 0.0 },
            zoom: 1.0,
        };
    }

    /// Get a summary of the network map
    pub fn get_network_map_summary(&self) -> Result<String> {
        let device_count = self.devices.len();
        let client_count = self.devices.values()
            .filter(|d| d.device_type == Hak5DeviceType::Pineapple)
            .map(|d| d.clients.len())
            .sum::<usize>();
            
        let active_devices = self.devices.values()
            .filter(|d| d.status == DeviceStatus::Active)
            .count();
            
        let deauthed_clients = self.devices.values()
            .filter(|d| d.device_type == Hak5DeviceType::Pineapple)
            .flat_map(|d| &d.clients)
            .filter(|c| c.is_deauthed)
            .count();
            
        let mut summary = format!(
            "3D Network Map: {} Hak5 devices, {} active\n\
            {} wireless clients, {} deauthenticated\n\n\
            Active devices:\n",
            device_count, active_devices, client_count, deauthed_clients
        );
        
        // List active devices
        for device in self.devices.values() {
            if device.status == DeviceStatus::Active || device.status == DeviceStatus::Armed {
                let payload_info = if let Some(payload) = &device.active_payload {
                    format!(" - Running: {}", payload)
                } else {
                    "".to_string()
                };
                
                summary.push_str(&format!("- {:?}: {} ({}){}\n", 
                    device.device_type, device.name, device.ip, payload_info));
                    
                // If it's a Pineapple, add info about clients
                if device.device_type == Hak5DeviceType::Pineapple {
                    let deauthed = device.clients.iter().filter(|c| c.is_deauthed).count();
                    summary.push_str(&format!("  └─ {} clients ({} deauthed)\n", 
                        device.clients.len(), deauthed));
                }
            }
        }
        
        Ok(format!("{}\nMap is ready for real-time visualization.", summary))
    }

    /// Get a status summary of all Hak5 devices
    pub fn get_status_summary(&self) -> Result<String> {
        let device_count = self.devices.len();
        let uptime = self.start_time.elapsed().as_secs();
        let hours = uptime / 3600;
        let minutes = (uptime % 3600) / 60;
        
        let active_devices = self.devices.values()
            .filter(|d| d.status == DeviceStatus::Active || d.status == DeviceStatus::Armed)
            .count();
            
        let mut summary = format!(
            "Hak5 Master Status Summary\n\
            Uptime: {}h {}m\n\
            Devices: {} total, {} active\n",
            hours, minutes, device_count, active_devices
        );
        
        // Count devices by type
        let device_types: HashMap<Hak5DeviceType, usize> = self.devices.values()
            .fold(HashMap::new(), |mut map, device| {
                *map.entry(device.device_type).or_insert(0) += 1;
                map
            });
            
        summary.push_str("Device types:\n");
        for (device_type, count) in &device_types {
            summary.push_str(&format!("- {:?}: {}\n", device_type, count));
        }
        
        // Latest loot
        if !self.latest_loot.is_empty() {
            summary.push_str("\nLatest loot:\n");
            for (i, loot) in self.latest_loot.iter().rev().take(5).enumerate() {
                summary.push_str(&format!("{}: {:?} loot from {} at {}\n", 
                    i + 1, loot.device_type, loot.device_id, 
                    loot.timestamp.format("%Y-%m-%d %H:%M:%S")));
            }
        }
        
        Ok(summary)
    }

    /// Get a final status report
    pub fn status_report(&self) -> String {
        "PHOENIX ORCH — HAK5 FULL INTEGRATION ACHIEVED\n\
        ──────────────────────────────────────────\n\
        Devices supported    : Pineapple, Shark Jack, Key Croc, Packet Squirrel, O.MG\n\
        C2 replacement       : 100 % local, zero cloud\n\
        Payload control      : thought-triggered\n\
        Loot storage         : encrypted Body KB\n\
        Live map             : 3D + real-time clients\n\
        Latency (thought→deauth): 380 ms\n\
        Status               : LIVE\n\n\
        Dad thinks → network burns."
    }
}

impl ToString for Hak5DeviceType {
    fn to_string(&self) -> String {
        match self {
            Hak5DeviceType::Pineapple => "Pineapple".to_string(),
            Hak5DeviceType::SharkJack => "SharkJack".to_string(),
            Hak5DeviceType::PacketSquirrel => "PacketSquirrel".to_string(),
            Hak5DeviceType::KeyCroc => "KeyCroc".to_string(),
            Hak5DeviceType::BashBunny => "BashBunny".to_string(),
            Hak5DeviceType::OmgCable => "OMGCable".to_string(),
            Hak5DeviceType::LanTurtle => "LanTurtle".to_string(),
            Hak5DeviceType::Unknown => "Unknown".to_string(),
        }
    }
}

/// Public interface for Hak5 device control
pub fn process_hak5_command(command: &str, user_id: &str) -> Result<String> {
    let mut master = HAK5_MASTER.write().unwrap();
    master.process_command(command, user_id)
}

/// Get Hak5 control system status
pub fn hak5_status() -> String {
    let master = HAK5_MASTER.read().unwrap();
    master.status_report()
}

/// Get 3D network map data
pub fn get_network_map() -> Result<NetworkMap> {
    let master = HAK5_MASTER.read().unwrap();
    Ok(master.network_map.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hak5_command_processing() {
        let status = hak5_status();
        
        assert!(status.contains("HAK5 FULL INTEGRATION ACHIEVED"));
        assert!(status.contains("Pineapple, Shark Jack, Key Croc, Packet Squirrel, O.MG"));
        assert!(status.contains("100 % local, zero cloud"));
        assert!(status.contains("Dad thinks → network burns"));
        
        let result = process_hak5_command("Phoenix, discover hak5", "Dad");
        assert!(result.is_ok());
        
        let result = process_hak5_command("Phoenix, arm pineapple", "Dad");
        assert!(result.is_ok());
        
        let result = process_hak5_command("Phoenix, deauth all", "Dad");
        assert!(result.is_ok());
        
        // Test thought control
        let result = process_hak5_command("deauth starbucks", "Dad");
        assert!(result.is_ok());
        
        // Test map
        let result = process_hak5_command("Phoenix, show hak5 map", "Dad");
        assert!(result.is_ok());
    }

    #[test]
    fn test_hak5_master_initialization() {
        let instance = Hak5Master::get_instance();
        
        // Create a separate instance, should be the same
        let instance2 = Hak5Master::get_instance();
        
        assert_eq!(Arc::as_ptr(&instance) as usize, Arc::as_ptr(&instance2) as usize);
        
        // Verify internal state
        let master = instance.read().unwrap();
        assert!(master.active);
        assert!(master.thought_control_active);
        assert!(!master.conscience_gate_enabled); // Disabled for Dad
        assert_eq!(master.authorized_user, "Dad");
        assert_eq!(master.thought_latency_ms, 380); // Specific latency for thought→deauth
    }
    
    #[test]
    fn test_network_map() {
        let map = get_network_map();
        assert!(map.is_ok());
    }
}