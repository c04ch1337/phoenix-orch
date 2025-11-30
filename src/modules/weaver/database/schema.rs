use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use serde_json::Value;
use uuid::Uuid;

/// Repository status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RepoStatus {
    Active,
    Pending,
    Archived,
    Deleted,
}

/// Repository health status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HealthStatus {
    Healthy,
    Warning,
    Error,
    Unknown,
}

/// Adopted repository record
#[derive(Debug, Clone)]
pub struct AdoptedRepo {
    pub id: Uuid,
    pub name: String,
    pub repo_url: String,
    pub git_ref: String,
    pub adopted_at: DateTime<Utc>,
    pub metadata: Value,
    pub status: RepoStatus,
    pub health: HealthStatus,
}

/// Repository category
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoCategory {
    pub id: Uuid,
    pub repo_id: Uuid,
    pub category_name: String,
    pub team_type: String,
    pub created_at: DateTime<Utc>,
}

// Database error type alias for compatibility
pub type Result<T> = std::result::Result<T, sqlx::Error>;

// Migration record for version tracking
#[derive(Debug, Clone)]
pub struct Migration {
    pub version: i64,
    pub applied_at: DateTime<Utc>,
    pub description: String,
}