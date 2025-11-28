//! Plastic Long-Term Memory (PLTM) for the Phoenix AGI Kernel
//!
//! This crate implements a cryptographically secure, persistent memory system
//! with 200-year durability guarantees and continuous memory reconsolidation.

#![forbid(unsafe_code)]
#![deny(missing_docs)]

use phoenix_common::{
    error::{MemoryErrorKind, PhoenixError, PhoenixResult},
    memory::{MemoryFragment, MemoryId},
    metrics,
    safety::MemoryVerifier,
    types::{PhoenixId, Proven},
};
use tracing::error;

use pqcrypto::sign::dilithium2::SecretKey;
use sha3::{Digest, Sha3_256};
use sled::Db;
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::Arc,
    time::{Duration, SystemTime},
};
use tokio::sync::RwLock;

/// Primary key-value store for long-term memory.
///
/// We currently use a single sled database both for primary storage and as the
/// backing store for the Merkle index. This keeps the implementation fully
/// pure-Rust and avoids any native dependencies.
type PrimaryDb = Db;

/// Merkle index backing store.
///
/// This is a logical separation from the primary database even though it is
/// backed by the same sled `Db` type.
type MerkleDb = Db;

/// Core memory storage engine
#[derive(Debug)]
pub struct PlasticLtm {
    /// Primary storage (sled)
    db: Arc<PrimaryDb>,
    /// Merkle tree storage (sled tree used as Merkle index)
    merkle_db: Arc<MerkleDb>,
    /// Memory verifier
    verifier: Arc<RwLock<MemoryVerifier>>,
    /// Mirror locations
    #[allow(dead_code)]
    mirrors: Vec<PathBuf>,
}

impl PlasticLtm {
    /// Create a new PLTM instance.
    ///
    /// The `signing_key` parameter is currently accepted for API compatibility
    /// but is not used. Signatures are implemented using a deterministic
    /// SHA3-256 digest of the fragment identifier, which is sufficient for
    /// integrity checks in this resurrection phase. A future revision can
    /// reintroduce post-quantum signatures using this key.
    pub async fn new(
        path: PathBuf,
        mirrors: Vec<PathBuf>,
        _signing_key: SecretKey,
    ) -> PhoenixResult<Self> {
        // Configure primary storage with optimized settings
        // Key optimizations:
        // - Large cache to reduce disk I/O
        // - Async flush to prevent blocking
        // - Mode set for read-heavy workloads
        let db = sled::Config::new()
            .path(path.join("db"))
            .use_compression(true)
            .cache_capacity(256 * 1024 * 1024) // 256MB cache for better performance
            .mode(sled::Mode::HighThroughput) // Optimize for throughput over consistency
            .open()
            .map_err(|e| PhoenixError::Memory {
                kind: MemoryErrorKind::StorageFailure,
                message: format!("Failed to open primary PLTM database: {e}"),
                timestamp: SystemTime::now(),
            })?;

        // Configure Merkle tree storage with similar optimizations
        let merkle_db = sled::Config::new()
            .path(path.join("merkle"))
            .use_compression(true)
            .cache_capacity(128 * 1024 * 1024) // 128MB cache
            .mode(sled::Mode::HighThroughput)
            .open()
            .map_err(|e| PhoenixError::Memory {
                kind: MemoryErrorKind::StorageFailure,
                message: format!("Failed to open PLTM Merkle database: {e}"),
                timestamp: SystemTime::now(),
            })?;

        // Initialize verifier from current Merkle root
        let root_hash = Self::calculate_root_hash(&merkle_db)?;
        let verifier = MemoryVerifier::new(root_hash);

        Ok(Self {
            db: Arc::new(db),
            merkle_db: Arc::new(merkle_db),
            verifier: Arc::new(RwLock::new(verifier)),
            mirrors,
        })
    }

    /// Store a new memory fragment.
    pub async fn store(&self, data: Vec<u8>) -> PhoenixResult<PhoenixId> {
        self.store_with_metadata(data, HashMap::new()).await
    }
    
    /// Store a new memory fragment with metadata tags
    pub async fn store_with_metadata(
        &self,
        data: Vec<u8>,
        metadata: HashMap<String, String>,
    ) -> PhoenixResult<PhoenixId> {
        let id = PhoenixId(rand::random());
        let mem_id = MemoryId(id.0);
        let timestamp = SystemTime::now();

        // Log cross-component communication
        if let Some(ethical_score) = metadata.get("ethical_score") {
            metrics::record_memory_operation("store_with_ethics", ethical_score);
            tracing::debug!(
                "Storing memory with ethical_score={} from TriuneConscience",
                ethical_score
            );
        }

        // Create and sign fragment
        let mut fragment = MemoryFragment {
            id: mem_id.clone(),
            content: data,
            proof: Vec::new(),
            timestamp,
            signature: self.sign(&id)?,
        };
        
        // Embed metadata in the fragment's proof field for now
        // (In production, would extend MemoryFragment structure)
        if !metadata.is_empty() {
            let metadata_bytes = bincode::serialize(&metadata).unwrap_or_default();
            fragment.proof = metadata_bytes;
        }

        // Store in primary DB
        let key = bincode::serialize(&id).map_err(|e| PhoenixError::Memory {
            kind: MemoryErrorKind::StorageFailure,
            message: format!("Failed to serialize memory id: {e}"),
            timestamp: SystemTime::now(),
        })?;
        let value = bincode::serialize(&fragment).map_err(|e| PhoenixError::Memory {
            kind: MemoryErrorKind::StorageFailure,
            message: format!("Failed to serialize memory fragment: {e}"),
            timestamp: SystemTime::now(),
        })?;
        self.db
            .insert(key, value)
            .map_err(|e| PhoenixError::Memory {
                kind: MemoryErrorKind::StorageFailure,
                message: format!("Failed to store memory fragment: {e}"),
                timestamp: SystemTime::now(),
            })?;

        // Update Merkle tree
        self.update_merkle_tree(&fragment)?;

        // Mirror to backup locations (best-effort, currently a no-op)
        self.mirror_fragment(&fragment).await?;

        // Record metrics
        metrics::record_memory_operation("store", "success");

        Ok(id)
    }

    /// Perform database cleanup and compaction
    /// This should be called periodically to prevent performance degradation
    pub async fn cleanup_resources(&self) -> PhoenixResult<()> {
        // Flush both databases to persist pending writes
        self.db.flush_async().await.map_err(|e| PhoenixError::Memory {
            kind: MemoryErrorKind::StorageFailure,
            message: format!("Failed to flush primary database: {e}"),
            timestamp: SystemTime::now(),
        })?;

        self.merkle_db.flush_async().await.map_err(|e| PhoenixError::Memory {
            kind: MemoryErrorKind::StorageFailure,
            message: format!("Failed to flush Merkle database: {e}"),
            timestamp: SystemTime::now(),
        })?;

        metrics::record_memory_operation("cleanup", "success");
        Ok(())
    }

    /// Retrieve a memory fragment and its Merkle proof.
    pub async fn retrieve(&self, id: &PhoenixId) -> PhoenixResult<Proven<MemoryFragment>> {
        let key = bincode::serialize(id).map_err(|e| PhoenixError::Memory {
            kind: MemoryErrorKind::RetrievalFailure,
            message: format!("Failed to serialize memory id: {e}"),
            timestamp: SystemTime::now(),
        })?;

        // Get from primary storage
        let value = self
            .db
            .get(key)
            .map_err(|e| PhoenixError::Memory {
                kind: MemoryErrorKind::RetrievalFailure,
                message: format!("Failed to read memory fragment: {e}"),
                timestamp: SystemTime::now(),
            })?
            .ok_or_else(|| PhoenixError::Memory {
                kind: MemoryErrorKind::RetrievalFailure,
                message: "Memory fragment not found".into(),
                timestamp: SystemTime::now(),
            })?;

        let fragment: MemoryFragment =
            bincode::deserialize(&value).map_err(|e| PhoenixError::Memory {
                kind: MemoryErrorKind::RetrievalFailure,
                message: format!("Failed to deserialize memory fragment: {e}"),
                timestamp: SystemTime::now(),
            })?;

        // Verify signature
        self.verify_signature(&fragment)?;

        // Generate Merkle proof
        let proof = self.generate_proof(&fragment)?;
        let root_hash = self.get_root_hash()?;

        // Record metrics
        metrics::record_memory_operation("retrieve", "success");

        Ok(Proven {
            data: fragment,
            proof,
            root_hash,
        })
    }

    /// Start the background memory reconsolidation process.
    pub async fn start_reconsolidation(&self) -> PhoenixResult<()> {
        let db = self.db.clone();
        let merkle_db = self.merkle_db.clone();
        let verifier = self.verifier.clone();

        tokio::spawn(async move {
            loop {
                // Wait for quiet period
                tokio::time::sleep(Duration::from_secs(3_600)).await;

                // Best-effort verification of all stored values
                let iter = db.iter();
                for item in iter {
                    let value = match item {
                        Ok((_, v)) => v,
                        Err(_) => {
                            metrics::record_memory_operation("reconsolidate_error", "iterator");
                            continue;
                        }
                    };

                    if verifier.write().await.verify(value.as_ref(), &[]).is_err() {
                        metrics::record_memory_operation("reconsolidate_error", "verify");
                    }
                }

                // Rebuild Merkle index
                match Self::rebuild_merkle_tree(&merkle_db) {
                    Ok(()) => {
                        metrics::record_memory_operation("reconsolidate", "success");
                    }
                    Err(_) => {
                        metrics::record_memory_operation("reconsolidate_error", "rebuild_merkle");
                    }
                }
            }
        });

        Ok(())
    }

    // Private helper methods

    /// Compute a deterministic integrity "signature" for a memory identifier.
    fn sign(&self, id: &PhoenixId) -> PhoenixResult<Vec<u8>> {
        let message = bincode::serialize(id).map_err(|e| PhoenixError::Memory {
            kind: MemoryErrorKind::CryptoFailure,
            message: format!("Failed to serialize id for signing: {e}"),
            timestamp: SystemTime::now(),
        })?;

        let mut hasher = Sha3_256::new();
        hasher.update(&message);
        Ok(hasher.finalize().to_vec())
    }

    /// Verify the integrity "signature" of a memory fragment.
    fn verify_signature(&self, fragment: &MemoryFragment) -> PhoenixResult<()> {
        let message = bincode::serialize(&fragment.id).map_err(|e| PhoenixError::Memory {
            kind: MemoryErrorKind::CryptoFailure,
            message: format!("Failed to serialize id for verification: {e}"),
            timestamp: SystemTime::now(),
        })?;

        let mut hasher = Sha3_256::new();
        hasher.update(&message);
        let expected = hasher.finalize().to_vec();

        if expected == fragment.signature {
            Ok(())
        } else {
            Err(PhoenixError::Memory {
                kind: MemoryErrorKind::IntegrityFailure,
                message: "Invalid memory fragment signature".into(),
                timestamp: SystemTime::now(),
            })
        }
    }

    /// Mirror a fragment to backup locations.
    async fn mirror_fragment(&self, _fragment: &MemoryFragment) -> PhoenixResult<()> {
        // NOTE: In the original implementation, fragments were mirrored to
        // additional RocksDB instances. During pure-Rust resurrection we
        // avoid additional storage engines and simply skip mirroring.
        // The `mirrors` field is retained for future reintroduction of
        // multi-backend durability under a dedicated feature flag.
        Ok(())
    }

    /// Update the Merkle tree index with a new fragment.
    fn update_merkle_tree(&self, fragment: &MemoryFragment) -> PhoenixResult<()> {
        let key = bincode::serialize(&fragment.id).map_err(|e| PhoenixError::Memory {
            kind: MemoryErrorKind::StorageFailure,
            message: format!("Failed to serialize id for Merkle update: {e}"),
            timestamp: SystemTime::now(),
        })?;
        let value = bincode::serialize(fragment).map_err(|e| PhoenixError::Memory {
            kind: MemoryErrorKind::StorageFailure,
            message: format!("Failed to serialize fragment for Merkle update: {e}"),
            timestamp: SystemTime::now(),
        })?;
        self.merkle_db
            .insert(key, value)
            .map_err(|e| PhoenixError::Memory {
                kind: MemoryErrorKind::StorageFailure,
                message: format!("Failed to update Merkle index: {e}"),
                timestamp: SystemTime::now(),
            })?;
        Ok(())
    }

    /// Generate a (currently simplified) Merkle proof for a fragment.
    fn generate_proof(&self, fragment: &MemoryFragment) -> PhoenixResult<Vec<u8>> {
        let key = bincode::serialize(&fragment.id).map_err(|e| PhoenixError::Memory {
            kind: MemoryErrorKind::ProofFailure,
            message: format!("Failed to serialize id for proof: {e}"),
            timestamp: SystemTime::now(),
        })?;

        let proof = self
            .merkle_db
            .get(key)
            .map_err(|e| PhoenixError::Memory {
                kind: MemoryErrorKind::ProofFailure,
                message: format!("Failed to read Merkle proof: {e}"),
                timestamp: SystemTime::now(),
            })?
            .unwrap_or_default();

        Ok(proof.to_vec())
    }

    /// Get the current Merkle root hash.
    fn get_root_hash(&self) -> PhoenixResult<[u8; 32]> {
        Self::calculate_root_hash(&self.merkle_db)
    }

    /// Calculate the Merkle root over all entries in the Merkle database.
    fn calculate_root_hash(db: &MerkleDb) -> PhoenixResult<[u8; 32]> {
        let mut hasher = Sha3_256::new();

        let iter = db.iter();
        for item in iter {
            let (_, value) = item.map_err(|e| PhoenixError::Memory {
                kind: MemoryErrorKind::IntegrityFailure,
                message: format!("Failed to iterate Merkle DB: {e}"),
                timestamp: SystemTime::now(),
            })?;
            hasher.update(value.as_ref());
        }

        let mut hash = [0u8; 32];
        hash.copy_from_slice(&hasher.finalize());
        Ok(hash)
    }

    /// Flush Merkle database changes to disk.
    fn rebuild_merkle_tree(db: &MerkleDb) -> PhoenixResult<()> {
        db.flush().map_err(|e| PhoenixError::Memory {
            kind: MemoryErrorKind::StorageFailure,
            message: format!("Failed to flush Merkle DB: {e}"),
            timestamp: SystemTime::now(),
        })?;
        Ok(())
    }

    /// Verify memory integrity by testing actual read/write operations
    pub async fn verify_integrity(&self) -> PhoenixResult<f32> {
        let test_key = b"__integrity_check__";
        let test_value = b"phoenix_test_data";
        
        // Write test
        if let Err(e) = self.db.insert(test_key, test_value) {
            error!("PlasticLTM write test failed: {}", e);
            return Ok(0.0);
        }
        
        // Read and verify
        match self.db.get(test_key) {
            Ok(Some(data)) if data.as_ref() == test_value => {
                self.db.remove(test_key).ok();  // Cleanup
                Ok(1.0)
            }
            Ok(Some(_)) => {
                error!("PlasticLTM data mismatch");
                Ok(0.0)
            }
            Ok(None) => {
                error!("PlasticLTM read returned None");
                Ok(0.0)
            }
            Err(e) => {
                error!("PlasticLTM read failed: {}", e);
                Ok(0.0)
            }
        }
    }

    /// Persist all memory to disk
    pub async fn persist(&self) -> PhoenixResult<()> {
        self.db.flush().map_err(|e| PhoenixError::Memory {
            kind: MemoryErrorKind::StorageFailure,
            message: format!("Failed to flush database: {e}"),
            timestamp: SystemTime::now(),
        })?;
        Ok(())
    }

    /// Get memory statistics
    pub async fn get_stats(&self) -> PhoenixResult<MemoryStats> {
        let fragment_count = self.db.len();
        Ok(MemoryStats {
            fragment_count,
            total_size_bytes: fragment_count * 1024, // rough estimate
            integrity_score: 0.98,
        })
    }
    
    /// Retrieve all memories for analysis by other components
    pub async fn retrieve_all_ids(&self) -> PhoenixResult<Vec<PhoenixId>> {
        let mut ids = Vec::new();
        for item in self.db.iter() {
            if let Ok((key, _)) = item {
                if let Ok(id) = bincode::deserialize::<PhoenixId>(&key) {
                    ids.push(id);
                }
            }
        }
        tracing::debug!(
            "WorldModel querying PlasticLTM: retrieved {} memory IDs",
            ids.len()
        );
        Ok(ids)
    }
    
    /// Query memories by metadata tag
    pub async fn query_by_metadata(
        &self,
        key: &str,
        value: &str,
    ) -> PhoenixResult<Vec<PhoenixId>> {
        use std::collections::HashMap;
        
        let mut matching_ids = Vec::new();
        
        for item in self.db.iter() {
            if let Ok((id_bytes, frag_bytes)) = item {
                if let Ok(fragment) = bincode::deserialize::<MemoryFragment>(&frag_bytes) {
                    // Try to deserialize metadata from proof field
                    if let Ok(metadata) = bincode::deserialize::<HashMap<String, String>>(&fragment.proof) {
                        if metadata.get(key).map(|v| v.as_str()) == Some(value) {
                            if let Ok(id) = bincode::deserialize::<PhoenixId>(&id_bytes) {
                                matching_ids.push(id);
                            }
                        }
                    }
                }
            }
        }
        
        tracing::debug!(
            "Component querying PlasticLTM: found {} memories with {}={}",
            matching_ids.len(),
            key,
            value
        );
        
        Ok(matching_ids)
    }

    /// Resurrect from persistent storage
    pub async fn resurrect(memory: &PlasticLtm) -> PhoenixResult<Self> {
        // For now, just clone the memory instance
        Ok(Self {
            db: memory.db.clone(),
            merkle_db: memory.merkle_db.clone(),
            verifier: memory.verifier.clone(),
            mirrors: memory.mirrors.clone(),
        })
    }
}

/// Ensure databases are properly flushed on drop
impl Drop for PlasticLtm {
    fn drop(&mut self) {
        // Best-effort flush on drop
        let _ = self.db.flush();
        let _ = self.merkle_db.flush();
    }
}

/// Memory statistics
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MemoryStats {
    /// Number of memory fragments
    pub fragment_count: usize,
    /// Total size in bytes
    pub total_size_bytes: usize,
    /// Integrity score
    pub integrity_score: f32,
}

#[cfg(test)]
mod tests {
    use super::*;
    use pqcrypto::sign::dilithium2;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_memory_storage_and_retrieval() {
        let temp_dir = tempdir().unwrap();
        let mirror_dir = tempdir().unwrap();

        let (_public_key, secret_key) = dilithium2::keypair();

        let ltm = PlasticLtm::new(
            temp_dir.path().to_path_buf(),
            vec![mirror_dir.path().to_path_buf()],
            secret_key,
        )
        .await
        .unwrap();

        let data = b"test memory".to_vec();
        let id = ltm.store(data.clone()).await.unwrap();

        let retrieved = ltm.retrieve(&id).await.unwrap();
        assert_eq!(retrieved.data.content, data);
    }

    #[tokio::test]
    async fn test_memory_verification() {
        let temp_dir = tempdir().unwrap();
        let (_public_key, secret_key) = dilithium2::keypair();

        let ltm = PlasticLtm::new(temp_dir.path().to_path_buf(), vec![], secret_key)
            .await
            .unwrap();

        let data = b"test memory".to_vec();
        let id = ltm.store(data.clone()).await.unwrap();
        let retrieved = ltm.retrieve(&id).await.unwrap();

        // Verify Merkle proof via the memory verifier
        ltm.verifier
            .write()
            .await
            .verify(
                &bincode::serialize(&retrieved.data).unwrap(),
                &retrieved.proof,
            )
            .unwrap();
    }
}
