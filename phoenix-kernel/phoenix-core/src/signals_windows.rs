use std::sync::{atomic::{AtomicBool, Ordering}, Arc};
use tokio::sync::RwLock;
use tracing::{error, info, warn};
use windows::Win32::System::Console;
use windows::Win32::System::Threading;

use crate::system::{SystemState, SystemSnapshot, ComponentState};

/// Global shutdown flag
static SHUTDOWN_REQUESTED: AtomicBool = AtomicBool::new(false);
static EMERGENCY_SHUTDOWN: AtomicBool = AtomicBool::new(false);

/// Set up Windows-specific event handlers
pub fn setup_event_handlers() {
    // Handle Ctrl+C
    tokio::spawn(async move {
        unsafe {
            Console::SetConsoleCtrlHandler(Some(ctrl_handler), true).unwrap();
        }
    });
}

/// Windows console control handler
unsafe extern "system" fn ctrl_handler(ctrl_type: u32) -> windows::Win32::Foundation::BOOL {
    match ctrl_type {
        Console::CTRL_C_EVENT => {
            info!("Received Ctrl+C - initiating graceful shutdown");
            request_shutdown();
            windows::Win32::Foundation::TRUE
        }
        Console::CTRL_BREAK_EVENT => {
            warn!("Received Ctrl+Break - initiating emergency shutdown");
            emergency_shutdown();
            windows::Win32::Foundation::TRUE
        }
        _ => windows::Win32::Foundation::FALSE,
    }
}

/// Handle system events and monitor system state
pub fn handle_signals(state: Arc<RwLock<SystemState>>) -> anyhow::Result<()> {
    setup_event_handlers();
    Ok(())
}

/// Request graceful shutdown
pub fn request_shutdown() {
    SHUTDOWN_REQUESTED.store(true, Ordering::SeqCst);
}

/// Check if shutdown was requested
pub fn is_shutdown_requested() -> bool {
    SHUTDOWN_REQUESTED.load(Ordering::SeqCst)
}

/// Trigger emergency shutdown
pub fn emergency_shutdown() {
    EMERGENCY_SHUTDOWN.store(true, Ordering::SeqCst);
    request_shutdown();
}

/// Check if emergency shutdown was triggered
pub fn is_emergency_shutdown() -> bool {
    EMERGENCY_SHUTDOWN.load(Ordering::SeqCst)
}

/// Dump current system state
async fn dump_system_state() {
    info!("Starting system state dump");

    // Create state snapshot
    let snapshot = SystemSnapshot {
        timestamp: std::time::SystemTime::now(),
        components: vec![
            ComponentState {
                name: "core".to_string(),
                status: crate::system::types::ComponentStatus::Running,
            }
        ],
        memory: None,
        world_model: None,
    };

    // Save to disk
    if let Err(e) = snapshot.save().await {
        error!("Failed to dump system state: {}", e);
    }

    info!("System state dump completed");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shutdown_flags() {
        assert!(!is_shutdown_requested());
        assert!(!is_emergency_shutdown());

        request_shutdown();
        assert!(is_shutdown_requested());
        assert!(!is_emergency_shutdown());

        emergency_shutdown();
        assert!(is_shutdown_requested());
        assert!(is_emergency_shutdown());
    }
}