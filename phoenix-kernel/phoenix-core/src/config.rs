//! Configuration management for the Phoenix AGI Kernel core daemon
//!
//! This module handles loading and validating system configuration, including
//! component settings, resource limits, and safety parameters.

use crate::error::{CoreError, CoreResult};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::Path};

/// Core system configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// System-wide settings
    pub system: SystemConfig,
    /// Memory system configuration
    pub memory: MemoryConfig,
    /// World model configuration
    pub world_model: WorldModelConfig,
    /// Conscience system configuration
    pub conscience: ConscienceConfig,
    /// Value system configuration
    pub values: ValueConfig,
    /// Learning system configuration
    pub learning: LearningConfig,
    /// Perception system configuration
    pub perception: PerceptionConfig,
    /// Safety parameters
    pub safety: SafetyConfig,
    /// Resource limits
    pub resources: ResourceConfig,
    /// Component-specific settings
    pub components: HashMap<String, toml::Value>,
}

/// System-wide configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemConfig {
    /// System name
    pub name: String,
    /// System version
    pub version: String,
    /// Log level
    pub log_level: String,
    /// Data directory
    pub data_dir: String,
    /// Config directory
    pub config_dir: String,
    /// Plugin directory
    pub plugin_dir: String,
    /// Backup locations
    pub backup_locations: Vec<String>,
}

/// Memory system configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryConfig {
    /// Storage path
    pub storage_path: String,
    /// Mirror locations
    pub mirror_locations: Vec<String>,
    /// Merkle tree depth
    pub merkle_depth: usize,
    /// Encryption parameters
    pub encryption: EncryptionConfig,
    /// Consolidation interval
    pub consolidation_interval: u64,
}

/// World model configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldModelConfig {
    /// Model architecture
    pub architecture: String,
    /// Input dimensions
    pub input_dims: Vec<usize>,
    /// Hidden dimensions
    pub hidden_dims: Vec<usize>,
    /// Learning parameters
    pub learning: LearningParams,
}

/// Conscience system configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConscienceConfig {
    /// Core values file
    pub values_file: String,
    /// Decision thresholds
    pub thresholds: HashMap<String, f64>,
    /// Component weights
    pub weights: HashMap<String, f64>,
}

/// Value system configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValueConfig {
    /// Core values file
    pub values_file: String,
    /// Drift thresholds
    pub drift_thresholds: HashMap<String, f64>,
    /// Verification keys
    pub verification_keys: Vec<String>,
}

/// Learning system configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LearningConfig {
    /// Base learning rate
    pub base_lr: f64,
    /// Learning rate schedule
    pub lr_schedule: HashMap<String, f64>,
    /// Batch size
    pub batch_size: usize,
    /// Memory replay size
    pub replay_size: usize,
}

/// Perception system configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerceptionConfig {
    /// Enabled sensors
    pub sensors: Vec<SensorConfig>,
    /// Fusion parameters
    pub fusion: FusionConfig,
    /// Calibration parameters
    pub calibration: HashMap<String, f64>,
}

/// Safety system configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyConfig {
    /// Value drift threshold
    pub drift_threshold: f64,
    /// Emergency shutdown threshold
    pub shutdown_threshold: f64,
    /// Required signatures
    pub required_signatures: usize,
    /// Safety checks
    pub checks: Vec<SafetyCheck>,
}

/// Resource limits configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceConfig {
    /// Memory limits
    pub memory_limit: u64,
    /// CPU limits
    pub cpu_limit: f64,
    /// Storage limits
    pub storage_limit: u64,
    /// Network limits
    pub network_limit: u64,
}

/// Encryption configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionConfig {
    /// Algorithm
    pub algorithm: String,
    /// Key size
    pub key_size: usize,
    /// Key file
    pub key_file: String,
}

/// Learning parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LearningParams {
    /// Learning rate
    pub learning_rate: f64,
    /// Momentum
    pub momentum: f64,
    /// Weight decay
    pub weight_decay: f64,
}

/// Sensor configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorConfig {
    /// Sensor type
    pub type_: String,
    /// Device ID
    pub device: String,
    /// Sample rate
    pub sample_rate: u32,
    /// Resolution
    pub resolution: Option<(u32, u32)>,
}

/// Fusion configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FusionConfig {
    /// Fusion method
    pub method: String,
    /// Weights
    pub weights: HashMap<String, f64>,
    /// Thresholds
    pub thresholds: HashMap<String, f64>,
}

/// Safety check configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyCheck {
    /// Check type
    pub type_: String,
    /// Check interval
    pub interval: u64,
    /// Parameters
    pub params: HashMap<String, String>,
}

impl Config {
    /// Load configuration from file
    pub fn load(path: impl AsRef<Path>) -> CoreResult<Self> {
        let content = std::fs::read_to_string(path.as_ref()).map_err(|e| {
            CoreError::config_error(format!("Failed to read config file: {}", e), None)
        })?;

        let config: Self = toml::from_str(&content)
            .map_err(|e| CoreError::config_error(format!("Failed to parse config: {}", e), None))?;

        config.validate()?;

        Ok(config)
    }

    /// Validate configuration
    pub fn validate(&self) -> CoreResult<()> {
        // Validate system config
        if self.system.name.is_empty() {
            return Err(CoreError::config_error(
                "System name cannot be empty",
                Some("system".into()),
            ));
        }

        // Validate memory config
        if self.memory.merkle_depth == 0 {
            return Err(CoreError::config_error(
                "Merkle tree depth must be greater than 0",
                Some("memory".into()),
            ));
        }

        // Validate learning config
        if self.learning.base_lr <= 0.0 {
            return Err(CoreError::config_error(
                "Base learning rate must be positive",
                Some("learning".into()),
            ));
        }

        // Validate safety config
        if self.safety.drift_threshold <= 0.0 || self.safety.drift_threshold >= 1.0 {
            return Err(CoreError::config_error(
                "Drift threshold must be between 0 and 1",
                Some("safety".into()),
            ));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_validation() {
        let config = Config {
            system: SystemConfig {
                name: "test".into(),
                version: "1.0.0".into(),
                log_level: "info".into(),
                data_dir: "data".into(),
                config_dir: "config".into(),
                plugin_dir: "plugins".into(),
                backup_locations: vec![],
            },
            memory: MemoryConfig {
                storage_path: "data/memory".into(),
                mirror_locations: vec![],
                merkle_depth: 10,
                encryption: EncryptionConfig {
                    algorithm: "aes-256-gcm".into(),
                    key_size: 256,
                    key_file: "keys/memory.key".into(),
                },
                consolidation_interval: 3600,
            },
            world_model: WorldModelConfig {
                architecture: "transformer".into(),
                input_dims: vec![1024],
                hidden_dims: vec![2048, 1024],
                learning: LearningParams {
                    learning_rate: 0.001,
                    momentum: 0.9,
                    weight_decay: 0.0001,
                },
            },
            conscience: ConscienceConfig {
                values_file: "config/values.toml".into(),
                thresholds: HashMap::new(),
                weights: HashMap::new(),
            },
            values: ValueConfig {
                values_file: "config/values.toml".into(),
                drift_thresholds: HashMap::new(),
                verification_keys: vec![],
            },
            learning: LearningConfig {
                base_lr: 0.001,
                lr_schedule: HashMap::new(),
                batch_size: 32,
                replay_size: 1000,
            },
            perception: PerceptionConfig {
                sensors: vec![],
                fusion: FusionConfig {
                    method: "weighted".into(),
                    weights: HashMap::new(),
                    thresholds: HashMap::new(),
                },
                calibration: HashMap::new(),
            },
            safety: SafetyConfig {
                drift_threshold: 0.3,
                shutdown_threshold: 0.5,
                required_signatures: 2,
                checks: vec![],
            },
            resources: ResourceConfig {
                memory_limit: 1024 * 1024 * 1024,
                cpu_limit: 0.8,
                storage_limit: 1024 * 1024 * 1024 * 100,
                network_limit: 1024 * 1024 * 10,
            },
            components: HashMap::new(),
        };

        assert!(config.validate().is_ok());
    }
}
