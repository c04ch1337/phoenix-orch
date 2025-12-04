//! Workflow registry for managing workflows.
//!
//! This module provides a central registry for managing workflow definitions,
//! including loading, saving, and retrieving workflows.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use anyhow::{Result, Context};
use tokio::sync::RwLock;

use crate::modules::orchestrator::workflows::schema::Workflow;
use crate::modules::orchestrator::workflows::loader::WorkflowLoader;
use crate::modules::orchestrator::workflows::WorkflowError;

/// Registry for managing workflows
#[derive(Debug, Clone)]
pub struct WorkflowRegistry {
    /// Loader for persisting workflows
    loader: Arc<WorkflowLoader>,
    
    /// In-memory cache of workflows
    workflows: Arc<RwLock<HashMap<String, Workflow>>>,
}

impl WorkflowRegistry {
    /// Create a new workflow registry with the specified loader
    pub fn new(loader: WorkflowLoader) -> Self {
        Self {
            loader: Arc::new(loader),
            workflows: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a workflow registry with a default workflow directory
    pub fn with_workflows_dir<P: Into<PathBuf>>(workflows_dir: P) -> Self {
        let loader = WorkflowLoader::new(workflows_dir.into());
        Self::new(loader)
    }

    /// Get the workflow loader
    pub fn loader(&self) -> &WorkflowLoader {
        &self.loader
    }

    /// Load all workflows from disk
    pub async fn load_workflows(&self) -> Result<(), WorkflowError> {
        let workflows = self.loader.load_all_workflows().await?;
        
        // Update the in-memory cache
        let mut cache = self.workflows.write().await;
        cache.clear();
        
        for workflow in workflows {
            cache.insert(workflow.id.clone(), workflow);
        }
        
        Ok(())
    }

    /// Save a workflow to disk and update the registry
    pub async fn save_workflow(&self, workflow: &Workflow) -> Result<(), WorkflowError> {
        // Validate the workflow
        workflow.validate().map_err(WorkflowError::InvalidDefinition)?;
        
        // Save to disk first
        self.loader.save_workflow(workflow).await?;
        
        // Update in-memory cache
        let mut cache = self.workflows.write().await;
        cache.insert(workflow.id.clone(), workflow.clone());
        
        Ok(())
    }

    /// Get a workflow by ID
    pub async fn get_workflow_by_id(&self, id: &str) -> Option<Workflow> {
        let cache = self.workflows.read().await;
        cache.get(id).cloned()
    }

    /// Get a workflow by name (case-insensitive)
    pub fn get_workflow(&self, name_or_id: &str) -> Option<Workflow> {
        // Normalize the name to lowercase for case-insensitive comparison
        let normalized = name_or_id.to_lowercase().replace(' ', "_");
        
        // First try to get by exact ID
        if let Some(workflow) = self.get_workflow_by_id(&normalized).now_or_never().flatten() {
            return Some(workflow);
        }
        
        // If that fails, look for partial matches
        let workflows = self.workflows.try_read().ok()?;
        
        // Try to match by name (case-insensitive)
        for workflow in workflows.values() {
            if workflow.name.to_lowercase().contains(&name_or_id.to_lowercase()) ||
               workflow.id.contains(&normalized) {
                return Some(workflow.clone());
            }
        }
        
        None
    }

    /// Delete a workflow by ID
    pub async fn delete_workflow(&self, id: &str) -> Result<(), WorkflowError> {
        // Delete from disk
        self.loader.delete_workflow(id).await?;
        
        // Remove from cache
        let mut cache = self.workflows.write().await;
        cache.remove(id);
        
        Ok(())
    }

    /// List all workflow IDs
    pub async fn list_workflow_ids(&self) -> Vec<String> {
        let cache = self.workflows.read().await;
        cache.keys().cloned().collect()
    }

    /// List all workflow names
    pub fn list_workflow_names(&self) -> Vec<String> {
        // This is safe because we're only reading
        if let Some(cache) = self.workflows.try_read().ok() {
            cache.values().map(|w| w.name.clone()).collect()
        } else {
            Vec::new() // Return empty if lock is contended
        }
    }

    /// List all workflows
    pub async fn list_workflows(&self) -> Vec<Workflow> {
        let cache = self.workflows.read().await;
        cache.values().cloned().collect()
    }

    /// Check if a workflow exists
    pub async fn workflow_exists(&self, id: &str) -> bool {
        let cache = self.workflows.read().await;
        cache.contains_key(id)
    }

    /// Get the number of workflows
    pub async fn workflow_count(&self) -> usize {
        let cache = self.workflows.read().await;
        cache.len()
    }

    /// Find workflows by tag
    pub async fn find_workflows_by_tag(&self, tag: &str) -> Vec<Workflow> {
        let cache = self.workflows.read().await;
        cache.values()
            .filter(|w| w.tags.iter().any(|t| t.to_lowercase() == tag.to_lowercase()))
            .cloned()
            .collect()
    }

    /// Search workflows by keyword (searches name, description, and tags)
    pub async fn search_workflows(&self, keyword: &str) -> Vec<Workflow> {
        let keyword = keyword.to_lowercase();
        let cache = self.workflows.read().await;
        
        cache.values()
            .filter(|w| {
                w.name.to_lowercase().contains(&keyword) || 
                w.description.to_lowercase().contains(&keyword) ||
                w.tags.iter().any(|t| t.to_lowercase().contains(&keyword))
            })
            .cloned()
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use crate::modules::orchestrator::workflows::schema::{WorkflowStep, WorkflowParameter};

    #[tokio::test]
    async fn test_workflow_registry() {
        // Create a temporary directory for testing
        let temp_dir = tempdir().unwrap();
        let registry = WorkflowRegistry::with_workflows_dir(temp_dir.path());

        // Create a test workflow
        let workflow = Workflow {
            id: "test_workflow".to_string(),
            name: "Test Workflow".to_string(),
            description: "A test workflow".to_string(),
            parameters: vec![],
            steps: vec![
                WorkflowStep {
                    id: "step1".to_string(),
                    name: "Step 1".to_string(),
                    description: "First step".to_string(),
                    step_type: "command".to_string(),
                    required: true,
                    order: 0,
                    condition: None,
                    actions: vec![serde_json::json!({
                        "command": "echo",
                        "args": ["Hello, world!"]
                    })],
                    config: serde_json::json!({}),
                    depends_on: vec![],
                    output_mapping: std::collections::HashMap::new(),
                }
            ],
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            tags: vec!["test".to_string()],
        };

        // Save the workflow
        registry.save_workflow(&workflow).await.unwrap();

        // Get the workflow by ID
        let loaded = registry.get_workflow_by_id(&workflow.id).await.unwrap();
        assert_eq!(loaded.id, workflow.id);

        // Get the workflow by name
        let by_name = registry.get_workflow(&workflow.name).unwrap();
        assert_eq!(by_name.id, workflow.id);

        // Check workflow count
        assert_eq!(registry.workflow_count().await, 1);

        // Delete the workflow
        registry.delete_workflow(&workflow.id).await.unwrap();

        // Verify it's gone
        assert!(registry.get_workflow_by_id(&workflow.id).await.is_none());
    }

    #[tokio::test]
    async fn test_search_workflows() {
        // Create a temporary directory for testing
        let temp_dir = tempdir().unwrap();
        let registry = WorkflowRegistry::with_workflows_dir(temp_dir.path());

        // Create multiple workflows with different tags
        let workflows = vec![
            Workflow {
                id: "security_scan".to_string(),
                name: "Security Scan".to_string(),
                description: "Run a security scan".to_string(),
                parameters: vec![],
                steps: vec![WorkflowStep {
                    id: "step1".to_string(),
                    name: "Step 1".to_string(),
                    description: "Scan step".to_string(),
                    step_type: "command".to_string(),
                    required: true,
                    order: 0,
                    condition: None,
                    actions: vec![],
                    config: serde_json::json!({}),
                    depends_on: vec![],
                    output_mapping: std::collections::HashMap::new(),
                }],
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                tags: vec!["security".to_string(), "scan".to_string()],
            },
            Workflow {
                id: "deployment".to_string(),
                name: "Deployment Workflow".to_string(),
                description: "Deploy to production".to_string(),
                parameters: vec![],
                steps: vec![WorkflowStep {
                    id: "step1".to_string(),
                    name: "Step 1".to_string(),
                    description: "Deploy step".to_string(),
                    step_type: "command".to_string(),
                    required: true,
                    order: 0,
                    condition: None,
                    actions: vec![],
                    config: serde_json::json!({}),
                    depends_on: vec![],
                    output_mapping: std::collections::HashMap::new(),
                }],
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                tags: vec!["deployment".to_string(), "production".to_string()],
            },
        ];

        // Save the workflows
        for workflow in &workflows {
            registry.save_workflow(workflow).await.unwrap();
        }

        // Search by tag
        let security_workflows = registry.find_workflows_by_tag("security").await;
        assert_eq!(security_workflows.len(), 1);
        assert_eq!(security_workflows[0].id, "security_scan");

        // Search by keyword in name
        let deployment_workflows = registry.search_workflows("deployment").await;
        assert_eq!(deployment_workflows.len(), 1);
        assert_eq!(deployment_workflows[0].id, "deployment");

        // Search by keyword in description
        let production_workflows = registry.search_workflows("production").await;
        assert_eq!(production_workflows.len(), 1);
        assert_eq!(production_workflows[0].id, "deployment");
    }
}