//! Workflow loader module for loading and saving workflow definitions.
//!
//! This module provides functionality to load workflow definitions from JSON files
//! and save new workflow definitions to the filesystem.

use std::path::{Path, PathBuf};
use std::fs;
use tokio::fs as async_fs;
use anyhow::{Result, Context};
use tokio::sync::RwLock;
use std::sync::Arc;

use crate::modules::orchestrator::workflows::schema::Workflow;
use crate::modules::orchestrator::workflows::WorkflowError;

/// Handles loading and saving workflows from/to disk
#[derive(Debug, Clone)]
pub struct WorkflowLoader {
    /// Directory where workflow definitions are stored
    workflows_dir: PathBuf,
}

impl WorkflowLoader {
    /// Create a new workflow loader with the specified workflows directory
    pub fn new<P: AsRef<Path>>(workflows_dir: P) -> Self {
        Self {
            workflows_dir: workflows_dir.as_ref().to_path_buf(),
        }
    }

    /// Get the workflows directory
    pub fn workflows_dir(&self) -> &Path {
        &self.workflows_dir
    }

    /// Load all workflow definitions from the workflows directory
    pub async fn load_all_workflows(&self) -> Result<Vec<Workflow>, WorkflowError> {
        // Create directory if it doesn't exist
        if !self.workflows_dir.exists() {
            async_fs::create_dir_all(&self.workflows_dir)
                .await
                .context("Failed to create workflows directory")?;
            return Ok(Vec::new()); // No workflows yet
        }

        let mut workflows = Vec::new();
        let mut dir = async_fs::read_dir(&self.workflows_dir)
            .await
            .context("Failed to read workflows directory")?;

        // Read each JSON file in the directory
        while let Some(entry) = dir.next_entry().await? {
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) == Some("json") {
                match self.load_workflow_from_path(&path).await {
                    Ok(workflow) => {
                        workflows.push(workflow);
                    }
                    Err(e) => {
                        // Log the error but continue loading other workflows
                        eprintln!("Error loading workflow from {}: {}", path.display(), e);
                    }
                }
            }
        }

        Ok(workflows)
    }

    /// Load a single workflow from a file path
    pub async fn load_workflow_from_path<P: AsRef<Path>>(&self, path: P) -> Result<Workflow, WorkflowError> {
        let content = async_fs::read_to_string(path.as_ref())
            .await
            .context("Failed to read workflow file")?;

        let workflow: Workflow = serde_json::from_str(&content)
            .context("Failed to parse workflow JSON")?;

        // Validate the workflow
        workflow.validate().map_err(WorkflowError::InvalidDefinition)?;

        Ok(workflow)
    }

    /// Save a workflow to disk
    pub async fn save_workflow(&self, workflow: &Workflow) -> Result<(), WorkflowError> {
        // Create directory if it doesn't exist
        if !self.workflows_dir.exists() {
            async_fs::create_dir_all(&self.workflows_dir)
                .await
                .context("Failed to create workflows directory")?;
        }

        // Validate the workflow before saving
        workflow.validate().map_err(WorkflowError::InvalidDefinition)?;

        // Create the file path
        let file_path = self.workflows_dir.join(format!("{}.json", workflow.id));

        // Serialize the workflow to JSON
        let json = serde_json::to_string_pretty(workflow)
            .context("Failed to serialize workflow to JSON")?;

        // Write to file
        async_fs::write(&file_path, json)
            .await
            .context("Failed to write workflow file")?;

        Ok(())
    }

    /// Delete a workflow from disk
    pub async fn delete_workflow(&self, workflow_id: &str) -> Result<(), WorkflowError> {
        let file_path = self.workflows_dir.join(format!("{}.json", workflow_id));

        // Check if the file exists
        if !file_path.exists() {
            return Err(WorkflowError::NotFound(workflow_id.to_string()));
        }

        // Delete the file
        async_fs::remove_file(&file_path)
            .await
            .context("Failed to delete workflow file")?;

        Ok(())
    }

    /// Check if a workflow exists
    pub fn workflow_exists(&self, workflow_id: &str) -> bool {
        let file_path = self.workflows_dir.join(format!("{}.json", workflow_id));
        file_path.exists()
    }

    /// Get the file path for a workflow
    pub fn get_workflow_path(&self, workflow_id: &str) -> PathBuf {
        self.workflows_dir.join(format!("{}.json", workflow_id))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use crate::modules::orchestrator::workflows::schema::{WorkflowStep, WorkflowParameter};

    #[tokio::test]
    async fn test_save_and_load_workflow() {
        // Create a temporary directory for testing
        let temp_dir = tempdir().unwrap();
        let loader = WorkflowLoader::new(temp_dir.path());

        // Create a simple test workflow
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
        loader.save_workflow(&workflow).await.unwrap();

        // Load the workflow
        let loaded = loader.load_workflow_from_path(
            loader.get_workflow_path(&workflow.id)
        ).await.unwrap();

        // Verify the workflow was loaded correctly
        assert_eq!(loaded.id, workflow.id);
        assert_eq!(loaded.name, workflow.name);
        assert_eq!(loaded.description, workflow.description);
        assert_eq!(loaded.steps.len(), workflow.steps.len());
    }

    #[tokio::test]
    async fn test_load_all_workflows() {
        // Create a temporary directory for testing
        let temp_dir = tempdir().unwrap();
        let loader = WorkflowLoader::new(temp_dir.path());

        // Create multiple test workflows
        for i in 1..4 {
            let workflow = Workflow {
                id: format!("test_workflow_{}", i),
                name: format!("Test Workflow {}", i),
                description: format!("Test workflow {}", i),
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
                            "args": [format!("Workflow {}", i)]
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
            loader.save_workflow(&workflow).await.unwrap();
        }

        // Load all workflows
        let workflows = loader.load_all_workflows().await.unwrap();

        // Verify all workflows were loaded
        assert_eq!(workflows.len(), 3);
    }
}