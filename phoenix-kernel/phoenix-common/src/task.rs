//! Task management utilities with panic recovery
//!
//! This module provides utilities for spawning Tokio tasks with
//! built-in panic recovery to ensure system stability.

use crate::logging;
use crate::metrics;
use std::{fmt, future::Future, panic::AssertUnwindSafe, pin::Pin};
use tokio::task::JoinHandle;
use tracing::{error, info, instrument, trace};

/// Error from a panicked task
#[derive(Debug)]
pub enum TaskError {
    /// Task panicked
    Panic(String),
    /// Task join error
    JoinError(tokio::task::JoinError),
}

impl fmt::Display for TaskError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Panic(msg) => write!(f, "Task panicked: {}", msg),
            Self::JoinError(err) => write!(f, "Task join error: {}", err),
        }
    }
}

impl std::error::Error for TaskError {}

/// Recoverable task result
pub type TaskResult<T> = Result<T, TaskError>;

/// Spawn a task with panic recovery
///
/// This function wraps any async task with panic recovery, ensuring that
/// all panics are properly logged and don't silently crash the application.
///
/// # Arguments
/// * `name` - Task name for logging
/// * `fut` - Future to execute
///
/// # Returns
/// A JoinHandle that returns TaskResult with either the successful value
/// or a TaskError if the task panicked.
///
/// # Example
/// ```
/// use phoenix_common::task::spawn_recover;
///
/// # async fn example() {
/// let handle = spawn_recover("my_task", async {
///     // Task work here
///     42
/// });
/// 
/// match handle.await.unwrap() {
///     Ok(value) => println!("Task returned: {}", value),
///     Err(err) => eprintln!("Task error: {}", err),
/// }
/// # }
/// ```
#[instrument(skip(fut), fields(task_name = %name))]
pub fn spawn_recover<F, T>(name: &str, fut: F) -> JoinHandle<TaskResult<T>>
where
    F: Future<Output = T> + Send + 'static,
    T: Send + 'static,
{
    let task_name = name.to_string();
    
    tokio::spawn(async move {
        trace!(task_name = %task_name, "Starting task");
        
        // AssertUnwindSafe is used here because we're capturing and handling the panic
        let result = std::panic::catch_unwind(AssertUnwindSafe(|| async move {
            let result = fut.await;
            trace!(task_name = %task_name, "Task completed successfully");
            result
        })).await;
        
        match result {
            Ok(value) => {
                metrics::record_memory_operation(&format!("task_{}", task_name), "success");
                Ok(value)
            }
            Err(panic) => {
                // Extract panic message 
                let panic_msg = if let Some(s) = panic.downcast_ref::<&str>() {
                    s.to_string()
                } else if let Some(s) = panic.downcast_ref::<String>() {
                    s.clone()
                } else {
                    "Unknown panic".to_string()
                };
                
                // Log the panic
                error!(
                    task_name = %task_name,
                    panic_message = %panic_msg,
                    "Task panicked"
                );
                
                // Record metrics
                metrics::record_memory_operation(&format!("task_{}", task_name), "panic");
                metrics::record_safety_violation("task_panic");
                
                Err(TaskError::Panic(panic_msg))
            }
        }
    })
}

/// Spawn a task without expecting a result, but with panic recovery and logging
///
/// This function is ideal for background tasks where you don't need to wait for 
/// the result but still want proper panic handling.
///
/// # Arguments
/// * `name` - Task name for logging
/// * `fut` - Future to execute
///
/// # Example
/// ```
/// use phoenix_common::task::spawn_monitored;
///
/// # async fn example() {
/// spawn_monitored("background_task", async {
///     // Background work here
///     loop {
///         tokio::time::sleep(std::time::Duration::from_secs(10)).await;
///         // Do periodic work
///     }
/// });
/// # }
/// ```
#[instrument(skip(fut), fields(task_name = %name))]
pub fn spawn_monitored<F>(name: &str, fut: F) -> JoinHandle<()> 
where 
    F: Future<Output = ()> + Send + 'static,
{
    let task_name = name.to_string();
    
    tokio::spawn(async move {
        info!(task_name = %task_name, "Starting monitored task");
        
        // Run with catch_unwind for panic recovery
        match std::panic::catch_unwind(AssertUnwindSafe(|| async { fut.await })).await {
            Ok(()) => {
                trace!(task_name = %task_name, "Monitored task completed successfully");
            }
            Err(panic) => {
                // Extract panic message
                let panic_msg = if let Some(s) = panic.downcast_ref::<&str>() {
                    s.to_string()
                } else if let Some(s) = panic.downcast_ref::<String>() {
                    s.clone()
                } else {
                    "Unknown panic".to_string()
                };
                
                // Log the panic
                error!(
                    task_name = %task_name,
                    panic_message = %panic_msg,
                    "Monitored task panicked"
                );
                
                // Record metrics
                metrics::record_memory_operation(&format!("task_{}", task_name), "panic");
                metrics::record_safety_violation("task_panic");
            }
        }
    })
}

/// Wrapper function to retry a task that panicked
///
/// # Arguments
/// * `name` - Task name for logging
/// * `fut_factory` - Function that creates the future to execute
/// * `max_retries` - Maximum number of retries (0 means no retries)
/// * `backoff_ms` - Initial backoff time in milliseconds (doubles after each retry)
///
/// # Returns
/// A JoinHandle that returns TaskResult with either the successful value or a TaskError
pub fn spawn_with_retry<F, FF, T>(
    name: &str, 
    fut_factory: FF, 
    max_retries: u32,
    backoff_ms: u64,
) -> JoinHandle<TaskResult<T>>
where
    F: Future<Output = T> + Send + 'static,
    FF: Fn() -> F + Send + Clone + 'static,
    T: Send + 'static,
{
    let task_name = name.to_string();
    let factory = fut_factory.clone();
    
    tokio::spawn(async move {
        let mut retries = 0;
        let mut backoff = backoff_ms;
        
        loop {
            match spawn_recover(&task_name, factory()).await {
                Ok(Ok(result)) => return Ok(result),
                Ok(Err(err)) => {
                    if retries >= max_retries {
                        error!(
                            task_name = %task_name,
                            error = %err,
                            retries = retries,
                            "Task failed after maximum retries"
                        );
                        return Err(err);
                    }

                    // Exponential backoff
                    retries += 1;
                    error!(
                        task_name = %task_name,
                        error = %err,
                        retry = retries,
                        backoff_ms = backoff,
                        "Task failed, retrying after backoff"
                    );
                    
                    tokio::time::sleep(std::time::Duration::from_millis(backoff)).await;
                    backoff *= 2; // Exponential backoff
                }
                Err(join_err) => {
                    return Err(TaskError::JoinError(join_err));
                }
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::Arc;

    #[tokio::test]
    async fn test_spawn_recover_success() {
        let result = spawn_recover("test_success", async {
            42
        }).await.unwrap();
        
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
    }

    #[tokio::test]
    async fn test_spawn_recover_panic() {
        let result = spawn_recover("test_panic", async {
            panic!("Intentional test panic");
            #[allow(unreachable_code)]
            42
        }).await.unwrap();
        
        assert!(result.is_err());
        match result {
            Err(TaskError::Panic(msg)) => {
                assert!(msg.contains("Intentional test panic"));
            }
            _ => panic!("Expected TaskError::Panic"),
        }
    }

    #[tokio::test]
    async fn test_spawn_with_retry() {
        let counter = Arc::new(AtomicU32::new(0));
        let counter_clone = counter.clone();
        
        let result = spawn_with_retry(
            "test_retry",
            move || {
                let count = counter_clone.fetch_add(1, Ordering::SeqCst);
                async move {
                    if count < 2 {
                        panic!("Intentional panic for retry");
                    }
                    count + 1
                }
            },
            5,
            10,
        ).await.unwrap();
        
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 3);
        assert_eq!(counter.load(Ordering::SeqCst), 3);
    }
}