use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::time::SystemTime;

/// System state snapshot for persistence and recovery
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemSnapshot {
    /// Timestamp when snapshot was taken
    pub timestamp: SystemTime,
    /// Active component states
    pub components: Vec<ComponentState>,
    /// Memory state
    pub memory: Option<MemoryState>,
    /// World model state
    pub world_model: Option<WorldModelState>,
}

impl SystemSnapshot {
    /// Save snapshot to disk
    pub async fn save(&self) -> Result<()> {
        let json = serde_json::to_string_pretty(self)?;
        tokio::fs::write("system_snapshot.json", json).await?;
        Ok(())
    }

    /// Load snapshot from disk
    pub async fn load() -> Result<Self> {
        let json = tokio::fs::read_to_string("system_snapshot.json").await?;
        let snapshot = serde_json::from_str(&json)?;
        Ok(snapshot)
    }
}

/// Component state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentState {
    /// Component name
    pub name: String,
    /// Component status
    pub status: ComponentStatus,
}

/// Component status
#[derive(Debug, Serialize, Deserialize)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ComponentStatus {
    /// Component is running normally
    Running,
    /// Component is paused
    Paused,
    /// Component has failed
    Failed(String),
}

/// Memory system state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryState {
    /// Memory usage statistics
    pub stats: MemoryStats,
}

/// Memory statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryStats {
    /// Total memory allocated (bytes)
    pub total_allocated: u64,
    /// Number of active memory fragments
    pub active_fragments: usize,
}

/// World model state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldModelState {
    /// Model version
    pub version: String,
    /// Active entities
    pub entity_count: usize,
}