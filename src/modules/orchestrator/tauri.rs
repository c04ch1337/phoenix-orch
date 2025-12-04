//! Tauri Command Implementation for OrchestratorAgent
//!
//! This module provides Tauri commands to interact with the OrchestratorAgent
//! from the frontend application.

use std::sync::{Arc, RwLock};
use std::collections::HashMap;
use std::time::SystemTime;
use serde::{Serialize, Deserialize};
use tauri::command;

use crate::modules::orchestrator::{
    OrchestratorAgent, 
    PhoenixResult, 
    PhoenixError,
    AgentErrorKind,
    ConscienceRequest,
    RequestId,
    RequestOrigin,
    ToolParameters
};
use crate::modules::orchestrator::tools::{hardware_master, mobile_master, hak5_master};

/// Response format for orchestrator task results
#[derive(Debug, Serialize, Deserialize)]
pub struct TaskResponse {
    /// Whether the task was successful
    pub success: bool,
    /// Result of the task execution (if successful)
    pub result: Option<String>,
    /// Error message (if unsuccessful)
    pub error: Option<String>,
    /// Whether human review is required
    pub requires_human_review: bool,
    /// Request ID for tracking
    pub request_id: String,
}

impl Default for TaskResponse {
    fn default() -> Self {
        Self {
            success: false,
            result: None,
            error: None,
            requires_human_review: false,
            request_id: RequestId::new().to_string(),
        }
    }
}

/// Invoke an OrchestratorAgent task
///
/// This function provides a Tauri command interface to execute tasks through
/// the OrchestratorAgent. The task is checked against the conscience gate 
/// for ethical validation before execution.
///
/// # Arguments
///
/// * `task` - A string description of the task to execute
/// * `orchestrator_agent` - Shared reference to the OrchestratorAgent instance
///
/// # Returns
///
/// A `TaskResponse` containing the result of the task execution
#[command]
pub async fn invoke_orchestrator_task(
    task: String,
    orchestrator_agent: tauri::State<'_, Arc<OrchestratorAgent>>,
) -> Result<TaskResponse, String> {
    // Create a request ID to track this task
    let request_id = RequestId::new();
    
    // Prepare a task response with the request ID
    let mut response = TaskResponse {
        success: false,
        result: None,
        error: None,
        requires_human_review: false,
        request_id: request_id.to_string(),
    };
    
    // Create a conscience request for validation
    let conscience_request = ConscienceRequest {
        id: request_id.clone(),
        action: format!("Execute task: {}", task),
        tool_id: "orchestrator_task".to_string(),
        parameters: ToolParameters::from(format!("{{\"task\": \"{}\"}}", task)),
        context: HashMap::new(),
        timestamp: SystemTime::now(),
        origin: RequestOrigin::User,
    };
    
    // Process the task
    let result = process_task(orchestrator_agent.inner().clone(), conscience_request, task).await;
    
    // Handle the result
    match result {
        Ok(task_result) => {
            response.success = true;
            response.result = Some(task_result);
        },
        Err(err) => {
            // Check if human review is required
            if let PhoenixError::Agent { kind, message, .. } = &err {
                if *kind == AgentErrorKind::HumanReviewRequired {
                    response.requires_human_review = true;
                    response.error = Some(format!("Human review required: {}", message));
                } else {
                    response.error = Some(format!("Error: {}", err));
                }
            } else {
                response.error = Some(format!("Error: {}", err));
            }
        }
    }
    
    Ok(response)
}

/// Submit a human-reviewed task for execution
///
/// This function is used when a task initially required human review,
/// and that review has now been completed. It bypasses the initial
/// conscience check since human review has already been performed.
///
/// # Arguments
///
/// * `task` - A string description of the task to execute
/// * `request_id` - The original request ID from the first attempt
/// * `human_reviewer_id` - ID of the human who reviewed the task
/// * `orchestrator_agent` - Shared reference to the OrchestratorAgent instance
///
/// # Returns
///
/// A `TaskResponse` containing the result of the task execution
#[command]
pub async fn submit_reviewed_task(
    task: String,
    request_id: String,
    human_reviewer_id: String,
    orchestrator_agent: tauri::State<'_, Arc<OrchestratorAgent>>,
) -> Result<TaskResponse, String> {
    // Parse the request ID from the string
    let request_id = RequestId(request_id);
    
    // Prepare a task response with the request ID
    let mut response = TaskResponse {
        success: false,
        result: None,
        error: None,
        requires_human_review: false,
        request_id: request_id.to_string(),
    };
    
    // Create context with human reviewer information
    let mut context = HashMap::new();
    context.insert("human_reviewer_id".to_string(), human_reviewer_id);
    context.insert("human_review_timestamp".to_string(), SystemTime::now().elapsed().unwrap_or_default().as_secs().to_string());
    
    // Create a conscience request that indicates human review has been performed
    let conscience_request = ConscienceRequest {
        id: request_id,
        action: format!("Execute reviewed task: {}", task),
        tool_id: "orchestrator_task_reviewed".to_string(),
        parameters: ToolParameters::from(format!("{{\"task\": \"{}\", \"reviewed\": true}}", task)),
        context,
        timestamp: SystemTime::now(),
        origin: RequestOrigin::User,
    };
    
    // Process the task with human review flag
    let result = process_task(orchestrator_agent.inner().clone(), conscience_request, task).await;
    
    // Handle the result
    match result {
        Ok(task_result) => {
            response.success = true;
            response.result = Some(task_result);
        },
        Err(err) => {
            response.error = Some(format!("Error: {}", err));
        }
    }
    
    Ok(response)
}

/// Internal function to process a task through the OrchestratorAgent
///
/// This function handles the logic of executing a task, including:
/// 1. Validating through the conscience gate
/// 2. Determining the appropriate tool to execute
/// 3. Executing the task
/// 4. Returning the result
///
/// # Arguments
///
/// * `agent` - Reference to the OrchestratorAgent
/// * `conscience_request` - The conscience request for validation
/// * `task` - The task description
///
/// # Returns
///
/// A `PhoenixResult<String>` with the task result or error
async fn process_task(agent: Arc<OrchestratorAgent>, conscience_request: ConscienceRequest, task: String) -> PhoenixResult<String> {
    // For simple tasks, we'll parse the task string to determine what to do
    // In a more sophisticated implementation, this could use NLP to understand the task
    
    // Check if the task is a search query
    if task.to_lowercase().contains("search") || task.to_lowercase().contains("find") || task.to_lowercase().contains("query") {
        // Extract search query - this is a simple extraction, could be more sophisticated
        let query = task.replace("search", "")
                        .replace("Search", "")
                        .replace("find", "")
                        .replace("Find", "")
                        .replace("query", "")
                        .replace("Query", "")
                        .trim()
                        .to_string();
        
        // Perform a memory search
        return agent.search_memory(&query, None).await;
    }
    
    // Check if the task is related to network drives
    let task_lower = task.to_lowercase();
    if (task_lower.contains("show") || task_lower.contains("list") || task_lower.contains("get")) &&
       task_lower.contains("network") &&
       task_lower.contains("drive") {
        // Execute list_network_drives operation
        let params = r#"{"operation":"list_network_drives"}"#;
        return agent.execute_tool("filesystem", params).await;
    }
    
    // Check if the task is to execute a specific tool
    if task.to_lowercase().starts_with("execute") || task.to_lowercase().starts_with("run") {
        // Try to extract tool name and parameters
        let parts: Vec<&str> = task.splitn(3, ' ').collect();
        if parts.len() >= 2 {
            let tool_name = parts[1].trim();
            let params = if parts.len() > 2 { parts[2] } else { "" };
            
            // Execute the tool
            return agent.execute_tool(tool_name, params).await;
        }
    }
    
    // For tasks that don't match specific patterns, route to chat tool (which uses OpenRouter/Gemini)
    let params = format!(r#"{{"goal": "{}", "context": []}}"#, task);
    agent.execute_tool("chat", &params).await
}

/// Register all Tauri commands related to the OrchestratorAgent
pub fn register_commands(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Log that commands are being registered
    log::info!("Registering OrchestratorAgent Tauri commands");
    
    // Register filesystem commands
    log::info!("Registering Filesystem Tauri commands");
    
    // The #[command] macro adds the commands to the generated invoke handler,
    // but we need to register the invoke handler with the Tauri app.
    // This is now handled by Tauri's plugin system automatically.
    
    Ok(())
}

/// Response format for filesystem operations
#[derive(Debug, Serialize, Deserialize)]
pub struct FilesystemResponse {
    /// Whether the operation was successful
    pub success: bool,
    /// Result of the operation (if successful)
    pub result: String,
    /// Error message (if unsuccessful)
    pub error: Option<String>,
    /// Request ID for tracking
    pub request_id: String,
}

impl Default for FilesystemResponse {
    fn default() -> Self {
        Self {
            success: false,
            result: String::new(),
            error: None,
            request_id: RequestId::new().to_string(),
        }
    }
}

/// Lists all available drives on the system
///
/// This Tauri command provides an interface to the FilesystemTool's list_drives functionality.
/// The request is validated through the conscience gate before execution.
///
/// # Returns
///
/// A `FilesystemResponse` containing the list of drives in JSON format
#[command]
pub async fn filesystem_list_drives(
    orchestrator_agent: tauri::State<'_, Arc<OrchestratorAgent>>,
) -> Result<FilesystemResponse, String> {
    // Create a request ID to track this operation
    let request_id = RequestId::new();
    
    // Prepare a response with the request ID
    let mut response = FilesystemResponse {
        success: false,
        result: String::new(),
        error: None,
        request_id: request_id.to_string(),
    };
    
    // Create a conscience request for validation
    let conscience_request = ConscienceRequest {
        id: request_id.clone(),
        action: "List all available drives".to_string(),
        tool_id: "filesystem".to_string(),
        parameters: ToolParameters::from(r#"{"operation":"list_drives"}"#),
        context: HashMap::new(),
        timestamp: SystemTime::now(),
        origin: RequestOrigin::User,
    };
    
    // Get the tool from the OrchestratorAgent
    let result = orchestrator_agent.execute_with_conscience_check(
        "filesystem",
        conscience_request,
        |tool| async {
            // Use the filesystem tool to list drives
            if let Some(filesystem_tool) = tool.downcast_ref::<crate::modules::orchestrator::tools::filesystem::FilesystemTool>() {
                filesystem_tool.tool_list_drives()
                    .map(|drives| serde_json::to_string(&drives).unwrap_or_default())
            } else {
                Err(PhoenixError::Agent {
                    kind: AgentErrorKind::ToolNotFound,
                    message: "Filesystem tool not found".to_string(),
                    component: "FilesystemTool".to_string(),
                })
            }
        }
    ).await;
    
    // Handle the result
    match result {
        Ok(drives_json) => {
            response.success = true;
            response.result = drives_json;
        },
        Err(err) => {
            response.error = Some(format!("Error: {}", err));
        }
    }
    
    Ok(response)
}

/// Reads file content
///
/// This Tauri command provides an interface to the FilesystemTool's read_file functionality.
/// The request is validated through the conscience gate before execution.
///
/// # Arguments
///
/// * `path` - A string containing the path to the file to read
///
/// # Returns
///
/// A `FilesystemResponse` containing the file content or an error
#[command]
pub async fn filesystem_read_file(
    path: String,
    orchestrator_agent: tauri::State<'_, Arc<OrchestratorAgent>>,
) -> Result<FilesystemResponse, String> {
    // Create a request ID to track this operation
    let request_id = RequestId::new();
    
    // Prepare a response with the request ID
    let mut response = FilesystemResponse {
        success: false,
        result: String::new(),
        error: None,
        request_id: request_id.to_string(),
    };
    
    // Create a conscience request for validation
    let conscience_request = ConscienceRequest {
        id: request_id.clone(),
        action: format!("Read file content: {}", path),
        tool_id: "filesystem".to_string(),
        parameters: ToolParameters::from(format!(r#"{{"operation":"read_file","path":"{}"}}"#, path)),
        context: HashMap::new(),
        timestamp: SystemTime::now(),
        origin: RequestOrigin::User,
    };
    
    // Get the tool from the OrchestratorAgent
    let result = orchestrator_agent.execute_with_conscience_check(
        "filesystem",
        conscience_request,
        |tool| async {
            // Use the filesystem tool to read file
            if let Some(filesystem_tool) = tool.downcast_ref::<crate::modules::orchestrator::tools::filesystem::FilesystemTool>() {
                filesystem_tool.tool_read_file(path.clone())
            } else {
                Err(PhoenixError::Agent {
                    kind: AgentErrorKind::ToolNotFound,
                    message: "Filesystem tool not found".to_string(),
                    component: "FilesystemTool".to_string(),
                })
            }
        }
    ).await;
    
    // Handle the result
    match result {
        Ok(content) => {
            response.success = true;
            response.result = content;
        },
        Err(err) => {
            response.error = Some(format!("Error: {}", err));
        }
    }
    
    Ok(response)
}

/// Writes content to a file
///
/// This Tauri command provides an interface to the FilesystemTool's write_file functionality.
/// The request is validated through the conscience gate before execution.
///
/// # Arguments
///
/// * `path` - A string containing the path to the file to write
/// * `content` - A string containing the content to write
///
/// # Returns
///
/// A `FilesystemResponse` indicating success or failure
#[command]
pub async fn filesystem_write_file(
    path: String,
    content: String,
    orchestrator_agent: tauri::State<'_, Arc<OrchestratorAgent>>,
) -> Result<FilesystemResponse, String> {
    // Create a request ID to track this operation
    let request_id = RequestId::new();
    
    // Prepare a response with the request ID
    let mut response = FilesystemResponse {
        success: false,
        result: String::new(),
        error: None,
        request_id: request_id.to_string(),
    };
    
    // Create a conscience request for validation
    let conscience_request = ConscienceRequest {
        id: request_id.clone(),
        action: format!("Write content to file: {}", path),
        tool_id: "filesystem".to_string(),
        parameters: ToolParameters::from(format!(
            r#"{{"operation":"write_file","path":"{}","content":{}}}"#,
            path, serde_json::to_string(&content).unwrap()
        )),
        context: HashMap::new(),
        timestamp: SystemTime::now(),
        origin: RequestOrigin::User,
    };
    
    // Get the tool from the OrchestratorAgent
    let result = orchestrator_agent.execute_with_conscience_check(
        "filesystem",
        conscience_request,
        |tool| async {
            // Use the filesystem tool to write file
            if let Some(filesystem_tool) = tool.downcast_ref::<crate::modules::orchestrator::tools::filesystem::FilesystemTool>() {
                filesystem_tool.tool_write_file(path.clone(), content.clone())
                    .map(|_| "File written successfully".to_string())
            } else {
                Err(PhoenixError::Agent {
                    kind: AgentErrorKind::ToolNotFound,
                    message: "Filesystem tool not found".to_string(),
                    component: "FilesystemTool".to_string(),
                })
            }
        }
    ).await;
    
    // Handle the result
    match result {
        Ok(message) => {
            response.success = true;
            response.result = message;
        },
        Err(err) => {
            response.error = Some(format!("Error: {}", err));
        }
    }
    
    Ok(response)
}

/// Lists directory contents
///
/// This Tauri command provides an interface to the FilesystemTool's list_directory functionality.
/// The request is validated through the conscience gate before execution.
///
/// # Arguments
///
/// * `path` - A string containing the path to the directory to list
///
/// # Returns
///
/// A `FilesystemResponse` containing the directory entries in JSON format
#[command]
pub async fn filesystem_list_directory(
    path: String,
    orchestrator_agent: tauri::State<'_, Arc<OrchestratorAgent>>,
) -> Result<FilesystemResponse, String> {
    // Create a request ID to track this operation
    let request_id = RequestId::new();
    
    // Prepare a response with the request ID
    let mut response = FilesystemResponse {
        success: false,
        result: String::new(),
        error: None,
        request_id: request_id.to_string(),
    };
    
    // Create a conscience request for validation
    let conscience_request = ConscienceRequest {
        id: request_id.clone(),
        action: format!("List directory contents: {}", path),
        tool_id: "filesystem".to_string(),
        parameters: ToolParameters::from(format!(r#"{{"operation":"list_directory","path":"{}"}}"#, path)),
        context: HashMap::new(),
        timestamp: SystemTime::now(),
        origin: RequestOrigin::User,
    };
    
    // Get the tool from the OrchestratorAgent
    let result = orchestrator_agent.execute_with_conscience_check(
        "filesystem",
        conscience_request,
        |tool| async {
            // Use the filesystem tool to list directory
            if let Some(filesystem_tool) = tool.downcast_ref::<crate::modules::orchestrator::tools::filesystem::FilesystemTool>() {
                filesystem_tool.tool_list_directory(path.clone())
                    .map(|entries| serde_json::to_string(&entries).unwrap_or_default())
            } else {
                Err(PhoenixError::Agent {
                    kind: AgentErrorKind::ToolNotFound,
                    message: "Filesystem tool not found".to_string(),
                    component: "FilesystemTool".to_string(),
                })
            }
        }
    ).await;
    
    // Handle the result
    match result {
        Ok(entries_json) => {
            response.success = true;
            response.result = entries_json;
        },
        Err(err) => {
            response.error = Some(format!("Error: {}", err));
        }
    }
    
    Ok(response)
}

/// Searches files across drives
///
/// This Tauri command provides an interface to the FilesystemTool's search_files functionality.
/// The request is validated through the conscience gate before execution.
///
/// # Arguments
///
/// * `query` - A string containing the search query
///
/// # Returns
///
/// A `FilesystemResponse` containing the search results in JSON format
#[command]
pub async fn filesystem_search_files(
    query: String,
    orchestrator_agent: tauri::State<'_, Arc<OrchestratorAgent>>,
) -> Result<FilesystemResponse, String> {
    // Create a request ID to track this operation
    let request_id = RequestId::new();
    
    // Prepare a response with the request ID
    let mut response = FilesystemResponse {
        success: false,
        result: String::new(),
        error: None,
        request_id: request_id.to_string(),
    };
    
    // Create a conscience request for validation
    let conscience_request = ConscienceRequest {
        id: request_id.clone(),
        action: format!("Search files with query: {}", query),
        tool_id: "filesystem".to_string(),
        parameters: ToolParameters::from(format!(r#"{{"operation":"search_files","query":"{}"}}"#, query)),
        context: HashMap::new(),
        timestamp: SystemTime::now(),
        origin: RequestOrigin::User,
    };
    
    // Get the tool from the OrchestratorAgent
    let result = orchestrator_agent.execute_with_conscience_check(
        "filesystem",
        conscience_request,
        |tool| async {
            // Use the filesystem tool to search files
            if let Some(filesystem_tool) = tool.downcast_ref::<crate::modules::orchestrator::tools::filesystem::FilesystemTool>() {
                filesystem_tool.tool_search_files(query.clone())
                    .map(|files| serde_json::to_string(&files).unwrap_or_default())
            } else {
                Err(PhoenixError::Agent {
                    kind: AgentErrorKind::ToolNotFound,
                    message: "Filesystem tool not found".to_string(),
                    component: "FilesystemTool".to_string(),
                })
            }
        }
    ).await;
    
    // Handle the result
    match result {
        Ok(files_json) => {
            response.success = true;
            response.result = files_json;
        },
        Err(err) => {
            response.error = Some(format!("Error: {}", err));
        }
    }
    
    Ok(response)
}

/// Creates a new directory
///
/// This Tauri command provides an interface to the FilesystemTool's create_directory functionality.
/// The request is validated through the conscience gate before execution.
///
/// # Arguments
///
/// * `path` - A string containing the path to the directory to create
///
/// # Returns
///
/// A `FilesystemResponse` indicating success or failure
#[command]
pub async fn filesystem_create_directory(
    path: String,
    orchestrator_agent: tauri::State<'_, Arc<OrchestratorAgent>>,
) -> Result<FilesystemResponse, String> {
    let request_id = RequestId::new();
    
    let mut response = FilesystemResponse {
        success: false,
        result: String::new(),
        error: None,
        request_id: request_id.to_string(),
    };
    
    let conscience_request = ConscienceRequest {
        id: request_id.clone(),
        action: format!("Create directory: {}", path),
        tool_id: "filesystem".to_string(),
        parameters: ToolParameters::from(format!(r#"{{"operation":"create_directory","path":"{}"}}"#, path)),
        context: HashMap::new(),
        timestamp: SystemTime::now(),
        origin: RequestOrigin::User,
    };
    
    let result = orchestrator_agent.execute_with_conscience_check(
        "filesystem",
        conscience_request,
        |tool| async {
            if let Some(filesystem_tool) = tool.downcast_ref::<crate::modules::orchestrator::tools::filesystem::FilesystemTool>() {
                filesystem_tool.tool_create_directory(path.clone())
                    .map(|_| "Directory created successfully".to_string())
            } else {
                Err(PhoenixError::Agent {
                    kind: AgentErrorKind::ToolNotFound,
                    message: "Filesystem tool not found".to_string(),
                    component: "FilesystemTool".to_string(),
                })
            }
        }
    ).await;
    
    match result {
        Ok(message) => {
            response.success = true;
            response.result = message;
        },
        Err(err) => {
            response.error = Some(format!("Error: {}", err));
        }
    }
    
    Ok(response)
}

/// Creates a new empty file
///
/// This Tauri command provides an interface to the FilesystemTool's create_file functionality.
/// The request is validated through the conscience gate before execution.
///
/// # Arguments
///
/// * `path` - A string containing the path to the file to create
///
/// # Returns
///
/// A `FilesystemResponse` indicating success or failure
#[command]
pub async fn filesystem_create_file(
    path: String,
    orchestrator_agent: tauri::State<'_, Arc<OrchestratorAgent>>,
) -> Result<FilesystemResponse, String> {
    let request_id = RequestId::new();
    
    let mut response = FilesystemResponse {
        success: false,
        result: String::new(),
        error: None,
        request_id: request_id.to_string(),
    };
    
    let conscience_request = ConscienceRequest {
        id: request_id.clone(),
        action: format!("Create file: {}", path),
        tool_id: "filesystem".to_string(),
        parameters: ToolParameters::from(format!(r#"{{"operation":"create_file","path":"{}"}}"#, path)),
        context: HashMap::new(),
        timestamp: SystemTime::now(),
        origin: RequestOrigin::User,
    };
    
    let result = orchestrator_agent.execute_with_conscience_check(
        "filesystem",
        conscience_request,
        |tool| async {
            if let Some(filesystem_tool) = tool.downcast_ref::<crate::modules::orchestrator::tools::filesystem::FilesystemTool>() {
                filesystem_tool.tool_create_file(path.clone())
                    .map(|_| "File created successfully".to_string())
            } else {
                Err(PhoenixError::Agent {
                    kind: AgentErrorKind::ToolNotFound,
                    message: "Filesystem tool not found".to_string(),
                    component: "FilesystemTool".to_string(),
                })
            }
        }
    ).await;
    
    match result {
        Ok(message) => {
            response.success = true;
            response.result = message;
        },
        Err(err) => {
            response.error = Some(format!("Error: {}", err));
        }
    }
    
    Ok(response)
}

/// Deletes a file or directory
///
/// This Tauri command provides an interface to the FilesystemTool's delete_item functionality.
/// The request is validated through the conscience gate before execution.
///
/// # Arguments
///
/// * `path` - A string containing the path to the item to delete
///
/// # Returns
///
/// A `FilesystemResponse` indicating success or failure
#[command]
pub async fn filesystem_delete_item(
    path: String,
    orchestrator_agent: tauri::State<'_, Arc<OrchestratorAgent>>,
) -> Result<FilesystemResponse, String> {
    let request_id = RequestId::new();
    
    let mut response = FilesystemResponse {
        success: false,
        result: String::new(),
        error: None,
        request_id: request_id.to_string(),
    };
    
    let conscience_request = ConscienceRequest {
        id: request_id.clone(),
        action: format!("Delete item: {}", path),
        tool_id: "filesystem".to_string(),
        parameters: ToolParameters::from(format!(r#"{{"operation":"delete_item","path":"{}"}}"#, path)),
        context: HashMap::new(),
        timestamp: SystemTime::now(),
        origin: RequestOrigin::User,
    };
    
    let result = orchestrator_agent.execute_with_conscience_check(
        "filesystem",
        conscience_request,
        |tool| async {
            if let Some(filesystem_tool) = tool.downcast_ref::<crate::modules::orchestrator::tools::filesystem::FilesystemTool>() {
                filesystem_tool.tool_delete_item(path.clone())
                    .map(|_| "Item deleted successfully".to_string())
            } else {
                Err(PhoenixError::Agent {
                    kind: AgentErrorKind::ToolNotFound,
                    message: "Filesystem tool not found".to_string(),
                    component: "FilesystemTool".to_string(),
                })
            }
        }
    ).await;
    
    match result {
        Ok(message) => {
            response.success = true;
            response.result = message;
        },
        Err(err) => {
            response.error = Some(format!("Error: {}", err));
        }
    }
    
    Ok(response)
}

/// Response format for hardware commands
#[derive(Debug, Serialize, Deserialize)]
pub struct HardwareCommandResponse {
    /// Whether the command was successful
    pub success: bool,
    /// Result message of the command execution
    pub message: Option<String>,
    /// Error message (if unsuccessful)
    pub error: Option<String>,
    /// Request ID for tracking
    pub request_id: String,
}

impl Default for HardwareCommandResponse {
    fn default() -> Self {
        Self {
            success: false,
            message: None,
            error: None,
            request_id: RequestId::new().to_string(),
        }
    }
}

/// Execute a hardware command
///
/// This Tauri command provides an interface to the hardware_master functionality.
/// It allows direct control of USB, HDMI, Ethernet, Wi-Fi, Bluetooth, GPU, Battery, BIOS, and sensor hardware.
/// The request is validated through the conscience gate before execution.
///
/// # Arguments
///
/// * `command` - A string containing the hardware command to execute
/// * `user_id` - The ID of the user issuing the command (must be "Dad" for conscience gate)
/// * `is_thought` - Optional boolean indicating if this is a thought command (no verbal prefix)
///
/// # Returns
///
/// A `HardwareCommandResponse` indicating success or failure with a result message
#[command]
pub async fn execute_hardware_command(
    command: String,
    user_id: String,
    is_thought: Option<bool>,
    orchestrator_agent: tauri::State<'_, Arc<OrchestratorAgent>>,
) -> Result<HardwareCommandResponse, String> {
    // Create a request ID to track this operation
    let request_id = RequestId::new();
    
    // Prepare a response with the request ID
    let mut response = HardwareCommandResponse {
        success: false,
        message: None,
        error: None,
        request_id: request_id.to_string(),
    };

    // Create a conscience request for validation
    let is_thought_command = is_thought.unwrap_or(false);
    let action_prefix = if is_thought_command { "Thought" } else { "Voice" };
    
    let conscience_request = ConscienceRequest {
        id: request_id.clone(),
        action: format!("{} hardware command: {}", action_prefix, command),
        tool_id: "hardware_master".to_string(),
        parameters: ToolParameters::from(format!(
            r#"{{"command":"{}","user_id":"{}","is_thought":{}}}"#,
            command, user_id, is_thought_command
        )),
        context: HashMap::new(),
        timestamp: SystemTime::now(),
        origin: RequestOrigin::User,
    };
    
    // Execute the hardware command with conscience check
    let result = orchestrator_agent.execute_with_conscience_check(
        "hardware_master",
        conscience_request,
        |_| async {
            // Direct call to hardware_master module
            hardware_master::process_hardware_command(&command, &user_id)
        }
    ).await;
    
    // Handle the result
    match result {
        Ok(message) => {
            response.success = true;
            response.message = Some(message);
        },
        Err(err) => {
            response.error = Some(format!("Error: {}", err));
        }
    }
    
    Ok(response)
}

/// Get hardware system status
///
/// This Tauri command provides an interface to get the status of all hardware systems.
///
/// # Returns
///
/// A string containing the hardware status report
#[command]
pub fn get_hardware_status() -> String {
    hardware_master::hardware_status()
}

/// Response format for mobile device commands
#[derive(Debug, Serialize, Deserialize)]
pub struct MobileCommandResponse {
    /// Whether the command was successful
    pub success: bool,
    /// Result message of the command execution
    pub message: Option<String>,
    /// Error message (if unsuccessful)
    pub error: Option<String>,
    /// Request ID for tracking
    pub request_id: String,
}

impl Default for MobileCommandResponse {
    fn default() -> Self {
        Self {
            success: false,
            message: None,
            error: None,
            request_id: RequestId::new().to_string(),
        }
    }
}

/// Execute a mobile device command
///
/// This Tauri command provides an interface to the mobile_master functionality.
/// It allows complete control of Android and iOS devices connected via USB.
/// The request is validated through the conscience gate before execution.
///
/// # Arguments
///
/// * `command` - A string containing the mobile command to execute
/// * `user_id` - The ID of the user issuing the command (must be "Dad" for conscience gate)
/// * `is_thought` - Optional boolean indicating if this is a thought command (no verbal prefix)
///
/// # Returns
///
/// A `MobileCommandResponse` indicating success or failure with a result message
#[command]
pub async fn execute_mobile_command(
    command: String,
    user_id: String,
    is_thought: Option<bool>,
    orchestrator_agent: tauri::State<'_, Arc<OrchestratorAgent>>,
) -> Result<MobileCommandResponse, String> {
    // Create a request ID to track this operation
    let request_id = RequestId::new();
    
    // Prepare a response with the request ID
    let mut response = MobileCommandResponse {
        success: false,
        message: None,
        error: None,
        request_id: request_id.to_string(),
    };

    // Create a conscience request for validation
    let is_thought_command = is_thought.unwrap_or(false);
    let action_prefix = if is_thought_command { "Thought" } else { "Voice" };
    
    let conscience_request = ConscienceRequest {
        id: request_id.clone(),
        action: format!("{} mobile command: {}", action_prefix, command),
        tool_id: "mobile_master".to_string(),
        parameters: ToolParameters::from(format!(
            r#"{{"command":"{}","user_id":"{}","is_thought":{}}}"#,
            command, user_id, is_thought_command
        )),
        context: HashMap::new(),
        timestamp: SystemTime::now(),
        origin: RequestOrigin::User,
    };
    
    // Execute the mobile command with conscience check
    let result = orchestrator_agent.execute_with_conscience_check(
        "mobile_master",
        conscience_request,
        |_| async {
            // Direct call to mobile_master module
            mobile_master::process_mobile_command(&command, &user_id)
        }
    ).await;
    
    // Handle the result
    match result {
        Ok(message) => {
            response.success = true;
            response.message = Some(message);
        },
        Err(err) => {
            response.error = Some(format!("Error: {}", err));
        }
    }
    
    Ok(response)
}

/// Get mobile system status
///
/// This Tauri command provides an interface to get the status of mobile device control systems.
///
/// # Returns
///
/// A string containing the mobile control status report
#[command]
pub fn get_mobile_status() -> String {
    mobile_master::mobile_status()
}

/// Set cybersecurity mode
///
/// This Tauri command enables or disables cybersecurity mode, which affects the behavior
/// of the mobile master system, including disabling conscience gate for Dad.
///
/// # Arguments
///
/// * `enabled` - Boolean indicating whether cybersecurity mode should be enabled
///
/// # Returns
///
/// A `MobileCommandResponse` indicating the new state
#[command]
pub async fn set_mobile_cybersecurity_mode(
    enabled: bool,
    orchestrator_agent: tauri::State<'_, Arc<OrchestratorAgent>>,
) -> Result<MobileCommandResponse, String> {
    // Create a request ID to track this operation
    let request_id = RequestId::new();
    
    // Prepare a response with the request ID
    let mut response = MobileCommandResponse {
        success: false,
        message: None,
        error: None,
        request_id: request_id.to_string(),
    };

    // Create a conscience request for validation
    let conscience_request = ConscienceRequest {
        id: request_id.clone(),
        action: format!("Set mobile cybersecurity mode: {}", if enabled { "ENABLED" } else { "DISABLED" }),
        tool_id: "mobile_master".to_string(),
        parameters: ToolParameters::from(format!(r#"{{"command":"set_cybersecurity_mode","enabled":{}}}"#, enabled)),
        context: HashMap::new(),
        timestamp: SystemTime::now(),
        origin: RequestOrigin::User,
    };
    
    // Execute the command with conscience check
    let result = orchestrator_agent.execute_with_conscience_check(
        "mobile_master",
        conscience_request,
        |_| async {
            // Direct call to mobile_master module
            mobile_master::set_cybersecurity_mode(enabled)
        }
    ).await;
    
    // Handle the result
    match result {
        Ok(message) => {
            response.success = true;
            response.message = Some(message);
        },
        Err(err) => {
            response.error = Some(format!("Error: {}", err));
        }
    }
    
    Ok(response)
}

/// Response format for Hak5 commands
#[derive(Debug, Serialize, Deserialize)]
pub struct Hak5CommandResponse {
    /// Whether the command was successful
    pub success: bool,
    /// Result message of the command execution
    pub message: Option<String>,
    /// Error message (if unsuccessful)
    pub error: Option<String>,
    /// Request ID for tracking
    pub request_id: String,
}

impl Default for Hak5CommandResponse {
    fn default() -> Self {
        Self {
            success: false,
            message: None,
            error: None,
            request_id: RequestId::new().to_string(),
        }
    }
}

/// Execute a Hak5 device command
///
/// This Tauri command provides an interface to the hak5_master functionality.
/// It allows complete control of Hak5 devices on the local network.
/// The request is validated through the conscience gate before execution.
///
/// # Arguments
///
/// * `command` - A string containing the Hak5 command to execute
/// * `user_id` - The ID of the user issuing the command (must be "Dad" for conscience gate)
/// * `is_thought` - Optional boolean indicating if this is a thought command (no verbal prefix)
///
/// # Returns
///
/// A `Hak5CommandResponse` indicating success or failure with a result message
#[command]
pub async fn execute_hak5_command(
    command: String,
    user_id: String,
    is_thought: Option<bool>,
    orchestrator_agent: tauri::State<'_, Arc<OrchestratorAgent>>,
) -> Result<Hak5CommandResponse, String> {
    // Create a request ID to track this operation
    let request_id = RequestId::new();
    
    // Prepare a response with the request ID
    let mut response = Hak5CommandResponse {
        success: false,
        message: None,
        error: None,
        request_id: request_id.to_string(),
    };

    // Create a conscience request for validation
    let is_thought_command = is_thought.unwrap_or(false);
    let action_prefix = if is_thought_command { "Thought" } else { "Voice" };
    
    let conscience_request = ConscienceRequest {
        id: request_id.clone(),
        action: format!("{} Hak5 command: {}", action_prefix, command),
        tool_id: "hak5_master".to_string(),
        parameters: ToolParameters::from(format!(
            r#"{{"command":"{}","user_id":"{}","is_thought":{}}}"#,
            command, user_id, is_thought_command
        )),
        context: HashMap::new(),
        timestamp: SystemTime::now(),
        origin: RequestOrigin::User,
    };
    
    // Execute the Hak5 command with conscience check
    let result = orchestrator_agent.execute_with_conscience_check(
        "hak5_master",
        conscience_request,
        |_| async {
            // Direct call to hak5_master module
            hak5_master::process_hak5_command(&command, &user_id)
        }
    ).await;
    
    // Handle the result
    match result {
        Ok(message) => {
            response.success = true;
            response.message = Some(message);
        },
        Err(err) => {
            response.error = Some(format!("Error: {}", err));
        }
    }
    
    Ok(response)
}

/// Get Hak5 system status
///
/// This Tauri command provides an interface to get the status of Hak5 device control systems.
///
/// # Returns
///
/// A string containing the Hak5 control status report
#[command]
pub fn get_hak5_status() -> String {
    hak5_master::hak5_status()
}

/// Get Hak5 network map
///
/// This Tauri command provides an interface to get the 3D network map of all Hak5 devices.
///
/// # Returns
///
/// A NetworkMap object containing all map entities and relationships
#[command]
pub fn get_hak5_network_map() -> Result<serde_json::Value, String> {
    match hak5_master::get_network_map() {
        Ok(network_map) => {
            match serde_json::to_value(&network_map) {
                Ok(value) => Ok(value),
                Err(err) => Err(format!("Error serializing network map: {}", err))
            }
        },
        Err(err) => Err(format!("Error getting network map: {}", err))
    }
}