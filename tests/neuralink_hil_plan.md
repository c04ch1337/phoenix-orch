# Neuralink Hardware-in-the-Loop Test Suite Plan

## Overview

This document outlines the architecture and implementation approach for the Neuralink Hardware-in-the-Loop (HIL) Test Suite (`neuralink_hil.rs`). The suite will verify Phoenix Orch's integration with Neuralink N1 implant, focusing on signal processing, safety features, and application logic.

## Test Suite Structure

### 1. Imports and Dependencies

```rust
// Core dependencies
use tokio;
use std::net::SocketAddr;
use std::time::Duration;
use std::sync::Arc;
use anyhow::{Result, anyhow};
use futures::future::join_all;

// Phoenix Orch dependencies
use phoenix_orch::{
    orchestrator::OrchestratorService,
    modules::orchestrator::tools::neural_emotion::{
        NeuralEmotionTool, EmotionSource, NeuralinkIntegration, BrainPattern
    }
};

// Test utilities
use test_context::{test_context, AsyncTestContext};
use mockito::mock;
use socket2::{Socket, Domain, Type};
```

### 2. Test Fixtures and Environment Setup

```rust
/// Neuralink HIL test context
struct NeuralinkTestContext {
    /// Orchestrator service instance
    pub orch: OrchestratorService,
    
    /// Neural emotion tool instance
    pub emotion_tool: NeuralEmotionTool,
    
    /// Mock Neuralink device - either connects to real hardware or simulates it
    pub neuralink_device: NeuralinkDevice,
    
    /// Signal recorder for validating brain signal processing
    pub signal_recorder: SignalRecorder,
}

impl AsyncTestContext for NeuralinkTestContext {
    async fn setup() -> Result<Self> {
        // Determine if we're using real hardware or mock
        let use_real_hardware = std::env::var("USE_REAL_NEURALINK")
            .unwrap_or("false".to_string())
            .parse::<bool>()
            .unwrap_or(false);
            
        // Initialize components
        let orch = OrchestratorService::new_test_instance()?;
        let emotion_tool = NeuralEmotionTool::new(EmotionEngineConfig {
            use_neuralink: true,
            neuralink_mock_mode: !use_real_hardware,
            neuralink_port: 9001,
            ..Default::default()
        })?;
        
        let neuralink_device = if use_real_hardware {
            NeuralinkDevice::connect_real()?
        } else {
            NeuralinkDevice::create_mock()?
        };
        
        let signal_recorder = SignalRecorder::new();
        
        Ok(Self {
            orch,
            emotion_tool,
            neuralink_device,
            signal_recorder,
        })
    }
    
    async fn teardown(self) -> Result<()> {
        if self.neuralink_device.is_real() {
            // Ensure real hardware is safely disconnected
            self.neuralink_device.safe_disconnect().await?;
        }
        
        // Clean up any recorded signals
        self.signal_recorder.cleanup()?;
        
        Ok(())
    }
}
```

### 3. Test Categories

#### 3.1 Basic Connectivity and Signal Processing

```rust
#[test_context(NeuralinkTestContext)]
#[tokio::test]
async fn test_neuralink_connectivity(ctx: &mut NeuralinkTestContext) {
    // Test basic connectivity to Neuralink device
    let connection_status = ctx.emotion_tool.check_neuralink_connection().await;
    assert!(connection_status.is_ok());
    
    // Verify we can receive signals
    let signals = ctx.emotion_tool.get_brain_signals().await;
    assert!(signals.is_ok());
    assert!(!signals.unwrap().is_empty());
}

#[test_context(NeuralinkTestContext)]
#[tokio::test]
async fn test_basic_signal_processing(ctx: &mut NeuralinkTestContext) {
    // Generate known test signal pattern
    let test_signal = ctx.neuralink_device.generate_test_signal(SignalPattern::Calm);
    ctx.neuralink_device.transmit_signal(&test_signal).await?;
    
    // Allow time for signal processing
    tokio::time::sleep(Duration::from_millis(100)).await;
    
    // Verify emotion engine properly processed the signal
    let analysis = ctx.emotion_tool.get_emotion_analysis().await?;
    
    // Check if brain signals were properly received
    assert!(analysis.signals.contains_key(&EmotionSource::BrainSignals));
    
    // Verify the signal interpretation matches expected emotional state 
    assert_eq!(analysis.dominant_emotion, BasicEmotion::Calm);
}
```

#### 3.2 Safety and Error Handling

```rust
#[test_context(NeuralinkTestContext)]
#[tokio::test]
async fn test_brain_pain_pattern_detection(ctx: &mut NeuralinkTestContext) {
    // Generate pain pattern signal
    let pain_signal = ctx.neuralink_device.generate_test_signal(SignalPattern::Pain);
    
    // Start recording events
    let event_recorder = EventRecorder::new();
    ctx.orch.register_event_listener(&event_recorder).await?;
    
    // Transmit pain signal
    ctx.neuralink_device.transmit_signal(&pain_signal).await?;
    
    // Allow time for signal processing and event generation
    tokio::time::sleep(Duration::from_millis(200)).await;
    
    // Verify pain pattern was detected
    let events = event_recorder.get_recorded_events().await;
    assert!(events.iter().any(|e| matches!(e, Event::BrainPatternDetected(BrainPattern::Pain))));
    
    // Verify conscience protector was activated
    let protector_actions = ctx.emotion_tool
        .get_conscience_protector()
        .get_recent_actions()
        .await?;
        
    assert!(!protector_actions.is_empty());
    assert!(protector_actions.iter().any(|a| a.triggered_by == BrainPattern::Pain));
}

#[test_context(NeuralinkTestContext)]
#[tokio::test]
async fn test_emergency_services_threshold(ctx: &mut NeuralinkTestContext) {
    // Mock the emergency services endpoint to prevent actual calls
    let _mock_emergency = mock("POST", "/emergency/911")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(r#"{"status": "acknowledged", "reference": "TEST-12345"}"#)
        .create();
    
    // Redirect emergency calls to mock server
    ctx.emotion_tool.get_conscience_protector_mut()
        .set_emergency_endpoint(mockito::server_url());
    
    // Generate severe pain pattern signal that should trigger emergency services
    let severe_pain_signal = ctx.neuralink_device
        .generate_test_signal(SignalPattern::SeverePain);
    
    // Create a future that waits for emergency call event
    let emergency_call_future = ctx.orch.wait_for_event(
        |e| matches!(e, Event::EmergencyServicesCalled { .. }),
        Duration::from_secs(5)
    );
    
    // Transmit the severe pain signal
    ctx.neuralink_device.transmit_signal(&severe_pain_signal).await?;
    
    // Wait for emergency call event or timeout
    let emergency_event = tokio::time::timeout(
        Duration::from_secs(5),
        emergency_call_future
    ).await??;
    
    // Verify emergency services were called
    assert!(matches!(emergency_event, Event::EmergencyServicesCalled { .. }));
    
    // Verify the mock endpoint was called
    assert_eq!(_mock_emergency.matched_times(), 1);
}
```

#### 3.3 Signal Data Flow and Persistence

```rust
#[test_context(NeuralinkTestContext)]
#[tokio::test]
async fn test_signal_recording_and_playback(ctx: &mut NeuralinkTestContext) {
    // Define test duration
    let test_duration = Duration::from_secs(3);
    
    // Start recording signals
    ctx.signal_recorder.start().await?;
    
    // Generate a sequence of test signals
    let signal_patterns = [
        SignalPattern::Calm,
        SignalPattern::Elevated,
        SignalPattern::Stressed
    ];
    
    // Transmit each pattern for 1 second
    for pattern in signal_patterns {
        let signal = ctx.neuralink_device.generate_test_signal(pattern);
        ctx.neuralink_device.transmit_signal(&signal).await?;
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
    
    // Stop recording
    let recording = ctx.signal_recorder.stop().await?;
    
    // Verify recording contains expected data
    assert_eq!(recording.duration().as_secs(), test_duration.as_secs());
    assert_eq!(recording.signal_patterns().len(), signal_patterns.len());
    
    // Test playback
    ctx.neuralink_device.set_playback_mode(true).await?;
    ctx.neuralink_device.play_recording(&recording).await?;
    
    // Verify emotion analyses match expected patterns
    let analyses = ctx.emotion_tool.get_emotion_history(test_duration).await?;
    
    // Should have at least one analysis per second
    assert!(analyses.len() >= signal_patterns.len());
    
    // Verify dominant emotions match our signal patterns
    let dominant_emotions: Vec<_> = analyses.iter()
        .map(|a| a.dominant_emotion)
        .collect();
        
    assert!(dominant_emotions.contains(&BasicEmotion::Calm));
    assert!(dominant_emotions.contains(&BasicEmotion::Stress));
}
```

#### 3.4 Hardware-in-the-Loop Signal Variation Testing

```rust
#[test_context(NeuralinkTestContext)]
#[tokio::test]
async fn test_signal_variation_handling(ctx: &mut NeuralinkTestContext) {
    // Testing how system handles different signal variations
    
    // Define test cases with different signal characteristics
    let test_cases = [
        // (Signal pattern, signal strength, noise ratio, expected emotion)
        (SignalPattern::Calm, 1.0, 0.1, BasicEmotion::Calm),
        (SignalPattern::Calm, 0.5, 0.1, BasicEmotion::Calm), // Weaker signal
        (SignalPattern::Calm, 1.0, 0.5, BasicEmotion::Calm), // Noisier signal
        (SignalPattern::Elevated, 1.0, 0.1, BasicEmotion::Excitement),
        (SignalPattern::Stressed, 0.7, 0.3, BasicEmotion::Stress),
    ];
    
    for (pattern, strength, noise, expected_emotion) in test_cases {
        // Generate the test signal with specified parameters
        let signal = ctx.neuralink_device.generate_test_signal_with_params(
            pattern, 
            SignalParams { strength, noise_ratio: noise }
        );
        
        // Clear previous state
        ctx.emotion_tool.reset_state().await?;
        
        // Transmit the test signal
        ctx.neuralink_device.transmit_signal(&signal).await?;
        
        // Allow time for processing
        tokio::time::sleep(Duration::from_millis(200)).await;
        
        // Get emotion analysis
        let analysis = ctx.emotion_tool.get_emotion_analysis().await?;
        
        // Check if dominant emotion matches expected
        assert_eq!(
            analysis.dominant_emotion, 
            expected_emotion,
            "Failed for pattern {:?}, strength {}, noise {}",
            pattern, strength, noise
        );
    }
}
```

#### 3.5 Integration Testing with Other Components

```rust
#[test_context(NeuralinkTestContext)]
#[tokio::test]
async fn test_neuralink_integration_with_security_systems(ctx: &mut NeuralinkTestContext) {
    // Setup security component
    let security = ctx.orch.get_security_services().await?;
    
    // Register security monitoring for brain signals
    security.register_signal_monitor().await?;
    
    // Generate a sequence of signals indicating potential security concern
    // (e.g., stress pattern followed by fear pattern)
    let stress_signal = ctx.neuralink_device.generate_test_signal(SignalPattern::Stressed);
    let fear_signal = ctx.neuralink_device.generate_test_signal(SignalPattern::Fear);
    
    // Transmit signals
    ctx.neuralink_device.transmit_signal(&stress_signal).await?;
    tokio::time::sleep(Duration::from_millis(500)).await;
    ctx.neuralink_device.transmit_signal(&fear_signal).await?;
    
    // Allow time for processing
    tokio::time::sleep(Duration::from_millis(500)).await;
    
    // Verify security component detected the concern
    let security_events = security.get_recent_events().await?;
    assert!(security_events.iter().any(|e| {
        matches!(e, SecurityEvent::BrainSignalAnomaly { .. })
    }));
    
    // Verify appropriate security measures were taken
    let security_actions = security.get_recent_actions().await?;
    assert!(!security_actions.is_empty());
}
```

### 4. Mock Implementation for CI Environments

```rust
/// Neuralink device abstraction for testing
struct NeuralinkDevice {
    /// Whether this is a real hardware connection or mock
    is_real: bool,
    
    /// UDP socket for signal transmission (real or mock)
    socket: Option<Socket>,
    
    /// Current device state
    state: NeuralinkDeviceState,
    
    /// Signal generator for mock mode
    signal_generator: Option<SignalGenerator>,
    
    /// For mock mode, are we in playback mode
    playback_mode: bool,
}

impl NeuralinkDevice {
    /// Connect to a real Neuralink device
    fn connect_real() -> Result<Self> {
        // Real hardware connection logic would go here
        // For safety, this should include stringent validation
        
        let socket = Socket::new(Domain::IPV4, Type::DGRAM, None)?;
        socket.connect(&SocketAddr::from(([127, 0, 0, 1], 9001)).into())?;
        
        Ok(Self {
            is_real: true,
            socket: Some(socket),
            state: NeuralinkDeviceState::Connected,
            signal_generator: None,
            playback_mode: false,
        })
    }
    
    /// Create a mock Neuralink device for testing
    fn create_mock() -> Result<Self> {
        let signal_generator = SignalGenerator::new();
        
        // Create mock UDP server
        let socket = Socket::new(Domain::IPV4, Type::DGRAM, None)?;
        socket.bind(&SocketAddr::from(([127, 0, 0, 1], 9001)).into())?;
        
        Ok(Self {
            is_real: false,
            socket: Some(socket),
            state: NeuralinkDeviceState::Connected,
            signal_generator: Some(signal_generator),
            playback_mode: false,
        })
    }
    
    /// Generate test signal with specified pattern
    fn generate_test_signal(&self, pattern: SignalPattern) -> Vec<f32> {
        if let Some(generator) = &self.signal_generator {
            generator.generate(pattern)
        } else {
            // Should not happen with proper initialization
            vec![0.0; 128] // Return dummy signal
        }
    }
    
    /// Transmit signal to emotion processing system
    async fn transmit_signal(&self, signal: &[f32]) -> Result<()> {
        if let Some(socket) = &self.socket {
            // Convert signal to bytes
            let signal_bytes: Vec<u8> = signal.iter()
                .flat_map(|f| f.to_le_bytes())
                .collect();
                
            // Send over UDP
            socket.send(&signal_bytes)?;
            Ok(())
        } else {
            Err(anyhow!("No socket connection available"))
        }
    }
}
```

## Required Dependencies and Hardware Integration

### 1. Neuralink N1 Integration Dependencies

```
[dependencies]
# Core dependencies
tokio = { version = "1.0", features = ["full"] }
anyhow = "1.0"
thiserror = "1.0"
futures = "0.3"

# Neuralink SDK (proprietary, would be provided by Neuralink)
neuralink-sdk = { version = "0.1", optional = true }

# Signal processing
ndarray = "0.15"
rustfft = "6.0"
realfft = "3.0"

# Hardware abstraction
serialport = "4.2"  # For serial communication if needed
socket2 = "0.4"     # For UDP communication

# Testing
test-context = "0.1"
mockito = "0.31"
criterion = "0.4"

[features]
# Feature flag to use real hardware
real-hardware = ["neuralink-sdk"]

# Mock mode is always available
default = []
```

### 2. Hardware Devices Required for Complete Testing

1. **Neuralink N1 Implant**
   - For real hardware testing
   - UDP port 9001 for signal communication
   - Supports signal sampling rate of 1000 Hz

2. **Signal Simulator**
   - For safe testing without implant
   - Generates realistic brain signal patterns
   - Configurable noise and artifact injection

3. **Integration Test Hardware**
   - Microphones (for voice+brain fusion testing)
   - Webcams (for facial+brain fusion testing)
   - UniFi controller (for testing security integration)
   - Hue bridge (for ambient response testing)
   - Hak5 devices (for security testing scenarios)

### 3. Mock Strategy for CI Environments

For CI environments to run safely without real hardware:

1. **Signal Simulation**
   - Pre-recorded signal datasets for various emotional states
   - Configurable signal generation with realistic characteristics
   - Ability to inject artifacts and anomalies for testing robustness

2. **Mock UDP Server**
   - Simulates Neuralink device communication
   - Responds to commands like real hardware
   - Can vary response times to test timeout handling

3. **Integration Mocks**
   - MockEmergencyServices - prevents actual 911 calls
   - MockSecurityDevices - simulates Hak5, UniFi, etc.
   - MockBrainPatternDetector - for testing conscience protection

### 4. Test Signal Patterns

Standard test signal patterns that simulate different brain states:

1. **Calm**: Low amplitude, regular alpha waves (8-12 Hz)
2. **Elevated**: Medium amplitude, mixed alpha/beta (15-20 Hz)
3. **Stressed**: High amplitude, dominant beta (>20 Hz)
4. **Fear**: Sharp amplitude variation, theta dominance (4-7 Hz)
5. **Pain**: Specific ACC activation pattern with high amplitude spikes
6. **SeverePain**: Like Pain but with sustained high amplitude

## CI/CD Integration Considerations

1. **Safety Precautions**
   - Never test with real emergency services endpoints in CI
   - Use feature flags to ensure hardware tests only run in appropriate environments
   - Implement test timeouts to prevent hanging tests

2. **Test Environments**
   - Development: Can run with real hardware if available
   - CI: Always runs with mock devices
   - Specialized Hardware Lab: Full HIL testing with all real devices

3. **Test Categorization**
   - Unit Tests: Run on every commit
   - Integration Tests: Run on PRs and scheduled runs
   - Full HIL Tests: Run in specialized environments on release candidates

4. **Error Handling**
   - Auto-fail CI on any unhandled exceptions
   - Auto-fail on emergency services bypass attempts
   - Auto-fail on unauthorized device access

5. **Reporting**
   - Generate comprehensive test reports with signal visualization
   - Track signal processing performance over time
   - Alert on degraded accuracy or increased latency