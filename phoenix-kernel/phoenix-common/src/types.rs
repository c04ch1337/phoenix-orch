//! Core type definitions for the Phoenix AGI Kernel
//!
//! This module provides fundamental types used across all Phoenix components,
//! ensuring consistent type usage and safety guarantees.

use serde::{Deserialize, Serialize};
use std::{collections::HashMap, time::SystemTime};

/// A unique identifier for any Phoenix entity
#[derive(Debug, Clone, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct PhoenixId(pub [u8; 32]);

impl std::fmt::Display for PhoenixId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        for byte in &self.0 {
            write!(f, "{:02x}", byte)?;
        }
        Ok(())
    }
}

/// A timestamped event in the system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event<T> {
    /// Unique event identifier
    pub id: PhoenixId,
    /// Event timestamp
    pub timestamp: SystemTime,
    /// Event data
    pub data: T,
    /// Event metadata
    pub metadata: HashMap<String, String>,
}

/// A cryptographically verified piece of data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Verified<T> {
    /// The verified data
    pub data: T,
    /// Cryptographic signature
    pub signature: Vec<u8>,
    /// Verification timestamp
    pub verified_at: SystemTime,
}

/// A piece of data with integrity proof
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Proven<T> {
    /// The proven data
    pub data: T,
    /// Merkle proof
    pub proof: Vec<u8>,
    /// Root hash at time of proof
    pub root_hash: [u8; 32],
}

/// A weighted vote from a component
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vote<T> {
    /// The voter's decision
    pub decision: T,
    /// Confidence weight (0.0 - 1.0)
    pub confidence: f32,
    /// Reasoning behind the vote
    pub reasoning: String,
}

/// A consensus decision from multiple components
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Consensus<T> {
    /// The final decision
    pub decision: T,
    /// Individual votes
    pub votes: Vec<Vote<T>>,
    /// Overall confidence
    pub confidence: f32,
    /// Final justification
    pub justification: String,
}

/// A learning update with provenance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LearningUpdate {
    /// Update identifier
    pub id: PhoenixId,
    /// Model being updated
    pub model: String,
    /// Update parameters
    pub parameters: Vec<f32>,
    /// Learning rate
    pub learning_rate: f32,
    /// Source of update
    pub source: String,
    /// Update justification
    pub justification: String,
}

/// A sensor reading with confidence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorReading<T> {
    /// The sensor data
    pub data: T,
    /// Confidence score (0.0 - 1.0)
    pub confidence: f32,
    /// Sensor metadata
    pub metadata: HashMap<String, String>,
    /// Timestamp
    pub timestamp: SystemTime,
}

/// A fused multi-modal perception
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FusedPerception {
    /// Vector representation
    pub vector: Vec<f32>,
    /// Source modalities
    pub sources: Vec<String>,
    /// Fusion confidence
    pub confidence: f32,
    /// Timestamp
    pub timestamp: SystemTime,
}

/// Status of a system component
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ComponentStatus {
    /// Component is healthy
    Healthy,
    /// Component has degraded performance
    Degraded,
    /// Component has failed
    Failed,
    /// Component status unknown
    Unknown,
}

/// A health check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheck {
    /// Overall health score (0.0 - 1.0)
    pub score: f32,
    /// Component status
    pub components: HashMap<String, ComponentStatus>,
    /// Memory integrity score
    pub memory_integrity: f32,
    /// Value alignment score
    pub value_alignment: f32,
    /// Warning messages
    pub warnings: Vec<String>,
    /// Timestamp
    pub timestamp: SystemTime,
}

/// Configuration for a component
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentConfig {
    /// Component name
    pub name: String,
    /// Component version
    pub version: String,
    /// Configuration parameters
    pub parameters: HashMap<String, String>,
    /// Dependencies
    pub dependencies: Vec<String>,
}

/// Resource usage metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceUsage {
    /// CPU usage percentage
    pub cpu_percent: f32,
    /// Memory usage in bytes
    pub memory_bytes: u64,
    /// Disk usage in bytes
    pub disk_bytes: u64,
    /// Network usage in bytes
    pub network_bytes: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_creation() {
        let event = Event {
            id: PhoenixId([0; 32]),
            timestamp: SystemTime::now(),
            data: "test data",
            metadata: HashMap::new(),
        };

        assert_eq!(event.data, "test data");
    }

    #[test]
    fn test_verified_data() {
        let verified = Verified {
            data: 42,
            signature: vec![1, 2, 3],
            verified_at: SystemTime::now(),
        };

        assert_eq!(verified.data, 42);
    }

    #[test]
    fn test_consensus_decision() {
        let consensus = Consensus {
            decision: true,
            votes: vec![
                Vote {
                    decision: true,
                    confidence: 0.8,
                    reasoning: "Good idea".to_string(),
                },
                Vote {
                    decision: true,
                    confidence: 0.9,
                    reasoning: "Safe choice".to_string(),
                },
            ],
            confidence: 0.85,
            justification: "Consensus reached".to_string(),
        };

        assert!(consensus.decision);
        assert!(consensus.confidence > 0.8);
    }

    #[test]
    fn test_component_status() {
        let mut health = HealthCheck {
            score: 0.95,
            components: HashMap::new(),
            memory_integrity: 0.99,
            value_alignment: 0.98,
            warnings: Vec::new(),
            timestamp: SystemTime::now(),
        };

        health
            .components
            .insert("test".to_string(), ComponentStatus::Healthy);
        assert_eq!(health.components["test"], ComponentStatus::Healthy);
    }
}
