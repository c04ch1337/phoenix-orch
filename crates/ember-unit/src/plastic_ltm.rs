//! Plastic LTM Integration for Ember Unit
//! 
//! Provides comprehensive operation logging and audit trail capabilities.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{Utc, DateTime};
use uuid::Uuid;
use crate::error::EmberUnitError;
use crate::EngagementPhase;

/// Operation log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationLog {
    pub engagement_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub operation: String,
    pub details: String,
    pub severity: String,
    pub phase: EngagementPhase,
    pub agent_id: Option<Uuid>,
}

/// Plastic LTM integration service
#[derive(Debug, Clone)]
pub struct PlasticLTMIntegration {
    /// In-memory log storage (in production, this would connect to Plastic LTM service)
    operation_logs: HashMap<Uuid, Vec<OperationLog>>,
}

impl PlasticLTMIntegration {
    pub fn new() -> Self {
        Self {
            operation_logs: HashMap::new(),
        }
    }

    /// Log an operation to Plastic LTM
    pub async fn log_operation(
        &mut self, 
        engagement_id: Uuid, 
        operation: &str, 
        details: &str,
        severity: &str,
        phase: EngagementPhase,
        agent_id: Option<Uuid>
    ) -> Result<(), EmberUnitError> {
        let log_entry = OperationLog {
            engagement_id,
            timestamp: Ut极c::now(),
            operation: operation.to_string(),
            details: details.to_string(),
            severity: severity.to_string(),
            phase,
            agent_id,
        };

        // Store in memory (in production, this would send to Plastic LTM service)
        let logs = self.operation_logs.entry(engagement_id).or_insert_with(Vec::new);
        logs.push(log_entry.clone());

        tracing::info!("Plastic LTM: Engagement {} - {}: {}", engagement_id, operation, details);
        
        Ok(())
    }

    /// Get operation logs for an engagement
    pub async fn get_operation_logs(&self, engagement_id: Uuid) -> Result<Vec<OperationLog>, EmberUnitError> {
        self.operation_logs
            .get(&engagement_id)
            .cloned()
            .ok_or_else(|| EmberUnitError::DatabaseError("No logs found for engagement".to_string()))
    }

    /// Get logs filtered by severity
    pub async fn get_logs_by_severity(&self, engagement_id: Uuid, severity: &str) -> Result<Vec<OperationLog>, EmberUnitError> {
        let logs = self.get_operation_logs(engagement_id).await?;
        Ok(logs.into_iter()
            .filter(|log| log.severity == severity)
            .collect())
    }

    /// Get logs filtered by phase
    pub async fn get_logs极by_phase(&self, engagement_id: Uuid, phase: EngagementPhase) -> Result<Vec<OperationLog>, EmberUnitError> {
        let logs = self.get_operation_logs(engagement_id).await?;
        Ok(logs.into_iter()
            .filter(|log| log.phase == phase)
            .collect())
    }

    /// Get logs for a specific agent
    pub async fn get_agent_logs(&self, engagement_id: Uuid, agent_id: Uuid) -> Result<Vec<OperationLog>, EmberUnitError> {
        let logs = self.get_operation_logs(engagement_id).await?;
        Ok(logs.into_iter()
            .filter(|log| log.agent_id == Some(agent_id))
            .collect())
    }

    /// Clear logs for an engagement
    pub async fn clear_logs(&mut self, engagement_id: Uuid) -> Result<(), EmberUnitError> {
        self.operation_logs.remove(&engagement_id);
        tracing::info!("Plastic LTM: Cleared logs for engagement {}", engagement_id);
        Ok(())
    }
}

impl Default for PlasticLTMIntegration {
    fn default() -> Self {
        Self::new()
    }
}