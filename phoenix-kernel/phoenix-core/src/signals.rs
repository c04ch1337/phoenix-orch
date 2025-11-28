//! Signal handling for the Phoenix AGI Kernel core daemon
//!
//! This module implements graceful shutdown and signal handling capabilities,
//! ensuring proper cleanup and state persistence on system shutdown.

use std::{
    sync::{atomic::{AtomicBool, Ordering}, Arc},
    time::Duration,
};
use tokio::{signal::unix::{signal, SignalKind}, sync::RwLock};
use tracing::{error, info, warn};
use serde::Serialize;

use crate::system::SystemState;

/// Global shutdown flag
static SHUTDOWN_REQUESTED: AtomicBool = AtomicBool::new(false);
static EMERGENCY_SHUTDOWN: AtomicBool = AtomicBool::new(false);

/// Set up signal handlers
pub fn setup_signal_handlers() {
    // Handle SIGTERM
    tokio::spawn(async move {
        let mut sigterm = signal(SignalKind::terminate()).unwrap();
        sigterm.recv().await;
        info!("Received SIGTERM - initiating graceful shutdown");
        request_shutdown();
    });

    // Handle SIGINT (Ctrl+C)
    tokio::spawn(async move {
        let mut sigint = signal(SignalKind::interrupt()).unwrap();
        sigint.recv().await;
        info!("Received SIGINT - initiating graceful shutdown");
        request_shutdown();
    });

    // Handle SIGQUIT
    tokio::spawn(async move {
        let mut sigquit = signal(SignalKind::quit()).unwrap();
        sigquit.recv().await;
        warn!("Received SIGQUIT - initiating emergency shutdown");
        emergency_shutdown();
    });

    // Handle SIGUSR1 (custom signal for state dump)
    tokio::spawn(async move {
        let mut sigusr1 = signal(SignalKind::user_defined1()).unwrap();
        sigusr1.recv().await;
        info!("Received SIGUSR1 - dumping system state");
        dump_system_state().await;
    });

    // Handle SIGUSR2 (custom signal for memory consolidation)
    tokio::spawn(async move {
        let mut sigusr2 = signal(SignalKind::user_defined2()).unwrap();
        sigusr2.recv().await;
        info!("Received SIGUSR2 - triggering memory consolidation");
        consolidate_memory().await;
    });
}

/// Handle signals and monitor system state
pub fn handle_signals(state: Arc<RwLock<SystemState>>) -> anyhow::Result<()> {
    setup_signal_handlers();
    Ok(())
}

/// Request graceful shutdown
pub fn request_shutdown() {
    SHUTDOWN_REQUESTED.store(true, Ordering::SeqCst);
}

/// Check if shutdown was requested
pub fn is_shutdown_requested() -> bool {
    SHUTDOWN_REQUESTED.load(Ordering::SeqCst)
}

/// Trigger emergency shutdown
pub fn emergency_shutdown() {
    EMERGENCY_SHUTDOWN.store(true, Ordering::SeqCst);
    request_shutdown();
}

/// Check if emergency shutdown was triggered
pub fn is_emergency_shutdown() -> bool {
    EMERGENCY_SHUTDOWN.load(Ordering::SeqCst)
}

/// Dump current system state
async fn dump_system_state() {
    info!("Starting system state dump");

    // Create state snapshot
    let snapshot = SystemSnapshot {
        timestamp: std::time::SystemTime::now(),
        components: Vec::new(),
        memory: None,
        world_model: None,
    };

    // Save to disk
    if let Err(e) = snapshot.save().await {
        error!("Failed to dump system state: {}", e);
    }

    info!("System state dump completed");
}

/// Trigger memory consolidation
async fn consolidate_memory() {
    info!("Starting memory consolidation");

    // TODO: Implement memory consolidation
    tokio::time::sleep(Duration::from_secs(1)).await;

    info!("Memory consolidation completed");
}

/// System state snapshot
#[derive(Debug, Serialize)]
struct SystemSnapshot {
    /// Snapshot timestamp
    timestamp: std::time::SystemTime,
    /// Component states
    components: Vec<ComponentState>,
    /// Memory system state
    memory: Option<MemoryState>,
    /// World model state
    world_model: Option<WorldModelState>,
}

/// Component state
#[derive(Debug, Serialize)]
struct ComponentState {
    /// Component name
    name: String,
    /// Component status
    status: String,
    /// Component metrics
    metrics: std::collections::HashMap<String, f64>,
}

/// Memory system state
#[derive(Debug, Serialize)]
struct MemoryState {
    /// Memory integrity score
    integrity: f64,
    /// Active memory fragments
    fragments: usize,
    /// Total size
    size: u64,
}

/// World model state
#[derive(Debug, Serialize)]
struct WorldModelState {
    /// Model version
    version: String,
    /// Active entities
    entities: usize,
    /// Model parameters
    parameters: std::collections::HashMap<String, f64>,
}

impl SystemSnapshot {
    /// Save snapshot to disk
    async fn save(&self) -> std::io::Result<()> {
        // Create snapshots directory if it doesn't exist
        tokio::fs::create_dir_all("data/snapshots").await?;

        // Generate filename with timestamp
        let filename = format!(
            "data/snapshots/snapshot_{}.json",
            chrono::Utc::now().format("%Y%m%d_%H%M%S")
        );

        // Serialize and save
        let json = serde_json::to_string_pretty(&self)?;
        tokio::fs::write(filename, json).await?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shutdown_flags() {
        assert!(!is_shutdown_requested());
        assert!(!is_emergency_shutdown());

        request_shutdown();
        assert!(is_shutdown_requested());
        assert!(!is_emergency_shutdown());

        emergency_shutdown();
        assert!(is_shutdown_requested());
        assert!(is_emergency_shutdown());
    }
}
