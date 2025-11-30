//! Chain of Custody Management
//! 
//! Tracks the complete history of evidence handling and access

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

/// Chain of Custody Manager
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainOfCustodyManager {
    pub custody_log: HashMap<Uuid, ChainOfCustody>,
    pub access_records: HashMap<Uuid, AccessRecordKeeper>,
    pub transfer_protocols: TransferProtocol,
    pub validation_rules: ValidationRuleSet,
}

impl ChainOfCustodyManager {
    /// Create a new Chain of Custody Manager
    pub fn new() -> Self {
        Self {
            custody_log: HashMap::new(),
            access_records: HashMap::new(),
            transfer_protocols: TransferProtocol::default(),
            validation_rules: ValidationRuleSet::default(),
        }
    }

    /// Create a new chain of custody entry
    pub fn create_entry(&mut self, evidence: &Evidence) -> Result<CustodyEntry, EvidenceError> {
        let custody_id = Uuid::new_v4();
        let entry = CustodyEntry {
            custody_id,
            evidence_id: evidence.evidence_id,
            action: CustodyAction::Collection,
            actor: evidence.collector.clone(),
            timestamp: Utc::now(),
            location: "Primary Storage".to_string(),
            notes: "Initial evidence collection".to_string(),
            signature: self.generate_signature(&evidence),
        };

        // Create new chain of custody
        let mut chain = ChainOfCustody::new(evidence.evidence_id);
        chain.add_entry(entry.clone());
        
        self.custody_log.insert(evidence.evidence_id, chain);
        
        // Initialize access records
        self.access_records.insert(evidence.evidence_id, AccessRecordKeeper::new());
        
        Ok(entry)
    }

    /// Add an entry to the chain of custody
    pub fn add_entry(&mut self, evidence_id: Uuid, entry: CustodyEntry) -> Result<(), EvidenceError> {
        if let Some(chain) = self.custody_log.get_mut(&evidence_id) {
            // Validate the new entry
            self.validation_rules.validate_entry(chain, &entry)?;
            
            // Add to chain
            chain.add_entry(entry);
            Ok(())
        } else {
            Err(EvidenceError::ChainOfCustodyError(
                format!("Evidence {} not found", evidence_id)
            ))
        }
    }

    /// Record access to evidence
    pub fn record_access(&mut self, evidence_id: Uuid, requester: &str) -> Result<(), EvidenceError> {
        if let Some(access_keeper) = self.access_records.get_mut(&evidence_id) {
            access_keeper.record_access(requester);
            Ok(())
        } else {
            Err(EvidenceError::ChainOfCustodyError(
                format!("Evidence {} not found", evidence_id)
            ))
        }
    }

    /// Transfer evidence between custodians
    pub fn transfer_evidence(
        &mut self,
        evidence_id: Uuid,
        from: &str,
        to: &str,
        notes: &str,
    ) -> Result<CustodyEntry, EvidenceError> {
        if let Some(chain) = self.custody_log.get_mut(&evidence_id) {
            let entry = CustodyEntry {
                custody_id: Uuid::new_v4(),
                evidence_id,
                action: CustodyAction::Transfer,
                actor: from.to_string(),
                timestamp: Utc::now(),
                location: "Transfer".to_string(),
                notes: format!("Transfer from {} to {}: {}", from, to, notes),
                signature: self.generate_transfer_signature(from, to),
            };

            // Validate transfer
            self.transfer_protocols.validate_transfer(chain, &entry)?;
            
            chain.add_entry(entry.clone());
            Ok(entry)
        } else {
            Err(EvidenceError::ChainOfCustodyError(
                format!("Evidence {} not found", evidence_id)
            ))
        }
    }

    /// Get complete chain of custody for evidence
    pub fn get_chain(&self, evidence_id: Uuid) -> Result<ChainOfCustody, EvidenceError> {
        self.custody_log.get(&evidence_id)
            .cloned()
            .ok_or_else(|| EvidenceError::ChainOfCustodyError(
                format!("Evidence {} not found", evidence_id)
            ))
    }

    /// Verify chain of custody integrity
    pub fn verify_chain(&self, evidence_id: Uuid) -> Result<ChainVerification, EvidenceError> {
        let chain = self.get_chain(evidence_id)?;
        let verification = self.validation_rules.verify_chain(&chain);
        Ok(verification)
    }

    /// Generate digital signature for custody entry
    fn generate_signature(&self, evidence: &Evidence) -> String {
        // In a real implementation, this would use cryptographic signing
        format!("SIGNED_{}_{}", evidence.evidence_id, Utc::now().timestamp())
    }

    /// Generate transfer signature
    fn generate_transfer_signature(&self, from: &str, to: &str) -> String {
        format!("XFER_{}_TO_{}_{}", from, to, Utc::now().timestamp())
    }
}

/// Complete Chain of Custody for evidence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainOfCustody {
    pub evidence_id: Uuid,
    pub entries: Vec<CustodyEntry>,
    pub created_at: DateTime<Utc>,
    pub last_updated: DateTime<Utc>,
}

impl ChainOfCustody {
    pub fn new(evidence_id: Uuid) -> Self {
        Self {
            evidence_id,
            entries: Vec::new(),
            created_at: Utc::now(),
            last_updated: Utc::now(),
        }
    }

    pub fn add_entry(&mut self, entry: CustodyEntry) {
        self.entries.push(entry);
        self.last_updated = Utc::now();
    }

    pub fn is_complete(&self) -> bool {
        // Check if chain has proper beginning and end
        !self.entries.is_empty() && 
        self.entries.first().unwrap().action == CustodyAction::Collection
    }

    pub fn get_last_custodian(&self) -> Option<&str> {
        self.entries.last().map(|entry| entry.actor.as_str())
    }
}

/// Individual Custody Entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustodyEntry {
    pub custody_id: Uuid,
    pub evidence_id: Uuid,
    pub action: CustodyAction,
    pub actor: String,
    pub timestamp: DateTime<Utc>,
    pub location: String,
    pub notes: String,
    pub signature: String,
}

/// Access Record Keeper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessRecordKeeper {
    pub access_log: Vec<AccessRecord>,
    pub access_policies: AccessPolicies,
}

impl AccessRecordKeeper {
    pub fn new() -> Self {
        Self {
            access_log: Vec::new(),
            access_policies: AccessPolicies::default(),
        }
    }

    pub fn record_access(&mut self, requester: &str) -> Result<(), EvidenceError> {
        // Validate requester input
        if requester.is_empty() || requester.len() > 255 {
            return Err(EvidenceError::ValidationError(
                "Invalid requester name length".to_string()
            ));
        }

        // Validate requester contains only valid characters
        if !requester.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.') {
            return Err(EvidenceError::ValidationError(
                "Requester contains invalid characters".to_string()
            ));
        }

        let record = AccessRecord {
            access_id: Uuid::new_v4(),
            requester: requester.to_string(),
            timestamp: Utc::now(),
            action: AccessAction::View,
            justification: "Evidence retrieval".to_string(),
        };
        
        self.access_log.push(record);
        Ok(())
    }

    pub fn get_access_log(&self) -> &[AccessRecord] {
        &self.access_log
    }
}

/// Access Record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessRecord {
    pub access_id: Uuid,
    pub requester: String,
    pub timestamp: DateTime<Utc>,
    pub action: AccessAction,
    pub justification: String,
}

/// Transfer Protocol
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferProtocol {
    pub require_dual_authorization: bool,
    pub transfer_timeout: Duration,
    pub verification_required: bool,
    pub logging_level: LoggingLevel,
}

impl Default for TransferProtocol {
    fn default() -> Self {
        Self {
            require_dual_authorization: true,
            transfer_timeout: Duration::new(3600), // 1 hour
            verification_required: true,
            logging_level: LoggingLevel::Detailed,
        }
    }
}

impl TransferProtocol {
    pub fn validate_transfer(&self, chain: &ChainOfCustody, entry: &CustodyEntry) -> Result<(), EvidenceError> {
        // Check if transfer requires dual authorization
        if self.require_dual_authorization {
            // In real implementation, verify both parties authorized
        }
        
        // Check transfer timeout
        if let Some(last_entry) = chain.entries.last() {
            let time_since_last = entry.timestamp - last_entry.timestamp;
            if time_since_last.num_seconds() > self.transfer_timeout.value as i64 {
                return Err(EvidenceError::ChainOfCustodyError(
                    "Transfer timeout exceeded".to_string()
                ));
            }
        }
        
        Ok(())
    }
}

/// Validation Rule Set
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationRuleSet {
    pub require_timestamps: bool,
    pub require_signatures: bool,
    pub max_gap_duration: Duration,
    pub allowed_actions: Vec<CustodyAction>,
}

impl Default for ValidationRuleSet {
    fn default() -> Self {
        Self {
            require_timestamps: true,
            require_signatures: true,
            max_gap_duration: Duration::new(86400), // 24 hours
            allowed_actions: vec![
                CustodyAction::Collection,
                CustodyAction::Transfer,
                CustodyAction::Analysis,
                CustodyAction::Storage,
            ],
        }
    }
}

impl ValidationRuleSet {
    pub fn validate_entry(&self, chain: &ChainOfCustody, entry: &CustodyEntry) -> Result<(), EvidenceError> {
        // Check timestamp requirement
        if self.require_timestamps && entry.timestamp < chain.last_updated {
            return Err(EvidenceError::ChainOfCustodyError(
                "Entry timestamp precedes last update".to_string()
            ));
        }
        
        // Check signature requirement
        if self.require_signatures && entry.signature.is_empty() {
            return Err(EvidenceError::ChainOfCustodyError(
                "Signature required for custody entry".to_string()
            ));
        }
        
        // Check allowed actions
        if !self.allowed_actions.contains(&entry.action) {
            return Err(EvidenceError::ChainOfCustodyError(
                format!("Action {:?} not allowed", entry.action)
            ));
        }
        
        Ok(())
    }
    
    pub fn verify_chain(&self, chain: &ChainOfCustody) -> ChainVerification {
        let mut issues = Vec::new();
        
        // Check chain completeness
        if !chain.is_complete() {
            issues.push("Chain of custody is incomplete".to_string());
        }
        
        // Check for time gaps
        for i in 1..chain.entries.len() {
            let prev = &chain.entries[i - 1];
            let current = &chain.entries[i];
            
            let gap = current.timestamp - prev.timestamp;
            if gap.num_seconds() > self.max_gap_duration.value as i64 {
                issues.push(format!(
                    "Large time gap between entries {} and {}: {} seconds",
                    i - 1, i, gap.num_seconds()
                ));
            }
        }
        
        ChainVerification {
            chain_id: chain.evidence_id,
            is_valid: issues.is_empty(),
            issues,
            verified_at: Utc::now(),
        }
    }
}

/// Access Policies
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessPolicies {
    pub allowed_users: Vec<String>,
    pub access_levels: HashMap<String, AccessLevel>,
    pub audit_required: bool,
}

impl Default for AccessPolicies {
    fn default() -> Self {
        Self {
            allowed_users: Vec::new(),
            access_levels: HashMap::new(),
            audit_required: true,
        }
    }
}

/// Chain Verification Result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainVerification {
    pub chain_id: Uuid,
    pub is_valid: bool,
    pub issues: Vec<String>,
    pub verified_at: DateTime<Utc>,
}

// Enums
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CustodyAction {
    Collection,
    Transfer,
    Analysis,
    Storage,
    Destruction,
    Return,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AccessAction {
    View,
    Modify,
    Copy,
    Export,
    Delete,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AccessLevel {
    ReadOnly,
    ReadWrite,
    Administrative,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LoggingLevel {
    Minimal,
    Standard,
    Detailed,
    Forensic,
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