use crate::{Threat, IncidentReport, Evidence};
use std::error::Error;
use std::path::PathBuf;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Serialize, Deserialize};
use plastic_ltm::{PlasticLtm, MemoryStats};
use pqcrypto::sign::dilithium2;
use phoenix_common::{
    memory::MemoryFragment,
    types::PhoenixId,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryConfig {
    pub base_path: PathBuf,
    pub mirror_paths: Vec<PathBuf>,
}

pub struct MemoryManager {
    ltm: Arc<PlasticLtm>,
    threat_index: Arc<RwLock<HashMap<uuid::Uuid, PhoenixId>>>,
    incident_index: Arc<RwLock<HashMap<uuid::Uuid, PhoenixId>>>,
    evidence_index: Arc<RwLock<HashMap<uuid::Uuid, PhoenixId>>>,
}

impl MemoryManager {
    pub async fn new(config: MemoryConfig) -> Result<Self, Box<dyn Error + Send + Sync>> {
        // Generate signing keys for memory integrity
        let (_public_key, secret_key) = dilithium2::keypair();

        // Initialize PlasticLTM
        let ltm = PlasticLtm::new(
            config.base_path,
            config.mirror_paths,
            secret_key,
        ).await?;

        Ok(Self {
            ltm: Arc::new(ltm),
            threat_index: Arc::new(RwLock::new(HashMap::new())),
            incident_index: Arc::new(RwLock::new(HashMap::new())),
            evidence_index: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    pub async fn store_threat(&self, threat: &Threat) -> Result<(), Box<dyn Error + Send + Sync>> {
        // Store threat data
        let metadata = HashMap::from([
            ("type".to_string(), "threat".to_string()),
            ("severity".to_string(), format!("{:?}", threat.severity)),
            ("source".to_string(), threat.source.clone()),
        ]);

        let memory_id = self.ltm.store_with_metadata(
            bincode::serialize(threat)?,
            metadata,
        ).await?;

        // Update index
        self.threat_index.write().await.insert(threat.id, memory_id);

        Ok(())
    }

    pub async fn store_incident(&self, incident: &IncidentReport) -> Result<(), Box<dyn Error + Send + Sync>> {
        // Store incident data
        let metadata = HashMap::from([
            ("type".to_string(), "incident".to_string()),
            ("status".to_string(), format!("{:?}", incident.status)),
            ("threat_id".to_string(), incident.threat.id.to_string()),
        ]);

        let memory_id = self.ltm.store_with_metadata(
            bincode::serialize(incident)?,
            metadata,
        ).await?;

        // Update index
        self.incident_index.write().await.insert(incident.id, memory_id);

        Ok(())
    }

    pub async fn store_evidence(&self, evidence: &Evidence) -> Result<(), Box<dyn Error + Send + Sync>> {
        // Store evidence data
        let metadata = HashMap::from([
            ("type".to_string(), "evidence".to_string()),
            ("evidence_type".to_string(), format!("{:?}", evidence.data_type)),
            ("incident_id".to_string(), evidence.incident_id.to_string()),
        ]);

        let memory_id = self.ltm.store_with_metadata(
            bincode::serialize(evidence)?,
            metadata,
        ).await?;

        // Update index
        self.evidence_index.write().await.insert(evidence.id, memory_id);

        Ok(())
    }

    pub async fn retrieve_threat(&self, id: &uuid::Uuid) -> Result<Option<Threat>, Box<dyn Error + Send + Sync>> {
        if let Some(memory_id) = self.threat_index.read().await.get(id) {
            let memory = self.ltm.retrieve(memory_id).await?;
            let threat: Threat = bincode::deserialize(&memory.data.content)?;
            Ok(Some(threat))
        } else {
            Ok(None)
        }
    }

    pub async fn retrieve_incident(&self, id: &uuid::Uuid) -> Result<Option<IncidentReport>, Box<dyn Error + Send + Sync>> {
        if let Some(memory_id) = self.incident_index.read().await.get(id) {
            let memory = self.ltm.retrieve(memory_id).await?;
            let incident: IncidentReport = bincode::deserialize(&memory.data.content)?;
            Ok(Some(incident))
        } else {
            Ok(None)
        }
    }

    pub async fn retrieve_evidence(&self, id: &uuid::Uuid) -> Result<Option<Evidence>, Box<dyn Error + Send + Sync>> {
        if let Some(memory_id) = self.evidence_index.read().await.get(id) {
            let memory = self.ltm.retrieve(memory_id).await?;
            let evidence: Evidence = bincode::deserialize(&memory.data.content)?;
            Ok(Some(evidence))
        } else {
            Ok(None)
        }
    }

    pub async fn query_threats_by_source(&self, source: &str) -> Result<Vec<Threat>, Box<dyn Error + Send + Sync>> {
        let memory_ids = self.ltm.query_by_metadata("source", source).await?;
        let mut threats = Vec::new();

        for memory_id in memory_ids {
            if let Ok(memory) = self.ltm.retrieve(&memory_id).await {
                if let Ok(threat) = bincode::deserialize(&memory.data.content) {
                    threats.push(threat);
                }
            }
        }

        Ok(threats)
    }

    pub async fn query_incidents_by_status(&self, status: &str) -> Result<Vec<IncidentReport>, Box<dyn Error + Send + Sync>> {
        let memory_ids = self.ltm.query_by_metadata("status", status).await?;
        let mut incidents = Vec::new();

        for memory_id in memory_ids {
            if let Ok(memory) = self.ltm.retrieve(&memory_id).await {
                if let Ok(incident) = bincode::deserialize(&memory.data.content) {
                    incidents.push(incident);
                }
            }
        }

        Ok(incidents)
    }

    pub async fn get_memory_stats(&self) -> Result<MemoryStats, Box<dyn Error + Send + Sync>> {
        Ok(self.ltm.get_stats().await?)
    }

    pub async fn verify_integrity(&self) -> Result<f32, Box<dyn Error + Send + Sync>> {
        Ok(self.ltm.verify_integrity().await?)
    }

    pub async fn persist(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.ltm.persist().await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use crate::ThreatSeverity;

    #[tokio::test]
    async fn test_memory_manager() {
        let temp_dir = tempdir().unwrap();
        let mirror_dir = tempdir().unwrap();

        let config = MemoryConfig {
            base_path: temp_dir.path().to_path_buf(),
            mirror_paths: vec![mirror_dir.path().to_path_buf()],
        };

        let manager = MemoryManager::new(config).await.unwrap();

        // Test threat storage and retrieval
        let threat = Threat {
            id: uuid::Uuid::new_v4(),
            severity: ThreatSeverity::High,
            description: "Test threat".to_string(),
            timestamp: chrono::Utc::now(),
            source: "test_source".to_string(),
        };

        manager.store_threat(&threat).await.unwrap();
        let retrieved = manager.retrieve_threat(&threat.id).await.unwrap().unwrap();
        assert_eq!(retrieved.description, threat.description);

        // Test incident storage and retrieval
        let incident = IncidentReport {
            id: uuid::Uuid::new_v4(),
            threat: threat.clone(),
            status: crate::IncidentStatus::Analyzing,
            actions_taken: vec![],
            evidence: vec![],
            timestamp: chrono::Utc::now(),
        };

        manager.store_incident(&incident).await.unwrap();
        let retrieved = manager.retrieve_incident(&incident.id).await.unwrap().unwrap();
        assert_eq!(retrieved.threat.id, threat.id);

        // Test evidence storage and retrieval
        let evidence = Evidence {
            id: uuid::Uuid::new_v4(),
            incident_id: incident.id,
            data_type: crate::EvidenceType::Log,
            content: "Test evidence".to_string(),
            timestamp: chrono::Utc::now(),
            hash: "test_hash".to_string(),
        };

        manager.store_evidence(&evidence).await.unwrap();
        let retrieved = manager.retrieve_evidence(&evidence.id).await.unwrap().unwrap();
        assert_eq!(retrieved.content, evidence.content);

        // Test querying
        let threats = manager.query_threats_by_source("test_source").await.unwrap();
        assert_eq!(threats.len(), 1);
        assert_eq!(threats[0].id, threat.id);

        // Test memory stats
        let stats = manager.get_memory_stats().await.unwrap();
        assert!(stats.fragment_count > 0);

        // Test integrity verification
        let integrity = manager.verify_integrity().await.unwrap();
        assert!(integrity > 0.0);
    }
}