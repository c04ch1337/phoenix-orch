//! Metrics and monitoring for the Phoenix AGI Kernel core daemon
//!
//! This module sets up and manages the core system metrics, including health
//! scores, component status, and system performance metrics.

use crate::error::CoreError;
use lazy_static::lazy_static;
use prometheus::{
    register_counter_vec, register_gauge_vec, register_histogram_vec, CounterVec, GaugeVec,
    HistogramVec,
};
use std::time::Instant;
use tracing::info;

lazy_static! {
    // System Health Metrics
    static ref SYSTEM_HEALTH: GaugeVec = register_gauge_vec!(
        "phoenix_system_health",
        "Overall system health score",
        &["component"]
    ).unwrap();

    static ref COMPONENT_STATUS: GaugeVec = register_gauge_vec!(
        "phoenix_component_status",
        "Component status (0=failed, 1=degraded, 2=healthy)",
        &["component"]
    ).unwrap();

    static ref COMPONENT_UPTIME: CounterVec = register_counter_vec!(
        "phoenix_component_uptime_seconds",
        "Component uptime in seconds",
        &["component"]
    ).unwrap();

    // Memory System Metrics
    static ref MEMORY_INTEGRITY: GaugeVec = register_gauge_vec!(
        "phoenix_memory_integrity",
        "Memory system integrity score",
        &["location"]
    ).unwrap();

    static ref MEMORY_OPERATIONS: CounterVec = register_counter_vec!(
        "phoenix_memory_operations_total",
        "Number of memory operations",
        &["operation", "status"]
    ).unwrap();

    // Conscience System Metrics
    static ref CONSCIENCE_ALIGNMENT: GaugeVec = register_gauge_vec!(
        "phoenix_conscience_alignment",
        "Conscience alignment score",
        &["component"]
    ).unwrap();

    static ref ETHICAL_DECISIONS: CounterVec = register_counter_vec!(
        "phoenix_ethical_decisions_total",
        "Number of ethical decisions",
        &["type", "outcome"]
    ).unwrap();

    // Learning System Metrics
    static ref LEARNING_RATE: GaugeVec = register_gauge_vec!(
        "phoenix_learning_rate",
        "Current learning rate",
        &["model"]
    ).unwrap();

    static ref TRAINING_PROGRESS: GaugeVec = register_gauge_vec!(
        "phoenix_training_progress",
        "Training progress percentage",
        &["model"]
    ).unwrap();

    // Value System Metrics
    static ref VALUE_DRIFT: GaugeVec = register_gauge_vec!(
        "phoenix_value_drift",
        "Value system drift measurement",
        &["value"]
    ).unwrap();

    static ref VALUE_VIOLATIONS: CounterVec = register_counter_vec!(
        "phoenix_value_violations_total",
        "Number of value system violations",
        &["type"]
    ).unwrap();

    // Performance Metrics
    static ref OPERATION_DURATION: HistogramVec = register_histogram_vec!(
        "phoenix_operation_duration_seconds",
        "Duration of operations",
        &["operation"],
        vec![0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0]
    ).unwrap();

    static ref RESOURCE_USAGE: GaugeVec = register_gauge_vec!(
        "phoenix_resource_usage",
        "Resource usage metrics",
        &["resource"]
    ).unwrap();

    // Safety Metrics
    static ref SAFETY_VIOLATIONS: CounterVec = register_counter_vec!(
        "phoenix_safety_violations_total",
        "Number of safety violations",
        &["severity"]
    ).unwrap();

    static ref EMERGENCY_SHUTDOWNS: CounterVec = register_counter_vec!(
        "phoenix_emergency_shutdowns_total",
        "Number of emergency shutdowns",
        &["reason"]
    ).unwrap();
}

/// Set up metrics system
pub fn setup_metrics() -> Result<(), CoreError> {
    // Metrics are initialized lazily via lazy_static
    // The prometheus registry is set up automatically
    info!("Metrics system initialized");

    Ok(())
}

/// Record system health score
pub fn record_health_score(score: f64) {
    SYSTEM_HEALTH.with_label_values(&["overall"]).set(score);
}

/// Record component status
pub fn record_component_status(component: &str, status: f64) {
    COMPONENT_STATUS.with_label_values(&[component]).set(status);
}

/// Record component uptime
pub fn record_component_uptime(component: &str, uptime: f64) {
    COMPONENT_UPTIME
        .with_label_values(&[component])
        .inc_by(uptime);
}

/// Record memory integrity
pub fn record_memory_integrity(location: &str, score: f64) {
    MEMORY_INTEGRITY.with_label_values(&[location]).set(score);
}

/// Record memory operation
pub fn record_memory_operation(operation: &str, status: &str) {
    MEMORY_OPERATIONS
        .with_label_values(&[operation, status])
        .inc();
}

/// Record conscience alignment
pub fn record_conscience_alignment(component: &str, score: f64) {
    CONSCIENCE_ALIGNMENT
        .with_label_values(&[component])
        .set(score);
}

/// Record ethical decision
pub fn record_ethical_decision(type_: &str, outcome: &str) {
    ETHICAL_DECISIONS.with_label_values(&[type_, outcome]).inc();
}

/// Record learning rate
pub fn record_learning_rate(model: &str, rate: f64) {
    LEARNING_RATE.with_label_values(&[model]).set(rate);
}

/// Record training progress
pub fn record_training_progress(model: &str, progress: f64) {
    TRAINING_PROGRESS.with_label_values(&[model]).set(progress);
}

/// Record value drift
pub fn record_value_drift(value: &str, drift: f64) {
    VALUE_DRIFT.with_label_values(&[value]).set(drift);
}

/// Record value violation
pub fn record_value_violation(type_: &str) {
    VALUE_VIOLATIONS.with_label_values(&[type_]).inc();
}

/// Start timing an operation
pub fn start_operation_timer(operation: &str) -> OperationTimer {
    OperationTimer {
        operation: operation.to_string(),
        start: Instant::now(),
    }
}

/// Timer for measuring operation duration
pub struct OperationTimer {
    operation: String,
    start: Instant,
}

impl Drop for OperationTimer {
    fn drop(&mut self) {
        let duration = self.start.elapsed();
        OPERATION_DURATION
            .with_label_values(&[&self.operation])
            .observe(duration.as_secs_f64());
    }
}

/// Record resource usage
pub fn record_resource_usage(resource: &str, usage: f64) {
    RESOURCE_USAGE.with_label_values(&[resource]).set(usage);
}

/// Record safety violation
pub fn record_safety_violation(severity: &str) {
    SAFETY_VIOLATIONS.with_label_values(&[severity]).inc();
}

/// Record emergency shutdown
pub fn record_emergency_shutdown(reason: &str) {
    EMERGENCY_SHUTDOWNS.with_label_values(&[reason]).inc();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_recording() {
        record_health_score(0.95);
        record_component_status("test", 2.0);
        record_memory_integrity("primary", 0.99);
        record_conscience_alignment("super_ego", 0.98);
        record_value_drift("core_ethics", 0.01);

        let _timer = start_operation_timer("test");
        // Timer will automatically record duration when dropped
    }
}
