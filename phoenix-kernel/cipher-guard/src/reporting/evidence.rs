use crate::{Evidence, EvidenceType, EvidenceCollector, IncidentReport};
use async_trait::async_trait;
use std::error::Error;
use std::collections::HashMap;
use tokio::sync::RwLock;
use std::sync::Arc;
use std::path::PathBuf;
use sha2::{Sha256, Digest};

pub struct ForensicsCollector {
    evidence_store: Arc<RwLock<HashMap<uuid::Uuid, Vec<Evidence>>>>,
    storage_path: PathBuf,
    chain_of_custody: Arc<RwLock<ChainOfCustody>>,
}

#[derive(Debug, Clone)]
struct ChainOfCustody {
    entries: HashMap<uuid::Uuid, Vec<CustodyEntry>>,
}

#[derive(Debug, Clone)]
struct CustodyEntry {
    evidence_id: uuid::Uuid,
    timestamp: chrono::DateTime<chrono::Utc>,
    action: CustodyAction,
    actor: String,
    hash: String,
}

#[derive(Debug, Clone)]
enum CustodyAction {
    Collection,
    Preservation,
    Analysis,
    Export,
    Deletion,
}

impl ForensicsCollector {
    pub fn new(storage_path: PathBuf) -> Self {
        Self {
            evidence_store: Arc::new(RwLock::new(HashMap::new())),
            storage_path,
            chain_of_custody: Arc::new(RwLock::new(ChainOfCustody {
                entries: HashMap::new(),
            })),
        }
    }

    async fn collect_process_info(&self, pid: u32) -> Result<Evidence, Box<dyn Error + Send + Sync>> {
        // In a real implementation, this would collect actual process information
        let content = format!("Process information for PID: {}", pid);
        let hash = self.calculate_hash(content.as_bytes());

        Ok(Evidence {
            id: uuid::Uuid::new_v4(),
            incident_id: uuid::Uuid::new_v4(), // This would be set properly when used
            data_type: EvidenceType::ProcessInfo,
            content,
            timestamp: chrono::Utc::now(),
            hash,
        })
    }

    async fn collect_memory_dump(&self, process_name: &str) -> Result<Evidence, Box<dyn Error + Send + Sync>> {
        // In a real implementation, this would perform an actual memory dump
        let content = format!("Memory dump for process: {}", process_name);
        let hash = self.calculate_hash(content.as_bytes());

        Ok(Evidence {
            id: uuid::Uuid::new_v4(),
            incident_id: uuid::Uuid::new_v4(),
            data_type: EvidenceType::MemoryDump,
            content,
            timestamp: chrono::Utc::now(),
            hash,
        })
    }

    async fn collect_network_capture(&self, interface: &str) -> Result<Evidence, Box<dyn Error + Send + Sync>> {
        // In a real implementation, this would capture actual network traffic
        let content = format!("Network capture from interface: {}", interface);
        let hash = self.calculate_hash(content.as_bytes());

        Ok(Evidence {
            id: uuid::Uuid::new_v4(),
            incident_id: uuid::Uuid::new_v4(),
            data_type: EvidenceType::NetworkCapture,
            content,
            timestamp: chrono::Utc::now(),
            hash,
        })
    }

    async fn collect_filesystem_artifacts(&self, path: &str) -> Result<Evidence, Box<dyn Error + Send + Sync>> {
        // In a real implementation, this would collect actual filesystem artifacts
        let content = format!("Filesystem artifacts from: {}", path);
        let hash = self.calculate_hash(content.as_bytes());

        Ok(Evidence {
            id: uuid::Uuid::new_v4(),
            incident_id: uuid::Uuid::new_v4(),
            data_type: EvidenceType::FileSystem,
            content,
            timestamp: chrono::Utc::now(),
            hash,
        })
    }

    fn calculate_hash(&self, data: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data);
        format!("{:x}", hasher.finalize())
    }

    async fn store_evidence(&self, evidence: &Evidence) -> Result<(), Box<dyn Error + Send + Sync>> {
        // Create evidence directory if it doesn't exist
        let evidence_dir = self.storage_path.join(evidence.incident_id.to_string());
        tokio::fs::create_dir_all(&evidence_dir).await?;

        // Store evidence file
        let evidence_path = evidence_dir.join(format!("{}.evidence", evidence.id));
        tokio::fs::write(&evidence_path, &evidence.content).await?;

        // Update chain of custody
        let mut custody = self.chain_of_custody.write().await;
        let entries = custody.entries.entry(evidence.id).or_insert_with(Vec::new);
        entries.push(CustodyEntry {
            evidence_id: evidence.id,
            timestamp: chrono::Utc::now(),
            action: CustodyAction::Preservation,
            actor: "ForensicsCollector".to_string(),
            hash: evidence.hash.clone(),
        });

        // Store in memory
        let mut store = self.evidence_store.write().await;
        let evidence_list = store.entry(evidence.incident_id).or_insert_with(Vec::new);
        evidence_list.push(evidence.clone());

        Ok(())
    }

    pub async fn verify_evidence(&self, evidence: &Evidence) -> Result<bool, Box<dyn Error + Send + Sync>> {
        let calculated_hash = self.calculate_hash(evidence.content.as_bytes());
        Ok(calculated_hash == evidence.hash)
    }

    pub async fn get_chain_of_custody(&self, evidence_id: uuid::Uuid) -> Option<Vec<CustodyEntry>> {
        let custody = self.chain_of_custody.read().await;
        custody.entries.get(&evidence_id).cloned()
    }
}

#[async_trait]
impl EvidenceCollector for ForensicsCollector {
    async fn collect(&self, incident: &IncidentReport) -> Result<Vec<Evidence>, Box<dyn Error + Send + Sync>> {
        let mut evidence = Vec::new();

        // Collect process information
        if let Ok(process_info) = self.collect_process_info(0).await {
            evidence.push(process_info);
        }

        // Collect memory dump
        if let Ok(memory_dump) = self.collect_memory_dump(&incident.threat.source).await {
            evidence.push(memory_dump);
        }

        // Collect network capture
        if let Ok(network_capture) = self.collect_network_capture("eth0").await {
            evidence.push(network_capture);
        }

        // Collect filesystem artifacts
        if let Ok(filesystem_artifacts) = self.collect_filesystem_artifacts("/suspicious/path").await {
            evidence.push(filesystem_artifacts);
        }

        // Set incident ID for all evidence
        for item in &mut evidence {
            item.incident_id = incident.id;
        }

        Ok(evidence)
    }

    async fn preserve(&self, evidence: &Evidence) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.store_evidence(evidence).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_evidence_collection() {
        let temp_dir = tempdir().unwrap();
        let collector = ForensicsCollector::new(temp_dir.path().to_path_buf());

        let incident = IncidentReport {
            id: uuid::Uuid::new_v4(),
            threat: crate::Threat {
                id: uuid::Uuid::new_v4(),
                severity: crate::ThreatSeverity::High,
                description: "Test threat".to_string(),
                timestamp: chrono::Utc::now(),
                source: "test_process".to_string(),
            },
            status: crate::IncidentStatus::Analyzing,
            actions_taken: vec![],
            evidence: vec![],
            timestamp: chrono::Utc::now(),
        };

        let evidence = collector.collect(&incident).await.unwrap();
        assert!(!evidence.is_empty());

        // Test evidence preservation
        for item in &evidence {
            collector.preserve(item).await.unwrap();
        }

        // Verify chain of custody
        let custody_entries = collector.get_chain_of_custody(evidence[0].id).await.unwrap();
        assert!(!custody_entries.is_empty());
    }

    #[tokio::test]
    async fn test_evidence_verification() {
        let temp_dir = tempdir().unwrap();
        let collector = ForensicsCollector::new(temp_dir.path().to_path_buf());

        let evidence = collector.collect_process_info(1234).await.unwrap();
        assert!(collector.verify_evidence(&evidence).await.unwrap());

        // Test with tampered evidence
        let mut tampered_evidence = evidence.clone();
        tampered_evidence.content = "Tampered content".to_string();
        assert!(!collector.verify_evidence(&tampered_evidence).await.unwrap());
    }
}