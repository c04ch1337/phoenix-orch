# Custom Workflows / Scenario Library

The Workflow System in Phoenix Orch provides a powerful way to save, manage, and execute reusable operational workflows. This component enables users to capture complex tasks as parameterized workflows, which can then be executed with a single command.

## Overview

The Workflow System consists of the following components:

1. **Workflow Definitions** - JSON schema for defining workflows, steps, and parameters
2. **Workflow Registry** - In-memory storage and management of workflows
3. **Workflow Loader** - File-based persistence for workflow definitions
4. **Workflow Executor** - Engine for executing workflow steps with parameters
5. **One-Thought Triggering** - Simple natural language commands to invoke workflows

## Key Features

- **Save completed tasks as reusable workflows** - Capture operational procedures for future use
- **One-thought replay** - Execute complex workflows with a simple command like "Phoenix, run workflow Nuclear Winter"
- **Parameterized workflows** - Define workflows with customizable parameters
- **JSON-based storage** - Workflows are stored as JSON files for easy editing and version control

## Using Workflows

### Creating a Workflow

Workflows can be created programmatically or by saving a completed task:

```rust
use crate::modules::orchestrator::workflows::{
    save_completed_task, WorkflowStep, WorkflowParameter, ParameterType
};

// Create and save a simple workflow
async fn create_example_workflow(registry: &WorkflowRegistry) -> Result<(), WorkflowError> {
    // Define workflow steps
    let steps = vec![
        WorkflowStep {
            id: "step1".to_string(),
            name: "Run Network Scan".to_string(),
            description: "Scan target network for open ports".to_string(),
            step_type: "command".to_string(),
            required: true,
            order: 0,
            condition: None,
            actions: vec![serde_json::json!({
                "command": "nmap",
                "args": ["-sV", "${params.target}"]
            })],
            config: serde_json::json!({}),
            depends_on: vec![],
            output_mapping: std::collections::HashMap::new(),
        },
        // Additional steps...
    ];
    
    // Define parameters
    let parameters = vec![
        WorkflowParameter {
            id: "target".to_string(),
            name: "Target".to_string(),
            description: "Target IP or hostname".to_string(),
            param_type: ParameterType::String,
            required: true,
            default_value: Some(serde_json::json!("localhost")),
            validation: std::collections::HashMap::new(),
        }
    ];
    
    // Save the workflow
    save_completed_task(
        registry,
        "Network Scan",
        "Comprehensive network scanning workflow",
        steps,
        Some(parameters)
    ).await
}
```

### Executing a Workflow

Workflows can be executed through code or via natural language commands:

```rust
use crate::modules::orchestrator::workflows::{execute_workflow};

// Execute a workflow with parameters
async fn run_example_workflow(
    registry: &WorkflowRegistry,
    executor: &WorkflowExecutor
) -> Result<(), WorkflowError> {
    let params = serde_json::json!({
        "target": "192.168.1.1"
    });
    
    execute_workflow(registry, executor, "network_scan", Some(params)).await
}
```

### Natural Language Commands

Users can trigger workflows with simple English commands:

- `Phoenix, run workflow Network Scan` - Run with default parameters
- `Phoenix, execute workflow APT29 with target=192.168.1.1,level=advanced` - Run with specific parameters

## Workflow JSON Schema

Workflows are defined using a JSON schema with the following structure:

```json
{
  "id": "network_scan",
  "name": "Network Scan",
  "description": "Comprehensive network scanning workflow",
  "parameters": [
    {
      "id": "target",
      "name": "Target",
      "description": "Target IP or hostname",
      "param_type": "string",
      "required": true,
      "default_value": "localhost"
    }
  ],
  "steps": [
    {
      "id": "step1",
      "name": "Run Network Scan",
      "description": "Scan target network for open ports",
      "step_type": "command",
      "required": true,
      "order": 0,
      "actions": [
        {
          "command": "nmap",
          "args": ["-sV", "${params.target}"]
        }
      ]
    }
  ],
  "created_at": "2025-12-04T15:00:00Z",
  "updated_at": "2025-12-04T15:00:00Z",
  "tags": ["network", "security"]
}
```

## Step Types

The Workflow Executor supports various types of steps:

- `command` - Execute shell commands
- `agent` - Launch specialized agents (browser, terminal, etc.)
- `browser` - Perform browser automation 
- `script` - Run custom scripts
- `model` - Run model inference
- `conditional` - Conditional logic
- `parallel` - Execute steps in parallel

## Integration with Other Components

The Workflow System integrates with several other Phoenix Orch components:

- **Agent Management System** - For spawning and controlling agents
- **Planning Mode** - For saving plans as workflows
- **Model Selection** - For selecting appropriate models for workflow execution
- **Browser Automation** - For web-based workflow steps
- **Terminal Capabilities** - For command execution in workflows

## Advanced Usage

### Workflow Events

The Workflow Executor emits events during workflow execution that can be used for monitoring and notifications:

```rust
// Subscribe to workflow events
let (tx, mut rx) = tokio::sync::mpsc::channel(100);
executor.set_event_listener(tx).await;

// Process events
tokio::spawn(async move {
    while let Some(event) = rx.recv().await {
        match event {
            WorkflowEvent::Started { workflow_id, workflow_name } => {
                println!("Started workflow: {}", workflow_name);
            },
            WorkflowEvent::StepCompleted { workflow_id, step_id, step_name, output } => {
                println!("Completed step: {}", step_name);
            },
            // Handle other events...
            _ => {}
        }
    }
});
```

### Conditional Step Execution

Workflows can include conditional logic to determine whether steps should be executed:

```json
{
  "id": "step2",
  "name": "Conditional Step",
  "step_type": "conditional",
  "condition": "steps.step1.output.status == 'success'",
  "actions": [
    {
      "condition": "${params.level == 'advanced'}",
      "then": { /* action if true */ },
      "else": { /* action if false */ }
    }
  ]
}
```

## Best Practices

1. **Parameterize workflows** - Make workflows flexible by using parameters for values that might change
2. **Add validation** - Use parameter validation to ensure valid inputs
3. **Structure steps logically** - Order steps for clarity and use dependencies for complex relationships
4. **Use tags** - Tag workflows for better organization and searchability
5. **Include clear descriptions** - Document what each workflow and step does
6. **Test workflows** - Validate workflows with different parameters before deploying