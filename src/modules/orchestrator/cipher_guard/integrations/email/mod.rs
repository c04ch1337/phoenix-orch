use async_trait::async_trait;
use serde::{Serialize, Deserialize};
use tracing::{info, warn, error};

use crate::modules::orchestrator::cipher_guard::integrations::{
    ExternalToolIntegration,
    IntegrationConfig,
    IntegrationError,
    common::{TokenManager, HttpClient, WebhookHandler},
};

// Microsoft Graph API Integration
pub struct MicrosoftGraphIntegration {
    config: Option<IntegrationConfig>,
    token_manager: Option<TokenManager>,
    http_client: Option<HttpClient>,
    webhook_handler: Option<WebhookHandler>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EmailMessage {
    pub subject: String,
    pub body: String,
    pub to_recipients: Vec<String>,
    pub cc_recipients: Option<Vec<String>>,
    pub importance: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TeamsMessage {
    pub content: String,
    pub channel_id: String,
    pub team_id: String,
    pub importance: Option<String>,
}

impl MicrosoftGraphIntegration {
    pub fn new() -> Self {
        Self {
            config: None,
            token_manager: None,
            http_client: None,
            webhook_handler: None,
        }
    }

    pub async fn send_email(&self, message: EmailMessage) -> Result<(), IntegrationError> {
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

        client.request(
            reqwest::Method::POST,
            "/v1.0/me/sendMail",
            Some(&message),
            Some(&token),
        ).await?;

        info!("Email sent successfully: {}", message.subject);
        Ok(())
    }

    pub async fn send_teams_message(&self, message: TeamsMessage) -> Result<(), IntegrationError> {
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

        client.request(
            reqwest::Method::POST,
            &format!("/v1.0/teams/{}/channels/{}/messages", message.team_id, message.channel_id),
            Some(&message),
            Some(&token),
        ).await?;

        info!("Teams message sent successfully to channel {}", message.channel_id);
        Ok(())
    }
}

#[async_trait]
impl ExternalToolIntegration for MicrosoftGraphIntegration {
    async fn initialize(&mut self, config: IntegrationConfig) -> Result<(), IntegrationError> {
        self.config = Some(config.clone());
        
        // Initialize token manager
        let token_info = TokenManager::new(
            serde_json::from_str(&config.client_secret).map_err(|e| IntegrationError {
                code: "TOKEN_INIT_ERROR".to_string(),
                message: "Failed to parse initial token info".to_string(),
                source: Some(Box::new(e)),
            })?,
            format!("{}/oauth2/v2.0/token", config.api_endpoint),
            config.client_id.clone(),
            config.client_secret.clone(),
        );
        self.token_manager = Some(token_info);

        // Initialize HTTP client
        self.http_client = Some(HttpClient::new(
            config.api_endpoint,
            config.rate_limit.map(|limit| (limit, std::time::Duration::from_secs(60))),
        ));

        info!("Microsoft Graph integration initialized successfully");
        Ok(())
    }

    async fn authenticate(&mut self) -> Result<(), IntegrationError> {
        if let Some(token_manager) = &self.token_manager {
            token_manager.get_valid_token().await?;
            info!("Microsoft Graph authentication successful");
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
            info!("Microsoft Graph tokens refreshed successfully");
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
                    "/v1.0/me",
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
        info!("Microsoft Graph integration shut down successfully");
        Ok(())
    }
}

// Proofpoint Integration
pub struct ProofpointIntegration {
    config: Option<IntegrationConfig>,
    http_client: Option<HttpClient>,
    webhook_handler: Option<WebhookHandler>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProofpointAlert {
    pub threat_id: String,
    pub severity: String,
    pub category: String,
    pub description: String,
    pub affected_users: Vec<String>,
}

impl ProofpointIntegration {
    pub fn new() -> Self {
        Self {
            config: None,
            http_client: None,
            webhook_handler: None,
        }
    }

    pub async fn get_alerts(&self, time_range: std::time::Duration) -> Result<Vec<ProofpointAlert>, IntegrationError> {
        let client = self.http_client.as_ref().ok_or(IntegrationError {
            code: "NOT_INITIALIZED".to_string(),
            message: "HTTP client not initialized".to_string(),
            source: None,
        })?;

        let response = client.request(
            reqwest::Method::GET,
            &format!("/v2/threats/alerts?window={}", time_range.as_secs()),
            None::<&()>,
            None,
        ).await?;

        response.json::<Vec<ProofpointAlert>>().await.map_err(|e| IntegrationError {
            code: "PARSE_ERROR".to_string(),
            message: "Failed to parse Proofpoint alerts".to_string(),
            source: Some(Box::new(e)),
        })
    }
}

#[async_trait]
impl ExternalToolIntegration for ProofpointIntegration {
    async fn initialize(&mut self, config: IntegrationConfig) -> Result<(), IntegrationError> {
        self.config = Some(config.clone());
        
        // Initialize HTTP client
        self.http_client = Some(HttpClient::new(
            config.api_endpoint,
            config.rate_limit.map(|limit| (limit, std::time::Duration::from_secs(60))),
        ));

        // Initialize webhook handler for alert notifications
        self.webhook_handler = Some(WebhookHandler::new(
            config.client_secret.clone(),
            Box::new(move |payload| {
                info!("Received Proofpoint alert webhook: {:?}", payload);
                Ok(())
            }),
        ));

        info!("Proofpoint integration initialized successfully");
        Ok(())
    }

    async fn authenticate(&mut self) -> Result<(), IntegrationError> {
        // Proofpoint uses API key authentication, so we just verify the config exists
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
            let response = client.request(
                reqwest::Method::GET,
                "/v2/health",
                None::<&()>,
                None,
            ).await?;
            
            Ok(response.status().is_success())
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
        info!("Proofpoint integration shut down successfully");
        Ok(())
    }
}

// Zoom Integration
pub struct ZoomIntegration {
    config: Option<IntegrationConfig>,
    token_manager: Option<TokenManager>,
    http_client: Option<HttpClient>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ZoomMeeting {
    pub topic: String,
    pub start_time: String,
    pub duration: u32,
    pub timezone: String,
    pub settings: ZoomMeetingSettings,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ZoomMeetingSettings {
    pub host_video: bool,
    pub participant_video: bool,
    pub join_before_host: bool,
    pub mute_upon_entry: bool,
    pub waiting_room: bool,
}

impl ZoomIntegration {
    pub fn new() -> Self {
        Self {
            config: None,
            token_manager: None,
            http_client: None,
        }
    }

    pub async fn create_meeting(&self, meeting: ZoomMeeting) -> Result<String, IntegrationError> {
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
            "/v2/users/me/meetings",
            Some(&meeting),
            Some(&token),
        ).await?;

        #[derive(Deserialize)]
        struct MeetingResponse {
            join_url: String,
        }

        let meeting_response = response.json::<MeetingResponse>().await
            .map_err(|e| IntegrationError {
                code: "PARSE_ERROR".to_string(),
                message: "Failed to parse Zoom meeting response".to_string(),
                source: Some(Box::new(e)),
            })?;

        info!("Zoom meeting created successfully: {}", meeting.topic);
        Ok(meeting_response.join_url)
    }
}

#[async_trait]
impl ExternalToolIntegration for ZoomIntegration {
    async fn initialize(&mut self, config: IntegrationConfig) -> Result<(), IntegrationError> {
        self.config = Some(config.clone());
        
        // Initialize token manager
        let token_info = TokenManager::new(
            serde_json::from_str(&config.client_secret).map_err(|e| IntegrationError {
                code: "TOKEN_INIT_ERROR".to_string(),
                message: "Failed to parse initial token info".to_string(),
                source: Some(Box::new(e)),
            })?,
            format!("{}/oauth/token", config.api_endpoint),
            config.client_id.clone(),
            config.client_secret.clone(),
        );
        self.token_manager = Some(token_info);

        // Initialize HTTP client
        self.http_client = Some(HttpClient::new(
            config.api_endpoint,
            config.rate_limit.map(|limit| (limit, std::time::Duration::from_secs(60))),
        ));

        info!("Zoom integration initialized successfully");
        Ok(())
    }

    async fn authenticate(&mut self) -> Result<(), IntegrationError> {
        if let Some(token_manager) = &self.token_manager {
            token_manager.get_valid_token().await?;
            info!("Zoom authentication successful");
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
            info!("Zoom tokens refreshed successfully");
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
                    "/v2/users/me",
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
        info!("Zoom integration shut down successfully");
        Ok(())
    }
}