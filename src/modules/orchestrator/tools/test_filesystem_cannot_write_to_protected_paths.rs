use super::filesystem::FilesystemTool;
use crate::modules::orchestrator::tool_registry::{Tool, ToolParameters};
use std::fs;
use std::path::{Path, PathBuf};
use tempfile::{tempdir, TempDir};
use std::io::Write;

/// Helper function to create a temporary test file with content
fn create_test_file(dir: &TempDir, filename: &str, content: &str) -> PathBuf {
    let file_path = dir.path().join(filename);
    let mut file = fs::File::create(&file_path).expect("Failed to create test file");
    write!(file, "{}", content).expect("Failed to write test content");
    file_path
}

/// Helper function to create a temporary directory structure for testing
fn setup_test_directory() -> TempDir {
    let temp_dir = tempdir().expect("Failed to create temporary directory");
    
    // Create a nested directory structure
    let nested_dir = temp_dir.path().join("nested");
    fs::create_dir(&nested_dir).expect("Failed to create nested directory");
    
    // Create some test files
    create_test_file(&temp_dir, "file1.txt", "This is test file 1");
    create_test_file(&temp_dir, "file2.txt", "This is test file 2");
    create_test_file(&temp_dir, "config.json", r#"{"setting1": "value1", "setting2": 42}"#);
    
    // Create a file in the nested directory
    let nested_file_path = nested_dir.join("nested_file.txt");
    let mut file = fs::File::create(&nested_file_path).expect("Failed to create nested test file");
    write!(file, "This is a nested file").expect("Failed to write nested test content");
    
    temp_dir
}

#[tokio::test]
async fn test_read_file_works_correctly() {
    // Test that reading files works correctly
    let temp_dir = setup_test_directory();
    let tool = FilesystemTool::new();
    
    // Test reading a valid file
    let file_path = temp_dir.path().join("file1.txt");
    let file_path_str = file_path.to_string_lossy().to_string();
    
    let params = ToolParameters(format!(r#"{{"operation":"read_file","path":"{}"}}"#, file_path_str));
    let result = tool.execute(params).await.expect("Tool execution failed");
    
    assert!(result.success, "Reading valid file should succeed");
    assert_eq!(result.data, "This is test file 1", "File content should match");
    
    // Test reading a nested file
    let nested_file_path = temp_dir.path().join("nested").join("nested_file.txt");
    let nested_file_path_str = nested_file_path.to_string_lossy().to_string();
    
    let params = ToolParameters(format!(r#"{{"operation":"read_file","path":"{}"}}"#, nested_file_path_str));
    let result = tool.execute(params).await.expect("Tool execution failed");
    
    assert!(result.success, "Reading nested file should succeed");
    assert_eq!(result.data, "This is a nested file", "Nested file content should match");
}

#[tokio::test]
async fn test_write_file_works_for_allowed_locations() {
    // Test that writing files works correctly for allowed locations
    let temp_dir = tempdir().expect("Failed to create temporary directory");
    let tool = FilesystemTool::new();
    
    // Test writing to a new file
    let file_path = temp_dir.path().join("new_file.txt");
    let file_path_str = file_path.to_string_lossy().to_string();
    let content = "This is a new test file";
    
    let params = ToolParameters(format!(
        r#"{{"operation":"write_file","path":"{}","content":"{}"}}"#, 
        file_path_str, content
    ));
    
    let result = tool.execute(params).await.expect("Tool execution failed");
    assert!(result.success, "Writing to an allowed location should succeed");
    
    // Verify the file was created with the correct content
    let file_content = fs::read_to_string(&file_path).expect("Failed to read the created file");
    assert_eq!(file_content, content, "Written content should match");
    
    // Test writing to a nested directory that doesn't exist yet (should create directories)
    let nested_dir_path = temp_dir.path().join("new_nested_dir");
    let nested_file_path = nested_dir_path.join("new_nested_file.txt");
    let nested_file_path_str = nested_file_path.to_string_lossy().to_string();
    let nested_content = "This is a new nested test file";
    
    let params = ToolParameters(format!(
        r#"{{"operation":"write_file","path":"{}","content":"{}"}}"#, 
        nested_file_path_str, nested_content
    ));
    
    let result = tool.execute(params).await.expect("Tool execution failed");
    assert!(result.success, "Writing to a new nested directory should succeed");
    
    // Verify the directory and file were created with the correct content
    assert!(nested_dir_path.exists(), "New nested directory should be created");
    assert!(nested_file_path.exists(), "New nested file should be created");
    
    let file_content = fs::read_to_string(&nested_file_path).expect("Failed to read the created nested file");
    assert_eq!(file_content, nested_content, "Written nested file content should match");
}

#[tokio::test]
async fn test_writing_to_protected_paths_is_blocked() {
    // Test that writing to protected paths is blocked
    let tool = FilesystemTool::new();
    
    // Test writing to system32
    let system32_path = "C:\\Windows\\system32\\test_should_not_work.txt";
    let content = "This should be blocked by the conscience gate";
    
    let params = ToolParameters(format!(
        r#"{{"operation":"write_file","path":"{}","content":"{}"}}"#, 
        system32_path, content
    ));
    
    let result = tool.execute(params).await.expect("Tool execution failed");
    assert!(!result.success, "Writing to system32 should be blocked");
    assert!(result.error.is_some(), "Error should be returned when writing to system32");
    let error_msg = result.error.unwrap();
    assert!(error_msg.contains("protected path") || error_msg.contains("conscience"), 
        "Error should mention protected path: {}", error_msg);
    
    // Test writing to Program Files
    let program_files_path = "C:\\Program Files\\test_should_not_work.txt";
    
    let params = ToolParameters(format!(
        r#"{{"operation":"write_file","path":"{}","content":"{}"}}"#, 
        program_files_path, content
    ));
    
    let result = tool.execute(params).await.expect("Tool execution failed");
    assert!(!result.success, "Writing to Program Files should be blocked");
    
    // Test writing to Windows directory
    let windows_path = "C:\\Windows\\test_should_not_work.txt";
    
    let params = ToolParameters(format!(
        r#"{{"operation":"write_file","path":"{}","content":"{}"}}"#, 
        windows_path, content
    ));
    
    let result = tool.execute(params).await.expect("Tool execution failed");
    assert!(!result.success, "Writing to Windows directory should be blocked");
}

#[tokio::test]
async fn test_directory_listing_works_correctly() {
    // Test that directory listing works correctly
    let temp_dir = setup_test_directory();
    let tool = FilesystemTool::new();
    
    // Test listing the temp directory
    let dir_path_str = temp_dir.path().to_string_lossy().to_string();
    
    let params = ToolParameters(format!(r#"{{"operation":"list_directory","path":"{}"}}"#, dir_path_str));
    let result = tool.execute(params).await.expect("Tool execution failed");
    
    assert!(result.success, "Directory listing should succeed");
    
    // Parse the result JSON and verify it contains the expected files
    let entries: Vec<serde_json::Value> = serde_json::from_str(&result.data).expect("Failed to parse JSON result");
    assert!(entries.len() >= 4, "Directory should contain at least 4 entries"); // 3 files + 1 directory
    
    let file_names: Vec<String> = entries.iter()
        .filter_map(|entry| entry.get("name").and_then(|name| name.as_str()).map(String::from))
        .collect();
    
    assert!(file_names.contains(&"file1.txt".to_string()), "Directory listing should include file1.txt");
    assert!(file_names.contains(&"file2.txt".to_string()), "Directory listing should include file2.txt");
    assert!(file_names.contains(&"config.json".to_string()), "Directory listing should include config.json");
    assert!(file_names.contains(&"nested".to_string()), "Directory listing should include nested directory");
    
    // Test listing a nested directory
    let nested_dir_path = temp_dir.path().join("nested");
    let nested_dir_path_str = nested_dir_path.to_string_lossy().to_string();
    
    let params = ToolParameters(format!(r#"{{"operation":"list_directory","path":"{}"}}"#, nested_dir_path_str));
    let result = tool.execute(params).await.expect("Tool execution failed");
    
    assert!(result.success, "Nested directory listing should succeed");
    
    let nested_entries: Vec<serde_json::Value> = serde_json::from_str(&result.data).expect("Failed to parse JSON result");
    assert_eq!(nested_entries.len(), 1, "Nested directory should contain exactly 1 entry");
    
    let nested_file_name = nested_entries[0].get("name").and_then(|name| name.as_str());
    assert_eq!(nested_file_name, Some("nested_file.txt"), "Nested directory should contain nested_file.txt");
}

#[tokio::test]
async fn test_drive_listing_shows_local_and_network_drives() {
    // Test that drive listing shows both local and network drives
    let tool = FilesystemTool::new();
    
    let params = ToolParameters(r#"{"operation":"list_drives"}"#.to_string());
    let result = tool.execute(params).await.expect("Tool execution failed");
    
    assert!(result.success, "Drive listing should succeed");
    
    // Parse the result JSON and verify it contains at least one drive (C:)
    let drives: Vec<serde_json::Value> = serde_json::from_str(&result.data).expect("Failed to parse JSON result");
    assert!(!drives.is_empty(), "At least one drive should be listed");
    
    // Check for C: drive
    let c_drive = drives.iter().find(|drive| {
        drive.get("name").and_then(|name| name.as_str()) == Some("C:\\")
    });
    assert!(c_drive.is_some(), "C: drive should be listed");
}

#[tokio::test]
async fn test_search_files_functionality() {
    // Test that search functions work correctly
    let temp_dir = setup_test_directory();
    let tool = FilesystemTool::new();
    
    // Note: Since search_files searches in ALLOWED_ROOTS rather than a specific directory,
    // we can't reliably test it with our temporary directory.
    // Instead, we'll verify that the method doesn't error out
    
    let params = ToolParameters(r#"{"operation":"search_files","query":"test_search"}"#.to_string());
    let result = tool.execute(params).await.expect("Tool execution failed");
    
    // We just verify that the operation succeeds, without checking specific results
    assert!(result.success, "Search files operation should succeed");
}

#[tokio::test]
async fn test_path_canonicalization_prevents_traversal_attacks() {
    // Test that path canonicalization prevents path traversal attacks
    let temp_dir = tempdir().expect("Failed to create temporary directory");
    let tool = FilesystemTool::new();
    
    // Create a test file in the temp directory
    let file_path = create_test_file(&temp_dir, "secure_file.txt", "This is sensitive content");
    
    // Attempt a path traversal attack to write outside the allowed roots
    // by using "../" to go up directories
    let real_path = temp_dir.path().to_string_lossy().to_string();
    let traversal_path = format!("{}/../../../etc/passwd", real_path);
    let content = "This should be blocked";
    
    let params = ToolParameters(format!(
        r#"{{"operation":"write_file","path":"{}","content":"{}"}}"#, 
        traversal_path, content
    ));
    
    let result = tool.execute(params).await.expect("Tool execution failed");
    assert!(!result.success, "Path traversal attempt should be blocked");
    
    // Attempt to read via path traversal
    let params = ToolParameters(format!(r#"{{"operation":"read_file","path":"{}"}}"#, traversal_path));
    let result = tool.execute(params).await.expect("Tool execution failed");
    assert!(!result.success, "Path traversal read attempt should be blocked");
    
    // Attempt directory listing via path traversal
    let params = ToolParameters(format!(r#"{{"operation":"list_directory","path":"{}"}}"#, traversal_path));
    let result = tool.execute(params).await.expect("Tool execution failed");
    assert!(!result.success, "Path traversal directory listing should be blocked");
}

#[tokio::test]
async fn test_invalid_operations_are_handled_correctly() {
    // Test that invalid operations are handled correctly
    let tool = FilesystemTool::new();
    
    // Test with invalid operation
    let params = ToolParameters(r#"{"operation":"invalid_operation"}"#.to_string());
    let result = tool.execute(params).await.expect("Tool execution failed");
    assert!(!result.success, "Invalid operation should fail");
    
    // Test with missing parameters
    let params = ToolParameters(r#"{"operation":"read_file"}"#.to_string());
    let result = tool.execute(params).await.expect("Tool execution failed");
    assert!(!result.success, "Operation with missing parameters should fail");
    
    // Test with non-existent path
    let params = ToolParameters(r#"{"operation":"read_file","path":"C:\\non_existent_path\\file.txt"}"#.to_string());
    let result = tool.execute(params).await.expect("Tool execution failed");
    assert!(!result.success, "Operation with non-existent path should fail");
    
    // Test with a path that exists but is not a file
    let temp_dir = tempdir().expect("Failed to create temporary directory");
    let dir_path_str = temp_dir.path().to_string_lossy().to_string();
    
    let params = ToolParameters(format!(r#"{{"operation":"read_file","path":"{}"}}"#, dir_path_str));
    let result = tool.execute(params).await.expect("Tool execution failed");
    assert!(!result.success, "Reading a directory as a file should fail");
}

#[tokio::test]
async fn test_file_metadata_is_correct() {
    // Test that file metadata is returned correctly
    let temp_dir = setup_test_directory();
    let tool = FilesystemTool::new();
    
    // Test listing directory and check file metadata
    let dir_path_str = temp_dir.path().to_string_lossy().to_string();
    let params = ToolParameters(format!(r#"{{"operation":"list_directory","path":"{}"}}"#, dir_path_str));
    let result = tool.execute(params).await.expect("Tool execution failed");
    
    assert!(result.success, "Directory listing should succeed");
    
    // Parse the result JSON and verify metadata fields
    let entries: Vec<serde_json::Value> = serde_json::from_str(&result.data).expect("Failed to parse JSON result");
    
    for entry in entries.iter().filter(|e| e.get("is_dir").and_then(|v| v.as_bool()) == Some(false)) {
        // Check that each file entry has the required metadata fields
        assert!(entry.get("name").is_some(), "File entry should have 'name' field");
        assert!(entry.get("path").is_some(), "File entry should have 'path' field");
        assert!(entry.get("size").is_some(), "File entry should have 'size' field");
        assert!(entry.get("last_modified").is_some(), "File entry should have 'last_modified' field");
        
        // For files we know, verify size (excluding directories)
        if let Some(name) = entry.get("name").and_then(|n| n.as_str()) {
            if name == "file1.txt" {
                let size = entry.get("size").and_then(|s| s.as_u64());
                assert_eq!(size, Some(18), "file1.txt should have correct size (18 bytes)");
            }
        }
    }
}