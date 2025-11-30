//! Evidence Preservation System
//! 
//! Comprehensive evidence management with chain of custody tracking

pub mod preservation;
pub mod chain_of_custody;
pub mod encryption;
pub mod integrity;

// Re-exports for convenient access
pub use preservation::*;
pub use chain_of_custody::*;
pub use encryption::*;
pub use integrity::*;

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Main Evidence Preservation System
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidencePreservationSystem {
    pub chain_of_custody: ChainOfCustodyManager,
    pub immutability_engine: ImmutabilityEngine,
    pub encryption_system: EncryptionSystem,
    pub integrity_verification: IntegrityVerifier,
    pub access_control: EvidenceAccessControl,
    pub storage_backend: StorageBackend,
}

impl EvidencePreservationSystem {
    /// Create a new Evidence Preservation System
    pub fn new() -> Result<Self, EvidenceError> {
        Ok(Self {
            chain_of_custody: ChainOfCustodyManager::new(),
            immutability_engine: ImmutabilityEngine::new(),
            encryption_system: EncryptionSystem::new(),
            integrity_verification: IntegrityVerifier::new(),
            access_control: EvidenceAccessControl::new(),
            storage_backend: StorageBackend::default(),
        })
    }

    /// Store evidence with full preservation
    pub async fn store_evidence(&mut self, evidence: Evidence) -> Result<EvidenceReceipt, EvidenceError> {
        // Validate evidence
        self.integrity_verification.validate_evidence(&evidence)?;
        
        // Apply encryption
        let encrypted_evidence = self.encryption_system.encrypt_evidence(evidence)?;
        
        // Create chain of custody entry
        let custody_entry = self.chain_of_custody.create_entry(&encrypted_evidence)?;
        
        // Store in immutable storage
        let storage_receipt = self.immutability_engine.store_evidence(encrypted_evidence).await?;
        
        // Create access control rules
        self.access_control.create_access_rules(&storage_receipt)?;
        
        Ok(EvidenceReceipt {
            evidence_id: storage_receipt.evidence_id,
            custody_id: custody_entry.custody_id,
            storage_receipt,
            timestamp: Utc::now(),
        })
    }

    /// Retrieve evidence with access control
    pub async fn retrieve_evidence(&self, evidence_id: Uuid, requester: &str) -> Result<Evidence, EvidenceError> {
        // Check access permissions
        self.access_control.verify_access(evidence_id, requester)?;
        
        // Retrieve from storage
        let encrypted_evidence = self.immutability_engine.retrieve_evidence(evidence_id).await?;
        
        // Verify integrity
        self.integrity_verification.verify_integrity(&encrypted_evidence)?;
        
        // Decrypt evidence
        let evidence = self.encryption_system.decrypt_evidence(encrypted_evidence)?;
        
        // Log access in chain of custody
        self.chain_of_custody.record_access(evidence_id, requester)?;
        
        Ok(evidence)
    }

    /// Verify evidence integrity
    pub async fn verify_evidence_integrity(&self, evidence_id: Uuid) -> Result<IntegrityReport, EvidenceError> {
        let evidence = self.immutability_engine.retrieve_evidence(evidence_id).await?;
        self.integrity_verification.verify_integrity(&evidence)
    }

    /// Get chain of custody for evidence
    pub fn get_chain_of_custody(&self, evidence_id: Uuid) -> Result<ChainOfCustody, EvidenceError> {
        self.chain_of_custody.get_chain(evidence_id)
    }

    /// Generate evidence audit report
    pub async fn generate_audit_report(&self, evidence_id: Uuid) -> Result<AuditReport, EvidenceError> {
        let chain_of_custody = self.get_chain_of_custody(evidence_id)?;
        let integrity_report = self.verify_evidence_integrity(evidence_id).await?;
        let access_log = self.access_control.get_access_log(evidence_id)?;
        
        Ok(AuditReport {
            evidence_id,
            chain_of_custody,
            integrity_report,
            access_log,
            generated_at: Utc::now(),
        })
    }
}

/// Evidence structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Evidence {
    pub evidence_id: Uuid,
    pub evidence_type: EvidenceType,
    pub content: Vec<u8>, // Raw evidence data
    pub metadata: EvidenceMetadata,
    pub collected_at: DateTime<Utc>,
    pub collector: String,
    pub hash: String, // SHA-256 hash of content
}

impl Evidence {
    /// Create new evidence
    pub fn new(
        evidence_type: EvidenceType,
        content: Vec<u8>,
        collector: String,
        metadata: EvidenceMetadata,
    ) -> Self {
        let evidence_id = Uuid::new_v4();
        let hash = Self::calculate_hash(&content);
        
        Self {
            evidence_id,
            evidence_type,
            content,
            metadata,
            collected_at: Utc::now(),
            collector,
            hash,
        }
    }

    /// Calculate SHA-256 hash of content
    fn calculate_hash(content: &[u8]) -> String {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(content);
        format!("{:x}", hasher.finalize())
    }

    /// Verify evidence integrity
    pub fn verify_integrity(&self) -> bool {
        self.hash == Self::calculate_hash(&self.content)
    }
}

/// Evidence metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceMetadata {
    pub description: String,
    pub source: String,
    pub collection_method: CollectionMethod,
    pub sensitivity_level: SensitivityLevel,
    pub retention_period: RetentionPeriod,
    pub tags: Vec<String>,
}

/// Evidence receipt
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceReceipt {
    pub evidence_id: Uuid,
    pub custody_id: Uuid,
    pub storage_receipt: StorageReceipt,
    pub timestamp: DateTime<Utc>,
}

/// Audit report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditReport {
    pub evidence_id: Uuid,
    pub chain_of_custody: ChainOfCustody,
    pub integrity_report: IntegrityReport,
    pub access_log: AccessLog,
    pub generated_at: DateTime<Utc>,
}

// Enums
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EvidenceType {
    LogFile,
    NetworkPacket,
    MemoryDump,
    DiskImage,
    Screenshot,
    VideoRecording,
    AudioRecording,
    Document,
    DatabaseRecord,
    ConfigurationFile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CollectionMethod {
    Automated,
    Manual,
    Forensic,
    Legal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SensitivityLevel {
    Public,
    Internal,
    Confidential,
    Secret,
    TopSecret,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetentionPeriod {
    pub duration: Duration,
    pub unit: RetentionUnit,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RetentionUnit {
    Days,
    Months,
    Years,
    Permanent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EvidenceError {
    IntegrityViolation(String),
    AccessDenied(String),
    StorageError(String),
    EncryptionError(String),
    ChainOfCustodyError(String),
    ValidationError(String),
}

// Duration type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Duration {
    pub value: u32,
}

impl Duration {
    pub fn new(value: u32) -> Self {
        Self { value }
    }
}