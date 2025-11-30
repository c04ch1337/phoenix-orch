use thiserror::Error;

/// Cipher Guard specific error types
#[derive(Error, Debug)]
pub enum CipherGuardError {
    #[error("Database error: {0}")]
    DatabaseError(#[from] rusqlite::Error),

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("Network error: {0}")]
    NetworkError(#[from] reqwest::Error),

    #[error("Encryption error: {0}")]
    EncryptionError(String),

    #[error("Evidence validation failed: {0}")]
    EvidenceValidationError(String),

    #[error("Chain of custody violation: {0}")]
    ChainOfCustodyError(String),

    #[error("Agent orchestration error: {0}")]
    AgentOrchestrationError(String),

    #[error("Report generation error: {0}")]
    ReportGenerationError(String),

    #[error("Integration error: {0}")]
    IntegrationError(String),

    #[error("Authentication error: {0}")]
    AuthenticationError(String),

    #[error("Authorization error: {0}")]
    AuthorizationError(String),

    #[error("Resource not found: {0}")]
    NotFoundError(String),

    #[error("Invalid input: {0}")]
    InvalidInputError(String),

    #[error("Configuration error: {0}")]
    ConfigurationError(String),

    #[error("Timeout error: {0}")]
    TimeoutError(String),

    #[error("Internal error: {0}")]
    InternalError(String),
}

impl CipherGuardError {
    /// Create a new encryption error
    pub fn encryption(msg: impl Into<String>) -> Self {
        Self::EncryptionError(msg.into())
    }

    /// Create a new evidence validation error
    pub fn evidence_validation(msg: impl Into<String>) -> Self {
        Self::EvidenceValidationError(msg.into())
    }

    /// Create a new chain of custody error
    pub fn chain_of_custody(msg: impl Into<String>) -> Self {
        Self::ChainOfCustodyError(msg.into())
    }

    /// Create a new agent orchestration error
    pub fn agent_orchestration(msg: impl Into<String>) -> Self {
        Self::AgentOrchestrationError(msg.into())
    }

    /// Create a new report generation error
    pub fn report_generation(msg: impl Into<String>) -> Self {
        Self::ReportGenerationError(msg.into())
    }

    /// Create a new integration error
    pub fn integration(msg: impl Into<String>) -> Self {
        Self::IntegrationError(msg.into())
    }
}

/// Result type for Cipher Guard operations
pub type Result<T> = std::result::Result<T, CipherGuardError>;