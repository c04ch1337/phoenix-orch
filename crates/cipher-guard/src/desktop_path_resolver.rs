//! Desktop Path Resolver Module for Cipher Guard
//!
//! Resolves the path to the user's Desktop directory across different operating systems
//! in a secure and reliable way.

use dirs::desktop_dir;
use std::path::{Path, PathBuf};
use std::env;
use std::io;
use thiserror::Error;

/// Error type for desktop path operations
#[derive(Error, Debug)]
pub enum DesktopPathError {
    /// Could not determine the Desktop directory
    #[error("Could not determine Desktop directory: {0}")]
    DesktopDirNotFound(String),
    
    /// Permission error when accessing Desktop
    #[error("Permission denied when accessing Desktop: {0}")]
    PermissionDenied(String),
    
    /// IO Error
    #[error("IO error: {0}")]
    IoError(#[from] io::Error),
    
    /// Path canonicalization error
    #[error("Path canonicalization error: {0}")]
    CanonicalPathError(String),
    
    /// Invalid filename
    #[error("Invalid filename: {0}")]
    InvalidFilename(String),
}

/// Result type for desktop path operations
pub type Result<T> = std::result::Result<T, DesktopPathError>;

/// Desktop Path Resolver for cross-platform desktop path resolution
#[derive(Debug, Clone)]
pub struct DesktopPathResolver {
    /// Cached desktop path
    desktop_path: Option<PathBuf>,
    /// Allow absolute paths
    allow_absolute_paths: bool,
}

impl DesktopPathResolver {
    /// Create a new desktop path resolver
    pub fn new() -> Self {
        Self {
            desktop_path: None,
            allow_absolute_paths: false,
        }
    }
    
    /// Allow or disallow absolute paths when resolving
    pub fn with_absolute_paths(mut self, allow: bool) -> Self {
        self.allow_absolute_paths = allow;
        self
    }
    
    /// Get the path to the user's Desktop directory
    pub fn get_desktop_path(&mut self) -> Result<PathBuf> {
        // Return cached path if available
        if let Some(path) = &self.desktop_path {
            return Ok(path.clone());
        }
        
        // Try standard directories API first
        if let Some(desktop) = desktop_dir() {
            // Verify the path exists and is writable
            if desktop.exists() && Self::is_writable(&desktop) {
                self.desktop_path = Some(desktop.clone());
                return Ok(desktop);
            }
        }
        
        // Fall back to platform-specific methods
        let path = self.resolve_platform_specific_desktop()?;
        self.desktop_path = Some(path.clone());
        
        Ok(path)
    }
    
    /// Resolve a file path on the desktop
    pub fn resolve_desktop_file_path(&mut self, filename: &str) -> Result<PathBuf> {
        // Validate filename
        self.validate_filename(filename)?;
        
        // Get desktop path
        let desktop = self.get_desktop_path()?;
        
        // Combine with filename
        let file_path = desktop.join(filename);
        
        // Canonicalize and check the path is within the desktop directory
        let canonical_path = file_path.canonicalize()
            .map_err(|_| DesktopPathError::CanonicalPathError(file_path.display().to_string()))?;
            
        if !self.allow_absolute_paths && !canonical_path.starts_with(&desktop) {
            return Err(DesktopPathError::PermissionDenied(
                "Path traversal attempt detected".to_string()
            ));
        }
        
        Ok(file_path)
    }
    
    /// Resolve a desktop file path without canonicalization (for new files that don't exist yet)
    pub fn resolve_new_desktop_file_path(&mut self, filename: &str) -> Result<PathBuf> {
        // Validate filename
        self.validate_filename(filename)?;
        
        // Get desktop path
        let desktop = self.get_desktop_path()?;
        
        // Combine with filename
        let file_path = desktop.join(filename);
        
        // Check that path normalization still keeps us in the desktop
        let normalized = file_path.components().fold(
            PathBuf::new(), 
            |mut result, component| {
                result.push(component);
                result
            }
        );
        
        if !normalized.starts_with(&desktop) {
            return Err(DesktopPathError::PermissionDenied(
                "Path traversal attempt detected".to_string()
            ));
        }
        
        Ok(file_path)
    }
    
    /// Platform-specific desktop resolution methods
    fn resolve_platform_specific_desktop(&self) -> Result<PathBuf> {
        #[cfg(target_os = "windows")]
        {
            // Try using environment variables first
            if let Ok(user_profile) = env::var("USERPROFILE") {
                let desktop = PathBuf::from(user_profile).join("Desktop");
                if desktop.exists() && Self::is_writable(&desktop) {
                    return Ok(desktop);
                }
            }
            
            // Try using the shell known folder path via winapi
            // For simplicity in this implementation we'll skip this and rely on the dirs crate
        }
        
        #[cfg(target_os = "macos")]
        {
            // macOS specific fallback
            if let Ok(home) = env::var("HOME") {
                let desktop = PathBuf::from(home).join("Desktop");
                if desktop.exists() && Self::is_writable(&desktop) {
                    return Ok(desktop);
                }
            }
        }
        
        #[cfg(target_os = "linux")]
        {
            // Linux specific fallback using XDG user dirs
            if let Ok(xdg_config) = env::var("XDG_CONFIG_HOME") {
                let user_dirs = PathBuf::from(xdg_config).join("user-dirs.dirs");
                if user_dirs.exists() {
                    // In a real implementation we would parse this file for XDG_DESKTOP_DIR
                    // For simplicity, we'll skip this here
                }
            }
            
            // Fallback to HOME/Desktop
            if let Ok(home) = env::var("HOME") {
                let desktop = PathBuf::from(home).join("Desktop");
                if desktop.exists() && Self::is_writable(&desktop) {
                    return Ok(desktop);
                }
            }
        }
        
        // If we couldn't determine the desktop path
        Err(DesktopPathError::DesktopDirNotFound(
            "Could not determine desktop directory".to_string()
        ))
    }
    
    /// Check if a path is writable
    fn is_writable(path: &Path) -> bool {
        // Try to create and remove a temporary file to check write permissions
        let test_file = path.join(".cipher_guard_write_test");
        let write_result = std::fs::write(&test_file, b"test");
        
        // Clean up the test file if it was created
        let _ = std::fs::remove_file(test_file);
        
        write_result.is_ok()
    }
    
    /// Validate filename for security
    fn validate_filename(&self, filename: &str) -> Result<()> {
        // Check for empty filenames
        if filename.trim().is_empty() {
            return Err(DesktopPathError::InvalidFilename(
                "Filename cannot be empty".to_string()
            ));
        }
        
        // Check for path traversal attempts
        if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
            return Err(DesktopPathError::InvalidFilename(
                "Filename contains invalid characters".to_string()
            ));
        }
        
        // Check for other invalid characters (Windows-specific)
        #[cfg(target_os = "windows")]
        {
            // Windows-prohibited characters
            let invalid_chars = ['<', '>', ':', '"', '|', '?', '*'];
            if filename.chars().any(|c| invalid_chars.contains(&c)) {
                return Err(DesktopPathError::InvalidFilename(
                    "Filename contains characters not allowed on Windows".to_string()
                ));
            }
        }
        
        Ok(())
    }
}

impl Default for DesktopPathResolver {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_desktop_path_resolver() {
        let mut resolver = DesktopPathResolver::new();
        let desktop_path = resolver.get_desktop_path();
        
        // Simply check that we get a result, not testing the specific path
        // since it would be different on different systems
        assert!(desktop_path.is_ok(), "Should be able to resolve desktop path");
    }
    
    #[test]
    fn test_filename_validation() {
        let mut resolver = DesktopPathResolver::new();
        
        // Valid filename
        assert!(resolver.validate_filename("test.txt").is_ok());
        
        // Invalid filenames
        assert!(resolver.validate_filename("").is_err());
        assert!(resolver.validate_filename("..").is_err());
        assert!(resolver.validate_filename("../test.txt").is_err());
        assert!(resolver.validate_filename("test/file.txt").is_err());
        assert!(resolver.validate_filename("test\\file.txt").is_err());
    }
}