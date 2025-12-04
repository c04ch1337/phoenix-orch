use async_trait::async_trait;
use serde::{Serialize, Deserialize};
use tracing::{info, warn, error};
use std::{path::PathBuf, fs};
use notify::{Watcher, RecursiveMode, Event};
use tokio::sync::mpsc;

use crate::modules::orchestrator::cipher_guard::integrations::{
    ExternalToolIntegration,
    IntegrationConfig,
    IntegrationError,
    common::{TokenManager, HttpClient, WebhookHandler},
};

// Obsidian Integration
#[derive(Debug)]
pub struct ObsidianWatcher {
    watcher: Option<notify::RecommendedWatcher>,
    rx: Option<mpsc::Receiver<notify::Result<Event>>>,
}

impl ObsidianWatcher {
    pub fn new() -> Self {
        Self {
            watcher: None,
            rx: None,
        }
    }

    pub async fn start_watching(&mut self, vault_path: PathBuf) -> Result<(), IntegrationError> {
        let (tx, rx) = mpsc::channel(100);
        self.rx = Some(rx);

        let mut watcher = notify::recommended_watcher(move |res| {
            let _ = tx.blocking_send(res);
        }).map_err(|e| IntegrationError {
            code: "WATCHER_ERROR".to_string(),
            message: "Failed to create file watcher".to_string(),
            source: Some(Box::new(e)),
        })?;

        watcher.watch(&vault_path, RecursiveMode::Recursive).map_err(|e| IntegrationError {
            code: "WATCH_ERROR".to_string(),
            message: format!("Failed to watch directory: {}", vault_path.display()),
            source: Some(Box::new(e)),
        })?;

        self.watcher = Some(watcher);
        info!("Started watching Obsidian vault: {}", vault_path.display());
        Ok(())
    }

    pub async fn process_events(&mut self) -> Result<(), IntegrationError> {
        if let Some(rx) = &mut self.rx {
            while let Some(res) = rx.recv().await {
                match res {
                    Ok(event) => {
                        info!("Obsidian file event: {:?}", event);
                        // Handle the file event (create, modify, delete)
                        // You can implement custom logic here
                    }
                    Err(e) => {
                        error!("Error watching Obsidian files: {:?}", e);
                    }
                }
            }
        }
        Ok(())
    }
}

pub struct ObsidianIntegration {
    config: Option<IntegrationConfig>,
    watcher: ObsidianWatcher,
}

impl ObsidianIntegration {
    pub fn new() -> Self {
        Self {
            config: None,
            watcher: ObsidianWatcher::new(),
        }
    }
}

#[async_trait]
impl ExternalToolIntegration for ObsidianIntegration {
    async fn initialize(&mut self, config: IntegrationConfig) -> Result<(), IntegrationError> {
        self.config = Some(config.clone());
        
        let vault_path = PathBuf::from(&config.api_endpoint);
        self.watcher.start_watching(vault_path).await?;

        info!("Obsidian integration initialized successfully");
        Ok(())
    }

    async fn authenticate(&mut self) -> Result<(), IntegrationError> {
        // No authentication needed for local file watching
        Ok(())
    }

    async fn refresh_auth(&mut self) -> Result<(), IntegrationError> {
        // No authentication refresh needed
        Ok(())
    }

    async fn health_check(&self) -> Result<bool, IntegrationError> {
        if let Some(config) = &self.config {
            let vault_path = PathBuf::from(&config.api_endpoint);
            Ok(vault_path.exists() && vault_path.is_dir())
        } else {
            Err(IntegrationError {
                code: "NOT_INITIALIZED".to_string(),
                message: "Configuration not initialized".to_string(),
                source: None,
            })
        }
    }

    async fn shutdown(&mut self) -> Result<(), IntegrationError> {
        self.config = None;
        self.watcher = ObsidianWatcher::new();
        info!("Obsidian integration shut down successfully");
        Ok(())
    }
}

// Docker Integration
#[derive(Debug, Serialize, Deserialize)]
pub struct DockerContainer {
    pub id: String,
    pub name: String,
    pub image: String,
    pub status: String,
    pub ports: Vec<DockerPort>,
    pub labels: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DockerPort {
    pub container_port: u16,
    pub host_port: u16,
    pub protocol: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DockerImage {
    pub id: String,
    pub repository: String,
    pub tag: String,
    pub size: u64,
    pub created: String,
}

pub struct DockerIntegration {
    config: Option<IntegrationConfig>,
    http_client: Option<HttpClient>,
}

impl DockerIntegration {
    pub fn new() -> Self {
        Self {
            config: None,
            http_client: None,
        }
    }

    pub async fn list_containers(&self) -> Result<Vec<DockerContainer>, IntegrationError> {
        let client = self.http_client.as_ref().ok_or(IntegrationError {
            code: "NOT_INITIALIZED".to_string(),
            message: "HTTP client not initialized".to_string(),
            source: None,
        })?;

        let response = client.request(
            reqwest::Method::GET,
            "/containers/json",
            None::<&()>,
            None,
        ).await?;

        response.json::<Vec<DockerContainer>>().await.map_err(|e| IntegrationError {
            code: "PARSE_ERROR".to_string(),
            message: "Failed to parse Docker containers".to_string(),
            source: Some(Box::new(e)),
        })
    }

    pub async fn create_container(
        &self,
        image: &str,
        name: &str,
        ports: &[DockerPort],
    ) -> Result<String, IntegrationError> {
        let client = self.http_client.as_ref().ok_or(IntegrationError {
            code: "NOT_INITIALIZED".to_string(),
            message: "HTTP client not initialized".to_string(),
            source: None,
        })?;

        let payload = serde_json::json!({
            "Image": image,
            "Name": name,
            "ExposedPorts": ports.iter().map(|p| {
                (format!("{}/{}", p.container_port, p.protocol), {})
            }).collect::<HashMap<String, serde_json::Value>>(),
            "HostConfig": {
                "PortBindings": ports.iter().map(|p| {
                    (format!("{}/{}", p.container_port, p.protocol), vec![{
                        "HostPort": p.host_port.to_string()
                    }])
                }).collect::<HashMap<String, Vec<serde_json::Value>>>()
            }
        });

        let response = client.request(
            reqwest::Method::POST,
            "/containers/create",
            Some(&payload),
            None,
        ).await?;

        #[derive(Deserialize)]
        struct CreateResponse {
            Id: String,
        }

        let container = response.json::<CreateResponse>().await
            .map_err(|e| IntegrationError {
                code: "PARSE_ERROR".to_string(),
                message: "Failed to parse Docker create container response".to_string(),
                source: Some(Box::new(e)),
            })?;

        info!("Docker container created successfully: {}", container.Id);
        Ok(container.Id)
    }
}

#[async_trait]
impl ExternalToolIntegration for DockerIntegration {
    async fn initialize(&mut self, config: IntegrationConfig) -> Result<(), IntegrationError> {
        self.config = Some(config.clone());
        
        // Initialize HTTP client for Docker daemon
        self.http_client = Some(HttpClient::new(
            config.api_endpoint,
            None, // No rate limiting for local Docker daemon
        ));

        info!("Docker integration initialized successfully");
        Ok(())
    }

    async fn authenticate(&mut self) -> Result<(), IntegrationError> {
        // Docker daemon uses Unix socket or named pipe, no authentication needed
        Ok(())
    }

    async fn refresh_auth(&mut self) -> Result<(), IntegrationError> {
        // No authentication refresh needed
        Ok(())
    }

    async fn health_check(&self) -> Result<bool, IntegrationError> {
        if let Some(client) = &self.http_client {
            let response = client.request(
                reqwest::Method::GET,
                "/_ping",
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
        info!("Docker integration shut down successfully");
        Ok(())
    }
}

// Power Automate Integration
#[derive(Debug, Serialize, Deserialize)]
pub struct PowerAutomateFlow {
    pub id: String,
    pub name: String,
    pub description: String,
    pub state: String,
    pub trigger_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PowerAutomateRun {
    pub id: String,
    pub flow_id: String,
    pub status: String,
    pub start_time: String,
    pub end_time: Option<String>,
}

pub struct PowerAutomateIntegration {
    config: Option<IntegrationConfig>,
    token_manager: Option<TokenManager>,
    http_client: Option<HttpClient>,
}

impl PowerAutomateIntegration {
    pub fn new() -> Self {
        Self {
            config: None,
            token_manager: None,
            http_client: None,
        }
    }

    pub async fn list_flows(&self) -> Result<Vec<PowerAutomateFlow>, IntegrationError> {
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
            "/flows",
            None::<&()>,
            Some(&token),
        ).await?;

        response.json::<Vec<PowerAutomateFlow>>().await.map_err(|e| IntegrationError {
            code: "PARSE_ERROR".to_string(),
            message: "Failed to parse Power Automate flows".to_string(),
            source: Some(Box::new(e)),
        })
    }

    pub async fn trigger_flow(&self, flow_id: &str) -> Result<String, IntegrationError> {
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
            &format!("/flows/{}/run", flow_id),
            None::<&()>,
            Some(&token),
        ).await?;

        #[derive(Deserialize)]
        struct RunResponse {
            id: String,
        }

        let run = response.json::<RunResponse>().await
            .map_err(|e| IntegrationError {
                code: "PARSE_ERROR".to_string(),
                message: "Failed to parse Power Automate run response".to_string(),
                source: Some(Box::new(e)),
            })?;

        info!("Power Automate flow triggered successfully: {}", run.id);
        Ok(run.id)
    }
}

#[async_trait]
impl ExternalToolIntegration for PowerAutomateIntegration {
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

        info!("Power Automate integration initialized successfully");
        Ok(())
    }

    async fn authenticate(&mut self) -> Result<(), IntegrationError> {
        if let Some(token_manager) = &self.token_manager {
            token_manager.get_valid_token().await?;
            info!("Power Automate authentication successful");
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
            info!("Power Automate tokens refreshed successfully");
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
                    "/health",
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
        info!("Power Automate integration shut down successfully");
        Ok(())
    }
}

// OneDrive Integration
#[derive(Debug, Serialize, Deserialize)]
pub struct OneDriveFile {
    pub id: String,
    pub name: String,
    pub size: u64,
    pub web_url: String,
    pub created_datetime: String,
    pub last_modified_datetime: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OneDriveFolder {
    pub id: String,
    pub name: String,
    pub child_count: u32,
    pub web_url: String,
}

pub struct OneDriveIntegration {
    config: Option<IntegrationConfig>,
    token_manager: Option<TokenManager>,
    http_client: Option<HttpClient>,
}

impl OneDriveIntegration {
    pub fn new() -> Self {
        Self {
            config: None,
            token_manager: None,
            http_client: None,
        }
    }

    pub async fn upload_file(&self, path: &str, content: Vec<u8>) -> Result<OneDriveFile, IntegrationError> {
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
            reqwest::Method::PUT,
            &format!("/drive/root:/{}:/content", path),
            Some(&content),
            Some(&token),
        ).await?;

        response.json::<OneDriveFile>().await.map_err(|e| IntegrationError {
            code: "PARSE_ERROR".to_string(),
            message: "Failed to parse OneDrive file response".to_string(),
            source: Some(Box::new(e)),
        })
    }

    pub async fn create_sharing_link(&self, file_id: &str) -> Result<String, IntegrationError> {
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
            "type": "view",
            "scope": "anonymous"
        });

        let response = client.request(
            reqwest::Method::POST,
            &format!("/drive/items/{}/createLink", file_id),
            Some(&payload),
            Some(&token),
        ).await?;

        #[derive(Deserialize)]
        struct ShareResponse {
            link: ShareLink,
        }

        #[derive(Deserialize)]
        struct ShareLink {
            webUrl: String,
        }

        let share = response.json::<ShareResponse>().await
            .map_err(|e| IntegrationError {
                code: "PARSE_ERROR".to_string(),
                message: "Failed to parse OneDrive sharing response".to_string(),
                source: Some(Box::new(e)),
            })?;

        Ok(share.link.webUrl)
    }
}

#[async_trait]
impl ExternalToolIntegration for OneDriveIntegration {
    async fn initialize(&mut self, config: IntegrationConfig) -> Result<(), IntegrationError> {
        self.config = Some(config.clone());
        
        // Initialize token manager using Microsoft Graph API tokens
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

        info!("OneDrive integration initialized successfully");
        Ok(())
    }

    async fn authenticate(&mut self) -> Result<(), IntegrationError> {
        if let Some(token_manager) = &self.token_manager {
            token_manager.get_valid_token().await?;
            info!("OneDrive authentication successful");
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
            info!("OneDrive tokens refreshed successfully");
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
                    "/drive",
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
        info!("OneDrive integration shut down successfully");
        Ok(())
    }
}