//! Tests for voice command processing module

use super::*;
use crate::commands::voice::{VoiceProcessor, AudioCapture, SpeechRecognizer, NoiseFilter, VoiceFeedback};
use std::sync::Arc;
use tokio::test;
use mockall::predicate::*;

#[test]
async fn test_voice_processor_initialization() -> Result<(), Box<dyn Error>> {
    let processor = VoiceProcessor::new()?;
    processor.initialize().await?;
    Ok(())
}

#[test]
async fn test_voice_command_capture() -> Result<(), Box<dyn Error>> {
    let processor = VoiceProcessor::new()?;
    processor.initialize().await?;
    
    processor.start_listening().await?;
    
    // Generate test audio data
    let test_audio: Vec<f32> = vec![0.0; 1024];
    let result = processor.process_audio(&test_audio).await?;
    
    assert!(!result.is_empty());
    Ok(())
}

#[test]
async fn test_noise_filtering() -> Result<(), Box<dyn Error>> {
    let filter = NoiseFilter::new()?;
    filter.initialize().await?;
    
    // Test audio with noise
    let noisy_audio: Vec<f32> = vec![0.1; 1024];
    let filtered = filter.filter(&noisy_audio).await?;
    
    // Verify noise reduction
    assert!(filtered.iter().all(|&x| x.abs() < 0.1));
    Ok(())
}

#[test]
async fn test_speech_recognition() -> Result<(), Box<dyn Error>> {
    let recognizer = SpeechRecognizer::new()?;
    recognizer.initialize().await?;
    
    // Test audio containing speech
    let speech_audio: Vec<f32> = vec![0.0; 1024];
    let text = recognizer.transcribe(&speech_audio).await?;
    
    assert!(!text.is_empty());
    Ok(())
}

#[test]
async fn test_voice_feedback() -> Result<(), Box<dyn Error>> {
    let feedback = VoiceFeedback::new()?;
    feedback.initialize().await?;
    
    // Test feedback notifications
    feedback.notify_listening().await?;
    feedback.notify_processing().await?;
    
    Ok(())
}

#[test]
async fn test_end_to_end_voice_command() -> Result<(), Box<dyn Error>> {
    let processor = VoiceProcessor::new()?;
    processor.initialize().await?;
    
    // Start listening
    processor.start_listening().await?;
    
    // Simulate voice command
    let test_audio: Vec<f32> = vec![0.0; 1024];
    let command_text = processor.process_audio(&test_audio).await?;
    
    assert!(!command_text.is_empty());
    Ok(())
}

#[test]
async fn test_concurrent_voice_processing() -> Result<(), Box<dyn Error>> {
    let processor = Arc::new(VoiceProcessor::new()?);
    processor.initialize().await?;
    
    let mut handles = Vec::new();
    
    // Spawn multiple concurrent processors
    for _ in 0..3 {
        let processor = Arc::clone(&processor);
        let handle = tokio::spawn(async move {
            let test_audio: Vec<f32> = vec![0.0; 1024];
            processor.process_audio(&test_audio).await
        });
        handles.push(handle);
    }
    
    // Wait for all processors to complete
    for handle in handles {
        let result = handle.await??;
        assert!(!result.is_empty());
    }
    
    Ok(())
}

#[test]
async fn test_error_handling() -> Result<(), Box<dyn Error>> {
    let processor = VoiceProcessor::new()?;
    processor.initialize().await?;
    
    // Test invalid audio data
    let invalid_audio: Vec<f32> = vec![];
    let result = processor.process_audio(&invalid_audio).await;
    
    assert!(result.is_err());
    Ok(())
}

#[test]
async fn test_audio_capture() -> Result<(), Box<dyn Error>> {
    let capture = AudioCapture::new()?;
    capture.initialize().await?;
    
    // Start capture
    capture.start_capture().await?;
    
    // Verify audio device configuration
    assert!(capture.device.default_input_config().is_ok());
    Ok(())
}

// Mock implementations for testing
mock! {
    VoiceProcessor {
        fn new() -> Result<Self, Box<dyn Error>>;
        async fn initialize(&self) -> Result<(), Box<dyn Error>>;
        async fn start_listening(&self) -> Result<(), Box<dyn Error>>;
        async fn process_audio(&self, audio: &[f32]) -> Result<String, Box<dyn Error>>;
    }
}

#[test]
async fn test_with_mocks() -> Result<(), Box<dyn Error>> {
    let mut mock = MockVoiceProcessor::new();
    
    mock.expect_initialize()
        .times(1)
        .returning(|| Ok(()));
        
    mock.expect_process_audio()
        .with(predicate::always())
        .times(1)
        .returning(|_| Ok("test command".to_string()));
        
    mock.initialize().await?;
    
    let result = mock.process_audio(&[0.0; 1024]).await?;
    assert_eq!(result, "test command");
    
    Ok(())
}