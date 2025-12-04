//! Workflow component for Phoenix Orch Antigravity integration.
//! 
//! This module provides functionality to save, manage, and execute reusable workflows.
//! Workflows can be created from completed tasks and executed with a single command.
//! The system supports parameterized workflows and stores workflow definitions as JSON files.

mod schema;
mod loader;
mod registry;
mod executor;

use std::path::PathBuf;
use anyhow::Result;

pub use schema::{Workflow, WorkflowStep, WorkflowParameter, ParameterType};
pub use registry::WorkflowRegistry;
pub use loader::WorkflowLoader;
pub use executor::WorkflowExecutor;

/// Error type for workflow operations
#[derive(Debug, thiserror::Error)]
pub enum WorkflowError {
    #[error("Workflow not found: {0}")]
    NotFound(String),
    
    #[error("Invalid workflow definition: {0}")]
    InvalidDefinition(String),
    
    #[error("Parameter validation error: {0}")]
    ParameterValidation(String),
    
    #[error("Execution error: {0}")]
    Execution(String),
    
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

/// Initialize workflow system with specified storage directory
pub async fn init(workflows_dir: PathBuf) -> Result<WorkflowRegistry, WorkflowError> {
    let loader = WorkflowLoader::new(workflows_dir);
    let registry = WorkflowRegistry::new(loader);
    
    // Load existing workflows
    registry.load_workflows().await?;
    
    Ok(registry)
}

/// Save a completed task as a reusable workflow
pub async fn save_completed_task(
    registry: &WorkflowRegistry,
    name: &str,
    description: &str,
    steps: Vec<WorkflowStep>,
    parameters: Option<Vec<WorkflowParameter>>,
) -> Result<(), WorkflowError> {
    let workflow = Workflow {
        id: name.to_lowercase().replace(' ', "_"),
        name: name.to_string(),
        description: description.to_string(),
        steps,
        parameters: parameters.unwrap_or_default(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        tags: Vec::new(),
    };
    
    registry.save_workflow(&workflow).await
}

/// Execute a workflow by name with optional parameters
pub async fn execute_workflow(
    registry: &WorkflowRegistry, 
    executor: &WorkflowExecutor,
    workflow_name: &str,
    parameters: Option<serde_json::Value>,
) -> Result<(), WorkflowError> {
    let workflow = registry.get_workflow(workflow_name)
        .ok_or_else(|| WorkflowError::NotFound(workflow_name.to_string()))?;
    
    executor.execute(&workflow, parameters).await
}

/// List all available workflows
pub async fn list_workflows(registry: &WorkflowRegistry) -> Vec<String> {
    registry.list_workflow_names()
}

/// Get details of a specific workflow
pub async fn get_workflow_details(
    registry: &WorkflowRegistry,
    workflow_name: &str,
) -> Option<Workflow> {
    registry.get_workflow(workflow_name).cloned()
}