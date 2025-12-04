use async_trait::async_trait;
use serde::{Serialize, Deserialize};
use tracing::{info, warn, error};
use std::collections::HashMap;

use crate::modules::orchestrator::cipher_guard::integrations::{
    ExternalToolIntegration,
    IntegrationConfig,
    IntegrationError,
    common::{TokenManager, HttpClient, WebhookHandler},
};

// Zscaler Integration
#[derive(Debug, Serialize, Deserialize)]
pub struct ZscalerPolicy {
    pub id: String,
    pub name: String,
    pub order: u32,
    pub action: String,
    pub protocols: Vec<String>,
    pub locations: Vec<String>,
    pub departments: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ZscalerSecurityAlert {
    pub alert_id: String,
    pub type_: String,
    pub severity: String,
    pub source_ip: String,
    pub destination: String,
    pub timestamp: String,
    pub details: String,
}

pub struct ZscalerIntegration {
    config: Option<IntegrationConfig>,
    token_manager: Option<TokenManager>,
    http_client: Option<HttpClient>,
    webhook_handler: Option<WebhookHandler>,
}

impl ZscalerIntegration {
    pub fn new() -> Self {
        Self {
            config: None,
            token_manager: None,
            http_client: None,
            webhook_handler: None,
        }
    }

    pub async fn create_policy(&self, policy: ZscalerPolicy) -> Result<String, IntegrationError> {
        let client = self.http_client.as_ref().ok_or(IntegrationError {
            code: "NOT_INITIALIZED".to_string(),
            message: "HTTP client not initialized".to_string(),
            source: None,
        })?;

        let token = self.token_manager.as_ref()
            .ok_or(IntegrationError {
                code: "NO_TOKEN_MANAGER".to_string(),
                message: "Token manager not initialized".to_string(),
                source: None,
            })?
            .get_valid_token()
            .await?;

        let response = client.request(
            reqwest::Method::POST,
            "/api/v1/policies",
            Some(&policy),
            Some(&token),
        ).await?;

        #[derive(Deserialize)]
        struct PolicyResponse {
            id: String,
        }

        let policy_response = response.json::<PolicyResponse>().await
            .map_err(|e| IntegrationError {
                code: "PARSE_ERROR".to_string(),
                message: "Failed to parse Zscaler policy response".to_string(),
                source: Some(Box::new(e)),
            })?;

        info!("Zscaler policy created successfully: {}", policy_response.id);
        Ok(policy_response.id)
    }

    pub async fn get_security_alerts(&self) -> Result<Vec<ZscalerSecurityAlert>, IntegrationError> {
        let client = self.http_client.as_ref().ok_or(IntegrationError {
            code: "NOT_INITIALIZED".to_string(),
            message: "HTTP client not initialized".to_string(),
            source: None,
        })?;

        let token = self.token_manager.as_ref()
            .ok_or(IntegrationError {
                code: "NO_TOKEN_MANAGER".to_string(),
                message: "Token manager not initialized".to_string(),
                source: None,
            })?
            .get_valid_token()
            .await?;

        let response = client.request(
            reqwest::Method::GET,
            "/api/v1/security/alerts",
            None::<&()>,
            Some(&token),
        ).await?;

        response.json::<Vec<ZscalerSecurityAlert>>().await.map_err(|e| IntegrationError {
            code: "PARSE_ERROR".to_string(),
            message: "Failed to parse Zscaler security alerts".to_string(),
            source: Some(Box::new(e)),
        })
    }
}

#[async_trait]
impl ExternalToolIntegration for ZscalerIntegration {
    async fn initialize(&mut self, config: IntegrationConfig) -> Result<(), IntegrationError> {
        self.config = Some(config.clone());
        
        // Initialize token manager
        let token_info = TokenManager::new(
            serde_json::from_str(&config.client_secret).map_err(|e| IntegrationError {
                code: "TOKEN_INIT_ERROR".to_string(),
                message: "Failed to parse initial token info".to_string(),
                source: Some(Box::new(e)),
            })?,
            format!("{}/api/v1/authenticatedSession", config.api_endpoint),
            config.client_id.clone(),
            config.client_secret.clone(),
        );
        self.token_manager = Some(token_info);

        // Initialize HTTP client
        self.http_client = Some(HttpClient::new(
            config.api_endpoint,
            config.rate_limit.map(|limit| (limit, std::time::Duration::from_secs(60))),
        ));

        // Initialize webhook handler for alerts
        self.webhook_handler = Some(WebhookHandler::new(
            config.client_secret.clone(),
            Box::new(move |payload| {
                info!("Received Zscaler alert webhook: {:?}", payload);
                Ok(())
            }),
        ));

        info!("Zscaler integration initialized successfully");
        Ok(())
    }

    async fn authenticate(&mut self) -> Result<(), IntegrationError> {
        if let Some(token_manager) = &self.token_manager {
            token_manager.get_valid_token().await?;
            info!("Zscaler authentication successful");
            Ok(())
        } else {
            Err(IntegrationError {
                code: "NOT_INITIALIZED".to_string(),
                message: "Token manager not initialized".to_string(),
                source: None,
            })
        }
    }

    async fn refresh_auth(&mut self) -> Result<(), IntegrationError> {
        if let Some(token_manager) = &self.token_manager {
            token_manager.refresh_tokens().await?;
            info!("Zscaler tokens refreshed successfully");
            Ok(())
        } else {
            Err(IntegrationError {
                code: "NOT_INITIALIZED".to_string(),
                message: "Token manager not initialized".to_string(),
                source: None,
            })
        }
    }

    async fn health_check(&self) -> Result<bool, IntegrationError> {
        if let Some(client) = &self.http_client {
            if let Some(token_manager) = &self.token_manager {
                let token = token_manager.get_valid_token().await?;
                let response = client.request(
                    reqwest::Method::GET,
                    "/api/v1/status",
                    None::<&()>,
                    Some(&token),
                ).await?;
                
                Ok(response.status().is_success())
            } else {
                Err(IntegrationError {
                    code: "NOT_INITIALIZED".to_string(),
                    message: "Token manager not initialized".to_string(),
                    source: None,
                })
            }
        } else {
            Err(IntegrationError {
                code: "NOT_INITIALIZED".to_string(),
                message: "HTTP client not initialized".to_string(),
                source: None,
            })
        }
    }

    async fn shutdown(&mut self) -> Result<(), IntegrationError> {
        self.config = None;
        self.token_manager = None;
        self.http_client = None;
        self.webhook_handler = None;
        info!("Zscaler integration shut down successfully");
        Ok(())
    }
}

// Meraki Integration
#[derive(Debug, Serialize, Deserialize)]
pub struct MerakiNetwork {
    pub id: String,
    pub name: String,
    pub organization_id: String,
    pub type_: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MerakiDevice {
    pub serial: String,
    pub model: String,
    pub name: String,
    pub network_id: String,
    pub status: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MerakiFirewallRule {
    pub comment: String,
    pub policy: String,
    pub protocol: String,
    pub src_port: String,
    pub src_cidr: String,
    pub dest_port: String,
    pub dest_cidr: String,
    pub syslog_enabled: bool,
}

pub struct MerakiIntegration {
    config: Option<IntegrationConfig>,
    http_client: Option<HttpClient>,
}

impl MerakiIntegration {
    pub fn new() -> Self {
        Self {
            config: None,
            http_client: None,
        }
    }

    pub async fn get_networks(&self) -> Result<Vec<MerakiNetwork>, IntegrationError> {
        let client = self.http_client.as_ref().ok_or(IntegrationError {
            code: "NOT_INITIALIZED".to_string(),
            message: "HTTP client not initialized".to_string(),
            source: None,
        })?;

        let config = self.config.as_ref().ok_or(IntegrationError {
            code: "NOT_INITIALIZED".to_string(),
            message: "Configuration not initialized".to_string(),
            source: None,
        })?;

        let response = client.request(
            reqwest::Method::GET,
            "/api/v1/organizations/networks",
            None::<&()>,
            Some(&config.client_secret),
        ).await?;

        response.json::<Vec<MerakiNetwork>>().await.map_err(|e| IntegrationError {
            code: "PARSE_ERROR".to_string(),
            message: "Failed to parse Meraki networks".to_string(),
            source: Some(Box::new(e)),
        })
    }

    pub async fn create_firewall_rule(
        &self,
        network_id: &str,
        rule: MerakiFirewallRule,
    ) -> Result<(), IntegrationError> {
        let client = self.http_client.as_ref().ok_or(IntegrationError {
            code: "NOT_INITIALIZED".to_string(),
            message: "HTTP client not initialized".to_string(),
            source: None,
        })?;

        let config = self.config.as_ref().ok_or(IntegrationError {
            code: "NOT_INITIALIZED".to_string(),
            message: "Configuration not initialized".to_string(),
            source: None,
        })?;

        client.request(
            reqwest::Method::POST,
            &format!("/api/v1/networks/{}/l3FirewallRules", network_id),
            Some(&rule),
            Some(&config.client_secret),
        ).await?;

        info!("Meraki firewall rule created successfully for network: {}", network_id);
        Ok(())
    }
}

#[async_trait]
impl ExternalToolIntegration for MerakiIntegration {
    async fn initialize(&mut self, config: IntegrationConfig) -> Result<(), IntegrationError> {
        self.config = Some(config.clone());
        
        // Initialize HTTP client
        self.http_client = Some(HttpClient::new(
            config.api_endpoint,
            config.rate_limit.map(|limit| (limit, std::time::Duration::from_secs(60))),
        ));

        info!("Meraki integration initialized successfully");
        Ok(())
    }

    async fn authenticate(&mut self) -> Result<(), IntegrationError> {
        // Meraki uses API key authentication
        if self.config.is_some() {
            Ok(())
        } else {
            Err(IntegrationError {
                code: "NOT_INITIALIZED".to_string(),
                message: "Configuration not initialized".to_string(),
                source: None,
            })
        }
    }

    async fn refresh_auth(&mut self) -> Result<(), IntegrationError> {
        // No token refresh needed for API key authentication
        Ok(())
    }

    async fn health_check(&self) -> Result<bool, IntegrationError> {
        if let Some(client) = &self.http_client {
            if let Some(config) = &self.config {
                let response = client.request(
                    reqwest::Method::GET,
                    "/api/v1/organizations",
                    None::<&()>,
                    Some(&config.client_secret),
                ).await?;
                
                Ok(response.status().is_success())
            } else {
                Err(IntegrationError {
                    code: "NOT_INITIALIZED".to_string(),
                    message: "Configuration not initialized".to_string(),
                    source: None,
                })
            }
        } else {
            Err(IntegrationError {
                code: "NOT_INITIALIZED".to_string(),
                message: "HTTP client not initialized".to_string(),
                source: None,
            })
        }
    }

    async fn shutdown(&mut self) -> Result<(), IntegrationError> {
        self.config = None;
        self.http_client = None;
        info!("Meraki integration shut down successfully");
        Ok(())
    }
}

// Cisco Umbrella Integration
#[derive(Debug, Serialize, Deserialize)]
pub struct UmbrellaPolicy {
    pub id: String,
    pub name: String,
    pub description: String,
    pub security_settings: SecuritySettings,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SecuritySettings {
    pub block_page_enabled: bool,
    pub ip_logging_enabled: bool,
    pub categories: Vec<String>,
    pub security_categories: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UmbrellaActivity {
    pub timestamp: String,
    pub internal_ip: String,
    pub destination: String,
    pub action: String,
    pub policy_id: String,
    pub category: String,
}

pub struct CiscoUmbrellaIntegration {
    config: Option<IntegrationConfig>,
    token_manager: Option<TokenManager>,
    http_client: Option<HttpClient>,
}

impl CiscoUmbrellaIntegration {
    pub fn new() -> Self {
        Self {
            config: None,
            token_manager: None,
            http_client: None,
        }
    }

    pub async fn create_policy(&self, policy: UmbrellaPolicy) -> Result<String, IntegrationError> {
        let client = self.http_client.as_ref().ok_or(IntegrationError {
            code: "NOT_INITIALIZED".to_string(),
            message: "HTTP client not initialized".to_string(),
            source: None,
        })?;

        let token = self.token_manager.as_ref()
            .ok_or(IntegrationError {
                code: "NO_TOKEN_MANAGER".to_string(),
                message: "Token manager not initialized".to_string(),
                source: None,
            })?
            .get_valid_token()
            .await?;

        let response = client.request(
            reqwest::Method::POST,
            "/policies/v2/policies",
            Some(&policy),
            Some(&token),
        ).await?;

        #[derive(Deserialize)]
        struct PolicyResponse {
            id: String,
        }

        let policy_response = response.json::<PolicyResponse>().await
            .map_err(|e| IntegrationError {
                code: "PARSE_ERROR".to_string(),
                message: "Failed to parse Umbrella policy response".to_string(),
                source: Some(Box::new(e)),
            })?;

        info!("Umbrella policy created successfully: {}", policy_response.id);
        Ok(policy_response.id)
    }

    pub async fn get_security_activity(&self) -> Result<Vec<UmbrellaActivity>, IntegrationError> {
        let client = self.http_client.as_ref().ok_or(IntegrationError {
            code: "NOT_INITIALIZED".to_string(),
            message: "HTTP client not initialized".to_string(),
            source: None,
        })?;

        let token = self.token_manager.as_ref()
            .ok_or(IntegrationError {
                code: "NO_TOKEN_MANAGER".to_string(),
                message: "Token manager not initialized".to_string(),
                source: None,
            })?
            .get_valid_token()
            .await?;

        let response = client.request(
            reqwest::Method::GET,
            "/reports/v2/activity",
            None::<&()>,
            Some(&token),
        ).await?;

        response.json::<Vec<UmbrellaActivity>>().await.map_err(|e| IntegrationError {
            code: "PARSE_ERROR".to_string(),
            message: "Failed to parse Umbrella security activity".to_string(),
            source: Some(Box::new(e)),
        })
    }
}

#[async_trait]
impl ExternalToolIntegration for CiscoUmbrellaIntegration {
    async fn initialize(&mut self, config: IntegrationConfig) -> Result<(), IntegrationError> {
        self.config = Some(config.clone());
        
        // Initialize token manager
        let token_info = TokenManager::new(
            serde_json::from_str(&config.client_secret).map_err(|e| IntegrationError {
                code: "TOKEN_INIT_ERROR".to_string(),
                message: "Failed to parse initial token info".to_string(),
                source: Some(Box::new(e)),
            })?,
            format!("{}/auth/v2/token", config.api_endpoint),
            config.client_id.clone(),
            config.client_secret.clone(),
        );
        self.token_manager = Some(token_info);

        // Initialize HTTP client
        self.http_client = Some(HttpClient::new(
            config.api_endpoint,
            config.rate_limit.map(|limit| (limit, std::time::Duration::from_secs(60))),
        ));

        info!("Cisco Umbrella integration initialized successfully");
        Ok(())
    }

    async fn authenticate(&mut self) -> Result<(), IntegrationError> {
        if let Some(token_manager) = &self.token_manager {
            token_manager.get_valid_token().await?;
            info!("Cisco Umbrella authentication successful");
            Ok(())
        } else {
            Err(IntegrationError {
                code: "NOT_INITIALIZED".to_string(),
                message: "Token manager not initialized".to_string(),
                source: None,
            })
        }
    }

    async fn refresh_auth(&mut self) -> Result<(), IntegrationError> {
        if let Some(token_manager) = &self.token_manager {
            token_manager.refresh_tokens().await?;
            info!("Cisco Umbrella tokens refreshed successfully");
            Ok(())
        } else {
            Err(IntegrationError {
                code: "NOT_INITIALIZED".to_string(),
                message: "Token manager not initialized".to_string(),
                source: None,
            })
        }
    }

    async fn health_check(&self) -> Result<bool, IntegrationError> {
        if let Some(client) = &self.http_client {
            if let Some(token_manager) = &self.token_manager {
                let token = token_manager.get_valid_token().await?;
                let response = client.request(
                    reqwest::Method::GET,
                    "/organizations/v2/status",
                    None::<&()>,
                    Some(&token),
                ).await?;
                
                Ok(response.status().is_success())
            } else {
                Err(IntegrationError {
                    code: "NOT_INITIALIZED".to_string(),
                    message: "Token manager not initialized".to_string(),
                    source: None,
                })
            }
        } else {
            Err(IntegrationError {
                code: "NOT_INITIALIZED".to_string(),
                message: "HTTP client not initialized".to_string(),
                source: None,
            })
        }
    }

    async fn shutdown(&mut self) -> Result<(), IntegrationError> {
        self.config = None;
        self.token_manager = None;
        self.http_client = None;
        info!("Cisco Umbrella integration shut down successfully");
        Ok(())
    }
}