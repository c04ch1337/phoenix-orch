//! Forge Leaderboard — Real-time usage/conscience/value ranking

use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;
use tokio::sync::{broadcast, RwLock};
use tracing::info;

use super::forge_core::{AgentManifest, ForgeCore};

/// Ranking criteria
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RankingCriteria {
    Conscience,    // Rank by conscience score
    Usage,         // Rank by usage count
    Impact,        // Rank by impact score
    Combined,      // Weighted combination
}

/// Leaderboard entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderboardEntry {
    pub rank: u32,
    pub agent_id: String,
    pub agent_name: String,
    pub score: f64,
    pub conscience_score: f64,
    pub usage_count: u64,
    pub impact_score: f64,
    pub is_ashen_saint: bool,
    pub last_updated: DateTime<Utc>,
}

/// Leaderboard event type for SSE
#[derive(Debug, Clone)]
pub struct LeaderboardEvent {
    pub event_type: String,
    pub timestamp: DateTime<Utc>,
}

/// Leaderboard — tracks and ranks agents
pub struct Leaderboard {
    data_dir: PathBuf,
    entries: Arc<RwLock<Vec<LeaderboardEntry>>>,
    criteria: RankingCriteria,
    event_sender: broadcast::Sender<LeaderboardEvent>,
}

impl Leaderboard {
    pub async fn new(data_dir: PathBuf) -> Result<Self> {
        fs::create_dir_all(&data_dir).await?;

        let entries_path = data_dir.join("leaderboard.json");
        let entries = if entries_path.exists() {
            let content = fs::read_to_string(&entries_path).await?;
            let vec: Vec<LeaderboardEntry> = serde_json::from_str(&content)?;
            Arc::new(RwLock::new(vec))
        } else {
            Arc::new(RwLock::new(Vec::new()))
        };

        // Create broadcast channel for leaderboard events
        let (event_sender, _) = broadcast::channel(100);

        Ok(Self {
            data_dir,
            entries,
            criteria: RankingCriteria::Combined,
            event_sender,
        })
    }

    /// Get event subscription channel
    pub fn subscribe(&self) -> broadcast::Receiver<LeaderboardEvent> {
        self.event_sender.subscribe()
    }

    /// Update rankings from agent manifests
    pub async fn update_rankings(&self) -> Result<()> {
        info!("🔥 Updating leaderboard rankings...");

        // This would be called with a reference to ForgeCore
        // For now, we'll implement a standalone update method
        // In production, this would fetch from ForgeCore

        self.save_entries().await?;

        // Emit leaderboard updated event
        self.emit_update_event().await;
        
        info!("✅ Leaderboard updated");
        Ok(())
    }

    /// Update rankings from agent manifests (with ForgeCore reference)
    pub async fn update_from_manifests(
        &self,
        manifests: Vec<AgentManifest>,
    ) -> Result<()> {
        let mut entries = Vec::new();

        for (idx, manifest) in manifests.iter().enumerate() {
            let score = match self.criteria {
                RankingCriteria::Conscience => manifest.conscience_score.overall,
                RankingCriteria::Usage => manifest.usage_count as f64 / 1000.0, // Normalize
                RankingCriteria::Impact => manifest.impact_score,
                RankingCriteria::Combined => {
                    // Weighted: conscience (40%), usage (30%), impact (30%)
                    (manifest.conscience_score.overall * 0.4)
                        + ((manifest.usage_count as f64 / 1000.0) * 0.3)
                        + (manifest.impact_score * 0.3)
                }
            };

            entries.push(LeaderboardEntry {
                rank: (idx + 1) as u32,
                agent_id: manifest.id.clone(),
                agent_name: manifest.name.clone(),
                score,
                conscience_score: manifest.conscience_score.overall,
                usage_count: manifest.usage_count,
                impact_score: manifest.impact_score,
                is_ashen_saint: manifest.soul_signature.is_some(),
                last_updated: Utc::now(),
            });
        }

        // Sort by score (descending)
        entries.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

        // Update ranks
        for (idx, entry) in entries.iter_mut().enumerate() {
            entry.rank = (idx + 1) as u32;
        }

        *self.entries.write().await = entries;
        self.save_entries().await?;
        
        // Emit leaderboard updated event
        self.emit_update_event().await;

        Ok(())
    }

    /// Get top N agents
    pub async fn get_top(&self, n: usize) -> Vec<LeaderboardEntry> {
        let entries = self.entries.read().await;
        entries.iter().take(n).cloned().collect()
    }

    /// Get top 100 (Ashen Saint threshold)
    pub async fn get_top_100(&self) -> Vec<LeaderboardEntry> {
        self.get_top(100).await
    }

    /// Get entry by agent ID
    pub async fn get_entry(&self, agent_id: &str) -> Option<LeaderboardEntry> {
        let entries = self.entries.read().await;
        entries.iter().find(|e| e.agent_id == agent_id).cloned()
    }

    /// Set ranking criteria
    pub fn set_criteria(&mut self, criteria: RankingCriteria) {
        self.criteria = criteria;
    }

    async fn save_entries(&self) -> Result<()> {
        let entries = self.entries.read().await;
        let content = serde_json::to_string_pretty(&*entries)?;
        fs::write(self.data_dir.join("leaderboard.json"), content).await?;
        Ok(())
    }

    /// Emit a leaderboard update event
    async fn emit_update_event(&self) {
        let event = LeaderboardEvent {
            event_type: "forge_leaderboard_updated".to_string(),
            timestamp: Utc::now(),
        };

        // It's okay if there are no listeners yet
        let _ = self.event_sender.send(event);
        info!("🔔 Emitted forge_leaderboard_updated event");
    }
}

