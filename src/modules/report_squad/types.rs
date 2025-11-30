use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Finding {
    pub id: String,
    pub title: String,
    pub description: String,
    pub severity: String,
    pub cvss: Cvss,
    pub affected_assets: Vec<AffectedAsset>,
    pub evidence: Vec<Evidence>,
    pub remediation: Remediation,
    pub attack_path: AttackPath,
    pub metadata: EngagementMetadata,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Cvss {
    pub score: f32,
    pub vector: String,
    pub version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AffectedAsset {
    pub id: String,
    pub name: String,
    pub asset_type: String,
    pub location: String,
    pub impact: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Evidence {
    pub id: String,
    pub timestamp: String,
    pub evidence_type: String,
    pub description: String,
    pub data: String,
    pub screenshot_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Remediation {
    pub recommendation: String,
    pub effort: String,
    pub priority: String,
    pub steps: Vec<String>,
    pub references: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AttackPath {
    pub steps: Vec<String>,
    pub prerequisites: Vec<String>,
    pub impact_chain: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EngagementMetadata {
    pub engagement_id: String,
    pub analyst: String,
    pub discovery_date: String,
    pub report_date: String,
    pub status: String,
}

// SQLite table schema
pub const FINDINGS_TABLE_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS findings_{engagement_id} (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL,
    cvss_score REAL NOT NULL,
    cvss_vector TEXT NOT NULL,
    cvss_version TEXT NOT NULL,
    affected_assets TEXT NOT NULL,
    evidence TEXT NOT NULL,
    remediation TEXT NOT NULL,
    attack_path TEXT NOT NULL,
    metadata TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);"#;