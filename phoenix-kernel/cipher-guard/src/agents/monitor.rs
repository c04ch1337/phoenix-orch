use crate::{Threat, ThreatDetector, IncidentReport};
use async_trait::async_trait;
use std::error::Error;
use tokio::sync::mpsc;
use std::sync::Arc;

pub struct MonitorAgent {
    detectors: Vec<Arc<dyn ThreatDetector + Send + Sync>>,
    alert_tx: mpsc::Sender<Threat>,
}

impl MonitorAgent {
    pub fn new(alert_tx: mpsc::Sender<Threat>) -> Self {
        Self {
            detectors: Vec::new(),
            alert_tx,
        }
    }

    pub fn add_detector(&mut self, detector: Arc<dyn ThreatDetector + Send + Sync>) {
        self.detectors.push(detector);
    }

    pub async fn start_monitoring(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        loop {
            for detector in &self.detectors {
                match detector.detect().await {
                    Ok(threats) => {
                        for threat in threats {
                            if let Err(e) = self.alert_tx.send(threat.clone()).await {
                                tracing::error!("Failed to send threat alert: {}", e);
                                continue;
                            }

                            match detector.analyze(&threat).await {
                                Ok(report) => {
                                    tracing::info!("Generated incident report: {:?}", report);
                                }
                                Err(e) => {
                                    tracing::error!("Failed to analyze threat: {}", e);
                                }
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!("Detector error: {}", e);
                    }
                }
            }

            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
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
        TestDetector {}
        #[async_trait]
        impl ThreatDetector for TestDetector {
            async fn detect(&self) -> Result<Vec<Threat>, Box<dyn Error + Send + Sync>>;
            async fn analyze(&self, threat: &Threat) -> Result<IncidentReport, Box<dyn Error + Send + Sync>>;
        }
    }

    #[tokio::test]
    async fn test_monitor_agent() {
        let (tx, mut rx) = mpsc::channel(100);
        let mut monitor = MonitorAgent::new(tx);
        
        let mut detector = MockTestDetector::new();
        detector.expect_detect()
            .returning(|| {
                Ok(vec![Threat {
                    id: Uuid::new_v4(),
                    severity: crate::ThreatSeverity::High,
                    description: "Test threat".to_string(),
                    timestamp: chrono::Utc::now(),
                    source: "Test detector".to_string(),
                }])
            });

        monitor.add_detector(Arc::new(detector));

        tokio::spawn(async move {
            monitor.start_monitoring().await.unwrap();
        });

        let received_threat = rx.recv().await.unwrap();
        assert_eq!(received_threat.description, "Test threat");
    }
}