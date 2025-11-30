mod monitor;
mod defender;
mod responder;
mod analyst;

pub use monitor::MonitorAgent;
pub use defender::DefenderAgent;
pub use responder::ResponderAgent;
pub use analyst::AnalystAgent;

use tokio::sync::mpsc;
use std::sync::Arc;

pub struct AgentOrchestrator {
    monitor: Arc<MonitorAgent>,
    defender: Arc<DefenderAgent>,
    responder: Arc<ResponderAgent>,
    analyst: Arc<AnalystAgent>,
}

impl AgentOrchestrator {
    pub fn new(
        monitor: MonitorAgent,
        defender: DefenderAgent,
        responder: ResponderAgent,
        analyst: AnalystAgent,
    ) -> Self {
        Self {
            monitor: Arc::new(monitor),
            defender: Arc::new(defender),
            responder: Arc::new(responder),
            analyst: Arc::new(analyst),
        }
    }

    pub async fn start(&self) {
        // Create channels for inter-agent communication
        let (threat_tx, threat_rx) = mpsc::channel(100);
        let (incident_tx, incident_rx) = mpsc::channel(100);
        let (evidence_tx, evidence_rx) = mpsc::channel(100);
        let (report_tx, report_rx) = mpsc::channel(100);

        // Clone Arc references for each task
        let monitor = Arc::clone(&self.monitor);
        let defender = Arc::clone(&self.defender);
        let responder = Arc::clone(&self.responder);
        let analyst = Arc::clone(&self.analyst);

        // Spawn agent tasks
        tokio::spawn(async move {
            monitor.start_monitoring().await.unwrap_or_else(|e| {
                tracing::error!("Monitor agent error: {}", e);
            });
        });

        tokio::spawn(async move {
            defender.start(threat_rx).await;
        });

        tokio::spawn(async move {
            responder.start(incident_rx).await;
        });

        // Handle evidence processing
        tokio::spawn(async move {
            while let Some(evidence) = evidence_rx.recv().await {
                if let Err(e) = analyst.analyze_evidence(&evidence).await {
                    tracing::error!("Failed to analyze evidence: {}", e);
                }
            }
        });

        // Handle report processing
        tokio::spawn(async move {
            while let Some(report) = report_rx.recv().await {
                tracing::info!("Generated report: {}", report);
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{ThreatDetector, IncidentResponder, EvidenceCollector, Reporter};
    use std::error::Error;

    #[tokio::test]
    async fn test_agent_orchestration() {
        let (alert_tx, _) = mpsc::channel(100);
        let (report_tx, _) = mpsc::channel(100);
        let (evidence_tx, _) = mpsc::channel(100);
        let (incident_tx, _) = mpsc::channel(100);

        let monitor = MonitorAgent::new(alert_tx);
        let defender = DefenderAgent::new(incident_tx);
        let responder = ResponderAgent::new(evidence_tx);
        let analyst = AnalystAgent::new(report_tx);

        let orchestrator = AgentOrchestrator::new(
            monitor,
            defender,
            responder,
            analyst,
        );

        orchestrator.start().await;
    }
}