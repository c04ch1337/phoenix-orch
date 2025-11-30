use metrics::{counter, gauge, histogram};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

/// Telemetry service for defensive monitoring
pub struct TelemetryService {
    metrics_state: Arc<RwLock<MetricsState>>,
    alert_thresholds: AlertThresholds,
}

impl TelemetryService {
    pub fn new(alert_thresholds: AlertThresholds) -> Self {
        Self {
            metrics_state: Arc::new(RwLock::new(MetricsState::new())),
            alert_thresholds,
        }
    }

    /// Record a defensive action
    pub async fn record_defensive_action(&self, action: &DefensiveActionMetric) {
        // Update metrics
        counter!("cipher_guard_defensive_actions_total", 1);
        histogram!("cipher_guard_action_duration_seconds", action.duration);

        let mut state = self.metrics_state.write().await;
        state.active_defenses += 1;
        state.action_history.push(action.clone());

        // Check thresholds
        if state.active_defenses >= self.alert_thresholds.max_concurrent_defenses {
            warn!(
                "High number of concurrent defensive actions: {}",
                state.active_defenses
            );
        }

        info!(
            "Defensive action recorded: {} (duration: {:.2}s)",
            action.action_type, action.duration
        );
    }

    /// Record a threat detection
    pub async fn record_threat_detection(&self, threat: &ThreatMetric) {
        counter!("cipher_guard_threats_detected_total", 1);
        gauge!("cipher_guard_threat_severity", threat.severity as f64);

        let mut state = self.metrics_state.write().await;
        state.active_threats += 1;
        state.threat_history.push(threat.clone());

        if threat.severity >= self.alert_thresholds.critical_severity {
            error!(
                "Critical threat detected: {} (severity: {})",
                threat.threat_type, threat.severity
            );
        }

        info!(
            "Threat detected: {} (severity: {})",
            threat.threat_type, threat.severity
        );
    }

    /// Record evidence collection
    pub async fn record_evidence_collection(&self, evidence: &EvidenceMetric) {
        counter!("cipher_guard_evidence_collected_total", 1);
        histogram!("cipher_guard_evidence_size_bytes", evidence.size as f64);

        let mut state = self.metrics_state.write().await;
        state.evidence_count += 1;
        state.total_evidence_size += evidence.size;
        state.evidence_history.push(evidence.clone());

        info!(
            "Evidence collected: {} (size: {} bytes)",
            evidence.evidence_type, evidence.size
        );
    }

    /// Record system health metrics
    pub async fn record_health_metrics(&self, health: &HealthMetrics) {
        gauge!("cipher_guard_cpu_usage", health.cpu_usage);
        gauge!("cipher_guard_memory_usage", health.memory_usage);
        gauge!("cipher_guard_network_latency", health.network_latency);

        let mut state = self.metrics_state.write().await;
        state.health_history.push(health.clone());

        if health.cpu_usage >= self.alert_thresholds.high_cpu_usage {
            warn!("High CPU usage detected: {:.2}%", health.cpu_usage);
        }

        if health.memory_usage >= self.alert_thresholds.high_memory_usage {
            warn!("High memory usage detected: {:.2}%", health.memory_usage);
        }
    }

    /// Get current metrics state
    pub async fn get_metrics_state(&self) -> MetricsState {
        self.metrics_state.read().await.clone()
    }

    /// Get health status
    pub async fn get_health_status(&self) -> HealthStatus {
        let state = self.metrics_state.read().await;
        let latest_health = state.health_history.last().cloned();

        HealthStatus {
            healthy: latest_health.as_ref().map_or(false, |h| {
                h.cpu_usage < self.alert_thresholds.high_cpu_usage
                    && h.memory_usage < self.alert_thresholds.high_memory_usage
            }),
            metrics: latest_health,
            active_defenses: state.active_defenses,
            active_threats: state.active_threats,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsState {
    pub active_defenses: u32,
    pub active_threats: u32,
    pub evidence_count: u64,
    pub total_evidence_size: u64,
    pub action_history: Vec<DefensiveActionMetric>,
    pub threat_history: Vec<ThreatMetric>,
    pub evidence_history: Vec<EvidenceMetric>,
    pub health_history: Vec<HealthMetrics>,
}

impl MetricsState {
    fn new() -> Self {
        Self {
            active_defenses: 0,
            active_threats: 0,
            evidence_count: 0,
            total_evidence_size: 0,
            action_history: Vec::new(),
            threat_history: Vec::new(),
            evidence_history: Vec::new(),
            health_history: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefensiveActionMetric {
    pub action_type: String,
    pub target: String,
    pub duration: f64,
    pub timestamp: i64,
    pub success: bool,
    pub resource_usage: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatMetric {
    pub threat_type: String,
    pub severity: u32,
    pub confidence: f64,
    pub timestamp: i64,
    pub indicators: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceMetric {
    pub evidence_type: String,
    pub size: u64,
    pub timestamp: i64,
    pub hash: String,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthMetrics {
    pub cpu_usage: f64,
    pub memory_usage: f64,
    pub network_latency: f64,
    pub timestamp: i64,
    pub subsystem_status: HashMap<String, bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertThresholds {
    pub max_concurrent_defenses: u32,
    pub critical_severity: u32,
    pub high_cpu_usage: f64,
    pub high_memory_usage: f64,
}

impl Default for AlertThresholds {
    fn default() -> Self {
        Self {
            max_concurrent_defenses: 10,
            critical_severity: 8,
            high_cpu_usage: 80.0,
            high_memory_usage: 85.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub healthy: bool,
    pub metrics: Option<HealthMetrics>,
    pub active_defenses: u32,
    pub active_threats: u32,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[tokio::test]
    async fn test_telemetry_service() {
        let service = TelemetryService::new(AlertThresholds::default());

        // Record defensive action
        let action = DefensiveActionMetric {
            action_type: "scan".to_string(),
            target: "network".to_string(),
            duration: 1.5,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64,
            success: true,
            resource_usage: HashMap::new(),
        };
        service.record_defensive_action(&action).await;

        // Record threat
        let threat = ThreatMetric {
            threat_type: "malware".to_string(),
            severity: 7,
            confidence: 0.85,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64,
            indicators: vec!["suspicious_traffic".to_string()],
        };
        service.record_threat_detection(&threat).await;

        // Verify metrics state
        let state = service.get_metrics_state().await;
        assert_eq!(state.active_defenses, 1);
        assert_eq!(state.active_threats, 1);
        assert_eq!(state.action_history.len(), 1);
        assert_eq!(state.threat_history.len(), 1);
    }
}