//! OrchestratorAgent Implementation
//!
//! This module contains the OrchestratorAgent implementation.

use std::sync::{Arc, RwLock};
use std::path::PathBuf;
use std::collections::HashMap;
use std::time::SystemTime;

use crate::modules::orchestrator::errors::{PhoenixResult, PhoenixError, AgentErrorKind};
use crate::modules::orchestrator::context::{PhoenixContext, KnowledgeBaseType};
use crate::modules::orchestrator::conscience::{ConscienceGate, ConscienceConfig, HumanReviewService};
use crate::modules::orchestrator::tool_registry::{ToolResult, ToolParameters, Tool};
use crate::modules::orchestrator::vector::{VectorSearchConfig, SearchResult};
use crate::modules::orchestrator::types::{
    ConscienceRequest, ConscienceResult, RequestId, RequestOrigin, HitmStatus
};

/// Configuration for the OrchestratorAgent
#[derive(Debug, Clone)]
pub struct OrchestratorConfig {
    /// System configuration
    pub system_config: SystemConfig,
    /// Vector search configuration
    pub vector_config: VectorSearchConfig,
    /// Conscience configuration
    pub conscience_config: ConscienceConfig,
    /// History capacity
    pub history_capacity: usize,
    /// Default search result limit
    pub default_search_limit: usize,
}

impl Default for OrchestratorConfig {
    fn default() -> Self {
        Self {
            system_config: SystemConfig::default(),
            vector_config: VectorSearchConfig::default(),
            conscience_config: ConscienceConfig::default(),
            history_capacity: 1000,
            default_search_limit: 10,
        }
    }
}

/// System configuration
#[derive(Debug, Clone, Default)]
pub struct SystemConfig {
    /// Path to memory storage
    pub memory_path: PathBuf,
    /// Path to values file
    pub values_path: PathBuf,
}

use std::time::Instant;
use serde_json;

use crate::modules::orchestrator::vector::VectorEngine;

/// Agent state information
#[derive(Debug)]
struct AgentState {
    /// When the agent was created
    start_time: Instant,
    
    /// Current agent status
    status: String,
}

impl AgentState {
    /// Create a new agent state
    fn new() -> Self {
        Self {
            start_time: Instant::now(),
            status: "initializing".to_string(),
        }
    }
    
    /// Get agent uptime in seconds
    fn uptime(&self) -> u64 {
        self.start_time.elapsed().as_secs()
    }
}

/// OrchestratorAgent is the central coordinator for Phoenix Marie
/// managing tools, memory access, and ethical screening
pub struct OrchestratorAgent {
    /// PhoenixContext provides access to all system components
    context: Arc<RwLock<PhoenixContext>>,
    
    /// Conscience gate for ethical validation
    conscience_gate: Arc<RwLock<ConscienceGate>>,
    
    /// Vector engine for semantic search over memory
    vector_engine: Arc<RwLock<VectorEngine>>,

    /// Tool registry for managing and executing tools
    tool_registry: Arc<RwLock<ToolRegistry>>,
    
    /// Configuration options for the agent
    config: OrchestratorConfig,
    
    /// Current agent state
    state: Arc<RwLock<AgentState>>,
}

impl OrchestratorAgent {
    /// Create a new OrchestratorAgent instance
    pub async fn new(config: OrchestratorConfig) -> PhoenixResult<Self> {
        // Initialize context
        let context = PhoenixContext::new(config.system_config.clone()).await?;
        
        // Initialize conscience gate with proper configuration
        let conscience_gate = ConscienceGate::new(
            config.conscience_config.clone(),
            None, // Human review service will be attached separately if needed
        ).await?;
        
        // Initialize vector engine
        let context_arc = Arc::new(RwLock::new(context));
        let vector_engine = VectorEngine::new(
            context_arc.clone(),
            config.vector_config.clone()
        ).await?;
        
        // Initialize tool registry
        let tool_registry = ToolRegistry::new();
        
        // Initialize agent state
        let state = AgentState::new();
        
        // Create agent instance
        let agent = Self {
            context: context_arc,
            conscience_gate: Arc::new(RwLock::new(conscience_gate)),
            vector_engine: Arc::new(RwLock::new(vector_engine)),
            tool_registry: Arc::new(RwLock::new(tool_registry)),
            config,
            state: Arc::new(RwLock::new(state)),
        };
        
        // Register default chat tool
        use crate::modules::orchestrator::tools::chat::ChatTool;
        agent.add_tool("chat", ChatTool::new().map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::IOError,
            message: format!("Failed to initialize ChatTool: {}", e),
            component: "OrchestratorAgent".to_string(),
        })?)?;
        
        Ok(agent)
    }
    
    /// Register a tool with the agent's tool registry
    pub fn add_tool<T: Tool + 'static>(&self, name: &str, tool: T) -> PhoenixResult<()> {
        let registry = self.tool_registry.write().map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::SerializationError,
            message: format!("Failed to acquire write lock on tool registry: {}", e),
            component: "OrchestratorAgent".to_string(),
        })?;
        
        registry.add_tool(name, Box::new(tool))
    }
    
    /// Execute a tool with the given parameters
    pub async fn execute_tool(
        &self,
        tool_id: &str,
        parameters: &str
    ) -> PhoenixResult<String> {
        // Parse parameters
        let params = ToolParameters::from(parameters.to_string());
        
        // Check if tool exists
        let registry = self.tool_registry.read().map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::SerializationError,
            message: format!("Failed to acquire read lock on tool registry: {}", e),
            component: "OrchestratorAgent".to_string(),
        })?;
        
        if !registry.has_tool(tool_id)? {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::ToolNotFound,
                message: format!("Tool '{}' not found in registry", tool_id),
                component: "OrchestratorAgent".to_string(),
            });
        }
        
        // Get tool info to check if it needs specific handling
        let (_, _, requires_human_review, requires_conscience_approval) = registry.get_tool_info(tool_id)?;
        
        // If tool requires conscience approval, evaluate through conscience gate
        if requires_conscience_approval {
            // Create request for conscience evaluation
            let request = ConscienceRequest {
                id: RequestId::new(),
                action: format!("Execute tool: {}", tool_id),
                tool_id: tool_id.to_string(),
                parameters: params.clone(),
                context: HashMap::new(),
                timestamp: SystemTime::now(),
                origin: RequestOrigin::User,
            };
            
            // Evaluate through conscience gate
            let conscience_result = self.conscience_gate.read().map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::SerializationError,
                message: format!("Failed to acquire read lock on conscience gate: {}", e),
                component: "OrchestratorAgent".to_string(),
            })?.evaluate(request.clone()).await?;
            
            // Check if approved
            if !conscience_result.approved {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::RequestRejected,
                    message: format!("Request rejected: {}",
                        conscience_result.violations.join(", ")),
                    component: "OrchestratorAgent".to_string(),
                });
            }
            
            // Check if human review required from conscience gate
            if conscience_result.requires_human_review {
                return Err(PhoenixError::Agent {
                    kind: AgentErrorKind::HumanReviewRequired,
                    message: "This request requires human review".to_string(),
                    component: "OrchestratorAgent".to_string(),
                });
            }
        }
        
        // Check if tool itself requires human review
        if requires_human_review {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::HumanReviewRequired,
                message: format!("Tool '{}' requires human review before execution", tool_id),
                component: "OrchestratorAgent".to_string(),
            });
        }
        
        // Execute the tool
        use crate::modules::orchestrator::tool_registry::ToolExecutionContext;
        let context = ToolExecutionContext {
            execution_id: uuid::Uuid::new_v4().to_string(),
            request_id: Some(RequestId::new()),
            user_id: None,
            origin: RequestOrigin::User,
            context: HashMap::new(),
            timestamp: SystemTime::now(),
        };
        let result = registry.execute_tool(tool_id, params, Some(context)).await?;
        
        // Return serialized result
        Ok(serde_json::to_string(&result)
            .map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::SerializationError,
                message: format!("Failed to serialize result: {}", e),
                component: "OrchestratorAgent".to_string(),
            })?)
    }
    
    /// Get a list of all registered tool names
    pub fn list_tools(&self) -> PhoenixResult<Vec<String>> {
        let registry = self.tool_registry.read().map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::SerializationError,
            message: format!("Failed to acquire read lock on tool registry: {}", e),
            component: "OrchestratorAgent".to_string(),
        })?;
        
        registry.list_tools()
    }
    
    /// Search memory using vector similarity across all knowledge bases
    ///
    /// This is the primary search method that should be used by clients.
    /// It searches across all memory knowledge bases and returns consolidated results.
    ///
    /// # Arguments
    ///
    /// * `query` - The search query string
    /// * `limit` - Maximum number of results to return
    ///
    /// # Returns
    ///
    /// A JSON string containing the search results
    pub async fn search_memory(
        &self,
        query: &str,
        limit: Option<usize>,
    ) -> PhoenixResult<String> {
        // Use provided limit or default from config
        let limit = limit.unwrap_or(self.config.default_search_limit);
        
        // Create request for conscience evaluation
        let request = ConscienceRequest {
            id: RequestId::new(),
            action: format!("Search memory: {}", query),
            tool_id: "memory_search".to_string(),
            parameters: format!("{{\"query\": \"{}\", \"limit\": {}}}", query, limit).into(),
            context: HashMap::new(),
            timestamp: SystemTime::now(),
            origin: RequestOrigin::User,
        };
        
        // Evaluate through conscience gate
        let conscience_result = self.conscience_gate.read().map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::SerializationError,
            message: format!("Failed to acquire read lock on conscience gate: {}", e),
            component: "OrchestratorAgent".to_string(),
        })?.evaluate(request.clone()).await?;
        
        // Check if approved
        if !conscience_result.approved {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::RequestRejected,
                message: format!("Request rejected: {}",
                    conscience_result.violations.join(", ")),
                component: "OrchestratorAgent".to_string(),
            });
        }
        
        // Check if human review required
        if conscience_result.requires_human_review {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::HumanReviewRequired,
                message: "This request requires human review".to_string(),
                component: "OrchestratorAgent".to_string(),
            });
        }
        
        // Perform vector search across all knowledge bases
        let results = self.vector_engine.read().await.search_all(query, limit, None).await?;
        
        // Return results
        Ok(serde_json::to_string(&results)
            .map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::SerializationError,
                message: format!("Failed to serialize result: {}", e),
                component: "OrchestratorAgent".to_string(),
            })?)
    }
    
    /// Search a specific knowledge base
    ///
    /// This method allows searching in just one of the memory knowledge bases.
    ///
    /// # Arguments
    ///
    /// * `query` - The search query string
    /// * `kb_type` - The specific knowledge base type to search
    /// * `limit` - Maximum number of results to return
    /// * `similarity_threshold` - Optional minimum similarity threshold
    ///
    /// # Returns
    ///
    /// A JSON string containing the search results from the specified knowledge base
    pub async fn search_specific_kb(
        &self,
        query: &str,
        kb_type: KnowledgeBaseType,
        limit: Option<usize>,
        similarity_threshold: Option<f32>,
    ) -> PhoenixResult<String> {
        // Use provided limit or default from config
        let limit = limit.unwrap_or(self.config.default_search_limit);
        
        // Create request for conscience evaluation
        let request = ConscienceRequest {
            id: RequestId::new(),
            action: format!("Search {} memory: {}", kb_type, query),
            tool_id: "memory_search_specific".to_string(),
            parameters: format!(
                "{{\"query\": \"{}\", \"kb_type\": \"{}\", \"limit\": {}}}",
                query, kb_type, limit
            ).into(),
            context: HashMap::new(),
            timestamp: SystemTime::now(),
            origin: RequestOrigin::User,
        };
        
        // Evaluate through conscience gate
        let conscience_result = self.conscience_gate.read().map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::SerializationError,
            message: format!("Failed to acquire read lock on conscience gate: {}", e),
            component: "OrchestratorAgent".to_string(),
        })?.evaluate(request.clone()).await?;
        
        // Check if approved
        if !conscience_result.approved {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::RequestRejected,
                message: format!("Request rejected: {}",
                    conscience_result.violations.join(", ")),
                component: "OrchestratorAgent".to_string(),
            });
        }
        
        // Perform vector search on the specific knowledge base
        let results = self.vector_engine.read().await.search_kb(
            query, kb_type, limit, similarity_threshold
        ).await?;
        
        // Return results
        Ok(serde_json::to_string(&results)
            .map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::SerializationError,
                message: format!("Failed to serialize result: {}", e),
                component: "OrchestratorAgent".to_string(),
            })?)
    }
    
    /// Store a memory with vector embedding
    ///
    /// This method stores a new memory in the specified knowledge base,
    /// generating and storing its vector embedding for future similarity searches.
    ///
    /// # Arguments
    ///
    /// * `content` - The memory content to store
    /// * `kb_type` - Knowledge base to store the memory in
    /// * `metadata` - Optional metadata associated with the memory
    ///
    /// # Returns
    ///
    /// The ID of the newly stored memory
    pub async fn store_memory(
        &self,
        content: &str,
        kb_type: KnowledgeBaseType,
        metadata: Option<HashMap<String, String>>,
    ) -> PhoenixResult<String> {
        // Create request for conscience evaluation
        let request = ConscienceRequest {
            id: RequestId::new(),
            action: format!("Store {} memory", kb_type),
            tool_id: "memory_store".to_string(),
            parameters: format!(
                "{{\"kb_type\": \"{}\", \"content_length\": {}}}",
                kb_type, content.len()
            ).into(),
            context: HashMap::new(),
            timestamp: SystemTime::now(),
            origin: RequestOrigin::User,
        };
        
        // Evaluate through conscience gate
        let conscience_result = self.conscience_gate.read().map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::SerializationError,
            message: format!("Failed to acquire read lock on conscience gate: {}", e),
            component: "OrchestratorAgent".to_string(),
        })?.evaluate(request.clone()).await?;
        
        // Check if approved
        if !conscience_result.approved {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::RequestRejected,
                message: format!("Request rejected: {}",
                    conscience_result.violations.join(", ")),
                component: "OrchestratorAgent".to_string(),
            });
        }
        
        // Generate embedding for the content
        let embedding = self.vector_engine.read().await.generate_embedding(content).await?;
        
        // Use provided metadata or create empty HashMap
        let metadata = metadata.unwrap_or_default();
        
        // Store the memory with its embedding
        let context = self.context.read().unwrap();
        let memory_id = context.store_memory(kb_type, content.to_string(), metadata, Some(embedding)).await?;
        
        Ok(memory_id)
    }
    
    /// Run a task through the OrchestratorAgent
    ///
    /// This is the primary method for executing tasks. It:
    /// 1. Validates the task through the conscience gate
    /// 2. Searches memory for relevant context
    /// 3. Executes the appropriate tool (defaults to "chat" if no specific tool is requested)
    /// 4. Returns the result
    ///
    /// # Arguments
    ///
    /// * `goal` - The task description or goal to accomplish
    ///
    /// # Returns
    ///
    /// A result string containing the task execution result
    pub async fn run_task(&self, goal: String) -> PhoenixResult<String> {
        // Update agent state
        {
            let mut state = self.state.write().map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::SerializationError,
                message: format!("Failed to acquire write lock on agent state: {}", e),
                component: "OrchestratorAgent".to_string(),
            })?;
            state.status = "processing_task".to_string();
        }
        
        // Search memory for relevant context
        let context_results = self.search_memory(&goal, Some(5)).await.unwrap_or_else(|_| "[]".to_string());
        
        // Default to chat tool if no specific tool is requested
        let tool_name = if goal.to_lowercase().starts_with("execute ") || goal.to_lowercase().starts_with("run ") {
            // Extract tool name from command
            let parts: Vec<&str> = goal.split_whitespace().collect();
            if parts.len() >= 2 {
                parts[1]
            } else {
                "chat"
            }
        } else {
            "chat"
        };
        
        // Prepare parameters with goal and context
        let params = format!(
            r#"{{"goal": "{}", "context": {}}}"#,
            goal,
            context_results
        );
        
        // Execute the tool
        let result = self.execute_tool(tool_name, &params).await?;
        
        // Update agent state
        {
            let mut state = self.state.write().map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::SerializationError,
                message: format!("Failed to acquire write lock on agent state: {}", e),
                component: "OrchestratorAgent".to_string(),
            })?;
            state.status = "idle".to_string();
        }
        
        Ok(result)
    }
}