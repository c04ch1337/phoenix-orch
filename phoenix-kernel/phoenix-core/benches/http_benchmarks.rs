//! HTTP Performance Benchmarks
//!
//! Tests endpoint throughput and latency improvements after optimizations.
//! Target: 100+ req/sec health checks, <10ms latencies

use std::time::{Duration, Instant};
use tokio::runtime::Runtime;

/// Benchmark configuration
const WARMUP_REQUESTS: usize = 100;
const BENCHMARK_REQUESTS: usize = 1000;
const CONCURRENT_CONNECTIONS: usize = 10;

/// Statistics for benchmark results
#[derive(Debug)]
struct BenchmarkStats {
    total_requests: usize,
    successful_requests: usize,
    failed_requests: usize,
    total_duration: Duration,
    min_latency: Duration,
    max_latency: Duration,
    avg_latency: Duration,
    p50_latency: Duration,
    p95_latency: Duration,
    p99_latency: Duration,
    requests_per_second: f64,
}

impl BenchmarkStats {
    fn from_latencies(latencies: &[Duration], total_duration: Duration, failed: usize) -> Self {
        let mut sorted = latencies.to_vec();
        sorted.sort();
        
        let total_requests = sorted.len() + failed;
        let successful = sorted.len();
        
        let min = sorted.first().copied().unwrap_or_default();
        let max = sorted.last().copied().unwrap_or_default();
        let avg = sorted.iter().sum::<Duration>() / sorted.len().max(1) as u32;
        
        let p50_idx = (sorted.len() as f64 * 0.50) as usize;
        let p95_idx = (sorted.len() as f64 * 0.95) as usize;
        let p99_idx = (sorted.len() as f64 * 0.99) as usize;
        
        let p50 = sorted.get(p50_idx).copied().unwrap_or_default();
        let p95 = sorted.get(p95_idx).copied().unwrap_or_default();
        let p99 = sorted.get(p99_idx).copied().unwrap_or_default();
        
        let rps = successful as f64 / total_duration.as_secs_f64();
        
        Self {
            total_requests,
            successful_requests: successful,
            failed_requests: failed,
            total_duration,
            min_latency: min,
            max_latency: max,
            avg_latency: avg,
            p50_latency: p50,
            p95_latency: p95,
            p99_latency: p99,
            requests_per_second: rps,
        }
    }
    
    fn print(&self, endpoint: &str) {
        println!("\n📊 {} Benchmark Results:", endpoint);
        println!("  Total Requests:    {}", self.total_requests);
        println!("  Successful:        {} ({:.1}%)", 
            self.successful_requests, 
            self.successful_requests as f64 / self.total_requests as f64 * 100.0
        );
        println!("  Failed:            {}", self.failed_requests);
        println!("  Total Duration:    {:?}", self.total_duration);
        println!("  Throughput:        {:.2} req/sec", self.requests_per_second);
        println!("  Latency Stats:");
        println!("    Min:             {:?}", self.min_latency);
        println!("    Average:         {:?}", self.avg_latency);
        println!("    P50 (median):    {:?}", self.p50_latency);
        println!("    P95:             {:?}", self.p95_latency);
        println!("    P99:             {:?}", self.p99_latency);
        println!("    Max:             {:?}", self.max_latency);
    }
}

/// Benchmark a single endpoint with sequential requests
fn benchmark_endpoint_sequential(url: &str, requests: usize) -> BenchmarkStats {
    let rt = Runtime::new().unwrap();
    let client = reqwest::blocking::Client::new();
    
    let mut latencies = Vec::new();
    let mut failures = 0;
    
    let start = Instant::now();
    
    for _ in 0..requests {
        let req_start = Instant::now();
        match client.get(url).send() {
            Ok(resp) if resp.status().is_success() => {
                latencies.push(req_start.elapsed());
            }
            _ => failures += 1,
        }
    }
    
    let total_duration = start.elapsed();
    BenchmarkStats::from_latencies(&latencies, total_duration, failures)
}

/// Benchmark endpoint with concurrent requests
fn benchmark_endpoint_concurrent(url: &str, total_requests: usize, concurrency: usize) -> BenchmarkStats {
    let rt = Runtime::new().unwrap();
    
    rt.block_on(async {
        let client = reqwest::Client::new();
        let mut handles = Vec::new();
        let mut latencies = Vec::new();
        let mut failures = 0;
        
        let start = Instant::now();
        
        // Launch concurrent requests
        for i in 0..total_requests {
            let client = client.clone();
            let url = url.to_string();
            
            let handle = tokio::spawn(async move {
                let req_start = Instant::now();
                match client.get(&url).send().await {
                    Ok(resp) if resp.status().is_success() => {
                        Ok(req_start.elapsed())
                    }
                    _ => Err(()),
                }
            });
            
            handles.push(handle);
            
            // Maintain concurrency limit
            if handles.len() >= concurrency {
                if let Some(handle) = handles.pop() {
                    match handle.await {
                        Ok(Ok(latency)) => latencies.push(latency),
                        _ => failures += 1,
                    }
                }
            }
        }
        
        // Wait for remaining requests
        for handle in handles {
            match handle.await {
                Ok(Ok(latency)) => latencies.push(latency),
                _ => failures += 1,
            }
        }
        
        let total_duration = start.elapsed();
        BenchmarkStats::from_latencies(&latencies, total_duration, failures)
    })
}

fn main() {
    println!("🚀 Phoenix HTTP Performance Benchmarks");
    println!("=========================================\n");
    println!("Testing against: http://127.0.0.1:5001");
    println!("Warmup requests: {}", WARMUP_REQUESTS);
    println!("Benchmark requests: {}", BENCHMARK_REQUESTS);
    
    // Warmup
    println!("\n⏳ Warming up...");
    benchmark_endpoint_sequential("http://127.0.0.1:5001/health", WARMUP_REQUESTS);
    
    // Health endpoint - sequential
    println!("\n🔍 Benchmarking /health (sequential)");
    let health_seq = benchmark_endpoint_sequential(
        "http://127.0.0.1:5001/health",
        BENCHMARK_REQUESTS
    );
    health_seq.print("/health (sequential)");
    
    // Health endpoint - concurrent
    println!("\n🔍 Benchmarking /health (concurrent)");
    let health_conc = benchmark_endpoint_concurrent(
        "http://127.0.0.1:5001/health",
        BENCHMARK_REQUESTS,
        CONCURRENT_CONNECTIONS
    );
    health_conc.print("/health (concurrent)");
    
    // Ready endpoint - sequential
    println!("\n🔍 Benchmarking /ready (sequential)");
    let ready_seq = benchmark_endpoint_sequential(
        "http://127.0.0.1:5001/ready",
        BENCHMARK_REQUESTS / 2 // Fewer requests since it's heavier
    );
    ready_seq.print("/ready (sequential)");
    
    // Ready endpoint - concurrent
    println!("\n🔍 Benchmarking /ready (concurrent)");
    let ready_conc = benchmark_endpoint_concurrent(
        "http://127.0.0.1:5001/ready",
        BENCHMARK_REQUESTS / 2,
        CONCURRENT_CONNECTIONS
    );
    ready_conc.print("/ready (concurrent)");
    
    // Performance assessment
    println!("\n📈 Performance Assessment");
    println!("========================");
    
    let health_target_met = health_conc.requests_per_second >= 100.0;
    let health_latency_met = health_conc.avg_latency < Duration::from_millis(10);
    let ready_target_met = ready_conc.requests_per_second >= 50.0;
    let ready_latency_met = ready_conc.avg_latency < Duration::from_millis(30);
    
    println!("\n✓ Targets:");
    println!("  /health throughput (100+ req/sec):  {} ({:.1} req/sec)",
        if health_target_met { "✓ PASS" } else { "✗ FAIL" },
        health_conc.requests_per_second
    );
    println!("  /health latency (<10ms avg):        {} ({:.1}ms)",
        if health_latency_met { "✓ PASS" } else { "✗ FAIL" },
        health_conc.avg_latency.as_micros() as f64 / 1000.0
    );
    println!("  /ready throughput (50+ req/sec):    {} ({:.1} req/sec)",
        if ready_target_met { "✓ PASS" } else { "✗ FAIL" },
        ready_conc.requests_per_second
    );
    println!("  /ready latency (<30ms avg):         {} ({:.1}ms)",
        if ready_latency_met { "✓ PASS" } else { "✗ FAIL" },
        ready_conc.avg_latency.as_micros() as f64 / 1000.0
    );
    
    let all_passed = health_target_met && health_latency_met && ready_target_met && ready_latency_met;
    
    if all_passed {
        println!("\n🎉 All performance targets MET!");
    } else {
        println!("\n⚠️  Some performance targets not met");
    }
    
    // Cache effectiveness
    if health_seq.requests_per_second < health_conc.requests_per_second * 0.8 {
        let improvement = (health_conc.requests_per_second / health_seq.requests_per_second - 1.0) * 100.0;
        println!("\n💾 Cache Effectiveness: {:.1}% improvement with concurrency", improvement);
    }
}