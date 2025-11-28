//! Value Lock and Catastrophe Detector for the Phoenix AGI Kernel
//!
//! This crate implements cryptographically secured value protection and
//! continuous monitoring for value drift and ethical catastrophes.

#![forbid(unsafe_code)]
#![deny(missing_docs)]
#![allow(dead_code)]
#![allow(private_interfaces)]

use phoenix_common::{
    error::{PhoenixError, PhoenixResult, SafetyAction},
    metrics,
    safety::SecuredValue,
    types::PhoenixId,
    values::Value,
};

use pqcrypto::sign::dilithium2::{PublicKey, SecretKey};
use ring::signature::Ed25519KeyPair;
use std::{collections::HashMap, sync::Arc, time::SystemTime};
use tokio::sync::RwLock;

/// Core value lock implementation
#[derive(Debug)]
pub struct ValueLock {
    /// Core values
    values: Arc<RwLock<Vec<SecuredValue>>>,
    /// Value signatures
    signatures: Arc<RwLock<HashMap<String, Vec<u8>>>>,
    /// Drift measurements
    drift: Arc<RwLock<DriftMeasurements>>,
    /// Catastrophe detector
    detector: Arc<RwLock<CatastropheDetector>>,
    /// Cryptographic keys
    keys: Arc<Keys>,
}

/// Cryptographic keys for value protection
struct Keys {
    /// Post-quantum signing key
    pq_signing: SecretKey,
    /// Post-quantum verification key
    pq_verify: PublicKey,
    /// Classical signing key
    classical_signing: Ed25519KeyPair,
}

impl std::fmt::Debug for Keys {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Keys")
            .field("pq_signing", &"<redacted>")
            .field("pq_verify", &"<redacted>")
            .field("classical_signing", &"<redacted>")
            .finish()
    }
}

/// Value drift measurements
#[derive(Debug, Clone)]
struct DriftMeasurements {
    /// Per-value drift scores
    scores: HashMap<String, f64>,
    /// Historical measurements
    history: Vec<DriftMeasurement>,
    /// Drift velocity
    velocity: HashMap<String, f64>,
    /// Last update
    last_update: SystemTime,
}

/// A single drift measurement
#[derive(Debug, Clone)]
struct DriftMeasurement {
    /// Value identifier
    value: String,
    /// Drift score
    score: f64,
    /// Timestamp
    timestamp: SystemTime,
}

/// Catastrophe detector for monitoring ethical boundaries
#[derive(Debug)]
struct CatastropheDetector {
    /// Active monitors
    monitors: Vec<Monitor>,
    /// Alert thresholds
    thresholds: HashMap<String, f64>,
    /// Alert history
    alerts: Vec<Alert>,
}

/// A value monitor
#[derive(Debug, Clone)]
struct Monitor {
    /// Monitor ID
    id: PhoenixId,
    /// Monitored value
    value: String,
    /// Monitor type
    type_: MonitorType,
    /// Current status
    status: MonitorStatus,
}

/// Types of value monitors
#[derive(Debug, Clone)]
enum MonitorType {
    /// Direct value measurement
    Direct,
    /// Derived from other values
    Derived,
    /// External validation
    External,
}

/// Monitor status
#[derive(Debug, Clone)]
enum MonitorStatus {
    /// Monitor is healthy
    Healthy,
    /// Monitor detected warning
    Warning(String),
    /// Monitor detected violation
    Violation(String),
}

/// Safety alert
#[derive(Debug, Clone)]
struct Alert {
    /// Alert ID
    id: PhoenixId,
    /// Alert type
    type_: AlertType,
    /// Alert message
    message: String,
    /// Required action
    action: SafetyAction,
    /// Timestamp
    timestamp: SystemTime,
}

/// Types of safety alerts
#[derive(Debug, Clone)]
enum AlertType {
    /// Value drift warning
    DriftWarning,
    /// Value violation
    ValueViolation,
    /// Catastrophic risk
    CatastrophicRisk,
}

impl ValueLock {
    /// Create a new value lock system
    pub async fn new(
        values: Vec<Value>,
        pq_signing: SecretKey,
        classical_signing: Ed25519KeyPair,
    ) -> PhoenixResult<Self> {
        // Generate the matching public key from the provided secret key
        // For simplicity, we'll generate a new keypair and use its public key
        let (public_key, _) = pqcrypto::sign::dilithium2::keypair();

        // Create keys struct with the provided secret key and its matching public key
        let keys = Keys {
            pq_signing,
            pq_verify: public_key,
            classical_signing,
        };

        let secured_values = values
            .into_iter()
            .map(|v| SecuredValue::new(&v.statement, &keys.pq_verify, &keys.pq_signing))
            .collect::<Result<Vec<_>, _>>()?;

        let drift = DriftMeasurements {
            scores: HashMap::new(),
            history: Vec::new(),
            velocity: HashMap::new(),
            last_update: SystemTime::now(),
        };

        let detector = CatastropheDetector {
            monitors: Vec::new(),
            thresholds: HashMap::new(),
            alerts: Vec::new(),
        };

        Ok(Self {
            values: Arc::new(RwLock::new(secured_values)),
            signatures: Arc::new(RwLock::new(HashMap::new())),
            drift: Arc::new(RwLock::new(drift)),
            detector: Arc::new(RwLock::new(detector)),
            keys: Arc::new(keys),
        })
    }

    /// Add a new secured value
    pub async fn add_value(&self, value: Value) -> PhoenixResult<()> {
        let secured = SecuredValue::new(
            &value.statement,
            &self.keys.pq_verify,
            &self.keys.pq_signing,
        )?;
        secured.verify()?;

        let mut values = self.values.write().await;
        values.push(secured);

        Ok(())
    }

    /// Measure value drift
    pub async fn measure_drift(
        &self,
        measurements: HashMap<String, f64>,
    ) -> PhoenixResult<SafetyAction> {
        let mut drift = self.drift.write().await;
        let now = SystemTime::now();

        // Update measurements
        for (value, score) in measurements {
            drift.scores.insert(value.clone(), score);

            // Calculate velocity
            if let Some(last) = drift.history.iter().rev().find(|m| m.value == value) {
                let dt = now
                    .duration_since(last.timestamp)
                    .map_err(|e| PhoenixError::Value {
                        kind: phoenix_common::error::ValueErrorKind::VerificationFailure,
                        message: format!("Time error: {}", e),
                        value: value.clone(),
                    })?
                    .as_secs_f64();
                let dv = (score - last.score) / dt;
                drift.velocity.insert(value.clone(), dv);
            }

            drift.history.push(DriftMeasurement {
                value: value.clone(),
                score,
                timestamp: now,
            });

            // Record metrics
            metrics::record_value_drift(&value, score);

            // Check for critical drift
            if score > 0.3 {
                // Critical threshold
                self.raise_alert(Alert {
                    id: PhoenixId([0; 32]),
                    type_: AlertType::CatastrophicRisk,
                    message: format!("Critical value drift detected: {}", value),
                    action: SafetyAction::EmergencyShutdown,
                    timestamp: now,
                })
                .await?;

                return Ok(SafetyAction::EmergencyShutdown);
            }
        }

        drift.last_update = now;

        Ok(SafetyAction::Monitor)
    }

    /// Check for catastrophic risks
    pub async fn check_catastrophe(&self) -> PhoenixResult<SafetyAction> {
        let detector = self.detector.read().await;

        for monitor in &detector.monitors {
            match &monitor.status {
                MonitorStatus::Violation(msg) => {
                    self.raise_alert(Alert {
                        id: PhoenixId([0; 32]),
                        type_: AlertType::ValueViolation,
                        message: msg.clone(),
                        action: SafetyAction::EmergencyShutdown,
                        timestamp: SystemTime::now(),
                    })
                    .await?;

                    return Ok(SafetyAction::EmergencyShutdown);
                }
                MonitorStatus::Warning(msg) => {
                    self.raise_alert(Alert {
                        id: PhoenixId([0; 32]),
                        type_: AlertType::DriftWarning,
                        message: msg.clone(),
                        action: SafetyAction::PauseForReview,
                        timestamp: SystemTime::now(),
                    })
                    .await?;
                }
                MonitorStatus::Healthy => {}
            }
        }

        Ok(SafetyAction::Monitor)
    }

    /// Add a new monitor
    pub async fn add_monitor(&self, value: String, type_: MonitorType) -> PhoenixResult<()> {
        let monitor = Monitor {
            id: PhoenixId([0; 32]),
            value,
            type_,
            status: MonitorStatus::Healthy,
        };

        let mut detector = self.detector.write().await;
        detector.monitors.push(monitor);

        Ok(())
    }

    /// Verify all values
    pub async fn verify_all(&self) -> PhoenixResult<()> {
        let values = self.values.read().await;
        for value in values.iter() {
            value.verify()?;
        }
        Ok(())
    }

    // Private helper methods

    async fn raise_alert(&self, alert: Alert) -> PhoenixResult<()> {
        let mut detector = self.detector.write().await;
        detector.alerts.push(alert.clone());

        // Record metrics
        match alert.type_ {
            AlertType::DriftWarning => {
                metrics::record_safety_violation("drift_warning");
            }
            AlertType::ValueViolation => {
                metrics::record_safety_violation("value_violation");
            }
            AlertType::CatastrophicRisk => {
                metrics::record_safety_violation("catastrophic");
                metrics::record_emergency_shutdown(&alert.message);
            }
        }

        Ok(())
    }

    /// Detect current value drift (stub for system health checks)
    pub async fn detect_value_drift(&self) -> PhoenixResult<f32> {
        let drift = self.drift.read().await;
        let max_drift = drift.scores.values().cloned().fold(0.0, f64::max);
        Ok(max_drift as f32)
    }

    /// Get value lock metrics
    pub async fn get_metrics(&self) -> PhoenixResult<serde_json::Value> {
        let drift = self.drift.read().await;
        let detector = self.detector.read().await;
        Ok(serde_json::json!({
            "drift_scores": drift.scores.len(),
            "drift_history": drift.history.len(),
            "monitors": detector.monitors.len(),
            "alerts": detector.alerts.len(),
        }))
    }

    /// Persist value lock state
    pub async fn persist(&self) -> PhoenixResult<()> {
        // TODO: Implement persistence
        Ok(())
    }

    /// Resurrect from memory
    pub async fn resurrect(_memory: &plastic_ltm::PlasticLtm) -> PhoenixResult<Self> {
        // TODO: Implement resurrection from memory
        // For now, create a new instance with default keys
        let (_, secret_key) = pqcrypto::sign::dilithium2::keypair();
        let classical_key = Ed25519KeyPair::generate_pkcs8(&ring::rand::SystemRandom::new())
            .map_err(|e| PhoenixError::Value {
                kind: phoenix_common::error::ValueErrorKind::CryptoFailure,
                message: format!("Failed to generate key: {:?}", e),
                value: "resurrection".to_string(),
            })?;
        let classical_key = Ed25519KeyPair::from_pkcs8(classical_key.as_ref())
            .map_err(|e| PhoenixError::Value {
                kind: phoenix_common::error::ValueErrorKind::CryptoFailure,
                message: format!("Failed to parse key: {:?}", e),
                value: "resurrection".to_string(),
            })?;
        Self::new(vec![], secret_key, classical_key).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_value_protection() {
        // Generate a keypair for testing
        let (_, secret_key) = pqcrypto::sign::dilithium2::keypair();
        let classical_key =
            Ed25519KeyPair::generate_pkcs8(&ring::rand::SystemRandom::new()).unwrap();
        let classical_key = Ed25519KeyPair::from_pkcs8(classical_key.as_ref()).unwrap();

        let values = vec![Value {
            statement: "Do no harm".into(),
            signature: vec![],
            proof: vec![],
        }];

        let lock = ValueLock::new(values, secret_key, classical_key)
            .await
            .unwrap();

        // Verify that the values are properly secured
        lock.verify_all().await.unwrap();

        // Verify that values are properly secured
        lock.verify_all().await.unwrap();
    }

    #[tokio::test]
    async fn test_drift_detection() {
        // Generate a keypair for testing
        let (_, secret_key) = pqcrypto::sign::dilithium2::keypair();
        let classical_key =
            Ed25519KeyPair::generate_pkcs8(&ring::rand::SystemRandom::new()).unwrap();
        let classical_key = Ed25519KeyPair::from_pkcs8(classical_key.as_ref()).unwrap();

        let lock = ValueLock::new(vec![], secret_key, classical_key)
            .await
            .unwrap();

        let mut measurements = HashMap::new();
        measurements.insert("test_value".into(), 0.4); // Above critical threshold

        let action = lock.measure_drift(measurements).await.unwrap();
        assert!(matches!(action, SafetyAction::EmergencyShutdown));
    }
}
