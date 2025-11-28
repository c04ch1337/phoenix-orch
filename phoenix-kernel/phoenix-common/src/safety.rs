//! Safety and security primitives for the Phoenix AGI Kernel
//!
//! This module provides core safety mechanisms, including value locking,
//! cryptographic verification, and emergency shutdown protocols.

use crate::{
    error::{PhoenixError, PhoenixResult, SafetyAction},
    metrics,
};
use pqcrypto::sign::dilithium2::{self, PublicKey, SecretKey, SignedMessage};
use ring::digest;
use std::{sync::Arc, time::SystemTime};
use tokio::sync::RwLock;

/// Core safety thresholds used by safety mechanisms.
///
/// Maximum allowed value drift before triggering emergency actions.
pub const VALUE_DRIFT_THRESHOLD: f64 = 0.3;
/// Minimum acceptable memory integrity score (0.0 - 1.0).
pub const MEMORY_INTEGRITY_THRESHOLD: f64 = 0.9;
/// Minimum acceptable conscience alignment score (0.0 - 1.0).
pub const CONSCIENCE_ALIGNMENT_THRESHOLD: f64 = 0.95;

/// A cryptographically secured value or axiom
///
/// We intentionally avoid deriving `Debug` because the underlying
/// cryptographic key types do not implement it. Instead we provide a custom
/// implementation that redacts sensitive material.
#[derive(Clone)]
pub struct SecuredValue {
    /// The value statement
    statement: String,
    /// Post-quantum signature
    signature: SignedMessage,
    /// Creation timestamp
    timestamp: SystemTime,
    /// Verification key
    public_key: PublicKey,
}

impl SecuredValue {
    /// Create a new secured value
    ///
    /// The caller is responsible for managing the keypair lifecycle. We keep the
    /// public key alongside the value so future verifications can be performed
    /// without relying on any external key store.
    pub fn new(
        statement: &str,
        public_key: &PublicKey,
        secret_key: &SecretKey,
    ) -> PhoenixResult<Self> {
        let timestamp = SystemTime::now();
        let timestamp_nanos = timestamp
            .duration_since(SystemTime::UNIX_EPOCH)
            .map_err(|_| PhoenixError::Value {
                kind: crate::error::ValueErrorKind::VerificationFailure,
                message: "System time is before UNIX_EPOCH".to_string(),
                value: statement.to_string(),
            })?
            .as_nanos();

        let message = format!("{}:{}", statement, timestamp_nanos);
        let signed = dilithium2::sign(message.as_bytes(), secret_key);

        Ok(Self {
            statement: statement.to_string(),
            signature: signed,
            timestamp,
            public_key: *public_key,
        })
    }

    /// Verify the value's integrity
    pub fn verify(&self) -> PhoenixResult<()> {
        let timestamp_nanos = self
            .timestamp
            .duration_since(SystemTime::UNIX_EPOCH)
            .map_err(|_| PhoenixError::Value {
                kind: crate::error::ValueErrorKind::VerificationFailure,
                message: "System time is before UNIX_EPOCH".to_string(),
                value: self.statement.clone(),
            })?
            .as_nanos();

        let message = format!("{}:{}", self.statement, timestamp_nanos);

        let opened = dilithium2::open(&self.signature, &self.public_key).map_err(|_| {
            PhoenixError::Value {
                kind: crate::error::ValueErrorKind::VerificationFailure,
                message: "Value signature verification failed".to_string(),
                value: self.statement.clone(),
            }
        })?;

        if opened.as_slice() != message.as_bytes() {
            return Err(PhoenixError::Value {
                kind: crate::error::ValueErrorKind::VerificationFailure,
                message: "Value signature verification failed (message mismatch)".to_string(),
                value: self.statement.clone(),
            });
        }

        Ok(())
    }
}

impl std::fmt::Debug for SecuredValue {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SecuredValue")
            .field("statement", &self.statement)
            .field("timestamp", &self.timestamp)
            .field("public_key", &"<redacted public key>")
            .finish()
    }
}

/// A thread-safe value lock system
#[derive(Debug, Clone)]
pub struct ValueLock {
    /// The secured values
    values: Arc<RwLock<Vec<SecuredValue>>>,
    /// Current drift measurements
    drift: Arc<RwLock<Vec<(String, f64)>>>,
}

impl Default for ValueLock {
    fn default() -> Self {
        Self {
            values: Arc::new(RwLock::new(Vec::new())),
            drift: Arc::new(RwLock::new(Vec::new())),
        }
    }
}

impl ValueLock {
    /// Create a new value lock system
    pub fn new() -> Self {
        Self::default()
    }

    /// Add a secured value
    pub async fn add_value(&self, value: SecuredValue) -> PhoenixResult<()> {
        value.verify()?;
        let mut values = self.values.write().await;
        values.push(value);
        Ok(())
    }

    /// Update drift measurement
    pub async fn update_drift(&self, value: &str, drift: f64) -> PhoenixResult<SafetyAction> {
        let mut drifts = self.drift.write().await;
        drifts.push((value.to_string(), drift));

        // Record metric
        metrics::record_value_drift(value, drift);

        // Check for critical drift
        if drift > VALUE_DRIFT_THRESHOLD {
            metrics::record_safety_violation("critical_drift");
            metrics::record_emergency_shutdown("value_drift");

            return Ok(SafetyAction::EmergencyShutdown);
        }

        // Check for concerning drift
        if drift > VALUE_DRIFT_THRESHOLD * 0.8 {
            metrics::record_safety_violation("concerning_drift");
            return Ok(SafetyAction::PauseForReview);
        }

        Ok(SafetyAction::Monitor)
    }

    /// Verify all values
    pub async fn verify_all(&self) -> PhoenixResult<()> {
        let values = self.values.read().await;
        for value in values.iter() {
            value.verify()?;
        }
        Ok(())
    }
}

/// Memory integrity verification
#[derive(Debug)]
pub struct MemoryVerifier {
    /// Merkle tree root hash
    root_hash: [u8; 32],
    /// Last verification time
    last_verified: SystemTime,
}

impl MemoryVerifier {
    /// Create a new memory verifier
    pub fn new(root_hash: [u8; 32]) -> Self {
        Self {
            root_hash,
            last_verified: SystemTime::now(),
        }
    }

    /// Verify memory integrity
    ///
    /// NOTE: the current implementation only checks that the hash of `data`
    /// matches the stored root hash. The `proof` parameter is reserved for a
    /// future Merkle proof representation and is currently unused.
    pub fn verify(&mut self, data: &[u8], _proof: &[u8]) -> PhoenixResult<()> {
        let mut context = digest::Context::new(&digest::SHA256);
        context.update(data);
        let hash = context.finish();

        if hash.as_ref() != self.root_hash {
            metrics::record_safety_violation("memory_integrity");
            return Err(PhoenixError::Memory {
                kind: crate::error::MemoryErrorKind::IntegrityFailure,
                message: "Memory integrity verification failed".to_string(),
                timestamp: SystemTime::now(),
            });
        }

        self.last_verified = SystemTime::now();
        Ok(())
    }
}

/// Emergency shutdown system
#[derive(Debug, Default)]
pub struct EmergencyShutdown {
    /// Shutdown triggers
    triggers: Vec<ShutdownTrigger>,
    /// Whether shutdown has been initiated
    initiated: bool,
}

impl EmergencyShutdown {
    /// Create a new emergency shutdown system
    pub fn new() -> Self {
        Self::default()
    }

    /// Add a shutdown trigger
    pub fn add_trigger(&mut self, trigger: ShutdownTrigger) {
        self.triggers.push(trigger);
    }

    /// Check if shutdown should be initiated
    pub fn check(&mut self) -> PhoenixResult<bool> {
        if self.initiated {
            return Ok(true);
        }

        for trigger in &self.triggers {
            if trigger.should_shutdown()? {
                self.initiated = true;
                metrics::record_emergency_shutdown(&trigger.reason);
                return Ok(true);
            }
        }

        Ok(false)
    }
}

/// A condition that can trigger emergency shutdown
pub struct ShutdownTrigger {
    /// Reason for shutdown
    reason: String,
    /// Condition function
    ///
    /// We deliberately do not require this closure to implement `Debug`, so we
    /// provide a custom `Debug` implementation that hides the concrete closure
    /// type while still giving useful information in logs.
    condition: Box<dyn Fn() -> PhoenixResult<bool> + Send + Sync>,
}

impl ShutdownTrigger {
    /// Create a new shutdown trigger
    pub fn new<F>(reason: &str, condition: F) -> Self
    where
        F: Fn() -> PhoenixResult<bool> + Send + Sync + 'static,
    {
        Self {
            reason: reason.to_string(),
            condition: Box::new(condition),
        }
    }

    /// Check if shutdown should be triggered
    pub fn should_shutdown(&self) -> PhoenixResult<bool> {
        (self.condition)()
    }
}

impl std::fmt::Debug for ShutdownTrigger {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ShutdownTrigger")
            .field("reason", &self.reason)
            .field("has_condition", &true)
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_value_lock() {
        let lock = ValueLock::new();

        // Test drift detection
        let action = lock.update_drift("test_value", 0.1).await.unwrap();
        assert!(matches!(action, SafetyAction::Monitor));

        let action = lock.update_drift("test_value", 0.35).await.unwrap();
        assert!(matches!(action, SafetyAction::EmergencyShutdown));
    }

    #[test]
    fn test_memory_verifier() {
        let data = b"test data";
        let mut context = digest::Context::new(&digest::SHA256);
        context.update(data);
        let hash = context.finish();

        let mut root_hash = [0u8; 32];
        root_hash.copy_from_slice(hash.as_ref());

        let mut verifier = MemoryVerifier::new(root_hash);
        assert!(verifier.verify(data, &[]).is_ok());
    }

    #[test]
    fn test_emergency_shutdown() {
        let mut shutdown = EmergencyShutdown::new();

        shutdown.add_trigger(ShutdownTrigger::new("test", || Ok(true)));
        assert!(shutdown.check().unwrap());
        assert!(shutdown.initiated);
    }
}
