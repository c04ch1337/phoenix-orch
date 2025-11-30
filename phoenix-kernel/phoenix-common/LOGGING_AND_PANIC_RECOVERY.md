# Phoenix Logging and Panic Recovery System

This document explains the comprehensive logging and panic recovery system implemented for the Phoenix AGI Kernel.

## Table of Contents

1. [Overview](#overview)
2. [Logging Infrastructure](#logging-infrastructure)
3. [Panic Recovery](#panic-recovery)
4. [Best Practices](#best-practices)
5. [Examples](#examples)
6. [Testing](#testing)

## Overview

The Phoenix logging and panic recovery system provides:

- **Structured logging** with both console and JSON outputs
- **Panic recovery** for all Tokio asynchronous tasks
- **Graceful error handling** to prevent silent failures
- **Context-rich logs** with spans, metrics, and metadata
- **Comprehensive telemetry** for system monitoring

The system is designed to ensure that no panics go unnoticed, all errors are properly logged, and the system can recover gracefully from unexpected failures.

## Logging Infrastructure

### Components

- `phoenix_common::logging`: Core logging module with tracing setup
- `tracing_subscriber`: Powers our structured logging with JSON and console outputs
- `metrics`: Prometheus-based metrics integrated with logs

### Configuration

To initialize the logging system in your application:

```rust
use phoenix_common::logging;
use std::path::PathBuf;

// Initialize logging with both console and JSON output
logging::init_tracing(
    "your-component-name", // Component/application name
    Some(PathBuf::from("logs")), // Log directory
    Some("debug"),  // JSON log level
    Some("info"),   // Console log level
).expect("Failed to initialize logging");
```

### Log Levels

- **error**: Critical issues requiring immediate attention
- **warn**: Concerning events that don't require immediate action
- **info**: Normal operational events
- **debug**: Detailed information for troubleshooting
- **trace**: Very detailed diagnostic information

### Using Spans

Spans allow you to group related logs and track context:

```rust
use tracing::{info, info_span, Instrument};

// Create and enter a span
let span = info_span!("operation_name", component = "component_name");
let _guard = span.enter();

// All logs within this scope will be associated with the span
info!(parameter = "value", "Operation starting");

// Or use .instrument() with async functions
async fn my_function() {
    info!("Inside function");
}

// Instrument the future
my_function()
    .instrument(info_span!("my_function_span"))
    .await;
```

## Panic Recovery

### Components

- `phoenix_common::task`: Task management with panic recovery
- Three main functions for different use cases:
  - `spawn_recover`: For tasks where you need the result
  - `spawn_monitored`: For background tasks (fire-and-forget)
  - `spawn_with_retry`: For tasks that should retry on failure

### Basic Panic Recovery

Instead of using `tokio::spawn` directly, use our recovery-enabled wrappers:

```rust
use phoenix_common::task::spawn_recover;

// Instead of tokio::spawn
let handle = spawn_recover("task_name", async {
    // Your async code here
    // If this panics, it will be caught and logged
    42
});

// You can still await the handle
match handle.await {
    Ok(Ok(result)) => println!("Task succeeded with result: {}", result),
    Ok(Err(err)) => println!("Task panicked: {}", err),
    Err(join_err) => println!("Join error: {}", join_err),
}
```

### Background Tasks

For tasks where you don't need the result:

```rust
use phoenix_common::task::spawn_monitored;

// Fire and forget with panic recovery
spawn_monitored("background_task", async {
    loop {
        // Long-running background work
        tokio::time::sleep(std::time::Duration::from_secs(10)).await;
        
        // If this panics, it won't bring down the system
        // The panic will be logged and the task will terminate
        perform_periodic_task().await;
    }
});
```

### Tasks with Retry

For tasks that should retry on failure:

```rust
use phoenix_common::task::spawn_with_retry;

let handle = spawn_with_retry(
    "retryable_task",
    || async {
        // This factory function is called for each retry attempt
        // If this panics, it will retry with backoff
        fetch_external_resource().await
    },
    5,     // Maximum 5 retries
    100,   // Initial backoff of 100ms (doubles for each retry)
);
```

## Best Practices

1. **Always use structured logging**:
   ```rust
   // Good
   info!(user_id = user.id, action = "login", "User logged in successfully");
   
   // Avoid
   info!("User {} logged in successfully", user.id);
   ```

2. **Use spans for operations**:
   ```rust
   let span = info_span!("request_handling", 
       request_id = %request.id,
       user_id = ?user.id,
   );
   async_operation().instrument(span).await;
   ```

3. **Use the appropriate spawn function**:
   - `spawn_recover`: When you need the result
   - `spawn_monitored`: For background tasks
   - `spawn_with_retry`: For operations that should retry on failure

4. **Include context in logs**:
   ```rust
   error!(
       error = %e,
       component = "database",
       operation = "query",
       "Database query failed"
   );
   ```

5. **Use specific task names**:
   ```rust
   // Good
   spawn_monitored("user_cache_refresh_task", async { /* ... */ });
   
   // Avoid
   spawn_monitored("task", async { /* ... */ });
   ```

## Examples

### Complete Example

```rust
use phoenix_common::{
    logging,
    task::{spawn_monitored, spawn_recover, spawn_with_retry},
    metrics,
};
use std::path::PathBuf;
use tracing::{debug, error, info, info_span, warn, Level};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    logging::init_tracing(
        "example-app",
        Some(PathBuf::from("logs")),
        Some("debug"),
        Some("info"),
    )?;
    
    // Create a span for the main function
    let span = info_span!("startup", app = "example");
    let _guard = span.enter();
    
    info!("Application starting");
    
    // Spawn a task with recovery
    let handle = spawn_recover("important_task", async {
        info!("Performing important work");
        
        // This could panic but would be caught
        let result = process_data().await?;
        
        info!(value = ?result, "Task completed successfully");
        Ok::<_, anyhow::Error>(result)
    });
    
    // Spawn a background task
    spawn_monitored("background_service", async {
        loop {
            debug!("Background service iteration");
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            
            if let Err(e) = perform_background_work().await {
                error!(error = %e, "Background work failed");
            }
        }
    });
    
    // Handle the result of our recoverable task
    match handle.await {
        Ok(Ok(result)) => {
            info!(result = ?result, "Main task completed successfully");
        }
        Ok(Err(e)) => {
            error!(error = %e, "Main task failed with error");
            metrics::record_safety_violation("task_error");
        }
        Err(e) => {
            error!(error = %e, "Task join error");
            metrics::record_safety_violation("join_error");
        }
    }
    
    info!("Application shutting down");
    Ok(())
}
```

## Testing

The system includes comprehensive test cases that demonstrate panic recovery:

- Basic panic recovery: `test_basic_panic_recovery`
- Monitored task panic: `test_monitored_task_panic`
- Retry with panics: `test_retry_with_panic`
- Nested async panic recovery: `test_nested_async_panic_recovery`

Run these tests with:

```bash
cargo test -p phoenix-common -- tests/panic_recovery_test
```

For additional examples of how the system works in practice, refer to:

- `phoenix-kernel/phoenix-common/src/examples/logging_example.rs`
- `phoenix-kernel/phoenix-common/src/tests/panic_recovery_test.rs`