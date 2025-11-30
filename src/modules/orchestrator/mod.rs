//! OrchestratorAgent Module
//!
//! This module contains the implementation of the OrchestratorAgent, which serves
//! as the central coordinating agent for Phoenix Marie.

// Export module structure
pub mod agent;
pub mod context;
pub mod conscience;
pub mod errors;
pub mod tauri;
pub mod tools;
pub mod types;
pub mod vector;

#[cfg(test)]
pub mod tests;

// Re-export key types for convenience
pub use agent::OrchestratorAgent;
pub use tools::{Tool, ToolRegistry, ToolParameters, ToolResult, BoxedTool};
pub use errors::{PhoenixResult, PhoenixError, AgentErrorKind};
pub use types::{
    ConscienceRequest, ConscienceResult, RequestId, RequestOrigin,
    RiskLevel, HitmStatus, HitmResponse, AuditRecord
};
pub use conscience::{HitmConfig, HitmTimeoutAction, ConscienceConfig, HumanReviewService};
pub use tauri::{invoke_orchestrator_task, submit_reviewed_task, register_commands};

// Re-export tool_registry macro
pub use crate::tool_registry;