use std::sync::{Arc, RwLock};
use crate::modules::orchestrator::{
    OrchestratorAgent,
    OrchestratorConfig,
    SystemConfig,
    VectorSearchConfig,
    ConscienceConfig,
};

/// OrchestratorModule provides a wrapper for the OrchestratorAgent
/// that can be integrated with the Tauri application state.
pub struct OrchestratorModule {
    /// The agent instance that handles orchestration tasks
    agent: Option<Arc<OrchestratorAgent>>,
}

impl OrchestratorModule {
    /// Create a new OrchestratorModule instance.
    pub fn new() -> Self {
        Self {
            agent: None,
        }
    }
    
    /// Initialize the OrchestratorAgent asynchronously.
    /// This method should be called during the Tauri setup phase.
    pub async fn initialize(&mut self) -> Result<(), String> {
        // Default configuration for the orchestrator agent
        let config = OrchestratorConfig {
            system_config: SystemConfig::default(),
            vector_config: VectorSearchConfig {
                model_type: "simple".to_string(),
                model_path: std::path::PathBuf::new(),
                dimensions: 128,
            },
            conscience_config: ConscienceConfig::default(),
            history_capacity: 1000,
            default_search_limit: 10,
        };
        
        // Initialize the orchestrator agent
        match OrchestratorAgent::new(config).await {
            Ok(agent) => {
                self.agent = Some(Arc::new(agent));
                Ok(())
            },
            Err(e) => {
                log::error!("Failed to initialize OrchestratorAgent: {}", e);
                Err(format!("Failed to initialize OrchestratorAgent: {}", e))
            }
        }
    }
    
    /// Get a reference to the OrchestratorAgent.
    pub fn get_agent(&self) -> Result<Arc<OrchestratorAgent>, String> {
        self.agent.clone()
            .ok_or_else(|| "OrchestratorAgent not initialized".to_string())
    }
    
    /// Get the status of the orchestrator module.
    pub fn get_status(&self) -> serde_json::Value {
        let initialized = self.agent.is_some();
        serde_json::json!({
            "initialized": initialized,
            "status": if initialized { "active" } else { "inactive" },
        })
    }
    
    /// Validate the state of the orchestrator module.
    pub fn validate_state(&self) -> Result<bool, String> {
        if self.agent.is_none() {
            return Err("OrchestratorAgent not initialized".to_string());
        }
        
        Ok(true)
    }
}