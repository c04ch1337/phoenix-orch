//! Shared Type Definitions for OrchestratorAgent
//!
//! This module contains type definitions shared across the OrchestratorAgent implementation.

use std::collections::HashMap;
use std::fmt;
use std::time::SystemTime;
use serde::{Serialize, Deserialize};

use crate::modules::orchestrator::tools::ToolParameters;

/// Unique identifier for a request
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct RequestId(pub String);

impl RequestId {
    /// Create a new unique request ID
    pub fn new() -> Self {
        use uuid::Uuid;
        Self(Uuid::new_v4().to_string())
    }
    
    /// Get the string representation of the request ID
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for RequestId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Origin of a request
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum RequestOrigin {
    /// Request originated from a user
    User,
    
    /// Request originated from the system
    System,
    
    /// Request originated from a tool (with tool name)
    Tool(String),
}

impl fmt::Display for RequestOrigin {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RequestOrigin::User => write!(f, "User"),
            RequestOrigin::System => write!(f, "System"),
            RequestOrigin::Tool(name) => write!(f, "Tool({})", name),
        }
    }
}

/// Request to the conscience gate for ethical evaluation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConscienceRequest {
    /// Unique request identifier
    pub id: RequestId,
    
    /// Action being requested
    pub action: String,
    
    /// Tool ID being used
    pub tool_id: String,
    
    /// Parameters for the tool
    pub parameters: ToolParameters,
    
    /// Additional context for the request
    pub context: HashMap<String, String>,
    
    /// Timestamp when the request was created
    pub timestamp: SystemTime,
    
    /// Origin of the request
    pub origin: RequestOrigin,
}

/// Result of a conscience evaluation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConscienceResult {
    /// Whether the request is approved
    pub approved: bool,
    
    /// Confidence in the decision (0-1)
    pub confidence: f32,
    
    /// Justification for the decision
    pub justification: String,
    
    /// Warnings about the request
    pub warnings: Vec<String>,
    
    /// Ethical violations detected
    pub violations: Vec<String>,
    
    /// Whether human review is required
    pub requires_human_review: bool,
    
    /// Detailed reasoning for the decision
    pub reasoning: Option<String>,
    
    /// Risk level assessment
    pub risk_level: RiskLevel,
}

/// Risk level assessment for a request
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RiskLevel {
    /// Low risk - minimal ethical concerns
    Low,
    
    /// Medium risk - some ethical concerns
    Medium,
    
    /// High risk - significant ethical concerns
    High,
    
    /// Critical risk - severe ethical concerns
    Critical,
}

impl fmt::Display for RiskLevel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RiskLevel::Low => write!(f, "Low"),
            RiskLevel::Medium => write!(f, "Medium"),
            RiskLevel::High => write!(f, "High"),
            RiskLevel::Critical => write!(f, "Critical"),
        }
    }
}

/// Human-In-The-Middle (HITM) review status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HitmStatus {
    /// Review pending - waiting for human input
    Pending,
    
    /// Review approved by human
    Approved,
    
    /// Review rejected by human
    Rejected,
    
    /// Review timed out
    TimedOut,
}

impl fmt::Display for HitmStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            HitmStatus::Pending => write!(f, "Pending"),
            HitmStatus::Approved => write!(f, "Approved"),
            HitmStatus::Rejected => write!(f, "Rejected"),
            HitmStatus::TimedOut => write!(f, "TimedOut"),
        }
    }
}

/// Human-In-The-Middle (HITM) review response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HitmResponse {
    /// Request ID being reviewed
    pub request_id: RequestId,
    
    /// Review status
    pub status: HitmStatus,
    
    /// Reviewer comments
    pub comments: Option<String>,
    
    /// Timestamp of the review
    pub timestamp: SystemTime,
    
    /// Reviewer identifier (if available)
    pub reviewer_id: Option<String>,
}

/// Audit record for a conscience decision
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditRecord {
    /// Request that was evaluated
    pub request: ConscienceRequest,
    
    /// Result of the evaluation
    pub result: ConscienceResult,
    
    /// HITM review response (if any)
    pub hitm_response: Option<HitmResponse>,
    
    /// Timestamp of the audit record
    pub timestamp: SystemTime,
}

/// Response format for orchestrator task results.
/// This struct is used by the Tauri commands to provide consistent
/// responses to the frontend for task invocation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskResponse {
    /// Whether the task was successful
    pub success: bool,
    /// Result of the task execution (if successful)
    pub result: Option<String>,
    /// Error message (if unsuccessful)
    pub error: Option<String>,
    /// Whether human review is required
    pub requires_human_review: bool,
    /// Request ID for tracking
    pub request_id: String,
}

impl Default for TaskResponse {
    fn default() -> Self {
        Self {
            success: false,
            result: None,
            error: None,
            requires_human_review: false,
            request_id: RequestId::new().to_string(),
        }
    }
}