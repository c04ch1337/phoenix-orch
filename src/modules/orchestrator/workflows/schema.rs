//! Schema definitions for workflow JSON files.
//! 
//! This module defines the structure of workflow files and provides serialization/deserialization
//! support for storing and loading workflows.

use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

/// Defines the types of parameters that can be used in workflows
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ParameterType {
    /// Text parameter
    String,
    /// Numeric parameter
    Number,
    /// True/false parameter
    Boolean,
    /// List of items
    Array,
    /// JSON object
    Object,
    /// Agent reference
    Agent,
    /// Model reference
    Model,
    /// File path
    FilePath,
    /// URL
    Url,
}

/// Parameter definition for a workflow
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowParameter {
    /// Unique parameter identifier
    pub id: String,
    
    /// Human-readable name
    pub name: String,
    
    /// Description of the parameter
    pub description: String,
    
    /// Parameter data type
    pub param_type: ParameterType,
    
    /// Whether this parameter is required
    #[serde(default)]
    pub required: bool,
    
    /// Default value for the parameter (JSON value)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_value: Option<serde_json::Value>,
    
    /// Validation rules specific to this parameter type
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub validation: HashMap<String, serde_json::Value>,
}

/// A single step in a workflow
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    /// Unique identifier for this step
    pub id: String,
    
    /// Human-readable name
    pub name: String,
    
    /// Description of what this step does
    pub description: String,
    
    /// Step type (determines how the step is executed)
    pub step_type: String,
    
    /// Whether this step is required or optional
    #[serde(default = "default_as_true")]
    pub required: bool,
    
    /// Order in which this step should be executed
    pub order: usize,
    
    /// Conditions for executing this step (optional)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,
    
    /// Actions to perform in this step
    pub actions: Vec<serde_json::Value>,
    
    /// Custom configuration for this step
    #[serde(default)]
    pub config: serde_json::Value,
    
    /// Depends on other steps (by ID)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub depends_on: Vec<String>,
    
    /// Output mapping from this step
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub output_mapping: HashMap<String, String>,
}

/// Main workflow definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    /// Unique workflow identifier
    pub id: String,
    
    /// Human-readable name
    pub name: String,
    
    /// Description of what this workflow does
    pub description: String,
    
    /// Parameters accepted by this workflow
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub parameters: Vec<WorkflowParameter>,
    
    /// Steps to execute in this workflow
    pub steps: Vec<WorkflowStep>,
    
    /// When this workflow was first created
    pub created_at: DateTime<Utc>,
    
    /// When this workflow was last updated
    pub updated_at: DateTime<Utc>,
    
    /// Tags for categorizing workflows
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
}

/// Default function to return true
fn default_as_true() -> bool {
    true
}

impl Workflow {
    /// Validates a workflow definition
    pub fn validate(&self) -> Result<(), String> {
        // Check for empty ID or name
        if self.id.is_empty() {
            return Err("Workflow ID cannot be empty".to_string());
        }
        if self.name.is_empty() {
            return Err("Workflow name cannot be empty".to_string());
        }

        // Ensure there's at least one step
        if self.steps.is_empty() {
            return Err("Workflow must contain at least one step".to_string());
        }

        // Validate step IDs are unique
        let mut step_ids = std::collections::HashSet::new();
        for step in &self.steps {
            if !step_ids.insert(&step.id) {
                return Err(format!("Duplicate step ID: {}", step.id));
            }
        }

        // Validate parameter IDs are unique
        let mut param_ids = std::collections::HashSet::new();
        for param in &self.parameters {
            if !param_ids.insert(&param.id) {
                return Err(format!("Duplicate parameter ID: {}", param.id));
            }
        }

        // Validate dependencies refer to existing steps
        for step in &self.steps {
            for dep_id in &step.depends_on {
                if !step_ids.contains(dep_id) {
                    return Err(format!("Step {} depends on non-existent step {}", step.id, dep_id));
                }
            }
        }

        Ok(())
    }
}