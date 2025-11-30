//! System management and monitoring

pub mod types;

pub use types::*;

use anyhow::Result;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::info;
use serde::{Serialize, Deserialize};

/// System components manager
#[derive(Debug)]
pub struct SystemComponents {
    /// Component states
    states: Arc<RwLock<Vec<types::ComponentState>>>,
    /// Memory subsystem
    pub memory: Option<Arc<crate::memory::PlasticLtm>>,
    /// Conscience subsystem
    pub conscience: Option<Arc<crate::conscience::TriuneConscience>>,
    /// World model subsystem
    pub world_model: Option<Arc<crate::world::WorldSelfModel>>,
}

impl SystemComponents {
    /// Create new system components manager
    pub fn new() -> Self {
        Self {
            states: Arc::new(RwLock::new(Vec::new())),
            memory: None,
            conscience: None,
            world_model: None,
        }
    }

    /// Get current health status with detailed component checks
    pub async fn get_health_status(&self) -> Result<SystemHealth> {
        info!("Performing system health check");
        let states = self.states.read().await;

        // Check core subsystems
        let memory_health = if let Some(mem) = &self.memory {
            match mem.verify_integrity().await {
                Ok(score) if score > 0.9 => true,
                Ok(score) => {
                    info!("Memory integrity below threshold: {}", score);
                    false
                },
                Err(e) => {
                    info!("Memory check failed: {}", e);
                    false
                }
            }
        } else {
            info!("Memory subsystem not initialized");
            false
        };

        let conscience_health = self.conscience.is_some();
        let world_model_health = self.world_model.is_some();
        let failed: Vec<_> = states
            .iter()
            .filter_map(|s| match &s.status {
                ComponentStatus::Failed(err) => Some((s.name.clone(), err.clone())),
                _ => None,
            })
            .collect();

        let healthy = failed.is_empty() && memory_health && conscience_health && world_model_health;
        
        let status = SystemHealth {
            healthy,
            failed_components: failed,
        };

        info!("Health check complete - System healthy: {}", healthy);
        if !healthy {
            info!("Failed components: {:?}", failed);
        }

        Ok(status)
    }

    /// Get system metrics
    pub async fn get_metrics(&self) -> Result<serde_json::Value> {
        let mut metrics = serde_json::Map::new();
        
        // Add component states
        let states = self.states.read().await;
        metrics.insert(
            "components".to_string(),
            serde_json::Value::Array(
                states
                    .iter()
                    .map(|s| serde_json::json!({
                        "name": s.name,
                        "status": format!("{:?}", s.status)
                    }))
                    .collect()
            )
        );

        // Add subsystem metrics
        if let Some(memory) = &self.memory {
            metrics.insert("memory_usage".to_string(), serde_json::json!(memory.get_usage().await?));
        }

        if let Some(world_model) = &self.world_model {
            metrics.insert("model_stats".to_string(), serde_json::json!(world_model.get_stats().await?));
        }

        Ok(serde_json::Value::Object(metrics))
    }
}

/// System health status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemHealth {
    /// Whether system is healthy overall
    pub healthy: bool,
    /// Failed components with error messages
    pub failed_components: Vec<(String, String)>,
}

/// Overall system state
#[derive(Debug)]
pub struct SystemState {
    /// Whether shutdown has been requested
    pub shutdown_requested: bool,
    /// Active system components
    pub components: Option<SystemComponents>,
    /// System start time
    pub start_time: std::time::SystemTime,
}

impl SystemState {
    /// Create new system state
    pub fn new(config: crate::config::SystemConfig, debug: Arc<crate::debug::DebugTrace>) -> Self {
        info!("Initializing system state with config: {:?}", config);
        
        let components = SystemComponents::new();
        info!("Core components initialized");

        Self {
            shutdown_requested: false,
            components: Some(components),
            start_time: std::time::SystemTime::now(),
        }
    }

    /// Get system uptime
    pub fn uptime(&self) -> Duration {
        self.start_time
            .elapsed()
            .unwrap_or(Duration::from_secs(0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_check() {
        let components = SystemComponents::new();
        let health = components.get_health_status().await.unwrap();
        assert!(health.healthy);
        assert!(health.failed_components.is_empty());
    }
}