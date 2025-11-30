mod containment;
mod mitigation;
mod recovery;

pub use containment::ContainmentSystem;
pub use mitigation::MitigationSystem;
pub use recovery::RecoverySystem;

use crate::{Threat, IncidentReport, IncidentResponder};
use std::sync::Arc;
use async_trait::async_trait;
use std::error::Error;

pub struct ResponseCoordinator {
    containment: Arc<ContainmentSystem>,
    mitigation: Arc<MitigationSystem>,
    recovery: Arc<RecoverySystem>,
}

impl ResponseCoordinator {
    pub fn new() -> Self {
        Self {
            containment: Arc::new(ContainmentSystem::new()),
            mitigation: Arc::new(MitigationSystem::new()),
            recovery: Arc::new(RecoverySystem::new()),
        }
    }

    pub async fn coordinate_response(&self, incident: &IncidentReport) -> Result<(), Box<dyn Error + Send + Sync>> {
        // First, contain the threat
        if let Err(e) = self.containment.contain(&incident.threat).await {
            tracing::error!("Containment failed: {}", e);
            return Err(e);
        }

        // Then, apply mitigation measures
        if let Err(e) = self.mitigation.mitigate(incident).await {
            tracing::error!("Mitigation failed: {}", e);
            return Err(e);
        }

        // Finally, initiate recovery
        if let Err(e) = self.recovery.respond(incident).await {
            tracing::error!("Recovery failed: {}", e);
            return Err(e);
        }

        Ok(())
    }
}

#[async_trait]
impl IncidentResponder for ResponseCoordinator {
    async fn respond(&self, incident: &IncidentReport) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.coordinate_response(incident).await
    }

    async fn contain(&self, threat: &Threat) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.containment.contain(threat).await
    }

    async fn mitigate(&self, incident: &IncidentReport) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.mitigation.mitigate(incident).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ThreatSeverity;
    use uuid::Uuid;

    #[tokio::test]
    async fn test_response_coordination() {
        let coordinator = ResponseCoordinator::new();

        let threat = Threat {
            id: Uuid::new_v4(),
            severity: ThreatSeverity::High,
            description: "Test threat".to_string(),
            timestamp: chrono::Utc::now(),
            source: "test_system".to_string(),
        };

        let incident = IncidentReport {
            id: Uuid::new_v4(),
            threat,
            status: crate::IncidentStatus::Analyzing,
            actions_taken: vec![],
            evidence: vec![],
            timestamp: chrono::Utc::now(),
        };

        coordinator.coordinate_response(&incident).await.unwrap();
    }
}