use anyhow::Result;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use tokio::sync::RwLock;
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolAction {
    pub id: Uuid,
    pub tool_id: Uuid,
    pub action_type: ActionType,
    pub timestamp: DateTime<Utc>,
    pub user: String,
    pub context: ActionContext,
    pub parameters: serde_json::Value,
    pub result: ActionResult,
    pub impact: ImpactAssessment,
    pub ethical_validation: EthicalValidation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActionType {
    Adoption,
    Execution,
    Configuration,
    Update,
    Removal,
    Integration,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionContext {
    pub ember_phase: Option<String>,
    pub cipher_phase: Option<String>,
    pub environment: String,
    pub source: String,
    pub related_actions: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionResult {
    pub status: ActionStatus,
    pub duration: std::time::Duration,
    pub output: Option<serde_json::Value>,
    pub error: Option<String>,
    pub metrics: ActionMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActionStatus {
    Success,
    Failure,
    Partial,
    Blocked,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionMetrics {
    pub cpu_usage: f64,
    pub memory_usage: u64,
    pub network_bytes: u64,
    pub error_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImpactAssessment {
    pub severity: ImpactSeverity,
    pub scope: Vec<ImpactScope>,
    pub duration: ImpactDuration,
    pub affected_systems: Vec<String>,
    pub mitigations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImpactSeverity {
    None,
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImpactScope {
    System,
    Network,
    Data,
    User,
    ThirdParty,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImpactDuration {
    Temporary,
    Short,
    Medium,
    Long,
    Permanent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EthicalValidation {
    pub approved: bool,
    pub principles_upheld: Vec<String>,
    pub concerns: Vec<EthicalConcern>,
    pub recommendations: Vec<String>,
    pub validator: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EthicalConcern {
    pub category: String,
    pub description: String,
    pub severity: ImpactSeverity,
    pub mitigation: Option<String>,
}

pub struct ConscienceLogger {
    db: Arc<RwLock<ConscienceDb>>,
    ethical_validator: Arc<dyn EthicalValidator>,
    impact_analyzer: Arc<dyn ImpactAnalyzer>,
}

#[async_trait::async_trait]
pub trait EthicalValidator: Send + Sync {
    async fn validate_action(&self, action: &ToolAction) -> Result<EthicalValidation>;
}

#[async_trait::async_trait]
pub trait ImpactAnalyzer: Send + Sync {
    async fn analyze_impact(&self, action: &ToolAction) -> Result<ImpactAssessment>;
}

struct ConscienceDb {
    actions: HashMap<Uuid, ToolAction>,
    tool_history: HashMap<Uuid, Vec<Uuid>>,
}

impl ConscienceLogger {
    pub fn new(
        ethical_validator: Arc<dyn EthicalValidator>,
        impact_analyzer: Arc<dyn ImpactAnalyzer>,
    ) -> Self {
        Self {
            db: Arc::new(RwLock::new(ConscienceDb {
                actions: HashMap::new(),
                tool_history: HashMap::new(),
            })),
            ethical_validator,
            impact_analyzer,
        }
    }

    pub async fn log_action(&self, mut action: ToolAction) -> Result<()> {
        // Validate action ethically
        action.ethical_validation = self.ethical_validator.validate_action(&action).await?;

        // Analyze impact
        action.impact = self.impact_analyzer.analyze_impact(&action).await?;

        // Store action
        let mut db = self.db.write().await;
        
        // Update tool history
        db.tool_history
            .entry(action.tool_id)
            .or_default()
            .push(action.id);

        // Store action
        db.actions.insert(action.id, action);

        Ok(())
    }

    pub async fn get_action(&self, action_id: Uuid) -> Option<ToolAction> {
        let db = self.db.read().await;
        db.actions.get(&action_id).cloned()
    }

    pub async fn get_tool_history(&self, tool_id: Uuid) -> Vec<ToolAction> {
        let db = self.db.read().await;
        db.tool_history
            .get(&tool_id)
            .map(|action_ids| {
                action_ids
                    .iter()
                    .filter_map(|id| db.actions.get(id))
                    .cloned()
                    .collect()
            })
            .unwrap_or_default()
    }

    pub async fn search_actions(&self, query: ActionQuery) -> Vec<ToolAction> {
        let db = self.db.read().await;
        db.actions
            .values()
            .filter(|action| query.matches(action))
            .cloned()
            .collect()
    }

    pub async fn get_tool_metrics(&self, tool_id: Uuid) -> ToolMetrics {
        let db = self.db.read().await;
        let actions = db.tool_history
            .get(&tool_id)
            .map(|ids| {
                ids.iter()
                    .filter_map(|id| db.actions.get(id))
                    .cloned()
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        ToolMetrics::from_actions(&actions)
    }
}

pub struct ActionQuery {
    pub tool_id: Option<Uuid>,
    pub action_type: Option<ActionType>,
    pub time_range: Option<(DateTime<Utc>, DateTime<Utc>)>,
    pub status: Option<ActionStatus>,
    pub ethical_approval: Option<bool>,
    pub impact_severity: Option<ImpactSeverity>,
}

impl ActionQuery {
    fn matches(&self, action: &ToolAction) -> bool {
        // Check tool ID
        if let Some(tool_id) = self.tool_id {
            if action.tool_id != tool_id {
                return false;
            }
        }

        // Check action type
        if let Some(action_type) = &self.action_type {
            if !matches!(action.action_type, ActionType::Adoption) {
                return false;
            }
        }

        // Check time range
        if let Some((start, end)) = self.time_range {
            if action.timestamp < start || action.timestamp > end {
                return false;
            }
        }

        // Check status
        if let Some(status) = &self.status {
            if !matches!(action.result.status, ActionStatus::Success) {
                return false;
            }
        }

        // Check ethical approval
        if let Some(approval) = self.ethical_approval {
            if action.ethical_validation.approved != approval {
                return false;
            }
        }

        // Check impact severity
        if let Some(severity) = &self.impact_severity {
            if !matches!(action.impact.severity, ImpactSeverity::High) {
                return false;
            }
        }

        true
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolMetrics {
    pub total_actions: u32,
    pub success_rate: f64,
    pub average_duration: std::time::Duration,
    pub error_rate: f64,
    pub ethical_approval_rate: f64,
    pub impact_distribution: HashMap<ImpactSeverity, u32>,
    pub resource_usage: ResourceMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceMetrics {
    pub total_cpu_time: f64,
    pub average_memory: u64,
    pub total_network: u64,
    pub peak_cpu: f64,
    pub peak_memory: u64,
}

impl ToolMetrics {
    fn from_actions(actions: &[ToolAction]) -> Self {
        let total = actions.len() as u32;
        if total == 0 {
            return Self::default();
        }

        let successes = actions.iter()
            .filter(|a| matches!(a.result.status, ActionStatus::Success))
            .count();

        let total_duration = actions.iter()
            .map(|a| a.result.duration)
            .sum::<std::time::Duration>();

        let ethical_approvals = actions.iter()
            .filter(|a| a.ethical_validation.approved)
            .count();

        let mut impact_dist = HashMap::new();
        for action in actions {
            *impact_dist.entry(action.impact.severity.clone()).or_default() += 1;
        }

        let resource_metrics = ResourceMetrics {
            total_cpu_time: actions.iter().map(|a| a.result.metrics.cpu_usage).sum(),
            average_memory: actions.iter().map(|a| a.result.metrics.memory_usage).sum::<u64>() / total as u64,
            total_network: actions.iter().map(|a| a.result.metrics.network_bytes).sum(),
            peak_cpu: actions.iter().map(|a| a.result.metrics.cpu_usage).fold(0.0, f64::max),
            peak_memory: actions.iter().map(|a| a.result.metrics.memory_usage).fold(0, u64::max),
        };

        Self {
            total_actions: total,
            success_rate: successes as f64 / total as f64,
            average_duration: total_duration / total as u32,
            error_rate: actions.iter().map(|a| a.result.metrics.error_count).sum::<u32>() as f64 / total as f64,
            ethical_approval_rate: ethical_approvals as f64 / total as f64,
            impact_distribution: impact_dist,
            resource_usage: resource_metrics,
        }
    }
}

impl Default for ToolMetrics {
    fn default() -> Self {
        Self {
            total_actions: 0,
            success_rate: 0.0,
            average_duration: std::time::Duration::from_secs(0),
            error_rate: 0.0,
            ethical_approval_rate: 0.0,
            impact_distribution: HashMap::new(),
            resource_usage: ResourceMetrics {
                total_cpu_time: 0.0,
                average_memory: 0,
                total_network: 0,
                peak_cpu: 0.0,
                peak_memory: 0,
            },
        }
    }
}