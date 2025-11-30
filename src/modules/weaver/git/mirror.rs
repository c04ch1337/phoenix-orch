use std::path::{Path, PathBuf};
use git2::{Repository, RemoteCallbacks, FetchOptions, Cred};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use anyhow::{Result, Context};
use tokio::sync::Mutex;
use std::collections::HashMap;
use std::sync::Arc;

pub struct GitMirror {
    base_path: PathBuf,
    mirrors: Arc<Mutex<HashMap<Uuid, Repository>>>,
}

impl GitMirror {
    pub fn new<P: AsRef<Path>>(base_path: P) -> Result<Self> {
        std::fs::create_dir_all(&base_path)?;
        Ok(Self {
            base_path: base_path.as_ref().to_path_buf(),
            mirrors: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    pub async fn mirror_repository(&self, url: &str, repo_id: Uuid) -> Result<PathBuf> {
        let repo_path = self.base_path.join(repo_id.to_string());
        
        // Set up authentication callbacks
        let mut callbacks = RemoteCallbacks::new();
        callbacks.credentials(|_url, username_from_url, _allowed_types| {
            // Use SSH key authentication if available, fallback to HTTPS
            if let Some(username) = username_from_url {
                Cred::ssh_key(
                    username,
                    None,
                    Path::new(&format!("{}/.ssh/id_rsa", std::env::var("HOME")?)),
                    None,
                )
            } else {
                // For HTTPS, try to get credentials from environment
                let username = std::env::var("GIT_USERNAME")?;
                let password = std::env::var("GIT_PASSWORD")?;
                Cred::userpass_plaintext(&username, &password)
            }
        });

        // Set up fetch options
        let mut fetch_opts = FetchOptions::new();
        fetch_opts.remote_callbacks(callbacks);

        // Clone the repository
        let repo = Repository::clone_with_fetch_options(
            url,
            &repo_path,
            &fetch_opts,
        ).context("Failed to clone repository")?;

        // Store the repository instance
        self.mirrors.lock().await.insert(repo_id, repo);

        Ok(repo_path)
    }

    pub async fn update_mirror(&self, repo_id: Uuid) -> Result<DateTime<Utc>> {
        let repo = self.mirrors.lock().await
            .get(&repo_id)
            .ok_or_else(|| anyhow::anyhow!("Repository not found"))?
            .clone();

        // Set up fetch options
        let mut remote = repo.find_remote("origin")?;
        let mut callbacks = RemoteCallbacks::new();
        callbacks.credentials(|_url, username_from_url, _allowed_types| {
            if let Some(username) = username_from_url {
                Cred::ssh_key(
                    username,
                    None,
                    Path::new(&format!("{}/.ssh/id_rsa", std::env::var("HOME")?)),
                    None,
                )
            } else {
                let username = std::env::var("GIT_USERNAME")?;
                let password = std::env::var("GIT_PASSWORD")?;
                Cred::userpass_plaintext(&username, &password)
            }
        });

        let mut fetch_opts = FetchOptions::new();
        fetch_opts.remote_callbacks(callbacks);

        // Fetch updates
        remote.fetch(&["master"], Some(&mut fetch_opts), None)?;

        // Get the latest commit time
        let head = repo.head()?;
        let commit = head.peel_to_commit()?;
        let timestamp = commit.time().seconds();
        
        Ok(DateTime::from_timestamp(timestamp, 0)
            .unwrap_or_else(|| Utc::now())
            .with_timezone(&Utc))
    }

    pub async fn get_mirror_path(&self, repo_id: Uuid) -> Option<PathBuf> {
        if self.mirrors.lock().await.contains_key(&repo_id) {
            Some(self.base_path.join(repo_id.to_string()))
        } else {
            None
        }
    }

    pub async fn remove_mirror(&self, repo_id: Uuid) -> Result<()> {
        // Remove from memory
        self.mirrors.lock().await.remove(&repo_id);

        // Remove from disk
        let path = self.base_path.join(repo_id.to_string());
        if path.exists() {
            std::fs::remove_dir_all(path)?;
        }

        Ok(())
    }

    pub async fn list_mirrors(&self) -> Vec<Uuid> {
        self.mirrors.lock().await.keys().cloned().collect()
    }
}