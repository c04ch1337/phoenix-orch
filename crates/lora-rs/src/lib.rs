use thiserror::Error;

#[derive(Debug, Error)]
pub enum LoraError {
    #[error("LoRA operation failed: {0}")]
    OperationFailed(String),
}

pub trait LoraAdapter {
    fn apply(&self) -> Result<(), LoraError>;
}

pub struct NoOpLoraAdapter;

impl LoraAdapter for NoOpLoraAdapter {
    fn apply(&self) -> Result<(), LoraError> {
        Ok(()) // No-op implementation
    }
}
