//! Phoenix ORCH Library
//!
//! This library contains the core modules for Phoenix ORCH.

pub mod modules;

// Re-export for convenience
pub use modules::orchestrator::{
    OrchestratorAgent,
    OrchestratorConfig,
    SystemConfig,
    VectorSearchConfig,
    ConscienceConfig,
};

