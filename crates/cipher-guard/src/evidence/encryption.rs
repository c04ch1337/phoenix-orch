//! Encryption System for Evidence Protection
//!
//! Provides encryption capabilities for evidence at rest and in transit

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use ring::{aead, rand};
#[macro_use]
extern crate array_ref;

use super::Evidence;
use super::EvidenceError;
use super::SensitivityLevel;

/// Encryption System for evidence protection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionSystem {
    pub at_rest_encryption: AtRestEncryption,
    pub in_transit_encryption: InTransitEncryption,
    pub key_management: KeyManagementSystem,
    pub encryption_policies: EncryptionPolicy,
    pub rbac: RbacSystem,
    pub current_role: Role,
}

impl EncryptionSystem {
    /// Create a new Encryption System
    pub fn new() -> Result<Self, EvidenceError> {
        let key_management = KeyManagementSystem::new()?;
        
        Ok(Self {
            at_rest_encryption: AtRestEncryption::new(),
            in_transit_encryption: InTransitEncryption::new(),
            key_management,
            encryption_policies: EncryptionPolicy::default(),
            rbac: RbacSystem::new(),
            current_role: Role::default(),
        })
    }

    /// Encrypt evidence
    pub fn encrypt_evidence(&self, evidence: Evidence) -> Result<EncryptedEvidence, EvidenceError> {
        // Validate encryption requirements
        self.encryption_policies.validate_encryption_requirements(&evidence)?;
        
        // Get appropriate encryption key
        let key_id = self.key_management.get_encryption_key(&evidence)?;
        
        // Encrypt based on evidence type and sensitivity
        let encrypted_data = match evidence.metadata.sensitivity_level {
            SensitivityLevel::Public => {
                // Minimal encryption for public data
                self.at_rest_encryption.encrypt_minimal(&evidence.content, &key_id)?
            }
            SensitivityLevel::Internal => {
                // Standard encryption for internal data
                self.at_rest_encryption.encrypt_standard(&evidence.content, &key_id)?
            }
            SensitivityLevel::Confidential => {
                // Strong encryption for confidential data
                self.at_rest_encryption.encrypt_strong(&evidence.content, &key_id)?
            }
            SensitivityLevel::Secret | SensitivityLevel::TopSecret => {
                // Maximum encryption for secret data
                self.at_rest_encryption.encrypt_maximum(&evidence.content, &key_id)?
            }
        };

        Ok(EncryptedEvidence {
            evidence_id: evidence.evidence_id,
            encrypted_data,
            encryption_metadata: EncryptionMetadata {
                key_id,
                algorithm: self.at_rest_encryption.algorithm.clone(),
                encryption_time: Utc::now(),
                iv: encrypted_data.iv.clone(),
            },
            original_hash: evidence.hash,
        })
    }

    /// Decrypt evidence
    pub fn decrypt_evidence(&self, encrypted_evidence: EncryptedEvidence) -> Result<Evidence, EvidenceError> {
        // Verify encryption metadata
        self.encryption_policies.verify_encryption_metadata(&encrypted_evidence.encryption_metadata)?;
        
        // Get decryption key
        let key = self.key_management.get_decryption_key(&encrypted_evidence.encryption_metadata.key_id)?;
        
        // Decrypt data
        let decrypted_data = self.at_rest_encryption.decrypt(
            &encrypted_evidence.encrypted_data,
            &key,
            &encrypted_evidence.encryption_metadata.iv
        )?;
        
        // Verify hash integrity
        let calculated_hash = Evidence::calculate_hash(&decrypted_data);
        if calculated_hash != encrypted_evidence.original_hash {
            return Err(EvidenceError::IntegrityViolation(
                "Hash mismatch after decryption".to_string()
            ));
        }

        // Reconstruct evidence (in real implementation, you'd have more metadata)
        Ok(Evidence {
            evidence_id: encrypted_evidence.evidence_id,
            evidence_type: EvidenceType::Document, // This would be stored in metadata
            content: decrypted_data,
            metadata: EvidenceMetadata::default(), // This would be reconstructed
            collected_at: Utc::now(),
            collector: "System".to_string(),
            hash: calculated_hash,
        })
    }

    /// Rotate encryption keys
    pub fn rotate_keys(&mut self) -> Result<KeyRotationReport, EvidenceError> {
        self.key_management.rotate_keys()
    }

    /// Get encryption status
    pub fn get_encryption_status(&self) -> EncryptionStatus {
        EncryptionStatus {
            total_keys: self.key_management.keys.len(),
            active_keys: self.key_management.keys.iter()
                .filter(|(_, key)| key.status == KeyStatus::Active)
                .count(),
            encryption_operations: self.at_rest_encryption.operations_count,
            last_key_rotation: self.key_management.last_rotation,
        }
    }
}

/// At-rest encryption implementation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AtRestEncryption {
    pub algorithm: EncryptionAlgorithm,
    pub key_size: KeySize,
    pub operations_count: u64,
}

impl AtRestEncryption {
    pub fn new() -> Self {
        Self {
            algorithm: EncryptionAlgorithm::Aes256Gcm,
            key_size: KeySize::Bits256,
            operations_count: 0,
        }
    }

    /// Minimal encryption (AES-128)
    pub fn encrypt_minimal(&mut self, data: &[u8], key_id: &str) -> Result<EncryptedData, EvidenceError> {
        self.encrypt_with_algorithm(data, key_id, EncryptionAlgorithm::Aes128Gcm)
    }

    /// Standard encryption (AES-256)
    pub fn encrypt_standard(&mut self, data: &[u8], key_id: &str) -> Result<EncryptedData, EvidenceError> {
        self.encrypt_with_algorithm(data, key_id, EncryptionAlgorithm::Aes256Gcm)
    }

    /// Strong encryption (ChaCha20-Poly1305)
    pub fn encrypt_strong(&mut self, data: &[u8], key_id: &str) -> Result<EncryptedData, EvidenceError> {
        self.encrypt_with_algorithm(data, key_id, EncryptionAlgorithm::ChaCha20Poly1305)
    }

    /// Maximum encryption (AES-256 with additional layers)
    pub fn encrypt_maximum(&mut self, data: &[u8], key_id: &str) -> Result<EncryptedData, EvidenceError> {
        // Multiple layers of encryption
        let first_pass = self.encrypt_strong(data, key_id)?;
        let second_pass = self.encrypt_standard(&first_pass.ciphertext, key_id)?;
        
        Ok(EncryptedData {
            ciphertext: second_pass.ciphertext,
            iv: first_pass.iv, // Use IV from first pass
            auth_tag: second_pass.auth_tag,
        })
    }

    /// Generic encryption method
    fn encrypt_with_algorithm(
        &mut self,
        data: &[u8],
        key_id: &str,
        algorithm: EncryptionAlgorithm,
    ) -> Result<EncryptedData, EvidenceError> {
        let mut rng = rand::SystemRandom::new();
        let mut iv = [0u8; 12];
        rng.fill(&mut iv).map_err(|e| EvidenceError::EncryptionError(e.to_string()))?;

        // Get encryption key from key management
        let key = self.key_management.get_decryption_key(key_id)?;

        // Create sealing key based on algorithm
        let sealing_key = match algorithm {
            EncryptionAlgorithm::Aes128Gcm => {
                aead::UnboundKey::new(&aead::AES_128_GCM, &key.key_data)
                    .map_err(|e| EvidenceError::EncryptionError(e.to_string()))?
            }
            EncryptionAlgorithm::Aes256Gcm => {
                aead::UnboundKey::new(&aead::AES_256_GCM, &key.key_data)
                    .map_err(|e| EvidenceError::EncryptionError(e.to_string()))?
            }
            EncryptionAlgorithm::ChaCha20Poly1305 => {
                aead::UnboundKey::new(&aead::CHACHA20_POLY1305, &key.key_data)
                    .map_err(|e| EvidenceError::EncryptionError(e.to_string()))?
            }
        };

        let sealing_key = aead::LessSafeKey::new(sealing_key);
        let nonce = aead::Nonce::assume_unique_for_key(iv);
        
        // Encrypt data
        let mut ciphertext = data.to_vec();
        let auth_tag = sealing_key
            .seal_in_place_separate_tag(nonce, aead::Aad::empty(), &mut ciphertext)
            .map_err(|e| EvidenceError::EncryptionError(e.to_string()))?;

        self.operations_count += 1;

        Ok(EncryptedData {
            ciphertext,
            iv: iv.to_vec(),
            auth_tag: auth_tag.as_ref().to_vec(),
        })
    }

    /// Decrypt data
    pub fn decrypt(
        &self,
        encrypted_data: &EncryptedData,
        key: &EncryptionKey,
        iv: &[u8],
    ) -> Result<Vec<u8>, EvidenceError> {
        // Create opening key based on algorithm
        let opening_key = match self.algorithm {
            EncryptionAlgorithm::Aes128Gcm => {
                aead::UnboundKey::new(&aead::AES_128_GCM, &key.key_data)
                    .map_err(|e| EvidenceError::EncryptionError(e.to_string()))?
            }
            EncryptionAlgorithm::Aes256Gcm => {
                aead::UnboundKey::new(&aead::AES_256_GCM, &key.key_data)
                    .map_err(|e| EvidenceError::EncryptionError(e.to_string()))?
            }
            EncryptionAlgorithm::ChaCha20Poly1305 => {
                aead::UnboundKey::new(&aead::CHACHA20_POLY1305, &key.key_data)
                    .map_err(|e| EvidenceError::EncryptionError(e.to_string()))?
            }
        };

        let opening_key = aead::LessSafeKey::new(opening_key);
        let nonce = aead::Nonce::assume_unique_for_key(*array_ref!(iv, 0, 12));

        // Combine ciphertext and auth tag
        let mut in_out = encrypted_data.ciphertext.clone();
        in_out.extend_from_slice(&encrypted_data.auth_tag);

        // Decrypt data
        let decrypted_data = opening_key
            .open_in_place(nonce, aead::Aad::empty(), &mut in_out)
            .map_err(|e| EvidenceError::EncryptionError(e.to_string()))?;

        Ok(decrypted_data.to_vec())
    }
}

/// In-transit encryption
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InTransitEncryption {
    pub protocol: TransportProtocol,
    pub certificate_authority: String,
    pub perfect_forward_secrecy: bool,
}

impl InTransitEncryption {
    pub fn new() -> Self {
        Self {
            protocol: TransportProtocol::Tls13,
            certificate_authority: "CipherGuard CA".to_string(),
            perfect_forward_secrecy: true,
        }
    }
}

/// Key Management System using age encryption
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyManagementSystem {
    pub keys: HashMap<String, EncryptionKey>,
    pub key_rotation_policy: KeyRotationPolicy,
    pub last_rotation: DateTime<Utc>,
    pub age_identities: HashMap<String, secrecy::Secret<String>>,
}

impl KeyManagementSystem {
    pub fn new() -> Result<Self, EvidenceError> {
        let mut keys = HashMap::new();
        let mut age_identities = HashMap::new();
        
        // Generate initial master key using age
        let master_identity = age::x25519::Identity::generate();
        let master_key = EncryptionKey::generate_master_with_age(&master_identity)?;
        
        // Store the identity securely
        age_identities.insert(
            "master".to_string(),
            secrecy::Secret::new(master_identity.to_string())
        );
        keys.insert("master".to_string(), master_key);
        
        Ok(Self {
            keys,
            key_rotation_policy: KeyRotationPolicy::default(),
            last_rotation: Utc::now(),
            age_identities,
        })
    }

    pub fn get_encryption_key(&self, evidence: &Evidence) -> Result<String, EvidenceError> {
        // Select appropriate key based on evidence sensitivity
        let key_id = match evidence.metadata.sensitivity_level {
            SensitivityLevel::Public => "public",
            SensitivityLevel::Internal => "internal",
            SensitivityLevel::Confidential => "confidential",
            SensitivityLevel::Secret => "secret",
            SensitivityLevel::TopSecret => "topsecret",
        };
        
        if self.keys.contains_key(key_id) {
            Ok(key_id.to_string())
        } else {
            // Fallback to master key
            Ok("master".to_string())
        }
    }

    pub fn get_decryption_key(&self, key_id: &str) -> Result<EncryptionKey, EvidenceError> {
        self.keys.get(key_id)
            .cloned()
            .ok_or_else(|| EvidenceError::EncryptionError(
                format!("Key {} not found", key_id)
            ))
    }

    pub fn rotate_keys(&mut self) -> Result<KeyRotationReport, EvidenceError> {
        let mut report = KeyRotationReport::new();
        
        // Rotate all keys except master
        for key_id in self.keys.keys().cloned().collect::<Vec<_>>() {
            if key_id != "master" {
                // Generate new age identity for the key
                let new_identity = age::x25519::Identity::generate();
                let new_key = EncryptionKey::generate_with_age(&new_identity, &key_id)?;
                
                // Store new identity and key
                self.age_identities.insert(
                    key_id.clone(),
                    secrecy::Secret::new(new_identity.to_string())
                );
                self.keys.insert(key_id.clone(), new_key);
                
                report.keys_rotated.push(key_id);
            }
        }
        
        self.last_rotation = Utc::now();
        report.rotation_time = self.last_rotation;
        
        Ok(report)
    }

    // Re-encrypt data with new key
    pub async fn reencrypt_data(&self, data: &[u8], old_key: &EncryptionKey, new_key: &EncryptionKey) -> Result<Vec<u8>, EvidenceError> {
        // Decrypt with old key
        let decrypted = self.decrypt_with_age(data, old_key)?;
        
        // Encrypt with new key
        self.encrypt_with_age(&decrypted, new_key)
    }

    // Encrypt data using age
    fn encrypt_with_age(&self, data: &[u8], key: &EncryptionKey) -> Result<Vec<u8>, EvidenceError> {
        let recipient = age::x25519::Recipient::from_str(&key.key_data_str())
            .map_err(|e| EvidenceError::EncryptionError(e.to_string()))?;

        let encryptor = age::Encryptor::with_recipients(vec![Box::new(recipient)])
            .map_err(|e| EvidenceError::EncryptionError(e.to_string()))?;

        let mut encrypted = vec![];
        let mut writer = encryptor.wrap_output(&mut encrypted)
            .map_err(|e| EvidenceError::EncryptionError(e.to_string()))?;

        writer.write_all(data)
            .map_err(|e| EvidenceError::EncryptionError(e.to_string()))?;
        writer.finish()
            .map_err(|e| EvidenceError::EncryptionError(e.to_string()))?;

        Ok(encrypted)
    }

    // Decrypt data using age
    fn decrypt_with_age(&self, encrypted_data: &[u8], key: &EncryptionKey) -> Result<Vec<u8>, EvidenceError> {
        let identity = age::x25519::Identity::from_str(
            secrecy::ExposeSecret::expose_secret(
                self.age_identities.get(&key.key_id)
                    .ok_or_else(|| EvidenceError::EncryptionError("Identity not found".to_string()))?
            )
        ).map_err(|e| EvidenceError::EncryptionError(e.to_string()))?;

        let decryptor = match age::Decryptor::new(encrypted_data)
            .map_err(|e| EvidenceError::EncryptionError(e.to_string()))? {
            age::Decryptor::Recipients(d) => d,
            _ => return Err(EvidenceError::EncryptionError("Invalid decryptor type".to_string())),
        };

        let mut decrypted = vec![];
        let mut reader = decryptor.decrypt(vec![Box::new(identity) as Box<dyn age::Identity>].iter())
            .map_err(|e| EvidenceError::EncryptionError(e.to_string()))?;

        reader.read_to_end(&mut decrypted)
            .map_err(|e| EvidenceError::EncryptionError(e.to_string()))?;

        Ok(decrypted)
    }
}

/// Encryption Policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionPolicy {
    pub minimum_encryption_level: EncryptionLevel,
    pub require_encryption: bool,
    pub key_rotation_interval: Duration,
    pub audit_encryption_operations: bool,
}

impl Default for EncryptionPolicy {
    fn default() -> Self {
        Self {
            minimum_encryption_level: EncryptionLevel::Aes256,
            require_encryption: true,
            key_rotation_interval: Duration::new(90), // 90 days
            audit_encryption_operations: true,
        }
    }
}

impl EncryptionPolicy {
    pub fn validate_encryption_requirements(&self, evidence: &Evidence) -> Result<(), EvidenceError> {
        if self.require_encryption && evidence.metadata.sensitivity_level == SensitivityLevel::Public {
            return Err(EvidenceError::EncryptionError(
                "Encryption required for all evidence".to_string()
            ));
        }
        Ok(())
    }

    pub fn verify_encryption_metadata(&self, metadata: &EncryptionMetadata) -> Result<(), EvidenceError> {
        // Check if encryption algorithm meets minimum requirements
        let algorithm_level = match metadata.algorithm {
            EncryptionAlgorithm::Aes128Gcm => EncryptionLevel::Aes128,
            EncryptionAlgorithm::Aes256Gcm => EncryptionLevel::Aes256,
            EncryptionAlgorithm::ChaCha20Poly1305 => EncryptionLevel::ChaCha20,
        };
        
        if algorithm_level < self.minimum_encryption_level {
            return Err(EvidenceError::EncryptionError(
                format!("Encryption level {:?} below minimum {:?}", 
                    algorithm_level, self.minimum_encryption_level)
            ));
        }
        
        Ok(())
    }
}

// Supporting structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedEvidence {
    pub evidence_id: Uuid,
    pub encrypted_data: EncryptedData,
    pub encryption_metadata: EncryptionMetadata,
    pub original_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedData {
    pub ciphertext: Vec<u8>,
    pub iv: Vec<u8>,
    pub auth_tag: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionMetadata {
    pub key_id: String,
    pub algorithm: EncryptionAlgorithm,
    pub encryption_time: DateTime<Utc>,
    pub iv: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionKey {
    pub key_id: String,
    pub key_data: Vec<u8>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub status: KeyStatus,
    pub key_type: KeyType,
}

impl EncryptionKey {
    pub fn generate_master_with_age(identity: &age::x25519::Identity) -> Result<Self, EvidenceError> {
        Ok(Self {
            key_id: "master".to_string(),
            key_data: identity.to_string().into_bytes(),
            created_at: Utc::now(),
            expires_at: Utc::now() + chrono::Duration::days(365),
            status: KeyStatus::Active,
            key_type: KeyType::Master,
        })
    }

    pub fn generate_with_age(identity: &age::x25519::Identity, key_id: &str) -> Result<Self, EvidenceError> {
        Ok(Self {
            key_id: key_id.to_string(),
            key_data: identity.to_string().into_bytes(),
            created_at: Utc::now(),
            expires_at: Utc::now() + chrono::Duration::days(90),
            status: KeyStatus::Active,
            key_type: KeyType::Data,
        })
    }

    pub fn key_data_str(&self) -> String {
        String::from_utf8_lossy(&self.key_data).to_string()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyRotationReport {
    pub keys_rotated: Vec<String>,
    pub rotation_time: DateTime<Utc>,
    pub success: bool,
}

impl KeyRotationReport {
    pub fn new() -> Self {
        Self {
            keys_rotated: Vec::new(),
            rotation_time: Utc::now(),
            success: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionStatus {
    pub total_keys: usize,
    pub active_keys: usize,
    pub encryption_operations: u64,
    pub last_key_rotation: DateTime<Utc>,
}

// RBAC System
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RbacSystem {
    pub roles: HashMap<String, Role>,
    pub permissions: HashMap<String, Vec<Permission>>,
    pub role_assignments: HashMap<String, Vec<String>>, // user -> roles
    pub operation_log: Vec<RbacOperationLog>,
}

impl RbacSystem {
    pub fn new() -> Self {
        let mut roles = HashMap::new();
        let mut permissions = HashMap::new();
        
        // Initialize default roles
        roles.insert("admin".to_string(), Role::new_admin());
        roles.insert("operator".to_string(), Role::new_operator());
        roles.insert("auditor".to_string(), Role::new_auditor());
        
        // Initialize default permissions
        permissions.insert("admin".to_string(), vec![
            Permission::Encrypt,
            Permission::Decrypt,
            Permission::RotateKeys,
            Permission::ManageRoles,
        ]);
        permissions.insert("operator".to_string(), vec![
            Permission::Encrypt,
            Permission::Decrypt,
        ]);
        permissions.insert("auditor".to_string(), vec![
            Permission::ViewLogs,
            Permission::ViewMetrics,
        ]);
        
        Self {
            roles,
            permissions,
            role_assignments: HashMap::new(),
            operation_log: Vec::new(),
        }
    }

    pub fn verify_encryption_permission(&self, key: &EncryptionKey, role: &Role) -> Result<bool, EvidenceError> {
        // Check if role has encryption permission
        if !self.permissions.get(&role.name)
            .map(|perms| perms.contains(&Permission::Encrypt))
            .unwrap_or(false) {
            return Ok(false);
        }

        // Check key-specific permissions
        match (key.key_type, &role.name) {
            (KeyType::Master, role_name) if role_name == "admin" => Ok(true),
            (KeyType::Data, _) => Ok(true),
            _ => Ok(false),
        }
    }

    pub fn log_operation(
        &mut self,
        operation: RbacOperation,
        resource: &str,
        role: &Role,
        context: impl std::fmt::Debug,
    ) -> Result<(), EvidenceError> {
        let log = RbacOperationLog {
            operation,
            resource: resource.to_string(),
            role: role.clone(),
            timestamp: Utc::now(),
            context: format!("{:?}", context),
        };
        
        self.operation_log.push(log);
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Role {
    pub name: String,
    pub description: String,
    pub level: SecurityLevel,
}

impl Role {
    pub fn new_admin() -> Self {
        Self {
            name: "admin".to_string(),
            description: "Full system access".to_string(),
            level: SecurityLevel::High,
        }
    }

    pub fn new_operator() -> Self {
        Self {
            name: "operator".to_string(),
            description: "Day-to-day operations".to_string(),
            level: SecurityLevel::Medium,
        }
    }

    pub fn new_auditor() -> Self {
        Self {
            name: "auditor".to_string(),
            description: "System auditing".to_string(),
            level: SecurityLevel::Low,
        }
    }
}

impl Default for Role {
    fn default() -> Self {
        Self::new_operator()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Permission {
    Encrypt,
    Decrypt,
    RotateKeys,
    ManageRoles,
    ViewLogs,
    ViewMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecurityLevel {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RbacOperation {
    Encrypt,
    Decrypt,
    RotateKey,
    AssignRole,
    RevokeRole,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RbacOperationLog {
    pub operation: RbacOperation,
    pub resource: String,
    pub role: Role,
    pub timestamp: DateTime<Utc>,
    pub context: String,
}

// Enums
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd)]
pub enum EncryptionAlgorithm {
    Aes128Gcm,
    Aes256Gcm,
    ChaCha20Poly1305,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransportProtocol {
    Tls12,
    Tls13,
    Dtls,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd)]
pub enum EncryptionLevel {
    Aes128,
    Aes256,
    ChaCha20,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum KeyStatus {
    Active,
    Expired,
    Revoked,
    Compromised,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum KeyType {
    Master,
    Data,
    Session,
    Ephemeral,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyRotationPolicy {
    pub rotation_interval: Duration,
    pub automatic_rotation: bool,
    pub key_archive_period: Duration,
}

impl Default for KeyRotationPolicy {
    fn default() -> Self {
        Self {
            rotation_interval: Duration::new(90), // 90 days
            automatic_rotation: true,
            key_archive_period: Duration::new(365), // 1 year
        }
    }
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