//! Core Phoenix AGI Kernel functionality

use crate::error::CoreError;
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;

/// Core system state
#[derive(Debug)]
pub struct CoreState {
    /// Whether shutdown has been requested
    pub shutdown_requested: bool,
}

impl CoreState {
    /// Create new core state
    pub fn new() -> Self {
        Self {
            shutdown_requested: false,
        }
    }
}

/// Core system manager
pub struct CoreManager {
    /// System state
    state: Arc<RwLock<CoreState>>,
}

impl CoreManager {
    /// Create new core manager
    pub fn new() -> Self {
        Self {
            state: Arc::new(RwLock::new(CoreState::new())),
        }
    }

    /// Request system shutdown
    pub async fn request_shutdown(&self) -> Result<(), CoreError> {
        info!("Shutdown requested");
        let mut state = self.state.write().await;
        state.shutdown_requested = true;
        Ok(())
    }

    /// Check if shutdown has been requested
    pub async fn is_shutdown_requested(&self) -> bool {
        self.state.read().await.shutdown_requested
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_shutdown_request() {
        let manager = CoreManager::new();
        assert!(!manager.is_shutdown_requested().await);

        manager.request_shutdown().await.unwrap();
        assert!(manager.is_shutdown_requested().await);
    }
}