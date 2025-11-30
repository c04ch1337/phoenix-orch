use anyhow::Result;
use reqwest::Client;
use serde::{Serialize, Deserialize};
use uuid::Uuid;
use std::time::Duration;
use crate::modules::weaver::bridge::{ToolCommand, ToolResponse};

pub struct EmberUnitClient {
    client: Client,
    base_url: String,
}

impl EmberUnitClient {
    pub fn new(base_url: &str) -> Result<Self> {
        Ok(Self {
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .build()?,
            base_url: base_url.to_string(),
        })
    }

    pub async fn execute_command(&self, command: ToolCommand) -> Result<ToolResponse> {
        let url = format!("{}/api/v1/tools/{}/execute", self.base_url, command.tool_id);
        
        let response = self.client
            .post(&url)
            .json(&command)
            .send()
            .await?
            .error_for_status()?;

        let tool_response: ToolResponse = response.json().await?;
        Ok(tool_response)
    }

    pub async fn register_tool(&self, tool_id: Uuid) -> Result<()> {
        let url = format!("{}/api/v1/tools/{}/register", self.base_url, tool_id);
        
        self.client
            .post(&url)
            .send()
            .await?
            .error_for_status()?;

        Ok(())
    }

    pub async fn unregister_tool(&self, tool_id: Uuid) -> Result<()> {
        let url = format!("{}/api/v1/tools/{}/unregister", self.base_url, tool_id);
        
        self.client
            .post(&url)
            .send()
            .await?
            .error_for_status()?;

        Ok(())
    }
}

pub struct CipherGuardClient {
    client: Client,
    base_url: String,
}

impl CipherGuardClient {
    pub fn new(base_url: &str) -> Result<Self> {
        Ok(Self {
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .build()?,
            base_url: base_url.to_string(),
        })
    }

    pub async fn execute_command(&self, command: ToolCommand) -> Result<ToolResponse> {
        let url = format!("{}/api/v1/tools/{}/execute", self.base_url, command.tool_id);
        
        let response = self.client
            .post(&url)
            .json(&command)
            .send()
            .await?
            .error_for_status()?;

        let tool_response: ToolResponse = response.json().await?;
        Ok(tool_response)
    }

    pub async fn register_tool(&self, tool_id: Uuid) -> Result<()> {
        let url = format!("{}/api/v1/tools/{}/register", self.base_url, tool_id);
        
        self.client
            .post(&url)
            .send()
            .await?
            .error_for_status()?;

        Ok(())
    }

    pub async fn unregister_tool(&self, tool_id: Uuid) -> Result<()> {
        let url = format!("{}/api/v1/tools/{}/unregister", self.base_url, tool_id);
        
        self.client
            .post(&url)
            .send()
            .await?
            .error_for_status()?;

        Ok(())
    }

    pub async fn report_security_event(&self, event: SecurityEvent) -> Result<()> {
        let url = format!("{}/api/v1/events", self.base_url);
        
        self.client
            .post(&url)
            .json(&event)
            .send()
            .await?
            .error_for_status()?;

        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SecurityEvent {
    pub tool_id: Uuid,
    pub event_type: SecurityEventType,
    pub severity: SecuritySeverity,
    pub description: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum SecurityEventType {
    UnauthorizedAccess,
    SuspiciousActivity,
    ResourceViolation,
    EthicsViolation,
    SystemError,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum SecuritySeverity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

// Error handling
#[derive(Debug, thiserror::Error)]
pub enum ClientError {
    #[error("HTTP request failed: {0}")]
    RequestFailed(#[from] reqwest::Error),
    
    #[error("Invalid response format: {0}")]
    InvalidResponse(String),
    
    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),
    
    #[error("Operation timed out")]
    Timeout,
}

// Helper functions for common operations
impl EmberUnitClient {
    pub async fn check_health(&self) -> Result<bool> {
        let url = format!("{}/health", self.base_url);
        
        let response = self.client
            .get(&url)
            .send()
            .await?
            .error_for_status()?;

        let health: serde_json::Value = response.json().await?;
        Ok(health["status"] == "healthy")
    }

    pub async fn get_tool_metrics(&self, tool_id: Uuid) -> Result<ToolMetrics> {
        let url = format!("{}/api/v1/tools/{}/metrics", self.base_url, tool_id);
        
        let response = self.client
            .get(&url)
            .send()
            .await?
            .error_for_status()?;

        let metrics: ToolMetrics = response.json().await?;
        Ok(metrics)
    }
}

impl CipherGuardClient {
    pub async fn check_health(&self) -> Result<bool> {
        let url = format!("{}/health", self.base_url);
        
        let response = self.client
            .get(&url)
            .send()
            .await?
            .error_for_status()?;

        let health: serde_json::Value = response.json().await?;
        Ok(health["status"] == "healthy")
    }

    pub async fn get_security_status(&self, tool_id: Uuid) -> Result<SecurityStatus> {
        let url = format!("{}/api/v1/tools/{}/security", self.base_url, tool_id);
        
        let response = self.client
            .get(&url)
            .send()
            .await?
            .error_for_status()?;

        let status: SecurityStatus = response.json().await?;
        Ok(status)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ToolMetrics {
    pub execution_count: u64,
    pub success_rate: f64,
    pub average_duration: Duration,
    pub error_count: u64,
    pub last_execution: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SecurityStatus {
    pub status: SecurityStatusType,
    pub last_check: chrono::DateTime<chrono::Utc>,
    pub violations: Vec<SecurityViolation>,
    pub risk_score: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum SecurityStatusType {
    Secure,
    Warning,
    Compromised,
    Unknown,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SecurityViolation {
    pub violation_type: String,
    pub description: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub severity: SecuritySeverity,
}