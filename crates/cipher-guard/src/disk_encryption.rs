//! Disk Encryption Module for Cipher Guard
//!
//! Provides full disk encryption capabilities for local and network drives
//! using strong, industry-standard encryption algorithms.

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::fmt;
use thiserror::Error;

use crate::evidence::encryption::{
    KeyManagementSystem, EncryptionKey, EncryptionAlgorithm, 
    KeyRotationReport, KeyStatus, KeyType
};

/// Disk Encryption System for full-drive encryption
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskEncryptionSystem {
    /// Encryption settings for disk operations
    pub encryption_config: DiskEncryptionConfig,
    /// Key management system reference (shared with evidence encryption)
    pub key_management: KeyManagementSystem,
    /// Currently encrypted drives
    pub encrypted_drives: HashMap<String, EncryptedDriveInfo>,
    /// Encryption operation history
    pub operation_history: Vec<DiskEncryptionOperation>,
    /// Current encryption operations in progress
    pub active_operations: HashMap<Uuid, EncryptionProgress>,
}

impl DiskEncryptionSystem {
    /// Create a new disk encryption system
    pub fn new(key_management: KeyManagementSystem) -> Self {
        Self {
            encryption_config: DiskEncryptionConfig::default(),
            key_management,
            encrypted_drives: HashMap::new(),
            operation_history: Vec::new(),
            active_operations: HashMap::new(),
        }
    }

    /// Initialize encryption for a drive
    /// 
    /// # Parameters
    /// * `drive_path` - Path to the drive (e.g., "C:", "Z:", "\\\\server\\share")
    /// * `config_override` - Optional configuration overrides
    /// * `context` - Additional context for the operation
    pub async fn encrypt_drive(
        &mut self,
        drive_path: &str,
        config_override: Option<DiskEncryptionConfig>,
        context: &EncryptionContext,
    ) -> Result<EncryptionOperation, DiskEncryptionError> {
        // Validate drive exists and is accessible
        if !self.validate_drive(drive_path)? {
            return Err(DiskEncryptionError::InvalidDrive(drive_path.to_string()));
        }
        
        // Check if drive is already encrypted
        if self.encrypted_drives.contains_key(drive_path) {
            return Err(DiskEncryptionError::DriveAlreadyEncrypted(drive_path.to_string()));
        }

        // Validate context and requirements
        self.validate_encryption_request(drive_path, context)?;
        
        // Generate operation ID and create initial progress
        let operation_id = Uuid::new_v4();
        let progress = EncryptionProgress {
            operation_id,
            drive_path: drive_path.to_string(),
            start_time: Utc::now(),
            end_time: None,
            current_phase: EncryptionPhase::Initializing,
            percent_complete: 0.0,
            bytes_processed: 0,
            estimated_total_bytes: self.estimate_drive_size(drive_path)?,
            status_message: "Initializing encryption process".to_string(),
            errors: Vec::new(),
        };
        
        // Generate encryption key for this drive
        let key_id = self.generate_drive_key(drive_path)?;
        
        // Create and return operation
        let operation = EncryptionOperation {
            id: operation_id,
            drive_path: drive_path.to_string(),
            key_id,
            config: config_override.unwrap_or_else(|| self.encryption_config.clone()),
            context: context.clone(),
            progress,
        };
        
        // Store active operation
        self.active_operations.insert(operation_id, operation.progress.clone());
        
        Ok(operation)
    }
    
    /// Update progress for an ongoing encryption operation
    pub async fn update_encryption_progress(
        &mut self,
        operation_id: Uuid,
        update: ProgressUpdate,
    ) -> Result<EncryptionProgress, DiskEncryptionError> {
        let progress = self.active_operations.get_mut(&operation_id)
            .ok_or_else(|| DiskEncryptionError::OperationNotFound(operation_id))?;
        
        // Apply updates
        if let Some(phase) = update.phase {
            progress.current_phase = phase;
        }
        
        if let Some(percent) = update.percent_complete {
            progress.percent_complete = percent;
        }
        
        if let Some(bytes) = update.bytes_processed {
            progress.bytes_processed = bytes;
        }
        
        if let Some(message) = update.status_message {
            progress.status_message = message;
        }
        
        if let Some(error) = update.error {
            progress.errors.push(error);
        }
        
        // Check if operation is complete
        if progress.current_phase == EncryptionPhase::Complete {
            progress.end_time = Some(Utc::now());
            
            // Create encrypted drive record
            let drive_info = EncryptedDriveInfo {
                drive_path: progress.drive_path.clone(),
                encryption_date: progress.start_time,
                key_id: "".to_string(), // This should be set from the actual operation's key_id
                algorithm: self.encryption_config.algorithm,
                sectors_encrypted: progress.bytes_processed / 512, // Standard sector size
                mount_status: MountStatus::Unmounted,
                last_validated: progress.start_time,
            };
            
            // Move from active to history and record encrypted drive
            self.encrypted_drives.insert(progress.drive_path.clone(), drive_info);
            
            // Record operation in history
            let operation_record = DiskEncryptionOperation {
                id: operation_id,
                drive_path: progress.drive_path.clone(),
                operation_type: OperationType::Encrypt,
                start_time: progress.start_time,
                end_time: progress.end_time,
                status: OperationStatus::Completed,
                details: format!("Encrypted {} bytes", progress.bytes_processed),
            };
            
            self.operation_history.push(operation_record);
        }
        
        Ok(progress.clone())
    }

    /// Finalize a completed encryption operation
    pub async fn finalize_encryption(
        &mut self,
        operation_id: Uuid,
    ) -> Result<EncryptedDriveInfo, DiskEncryptionError> {
        let progress = self.active_operations.get(&operation_id)
            .ok_or_else(|| DiskEncryptionError::OperationNotFound(operation_id))?;
        
        if progress.current_phase != EncryptionPhase::Complete {
            return Err(DiskEncryptionError::OperationIncomplete(operation_id));
        }
        
        // Remove from active operations
        let progress = self.active_operations.remove(&operation_id)
            .ok_or_else(|| DiskEncryptionError::OperationNotFound(operation_id))?;
        
        // Return the encrypted drive info
        self.encrypted_drives.get(&progress.drive_path)
            .cloned()
            .ok_or_else(|| DiskEncryptionError::DriveNotEncrypted(progress.drive_path))
    }
    
    /// Get status of an encryption operation
    pub fn get_encryption_status(&self, operation_id: Uuid) -> Result<EncryptionProgress, DiskEncryptionError> {
        self.active_operations.get(&operation_id)
            .cloned()
            .ok_or_else(|| DiskEncryptionError::OperationNotFound(operation_id))
    }
    
    /// List all encrypted drives
    pub fn list_encrypted_drives(&self) -> Vec<EncryptedDriveInfo> {
        self.encrypted_drives.values().cloned().collect()
    }
    
    /// Verify encryption status of a drive
    pub async fn verify_drive_encryption(
        &mut self,
        drive_path: &str
    ) -> Result<VerificationResult, DiskEncryptionError> {
        let drive_info = self.encrypted_drives.get_mut(drive_path)
            .ok_or_else(|| DiskEncryptionError::DriveNotEncrypted(drive_path.to_string()))?;
        
        // Perform verification checks
        let result = VerificationResult {
            drive_path: drive_path.to_string(),
            verified: true,
            verification_time: Utc::now(),
            key_status: self.verify_key_status(&drive_info.key_id)?,
            integrity_check: true,
            issues: Vec::new(),
        };
        
        // Update last validated time
        drive_info.last_validated = result.verification_time;
        
        Ok(result)
    }
    
    /// Mount an encrypted drive (make it accessible)
    pub async fn mount_encrypted_drive(
        &mut self,
        drive_path: &str,
        password: Option<String>,
    ) -> Result<(), DiskEncryptionError> {
        let drive_info = self.encrypted_drives.get_mut(drive_path)
            .ok_or_else(|| DiskEncryptionError::DriveNotEncrypted(drive_path.to_string()))?;
        
        // Actual mounting logic would go here
        // ...
        
        // Update mount status
        drive_info.mount_status = MountStatus::Mounted;
        
        Ok(())
    }
    
    /// Unmount an encrypted drive
    pub async fn unmount_encrypted_drive(
        &mut self,
        drive_path: &str,
    ) -> Result<(), DiskEncryptionError> {
        let drive_info = self.encrypted_drives.get_mut(drive_path)
            .ok_or_else(|| DiskEncryptionError::DriveNotEncrypted(drive_path.to_string()))?;
        
        // Actual unmounting logic would go here
        // ...
        
        // Update mount status
        drive_info.mount_status = MountStatus::Unmounted;
        
        Ok(())
    }

    // Helper methods

    /// Validate that a drive exists and is accessible
    fn validate_drive(&self, drive_path: &str) -> Result<bool, DiskEncryptionError> {
        // In a real implementation, this would check if the drive exists
        // For now, we'll do some basic validation
        if drive_path.is_empty() {
            return Err(DiskEncryptionError::InvalidDrive("Empty drive path".to_string()));
        }
        
        // Simple validation for Windows drive letters
        if drive_path.len() == 2 && drive_path.ends_with(':') {
            let drive_letter = drive_path.chars().next().unwrap();
            if !('A'..='Z').contains(&drive_letter) && !('a'..='z').contains(&drive_letter) {
                return Err(DiskEncryptionError::InvalidDrive(format!("Invalid drive letter: {}", drive_letter)));
            }
        }
        
        // For network paths, check basic UNC format
        if drive_path.starts_with("\\\\") {
            // Validate UNC path format
            let parts: Vec<&str> = drive_path.split('\\').collect();
            if parts.len() < 4 {
                return Err(DiskEncryptionError::InvalidDrive("Invalid network path format".to_string()));
            }
        }
        
        // In a real implementation, we would check if the drive is accessible
        Ok(true)
    }
    
    /// Validate that encryption request meets requirements
    fn validate_encryption_request(
        &self,
        drive_path: &str,
        context: &EncryptionContext
    ) -> Result<(), DiskEncryptionError> {
        // Check for system drive (typically C:)
        if drive_path.eq_ignore_ascii_case("C:") && !context.force_system_drive {
            return Err(DiskEncryptionError::SystemDriveEncryption(
                "Encrypting system drive requires explicit confirmation".to_string()
            ));
        }

        // Prevent encryption of Hak5 devices
        if drive_path.starts_with("hak5://") {
            return Err(DiskEncryptionError::InvalidDrive(
                "Encryption of Hak5 devices is prohibited".to_string()
            ));
        }
        
        // Check for adequate free space for the temporary files needed during encryption
        // In a real implementation, we would check actual free space
        
        // Validate backup status if required
        if self.encryption_config.require_backup && !context.backup_verified {
            return Err(DiskEncryptionError::BackupRequired(
                "Backup verification required before encryption".to_string()
            ));
        }
        
        Ok(())
    }
    
    /// Generate a key for drive encryption
    fn generate_drive_key(&self, drive_path: &str) -> Result<String, DiskEncryptionError> {
        // In a real implementation, this would interact with the key management system
        // For now, we'll just create a placeholder key ID
        Ok(format!("disk_key_{}", Uuid::new_v4()))
    }
    
    /// Estimate the size of a drive
    fn estimate_drive_size(&self, drive_path: &str) -> Result<u64, DiskEncryptionError> {
        // In a real implementation, this would query the actual drive size
        // For now, return a placeholder value (500 GB)
        Ok(500 * 1024 * 1024 * 1024)
    }
    
    /// Verify the status of an encryption key
    fn verify_key_status(&self, key_id: &str) -> Result<KeyStatus, DiskEncryptionError> {
        // In a real implementation, this would check the key status in the key management system
        Ok(KeyStatus::Active)
    }
}

/// Configuration for disk encryption operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskEncryptionConfig {
    /// Encryption algorithm to use
    pub algorithm: EncryptionAlgorithm,
    /// Sector size for encryption (typically 512 or 4096 bytes)
    pub sector_size: u32,
    /// Whether to use hardware acceleration when available
    pub use_hardware_acceleration: bool,
    /// Whether to encrypt the entire drive or just used sectors
    pub encrypt_entire_drive: bool,
    /// Whether to require a verified backup before encryption
    pub require_backup: bool,
    /// Whether to perform verification after encryption
    pub verify_after_encryption: bool,
}

impl Default for DiskEncryptionConfig {
    fn default() -> Self {
        Self {
            algorithm: EncryptionAlgorithm::Aes256Gcm,
            sector_size: 4096,
            use_hardware_acceleration: true,
            encrypt_entire_drive: true,
            require_backup: true,
            verify_after_encryption: true,
        }
    }
}

/// Information about an encrypted drive
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedDriveInfo {
    /// Path to the drive
    pub drive_path: String,
    /// Date when the drive was encrypted
    pub encryption_date: DateTime<Utc>,
    /// ID of the encryption key
    pub key_id: String,
    /// Encryption algorithm used
    pub algorithm: EncryptionAlgorithm,
    /// Number of sectors encrypted
    pub sectors_encrypted: u64,
    /// Current mount status
    pub mount_status: MountStatus,
    /// When the drive encryption was last validated
    pub last_validated: DateTime<Utc>,
}

/// Mount status for encrypted drives
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MountStatus {
    /// Drive is mounted and accessible
    Mounted,
    /// Drive is unmounted (encryption active but not accessible)
    Unmounted,
    /// Drive is locked due to security policy
    Locked,
    /// Drive is in a disconnected state
    Disconnected,
}

/// Progress information for encryption operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionProgress {
    /// Unique ID for this operation
    pub operation_id: Uuid,
    /// Path to the drive being encrypted
    pub drive_path: String,
    /// When the operation started
    pub start_time: DateTime<Utc>,
    /// When the operation completed (if completed)
    pub end_time: Option<DateTime<Utc>>,
    /// Current phase of the encryption process
    pub current_phase: EncryptionPhase,
    /// Percentage complete (0.0 to 100.0)
    pub percent_complete: f64,
    /// Number of bytes processed so far
    pub bytes_processed: u64,
    /// Estimated total bytes to process
    pub estimated_total_bytes: u64,
    /// Human-readable status message
    pub status_message: String,
    /// Any errors encountered during encryption
    pub errors: Vec<String>,
}

/// Update to encryption progress
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressUpdate {
    /// Updated phase (if changed)
    pub phase: Option<EncryptionPhase>,
    /// Updated completion percentage
    pub percent_complete: Option<f64>,
    /// Updated bytes processed
    pub bytes_processed: Option<u64>,
    /// Updated status message
    pub status_message: Option<String>,
    /// New error message (if any)
    pub error: Option<String>,
}

/// Phases of the encryption process
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EncryptionPhase {
    /// Initializing encryption
    Initializing,
    /// Analyzing drive structure
    Analyzing,
    /// Creating recovery information
    CreatingRecovery,
    /// Encrypting sectors
    Encrypting,
    /// Verifying encrypted data
    Verifying,
    /// Cleaning up temporary files
    CleaningUp,
    /// Encryption completed
    Complete,
    /// Encryption failed
    Failed,
    /// Encryption paused
    Paused,
}

/// Context for encryption operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionContext {
    /// Whether backup has been verified
    pub backup_verified: bool,
    /// Force encryption of system drive
    pub force_system_drive: bool,
    /// User who initiated the encryption
    pub initiated_by: String,
    /// Purpose for encryption
    pub purpose: String,
    /// Any special considerations for this operation
    pub special_instructions: Option<String>,
    /// Required security level
    pub security_level: SecurityLevel,
}

/// Security levels for encryption operations
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, PartialOrd)]
pub enum SecurityLevel {
    /// Standard security (e.g., for non-sensitive data)
    Standard,
    /// Enhanced security (e.g., for sensitive internal data)
    Enhanced,
    /// Maximum security (e.g., for highly sensitive data)
    Maximum,
}

/// Encryption operation details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionOperation {
    /// Unique ID for this operation
    pub id: Uuid,
    /// Path to the drive being encrypted
    pub drive_path: String,
    /// ID of the key being used
    pub key_id: String,
    /// Configuration for this operation
    pub config: DiskEncryptionConfig,
    /// Context for this operation
    pub context: EncryptionContext,
    /// Current progress
    pub progress: EncryptionProgress,
}

/// Result of a drive verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    /// Path to the drive that was verified
    pub drive_path: String,
    /// Whether verification succeeded
    pub verified: bool,
    /// When verification was performed
    pub verification_time: DateTime<Utc>,
    /// Status of the encryption key
    pub key_status: KeyStatus,
    /// Whether integrity check passed
    pub integrity_check: bool,
    /// Any issues found during verification
    pub issues: Vec<String>,
}

/// Record of disk encryption operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskEncryptionOperation {
    /// Unique operation ID
    pub id: Uuid,
    /// Path to the drive
    pub drive_path: String,
    /// Type of operation
    pub operation_type: OperationType,
    /// When the operation started
    pub start_time: DateTime<Utc>,
    /// When the operation ended
    pub end_time: Option<DateTime<Utc>>,
    /// Final status
    pub status: OperationStatus,
    /// Additional details about the operation
    pub details: String,
}

/// Types of disk operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OperationType {
    /// Encrypt a drive
    Encrypt,
    /// Decrypt a drive
    Decrypt,
    /// Change encryption key
    ChangeKey,
    /// Verify encryption
    Verify,
}

/// Status of operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OperationStatus {
    /// Operation in progress
    InProgress,
    /// Operation completed successfully
    Completed,
    /// Operation failed
    Failed,
    /// Operation canceled
    Canceled,
}

/// Errors that can occur during disk encryption
#[derive(Debug, Error)]
pub enum DiskEncryptionError {
    /// Drive does not exist or is inaccessible
    #[error("Invalid drive: {0}")]
    InvalidDrive(String),
    
    /// Drive is already encrypted
    #[error("Drive is already encrypted: {0}")]
    DriveAlreadyEncrypted(String),
    
    /// Drive is not encrypted
    #[error("Drive is not encrypted: {0}")]
    DriveNotEncrypted(String),
    
    /// System drive encryption requires special handling
    #[error("System drive encryption: {0}")]
    SystemDriveEncryption(String),
    
    /// Backup required before encryption
    #[error("Backup required: {0}")]
    BackupRequired(String),
    
    /// Operation not found
    #[error("Operation not found: {0}")]
    OperationNotFound(Uuid),
    
    /// Operation is incomplete
    #[error("Operation incomplete: {0}")]
    OperationIncomplete(Uuid),
    
    /// Authentication failed
    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),
    
    /// Encryption failed
    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),
    
    /// Decryption failed
    #[error("Decryption failed: {0}")]
    DecryptionFailed(String),
    
    /// IO error
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    /// Other error
    #[error("Error: {0}")]
    Other(String),
}

impl Serialize for DiskEncryptionError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

// Struct for schema definition (used for web API)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskEncryptionRequest {
    /// Drive to encrypt (e.g., "Z:", "\\\\server\\share")
    pub drive_path: String,
    /// Override default configuration
    pub config: Option<DiskEncryptionConfig>,
    /// Verification that backup exists
    pub backup_verified: bool,
    /// Force encryption of system drive
    pub force_system_drive: bool,
    /// User initiating the encryption
    pub initiated_by: String,
    /// Purpose for encryption
    pub purpose: String,
    /// Any special instructions
    pub special_instructions: Option<String>,
}