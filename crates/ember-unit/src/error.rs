use thiserror::Error;

/// Error types for Ember Unit operations
#[derive(Debug, Error)]
pub enum EmberUnitError {
    #[error("Engagement error: {0}")]
    EngagementError(String),
    
    #[error("C2 Orchestrator error: {0}")]
    C2Error(String),
    
    #[error("Agent spawn error: {0}")]
    AgentError(String),
    
    #[error("Safety violation: {0}")]
    SafetyViolation(String),
    
    #[error("Conscience violation: {0}")]
    ConscienceViolation(String),
    
    #[error("Conscience error: {0}")]
    ConscienceError(String),
    
    #[error("Integration error: {0}")]
    IntegrationError(String),
    
    #[error("Reporting error: {0}")]
    ReportingError(String),
    
    #[error("Network error: {0}")]
    NetworkError(String),
    
    #[error("Database error: {0}")]
    DatabaseError(String),
    
    #[error("Configuration error: {0}")]
    ConfigError(String),
    
    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl From<std::io::Error> for EmberUnitError {
    fn from(err: std::io::Error) -> Self {
        EmberUnitError::NetworkError(err.to_string())
    }
}

impl From<serde_json::Error> for EmberUnitError {
    fn from(err: serde_json::Error) -> Self {
        EmberUnitError::IntegrationError(err.to_string())
    }
}

impl From<uuid::Error> for EmberUnitError {
    fn from(err: uuid::Error) -> Self {
        EmberUnitError::ConfigError(err.to_string())
    }
}