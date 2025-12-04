//! Forensics Recorder Module
//!
//! Provides a comprehensive forensic data recording system with 1-year rolling retention,
//! immutable storage, and time-based retrieval capabilities using a tiered storage architecture.

use std::collections::{HashMap, BTreeMap};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, SystemTime};

use anyhow::{Result, Context, anyhow};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use serde::{Deserialize, Serialize};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// Types of forensic events that can be recorded
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ForensicEventType {
    /// Process creation event
    ProcessCreation,
    /// Network connection event
    NetworkConnection,
    /// File system event
    FileSystem,
    /// Registry event
    Registry,
    /// DNS query event
    DnsQuery,
    /// Authentication event
    Authentication,
    /// Security alert event
    SecurityAlert,
    /// Memory snapshot event
    MemorySnapshot,
    /// Disk snapshot event
    DiskSnapshot,
    /// Network capture event
    NetworkCapture,
    /// Process dump event
    ProcessDump,
    /// Custom event type
    Custom(String),
}

/// Storage tiers for forensic data
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum StorageTier {
    /// Hot storage - recent events (0-30 days) for fast access
    Hot,
    /// Warm storage - medium-term events (31-90 days) for balanced performance
    Warm,
    /// Cold storage - long-term events (91-365 days) for archival
    Cold,
}

impl StorageTier {
    /// Get the minimum age for this storage tier (in days)
    fn min_age_days(&self) -> u32 {
        match self {
            StorageTier::Hot => 0,
            StorageTier::Warm => 31,
            StorageTier::Cold => 91,
        }
    }
    
    /// Get the maximum age for this storage tier (in days)
    fn max_age_days(&self) -> u32 {
        match self {
            StorageTier::Hot => 30,
            StorageTier::Warm => 90,
            StorageTier::Cold => 365,
        }
    }
    
    /// Determine which tier should store an event of a given age
    fn for_age_days(age_days: u32) -> Option<Self> {
        match age_days {
            0..=30 => Some(StorageTier::Hot),
            31..=90 => Some(StorageTier::Warm),
            91..=365 => Some(StorageTier::Cold),
            _ => None, // Beyond retention window
        }
    }
}

/// A single forensic event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForensicEvent {
    /// Unique event identifier
    pub event_id: String,
    /// Type of the event
    pub event_type: ForensicEventType,
    /// Timestamp when the event occurred
    pub timestamp: DateTime<Utc>,
    /// Source system or component that generated the event
    pub source: String,
    /// Host or endpoint where the event occurred
    pub host: String,
    /// User associated with the event (if any)
    pub user: Option<String>,
    /// Process associated with the event (if any)
    pub process: Option<String>,
    /// Event data in a structured format
    pub data: serde_json::Value,
    /// Metadata about the event
    pub metadata: HashMap<String, String>,
    /// Hash of the event data for integrity verification
    pub data_hash: String,
    /// Size of the event data in bytes
    pub size_bytes: u64,
    /// Storage tier for this event
    #[serde(skip)]
    pub storage_tier: Option<StorageTier>,
}

impl ForensicEvent {
    /// Create a new forensic event
    pub fn new(
        event_type: ForensicEventType,
        timestamp: DateTime<Utc>,
        source: String,
        host: String,
        data: serde_json::Value,
        user: Option<String>,
        process: Option<String>,
        metadata: HashMap<String, String>,
    ) -> Result<Self> {
        // Calculate data hash for integrity
        let data_str = serde_json::to_string(&data)?;
        let data_hash = format!("{:x}", md5::compute(data_str.as_bytes()));
        let size_bytes = data_str.len() as u64;
        
        Ok(Self {
            event_id: format!("event_{}", Uuid::new_v4()),
            event_type,
            timestamp,
            source,
            host,
            user,
            process,
            data,
            metadata,
            data_hash,
            size_bytes,
            storage_tier: None,
        })
    }
    
    /// Calculate the age of the event in days
    pub fn age_days(&self) -> u32 {
        let now = Utc::now();
        let duration = now.signed_duration_since(self.timestamp);
        
        if duration.num_days() < 0 {
            0 // Future events have age 0
        } else {
            duration.num_days() as u32
        }
    }
    
    /// Determine appropriate storage tier for this event
    pub fn determine_storage_tier(&mut self) -> Option<StorageTier> {
        let age_days = self.age_days();
        self.storage_tier = StorageTier::for_age_days(age_days);
        self.storage_tier
    }
}

/// Storage configuration for forensic recorder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForensicsConfig {
    /// Root storage directory
    pub storage_root: PathBuf,
    /// Maximum retention period in days (default: 365 days)
    pub max_retention_days: u32,
    /// Hot storage directory
    pub hot_storage_path: PathBuf,
    /// Warm storage directory
    pub warm_storage_path: PathBuf,
    /// Cold storage directory
    pub cold_storage_path: PathBuf,
    /// Maximum container size in bytes
    pub max_container_size: u64,
    /// Container duration in hours
    pub container_duration_hours: u32,
    /// Compression level (0-9)
    pub compression_level: u8,
    /// Enable encryption
    pub encryption_enabled: bool,
    /// Automatic cleanup enabled
    pub auto_cleanup_enabled: bool,
    /// Cleanup interval in hours
    pub cleanup_interval_hours: u32,
}

impl Default for ForensicsConfig {
    fn default() -> Self {
        let storage_root = PathBuf::from("/var/lib/cipher_guard/forensics");
        
        Self {
            storage_root: storage_root.clone(),
            max_retention_days: 365,
            hot_storage_path: storage_root.join("hot"),
            warm_storage_path: storage_root.join("warm"),
            cold_storage_path: storage_root.join("cold"),
            max_container_size: 100 * 1024 * 1024, // 100 MB
            container_duration_hours: 24, // Daily containers
            compression_level: 6,
            encryption_enabled: true,
            auto_cleanup_enabled: true,
            cleanup_interval_hours: 24,
        }
    }
}

/// Forensic data container
#[derive(Debug, Clone)]
pub struct ForensicContainer {
    /// Container ID
    pub id: String,
    /// Storage tier
    pub tier: StorageTier,
    /// Start time of events in this container
    pub start_time: DateTime<Utc>,
    /// End time of events in this container
    pub end_time: DateTime<Utc>,
    /// Events in this container
    pub events: Vec<ForensicEvent>,
    /// Container file path
    pub file_path: PathBuf,
}

/// Query parameters for forensic event retrieval
#[derive(Debug, Clone)]
pub struct EventQuery {
    /// Start time for the query range
    pub start_time: DateTime<Utc>,
    /// End time for the query range
    pub end_time: DateTime<Utc>,
    /// Event types to include
    pub event_types: Option<Vec<ForensicEventType>>,
    /// Hosts to include
    pub hosts: Option<Vec<String>>,
    /// Users to include
    pub users: Option<Vec<String>>,
    /// Maximum number of events to return
    pub limit: Option<usize>,
    /// Custom filter criteria
    pub filters: HashMap<String, String>,
}

/// Result of forensic event retention cleanup
#[derive(Debug)]
pub struct CleanupResult {
    /// Number of events deleted
    pub events_deleted: u64,
    /// Number of bytes freed
    pub bytes_freed: u64,
    /// Time taken for cleanup
    pub duration: Duration,
}

/// Main forensics recorder system
pub struct ForensicsRecorder {
    /// Configuration
    config: ForensicsConfig,
    /// Current active containers
    active_containers: HashMap<StorageTier, ForensicContainer>,
    /// Index for timestamp-based queries
    time_index: BTreeMap<DateTime<Utc>, String>,
    /// Index for host-based queries
    host_index: HashMap<String, Vec<String>>,
    /// Index for event type queries
    type_index: HashMap<ForensicEventType, Vec<String>>,
}

impl ForensicsRecorder {
    /// Create a new forensics recorder
    pub fn new() -> Result<Self> {
        let config = ForensicsConfig::default();
        
        // Create storage directories if they don't exist
        std::fs::create_dir_all(&config.hot_storage_path)?;
        std::fs::create_dir_all(&config.warm_storage_path)?;
        std::fs::create_dir_all(&config.cold_storage_path)?;
        
        Ok(Self {
            config,
            active_containers: HashMap::new(),
            time_index: BTreeMap::new(),
            host_index: HashMap::new(),
            type_index: HashMap::new(),
        })
    }
    
    /// Initialize with custom configuration
    pub fn with_config(config: ForensicsConfig) -> Result<Self> {
        // Create storage directories if they don't exist
        std::fs::create_dir_all(&config.hot_storage_path)?;
        std::fs::create_dir_all(&config.warm_storage_path)?;
        std::fs::create_dir_all(&config.cold_storage_path)?;
        
        Ok(Self {
            config,
            active_containers: HashMap::new(),
            time_index: BTreeMap::new(),
            host_index: HashMap::new(),
            type_index: HashMap::new(),
        })
    }
    
    /// Record a forensic event
    pub async fn record_event(&mut self, event: ForensicEvent) -> Result<()> {
        // Determine storage tier
        let mut event = event;
        let tier = event.determine_storage_tier().unwrap_or(StorageTier::Hot);
        
        // Get or create container for this tier
        let container = self.get_active_container(tier).await?;
        
        // Add event to container
        self.add_event_to_container(container, event.clone()).await?;
        
        // Update indexes
        self.time_index.insert(event.timestamp, event.event_id.clone());
        
        self.host_index
            .entry(event.host.clone())
            .or_insert_with(Vec::new)
            .push(event.event_id.clone());
        
        self.type_index
            .entry(event.event_type.clone())
            .or_insert_with(Vec::new)
            .push(event.event_id.clone());
        
        Ok(())
    }
    
    /// Get or create an active container for a storage tier
    async fn get_active_container(&mut self, tier: StorageTier) -> Result<&mut ForensicContainer> {
        if !self.active_containers.contains_key(&tier) {
            // Create a new container for this tier
            let now = Utc::now();
            let end_time = now + ChronoDuration::hours(self.config.container_duration_hours as i64);
            
            let tier_path = match tier {
                StorageTier::Hot => &self.config.hot_storage_path,
                StorageTier::Warm => &self.config.warm_storage_path,
                StorageTier::Cold => &self.config.cold_storage_path,
            };
            
            let container_id = format!("container_{}", Uuid::new_v4());
            let file_name = format!("{}_{}_{}.fctr", 
                container_id,
                now.format("%Y%m%d%H%M%S"),
                end_time.format("%Y%m%d%H%M%S")
            );
            
            let file_path = tier_path.join(file_name);
            
            let container = ForensicContainer {
                id: container_id,
                tier,
                start_time: now,
                end_time,
                events: Vec::new(),
                file_path,
            };
            
            self.active_containers.insert(tier, container);
        }
        
        // Now we can return a mutable reference to the container
        Ok(self.active_containers.get_mut(&tier).unwrap())
    }
    
    /// Add an event to a container
    async fn add_event_to_container(&mut self, container: &mut ForensicContainer, event: ForensicEvent) -> Result<()> {
        // Check if container is full or expired
        if container.events.len() as u64 * 1024 > self.config.max_container_size || 
           Utc::now() > container.end_time {
            // Rotate container
            self.rotate_container(container.tier).await?;
            return self.record_event(event).await; // Try again with new container
        }
        
        container.events.push(event);
        
        // If container events reached a threshold, flush to disk
        if container.events.len() % 100 == 0 {
            self.flush_container(container.tier).await?;
        }
        
        Ok(())
    }
    
    /// Rotate a container by flushing it to disk and creating a new one
    async fn rotate_container(&mut self, tier: StorageTier) -> Result<()> {
        // Flush container to disk
        self.flush_container(tier).await?;
        
        // Remove the old container to force creating a new one
        self.active_containers.remove(&tier);
        
        Ok(())
    }
    
    /// Flush a container to disk
    async fn flush_container(&mut self, tier: StorageTier) -> Result<()> {
        if let Some(container) = self.active_containers.get(&tier) {
            let container_clone = container.clone();
            
            // Simulate writing container to disk
            info!("Writing container {} with {} events to {}",
                container_clone.id, 
                container_clone.events.len(),
                container_clone.file_path.display()
            );
            
            // In a real implementation, we would serialize and write to disk here
            // For simulation, we'll just log the operation
        }
        
        Ok(())
    }
    
    /// Query events by time range
    pub async fn query_events(&self, query: EventQuery) -> Result<Vec<ForensicEvent>> {
        let mut results = Vec::new();
        
        // Find all event IDs in the time range
        let event_ids: Vec<&String> = self.time_index
            .range(query.start_time..=query.end_time)
            .map(|(_, event_id)| event_id)
            .collect();
        
        // Filter by event types if specified
        let filtered_event_ids: Vec<&String> = if let Some(event_types) = &query.event_types {
            // Get all event IDs for the specified types
            let type_event_ids: Vec<&String> = event_types.iter()
                .filter_map(|event_type| self.type_index.get(event_type))
                .flat_map(|ids| ids.iter())
                .collect();
            
            // Find intersection of time-based and type-based IDs
            event_ids.into_iter()
                .filter(|id| type_event_ids.contains(id))
                .collect()
        } else {
            event_ids
        };
        
        // Filter by hosts if specified
        let filtered_event_ids: Vec<&String> = if let Some(hosts) = &query.hosts {
            // Get all event IDs for the specified hosts
            let host_event_ids: Vec<&String> = hosts.iter()
                .filter_map(|host| self.host_index.get(host))
                .flat_map(|ids| ids.iter())
                .collect();
            
            // Find intersection with previous filter
            filtered_event_ids.into_iter()
                .filter(|id| host_event_ids.contains(id))
                .collect()
        } else {
            filtered_event_ids
        };
        
        // Now we need to fetch the actual events for these IDs
        // In a real implementation, this would involve reading from storage
        // For this simulation, we'll return empty results
        
        // Apply limit if specified
        if let Some(limit) = query.limit {
            if limit < results.len() {
                results.truncate(limit);
            }
        }
        
        Ok(results)
    }
    
    /// Clean up expired events based on retention policy
    pub async fn cleanup_expired_events(&mut self) -> Result<CleanupResult> {
        let start_time = SystemTime::now();
        let cutoff_date = Utc::now() - ChronoDuration::days(self.config.max_retention_days as i64);
        
        // In a real implementation, this would scan storage and delete expired containers
        // For this simulation, we'll just log the operation
        
        info!("Cleaning up events older than {}", cutoff_date);
        
        let elapsed = SystemTime::now().duration_since(start_time).unwrap_or(Duration::from_secs(0));
        
        Ok(CleanupResult {
            events_deleted: 0,
            bytes_freed: 0,
            duration: elapsed,
        })
    }
    
    /// Take a forensic snapshot of a system
    pub async fn take_snapshot(&mut self, 
                              snapshot_type: ForensicEventType,
                              host: String, 
                              metadata: HashMap<String, String>) -> Result<String> {
        // In a real implementation, this would trigger a snapshot collection
        // For this simulation, we'll create a synthetic snapshot event
        
        let snapshot_id = format!("snapshot_{}", Uuid::new_v4());
        
        let snapshot_data = serde_json::json!({
            "snapshot_id": snapshot_id,
            "snapshot_type": format!("{:?}", snapshot_type),
            "timestamp": Utc::now().to_rfc3339(),
            "host": host,
            "metadata": metadata,
        });
        
        let event = ForensicEvent::new(
            snapshot_type, 
            Utc::now(), 
            "ForensicsRecorder".to_string(), 
            host.clone(), 
            snapshot_data, 
            None,
            None,
            metadata,
        )?;
        
        self.record_event(event).await?;
        
        Ok(snapshot_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_forensics_recorder() {
        // Create a forensics recorder
        let mut recorder = ForensicsRecorder::new().unwrap();
        
        // Create a test event
        let event = ForensicEvent::new(
            ForensicEventType::ProcessCreation,
            Utc::now(),
            "test_source".to_string(),
            "test_host".to_string(),
            serde_json::json!({
                "process_name": "test.exe",
                "pid": 1234,
                "command_line": "test.exe --arg"
            }),
            Some("test_user".to_string()),
            Some("test.exe".to_string()),
            HashMap::new(),
        )
        .unwrap();
        
        // Record the event
        let result = recorder.record_event(event.clone()).await;
        assert!(result.is_ok());
    }
}