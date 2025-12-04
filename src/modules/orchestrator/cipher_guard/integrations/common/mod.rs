use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, Semaphore};
use reqwest::{Client, Response, StatusCode};
use serde::{Serialize, Deserialize};
use tracing::{info, warn, error};
use super::IntegrationError;

// Rate limiter implementation
pub struct RateLimiter {
    semaphore: Arc<Semaphore>,
    timeout: Duration,
}

impl RateLimiter {
    pub fn new(max_requests: u32, window: Duration) -> Self {
        Self {
            semaphore: Arc::new(Semaphore::new(max_requests as usize)),
            timeout: window,
        }
    }

    pub async fn acquire(&self) -> Result<(), IntegrationError> {
        self.semaphore.acquire().await.map_err(|e| IntegrationError {
            code: "RATE_LIMIT_ERROR".to_string(),
            message: "Failed to acquire rate limit permit".to_string(),
            source: Some(Box::new(e)),
        })?;
        Ok(())
    }

    pub fn release(&self) {
        self.semaphore.add_permits(1);
    }
}

// Token management
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: Option<u64>,
    pub token_type: String,
}

pub struct TokenManager {
    tokens: Arc<Mutex<TokenInfo>>,
    client: Client,
    refresh_endpoint: String,
    client_id: String,
    client_secret: String,
}

impl TokenManager {
    pub fn new(
        initial_tokens: TokenInfo,
        refresh_endpoint: String,
        client_id: String,
        client_secret: String,
    ) -> Self {
        Self {
            tokens: Arc::new(Mutex::new(initial_tokens)),
            client: Client::new(),
            refresh_endpoint,
            client_id,
            client_secret,
        }
    }

    pub async fn get_valid_token(&self) -> Result<String, IntegrationError> {
        let mut tokens = self.tokens.lock().await;
        // Implement token refresh logic here if needed
        Ok(tokens.access_token.clone())
    }

    pub async fn refresh_tokens(&self) -> Result<(), IntegrationError> {
        let mut tokens = self.tokens.lock().await;
        if let Some(refresh_token) = &tokens.refresh_token {
            let new_tokens: TokenInfo = self.client
                .post(&self.refresh_endpoint)
                .basic_auth(&self.client_id, Some(&self.client_secret))
                .form(&[
                    ("grant_type", "refresh_token"),
                    ("refresh_token", refresh_token),
                ])
                .send()
                .await
                .map_err(|e| IntegrationError {
                    code: "REFRESH_ERROR".to_string(),
                    message: "Failed to refresh tokens".to_string(),
                    source: Some(Box::new(e)),
                })?
                .json()
                .await
                .map_err(|e| IntegrationError {
                    code: "REFRESH_PARSE_ERROR".to_string(),
                    message: "Failed to parse refresh response".to_string(),
                    source: Some(Box::new(e)),
                })?;

            *tokens = new_tokens;
            Ok(())
        } else {
            Err(IntegrationError {
                code: "NO_REFRESH_TOKEN".to_string(),
                message: "No refresh token available".to_string(),
                source: None,
            })
        }
    }
}

// Webhook handler
pub struct WebhookHandler {
    verification_token: String,
    handler: Arc<Mutex<Box<dyn Fn(serde_json::Value) -> Result<(), IntegrationError> + Send + Sync>>>,
}

impl WebhookHandler {
    pub fn new<F>(verification_token: String, handler: F) -> Self 
    where
        F: Fn(serde_json::Value) -> Result<(), IntegrationError> + Send + Sync + 'static,
    {
        Self {
            verification_token,
            handler: Arc::new(Mutex::new(Box::new(handler))),
        }
    }

    pub async fn handle_webhook(
        &self,
        payload: serde_json::Value,
        token: &str,
    ) -> Result<(), IntegrationError> {
        if token != self.verification_token {
            return Err(IntegrationError {
                code: "INVALID_WEBHOOK_TOKEN".to_string(),
                message: "Invalid webhook verification token".to_string(),
                source: None,
            });
        }

        let handler = self.handler.lock().await;
        handler(payload)
    }
}

// HTTP client wrapper with automatic retry and error handling
pub struct HttpClient {
    client: Client,
    rate_limiter: Option<RateLimiter>,
    base_url: String,
}

impl HttpClient {
    pub fn new(base_url: String, rate_limit: Option<(u32, Duration)>) -> Self {
        let rate_limiter = rate_limit.map(|(max_requests, window)| {
            RateLimiter::new(max_requests, window)
        });

        Self {
            client: Client::new(),
            rate_limiter,
            base_url,
        }
    }

    pub async fn request<T: Serialize + ?Sized>(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Option<&T>,
        token: Option<&str>,
    ) -> Result<Response, IntegrationError> {
        if let Some(limiter) = &self.rate_limiter {
            limiter.acquire().await?;
        }

        let url = format!("{}{}", self.base_url, path);
        let mut builder = self.client.request(method.clone(), &url);

        if let Some(token) = token {
            builder = builder.header("Authorization", format!("Bearer {}", token));
        }

        if let Some(body) = body {
            builder = builder.json(body);
        }

        let response = builder.send().await.map_err(|e| IntegrationError {
            code: "REQUEST_ERROR".to_string(),
            message: format!("Failed to send request to {}", url),
            source: Some(Box::new(e)),
        })?;

        if let Some(limiter) = &self.rate_limiter {
            limiter.release();
        }

        match response.status() {
            StatusCode::OK | StatusCode::CREATED | StatusCode::ACCEPTED => Ok(response),
            status => {
                let error_body = response.text().await.unwrap_or_default();
                Err(IntegrationError {
                    code: status.to_string(),
                    message: format!("Request failed: {} - {}", status, error_body),
                    source: None,
                })
            }
        }
    }
}