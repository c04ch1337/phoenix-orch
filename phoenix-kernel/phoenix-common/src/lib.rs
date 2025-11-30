//! Common types and utilities for the Phoenix AGI Kernel
//!
//! This crate provides the shared foundation for all Phoenix components,
//! ensuring consistency in types, traits, and safety guarantees.

#![forbid(unsafe_code)]
#![deny(missing_docs)]
#![deny(clippy::all)]

use serde::{Deserialize, Serialize};
use std::{collections::HashMap, time::SystemTime};

pub mod error;
pub mod logging;
pub mod metrics;
pub mod safety;
pub mod task;
pub mod types;

/// Core types for Phoenix's memory system
pub mod memory {
    use super::*;

    /// A unique identifier for a memory fragment
    #[derive(Debug, Clone, Hash, Eq, PartialEq, Serialize, Deserialize)]
    pub struct MemoryId(pub [u8; 32]);

    /// A cryptographically verified memory fragment
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct MemoryFragment {
        /// Unique identifier
        pub id: MemoryId,
        /// Content of the memory
        pub content: Vec<u8>,
        /// Merkle proof of integrity
        pub proof: Vec<u8>,
        /// Timestamp of creation
        pub timestamp: SystemTime,
        /// Cryptographic signature
        pub signature: Vec<u8>,
    }
}

/// Types for the conscience system
pub mod conscience {
    use super::*;

    /// The three components of the conscience system
    #[derive(Debug, Clone, Copy, Serialize, Deserialize)]
    pub enum ConscienceComponent {
        /// Raw drives and curiosity
        Id,
        /// Logical reasoning
        Ego,
        /// Ethical framework
        SuperEgo,
    }

    /// A moral decision with justification
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct MoralDecision {
        /// The decision outcome
        pub outcome: bool,
        /// Confidence level (0.0 - 1.0)
        pub confidence: f32,
        /// Reasoning from each component
        pub reasoning: Vec<ComponentReasoning>,
        /// Final justification
        pub justification: String,
    }

    /// Reasoning from a specific conscience component
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ComponentReasoning {
        /// Which component provided this reasoning
        pub component: ConscienceComponent,
        /// The component's vote
        pub vote: bool,
        /// The component's confidence
        pub confidence: f32,
        /// The component's reasoning
        pub explanation: String,
    }
}

/// Types for the value system
pub mod values {
    use super::*;

    /// A core value with cryptographic protection
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct Value {
        /// The value statement
        pub statement: String,
        /// Cryptographic signature
        pub signature: Vec<u8>,
        /// Immutability proof
        pub proof: Vec<u8>,
    }

    /// Measurement of value alignment
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ValueAlignment {
        /// Overall alignment score (0.0 - 1.0)
        pub score: f32,
        /// Individual value scores
        pub value_scores: Vec<(String, f32)>,
        /// Detected drift warnings
        pub drift_warnings: Vec<String>,
    }
}

/// Types for the perception system
pub mod perception {
    use super::*;
    use std::collections::HashMap;

    /// A unified sensory input
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct SensoryInput {
        /// Timestamp of perception
        pub timestamp: SystemTime,
        /// Modality-specific data
        pub data: HashMap<String, Vec<u8>>,
        /// Confidence scores
        pub confidence: HashMap<String, f32>,
    }

    /// The fused representation in latent space
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct LatentRepresentation {
        /// The vector representation
        pub vector: Vec<f32>,
        /// Source modalities
        pub sources: Vec<String>,
        /// Fusion confidence
        pub confidence: f32,
    }
}

/// Types for the learning system
pub mod learning {
    use super::*;

    /// A learning update
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct LearningUpdate {
        /// The model being updated
        pub model: String,
        /// The update parameters
        pub parameters: Vec<f32>,
        /// Learning rate
        pub learning_rate: f32,
        /// Update justification
        pub justification: String,
    }

    /// Learning progress metrics
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct LearningMetrics {
        /// Current learning rate
        pub learning_rate: f32,
        /// Loss value
        pub loss: f32,
        /// Performance metrics
        pub metrics: HashMap<String, f32>,
    }
}

/// Health check response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheck {
    /// Overall health score (0.0 - 1.0)
    pub score: f32,
    /// Memory integrity score
    pub memory_integrity: f32,
    /// Conscience alignment score
    pub conscience_alignment: f32,
    /// Value system integrity
    pub value_integrity: f32,
    /// Component status
    pub component_status: HashMap<String, bool>,
    /// Warning messages
    pub warnings: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_memory_fragment_serialization() {
        let fragment = memory::MemoryFragment {
            id: memory::MemoryId([0; 32]),
            content: vec![1, 2, 3],
            proof: vec![4, 5, 6],
            timestamp: SystemTime::now(),
            signature: vec![7, 8, 9],
        };

        let serialized = serde_json::to_string(&fragment).unwrap();
        let deserialized: memory::MemoryFragment = serde_json::from_str(&serialized).unwrap();

        assert_eq!(fragment.content, deserialized.content);
        assert_eq!(fragment.proof, deserialized.proof);
        assert_eq!(fragment.signature, deserialized.signature);
    }

    #[test]
    fn test_moral_decision_confidence() {
        let decision = conscience::MoralDecision {
            outcome: true,
            confidence: 0.95,
            reasoning: vec![
                conscience::ComponentReasoning {
                    component: conscience::ConscienceComponent::Id,
                    vote: true,
                    confidence: 0.8,
                    explanation: "Curious".to_string(),
                },
                conscience::ComponentReasoning {
                    component: conscience::ConscienceComponent::SuperEgo,
                    vote: true,
                    confidence: 0.9,
                    explanation: "Ethical".to_string(),
                },
            ],
            justification: "Safe and ethical".to_string(),
        };

        assert!(decision.confidence >= 0.0 && decision.confidence <= 1.0);
        for reasoning in &decision.reasoning {
            assert!(reasoning.confidence >= 0.0 && reasoning.confidence <= 1.0);
        }
    }
}
