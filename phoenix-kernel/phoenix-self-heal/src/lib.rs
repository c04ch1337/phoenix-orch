//! Self-Healing System for the Phoenix AGI Kernel
//!
//! This crate implements autonomous error detection, diagnosis, and recovery
//! capabilities to maintain system health and stability.

#![forbid(unsafe_code)]
#![deny(missing_docs)]
#![allow(dead_code)]

use phoenix_common::{
    error::PhoenixResult,
    types::{ComponentStatus, PhoenixId},
};

/// Self-healing engine type alias for API compatibility
///
/// This type alias provides backward compatibility with code that references
/// `SelfHealingEngine` while the implementation uses `SelfHeal`.
pub type SelfHealingEngine = SelfHeal;

use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, SystemTime},
};
use tokio::sync::RwLock;
use tracing::error;

/// Core self-healing implementation
#[derive(Debug)]
pub struct SelfHeal {
    /// Active monitors
    monitors: Arc<RwLock<HashMap<String, Monitor>>>,
    /// Recovery strategies
    strategies: Arc<RwLock<HashMap<String, Strategy>>>,
    /// Health history
    history: Arc<RwLock<Vec<HealthEvent>>>,
    /// Recovery actions
    actions: Arc<RwLock<Vec<RecoveryAction>>>,
}

/// A system monitor
#[derive(Debug)]
struct Monitor {
    /// Monitor ID
    id: PhoenixId,
    /// Monitor type
    type_: MonitorType,
    /// Monitor status
    status: MonitorStatus,
    /// Check interval
    interval: Duration,
    /// Last check
    last_check: SystemTime,
}

/// Types of monitors
#[derive(Debug, Clone)]
pub enum MonitorType {
    /// Component health monitor
    Component {
        /// Component name
        name: String,
        /// Component type
        type_: String,
    },
    /// Resource monitor
    Resource {
        /// Resource type
        type_: String,
        /// Thresholds
        thresholds: HashMap<String, f64>,
    },
    /// Performance monitor
    Performance {
        /// Metric name
        metric: String,
        /// Target value
        target: f64,
    },
}

/// Monitor status
#[derive(Debug, Clone)]
enum MonitorStatus {
    /// Monitor is healthy
    Healthy,
    /// Monitor has detected warning
    Warning(String),
    /// Monitor has detected error
    Error(String),
}

/// A recovery strategy
#[derive(Debug, Clone)]
struct Strategy {
    /// Strategy ID
    id: PhoenixId,
    /// Strategy type
    type_: StrategyType,
    /// Success rate
    success_rate: f64,
    /// Last used
    last_used: Option<SystemTime>,
}

/// Types of recovery strategies
#[derive(Debug, Clone)]
pub enum StrategyType {
    /// Restart component
    Restart {
        /// Component name
        component: String,
        /// Restart parameters
        params: HashMap<String, String>,
    },
    /// Resource reallocation
    Reallocate {
        /// Resource type
        resource: String,
        /// New allocation
        allocation: HashMap<String, u64>,
    },
    /// Configuration update
    Reconfigure {
        /// Target component
        component: String,
        /// New configuration
        config: HashMap<String, String>,
    },
    /// Failover activation
    Failover {
        /// Primary component
        primary: String,
        /// Backup component
        backup: String,
    },
}

/// A health event
#[derive(Debug, Clone)]
pub struct HealthEvent {
    /// Event ID
    id: PhoenixId,
    /// Event type
    type_: HealthEventType,
    /// Component name
    component: String,
    /// Event message
    message: String,
    /// Event metadata
    metadata: HashMap<String, String>,
    /// Timestamp
    timestamp: SystemTime,
}

/// Types of health events
#[derive(Debug, Clone)]
enum HealthEventType {
    /// Status change
    StatusChange(ComponentStatus),
    /// Resource warning
    ResourceWarning,
    /// Performance degradation
    PerformanceDegradation,
    /// Error condition
    Error(String),
}

/// A recovery action
#[derive(Debug, Clone)]
pub struct RecoveryAction {
    /// Action ID
    id: PhoenixId,
    /// Strategy used
    strategy: PhoenixId,
    /// Target component
    target: String,
    /// Action result
    result: ActionResult,
    /// Timestamp
    timestamp: SystemTime,
}

/// Recovery action result
#[derive(Debug, Clone)]
enum ActionResult {
    /// Action succeeded
    Success,
    /// Action failed
    Failure(String),
    /// Action in progress
    InProgress,
}

impl SelfHeal {
    /// Create a new self-healing system
    pub async fn new() -> PhoenixResult<Self> {
        Ok(Self {
            monitors: Arc::new(RwLock::new(HashMap::new())),
            strategies: Arc::new(RwLock::new(HashMap::new())),
            history: Arc::new(RwLock::new(Vec::new())),
            actions: Arc::new(RwLock::new(Vec::new())),
        })
    }

    /// Add a new monitor
    pub async fn add_monitor(
        &self,
        type_: MonitorType,
        interval: Duration,
    ) -> PhoenixResult<PhoenixId> {
        let id = PhoenixId([0; 32]);

        let monitor = Monitor {
            id: id.clone(),
            type_,
            status: MonitorStatus::Healthy,
            interval,
            last_check: SystemTime::now(),
        };

        let mut monitors = self.monitors.write().await;
        monitors.insert(id.to_string(), monitor);

        Ok(id)
    }

    /// Add a recovery strategy
    pub async fn add_strategy(&self, type_: StrategyType) -> PhoenixResult<PhoenixId> {
        let id = PhoenixId([0; 32]);

        let strategy = Strategy {
            id: id.clone(),
            type_,
            success_rate: 1.0,
            last_used: None,
        };

        let mut strategies = self.strategies.write().await;
        strategies.insert(id.to_string(), strategy);

        Ok(id)
    }

    /// Start monitoring.
    ///
    /// This spawns a background task that periodically evaluates all monitors and
    /// attempts recovery when necessary. Errors from time calculations and
    /// recovery execution are logged but do not tear down the monitoring loop.
    pub async fn start_monitoring(&self) -> PhoenixResult<()> {
        let monitors = self.monitors.clone();
        let strategies = self.strategies.clone();
        let history = self.history.clone();
        let actions = self.actions.clone();

        // Use phoenix_common's panic-safe task spawning
        phoenix_common::task::spawn_monitored("self_heal_monitoring", async move {
            loop {
                let now = SystemTime::now();

                // Check all monitors
                let mut monitors_guard = monitors.write().await;
                for monitor in monitors_guard.values_mut() {
                    // If system time goes backwards, skip this cycle for the monitor.
                    let Ok(delta) = now.duration_since(monitor.last_check) else {
                        continue;
                    };

                    if delta < monitor.interval {
                        continue;
                    }

                    match &monitor.type_ {
                        MonitorType::Component { name, .. } => {
                            // Check component health
                            if let Err(e) = check_component_health(name).await {
                                monitor.status = MonitorStatus::Error(e.to_string());

                                // Record event
                                let mut history_guard = history.write().await;
                                history_guard.push(HealthEvent {
                                    id: PhoenixId([0; 32]),
                                    type_: HealthEventType::Error(e.to_string()),
                                    component: name.clone(),
                                    message: format!("Component {} health check failed", name),
                                    metadata: HashMap::new(),
                                    timestamp: now,
                                });

                                // Attempt recovery
                                let strategies_guard = strategies.read().await;
                                if let Some(strategy) =
                                    find_recovery_strategy(&strategies_guard, name)
                                {
                                    let mut actions_guard = actions.write().await;
                                    actions_guard.push(RecoveryAction {
                                        id: PhoenixId([0; 32]),
                                        strategy: strategy.id.clone(),
                                        target: name.clone(),
                                        result: ActionResult::InProgress,
                                        timestamp: now,
                                    });

                                    // Execute recovery (best-effort)
                                    if let Err(e) = execute_recovery(&strategy.type_, name).await {
                                        error!("Recovery failed: {}", e);
                                    }
                                }
                            }
                        }
                        MonitorType::Resource { type_, thresholds } => {
                            // Check resource usage
                            if let Err(e) = check_resource_usage(type_, thresholds).await {
                                monitor.status = MonitorStatus::Warning(e.to_string());
                            }
                        }
                        MonitorType::Performance { metric, target } => {
                            // Check performance
                            if let Err(e) = check_performance(metric, *target).await {
                                monitor.status = MonitorStatus::Warning(e.to_string());
                            }
                        }
                    }

                    monitor.last_check = now;
                }

                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        });

        Ok(())
    }

    /// Get health history
    pub async fn get_history(&self) -> PhoenixResult<Vec<HealthEvent>> {
        Ok(self.history.read().await.clone())
    }

    /// Get recovery actions
    pub async fn get_actions(&self) -> PhoenixResult<Vec<RecoveryAction>> {
        Ok(self.actions.read().await.clone())
    }
}

// Helper functions

async fn check_component_health(_name: &str) -> PhoenixResult<()> {
    // TODO: implement real component health checks. For now this is a stub that
    // always reports success so that the self-heal loop can run safely.
    Ok(())
}

async fn check_resource_usage(
    _type_: &str,
    _thresholds: &HashMap<String, f64>,
) -> PhoenixResult<()> {
    // TODO: implement real resource usage checks.
    Ok(())
}

async fn check_performance(_metric: &str, _target: f64) -> PhoenixResult<()> {
    // TODO: implement real performance checks.
    Ok(())
}

fn find_recovery_strategy<'a>(
    strategies: &'a HashMap<String, Strategy>,
    _component: &str,
) -> Option<&'a Strategy> {
    // Find best strategy. For now we simply pick the first available strategy.
    strategies.values().next()
}

async fn execute_recovery(strategy: &StrategyType, _target: &str) -> PhoenixResult<()> {
    match strategy {
        StrategyType::Restart {
            component: _,
            params: _,
        } => {
            // TODO: Implement restart
        }
        StrategyType::Reallocate {
            resource: _,
            allocation: _,
        } => {
            // TODO: Implement reallocation
        }
        StrategyType::Reconfigure {
            component: _,
            config: _,
        } => {
            // TODO: Implement reconfiguration
        }
        StrategyType::Failover {
            primary: _,
            backup: _,
        } => {
            // TODO: Implement failover
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_monitor_creation() {
        let heal = SelfHeal::new().await.unwrap();

        let id = heal
            .add_monitor(
                MonitorType::Component {
                    name: "test".into(),
                    type_: "test".into(),
                },
                Duration::from_secs(60),
            )
            .await
            .unwrap();

        let monitors = heal.monitors.read().await;
        assert!(monitors.contains_key(&id.to_string()));
    }

    #[tokio::test]
    async fn test_strategy_creation() {
        let heal = SelfHeal::new().await.unwrap();

        let id = heal
            .add_strategy(StrategyType::Restart {
                component: "test".into(),
                params: HashMap::new(),
            })
            .await
            .unwrap();

        let strategies = heal.strategies.read().await;
        assert!(strategies.contains_key(&id.to_string()));
    }
}
