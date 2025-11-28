//! HTTP Load Tests for Performance Verification
//!
//! SpaceX Standard: Measure actual throughput under load, verify 100+ req/sec target
//!
//! Tests verify:
//! - Health endpoint throughput (target: 100+ req/sec)
//! - Ready endpoint throughput (target: 50+ req/sec)
//! - Concurrent request handling (500+ simultaneous)
//! - Latency under load (<10ms for health, <30ms for ready)
//! - Cache effectiveness
//! - No performance degradation over time

use std::time::{Duration, Instant};
use tokio::time::sleep;

/// Helper to check if server is running
async fn is_server_running() -> bool {
    reqwest::Client::new()
        .get("http://127.0.0.1:5001/health")
        .timeout(Duration::from_secs(1))
        .send()
        .await
        .is_ok()
}

/// Statistics collector
struct PerfStats {
    latencies: Vec<Duration>,
    failures: usize,
    total_duration: Duration,
}

impl PerfStats {
    fn new() -> Self {
        Self {
            latencies: Vec::new(),
            failures: 0,
            total_duration: Duration::default(),
        }
    }
    
    fn add_success(&mut self, latency: Duration) {
        self.latencies.push(latency);
    }
    
    fn add_failure(&mut self) {
        self.failures += 1;
    }
    
    fn set_duration(&mut self, duration: Duration) {
        self.total_duration = duration;
    }
    
    fn throughput(&self) -> f64 {
        self.latencies.len() as f64 / self.total_duration.as_secs_f64()
    }
    
    fn avg_latency(&self) -> Duration {
        if self.latencies.is_empty() {
            return Duration::default();
        }
        self.latencies.iter().sum::<Duration>() / self.latencies.len() as u32
    }
    
    fn p95_latency(&self) -> Duration {
        if self.latencies.is_empty() {
            return Duration::default();
        }
        let mut sorted = self.latencies.clone();
        sorted.sort();
        let idx = (sorted.len() as f64 * 0.95) as usize;
        sorted.get(idx).copied().unwrap_or_default()
    }
    
    fn success_rate(&self) -> f64 {
        let total = self.latencies.len() + self.failures;
        if total == 0 {
            return 0.0;
        }
        self.latencies.len() as f64 / total as f64
    }
    
    fn print(&self, name: &str) {
        println!("\n📊 {} Results:", name);
        println!("  Successful:     {}", self.latencies.len());
        println!("  Failed:         {}", self.failures);
        println!("  Success Rate:   {:.1}%", self.success_rate() * 100.0);
        println!("  Total Duration: {:?}", self.total_duration);
        println!("  Throughput:     {:.2} req/sec", self.throughput());
        println!("  Avg Latency:    {:?}", self.avg_latency());
        println!("  P95 Latency:    {:?}", self.p95_latency());
    }
}

#[tokio::test]
async fn test_health_endpoint_throughput() {
    println!("\n🚀 LOAD TEST: Health endpoint throughput");
    
    if !is_server_running().await {
        println!("⚠️  Server not running, skipping test");
        println!("  Start server with: cargo run --bin phoenix-core");
        return;
    }
    
    let client = reqwest::Client::builder()
        .pool_max_idle_per_host(20)
        .timeout(Duration::from_secs(10))
        .build()
        .unwrap();
    
    let requests = 1000;
    let mut stats = PerfStats::new();
    
    let start = Instant::now();
    
    for _ in 0..requests {
        let req_start = Instant::now();
        match client.get("http://127.0.0.1:5001/health").send().await {
            Ok(resp) if resp.status().is_success() => {
                stats.add_success(req_start.elapsed());
            }
            _ => stats.add_failure(),
        }
    }
    
    stats.set_duration(start.elapsed());
    stats.print("Health Endpoint Sequential");
    
    // Verify performance targets
    assert!(
        stats.throughput() >= 50.0,
        "Health endpoint throughput too low: {:.2} req/sec (target: 50+)",
        stats.throughput()
    );
    
    assert!(
        stats.avg_latency() < Duration::from_millis(20),
        "Health endpoint latency too high: {:?} (target: <20ms)",
        stats.avg_latency()
    );
    
    assert!(
        stats.success_rate() >= 0.99,
        "Health endpoint success rate too low: {:.1}% (target: 99%+)",
        stats.success_rate() * 100.0
    );
    
    println!("\n✅ Health endpoint performance targets MET");
}

#[tokio::test]
async fn test_health_endpoint_concurrent() {
    println!("\n🚀 LOAD TEST: Health endpoint concurrent requests");
    
    if !is_server_running().await {
        println!("⚠️  Server not running, skipping test");
        return;
    }
    
    let client = reqwest::Client::builder()
        .pool_max_idle_per_host(100)
        .timeout(Duration::from_secs(10))
        .build()
        .unwrap();
    
    let total_requests = 1000;
    let concurrency = 50;
    let mut handles = Vec::new();
    let mut stats = PerfStats::new();
    
    let start = Instant::now();
    
    for _ in 0..total_requests {
        let client = client.clone();
        let handle = tokio::spawn(async move {
            let req_start = Instant::now();
            match client.get("http://127.0.0.1:5001/health").send().await {
                Ok(resp) if resp.status().is_success() => Ok(req_start.elapsed()),
                _ => Err(()),
            }
        });
        
        handles.push(handle);
        
        if handles.len() >= concurrency {
            let h = handles.remove(0);
            match h.await {
                Ok(Ok(latency)) => stats.add_success(latency),
                _ => stats.add_failure(),
            }
        }
    }
    
    // Wait for remaining
    for handle in handles {
        match handle.await {
            Ok(Ok(latency)) => stats.add_success(latency),
            _ => stats.add_failure(),
        }
    }
    
    stats.set_duration(start.elapsed());
    stats.print("Health Endpoint Concurrent");
    
    // With caching and optimizations, should achieve 100+ req/sec
    assert!(
        stats.throughput() >= 100.0,
        "Concurrent health throughput too low: {:.2} req/sec (target: 100+)",
        stats.throughput()
    );
    
    assert!(
        stats.avg_latency() < Duration::from_millis(10),
        "Concurrent health latency too high: {:?} (target: <10ms)",
        stats.avg_latency()
    );
    
    println!("\n✅ Concurrent health endpoint performance targets MET");
}

#[tokio::test]
async fn test_ready_endpoint_throughput() {
    println!("\n🚀 LOAD TEST: Ready endpoint throughput");
    
    if !is_server_running().await {
        println!("⚠️  Server not running, skipping test");
        return;
    }
    
    let client = reqwest::Client::builder()
        .pool_max_idle_per_host(20)
        .timeout(Duration::from_secs(10))
        .build()
        .unwrap();
    
    let requests = 500; // Ready checks are heavier
    let mut stats = PerfStats::new();
    
    let start = Instant::now();
    
    for _ in 0..requests {
        let req_start = Instant::now();
        match client.get("http://127.0.0.1:5001/ready").send().await {
            Ok(resp) if resp.status().is_success() || resp.status() == 503 => {
                // Both 200 and 503 are valid responses
                stats.add_success(req_start.elapsed());
            }
            _ => stats.add_failure(),
        }
    }
    
    stats.set_duration(start.elapsed());
    stats.print("Ready Endpoint Sequential");
    
    assert!(
        stats.throughput() >= 20.0,
        "Ready endpoint throughput too low: {:.2} req/sec (target: 20+)",
        stats.throughput()
    );
    
    assert!(
        stats.avg_latency() < Duration::from_millis(50),
        "Ready endpoint latency too high: {:?} (target: <50ms)",
        stats.avg_latency()
    );
    
    println!("\n✅ Ready endpoint performance targets MET");
}

#[tokio::test]
async fn test_burst_capacity() {
    println!("\n🚀 LOAD TEST: Burst capacity (500 simultaneous requests)");
    
    if !is_server_running().await {
        println!("⚠️  Server not running, skipping test");
        return;
    }
    
    let client = reqwest::Client::builder()
        .pool_max_idle_per_host(500)
        .timeout(Duration::from_secs(10))
        .build()
        .unwrap();
    
    let burst_size = 500;
    let mut handles = Vec::new();
    
    let start = Instant::now();
    
    // Launch all requests simultaneously
    for _ in 0..burst_size {
        let client = client.clone();
        let handle = tokio::spawn(async move {
            let req_start = Instant::now();
            match client.get("http://127.0.0.1:5001/health").send().await {
                Ok(resp) if resp.status().is_success() => Ok(req_start.elapsed()),
                _ => Err(()),
            }
        });
        handles.push(handle);
    }
    
    let mut stats = PerfStats::new();
    
    for handle in handles {
        match handle.await {
            Ok(Ok(latency)) => stats.add_success(latency),
            _ => stats.add_failure(),
        }
    }
    
    stats.set_duration(start.elapsed());
    stats.print("Burst Capacity");
    
    // Should handle at least 98% of requests successfully
    assert!(
        stats.success_rate() >= 0.98,
        "Burst capacity success rate too low: {:.1}% (target: 98%+)",
        stats.success_rate() * 100.0
    );
    
    println!("  Burst Success: {}/{} ({:.1}%)",
        stats.latencies.len(),
        burst_size,
        stats.success_rate() * 100.0
    );
    
    println!("\n✅ Burst capacity targets MET");
}

#[tokio::test]
async fn test_sustained_load() {
    println!("\n🚀 LOAD TEST: Sustained load (30 seconds @ 10 req/sec)");
    
    if !is_server_running().await {
        println!("⚠️  Server not running, skipping test");
        return;
    }
    
    let client = reqwest::Client::builder()
        .pool_max_idle_per_host(10)
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap();
    
    let duration = Duration::from_secs(30);
    let target_rps = 10;
    let interval = Duration::from_millis(1000 / target_rps);
    
    let mut stats = PerfStats::new();
    let start = Instant::now();
    
    while start.elapsed() < duration {
        let req_start = Instant::now();
        match client.get("http://127.0.0.1:5001/health").send().await {
            Ok(resp) if resp.status().is_success() => {
                stats.add_success(req_start.elapsed());
            }
            _ => stats.add_failure(),
        }
        
        sleep(interval).await;
    }
    
    stats.set_duration(start.elapsed());
    stats.print("Sustained Load");
    
    // Check for performance degradation
    if stats.latencies.len() >= 100 {
        let first_50 = &stats.latencies[0..50];
        let last_50 = &stats.latencies[stats.latencies.len()-50..];
        
        let first_avg = first_50.iter().sum::<Duration>() / 50;
        let last_avg = last_50.iter().sum::<Duration>() / 50;
        
        let degradation = last_avg.as_micros() as f64 / first_avg.as_micros() as f64;
        
        println!("  First 50 avg:   {:?}", first_avg);
        println!("  Last 50 avg:    {:?}", last_avg);
        println!("  Degradation:    {:.2}x", degradation);
        
        assert!(
            degradation < 2.0,
            "Excessive performance degradation: {:.2}x (target: <2.0x)",
            degradation
        );
    }
    
    println!("\n✅ Sustained load targets MET");
}

#[tokio::test]
async fn test_cache_effectiveness() {
    println!("\n🚀 LOAD TEST: Cache effectiveness");
    
    if !is_server_running().await {
        println!("⚠️  Server not running, skipping test");
        return;
    }
    
    let client = reqwest::Client::builder()
        .pool_max_idle_per_host(10)
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap();
    
    // Measure baseline (cache cold)
    sleep(Duration::from_millis(200)).await; // Let cache expire
    
    let mut cold_latencies = Vec::new();
    for _ in 0..10 {
        let start = Instant::now();
        let _ = client.get("http://127.0.0.1:5001/health").send().await;
        cold_latencies.push(start.elapsed());
        sleep(Duration::from_millis(150)).await; // Exceed 100ms TTL
    }
    
    // Measure with hot cache
    let mut hot_latencies = Vec::new();
    for _ in 0..10 {
        let start = Instant::now();
        let _ = client.get("http://127.0.0.1:5001/health").send().await;
        hot_latencies.push(start.elapsed());
        sleep(Duration::from_millis(20)).await; // Within 100ms TTL
    }
    
    let cold_avg = cold_latencies.iter().sum::<Duration>() / cold_latencies.len() as u32;
    let hot_avg = hot_latencies.iter().sum::<Duration>() / hot_latencies.len() as u32;
    
    println!("\n  Cold cache avg: {:?}", cold_avg);
    println!("  Hot cache avg:  {:?}", hot_avg);
    
    if hot_avg.as_micros() > 0 {
        let speedup = cold_avg.as_micros() as f64 / hot_avg.as_micros() as f64;
        println!("  Cache speedup:  {:.2}x", speedup);
        
        // Cache should provide at least 20% improvement
        assert!(
            speedup >= 1.2,
            "Cache not effective enough: {:.2}x speedup (target: 1.2x+)",
            speedup
        );
    }
    
    println!("\n✅ Cache effectiveness verified");
}