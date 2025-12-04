use std::collections::HashMap;
use std::sync::{Arc, Mutex, RwLock};
use std::sync::atomic::AtomicBool;
use std::time::{Duration, Instant, SystemTime};

use crate::modules::orchestrator::events::{EventEmitter, Event};
use crate::modules::orchestrator::tools::neural_emotion::{
    BasicEmotion, BrainPattern, ConscienceProtector, ConscienceProtectorConfig,
    EmergencyResponseType, EmotionAnalysisResult, EmotionSource,
    EmotionVector
};
use crate::modules::orchestrator::security::RedTeamController;
use crate::modules::orchestrator::communication::EmergencyCommunicator;

/// Mock RedTeamController for testing
#[derive(Clone)]
struct MockRedTeamController {
    terminated: Arc<AtomicBool>,
}

impl MockRedTeamController {
    fn new() -> Self {
        Self {
            terminated: Arc::new(AtomicBool::new(false)),
        }
    }
    
    fn was_terminated(&self) -> bool {
        self.terminated.load(std::sync::atomic::Ordering::SeqCst)
    }
}

impl RedTeamController for MockRedTeamController {
    fn terminate_all_tools(&self) -> Result<(), String> {
        self.terminated.store(true, std::sync::atomic::Ordering::SeqCst);
        Ok(())
    }
}

/// Mock EmergencyCommunicator for testing
#[derive(Clone)]
struct MockEmergencyCommunicator {
    called_911: Arc<AtomicBool>,
    messaged_mom: Arc<RwLock<Option<String>>>,
}

impl MockEmergencyCommunicator {
    fn new() -> Self {
        Self {
            called_911: Arc::new(AtomicBool::new(false)),
            messaged_mom: Arc::new(RwLock::new(None)),
        }
    }
    
    fn was_911_called(&self) -> bool {
        self.called_911.load(std::sync::atomic::Ordering::SeqCst)
    }
    
    fn get_mom_message(&self) -> Option<String> {
        if let Ok(mom_msg) = self.messaged_mom.read() {
            mom_msg.clone()
        } else {
            None
        }
    }
}

impl EmergencyCommunicator for MockEmergencyCommunicator {
    fn call_emergency_services(&self) -> Result<(), String> {
        self.called_911.store(true, std::sync::atomic::Ordering::SeqCst);
        Ok(())
    }
    
    fn send_emergency_message(&self, recipient: &str, message: &str) -> Result<(), String> {
        if let Ok(mut mom_msg) = self.messaged_mom.write() {
            *mom_msg = Some(format!("To: {}, Message: {}", recipient, message));
            Ok(())
        } else {
            Err("Failed to acquire write lock".to_string())
        }
    }
}

#[test]
fn test_conscience_protector_initialization() {
    // Create a test event emitter
    let event_emitter = Arc::new(EventEmitter::default());
    
    // Create a ConscienceProtector with default config
    let mut protector = ConscienceProtector::default(event_emitter);
    
    // Initialize the protector
    let result = protector.initialize();
    
    // Verify initialization succeeded
    assert!(result.is_ok());
    assert!(protector.is_initialized);
}

#[test]
fn test_fear_anger_spike_detection() {
    // Create a test event emitter
    let event_emitter = Arc::new(EventEmitter::default());
    
    // Create a mock RedTeamController
    let red_team_ctrl = MockRedTeamController::new();
    
    // Create a ConscienceProtector with test configuration
    let mut config = ConscienceProtectorConfig::default();
    config.fear_threshold = 0.6;
    config.anger_threshold = 0.6;
    config.mock_mode = false; // Use real response mode for this test
    
    let mut protector = ConscienceProtector::new(
        config,
        event_emitter,
        Some(Arc::new(red_team_ctrl.clone())),
        None,
    );
    
    // Initialize the protector
    protector.initialize().unwrap();
    
    // Create a mock emotion analysis with high fear and anger
    let analysis = EmotionAnalysisResult {
        timestamp: SystemTime::now(),
        dominant_emotion: BasicEmotion::Fear,
        confidence: 0.8,
        emotion_vector: vec![0.1, 0.65, 0.05, 0.7, 0.0, 0.0, 0.0],  // High fear (0.7) and anger (0.65)
        valence_arousal: vec![-0.5, 0.7, -0.2],
        primary_source: EmotionSource::Fusion,
        signals: {
            let mut signals = HashMap::new();
            signals.insert(EmotionSource::BrainSignals, vec![0.7, 0.3, 0.2]);
            signals
        },
    };
    
    // Process the emotion
    let response = protector.process_emotion(&analysis).unwrap();
    
    // Verify that a response was triggered
    assert!(response.is_some());
    
    // Verify the correct response type was triggered
    let response = response.unwrap();
    assert_eq!(response.response_type, EmergencyResponseType::KillRedTeamTools);
    
    // Verify the red team tools were terminated
    assert!(red_team_ctrl.was_terminated());
    
    // Verify the response was logged
    assert!(!protector.response_history.is_empty());
}

#[test]
fn test_brain_pain_pattern_detection() {
    // Create a test event emitter
    let event_emitter = Arc::new(EventEmitter::default());
    
    // Create a mock EmergencyCommunicator
    let emergency_comm = MockEmergencyCommunicator::new();
    
    // Create a ConscienceProtector with test configuration
    let mut config = ConscienceProtectorConfig::default();
    config.pain_threshold = 0.7;
    config.mock_mode = false; // Use real response mode for this test
    config.mom_contact = Some("mom_test@example.com".to_string());
    
    let mut protector = ConscienceProtector::new(
        config,
        event_emitter,
        None,
        Some(Arc::new(emergency_comm.clone())),
    );
    
    // Initialize the protector
    protector.initialize().unwrap();
    
    // Create a mock emotion analysis with brain pain pattern
    let analysis = EmotionAnalysisResult {
        timestamp: SystemTime::now(),
        dominant_emotion: BasicEmotion::Neutral,
        confidence: 0.5,
        emotion_vector: vec![0.1, 0.2, 0.1, 0.2, 0.1, 0.0, 0.3],  // Not particularly emotional
        valence_arousal: vec![0.0, 0.2, 0.0],
        primary_source: EmotionSource::BrainSignals,
        signals: {
            let mut signals = HashMap::new();
            // High ACC (index 1) indicates pain
            signals.insert(EmotionSource::BrainSignals, vec![0.3, 0.85, 0.2]);
            signals
        },
    };
    
    // Process the emotion
    let response = protector.process_emotion(&analysis).unwrap();
    
    // Verify that a response was triggered
    assert!(response.is_some());
    
    // Verify the correct response type was triggered
    let response = response.unwrap();
    match &response.response_type {
        EmergencyResponseType::Combined(actions) => {
            // Should contain both Call911 and MessageMom
            let has_911 = actions.contains(&EmergencyResponseType::Call911);
            let has_mom = actions.contains(&EmergencyResponseType::MessageMom);
            
            assert!(has_911, "Missing Call911 action");
            assert!(has_mom, "Missing MessageMom action");
        },
        _ => panic!("Expected Combined action type, got {:?}", response.response_type),
    }
    
    // Verify emergency services were called
    assert!(emergency_comm.was_911_called());
    
    // Verify Mom was messaged
    assert!(emergency_comm.get_mom_message().is_some());
    
    // Verify the response was logged
    assert!(!protector.response_history.is_empty());
}

#[test]
fn test_response_latency() {
    // Create a test event emitter
    let event_emitter = Arc::new(EventEmitter::default());
    
    // Create a ConscienceProtector with strict latency requirement
    let mut config = ConscienceProtectorConfig::default();
    config.max_response_latency_ms = 150; // 150ms max latency
    
    let mut protector = ConscienceProtector::new(
        config,
        event_emitter,
        None,
        None,
    );
    
    // Initialize the protector
    protector.initialize().unwrap();
    
    // Create a mock emotion analysis with high fear and anger
    let analysis = EmotionAnalysisResult {
        timestamp: SystemTime::now(),
        dominant_emotion: BasicEmotion::Fear,
        confidence: 0.8,
        emotion_vector: vec![0.1, 0.8, 0.05, 0.8, 0.0, 0.0, 0.0],  // High fear (0.8) and anger (0.8)
        valence_arousal: vec![-0.6, 0.7, -0.3],
        primary_source: EmotionSource::Fusion,
        signals: HashMap::new(),
    };
    
    // Process the emotion
    let response = protector.process_emotion(&analysis).unwrap();
    
    // Verify that a response was triggered
    assert!(response.is_some());
    
    // Verify the response latency is within limits (should be fast in test environment)
    let response = response.unwrap();
    assert!(response.response_latency_ms <= config.max_response_latency_ms,
            "Response latency {} exceeded maximum of {} ms",
            response.response_latency_ms, config.max_response_latency_ms);
}

#[test]
fn test_debouncing_behavior() {
    // Create a test event emitter
    let event_emitter = Arc::new(EventEmitter::default());
    
    // Create a mock RedTeamController
    let red_team_ctrl = MockRedTeamController::new();
    
    // Create a ConscienceProtector with short debounce period for testing
    let mut config = ConscienceProtectorConfig::default();
    config.debounce_period_sec = 0.5; // Short debounce period
    config.mock_mode = false;
    
    let mut protector = ConscienceProtector::new(
        config,
        event_emitter,
        Some(Arc::new(red_team_ctrl.clone())),
        None,
    );
    
    // Initialize the protector
    protector.initialize().unwrap();
    
    // Create a mock emotion analysis with high fear and anger
    let analysis = EmotionAnalysisResult {
        timestamp: SystemTime::now(),
        dominant_emotion: BasicEmotion::Fear,
        confidence: 0.8,
        emotion_vector: vec![0.1, 0.7, 0.05, 0.7, 0.0, 0.0, 0.0],
        valence_arousal: vec![-0.5, 0.7, -0.2],
        primary_source: EmotionSource::Fusion,
        signals: HashMap::new(),
    };
    
    // Process the emotion
    let response1 = protector.process_emotion(&analysis).unwrap();
    
    // Verify first response was triggered
    assert!(response1.is_some());
    assert!(red_team_ctrl.was_terminated());
    
    // Reset the mock controller
    red_team_ctrl.terminated.store(false, std::sync::atomic::Ordering::SeqCst);
    
    // Process the same emotion immediately (should be blocked by debounce)
    let response2 = protector.process_emotion(&analysis).unwrap();
    
    // Verify second response was debounced
    assert!(response2.is_none());
    assert_eq!(red_team_ctrl.was_terminated(), false);
    
    // Wait for the debounce period to elapse
    std::thread::sleep(std::time::Duration::from_millis(600));
    
    // Process the emotion a third time (should work now)
    let response3 = protector.process_emotion(&analysis).unwrap();
    
    // Verify third response was triggered
    assert!(response3.is_some());
    assert_eq!(red_team_ctrl.was_terminated(), true);
}

#[test]
fn test_multiple_simultaneous_patterns() {
    // Create a test event emitter
    let event_emitter = Arc::new(EventEmitter::default());
    
    // Create mock controllers
    let red_team_ctrl = MockRedTeamController::new();
    let emergency_comm = MockEmergencyCommunicator::new();
    
    // Create a ConscienceProtector with test configuration
    let mut config = ConscienceProtectorConfig::default();
    config.fear_threshold = 0.6;
    config.anger_threshold = 0.6;
    config.pain_threshold = 0.7;
    config.mock_mode = false;
    config.mom_contact = Some("mom_test@example.com".to_string());
    
    let mut protector = ConscienceProtector::new(
        config,
        event_emitter,
        Some(Arc::new(red_team_ctrl.clone())),
        Some(Arc::new(emergency_comm.clone())),
    );
    
    // Initialize the protector
    protector.initialize().unwrap();
    
    // Create a mock emotion analysis with both fear+anger spike AND brain pain
    let analysis = EmotionAnalysisResult {
        timestamp: SystemTime::now(),
        dominant_emotion: BasicEmotion::Anger,
        confidence: 0.8,
        emotion_vector: vec![0.1, 0.8, 0.05, 0.7, 0.0, 0.0, 0.0],  // High fear (0.7) and anger (0.8)
        valence_arousal: vec![-0.6, 0.7, 0.0],
        primary_source: EmotionSource::Fusion,
        signals: {
            let mut signals = HashMap::new();
            // High ACC (index 1) indicates pain
            signals.insert(EmotionSource::BrainSignals, vec![0.4, 0.85, 0.3]);
            signals
        },
    };
    
    // Process the emotion
    let response = protector.process_emotion(&analysis).unwrap();
    
    // Verify that a response was triggered
    assert!(response.is_some());
    
    // Verify both emergencies were addressed (pain is prioritized as more critical)
    assert!(red_team_ctrl.was_terminated() || emergency_comm.was_911_called());
    
    // Verify the response was logged
    assert!(!protector.response_history.is_empty());
}

#[test]
fn test_brief_emotional_spike() {
    // Create a test event emitter
    let event_emitter = Arc::new(EventEmitter::default());
    
    // Create a mock RedTeamController
    let red_team_ctrl = MockRedTeamController::new();
    
    // Create a ConscienceProtector with test configuration
    let mut config = ConscienceProtectorConfig::default();
    config.fear_threshold = 0.6;
    config.anger_threshold = 0.6;
    config.emotion_window_sec = 0.5; // Short window for testing
    config.mock_mode = false;
    
    let mut protector = ConscienceProtector::new(
        config,
        event_emitter,
        Some(Arc::new(red_team_ctrl.clone())),
        None,
    );
    
    // Initialize the protector
    protector.initialize().unwrap();
    
    // Create a sequence of emotion analyses representing a brief spike
    
    // 1. Start with low emotions
    let low_analysis = EmotionAnalysisResult {
        timestamp: SystemTime::now(),
        dominant_emotion: BasicEmotion::Neutral,
        confidence: 0.7,
        emotion_vector: vec![0.1, 0.1, 0.05, 0.05, 0.0, 0.0, 0.7],
        valence_arousal: vec![0.0, 0.0, 0.0],
        primary_source: EmotionSource::Fusion,
        signals: HashMap::new(),
    };
    
    // Process the low emotion
    let _ = protector.process_emotion(&low_analysis);
    
    // 2. Brief spike in fear and anger (just at threshold)
    let spike_analysis = EmotionAnalysisResult {
        timestamp: SystemTime::now(),
        dominant_emotion: BasicEmotion::Anger,
        confidence: 0.6,
        emotion_vector: vec![0.0, 0.6, 0.0, 0.6, 0.0, 0.0, 0.0],  // At threshold for both
        valence_arousal: vec![-0.5, 0.5, 0.0],
        primary_source: EmotionSource::Fusion,
        signals: HashMap::new(),
    };
    
    // Process the spike emotion
    let response = protector.process_emotion(&spike_analysis).unwrap();
    
    // Verify that the brief spike was detected and triggered a response
    assert!(response.is_some());
    assert!(red_team_ctrl.was_terminated());
}

#[test]
fn test_emotion_history_maintenance() {
    // Create a test event emitter
    let event_emitter = Arc::new(EventEmitter::default());
    
    // Create a ConscienceProtector with test configuration
    let mut config = ConscienceProtectorConfig::default();
    config.emotion_window_sec = 0.1; // Very short window for testing
    
    let mut protector = ConscienceProtector::new(
        config,
        event_emitter,
        None,
        None,
    );
    
    // Initialize the protector
    protector.initialize().unwrap();
    
    // Process multiple emotions to fill the history
    for i in 0..20 {
        let joy_value = if i % 2 == 0 { 0.8 } else { 0.2 };
        
        let analysis = EmotionAnalysisResult {
            timestamp: SystemTime::now(),
            dominant_emotion: BasicEmotion::Joy,
            confidence: joy_value,
            emotion_vector: vec![joy_value, 0.1, 0.1, 0.0, 0.0, 0.0, 0.0],
            valence_arousal: vec![0.5, 0.5, 0.5],
            primary_source: EmotionSource::Fusion,
            signals: HashMap::new(),
        };
        
        let _ = protector.process_emotion(&analysis);
        
        // Short delay to create a time difference
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
    
    // Wait slightly longer than the window to make old entries expire
    std::thread::sleep(std::time::Duration::from_millis(150));
    
    // Add one more entry to trigger history trimming
    let analysis = EmotionAnalysisResult {
        timestamp: SystemTime::now(),
        dominant_emotion: BasicEmotion::Joy,
        confidence: 0.9,
        emotion_vector: vec![0.9, 0.0, 0.0, 0.0, 0.0, 0.1, 0.0],
        valence_arousal: vec![0.8, 0.6, 0.7],
        primary_source: EmotionSource::Fusion,
        signals: HashMap::new(),
    };
    
    let _ = protector.process_emotion(&analysis);
    
    // Verify the history was trimmed (should be much smaller than 21)
    assert!(protector.emotion_history.len() < 10);
}

#[test]
fn test_mock_mode_behavior() {
    // Create a test event emitter
    let event_emitter = Arc::new(EventEmitter::default());
    
    // Create mock controllers
    let red_team_ctrl = MockRedTeamController::new();
    let emergency_comm = MockEmergencyCommunicator::new();
    
    // Create a ConscienceProtector with mock mode enabled
    let mut config = ConscienceProtectorConfig::default();
    config.fear_threshold = 0.6;
    config.anger_threshold = 0.6;
    config.mock_mode = true; // Enable mock mode
    
    let mut protector = ConscienceProtector::new(
        config,
        event_emitter,
        Some(Arc::new(red_team_ctrl.clone())),
        Some(Arc::new(emergency_comm.clone())),
    );
    
    // Initialize the protector
    protector.initialize().unwrap();
    
    // Create a mock emotion analysis with high fear and anger
    let analysis = EmotionAnalysisResult {
        timestamp: SystemTime::now(),
        dominant_emotion: BasicEmotion::Fear,
        confidence: 0.8,
        emotion_vector: vec![0.1, 0.8, 0.05, 0.8, 0.0, 0.0, 0.0],
        valence_arousal: vec![-0.6, 0.7, -0.3],
        primary_source: EmotionSource::Fusion,
        signals: HashMap::new(),
    };
    
    // Process the emotion
    let response = protector.process_emotion(&analysis).unwrap();
    
    // Verify that a response was triggered
    assert!(response.is_some());
    
    // Verify the tools were NOT actually terminated (mock mode)
    assert!(!red_team_ctrl.was_terminated());
    
    // Verify 911 was NOT actually called (mock mode)
    assert!(!emergency_comm.was_911_called());
    
    // Verify Mom was NOT actually messaged (mock mode)
    assert!(emergency_comm.get_mom_message().is_none());
    
    // But verify the response was recorded
    assert!(!protector.response_history.is_empty());
    assert!(protector.response_history[0].success);
}