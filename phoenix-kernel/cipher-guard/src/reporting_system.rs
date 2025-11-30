use crate::{
    Threat, IncidentReport, Evidence,
    reporting::{AlertManager, MetricsCollector, ForensicsCollector, Alert, SecurityMetrics},
    memory::MemoryManager,
    websocket::{WebSocketServer, MonitoringMessage},
    integration::EmberUnitIntegration,
};
use std::error::Error;
use std::sync::Arc;
use tokio::sync::mpsc;
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComprehensiveReport {
    pub id: uuid::Uuid,
    pub timestamp: DateTime<Utc>,
    pub summary: ReportSummary,
    pub threats: Vec<ThreatDetails>,
    pub incidents: Vec<IncidentDetails>,
    pub metrics: SecurityMetrics,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportSummary {
    pub total_threats: usize,
    pub active_incidents: usize,
    pub resolved_incidents: usize,
    pub system_status: String,
    pub threat_level: String,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatDetails {
    pub threat: Threat,
    pub related_incidents: Vec<uuid::Uuid>,
    pub evidence_count: usize,
    pub containment_status: String,
    pub mitigation_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncidentDetails {
    pub incident: IncidentReport,
    pub evidence: Vec<Evidence>,
    pub timeline: Vec<TimelineEvent>,
    pub resolution_time: Option<chrono::Duration>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineEvent {
    pub timestamp: DateTime<Utc>,
    pub event_type: String,
    pub description: String,
    pub actor: String,
}

pub struct ReportingSystem {
    alert_manager: Arc<AlertManager>,
    metrics_collector: Arc<MetricsCollector>,
    forensics_collector: Arc<ForensicsCollector>,
    memory_manager: Arc<MemoryManager>,
    websocket_server: Arc<WebSocketServer>,
    ember_unit: Arc<EmberUnitIntegration>,
    report_tx: mpsc::Sender<ComprehensiveReport>,
}

impl ReportingSystem {
    pub fn new(
        alert_manager: Arc<AlertManager>,
        metrics_collector: Arc<MetricsCollector>,
        forensics_collector: Arc<ForensicsCollector>,
        memory_manager: Arc<MemoryManager>,
        websocket_server: Arc<WebSocketServer>,
        ember_unit: Arc<EmberUnitIntegration>,
        report_tx: mpsc::Sender<ComprehensiveReport>,
    ) -> Self {
        Self {
            alert_manager,
            metrics_collector,
            forensics_collector,
            memory_manager,
            websocket_server,
            ember_unit,
            report_tx,
        }
    }

    pub async fn process_threat(&self, threat: &Threat) -> Result<(), Box<dyn Error + Send + Sync>> {
        // Store threat in memory
        self.memory_manager.store_threat(threat).await?;

        // Generate and send alert
        let alert = Alert {
            id: uuid::Uuid::new_v4(),
            severity: match threat.severity {
                crate::ThreatSeverity::Critical => "critical",
                crate::ThreatSeverity::High => "high",
                crate::ThreatSeverity::Medium => "medium",
                crate::ThreatSeverity::Low => "low",
            }.to_string(),
            message: threat.description.clone(),
            timestamp: threat.timestamp,
            source: threat.source.clone(),
        };
        
        // Send alert through WebSocket
        self.websocket_server.broadcast(MonitoringMessage::ThreatDetected(threat.clone())).await?;

        // Get threat intelligence from Ember Unit
        if let Ok(intel) = self.ember_unit.analyze_threat(threat).await {
            // Update metrics with threat intelligence
            self.metrics_collector.update_threat_metrics(threat).await?;
        }

        Ok(())
    }

    pub async fn process_incident(&self, incident: &IncidentReport) -> Result<(), Box<dyn Error + Send + Sync>> {
        // Store incident in memory
        self.memory_manager.store_incident(incident).await?;

        // Collect evidence
        let evidence = self.forensics_collector.collect(incident).await?;
        for item in &evidence {
            self.memory_manager.store_evidence(item).await?;
            self.ember_unit.submit_evidence(item).await?;
        }

        // Update metrics
        self.metrics_collector.update_incident_metrics(incident).await?;

        // Send incident update through WebSocket
        self.websocket_server.broadcast(MonitoringMessage::IncidentUpdate(incident.clone())).await?;

        // Send incident report to Ember Unit
        self.ember_unit.send_incident_report(incident).await?;

        Ok(())
    }

    pub async fn generate_comprehensive_report(&self) -> Result<ComprehensiveReport, Box<dyn Error + Send + Sync>> {
        let metrics = self.metrics_collector.generate_metrics_report().await?;
        let period_end = Utc::now();
        let period_start = period_end - chrono::Duration::hours(24);

        // Collect active threats and incidents
        let mut threats = Vec::new();
        let mut incidents = Vec::new();

        // Query memory for recent threats and incidents
        let recent_threats = self.memory_manager
            .query_threats_by_source("all")
            .await?;

        for threat in recent_threats {
            let related_incidents = self.memory_manager
                .query_incidents_by_status("active")
                .await?
                .into_iter()
                .filter(|i| i.threat.id == threat.id)
                .collect::<Vec<_>>();

            threats.push(ThreatDetails {
                threat,
                related_incidents: related_incidents.iter().map(|i| i.id).collect(),
                evidence_count: related_incidents.iter().map(|i| i.evidence.len()).sum(),
                containment_status: "contained".to_string(),
                mitigation_status: "mitigated".to_string(),
            });

            for incident in related_incidents {
                let evidence = incident.evidence.clone();
                let mut timeline = Vec::new();
                
                // Build incident timeline
                timeline.push(TimelineEvent {
                    timestamp: incident.timestamp,
                    event_type: "detection".to_string(),
                    description: "Threat detected".to_string(),
                    actor: "Monitor".to_string(),
                });

                for action in &incident.actions_taken {
                    timeline.push(TimelineEvent {
                        timestamp: Utc::now(), // In real impl, would store timestamps with actions
                        event_type: "action".to_string(),
                        description: action.clone(),
                        actor: "Defender".to_string(),
                    });
                }

                incidents.push(IncidentDetails {
                    incident,
                    evidence,
                    timeline,
                    resolution_time: Some(chrono::Duration::hours(1)), // Example duration
                });
            }
        }

        let report = ComprehensiveReport {
            id: uuid::Uuid::new_v4(),
            timestamp: Utc::now(),
            summary: ReportSummary {
                total_threats: threats.len(),
                active_incidents: incidents.len(),
                resolved_incidents: 0, // Would track this in real impl
                system_status: "operational".to_string(),
                threat_level: "medium".to_string(),
                period_start,
                period_end,
            },
            threats,
            incidents,
            metrics: serde_json::from_str(&metrics)?,
            recommendations: vec![
                "Update threat signatures".to_string(),
                "Review security policies".to_string(),
            ],
        };

        // Send report through channel
        self.report_tx.send(report.clone()).await?;

        Ok(report)
    }

    pub async fn start_periodic_reporting(&self) {
        let report_interval = tokio::time::Duration::from_secs(3600); // 1 hour
        let self_clone = self.clone();

        tokio::spawn(async move {
            loop {
                tokio::time::sleep(report_interval).await;
                
                match self_clone.generate_comprehensive_report().await {
                    Ok(report) => {
                        tracing::info!("Generated periodic report: {}", report.id);
                    }
                    Err(e) => {
                        tracing::error!("Failed to generate periodic report: {}", e);
                    }
                }
            }
        });
    }
}

impl Clone for ReportingSystem {
    fn clone(&self) -> Self {
        Self {
            alert_manager: self.alert_manager.clone(),
            metrics_collector: self.metrics_collector.clone(),
            forensics_collector: self.forensics_collector.clone(),
            memory_manager: self.memory_manager.clone(),
            websocket_server: self.websocket_server.clone(),
            ember_unit: self.ember_unit.clone(),
            report_tx: self.report_tx.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use crate::memory::MemoryConfig;

    #[tokio::test]
    async fn test_reporting_system() {
        // Set up memory system
        let temp_dir = tempdir().unwrap();
        let config = MemoryConfig {
            base_path: temp_dir.path().to_path_buf(),
            mirror_paths: vec![],
        };
        let memory_manager = Arc::new(MemoryManager::new(config).await.unwrap());

        // Set up other components
        let (alert_tx, _) = mpsc::channel(100);
        let alert_manager = Arc::new(AlertManager::new(alert_tx));
        let metrics_collector = Arc::new(MetricsCollector::new(30));
        let forensics_collector = Arc::new(ForensicsCollector::new(temp_dir.path().to_path_buf()));
        let websocket_server = Arc::new(WebSocketServer::new());
        
        let ember_config = crate::integration::EmberUnitConfig {
            base_url: "http://localhost:8080".to_string(),
            api_key: "test".to_string(),
            ws_url: "ws://localhost:8080/ws".to_string(),
        };
        let (threat_tx, _) = mpsc::channel(100);
        let ember_unit = Arc::new(EmberUnitIntegration::new(ember_config, threat_tx));

        let (report_tx, mut report_rx) = mpsc::channel(100);

        let reporting_system = ReportingSystem::new(
            alert_manager,
            metrics_collector,
            forensics_collector,
            memory_manager,
            websocket_server,
            ember_unit,
            report_tx,
        );

        // Test threat processing
        let threat = Threat {
            id: uuid::Uuid::new_v4(),
            severity: crate::ThreatSeverity::High,
            description: "Test threat".to_string(),
            timestamp: Utc::now(),
            source: "test".to_string(),
        };

        reporting_system.process_threat(&threat).await.unwrap();

        // Test incident processing
        let incident = IncidentReport {
            id: uuid::Uuid::new_v4(),
            threat: threat.clone(),
            status: crate::IncidentStatus::Analyzing,
            actions_taken: vec!["Containment initiated".to_string()],
            evidence: vec![],
            timestamp: Utc::now(),
        };

        reporting_system.process_incident(&incident).await.unwrap();

        // Test report generation
        let report = reporting_system.generate_comprehensive_report().await.unwrap();
        assert_eq!(report.threats.len(), 1);
        assert_eq!(report.incidents.len(), 1);
    }
}