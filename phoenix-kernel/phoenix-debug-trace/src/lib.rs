//! Real-time debugging and tracing system for the Phoenix AGI Kernel
//!
//! This crate provides comprehensive debugging and tracing capabilities,
//! including real-time monitoring, event logging, and diagnostic tools.

#![forbid(unsafe_code)]
#![deny(missing_docs)]

use phoenix_common::{error::PhoenixResult, types::PhoenixId};

use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, SystemTime},
};
use tokio::io::AsyncWriteExt;
use tokio::sync::RwLock;
use tracing::Level;

/// Core debug trace implementation
///
/// In the resurrection phase we intentionally keep this tracer in-process only,
/// without wiring it to OpenTelemetry exporters. This avoids bringing in
/// additional complexity and native dependencies while still providing rich
/// structured trace data for debugging and tests.
pub struct DebugTrace {
    /// Active traces
    traces: Arc<RwLock<HashMap<String, Trace>>>,
    /// Event history
    history: Arc<RwLock<Vec<TraceEvent>>>,
    /// Trace subscribers
    subscribers: Arc<RwLock<Vec<Box<dyn TraceSubscriber>>>>,
}

impl std::fmt::Debug for DebugTrace {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DebugTrace")
            .field("traces", &"<HashMap<String, Trace>>")
            .field("history", &"<Vec<TraceEvent>>")
            .field("subscribers", &"<Vec<Box<dyn TraceSubscriber>>>")
            .finish()
    }
}

/// A debug trace.
///
/// Each trace represents a logical sequence of events that can be used to
/// understand system behavior, debug issues, or verify correctness.
#[derive(Debug)]
pub struct Trace {
    /// Trace ID
    pub id: PhoenixId,
    /// Trace type
    pub type_: TraceType,
    /// Trace status
    pub status: TraceStatus,
    /// Start time
    pub started: SystemTime,
    /// Events
    pub events: Vec<TraceEvent>,
}

/// Types of traces.
#[derive(Debug, Clone)]
pub enum TraceType {
    /// Component trace
    Component {
        /// Component name
        name: String,
        /// Component type
        type_: String,
    },
    /// Process trace
    Process {
        /// Process ID
        pid: u32,
        /// Process name
        name: String,
    },
    /// Memory trace
    Memory {
        /// Memory region
        region: String,
        /// Access type
        access: MemoryAccess,
    },
    /// Network trace
    Network {
        /// Protocol
        protocol: String,
        /// Remote endpoint
        endpoint: String,
    },
}

/// Memory access types.
#[derive(Debug, Clone)]
pub enum MemoryAccess {
    /// Read access
    Read,
    /// Write access
    Write,
    /// Execute access
    Execute,
}

/// Trace status.
#[derive(Debug, Clone)]
pub enum TraceStatus {
    /// Trace is active
    Active,
    /// Trace is paused
    Paused,
    /// Trace has completed
    Completed {
        /// End time
        ended: SystemTime,
        /// Duration
        duration: Duration,
    },
    /// Trace has failed
    Failed {
        /// Error message
        error: String,
        /// Failure time
        failed: SystemTime,
    },
}

/// A trace event.
#[derive(Debug, Clone)]
pub struct TraceEvent {
    /// Event ID
    pub id: PhoenixId,
    /// Event type
    pub type_: EventType,
    /// Event level
    pub level: Level,
    /// Event message
    pub message: String,
    /// Event metadata
    pub metadata: HashMap<String, String>,
    /// Timestamp
    pub timestamp: SystemTime,
}

/// Types of trace events.
#[derive(Debug, Clone)]
pub enum EventType {
    /// Log message
    Log,
    /// Metric update
    Metric,
    /// State change
    State,
    /// Error condition
    Error,
}

/// Trace subscriber interface
#[async_trait::async_trait]
pub trait TraceSubscriber: Send + Sync {
    /// Handle a trace event
    async fn handle_event(&self, event: TraceEvent) -> PhoenixResult<()>;
}

impl DebugTrace {
    /// Create a new debug trace system.
    ///
    /// This implementation keeps all traces in-memory and does not depend on
    /// external telemetry backends. It is sufficient for kernel-level debugging
    /// and tests, and can later be extended with exporter hooks if needed.
    pub async fn new() -> PhoenixResult<Self> {
        Ok(Self {
            traces: Arc::new(RwLock::new(HashMap::new())),
            history: Arc::new(RwLock::new(Vec::new())),
            subscribers: Arc::new(RwLock::new(Vec::new())),
        })
    }

    /// Start a new trace
    pub async fn start_trace(&self, type_: TraceType) -> PhoenixResult<PhoenixId> {
        let id = PhoenixId([0; 32]);

        let trace = Trace {
            id: id.clone(),
            type_,
            status: TraceStatus::Active,
            started: SystemTime::now(),
            events: Vec::new(),
        };

        let mut traces = self.traces.write().await;
        traces.insert(id.to_string(), trace);

        Ok(id)
    }

    /// Record a trace event
    pub async fn record_event(
        &self,
        trace_id: &PhoenixId,
        type_: EventType,
        level: Level,
        message: String,
        metadata: HashMap<String, String>,
    ) -> PhoenixResult<()> {
        let event = TraceEvent {
            id: PhoenixId([0; 32]),
            type_,
            level,
            message,
            metadata,
            timestamp: SystemTime::now(),
        };

        // Add to trace
        let mut traces = self.traces.write().await;
        if let Some(trace) = traces.get_mut(&trace_id.to_string()) {
            trace.events.push(event.clone());
        }

        // Add to history
        let mut history = self.history.write().await;
        history.push(event.clone());

        // Notify subscribers
        let subscribers = self.subscribers.read().await;
        for subscriber in subscribers.iter() {
            subscriber.handle_event(event.clone()).await?;
        }

        Ok(())
    }

    /// Add a trace subscriber
    pub async fn add_subscriber<S: TraceSubscriber + 'static>(
        &self,
        subscriber: S,
    ) -> PhoenixResult<()> {
        let mut subscribers = self.subscribers.write().await;
        subscribers.push(Box::new(subscriber));
        Ok(())
    }

    /// Get trace history
    pub async fn get_history(&self) -> PhoenixResult<Vec<TraceEvent>> {
        Ok(self.history.read().await.clone())
    }

    /// Complete a trace
    pub async fn complete_trace(&self, id: &PhoenixId) -> PhoenixResult<()> {
        let mut traces = self.traces.write().await;
        if let Some(trace) = traces.get_mut(&id.to_string()) {
            let now = SystemTime::now();
            let duration = match now.duration_since(trace.started) {
                Ok(d) => d,
                Err(_) => Duration::from_secs(0),
            };
            trace.status = TraceStatus::Completed {
                ended: now,
                duration,
            };
        }
        Ok(())
    }
}

/// File-based trace subscriber
pub struct FileSubscriber {
    /// Output file path
    path: std::path::PathBuf,
}

impl FileSubscriber {
    /// Create a new file subscriber
    pub fn new<P: Into<std::path::PathBuf>>(path: P) -> Self {
        Self { path: path.into() }
    }
}

#[async_trait::async_trait]
impl TraceSubscriber for FileSubscriber {
    async fn handle_event(&self, event: TraceEvent) -> PhoenixResult<()> {
        let seconds = match event.timestamp.duration_since(SystemTime::UNIX_EPOCH) {
            Ok(d) => d.as_secs(),
            Err(_) => 0,
        };

        let output = format!("[{}] {} - {}\n", seconds, event.level, event.message,);

        if let Ok(mut file) = tokio::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)
            .await
        {
            let _ = file.write_all(output.as_bytes()).await;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_trace_recording() {
        let debug = DebugTrace::new().await.unwrap();

        let trace_id = debug
            .start_trace(TraceType::Component {
                name: "test".into(),
                type_: "test".into(),
            })
            .await
            .unwrap();

        debug
            .record_event(
                &trace_id,
                EventType::Log,
                Level::INFO,
                "Test event".into(),
                HashMap::new(),
            )
            .await
            .unwrap();

        let history = debug.get_history().await.unwrap();
        assert_eq!(history.len(), 1);
    }

    #[tokio::test]
    async fn test_file_subscriber() {
        let debug = DebugTrace::new().await.unwrap();

        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("trace.log");

        debug
            .add_subscriber(FileSubscriber::new(&file_path))
            .await
            .unwrap();

        let trace_id = debug
            .start_trace(TraceType::Process {
                pid: 1,
                name: "test".into(),
            })
            .await
            .unwrap();

        debug
            .record_event(
                &trace_id,
                EventType::Log,
                Level::INFO,
                "Test event".into(),
                HashMap::new(),
            )
            .await
            .unwrap();

        assert!(file_path.exists());
    }
}
