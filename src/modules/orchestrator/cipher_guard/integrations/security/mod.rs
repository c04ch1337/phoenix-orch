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

// SentinelOne Integration
#[derive(Debug, Serialize, Deserialize)]
pub struct SentinelOneAlert {
    pub id: String,
    pub severity: String,
    pub classification: String,
    pub description: String,
    pub agent_id: String,
    pub created_at: String,
}

pub struct SentinelOneIntegration {
    config: Option<IntegrationConfig>,
    http_client: Option<HttpClient>,
    webhook_handler: Option<WebhookHandler>,
}

impl SentinelOneIntegration {
    pub fn new() -> Self {
        Self {
            config: None,
            http_client: None,
            webhook_handler: None,
        }
    }

    pub async fn get_alerts(&self, timeframe: std::time::Duration) -> Result<Vec<SentinelOneAlert>, IntegrationError> {
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
            "/web/api/v2.1/threats",
            None::<&()>,
            Some(&config.client_secret),
        ).await?;

        response.json::<Vec<SentinelOneAlert>>().await.map_err(|e| IntegrationError {
            code: "PARSE_ERROR".to_string(),
            message: "Failed to parse SentinelOne alerts".to_string(),
            source: Some(Box::new(e)),
        })
    }

    pub async fn isolate_endpoint(&self, agent_id: &str) -> Result<(), IntegrationError> {
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

        let payload = serde_json::json!({
            "filter": {
                "ids": [agent_id]
            },
            "data": {
                "value": true
            }
        });

        client.request(
            reqwest::Method::POST,
            "/web/api/v2.1/agents/actions/disconnect",
            Some(&payload),
            Some(&config.client_secret),
        ).await?;

        info!("Endpoint isolated successfully: {}", agent_id);
        Ok(())
    }
}

#[async_trait]
impl ExternalToolIntegration for SentinelOneIntegration {
    async fn initialize(&mut self, config: IntegrationConfig) -> Result<(), IntegrationError> {
        self.config = Some(config.clone());
        
        // Initialize HTTP client
        self.http_client = Some(HttpClient::new(
            config.api_endpoint,
            config.rate_limit.map(|limit| (limit, std::time::Duration::from_secs(60))),
        ));

        // Initialize webhook handler for alerts
        self.webhook_handler = Some(WebhookHandler::new(
            config.client_secret.clone(),
            Box::new(move |payload| {
                info!("Received SentinelOne alert webhook: {:?}", payload);
                Ok(())
            }),
        ));

        info!("SentinelOne integration initialized successfully");
        Ok(())
    }

    async fn authenticate(&mut self) -> Result<(), IntegrationError> {
        // SentinelOne uses API key authentication
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
                    "/web/api/v2.1/system/status",
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
        self.webhook_handler = None;
        info!("SentinelOne integration shut down successfully");
        Ok(())
    }
}

// CrowdStrike Falcon Integration
#[derive(Debug, Serialize, Deserialize)]
pub struct CrowdStrikeDetection {
    pub detection_id: String,
    pub severity: u32,
    pub tactic: String,
    pub technique: String,
    pub description: String,
    pub device_id: String,
    pub timestamp: String,
}

pub struct CrowdStrikeFalconIntegration {
    config: Option<IntegrationConfig>,
    token_manager: Option<TokenManager>,
    http_client: Option<HttpClient>,
    webhook_handler: Option<WebhookHandler>,
}

impl CrowdStrikeFalconIntegration {
    pub fn new() -> Self {
        Self {
            config: None,
            token_manager: None,
            http_client: None,
            webhook_handler: None,
        }
    }

    pub async fn get_detections(&self) -> Result<Vec<CrowdStrikeDetection>, IntegrationError> {
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
            "/detects/queries/detects/v1",
            None::<&()>,
            Some(&token),
        ).await?;

        response.json::<Vec<CrowdStrikeDetection>>().await.map_err(|e| IntegrationError {
            code: "PARSE_ERROR".to_string(),
            message: "Failed to parse CrowdStrike detections".to_string(),
            source: Some(Box::new(e)),
        })
    }

    pub async fn contain_device(&self, device_id: &str) -> Result<(), IntegrationError> {
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

        let payload = serde_json::json!({
            "device_id": device_id,
            "action_name": "contain"
        });

        client.request(
            reqwest::Method::POST,
            "/devices/entities/devices-actions/v2",
            Some(&payload),
            Some(&token),
        ).await?;

        info!("Device contained successfully: {}", device_id);
        Ok(())
    }
}

#[async_trait]
impl ExternalToolIntegration for CrowdStrikeFalconIntegration {
    async fn initialize(&mut self, config: IntegrationConfig) -> Result<(), IntegrationError> {
        self.config = Some(config.clone());
        
        // Initialize token manager
        let token_info = TokenManager::new(
            serde_json::from_str(&config.client_secret).map_err(|e| IntegrationError {
                code: "TOKEN_INIT_ERROR".to_string(),
                message: "Failed to parse initial token info".to_string(),
                source: Some(Box::new(e)),
            })?,
            format!("{}/oauth2/token", config.api_endpoint),
            config.client_id.clone(),
            config.client_secret.clone(),
        );
        self.token_manager = Some(token_info);

        // Initialize HTTP client
        self.http_client = Some(HttpClient::new(
            config.api_endpoint,
            config.rate_limit.map(|limit| (limit, std::time::Duration::from_secs(60))),
        ));

        // Initialize webhook handler for detections
        self.webhook_handler = Some(WebhookHandler::new(
            config.client_secret.clone(),
            Box::new(move |payload| {
                info!("Received CrowdStrike detection webhook: {:?}", payload);
                Ok(())
            }),
        ));

        info!("CrowdStrike Falcon integration initialized successfully");
        Ok(())
    }

    async fn authenticate(&mut self) -> Result<(), IntegrationError> {
        if let Some(token_manager) = &self.token_manager {
            token_manager.get_valid_token().await?;
            info!("CrowdStrike Falcon authentication successful");
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
            info!("CrowdStrike Falcon tokens refreshed successfully");
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
                    "/sensors/queries/installers/v1",
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
        info!("CrowdStrike Falcon integration shut down successfully");
        Ok(())
    }
}

// Rapid7 Integration
#[derive(Debug, Serialize, Deserialize)]
pub struct Rapid7Alert {
    pub alert_id: String,
    pub title: String,
    pub severity: String,
    pub source: String,
    pub status: String,
    pub created_time: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Rapid7Vulnerability {
    pub id: String,
    pub title: String,
    pub severity: String,
    pub cvss_score: f32,
    pub affected_assets: Vec<String>,
    pub remediation: String,
}

pub struct Rapid7Integration {
    config: Option<IntegrationConfig>,
    token_manager: Option<TokenManager>,
    http_client: Option<HttpClient>,
}

impl Rapid7Integration {
    pub fn new() -> Self {
        Self {
            config: None,
            token_manager: None,
            http_client: None,
        }
    }

    pub async fn get_idr_alerts(&self) -> Result<Vec<Rapid7Alert>, IntegrationError> {
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
            "/idr/v1/alerts",
            None::<&()>,
            Some(&token),
        ).await?;

        response.json::<Vec<Rapid7Alert>>().await.map_err(|e| IntegrationError {
            code: "PARSE_ERROR".to_string(),
            message: "Failed to parse Rapid7 IDR alerts".to_string(),
            source: Some(Box::new(e)),
        })
    }

    pub async fn get_vulnerabilities(&self) -> Result<Vec<Rapid7Vulnerability>, IntegrationError> {
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
            "/vm/v4/vulnerabilities",
            None::<&()>,
            Some(&token),
        ).await?;

        response.json::<Vec<Rapid7Vulnerability>>().await.map_err(|e| IntegrationError {
            code: "PARSE_ERROR".to_string(),
            message: "Failed to parse Rapid7 vulnerabilities".to_string(),
            source: Some(Box::new(e)),
        })
    }
}

#[async_trait]
impl ExternalToolIntegration for Rapid7Integration {
    async fn initialize(&mut self, config: IntegrationConfig) -> Result<(), IntegrationError> {
        self.config = Some(config.clone());
        
        // Initialize token manager
        let token_info = TokenManager::new(
            serde_json::from_str(&config.client_secret).map_err(|e| IntegrationError {
                code: "TOKEN_INIT_ERROR".to_string(),
                message: "Failed to parse initial token info".to_string(),
                source: Some(Box::new(e)),
            })?,
            format!("{}/oauth2/token", config.api_endpoint),
            config.client_id.clone(),
            config.client_secret.clone(),
        );
        self.token_manager = Some(token_info);

        // Initialize HTTP client
        self.http_client = Some(HttpClient::new(
            config.api_endpoint,
            config.rate_limit.map(|limit| (limit, std::time::Duration::from_secs(60))),
        ));

        info!("Rapid7 integration initialized successfully");
        Ok(())
    }

    async fn authenticate(&mut self) -> Result<(), IntegrationError> {
        if let Some(token_manager) = &self.token_manager {
            token_manager.get_valid_token().await?;
            info!("Rapid7 authentication successful");
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
            info!("Rapid7 tokens refreshed successfully");
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
                    "/platform/v1/health",
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
        info!("Rapid7 integration shut down successfully");
        Ok(())
    }
}

// Cloudflare Integration
#[derive(Debug, Serialize, Deserialize)]
pub struct CloudflareZone {
    pub id: String,
    pub name: String,
    pub status: String,
    pub paused: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CloudflareFirewallRule {
    pub id: String,
    pub description: String,
    pub action: String,
    pub filter: CloudflareFilter,
    pub priority: u32,
    pub paused: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CloudflareFilter {
    pub expression: String,
    pub description: String,
}

pub struct CloudflareIntegration {
    config: Option<IntegrationConfig>,
    http_client: Option<HttpClient>,
}

impl CloudflareIntegration {
    pub fn new() -> Self {
        Self {
            config: None,
            http_client: None,
        }
    }

    pub async fn get_zones(&self) -> Result<Vec<CloudflareZone>, IntegrationError> {
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
            "/client/v4/zones",
            None::<&()>,
            Some(&config.client_secret),
        ).await?;

        #[derive(Deserialize)]
        struct CloudflareResponse<T> {
            result: T,
            success: bool,
        }

        let zones_response = response.json::<CloudflareResponse<Vec<CloudflareZone>>>().await
            .map_err(|e| IntegrationError {
                code: "PARSE_ERROR".to_string(),
                message: "Failed to parse Cloudflare zones".to_string(),
                source: Some(Box::new(e)),
            })?;

        if zones_response.success {
            Ok(zones_response.result)
        } else {
            Err(IntegrationError {
                code: "API_ERROR".to_string(),
                message: "Cloudflare API request failed".to_string(),
                source: None,
            })
        }
    }

    pub async fn create_firewall_rule(
        &self,
        zone_id: &str,
        rule: CloudflareFirewallRule,
    ) -> Result<String, IntegrationError> {
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
            reqwest::Method::POST,
            &format!("/client/v4/zones/{}/firewall/rules", zone_id),
            Some(&rule),
            Some(&config.client_secret),
        ).await?;

        #[derive(Deserialize)]
        struct CloudflareResponse {
            result: CloudflareFirewallRule,
            success: bool,
        }

        let rule_response = response.json::<CloudflareResponse>().await
            .map_err(|e| IntegrationError {
                code: "PARSE_ERROR".to_string(),
                message: "Failed to parse Cloudflare firewall rule response".to_string(),
                source: Some(Box::new(e)),
            })?;

        if rule_response.success {
            info!("Cloudflare firewall rule created successfully: {}", rule_response.result.id);
            Ok(rule_response.result.id)
        } else {
            Err(IntegrationError {
                code: "API_ERROR".to_string(),
                message: "Cloudflare API request failed".to_string(),
                source: None,
            })
        }
    }
}

#[async_trait]
impl ExternalToolIntegration for CloudflareIntegration {
    async fn initialize(&mut self, config: IntegrationConfig) -> Result<(), IntegrationError> {
        self.config = Some(config.clone());
        
        // Initialize HTTP client
        self.http_client = Some(HttpClient::new(
            config.api_endpoint,
            config.rate_limit.map(|limit| (limit, std::time::Duration::from_secs(60))),
        ));

        info!("Cloudflare integration initialized successfully");
        Ok(())
    }

    async fn authenticate(&mut self) -> Result<(), IntegrationError> {
        // Cloudflare uses API key authentication
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
                    "/client/v4/user",
                    None::<&()>,
                    Some(&config.client_secret),
                ).await?;
                
                #[derive(Deserialize)]
                struct CloudflareResponse {
                    success: bool,
                }

                let health_response = response.json::<CloudflareResponse>().await
                    .map_err(|e| IntegrationError {
                        code: "PARSE_ERROR".to_string(),
                        message: "Failed to parse Cloudflare health check response".to_string(),
                        source: Some(Box::new(e)),
                    })?;

                Ok(health_response.success)
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
        info!("Cloudflare integration shut down successfully");
        Ok(())
    }
}