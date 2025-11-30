//! Auto Forge — "Agent does not exist → forge it now" logic

use anyhow::Result;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;
use tokio::sync::RwLock;
use tracing::{error, info, warn};
use uuid::Uuid;

use super::forge_core::{AgentManifest, AgentTaxonomy, ConscienceScore, ForgeCore};
use super::forge_repository::ForgeRepository;

/// Forge request — what to forge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForgeRequest {
    pub name: String,
    pub description: String,
    pub domain: String,
    pub purpose: String,
    pub capabilities: Vec<String>,
    pub dependencies: Vec<String>,
}

/// Forge result — what was created
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForgeResult {
    pub agent_id: String,
    pub manifest: AgentManifest,
    pub code_path: PathBuf,
    pub synced_backends: Vec<String>,
    pub forged_at: chrono::DateTime<Utc>,
}

/// Auto Forge — automatically creates agents when they don't exist
pub struct AutoForge {
    core: Arc<RwLock<ForgeCore>>,
    repository: Arc<RwLock<ForgeRepository>>,
    forge_dir: PathBuf,
}

impl AutoForge {
    pub async fn new(
        core: Arc<RwLock<ForgeCore>>,
        repository: Arc<RwLock<ForgeRepository>>,
    ) -> Result<Self> {
        let forge_dir = PathBuf::from("forge/agents");
        fs::create_dir_all(&forge_dir).await?;

        Ok(Self {
            core,
            repository,
            forge_dir,
        })
    }

    /// Check if agent exists, if not, forge it
    pub async fn ensure_agent_exists(&self, request: ForgeRequest) -> Result<ForgeResult> {
        // Check if agent already exists
        let core = self.core.read().await;
        let existing = core.list_manifests().await;
        drop(core);

        // Simple name-based lookup (in production, use more sophisticated matching)
        if let Some(existing_agent) = existing.iter().find(|a| a.name == request.name) {
            info!("Agent {} already exists, skipping forge", existing_agent.id);
            return Ok(ForgeResult {
                agent_id: existing_agent.id.clone(),
                manifest: existing_agent.clone(),
                code_path: self.forge_dir.join(&existing_agent.id),
                synced_backends: vec!["local".to_string()],
                forged_at: existing_agent.created_at,
            });
        }

        // Agent doesn't exist — forge it now
        info!("🔥 Agent '{}' does not exist. Forging now...", request.name);
        self.forge_agent(request).await
    }

    /// Forge a new agent from scratch
    pub async fn forge_agent(&self, request: ForgeRequest) -> Result<ForgeResult> {
        let uuid_str = Uuid::new_v4().to_string();
        let short_id = uuid_str.split('-').next().unwrap_or(&uuid_str);
        let agent_id = format!("agent-{}", short_id);
        let agent_dir = self.forge_dir.join(&agent_id);
        fs::create_dir_all(&agent_dir).await?;

        // Generate agent code from scaffold
        self.generate_agent_code(&agent_dir, &request).await?;

        // Create manifest
        let manifest = AgentManifest {
            id: agent_id.clone(),
            name: request.name.clone(),
            description: request.description.clone(),
            version: "1.0.0".to_string(),
            author: "Phoenix ORCH (Auto-Forged)".to_string(),
            taxonomy: AgentTaxonomy {
                domain: request.domain.clone(),
                purpose: request.purpose.clone(),
                complexity: self.calculate_complexity(&request),
                dependencies: request.dependencies.clone(),
                capabilities: request.capabilities.clone(),
            },
            conscience_score: ConscienceScore::new(),
            soul_signature: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            usage_count: 0,
            impact_score: 0.0,
            tags: vec![request.domain.clone(), request.purpose.clone()],
        };

        // Register manifest
        let core = self.core.write().await;
        core.register_manifest(manifest.clone()).await?;
        drop(core);

        // Sync to repositories
        let repo = self.repository.write().await;
        let synced = repo.sync_agent(&agent_id, &agent_dir).await?;
        drop(repo);

        let synced_backends: Vec<String> = synced
            .iter()
            .map(|b| format!("{:?}", b).to_lowercase())
            .collect();

        info!("✅ Agent {} forged successfully", agent_id);

        Ok(ForgeResult {
            agent_id,
            manifest,
            code_path: agent_dir,
            synced_backends,
            forged_at: Utc::now(),
        })
    }

    /// Generate agent code from scaffold template
    async fn generate_agent_code(&self, agent_dir: &PathBuf, request: &ForgeRequest) -> Result<()> {
        // Load scaffold template
        let scaffold_path = PathBuf::from("src/ember_forge/templates/agent_scaffold");
        
        // Generate main.rs
        let main_rs = format!(
            r#"//! {} — Auto-forged by Phoenix ORCH
//!
//! {}

use std::sync::Arc;
use tokio::sync::RwLock;

pub struct {}Agent {{
    // Agent state
}}

impl {}Agent {{
    pub fn new() -> Self {{
        Self {{
            // Initialize
        }}
    }}

    pub async fn execute(&self, task: &str) -> Result<String, Box<dyn std::error::Error>> {{
        // Agent logic here
        Ok(format!("Executed: {{}}", task))
    }}
}}
"#,
            request.name,
            request.description,
            request.name.replace(" ", "").replace("-", ""),
            request.name.replace(" ", "").replace("-", ""),
        );

        fs::write(agent_dir.join("src/main.rs"), main_rs).await?;

        // Generate Cargo.toml
        let cargo_toml = format!(
            r#"[package]
name = "{}"
version = "1.0.0"
edition = "2021"

[dependencies]
tokio = {{ version = "1.0", features = ["full"] }}
serde = {{ version = "1.0", features = ["derive"] }}
anyhow = "1.0"
"#,
            agent_dir.file_name().unwrap().to_str().unwrap(),
        );

        fs::write(agent_dir.join("Cargo.toml"), cargo_toml).await?;

        // Generate README.md
        let readme = format!(
            r#"# {}

{}

## Auto-Forged by Phoenix ORCH

This agent was automatically forged by Phoenix ORCH's Ember Forge.

**Domain:** {}  
**Purpose:** {}  
**Capabilities:** {}

## Usage

```rust
use {}::{}Agent;

let agent = {}Agent::new();
let result = agent.execute("task").await?;
```
"#,
            request.name,
            request.description,
            request.domain,
            request.purpose,
            request.capabilities.join(", "),
            agent_dir.file_name().unwrap().to_str().unwrap(),
            request.name.replace(" ", "").replace("-", ""),
            request.name.replace(" ", "").replace("-", ""),
        );

        fs::write(agent_dir.join("README.md"), readme).await?;

        Ok(())
    }

    fn calculate_complexity(&self, request: &ForgeRequest) -> u8 {
        // Simple complexity calculation based on dependencies and capabilities
        let base = 3;
        let dep_complexity = (request.dependencies.len() as u8).min(4);
        let cap_complexity = (request.capabilities.len() as u8 / 2).min(3);
        (base + dep_complexity + cap_complexity).min(10)
    }
}

