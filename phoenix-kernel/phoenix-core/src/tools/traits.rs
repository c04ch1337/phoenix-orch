//! Eternal Tool Trait
//!
//! The foundation of Phoenix ORCH's infinite tool arsenal.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use anyhow::Result;
use async_trait::async_trait;

/// Human-in-the-Middle approval levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HitmLevel {
    /// No approval required
    None = 0,
    /// Low-risk operations
    Low = 1,
    /// Medium-risk operations
    Medium = 2,
    /// High-risk operations (destructive, network-wide, etc.)
    High = 3,
    /// Critical operations (system-level, irreversible)
    Critical = 4,
}

/// Tool parameters (flexible JSON structure)
pub type ToolParams = HashMap<String, serde_json::Value>;

/// Tool output (structured result)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolOutput {
    pub success: bool,
    pub data: serde_json::Value,
    pub message: String,
    pub warnings: Vec<String>,
    pub metadata: HashMap<String, String>,
}

/// Eternal Tool Trait
///
/// Every tool in Phoenix ORCH's arsenal implements this trait.
/// Tools are infinite, extensible, and versioned for eternity.
pub trait EternalTool: Send + Sync {
    /// Execute the tool with given parameters
    fn call(&self, params: ToolParams) -> Result<ToolOutput>;
    
    /// Get the HITM approval level required for this tool
    fn hitm_level(&self) -> HitmLevel;
    
    /// Get the tool's name
    fn name(&self) -> &str;
    
    /// Get the tool's version
    fn version(&self) -> &str;
    
    /// Get the tool's description
    fn description(&self) -> &str;
}

