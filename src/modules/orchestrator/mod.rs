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
// tools.rs contains the ToolRegistry implementation
pub mod tools as tool_registry;
pub mod tools {
    pub mod chat;
}
pub mod types;
pub mod vector;

#[cfg(test)]
pub mod tests;

// Re-export key types for convenience
pub use agent::OrchestratorAgent;
pub use tool_registry::{Tool, ToolRegistry, ToolParameters, ToolResult, BoxedTool, ToolExecutionContext};

// Re-export tool types under tools:: for backward compatibility
pub mod tools {
    pub use super::tool_registry::{Tool, ToolParameters, ToolResult, BoxedTool};
    pub mod chat {
        pub use super::super::tools::chat::ChatTool;
    }
}
pub use errors::{PhoenixResult, PhoenixError, AgentErrorKind};
pub use types::{
    ConscienceRequest, ConscienceResult, RequestId, RequestOrigin,
    RiskLevel, HitmStatus, HitmResponse, AuditRecord
};
pub use conscience::{HitmConfig, HitmTimeoutAction, ConscienceConfig, HumanReviewService};
pub use tauri::{invoke_orchestrator_task, submit_reviewed_task, register_commands};

// Re-export tool_registry macro
pub use crate::tool_registry;