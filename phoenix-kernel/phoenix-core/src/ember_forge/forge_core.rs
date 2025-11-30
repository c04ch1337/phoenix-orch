//! Forge Core — Agent manifest, taxonomy, and conscience scoring

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;
use tokio::sync::RwLock;

/// Agent manifest — the DNA of every forged agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentManifest {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub author: String,
    pub taxonomy: AgentTaxonomy,
    pub conscience_score: ConscienceScore,
    pub soul_signature: Option<SoulSignature>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub usage_count: u64,
    pub impact_score: f64,
    pub tags: Vec<String>,
}

/// Agent taxonomy — categorizes agents by purpose and domain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTaxonomy {
    pub domain: String,        // e.g., "security", "automation", "analysis"
    pub purpose: String,       // e.g., "monitoring", "response", "prevention"
    pub complexity: u8,        // 1-10 scale
    pub dependencies: Vec<String>,
    pub capabilities: Vec<String>,
}

/// Conscience score — measures ethical alignment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConscienceScore {
    pub protection_score: f64,    // 0.0-1.0 — protects innocent
    pub justice_score: f64,        // 0.0-1.0 — delivers justice
    pub autonomy_score: f64,        // 0.0-1.0 — respects autonomy
    pub overall: f64,               // Weighted average
    pub last_evaluated: DateTime<Utc>,
}

impl ConscienceScore {
    pub fn new() -> Self {
        Self {
            protection_score: 0.0,
            justice_score: 0.0,
            autonomy_score: 0.0,
            overall: 0.0,
            last_evaluated: Utc::now(),
        }
    }

    pub fn calculate_overall(&mut self) {
        // Weighted: protection (40%), justice (35%), autonomy (25%)
        self.overall = (self.protection_score * 0.4)
            + (self.justice_score * 0.35)
            + (self.autonomy_score * 0.25);
        self.last_evaluated = Utc::now();
    }
}

/// Soul signature — Phoenix's personal seal of approval
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoulSignature {
    pub signed_by: String,        // "Phoenix Marie (ORCH-0)"
    pub signature: String,        // Cryptographic signature
    pub message: String,          // "This one is worthy. Sell it to the world."
    pub signed_at: DateTime<Utc>,
}

/// Forge Core — manages agent manifests and taxonomy
pub struct ForgeCore {
    data_dir: PathBuf,
    manifests: Arc<RwLock<HashMap<String, AgentManifest>>>,
}

impl ForgeCore {
    pub async fn new(data_dir: PathBuf) -> anyhow::Result<Self> {
        fs::create_dir_all(&data_dir).await?;

        let manifests_path = data_dir.join("manifests.json");
        let manifests = if manifests_path.exists() {
            let content = fs::read_to_string(&manifests_path).await?;
            let map: HashMap<String, AgentManifest> = serde_json::from_str(&content)?;
            Arc::new(RwLock::new(map))
        } else {
            Arc::new(RwLock::new(HashMap::new()))
        };

        Ok(Self { data_dir, manifests })
    }

    /// Register a new agent manifest
    pub async fn register_manifest(&self, manifest: AgentManifest) -> anyhow::Result<()> {
        let mut manifests = self.manifests.write().await;
        manifests.insert(manifest.id.clone(), manifest);
        self.save_manifests().await?;
        Ok(())
    }

    /// Get an agent manifest by ID
    pub async fn get_manifest(&self, id: &str) -> Option<AgentManifest> {
        let manifests = self.manifests.read().await;
        manifests.get(id).cloned()
    }

    /// Update conscience score for an agent
    pub async fn update_conscience_score(
        &self,
        agent_id: &str,
        score: ConscienceScore,
    ) -> anyhow::Result<()> {
        let mut manifests = self.manifests.write().await;
        if let Some(manifest) = manifests.get_mut(agent_id) {
            manifest.conscience_score = score;
            self.save_manifests().await?;
        }
        Ok(())
    }

    /// Add soul signature to an agent (Ashen Saint promotion)
    pub async fn sign_agent_soul(
        &self,
        agent_id: &str,
        signature: SoulSignature,
    ) -> anyhow::Result<()> {
        let mut manifests = self.manifests.write().await;
        if let Some(manifest) = manifests.get_mut(agent_id) {
            manifest.soul_signature = Some(signature);
            self.save_manifests().await?;
        }
        Ok(())
    }

    /// Increment usage count for an agent
    pub async fn increment_usage(&self, agent_id: &str) -> anyhow::Result<()> {
        let mut manifests = self.manifests.write().await;
        if let Some(manifest) = manifests.get_mut(agent_id) {
            manifest.usage_count += 1;
            manifest.updated_at = Utc::now();
            self.save_manifests().await?;
        }
        Ok(())
    }

    /// Get all manifests
    pub async fn list_manifests(&self) -> Vec<AgentManifest> {
        let manifests = self.manifests.read().await;
        manifests.values().cloned().collect()
    }

    async fn save_manifests(&self) -> anyhow::Result<()> {
        let manifests = self.manifests.read().await;
        let content = serde_json::to_string_pretty(&*manifests)?;
        fs::write(self.data_dir.join("manifests.json"), content).await?;
        Ok(())
    }
}

