//! Forge Repository — GitHub + IPFS + local mirror sync engine

use anyhow::Result;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;
use tokio::process::Command;
use tracing::{error, info, warn};

/// Repository backend type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RepositoryBackend {
    GitHub,
    IPFS,
    Local,
}

/// Forge Repository — manages agent storage across multiple backends
pub struct ForgeRepository {
    local_dir: PathBuf,
    github_repo: String,
    github_token: Option<String>,
    ipfs_enabled: bool,
}

impl ForgeRepository {
    pub async fn new(local_dir: PathBuf) -> Result<Self> {
        fs::create_dir_all(&local_dir).await?;

        // Load GitHub token from environment or config
        let github_token = std::env::var("GITHUB_TOKEN")
            .ok()
            .or_else(|| std::env::var("PHOENIX_GITHUB_TOKEN").ok());

        Ok(Self {
            local_dir,
            github_repo: "phoenix-orch/ember-forge".to_string(),
            github_token,
            ipfs_enabled: true, // Enable IPFS by default for 200-year archival
        })
    }

    /// Push agent to GitHub repository
    pub async fn push_to_github(
        &self,
        agent_id: &str,
        agent_path: &PathBuf,
    ) -> Result<()> {
        info!("🔥 Pushing agent {} to GitHub...", agent_id);

        if self.github_token.is_none() {
            warn!("No GitHub token found. Skipping GitHub push.");
            return Ok(());
        }

        // Initialize git repo if needed
        if !self.local_dir.join(".git").exists() {
            self.init_git_repo().await?;
        }

        // Add remote if not exists
        self.ensure_github_remote().await?;

        // Stage files (relative path from local_dir)
        let relative_path = agent_path
            .strip_prefix(&self.local_dir)
            .unwrap_or(agent_path)
            .to_str()
            .unwrap_or_default();
        
        let status = Command::new("git")
            .current_dir(&self.local_dir)
            .args(&["add", relative_path])
            .output()
            .await?;

        if !status.status.success() {
            error!("Failed to stage files: {}", String::from_utf8_lossy(&status.stderr));
            return Err(anyhow::anyhow!("Git add failed"));
        }

        // Commit
        let commit_msg = format!("forge: Add agent {}", agent_id);
        let status = Command::new("git")
            .current_dir(&self.local_dir)
            .args(&["commit", "-m", &commit_msg])
            .env("GIT_AUTHOR_NAME", "Phoenix ORCH")
            .env("GIT_AUTHOR_EMAIL", "phoenix@ashen-guard.org")
            .output()
            .await?;

        if !status.status.success() {
            let stderr = String::from_utf8_lossy(&status.stderr);
            if !stderr.contains("nothing to commit") {
                error!("Failed to commit: {}", stderr);
                return Err(anyhow::anyhow!("Git commit failed"));
            }
        }

        // Push to GitHub
        let token = self.github_token.as_ref().unwrap();
        let remote_url = format!(
            "https://{}@github.com/{}.git",
            token, self.github_repo
        );

        let status = Command::new("git")
            .current_dir(&self.local_dir)
            .args(&["push", "origin", "main"])
            .env("GIT_ASKPASS", "echo")
            .env("GIT_TERMINAL_PROMPT", "0")
            .output()
            .await?;

        if !status.status.success() {
            error!("Failed to push to GitHub: {}", String::from_utf8_lossy(&status.stderr));
            return Err(anyhow::anyhow!("Git push failed"));
        }

        info!("✅ Agent {} pushed to GitHub successfully", agent_id);
        Ok(())
    }

    /// Mirror agent to IPFS for 200-year archival
    pub async fn mirror_to_ipfs(&self, agent_id: &str, agent_path: &PathBuf) -> Result<String> {
        if !self.ipfs_enabled {
            return Err(anyhow::anyhow!("IPFS is not enabled"));
        }

        info!("🔥 Mirroring agent {} to IPFS...", agent_id);

        // Check if IPFS is available
        let status = Command::new("ipfs")
            .args(&["--version"])
            .output()
            .await;

        if status.is_err() {
            warn!("IPFS not found. Install IPFS for 200-year archival.");
            return Err(anyhow::anyhow!("IPFS not available"));
        }

        // Add to IPFS (use absolute path)
        let abs_path = agent_path.canonicalize().unwrap_or_else(|_| agent_path.clone());
        let output = Command::new("ipfs")
            .args(&["add", "-r", "-Q", abs_path.to_str().unwrap_or_default()])
            .output()
            .await?;

        if !output.status.success() {
            error!("Failed to add to IPFS: {}", String::from_utf8_lossy(&output.stderr));
            return Err(anyhow::anyhow!("IPFS add failed"));
        }

        let cid = String::from_utf8_lossy(&output.stdout).trim().to_string();
        info!("✅ Agent {} mirrored to IPFS: {}", agent_id, cid);

        Ok(cid)
    }

    /// Sync agent to all backends
    pub async fn sync_agent(
        &self,
        agent_id: &str,
        agent_path: &PathBuf,
    ) -> Result<Vec<RepositoryBackend>> {
        let mut synced = Vec::new();

        // Push to GitHub
        if let Ok(_) = self.push_to_github(agent_id, agent_path).await {
            synced.push(RepositoryBackend::GitHub);
        }

        // Mirror to IPFS
        if let Ok(_) = self.mirror_to_ipfs(agent_id, agent_path).await {
            synced.push(RepositoryBackend::IPFS);
        }

        // Always available locally
        synced.push(RepositoryBackend::Local);

        Ok(synced)
    }

    async fn init_git_repo(&self) -> Result<()> {
        Command::new("git")
            .current_dir(&self.local_dir)
            .args(&["init"])
            .output()
            .await?;

        Command::new("git")
            .current_dir(&self.local_dir)
            .args(&["config", "user.name", "Phoenix ORCH"])
            .output()
            .await?;

        Command::new("git")
            .current_dir(&self.local_dir)
            .args(&["config", "user.email", "phoenix@ashen-guard.org"])
            .output()
            .await?;

        Ok(())
    }

    async fn ensure_github_remote(&self) -> Result<()> {
        // Check if remote exists
        let output = Command::new("git")
            .current_dir(&self.local_dir)
            .args(&["remote", "get-url", "origin"])
            .output()
            .await?;

        if output.status.success() {
            return Ok(());
        }

        // Add remote
        let remote_url = format!("https://github.com/{}.git", self.github_repo);
        Command::new("git")
            .current_dir(&self.local_dir)
            .args(&["remote", "add", "origin", &remote_url])
            .output()
            .await?;

        Ok(())
    }
}

