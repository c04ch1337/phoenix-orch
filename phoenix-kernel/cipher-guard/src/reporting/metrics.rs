use crate::{Threat, IncidentReport, Reporter};
use async_trait::async_trait;
use std::error::Error;
use std::collections::HashMap;
use tokio::sync::RwLock;
use std::sync::Arc;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityMetrics {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub threat_metrics: ThreatMetrics,
    pub response_metrics: ResponseMetrics,
    pub system_metrics: SystemMetrics,
    pub performance_metrics: PerformanceMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatMetrics {
    pub total_threats: u64,
    pub threats_by_severity: HashMap<String, u64>,
    pub threats_by_source: HashMap<String, u64>,
    pub detection_rate: f64,
    pub false_positive_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseMetrics {
    pub average_response_time: f64,
    pub containment_success_rate: f64,
    pub mitigation_success_rate: f64,
    pub recovery_success_rate: f64,
    pub incidents_by_status: HashMap<String, u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub uptime: f64,
    pub cpu_usage: f64,
    pub memory_usage: f64,
    pub network_throughput: f64,
    pub disk_usage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub detection_latency: f64,
    pub analysis_time: f64,
    pub response_latency: f64,
    pub resource_utilization: HashMap<String, f64>,
}

pub struct MetricsCollector {
    metrics: Arc<RwLock<SecurityMetrics>>,
    historical_metrics: Arc<RwLock<Vec<SecurityMetrics>>>,
    retention_period: chrono::Duration,
}

impl MetricsCollector {
    pub fn new(retention_days: i64) -> Self {
        Self {
            metrics: Arc::new(RwLock::new(SecurityMetrics {
                timestamp: chrono::Utc::now(),
                threat_metrics: ThreatMetrics {
                    total_threats: 0,
                    threats_by_severity: HashMap::new(),
                    threats_by_source: HashMap::new(),
                    detection_rate: 0.0,
                    false_positive_rate: 0.0,
                },
                response_metrics: ResponseMetrics {
                    average_response_time: 0.0,
                    containment_success_rate: 0.0,
                    mitigation_success_rate: 0.0,
                    recovery_success_rate: 0.0,
                    incidents_by_status: HashMap::new(),
                },
                system_metrics: SystemMetrics {
                    uptime: 0.0,
                    cpu_usage: 0.0,
                    memory_usage: 0.0,
                    network_throughput: 0.0,
                    disk_usage: 0.0,
                },
                performance_metrics: PerformanceMetrics {
                    detection_latency: 0.0,
                    analysis_time: 0.0,
                    response_latency: 0.0,
                    resource_utilization: HashMap::new(),
                },
            })),
            historical_metrics: Arc::new(RwLock::new(Vec::new())),
            retention_period: chrono::Duration::days(retention_days),
        }
    }

    async fn update_threat_metrics(&self, threat: &Threat) {
        let mut metrics = self.metrics.write().await;
        
        // Update total threats
        metrics.threat_metrics.total_threats += 1;

        // Update threats by severity
        *metrics.threat_metrics.threats_by_severity
            .entry(format!("{:?}", threat.severity))
            .or_insert(0) += 1;

        // Update threats by source
        *metrics.threat_metrics.threats_by_source
            .entry(threat.source.clone())
            .or_insert(0) += 1;

        metrics.timestamp = chrono::Utc::now();
    }

    async fn update_incident_metrics(&self, incident: &IncidentReport) {
        let mut metrics = self.metrics.write().await;
        
        // Update response metrics
        let response_time = incident.timestamp - incident.threat.timestamp;
        metrics.response_metrics.average_response_time = 
            (metrics.response_metrics.average_response_time + response_time.num_seconds() as f64) / 2.0;

        // Update incidents by status
        *metrics.response_metrics.incidents_by_status
            .entry(format!("{:?}", incident.status))
            .or_insert(0) += 1;

        metrics.timestamp = chrono::Utc::now();
    }

    async fn update_system_metrics(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        let mut metrics = self.metrics.write().await;
        
        // In a real implementation, these would be actual system measurements
        metrics.system_metrics = SystemMetrics {
            uptime: 100.0,
            cpu_usage: 45.0,
            memory_usage: 60.0,
            network_throughput: 75.0,
            disk_usage: 55.0,
        };

        metrics.timestamp = chrono::Utc::now();
        Ok(())
    }

    async fn store_historical_metrics(&self) {
        let current_metrics = self.metrics.read().await.clone();
        let mut historical = self.historical_metrics.write().await;
        
        // Add current metrics to history
        historical.push(current_metrics);

        // Remove old metrics beyond retention period
        let cutoff = chrono::Utc::now() - self.retention_period;
        historical.retain(|m| m.timestamp > cutoff);
    }

    pub async fn generate_metrics_report(&self) -> Result<String, Box<dyn Error + Send + Sync>> {
        let metrics = self.metrics.read().await;
        let report = serde_json::to_string_pretty(&*metrics)?;
        Ok(report)
    }

    pub async fn get_historical_metrics(&self, duration: chrono::Duration) -> Vec<SecurityMetrics> {
        let historical = self.historical_metrics.read().await;
        let cutoff = chrono::Utc::now() - duration;
        historical.iter()
            .filter(|m| m.timestamp > cutoff)
            .cloned()
            .collect()
    }
}

#[async_trait]
impl Reporter for MetricsCollector {
    async fn generate_report(&self, _incident: &IncidentReport) -> Result<String, Box<dyn Error + Send + Sync>> {
        self.generate_metrics_report().await
    }

    async fn alert(&self, threat: &Threat) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.update_threat_metrics(threat).await;
        Ok(())
    }

    async fn update_metrics(&self, incident: &IncidentReport) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.update_incident_metrics(incident).await;
        self.update_system_metrics().await?;
        self.store_historical_metrics().await;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ThreatSeverity;

    #[tokio::test]
    async fn test_metrics_collection() {
        let collector = MetricsCollector::new(30);

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

        collector.alert(&threat).await.unwrap();
        collector.update_metrics(&incident).await.unwrap();

        let metrics = collector.metrics.read().await;
        assert_eq!(metrics.threat_metrics.total_threats, 1);
        assert!(metrics.threat_metrics.threats_by_severity.contains_key("High"));
    }

    #[tokio::test]
    async fn test_historical_metrics() {
        let collector = MetricsCollector::new(30);
        
        // Update metrics a few times
        for _ in 0..3 {
            collector.update_system_metrics().await.unwrap();
            collector.store_historical_metrics().await;
        }

        let historical = collector.get_historical_metrics(chrono::Duration::hours(1)).await;
        assert_eq!(historical.len(), 3);
    }
}