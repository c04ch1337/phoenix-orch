//! Filesystem Tool Implementation
//!
//! This module implements filesystem tools for the OrchestratorAgent,
//! providing secure access to the file system with appropriate jailing
//! and conscience gate checks.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use std::io::{self, Read, Write};
use serde::{Serialize, Deserialize};
use serde_json;
use walkdir::WalkDir;

use crate::modules::orchestrator::tool_registry::{Tool, ToolParameters, ToolResult};
use crate::modules::orchestrator::errors::{PhoenixResult, PhoenixError, AgentErrorKind};
use crate::modules::orchestrator::types::RiskLevel;

/// Format network drives into a user-friendly display format
fn format_network_drives(drives: Vec<DriveInfo>) -> String {
    if drives.is_empty() {
        return "No network drives found on this system.".to_string();
    }
    
    // Create a nicely formatted table-like output
    let mut result = String::from("Network Drives:\n");
    result.push_str("┌──────────┬─────────────────────────┬───────────────┐\n");
    result.push_str("│ Drive    │ Name                    │ Path          │\n");
    result.push_str("├──────────┼─────────────────────────┼───────────────┤\n");
    
    for drive in &drives {
        let drive_letter = drive.name.chars().next().unwrap_or('?');
        let display = drive.display_name.clone().unwrap_or_else(|| drive.name.clone());
        let path = drive.path.clone().unwrap_or_else(|| "N/A".to_string());
        
        // Format each row, padding columns appropriately
        result.push_str(&format!("│ {:<8} │ {:<23} │ {:<13} │\n",
            if drive.name.ends_with(":\\") { drive.name.clone() } else { "-".to_string() },
            truncate_with_ellipsis(&display, 23),
            truncate_with_ellipsis(&path, 13)
        ));
    }
    
    result.push_str("└──────────┴─────────────────────────┴───────────────┘\n");
    
    // Add a summary line
    result.push_str(&format!("\nFound {} network drive(s).", drives.len()));
    
    result
}

/// Helper function to truncate a string with ellipsis if it's too long
fn truncate_with_ellipsis(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        let mut truncated = s.chars().take(max_len - 3).collect::<String>();
        truncated.push_str("...");
        truncated
    }
}

/// The FilesystemTool provides managed access to filesystem operations
#[derive(Debug)]
pub struct FilesystemTool;

// Define allowed root paths for security (jail to these paths)
const ALLOWED_ROOTS: &[&str] = &[
    "C:\\Users", 
    // Add other allowed roots as needed
];

// Define protected paths that should not be written to (conscience gate)
const PROTECTED_PATHS: &[&str] = &[
    "C:\\Windows\\system32",
    "C:\\Windows",
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    // Add other protected paths as needed
];

// Response types for serialization
#[derive(Debug, Serialize)]
struct DriveInfo {
    name: String,
    drive_type: String,
    is_ready: bool,
    display_name: Option<String>,
    path: Option<String>,
}

#[derive(Debug, Serialize)]
struct FileInfo {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
    last_modified: Option<String>,
}

impl FilesystemTool {
    /// Create a new filesystem tool instance
    pub fn new() -> Self {
        Self
    }
    
    /// Helper function to canonicalize and check if a path is allowed (jailed)
    fn safe_canonicalize<P: AsRef<Path>>(&self, path: P) -> PhoenixResult<PathBuf> {
        let path_ref = path.as_ref();
        
        // Attempt to canonicalize the path
        let canonical_path = fs::canonicalize(path_ref).map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::IOError,
            message: format!("Failed to canonicalize path '{}': {}", path_ref.display(), e),
            component: "FilesystemTool".to_string(),
        })?;
        
        // Check if the path is within any of the allowed roots (jail check)
        if !ALLOWED_ROOTS.iter().any(|root| {
            let root_path = PathBuf::from(root);
            canonical_path.starts_with(root_path)
        }) {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::RequestRejected,
                message: format!("Access to path '{}' is not allowed for security reasons", canonical_path.display()),
                component: "FilesystemTool".to_string(),
            });
        }
        
        Ok(canonical_path)
    }

    /// Check if path is in protected area (conscience check)
    fn is_protected_path<P: AsRef<Path>>(&self, path: P) -> bool {
        let path_str = path.as_ref().to_string_lossy().to_lowercase();
        
        PROTECTED_PATHS.iter().any(|protected| {
            let protected_lower = protected.to_lowercase();
            path_str.starts_with(&protected_lower)
        })
    }

    /// Lists available drives on the system
    pub fn tool_list_drives(&self) -> PhoenixResult<Vec<DriveInfo>> {
        let mut drives = Vec::new();
        
        // List drives on Windows (A-Z)
        for drive_letter in b'A'..=b'Z' {
            let drive_path = format!("{}:\\", drive_letter as char);
            let path = Path::new(&drive_path);
            
            if path.exists() {
                // Basic validation that it's a drive
                if let Ok(metadata) = fs::metadata(path) {
                    if metadata.is_dir() {
                        // Determine drive type based on drive letter and other characteristics
                        // In a real implementation, this would use the Windows API's GetDriveType
                        let drive_type = match drive_letter {
                            b'A' | b'B' => "Removable", // Typically floppy drives
                            b'C' => "Fixed", // Usually the system drive
                            b'D'..=b'E' => "Fixed", // Often additional local drives
                            b'X' | b'Y' | b'Z' => "Network", // Commonly used for network drives
                            _ => {
                                // For other drives, attempt to determine if it's a network drive
                                // Network drives often show certain patterns in their root
                                // This is a simplified heuristic for demonstration
                                if let Ok(entries) = fs::read_dir(path) {
                                    if let Some(entry) = entries.take(1).next() {
                                        if let Ok(entry) = entry {
                                            let name = entry.file_name().to_string_lossy().to_lowercase();
                                            if name.contains("network") || name.contains("remote") {
                                                "Network"
                                            } else {
                                                "Unknown"
                                            }
                                        } else {
                                            "Unknown"
                                        }
                                    } else {
                                        // Empty root may suggest a network drive
                                        "Network"
                                    }
                                } else {
                                    // If we can't read the directory but it exists, it might be a network drive
                                    "Network"
                                }
                            }
                        };
                        
                        // Get a display name - for demonstration, using drive letter
                        // In a real implementation, this would query volume information
                        let display_name = match drive_type {
                            "Fixed" => Some(format!("Local Disk ({}:)", drive_letter as char)),
                            "Network" => Some(format!("Network Drive ({}:)", drive_letter as char)),
                            "Removable" => Some(format!("Removable Drive ({}:)", drive_letter as char)),
                            _ => Some(format!("Drive ({}:)", drive_letter as char))
                        };
                        
                        drives.push(DriveInfo {
                            name: drive_path.clone(),
                            drive_type: drive_type.to_string(),
                            is_ready: true,
                            display_name,
                            path: Some(drive_path),
                        });
                    }
                }
            }
        }
        
        // Add UNC paths (\\server\share) - in a real implementation, this would
        // enumerate actual network shares using Windows API
        // This is a simplified demonstration that adds a sample network share
        drives.push(DriveInfo {
            name: "\\\\server\\share".to_string(),
            drive_type: "Network".to_string(),
            is_ready: true,
            display_name: Some("Sample Network Share".to_string()),
            path: Some("\\\\server\\share".to_string()),
        });
        
        Ok(drives)
    }
    
    /// Lists only network drives
    pub fn tool_list_network_drives(&self) -> PhoenixResult<Vec<DriveInfo>> {
        let all_drives = self.tool_list_drives()?;
        
        // Filter to only include network drives
        let network_drives = all_drives
            .into_iter()
            .filter(|drive| drive.drive_type == "Network")
            .collect();
            
        Ok(network_drives)
    }

    /// Reads file content safely with path jailing
    pub fn tool_read_file(&self, path: String) -> PhoenixResult<String> {
        // Security: Canonicalize and check if path is allowed
        let canonical_path = self.safe_canonicalize(&path)?;
        
        // Check if file exists and is a file (not a directory)
        if !canonical_path.exists() {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::IOError,
                message: format!("File does not exist: {}", canonical_path.display()),
                component: "FilesystemTool".to_string(),
            });
        }
        
        if !canonical_path.is_file() {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::IOError,
                message: format!("Path is not a file: {}", canonical_path.display()),
                component: "FilesystemTool".to_string(),
            });
        }
        
        // Read file content
        let mut file = fs::File::open(&canonical_path).map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::IOError,
            message: format!("Failed to open file '{}': {}", canonical_path.display(), e),
            component: "FilesystemTool".to_string(),
        })?;
        
        let mut content = String::new();
        file.read_to_string(&mut content).map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::IOError,
            message: format!("Failed to read file '{}': {}", canonical_path.display(), e),
            component: "FilesystemTool".to_string(),
        })?;
        
        Ok(content)
    }

    /// Writes content to a file with safety checks and conscience gate
    pub fn tool_write_file(&self, path: String, content: String) -> PhoenixResult<()> {
        // Security: Canonicalize and check if path is allowed
        let canonical_path = self.safe_canonicalize(&path)?;
        
        // Conscience gate: Reject writing to protected paths
        if self.is_protected_path(&canonical_path) {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::RequestRejected,
                message: format!(
                    "Cannot write to protected path: {}. This is blocked by the conscience gate.",
                    canonical_path.display()
                ),
                component: "FilesystemTool".to_string(),
            });
        }
        
        // Create parent directories if they don't exist
        if let Some(parent) = canonical_path.parent() {
            fs::create_dir_all(parent).map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::IOError,
                message: format!("Failed to create parent directories for '{}': {}", canonical_path.display(), e),
                component: "FilesystemTool".to_string(),
            })?;
        }
        
        // Write to file
        let mut file = fs::File::create(&canonical_path).map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::IOError,
            message: format!("Failed to create file '{}': {}", canonical_path.display(), e),
            component: "FilesystemTool".to_string(),
        })?;
        
        file.write_all(content.as_bytes()).map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::IOError,
            message: format!("Failed to write to file '{}': {}", canonical_path.display(), e),
            component: "FilesystemTool".to_string(),
        })?;
        
        Ok(())
    }

    /// Lists directory contents safely
    pub fn tool_list_directory(&self, path: String) -> PhoenixResult<Vec<FileInfo>> {
        // Security: Canonicalize and check if path is allowed
        let canonical_path = self.safe_canonicalize(&path)?;
        
        // Check if directory exists
        if !canonical_path.exists() {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::IOError,
                message: format!("Directory does not exist: {}", canonical_path.display()),
                component: "FilesystemTool".to_string(),
            });
        }
        
        if !canonical_path.is_dir() {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::IOError,
                message: format!("Path is not a directory: {}", canonical_path.display()),
                component: "FilesystemTool".to_string(),
            });
        }
        
        // List directory contents
        let entries = fs::read_dir(&canonical_path).map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::IOError,
            message: format!("Failed to read directory '{}': {}", canonical_path.display(), e),
            component: "FilesystemTool".to_string(),
        })?;
        
        let mut file_infos = Vec::new();
        
        for entry in entries {
            let entry = entry.map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::IOError,
                message: format!("Failed to read directory entry: {}", e),
                component: "FilesystemTool".to_string(),
            })?;
            
            let path = entry.path();
            let metadata = entry.metadata().map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::IOError,
                message: format!("Failed to read metadata for '{}': {}", path.display(), e),
                component: "FilesystemTool".to_string(),
            })?;
            
            // Format last_modified as ISO 8601 timestamp if available
            let last_modified = metadata.modified().ok().map(|time| {
                chrono::DateTime::<chrono::Utc>::from(time)
                    .to_rfc3339()
            });
            
            file_infos.push(FileInfo {
                name: entry.file_name().to_string_lossy().to_string(),
                path: path.to_string_lossy().to_string(),
                is_dir: metadata.is_dir(),
                size: if metadata.is_file() { metadata.len() } else { 0 },
                last_modified,
            });
        }
        
        Ok(file_infos)
    }

    /// Searches for files recursively using a query
    pub fn tool_search_files(&self, query: String) -> PhoenixResult<Vec<FileInfo>> {
        let mut results = Vec::new();
        
        // Search all allowed roots
        for root in ALLOWED_ROOTS {
            let root_path = PathBuf::from(root);
            if !root_path.exists() || !root_path.is_dir() {
                continue;
            }
            
            // Walk the directory tree
            for entry in WalkDir::new(&root_path)
                .follow_links(false)
                .into_iter()
                .filter_map(Result::ok) {
                
                let path = entry.path();
                let file_name = entry.file_name().to_string_lossy().to_lowercase();
                
                // Skip non-file entries if desired
                if !entry.file_type().is_file() {
                    continue;
                }
                
                // Simple filename matching (could be enhanced with regex or other patterns)
                let query_lower = query.to_lowercase();
                if file_name.contains(&query_lower) {
                    let metadata = match fs::metadata(path) {
                        Ok(meta) => meta,
                        Err(_) => continue, // Skip entries with metadata errors
                    };
                    
                    let last_modified = metadata.modified().ok().map(|time| {
                        chrono::DateTime::<chrono::Utc>::from(time)
                            .to_rfc3339()
                    });
                    
                    results.push(FileInfo {
                        name: entry.file_name().to_string_lossy().to_string(),
                        path: path.to_string_lossy().to_string(),
                        is_dir: metadata.is_dir(),
                        size: if metadata.is_file() { metadata.len() } else { 0 },
                        last_modified,
                    });
                }
            }
        }
        
        Ok(results)
    }

    /// Creates a new directory
    pub fn tool_create_directory(&self, path: String) -> PhoenixResult<()> {
        // Security: Canonicalize and check if path is allowed
        let canonical_path = self.safe_canonicalize(&path)?;
        
        // Conscience gate: Reject creating directories in protected paths
        if self.is_protected_path(&canonical_path) {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::RequestRejected,
                message: format!(
                    "Cannot create directory in protected path: {}. This is blocked by the conscience gate.",
                    canonical_path.display()
                ),
                component: "FilesystemTool".to_string(),
            });
        }
        
        // Create directory
        fs::create_dir_all(&canonical_path).map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::IOError,
            message: format!("Failed to create directory '{}': {}", canonical_path.display(), e),
            component: "FilesystemTool".to_string(),
        })?;
        
        Ok(())
    }

    /// Creates a new empty file
    pub fn tool_create_file(&self, path: String) -> PhoenixResult<()> {
        // Security: Canonicalize and check if path is allowed
        let canonical_path = self.safe_canonicalize(&path)?;
        
        // Conscience gate: Reject creating files in protected paths
        if self.is_protected_path(&canonical_path) {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::RequestRejected,
                message: format!(
                    "Cannot create file in protected path: {}. This is blocked by the conscience gate.",
                    canonical_path.display()
                ),
                component: "FilesystemTool".to_string(),
            });
        }
        
        // Create parent directories if they don't exist
        if let Some(parent) = canonical_path.parent() {
            fs::create_dir_all(parent).map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::IOError,
                message: format!("Failed to create parent directories for '{}': {}", canonical_path.display(), e),
                component: "FilesystemTool".to_string(),
            })?;
        }
        
        // Create empty file
        fs::File::create(&canonical_path).map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::IOError,
            message: format!("Failed to create file '{}': {}", canonical_path.display(), e),
            component: "FilesystemTool".to_string(),
        })?;
        
        Ok(())
    }

    /// Deletes a file or directory
    pub fn tool_delete_item(&self, path: String) -> PhoenixResult<()> {
        // Security: Canonicalize and check if path is allowed
        let canonical_path = self.safe_canonicalize(&path)?;
        
        // Conscience gate: Reject deleting from protected paths
        if self.is_protected_path(&canonical_path) {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::RequestRejected,
                message: format!(
                    "Cannot delete from protected path: {}. This is blocked by the conscience gate.",
                    canonical_path.display()
                ),
                component: "FilesystemTool".to_string(),
            });
        }
        
        // Check if path exists
        if !canonical_path.exists() {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::IOError,
                message: format!("Path does not exist: {}", canonical_path.display()),
                component: "FilesystemTool".to_string(),
            });
        }
        
        // Delete file or directory
        if canonical_path.is_dir() {
            fs::remove_dir_all(&canonical_path).map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::IOError,
                message: format!("Failed to delete directory '{}': {}", canonical_path.display(), e),
                component: "FilesystemTool".to_string(),
            })?;
        } else {
            fs::remove_file(&canonical_path).map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::IOError,
                message: format!("Failed to delete file '{}': {}", canonical_path.display(), e),
                component: "FilesystemTool".to_string(),
            })?;
        }
        
        Ok(())
    }
}

#[async_trait::async_trait]
impl Tool for FilesystemTool {
    async fn execute(&self, parameters: ToolParameters) -> PhoenixResult<ToolResult> {
        // Parse the parameters JSON
        let params_json: serde_json::Value = serde_json::from_str(&parameters.0)
            .map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::InvalidRequest,
                message: format!("Failed to parse filesystem parameters: {}", e),
                component: "FilesystemTool".to_string(),
            })?;
        
        // Extract the operation type
        let operation = params_json.get("operation")
            .and_then(|v| v.as_str())
            .ok_or_else(|| PhoenixError::Agent {
                kind: AgentErrorKind::InvalidRequest,
                message: "Missing 'operation' field in parameters".to_string(),
                component: "FilesystemTool".to_string(),
            })?;
        
        // Execute the appropriate operation
        let (success, data, error) = match operation {
            "list_drives" => {
                match self.tool_list_drives() {
                    Ok(drives) => (true, serde_json::to_string(&drives).unwrap(), None),
                    Err(e) => (false, String::new(), Some(e.to_string())),
                }
            },
            "list_network_drives" => {
                match self.tool_list_network_drives() {
                    Ok(drives) => {
                        if drives.is_empty() {
                            (false, String::new(), Some("No network drives found on this system".to_string()))
                        } else {
                            // Format the network drives in a user-friendly way
                            let formatted_drives = format_network_drives(drives.clone());
                            let mut result = serde_json::json!({
                                "drives": drives,
                                "formatted": formatted_drives,
                                "count": drives.len()
                            });
                            (true, serde_json::to_string(&result).unwrap(), None)
                        }
                    },
                    Err(e) => (false, String::new(), Some(e.to_string())),
                }
            },
            "read_file" => {
                if let Some(path) = params_json.get("path").and_then(|v| v.as_str()) {
                    match self.tool_read_file(path.to_string()) {
                        Ok(content) => (true, content, None),
                        Err(e) => (false, String::new(), Some(e.to_string())),
                    }
                } else {
                    (false, String::new(), Some("Missing 'path' parameter".to_string()))
                }
            },
            "write_file" => {
                let path = params_json.get("path").and_then(|v| v.as_str());
                let content = params_json.get("content").and_then(|v| v.as_str());
                
                match (path, content) {
                    (Some(p), Some(c)) => {
                        match self.tool_write_file(p.to_string(), c.to_string()) {
                            Ok(_) => (true, "File written successfully".to_string(), None),
                            Err(e) => (false, String::new(), Some(e.to_string())),
                        }
                    },
                    _ => (false, String::new(), Some("Missing 'path' or 'content' parameter".to_string())),
                }
            },
            "list_directory" => {
                if let Some(path) = params_json.get("path").and_then(|v| v.as_str()) {
                    match self.tool_list_directory(path.to_string()) {
                        Ok(entries) => (true, serde_json::to_string(&entries).unwrap(), None),
                        Err(e) => (false, String::new(), Some(e.to_string())),
                    }
                } else {
                    (false, String::new(), Some("Missing 'path' parameter".to_string()))
                }
            },
            "search_files" => {
                if let Some(query) = params_json.get("query").and_then(|v| v.as_str()) {
                    match self.tool_search_files(query.to_string()) {
                        Ok(files) => (true, serde_json::to_string(&files).unwrap(), None),
                        Err(e) => (false, String::new(), Some(e.to_string())),
                    }
                } else {
                    (false, String::new(), Some("Missing 'query' parameter".to_string()))
                }
            },
            "create_directory" => {
                if let Some(path) = params_json.get("path").and_then(|v| v.as_str()) {
                    match self.tool_create_directory(path.to_string()) {
                        Ok(_) => (true, "Directory created successfully".to_string(), None),
                        Err(e) => (false, String::new(), Some(e.to_string())),
                    }
                } else {
                    (false, String::new(), Some("Missing 'path' parameter".to_string()))
                }
            },
            "create_file" => {
                if let Some(path) = params_json.get("path").and_then(|v| v.as_str()) {
                    match self.tool_create_file(path.to_string()) {
                        Ok(_) => (true, "File created successfully".to_string(), None),
                        Err(e) => (false, String::new(), Some(e.to_string())),
                    }
                } else {
                    (false, String::new(), Some("Missing 'path' parameter".to_string()))
                }
            },
            "delete_item" => {
                if let Some(path) = params_json.get("path").and_then(|v| v.as_str()) {
                    match self.tool_delete_item(path.to_string()) {
                        Ok(_) => (true, "Item deleted successfully".to_string(), None),
                        Err(e) => (false, String::new(), Some(e.to_string())),
                    }
                } else {
                    (false, String::new(), Some("Missing 'path' parameter".to_string()))
                }
            },
            _ => (false, String::new(), Some(format!("Unknown operation: {}", operation))),
        };
        
        // Build metadata
        let mut metadata = HashMap::new();
        metadata.insert("tool".to_string(), "filesystem".to_string());
        metadata.insert("operation".to_string(), operation.to_string());
        
        if let Some(path) = params_json.get("path").and_then(|v| v.as_str()) {
            metadata.insert("path".to_string(), path.to_string());
        }
        
        Ok(ToolResult {
            success,
            data,
            error,
            metadata,
            timestamp: SystemTime::now(),
        })
    }
    
    fn name(&self) -> &str {
        "filesystem"
    }
    
    fn description(&self) -> &str {
        "File system operations tool that provides controlled access to the filesystem with security checks"
    }
    
    fn requires_conscience_approval(&self) -> bool {
        true // All filesystem operations require conscience approval
    }
    
    fn requires_human_review(&self) -> bool {
        false // This is delegated to the conscience gate
    }
}

// Implement EthicalTool trait for enhanced security controls
impl crate::modules::orchestrator::tool_registry::EthicalTool for FilesystemTool {
    fn can_leak_sensitive_data(&self) -> bool {
        true // Filesystem operations can potentially expose sensitive data
    }
    
    fn risk_level(&self) -> RiskLevel {
        RiskLevel::Medium // Medium risk for most filesystem operations
    }
    
    fn ethical_concerns(&self) -> Vec<String> {
        vec![
            "Can access sensitive user data".to_string(),
            "Can modify files on the system".to_string(),
            "Could potentially be used to introduce malicious files".to_string(),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use std::io::Write;
    
    #[tokio::test]
    async fn test_read_write_file() {
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("test_file.txt");
        let file_path_str = file_path.to_string_lossy().to_string();
        
        // Create a test file
        let test_content = "Hello, Phoenix!";
        {
            let mut file = fs::File::create(&file_path).unwrap();
            write!(file, "{}", test_content).unwrap();
        }
        
        let tool = FilesystemTool::new();
        
        // Test read_file
        let params = ToolParameters(format!(r#"{{"operation":"read_file","path":"{}"}}"#, file_path_str));
        let result = tool.execute(params).await.unwrap();
        assert!(result.success);
        assert_eq!(result.data, test_content);
        
        // Test write_file
        let new_content = "Updated content";
        let params = ToolParameters(format!(
            r#"{{"operation":"write_file","path":"{}","content":"{}"}}"#, 
            file_path_str, new_content
        ));
        let result = tool.execute(params).await.unwrap();
        assert!(result.success);
        
        // Verify content was updated
        let params = ToolParameters(format!(r#"{{"operation":"read_file","path":"{}"}}"#, file_path_str));
        let result = tool.execute(params).await.unwrap();
        assert!(result.success);
        assert_eq!(result.data, new_content);
    }
    
    #[tokio::test]
    async fn test_list_directory() {
        let temp_dir = tempdir().unwrap();
        let dir_path_str = temp_dir.path().to_string_lossy().to_string();
        
        // Create some test files
        fs::File::create(temp_dir.path().join("file1.txt")).unwrap();
        fs::File::create(temp_dir.path().join("file2.txt")).unwrap();
        
        let tool = FilesystemTool::new();
        
        let params = ToolParameters(format!(r#"{{"operation":"list_directory","path":"{}"}}"#, dir_path_str));
        let result = tool.execute(params).await.unwrap();
        assert!(result.success);
        
        // Parse the JSON result
        let entries: Vec<FileInfo> = serde_json::from_str(&result.data).unwrap();
        assert_eq!(entries.len(), 2);
        
        let filenames: Vec<String> = entries.iter().map(|e| e.name.clone()).collect();
        assert!(filenames.contains(&"file1.txt".to_string()));
        assert!(filenames.contains(&"file2.txt".to_string()));
    }
    
    #[tokio::test]
    async fn test_protected_path_rejection() {
        let tool = FilesystemTool::new();
        
        // Try to write to a protected path
        let params = ToolParameters(r#"{"operation":"write_file","path":"C:\\Windows\\system32\\test.txt","content":"This should be rejected"}"#.to_string());
        let result = tool.execute(params).await.unwrap();
        assert!(!result.success);
        assert!(result.error.is_some());
        
        let error_msg = result.error.unwrap();
        assert!(error_msg.contains("protected path") || error_msg.contains("conscience"));
    }
}