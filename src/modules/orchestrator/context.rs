//! PhoenixContext Implementation
//!
//! This module contains the PhoenixContext implementation, which provides
//! the OrchestratorAgent with access to all system components.

use std::sync::{Arc, RwLock};
use std::collections::HashMap;
use std::time::{Instant, SystemTime};
use std::path::PathBuf;

use crate::modules::orchestrator::errors::{PhoenixResult, PhoenixError, AgentErrorKind};
use crate::modules::orchestrator::agent::{SystemConfig};
use std::fmt;

/// Memory knowledge base types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum KnowledgeBaseType {
    /// Episodic memory (personal experiences and events)
    Episodic,
    /// Semantic memory (facts, concepts, and general knowledge)
    Semantic,
    /// Procedural memory (skills, procedures, and how-to knowledge)
    Procedural,
    /// Working memory (current context and temporary information)
    Working,
}

impl fmt::Display for KnowledgeBaseType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            KnowledgeBaseType::Episodic => write!(f, "episodic"),
            KnowledgeBaseType::Semantic => write!(f, "semantic"),
            KnowledgeBaseType::Procedural => write!(f, "procedural"),
            KnowledgeBaseType::Working => write!(f, "working"),
        }
    }
}

/// Memory entry in a knowledge base
#[derive(Debug, Clone)]
pub struct MemoryEntry {
    /// Unique identifier for the memory
    pub id: String,
    /// The actual content of the memory
    pub content: String,
    /// When the memory was created
    pub created_at: SystemTime,
    /// When the memory was last accessed
    pub last_accessed: SystemTime,
    /// Type of knowledge base this memory belongs to
    pub kb_type: KnowledgeBaseType,
    /// Metadata associated with the memory
    pub metadata: HashMap<String, String>,
    /// Vector embedding of the memory content (for similarity search)
    pub embedding: Option<Vec<f32>>,
}

/// Knowledge base for storing memories
#[derive(Debug)]
pub struct KnowledgeBase {
    /// Type of knowledge base
    pub kb_type: KnowledgeBaseType,
    /// Memories stored in this knowledge base
    pub memories: HashMap<String, MemoryEntry>,
    /// Path to persistent storage for this knowledge base
    pub storage_path: PathBuf,
}

impl KnowledgeBase {
    /// Create a new knowledge base
    pub fn new(kb_type: KnowledgeBaseType, storage_path: PathBuf) -> Self {
        Self {
            kb_type,
            memories: HashMap::new(),
            storage_path,
        }
    }

    /// Add a memory to the knowledge base
    pub fn add_memory(&mut self, memory: MemoryEntry) -> PhoenixResult<()> {
        self.memories.insert(memory.id.clone(), memory);
        Ok(())
    }

    /// Retrieve a memory by ID
    pub fn get_memory(&self, id: &str) -> Option<&MemoryEntry> {
        self.memories.get(id)
    }
}

/// PhoenixContext provides the OrchestratorAgent with access to
/// all required system components
pub struct PhoenixContext {
    /// System configuration
    pub config: SystemConfig,
    
    /// Health status information
    pub health: Arc<RwLock<SystemHealth>>,
    
    /// Memory knowledge bases
    pub knowledge_bases: HashMap<KnowledgeBaseType, Arc<RwLock<KnowledgeBase>>>,
    
    /// Conscience system
    pub conscience_placeholder: bool,
    
    /// World model
    pub world_model_placeholder: bool,
}

/// System health information
#[derive(Debug, Clone)]
pub struct SystemHealth {
    /// Overall status
    pub status: String,
    
    /// Component-specific health
    pub components: HashMap<String, f32>,
    
    /// Last health check timestamp
    pub last_check: SystemTime,
}

impl PhoenixContext {
    /// Create a new PhoenixContext instance
    pub async fn new(config: SystemConfig) -> PhoenixResult<Self> {
        // Initialize health status
        let health = SystemHealth {
            status: "initializing".to_string(),
            components: HashMap::new(),
            last_check: SystemTime::now(),
        };
        
        // Initialize knowledge bases
        let mut knowledge_bases = HashMap::new();
        
        // Create base memory directory if it doesn't exist
        let memory_path = config.memory_path.clone();
        if !memory_path.exists() {
            std::fs::create_dir_all(&memory_path).map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::SerializationError,
                message: format!("Failed to create memory directory: {}", e),
                component: "PhoenixContext".to_string(),
            })?;
        }
        
        // Initialize all four knowledge bases
        for kb_type in [
            KnowledgeBaseType::Episodic,
            KnowledgeBaseType::Semantic,
            KnowledgeBaseType::Procedural,
            KnowledgeBaseType::Working,
        ].iter() {
            let kb_path = memory_path.join(kb_type.to_string());
            if !kb_path.exists() {
                std::fs::create_dir_all(&kb_path).map_err(|e| PhoenixError::Agent {
                    kind: AgentErrorKind::SerializationError,
                    message: format!("Failed to create KB directory: {}", e),
                    component: "PhoenixContext".to_string(),
                })?;
            }
            
            let kb = KnowledgeBase::new(*kb_type, kb_path);
            knowledge_bases.insert(*kb_type, Arc::new(RwLock::new(kb)));
        }
        
        Ok(Self {
            config,
            health: Arc::new(RwLock::new(health)),
            knowledge_bases,
            conscience_placeholder: true,
            world_model_placeholder: true,
        })
    }
    
    /// Get memory system health status
    pub async fn memory_health(&self) -> PhoenixResult<f32> {
        let mut health_values = Vec::new();
        
        // Check all knowledge bases
        for (kb_type, kb) in &self.knowledge_bases {
            // In a real implementation, this would do more thorough checks
            // For now, just check if we can acquire a read lock as a basic health check
            if kb.read().is_ok() {
                health_values.push(1.0);
            } else {
                health_values.push(0.0);
            }
            
            // Update health record for this specific KB
            if let Ok(mut health) = self.health.write() {
                health.components.insert(format!("memory_{}", kb_type), health_values.last().unwrap().clone());
                health.last_check = SystemTime::now();
            }
        }
        
        // Calculate average health value
        let avg_health = if health_values.is_empty() {
            0.0
        } else {
            health_values.iter().sum::<f32>() / health_values.len() as f32
        };
        
        // Update overall memory health
        if let Ok(mut health) = self.health.write() {
            health.components.insert("memory".to_string(), avg_health);
            health.last_check = SystemTime::now();
        }
        
        Ok(avg_health)
    }
    
    /// Get a specific knowledge base
    pub async fn get_kb(&self, kb_type: KnowledgeBaseType) -> PhoenixResult<Arc<RwLock<KnowledgeBase>>> {
        match self.knowledge_bases.get(&kb_type) {
            Some(kb) => Ok(kb.clone()),
            None => Err(PhoenixError::Agent {
                kind: AgentErrorKind::ToolNotFound,
                message: format!("Knowledge base not found: {}", kb_type),
                component: "PhoenixContext".to_string(),
            }),
        }
    }
    
    /// Store a memory in a specific knowledge base
    pub async fn store_memory(
        &self,
        kb_type: KnowledgeBaseType,
        content: String,
        metadata: HashMap<String, String>,
        embedding: Option<Vec<f32>>,
    ) -> PhoenixResult<String> {
        let kb = self.get_kb(kb_type).await?;
        
        let id = format!("{}_{}", kb_type, uuid::Uuid::new_v4());
        let now = SystemTime::now();
        
        let memory = MemoryEntry {
            id: id.clone(),
            content,
            created_at: now,
            last_accessed: now,
            kb_type,
            metadata,
            embedding,
        };
        
        // Add memory to knowledge base
        kb.write().unwrap().add_memory(memory)?;
        
        Ok(id)
    }
    
    /// Retrieve a memory from any knowledge base by ID
    pub async fn retrieve_memory(&self, id: &str) -> PhoenixResult<Option<MemoryEntry>> {
        // Try each knowledge base
        for (_, kb) in &self.knowledge_bases {
            let kb_guard = kb.read().unwrap();
            if let Some(memory) = kb_guard.get_memory(id) {
                // Clone the memory to return it
                let mut memory_clone = memory.clone();
                
                // Update last accessed time (would be done properly in a real implementation)
                memory_clone.last_accessed = SystemTime::now();
                
                return Ok(Some(memory_clone));
            }
        }
        
        Ok(None)
    }
    
    /// Get conscience system health status
    pub async fn conscience_health(&self) -> PhoenixResult<f32> {
        // In a real implementation, this would check the actual conscience system
        // For now, just return a placeholder value
        let health_value = 1.0;
        
        // Update health record
        if let Ok(mut health) = self.health.write() {
            health.components.insert("conscience".to_string(), health_value);
            health.last_check = SystemTime::now();
        }
        
        Ok(health_value)
    }
    
    /// Get world model coherence
    pub async fn world_coherence(&self) -> PhoenixResult<f32> {
        // In a real implementation, this would check the actual world model
        // For now, just return a placeholder value
        let health_value = 1.0;
        
        // Update health record
        if let Ok(mut health) = self.health.write() {
            health.components.insert("world_model".to_string(), health_value);
            health.last_check = SystemTime::now();
        }
        
        Ok(health_value)
    }
}