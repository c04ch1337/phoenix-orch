//! Model Router Implementation
//!
//! This module provides the model selection and routing functionality,
//! allowing different LLM models to be used for different agents and tasks.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::modules::orchestrator::antigravity_core::{AgentType, TaskInfo};
use crate::modules::orchestrator::errors::{PhoenixError, PhoenixResult};
use async_trait::async_trait;

/// Model types supported by the system
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ModelType {
    /// DeepSeek-Coder-V2 model (optimized for red team tasks)
    DeepSeekCoder,
    /// Claude 3.5 model
    Claude35,
    /// Gemini 3 Pro model
    Gemini3Pro,
    /// Local Llama 3.1 70B model
    LocalLlama70B,
}

impl ModelType {
    /// Returns a string representation of the model type
    pub fn as_str(&self) -> &'static str {
        match self {
            ModelType::DeepSeekCoder => "DeepSeek-Coder-V2",
            ModelType::Claude35 => "Claude 3.5",
            ModelType::Gemini3Pro => "Gemini 3 Pro",
            ModelType::LocalLlama70B => "Local Llama 3.1 70B",
        }
    }
    
    /// Returns the model ID used for API calls
    pub fn model_id(&self) -> &'static str {
        match self {
            ModelType::DeepSeekCoder => "deepseek-ai/deepseek-coder-v2",
            ModelType::Claude35 => "anthropic/claude-3-5-sonnet",
            ModelType::Gemini3Pro => "google/gemini-3-pro",
            ModelType::LocalLlama70B => "local/llama-3-70b",
        }
    }
    
    /// Returns the default maximum token context size
    pub fn default_max_tokens(&self) -> usize {
        match self {
            ModelType::DeepSeekCoder => 32000,
            ModelType::Claude35 => 200000,
            ModelType::Gemini3Pro => 128000,
            ModelType::LocalLlama70B => 32000,
        }
    }
}

/// Configuration for the model router
#[derive(Debug, Clone)]
pub struct ModelRouterConfig {
    /// Default model when none is specified
    pub default_model: ModelType,
    /// Default model for each agent type
    pub agent_defaults: HashMap<AgentType, ModelType>,
    /// API endpoints for each model type
    pub api_endpoints: HashMap<ModelType, String>,
    /// API keys for each model type (if applicable)
    pub api_keys: HashMap<ModelType, String>,
    /// Whether to enable model caching
    pub enable_caching: bool,
    /// Cache timeout in seconds
    pub cache_timeout_secs: u64,
}

impl Default for ModelRouterConfig {
    fn default() -> Self {
        let mut agent_defaults = HashMap::new();
        agent_defaults.insert(AgentType::EmberUnit, ModelType::DeepSeekCoder);
        agent_defaults.insert(AgentType::CipherGuard, ModelType::Claude35);
        
        let mut api_endpoints = HashMap::new();
        api_endpoints.insert(ModelType::DeepSeekCoder, "https://api.deepseek.com/v1".to_string());
        api_endpoints.insert(ModelType::Claude35, "https://api.anthropic.com/v1".to_string());
        api_endpoints.insert(ModelType::Gemini3Pro, "https://generativelanguage.googleapis.com/v1".to_string());
        api_endpoints.insert(ModelType::LocalLlama70B, "http://localhost:8000/v1".to_string());
        
        Self {
            default_model: ModelType::Claude35,
            agent_defaults,
            api_endpoints,
            api_keys: HashMap::new(),
            enable_caching: true,
            cache_timeout_secs: 3600, // 1 hour
        }
    }
}

/// Model request parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelRequestParams {
    /// The prompt or messages to send to the model
    pub prompt: String,
    /// Maximum tokens to generate
    pub max_tokens: Option<usize>,
    /// Temperature (0.0 to 1.0)
    pub temperature: Option<f32>,
    /// Top-p sampling
    pub top_p: Option<f32>,
    /// Whether to stream the response
    pub stream: Option<bool>,
    /// System message
    pub system: Option<String>,
    /// Stop sequences
    pub stop: Option<Vec<String>>,
    /// Model-specific parameters
    pub model_params: Option<HashMap<String, serde_json::Value>>,
}

/// Model response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelResponse {
    /// Generated text
    pub text: String,
    /// Model used
    pub model: String,
    /// Tokens used
    pub usage: ModelUsage,
    /// Raw response data
    pub raw_response: Option<serde_json::Value>,
}

/// Token usage information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelUsage {
    /// Prompt tokens
    pub prompt_tokens: usize,
    /// Completion tokens
    pub completion_tokens: usize,
    /// Total tokens
    pub total_tokens: usize,
}

/// Model client trait for interfacing with different LLM APIs
#[async_trait]
pub trait ModelClient: Send + Sync {
    /// Get the model type
    fn model_type(&self) -> ModelType;
    
    /// Complete a prompt using this model
    async fn complete(&self, params: ModelRequestParams) -> PhoenixResult<ModelResponse>;
    
    /// Check if the model is available
    async fn is_available(&self) -> bool;
}

/// Task-specific model selection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskModelSelection {
    /// Task ID
    pub task_id: String,
    /// Selected model
    pub model: ModelType,
    /// Model parameters
    pub parameters: Option<HashMap<String, serde_json::Value>>,
    /// Timestamp of selection
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Agent-specific model selection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentModelSelection {
    /// Agent ID
    pub agent_id: String,
    /// Selected model
    pub model: ModelType,
    /// Model parameters
    pub parameters: Option<HashMap<String, serde_json::Value>>,
    /// Timestamp of selection
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Model Router - handles model selection and API routing
pub struct ModelRouter {
    /// Configuration
    config: ModelRouterConfig,
    /// Model clients
    clients: HashMap<ModelType, Arc<dyn ModelClient>>,
    /// Task-specific model selections
    task_models: Arc<RwLock<HashMap<String, TaskModelSelection>>>,
    /// Agent-specific model selections
    agent_models: Arc<RwLock<HashMap<String, AgentModelSelection>>>,
}

impl ModelRouter {
    /// Create a new ModelRouter
    pub fn new(config: Option<ModelRouterConfig>) -> Self {
        Self {
            config: config.unwrap_or_default(),
            clients: HashMap::new(),
            task_models: Arc::new(RwLock::new(HashMap::new())),
            agent_models: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Register a model client
    pub fn register_client(&mut self, client: Arc<dyn ModelClient>) {
        let model_type = client.model_type();
        self.clients.insert(model_type, client);
    }
    
    /// Get the appropriate model for a task
    pub async fn get_model_for_task(&self, task_info: &TaskInfo) -> PhoenixResult<ModelType> {
        // Check if there's a specific model selection for this task
        let task_models = self.task_models.read().await;
        if let Some(selection) = task_models.get(&task_info.id) {
            return Ok(selection.model.clone());
        }
        
        // If no task-specific model, check the agent's model
        if let Some(agent_id) = &task_info.agent_id {
            let agent_models = self.agent_models.read().await;
            if let Some(selection) = agent_models.get(agent_id) {
                return Ok(selection.model.clone());
            }
            
            // If no agent-specific model, check the agent type default
            if let Some(agent_type) = task_info.metadata.get("agent_type") {
                if let Ok(agent_type) = serde_json::from_str::<AgentType>(agent_type) {
                    if let Some(default_model) = self.config.agent_defaults.get(&agent_type) {
                        return Ok(default_model.clone());
                    }
                }
            }
        }
        
        // Default fallback
        Ok(self.config.default_model.clone())
    }
    
    /// Set the model for a specific task
    pub async fn set_task_model(
        &self, 
        task_id: &str, 
        model: ModelType,
        parameters: Option<HashMap<String, serde_json::Value>>,
    ) -> PhoenixResult<()> {
        // Verify the model is available
        if !self.clients.contains_key(&model) {
            return Err(PhoenixError::Agent {
                kind: crate::modules::orchestrator::errors::AgentErrorKind::ConfigurationError,
                message: format!("Model {} is not registered", model.as_str()),
                component: "ModelRouter".to_string(),
            });
        }
        
        let selection = TaskModelSelection {
            task_id: task_id.to_string(),
            model,
            parameters,
            timestamp: chrono::Utc::now(),
        };
        
        let mut task_models = self.task_models.write().await;
        task_models.insert(task_id.to_string(), selection);
        
        Ok(())
    }
    
    /// Set the default model for an agent
    pub async fn set_agent_model(
        &self, 
        agent_id: &str, 
        model: ModelType,
        parameters: Option<HashMap<String, serde_json::Value>>,
    ) -> PhoenixResult<()> {
        // Verify the model is available
        if !self.clients.contains_key(&model) {
            return Err(PhoenixError::Agent {
                kind: crate::modules::orchestrator::errors::AgentErrorKind::ConfigurationError,
                message: format!("Model {} is not registered", model.as_str()),
                component: "ModelRouter".to_string(),
            });
        }
        
        let selection = AgentModelSelection {
            agent_id: agent_id.to_string(),
            model,
            parameters,
            timestamp: chrono::Utc::now(),
        };
        
        let mut agent_models = self.agent_models.write().await;
        agent_models.insert(agent_id.to_string(), selection);
        
        Ok(())
    }
    
    /// Execute a model request for a specific task
    pub async fn execute_for_task(
        &self,
        task_id: &str,
        params: ModelRequestParams,
    ) -> PhoenixResult<ModelResponse> {
        // Get task info (assuming we have a method to get it)
        let task_info = self.get_task_info(task_id).await?;
        
        // Get the appropriate model
        let model_type = self.get_model_for_task(&task_info).await?;
        
        // Get the client for this model
        let client = self.get_client(&model_type)?;
        
        // Execute the request
        client.complete(params).await
    }
    
    /// Execute a model request with a specific model
    pub async fn execute_with_model(
        &self,
        model_type: &ModelType,
        params: ModelRequestParams,
    ) -> PhoenixResult<ModelResponse> {
        // Get the client for this model
        let client = self.get_client(model_type)?;
        
        // Execute the request
        client.complete(params).await
    }
    
    /// Get a client for a specific model
    fn get_client(&self, model_type: &ModelType) -> PhoenixResult<Arc<dyn ModelClient>> {
        self.clients.get(model_type).cloned().ok_or_else(|| {
            PhoenixError::Agent {
                kind: crate::modules::orchestrator::errors::AgentErrorKind::ConfigurationError,
                message: format!("No client registered for model {}", model_type.as_str()),
                component: "ModelRouter".to_string(),
            }
        })
    }
    
    /// Get task info by ID (placeholder implementation)
    async fn get_task_info(&self, task_id: &str) -> PhoenixResult<TaskInfo> {
        // This would likely use the AntigravityCore to get task info
        // For now, return a placeholder that allows code to compile
        Err(PhoenixError::Agent {
            kind: crate::modules::orchestrator::errors::AgentErrorKind::NotImplemented,
            message: format!("get_task_info not implemented, task_id: {}", task_id),
            component: "ModelRouter".to_string(),
        })
    }
    
    /// List available models
    pub fn list_available_models(&self) -> Vec<ModelType> {
        self.clients.keys().cloned().collect()
    }
    
    /// Get model info
    pub fn get_model_info(&self, model_type: &ModelType) -> Option<ModelInfo> {
        if !self.clients.contains_key(model_type) {
            return None;
        }
        
        Some(ModelInfo {
            model_type: model_type.clone(),
            name: model_type.as_str().to_string(),
            max_tokens: model_type.default_max_tokens(),
            supports_streaming: true,
            api_endpoint: self.config.api_endpoints.get(model_type).cloned(),
        })
    }
}

/// Model information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    /// Model type
    pub model_type: ModelType,
    /// Display name
    pub name: String,
    /// Maximum tokens supported
    pub max_tokens: usize,
    /// Whether the model supports streaming
    pub supports_streaming: bool,
    /// API endpoint for this model
    pub api_endpoint: Option<String>,
}
