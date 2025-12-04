//! Tests for thought command interface module

use super::*;
use crate::commands::thought::{ThoughtInterface, NeuralInterface, PatternRecognizer, IntentClassifier, SafetyMonitor};
use std::sync::Arc;
use tokio::test;
use mockall::predicate::*;
use chrono::Utc;

#[test]
async fn test_thought_interface_initialization() -> Result<(), Box<dyn Error>> {
    let interface = ThoughtInterface::new()?;
    interface.initialize().await?;
    Ok(())
}

#[test]
async fn test_neural_signal_processing() -> Result<(), Box<dyn Error>> {
    let interface = ThoughtInterface::new()?;
    interface.initialize().await?;
    
    // Create test neural signal
    let signal = NeuralSignal {
        data: vec![0.0; 1024],
        amplitude: 0.5,
        frequency: 10.0,
        timestamp: Utc::now(),
    };
    
    let result = interface.process_signal(&signal).await?;
    
    assert!(result.confidence > 0.0);
    Ok(())
}

#[test]
async fn test_thought_pattern_recognition() -> Result<(), Box<dyn Error>> {
    let recognizer = PatternRecognizer::new()?;
    recognizer.initialize().await?;
    
    // Test neural signal
    let signal = NeuralSignal {
        data: vec![0.0; 1024],
        amplitude: 0.5,
        frequency: 10.0,
        timestamp: Utc::now(),
    };
    
    let pattern = recognizer.analyze(&signal).await?;
    
    assert!(pattern.confidence > 0.8);
    assert!(!pattern.features.is_empty());
    Ok(())
}

#[test]
async fn test_intent_classification() -> Result<(), Box<dyn Error>> {
    let classifier = IntentClassifier::new()?;
    classifier.initialize().await?;
    
    // Test thought pattern
    let pattern = ThoughtPattern {
        features: vec![0.0; 128],
        confidence: 0.9,
    };
    
    let intent = classifier.classify(&pattern).await?;
    
    assert!(!intent.is_empty());
    Ok(())
}

#[test]
async fn test_safety_monitoring() -> Result<(), Box<dyn Error>> {
    let monitor = SafetyMonitor::new()?;
    monitor.initialize().await?;
    
    // Test safe signal
    let safe_signal = NeuralSignal {
        data: vec![0.0; 1024],
        amplitude: 0.5,
        frequency: 10.0,
        timestamp: Utc::now(),
    };
    
    assert!(monitor.check_signal(&safe_signal).await.is_ok());
    
    // Test unsafe signal
    let unsafe_signal = NeuralSignal {
        data: vec![0.0; 1024],
        amplitude: 2.0, // Exceeds safety threshold
        frequency: 10.0,
        timestamp: Utc::now(),
    };
    
    assert!(monitor.check_signal(&unsafe_signal).await.is_err());
    Ok(())
}

#[test]
async fn test_thought_monitoring() -> Result<(), Box<dyn Error>> {
    let interface = ThoughtInterface::new()?;
    interface.initialize().await?;
    
    interface.start_monitoring().await?;
    
    // Verify monitoring state
    let state = interface.state.read().await;
    assert!(state.is_monitoring);
    
    Ok(())
}

#[test]
async fn test_concurrent_thought_processing() -> Result<(), Box<dyn Error>> {
    let interface = Arc::new(ThoughtInterface::new()?);
    interface.initialize().await?;
    
    let mut handles = Vec::new();
    
    // Create test signal
    let signal = NeuralSignal {
        data: vec![0.0; 1024],
        amplitude: 0.5,
        frequency: 10.0,
        timestamp: Utc::now(),
    };
    
    // Spawn multiple concurrent processors
    for _ in 0..3 {
        let interface = Arc::clone(&interface);
        let signal = signal.clone();
        let handle = tokio::spawn(async move {
            interface.process_signal(&signal).await
        });
        handles.push(handle);
    }
    
    // Wait for all processors to complete
    for handle in handles {
        let result = handle.await??;
        assert!(result.confidence > 0.0);
    }
    
    Ok(())
}

#[test]
async fn test_error_handling() -> Result<(), Box<dyn Error>> {
    let interface = ThoughtInterface::new()?;
    interface.initialize().await?;
    
    // Test invalid neural signal
    let invalid_signal = NeuralSignal {
        data: vec![], // Empty data
        amplitude: 0.5,
        frequency: 10.0,
        timestamp: Utc::now(),
    };
    
    let result = interface.process_signal(&invalid_signal).await;
    assert!(result.is_err());
    
    Ok(())
}

#[test]
async fn test_neural_interface() -> Result<(), Box<dyn Error>> {
    let interface = NeuralInterface::new()?;
    interface.initialize().await?;
    
    // Test device connection
    interface.device.connect().await?;
    
    // Test signal processing
    interface.signal_processor.calibrate().await?;
    
    Ok(())
}

// Mock implementations for testing
mock! {
    ThoughtInterface {
        fn new() -> Result<Self, Box<dyn Error>>;
        async fn initialize(&self) -> Result<(), Box<dyn Error>>;
        async fn start_monitoring(&self) -> Result<(), Box<dyn Error>>;
        async fn process_signal(&self, signal: &NeuralSignal) -> Result<ThoughtCommand, Box<dyn Error>>;
    }
}

#[test]
async fn test_with_mocks() -> Result<(), Box<dyn Error>> {
    let mut mock = MockThoughtInterface::new();
    
    mock.expect_initialize()
        .times(1)
        .returning(|| Ok(()));
        
    mock.expect_process_signal()
        .with(predicate::always())
        .times(1)
        .returning(|_| Ok(ThoughtCommand {
            intent: "test_intent".to_string(),
            confidence: 0.95,
            timestamp: Utc::now(),
        }));
        
    mock.initialize().await?;
    
    let signal = NeuralSignal {
        data: vec![0.0; 1024],
        amplitude: 0.5,
        frequency: 10.0,
        timestamp: Utc::now(),
    };
    
    let result = mock.process_signal(&signal).await?;
    assert_eq!(result.intent, "test_intent");
    
    Ok(())
}