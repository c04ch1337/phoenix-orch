//! Core Phoenix AGI Kernel functionality

use crate::error::CoreError;
use anyhow::Result;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tokio::task;
use tracing::{info, debug};
use futures::future::{join_all, FutureExt};

/// Performance metrics for activation sequence
#[derive(Debug, Clone)]
pub struct ActivationMetrics {
    /// Total activation time in milliseconds
    pub total_ms: u64,
    /// Detailed timing of individual components
    pub component_timings: Vec<ComponentTiming>,
    /// Whether the activation was performed via preloaded components
    pub used_preloaded: bool,
}

/// Timing for individual components during activation
#[derive(Debug, Clone)]
pub struct ComponentTiming {
    /// Component name
    pub name: String,
    /// Time taken in milliseconds
    pub duration_ms: u64,
}

/// Core system state
#[derive(Debug)]
pub struct CoreState {
    /// Whether shutdown has been requested
    pub shutdown_requested: bool,
    /// Cybersecurity mode status
    pub cybersecurity_mode: CybersecurityMode,
    /// Pre-loaded components for fast activation
    pub preloaded_components: PreloadedComponents,
    /// Latest activation metrics
    pub activation_metrics: Option<ActivationMetrics>,
}

/// Preloaded components for fast activation
#[derive(Debug, Default)]
pub struct PreloadedComponents {
    /// Whether components are already preloaded
    pub is_loaded: bool,
    /// Preloaded Hak5 device information
    pub hak5_devices: Option<Vec<String>>,
    /// Timestamp of preloading
    pub preload_time: Option<chrono::DateTime<chrono::Utc>>,
}

/// Cybersecurity mode configuration
#[derive(Debug, Clone)]
pub struct CybersecurityMode {
    /// Whether mode is active
    pub armed: bool,
    /// Time of last activation
    pub activation_time: Option<chrono::DateTime<chrono::Utc>>,
    /// Detected Hak5 devices
    pub hak5_devices: Vec<String>,
}

impl CoreState {
    /// Create new core state
    pub fn new() -> Self {
        Self {
            shutdown_requested: false,
            cybersecurity_mode: CybersecurityMode {
                armed: false,
                activation_time: None,
                hak5_devices: Vec::new(),
            },
            preloaded_components: PreloadedComponents::default(),
            activation_metrics: None,
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
        let manager = Self {
            state: Arc::new(RwLock::new(CoreState::new())),
        };
        
        // Immediately start preloading components
        let state_clone = manager.state.clone();
        tokio::spawn(async move {
            let _ = Self::preload_critical_components(state_clone).await;
        });
        
        manager
    }

    /// Preload critical components for fast activation
    pub async fn preload_critical_components(state: Arc<RwLock<CoreState>>) -> Result<(), CoreError> {
        debug!("Preloading critical components for fast activation");
        let start = Instant::now();
        
        // Preload Hak5 devices in the background
        let hak5_devices = Self::enumerate_hak5_devices_internal().await?;
        
        // Store the preloaded components
        let mut state_write = state.write().await;
        state_write.preloaded_components.is_loaded = true;
        state_write.preloaded_components.hak5_devices = Some(hak5_devices);
        state_write.preloaded_components.preload_time = Some(chrono::Utc::now());
        
        let duration = start.elapsed();
        debug!("Preloaded critical components in {:?}", duration);
        
        Ok(())
    }

    /// Activate cybersecurity mode with optimized parallel flow
    pub async fn activate_cybersecurity_mode(&self) -> Result<ActivationMetrics, CoreError> {
        info!("Activating cybersecurity mode");
        let start = Instant::now();
        let mut component_timings = Vec::new();
        
        // Check if we have preloaded components
        let used_preloaded;
        let hak5_devices;
        
        {
            let state_read = self.state.read().await;
            used_preloaded = state_read.preloaded_components.is_loaded;
            
            if used_preloaded && state_read.preloaded_components.hak5_devices.is_some() {
                // Use preloaded components
                debug!("Using preloaded components for fast activation");
                hak5_devices = state_read.preloaded_components.hak5_devices.clone().unwrap_or_default();
                
                // Record component timing for preloaded devices
                let preload_time = state_read.preloaded_components.preload_time.unwrap_or_else(|| chrono::Utc::now());
                let now = chrono::Utc::now();
                let age_ms = (now - preload_time).num_milliseconds() as u64;
                component_timings.push(ComponentTiming {
                    name: "hak5_devices_preloaded".to_string(),
                    duration_ms: 0, // Instant access since preloaded
                });
                debug!("Using Hak5 devices preloaded {} ms ago", age_ms);
            } else {
                // Need to load everything now
                debug!("No preloaded components available, loading on demand");
                drop(state_read); // Release the read lock before async operations
                
                // Measure device enumeration time
                let devices_start = Instant::now();
                hak5_devices = self.enumerate_hak5_devices().await?;
                component_timings.push(ComponentTiming {
                    name: "hak5_devices".to_string(),
                    duration_ms: devices_start.elapsed().as_millis() as u64
                });
            }
        }

        // Update state with activation info
        {
            let mut state_write = self.state.write().await;
            let update_start = Instant::now();
            
            state_write.cybersecurity_mode.armed = true;
            state_write.cybersecurity_mode.activation_time = Some(chrono::Utc::now());
            state_write.cybersecurity_mode.hak5_devices = hak5_devices;
            
            component_timings.push(ComponentTiming {
                name: "state_update".to_string(),
                duration_ms: update_start.elapsed().as_millis() as u64
            });
        }
        
        // Launch background task to refresh preloaded components
        let state_clone = self.state.clone();
        task::spawn(async move {
            // Slight delay to not compete with initial activation
            tokio::time::sleep(Duration::from_millis(100)).await;
            let _ = Self::preload_critical_components(state_clone).await;
        });
        
        // Calculate total activation time
        let total_duration = start.elapsed();
        let total_ms = total_duration.as_millis() as u64;
        
        // Create metrics object
        let metrics = ActivationMetrics {
            total_ms,
            component_timings,
            used_preloaded,
        };
        
        // Store metrics in state
        {
            let mut state_write = self.state.write().await;
            state_write.activation_metrics = Some(metrics.clone());
        }
        
        info!("Cybersecurity mode activated in {} ms", total_ms);
        Ok(metrics)
    }

    /// Enumerate connected Hak5 devices
    async fn enumerate_hak5_devices(&self) -> Result<Vec<String>, CoreError> {
        Self::enumerate_hak5_devices_internal().await
    }
    
    /// Internal implementation for Hak5 device enumeration
    async fn enumerate_hak5_devices_internal() -> Result<Vec<String>, CoreError> {
        // Implementation would use platform-specific USB enumeration
        // Simulating some processing time for real-world scenarios
        tokio::time::sleep(Duration::from_millis(50)).await;
        Ok(vec!["USB Rubber Ducky".to_string(), "LAN Turtle".to_string()])
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

    /// Get current cybersecurity status
    pub async fn cybersecurity_status(&self) -> CybersecurityMode {
        self.state.read().await.cybersecurity_mode.clone()
    }
    
    /// Get latest activation metrics
    pub async fn get_activation_metrics(&self) -> Option<ActivationMetrics> {
        self.state.read().await.activation_metrics.clone()
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
    
    #[tokio::test]
    async fn test_cybersecurity_activation() {
        let manager = CoreManager::new();
        
        // Allow preloading to potentially complete
        tokio::time::sleep(Duration::from_millis(200)).await;
        
        // Activate cybersecurity mode
        let metrics = manager.activate_cybersecurity_mode().await.unwrap();
        
        // Verify it's activated
        let status = manager.cybersecurity_status().await;
        assert!(status.armed);
        assert!(status.activation_time.is_some());
        
        // Verify metrics
        assert!(metrics.total_ms > 0, "Should track activation time");
        assert!(!metrics.component_timings.is_empty(), "Should track component timings");
        
        // Retrieve metrics through getter
        let stored_metrics = manager.get_activation_metrics().await;
        assert!(stored_metrics.is_some(), "Metrics should be stored in state");
    }
    
    #[tokio::test]
    async fn test_preloading() {
        let manager = CoreManager::new();
        
        // Force preload components
        CoreManager::preload_critical_components(manager.state.clone()).await.unwrap();
        
        // Verify components are preloaded
        let state = manager.state.read().await;
        assert!(state.preloaded_components.is_loaded);
        assert!(state.preloaded_components.hak5_devices.is_some());
        
        // Drop read lock
        drop(state);
        
        // Activate and verify preloaded components were used
        let metrics = manager.activate_cybersecurity_mode().await.unwrap();
        assert!(metrics.used_preloaded, "Should use preloaded components");
        assert!(
            metrics.total_ms < 20,
            "Activation with preloaded components should be very fast (was {} ms)",
            metrics.total_ms
        );
    }
}