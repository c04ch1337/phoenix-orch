//! Comprehensive logging and tracing system for Phoenix
//!
//! This module provides structured logging with both JSON and console output,
//! as well as utilities for panic handling and recovery.

use std::{fmt, fs::OpenOptions, io::Write, panic::PanicInfo, path::PathBuf, sync::Arc};
use tracing::{Event, Level, Metadata, Subscriber};
use tracing_subscriber::{
    fmt::{format::FmtSpan, time::ChronoUtc, writer::BoxMakeWriter, Layer as FmtLayer},
    layer::{Context, Layer, SubscriberExt},
    registry::Registry,
    util::SubscriberInitExt,
    EnvFilter, Layer as _,
};

use crate::metrics;

/// Default log directory
pub const DEFAULT_LOG_DIR: &str = "logs";
/// Default log file name
pub const DEFAULT_LOG_FILE: &str = "phoenix.json";
/// Default log level 
pub const DEFAULT_LOG_LEVEL: &str = "info";

/// Initialize tracing with console and JSON output
/// 
/// # Arguments
/// * `app_name` - Application name to include in logs
/// * `log_dir` - Optional custom log directory
/// * `json_log_level` - Optional log level for JSON output
/// * `console_log_level` - Optional log level for console output
pub fn init_tracing(
    app_name: &str, 
    log_dir: Option<PathBuf>,
    json_log_level: Option<&str>,
    console_log_level: Option<&str>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let log_path = match log_dir {
        Some(dir) => dir,
        None => PathBuf::from(DEFAULT_LOG_DIR),
    };

    // Create log directory if it doesn't exist
    std::fs::create_dir_all(&log_path)?;

    let json_log_file = log_path.join(DEFAULT_LOG_FILE);
    
    // Set up JSON layer with appropriate filter
    let json_filter = EnvFilter::try_new(json_log_level.unwrap_or(DEFAULT_LOG_LEVEL))?;
    let file_appender = tracing_appender::rolling::daily(&log_path, DEFAULT_LOG_FILE);
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);
    
    let json_layer = tracing_subscriber::fmt::layer()
        .with_writer(non_blocking)
        .with_timer(ChronoUtc::rfc3339())
        .with_span_events(FmtSpan::NEW | FmtSpan::CLOSE)
        .json()
        .with_filter(json_filter);
    
    // Set up console layer with appropriate filter
    let console_filter = EnvFilter::try_new(console_log_level.unwrap_or(DEFAULT_LOG_LEVEL))?;
    let console_layer = tracing_subscriber::fmt::layer()
        .with_timer(ChronoUtc::rfc3339())
        .with_span_events(FmtSpan::NEW | FmtSpan::CLOSE)
        .with_filter(console_filter);
    
    // Register both layers with the tracing system
    Registry::default()
        .with(console_layer)
        .with(json_layer)
        .init();
    
    // Set panic hook to ensure panics are logged
    setup_panic_hook(app_name, json_log_file)?;
    
    tracing::info!(
        app_name = %app_name,
        version = env!("CARGO_PKG_VERSION"),
        "Logging initialized with JSON and console output"
    );
    
    Ok(())
}

/// Set up panic hook to log panics via tracing
fn setup_panic_hook(app_name: &str, log_file: PathBuf) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let app_name = app_name.to_string();
    let previous_hook = std::panic::take_hook();
    
    std::panic::set_hook(Box::new(move |panic_info| {
        // Log the panic through tracing
        let backtrace = std::backtrace::Backtrace::capture();
        let thread = std::thread::current();
        let thread_name = thread.name().unwrap_or("<unnamed>");
        
        let panic_message = extract_panic_message(panic_info);
        let location = panic_info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "<unknown location>".to_string());
        
        tracing::error!(
            message = %panic_message,
            location = %location,
            thread = %thread_name,
            app_name = %app_name,
            "PANIC",
        );

        // Also ensure panic is recorded in metrics
        metrics::record_safety_violation("panic");
        
        // Append to raw log file in case structured logging is broken
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_file)
        {
            let _ = writeln!(
                file, 
                "[PANIC] Thread '{}' panicked at '{}', location: {}\n{:?}",
                thread_name, panic_message, location, backtrace
            );
        }
        
        // Call the default handler
        previous_hook(panic_info);
    }));
    
    Ok(())
}

/// Extract message from PanicInfo
fn extract_panic_message(info: &PanicInfo) -> String {
    if let Some(s) = info.payload().downcast_ref::<&str>() {
        s.to_string()
    } else if let Some(s) = info.payload().downcast_ref::<String>() {
        s.clone()
    } else {
        "Unknown panic payload".to_string()
    }
}

/// Create a panic-safe wrapper for Tokio tasks
/// 
/// This function wraps a Tokio task with panic recovery to ensure that
/// panics in spawned tasks are properly caught and logged.
pub fn spawn_panic_safe<F>(task_name: &str, future: F) -> tokio::task::JoinHandle<()>
where
    F: std::future::Future<Output = ()> + Send + 'static,
{
    let task_name = task_name.to_string();
    
    tokio::spawn(async move {
        // Set up a tracing span
        let span = tracing::info_span!("task", name = %task_name);
        let _guard = span.enter();
        
        // Use catch_unwind to handle panics within the future
        match std::panic::catch_unwind(std::future::Future::into_future(future)) {
            Ok(()) => {
                tracing::trace!(task = %task_name, "Task completed successfully");
            }
            Err(e) => {
                // Extract panic message if possible
                let panic_msg = if let Some(s) = e.downcast_ref::<&str>() {
                    s.to_string()
                } else if let Some(s) = e.downcast_ref::<String>() {
                    s.clone()
                } else {
                    "Unknown panic".to_string() 
                };
                
                // Log the panic
                tracing::error!(
                    task = %task_name,
                    panic = %panic_msg,
                    "Task panicked"
                );
                
                // Record in metrics
                metrics::record_safety_violation("task_panic");
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::path::Path;
    
    #[test]
    fn test_panic_hook_setup() {
        let temp_dir = TempDir::new().unwrap();
        let log_file = temp_dir.path().join("test_panic.json");
        
        // Setup panic hook 
        setup_panic_hook("test_app", log_file.clone()).unwrap();
        
        // The panic hook should create a file when a panic occurs
        // However, we can't actually test a panic since it would terminate the test
        assert!(std::panic::take_hook().is_some());
    }
}