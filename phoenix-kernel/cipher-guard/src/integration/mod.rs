mod ember;

pub use ember::{EmberUnitIntegration, EmberUnitConfig};

use std::error::Error;
use std::fmt;

#[derive(Debug)]
pub enum IntegrationError {
    Connection(String),
    Authentication(String),
    Communication(String),
    InvalidResponse(String),
}

impl Error for IntegrationError {}

impl fmt::Display for IntegrationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            IntegrationError::Connection(msg) => write!(f, "Connection error: {}", msg),
            IntegrationError::Authentication(msg) => write!(f, "Authentication error: {}", msg),
            IntegrationError::Communication(msg) => write!(f, "Communication error: {}", msg),
            IntegrationError::InvalidResponse(msg) => write!(f, "Invalid response: {}", msg),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc;
    use crate::Threat;

    #[tokio::test]
    async fn test_ember_unit_config() {
        let (tx, _rx) = mpsc::channel::<Threat>(100);
        
        let config = EmberUnitConfig {
            base_url: "http://localhost:8080".to_string(),
            api_key: "test_key".to_string(),
            ws_url: "ws://localhost:8080/ws/ember-unit".to_string(),
        };

        let _integration = EmberUnitIntegration::new(config, tx);
        // Integration tests would go here
    }
}