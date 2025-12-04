use std::error::Error;
use async_trait::async_trait;
use serde::{Serialize, Deserialize};
use tokio::time::{Duration, sleep};
use tracing::{info, warn, error};

pub mod common;
pub mod email;
pub mod ticketing;
pub mod security;
pub mod network;
pub mod knowledge;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationConfig {
    pub api_endpoint: String,
    pub client_id: String,
    pub client_secret: String,
    pub refresh_token: Option<String>,
    pub rate_limit: Option<u32>,
    pub timeout: Option<Duration>,
}

#[derive(Debug)]
pub struct IntegrationError {
    pub code: String,
    pub message: String,
    pub source: Option<Box<dyn Error + Send + Sync>>,
}

#[async_trait]
pub trait ExternalToolIntegration: Send + Sync {
    /// Initialize the integration with the provided configuration
    async fn initialize(&mut self, config: IntegrationConfig) -> Result<(), IntegrationError>;
    
    /// Authenticate with the external service
    async fn authenticate(&mut self) -> Result<(), IntegrationError>;
    
    /// Refresh authentication tokens if supported
    async fn refresh_auth(&mut self) -> Result<(), IntegrationError>;
    
    /// Check the health/status of the integration
    async fn health_check(&self) -> Result<bool, IntegrationError>;
    
    /// Clean up any resources used by the integration
    async fn shutdown(&mut self) -> Result<(), IntegrationError>;
}

// Common retry mechanism with exponential backoff
pub async fn retry_with_backoff<F, T, E>(
    operation: F,
    max_retries: u32,
    initial_delay: Duration,
) -> Result<T, E>
where
    F: Fn() -> Result<T, E> + Send,
    E: std::fmt::Debug,
{
    let mut retries = 0;
    let mut delay = initial_delay;

    loop {
        match operation() {
            Ok(value) => return Ok(value),
            Err(err) => {
                if retries >= max_retries {
                    return Err(err);
                }
                warn!("Operation failed, retrying in {:?}. Error: {:?}", delay, err);
                sleep(delay).await;
                delay *= 2;
                retries += 1;
            }
        }
    }
}