use anyhow::Result;
use phoenix_orch::context_engineering::PhoenixContext;
use regex::Regex;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

// Public modules
pub mod agent_manager;
pub mod api;
pub mod c2_orchestrator;
pub mod conscience;
pub mod engagement;
pub mod error;
pub mod integration;
pub mod network_scanner;
pub mod network_scanner_api;
pub mod phases;
pub mod plastic_ltm;
pub mod reporting;
pub mod safety;
pub mod services;
pub mod tests;
pub mod world_model;

// Re-export key types
pub use network_scanner::{
    HostInfo, NetworkScanRequest, NetworkScanResult, PortInfo, PortProtocol, PortState,
    ScanStatus, ScanType,
};
pub use network_scanner_api::{NetworkScanCommand, NetworkScannerApi};
pub use error::EmberUnitError;
pub use conscience::{ConscienceEvaluation, PhoenixConscienceIntegration};

// Target scope for network scanning
#[derive(Debug, Clone)]
pub struct TargetScope {
    pub target: String,
    pub scope: Vec<String>,
    pub rules_of_engagement: Vec<String>,
}

// Action that can be taken by Ember Unit
#[derive(Default, Debug, Clone)]
pub struct Action {
    pub network_scan: Option<NetworkScanResult>,
    pub message: Option<String>,
    pub error: Option<String>,
    pub command_id: Option<Uuid>,
}

// Pattern for natural language network scan commands
const NETWORK_SCAN_PATTERN: &str = r"^(?i)Run\s+(\w+)\s+scan\s+on\s+(.+)$";

// Lazily initialized network scanner instance
lazy_static::lazy_static! {
    static ref NETWORK_SCANNER: Arc<Mutex<Option<network_scanner::NetworkScanner>>> = Arc::new(Mutex::new(None));
}

pub async fn initialize() -> Result<(), EmberUnitError> {
    // Initialize conscience integration
    let conscience = PhoenixConscienceIntegration::new();
    
    // Initialize network scanner
    let mut scanner_lock = NETWORK_SCANNER.lock().await;
    *scanner_lock = Some(network_scanner::NetworkScanner::new(conscience));
    
    Ok(())
}

pub async fn act(ctx: &PhoenixContext) -> Result<Action> {
    tracing::debug!("Ember Unit: Processing context");
    
    // Extract the raw input from context
    let input = ctx.raw_input.as_ref().unwrap_or(&String::new());
    
    // Check if this is a network scan command
    if let Some((scan_type, target)) = parse_network_scan_command(input) {
        return process_network_scan_command(scan_type, target).await;
    }
    
    // Default action if no command matched
    Ok(Action {
        network_scan: None,
        message: Some("No action taken".to_string()),
        error: None,
        command_id: None,
    })
}

// Parse a natural language network scan command
fn parse_network_scan_command(input: &str) -> Option<(ScanType, String)> {
    let re = Regex::new(NETWORK_SCAN_PATTERN).ok()?;
    
    if let Some(captures) = re.captures(input) {
        if captures.len() < 3 {
            return None;
        }
        
        let scan_type_str = captures.get(1)?.as_str().to_lowercase();
        let target = captures.get(2)?.as_str();
        
        // Map scan type string to ScanType enum
        let scan_type = match scan_type_str.as_str() {
            "passive" => ScanType::Passive,
            "port" => ScanType::PortDiscovery,
            "service" => ScanType::ServiceDetection,
            "os" => ScanType::OsFingerprint,
            _ => return None,
        };
        
        Some((scan_type, target.to_string()))
    } else {
        None
    }
}

// Process a network scan command
async fn process_network_scan_command(scan_type: ScanType, target: String) -> Result<Action> {
    let scanner_lock = NETWORK_SCANNER.lock().await;
    
    // Check if we have initialized the scanner
    if scanner_lock.is_none() {
        return Ok(Action {
            network_scan: None,
            message: None,
            error: Some("Network scanner not initialized".to_string()),
            command_id: None,
        });
    }
    
    let scanner = scanner_lock.as_ref().unwrap();
    
    // Create scan request
    let request = NetworkScanRequest {
        target,
        scan_type,
        rate_limit: None,
        timeout: None,
        options: HashMap::new(),
    };
    
    // Execute the scan
    match scanner.start_scan(request).await {
        Ok(result) => {
            tracing::info!("Network scan started with ID: {}", result.scan_id);
            Ok(Action {
                network_scan: Some(result.clone()),
                message: Some(format!("Network scan started successfully. Scan ID: {}", result.scan_id)),
                error: None,
                command_id: Some(result.scan_id),
            })
        }
        Err(e) => {
            tracing::error!("Failed to start network scan: {}", e);
            Ok(Action {
                network_scan: None,
                message: None,
                error: Some(format!("Failed to start network scan: {}", e)),
                command_id: None,
            })
        }
    }
}

// Get the status of a network scan
pub async fn get_scan_status(scan_id: Uuid) -> Result<Action, EmberUnitError> {
    let scanner_lock = NETWORK_SCANNER.lock().await;
    
    if scanner_lock.is_none() {
        return Err(EmberUnitError::NetworkError("Network scanner not initialized".to_string()));
    }
    
    let scanner = scanner_lock.as_ref().unwrap();
    
    match scanner.get_scan_status(scan_id).await {
        Ok(result) => {
            Ok(Action {
                network_scan: Some(result),
                message: Some(format!("Scan status retrieved successfully")),
                error: None,
                command_id: Some(scan_id),
            })
        }
        Err(e) => Err(e),
    }
}