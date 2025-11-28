//! Startup smoke tests for Phoenix kernel
//!
//! These tests verify that the kernel can boot, enter chatbot mode,
//! and handle basic interactions before shutting down cleanly.

use std::{
    io::{BufRead, BufReader, Write},
    process::{Command, Stdio},
    sync::mpsc,
    thread,
    time::Duration,
};

#[test]
fn test_kernel_startup_and_chatbot_interaction() {
    println!("Starting kernel startup smoke test...");

    // Build the binary first to avoid timeout issues
    let build = Command::new("cargo")
        .args(["build", "--bin", "phoenix-core"])
        .current_dir(".")
        .output()
        .expect("Failed to build kernel");

    if !build.status.success() {
        let stderr = String::from_utf8_lossy(&build.stderr);
        panic!("Failed to build kernel:\n{}", stderr);
    }

    // Start the kernel in chatbot mode with proper stdio piping
    let mut kernel = Command::new("cargo")
        .args(["run", "--bin", "phoenix-core", "--", "--chatbot"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .current_dir(".")
        .spawn()
        .expect("Failed to start kernel");

    let mut stdin = kernel.stdin.take().expect("Failed to open stdin");
    let stdout = kernel.stdout.take().expect("Failed to open stdout");
    let stderr = kernel.stderr.take().expect("Failed to open stderr");

    // Channel to signal when we've seen the ready message
    let (ready_tx, ready_rx) = mpsc::channel();
    let (response_tx, response_rx) = mpsc::channel();

    // Thread to monitor stderr for startup message
    let stderr_thread = thread::spawn(move || {
        let reader = BufReader::new(stderr);
        let mut ready_sent = false;

        for line in reader.lines() {
            if let Ok(line) = line {
                println!("[STDERR] {}", line);

                // Look for the ready signal
                if !ready_sent && line.contains("Phoenix Marie is online") {
                    println!("✓ Found ready signal!");
                    ready_tx.send(true).ok();
                    ready_sent = true;
                }
            }
        }
    });

    // Thread to monitor stdout for response
    let stdout_thread = thread::spawn(move || {
        let reader = BufReader::new(stdout);

        for line in reader.lines() {
            if let Ok(line) = line {
                println!("[STDOUT] {}", line);

                // Look for response with "Dad" prefix
                if line.contains("Dad") {
                    println!("✓ Found expected response!");
                    response_tx.send(line.clone()).ok();
                    break;
                }
            }
        }
    });

    // Wait for kernel to be ready (with timeout)
    println!("Waiting for kernel to be ready...");
    match ready_rx.recv_timeout(Duration::from_secs(30)) {
        Ok(_) => println!("✓ Kernel is ready!"),
        Err(_) => {
            kernel.kill().ok();
            kernel.wait().ok();
            panic!("Timeout waiting for kernel ready signal");
        }
    }

    // Give it a moment to fully initialize
    thread::sleep(Duration::from_secs(1));

    // Send test message to kernel
    println!("Sending test message: 'Hey Firebird'");
    writeln!(stdin, "Hey Firebird").expect("Failed to write to stdin");
    stdin.flush().expect("Failed to flush stdin");

    // Wait for response (with timeout)
    println!("Waiting for response...");
    match response_rx.recv_timeout(Duration::from_secs(5)) {
        Ok(response) => {
            println!("✓ Received response: {}", response);

            // Verify response contains expected content
            assert!(
                response.contains("Dad"),
                "Response should contain 'Dad' prefix, got: {}",
                response
            );
        }
        Err(_) => {
            kernel.kill().ok();
            kernel.wait().ok();
            panic!("Timeout waiting for kernel response");
        }
    }

    // Clean shutdown
    println!("Shutting down kernel...");
    kernel.kill().expect("Failed to kill kernel");
    let exit_status = kernel.wait().expect("Failed to wait for kernel");

    println!("✓ Kernel shutdown complete (status: {})", exit_status);

    // Wait for threads to finish
    stderr_thread.join().ok();
    stdout_thread.join().ok();

    println!("✓ Startup smoke test passed!");
}

#[test]
fn test_kernel_startup_logs() {
    println!("Testing kernel startup logs...");

    // Start kernel and capture output
    let mut kernel = Command::new("cargo")
        .args(["run", "--bin", "phoenix-core"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .current_dir(".")
        .spawn()
        .expect("Failed to start kernel");

    let stderr = kernel.stderr.take().expect("Failed to open stderr");

    // Channel to collect logs
    let (log_tx, log_rx) = mpsc::channel::<String>();

    // Thread to collect logs
    let log_thread = thread::spawn(move || {
        let reader = BufReader::new(stderr);
        let mut logs = Vec::new();

        for line in reader.lines() {
            if let Ok(line) = line {
                println!("[LOG] {}", line);
                logs.push(line.clone());

                // Once we see the ready signal, we have enough logs
                if line.contains("Phoenix Marie is online") {
                    break;
                }
            }
        }

        log_tx.send(logs.join("\n")).ok();
    });

    // Wait for logs with timeout
    let combined_logs = match log_rx.recv_timeout(Duration::from_secs(30)) {
        Ok(logs) => logs,
        Err(_) => {
            kernel.kill().ok();
            kernel.wait().ok();
            panic!("Timeout waiting for startup logs");
        }
    };

    // Verify critical startup messages
    assert!(
        combined_logs.contains("Starting Phoenix AGI Kernel"),
        "Missing 'Starting Phoenix AGI Kernel' message"
    );

    assert!(
        combined_logs.contains("Phoenix AGI Kernel started successfully"),
        "Missing 'Phoenix AGI Kernel started successfully' message"
    );

    assert!(
        combined_logs.contains("Phoenix Marie is online"),
        "Missing 'Phoenix Marie is online' ready signal"
    );

    // Clean shutdown
    println!("Shutting down kernel...");
    kernel.kill().expect("Failed to kill kernel");
    kernel.wait().expect("Failed to wait for kernel");

    log_thread.join().ok();

    println!("✓ Startup logs test passed!");
}

#[test]
fn test_kernel_health_endpoint() {
    println!("Testing kernel health endpoint...");

    // Start the kernel
    let mut kernel = Command::new("cargo")
        .args(["run", "--bin", "phoenix-core"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .current_dir(".")
        .spawn()
        .expect("Failed to start kernel");

    let stderr = kernel.stderr.take().expect("Failed to open stderr");

    // Channel for ready signal
    let (ready_tx, ready_rx) = mpsc::channel();

    // Monitor stderr for ready signal
    let stderr_thread = thread::spawn(move || {
        let reader = BufReader::new(stderr);

        for line in reader.lines() {
            if let Ok(line) = line {
                println!("[STDERR] {}", line);

                if line.contains("Phoenix Marie is online") {
                    ready_tx.send(true).ok();
                    break;
                }
            }
        }
    });

    // Wait for kernel to be ready
    println!("Waiting for kernel to be ready...");
    match ready_rx.recv_timeout(Duration::from_secs(30)) {
        Ok(_) => println!("✓ Kernel is ready!"),
        Err(_) => {
            kernel.kill().ok();
            kernel.wait().ok();
            panic!("Timeout waiting for kernel ready signal");
        }
    }

    // Give API server time to start
    thread::sleep(Duration::from_secs(2));

    // Check health endpoint using curl
    println!("Checking health endpoint...");
    let health_check = Command::new("curl")
        .args(["-s", "-f", "http://localhost:8080/health"])
        .output()
        .expect("Failed to check health (is curl installed?)");

    if !health_check.status.success() {
        kernel.kill().ok();
        kernel.wait().ok();
        let stderr = String::from_utf8_lossy(&health_check.stderr);
        panic!("Health check request failed:\n{}", stderr);
    }

    let health_response = String::from_utf8_lossy(&health_check.stdout);
    println!("Health response: {}", health_response);

    // Verify response contains expected status
    assert!(
        health_response.contains("\"status\":") || health_response.contains("score"),
        "Unexpected health response format: {}",
        health_response
    );

    // Clean shutdown
    println!("Shutting down kernel...");
    kernel.kill().expect("Failed to kill kernel");
    kernel.wait().expect("Failed to wait for kernel");

    stderr_thread.join().ok();

    println!("✓ Health endpoint test passed!");
}
