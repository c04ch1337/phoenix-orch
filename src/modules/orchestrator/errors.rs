//! OrchestratorAgent Error Types
//!
//! This module defines error types used by the OrchestratorAgent.

/// Result type for Phoenix operations
pub type PhoenixResult<T> = std::result::Result<T, PhoenixError>;

/// Error types for Phoenix operations
#[derive(Debug)]
pub enum PhoenixError {
    /// Agent-related errors
    Agent {
        /// Type of agent error
        kind: AgentErrorKind,
        /// Error message
        message: String,
        /// Component that generated the error
        component: String,
    },
    // Add other error types as needed
}

/// Types of agent errors
#[derive(Debug, PartialEq)]
pub enum AgentErrorKind {
    /// Request was rejected due to ethical/security concerns
    RequestRejected,
    /// Human review is required for this request
    HumanReviewRequired,
    /// Invalid parameters provided
    InvalidParameters,
    /// Tool not found
    ToolNotFound,
    /// Serialization error
    SerializationError,
    // Add other error kinds as needed
}