use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::error::Error;
use uuid::Uuid;

pub mod agents;
pub mod detection;
pub mod response;
pub mod reporting;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Threat {
    pub id: Uuid,
    pub severity: ThreatSeverity,
    pub description: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub source: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ThreatSeverity {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncidentReport {
    pub id: Uuid,
    pub threat: Threat,
    pub status: IncidentStatus,
    pub actions_taken: Vec<String>,
    pub evidence: Vec<Evidence>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IncidentStatus {
    Detected,
    Analyzing,
    Responding,
    Contained,
    Resolved,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Evidence {
    pub id: Uuid,
    pub incident_id: Uuid,
    pub data_type: EvidenceType,
    pub content: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EvidenceType {
    Log,
    NetworkCapture,
    MemoryDump,
    FileSystem,
    ProcessInfo,
}

#[async_trait]
pub trait ThreatDetector {
    async fn detect(&self) -> Result<Vec<Threat>, Box<dyn Error + Send + Sync>>;
    async fn analyze(&self, threat: &Threat) -> Result<IncidentReport, Box<dyn Error + Send + Sync>>;
}

#[async_trait]
pub trait IncidentResponder {
    async fn respond(&self, incident: &IncidentReport) -> Result<(), Box<dyn Error + Send + Sync>>;
    async fn contain(&self, threat: &Threat) -> Result<(), Box<dyn Error + Send + Sync>>;
    async fn mitigate(&self, incident: &IncidentReport) -> Result<(), Box<dyn Error + Send + Sync>>;
}

#[async_trait]
pub trait EvidenceCollector {
    async fn collect(&self, incident: &IncidentReport) -> Result<Vec<Evidence>, Box<dyn Error + Send + Sync>>;
    async fn preserve(&self, evidence: &Evidence) -> Result<(), Box<dyn Error + Send + Sync>>;
}

#[async_trait]
pub trait Reporter {
    async fn generate_report(&self, incident: &IncidentReport) -> Result<String, Box<dyn Error + Send + Sync>>;
    async fn alert(&self, threat: &Threat) -> Result<(), Box<dyn Error + Send + Sync>>;
    async fn update_metrics(&self, incident: &IncidentReport) -> Result<(), Box<dyn Error + Send + Sync>>;
}