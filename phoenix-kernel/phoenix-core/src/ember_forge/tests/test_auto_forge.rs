//! Tests for Auto Forge functionality

use anyhow::Result;
use phoenix_core::ember_forge::{
    forge_auto_forge::{AutoForge, ForgeRequest},
    forge_core::ForgeCore,
    forge_repository::ForgeRepository,
};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_test;

#[tokio::test]
async fn test_forge_agent() -> Result<()> {
    let temp_dir = std::env::temp_dir().join("forge_test");
    std::fs::create_dir_all(&temp_dir)?;

    let core = Arc::new(RwLock::new(ForgeCore::new(temp_dir.join("core")).await?));
    let repo = Arc::new(RwLock::new(ForgeRepository::new(temp_dir.join("repo")).await?));
    let auto_forge = AutoForge::new(core, repo).await?;

    let request = ForgeRequest {
        name: "Test Agent".to_string(),
        description: "A test agent".to_string(),
        domain: "testing".to_string(),
        purpose: "testing".to_string(),
        capabilities: vec!["test".to_string()],
        dependencies: vec![],
    };

    let result = auto_forge.forge_agent(request).await?;
    assert_eq!(result.agent_id.starts_with("agent-"), true);
    assert!(result.code_path.exists());

    Ok(())
}

