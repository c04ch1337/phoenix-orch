//! Tests for Leaderboard functionality

use anyhow::Result;
use phoenix_core::ember_forge::{
    forge_core::{AgentManifest, AgentTaxonomy, ConscienceScore},
    forge_leaderboard::{Leaderboard, RankingCriteria},
};
use chrono::Utc;
use std::path::PathBuf;
use tokio_test;

#[tokio::test]
async fn test_leaderboard_ranking() -> Result<()> {
    let temp_dir = std::env::temp_dir().join("leaderboard_test");
    std::fs::create_dir_all(&temp_dir)?;

    let leaderboard = Leaderboard::new(temp_dir).await?;

    // Create test manifests
    let mut manifests = Vec::new();
    for i in 0..5 {
        let mut score = ConscienceScore::new();
        score.protection_score = 0.8 + (i as f64 * 0.05);
        score.justice_score = 0.7 + (i as f64 * 0.05);
        score.autonomy_score = 0.6 + (i as f64 * 0.05);
        score.calculate_overall();

        manifests.push(AgentManifest {
            id: format!("agent-{}", i),
            name: format!("Agent {}", i),
            description: "Test agent".to_string(),
            version: "1.0.0".to_string(),
            author: "Test".to_string(),
            taxonomy: AgentTaxonomy {
                domain: "test".to_string(),
                purpose: "test".to_string(),
                complexity: 5,
                dependencies: vec![],
                capabilities: vec![],
            },
            conscience_score: score,
            soul_signature: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            usage_count: (i * 100) as u64,
            impact_score: i as f64 * 0.1,
            tags: vec![],
        });
    }

    leaderboard.update_from_manifests(manifests).await?;

    let top = leaderboard.get_top(3).await;
    assert_eq!(top.len(), 3);
    assert!(top[0].score >= top[1].score);

    Ok(())
}

