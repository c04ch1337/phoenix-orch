//! OrchestratorAgent Module
//!
//! This module contains the implementation of the OrchestratorAgent, which serves
//! as the central coordinating agent for Phoenix Marie.

// Export module structure
pub mod agent;
pub mod context;
pub mod conscience;
pub mod errors;
pub mod model_router;
pub mod security;
pub mod tauri;
// tools.rs contains the ToolRegistry implementation
pub mod tools as tool_registry;
pub mod tools {
    pub mod chat;
}
pub mod types;
pub mod vector;

// Antigravity Mission Control integration
pub mod antigravity_core;
pub mod agent_manager;
pub mod artifacts;
pub mod planner;
pub mod modes;
pub mod browser_agent;
pub mod terminal_agent;
pub mod workflows;

#[cfg(test)]
pub mod tests;

pub mod examples;

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

// Antigravity re-exports
pub use antigravity_core::{
    AntigravityCore,
    AntigravityCoreConfig,
    AgentType,
    AgentInfo,
    AgentStatus,
    TaskInfo,
    TaskStatus,
    AntigravityEvent,
    AgentCommand,
    AgentResponse
};
pub use browser_agent::{
    BrowserAgent,
    BrowserAgentConfig,
    BrowserAction,
    BrowserSessionResult
};
pub use terminal_agent::{
    TerminalAgent,
    TerminalAgentConfig,
    TerminalCommand,
    CommandResult,
    TerminalAutonomyLevel,
    CommandStatus,
    CommandRiskLevel,
    CommandApprovalRequest,
    CommandApprovalResponse
};
pub use modes::{
    OperationModes,
    ModesConfig,
    OperatingMode,
    AutonomyPermissions,
    ModeEvent,
    process_fast_mode_command,
    process_workflow_command
};
pub use agent_manager::{
    AgentManager,
    AgentManagerConfig,
    AgentOperationResponse
};
pub use artifacts::{
    ArtifactSystem,
    ArtifactSystemConfig,
    ArtifactType,
    ArtifactInfo,
    ArtifactComment,
    ArtifactEvent
};
pub use planner::{
    Planner,
    PlannerConfig,
    PlanInfo,
    PlanState,
    PlanStep,
    StepStatus,
    FeedbackAction,
    PlanEvent,
    TimeoutAction
};
pub use conscience::{HitmConfig, HitmTimeoutAction, ConscienceConfig, HumanReviewService};
pub use workflows::{
    Workflow, 
    WorkflowStep, 
    WorkflowParameter, 
    ParameterType,
    WorkflowRegistry, 
    WorkflowLoader, 
    WorkflowExecutor,
    WorkflowError,
    init as init_workflows,
    save_completed_task,
    execute_workflow,
    list_workflows,
    get_workflow_details
};
pub use tauri::{
    invoke_orchestrator_task, 
    submit_reviewed_task, 
    register_commands,
    filesystem_list_drives,
    filesystem_read_file,
    filesystem_write_file,
    filesystem_list_directory,
    filesystem_search_files,
    filesystem_create_directory,
    filesystem_create_file,
    filesystem_delete_item,
};

// Security module re-exports
pub use security::pentest_access_control::{
    AccessLevel,
    OperationType,
    Scope,
    AccessToken,
    ConsentRecord,
    PentestAccessControls,
    AuthorizationResponse,
    AuthorizationDecision
};

// Re-export tool_registry macro
pub use crate::tool_registry;