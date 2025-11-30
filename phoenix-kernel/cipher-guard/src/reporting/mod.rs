mod alerts;
mod metrics;
mod evidence;

pub use alerts::{AlertManager, Alert, AlertSeverity, AlertStatus, NotificationChannel};
pub use metrics::{MetricsCollector, SecurityMetrics, ThreatMetrics, ResponseMetrics, SystemMetrics, PerformanceMetrics};
pub use evidence::ForensicsCollector;

use crate::{Threat, IncidentReport, Reporter, Evidence};
use std::sync::Arc;
use async_trait::async_trait;
use std::error::Error;
use tokio::sync::mpsc;

pub struct ReportingSystem {
    alert_manager: Arc<AlertManager>,
    metrics_collector: Arc<MetricsCollector>,
    forensics_collector: Arc<ForensicsCollector>,
}

impl ReportingSystem {
    pub fn new(
        alert_tx: mpsc::Sender<Alert>,
        storage_path: std::path::PathBuf,
    ) -> Self {
        Self {
            alert_manager: Arc::new(AlertManager::new(alert_tx)),
            metrics_collector: Arc::new(MetricsCollector::new(30)), // 30 days retention
            forensics_collector: Arc::new(ForensicsCollector::new(storage_path)),
        }
    }

    pub fn alert_manager(&self) -> Arc<AlertManager> {
        Arc::clone(&self.alert_manager)
    }

    pub fn metrics_collector(&self) -> Arc<MetricsCollector> {
        Arc::clone(&self.metrics_collector)
    }

    pub fn forensics_collector(&self) -> Arc<ForensicsCollector> {
        Arc::clone(&self.forensics_collector)
    }

    pub async fn collect_evidence(&self, incident: &IncidentReport) -> Result<Vec<Evidence>, Box<dyn Error + Send + Sync>> {
        let evidence = self.forensics_collector.collect(incident).await?;
        
        for item in &evidence {
            self.forensics_collector.preserve(item).await?;
        }

        Ok(evidence)
    }

    pub async fn generate_comprehensive_report(&self, incident: &IncidentReport) -> Result<String, Box<dyn Error + Send + Sync>> {
        let metrics_report = self.metrics_collector.generate_report(incident).await?;
        let evidence = self.collect_evidence(incident).await?;
        
        let report = format!(
            "Incident Report\n\
            ===============\n\
            Incident ID: {}\n\
            Threat Description: {}\n\
            Status: {:?}\n\
            Timestamp: {}\n\
            \n\
            Metrics:\n\
            {}\n\
            \n\
            Evidence Collected: {}\n\
            {}",
            incident.id,
            incident.threat.description,
            incident.status,
            incident.timestamp,
            metrics_report,
            evidence.len(),
            evidence.iter()
                .map(|e| format!("- {:?}: {}", e.data_type, e.hash))
                .collect::<Vec<_>>()
                .join("\n")
        );

        Ok(report)
    }
}

#[async_trait]
impl Reporter for ReportingSystem {
    async fn generate_report(&self, incident: &IncidentReport) -> Result<String, Box<dyn Error + Send + Sync>> {
        self.generate_comprehensive_report(incident).await
    }

    async fn alert(&self, threat: &Threat) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.alert_manager.alert(threat).await?;
        self.metrics_collector.alert(threat).await?;
        Ok(())
    }

    async fn update_metrics(&self, incident: &IncidentReport) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.metrics_collector.update_metrics(incident).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ThreatSeverity;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_reporting_system() {
        let (alert_tx, _) = mpsc::channel(100);
        let temp_dir = tempdir().unwrap();
        let system = ReportingSystem::new(alert_tx, temp_dir.path().to_path_buf());

        let threat = Threat {
            id: uuid::Uuid::new_v4(),
            severity: ThreatSeverity::High,
            description: "Test threat".to_string(),
            timestamp: chrono::Utc::now(),
            source: "test_source".to_string(),
        };

        let incident = IncidentReport {
            id: uuid::Uuid::new_v4(),
            threat: threat.clone(),
            status: crate::IncidentStatus::Analyzing,
            actions_taken: vec![],
            evidence: vec![],
            timestamp: chrono::Utc::now(),
        };

        system.alert(&threat).await.unwrap();
        system.update_metrics(&incident).await.unwrap();

        let report = system.generate_comprehensive_report(&incident).await.unwrap();
        assert!(report.contains(&incident.id.to_string()));
        assert!(report.contains("Evidence Collected:"));
    }
}