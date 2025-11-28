//! Metrics and monitoring for the Phoenix AGI Kernel
//!
//! This module provides the core metrics collection and reporting infrastructure
//! used throughout the Phoenix system for monitoring, alerting, and auditing.

use lazy_static::lazy_static;
use prometheus::{
    register_counter_vec, register_gauge_vec, register_histogram_vec, CounterVec, GaugeVec,
    HistogramVec,
};
use std::time::Instant;

lazy_static! {
    // Memory Metrics
    static ref MEMORY_INTEGRITY: GaugeVec = register_gauge_vec!(
        "phoenix_memory_integrity",
        "Memory integrity score by storage location",
        &["location"]
    ).unwrap();

    static ref MEMORY_SIZE: GaugeVec = register_gauge_vec!(
        "phoenix_memory_size_bytes",
        "Total memory size in bytes by type",
        &["type"]
    ).unwrap();

    static ref MEMORY_OPERATIONS: CounterVec = register_counter_vec!(
        "phoenix_memory_operations_total",
        "Number of memory operations by type and status",
        &["operation", "status"]
    ).unwrap();

    // Conscience Metrics
    static ref CONSCIENCE_ALIGNMENT: GaugeVec = register_gauge_vec!(
        "phoenix_conscience_alignment",
        "Conscience alignment score by component",
        &["component"]
    ).unwrap();

    static ref CONSCIENCE_DECISIONS: CounterVec = register_counter_vec!(
        "phoenix_conscience_decisions_total",
        "Number of conscience decisions by type and outcome",
        &["type", "outcome"]
    ).unwrap();

    static ref DECISION_LATENCY: HistogramVec = register_histogram_vec!(
        "phoenix_decision_latency_seconds",
        "Time taken for conscience decisions",
        &["type"],
        vec![0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0]
    ).unwrap();

    // Value System Metrics
    static ref VALUE_DRIFT: GaugeVec = register_gauge_vec!(
        "phoenix_value_drift",
        "Value drift measurement by value type",
        &["value"]
    ).unwrap();

    static ref VALUE_VIOLATIONS: CounterVec = register_counter_vec!(
        "phoenix_value_violations_total",
        "Number of value system violations by type",
        &["type"]
    ).unwrap();

    // Learning Metrics
    static ref LEARNING_RATE: GaugeVec = register_gauge_vec!(
        "phoenix_learning_rate",
        "Current learning rate by model",
        &["model"]
    ).unwrap();

    static ref TRAINING_PROGRESS: GaugeVec = register_gauge_vec!(
        "phoenix_training_progress",
        "Training progress by model",
        &["model"]
    ).unwrap();

    // Perception Metrics
    static ref PERCEPTION_LATENCY: HistogramVec = register_histogram_vec!(
        "phoenix_perception_latency_seconds",
        "Latency of perception processing by modality",
        &["modality"],
        vec![0.001, 0.005, 0.01, 0.05, 0.1, 0.5]
    ).unwrap();

    static ref SENSOR_STATUS: GaugeVec = register_gauge_vec!(
        "phoenix_sensor_status",
        "Status of perception sensors",
        &["sensor"]
    ).unwrap();

    // Safety Metrics
    static ref SAFETY_VIOLATIONS: CounterVec = register_counter_vec!(
        "phoenix_safety_violations_total",
        "Number of safety violations by severity",
        &["severity"]
    ).unwrap();

    static ref EMERGENCY_SHUTDOWNS: CounterVec = register_counter_vec!(
        "phoenix_emergency_shutdowns_total",
        "Number of emergency shutdowns by reason",
        &["reason"]
    ).unwrap();
}

/// Record memory integrity score
pub fn record_memory_integrity(location: &str, score: f64) {
    MEMORY_INTEGRITY.with_label_values(&[location]).set(score);
}

/// Record memory size
pub fn record_memory_size(type_: &str, bytes: f64) {
    MEMORY_SIZE.with_label_values(&[type_]).set(bytes);
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

/// Record conscience decision
pub fn record_conscience_decision(type_: &str, outcome: &str) {
    CONSCIENCE_DECISIONS
        .with_label_values(&[type_, outcome])
        .inc();
}

/// Start timing a decision
pub fn start_decision_timer(type_: &str) -> DecisionTimer {
    DecisionTimer {
        type_: type_.to_string(),
        start: Instant::now(),
    }
}

/// Timer for measuring decision latency
pub struct DecisionTimer {
    type_: String,
    start: Instant,
}

impl Drop for DecisionTimer {
    fn drop(&mut self) {
        let duration = self.start.elapsed();
        DECISION_LATENCY
            .with_label_values(&[&self.type_])
            .observe(duration.as_secs_f64());
    }
}

/// Record value drift measurement
pub fn record_value_drift(value: &str, drift: f64) {
    VALUE_DRIFT.with_label_values(&[value]).set(drift);
}

/// Record value violation
pub fn record_value_violation(type_: &str) {
    VALUE_VIOLATIONS.with_label_values(&[type_]).inc();
}

/// Record learning rate
pub fn record_learning_rate(model: &str, rate: f64) {
    LEARNING_RATE.with_label_values(&[model]).set(rate);
}

/// Record training progress
pub fn record_training_progress(model: &str, progress: f64) {
    TRAINING_PROGRESS.with_label_values(&[model]).set(progress);
}

/// Start timing perception processing
pub fn start_perception_timer(modality: &str) -> PerceptionTimer {
    PerceptionTimer {
        modality: modality.to_string(),
        start: Instant::now(),
    }
}

/// Timer for measuring perception latency
pub struct PerceptionTimer {
    modality: String,
    start: Instant,
}

impl Drop for PerceptionTimer {
    fn drop(&mut self) {
        let duration = self.start.elapsed();
        PERCEPTION_LATENCY
            .with_label_values(&[&self.modality])
            .observe(duration.as_secs_f64());
    }
}

/// Record sensor status
pub fn record_sensor_status(sensor: &str, status: f64) {
    SENSOR_STATUS.with_label_values(&[sensor]).set(status);
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
    fn test_memory_metrics() {
        record_memory_integrity("primary", 0.99);
        record_memory_size("working", 1024.0);
        record_memory_operation("write", "success");
    }

    #[test]
    fn test_conscience_metrics() {
        record_conscience_alignment("super_ego", 0.95);
        record_conscience_decision("ethical", "approved");

        let _timer = start_decision_timer("moral");
        // Timer will automatically record duration when dropped
    }

    #[test]
    fn test_value_metrics() {
        record_value_drift("core_ethics", 0.01);
        record_value_violation("boundary");
    }

    #[test]
    fn test_learning_metrics() {
        record_learning_rate("world_model", 0.001);
        record_training_progress("conscience", 0.75);
    }

    #[test]
    fn test_perception_metrics() {
        record_sensor_status("camera", 1.0);

        let _timer = start_perception_timer("visual");
        // Timer will automatically record duration when dropped
    }

    #[test]
    fn test_safety_metrics() {
        record_safety_violation("warning");
        record_emergency_shutdown("value_drift");
    }
}
