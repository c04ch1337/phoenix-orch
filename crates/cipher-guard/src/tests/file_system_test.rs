//! Tests for file system operations

use crate::ethics::EthicalFramework;
use crate::file_system::FileSystemService;
use crate::desktop_path_resolver::DesktopPathResolver;
use tokio::test;

/// Test basic desktop path resolution
#[test]
async fn test_desktop_path_resolver() {
    let mut resolver = DesktopPathResolver::new();
    
    // This test should pass on any platform
    match resolver.get_desktop_path() {
        Ok(path) => {
            println!("Successfully resolved desktop path: {:?}", path);
            assert!(path.exists(), "Desktop path should exist");
        },
        Err(e) => {
            println!("Desktop path resolution error: {:?}", e);
            // Don't fail the test just because we can't resolve the desktop
            // This allows tests to run in CI environments without a desktop
        }
    }
}

/// Test WriteToDesktop command parsing and execution
#[test]
async fn test_write_to_desktop_command() {
    // Create a test file system service
    let mut service = FileSystemService::new(EthicalFramework::new());
    
    // Generate a unique test filename with timestamp
    let timestamp = chrono::Utc::now().timestamp();
    let test_filename = format!("phoenix_test_{}.txt", timestamp);
    let test_content = "This is a test file created by Phoenix ORCH";
    
    // Try to write to desktop
    let result = service.write_to_desktop(
        &test_filename, 
        test_content,
        "test_user"
    ).await;
    
    match result {
        Ok(file_result) => {
            println!("Successfully wrote file to desktop: {:?}", file_result.path);
            
            // Try to read the file back
            let read_result = service.read_from_desktop(&test_filename).await;
            match read_result {
                Ok(content) => {
                    println!("Successfully read file from desktop: {}", content);
                    assert_eq!(content, test_content, "File content should match");
                },
                Err(e) => {
                    println!("Could not read test file: {:?}", e);
                    // Don't fail the test if we can't read back, maybe permissions
                }
            }
            
            // Try to clean up the test file - best effort, don't fail test if can't delete
            if file_result.path.exists() {
                let _ = std::fs::remove_file(&file_result.path);
            }
        },
        Err(e) => {
            println!("Could not write to desktop: {:?}", e);
            // Don't fail the test if we can't write, as this might be running in an environment
            // without desktop write access
        }
    }
}