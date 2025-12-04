use std::sync::Arc;
use tokio::sync::RwLock;
use notify::{Watcher, RecursiveMode, Event};
use std::path::{Path, PathBuf};
use chrono::Utc;
use tokio::fs;
use std::collections::HashMap;

use crate::modules::orchestrator::cipher_guard::automation::{
    config::AutomationConfig,
    types::{Incident, Vulnerability, Severity},
};

pub struct ObsidianIntegration {
    config: Arc<RwLock<AutomationConfig>>,
    watcher: Option<Box<dyn Watcher>>,
    template_cache: Arc<RwLock<HashMap<String, String>>>,
}

impl ObsidianIntegration {
    pub async fn new(config: Arc<RwLock<AutomationConfig>>) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {
            config,
            watcher: None,
            template_cache: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    pub async fn start_file_watcher(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let config = self.config.read().await;
        let vault_path = config.obsidian.vault_path.clone();
        let template_cache = self.template_cache.clone();

        // Initialize watcher
        let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
            let template_cache = template_cache.clone();
            tokio::spawn(async move {
                if let Ok(event) = res {
                    match event.kind {
                        notify::EventKind::Create(_) | notify::EventKind::Modify(_) => {
                            if let Some(path) = event.paths.first() {
                                if path.extension().map_or(false, |ext| ext == "md") {
                                    // Process markdown file changes
                                    if let Err(e) = Self::process_file_change(path, &template_cache).await {
                                        eprintln!("Error processing file change: {}", e);
                                    }
                                }
                            }
                        }
                        _ => {}
                    }
                }
            });
        })?;

        // Start watching the vault directory
        watcher.watch(&vault_path, RecursiveMode::Recursive)?;
        self.watcher = Some(Box::new(watcher));

        // Initialize template cache
        self.load_templates().await?;

        // Start backup scheduler if enabled
        if config.obsidian.auto_backup_enabled {
            self.schedule_backups().await?;
        }

        Ok(())
    }

    pub async fn stop_file_watcher(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        self.watcher = None;
        Ok(())
    }

    pub async fn create_note(&self, template: &str, params: HashMap<String, String>) -> Result<PathBuf, Box<dyn std::error::Error>> {
        let config = self.config.read().await;
        let template_content = self.get_template(template).await?;
        
        // Replace template parameters
        let content = self.fill_template(&template_content, params)?;
        
        // Generate filename
        let filename = format!("{}_{}.md", template, Utc::now().format("%Y%m%d_%H%M%S"));
        let file_path = config.obsidian.vault_path.join(filename);
        
        // Write file
        fs::write(&file_path, content).await?;
        
        Ok(file_path)
    }

    pub async fn create_incident_note(&self, incident: &Incident) -> Result<PathBuf, Box<dyn std::error::Error>> {
        let mut params = HashMap::new();
        params.insert("id".to_string(), incident.id.clone());
        params.insert("title".to_string(), incident.title.clone());
        params.insert("severity".to_string(), incident.severity.to_string());
        params.insert("status".to_string(), incident.status.clone());
        params.insert("created_at".to_string(), incident.created_at.to_rfc3339());
        
        self.create_note("incident", params).await
    }

    pub async fn create_vulnerability_note(&self, vuln: &Vulnerability) -> Result<PathBuf, Box<dyn std::error::Error>> {
        let mut params = HashMap::new();
        params.insert("id".to_string(), vuln.id.clone());
        params.insert("title".to_string(), vuln.title.clone());
        params.insert("severity".to_string(), vuln.severity.to_string());
        params.insert("cvss_score".to_string(), vuln.cvss_score.to_string());
        params.insert("discovered_at".to_string(), vuln.discovered_at.to_rfc3339());
        
        self.create_note("vulnerability", params).await
    }

    async fn load_templates(&self) -> Result<(), Box<dyn std::error::Error>> {
        let config = self.config.read().await;
        let template_path = &config.obsidian.template_path;
        
        let mut templates = HashMap::new();
        
        let mut entries = fs::read_dir(template_path).await?;
        while let Some(entry) = entries.next_entry().await? {
            if entry.path().extension().map_or(false, |ext| ext == "md") {
                let template_name = entry.path().file_stem()
                    .unwrap()
                    .to_string_lossy()
                    .into_owned();
                let content = fs::read_to_string(entry.path()).await?;
                templates.insert(template_name, content);
            }
        }
        
        *self.template_cache.write().await = templates;
        Ok(())
    }

    async fn get_template(&self, name: &str) -> Result<String, Box<dyn std::error::Error>> {
        let templates = self.template_cache.read().await;
        templates.get(name)
            .cloned()
            .ok_or_else(|| format!("Template '{}' not found", name).into())
    }

    fn fill_template(&self, template: &str, params: HashMap<String, String>) -> Result<String, Box<dyn std::error::Error>> {
        let mut content = template.to_string();
        for (key, value) in params {
            content = content.replace(&format!("{{{{ {} }}}}", key), &value);
        }
        Ok(content)
    }

    async fn process_file_change(path: &Path, template_cache: &Arc<RwLock<HashMap<String, String>>>) -> Result<(), Box<dyn std::error::Error>> {
        // Read file content
        let content = fs::read_to_string(path).await?;
        
        // Extract metadata and update links
        let processed_content = Self::process_markdown(&content)?;
        
        // Write back processed content
        fs::write(path, processed_content).await?;
        
        Ok(())
    }

    fn process_markdown(content: &str) -> Result<String, Box<dyn std::error::Error>> {
        // TODO: Implement markdown processing
        // - Extract YAML frontmatter
        // - Update internal links
        // - Add backlinks
        Ok(content.to_string())
    }

    async fn schedule_backups(&self) -> Result<(), Box<dyn std::error::Error>> {
        let config = self.config.read().await;
        let backup_interval = config.obsidian.backup_interval_hours;
        let vault_path = config.obsidian.vault_path.clone();
        let backup_path = config.obsidian.backup_path.clone();

        tokio::spawn(async move {
            loop {
                if let Err(e) = Self::create_backup(&vault_path, &backup_path).await {
                    eprintln!("Backup error: {}", e);
                }
                tokio::time::sleep(tokio::time::Duration::from_secs(backup_interval as u64 * 3600)).await;
            }
        });

        Ok(())
    }

    async fn create_backup(vault_path: &Path, backup_path: &Path) -> Result<(), Box<dyn std::error::Error>> {
        // Create backup directory if it doesn't exist
        fs::create_dir_all(backup_path).await?;
        
        // Generate backup filename with timestamp
        let backup_name = format!("vault_backup_{}.zip", Utc::now().format("%Y%m%d_%H%M%S"));
        let backup_file = backup_path.join(backup_name);
        
        // Create zip archive
        let file = std::fs::File::create(&backup_file)?;
        let mut zip = zip::ZipWriter::new(file);
        
        // Add files to zip
        Self::add_directory_to_zip(&mut zip, vault_path, vault_path)?;
        
        // Finalize zip
        zip.finish()?;
        
        Ok(())
    }

    fn add_directory_to_zip(
        zip: &mut zip::ZipWriter<std::fs::File>,
        base_path: &Path,
        current_path: &Path,
    ) -> Result<(), Box<dyn std::error::Error>> {
        for entry in std::fs::read_dir(current_path)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_file() {
                let relative_path = path.strip_prefix(base_path)?;
                zip.start_file(
                    relative_path.to_string_lossy().into_owned(),
                    zip::write::FileOptions::default(),
                )?;
                let mut file = std::fs::File::open(path)?;
                std::io::copy(&mut file, zip)?;
            } else if path.is_dir() {
                Self::add_directory_to_zip(zip, base_path, &path)?;
            }
        }
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_obsidian_integration() {
        // Test implementation will go here
    }
}