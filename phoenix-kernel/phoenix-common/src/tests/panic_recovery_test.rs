//! Tests for panic recovery in Tokio tasks
//!
//! This file contains tests that demonstrate how our panic recovery system
//! works for Tokio tasks, ensuring that panics are caught and logged properly.

use crate::task::{spawn_monitored, spawn_recover, spawn_with_retry};
use std::sync::{Arc, atomic::{AtomicBool, AtomicU32, Ordering}};
use std::time::Duration;
use tokio::time::sleep;

/// Test that a task with a panic is properly caught and doesn't bring down the process
#[tokio::test]
async fn test_basic_panic_recovery() {
    let completed = Arc::new(AtomicBool::new(false));
    let completed_clone = completed.clone();
    
    // This task will panic
    let handle = spawn_recover("basic_panic_test", async move {
        // Do some work before panicking
        sleep(Duration::from_millis(50)).await;
        
        // This will panic
        panic!("Intentional test panic");
        
        // This is unreachable
        #[allow(unreachable_code)]
        {
            completed_clone.store(true, Ordering::SeqCst);
            "Unreachable result"
        }
    });
    
    // We can still await the handle, which will give us an error result
    let result = handle.await.unwrap();
    
    // The task should have failed with a panic
    assert!(result.is_err());
    
    // The completed flag should not have been set since the panic occurred before that code
    assert_eq!(completed.load(Ordering::SeqCst), false);
}

/// Test that spawn_monitored properly handles panics
#[tokio::test]
async fn test_monitored_task_panic() {
    let call_count = Arc::new(AtomicU32::new(0));
    let call_count_clone = call_count.clone();

    // Spawn a task that will increment counter then panic
    spawn_monitored("monitored_panic_test", async move {
        call_count_clone.fetch_add(1, Ordering::SeqCst);
        
        // This will panic but won't crash the test
        panic!("Intentional panic in monitored task");
    });
    
    // Give the task time to execute
    sleep(Duration::from_millis(100)).await;
    
    // The counter should have been incremented before the panic
    assert_eq!(call_count.load(Ordering::SeqCst), 1);
}

/// Test that retry logic works with panicking tasks
#[tokio::test]
async fn test_retry_with_panic() {
    let attempt_counter = Arc::new(AtomicU32::new(0));
    let attempt_counter_clone = attempt_counter.clone();
    
    // This will retry a task that fails on the first 2 attempts
    let handle = spawn_with_retry(
        "retry_panic_test",
        move || {
            let counter = attempt_counter_clone.clone();
            async move {
                let attempt = counter.fetch_add(1, Ordering::SeqCst);
                
                // First two attempts will panic
                if attempt < 2 {
                    panic!("Intentional panic on attempt {}", attempt);
                }
                
                // Third attempt succeeds
                format!("Success on attempt {}", attempt)
            }
        },
        5,      // Max retries
        50,     // Starting backoff in ms
    );
    
    // We should eventually get a successful result
    let result = handle.await.unwrap();
    assert!(result.is_ok());
    
    // The task should have been attempted 3 times (initial + 2 retries)
    assert_eq!(attempt_counter.load(Ordering::SeqCst), 3);
    
    // The result should contain our success message
    let message = result.unwrap();
    assert_eq!(message, "Success on attempt 2");
}

/// Test that nested async tasks with panics are handled properly
#[tokio::test]
async fn test_nested_async_panic_recovery() {
    // This counter tracks which sections of code executed
    let execution_tracker = Arc::new(AtomicU32::new(0));
    let tracker_clone = execution_tracker.clone();
    
    // Outer task that contains inner tasks, some of which panic
    let handle = spawn_recover("outer_task", async move {
        tracker_clone.fetch_add(1, Ordering::SeqCst); // Mark outer task started
        
        // Spawn an inner task that completes successfully
        let inner_tracker = tracker_clone.clone();
        let inner_handle = spawn_recover("inner_success_task", async move {
            inner_tracker.fetch_add(10, Ordering::SeqCst); // Mark inner success task
            "Inner success result"
        }).await.unwrap();
        
        // This inner task should succeed
        assert!(inner_handle.is_ok());
        
        // Spawn an inner task that panics
        let inner_tracker = tracker_clone.clone();
        let inner_panic_handle = spawn_recover("inner_panic_task", async move {
            inner_tracker.fetch_add(100, Ordering::SeqCst); // Mark inner panic task started
            panic!("Inner task panic");
            #[allow(unreachable_code)]
            "Inner unreachable result"
        }).await.unwrap();
        
        // This inner task should fail with a panic
        assert!(inner_panic_handle.is_err());
        
        tracker_clone.fetch_add(1000, Ordering::SeqCst); // Mark outer task completed
        "Outer task result"
    });
    
    // The outer task should complete successfully
    let result = handle.await.unwrap();
    assert!(result.is_ok());
    
    // Check which parts of the code executed based on our counter
    let execution_value = execution_tracker.load(Ordering::SeqCst);
    assert_eq!(execution_value, 1111); // 1 (outer start) + 10 (inner success) + 100 (inner panic start) + 1000 (outer completion)
}