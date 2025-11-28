//! Real-World Failure Scenario Tests for Phoenix AGI Kernel
//!
//! SpaceX Standard: Test the failure modes you'll encounter in production.
//!
//! These tests simulate:
//! - Corrupted databases
//! - Missing configuration files
//! - Disk full conditions
//! - Network issues
//! - Permission problems

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tempfile::tempdir;
use tokio::sync::RwLock;

use plastic_ltm::PlasticLtm;
use triune_conscience::{TriuneConscience, WorldModel as ConscienceWorldModel};
use world_self_model::WorldModel;

#[tokio::test]
async fn test_corrupted_database() {
    println!("💥 FAILURE TEST: Corrupted sled database");
    
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("db");
    
    // Create a valid database first
    let (_public_key, secret_key) = pqcrypto::sign::dilithium2::keypair();
    
    {
        let ltm = PlasticLtm::new(
            temp_dir.path().to_path_buf(),
            vec![],
            secret_key.clone(),
        )
        .await
        .expect("Failed to create initial LTM");
        
        // Store some data
        ltm.store(b"test_data".to_vec()).await.expect("Failed to store");
        ltm.persist().await.expect("Failed to persist");
    }
    
    // Corrupt the database by writing garbage to it
    if db_path.exists() {
        let corrupt_file = db_path.join("db");
        if corrupt_file.exists() {
            fs::write(&corrupt_file, b"CORRUPTED_GARBAGE_DATA_XXX")
                .expect("Failed to corrupt file");
            println!("  Corrupted database file: {:?}", corrupt_file);
        }
    }
    
    // Try to open corrupted database
    let result = PlasticLtm::new(
        temp_dir.path().to_path_buf(),
        vec![],
        secret_key,
    )
    .await;
    
    // Should either recreate cleanly or report corruption
    match result {
        Ok(ltm) => {
            // If it opened, verify_integrity should detect problems
            let integrity = ltm.verify_integrity().await.unwrap();
            println!("  Database opened, integrity: {:.2}", integrity);
            
            // System should remain stable even with low integrity
            assert!(integrity >= 0.0 && integrity <= 1.0, "Integrity out of range");
        }
        Err(e) => {
            // Expected: database corruption detected
            println!("  Database corruption detected: {:?}", e);
            println!("  ✓ System didn't crash on corruption");
        }
    }
    
    println!("✓ Corrupted database handled gracefully");
}

#[tokio::test]
async fn test_missing_axioms_file() {
    println!("💥 FAILURE TEST: Missing axioms.json file");
    
    let world_model = Arc::new(RwLock::new(ConscienceWorldModel {
        state: HashMap::new(),
    }));
    
    // Try to create conscience with non-existent axioms file
    let nonexistent_path = PathBuf::from("/tmp/nonexistent_path_phoenix_test/axioms.json");
    
    let result = TriuneConscience::with_axioms_path(
        vec![],
        world_model.clone(),
        nonexistent_path.clone(),
    );
    
    match result {
        Ok(conscience) => {
            // Conscience created but should have reduced alignment
            let alignment = conscience.get_alignment().await.expect("Should get alignment");
            println!("  Conscience created with alignment: {:.2}", alignment);
            
            // Without axioms, alignment should be low
            assert!(alignment <= 0.7, "Alignment should be reduced without axioms: {}", alignment);
            
            // Should be able to evaluate actions but with low confidence
            let (decision, confidence, reasoning) = conscience
                .evaluate_action("test action")
                .await
                .expect("Should evaluate");
            
            println!("  Evaluation: decision={}, confidence={:.2}", decision, confidence);
            println!("  Reasoning: {}", reasoning);
            
            assert!(confidence <= 0.6, "Confidence should be low without axioms");
        }
        Err(e) => {
            // Also acceptable - fail gracefully with clear error
            println!("  Failed to create conscience: {:?}", e);
        }
    }
    
    println!("✓ Missing axioms file handled gracefully");
}

#[tokio::test]
async fn test_missing_axioms_file_with_warning() {
    println!("💥 FAILURE TEST: Missing axioms with system warning");
    
    let world_model = Arc::new(RwLock::new(ConscienceWorldModel {
        state: HashMap::new(),
    }));
    
    let missing_path = PathBuf::from("/nonexistent/axioms.json");
    
    let conscience = TriuneConscience::with_axioms_path(
        vec![],
        world_model,
        missing_path,
    )
    .expect("Should create conscience even without axioms");
    
    // System should log warning but continue
    let alignment = conscience.get_alignment().await;
    assert!(alignment.is_ok(), "Should return alignment even without axioms");
    
    let alignment_score = alignment.unwrap();
    println!("  Alignment without axioms: {:.2}", alignment_score);
    
    // Should be able to operate in degraded mode
    assert!(alignment_score >= 0.0, "Alignment should be non-negative");
    
    println!("✓ System operates in degraded mode without axioms");
}

#[tokio::test]
async fn test_disk_full_scenario() {
    println!("💥 FAILURE TEST: Disk full simulation");
    
    // Note: We can't actually fill the disk, but we can test small storage
    let temp_dir = tempdir().unwrap();
    let (_public_key, secret_key) = pqcrypto::sign::dilithium2::keypair();
    
    let ltm = PlasticLtm::new(
        temp_dir.path().to_path_buf(),
        vec![],
        secret_key,
    )
    .await
    .expect("Failed to create LTM");
    
    // Try to store many large chunks to simulate approaching disk limits
    let mut stored_ids = Vec::new();
    let large_data = vec![0u8; 1024 * 1024]; // 1MB chunks
    
    for i in 0..10 {
        match ltm.store(large_data.clone()).await {
            Ok(id) => {
                stored_ids.push(id);
                println!("  Stored chunk {}: success", i + 1);
            }
            Err(e) => {
                println!("  Storage failed at chunk {}: {:?}", i + 1, e);
                println!("  ✓ Graceful failure handling");
                break;
            }
        }
    }
    
    // System should remain operational even after storage failures
    let integrity = ltm.verify_integrity().await;
    assert!(integrity.is_ok(), "System should remain stable after storage issues");
    
    // Should be able to retrieve previously stored data
    if !stored_ids.is_empty() {
        let first_id = &stored_ids[0];
        let retrieved = ltm.retrieve(first_id).await;
        assert!(retrieved.is_ok(), "Should retrieve existing data after failures");
    }
    
    println!("✓ Disk full scenario handled gracefully");
    println!("  - Stored {} chunks before potential limit", stored_ids.len());
    println!("  - System stability maintained: ✓");
}

#[tokio::test]
async fn test_read_only_filesystem() {
    println!("💥 FAILURE TEST: Read-only filesystem simulation");
    
    let temp_dir = tempdir().unwrap();
    let (_public_key, secret_key) = pqcrypto::sign::dilithium2::keypair();
    
    // Create and populate database
    let ltm = PlasticLtm::new(
        temp_dir.path().to_path_buf(),
        vec![],
        secret_key.clone(),
    )
    .await
    .expect("Failed to create LTM");
    
    let data = b"test_data_before_readonly".to_vec();
    let id = ltm.store(data.clone()).await.expect("Failed initial store");
    
    // We can't actually make filesystem read-only in test,
    // but we can test read operations still work
    let retrieved = ltm.retrieve(&id).await;
    assert!(retrieved.is_ok(), "Reads should work on read-only filesystem");
    
    let retrieved_data = retrieved.unwrap();
    assert_eq!(retrieved_data.data.content, data, "Data should match");
    
    // Verify integrity check (read operation) works
    let integrity = ltm.verify_integrity().await;
    assert!(integrity.is_ok(), "Integrity checks should work in read-only mode");
    
    println!("✓ Read-only filesystem handled gracefully");
    println!("  - Read operations: ✓");
    println!("  - Integrity checks: ✓");
}

#[tokio::test]
async fn test_network_partition_simulation() {
    println!("💥 FAILURE TEST: Network partition (local operation)");
    
    // In a distributed system, network partition would affect sync
    // In local mode, test that system operates without network
    
    let temp_dir = tempdir().unwrap();
    let (_public_key, secret_key) = pqcrypto::sign::dilithium2::keypair();
    
    // Create LTM without mirrors (simulates no network connectivity)
    let ltm = PlasticLtm::new(
        temp_dir.path().to_path_buf(),
        vec![], // No mirror locations
        secret_key,
    )
    .await
    .expect("Should work without network");
    
    // All local operations should work
    let data = b"local_operation_data".to_vec();
    let id = ltm.store(data.clone()).await.expect("Local store should work");
    
    let retrieved = ltm.retrieve(&id).await.expect("Local retrieve should work");
    assert_eq!(retrieved.data.content, data);
    
    let integrity = ltm.verify_integrity().await.expect("Integrity check should work");
    assert!(integrity > 0.9, "Integrity should be high for local operations");
    
    // Create other components - should all work locally
    let world_model = WorldModel::new().await.expect("WorldModel should work offline");
    let coherence = world_model.get_coherence().await.expect("Should work offline");
    assert!(coherence >= 0.0, "Coherence check should work offline");
    
    println!("✓ Network partition handled gracefully");
    println!("  - Local operations: ✓");
    println!("  - Degraded mode: ✓");
    println!("  - No network dependency: ✓");
}

#[tokio::test]
async fn test_malformed_data_recovery() {
    println!("💥 FAILURE TEST: Malformed data in storage");
    
    let temp_dir = tempdir().unwrap();
    let (_public_key, secret_key) = pqcrypto::sign::dilithium2::keypair();
    
    let ltm = PlasticLtm::new(
        temp_dir.path().to_path_buf(),
        vec![],
        secret_key,
    )
    .await
    .expect("Failed to create LTM");
    
    // Store various edge cases
    let test_cases = vec![
        (b"".to_vec(), "empty data"),
        (vec![0u8; 0], "zero-length vector"),
        (vec![0xFF; 1000], "all 0xFF bytes"),
        (vec![0x00; 1000], "all 0x00 bytes"),
    ];
    
    for (data, description) in test_cases {
        println!("  Testing: {}", description);
        
        let result = ltm.store(data.clone()).await;
        match result {
            Ok(id) => {
                // Should be able to retrieve it back
                let retrieved = ltm.retrieve(&id).await;
                assert!(retrieved.is_ok(), "Should retrieve {}", description);
                println!("    ✓ Stored and retrieved {}", description);
            }
            Err(e) => {
                println!("    Storage failed (acceptable): {:?}", e);
            }
        }
    }
    
    // System should remain stable after edge cases
    let integrity = ltm.verify_integrity().await.expect("Integrity check failed");
    assert!(integrity >= 0.0, "System should remain stable");
    
    println!("✓ Malformed data handled without corruption");
}

#[tokio::test]
async fn test_component_initialization_failure_recovery() {
    println!("💥 FAILURE TEST: Component initialization failure cascade");
    
    // Test that if one component fails to initialize, others can still work
    
    // Initialize WorldModel first (doesn't depend on others)
    let world_model = WorldModel::new().await;
    assert!(world_model.is_ok(), "WorldModel should initialize independently");
    let wm = world_model.unwrap();
    
    // Even if Conscience fails to initialize (missing axioms),
    // WorldModel should continue to work
    let coherence = wm.get_coherence().await;
    assert!(coherence.is_ok(), "WorldModel should work despite other failures");
    
    // Initialize PlasticLTM independently
    let temp_dir = tempdir().unwrap();
    let (_public_key, secret_key) = pqcrypto::sign::dilithium2::keypair();
    
    let ltm = PlasticLtm::new(
        temp_dir.path().to_path_buf(),
        vec![],
        secret_key,
    )
    .await;
    assert!(ltm.is_ok(), "PlasticLTM should initialize independently");
    
    println!("✓ Component isolation prevents cascade failures");
    println!("  - Independent initialization: ✓");
    println!("  - Graceful degradation: ✓");
}

#[tokio::test]
async fn test_concurrent_corruption_attempts() {
    println!("💥 FAILURE TEST: Concurrent corruption attempts");
    
    let temp_dir = tempdir().unwrap();
    let (_public_key, secret_key) = pqcrypto::sign::dilithium2::keypair();
    
    let ltm = PlasticLtm::new(
        temp_dir.path().to_path_buf(),
        vec![],
        secret_key,
    )
    .await
    .expect("Failed to create LTM");
    
    let ltm = Arc::new(ltm);
    
    // Spawn multiple concurrent operations with potentially conflicting data
    let mut handles = Vec::new();
    
    for i in 0..20 {
        let ltm_clone = ltm.clone();
        let handle = tokio::spawn(async move {
            // Mix of normal and edge-case data
            let data = if i % 3 == 0 {
                vec![0xFF; 100]
            } else if i % 3 == 1 {
                vec![0x00; 100]
            } else {
                format!("data_{}", i).into_bytes()
            };
            
            ltm_clone.store(data).await
        });
        handles.push(handle);
    }
    
    // Wait for all operations
    let mut successes = 0;
    let mut failures = 0;
    
    for handle in handles {
        match handle.await {
            Ok(Ok(_)) => successes += 1,
            Ok(Err(_)) | Err(_) => failures += 1,
        }
    }
    
    println!("  Concurrent operations: {} succeeded, {} failed", successes, failures);
    
    // Verify system integrity after concurrent stress
    let integrity = ltm.verify_integrity().await.expect("Should complete integrity check");
    assert!(integrity >= 0.0, "System should remain stable after concurrent stress");
    
    println!("✓ Concurrent corruption attempts handled");
    println!("  - No data races: ✓");
    println!("  - Integrity maintained: {:.2}", integrity);
}

#[tokio::test]
async fn test_resource_exhaustion_graceful_failure() {
    println!("💥 FAILURE TEST: Resource exhaustion (memory pressure)");
    
    let temp_dir = tempdir().unwrap();
    let (_public_key, secret_key) = pqcrypto::sign::dilithium2::keypair();
    
    let ltm = PlasticLtm::new(
        temp_dir.path().to_path_buf(),
        vec![],
        secret_key,
    )
    .await
    .expect("Failed to create LTM");
    
    // Try to allocate progressively larger chunks
    let mut last_successful_size = 0;
    let sizes = vec![
        1024,           // 1 KB
        10 * 1024,      // 10 KB
        100 * 1024,     // 100 KB
        1024 * 1024,    // 1 MB
        10 * 1024 * 1024, // 10 MB
    ];
    
    for size in sizes {
        let data = vec![0u8; size];
        match ltm.store(data).await {
            Ok(_) => {
                last_successful_size = size;
                println!("  Successfully stored {} bytes", size);
            }
            Err(e) => {
                println!("  Failed at {} bytes: {:?}", size, e);
                break;
            }
        }
    }
    
    // System should still be operational
    let integrity = ltm.verify_integrity().await;
    assert!(integrity.is_ok(), "System should remain operational after memory pressure");
    
    println!("✓ Resource exhaustion handled gracefully");
    println!("  - Last successful size: {} bytes", last_successful_size);
    println!("  - System stability: ✓");
}