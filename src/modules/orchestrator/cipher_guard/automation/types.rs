use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobDefinition {
    pub id: String,
    pub name: String,
    pub schedule: String,
    pub enabled: bool,
    pub retry_policy: RetryPolicy,
    pub actions: Vec<AutomationAction>,
    pub conditions: Vec<AutomationCondition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryPolicy {
    pub max_attempts: u32,
    pub backoff_seconds: u32,
    pub max_backoff_seconds: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatus {
    pub job_id: String,
    pub status: JobState,
    pub last_run: Option<DateTime<Utc>>,
    pub next_run: Option<DateTime<Utc>>,
    pub attempt: u32,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum JobState {
    Pending,
    Running,
    Completed,
    Failed,
    Retrying,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationAction {
    pub action_type: ActionType,
    pub parameters: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActionType {
    GenerateBriefing,
    PostToTeams,
    CreateObsidianNote,
    VoiceAlert,
    ExecuteCommand,
    SendNotification,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationCondition {
    pub condition_type: ConditionType,
    pub parameters: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConditionType {
    TimeWindow,
    SystemStatus,
    IncidentCount,
    AlertSeverity,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyBriefing {
    pub generated_at: DateTime<Utc>,
    pub incidents: Vec<Incident>,
    pub vulnerabilities: Vec<Vulnerability>,
    pub phishing_stats: PhishingStats,
    pub edr_alerts: Vec<EdrAlert>,
    pub jira_tickets: Vec<JiraTicket>,
    pub trends: TrendAnalysis,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Incident {
    pub id: String,
    pub title: String,
    pub severity: Severity,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vulnerability {
    pub id: String,
    pub title: String,
    pub severity: Severity,
    pub cvss_score: f32,
    pub discovered_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhishingStats {
    pub total_attempts: u32,
    pub blocked_attempts: u32,
    pub reported_attempts: u32,
    pub click_rate: f32,
    pub top_domains: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EdrAlert {
    pub id: String,
    pub title: String,
    pub severity: Severity,
    pub timestamp: DateTime<Utc>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraTicket {
    pub key: String,
    pub summary: String,
    pub priority: String,
    pub status: String,
    pub assignee: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendAnalysis {
    pub incident_trend: TrendDirection,
    pub vulnerability_trend: TrendDirection,
    pub phishing_trend: TrendDirection,
    pub alert_trend: TrendDirection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TrendDirection {
    Increasing,
    Decreasing,
    Stable,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum Severity {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceProfile {
    pub voice_id: String,
    pub language: String,
    pub speed: f32,
    pub pitch: f32,
    pub volume: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceAlert {
    pub message: String,
    pub priority: AlertPriority,
    pub profile: VoiceProfile,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum AlertPriority {
    Low,
    Medium,
    High,
    Critical,
    Emergency,
}