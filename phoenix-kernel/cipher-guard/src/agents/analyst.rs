use crate::{Threat, IncidentReport, Evidence, Reporter};
use async_trait::async_trait;
use std::error::Error;
use tokio::sync::mpsc;
use std::sync::Arc;
use std::collections::HashMap;

pub struct AnalystAgent {
    reporters: Vec<Arc<dyn Reporter + Send + Sync>>,
    threat_patterns: HashMap<String, u32>,
    incident_metrics: HashMap<uuid::Uuid, IncidentMetrics>,
    report_tx: mpsc::Sender<String>,
}

#[derive(Debug, Clone)]
struct IncidentMetrics {
    detection_time: chrono::Duration,
    response_time: chrono::Duration,
    resolution_time: Option<chrono::Duration>,
    evidence_count: usize,
    severity_level: u8,
}

impl AnalystAgent {
    pub fn new(report_tx: mpsc::Sender<String>) -> Self {
        Self {
            reporters: Vec::new(),
            threat_patterns: HashMap::new(),
            incident_metrics: HashMap::new(),
            report_tx,
        }
    }

    pub fn add_reporter(&mut self, reporter: Arc<dyn Reporter + Send + Sync>) {
        self.reporters.push(reporter);
    }

    pub async fn analyze_threat(&mut self, threat: &Threat) -> Result<(), Box<dyn Error + Send + Sync>> {
        // Update threat pattern statistics
        let pattern_count = self.threat_patterns
            .entry(threat.source.clone())
            .or_insert(0);
        *pattern_count += 1;

        // Alert all reporters
        for reporter in &self.reporters {
            if let Err(e) = reporter.alert(threat).await {
                tracing::error!("Failed to send alert: {}", e);
            }
        }

        Ok(())
    }

    pub async fn analyze_incident(&mut self, incident: &IncidentReport) -> Result<(), Box<dyn Error + Send + Sync>> {
        // Calculate incident metrics
        let detection_time = incident.timestamp - incident.threat.timestamp;
        let response_time = chrono::Duration::seconds(0); // TODO: Calculate from actions_taken timestamps
        
        let metrics = IncidentMetrics {
            detection_time,
            response_time,
            resolution_time: None,
            evidence_count: incident.evidence.len(),
            severity_level: match incident.threat.severity {
                crate::ThreatSeverity::Low => 1,
                crate::ThreatSeverity::Medium => 2,
                crate::ThreatSeverity::High => 3,
                crate::ThreatSeverity::Critical => 4,
            },
        };

        self.incident_metrics.insert(incident.id, metrics.clone());

        // Generate and send reports
        for reporter in &self.reporters {
            match reporter.generate_report(incident).await {
                Ok(report) => {
                    if let Err(e) = self.report_tx.send(report).await {
                        tracing::error!("Failed to send report: {}", e);
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to generate report: {}", e);
                }
            }

            if let Err(e) = reporter.update_metrics(incident).await {
                tracing::error!("Failed to update metrics: {}", e);
            }
        }

        Ok(())
    }

    pub async fn analyze_evidence(&mut self, evidence: &Evidence) -> Result<(), Box<dyn Error + Send + Sync>> {
        if let Some(metrics) = self.incident_metrics.get_mut(&evidence.incident_id) {
            metrics.evidence_count += 1;
        }

        Ok(())
    }

    pub fn get_threat_patterns(&self) -> &HashMap<String, u32> {
        &self.threat_patterns
    }

    pub fn get_incident_metrics(&self) -> &HashMap<uuid::Uuid, IncidentMetrics> {
        &self.incident_metrics
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockall::predicate::*;
    use mockall::mock;
    use uuid::Uuid;

    mock! {
        TestReporter {}
        #[async_trait]
        impl Reporter for TestReporter {
            async fn generate_report(&self, incident: &IncidentReport) -> Result<String, Box<dyn Error + Send + Sync>>;
            async fn alert(&self, threat: &Threat) -> Result<(), Box<dyn Error + Send + Sync>>;
            async fn update_metrics(&self, incident: &IncidentReport) -> Result<(), Box<dyn Error + Send + Sync>>;
        }
    }

    #[tokio::test]
    async fn test_analyst_agent() {
        let (report_tx, mut report_rx) = mpsc::channel(100);
        let mut analyst = AnalystAgent::new(report_tx);

        let mut reporter = MockTestReporter::new();
        reporter.expect_alert()
            .returning(|_| Ok(()));
        reporter.expect_generate_report()
            .returning(|_| Ok("Test report".to_string()));
        reporter.expect_update_metrics()
            .returning(|_| Ok(()));

        analyst.add_reporter(Arc::new(reporter));

        let threat = Threat {
            id: Uuid::new_v4(),
            severity: crate::ThreatSeverity::High,
            description: "Test threat".to_string(),
            timestamp: chrono::Utc::now(),
            source: "Test source".to_string(),
        };

        let incident = IncidentReport {
            id: Uuid::new_v4(),
            threat: threat.clone(),
            status: crate::IncidentStatus::Analyzing,
            actions_taken: vec![],
            evidence: vec![],
            timestamp: chrono::Utc::now(),
        };

        analyst.analyze_threat(&threat).await.unwrap();
        analyst.analyze_incident(&incident).await.unwrap();

        let report = report_rx.recv().await.unwrap();
        assert_eq!(report, "Test report");
    }
}