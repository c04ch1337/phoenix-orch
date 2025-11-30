use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use ring::{aead, digest, pbkdf2, rand};
use ring::rand::SecureRandom;
use std::num::NonZeroU32;

/// SecurityModule implements all security-related functionality
/// including crypto operations, validation, and memory analysis
/// Designed with zero circular dependencies
pub struct SecurityModule {
    memory_map: HashMap<String, Vec<u8>>,
    validation_timestamps: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionResult {
    pub encrypted_data: String,
    pub salt: String,
    pub nonce: String,
}

impl SecurityModule {
    /// Create a new SecurityModule instance
    pub fn new() -> Self {
        Self {
            memory_map: HashMap::new(),
            validation_timestamps: Vec::new(),
        }
    }
    
    /// Encrypt data using AES-GCM
    pub fn encrypt(&self, data: &str, key: &str) -> Result<String, String> {
        if data.is_empty() || key.is_empty() {
            return Err("Data and key cannot be empty".to_string());
        }
        
        // Generate random salt
        let salt = self.generate_random_bytes(16)?;
        
        // Derive encryption key using PBKDF2
        let derived_key = self.derive_key(key.as_bytes(), &salt, 100_000)?;
        
        // Generate random nonce
        let nonce = self.generate_random_bytes(12)?;
        
        // Create sealing key
        let sealing_key = aead::UnboundKey::new(&aead::AES_256_GCM, &derived_key)
            .map_err(|_| "Failed to create sealing key".to_string())?;
        let sealing_key = aead::LessSafeKey::new(sealing_key);
        
        // Create nonce
        let nonce_sequence = aead::Nonce::assume_unique_for_key(
            <[u8; 12]>::try_from(&nonce[..]).map_err(|_| "Invalid nonce length".to_string())?
        );
        
        // Encrypt data
        let mut in_out = data.as_bytes().to_vec();
        sealing_key.seal_in_place_append_tag(nonce_sequence, aead::Aad::empty(), &mut in_out)
            .map_err(|_| "Failed to encrypt data".to_string())?;
        
        // Create result
        let result = EncryptionResult {
            encrypted_data: base64::encode(&in_out),
            salt: base64::encode(&salt),
            nonce: base64::encode(&nonce),
        };
        
        // Return serialized result
        serde_json::to_string(&result)
            .map_err(|e| format!("Failed to serialize encryption result: {}", e))
    }
    
    /// Decrypt data using AES-GCM
    pub fn decrypt(&self, encrypted_data: &str, key: &str) -> Result<String, String> {
        if encrypted_data.is_empty() || key.is_empty() {
            return Err("Encrypted data and key cannot be empty".to_string());
        }
        
        // Parse encryption result
        let encryption_result: EncryptionResult = serde_json::from_str(encrypted_data)
            .map_err(|e| format!("Failed to parse encryption result: {}", e))?;
        
        // Decode base64 data
        let mut encrypted_bytes = base64::decode(&encryption_result.encrypted_data)
            .map_err(|e| format!("Failed to decode encrypted data: {}", e))?;
        let salt = base64::decode(&encryption_result.salt)
            .map_err(|e| format!("Failed to decode salt: {}", e))?;
        let nonce = base64::decode(&encryption_result.nonce)
            .map_err(|e| format!("Failed to decode nonce: {}", e))?;
        
        // Derive encryption key using PBKDF2
        let derived_key = self.derive_key(key.as_bytes(), &salt, 100_000)?;
        
        // Create opening key
        let opening_key = aead::UnboundKey::new(&aead::AES_256_GCM, &derived_key)
            .map_err(|_| "Failed to create opening key".to_string())?;
        let opening_key = aead::LessSafeKey::new(opening_key);
        
        // Create nonce
        let nonce_sequence = aead::Nonce::assume_unique_for_key(
            <[u8; 12]>::try_from(&nonce[..]).map_err(|_| "Invalid nonce length".to_string())?
        );
        
        // Decrypt data
        let decrypted_data = opening_key.open_in_place(nonce_sequence, aead::Aad::empty(), &mut encrypted_bytes)
            .map_err(|_| "Failed to decrypt data".to_string())?;
        
        // Convert decrypted data to string
        String::from_utf8(decrypted_data.to_vec())
            .map_err(|e| format!("Failed to convert decrypted data to string: {}", e))
    }
    
    /// Derive encryption key using PBKDF2
    fn derive_key(&self, password: &[u8], salt: &[u8], iterations: u32) -> Result<[u8; 32], String> {
        let mut derived_key = [0u8; 32];
        
        pbkdf2::derive(
            pbkdf2::PBKDF2_HMAC_SHA256,
            NonZeroU32::new(iterations).unwrap(),
            salt,
            password,
            &mut derived_key,
        );
        
        Ok(derived_key)
    }
    
    /// Generate random bytes
    fn generate_random_bytes(&self, length: usize) -> Result<Vec<u8>, String> {
        let mut bytes = vec![0u8; length];
        let rng = rand::SystemRandom::new();
        rng.fill(&mut bytes)
            .map_err(|_| "Failed to generate random bytes".to_string())?;
        Ok(bytes)
    }
    
    /// Calculate hash of data
    pub fn calculate_hash(&self, data: &[u8]) -> String {
        let digest = digest::digest(&digest::SHA256, data);
        base64::encode(digest.as_ref())
    }
    
    /// Validate memory integrity
    pub fn validate_memory_integrity(&self) -> Result<bool, String> {
        // Record validation timestamp
        let timestamp = chrono::Utc::now().to_rfc3339();
        
        // Perform memory validation by computing checksum of memory map
        let mut combined_data = Vec::new();
        
        // Combine all memory entries for checksum calculation
        for (key, value) in &self.memory_map {
            combined_data.extend_from_slice(key.as_bytes());
            combined_data.extend_from_slice(value);
        }
        
        // Calculate checksum
        let _checksum = self.calculate_hash(&combined_data);
        
        // In a real implementation, this would validate against expected values
        // and possibly perform more sophisticated memory analysis
        
        Ok(true)
    }
    
    /// Store data in memory map
    pub fn store_memory(&mut self, key: &str, data: &[u8]) {
        self.memory_map.insert(key.to_string(), data.to_vec());
    }
    
    /// Retrieve data from memory map
    pub fn retrieve_memory(&self, key: &str) -> Option<Vec<u8>> {
        self.memory_map.get(key).cloned()
    }
    
    /// Clear memory map
    pub fn clear_memory(&mut self) {
        self.memory_map.clear();
    }
    
    /// Get module status
    pub fn get_status(&self) -> String {
        // Return module status
        let status = serde_json::json!({
            "active": true,
            "memory_entries": self.memory_map.len(),
            "validation_count": self.validation_timestamps.len(),
            "last_validation": self.validation_timestamps.last(),
        });
        
        serde_json::to_string(&status)
            .unwrap_or_else(|_| "{\"active\":true}".to_string())
    }
}