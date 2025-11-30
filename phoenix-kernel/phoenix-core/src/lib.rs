//! Phoenix AGI Kernel - Conscience-driven general intelligence with eternal memory
//!
//! This is the core orchestration daemon that coordinates all Phoenix components:
//! - Plastic Long-Term Memory (PLTM)
//! - Triune Conscience Engine
//! - Hierarchical World & Self Model
//! - Incremental Learning Daemon
//! - Value Lock & Catastrophe Detector
//! - Multi-Modal Perception Fusion

pub mod api;
pub mod config;
pub mod core;
pub mod error;
pub mod tools;
pub mod ember_forge;

#[cfg(target_os = "windows")]
pub mod metrics_windows;
#[cfg(target_os = "windows")]
pub use metrics_windows as metrics;
#[cfg(not(target_os = "windows"))]
pub mod metrics;

#[cfg(target_os = "windows")]
pub mod signals_windows;
#[cfg(target_os = "windows")]
pub use signals_windows as signals;
#[cfg(not(target_os = "windows"))]
pub mod signals;

pub mod system;

// Re-export key components
pub use incremental_learner as learning;
pub use perception_fusion as perception;
pub use phoenix_debug_trace as debug;
pub use phoenix_self_heal as healing;
pub use plastic_ltm as memory;
pub use triune_conscience as conscience;
pub use value_lock as values;
pub use world_self_model as world;

// Re-export core types
pub use config::SystemConfig;
pub use error::Error;
pub use system::{SystemComponents, SystemHealth, SystemState};

/// Phoenix Core API state (simplified for API server)
#[derive(Debug, Clone)]
pub struct PhoenixCore {
    pub components: Arc<tokio::sync::RwLock<std::collections::HashMap<String, String>>>,
    pub config: Arc<tokio::sync::RwLock<config::Config>>,
    pub health: Arc<tokio::sync::RwLock<system::SystemHealth>>,
}

use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info};

/// Core Phoenix AGI Kernel
pub struct PhoenixKernel {
    /// System state
    state: Arc<RwLock<SystemState>>,

    /// Configuration
    config: SystemConfig,

    /// Debug trace
    debug: Arc<debug::DebugTrace>,
}

impl PhoenixKernel {
    /// Create a new Phoenix Kernel instance
    pub async fn new(config: SystemConfig) -> Result<Self> {
        info!("Initializing Phoenix AGI Kernel");

        let debug = Arc::new(debug::DebugTrace::new().await?);
        let state = Arc::new(RwLock::new(SystemState::new(config.clone(), debug.clone())));

        Ok(Self {
            state,
            config,
            debug,
        })
    }

    /// Start the kernel in daemon mode
    pub async fn start_daemon(&self, data_dir: std::path::PathBuf) -> Result<()> {
        info!("Starting Phoenix AGI Kernel in daemon mode");

        // Initialize metrics
        metrics::setup_metrics()?;

        // Handle signals
        signals::handle_signals(self.state.clone())?;

        // Main daemon loop would go here - this is placeholder
        info!("Daemon mode started");

        Ok(())
    }

    /// Attempt resurrection from backup
    pub async fn resurrect(&self, backup_location: std::path::PathBuf) -> Result<()> {
        info!("Attempting resurrection from backup at {:?}", backup_location);

        // Resurrection logic would go here - this is placeholder
        info!("Resurrection initiated");

        Ok(())
    }

    /// Get current system health status
    pub async fn get_health(&self) -> Result<SystemHealth> {
        let state = self.state.read().await;
        if let Some(components) = &state.components {
            components.get_health_status().await
        } else {
            error!("No components initialized");
            Err(anyhow::anyhow!("System not initialized"))
        }
    }

    /// Request graceful shutdown
    pub async fn shutdown(&self) -> Result<()> {
        info!("Initiating graceful shutdown");

        let mut state = self.state.write().await;
        state.shutdown_requested = true;

        Ok(())
    }
}

impl Drop for PhoenixKernel {
    fn drop(&mut self) {
        info!("Phoenix AGI Kernel shutting down");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_kernel_lifecycle() {
        let config = config::get_default_config();
        let kernel = PhoenixKernel::new(config).await.unwrap();

        // Test shutdown
        kernel.shutdown().await.unwrap();

        let state = kernel.state.read().await;
        assert!(state.shutdown_requested);
    }
}
