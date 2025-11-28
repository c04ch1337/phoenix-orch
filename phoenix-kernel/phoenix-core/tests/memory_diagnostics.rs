//! Memory Diagnostics for Phoenix AGI Kernel
//!
//! This test file contains detailed memory profiling and leak detection tests
//! to identify the source of memory growth during sustained operations.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime};
use tempfile::tempdir;

use plastic_ltm::PlasticLtm;
use triune_conscience::{TriuneConscience, WorldModel as ConscienceWorldModel};
use world_self_model::WorldModel;
use phoenix_common::types::{Event, PhoenixId, SensorReading};
use tokio::sync::RwLock;

/// Helper to estimate current process memory usage (Linux only)
fn get_process_memory_mb() -> f64 {
    #[cfg(target_os = "linux")]
    {
        if let Ok(status) = std::fs::read_to_string("/proc/self/status") {
            for line in status.lines() {
                if line.starts_with("VmRSS:") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 2 {
                        if let Ok(kb) = parts[1].parse::<f64>() {
                            return kb / 1024.0; // Convert to MB
                        }
                    }
                }
            }
        }
    }
    0.0 // Fallback for non-Linux or if reading fails
}

/// Test helper to force garbage collection hints
async fn force_gc_hint() {
    tokio::time::sleep(Duration::from_millis(10)).await;
}

#[tokio::test]
async fn diagnose_plastic_ltm_memory_leak() {
    println!("🔬 DIAGNOSTIC: PlasticLTM memory leak detection");
    
    let temp_dir = tempdir().unwrap();
    let (_public_key, secret_key) = pqcrypto::sign::dilithium2::keypair();
    
    let ltm = PlasticLtm::new(
        temp_dir.path().to_path_buf(),
        vec![],
        secret_key,
    )
    .await
    .expect("Failed to create PlasticLTM");
    
    let cycles = 100;
    let mut memory_samples = Vec::new();
    let mut cycle_times = Vec::new();
    
    let start_mem = get_process_memory_mb();
    println!("  Starting memory: {:.2} MB", start_mem);
    
    for i in 0..cycles {
        let cycle_start = Instant::now();
        let cycle_mem_start = get_process_memory_mb();
        
        // PlasticLTM store operation
        let data = format!("diagnostic_test_{}", i).into_bytes();
        let id = ltm.store(data.clone()).await.expect("Store failed");
        
        // Retrieve to test round-trip
        let _retrieved = ltm.retrieve(&id).await.expect("Retrieve failed");
        
        force_gc_hint().await;
        
        let cycle_time = cycle_start.elapsed();
        let cycle_mem_end = get_process_memory_mb();
        
        cycle_times.push(cycle_time);
        memory_samples.push(cycle_mem_end);
        
        if (i + 1) % 10 == 0 {
            let mem_delta = cycle_mem_end - start_mem;
            println!("  Cycle {}: {} MB (+{:.2} MB), {:?}", 
                i + 1, cycle_mem_end, mem_delta, cycle_time);
        }
    }
    
    let end_mem = get_process_memory_mb();
    let growth = end_mem - start_mem;
    
    // Analyze performance degradation
    let first_10_avg = cycle_times[0..10].iter().sum::<Duration>() / 10;
    let last_10_avg = cycle_times[cycles-10..cycles].iter().sum::<Duration>() / 10;
    let time_ratio = last_10_avg.as_micros() as f64 / first_10_avg.as_micros() as f64;
    
    println!("\n📊 Analysis:");
    println!("  Memory growth: {:.2} MB over {} cycles", growth, cycles);
    println!("  Per-cycle overhead: {:.2} KB", (growth * 1024.0) / cycles as f64);
    println!("  First 10 cycles avg: {:?}", first_10_avg);
    println!("  Last 10 cycles avg: {:?}", last_10_avg);
    println!("  Performance ratio: {:.2}x", time_ratio);
    
    // Assert reasonable growth (<50MB for 100 cycles with 1KB data each)
    assert!(growth < 50.0, "Excessive memory growth detected: {:.2} MB", growth);
    assert!(time_ratio < 2.0, "Significant performance degradation: {:.2}x", time_ratio);
}

#[tokio::test]
async fn diagnose_merkle_tree_accumulation() {
    println!("🔬 DIAGNOSTIC: Merkle tree node accumulation");
    
    let temp_dir = tempdir().unwrap();
    let (_public_key, secret_key) = pqcrypto::sign::dilithium2::keypair();
    
    let ltm = PlasticLtm::new(
        temp_dir.path().to_path_buf(),
        vec![],
        secret_key,
    )
    .await
    .expect("Failed to create PlasticLTM");
    
    let cycles = 50;
    
    for i in 0..cycles {
        // Store multiple items
        for j in 0..10 {
            let data = format!("merkle_test_{}_{}", i, j).into_bytes();
            let _id = ltm.store(data).await.expect("Store failed");
        }
        
        // Get stats after each batch
        if (i + 1) % 10 == 0 {
            let stats = ltm.get_stats().await.expect("Stats failed");
            let mem = get_process_memory_mb();
            println!("  After {} batches: {} fragments, {:.2} MB", 
                i + 1, stats.fragment_count, mem);
        }
    }
    
    let final_stats = ltm.get_stats().await.expect("Stats failed");
    println!("\n📊 Final stats:");
    println!("  Total fragments: {}", final_stats.fragment_count);
    println!("  Expected: {}", cycles * 10);
    
    // The fragment count should match what we inserted
    assert_eq!(final_stats.fragment_count, cycles * 10);
}

#[tokio::test]
async fn diagnose_iterator_leak() {
    println!("🔬 DIAGNOSTIC: Iterator reference leak");
    
    let temp_dir = tempdir().unwrap();
    let (_public_key, secret_key) = pqcrypto::sign::dilithium2::keypair();
    
    let ltm = PlasticLtm::new(
        temp_dir.path().to_path_buf(),
        vec![],
        secret_key,
    )
    .await
    .expect("Failed to create PlasticLTM");
    
    // Store some data
    for i in 0..20 {
        let data = format!("iterator_test_{}", i).into_bytes();
        let _id = ltm.store(data).await.expect("Store failed");
    }
    
    let start_mem = get_process_memory_mb();
    println!("  Starting memory: {:.2} MB", start_mem);
    
    // Repeatedly call retrieve_all_ids which uses iterators
    for i in 0..100 {
        let ids = ltm.retrieve_all_ids().await.expect("Failed to get IDs");
        
        if (i + 1) % 20 == 0 {
            let mem = get_process_memory_mb();
            println!("  After {} iterations: {} IDs, {:.2} MB", 
                i + 1, ids.len(), mem);
        }
    }
    
    force_gc_hint().await;
    
    let end_mem = get_process_memory_mb();
    let growth = end_mem - start_mem;
    
    println!("  Memory growth from iterators: {:.2} MB", growth);
    
    // Iterators should not cause significant memory growth
    assert!(growth < 10.0, "Iterator memory leak detected: {:.2} MB", growth);
}

#[tokio::test]
async fn diagnose_full_system_leak() {
    println!("🔬 DIAGNOSTIC: Full system memory leak (all components)");
    
    let temp_dir = tempdir().unwrap();
    let (_public_key, secret_key) = pqcrypto::sign::dilithium2::keypair();
    
    let ltm = PlasticLtm::new(
        temp_dir.path().to_path_buf(),
        vec![],
        secret_key,
    )
    .await
    .expect("Failed to create PlasticLTM");
    
    let world_model_ref = Arc::new(RwLock::new(ConscienceWorldModel {
        state: HashMap::new(),
    }));
    
    let conscience = TriuneConscience::new(vec![], world_model_ref)
        .expect("Failed to create TriuneConscience");
    
    let world_model = WorldModel::new().await
        .expect("Failed to create WorldModel");
    
    let cycles = 100;
    let start_mem = get_process_memory_mb();
    
    println!("  Starting memory: {:.2} MB", start_mem);
    
    for i in 0..cycles {
        // Full operation cycle
        let data = format!("full_test_{}", i).into_bytes();
        let id = ltm.store(data).await.expect("Store failed");
        let _ = ltm.retrieve(&id).await.expect("Retrieve failed");
        let _ = conscience.get_alignment().await.expect("Alignment failed");
        
        let event = Event {
            id: PhoenixId([i as u8; 32]),
            timestamp: SystemTime::now(),
            data: SensorReading {
                data: vec![0.5; 512],
                confidence: 0.9,
                metadata: HashMap::new(),
                timestamp: SystemTime::now(),
            },
            metadata: HashMap::new(),
        };
        let _ = world_model.update(event).await.expect("Update failed");
        
        if (i + 1) % 20 == 0 {
            let mem = get_process_memory_mb();
            println!("  Cycle {}: {:.2} MB", i + 1, mem);
        }
    }
    
    let end_mem = get_process_memory_mb();
    let growth = end_mem - start_mem;
    
    println!("\n📊 Full system analysis:");
    println!("  Memory growth: {:.2} MB over {} cycles", growth, cycles);
    println!("  Per-cycle overhead: {:.2} KB", (growth * 1024.0) / cycles as f64);
    
    // Full system should show controlled memory growth
    assert!(growth < 100.0, "Excessive full system memory growth: {:.2} MB", growth);
}