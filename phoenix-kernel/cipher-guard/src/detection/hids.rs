use crate::{Threat, ThreatDetector, IncidentReport, ThreatSeverity};
use async_trait::async_trait;
use std::error::Error;
use std::collections::HashMap;
use tokio::sync::RwLock;
use std::sync::Arc;
use std::path::PathBuf;

pub struct HostIDS {
    file_monitors: Arc<RwLock<HashMap<PathBuf, FileMonitor>>>,
    process_monitors: Arc<RwLock<HashMap<u32, ProcessMonitor>>>,
    baseline: Arc<RwLock<SystemBaseline>>,
}

#[derive(Debug, Clone)]
struct FileMonitor {
    path: PathBuf,
    hash: String,
    permissions: u32,
    last_modified: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone)]
struct ProcessMonitor {
    pid: u32,
    name: String,
    start_time: chrono::DateTime<chrono::Utc>,
    memory_usage: u64,
    cpu_usage: f32,
}

#[derive(Debug, Clone, Default)]
struct SystemBaseline {
    authorized_processes: HashMap<String, ProcessBaseline>,
    critical_files: HashMap<PathBuf, FileBaseline>,
    system_calls: HashMap<String, u32>,
    last_update: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone)]
struct ProcessBaseline {
    name: String,
    expected_path: PathBuf,
    max_memory: u64,
    allowed_syscalls: Vec<String>,
}

#[derive(Debug, Clone)]
struct FileBaseline {
    path: PathBuf,
    expected_hash: String,
    expected_permissions: u32,
    modification_allowed: bool,
}

impl HostIDS {
    pub fn new() -> Self {
        Self {
            file_monitors: Arc::new(RwLock::new(HashMap::new())),
            process_monitors: Arc::new(RwLock::new(HashMap::new())),
            baseline: Arc::new(RwLock::new(SystemBaseline::default())),
        }
    }

    pub async fn add_file_monitor(&self, path: PathBuf, hash: String, permissions: u32) {
        let mut monitors = self.file_monitors.write().await;
        monitors.insert(path.clone(), FileMonitor {
            path,
            hash,
            permissions,
            last_modified: chrono::Utc::now(),
        });
    }

    pub async fn add_process_monitor(&self, pid: u32, name: String) {
        let mut monitors = self.process_monitors.write().await;
        monitors.insert(pid, ProcessMonitor {
            pid,
            name,
            start_time: chrono::Utc::now(),
            memory_usage: 0,
            cpu_usage: 0.0,
        });
    }

    pub async fn update_baseline(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        let mut baseline = self.baseline.write().await;
        baseline.last_update = Some(chrono::Utc::now());
        
        // In a real implementation, this would:
        // 1. Scan the system for running processes
        // 2. Calculate file hashes for critical system files
        // 3. Record normal system call patterns
        // 4. Update the baseline with current "known good" state
        
        Ok(())
    }

    async fn check_file_integrity(&self) -> Result<Vec<Threat>, Box<dyn Error + Send + Sync>> {
        let mut threats = Vec::new();
        let monitors = self.file_monitors.read().await;
        let baseline = self.baseline.read().await;

        for (path, monitor) in monitors.iter() {
            if let Some(baseline) = baseline.critical_files.get(path) {
                // Check if file hash matches baseline
                if monitor.hash != baseline.expected_hash {
                    threats.push(Threat {
                        id: uuid::Uuid::new_v4(),
                        severity: ThreatSeverity::High,
                        description: format!("File integrity violation detected: {}", path.display()),
                        timestamp: chrono::Utc::now(),
                        source: "HostIDS-FileIntegrity".to_string(),
                    });
                }

                // Check permissions
                if monitor.permissions != baseline.expected_permissions {
                    threats.push(Threat {
                        id: uuid::Uuid::new_v4(),
                        severity: ThreatSeverity::Medium,
                        description: format!("File permission change detected: {}", path.display()),
                        timestamp: chrono::Utc::now(),
                        source: "HostIDS-FilePermissions".to_string(),
                    });
                }
            }
        }

        Ok(threats)
    }

    async fn check_process_anomalies(&self) -> Result<Vec<Threat>, Box<dyn Error + Send + Sync>> {
        let mut threats = Vec::new();
        let monitors = self.process_monitors.read().await;
        let baseline = self.baseline.read().await;

        for (pid, monitor) in monitors.iter() {
            if let Some(baseline) = baseline.authorized_processes.get(&monitor.name) {
                // Check memory usage
                if monitor.memory_usage > baseline.max_memory {
                    threats.push(Threat {
                        id: uuid::Uuid::new_v4(),
                        severity: ThreatSeverity::Medium,
                        description: format!("Process memory anomaly detected: {} (PID: {})", monitor.name, pid),
                        timestamp: chrono::Utc::now(),
                        source: "HostIDS-ProcessMemory".to_string(),
                    });
                }
            } else {
                // Unknown process
                threats.push(Threat {
                    id: uuid::Uuid::new_v4(),
                    severity: ThreatSeverity::High,
                    description: format!("Unauthorized process detected: {} (PID: {})", monitor.name, pid),
                    timestamp: chrono::Utc::now(),
                    source: "HostIDS-UnauthorizedProcess".to_string(),
                });
            }
        }

        Ok(threats)
    }
}

#[async_trait]
impl ThreatDetector for HostIDS {
    async fn detect(&self) -> Result<Vec<Threat>, Box<dyn Error + Send + Sync>> {
        let mut threats = Vec::new();
        
        // Check file integrity
        threats.extend(self.check_file_integrity().await?);
        
        // Check process anomalies
        threats.extend(self.check_process_anomalies().await?);
        
        Ok(threats)
    }

    async fn analyze(&self, threat: &Threat) -> Result<IncidentReport, Box<dyn Error + Send + Sync>> {
        Ok(IncidentReport {
            id: uuid::Uuid::new_v4(),
            threat: threat.clone(),
            status: crate::IncidentStatus::Analyzing,
            actions_taken: vec![
                "Host-based analysis initiated".to_string(),
                "System state correlation in progress".to_string(),
            ],
            evidence: vec![],
            timestamp: chrono::Utc::now(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[tokio::test]
    async fn test_file_integrity_detection() {
        let hids = HostIDS::new();
        
        let test_path = PathBuf::from("/test/file.txt");
        hids.add_file_monitor(
            test_path.clone(),
            "original_hash".to_string(),
            0o644
        ).await;

        {
            let mut baseline = hids.baseline.write().await;
            baseline.critical_files.insert(test_path.clone(), FileBaseline {
                path: test_path.clone(),
                expected_hash: "different_hash".to_string(),
                expected_permissions: 0o644,
                modification_allowed: false,
            });
        }

        let threats = hids.check_file_integrity().await.unwrap();
        assert!(!threats.is_empty());
        assert_eq!(threats[0].severity, ThreatSeverity::High);
    }

    #[tokio::test]
    async fn test_process_anomaly_detection() {
        let hids = HostIDS::new();
        
        hids.add_process_monitor(1234, "test_process".to_string()).await;

        {
            let mut baseline = hids.baseline.write().await;
            baseline.authorized_processes.insert("test_process".to_string(), ProcessBaseline {
                name: "test_process".to_string(),
                expected_path: PathBuf::from("/usr/bin/test_process"),
                max_memory: 100000,
                allowed_syscalls: vec!["read".to_string(), "write".to_string()],
            });
        }

        let threats = hids.check_process_anomalies().await.unwrap();
        assert!(threats.is_empty());
    }
}