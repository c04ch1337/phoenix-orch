use std::path::PathBuf;
use std::sync::Arc;
use chrono::Utc;
use tokio::fs;
use serde_json::json;

use crate::modules::orchestrator::workflows::{
    Workflow, 
    WorkflowStep, 
    WorkflowParameter, 
    WorkflowRegistry, 
    WorkflowLoader, 
    WorkflowExecutor,
    ParameterType
};
use crate::modules::orchestrator::agent_manager::AgentManager;
use crate::modules::orchestrator::model_router::ModelRouter;
use crate::modules::orchestrator::tools::ToolRegistry;

// Setup function to create a test workflow file
async fn setup_test_workflow(root_dir: &PathBuf) -> anyhow::Result<()> {
    // Create workflow directory
    let workflows_dir = root_dir.join("workflows");
    if !workflows_dir.exists() {
        fs::create_dir_all(&workflows_dir).await?;
    }

    // Create a test workflow
    let workflow = Workflow {
        id: "test_workflow".to_string(),
        name: "Test Workflow".to_string(),
        description: "A test workflow for testing".to_string(),
        parameters: vec![
            WorkflowParameter {
                id: "target".to_string(),
                name: "Target".to_string(),
                description: "Target system for the workflow".to_string(),
                param_type: ParameterType::String,
                required: true,
                default_value: Some(json!("localhost")),
                validation: std::collections::HashMap::new(),
            }
        ],
        steps: vec![
            WorkflowStep {
                id: "step1".to_string(),
                name: "First Step".to_string(),
                description: "This is the first step".to_string(),
                step_type: "command".to_string(),
                required: true,
                order: 0,
                condition: None,
                actions: vec![json!({
                    "command": "echo",
                    "args": ["Hello, World!"]
                })],
                config: serde_json::json!({}),
                depends_on: vec![],
                output_mapping: std::collections::HashMap::new(),
            }
        ],
        created_at: Utc::now(),
        updated_at: Utc::now(),
        tags: vec!["test".to_string(), "example".to_string()],
    };

    // Serialize to JSON
    let json = serde_json::to_string_pretty(&workflow)?;
    let file_path = workflows_dir.join("test_workflow.json");
    fs::write(file_path, json).await?;

    Ok(())
}

#[tokio::test]
async fn test_workflow_loading() -> anyhow::Result<()> {
    let temp_dir = tempfile::tempdir()?;
    let temp_path = temp_dir.path().to_path_buf();
    
    // Setup test workflow file
    setup_test_workflow(&temp_path).await?;
    
    // Create workflow loader and registry
    let loader = WorkflowLoader::new(temp_path.join("workflows"));
    let registry = WorkflowRegistry::new(loader);
    
    // Load workflows
    registry.load_workflows().await?;
    
    // Check if workflow was loaded
    let workflow = registry.get_workflow("test_workflow");
    assert!(workflow.is_some());
    
    let workflow = workflow.unwrap();
    assert_eq!(workflow.name, "Test Workflow");
    assert_eq!(workflow.steps.len(), 1);
    assert_eq!(workflow.parameters.len(), 1);
    
    Ok(())
}

#[tokio::test]
#[ignore] // Requires actual components, so we'll ignore it by default
async fn test_workflow_execution() -> anyhow::Result<()> {
    // This test would be implemented to test the actual execution using mocks
    // for AgentManager, ModelRouter, and ToolRegistry
    
    /*
    // Create required components
    let agent_manager = Arc::new(AgentManager::new_mock());
    let model_router = Arc::new(ModelRouter::new_mock());
    let tool_registry = Arc::new(ToolRegistry::new_mock());
    
    // Create workflow executor
    let executor = WorkflowExecutor::new(
        agent_manager,
        model_router,
        tool_registry
    );
    
    // Create workflow registry
    let temp_dir = tempfile::tempdir()?;
    let temp_path = temp_dir.path().to_path_buf();
    setup_test_workflow(&temp_path).await?;
    let loader = WorkflowLoader::new(temp_path.join("workflows"));
    let registry = WorkflowRegistry::new(loader);
    registry.load_workflows().await?;
    
    // Execute workflow with parameters
    let parameters = json!({
        "target": "192.168.1.1"
    });
    
    executor.execute_workflow_by_name("test_workflow", &registry, Some(parameters)).await?;
    */
    
    Ok(())
}

#[tokio::test]
async fn test_workflow_parameter_validation() -> anyhow::Result<()> {
    let temp_dir = tempfile::tempdir()?;
    let temp_path = temp_dir.path().to_path_buf();
    
    // Create a test workflow with various parameter types
    let workflows_dir = temp_path.join("workflows");
    fs::create_dir_all(&workflows_dir).await?;
    
    // Create workflow with multiple parameter types
    let workflow = Workflow {
        id: "param_test".to_string(),
        name: "Parameter Test".to_string(),
        description: "Testing parameter validation".to_string(),
        parameters: vec![
            WorkflowParameter {
                id: "string_param".to_string(),
                name: "String Parameter".to_string(),
                description: "A string parameter".to_string(),
                param_type: ParameterType::String,
                required: true,
                default_value: Some(json!("default")),
                validation: std::collections::HashMap::new(),
            },
            WorkflowParameter {
                id: "number_param".to_string(),
                name: "Number Parameter".to_string(),
                description: "A number parameter".to_string(),
                param_type: ParameterType::Number,
                required: false,
                default_value: Some(json!(42)),
                validation: std::collections::HashMap::new(),
            }
        ],
        steps: vec![
            WorkflowStep {
                id: "step1".to_string(),
                name: "Test Step".to_string(),
                description: "Test step".to_string(),
                step_type: "command".to_string(),
                required: true,
                order: 0,
                condition: None,
                actions: vec![json!({
                    "command": "echo",
                    "args": ["Hello"]
                })],
                config: serde_json::json!({}),
                depends_on: vec![],
                output_mapping: std::collections::HashMap::new(),
            }
        ],
        created_at: Utc::now(),
        updated_at: Utc::now(),
        tags: vec![],
    };
    
    // Save workflow
    let json = serde_json::to_string_pretty(&workflow)?;
    let file_path = workflows_dir.join("param_test.json");
    fs::write(file_path, json).await?;
    
    // Create loader and registry
    let loader = WorkflowLoader::new(workflows_dir);
    let registry = WorkflowRegistry::new(loader);
    registry.load_workflows().await?;
    
    // Validate workflow was loaded correctly
    let loaded = registry.get_workflow("param_test");
    assert!(loaded.is_some());
    let loaded = loaded.unwrap();
    
    // Validate parameter types
    assert_eq!(loaded.parameters.len(), 2);
    assert_eq!(loaded.parameters[0].param_type, ParameterType::String);
    assert_eq!(loaded.parameters[1].param_type, ParameterType::Number);
    
    // Validate default values
    assert_eq!(loaded.parameters[0].default_value, Some(json!("default")));
    assert_eq!(loaded.parameters[1].default_value, Some(json!(42)));
    
    Ok(())
}