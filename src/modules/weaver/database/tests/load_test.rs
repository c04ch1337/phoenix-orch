//! Database Load Testing
//!
//! This test verifies that our SQLite connection pooling implementation
//! handles concurrent load properly without "database is locked" errors.

use crate::modules::weaver::database::{Database, AdoptedRepo, RepoStatus, HealthStatus};
use serde_json::json;
use tokio::time::{Duration, Instant};
use uuid::Uuid;
use chrono::Utc;
use futures::future::join_all;
use std::sync::{Arc, atomic::{AtomicUsize, Ordering}};

#[tokio::test(flavor = "multi_thread", worker_threads = 16)]
async fn test_database_under_load() {
    println!("🔍 DATABASE LOAD TEST: Concurrent operations (100 threads)");
    
    // Use in-memory SQLite for testing
    let db = Database::new("sqlite::memory:", Some(20)).await
        .expect("Failed to create test database");
    
    // Create shared database reference
    let db = Arc::new(db);
    
    // First, initialize with some data
    initialize_test_data(&db).await;
    
    // Track success/failure metrics
    let success_count = Arc::new(AtomicUsize::new(0));
    let failure_count = Arc::new(AtomicUsize::new(0));
    let success_count_clone = success_count.clone();
    let failure_count_clone = failure_count.clone();
    
    // Concurrent operation count
    let operations_per_type = 100;
    let total_operations = operations_per_type * 3; // read, write, update
    
    // Start timer
    let start_time = Instant::now();
    
    // Create a mix of read and write operations to run concurrently
    let mut handles = Vec::new();
    
    // Test reads - should not cause locking issues due to shared access
    for _ in 0..operations_per_type {
        let db_clone = db.clone();
        let success_count = success_count.clone();
        let failure_count = failure_count.clone();
        
        let handle = tokio::spawn(async move {
            match db_clone.list_repos().await {
                Ok(_) => {
                    success_count.fetch_add(1, Ordering::Relaxed);
                }
                Err(e) => {
                    eprintln!("Read error: {}", e);
                    failure_count.fetch_add(1, Ordering::Relaxed);
                }
            }
        });
        
        handles.push(handle);
    }
    
    // Test writes - potential for locking without pooling
    for i in 0..operations_per_type {
        let db_clone = db.clone();
        let success_count = success_count.clone();
        let failure_count = failure_count.clone();
        
        let handle = tokio::spawn(async move {
            let repo = AdoptedRepo {
                id: Uuid::new_v4(),
                name: format!("load-test-repo-{}", i),
                repo_url: format!("https://github.com/test/load-{}", i),
                git_ref: "main".to_string(),
                adopted_at: Utc::now(),
                metadata: json!({"test": "load", "index": i}),
                status: RepoStatus::Active,
                health: HealthStatus::Healthy,
            };
            
            match db_clone.insert_repo(&repo).await {
                Ok(_) => {
                    success_count.fetch_add(1, Ordering::Relaxed);
                }
                Err(e) => {
                    eprintln!("Write error: {}", e);
                    failure_count.fetch_add(1, Ordering::Relaxed);
                }
            }
        });
        
        handles.push(handle);
    }
    
    // Test updates - potential for locking without proper transaction handling
    for _ in 0..operations_per_type {
        let db_clone = db.clone();
        let success_count = success_count.clone();
        let failure_count = failure_count.clone();
        
        let handle = tokio::spawn(async move {
            // Get a random repo to update
            let repos = match db_clone.list_repos().await {
                Ok(repos) => repos,
                Err(e) => {
                    eprintln!("Failed to list repos for update: {}", e);
                    failure_count.fetch_add(1, Ordering::Relaxed);
                    return;
                }
            };
            
            if repos.is_empty() {
                // Nothing to update yet
                success_count.fetch_add(1, Ordering::Relaxed);
                return;
            }
            
            // Select a repo to update (using a simple index calculation)
            let idx = Uuid::new_v4().as_u128() as usize % repos.len();
            let repo_id = repos[idx].id;
            
            // Perform update
            match db_clone.update_repo_status(repo_id, RepoStatus::Archived).await {
                Ok(_) => {
                    success_count.fetch_add(1, Ordering::Relaxed);
                }
                Err(e) => {
                    eprintln!("Update error: {}", e);
                    failure_count.fetch_add(1, Ordering::Relaxed);
                }
            }
        });
        
        handles.push(handle);
    }
    
    // Wait for all operations to complete
    join_all(handles).await;
    
    // Calculate performance metrics
    let elapsed = start_time.elapsed();
    let success_count = success_count_clone.load(Ordering::Relaxed);
    let failure_count = failure_count_clone.load(Ordering::Relaxed);
    
    // Get database metrics
    let db_metrics = db.get_metrics().await;
    
    // Print results
    println!("✅ Database load test completed");
    println!("  Duration: {:?}", elapsed);
    println!("  Operations: {}", total_operations);
    println!("  Successes: {} ({:.1}%)", 
        success_count, 
        success_count as f64 / total_operations as f64 * 100.0
    );
    println!("  Failures: {} ({:.1}%)", 
        failure_count, 
        failure_count as f64 / total_operations as f64 * 100.0
    );
    println!("  Operations per second: {:.1}", 
        total_operations as f64 / elapsed.as_secs_f64()
    );
    
    // Print pool metrics
    println!("  Connection pool metrics:");
    println!("    In use: {}/{}", db_metrics.connections_in_use, db_metrics.connections_max);
    println!("    Idle: {}", db_metrics.idle_connections);
    println!("    Is closed: {}", db_metrics.is_closed);
    
    // Run health check
    let health_status = db.health_check().await;
    println!("  Database health check: {}", if health_status { "PASSED" } else { "FAILED" });
    
    // Verify success rate is acceptable
    let success_rate = success_count as f64 / total_operations as f64;
    assert!(success_rate > 0.95, "Success rate too low: {:.1}%", success_rate * 100.0);
    
    // Verify health check passes
    assert!(health_status, "Final health check failed");
}

// Initialize database with test data
async fn initialize_test_data(db: &Database) -> usize {
    const INITIAL_COUNT: usize = 20;
    
    for i in 0..INITIAL_COUNT {
        let repo = AdoptedRepo {
            id: Uuid::new_v4(),
            name: format!("test-repo-{}", i),
            repo_url: format!("https://github.com/test/repo-{}", i),
            git_ref: "main".to_string(),
            adopted_at: Utc::now(),
            metadata: json!({"initializer": true, "index": i}),
            status: RepoStatus::Active,
            health: HealthStatus::Healthy,
        };
        
        db.insert_repo(&repo).await.expect("Failed to insert initial test data");
    }
    
    INITIAL_COUNT
}

// Test retry logic specifically
#[tokio::test]
async fn test_retry_logic() {
    println!("🔍 DATABASE RETRY TEST: Verify retry logic works");
    
    // Use in-memory SQLite for testing
    let db = Database::new("sqlite::memory:", Some(5)).await
        .expect("Failed to create test database");
    
    // Create a high contention scenario with limited connections
    let db = Arc::new(db);
    
    // Start 50 concurrent operations with only 5 connections
    // This will force retry logic to activate
    let mut handles = Vec::new();
    
    for i in 0..50 {
        let db_clone = db.clone();
        
        let handle = tokio::spawn(async move {
            // Each task does a write that would normally cause lock contention
            let repo = AdoptedRepo {
                id: Uuid::new_v4(),
                name: format!("retry-test-{}", i),
                repo_url: format!("https://github.com/test/retry-{}", i),
                git_ref: "main".to_string(),
                adopted_at: Utc::now(),
                metadata: json!({"retry_test": true}),
                status: RepoStatus::Active,
                health: HealthStatus::Healthy,
            };
            
            db_clone.insert_repo(&repo).await
        });
        
        handles.push(handle);
    }
    
    // Wait for all operations to complete
    let results = join_all(handles).await;
    
    // Count successes and failures
    let success_count = results.iter()
        .filter(|r| r.is_ok() && r.as_ref().unwrap().is_ok())
        .count();
    
    println!("✅ Retry logic test completed");
    println!("  Successes: {}/50", success_count);
    
    // We should have high success rate even with limited connections
    // thanks to retry logic and connection pooling
    assert!(success_count >= 45, "Too many failures with retry logic");
}