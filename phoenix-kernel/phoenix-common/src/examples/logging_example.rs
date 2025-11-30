//! Example demonstrating the logging and panic recovery infrastructure
//!
//! This example shows how to:
//! 1. Initialize the logging system
//! 2. Use structured logging with spans
//! 3. Spawn recovery-enabled Tokio tasks
//! 4. Handle panics in tasks

use phoenix_common::{
    logging,
    task::{spawn_monitored, spawn_recover, spawn_with_retry},
};
use std::path::PathBuf;
use std::time::Duration;
use tracing::{debug, error, info, span, warn, Level};

/// Main function demonstrating the full logging and recovery system
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Initialize logging system
    logging::init_tracing(
        "example-app",           // App name
        Some(PathBuf::from("logs")), // Log directory
        Some("debug"),           // JSON log level
        Some("info"),            // Console log level
    )?;

    // Create a new tracing span for the entire operation
    let span = span!(Level::INFO, "main_process", app = "example");
    let _guard = span.enter();

    // Add some basic logs
    info!("Application started");
    debug!("Detailed configuration loaded");

    // Demonstrate structured logging with fields
    info!(
        user_id = 1234,
        component = "authentication",
        "User logged in successfully"
    );

    // Start some tasks with proper panic recovery
    
    // 1. Task that completes successfully
    let successful_task = spawn_recover("successful_task", async {
        info!("Working on successful task");
        
        // Do some work
        tokio::time::sleep(Duration::from_millis(100)).await;
        
        info!("Successfully completed the task");
        "Task result"
    });

    // 2. Monitored background task (we don't wait for its result)
    spawn_monitored("background_task", async {
        let span = span!(Level::INFO, "background_operation");
        let _guard = span.enter();

        info!("Starting background processing");
        
        // Simulate long-running background work
        for i in 0..3 {
            debug!(iteration = i, "Processing iteration");
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        
        info!("Background processing complete");
    });

    // 3. Task that will panic and be recovered
    let panicking_task = spawn_recover("panicking_task", async {
        warn!("About to enter dangerous code section");
        
        // Simulate some work before panic
        tokio::time::sleep(Duration::from_millis(50)).await;
        
        // This will panic, but our recovery system will handle it
        panic!("Intentional panic for demonstration");
        
        // This code is unreachable
        #[allow(unreachable_code)]
        {
            info!("This will never be logged");
            "Unreachable result"
        }
    });

    // 4. Task with retries
    let retry_task = spawn_with_retry(
        "retry_task",
        || async {
            // This is a factory function that creates a new future each retry
            static ATTEMPT: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
            let attempt = ATTEMPT.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            
            info!(attempt = attempt, "Starting retry attempt");
            
            // First two attempts will fail
            if attempt < 2 {
                panic!("Simulated failure for retry demonstration");
            }
            
            info!("Retry task succeeded");
            format!("Success on attempt {}", attempt)
        },
        5,      // Max 5 retries
        100,    // Start with 100ms backoff
    );

    // Wait for and print tasks results
    match successful_task.await? {
        Ok(result) => info!(result = %result, "Successful task completed"),
        Err(err) => error!(error = %err, "Successful task failed unexpectedly"),
    }

    // The panicking task will return an error, but it's contained and logged
    match panicking_task.await? {
        Ok(_) => info!("Panicking task completed (should not happen)"),
        Err(err) => info!(error = %err, "Panicking task failed as expected"),
    }

    // The retry task should eventually succeed
    match retry_task.await? {
        Ok(result) => info!(result = %result, "Retry task completed after attempts"),
        Err(err) => error!(error = %err, "Retry task failed despite retries"),
    }

    info!("Application shutting down");
    Ok(())
}