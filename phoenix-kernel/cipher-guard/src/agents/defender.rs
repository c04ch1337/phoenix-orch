use crate::{IncidentResponder, Threat, IncidentReport, IncidentStatus};
use async_trait::async_trait;
use std::error::Error;
use tokio::sync::mpsc;
use std::sync::Arc;
use std::collections::HashMap;

pub struct DefenderAgent {
    responders: Vec<Arc<dyn IncidentResponder + Send + Sync>>,
    active_incidents: HashMap<uuid::Uuid, IncidentReport>,
    report_tx: mpsc::Sender<IncidentReport>,
}

impl DefenderAgent {
    pub fn new(report_tx: mpsc::Sender<IncidentReport>) -> Self {
        Self {
            responders: Vec::new(),
            active_incidents: HashMap::new(),
            report_tx,
        }
    }

    pub fn add_responder(&mut self, responder: Arc<dyn IncidentResponder + Send + Sync>) {
        self.responders.push(responder);
    }

    pub async fn handle_threat(&mut self, threat: Threat) -> Result<(), Box<dyn Error + Send + Sync>> {
        let incident = IncidentReport {
            id: uuid::Uuid::new_v4(),
            threat: threat.clone(),
            status: IncidentStatus::Analyzing,
            actions_taken: Vec::new(),
            evidence: Vec::new(),
            timestamp: chrono::Utc::now(),
        };

        self.active_incidents.insert(incident.id, incident.clone());
        self.report_tx.send(incident.clone()).await?;

        for responder in &self.responders {
            // First contain the threat
            if let Err(e) = responder.contain(&threat).await {
                tracing::error!("Failed to contain threat: {}", e);
                continue;
            }

            // Then attempt mitigation
            if let Err(e) = responder.mitigate(&incident).await {
                tracing::error!("Failed to mitigate incident: {}", e);
                continue;
            }

            // Finally execute the response plan
            if let Err(e) = responder.respond(&incident).await {
                tracing::error!("Failed to execute response: {}", e);
                continue;
            }
        }

        // Update incident status
        if let Some(mut incident) = self.active_incidents.get_mut(&incident.id) {
            incident.status = IncidentStatus::Contained;
            self.report_tx.send(incident.clone()).await?;
        }

        Ok(())
    }

    pub async fn start(&mut self, mut threat_rx: mpsc::Receiver<Threat>) {
        while let Some(threat) = threat_rx.recv().await {
            if let Err(e) = self.handle_threat(threat).await {
                tracing::error!("Failed to handle threat: {}", e);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockall::predicate::*;
    use mockall::mock;

    mock! {
        TestResponder {}
        #[async_trait]
        impl IncidentResponder for TestResponder {
            async fn respond(&self, incident: &IncidentReport) -> Result<(), Box<dyn Error + Send + Sync>>;
            async fn contain(&self, threat: &Threat) -> Result<(), Box<dyn Error + Send + Sync>>;
            async fn mitigate(&self, incident: &IncidentReport) -> Result<(), Box<dyn Error + Send + Sync>>;
        }
    }

    #[tokio::test]
    async fn test_defender_agent() {
        let (report_tx, mut report_rx) = mpsc::channel(100);
        let mut defender = DefenderAgent::new(report_tx);
        
        let mut responder = MockTestResponder::new();
        responder.expect_contain()
            .returning(|_| Ok(()));
        responder.expect_mitigate()
            .returning(|_| Ok(()));
        responder.expect_respond()
            .returning(|_| Ok(()));

        defender.add_responder(Arc::new(responder));

        let threat = Threat {
            id: uuid::Uuid::new_v4(),
            severity: crate::ThreatSeverity::High,
            description: "Test threat".to_string(),
            timestamp: chrono::Utc::now(),
            source: "Test source".to_string(),
        };

        defender.handle_threat(threat).await.unwrap();

        let report = report_rx.recv().await.unwrap();
        assert_eq!(report.status, IncidentStatus::Analyzing);
    }
}