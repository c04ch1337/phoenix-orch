use crate::{IncidentReport, IncidentStatus, Evidence, EvidenceCollector};
use async_trait::async_trait;
use std::error::Error;
use tokio::sync::mpsc;
use std::sync::Arc;
use std::collections::HashMap;

pub struct ResponderAgent {
    evidence_collectors: Vec<Arc<dyn EvidenceCollector + Send + Sync>>,
    active_responses: HashMap<uuid::Uuid, ResponseState>,
    evidence_tx: mpsc::Sender<Evidence>,
}

#[derive(Debug)]
struct ResponseState {
    incident: IncidentReport,
    evidence_collected: bool,
    recovery_initiated: bool,
}

impl ResponderAgent {
    pub fn new(evidence_tx: mpsc::Sender<Evidence>) -> Self {
        Self {
            evidence_collectors: Vec::new(),
            active_responses: HashMap::new(),
            evidence_tx,
        }
    }

    pub fn add_collector(&mut self, collector: Arc<dyn EvidenceCollector + Send + Sync>) {
        self.evidence_collectors.push(collector);
    }

    pub async fn handle_incident(&mut self, incident: IncidentReport) -> Result<(), Box<dyn Error + Send + Sync>> {
        let response_state = ResponseState {
            incident: incident.clone(),
            evidence_collected: false,
            recovery_initiated: false,
        };

        self.active_responses.insert(incident.id, response_state);

        // Collect evidence from all collectors
        for collector in &self.evidence_collectors {
            match collector.collect(&incident).await {
                Ok(evidence_items) => {
                    for evidence in evidence_items {
                        // Preserve evidence
                        if let Err(e) = collector.preserve(&evidence).await {
                            tracing::error!("Failed to preserve evidence: {}", e);
                            continue;
                        }

                        // Send evidence for reporting
                        if let Err(e) = self.evidence_tx.send(evidence).await {
                            tracing::error!("Failed to send evidence: {}", e);
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to collect evidence: {}", e);
                }
            }
        }

        // Update response state
        if let Some(state) = self.active_responses.get_mut(&incident.id) {
            state.evidence_collected = true;
        }

        Ok(())
    }

    pub async fn initiate_recovery(&mut self, incident_id: uuid::Uuid) -> Result<(), Box<dyn Error + Send + Sync>> {
        if let Some(state) = self.active_responses.get_mut(&incident_id) {
            if !state.evidence_collected {
                return Err("Cannot initiate recovery before evidence collection".into());
            }

            state.recovery_initiated = true;
            state.incident.status = IncidentStatus::Resolved;
        }

        Ok(())
    }

    pub async fn start(&mut self, mut incident_rx: mpsc::Receiver<IncidentReport>) {
        while let Some(incident) = incident_rx.recv().await {
            if let Err(e) = self.handle_incident(incident).await {
                tracing::error!("Failed to handle incident: {}", e);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockall::predicate::*;
    use mockall::mock;
    use uuid::Uuid;

    mock! {
        TestCollector {}
        #[async_trait]
        impl EvidenceCollector for TestCollector {
            async fn collect(&self, incident: &IncidentReport) -> Result<Vec<Evidence>, Box<dyn Error + Send + Sync>>;
            async fn preserve(&self, evidence: &Evidence) -> Result<(), Box<dyn Error + Send + Sync>>;
        }
    }

    #[tokio::test]
    async fn test_responder_agent() {
        let (evidence_tx, mut evidence_rx) = mpsc::channel(100);
        let mut responder = ResponderAgent::new(evidence_tx);

        let mut collector = MockTestCollector::new();
        collector.expect_collect()
            .returning(|_| {
                Ok(vec![Evidence {
                    id: Uuid::new_v4(),
                    incident_id: Uuid::new_v4(),
                    data_type: crate::EvidenceType::Log,
                    content: "Test evidence".to_string(),
                    timestamp: chrono::Utc::now(),
                    hash: "test_hash".to_string(),
                }])
            });
        collector.expect_preserve()
            .returning(|_| Ok(()));

        responder.add_collector(Arc::new(collector));

        let incident = IncidentReport {
            id: Uuid::new_v4(),
            threat: crate::Threat {
                id: Uuid::new_v4(),
                severity: crate::ThreatSeverity::High,
                description: "Test threat".to_string(),
                timestamp: chrono::Utc::now(),
                source: "Test source".to_string(),
            },
            status: IncidentStatus::Analyzing,
            actions_taken: vec![],
            evidence: vec![],
            timestamp: chrono::Utc::now(),
        };

        responder.handle_incident(incident.clone()).await.unwrap();

        let evidence = evidence_rx.recv().await.unwrap();
        assert_eq!(evidence.data_type, crate::EvidenceType::Log);
    }
}