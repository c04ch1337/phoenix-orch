//! EDR Integration Module
//!
//! Provides integration with real-time Endpoint Detection and Response (EDR) systems
//! including Velociraptor, Osquery, and Wazuh HIDS.

use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use anyhow::{Result, Context, anyhow};
use async_trait::async_trait;
use serde::{Serialize, Deserialize};
use tokio::time::Duration;
use tracing::{debug, error, info, warn};

/// Type alias for telemetry data stored as key-value pairs
pub type TelemetryData = HashMap<String, serde_json::Value>;

/// Common data format for endpoint events across all EDR systems
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointEvent {
    /// Unique identifier for the event
    pub event_id: String,
    /// Timestamp of when the event occurred
    pub timestamp: chrono::DateTime<chrono::Utc>,
    /// Source of the event (hostname, IP, etc.)
    pub source: String,
    /// Type of event (process_creation, network_connection, etc.)
    pub event_type: String,
    /// Severity level of the event
    pub severity: EventSeverity,
    /// Raw event data in standardized format
    pub data: TelemetryData,
}

/// Severity levels for endpoint events
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum EventSeverity {
    /// Informational event, no security concern
    Info,
    /// Low severity event, potential minor concern
    Low,
    /// Medium severity event, requires attention
    Medium,
    /// High severity event, potential security incident
    High,
    /// Critical severity event, active security incident
    Critical,
}

/// Configuration for connecting to an EDR system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EdrConfig {
    /// Type of EDR system
    pub edr_type: EdrType,
    /// Connection endpoint (URL, socket, etc.)
    pub endpoint: String,
    /// Authentication credentials
    pub credentials: EdrCredentials,
    /// Connection timeout in seconds
    pub timeout_seconds: u64,
    /// Custom configuration options specific to the EDR system
    pub options: HashMap<String, String>,
}

/// Types of supported EDR systems
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum EdrType {
    /// Velociraptor EDR
    Velociraptor,
    /// Osquery
    Osquery,
    /// Wazuh Host-based IDS
    Wazuh,
}

/// Authentication credentials for EDR systems
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EdrCredentials {
    /// API key authentication
    ApiKey(String),
    /// Username and password authentication
    UsernamePassword {
        /// Username for authentication
        username: String,
        /// Password for authentication
        password: String,
    },
    /// Certificate-based authentication
    Certificate {
        /// Path to the certificate file
        cert_path: String,
        /// Path to the key file
        key_path: String,
    },
}

/// Status of an EDR system connection
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ConnectionStatus {
    /// Connected and operational
    Connected,
    /// Disconnected but attempting reconnection
    Reconnecting,
    /// Disconnected and not attempting reconnection
    Disconnected,
    /// Connection error
    Error(String),
}

/// Common trait for all EDR system integrations
#[async_trait]
pub trait EdrConnector: Send + Sync {
    /// Get the type of EDR system
    fn edr_type(&self) -> EdrType;
    
    /// Connect to the EDR system
    async fn connect(&mut self) -> Result<()>;
    
    /// Disconnect from the EDR system
    async fn disconnect(&mut self) -> Result<()>;
    
    /// Get the current connection status
    async fn status(&self) -> ConnectionStatus;
    
    /// Query the EDR system for specific data
    async fn query(&self, query: &str, parameters: Option<TelemetryData>) -> Result<Vec<EndpointEvent>>;
    
    /// Subscribe to a specific event stream
    async fn subscribe(&mut self, event_type: &str) -> Result<()>;
    
    /// Unsubscribe from a specific event stream
    async fn unsubscribe(&mut self, event_type: &str) -> Result<()>;
    
    /// Execute a remediation action on an endpoint
    async fn execute_action(&self, endpoint: &str, action: &str, parameters: Option<TelemetryData>) -> Result<TelemetryData>;
}

/// Velociraptor EDR connector implementation
pub struct VelociraptorConnector {
    /// Configuration for the Velociraptor connection
    config: EdrConfig,
    /// Current connection status
    status: ConnectionStatus,
    /// Cached client instance for reuse
    client: Option<reqwest::Client>,
    /// API session token when authenticated
    session_token: Option<String>,
}

impl VelociraptorConnector {
    /// Create a new Velociraptor connector with the given configuration
    pub fn new(config: EdrConfig) -> Self {
        if config.edr_type != EdrType::Velociraptor {
            warn!("Creating Velociraptor connector with non-Velociraptor config");
        }
        
        Self {
            config,
            status: ConnectionStatus::Disconnected,
            client: None,
            session_token: None,
        }
    }
    
    // Helper method to initialize the HTTP client
    fn init_client(&mut self) -> Result<&reqwest::Client> {
        if self.client.is_none() {
            let timeout = Duration::from_secs(self.config.timeout_seconds);
            let client = reqwest::Client::builder()
                .timeout(timeout)
                .build()
                .context("Failed to build HTTP client for Velociraptor")?;
            
            self.client = Some(client);
        }
        
        Ok(self.client.as_ref().unwrap())
    }
}

#[async_trait]
impl EdrConnector for VelociraptorConnector {
    fn edr_type(&self) -> EdrType {
        EdrType::Velociraptor
    }
    
    async fn connect(&mut self) -> Result<()> {
        let client = self.init_client()?;
        
        // Simulate authentication to Velociraptor API
        // In a real implementation, this would authenticate with the Velociraptor API
        match &self.config.credentials {
            EdrCredentials::ApiKey(key) => {
                debug!("Authenticating to Velociraptor with API key");
                // Simulate API key authentication
                self.session_token = Some(format!("simulated_token_{}", key.chars().rev().collect::<String>()));
            }
            EdrCredentials::UsernamePassword { username, password } => {
                debug!("Authenticating to Velociraptor with username/password");
                // Simulate username/password authentication
                self.session_token = Some(format!("simulated_token_{}_{}", username, password.len()));
            }
            EdrCredentials::Certificate { cert_path, key_path } => {
                debug!("Authenticating to Velociraptor with certificate");
                // Simulate certificate authentication
                self.session_token = Some(format!("simulated_token_cert"));
            }
        }
        
        self.status = ConnectionStatus::Connected;
        info!("Successfully connected to Velociraptor EDR");
        
        Ok(())
    }
    
    async fn disconnect(&mut self) -> Result<()> {
        // Clear session token and update status
        self.session_token = None;
        self.status = ConnectionStatus::Disconnected;
        info!("Disconnected from Velociraptor EDR");
        
        Ok(())
    }
    
    async fn status(&self) -> ConnectionStatus {
        self.status.clone()
    }
    
    async fn query(&self, query: &str, parameters: Option<TelemetryData>) -> Result<Vec<EndpointEvent>> {
        if self.session_token.is_none() {
            return Err(anyhow!("Not connected to Velociraptor"));
        }
        
        // Simulate query execution and response parsing
        // In a real implementation, this would send the query to the Velociraptor API
        debug!("Executing Velociraptor query: {}", query);
        
        // Generate a simulated response
        let mut events = Vec::new();
        let now = chrono::Utc::now();
        
        // Create a simulated event
        let mut data = TelemetryData::new();
        data.insert("query".to_string(), serde_json::Value::String(query.to_string()));
        if let Some(params) = parameters {
            data.insert("parameters".to_string(), serde_json::Value::Object(serde_json::Map::from_iter(
                params.into_iter().map(|(k, v)| (k, v))
            )));
        }
        
        let event = EndpointEvent {
            event_id: format!("veloc_{}", uuid::Uuid::new_v4()),
            timestamp: now,
            source: "simulated.endpoint.local".to_string(),
            event_type: "query_result".to_string(),
            severity: EventSeverity::Info,
            data,
        };
        
        events.push(event);
        
        Ok(events)
    }
    
    async fn subscribe(&mut self, event_type: &str) -> Result<()> {
        if self.session_token.is_none() {
            return Err(anyhow!("Not connected to Velociraptor"));
        }
        
        // Simulate subscription to event stream
        info!("Subscribed to Velociraptor event stream: {}", event_type);
        
        Ok(())
    }
    
    async fn unsubscribe(&mut self, event_type: &str) -> Result<()> {
        if self.session_token.is_none() {
            return Err(anyhow!("Not connected to Velociraptor"));
        }
        
        // Simulate unsubscription from event stream
        info!("Unsubscribed from Velociraptor event stream: {}", event_type);
        
        Ok(())
    }
    
    async fn execute_action(&self, endpoint: &str, action: &str, parameters: Option<TelemetryData>) -> Result<TelemetryData> {
        if self.session_token.is_none() {
            return Err(anyhow!("Not connected to Velociraptor"));
        }
        
        // Simulate action execution
        info!("Executing Velociraptor action '{}' on endpoint '{}'", action, endpoint);
        
        // Generate a simulated response
        let mut result = TelemetryData::new();
        result.insert("success".to_string(), serde_json::Value::Bool(true));
        result.insert("action".to_string(), serde_json::Value::String(action.to_string()));
        result.insert("endpoint".to_string(), serde_json::Value::String(endpoint.to_string()));
        
        if let Some(params) = parameters {
            result.insert("parameters".to_string(), serde_json::Value::Object(serde_json::Map::from_iter(
                params.into_iter().map(|(k, v)| (k, v))
            )));
        }
        
        Ok(result)
    }
}

/// Osquery connector implementation
pub struct OsqueryConnector {
    /// Configuration for the Osquery connection
    config: EdrConfig,
    /// Current connection status
    status: ConnectionStatus,
    /// Osquery socket connection (simulated)
    connection: Option<String>,
}

impl OsqueryConnector {
    /// Create a new Osquery connector with the given configuration
    pub fn new(config: EdrConfig) -> Self {
        if config.edr_type != EdrType::Osquery {
            warn!("Creating Osquery connector with non-Osquery config");
        }
        
        Self {
            config,
            status: ConnectionStatus::Disconnected,
            connection: None,
        }
    }
}

#[async_trait]
impl EdrConnector for OsqueryConnector {
    fn edr_type(&self) -> EdrType {
        EdrType::Osquery
    }
    
    async fn connect(&mut self) -> Result<()> {
        // Simulate connection to Osquery socket
        debug!("Connecting to Osquery at {}", self.config.endpoint);
        
        // In a real implementation, this would connect to the Osquery socket
        self.connection = Some(self.config.endpoint.clone());
        self.status = ConnectionStatus::Connected;
        
        info!("Successfully connected to Osquery");
        Ok(())
    }
    
    async fn disconnect(&mut self) -> Result<()> {
        // Clear connection and update status
        self.connection = None;
        self.status = ConnectionStatus::Disconnected;
        
        info!("Disconnected from Osquery");
        Ok(())
    }
    
    async fn status(&self) -> ConnectionStatus {
        self.status.clone()
    }
    
    async fn query(&self, query: &str, parameters: Option<TelemetryData>) -> Result<Vec<EndpointEvent>> {
        if self.connection.is_none() {
            return Err(anyhow!("Not connected to Osquery"));
        }
        
        // Simulate SQL query execution with Osquery
        debug!("Executing Osquery SQL query: {}", query);
        
        // Generate a simulated response
        let mut events = Vec::new();
        let now = chrono::Utc::now();
        
        // Create a simulated event
        let mut data = TelemetryData::new();
        data.insert("sql_query".to_string(), serde_json::Value::String(query.to_string()));
        
        if let Some(params) = parameters {
            data.insert("parameters".to_string(), serde_json::Value::Object(serde_json::Map::from_iter(
                params.into_iter().map(|(k, v)| (k, v))
            )));
        }
        
        let event = EndpointEvent {
            event_id: format!("osquery_{}", uuid::Uuid::new_v4()),
            timestamp: now,
            source: "localhost".to_string(),
            event_type: "query_result".to_string(),
            severity: EventSeverity::Info,
            data,
        };
        
        events.push(event);
        
        Ok(events)
    }
    
    async fn subscribe(&mut self, event_type: &str) -> Result<()> {
        if self.connection.is_none() {
            return Err(anyhow!("Not connected to Osquery"));
        }
        
        // Simulate registering a scheduled query
        info!("Registered Osquery scheduled query for: {}", event_type);
        
        Ok(())
    }
    
    async fn unsubscribe(&mut self, event_type: &str) -> Result<()> {
        if self.connection.is_none() {
            return Err(anyhow!("Not connected to Osquery"));
        }
        
        // Simulate removing a scheduled query
        info!("Removed Osquery scheduled query for: {}", event_type);
        
        Ok(())
    }
    
    async fn execute_action(&self, endpoint: &str, action: &str, parameters: Option<TelemetryData>) -> Result<TelemetryData> {
        if self.connection.is_none() {
            return Err(anyhow!("Not connected to Osquery"));
        }
        
        // Simulate action execution
        info!("Executing Osquery action '{}' on endpoint '{}'", action, endpoint);
        
        // Generate a simulated response
        let mut result = TelemetryData::new();
        result.insert("success".to_string(), serde_json::Value::Bool(true));
        result.insert("action".to_string(), serde_json::Value::String(action.to_string()));
        result.insert("endpoint".to_string(), serde_json::Value::String(endpoint.to_string()));
        
        if let Some(params) = parameters {
            result.insert("parameters".to_string(), serde_json::Value::Object(serde_json::Map::from_iter(
                params.into_iter().map(|(k, v)| (k, v))
            )));
        }
        
        Ok(result)
    }
}

/// Wazuh HIDS connector implementation
pub struct WazuhConnector {
    /// Configuration for the Wazuh connection
    config: EdrConfig,
    /// Current connection status
    status: ConnectionStatus,
    /// Cached client instance for reuse
    client: Option<reqwest::Client>,
    /// API token when authenticated
    api_token: Option<String>,
}

impl WazuhConnector {
    /// Create a new Wazuh connector with the given configuration
    pub fn new(config: EdrConfig) -> Self {
        if config.edr_type != EdrType::Wazuh {
            warn!("Creating Wazuh connector with non-Wazuh config");
        }
        
        Self {
            config,
            status: ConnectionStatus::Disconnected,
            client: None,
            api_token: None,
        }
    }
    
    // Helper method to initialize the HTTP client
    fn init_client(&mut self) -> Result<&reqwest::Client> {
        if self.client.is_none() {
            let timeout = Duration::from_secs(self.config.timeout_seconds);
            let client = reqwest::Client::builder()
                .timeout(timeout)
                .build()
                .context("Failed to build HTTP client for Wazuh")?;
            
            self.client = Some(client);
        }
        
        Ok(self.client.as_ref().unwrap())
    }
}

#[async_trait]
impl EdrConnector for WazuhConnector {
    fn edr_type(&self) -> EdrType {
        EdrType::Wazuh
    }
    
    async fn connect(&mut self) -> Result<()> {
        let client = self.init_client()?;
        
        // Simulate authentication to Wazuh API
        match &self.config.credentials {
            EdrCredentials::ApiKey(key) => {
                debug!("Authenticating to Wazuh with API key");
                // Simulate API key authentication
                self.api_token = Some(format!("wazuh_token_{}", key.chars().rev().collect::<String>()));
            }
            EdrCredentials::UsernamePassword { username, password } => {
                debug!("Authenticating to Wazuh with username/password");
                // Simulate username/password authentication
                self.api_token = Some(format!("wazuh_token_{}_{}", username, password.len()));
            }
            EdrCredentials::Certificate { cert_path, key_path } => {
                return Err(anyhow!("Certificate authentication not supported for Wazuh"));
            }
        }
        
        self.status = ConnectionStatus::Connected;
        info!("Successfully connected to Wazuh HIDS");
        
        Ok(())
    }
    
    async fn disconnect(&mut self) -> Result<()> {
        // Clear API token and update status
        self.api_token = None;
        self.status = ConnectionStatus::Disconnected;
        
        info!("Disconnected from Wazuh HIDS");
        Ok(())
    }
    
    async fn status(&self) -> ConnectionStatus {
        self.status.clone()
    }
    
    async fn query(&self, query: &str, parameters: Option<TelemetryData>) -> Result<Vec<EndpointEvent>> {
        if self.api_token.is_none() {
            return Err(anyhow!("Not connected to Wazuh"));
        }
        
        // Simulate query to Wazuh API
        debug!("Executing Wazuh query: {}", query);
        
        // Generate a simulated response
        let mut events = Vec::new();
        let now = chrono::Utc::now();
        
        // Create a simulated event
        let mut data = TelemetryData::new();
        data.insert("query".to_string(), serde_json::Value::String(query.to_string()));
        
        if let Some(params) = parameters {
            data.insert("parameters".to_string(), serde_json::Value::Object(serde_json::Map::from_iter(
                params.into_iter().map(|(k, v)| (k, v))
            )));
        }
        
        let event = EndpointEvent {
            event_id: format!("wazuh_{}", uuid::Uuid::new_v4()),
            timestamp: now,
            source: "wazuh-manager".to_string(),
            event_type: "alert".to_string(),
            severity: EventSeverity::Medium,
            data,
        };
        
        events.push(event);
        
        Ok(events)
    }
    
    async fn subscribe(&mut self, event_type: &str) -> Result<()> {
        if self.api_token.is_none() {
            return Err(anyhow!("Not connected to Wazuh"));
        }
        
        // Simulate subscription to Wazuh alerts
        info!("Subscribed to Wazuh alerts for: {}", event_type);
        
        Ok(())
    }
    
    async fn unsubscribe(&mut self, event_type: &str) -> Result<()> {
        if self.api_token.is_none() {
            return Err(anyhow!("Not connected to Wazuh"));
        }
        
        // Simulate unsubscription from Wazuh alerts
        info!("Unsubscribed from Wazuh alerts for: {}", event_type);
        
        Ok(())
    }
    
    async fn execute_action(&self, endpoint: &str, action: &str, parameters: Option<TelemetryData>) -> Result<TelemetryData> {
        if self.api_token.is_none() {
            return Err(anyhow!("Not connected to Wazuh"));
        }
        
        // Simulate action execution
        info!("Executing Wazuh action '{}' on endpoint '{}'", action, endpoint);
        
        // Generate a simulated response
        let mut result = TelemetryData::new();
        result.insert("success".to_string(), serde_json::Value::Bool(true));
        result.insert("action".to_string(), serde_json::Value::String(action.to_string()));
        result.insert("endpoint".to_string(), serde_json::Value::String(endpoint.to_string()));
        
        if let Some(params) = parameters {
            result.insert("parameters".to_string(), serde_json::Value::Object(serde_json::Map::from_iter(
                params.into_iter().map(|(k, v)| (k, v))
            )));
        }
        
        Ok(result)
    }
}

/// Factory for creating EDR connectors based on configuration
pub struct EdrConnectorFactory;

impl EdrConnectorFactory {
    /// Create a new EDR connector based on the provided configuration
    pub fn create(config: EdrConfig) -> Result<Box<dyn EdrConnector>> {
        match config.edr_type {
            EdrType::Velociraptor => {
                let connector = VelociraptorConnector::new(config);
                Ok(Box::new(connector) as Box<dyn EdrConnector>)
            },
            EdrType::Osquery => {
                let connector = OsqueryConnector::new(config);
                Ok(Box::new(connector) as Box<dyn EdrConnector>)
            },
            EdrType::Wazuh => {
                let connector = WazuhConnector::new(config);
                Ok(Box::new(connector) as Box<dyn EdrConnector>)
            }
        }
    }
}

/// Manages multiple EDR integrations and provides a unified interface
pub struct EdrIntegrationManager {
    /// Map of active EDR connectors by name
    connectors: HashMap<String, Box<dyn EdrConnector>>,
    /// Redundancy settings for high availability
    redundancy_enabled: bool,
}

impl EdrIntegrationManager {
    /// Create a new EDR integration manager
    pub fn new() -> Result<Self> {
        Ok(Self {
            connectors: HashMap::new(),
            redundancy_enabled: false,
        })
    }
    
    /// Add a new EDR connector with the given name
    pub async fn add_connector(&mut self, name: &str, config: EdrConfig) -> Result<()> {
        let connector = EdrConnectorFactory::create(config)?;
        self.connectors.insert(name.to_string(), connector);
        
        info!("Added EDR connector: {}", name);
        Ok(())
    }
    
    /// Remove an EDR connector by name
    pub async fn remove_connector(&mut self, name: &str) -> Result<()> {
        if let Some(mut connector) = self.connectors.remove(name) {
            // Ensure the connector is disconnected
            if let ConnectionStatus::Connected = connector.status().await {
                connector.disconnect().await?;
            }
        }
        
        info!("Removed EDR connector: {}", name);
        Ok(())
    }
    
    /// Connect all EDR systems
    pub async fn connect_all(&mut self) -> Result<()> {
        for (name, connector) in self.connectors.iter_mut() {
            match connector.connect().await {
                Ok(_) => info!("Connected to EDR system: {}", name),
                Err(e) => error!("Failed to connect to EDR system {}: {}", name, e),
            }
        }
        
        Ok(())
    }
    
    /// Disconnect all EDR systems
    pub async fn disconnect_all(&mut self) -> Result<()> {
        for (name, connector) in self.connectors.iter_mut() {
            match connector.disconnect().await {
                Ok(_) => info!("Disconnected from EDR system: {}", name),
                Err(e) => error!("Failed to disconnect from EDR system {}: {}", name, e),
            }
        }
        
        Ok(())
    }
    
    /// Get the status of all EDR connectors
    pub async fn get_status(&self) -> HashMap<String, ConnectionStatus> {
        let mut statuses = HashMap::new();
        
        for (name, connector) in &self.connectors {
            statuses.insert(name.clone(), connector.status().await);
        }
        
        statuses
    }
    
    /// Execute a query on all connected EDR systems and merge the results
    pub async fn query_all(&self, query: &str, parameters: Option<TelemetryData>) -> Result<Vec<EndpointEvent>> {
        let mut all_events = Vec::new();
        
        for (name, connector) in &self.connectors {
            if let ConnectionStatus::Connected = connector.status().await {
                match connector.query(query, parameters.clone()).await {
                    Ok(events) => {
                        debug!("Received {} events from EDR system: {}", events.len(), name);
                        all_events.extend(events);
                    },
                    Err(e) => error!("Query failed for EDR system {}: {}", name, e),
                }
            }
        }
        
        Ok(all_events)
    }
    
    /// Execute an action on a specific endpoint across all connected EDR systems
    /// Returns the first successful result, or an error if all fail
    pub async fn execute_action(&self, endpoint: &str, action: &str, parameters: Option<TelemetryData>) -> Result<TelemetryData> {
        let mut last_error = None;
        
        for (name, connector) in &self.connectors {
            if let ConnectionStatus::Connected = connector.status().await {
                match connector.execute_action(endpoint, action, parameters.clone()).await {
                    Ok(result) => {
                        info!("Action '{}' executed successfully via EDR system: {}", action, name);
                        return Ok(result);
                    },
                    Err(e) => {
                        error!("Action '{}' failed on EDR system {}: {}", action, name, e);
                        last_error = Some(e);
                    }
                }
            }
        }
        
        Err(last_error.unwrap_or_else(|| anyhow!("No connected EDR systems available to execute action")))
    }
    
    /// Enable redundancy mode for high availability
    pub fn enable_redundancy(&mut self, enabled: bool) {
        self.redundancy_enabled = enabled;
        info!("EDR redundancy mode {}", if enabled { "enabled" } else { "disabled" });
    }
    
    /// Get all EDR connector names
    pub fn get_connector_names(&self) -> Vec<String> {
        self.connectors.keys().cloned().collect()
    }
    
    /// Get the number of active EDR connectors
    pub fn connector_count(&self) -> usize {
        self.connectors.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_velociraptor_connector() {
        let config = EdrConfig {
            edr_type: EdrType::Velociraptor,
            endpoint: "https://velociraptor.example.com".to_string(),
            credentials: EdrCredentials::ApiKey("test_api_key".to_string()),
            timeout_seconds: 30,
            options: HashMap::new(),
        };
        
        let mut connector = VelociraptorConnector::new(config);
        
        // Test connect
        let connect_result = connector.connect().await;
        assert!(connect_result.is_ok());
        assert_eq!(connector.status().await, ConnectionStatus::Connected);
        
        // Test query
        let query_result = connector.query("SELECT * FROM processes", None).await;
        assert!(query_result.is_ok());
        assert!(!query_result.unwrap().is_empty());
        
        // Test disconnect
        let disconnect_result = connector.disconnect().await;
        assert!(disconnect_result. is_ok());
        assert_eq!(connector.status().await, ConnectionStatus::Disconnected);
    }
    
    #[tokio::test]
    async fn test_edr_integration_manager() {
        let mut manager = EdrIntegrationManager::new().unwrap();
        
        // Add connectors
        let velociraptor_config = EdrConfig {
            edr_type: EdrType::Velociraptor,
            endpoint: "https://velociraptor.example.com".to_string(),
            credentials: EdrCredentials::ApiKey("test_api_key".to_string()),
            timeout_seconds: 30,
            options: HashMap::new(),
        };
        
        let osquery_config = EdrConfig {
            edr_type: EdrType::Osquery,
            endpoint: "/var/osquery/osquery.em".to_string(),
            credentials: EdrCredentials::UsernamePassword {
                username: "osquery".to_string(),
                password: "password".to_string(),
            },
            timeout_seconds: 10,
            options: HashMap::new(),
        };
        
        let add_result1 = manager.add_connector("velociraptor1", velociraptor_config).await;
        assert!(add_result1.is_ok());
        
        let add_result2 = manager.add_connector("osquery1", osquery_config).await;
        assert!(add_result2.is_ok());
        
        assert_eq!(manager.connector_count(), 2);
        assert_eq!(manager.get_connector_names().len(), 2);
        
        // Test connect all
        let connect_result = manager.connect_all().await;
        assert!(connect_result.is_ok());
        
        // Test status
        let statuses = manager.get_status().await;
        assert_eq!(statuses.len(), 2);
        assert_eq!(statuses.get("velociraptor1").unwrap(), &ConnectionStatus::Connected);
        assert_eq!(statuses.get("osquery1").unwrap(), &ConnectionStatus::Connected);
        
        // Test disconnect all
        let disconnect_result = manager.disconnect_all().await;
        assert!(disconnect_result.is_ok());
    }
}