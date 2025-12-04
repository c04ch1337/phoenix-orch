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

    #[error("Disk encryption error: {0}")]
    DiskEncryptionError(String),

    #[error("Command parsing error: {0}")]
    CommandParsingError(String),

    #[error("Conscience gate error: {0}")]
    ConscienceGateError(String),

    #[error("Unrecognized command: {0}")]
    UnrecognizedCommand(String),

    #[error("Repository not found: {0}")]
    RepositoryNotFound(String),

    #[error("Entry not found: {0}")]
    EntryNotFound(String),

    #[error("Invalid regex: {0}")]
    InvalidRegex(String),

    #[error("Knowledge base error: {0}")]
    KnowledgeBaseError(String),
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

    /// Create a new disk encryption error
    pub fn disk_encryption(msg: impl Into<String>) -> Self {
        Self::DiskEncryptionError(msg.into())
    }

    /// Create a new command parsing error
    pub fn command_parsing(msg: impl Into<String>) -> Self {
        Self::CommandParsingError(msg.into())
    }

    /// Create a new conscience gate error
    pub fn conscience_gate(msg: impl Into<String>) -> Self {
        Self::ConscienceGateError(msg.into())
    }

    /// Create a new unrecognized command error
    pub fn unrecognized_command(msg: impl Into<String>) -> Self {
        Self::UnrecognizedCommand(msg.into())
    }

    /// Create a new repository not found error
    pub fn repository_not_found(name: impl Into<String>) -> Self {
        Self::RepositoryNotFound(name.into())
    }

    /// Create a new entry not found error
    pub fn entry_not_found(id: impl Into<String>) -> Self {
        Self::EntryNotFound(id.into())
    }

    /// Create a new invalid regex error
    pub fn invalid_regex(msg: impl Into<String>) -> Self {
        Self::InvalidRegex(msg.into())
    }

    /// Create a new knowledge base error
    pub fn knowledge_base(msg: impl Into<String>) -> Self {
        Self::KnowledgeBaseError(msg.into())
    }
}

/// Result type for Cipher Guard operations
pub type Result<T> = std::result::Result<T, CipherGuardError>;