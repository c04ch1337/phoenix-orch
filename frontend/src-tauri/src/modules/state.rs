use super::{
    cipher::CipherModule,
    ember::EmberModule,
    orchestrator::OrchestratorModule,
    security::SecurityModule,
};

/// AppState serves as the central state container for the application,
/// providing dependency injection and avoiding circular dependencies
/// through interface-based communication between modules.
pub struct AppState {
    pub cipher: CipherModule,
    pub ember: EmberModule,
    pub orchestrator: OrchestratorModule,
    pub security: SecurityModule,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            cipher: CipherModule::new(),
            ember: EmberModule::new(),
            orchestrator: OrchestratorModule::new(),
            security: SecurityModule::new(),
        }
    }
    
    // This method is used to validate the global state integrity
    pub fn validate_global_state(&self) -> Result<bool, String> {
        // First check security integrity
        self.security.validate_memory_integrity()?;
        
        // Then check cipher state
        self.cipher.validate_state()?;
        
        // Check orchestrator state
        self.orchestrator.validate_state()?;
        
        // Finally check ember unit state
        self.ember.validate_state()?;
        
        Ok(true)
    }
    
    // Get system health information as JSON
    pub fn get_health_info(&self) -> Result<String, String> {
        let health_data = serde_json::json!({
            "cipher_status": self.cipher.get_status(),
            "ember_status": self.ember.get_status(),
            "orchestrator_status": self.orchestrator.get_status(),
            "security_status": self.security.get_status(),
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });
        
        serde_json::to_string(&health_data)
            .map_err(|e| format!("Failed to serialize health data: {}", e))
    }
}