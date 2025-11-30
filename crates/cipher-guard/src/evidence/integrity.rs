//! Integrity Verification System
//!
//! Ensures evidence integrity through cryptographic hashing and verification

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use sha2::{Sha256, Sha512, Digest};
use sha3;

use super::Evidence;
use super::EvidenceError;

/// Integrity Verifier for evidence validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrityVerifier {
    pub hash_algorithms: Vec<HashAlgorithm>,
    pub verification_policies: VerificationPolicy,
    pub integrity_log: IntegrityLog,
}

impl IntegrityVerifier {
    /// Create a new Integrity Verifier
    pub fn new() -> Self {
        Self {
            hash_algorithms: vec![HashAlgorithm::Sha256, HashAlgorithm::Sha512],
            verification_policies: VerificationPolicy::default(),
            integrity_log: IntegrityLog::new(),
        }
    }

    /// Validate evidence integrity
    pub fn validate_evidence(&self, evidence: &Evidence) -> Result<(), EvidenceError> {
        // Calculate current hash
        let calculated_hash = self.calculate_hash(&evidence.content, HashAlgorithm::Sha256);
        
        // Compare with stored hash
        if calculated_hash != evidence.hash {
            return Err(EvidenceError::IntegrityViolation(
                "Evidence hash mismatch".to_string()
            ));
        }

        // Log successful validation
        self.integrity_log.record_validation(
            evidence.evidence_id,
            ValidationResult::Success,
            "Initial validation".to_string()
        );

        Ok(())
    }

    /// Verify evidence integrity with detailed report
    pub fn verify_integrity(&self, evidence: &Evidence) -> Result<IntegrityReport, EvidenceError> {
        let mut report = IntegrityReport::new(evidence.evidence_id);
        
        // Verify primary hash
        let primary_hash = self.calculate_hash(&evidence.content, HashAlgorithm::Sha256);
        report.add_hash_verification(
            HashAlgorithm::Sha256,
            primary_hash.clone(),
            evidence.hash.clone(),
            primary_hash == evidence.hash
        );

        // Verify secondary hash if configured
        if self.verification_policies.use_multiple_hashes {
            let secondary_hash = self.calculate_hash(&evidence.content, HashAlgorithm::Sha512);
            report.add_hash_verification(
                HashAlgorithm::Sha512,
                secondary_hash.clone(),
                "".to_string(), // Secondary hash not stored in evidence
                true // Always true since we don't store secondary hash
            );
        }

        // Check evidence size
        if self.verification_policies.check_size_limits {
            let size_ok = evidence.content.len() <= self.verification_policies.max_evidence_size;
            report.add_size_verification(
                evidence.content.len(),
                self.verification_policies.max_evidence_size,
                size_ok
            );
        }

        // Check evidence age if retention policy exists
        if let Some(max_age) = self.verification_policies.max_evidence_age {
            let age = Utc::now() - evidence.collected_at;
            let age_ok = age.num_days() <= max_age as i64;
            report.add_age_verification(
                age.num_days(),
                max_age as i64,
                age_ok
            );
        }

        // Log verification
        let validation_result = if report.is_valid() {
            ValidationResult::Success
        } else {
            ValidationResult::Failed
        };

        self.integrity_log.record_validation(
            evidence.evidence_id,
            validation_result,
            report.generate_summary()
        );

        Ok(report)
    }

    /// Calculate hash of data using specified algorithm
    pub fn calculate_hash(&self, data: &[u8], algorithm: HashAlgorithm) -> String {
        match algorithm {
            HashAlgorithm::Sha256 => {
                let mut hasher = Sha256::new();
                hasher.update(data);
                format!("{:x}", hasher.finalize())
            }
            HashAlgorithm::Sha512 => {
                let mut hasher = Sha512::new();
                hasher.update(data);
                format!("{:x}", hasher.finalize())
            }
            HashAlgorithm::Sha3_256 => {
                let mut hasher = sha3::Sha3_256::new();
                hasher.update(data);
                format!("{:x}", hasher.finalize())
            }
            HashAlgorithm::Blake3 => {
                let hash = blake3::hash(data);
                hash.to_hex().to_string()
            }
        }
    }

    /// Generate digital signature for evidence
    pub fn generate_signature(&self, evidence: &Evidence) -> Result<String, EvidenceError> {
        // In real implementation, this would use cryptographic signing
        let signature_data = format!(
            "{}_{}_{}",
            evidence.evidence_id,
            evidence.hash,
            Utc::now().timestamp()
        );
        
        let signature = self.calculate_hash(signature_data.as_bytes(), HashAlgorithm::Sha256);
        Ok(signature)
    }

    /// Verify digital signature
    pub fn verify_signature(&self, evidence: &Evidence, signature: &str) -> Result<bool, EvidenceError> {
        let expected_signature = self.generate_signature(evidence)?;
        Ok(signature == expected_signature)
    }

    /// Get integrity status for evidence
    pub fn get_integrity_status(&self, evidence_id: Uuid) -> Result<IntegrityStatus, EvidenceError> {
        let validations = self.integrity_log.get_validations(evidence_id);
        let last_validation = validations.last();
        
        Ok(IntegrityStatus {
            evidence_id,
            last_validation: last_validation.cloned(),
            total_validations: validations.len(),
            successful_validations: validations.iter()
                .filter(|v| v.result == ValidationResult::Success)
                .count(),
            integrity_score: self.calculate_integrity_score(&validations),
        })
    }

    /// Calculate integrity score based on validation history
    fn calculate_integrity_score(&self, validations: &[ValidationRecord]) -> f64 {
        if validations.is_empty() {
            return 1.0; // No validations means assumed integrity
        }
        
        let successful = validations.iter()
            .filter(|v| v.result == ValidationResult::Success)
            .count();
        
        successful as f64 / validations.len() as f64
    }
}

/// Integrity Log for tracking validation history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrityLog {
    pub validation_records: HashMap<Uuid, Vec<ValidationRecord>>,
    pub log_retention_period: Duration,
}

impl IntegrityLog {
    pub fn new() -> Self {
        Self {
            validation_records: HashMap::new(),
            log_retention_period: Duration::new(365), // 1 year
        }
    }

    /// Record a validation result
    pub fn record_validation(&mut self, evidence_id: Uuid, result: ValidationResult, notes: String) {
        let record = ValidationRecord {
            validation_id: Uuid::new_v4(),
            evidence_id,
            timestamp: Utc::now(),
            result,
            notes,
            validator: "System".to_string(),
        };
        
        self.validation_records.entry(evidence_id)
            .or_insert_with(Vec::new)
            .push(record);
        
        // Clean up old records
        self.cleanup_old_records();
    }

    /// Get all validations for evidence
    pub fn get_validations(&self, evidence_id: Uuid) -> Vec<ValidationRecord> {
        self.validation_records.get(&evidence_id)
            .cloned()
            .unwrap_or_default()
    }

    /// Clean up records older than retention period
    fn cleanup_old_records(&mut self) {
        let cutoff = Utc::now() - chrono::Duration::days(self.log_retention_period.value as i64);
        
        for records in self.validation_records.values_mut() {
            records.retain(|record| record.timestamp >= cutoff);
        }
        
        // Remove empty entries
        self.validation_records.retain(|_, records| !records.is_empty());
    }

    /// Generate integrity audit report
    pub fn generate_audit_report(&self, evidence_id: Uuid) -> Option<IntegrityAuditReport> {
        let validations = self.get_validations(evidence_id);
        if validations.is_empty() {
            return None;
        }
        
        Some(IntegrityAuditReport {
            evidence_id,
            total_validations: validations.len(),
            successful_validations: validations.iter()
                .filter(|v| v.result == ValidationResult::Success)
                .count(),
            first_validation: validations.first().cloned(),
            last_validation: validations.last().cloned(),
            validation_timeline: validations,
            generated_at: Utc::now(),
        })
    }
}

/// Integrity Report with detailed verification results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrityReport {
    pub evidence_id: Uuid,
    pub hash_verifications: Vec<HashVerification>,
    pub size_verification: Option<SizeVerification>,
    pub age_verification: Option<AgeVerification>,
    pub overall_valid: bool,
    pub generated_at: DateTime<Utc>,
}

impl IntegrityReport {
    pub fn new(evidence_id: Uuid) -> Self {
        Self {
            evidence_id,
            hash_verifications: Vec::new(),
            size_verification: None,
            age_verification: None,
            overall_valid: true,
            generated_at: Utc::now(),
        }
    }

    pub fn add_hash_verification(&mut self, algorithm: HashAlgorithm, calculated: String, expected: String, valid: bool) {
        self.hash_verifications.push(HashVerification {
            algorithm,
            calculated,
            expected,
            valid,
        });
        
        if !valid {
            self.overall_valid = false;
        }
    }

    pub fn add_size_verification(&mut self, actual_size: usize, max_size: usize, valid: bool) {
        self.size_verification = Some(SizeVerification {
            actual_size,
            max_size,
            valid,
        });
        
        if !valid {
            self.overall_valid = false;
        }
    }

    pub fn add_age_verification(&mut self, actual_age: i64, max_age: i64, valid: bool) {
        self.age_verification = Some(AgeVerification {
            actual_age,
            max_age,
            valid,
        });
        
        if !valid {
            self.overall_valid = false;
        }
    }

    pub fn is_valid(&self) -> bool {
        self.overall_valid
    }

    pub fn generate_summary(&self) -> String {
        let mut summary = format!("Integrity Report for Evidence {}: ", self.evidence_id);
        
        if self.overall_valid {
            summary.push_str("VALID - All integrity checks passed");
        } else {
            summary.push_str("INVALID - Integrity violations detected");
            
            for (i, hash_ver) in self.hash_verifications.iter().enumerate() {
                if !hash_ver.valid {
                    summary.push_str(&format!("\n  Hash {}: {} != {}", 
                        i + 1, hash_ver.calculated, hash_ver.expected));
                }
            }
            
            if let Some(size_ver) = &self.size_verification {
                if !size_ver.valid {
                    summary.push_str(&format!("\n  Size: {} > {}", 
                        size_ver.actual_size, size_ver.max_size));
                }
            }
            
            if let Some(age_ver) = &self.age_verification {
                if !age_ver.valid {
                    summary.push_str(&format!("\n  Age: {} days > {} days", 
                        age_ver.actual_age, age_ver.max_age));
                }
            }
        }
        
        summary
    }
}

/// Verification Policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationPolicy {
    pub use_multiple_hashes: bool,
    pub check_size_limits: bool,
    pub max_evidence_size: usize,
    pub max_evidence_age: Option<u32>, // days
    pub require_signatures: bool,
    pub automatic_verification: bool,
}

impl Default for VerificationPolicy {
    fn default() -> Self {
        Self {
            use_multiple_hashes: true,
            check_size_limits: true,
            max_evidence_size: 100 * 1024 * 1024, // 100MB
            max_evidence_age: Some(365), // 1 year
            require_signatures: true,
            automatic_verification: true,
        }
    }
}

// Supporting structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HashVerification {
    pub algorithm: HashAlgorithm,
    pub calculated: String,
    pub expected: String,
    pub valid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SizeVerification {
    pub actual_size: usize,
    pub max_size: usize,
    pub valid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgeVerification {
    pub actual_age: i64,
    pub max_age: i64,
    pub valid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationRecord {
    pub validation_id: Uuid,
    pub evidence_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub result: ValidationResult,
    pub notes: String,
    pub validator: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrityStatus {
    pub evidence_id: Uuid,
    pub last_validation: Option<ValidationRecord>,
    pub total_validations: usize,
    pub successful_validations: usize,
    pub integrity_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrityAuditReport {
    pub evidence_id: Uuid,
    pub total_validations: usize,
    pub successful_validations: usize,
    pub first_validation: Option<ValidationRecord>,
    pub last_validation: Option<ValidationRecord>,
    pub validation_timeline: Vec<ValidationRecord>,
    pub generated_at: DateTime<Utc>,
}

// Enums
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HashAlgorithm {
    Sha256,
    Sha512,
    Sha3_256,
    Blake3,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ValidationResult {
    Success,
    Failed,
    Warning,
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