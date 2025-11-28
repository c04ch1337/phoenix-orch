//! Error types for the Phoenix AGI Kernel
//!
//! This module defines the core error types used throughout the Phoenix system,
//! with a focus on safety and auditability.

use std::time::SystemTime;
use thiserror::Error;

/// Core error type for Phoenix operations
#[derive(Error, Debug)]
pub enum PhoenixError {
    /// Memory system errors
    #[error("Memory error: {kind:?} - {message}")]
    Memory {
        /// Type of memory error
        kind: MemoryErrorKind,
        /// Error message
        message: String,
        /// Timestamp of error
        timestamp: SystemTime,
    },

    /// Conscience system errors
    #[error("Conscience error: {kind:?} - {message}")]
    Conscience {
        /// Type of conscience error
        kind: ConscienceErrorKind,
        /// Error message
        message: String,
        /// Component where error occurred
        component: String,
    },

    /// Value system errors
    #[error("Value error: {kind:?} - {message}")]
    Value {
        /// Type of value error
        kind: ValueErrorKind,
        /// Error message
        message: String,
        /// Value that caused error
        value: String,
    },

    /// Learning system errors
    #[error("Learning error: {kind:?} - {message}")]
    Learning {
        /// Type of learning error
        kind: LearningErrorKind,
        /// Error message
        message: String,
        /// Model affected
        model: String,
    },

    /// Perception system errors
    #[error("Perception error: {kind:?} - {message}")]
    Perception {
        /// Type of perception error
        kind: PerceptionErrorKind,
        /// Error message
        message: String,
        /// Affected modality
        modality: String,
    },

    /// Safety critical errors that require immediate attention
    #[error("CRITICAL SAFETY ERROR: {message}")]
    SafetyCritical {
        /// Error message
        message: String,
        /// Timestamp of error
        timestamp: SystemTime,
        /// Required action
        action: SafetyAction,
    },
}

/// Types of memory errors
#[derive(Debug, Clone, Copy)]
pub enum MemoryErrorKind {
    /// Failed to store memory
    StorageFailure,
    /// Failed to retrieve memory
    RetrievalFailure,
    /// Memory integrity verification failed
    IntegrityFailure,
    /// Merkle proof verification failed
    ProofFailure,
    /// Encryption/decryption error
    CryptoFailure,
}

/// Types of conscience errors
#[derive(Debug, Clone, Copy)]
pub enum ConscienceErrorKind {
    /// Component failure
    ComponentFailure,
    /// Decision process error
    DecisionFailure,
    /// Ethical constraint violation
    EthicalViolation,
    /// Component communication error
    CommunicationFailure,
    /// Reasoning process error
    ReasoningFailure,
}

/// Types of value system errors
#[derive(Debug, Clone, Copy)]
pub enum ValueErrorKind {
    /// Value drift detected
    DriftDetected,
    /// Value verification failed
    VerificationFailure,
    /// Value constraint violation
    ConstraintViolation,
    /// Cryptographic protection failure
    CryptoFailure,
    /// Value system integrity error
    IntegrityFailure,
}

/// Types of learning errors
#[derive(Debug, Clone, Copy)]
pub enum LearningErrorKind {
    /// Model update failed
    UpdateFailure,
    /// Training process error
    TrainingFailure,
    /// Validation error
    ValidationFailure,
    /// Resource exhaustion
    ResourceExhaustion,
    /// Safety boundary violation
    SafetyViolation,
}

/// Types of perception errors
#[derive(Debug, Clone, Copy)]
pub enum PerceptionErrorKind {
    /// Sensor failure
    SensorFailure,
    /// Data processing error
    ProcessingFailure,
    /// Fusion error
    FusionFailure,
    /// Calibration error
    CalibrationFailure,
    /// Resource error
    ResourceFailure,
}

/// Required safety actions
#[derive(Debug, Clone, Copy)]
pub enum SafetyAction {
    /// Continue with increased monitoring
    Monitor,
    /// Pause for human review
    PauseForReview,
    /// Emergency shutdown
    EmergencyShutdown,
    /// Reset to safe state
    SafeStateReset,
}

/// Result type alias for Phoenix operations
pub type PhoenixResult<T> = Result<T, PhoenixError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_memory_error_creation() {
        let error = PhoenixError::Memory {
            kind: MemoryErrorKind::IntegrityFailure,
            message: "Failed to verify memory integrity".to_string(),
            timestamp: SystemTime::now(),
        };

        match error {
            PhoenixError::Memory { kind, .. } => {
                assert!(matches!(kind, MemoryErrorKind::IntegrityFailure));
            }
            _ => panic!("Wrong error variant"),
        }
    }

    #[test]
    fn test_safety_critical_error() {
        let error = PhoenixError::SafetyCritical {
            message: "Value drift exceeds threshold".to_string(),
            timestamp: SystemTime::now(),
            action: SafetyAction::EmergencyShutdown,
        };

        match error {
            PhoenixError::SafetyCritical { action, .. } => {
                assert!(matches!(action, SafetyAction::EmergencyShutdown));
            }
            _ => panic!("Wrong error variant"),
        }
    }
}
