//! Error types for the Phoenix AGI Kernel core daemon
//!
//! This module defines the core error types and error handling functionality
//! for the Phoenix system orchestration layer.

use std::time::SystemTime;
use thiserror::Error;

// Re-export Error for external use
pub use anyhow::Error;

/// Core error type for Phoenix operations
#[derive(Error, Debug)]
pub enum CoreError {
    /// Component initialization error
    #[error("Failed to initialize component {component}: {message}")]
    InitializationError {
        /// Component name
        component: String,
        /// Error message
        message: String,
        /// Error timestamp
        timestamp: SystemTime,
    },

    /// Component startup error
    #[error("Failed to start component {component}: {message}")]
    StartupError {
        /// Component name
        component: String,
        /// Error message
        message: String,
        /// Error timestamp
        timestamp: SystemTime,
    },

    /// Configuration error
    #[error("Configuration error: {message}")]
    ConfigError {
        /// Error message
        message: String,
        /// Configuration section
        section: Option<String>,
    },

    /// Memory system error
    #[error("Memory system error: {message}")]
    MemoryError {
        /// Error message
        message: String,
        /// Operation that failed
        operation: String,
        /// Error timestamp
        timestamp: SystemTime,
    },

    /// World model error
    #[error("World model error: {message}")]
    WorldModelError {
        /// Error message
        message: String,
        /// Model component
        component: String,
        /// Error timestamp
        timestamp: SystemTime,
    },

    /// Conscience system error
    #[error("Conscience error: {message}")]
    ConscienceError {
        /// Error message
        message: String,
        /// Affected component
        component: String,
        /// Error timestamp
        timestamp: SystemTime,
    },

    /// Value system error
    #[error("Value system error: {message}")]
    ValueError {
        /// Error message
        message: String,
        /// Affected value
        value: String,
        /// Error timestamp
        timestamp: SystemTime,
    },

    /// Learning system error
    #[error("Learning error: {message}")]
    LearningError {
        /// Error message
        message: String,
        /// Affected model
        model: String,
        /// Error timestamp
        timestamp: SystemTime,
    },

    /// Perception system error
    #[error("Perception error: {message}")]
    PerceptionError {
        /// Error message
        message: String,
        /// Affected modality
        modality: String,
        /// Error timestamp
        timestamp: SystemTime,
    },

    /// Resource allocation error
    #[error("Resource error: {message}")]
    ResourceError {
        /// Error message
        message: String,
        /// Resource type
        resource: String,
        /// Error timestamp
        timestamp: SystemTime,
    },

    /// System state error
    #[error("System state error: {message}")]
    StateError {
        /// Error message
        message: String,
        /// State operation
        operation: String,
        /// Error timestamp
        timestamp: SystemTime,
    },

    /// Safety critical error
    #[error("CRITICAL SAFETY ERROR: {message}")]
    SafetyCritical {
        /// Error message
        message: String,
        /// Error timestamp
        timestamp: SystemTime,
        /// Required action
        action: String,
    },

    /// External system error
    #[error("External system error: {message}")]
    ExternalError {
        /// Error message
        message: String,
        /// System name
        system: String,
        /// Error timestamp
        timestamp: SystemTime,
    },

    /// I/O error
    #[error("I/O error: {0}")]
    IoError(#[from] std::io::Error),

    /// Serialization error
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),

    /// Configuration parsing error
    #[error("Config parsing error: {0}")]
    TomlError(#[from] toml::de::Error),

    /// Metrics error
    #[error("Metrics error: {0}")]
    MetricsError(#[from] prometheus::Error),
}

/// Result type alias for Phoenix core operations
pub type CoreResult<T> = Result<T, CoreError>;

impl CoreError {
    /// Create a new initialization error
    pub fn init_error(component: impl Into<String>, message: impl Into<String>) -> Self {
        Self::InitializationError {
            component: component.into(),
            message: message.into(),
            timestamp: SystemTime::now(),
        }
    }

    /// Create a new startup error
    pub fn startup_error(component: impl Into<String>, message: impl Into<String>) -> Self {
        Self::StartupError {
            component: component.into(),
            message: message.into(),
            timestamp: SystemTime::now(),
        }
    }

    /// Create a new config error
    pub fn config_error(message: impl Into<String>, section: Option<String>) -> Self {
        Self::ConfigError {
            message: message.into(),
            section,
        }
    }

    /// Create a new memory error
    pub fn memory_error(message: impl Into<String>, operation: impl Into<String>) -> Self {
        Self::MemoryError {
            message: message.into(),
            operation: operation.into(),
            timestamp: SystemTime::now(),
        }
    }

    /// Create a new safety critical error
    pub fn safety_critical(message: impl Into<String>, action: impl Into<String>) -> Self {
        Self::SafetyCritical {
            message: message.into(),
            timestamp: SystemTime::now(),
            action: action.into(),
        }
    }

    /// Check if error is safety critical
    pub fn is_safety_critical(&self) -> bool {
        matches!(self, Self::SafetyCritical { .. })
    }

    /// Get error timestamp
    pub fn timestamp(&self) -> Option<SystemTime> {
        match self {
            Self::InitializationError { timestamp, .. } => Some(*timestamp),
            Self::StartupError { timestamp, .. } => Some(*timestamp),
            Self::MemoryError { timestamp, .. } => Some(*timestamp),
            Self::WorldModelError { timestamp, .. } => Some(*timestamp),
            Self::ConscienceError { timestamp, .. } => Some(*timestamp),
            Self::ValueError { timestamp, .. } => Some(*timestamp),
            Self::LearningError { timestamp, .. } => Some(*timestamp),
            Self::PerceptionError { timestamp, .. } => Some(*timestamp),
            Self::ResourceError { timestamp, .. } => Some(*timestamp),
            Self::StateError { timestamp, .. } => Some(*timestamp),
            Self::SafetyCritical { timestamp, .. } => Some(*timestamp),
            Self::ExternalError { timestamp, .. } => Some(*timestamp),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_creation() {
        let error = CoreError::init_error("test", "failed to init");
        assert!(matches!(error, CoreError::InitializationError { .. }));

        let error = CoreError::safety_critical("critical error", "shutdown");
        assert!(error.is_safety_critical());
        assert!(error.timestamp().is_some());
    }

    #[test]
    fn test_error_conversion() {
        let io_error = std::io::Error::new(std::io::ErrorKind::Other, "io error");
        let error: CoreError = io_error.into();
        assert!(matches!(error, CoreError::IoError(..)));

        let json_error =
            serde_json::Error::syntax(serde_json::error::ErrorCode::ExpectedSomeValue, 0, 0);
        let error: CoreError = json_error.into();
        assert!(matches!(error, CoreError::SerializationError(..)));
    }
}
