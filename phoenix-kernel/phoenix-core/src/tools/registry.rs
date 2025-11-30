//! Tool Registry
//!
//! Encrypted storage and management of all tools in Phoenix ORCH's arsenal.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::core::memory::{MemoryEntry, PersistenceService};
use super::traits::{EternalTool, HitmLevel};

/// Tool metadata stored in registry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolMetadata {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub yaml_spec: String,
    pub hitm_level: HitmLevel,
    pub github_repo: Option<String>,
    pub created_at: String,
    pub last_used: Option<String>,
}

/// Tool Registry
///
/// Manages all tools in Phoenix ORCH's eternal arsenal.
/// Tools are stored in encrypted memory and can be dynamically registered.
pub struct ToolRegistry {
    memory: Arc<tokio::sync::Mutex<PersistenceService>>,
    tools: Arc<RwLock<HashMap<String, Box<dyn EternalTool>>>>,
}

impl ToolRegistry {
    pub fn new(memory: Arc<tokio::sync::Mutex<PersistenceService>>) -> Self {
        Self {
            memory,
            tools: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Register a tool in the arsenal
    pub async fn register(&self, tool: Box<dyn EternalTool>) -> Result<String, anyhow::Error> {
        let tool_id = Uuid::new_v4().to_string();
        let name = tool.name().to_string();
        let version = tool.version().to_string();
        let description = tool.description().to_string();
        let hitm_level = tool.hitm_level();
        
        // Store tool metadata in memory
        let metadata = ToolMetadata {
            id: tool_id.clone(),
            name: name.clone(),
            version,
            description,
            yaml_spec: format!("tool: {}\nversion: {}\nhitm_level: {:?}", name, version, hitm_level),
            hitm_level,
            github_repo: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            last_used: None,
        };
        
        let memory_entry = MemoryEntry::new(
            format!("Tool: {}", name),
            serde_json::json!({
                "type": "tool_registration",
                "tool_id": tool_id,
                "metadata": metadata,
            }),
        );
        
        {
            let mut mem = self.memory.lock().await;
            mem.store(&memory_entry).await?;
        }
        
        // Register in runtime registry
        {
            let mut tools = self.tools.write().await;
            tools.insert(tool_id.clone(), tool);
        }
        
        Ok(tool_id)
    }
    
    /// Get a tool by ID (simplified - returns None for now)
    /// In production, this would use Arc internally for proper sharing
    pub async fn get_tool(&self, _tool_id: &str) -> Option<()> {
        None // Placeholder - actual implementation would return tool reference
    }
    
    /// List all registered tools
    pub async fn list_tools(&self) -> Vec<ToolMetadata> {
        let mem = self.memory.lock().await;
        if let Ok(all_entries) = mem.list_all().await {
            all_entries
                .into_iter()
                .filter_map(|entry| {
                    if let Some(metadata) = entry.metadata.as_object() {
                        if metadata.get("type")?.as_str()? == "tool_registration" {
                            if let Some(tool_meta) = metadata.get("metadata") {
                                serde_json::from_value(tool_meta.clone()).ok()
                            } else {
                                None
                            }
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                })
                .collect()
        } else {
            Vec::new()
        }
    }
    
    /// Call a tool by name
    pub async fn call_tool(&self, name: &str, params: super::traits::ToolParams) -> Result<super::traits::ToolOutput, anyhow::Error> {
        let tools = self.tools.read().await;
        
        // Find tool by name
        for (_, tool) in tools.iter() {
            if tool.name() == name {
                return tool.call(params).await;
            }
        }
        
        Err(anyhow::anyhow!("Tool not found: {}", name))
    }
}

