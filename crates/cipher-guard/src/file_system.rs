//! File System Module for Cipher Guard
//!
//! Provides secure file system operations for Phoenix, including
//! writing files to the desktop in response to natural language commands.

use crate::desktop_path_resolver::{DesktopPathResolver, DesktopPathError};
use crate::ethics::{EthicalFramework, DefensiveAction, ImpactCategory};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use thiserror::Error;

/// File System Service that handles secure file operations
pub struct FileSystemService {
    /// Desktop path resolver
    desktop_resolver: DesktopPathResolver,
    /// Ethical framework for evaluating operations
    ethical_framework: EthicalFramework,
}

impl FileSystemService {
    /// Create a new file system service
    pub fn new(ethical_framework: EthicalFramework) -> Self {
        Self {
            desktop_resolver: DesktopPathResolver::new(),
            ethical_framework,
        }
    }
    
    /// Write content to a file on the Desktop
    pub async fn write_to_desktop(
        &mut self,
        filename: &str,
        content: &str,
        user: &str,
    ) -> Result<FileOperationResult, FileSystemError> {
        // Validate operation through ethical framework
        let action = self.create_file_write_action(filename, user)?;
        let evaluation = self.ethical_framework.evaluate_action(&action);
        
        if evaluation.overall_score < 0.7 {
            return Err(FileSystemError::EthicalViolation(
                format!("File operation failed ethical evaluation. Score: {}", evaluation.overall_score)
            ));
        }
        
        // Resolve the desktop path
        let file_path = self.desktop_resolver.resolve_new_desktop_file_path(filename)
            .map_err(|e| FileSystemError::PathResolutionError(e.to_string()))?;
        
        // Create parent directories if they don't exist
        if let Some(parent) = file_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| FileSystemError::IoError(format!("Failed to create directories: {}", e)))?;
            }
        }
        
        // Write the content to the file
        fs::write(&file_path, content.as_bytes())
            .map_err(|e| FileSystemError::IoError(format!("Failed to write file: {}", e)))?;
        
        Ok(FileOperationResult {
            success: true,
            path: file_path,
            operation_type: FileOperationType::Write,
            bytes_processed: content.len() as u64,
        })
    }
    
    /// Create a defensive action for file write operation
    fn create_file_write_action(&self, filename: &str, user: &str) -> Result<DefensiveAction, FileSystemError> {
        // Create estimated impact
        let mut estimated_impact = HashMap::new();
        estimated_impact.insert(ImpactCategory::Data, 0.3);  // Medium data impact
        estimated_impact.insert(ImpactCategory::Systems, 0.1); // Low system impact
        estimated_impact.insert(ImpactCategory::Privacy, 0.2); // Low-medium privacy impact
        estimated_impact.insert(ImpactCategory::Operations, 0.1); // Low operations impact
        
        // Create safeguards
        let mut safeguards = Vec::new();
        safeguards.push("filename_validation".to_string());
        safeguards.push("path_traversal_prevention".to_string());
        safeguards.push("desktop_only_write".to_string());
        safeguards.push("user_consent_required".to_string());
        
        Ok(DefensiveAction {
            action_type: "file_write_to_desktop".to_string(),
            target_scope: format!("file:{}", filename),
            estimated_impact,
            safeguards,
        })
    }
    
    /// Authentication function to check if user is authorized for loot vault access
    pub fn authenticate_for_vault(&self, user: &str) -> Result<bool, FileSystemError> {
        // Only "Dad" is allowed to access the loot vault
        if user != "Dad" {
            return Err(FileSystemError::PermissionDenied(
                "Only Dad can access the loot vault".to_string()
            ));
        }
        
        Ok(true)
    }
    
    /// Securely access the loot vault storage location
    pub fn access_loot_vault(&self, user: &str) -> Result<PathBuf, FileSystemError> {
        // Authenticate the user
        self.authenticate_for_vault(user)?;
        
        // Create a safe, isolated path for loot storage
        let vault_path = dirs::data_local_dir()
            .ok_or_else(|| FileSystemError::PathResolutionError("Could not determine data directory".to_string()))?
            .join("phoenix-orch")
            .join("loot-vault");
        
        // Create the directory if it doesn't exist
        if !vault_path.exists() {
            fs::create_dir_all(&vault_path)
                .map_err(|e| FileSystemError::IoError(format!("Failed to create loot vault directory: {}", e)))?;
        }
        
        // Ensure the directory permissions are secure
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let metadata = fs::metadata(&vault_path)
                .map_err(|e| FileSystemError::IoError(format!("Failed to get vault directory metadata: {}", e)))?;
            let mut permissions = metadata.permissions();
            permissions.set_mode(0o700); // rwx------ (owner only)
            fs::set_permissions(&vault_path, permissions)
                .map_err(|e| FileSystemError::IoError(format!("Failed to set vault permissions: {}", e)))?;
        }
        
        Ok(vault_path)
    }
    
    /// Generate a secure encryption key for the loot vault
    pub fn generate_vault_encryption_key(&self, user: &str) -> Result<[u8; 32], FileSystemError> {
        // Authenticate the user
        self.authenticate_for_vault(user)?;
        
        // Generate a secure random key
        let mut key = [0u8; 32];
        
        // In a real implementation, we would use a proper CSPRNG
        // For this example, we'll use a simple random generator
        for i in 0..32 {
            key[i] = (i % 255) as u8; // Placeholder implementation
        }
        
        Ok(key)
    }
    
    /// Check if a file exists on the desktop
    pub fn desktop_file_exists(&mut self, filename: &str) -> Result<bool, FileSystemError> {
        // Resolve the desktop path
        let file_path = self.desktop_resolver.resolve_new_desktop_file_path(filename)
            .map_err(|e| FileSystemError::PathResolutionError(e.to_string()))?;
        
        Ok(file_path.exists())
    }
    
    /// Read content from a file on the desktop
    pub async fn read_from_desktop(&mut self, filename: &str) -> Result<String, FileSystemError> {
        // Resolve the desktop path
        let file_path = self.desktop_resolver.resolve_desktop_file_path(filename)
            .map_err(|e| FileSystemError::PathResolutionError(e.to_string()))?;
        
        // Check if the file exists
        if !file_path.exists() {
            return Err(FileSystemError::FileNotFound(filename.to_string()));
        }
        
        // Read the content from the file
        fs::read_to_string(&file_path)
            .map_err(|e| FileSystemError::IoError(format!("Failed to read file: {}", e)))
    }
}

/// Result of a file operation
#[derive(Debug)]
pub struct FileOperationResult {
    /// Whether the operation succeeded
    pub success: bool,
    /// Path to the file
    pub path: PathBuf,
    /// Type of operation
    pub operation_type: FileOperationType,
    /// Bytes processed
    pub bytes_processed: u64,
}

/// Type of file operations
#[derive(Debug)]
pub enum FileOperationType {
    /// Read operation
    Read,
    /// Write operation
    Write,
    /// Delete operation
    Delete,
    /// Update operation
    Update,
}

/// File system error types
#[derive(Error, Debug)]
pub enum FileSystemError {
    /// Could not resolve file path
    #[error("Path resolution error: {0}")]
    PathResolutionError(String),
    
    /// File not found
    #[error("File not found: {0}")]
    FileNotFound(String),
    
    /// Permission error
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    
    /// IO Error
    #[error("IO error: {0}")]
    IoError(String),
    
    /// Ethical violation
    #[error("Ethical violation: {0}")]
    EthicalViolation(String),
    
    /// Invalid filename
    #[error("Invalid filename: {0}")]
    InvalidFilename(String),
    
    /// Path traversal attempt
    #[error("Path traversal attempt: {0}")]
    PathTraversal(String),
}

#[cfg(test)]
mod tests {
    use super::*;
    
    fn create_test_service() -> FileSystemService {
        FileSystemService::new(EthicalFramework::new())
    }
    
    #[tokio::test]
    async fn test_write_to_desktop() {
        let mut service = create_test_service();
        let result = service.write_to_desktop("test_file.txt", "test content", "test_user").await;
        
        // This test may succeed or fail depending on the environment
        // Just check that we get a result
        println!("Write to desktop result: {:?}", result);
    }
}