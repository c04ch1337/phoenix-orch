use anyhow::Result;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};
use tokio::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;
use sha2::{Sha256, Digest};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveEntry {
    pub id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub content_type: ContentType,
    pub metadata: Metadata,
    pub storage_info: StorageInfo,
    pub integrity: IntegrityInfo,
    pub retention: RetentionPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ContentType {
    ToolState,
    ActionLog,
    EthicalValidation,
    SystemSnapshot,
    AuditTrail,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metadata {
    pub title: String,
    pub description: String,
    pub tags: Vec<String>,
    pub source: String,
    pub related_entries: Vec<Uuid>,
    pub custom_fields: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageInfo {
    pub location: StorageLocation,
    pub format: StorageFormat,
    pub size: u64,
    pub compression: Option<CompressionType>,
    pub encryption: Option<EncryptionInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StorageLocation {
    Local(PathBuf),
    S3 {
        bucket: String,
        key: String,
    },
    Ipfs {
        cid: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StorageFormat {
    Json,
    Binary,
    Yaml,
    MessagePack,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CompressionType {
    Gzip,
    Zstd,
    Lz4,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionInfo {
    pub algorithm: String,
    pub key_id: String,
    pub iv: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrityInfo {
    pub hash_algorithm: String,
    pub content_hash: String,
    pub signature: Option<String>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetentionPolicy {
    pub duration: RetentionDuration,
    pub importance: ImportanceLevel,
    pub access_control: AccessControl,
    pub deletion_policy: DeletionPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RetentionDuration {
    Temporary(chrono::Duration),
    Fixed(DateTime<Utc>),
    Permanent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImportanceLevel {
    Critical,
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessControl {
    pub read_roles: Vec<String>,
    pub write_roles: Vec<String>,
    pub delete_roles: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DeletionPolicy {
    HardDelete,
    SoftDelete,
    Retain,
}

pub struct ArchivalSystem {
    base_path: PathBuf,
    index: sled::Db,
    encryption_key: Option<Vec<u8>>,
}

impl ArchivalSystem {
    pub async fn new(base_path: PathBuf, encryption_key: Option<Vec<u8>>) -> Result<Self> {
        fs::create_dir_all(&base_path).await?;
        
        let index = sled::open(base_path.join("index"))?;

        Ok(Self {
            base_path,
            index,
            encryption_key,
        })
    }

    pub async fn archive_content<T: Serialize>(
        &self,
        content: &T,
        content_type: ContentType,
        metadata: Metadata,
        retention: RetentionPolicy,
    ) -> Result<ArchiveEntry> {
        let id = Uuid::new_v4();
        let timestamp = Utc::now();

        // Serialize content
        let content_bytes = match &content_type {
            ContentType::ToolState | ContentType::ActionLog | ContentType::EthicalValidation => {
                serde_json::to_vec(content)?
            }
            ContentType::SystemSnapshot | ContentType::AuditTrail => {
                rmp_serde::to_vec(content)?
            }
            ContentType::Custom(_) => {
                bincode::serialize(content)?
            }
        };

        // Compress if needed
        let (compressed_bytes, compression) = self.compress_content(&content_bytes)?;

        // Encrypt if needed
        let (encrypted_bytes, encryption) = self.encrypt_content(&compressed_bytes)?;

        // Calculate integrity info
        let integrity = self.calculate_integrity(&encrypted_bytes)?;

        // Store content
        let storage_path = self.get_storage_path(id, &content_type);
        fs::write(&storage_path, &encrypted_bytes).await?;

        let storage_info = StorageInfo {
            location: StorageLocation::Local(storage_path),
            format: match content_type {
                ContentType::ToolState | ContentType::ActionLog | ContentType::EthicalValidation => {
                    StorageFormat::Json
                }
                ContentType::SystemSnapshot | ContentType::AuditTrail => {
                    StorageFormat::MessagePack
                }
                ContentType::Custom(_) => StorageFormat::Binary,
            },
            size: encrypted_bytes.len() as u64,
            compression: Some(compression),
            encryption,
        };

        let entry = ArchiveEntry {
            id,
            timestamp,
            content_type,
            metadata,
            storage_info,
            integrity,
            retention,
        };

        // Update index
        self.index.insert(
            id.as_bytes(),
            bincode::serialize(&entry)?,
        )?;

        Ok(entry)
    }

    pub async fn retrieve_content<T: for<'de> Deserialize<'de>>(
        &self,
        entry_id: Uuid,
    ) -> Result<T> {
        let entry_bytes = self.index.get(entry_id.as_bytes())?
            .ok_or_else(|| anyhow::anyhow!("Entry not found"))?;

        let entry: ArchiveEntry = bincode::deserialize(&entry_bytes)?;

        // Read content
        let encrypted_bytes = match entry.storage_info.location {
            StorageLocation::Local(path) => fs::read(path).await?,
            StorageLocation::S3 { .. } => unimplemented!(),
            StorageLocation::Ipfs { .. } => unimplemented!(),
        };

        // Verify integrity
        self.verify_integrity(&encrypted_bytes, &entry.integrity)?;

        // Decrypt if needed
        let compressed_bytes = if let Some(encryption) = entry.storage_info.encryption {
            self.decrypt_content(&encrypted_bytes, &encryption)?
        } else {
            encrypted_bytes
        };

        // Decompress if needed
        let content_bytes = if let Some(compression) = entry.storage_info.compression {
            self.decompress_content(&compressed_bytes, &compression)?
        } else {
            compressed_bytes
        };

        // Deserialize
        let content = match entry.content_type {
            ContentType::ToolState | ContentType::ActionLog | ContentType::EthicalValidation => {
                serde_json::from_slice(&content_bytes)?
            }
            ContentType::SystemSnapshot | ContentType::AuditTrail => {
                rmp_serde::from_slice(&content_bytes)?
            }
            ContentType::Custom(_) => {
                bincode::deserialize(&content_bytes)?
            }
        };

        Ok(content)
    }

    fn get_storage_path(&self, id: Uuid, content_type: &ContentType) -> PathBuf {
        let type_dir = match content_type {
            ContentType::ToolState => "tool_states",
            ContentType::ActionLog => "action_logs",
            ContentType::EthicalValidation => "ethical_validations",
            ContentType::SystemSnapshot => "system_snapshots",
            ContentType::AuditTrail => "audit_trails",
            ContentType::Custom(name) => name,
        };

        self.base_path
            .join(type_dir)
            .join(format!("{}.bin", id))
    }

    fn compress_content(&self, content: &[u8]) -> Result<(Vec<u8>, CompressionType)> {
        use zstd::bulk::compress;

        let compressed = compress(content, 3)?;
        Ok((compressed, CompressionType::Zstd))
    }

    fn decompress_content(&self, content: &[u8], compression: &CompressionType) -> Result<Vec<u8>> {
        match compression {
            CompressionType::Zstd => {
                Ok(zstd::bulk::decompress(content, 10_000_000)?)
            }
            _ => unimplemented!(),
        }
    }

    fn encrypt_content(&self, content: &[u8]) -> Result<(Vec<u8>, Option<EncryptionInfo>)> {
        if let Some(key) = &self.encryption_key {
            use aes_gcm::{Aes256Gcm, KeyInit, aead::{Aead, Nonce}};
            
            let cipher = Aes256Gcm::new_from_slice(key)?;
            let nonce = Nonce::from_slice(b"unique nonce");
            
            let encrypted = cipher.encrypt(nonce, content)?;
            
            let info = EncryptionInfo {
                algorithm: "AES-256-GCM".to_string(),
                key_id: "primary".to_string(),
                iv: nonce.to_vec(),
            };

            Ok((encrypted, Some(info)))
        } else {
            Ok((content.to_vec(), None))
        }
    }

    fn decrypt_content(&self, content: &[u8], info: &EncryptionInfo) -> Result<Vec<u8>> {
        if let Some(key) = &self.encryption_key {
            use aes_gcm::{Aes256Gcm, KeyInit, aead::{Aead, Nonce}};
            
            let cipher = Aes256Gcm::new_from_slice(key)?;
            let nonce = Nonce::from_slice(&info.iv);
            
            Ok(cipher.decrypt(nonce, content)?)
        } else {
            anyhow::bail!("No encryption key available")
        }
    }

    fn calculate_integrity(&self, content: &[u8]) -> Result<IntegrityInfo> {
        let mut hasher = Sha256::new();
        hasher.update(content);
        let hash = hasher.finalize();

        Ok(IntegrityInfo {
            hash_algorithm: "SHA-256".to_string(),
            content_hash: hex::encode(hash),
            signature: None,
            timestamp: Utc::now(),
        })
    }

    fn verify_integrity(&self, content: &[u8], info: &IntegrityInfo) -> Result<()> {
        let mut hasher = Sha256::new();
        hasher.update(content);
        let hash = hasher.finalize();

        if hex::encode(hash) != info.content_hash {
            anyhow::bail!("Content integrity verification failed");
        }

        Ok(())
    }
}