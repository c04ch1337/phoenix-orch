// Export all modules for use in main.rs
pub mod cipher;
pub mod ember;
pub mod orchestrator;  // This is a wrapper that bridges to root orchestrator
pub mod security;
pub mod state;
pub mod sse;

// Re-export types that are commonly used
pub use state::AppState;
pub use sse::SseServer;
pub use orchestrator::OrchestratorModule;