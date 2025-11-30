mod ids;
mod hids;
mod anomaly;

pub use ids::NetworkIDS;
pub use hids::HostIDS;
pub use anomaly::AnomalyDetector;

use crate::{Threat, ThreatDetector};
use std::sync::Arc;
use tokio::sync::mpsc;

pub struct DetectionSystem {
    detectors: Vec<Arc<dyn ThreatDetector + Send + Sync>>,
    threat_tx: mpsc::Sender<Threat>,
}

impl DetectionSystem {
    pub fn new(threat_tx: mpsc::Sender<Threat>) -> Self {
        Self {
            detectors: Vec::new(),
            threat_tx,
        }
    }

    pub fn add_detector(&mut self, detector: Arc<dyn ThreatDetector + Send + Sync>) {
        self.detectors.push(detector);
    }

    pub async fn start(&self) {
        loop {
            for detector in &self.detectors {
                match detector.detect().await {
                    Ok(threats) => {
                        for threat in threats {
                            if let Err(e) = self.threat_tx.send(threat).await {
                                tracing::error!("Failed to send threat: {}", e);
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
    use crate::ThreatSeverity;

    #[tokio::test]
    async fn test_detection_system() {
        let (tx, mut rx) = mpsc::channel(100);
        let mut system = DetectionSystem::new(tx);

        // Create and add a network IDS
        let network_ids = NetworkIDS::new(1, 60);
        network_ids.add_rule(
            "MALICIOUS".to_string(),
            ThreatSeverity::High,
            "Test malicious pattern".to_string()
        ).await;
        system.add_detector(Arc::new(network_ids));

        // Create and add a host IDS
        let host_ids = HostIDS::new();
        system.add_detector(Arc::new(host_ids));

        // Create and add an anomaly detector
        let anomaly_detector = AnomalyDetector::new(2.0);
        system.add_detector(Arc::new(anomaly_detector));

        // Start the detection system in a separate task
        tokio::spawn(async move {
            system.start().await;
        });

        // Wait for potential threats
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    }
}