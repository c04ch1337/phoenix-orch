use crate::{Threat, ThreatDetector, IncidentReport, ThreatSeverity};
use async_trait::async_trait;
use std::error::Error;
use std::collections::{HashMap, VecDeque};
use tokio::sync::RwLock;
use std::sync::Arc;

pub struct AnomalyDetector {
    behavior_profiles: Arc<RwLock<HashMap<String, BehaviorProfile>>>,
    alert_threshold: f64,
    learning_mode: bool,
}

#[derive(Debug, Clone)]
struct BehaviorProfile {
    entity_type: String,
    metrics: HashMap<String, MetricProfile>,
    patterns: VecDeque<Pattern>,
    max_patterns: usize,
}

#[derive(Debug, Clone)]
struct MetricProfile {
    name: String,
    mean: f64,
    std_dev: f64,
    min: f64,
    max: f64,
    samples: VecDeque<f64>,
    window_size: usize,
}

#[derive(Debug, Clone)]
struct Pattern {
    timestamp: chrono::DateTime<chrono::Utc>,
    sequence: Vec<String>,
    frequency: u32,
}

impl AnomalyDetector {
    pub fn new(alert_threshold: f64) -> Self {
        Self {
            behavior_profiles: Arc::new(RwLock::new(HashMap::new())),
            alert_threshold,
            learning_mode: true,
        }
    }

    pub async fn create_profile(&self, entity: String, entity_type: String) {
        let mut profiles = self.behavior_profiles.write().await;
        profiles.insert(entity, BehaviorProfile {
            entity_type,
            metrics: HashMap::new(),
            patterns: VecDeque::with_capacity(1000),
            max_patterns: 1000,
        });
    }

    pub async fn add_metric(&self, entity: &str, metric_name: &str, window_size: usize) {
        let mut profiles = self.behavior_profiles.write().await;
        if let Some(profile) = profiles.get_mut(entity) {
            profile.metrics.insert(metric_name.to_string(), MetricProfile {
                name: metric_name.to_string(),
                mean: 0.0,
                std_dev: 0.0,
                min: f64::MAX,
                max: f64::MIN,
                samples: VecDeque::with_capacity(window_size),
                window_size,
            });
        }
    }

    pub async fn update_metric(&self, entity: &str, metric_name: &str, value: f64) -> Option<Threat> {
        let mut profiles = self.behavior_profiles.write().await;
        if let Some(profile) = profiles.get_mut(entity) {
            if let Some(metric) = profile.metrics.get_mut(metric_name) {
                // Update metric statistics
                metric.samples.push_back(value);
                if metric.samples.len() > metric.window_size {
                    metric.samples.pop_front();
                }

                // Update min/max
                metric.min = metric.min.min(value);
                metric.max = metric.max.max(value);

                // Calculate new mean and standard deviation
                let n = metric.samples.len() as f64;
                let sum: f64 = metric.samples.iter().sum();
                let mean = sum / n;
                
                let variance = metric.samples.iter()
                    .map(|x| (x - mean).powi(2))
                    .sum::<f64>() / n;
                let std_dev = variance.sqrt();

                metric.mean = mean;
                metric.std_dev = std_dev;

                // Check for anomalies if not in learning mode
                if !self.learning_mode {
                    let z_score = (value - mean).abs() / std_dev;
                    if z_score > self.alert_threshold {
                        return Some(Threat {
                            id: uuid::Uuid::new_v4(),
                            severity: if z_score > self.alert_threshold * 2.0 {
                                ThreatSeverity::High
                            } else {
                                ThreatSeverity::Medium
                            },
                            description: format!(
                                "Anomaly detected for {}/{}: value {} (z-score: {:.2})",
                                entity, metric_name, value, z_score
                            ),
                            timestamp: chrono::Utc::now(),
                            source: "AnomalyDetector".to_string(),
                        });
                    }
                }
            }
        }
        None
    }

    pub async fn add_pattern(&self, entity: &str, sequence: Vec<String>) {
        let mut profiles = self.behavior_profiles.write().await;
        if let Some(profile) = profiles.get_mut(entity) {
            // Look for existing pattern
            let mut found = false;
            for pattern in profile.patterns.iter_mut() {
                if pattern.sequence == sequence {
                    pattern.frequency += 1;
                    found = true;
                    break;
                }
            }

            // Add new pattern if not found
            if !found {
                if profile.patterns.len() >= profile.max_patterns {
                    profile.patterns.pop_front();
                }
                profile.patterns.push_back(Pattern {
                    timestamp: chrono::Utc::now(),
                    sequence,
                    frequency: 1,
                });
            }
        }
    }

    pub fn enable_learning_mode(&mut self) {
        self.learning_mode = true;
    }

    pub fn disable_learning_mode(&mut self) {
        self.learning_mode = false;
    }
}

#[async_trait]
impl ThreatDetector for AnomalyDetector {
    async fn detect(&self) -> Result<Vec<Threat>, Box<dyn Error + Send + Sync>> {
        // In a real implementation, this would continuously analyze all metrics
        // For now, we return an empty vec as threats are generated by update_metric
        Ok(Vec::new())
    }

    async fn analyze(&self, threat: &Threat) -> Result<IncidentReport, Box<dyn Error + Send + Sync>> {
        Ok(IncidentReport {
            id: uuid::Uuid::new_v4(),
            threat: threat.clone(),
            status: crate::IncidentStatus::Analyzing,
            actions_taken: vec![
                "Anomaly analysis initiated".to_string(),
                "Behavioral pattern correlation in progress".to_string(),
            ],
            evidence: vec![],
            timestamp: chrono::Utc::now(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_anomaly_detection() {
        let mut detector = AnomalyDetector::new(2.0); // 2 standard deviations
        
        // Create profile for testing
        detector.create_profile(
            "test_service".to_string(),
            "service".to_string()
        ).await;
        
        detector.add_metric("test_service", "cpu_usage", 10).await;

        // Add normal values
        for i in 0..10 {
            let value = 50.0 + (i as f64 * 0.1); // Normal values around 50
            assert!(detector.update_metric("test_service", "cpu_usage", value).await.is_none());
        }

        // Disable learning mode
        detector.disable_learning_mode();

        // Test anomaly detection
        let threat = detector.update_metric("test_service", "cpu_usage", 90.0).await;
        assert!(threat.is_some());
        let threat = threat.unwrap();
        assert_eq!(threat.severity, ThreatSeverity::High);
    }

    #[tokio::test]
    async fn test_pattern_learning() {
        let detector = AnomalyDetector::new(2.0);
        
        detector.create_profile(
            "test_user".to_string(),
            "user".to_string()
        ).await;

        // Add some behavior patterns
        detector.add_pattern("test_user", vec![
            "login".to_string(),
            "read_file".to_string(),
            "logout".to_string(),
        ]).await;

        let profiles = detector.behavior_profiles.read().await;
        let profile = profiles.get("test_user").unwrap();
        assert_eq!(profile.patterns.len(), 1);
        assert_eq!(profile.patterns[0].frequency, 1);
    }
}