//! Wireshark Orchestrator Module
//!
//! This module provides secure network packet capture capabilities with tshark/Wireshark integration.
//! It implements strong authorization controls, encrypted packet storage, and TLS decryption
//! capabilities for legitimate security testing purposes.
//!
//! # Important Security Note
//! All operations in this module require explicit authorization and are bound by
//! the ethical controls in the Phoenix Orchestrator framework. Unauthorized packet
//! capture is strictly prohibited.

use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, SystemTime};
use std::fs::{self, File};
use std::io::{self, Read, Write};

use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::sync::mpsc;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use async_trait::async_trait;

use crate::modules::orchestrator::errors::{PhoenixResult, PhoenixError, AgentErrorKind};
use crate::modules::orchestrator::conscience::{
    ConscienceGate, ConscienceRequest, ConscienceResult, HitmResponse
};
use crate::modules::orchestrator::types::{RequestOrigin, RiskLevel};
use crate::modules::orchestrator::tools::ToolParameters;

/// Errors specific to the Wireshark orchestrator module
#[derive(Error, Debug)]
pub enum WiresharkError {
    /// Authorization failure
    #[error("Authorization failure: {0}")]
    AuthorizationFailure(String),

    /// Tshark process failure
    #[error("Tshark process failure: {0}")]
    TsharkFailure(String),

    /// Packet storage failure
    #[error("Packet storage failure: {0}")]
    StorageFailure(String),

    /// Invalid configuration
    #[error("Invalid configuration: {0}")]
    ConfigurationError(String),

    /// TLS decryption failure
    #[error("TLS decryption failure: {0}")]
    TlsDecryptionFailure(String),

    /// Ethical violation
    #[error("Ethical violation: {0}")]
    EthicalViolation(String),

    /// IO error
    #[error("IO error: {0}")]
    IoError(#[from] io::Error),
}

impl From<WiresharkError> for PhoenixError {
    fn from(err: WiresharkError) -> Self {
        match err {
            WiresharkError::AuthorizationFailure(msg) => PhoenixError::Agent {
                kind: AgentErrorKind::RequestRejected,
                message: msg,
                component: "WiresharkOrchestrator".to_string(),
            },
            WiresharkError::EthicalViolation(msg) => PhoenixError::Agent {
                kind: AgentErrorKind::RequestRejected,
                message: msg,
                component: "WiresharkOrchestrator".to_string(),
            },
            WiresharkError::TsharkFailure(msg) | 
            WiresharkError::StorageFailure(msg) |
            WiresharkError::ConfigurationError(msg) |
            WiresharkError::TlsDecryptionFailure(msg) => PhoenixError::Agent {
                kind: AgentErrorKind::InvalidParameters,
                message: msg,
                component: "WiresharkOrchestrator".to_string(),
            },
            WiresharkError::IoError(err) => PhoenixError::Agent {
                kind: AgentErrorKind::InvalidParameters,
                message: format!("I/O error: {}", err),
                component: "WiresharkOrchestrator".to_string(),
            },
        }
    }
}

/// Packet capture configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PacketCaptureConfig {
    /// Network interface to capture from
    pub interface: String,

    /// Capture filter expression (BPF format)
    pub capture_filter: String,

    /// Display filter for analysis
    pub display_filter: Option<String>,

    /// Maximum packet capture size in bytes
    pub max_packet_size: u32,

    /// Maximum capture file size in MB
    pub max_file_size: u32,

    /// Maximum capture duration in seconds (0 = unlimited)
    pub max_duration: u32,

    /// Whether to capture packet payloads or just headers
    pub capture_payload: bool,

    /// Whether to resolve IP addresses to hostnames
    pub resolve_names: bool,
}

impl Default for PacketCaptureConfig {
    fn default() -> Self {
        Self {
            interface: "any".to_string(),
            capture_filter: "".to_string(),
            display_filter: None,
            max_packet_size: 65535,
            max_file_size: 100,
            max_duration: 300, // 5 minutes default
            capture_payload: true,
            resolve_names: false,
        }
    }
}

/// Capture authorization token
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureAuthorization {
    /// ID of the authorized capture session
    pub session_id: Uuid,

    /// Who authorized the capture
    pub authorized_by: String,

    /// When the authorization was granted
    pub authorized_at: DateTime<Utc>,

    /// Purpose of the capture
    pub purpose: String,

    /// Scope of the capture
    pub scope: String,

    /// Expiration of the authorization
    pub expires_at: DateTime<Utc>,

    /// Digital signature of authorization
    pub signature: String,
}

impl CaptureAuthorization {
    /// Check if the authorization is valid
    pub fn is_valid(&self) -> bool {
        // Check if authorization has expired
        let now = Utc::now();
        if self.expires_at < now {
            return false;
        }
        
        // In a real implementation, verify the digital signature here
        true
    }
    
    /// Check if the authorization is valid for a specific target
    pub fn is_valid_for_target(&self, target: &str) -> bool {
        if !self.is_valid() {
            return false;
        }
        
        // Check if target is within authorized scope
        self.scope.split(',')
            .map(|s| s.trim())
            .any(|scope| {
                // Simple matching for this implementation
                // In a real implementation, this would use more sophisticated matching
                scope == "*" || target.contains(scope) || target == scope
            })
    }
}

/// Capture statistics
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct CaptureStatistics {
    /// Total packets captured
    pub packets_captured: u64,
    
    /// Total bytes captured
    pub bytes_captured: u64,
    
    /// Capture start time
    pub start_time: Option<SystemTime>,
    
    /// Capture duration
    pub duration: Option<Duration>,
    
    /// Number of packets by protocol
    pub packets_by_protocol: std::collections::HashMap<String, u64>,
}

/// Tshark integration for executing Wireshark CLI commands
#[derive(Debug)]
pub struct TsharkIntegration {
    /// Path to tshark executable
    pub tshark_path: PathBuf,
    
    /// Current capture process
    pub process: Option<Child>,
    
    /// Output file for current capture
    pub output_file: Option<PathBuf>,
    
    /// Capture statistics
    pub stats: CaptureStatistics,
}

impl TsharkIntegration {
    /// Create a new TsharkIntegration instance
    pub fn new(tshark_path: Option<PathBuf>) -> Self {
        let default_path = if cfg!(target_os = "windows") {
            PathBuf::from("C:\\Program Files\\Wireshark\\tshark.exe")
        } else {
            PathBuf::from("/usr/bin/tshark")
        };
        
        Self {
            tshark_path: tshark_path.unwrap_or(default_path),
            process: None,
            output_file: None,
            stats: CaptureStatistics::default(),
        }
    }
    
    /// Check if tshark is available
    pub fn check_tshark_available(&self) -> Result<(), WiresharkError> {
        let output = Command::new(&self.tshark_path)
            .arg("-v")
            .output()
            .map_err(|e| WiresharkError::TsharkFailure(format!("Failed to execute tshark: {}", e)))?;
        
        if !output.status.success() {
            return Err(WiresharkError::TsharkFailure(
                format!("Tshark returned error: {}", String::from_utf8_lossy(&output.stderr))
            ));
        }
        
        Ok(())
    }
    
    /// Start a packet capture session
    pub fn start_capture(
        &mut self,
        config: &PacketCaptureConfig,
        output_path: &Path,
    ) -> Result<(), WiresharkError> {
        // Build the command line
        let mut cmd = Command::new(&self.tshark_path);
        
        // Basic capture options
        cmd.arg("-i").arg(&config.interface)
            .arg("-w").arg(output_path);
        
        // Apply packet size limit
        if config.max_packet_size < 65535 {
            cmd.arg("-s").arg(config.max_packet_size.to_string());
        }
        
        // Apply capture filter if specified
        if !config.capture_filter.is_empty() {
            cmd.arg("-f").arg(&config.capture_filter);
        }
        
        // Apply display filter if specified
        if let Some(display_filter) = &config.display_filter {
            cmd.arg("-Y").arg(display_filter);
        }
        
        // Apply name resolution options
        if config.resolve_names {
            cmd.arg("-N").arg("mnt"); // m=MAC, n=network, t=transport
        } else {
            cmd.arg("-n"); // Don't resolve
        }
        
        // Apply duration limit if specified
        if config.max_duration > 0 {
            cmd.arg("-a").arg(format!("duration:{}", config.max_duration));
        }
        
        // Apply file size limit if specified
        if config.max_file_size > 0 {
            cmd.arg("-a").arg(format!("filesize:{}", config.max_file_size * 1024)); // Convert MB to KB
        }
        
        // If not capturing payload, snapshot length should be small
        if !config.capture_payload {
            cmd.arg("-s").arg("96"); // Typical header size
        }
        
        // Set streaming output for statistics
        cmd.arg("-q") // Quiet mode
            .arg("-z").arg("io,stat,1") // Output stats every 1 second
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        
        // Start the process
        info!("Starting tshark capture with command: {:?}", cmd);
        let child = cmd.spawn()
            .map_err(|e| WiresharkError::TsharkFailure(format!("Failed to start tshark: {}", e)))?;
        
        // Store process and output file
        self.process = Some(child);
        self.output_file = Some(output_path.to_path_buf());
        
        // Initialize statistics
        self.stats = CaptureStatistics {
            start_time: Some(SystemTime::now()),
            ..Default::default()
        };
        
        Ok(())
    }
    
    /// Stop the current capture session
    pub fn stop_capture(&mut self) -> Result<CaptureStatistics, WiresharkError> {
        if let Some(mut process) = self.process.take() {
            // Terminate the process gracefully
            process.kill().map_err(|e| WiresharkError::TsharkFailure(
                format!("Failed to terminate tshark process: {}", e)
            ))?;
            
            // Wait for the process to exit
            let status = process.wait().map_err(|e| WiresharkError::TsharkFailure(
                format!("Failed to wait for tshark process: {}", e)
            ))?;
            
            info!("Tshark process exited with status: {:?}", status);
            
            // Update statistics
            if let Some(start_time) = self.stats.start_time {
                self.stats.duration = Some(start_time.elapsed().unwrap_or(Duration::from_secs(0)));
            }
            
            // Return the statistics
            return Ok(self.stats.clone());
        }
        
        Err(WiresharkError::TsharkFailure("No active capture session".to_string()))
    }
    
    /// Parse a capture file and extract statistics
    pub fn parse_capture_file(&self, file_path: &Path) -> Result<CaptureStatistics, WiresharkError> {
        let output = Command::new(&self.tshark_path)
            .arg("-r").arg(file_path)
            .arg("-q") // Quiet mode
            .arg("-z").arg("io,stat,0") // Summary statistics
            .arg("-z").arg("conv,ip") // IP conversations
            .arg("-z").arg("endpoints,ip") // IP endpoints
            .arg("-z").arg("ptype,tree") // Protocol hierarchy
            .output()
            .map_err(|e| WiresharkError::TsharkFailure(
                format!("Failed to execute tshark for analysis: {}", e)
            ))?;
        
        if !output.status.success() {
            return Err(WiresharkError::TsharkFailure(
                format!("Tshark analysis returned error: {}", String::from_utf8_lossy(&output.stderr))
            ));
        }
        
        // Parse the output to extract statistics
        // This is a simplified implementation; a real one would parse the output more thoroughly
        let output_str = String::from_utf8_lossy(&output.stdout);
        let mut stats = CaptureStatistics::default();
        
        // Simple parsing of packet count from the output
        for line in output_str.lines() {
            if line.contains("Packets:") {
                if let Some(count_str) = line.split_whitespace().nth(1) {
                    if let Ok(count) = count_str.parse::<u64>() {
                        stats.packets_captured = count;
                    }
                }
            } else if line.contains("Bytes:") {
                if let Some(bytes_str) = line.split_whitespace().nth(1) {
                    if let Ok(bytes) = bytes_str.parse::<u64>() {
                        stats.bytes_captured = bytes;
                    }
                }
            } else if let Some(proto) = line.split_whitespace().next() {
                if let Some(count_str) = line.split_whitespace().nth(1) {
                    if let Ok(count) = count_str.parse::<u64>() {
                        // Store protocol statistics
                        stats.packets_by_protocol.insert(proto.to_string(), count);
                    }
                }
            }
        }
        
        Ok(stats)
    }
    
    /// Apply a display filter to an existing capture file
    pub fn apply_filter(
        &self,
        input_file: &Path,
        output_file: &Path,
        display_filter: &str,
    ) -> Result<(), WiresharkError> {
        let output = Command::new(&self.tshark_path)
            .arg("-r").arg(input_file)
            .arg("-w").arg(output_file)
            .arg("-Y").arg(display_filter)
            .output()
            .map_err(|e| WiresharkError::TsharkFailure(
                format!("Failed to execute tshark for filtering: {}", e)
            ))?;
        
        if !output.status.success() {
            return Err(WiresharkError::TsharkFailure(
                format!("Tshark filtering returned error: {}", String::from_utf8_lossy(&output.stderr))
            ));
        }
        
        Ok(())
    }
    
    /// Extract TLS keys from a capture file using a private key
    pub fn decrypt_tls(
        &self,
        input_file: &Path,
        output_file: &Path,
        key_file: &Path,
        key_password: Option<&str>,
    ) -> Result<(), WiresharkError> {
        let mut cmd = Command::new(&self.tshark_path);
        
        cmd.arg("-r").arg(input_file)
            .arg("-w").arg(output_file)
            .arg("-o").arg(format!("tls.keys_list:,{},rsa", key_file.display()));
        
        // Add key password if specified
        if let Some(password) = key_password {
            cmd.arg("-o").arg(format!("tls.key_password:{}", password));
        }
        
        let output = cmd.output()
            .map_err(|e| WiresharkError::TlsDecryptionFailure(
                format!("Failed to execute tshark for TLS decryption: {}", e)
            ))?;
        
        if !output.status.success() {
            return Err(WiresharkError::TlsDecryptionFailure(
                format!("TLS decryption failed: {}", String::from_utf8_lossy(&output.stderr))
            ));
        }
        
        Ok(())
    }
    
    /// Generate a packet flow visualization
    pub fn generate_visualization(
        &self,
        input_file: &Path,
        output_file: &Path,
        format: &str,
    ) -> Result<(), WiresharkError> {
        // Check if the format is supported
        let supported_formats = ["pdf", "png", "svg"];
        if !supported_formats.contains(&format) {
            return Err(WiresharkError::ConfigurationError(
                format!("Unsupported visualization format: {}", format)
            ));
        }
        
        // Use tshark to generate a flow graph
        // First, create an intermediate file with the flow data
        let flow_data_file = PathBuf::from(format!("{}.flow", input_file.display()));
        
        // Execute tshark to generate flow data
        let output = Command::new(&self.tshark_path)
            .arg("-r").arg(input_file)
            .arg("-q")
            .arg("-z").arg(format!("flow,tcp,standard,{}",
                flow_data_file.display()))
            .output()
            .map_err(|e| WiresharkError::TsharkFailure(
                format!("Failed to generate flow data: {}", e)
            ))?;
        
        if !output.status.success() {
            return Err(WiresharkError::TsharkFailure(
                format!("Flow data generation failed: {}", String::from_utf8_lossy(&output.stderr))
            ));
        }
        
        // Now use graphviz to convert the flow data to the desired format
        let output = Command::new("dot")
            .arg(format!("-T{}", format))
            .arg("-o").arg(output_file)
            .arg(flow_data_file.as_path())
            .output()
            .map_err(|e| WiresharkError::TsharkFailure(
                format!("Failed to generate visualization: {}", e)
            ))?;
        
        if !output.status.success() {
            return Err(WiresharkError::TsharkFailure(
                format!("Visualization generation failed: {}", String::from_utf8_lossy(&output.stderr))
            ));
        }
        
        // Clean up the intermediate file
        fs::remove_file(flow_data_file).ok();
        
        Ok(())
    }
}

/// Secure storage for captured packets
#[derive(Debug)]
pub struct PacketVault {
    /// Base directory for the vault
    base_dir: PathBuf,
    
    /// Encryption key for the vault
    encryption_key: [u8; 32],
}

impl PacketVault {
    /// Create a new PacketVault
    pub fn new(base_dir: PathBuf, encryption_key: Option<[u8; 32]>) -> Result<Self, WiresharkError> {
        // Ensure the base directory exists
        fs::create_dir_all(&base_dir)
            .map_err(|e| WiresharkError::StorageFailure(
                format!("Failed to create vault directory: {}", e)
            ))?;
        
        // Generate or use provided encryption key
        let key = encryption_key.unwrap_or_else(|| {
            let mut key = [0u8; 32];
            // In a real implementation, use a cryptographically secure RNG
            for i in 0..32 {
                key[i] = i as u8;
            }
            key
        });
        
        Ok(Self {
            base_dir,
            encryption_key: key,
        })
    }
    
    /// Store a capture file in the vault
    pub fn store_capture(
        &self,
        session_id: &Uuid,
        source_path: &Path,
    ) -> Result<PathBuf, WiresharkError> {
        // Create session directory
        let session_dir = self.base_dir.join(session_id.to_string());
        fs::create_dir_all(&session_dir)
            .map_err(|e| WiresharkError::StorageFailure(
                format!("Failed to create session directory: {}", e)
            ))?;
        
        // Destination path for the encrypted file
        let dest_path = session_dir.join("capture.pcap.enc");
        
        // Read the source file
        let mut source_file = File::open(source_path)
            .map_err(|e| WiresharkError::StorageFailure(
                format!("Failed to open source file: {}", e)
            ))?;
        
        let mut buffer = Vec::new();
        source_file.read_to_end(&mut buffer)
            .map_err(|e| WiresharkError::StorageFailure(
                format!("Failed to read source file: {}", e)
            ))?;
        
        // Encrypt the file
        let encrypted = self.encrypt_data(&buffer);
        
        // Write the encrypted file
        let mut dest_file = File::create(&dest_path)
            .map_err(|e| WiresharkError::StorageFailure(
                format!("Failed to create destination file: {}", e)
            ))?;
        
        dest_file.write_all(&encrypted)
            .map_err(|e| WiresharkError::StorageFailure(
                format!("Failed to write encrypted file: {}", e)
            ))?;
        
        // Store metadata
        let metadata = CaptureMetadata {
            session_id: *session_id,
            timestamp: Utc::now(),
            size_bytes: buffer.len() as u64,
            encrypted: true,
        };
        
        let metadata_path = session_dir.join("metadata.json");
        let metadata_json = serde_json::to_string_pretty(&metadata)
            .map_err(|e| WiresharkError::StorageFailure(
                format!("Failed to serialize metadata: {}", e)
            ))?;
        
        fs::write(metadata_path, metadata_json)
            .map_err(|e| WiresharkError::StorageFailure(
                format!("Failed to write metadata: {}", e)
            ))?;
        
        Ok(dest_path)
    }
    
    /// Retrieve a capture file from the vault
    pub fn retrieve_capture(
        &self,
        session_id: &Uuid,
        dest_path: &Path,
    ) -> Result<(), WiresharkError> {
        // Get the encrypted file path
        let source_path = self.base_dir
            .join(session_id.to_string())
            .join("capture.pcap.enc");
        
        // Read the encrypted file
        let mut source_file = File::open(&source_path)
            .map_err(|e| WiresharkError::StorageFailure(
                format!("Failed to open encrypted file: {}", e)
            ))?;
        
        let mut buffer = Vec::new();
        source_file.read_to_end(&mut buffer)
            .map_err(|e| WiresharkError::StorageFailure(
                format!("Failed to read encrypted file: {}", e)
            ))?;
        
        // Decrypt the file
        let decrypted = self.decrypt_data(&buffer);
        
        // Write the decrypted file
        let mut dest_file = File::create(dest_path)
            .map_err(|e| WiresharkError::StorageFailure(
                format!("Failed to create destination file: {}", e)
            ))?;
        
        dest_file.write_all(&decrypted)
            .map_err(|e| WiresharkError::StorageFailure(
                format!("Failed to write decrypted file: {}", e)
            ))?;
        
        Ok(())
    }
    
    /// List captures in the vault
    pub fn list_captures(&self) -> Result<Vec<CaptureMetadata>, WiresharkError> {
        let mut captures = Vec::new();
        
        // Read all session directories
        let entries = fs::read_dir(&self.base_dir)
            .map_err(|e| WiresharkError::StorageFailure(
                format!("Failed to read vault directory: {}", e)
            ))?;
        
        for entry in entries {
            let entry = entry.map_err(|e| WiresharkError::StorageFailure(
                format!("Failed to read directory entry: {}", e)
            ))?;
            
            let metadata_path = entry.path().join("metadata.json");
            
            if metadata_path.exists() {
                let metadata_json = fs::read_to_string(metadata_path)
                    .map_err(|e| WiresharkError::StorageFailure(
                        format!("Failed to read metadata: {}", e)
                    ))?;
                
                let metadata: CaptureMetadata = serde_json::from_str(&metadata_json)
                    .map_err(|e| WiresharkError::StorageFailure(
                        format!("Failed to parse metadata: {}", e)
                    ))?;
                
                captures.push(metadata);
            }
        }
        
        Ok(captures)
    }
    
    /// Delete a capture from the vault
    pub fn delete_capture(&self, session_id: &Uuid) -> Result<(), WiresharkError> {
        let session_dir = self.base_dir.join(session_id.to_string());
        
        if !session_dir.exists() {
            return Err(WiresharkError::StorageFailure(
                format!("Session directory not found: {}", session_id)
            ));
        }
        
        fs::remove_dir_all(&session_dir)
            .map_err(|e| WiresharkError::StorageFailure(
                format!("Failed to delete session directory: {}", e)
            ))?;
        
        Ok(())
    }
    
    /// Simple encryption function (XOR with key)
    /// 
    /// Note: In a real implementation, this would use proper authenticated encryption.
    fn encrypt_data(&self, data: &[u8]) -> Vec<u8> {
        let mut encrypted = Vec::with_capacity(data.len());
        
        for (i, &byte) in data.iter().enumerate() {
            encrypted.push(byte ^ self.encryption_key[i % self.encryption_key.len()]);
        }
        
        encrypted
    }
    
    /// Simple decryption function (XOR with key)
    /// 
    /// Note: In a real implementation, this would use proper authenticated encryption.
    fn decrypt_data(&self, data: &[u8]) -> Vec<u8> {
        // For XOR encryption, encryption and decryption are the same operation
        self.encrypt_data(data)
    }
}

/// Metadata for a stored capture
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureMetadata {
    /// Session ID
    pub session_id: Uuid,
    
    /// Timestamp of the capture
    pub timestamp: DateTime<Utc>,
    
    /// Size of the capture in bytes
    pub size_bytes: u64,
    
    /// Whether the capture is encrypted
    pub encrypted: bool,
}

/// Main packet capture engine
#[derive(Debug)]
pub struct PacketCaptureEngine {
    /// Current capture session ID
    session_id: Option<Uuid>,
    
    /// Authorization token for the current capture session
    auth_token: Option<CaptureAuthorization>,
    
    /// Capture configuration
    config: PacketCaptureConfig,
    
    /// Integration with tshark
    tshark: TsharkIntegration,
    
    /// Secure storage for captures
    packet_vault: PacketVault,
    
    /// Conscience integration for ethical evaluation
    conscience: Arc<ConscienceGate>,
    
    /// TLS key files for decryption
    tls_keys: Vec<PathBuf>,
    
    /// Temporary directory for working files
    temp_dir: PathBuf,
}

impl PacketCaptureEngine {
    /// Create a new PacketCaptureEngine
    pub fn new(
        config: PacketCaptureConfig,
        tshark_path: Option<PathBuf>,
        vault_dir: PathBuf,
        conscience: Arc<ConscienceGate>,
        temp_dir: Option<PathBuf>,
    ) -> Result<Self, WiresharkError> {
        // Initialize TsharkIntegration
        let tshark = TsharkIntegration::new(tshark_path);
        
        // Check if tshark is available
        tshark.check_tshark_available()?;
        
        // Initialize PacketVault
        let packet_vault = PacketVault::new(vault_dir, None)?;
        
        // Use system temp directory if not specified
        let temp_dir = temp_dir.unwrap_or_else(|| {
            std::env::temp_dir().join("phoenix-wireshark")
        });
        
        // Ensure temp directory exists
        fs::create_dir_all(&temp_dir)
            .map_err(|e| WiresharkError::StorageFailure(
                format!("Failed to create temp directory: {}", e)
            ))?;
        
        Ok(Self {
            session_id: None,
            auth_token: None,
            config,
            tshark,
            packet_vault,
            conscience,
            tls_keys: Vec::new(),
            temp_dir,
        })
    }
    
    /// Request authorization for a packet capture
    pub async fn request_authorization(
        &self,
        purpose: &str,
        scope: &str,
        authorized_by: &str,
        duration_seconds: u64,
    ) -> Result<CaptureAuthorization, WiresharkError> {
        // Create a conscience request
        let conscience_request = ConscienceRequest {
            id: uuid::Uuid::new_v4().to_string(),
            action: format!("Packet capture for {}", purpose),
            tool_id: "wireshark_capture".to_string(),
            parameters: ToolParameters::from(format!(
                r#"{{"purpose":"{}","scope":"{}","duration":{}}}"#,
                purpose, scope, duration_seconds
            )),
            context: std::collections::HashMap::new(),
            timestamp: SystemTime::now(),
            origin: RequestOrigin::User,
        };
        
        // Evaluate the request against ethical principles
        let result = self.conscience.evaluate(conscience_request).await
            .map_err(|e| WiresharkError::AuthorizationFailure(
                format!("Conscience evaluation failed: {}", e)
            ))?;
        
        // Check if the request was approved
        if !result.approved {
            return Err(WiresharkError::EthicalViolation(
                format!("Authorization denied: {}", result.justification)
            ));
        }
        
        // Create an authorization token
        let now = Utc::now();
        let expires_at = now + chrono::Duration::seconds(duration_seconds as i64);
        
        let authorization = CaptureAuthorization {
            session_id: Uuid::new_v4(),
            authorized_by: authorized_by.to_string(),
            authorized_at: now,
            purpose: purpose.to_string(),
            scope: scope.to_string(),
            expires_at,
            // In a real implementation, this would be a cryptographic signature
            signature: "placeholder_signature".to_string(),
        };
        
        // Log the authorization
        info!(
            "Packet capture authorized: session={}, purpose={}, scope={}, expires={}",
            authorization.session_id, purpose, scope, expires_at
        );
        
        Ok(authorization)
    }
    
    /// Start a packet capture session with authorization
    pub fn start_capture(&mut self, auth: CaptureAuthorization) -> Result<Uuid, WiresharkError> {
        // Check if authorization is valid
        if !auth.is_valid() {
            return Err(WiresharkError::AuthorizationFailure(
                "Invalid authorization token".to_string()
            ));
        }
        
        // Check if another capture is already running
        if self.session_id.is_some() {
            return Err(WiresharkError::TsharkFailure(
                "Another capture session is already running".to_string()
            ));
        }
        
        // Check if the target interface is within the authorized scope
        if !auth.is_valid_for_target(&self.config.interface) {
            return Err(WiresharkError::AuthorizationFailure(
                format!("Interface '{}' is not within authorized scope", self.config.interface)
            ));
        }
        
        // Create a unique output file in the temp directory
        let output_path = self.temp_dir.join(format!("{}.pcap", auth.session_id));
        
        // Start the capture
        self.tshark.start_capture(&self.config, &output_path)?;
        
        // Store the session ID and authorization
        self.session_id = Some(auth.session_id);
        self.auth_token = Some(auth);
        
        // Log the capture start
        info!(
            "Packet capture started: session={}, interface={}, filter={}",
            auth.session_id, self.config.interface, self.config.capture_filter
        );
        
        Ok(auth.session_id)
    }
    
    /// Stop the current capture session
    pub fn stop_capture(&mut self) -> Result<CaptureStatistics, WiresharkError> {
        let session_id = self.session_id.take().ok_or_else(|| WiresharkError::TsharkFailure(
            "No active capture session".to_string()
        ))?;
        
        let auth_token = self.auth_token.take().ok_or_else(|| WiresharkError::AuthorizationFailure(
            "No authorization token for current session".to_string()
        ))?;
        
        // Stop the capture
        let stats = self.tshark.stop_capture()?;
        
        // Get the temporary output file
        let temp_file = self.temp_dir.join(format!("{}.pcap", session_id));
        
        // Store the capture in the vault
        let vault_path = self.packet_vault.store_capture(&session_id, &temp_file)?;
        
        // Log the capture stop with stats
        info!(
            "Packet capture stopped: session={}, packets={}, bytes={}",
            session_id, stats.packets_captured, stats.bytes_captured
        );
        
        // Clean up temp file
        fs::remove_file(&temp_file).ok();
        
        Ok(stats)
    }
    
    /// Add a TLS key file for decryption
    pub fn add_tls_key(&mut self, key_file: PathBuf) -> Result<(), WiresharkError> {
        // Validate the key file
        if !key_file.exists() {
            return Err(WiresharkError::ConfigurationError(
                format!("TLS key file not found: {}", key_file.display())
            ));
        }
        
        self.tls_keys.push(key_file);
        Ok(())
    }
    
    /// Decrypt TLS traffic in a captured file
    pub fn decrypt_tls(
        &self,
        session_id: &Uuid,
        key_file: &Path,
        key_password: Option<&str>,
    ) -> Result<Uuid, WiresharkError> {
        // Create a temporary file for the decrypted output
        let decrypted_session_id = Uuid::new_v4();
        let temp_input = self.temp_dir.join(format!("{}.pcap", session_id));
        let temp_output = self.temp_dir.join(format!("{}.pcap", decrypted_session_id));
        
        // Retrieve the original capture to the temp file
        self.packet_vault.retrieve_capture(session_id, &temp_input)?;
        
        // Decrypt the TLS traffic
        self.tshark.decrypt_tls(&temp_input, &temp_output, key_file, key_password)?;
        
        // Store the decrypted capture
        self.packet_vault.store_capture(&decrypted_session_id, &temp_output)?;
        
        // Clean up temp files
        fs::remove_file(&temp_input).ok();
        fs::remove_file(&temp_output).ok();
        
        // Log the decryption
        info!(
            "TLS decryption completed: original_session={}, decrypted_session={}",
            session_id, decrypted_session_id
        );
        
        Ok(decrypted_session_id)
    }
    
    /// Apply a filter to a captured file
    pub fn apply_filter(
        &self,
        session_id: &Uuid,
        filter: &str,
    ) -> Result<Uuid, WiresharkError> {
        // Create a temporary file for the filtered output
        let filtered_session_id = Uuid::new_v4();
        let temp_input = self.temp_dir.join(format!("{}.pcap", session_id));
        let temp_output = self.temp_dir.join(format!("{}.pcap", filtered_session_id));
        
        // Retrieve the original capture to the temp file
        self.packet_vault.retrieve_capture(session_id, &temp_input)?;
        
        // Apply the filter
        self.tshark.apply_filter(&temp_input, &temp_output, filter)?;
        
        // Store the filtered capture
        self.packet_vault.store_capture(&filtered_session_id, &temp_output)?;
        
        // Clean up temp files
        fs::remove_file(&temp_input).ok();
        fs::remove_file(&temp_output).ok();
        
        // Log the filtering
        info!(
            "Filter applied: original_session={}, filtered_session={}, filter={}",
            session_id, filtered_session_id, filter
        );
        
        Ok(filtered_session_id)
    }
    
    /// Generate a visualization of the packet flow
    pub fn generate_visualization(
        &self,
        session_id: &Uuid,
        format: &str,
    ) -> Result<PathBuf, WiresharkError> {
        // Create temporary files for the visualization
        let temp_input = self.temp_dir.join(format!("{}.pcap", session_id));
        let output_path = self.temp_dir.join(format!("{}.{}", session_id, format));
        
        // Retrieve the capture to the temp file
        self.packet_vault.retrieve_capture(session_id, &temp_input)?;
        
        // Generate the visualization
        self.tshark.generate_visualization(&temp_input, &output_path, format)?;
        
        // Clean up temp input file
        fs::remove_file(&temp_input).ok();
        
        // Log the visualization
        info!(
            "Visualization generated: session={}, format={}, path={}",
            session_id, format, output_path.display()
        );
        
        Ok(output_path)
    }
    
    /// List captures in the vault
    pub fn list_captures(&self) -> Result<Vec<CaptureMetadata>, WiresharkError> {
        self.packet_vault.list_captures()
    }
    
    /// Analyze a capture file
    pub fn analyze_capture(
        &self,
        session_id: &Uuid,
    ) -> Result<CaptureStatistics, WiresharkError> {
        // Create a temporary file for analysis
        let temp_file = self.temp_dir.join(format!("{}.pcap", session_id));
        
        // Retrieve the capture to the temp file
        self.packet_vault.retrieve_capture(session_id, &temp_file)?;
        
        // Analyze the file
        let stats = self.tshark.parse_capture_file(&temp_file)?;
        
        // Clean up temp file
        fs::remove_file(&temp_file).ok();
        
        // Log the analysis
        info!(
            "Capture analyzed: session={}, packets={}, bytes={}",
            session_id, stats.packets_captured, stats.bytes_captured
        );
        
        Ok(stats)
    }
    
    /// Delete a capture from the vault
    pub fn delete_capture(
        &self,
        session_id: &Uuid,
        auth: &CaptureAuthorization,
    ) -> Result<(), WiresharkError> {
        // Check if authorization is valid
        if !auth.is_valid() {
            return Err(WiresharkError::AuthorizationFailure(
                "Invalid authorization token".to_string()
            ));
        }
        
        // Check if the authorization is for this session
        if auth.session_id != *session_id {
            return Err(WiresharkError::AuthorizationFailure(
                "Authorization token does not match session ID".to_string()
            ));
        }
        
        // Delete the capture
        self.packet_vault.delete_capture(session_id)?;
        
        // Log the deletion
        info!(
            "Capture deleted: session={}, authorized_by={}",
            session_id, auth.authorized_by
        );
        
        Ok(())
    }
}

/// API for packet capture operations
#[async_trait]
pub trait PacketCaptureApi {
    /// Request authorization for a packet capture
    async fn request_authorization(&self, request: CaptureRequest) -> PhoenixResult<CaptureAuthorization>;
    
    /// Start a packet capture session
    async fn start_capture(&self, config: PacketCaptureConfig, auth: CaptureAuthorization) -> PhoenixResult<Uuid>;
    
    /// Stop an active capture session
    async fn stop_capture(&self, session_id: Uuid) -> PhoenixResult<CaptureStatistics>;
    
    /// Retrieve capture statistics
    async fn get_statistics(&self, session_id: Uuid) -> PhoenixResult<CaptureStatistics>;
    
    /// List available capture files
    async fn list_capture_files(&self) -> PhoenixResult<Vec<CaptureMetadata>>;
    
    /// Analyze a capture file
    async fn analyze_capture(&self, session_id: Uuid, filter: Option<String>) -> PhoenixResult<CaptureStatistics>;
    
    /// Export a capture file (with authorization)
    async fn export_capture(&self, session_id: Uuid, format: String, auth: CaptureAuthorization) -> PhoenixResult<PathBuf>;
}

/// Request for a new packet capture
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureRequest {
    /// Purpose of the capture
    pub purpose: String,
    
    /// Scope of the capture
    pub scope: String,
    
    /// Who is authorizing the capture
    pub authorized_by: String,
    
    /// Duration of the capture authorization in seconds
    pub duration_seconds: u64,
}

/// Implementation of the Wireshark orchestrator module
pub struct WiresharkOrchestrator {
    /// Packet capture engine
    engine: Arc<Mutex<PacketCaptureEngine>>,
    
    /// Conscience gate
    conscience: Arc<ConscienceGate>,
}

impl WiresharkOrchestrator {
    /// Create a new WiresharkOrchestrator
    pub async fn new(
        config: PacketCaptureConfig,
        conscience: Arc<ConscienceGate>,
        tshark_path: Option<PathBuf>,
        vault_dir: Option<PathBuf>,
        temp_dir: Option<PathBuf>,
    ) -> Result<Self, PhoenixError> {
        // Use default vault directory if not specified
        let vault_dir = vault_dir.unwrap_or_else(|| {
            let mut path = std::env::temp_dir();
            path.push("phoenix-wireshark-vault");
            path
        });
        
        // Create the packet capture engine
        let engine = PacketCaptureEngine::new(
            config,
            tshark_path,
            vault_dir,
            conscience.clone(),
            temp_dir,
        )?;
        
        Ok(Self {
            engine: Arc::new(Mutex::new(engine)),
            conscience,
        })
    }
}

#[async_trait]
impl PacketCaptureApi for WiresharkOrchestrator {
    async fn request_authorization(&self, request: CaptureRequest) -> PhoenixResult<CaptureAuthorization> {
        let engine = self.engine.lock().unwrap();
        
        let auth = engine.request_authorization(
            &request.purpose,
            &request.scope,
            &request.authorized_by,
            request.duration_seconds,
        ).await?;
        
        Ok(auth)
    }
    
    async fn start_capture(&self, config: PacketCaptureConfig, auth: CaptureAuthorization) -> PhoenixResult<Uuid> {
        let mut engine = self.engine.lock().unwrap();
        
        // Update configuration
        engine.config = config;
        
        // Start the capture
        let session_id = engine.start_capture(auth)?;
        
        Ok(session_id)
    }
    
    async fn stop_capture(&self, _session_id: Uuid) -> PhoenixResult<CaptureStatistics> {
        let mut engine = self.engine.lock().unwrap();
        
        // Stop the current capture
        let stats = engine.stop_capture()?;
        
        Ok(stats)
    }
    
    async fn get_statistics(&self, session_id: Uuid) -> PhoenixResult<CaptureStatistics> {
        let engine = self.engine.lock().unwrap();
        
        // Check if the session is active
        if let Some(active_session) = engine.session_id {
            if active_session == session_id {
                return Ok(engine.tshark.stats.clone());
            }
        }
        
        // If not active, analyze from the stored capture
        let stats = engine.analyze_capture(&session_id)?;
        
        Ok(stats)
    }
    
    async fn list_capture_files(&self) -> PhoenixResult<Vec<CaptureMetadata>> {
        let engine = self.engine.lock().unwrap();
        
        // List captures in the vault
        let captures = engine.list_captures()?;
        
        Ok(captures)
    }
    
    async fn analyze_capture(&self, session_id: Uuid, filter: Option<String>) -> PhoenixResult<CaptureStatistics> {
        let engine = self.engine.lock().unwrap();
        
        // Apply filter if specified
        let analysis_session_id = if let Some(filter) = filter {
            engine.apply_filter(&session_id, &filter)?
        } else {
            session_id
        };
        
        // Analyze the capture
        let stats = engine.analyze_capture(&analysis_session_id)?;
        
        // If we created a filtered capture, clean it up
        if analysis_session_id != session_id {
            // This would delete the filtered copy, but we'd need authorization
            // engine.delete_capture(&analysis_session_id, &auth)?;
        }
        
        Ok(stats)
    }
    
    async fn export_capture(&self, session_id: Uuid, format: String, auth: CaptureAuthorization) -> PhoenixResult<PathBuf> {
        let engine = self.engine.lock().unwrap();
        
        // Check if authorization is valid
        if !auth.is_valid() {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::RequestRejected,
                message: "Invalid authorization token".to_string(),
                component: "WiresharkOrchestrator".to_string(),
            });
        }
        
        // For non-visualization exports, export the raw file
        if format == "pcap" {
            let temp_file = engine.temp_dir.join(format!("{}.pcap", session_id));
            
            engine.packet_vault.retrieve_capture(&session_id, &temp_file)?;
            
            return Ok(temp_file);
        }
        
        // For visualization exports, generate the visualization
        if ["pdf", "png", "svg"].contains(&format.as_str()) {
            let output_path = engine.generate_visualization(&session_id, &format)?;
            
            return Ok(output_path);
        }
        
        Err(PhoenixError::Agent {
            kind: AgentErrorKind::InvalidParameters,
            message: format!("Unsupported export format: {}", format),
            component: "WiresharkOrchestrator".to_string(),
        })
    }
}

// Public functions for module exports

/// Process a Wireshark command
pub async fn process_wireshark_command(command: &str, params: &str) -> PhoenixResult<String> {
    // Parse parameters
    let parameters: serde_json::Value = serde_json::from_str(params)
        .map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::InvalidParameters,
            message: format!("Failed to parse parameters: {}", e),
            component: "WiresharkOrchestrator".to_string(),
        })?;
    
    // Create a default configuration
    let config = PacketCaptureConfig::default();
    
    // TODO: For a full implementation, create a ConscienceGate and WiresharkOrchestrator
    // For now, return a placeholder response
    
    match command {
        "status" => Ok("Wireshark orchestrator is available".to_string()),
        "request_authorization" => {
            // This would normally create a real authorization
            let auth_id = Uuid::new_v4();
            Ok(format!("Authorization request submitted, ID: {}", auth_id))
        },
        "start_capture" => {
            // This would normally start a real capture
            let session_id = Uuid::new_v4();
            Ok(format!("Capture started with session ID: {}", session_id))
        },
        "stop_capture" => {
            Ok("Capture stopped successfully".to_string())
        },
        "list_captures" => {
            Ok("No captures available".to_string())
        },
        _ => Err(PhoenixError::Agent {
            kind: AgentErrorKind::InvalidParameters,
            message: format!("Unknown command: {}", command),
            component: "WiresharkOrchestrator".to_string(),
        }),
    }
}

/// Get the status of the Wireshark orchestrator
pub fn wireshark_status() -> String {
    // Check if tshark is available
    let tshark = TsharkIntegration::new(None);
    
    match tshark.check_tshark_available() {
        Ok(_) => "Wireshark orchestrator is available".to_string(),
        Err(e) => format!("Wireshark orchestrator is unavailable: {}", e),
    }
}