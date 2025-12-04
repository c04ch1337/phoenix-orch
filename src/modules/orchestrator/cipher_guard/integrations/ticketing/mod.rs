use async_trait::async_trait;
use serde::{Serialize, Deserialize};
use tracing::{info, warn, error};

use crate::modules::orchestrator::cipher_guard::integrations::{
    ExternalToolIntegration,
    IntegrationConfig,
    IntegrationError,
    common::{TokenManager, HttpClient, WebhookHandler},
};

// JIRA Integration
#[derive(Debug, Serialize, Deserialize)]
pub struct JiraIssue {
    pub summary: String,
    pub description: String,
    pub issue_type: String,
    pub priority: String,
    pub project_key: String,
    pub assignee: Option<String>,
    pub labels: Vec<String>,
}

pub struct JiraIntegration {
    config: Option<IntegrationConfig>,
    token_manager: Option<TokenManager>,
    http_client: Option<HttpClient>,
    webhook_handler: Option<WebhookHandler>,
}

impl JiraIntegration {
    pub fn new() -> Self {
        Self {
            config: None,
            token_manager: None,
            http_client: None,
            webhook_handler: None,
        }
    }

    pub async fn create_issue(&self, issue: JiraIssue) -> Result<String, IntegrationError> {
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

        #[derive(Serialize)]
        struct JiraFields {
            summary: String,
            description: String,
            issuetype: IssueType,
            priority: Priority,
            project: Project,
            assignee: Option<Assignee>,
            labels: Vec<String>,
        }

        #[derive(Serialize)]
        struct IssueType {
            name: String,
        }

        #[derive(Serialize)]
        struct Priority {
            name: String,
        }

        #[derive(Serialize)]
        struct Project {
            key: String,
        }

        #[derive(Serialize)]
        struct Assignee {
            name: String,
        }

        let fields = JiraFields {
            summary: issue.summary,
            description: issue.description,
            issuetype: IssueType { name: issue.issue_type },
            priority: Priority { name: issue.priority },
            project: Project { key: issue.project_key },
            assignee: issue.assignee.map(|name| Assignee { name }),
            labels: issue.labels,
        };

        #[derive(Serialize)]
        struct CreateIssuePayload {
            fields: JiraFields,
        }

        let payload = CreateIssuePayload { fields };

        let response = client.request(
            reqwest::Method::POST,
            "/rest/api/2/issue",
            Some(&payload),
            Some(&token),
        ).await?;

        #[derive(Deserialize)]
        struct CreateIssueResponse {
            key: String,
        }

        let issue_response = response.json::<CreateIssueResponse>().await
            .map_err(|e| IntegrationError {
                code: "PARSE_ERROR".to_string(),
                message: "Failed to parse JIRA create issue response".to_string(),
                source: Some(Box::new(e)),
            })?;

        info!("JIRA issue created successfully: {}", issue_response.key);
        Ok(issue_response.key)
    }
}

#[async_trait]
impl ExternalToolIntegration for JiraIntegration {
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

        // Initialize webhook handler for issue updates
        self.webhook_handler = Some(WebhookHandler::new(
            config.client_secret.clone(),
            Box::new(move |payload| {
                info!("Received JIRA webhook: {:?}", payload);
                Ok(())
            }),
        ));

        info!("JIRA integration initialized successfully");
        Ok(())
    }

    async fn authenticate(&mut self) -> Result<(), IntegrationError> {
        if let Some(token_manager) = &self.token_manager {
            token_manager.get_valid_token().await?;
            info!("JIRA authentication successful");
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
            info!("JIRA tokens refreshed successfully");
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
                    "/rest/api/2/myself",
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
        info!("JIRA integration shut down successfully");
        Ok(())
    }
}

// Confluence Integration
#[derive(Debug, Serialize, Deserialize)]
pub struct ConfluencePage {
    pub title: String,
    pub space_key: String,
    pub body: String,
    pub parent_id: Option<String>,
    pub labels: Vec<String>,
}

pub struct ConfluenceIntegration {
    config: Option<IntegrationConfig>,
    token_manager: Option<TokenManager>,
    http_client: Option<HttpClient>,
}

impl ConfluenceIntegration {
    pub fn new() -> Self {
        Self {
            config: None,
            token_manager: None,
            http_client: None,
        }
    }

    pub async fn create_page(&self, page: ConfluencePage) -> Result<String, IntegrationError> {
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

        #[derive(Serialize)]
        struct CreatePagePayload {
            title: String,
            space: Space,
            body: Body,
            #[serde(skip_serializing_if = "Option::is_none")]
            ancestors: Option<Vec<Ancestor>>,
            metadata: Metadata,
        }

        #[derive(Serialize)]
        struct Space {
            key: String,
        }

        #[derive(Serialize)]
        struct Body {
            storage: Storage,
        }

        #[derive(Serialize)]
        struct Storage {
            value: String,
            representation: String,
        }

        #[derive(Serialize)]
        struct Ancestor {
            id: String,
        }

        #[derive(Serialize)]
        struct Metadata {
            labels: Vec<Label>,
        }

        #[derive(Serialize)]
        struct Label {
            name: String,
        }

        let payload = CreatePagePayload {
            title: page.title,
            space: Space { key: page.space_key },
            body: Body {
                storage: Storage {
                    value: page.body,
                    representation: "storage".to_string(),
                },
            },
            ancestors: page.parent_id.map(|id| vec![Ancestor { id }]),
            metadata: Metadata {
                labels: page.labels.into_iter().map(|name| Label { name }).collect(),
            },
        };

        let response = client.request(
            reqwest::Method::POST,
            "/rest/api/content",
            Some(&payload),
            Some(&token),
        ).await?;

        #[derive(Deserialize)]
        struct CreatePageResponse {
            id: String,
        }

        let page_response = response.json::<CreatePageResponse>().await
            .map_err(|e| IntegrationError {
                code: "PARSE_ERROR".to_string(),
                message: "Failed to parse Confluence create page response".to_string(),
                source: Some(Box::new(e)),
            })?;

        info!("Confluence page created successfully with ID: {}", page_response.id);
        Ok(page_response.id)
    }
}

#[async_trait]
impl ExternalToolIntegration for ConfluenceIntegration {
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

        info!("Confluence integration initialized successfully");
        Ok(())
    }

    async fn authenticate(&mut self) -> Result<(), IntegrationError> {
        if let Some(token_manager) = &self.token_manager {
            token_manager.get_valid_token().await?;
            info!("Confluence authentication successful");
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
            info!("Confluence tokens refreshed successfully");
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
                    "/rest/api/space",
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
        info!("Confluence integration shut down successfully");
        Ok(())
    }
}

// SharePoint Integration
#[derive(Debug, Serialize, Deserialize)]
pub struct SharePointFile {
    pub name: String,
    pub content: Vec<u8>,
    pub folder_path: String,
}

pub struct SharePointIntegration {
    config: Option<IntegrationConfig>,
    token_manager: Option<TokenManager>,
    http_client: Option<HttpClient>,
}

impl SharePointIntegration {
    pub fn new() -> Self {
        Self {
            config: None,
            token_manager: None,
            http_client: None,
        }
    }

    pub async fn upload_file(&self, file: SharePointFile) -> Result<String, IntegrationError> {
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

        let path = format!("/v1.0/drive/root:{}:/{}:/content", file.folder_path, file.name);
        
        let response = client.request(
            reqwest::Method::PUT,
            &path,
            Some(&file.content),
            Some(&token),
        ).await?;

        #[derive(Deserialize)]
        struct UploadResponse {
            id: String,
        }

        let upload_response = response.json::<UploadResponse>().await
            .map_err(|e| IntegrationError {
                code: "PARSE_ERROR".to_string(),
                message: "Failed to parse SharePoint upload response".to_string(),
                source: Some(Box::new(e)),
            })?;

        info!("File uploaded successfully to SharePoint: {}", file.name);
        Ok(upload_response.id)
    }
}

#[async_trait]
impl ExternalToolIntegration for SharePointIntegration {
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

        info!("SharePoint integration initialized successfully");
        Ok(())
    }

    async fn authenticate(&mut self) -> Result<(), IntegrationError> {
        if let Some(token_manager) = &self.token_manager {
            token_manager.get_valid_token().await?;
            info!("SharePoint authentication successful");
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
            info!("SharePoint tokens refreshed successfully");
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
                    "/v1.0/sites/root",
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
        info!("SharePoint integration shut down successfully");
        Ok(())
    }
}

// SmartSheets Integration
#[derive(Debug, Serialize, Deserialize)]
pub struct SmartSheet {
    pub name: String,
    pub columns: Vec<Column>,
    pub rows: Vec<Row>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Column {
    pub title: String,
    pub type_: String,
    pub primary: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Row {
    pub cells: Vec<Cell>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Cell {
    pub column_id: i64,
    pub value: String,
}

pub struct SmartSheetsIntegration {
    config: Option<IntegrationConfig>,
    http_client: Option<HttpClient>,
}

impl SmartSheetsIntegration {
    pub fn new() -> Self {
        Self {
            config: None,
            http_client: None,
        }
    }

    pub async fn create_sheet(&self, sheet: SmartSheet) -> Result<i64, IntegrationError> {
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

        #[derive(Serialize)]
        struct CreateSheetPayload {
            name: String,
            columns: Vec<ColumnPayload>,
        }

        #[derive(Serialize)]
        struct ColumnPayload {
            title: String,
            #[serde(rename = "type")]
            type_: String,
            primary: bool,
        }

        let payload = CreateSheetPayload {
            name: sheet.name,
            columns: sheet.columns.into_iter().map(|col| ColumnPayload {
                title: col.title,
                type_: col.type_,
                primary: col.primary,
            }).collect(),
        };

        let response = client.request(
            reqwest::Method::POST,
            "/sheets",
            Some(&payload),
            Some(&config.client_secret), // SmartSheets uses API key in Authorization header
        ).await?;

        #[derive(Deserialize)]
        struct CreateSheetResponse {
            id: i64,
        }

        let sheet_response = response.json::<CreateSheetResponse>().await
            .map_err(|e| IntegrationError {
                code: "PARSE_ERROR".to_string(),
                message: "Failed to parse SmartSheets create sheet response".to_string(),
                source: Some(Box::new(e)),
            })?;

        info!("SmartSheet created successfully with ID: {}", sheet_response.id);
        Ok(sheet_response.id)
    }
}

#[async_trait]
impl ExternalToolIntegration for SmartSheetsIntegration {
    async fn initialize(&mut self, config: IntegrationConfig) -> Result<(), IntegrationError> {
        self.config = Some(config.clone());
        
        // Initialize HTTP client
        self.http_client = Some(HttpClient::new(
            config.api_endpoint,
            config.rate_limit.map(|limit| (limit, std::time::Duration::from_secs(60))),
        ));

        info!("SmartSheets integration initialized successfully");
        Ok(())
    }

    async fn authenticate(&mut self) -> Result<(), IntegrationError> {
        // SmartSheets uses API key authentication, so we just verify the config exists
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
                    "/users/me",
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
        info!("SmartSheets integration shut down successfully");
        Ok(())
    }
}