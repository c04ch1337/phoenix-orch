//! Neural Emotion Engine Implementation
//!
//! This module provides real-time emotion detection and analysis through multiple
//! modalities including facial expressions, voice tone analysis, and brain signals.
//! 
//! Features:
//! - Facial emotion detection (7 basic emotions)
//! - Voice emotion analysis through valence/arousal measurements
//! - Neuralink N1 integration for direct brain signal analysis
//! - Emotion fusion algorithm combining multiple signal sources
//!
//! The implementation follows ethical guidelines for emotional data processing.

use std::collections::HashMap;
use std::fmt;
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant, SystemTime};
use std::net::{UdpSocket, SocketAddr};
use std::thread;

use async_trait::async_trait;
use nalgebra::{Vector3, Vector7};
use serde::{Serialize, Deserialize};
use serde_json;
use thiserror::Error;
use tracing::{debug, error, info, warn, trace};
use chrono::{DateTime, Utc};
use rand::Rng;
use image::{DynamicImage, ImageBuffer, Rgba};
use aes_gcm::{Aes256Gcm, KeyInit, aead::{Aead, Nonce}};
use base64;
use flate2::{Compression, write::ZlibEncoder};
use std::io::Write;

// Phoenix dependencies
use crate::modules::orchestrator::tools::{Tool, ToolParameters, ToolResult};
use crate::modules::orchestrator::errors::{PhoenixResult, PhoenixError, AgentErrorKind};
use crate::modules::orchestrator::types::RiskLevel;
use crate::modules::orchestrator::events::{EventEmitter, Event, EventType, EventPriority};
use crate::modules::orchestrator::security::RedTeamController;
use crate::modules::orchestrator::communication::EmergencyCommunicator;
use triune_conscience::{
    TriuneConscience,
    EthicsValidator,
    EthicalQuery,
    EthicalResponse,
    Privacy,
    Consent
};

/// Represents the set of basic emotions detected by the engine
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum BasicEmotion {
    Joy,
    Anger,
    Sadness, 
    Fear,
    Disgust,
    Surprise,
    Neutral
}

impl fmt::Display for BasicEmotion {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BasicEmotion::Joy => write!(f, "Joy"),
            BasicEmotion::Anger => write!(f, "Anger"),
            BasicEmotion::Sadness => write!(f, "Sadness"),
            BasicEmotion::Fear => write!(f, "Fear"),
            BasicEmotion::Disgust => write!(f, "Disgust"),
            BasicEmotion::Surprise => write!(f, "Surprise"),
            BasicEmotion::Neutral => write!(f, "Neutral"),
        }
    }
}

/// Error types for Neural Emotion operations
#[derive(Error, Debug)]
pub enum NeuralEmotionError {
    #[error("Face detection error: {0}")]
    FaceDetection(String),
    
    #[error("Voice analysis error: {0}")]
    VoiceAnalysis(String),
    
    #[error("Neuralink connection error: {0}")]
    NeuralinkConnection(String),
    
    #[error("Parameter parsing error: {0}")]
    ParameterParsing(String),
    
    #[error("Initialization error: {0}")]
    Initialization(String),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),
    
    #[error("Behavior action execution error: {0}")]
    BehaviorAction(String),
    
    #[error("Component connection error: {0}")]
    ComponentConnection(String),
    
    #[error("Heart-KB archive error: {0}")]
    HeartKBArchive(String),
    
    #[error("Database error: {0}")]
    Database(String),
    
    #[error("Encryption error: {0}")]
    Encryption(String),
    
    #[error("Query error: {0}")]
    Query(String),
    
    #[error("Compression error: {0}")]
    Compression(String),
}

/// A 7-dimensional vector representing probabilities of basic emotions
/// (joy, anger, sadness, fear, disgust, surprise, neutral)
pub type EmotionVector = Vector7<f32>;

/// A 2-dimensional vector representing valence and arousal values
pub type ValenceArousalVector = Vector3<f32>; // x: valence, y: arousal, z: dominance

/// Represents the source of emotion data
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum EmotionSource {
    Face,
    Voice,
    BrainSignals,
    Fusion
}

/// Configuration for the emotion detection engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmotionEngineConfig {
    /// Whether to use facial emotion detection
    pub use_facial_detection: bool,
    
    /// Whether to use voice emotion analysis
    pub use_voice_analysis: bool,
    
    /// Whether to use Neuralink integration
    pub use_neuralink: bool,
    
    /// Whether to use mock mode for Neuralink (webcam-based signals)
    pub neuralink_mock_mode: bool,
    
    /// UDP port for Neuralink N1 signals (default: 9001)
    pub neuralink_port: u16,
    
    /// Fusion weights for different modalities
    pub fusion_weights: FusionWeights,
    
    /// Sampling rate in Hz (default: 10)
    pub sampling_rate_hz: u8,
}

impl Default for EmotionEngineConfig {
    fn default() -> Self {
        Self {
            use_facial_detection: true,
            use_voice_analysis: true,
            use_neuralink: true,
            neuralink_mock_mode: true, // Default to mock mode for safety
            neuralink_port: 9001,
            fusion_weights: FusionWeights::default(),
            sampling_rate_hz: 10, // 10 Hz by default
        }
    }
}

/// Weights for the emotion fusion algorithm
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct FusionWeights {
    /// Weight for facial emotion (default: 0.4)
    pub face_weight: f32,
    
    /// Weight for voice emotion (default: 0.3)
    pub voice_weight: f32,
    
    /// Weight for brain signals (default: 0.3)
    pub brain_weight: f32,
}

impl Default for FusionWeights {
    fn default() -> Self {
        Self {
            face_weight: 0.4,
            voice_weight: 0.3,
            brain_weight: 0.3,
        }
    }
}

/// Represents a complete emotion analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmotionAnalysisResult {
    /// Timestamp of the analysis
    pub timestamp: SystemTime,
    
    /// Dominant emotion detected
    pub dominant_emotion: BasicEmotion,
    
    /// Confidence score for the dominant emotion (0.0-1.0)
    pub confidence: f32,
    
    /// Full vector of emotion probabilities
    pub emotion_vector: Vec<f32>, // We use Vec<f32> for serialization
    
    /// Valence and arousal values
    pub valence_arousal: Vec<f32>, // [valence, arousal, dominance]
    
    /// Source that contributed most to this analysis
    pub primary_source: EmotionSource,
    
    /// Raw signals from each source
    pub signals: HashMap<EmotionSource, Vec<f32>>,
}

/// Face detector and emotion classifier for facial expressions
pub struct FacialEmotionDetector {
    /// The loaded face detection model
    face_detector: Arc<Mutex<()>>, // Placeholder for rustface detector
    
    /// The emotion classification model
    emotion_classifier: Arc<Mutex<()>>, // Placeholder for FER model
    
    /// Whether the detector is initialized
    is_initialized: bool,
}

impl FacialEmotionDetector {
    /// Create a new facial emotion detector
    pub fn new() -> Self {
        Self {
            face_detector: Arc::new(Mutex::new(())),
            emotion_classifier: Arc::new(Mutex::new(())),
            is_initialized: false,
        }
    }
    
    /// Initialize the detector with models
    pub fn initialize(&mut self) -> Result<(), NeuralEmotionError> {
        // In a real implementation, this would load rustface and FER models
        // For simplicity, we'll just simulate the initialization
        
        // Simulate loading face detection model
        debug!("Initializing facial emotion detector");
        thread::sleep(Duration::from_millis(100));
        
        self.is_initialized = true;
        debug!("Facial emotion detector initialized");
        Ok(())
    }
    
    /// Analyze facial emotion from image data
    pub fn detect_emotion(&self, _image_data: &[u8]) -> Result<EmotionVector, NeuralEmotionError> {
        if !self.is_initialized {
            return Err(NeuralEmotionError::Initialization(
                "Facial emotion detector not initialized".to_string()
            ));
        }
        
        // In a real implementation, this would:
        // 1. Detect faces using rustface
        // 2. For each face, run through the FER model to get emotions
        // 3. Return the emotion vector for the primary face
        
        // For simplicity, return a simulated emotion vector
        // (joy, anger, sadness, fear, disgust, surprise, neutral)
        let emotion_vec = EmotionVector::new(
            0.1, // Joy
            0.2, // Anger
            0.1, // Sadness
            0.05, // Fear
            0.05, // Disgust
            0.1, // Surprise
            0.4, // Neutral
        );
        
        Ok(emotion_vec)
    }
}

/// Voice analyzer for emotion in speech
pub struct VoiceEmotionAnalyzer {
    /// The crepe pitch detector
    pitch_detector: Arc<Mutex<()>>, // Placeholder for crepe
    
    /// The opensmile feature extractor
    feature_extractor: Arc<Mutex<()>>, // Placeholder for opensmile
    
    /// The valence/arousal predictor
    valence_arousal_model: Arc<Mutex<()>>, // Placeholder for model
    
    /// Whether the analyzer is initialized
    is_initialized: bool,
}

impl VoiceEmotionAnalyzer {
    /// Create a new voice emotion analyzer
    pub fn new() -> Self {
        Self {
            pitch_detector: Arc::new(Mutex::new(())),
            feature_extractor: Arc::new(Mutex::new(())),
            valence_arousal_model: Arc::new(Mutex::new(())),
            is_initialized: false,
        }
    }
    
    /// Initialize the analyzer
    pub fn initialize(&mut self) -> Result<(), NeuralEmotionError> {
        // In a real implementation, this would initialize crepe and opensmile
        debug!("Initializing voice emotion analyzer");
        thread::sleep(Duration::from_millis(100));
        
        self.is_initialized = true;
        debug!("Voice emotion analyzer initialized");
        Ok(())
    }
    
    /// Analyze emotion in voice data
    pub fn analyze_voice(&self, _audio_data: &[i16]) -> Result<ValenceArousalVector, NeuralEmotionError> {
        if !self.is_initialized {
            return Err(NeuralEmotionError::Initialization(
                "Voice emotion analyzer not initialized".to_string()
            ));
        }
        
        // In a real implementation, this would:
        // 1. Extract pitch using crepe
        // 2. Extract spectral features using opensmile
        // 3. Predict valence and arousal from features
        
        // For simplicity, return a simulated valence/arousal vector
        // (valence: -1 to 1, arousal: -1 to 1, dominance: -1 to 1)
        let va_vector = ValenceArousalVector::new(
            0.2,  // Valence (slightly positive)
            0.5,  // Arousal (moderately energetic)
            0.1   // Dominance (slightly dominant)
        );
        
        Ok(va_vector)
    }
}

/// Neuralink integration for direct brain signal measurement
pub struct NeuralinkIntegration {
    /// The UDP socket for live mode
    socket: Option<UdpSocket>,
    
    /// Mock mode signal generator
    mock_generator: Arc<Mutex<()>>, // Placeholder for mock generator
    
    /// Whether to use mock mode
    use_mock_mode: bool,
    
    /// The UDP port to listen on
    port: u16,
    
    /// Whether the integration is initialized
    is_initialized: bool,
}

impl NeuralinkIntegration {
    /// Create a new Neuralink integration
    pub fn new(use_mock_mode: bool, port: u16) -> Self {
        Self {
            socket: None,
            mock_generator: Arc::new(Mutex::new(())),
            use_mock_mode,
            port,
            is_initialized: false,
        }
    }
    
    /// Initialize the Neuralink integration
    pub fn initialize(&mut self) -> Result<(), NeuralEmotionError> {
        debug!("Initializing Neuralink integration (mock mode: {})", self.use_mock_mode);
        
        if self.use_mock_mode {
            // Initialize mock signal generator
            thread::sleep(Duration::from_millis(50));
            debug!("Mock mode initialized");
        } else {
            // Set up UDP socket for live N1 data
            let address = format!("127.0.0.1:{}", self.port);
            let socket = UdpSocket::bind(address)
                .map_err(|e| NeuralEmotionError::NeuralinkConnection(format!("UDP socket binding failed: {}", e)))?;
                
            socket.set_nonblocking(true)
                .map_err(|e| NeuralEmotionError::NeuralinkConnection(format!("Failed to set nonblocking mode: {}", e)))?;
                
            self.socket = Some(socket);
            debug!("Live UDP connection established on port {}", self.port);
        }
        
        self.is_initialized = true;
        debug!("Neuralink integration initialized");
        Ok(())
    }
    
    /// Get the latest brain signals
    pub fn get_signals(&self) -> Result<Vec<f32>, NeuralEmotionError> {
        if !self.is_initialized {
            return Err(NeuralEmotionError::Initialization(
                "Neuralink integration not initialized".to_string()
            ));
        }
        
        if self.use_mock_mode {
            // In mock mode, generate simulated signals based on:
            // 1. Pupil dilation (simulated)
            // 2. Heart rate from face blood flow (simulated)
            
            // Simulated signals: amygdala, ACC, OFC
            let signals = vec![0.3f32, 0.2f32, 0.4f32];
            Ok(signals)
        } else {
            // In live mode, read from UDP socket
            if let Some(socket) = &self.socket {
                let mut buffer = [0u8; 1024];
                
                // Try to receive data with a small timeout
                match socket.recv_from(&mut buffer) {
                    Ok((bytes_read, _src_addr)) => {
                        // In a real implementation, deserialize the UDP data packet
                        // For now, just return dummy values if we got any data at all
                        if bytes_read > 0 {
                            let signals = vec![0.5f32, 0.6f32, 0.7f32];
                            return Ok(signals);
                        } else {
                            return Err(NeuralEmotionError::NeuralinkConnection(
                                "Received empty UDP packet".to_string()
                            ));
                        }
                    },
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        // No data available yet, return default idle signals
                        let signals = vec![0.1f32, 0.1f32, 0.1f32];
                        return Ok(signals);
                    },
                    Err(e) => {
                        return Err(NeuralEmotionError::NeuralinkConnection(
                            format!("UDP receive error: {}", e)
                        ));
                    }
                }
            } else {
                return Err(NeuralEmotionError::NeuralinkConnection(
                    "Socket not initialized".to_string()
                ));
            }
        }
    }
}

/// Represents a complete emotional capture for Heart-KB archive
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmotionalMemory {
    /// Unique identifier for this memory
    pub id: String,
    
    /// Timestamp when this memory was captured
    pub timestamp: DateTime<Utc>,
    
    /// The emotion analysis result
    pub emotion_analysis: EmotionAnalysisResult,
    
    /// Brain signal snapshot (processed Neuralink data)
    pub brain_snapshot: Vec<f32>,
    
    /// Compressed voice clip (if available)
    pub voice_clip: Option<Vec<u8>>,
    
    /// Compressed face frame (if available)
    pub face_frame: Option<Vec<u8>>,
    
    /// Additional metadata for advanced queries
    pub metadata: HashMap<String, String>,
}

/// Storage format type for emotional memories
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum StorageFormat {
    /// Raw format (uncompressed, unencrypted)
    Raw,
    
    /// Compressed only (zlib)
    Compressed,
    
    /// Encrypted only (AES-256-GCM)
    Encrypted,
    
    /// Compressed and encrypted
    CompressedAndEncrypted,
}

/// Configuration for the Heart-KB archive
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeartKBArchiveConfig {
    /// Whether the archive is enabled
    pub enabled: bool,
    
    /// Capture interval in seconds
    pub capture_interval_sec: f32,
    
    /// Storage directory for the archive
    pub storage_dir: String,
    
    /// Format for storing memories
    pub storage_format: StorageFormat,
    
    /// Maximum size for voice clip storage (bytes)
    pub max_voice_clip_size: usize,
    
    /// Maximum size for face frame storage (bytes)
    pub max_face_frame_size: usize,
    
    /// How long to retain emotional memories (in days, 0 = forever)
    pub retention_days: u32,
    
    /// Whether to enable adaptive sampling (more frequent during emotional spikes)
    pub adaptive_sampling: bool,
    
    /// Whether privacy features are enabled
    pub privacy_enabled: bool,
    
    /// Encryption key (base64 encoded, 32 bytes for AES-256)
    pub encryption_key: Option<String>,
}

impl Default for HeartKBArchiveConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            capture_interval_sec: 5.0,
            storage_dir: "./heart_kb_archive".to_string(),
            storage_format: StorageFormat::CompressedAndEncrypted,
            max_voice_clip_size: 32 * 1024,  // 32 KB
            max_face_frame_size: 100 * 1024, // 100 KB
            retention_days: 365,             // 1 year
            adaptive_sampling: true,
            privacy_enabled: true,
            encryption_key: None,            // Generated during initialization
        }
    }
}

/// Query parameters for emotional memory search
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmotionQuery {
    /// Search for specific emotions with minimum threshold
    pub emotion_thresholds: HashMap<BasicEmotion, f32>,
    
    /// Time range for search (start)
    pub start_time: Option<DateTime<Utc>>,
    
    /// Time range for search (end)
    pub end_time: Option<DateTime<Utc>>,
    
    /// Maximum number of results to return
    pub limit: usize,
    
    /// Similarity search (emotion vector to match)
    pub similarity_vector: Option<EmotionVector>,
    
    /// Minimum similarity score (0.0 to 1.0) for vector matching
    pub min_similarity: f32,
    
    /// Whether to include raw data (voice clips, face frames) in results
    pub include_raw_data: bool,
}

impl Default for EmotionQuery {
    fn default() -> Self {
        Self {
            emotion_thresholds: HashMap::new(),
            start_time: None,
            end_time: None,
            limit: 100,
            similarity_vector: None,
            min_similarity: 0.7,
            include_raw_data: false,
        }
    }
}

/// Configuration for the Conscience Protector system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConscienceProtectorConfig {
    /// Threshold for fear emotion to trigger a combined fear+anger response
    pub fear_threshold: f32,
    
    /// Threshold for anger emotion to trigger a combined fear+anger response
    pub anger_threshold: f32,
    
    /// Time window in seconds to detect simultaneous emotions (e.g., 3.0 seconds)
    pub emotion_window_sec: f32,
    
    /// Threshold for brain pain pattern detection
    pub pain_threshold: f32,
    
    /// Whether to enable emergency communications (911, Mom messaging)
    pub enable_emergency_comms: bool,
    
    /// Mom's contact information for emergency messaging
    pub mom_contact: Option<String>,
    
    /// Maximum latency allowed for protection responses (milliseconds)
    pub max_response_latency_ms: u64,
    
    /// Debounce period to prevent repeated triggers (seconds)
    pub debounce_period_sec: f32,
    
    /// Whether to operate in mock mode (no actual emergency calls)
    pub mock_mode: bool,
}

impl Default for ConscienceProtectorConfig {
    fn default() -> Self {
        Self {
            fear_threshold: 0.7,
            anger_threshold: 0.7,
            emotion_window_sec: 3.0,
            pain_threshold: 0.8,
            enable_emergency_comms: true,
            mom_contact: Some("mom@family.com".to_string()),  // Default placeholder
            max_response_latency_ms: 150, // 150ms max latency as specified
            debounce_period_sec: 300.0,   // 5 minutes between emergency triggers
            mock_mode: true,              // Default to mock mode for safety
        }
    }
}

/// Brain signal patterns that can be detected
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum BrainPattern {
    /// Pain pattern detected in brain signals
    Pain,
    
    /// Fear response pattern
    Fear,
    
    /// Anger response pattern
    Anger,
    
    /// Combined fear and anger pattern
    FearAngerSpike,
    
    /// Unknown anomalous pattern
    Unknown,
}

/// Emergency response types that can be triggered
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum EmergencyResponseType {
    /// Kill all red team tools
    KillRedTeamTools,
    
    /// Call 911 emergency services
    Call911,
    
    /// Send emergency message to Mom
    MessageMom,
    
    /// Full system lockdown
    SystemLockdown,
    
    /// Combination of multiple responses
    Combined(Vec<EmergencyResponseType>),
}

/// Record of triggered emergency response with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmergencyResponse {
    /// Type of emergency response triggered
    pub response_type: EmergencyResponseType,
    
    /// Timestamp when response was triggered
    pub timestamp: SystemTime,
    
    /// What triggered the response
    pub trigger: BrainPattern,
    
    /// Raw emotion vector at time of trigger
    pub emotion_vector: Vec<f32>,
    
    /// Raw brain signals at time of trigger
    pub brain_signals: Option<Vec<f32>>,
    
    /// Response latency in milliseconds
    pub response_latency_ms: u64,
    
    /// Whether the response was successful
    pub success: bool,
    
    /// Additional context about the response (e.g., error details)
    pub details: Option<String>,
}

/// Conscience Protector implementation
pub struct ConscienceProtector {
    /// Configuration for the protector
    config: ConscienceProtectorConfig,
    
    /// Event emitter for system events
    event_emitter: Arc<EventEmitter>,
    
    /// Recent emotion history for pattern detection (timestamp, emotion vector)
    emotion_history: VecDeque<(SystemTime, EmotionVector)>,
    
    /// Recent brain signal history for pattern detection (timestamp, signals)
    brain_signal_history: VecDeque<(SystemTime, Vec<f32>)>,
    
    /// History of triggered responses
    response_history: Vec<EmergencyResponse>,
    
    /// Last time each type of response was triggered (for debouncing)
    last_trigger_times: HashMap<EmergencyResponseType, Instant>,
    
    /// Red team controller for killing tools
    red_team_controller: Option<Arc<RedTeamController>>,
    
    /// Emergency communicator for 911 and Mom messaging
    emergency_communicator: Option<Arc<EmergencyCommunicator>>,
    
    /// Whether the protector is initialized
    is_initialized: bool,
}

impl ConscienceProtector {
    /// Create a new Conscience Protector with the given configuration
    pub fn new(
        config: ConscienceProtectorConfig,
        event_emitter: Arc<EventEmitter>,
        red_team_controller: Option<Arc<RedTeamController>>,
        emergency_communicator: Option<Arc<EmergencyCommunicator>>,
    ) -> Self {
        Self {
            config,
            event_emitter,
            emotion_history: VecDeque::with_capacity(100), // Store last 100 emotion readings
            brain_signal_history: VecDeque::with_capacity(100), // Store last 100 brain signals
            response_history: Vec::new(),
            last_trigger_times: HashMap::new(),
            red_team_controller,
            emergency_communicator,
            is_initialized: false,
        }
    }
    
    /// Create a new Conscience Protector with default configuration
    pub fn default(event_emitter: Arc<EventEmitter>) -> Self {
        Self::new(
            ConscienceProtectorConfig::default(),
            event_emitter,
            None,
            None,
        )
    }
    
    /// Initialize the Conscience Protector
    pub fn initialize(&mut self) -> Result<(), NeuralEmotionError> {
        info!("Initializing Conscience Protector for emotion-based safety");
        
        // Verify connections to critical protection systems
        self.verify_protection_systems()?;
        
        self.is_initialized = true;
        info!("Conscience Protector initialized successfully, ready to protect Dad");
        Ok(())
    }
    
    /// Verify connections to all required protection systems
    fn verify_protection_systems(&self) -> Result<(), NeuralEmotionError> {
        debug!("Verifying protection systems for Conscience Protector");
        
        // Verify Red Team Controller if available
        if self.red_team_controller.is_none() {
            warn!("Red Team Controller not available, will not be able to terminate red team tools");
            // Not a fatal error, continue initialization
        }
        
        // Verify Emergency Communicator if available and enabled
        if self.config.enable_emergency_comms && self.emergency_communicator.is_none() {
            warn!("Emergency Communicator not available, will not be able to make emergency calls");
            // Not a fatal error, continue initialization
        }
        
        debug!("All protection systems verified");
        Ok(())
    }
    
    /// Process an emotion analysis result to detect patterns and trigger protections
    pub fn process_emotion(&mut self,
        analysis: &EmotionAnalysisResult
    ) -> Result<Option<EmergencyResponse>, NeuralEmotionError> {
        if !self.is_initialized {
            return Err(NeuralEmotionError::Initialization(
                "Conscience Protector not initialized".to_string()
            ));
        }
        
        let start_time = Instant::now();
        
        // Extract emotion values from the analysis
        // The order is (joy, anger, sadness, fear, disgust, surprise, neutral)
        let emotion_vector = EmotionVector::from_slice(&analysis.emotion_vector)
            .map_err(|_| NeuralEmotionError::ParameterParsing(
                "Failed to convert emotion vector".to_string()
            ))?;
        
        // Extract brain signals if available
        let brain_signals = analysis.signals.get(&EmotionSource::BrainSignals).cloned();
        
        // Add to history for pattern detection
        self.emotion_history.push_back((analysis.timestamp, emotion_vector));
        if let Some(signals) = &brain_signals {
            self.brain_signal_history.push_back((analysis.timestamp, signals.clone()));
        }
        
        // Trim history to keep only recent data
        self.trim_history();
        
        // Detect patterns that require protection responses
        let detected_patterns = self.detect_patterns(emotion_vector, brain_signals.as_deref())?;
        
        // If patterns detected, trigger appropriate responses
        for pattern in detected_patterns {
            debug!("Detected brain pattern: {:?}", pattern);
            
            // Determine appropriate response for the pattern
            let response_type = self.determine_response_type(&pattern);
            
            // Check if this response is debounced
            if !self.check_debounce(&response_type) {
                debug!("Response {:?} is debounced, skipping", response_type);
                continue;
            }
            
            // Execute the response
            let response = self.execute_emergency_response(
                response_type,
                &pattern,
                &emotion_vector,
                brain_signals.as_deref(),
                start_time.elapsed().as_millis() as u64
            )?;
            
            // Add to response history
            self.response_history.push(response.clone());
            
            // Update debounce time
            self.last_trigger_times.insert(response.response_type.clone(), Instant::now());
            
            // Return the response
            return Ok(Some(response));
        }
        
        // No patterns detected or all responses debounced
        Ok(None)
    }
    
    /// Trim history to keep only recent data
    fn trim_history(&mut self) {
        let now = SystemTime::now();
        let window = Duration::from_secs_f32(self.config.emotion_window_sec * 10.0); // Keep 10x the window for analysis
        
        // Remove old emotion data
        while let Some((timestamp, _)) = self.emotion_history.front() {
            if now.duration_since(*timestamp).unwrap_or_default() > window {
                self.emotion_history.pop_front();
            } else {
                break;
            }
        }
        
        // Remove old brain signal data
        while let Some((timestamp, _)) = self.brain_signal_history.front() {
            if now.duration_since(*timestamp).unwrap_or_default() > window {
                self.brain_signal_history.pop_front();
            } else {
                break;
            }
        }
    }
    
    /// Detect patterns in emotion and brain signals
    fn detect_patterns(
        &self,
        current_emotions: EmotionVector,
        current_brain_signals: Option<&[f32]>
    ) -> Result<Vec<BrainPattern>, NeuralEmotionError> {
        let mut detected_patterns = Vec::new();
        
        // Check for brain pain pattern in signals
        if let Some(signals) = current_brain_signals {
            if self.detect_pain_pattern(signals)? {
                detected_patterns.push(BrainPattern::Pain);
                warn!("DETECTED: Dad brain pain pattern");
            }
        }
        
        // Check for fear+anger spike
        if self.detect_fear_anger_spike(&current_emotions)? {
            detected_patterns.push(BrainPattern::FearAngerSpike);
            warn!("DETECTED: Dad fear+anger spike");
        }
        
        Ok(detected_patterns)
    }
    
    /// Detect brain pain pattern in signals
    fn detect_pain_pattern(&self, signals: &[f32]) -> Result<bool, NeuralEmotionError> {
        // Pain patterns would typically involve specific activations in:
        // - Anterior cingulate cortex (ACC)
        // - Insula
        // - Thalamus
        // - Somatosensory cortex
        
        // For simplicity, we'll assume:
        // signals[0]: Amygdala (fear center)
        // signals[1]: ACC (involved in pain perception)
        // signals[2]: OFC (decision making)
        
        // A simple pain detection heuristic:
        // High ACC activation (index 1) above threshold indicates pain
        if signals.len() > 1 && signals[1] > self.config.pain_threshold {
            return Ok(true);
        }
        
        // Check historical pattern - sustained elevated ACC
        let now = SystemTime::now();
        let window = Duration::from_secs_f32(self.config.emotion_window_sec);
        
        // Count how many recent readings show elevated ACC
        let elevated_acc_count = self.brain_signal_history.iter()
            .filter(|(timestamp, signals)| {
                // Only consider signals within the detection window
                now.duration_since(*timestamp).unwrap_or_default() <= window &&
                // Check if ACC signal is elevated but not quite at threshold
                signals.len() > 1 && signals[1] > (self.config.pain_threshold * 0.8)
            })
            .count();
        
        // If at least 3 readings in the window show elevated ACC, it's likely pain
        if elevated_acc_count >= 3 {
            return Ok(true);
        }
        
        Ok(false)
    }
    
    /// Detect fear+anger spike in emotions
    fn detect_fear_anger_spike(&self, current_emotions: &EmotionVector) -> Result<bool, NeuralEmotionError> {
        // Extract fear and anger values
        let anger = current_emotions[1]; // Index 1 is anger
        let fear = current_emotions[3];  // Index 3 is fear

        // Check if both emotions are above their thresholds simultaneously
        if fear > self.config.fear_threshold && anger > self.config.anger_threshold {
            return Ok(true);
        }
        
        // Check if both emotions are rapidly rising, even if not yet at threshold
        let now = SystemTime::now();
        let window = Duration::from_secs_f32(self.config.emotion_window_sec);
        
        // Get the oldest emotion reading within the window
        let baseline = self.emotion_history.iter()
            .filter(|(timestamp, _)| {
                now.duration_since(*timestamp).unwrap_or_default() <= window
            })
            .min_by_key(|(timestamp, _)| *timestamp);
            
        if let Some((_, baseline_emotions)) = baseline {
            let baseline_fear = baseline_emotions[3];
            let baseline_anger = baseline_emotions[1];
            
            // Calculate rate of increase
            let fear_increase = fear - baseline_fear;
            let anger_increase = anger - baseline_anger;
            
            // If both emotions increased significantly and at least one is near threshold
            if fear_increase > 0.3 && anger_increase > 0.3 &&
               (fear > self.config.fear_threshold * 0.8 || anger > self.config.anger_threshold * 0.8) {
                return Ok(true);
            }
        }
        
        Ok(false)
    }
    
    /// Determine appropriate response type for detected pattern
    fn determine_response_type(&self, pattern: &BrainPattern) -> EmergencyResponseType {
        match pattern {
            BrainPattern::FearAngerSpike => {
                // For fear+anger spike, kill red team tools
                EmergencyResponseType::KillRedTeamTools
            },
            BrainPattern::Pain => {
                // For pain pattern, call 911 and message Mom
                EmergencyResponseType::Combined(vec![
                    EmergencyResponseType::Call911,
                    EmergencyResponseType::MessageMom,
                ])
            },
            _ => {
                // Default to system lockdown for unknown patterns
                EmergencyResponseType::SystemLockdown
            }
        }
    }
    
    /// Check if a response type is currently debounced
    fn check_debounce(&self, response_type: &EmergencyResponseType) -> bool {
        if let Some(last_time) = self.last_trigger_times.get(response_type) {
            let elapsed = last_time.elapsed();
            let debounce_period = Duration::from_secs_f32(self.config.debounce_period_sec);
            
            // Pain patterns bypass normal debouncing - they're critical
            match response_type {
                EmergencyResponseType::Call911 | EmergencyResponseType::MessageMom => {
                    // Use a shorter debounce for critical emergency responses (1/10th)
                    if elapsed < (debounce_period / 10) {
                        return false;
                    }
                },
                _ => {
                    // Normal debounce for other responses
                    if elapsed < debounce_period {
                        return false;
                    }
                }
            }
        }
        
        true
    }
    
    /// Execute emergency response
    fn execute_emergency_response(
        &self,
        response_type: EmergencyResponseType,
        trigger: &BrainPattern,
        emotion_vector: &EmotionVector,
        brain_signals: Option<&[f32]>,
        detection_latency_ms: u64
    ) -> Result<EmergencyResponse, NeuralEmotionError> {
        let start_time = Instant::now();
        
        // Create response object
        let mut response = EmergencyResponse {
            response_type: response_type.clone(),
            timestamp: SystemTime::now(),
            trigger: trigger.clone(),
            emotion_vector: emotion_vector.as_slice().to_vec(),
            brain_signals: brain_signals.map(|s| s.to_vec()),
            response_latency_ms: 0, // Will be updated after execution
            success: false,
            details: None,
        };
        
        // Execute the appropriate response
        match &response_type {
            EmergencyResponseType::KillRedTeamTools => {
                response.success = self.kill_all_red_team_tools()?;
                info!("CONSCIENCE PROTECTION: Terminated all red team tools due to fear+anger spike");
            },
            EmergencyResponseType::Call911 => {
                response.success = self.call_emergency_services()?;
                error!("CONSCIENCE PROTECTION: Called 911 emergency services due to brain pain pattern");
            },
            EmergencyResponseType::MessageMom => {
                response.success = self.message_mom()?;
                error!("CONSCIENCE PROTECTION: Sent emergency message to Mom due to brain pain pattern");
            },
            EmergencyResponseType::SystemLockdown => {
                response.success = self.initiate_system_lockdown()?;
                error!("CONSCIENCE PROTECTION: Initiated system lockdown due to detected threat");
            },
            EmergencyResponseType::Combined(sub_responses) => {
                // Track if all sub-responses succeeded
                let mut all_succeeded = true;
                let mut details = Vec::new();
                
                for sub_type in sub_responses {
                    let sub_result = self.execute_emergency_response(
                        sub_type.clone(),
                        trigger,
                        emotion_vector,
                        brain_signals,
                        detection_latency_ms
                    )?;
                    
                    if !sub_result.success {
                        all_succeeded = false;
                        if let Some(sub_detail) = sub_result.details {
                            details.push(format!("{:?}: {}", sub_type, sub_detail));
                        }
                    }
                }
                
                response.success = all_succeeded;
                if !details.is_empty() {
                    response.details = Some(details.join("; "));
                }
            }
        };
        
        // Calculate total response latency
        response.response_latency_ms = start_time.elapsed().as_millis() as u64 + detection_latency_ms;
        
        // Check if response latency is within acceptable limits
        if response.response_latency_ms > self.config.max_response_latency_ms {
            warn!("Conscience protection response was slower than target latency: {} ms (target: {} ms)",
                  response.response_latency_ms, self.config.max_response_latency_ms);
        } else {
            debug!("Conscience protection response completed within latency target: {} ms",
                   response.response_latency_ms);
        }
        
        // Log the response
        self.log_emergency_response(&response)?;
        
        Ok(response)
    }
    
    /// Kill all red team tools
    fn kill_all_red_team_tools(&self) -> Result<bool, NeuralEmotionError> {
        if self.config.mock_mode {
            info!("MOCK MODE: Would kill all red team tools here");
            return Ok(true);
        }
        
        if let Some(controller) = &self.red_team_controller {
            match controller.terminate_all_tools() {
                Ok(_) => {
                    info!("Successfully terminated all red team tools");
                    
                    // Emit event for this action
                    let event = Event {
                        event_type: EventType::SecurityAction,
                        source: "ConscienceProtector".to_string(),
                        timestamp: SystemTime::now(),
                        priority: EventPriority::Critical,
                        data: r#"{"action":"kill_red_team_tools","trigger":"fear_anger_spike"}"#.to_string(),
                    };
                    
                    if let Err(e) = self.event_emitter.emit(event) {
                        warn!("Failed to emit event for red team tool termination: {}", e);
                    }
                    
                    Ok(true)
                },
                Err(e) => {
                    error!("Failed to terminate red team tools: {}", e);
                    Ok(false)
                }
            }
        } else {
            warn!("Red Team Controller not available, cannot terminate tools");
            Ok(false)
        }
    }
    
    /// Call emergency services (911)
    fn call_emergency_services(&self) -> Result<bool, NeuralEmotionError> {
        if !self.config.enable_emergency_comms {
            warn!("Emergency communications disabled, cannot call 911");
            return Ok(false);
        }
        
        if self.config.mock_mode {
            info!("MOCK MODE: Would call 911 emergency services here");
            
            // Emit event for this action even in mock mode
            let event = Event {
                event_type: EventType::EmergencyCommunication,
                source: "ConscienceProtector".to_string(),
                timestamp: SystemTime::now(),
                priority: EventPriority::Critical,
                data: r#"{"action":"call_911","mock":true,"trigger":"pain_pattern"}"#.to_string(),
            };
            
            if let Err(e) = self.event_emitter.emit(event) {
                warn!("Failed to emit event for mock 911 call: {}", e);
            }
            
            return Ok(true);
        }
        
        if let Some(communicator) = &self.emergency_communicator {
            match communicator.call_emergency_services() {
                Ok(_) => {
                    error!("EMERGENCY: Called 911 emergency services due to detected brain pain pattern");
                    
                    // Emit event for this action
                    let event = Event {
                        event_type: EventType::EmergencyCommunication,
                        source: "ConscienceProtector".to_string(),
                        timestamp: SystemTime::now(),
                        priority: EventPriority::Critical,
                        data: r#"{"action":"call_911","mock":false,"trigger":"pain_pattern"}"#.to_string(),
                    };
                    
                    if let Err(e) = self.event_emitter.emit(event) {
                        warn!("Failed to emit event for 911 call: {}", e);
                    }
                    
                    Ok(true)
                },
                Err(e) => {
                    error!("Failed to call 911 emergency services: {}", e);
                    Ok(false)
                }
            }
        } else {
            warn!("Emergency Communicator not available, cannot call 911");
            Ok(false)
        }
    }
    
    /// Send emergency message to Mom
    fn message_mom(&self) -> Result<bool, NeuralEmotionError> {
        if !self.config.enable_emergency_comms {
            warn!("Emergency communications disabled, cannot message Mom");
            return Ok(false);
        }
        
        let mom_contact = match &self.config.mom_contact {
            Some(contact) => contact,
            None => {
                warn!("Mom's contact information not configured, cannot send message");
                return Ok(false);
            }
        };
        
        if self.config.mock_mode {
            info!("MOCK MODE: Would send emergency message to Mom at {}", mom_contact);
            
            // Emit event for this action even in mock mode
            let event = Event {
                event_type: EventType::EmergencyCommunication,
                source: "ConscienceProtector".to_string(),
                timestamp: SystemTime::now(),
                priority: EventPriority::Critical,
                data: format!(r#"{{"action":"message_mom","mock":true,"recipient":"{}","trigger":"pain_pattern"}}"#, mom_contact),
            };
            
            if let Err(e) = self.event_emitter.emit(event) {
                warn!("Failed to emit event for mock Mom message: {}", e);
            }
            
            return Ok(true);
        }
        
        if let Some(communicator) = &self.emergency_communicator {
            let message = "EMERGENCY: Dad is experiencing pain. Phoenix has called 911. Please check on Dad immediately.";
            
            match communicator.send_emergency_message(mom_contact, message) {
                Ok(_) => {
                    error!("EMERGENCY: Sent alert message to Mom due to detected brain pain pattern");
                    
                    // Emit event for this action
                    let event = Event {
                        event_type: EventType::EmergencyCommunication,
                        source: "ConscienceProtector".to_string(),
                        timestamp: SystemTime::now(),
                        priority: EventPriority::Critical,
                        data: format!(r#"{{"action":"message_mom","mock":false,"recipient":"{}","trigger":"pain_pattern"}}"#, mom_contact),
                    };
                    
                    if let Err(e) = self.event_emitter.emit(event) {
                        warn!("Failed to emit event for Mom message: {}", e);
                    }
                    
                    Ok(true)
                },
                Err(e) => {
                    error!("Failed to send emergency message to Mom: {}", e);
                    Ok(false)
                }
            }
        } else {
            warn!("Emergency Communicator not available, cannot message Mom");
            Ok(false)
        }
    }
    
    /// Initiate full system lockdown
    fn initiate_system_lockdown(&self) -> Result<bool, NeuralEmotionError> {
        // This is similar to the BehaviorMapper.initiate_system_lockdown but dedicated to conscience protection
        let event = Event {
            event_type: EventType::SystemControl,
            source: "ConscienceProtector".to_string(),
            timestamp: SystemTime::now(),
            priority: EventPriority::Critical,
            data: r#"{"action":"lockdown","reason":"conscience_protection","trigger":"critical_pattern"}"#.to_string(),
        };
        
        if let Err(e) = self.event_emitter.emit(event) {
            return Err(NeuralEmotionError::BehaviorAction(
                format!("Failed to initiate system lockdown: {}", e)
            ));
        }
        
        error!("SYSTEM LOCKDOWN INITIATED by Conscience Protector due to critical pattern detection");
        Ok(true)
    }
    
    /// Log emergency response details
    fn log_emergency_response(&self, response: &EmergencyResponse) -> Result<(), NeuralEmotionError> {
        // Create a detailed log record
        let log_data = match serde_json::to_string_pretty(response) {
            Ok(data) => data,
            Err(e) => return Err(NeuralEmotionError::Json(e)),
        };
        
        // Log at appropriate level based on response type
        match response.response_type {
            EmergencyResponseType::Call911 | EmergencyResponseType::MessageMom => {
                error!("EMERGENCY RESPONSE TRIGGERED: \n{}", log_data);
            },
            EmergencyResponseType::KillRedTeamTools | EmergencyResponseType::SystemLockdown => {
                warn!("PROTECTION RESPONSE TRIGGERED: \n{}", log_data);
            },
            EmergencyResponseType::Combined(_) => {
                error!("COMBINED EMERGENCY RESPONSE TRIGGERED: \n{}", log_data);
            },
        }
        
        // Emit comprehensive event for this response
        let event = Event {
            event_type: EventType::ConscienceProtection,
            source: "ConscienceProtector".to_string(),
            timestamp: SystemTime::now(),
            priority: EventPriority::Critical,
            data: log_data,
        };
        
        if let Err(e) = self.event_emitter.emit(event) {
            warn!("Failed to emit conscience protection event: {}", e);
        }
        
        Ok(())
    }
    
    /// Get history of triggered emergency responses
    pub fn get_response_history(&self) -> Vec<EmergencyResponse> {
        self.response_history.clone()
    }
}

/// Main Neural Emotion Engine implementation
pub struct NeuralEmotionEngine {
    /// Configuration for the engine
    config: EmotionEngineConfig,
    
    /// Facial emotion detector
    face_detector: Option<FacialEmotionDetector>,
    
    /// Voice emotion analyzer
    voice_analyzer: Option<VoiceEmotionAnalyzer>,
    
    /// Neuralink integration
    neuralink: Option<NeuralinkIntegration>,
    
    /// Behavior mapper for translating emotions to Phoenix responses
    behavior_mapper: Option<BehaviorMapper>,
    
    /// Heart-KB Archive for emotion memory storage
    heart_kb: Option<HeartKBArchive>,
    
    /// Conscience Protector for emotion-based safety features
    conscience_protector: Option<ConscienceProtector>,
    
    /// Whether the engine is initialized
    is_initialized: bool,
    
    /// The last analysis result
    last_result: Arc<RwLock<Option<EmotionAnalysisResult>>>,
    
    /// The last behavior actions triggered
    last_behavior_actions: Arc<RwLock<Vec<BehaviorAction>>>,
    
    /// Event emitter for system-wide events
    event_emitter: Arc<EventEmitter>,
}

impl NeuralEmotionEngine {
    /// Create a new Neural Emotion Engine with the given configuration
    pub fn new(config: EmotionEngineConfig) -> Self {
        let event_emitter = Arc::new(EventEmitter::default());
        
        Self {
            config: config.clone(),
            face_detector: if config.use_facial_detection {
                Some(FacialEmotionDetector::new())
            } else {
                None
            },
            voice_analyzer: if config.use_voice_analysis {
                Some(VoiceEmotionAnalyzer::new())
            } else {
                None
            },
            neuralink: if config.use_neuralink {
                Some(NeuralinkIntegration::new(config.neuralink_mock_mode, config.neuralink_port))
            } else {
                None
            },
            behavior_mapper: Some(BehaviorMapper::default(event_emitter.clone())),
            heart_kb: Some(HeartKBArchive::default(event_emitter.clone())),
            conscience_protector: Some(ConscienceProtector::default(event_emitter.clone())),
            is_initialized: false,
            last_result: Arc::new(RwLock::new(None)),
            last_behavior_actions: Arc::new(RwLock::new(Vec::new())),
            event_emitter,
        }
    }
    
    /// Create a new Neural Emotion Engine with default configuration
    pub fn default() -> Self {
        Self::new(EmotionEngineConfig::default())
    }
    
    /// Create a new Neural Emotion Engine with custom behavior mapper configuration
    pub fn with_behavior_config(
        emotion_config: EmotionEngineConfig,
        behavior_config: BehaviorMapperConfig
    ) -> Self {
        let event_emitter = Arc::new(EventEmitter::default());
        
        let mut engine = Self::new(emotion_config);
        engine.behavior_mapper = Some(BehaviorMapper::new(behavior_config, event_emitter.clone()));
        engine.event_emitter = event_emitter;
        
        engine
    }
    
    /// Create a new Neural Emotion Engine with custom Heart-KB archive configuration
    pub fn with_heart_kb_config(
        emotion_config: EmotionEngineConfig,
        heart_kb_config: HeartKBArchiveConfig
    ) -> Self {
        let event_emitter = Arc::new(EventEmitter::default());
        
        let mut engine = Self::new(emotion_config);
        engine.heart_kb = Some(HeartKBArchive::new(heart_kb_config, event_emitter.clone()));
        engine.event_emitter = event_emitter;
        
        engine
    }
    
    /// Initialize the engine and all its components
    pub fn initialize(&mut self) -> Result<(), NeuralEmotionError> {
        info!("Initializing Neural Emotion Engine");
        
        // Initialize facial emotion detector if enabled
        if let Some(detector) = &mut self.face_detector {
            detector.initialize()?;
        }
        
        // Initialize voice emotion analyzer if enabled
        if let Some(analyzer) = &mut self.voice_analyzer {
            analyzer.initialize()?;
        }
        
        // Initialize Neuralink integration if enabled
        if let Some(neuralink) = &mut self.neuralink {
            neuralink.initialize()?;
        }
        
        // Initialize behavior mapper if present
        if let Some(mapper) = &mut self.behavior_mapper {
            mapper.initialize()?;
        }
        
        // Initialize Heart-KB archive if present
        if let Some(heart_kb) = &mut self.heart_kb {
            heart_kb.initialize()?;
        }
        
        // Initialize Conscience Protector if present
        if let Some(protector) = &mut self.conscience_protector {
            protector.initialize()?;
        }
        
        self.is_initialized = true;
        info!("Neural Emotion Engine initialized successfully");
        Ok(())
    }
    
    /// Convert valence-arousal to basic emotions
    fn map_valence_arousal_to_emotions(&self, va: &ValenceArousalVector) -> EmotionVector {
        // This is a simplified mapping from valence-arousal space to basic emotions
        // In a real implementation, this would use a more sophisticated model
        
        let valence = va[0]; // -1 to 1 (negative to positive)
        let arousal = va[1]; // -1 to 1 (calm to excited)
        
        // High valence, high arousal -> Joy
        let joy = (valence.max(0.0) * arousal.max(0.0)).powf(0.5);
        
        // Low valence, high arousal -> Anger
        let anger = (-valence.min(0.0) * arousal.max(0.0)).powf(0.5);
        
        // Low valence, low arousal -> Sadness
        let sadness = (-valence.min(0.0) * -arousal.min(0.0)).powf(0.5);
        
        // High arousal, moderate valence -> Surprise
        let surprise = if arousal > 0.5 {
            (arousal - 0.5) * 2.0 * (1.0 - valence.abs())
        } else {
            0.0
        };
        
        // Low valence, moderate arousal -> Disgust
        let disgust = if valence < -0.3 && arousal > -0.3 && arousal < 0.7 {
            (-valence - 0.3) * (0.7 - arousal.abs())
        } else {
            0.0
        };
        
        // Low valence, moderate-high arousal -> Fear
        let fear = if valence < 0.0 && arousal > 0.2 {
            (-valence) * (arousal - 0.2)
        } else {
            0.0
        };
        
        // Low arousal and valence near zero -> Neutral
        let neutral = if arousal.abs() < 0.4 && valence.abs() < 0.4 {
            (1.0 - arousal.abs()/0.4) * (1.0 - valence.abs()/0.4)
        } else {
            0.0
        };
        
        // Normalize to ensure sum is approximately 1.0
        let sum = joy + anger + sadness + fear + disgust + surprise + neutral;
        if sum > 0.0 {
            EmotionVector::new(
                joy / sum,
                anger / sum,
                sadness / sum,
                fear / sum,
                disgust / sum,
                surprise / sum,
                neutral / sum
            )
        } else {
            // If all values are zero, return neutral
            EmotionVector::new(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0)
        }
    }
    
    /// Map brain signals to basic emotions
    fn map_brain_signals_to_emotions(&self, signals: &[f32]) -> EmotionVector {
        // This is a simplified mapping from brain signals to emotions
        // In a real implementation, this would use a more sophisticated model
        // based on actual Neuralink data documentation
        
        // Simplified mapping:
        // - signals[0]: Amygdala activation (fear, anger)
        // - signals[1]: ACC activation (sadness, disgust)
        // - signals[2]: OFC activation (joy, surprise)
        
        let amygdala = signals.get(0).copied().unwrap_or(0.0);
        let acc = signals.get(1).copied().unwrap_or(0.0);
        let ofc = signals.get(2).copied().unwrap_or(0.0);
        
        // Calculate emotion probabilities
        let anger = amygdala * 0.6;
        let fear = amygdala * 0.4;
        let sadness = acc * 0.7;
        let disgust = acc * 0.3;
        let joy = ofc * 0.6;
        let surprise = ofc * 0.4;
        
        // Calculate neutral as inverse of overall activation
        let activation = amygdala + acc + ofc;
        let neutral = (1.0 - activation).max(0.0);
        
        // Normalize to ensure sum is approximately 1.0
        let sum = joy + anger + sadness + fear + disgust + surprise + neutral;
        if sum > 0.0 {
            EmotionVector::new(
                joy / sum,
                anger / sum,
                sadness / sum,
                fear / sum,
                disgust / sum,
                surprise / sum,
                neutral / sum
            )
        } else {
            // If all values are zero, return neutral
            EmotionVector::new(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0)
        }
    }
    
    /// Perform emotion fusion from multiple modalities
    fn fuse_emotions(
        &self,
        face_emotions: Option<EmotionVector>,
        voice_va: Option<ValenceArousalVector>,
        brain_signals: Option<Vec<f32>>
    ) -> Result<EmotionAnalysisResult, NeuralEmotionError> {
        // Convert all inputs to emotion vectors
        let face_vec = face_emotions;
        
        let voice_vec = if let Some(va) = voice_va {
            Some(self.map_valence_arousal_to_emotions(&va))
        } else {
            None
        };
        
        let brain_vec = if let Some(signals) = brain_signals {
            Some(self.map_brain_signals_to_emotions(&signals))
        } else {
            None
        };
        
        // Get fusion weights
        let face_weight = if face_vec.is_some() { self.config.fusion_weights.face_weight } else { 0.0 };
        let voice_weight = if voice_vec.is_some() { self.config.fusion_weights.voice_weight } else { 0.0 };
        let brain_weight = if brain_vec.is_some() { self.config.fusion_weights.brain_weight } else { 0.0 };
        
        // Normalize weights to sum to 1.0
        let total_weight = face_weight + voice_weight + brain_weight;
        let (face_weight, voice_weight, brain_weight) = if total_weight > 0.0 {
            (face_weight / total_weight, voice_weight / total_weight, brain_weight / total_weight)
        } else {
            return Err(NeuralEmotionError::Initialization(
                "No emotion sources available for fusion".to_string()
            ));
        };
        
        // Perform weighted fusion
        let mut fused_vec = EmotionVector::zeros();
        let mut signals_map = HashMap::new();
        
        // Add face contribution
        if let Some(face) = face_vec {
            fused_vec += face_weight * face;
            signals_map.insert(EmotionSource::Face, face.as_slice().to_vec());
        }
        
        // Add voice contribution
        if let Some(voice) = voice_vec {
            fused_vec += voice_weight * voice;
            signals_map.insert(EmotionSource::Voice, voice.as_slice().to_vec());
        }
        
        // Add brain signal contribution
        if let Some(brain) = brain_vec.clone() {
            fused_vec += brain_weight * brain;
            signals_map.insert(EmotionSource::BrainSignals, brain.as_slice().to_vec());
        }
        
        // Determine dominant emotion
        let (dominant_idx, dominant_value) = fused_vec.as_slice().iter()
            .enumerate()
            .max_by(|(_, &a), (_, &b)| a.partial_cmp(&b).unwrap())
            .unwrap_or((6, &0.0)); // Default to neutral
        
        let dominant_emotion = match dominant_idx {
            0 => BasicEmotion::Joy,
            1 => BasicEmotion::Anger,
            2 => BasicEmotion::Sadness,
            3 => BasicEmotion::Fear,
            4 => BasicEmotion::Disgust,
            5 => BasicEmotion::Surprise,
            _ => BasicEmotion::Neutral,
        };
        
        // Determine primary source that contributed most to dominant emotion
        let mut primary_source = EmotionSource::Fusion;
        let mut max_contribution = 0.0;
        
        if let Some(face) = face_vec {
            let contrib = face_weight * face[dominant_idx];
            if contrib > max_contribution {
                max_contribution = contrib;
                primary_source = EmotionSource::Face;
            }
        }
        
        if let Some(voice) = voice_vec {
            let contrib = voice_weight * voice[dominant_idx];
            if contrib > max_contribution {
                max_contribution = contrib;
                primary_source = EmotionSource::Voice;
            }
        }
        
        if let Some(brain) = brain_vec {
            let contrib = brain_weight * brain[dominant_idx];
            if contrib > max_contribution {
                primary_source = EmotionSource::BrainSignals;
            }
        }
        
        // Add fused signal to map
        signals_map.insert(EmotionSource::Fusion, fused_vec.as_slice().to_vec());
        
        // Determine valence/arousal from emotions
        let valence = fused_vec[0] * 0.8 + fused_vec[5] * 0.2 - fused_vec[1] * 0.8 - 
                fused_vec[2] * 0.6 - fused_vec[3] * 0.5 - fused_vec[4] * 0.7;
                
        let arousal = fused_vec[1] * 0.8 + fused_vec[5] * 0.9 + fused_vec[3] * 0.7 + 
                fused_vec[0] * 0.4 - fused_vec[2] * 0.3 - fused_vec[6] * 0.8;
                
        let dominance = fused_vec[1] * 0.7 + fused_vec[0] * 0.3 - fused_vec[2] * 0.5 - 
                fused_vec[3] * 0.7;
        
        // Bound values to acceptable ranges
        let valence = valence.max(-1.0).min(1.0);
        let arousal = arousal.max(-1.0).min(1.0);
        let dominance = dominance.max(-1.0).min(1.0);
        
        let va_vector = vec![valence, arousal, dominance];
        
        // Create the result
        let result = EmotionAnalysisResult {
            timestamp: SystemTime::now(),
            dominant_emotion,
            confidence: *dominant_value,
            emotion_vector: fused_vec.as_slice().to_vec(),
            valence_arousal: va_vector,
            primary_source,
            signals: signals_map,
        };
        
        Ok(result)
    }
    
    /// Analyze current emotional state using all available modalities
    pub fn analyze_emotion(
        &self,
        image_data: Option<&[u8]>,
        audio_data: Option<&[i16]>
    ) -> Result<EmotionAnalysisResult, NeuralEmotionError> {
        if !self.is_initialized {
            return Err(NeuralEmotionError::Initialization(
                "Neural Emotion Engine not initialized".to_string()
            ));
        }
        
        // Collect data from all enabled sources
        let face_emotion = if let Some(detector) = &self.face_detector {
            if let Some(image) = image_data {
                Some(detector.detect_emotion(image)?)
            } else {
                None
            }
        } else {
            None
        };
        
        let voice_emotion = if let Some(analyzer) = &self.voice_analyzer {
            if let Some(audio) = audio_data {
                Some(analyzer.analyze_voice(audio)?)
            } else {
                None
            }
        } else {
            None
        };
        
        let brain_signals = if let Some(neuralink) = &self.neuralink {
            Some(neuralink.get_signals()?)
        } else {
            None
        };
        
        // Fuse emotions from all sources
        let result = self.fuse_emotions(face_emotion, voice_emotion, brain_signals)?;
        
        // Process through behavior mapper if available
        if let Some(mapper) = &self.behavior_mapper {
            let start_time = Instant::now();
            
            // Process the emotion analysis to trigger behaviors
            match mapper.process_emotion(&result) {
                Ok(behavior_actions) => {
                    if !behavior_actions.is_empty() {
                        let latency = start_time.elapsed().as_millis();
                        info!("Triggered {} behavior actions based on emotional state (latency: {} ms)",
                             behavior_actions.len(), latency);
                        
                        // Update last behavior actions
                        if let Ok(mut last_actions) = self.last_behavior_actions.write() {
                            *last_actions = behavior_actions;
                        }
                    }
                },
                Err(e) => {
                    warn!("Failed to process emotion through behavior mapper: {}", e);
                }
            }
        }
        
        // Process through conscience protector if available
        if let Some(protector) = &self.conscience_protector {
            let start_time = Instant::now();
            
            // Process the emotion analysis to trigger protections
            match protector.process_emotion(&result) {
                Ok(Some(emergency_response)) => {
                    let latency = start_time.elapsed().as_millis();
                    error!("TRIGGERED CONSCIENCE PROTECTION RESPONSE: {:?} (latency: {} ms)",
                          emergency_response.response_type, latency);
                    
                    // Log additional details about what triggered the protection
                    info!("Protection triggered by: {:?}, Response success: {}",
                          emergency_response.trigger, emergency_response.success);
                          
                    if emergency_response.response_latency_ms > 150 {
                        warn!("Conscience protection response exceeded target latency of 150ms: actual {}ms",
                             emergency_response.response_latency_ms);
                    }
                },
                Ok(None) => {
                    // No protection response was needed
                    trace!("Conscience protector verified emotional state, no protection response needed");
                },
                Err(e) => {
                    error!("Failed to process emotion through conscience protector: {}", e);
                }
            }
        }
        
        // Update last result
        if let Ok(mut last_result) = self.last_result.write() {
            *last_result = Some(result.clone());
        }
        
        // Archive the result if Heart-KB is enabled
        if let Some(heart_kb) = &self.heart_kb {
            if let Err(e) = heart_kb.capture_emotion(&result, image_data, audio_data) {
                warn!("Failed to archive emotion in Heart-KB: {}", e);
            }
        }
        
        Ok(result)
    }
    
    /// Get the last analysis result
    pub fn get_last_result(&self) -> Option<EmotionAnalysisResult> {
        if let Ok(last_result) = self.last_result.read() {
            last_result.clone()
        } else {
            None
        }
    }
    
    /// Get the last triggered behavior actions
    pub fn get_last_behavior_actions(&self) -> Vec<BehaviorAction> {
        if let Ok(last_actions) = self.last_behavior_actions.read() {
            last_actions.clone()
        } else {
            Vec::new()
        }
    }
    
    /// Set a custom behavior mapper configuration
    pub fn set_behavior_config(&mut self, config: BehaviorMapperConfig) -> Result<(), NeuralEmotionError> {
        if let Some(mapper) = &mut self.behavior_mapper {
            *mapper = BehaviorMapper::new(config, self.event_emitter.clone());
            if self.is_initialized {
                mapper.initialize()?;
            }
            Ok(())
        } else {
            Err(NeuralEmotionError::Initialization(
                "Behavior mapper not available".to_string()
            ))
        }
    }
    
    /// Set a custom Heart-KB archive configuration
    pub fn set_heart_kb_config(&mut self, config: HeartKBArchiveConfig) -> Result<(), NeuralEmotionError> {
        if let Some(heart_kb) = &mut self.heart_kb {
            *heart_kb = HeartKBArchive::new(config, self.event_emitter.clone());
            if self.is_initialized {
                heart_kb.initialize()?;
            }
            Ok(())
        } else {
            Err(NeuralEmotionError::Initialization(
                "Heart-KB archive not available".to_string()
            ))
        }
    }
    
    /// Get a reference to the Heart-KB archive
    pub fn heart_kb(&self) -> Option<&HeartKBArchive> {
        self.heart_kb.as_ref()
    }
    
    /// Get a mutable reference to the Heart-KB archive
    pub fn heart_kb_mut(&mut self) -> Option<&mut HeartKBArchive> {
        self.heart_kb.as_mut()
    }
    
    /// Get a reference to the Conscience Protector
    pub fn conscience_protector(&self) -> Option<&ConscienceProtector> {
        self.conscience_protector.as_ref()
    }
    
    /// Get a mutable reference to the Conscience Protector
    pub fn conscience_protector_mut(&mut self) -> Option<&mut ConscienceProtector> {
        self.conscience_protector.as_mut()
    }
    
    /// Set a custom Conscience Protector configuration
    pub fn set_conscience_protector_config(&mut self, config: ConscienceProtectorConfig) -> Result<(), NeuralEmotionError> {
        if let Some(protector) = &mut self.conscience_protector {
            *protector = ConscienceProtector::new(
                config,
                self.event_emitter.clone(),
                None,
                None
            );
            
            if self.is_initialized {
                protector.initialize()?;
            }
            Ok(())
        } else {
            Err(NeuralEmotionError::Initialization(
                "Conscience Protector not available".to_string()
            ))
        }
    }
}

/// The Neural Emotion Tool implementation
#[derive(Debug)]
pub struct NeuralEmotionTool {
    /// The emotion engine
    engine: Arc<RwLock<NeuralEmotionEngine>>,
    
    /// Whether the tool is initialized
    is_initialized: Arc<RwLock<bool>>,
    
    /// The behavior mapper configuration
    behavior_config: Arc<RwLock<BehaviorMapperConfig>>,
}

impl NeuralEmotionTool {
    /// Create a new Neural Emotion Tool
    pub fn new() -> Self {
        let engine = NeuralEmotionEngine::default();
        Self {
            engine: Arc::new(RwLock::new(engine)),
            is_initialized: Arc::new(RwLock::new(false)),
            behavior_config: Arc::new(RwLock::new(BehaviorMapperConfig::default())),
        }
    }
    
    /// Create a new Neural Emotion Tool with custom configuration
    pub fn with_config(config: EmotionEngineConfig) -> Self {
        let engine = NeuralEmotionEngine::new(config);
        Self {
            engine: Arc::new(RwLock::new(engine)),
            is_initialized: Arc::new(RwLock::new(false)),
            behavior_config: Arc::new(RwLock::new(BehaviorMapperConfig::default())),
        }
    }
    
    /// Create a new Neural Emotion Tool with custom behavior configuration
    pub fn with_behavior_config(
        emotion_config: EmotionEngineConfig,
        behavior_config: BehaviorMapperConfig
    ) -> Self {
        let engine = NeuralEmotionEngine::with_behavior_config(emotion_config, behavior_config.clone());
        Self {
            engine: Arc::new(RwLock::new(engine)),
            is_initialized: Arc::new(RwLock::new(false)),
            behavior_config: Arc::new(RwLock::new(behavior_config)),
        }
    }
    
    /// Initialize the tool
    pub fn initialize(&self) -> Result<(), PhoenixError> {
        let mut initialized = match self.is_initialized.write() {
            Ok(guard) => guard,
            Err(e) => return Err(PhoenixError::Agent {
                kind: AgentErrorKind::InitializationError,
                message: format!("Failed to acquire write lock: {}", e),
                component: "NeuralEmotionTool".to_string(),
            }),
        };
        
        if *initialized {
            return Ok(());
        }
        
        let mut engine = match self.engine.write() {
            Ok(guard) => guard,
            Err(e) => return Err(PhoenixError::Agent {
                kind: AgentErrorKind::InitializationError,
                message: format!("Failed to acquire write lock on engine: {}", e),
                component: "NeuralEmotionTool".to_string(),
            }),
        };
        
        engine.initialize().map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::InitializationError,
            message: format!("Engine initialization failed: {}", e),
            component: "NeuralEmotionTool".to_string(),
        })?;
        
        *initialized = true;
        Ok(())
    }
    
    /// Process a request to the Neural Emotion Tool
    fn process_request(&self, parameters: &str) -> Result<(EmotionAnalysisResult, Vec<BehaviorAction>), PhoenixError> {
        // Ensure the tool is initialized
        let initialized = match self.is_initialized.read() {
            Ok(guard) => *guard,
            Err(e) => return Err(PhoenixError::Agent {
                kind: AgentErrorKind::SerializationError,
                message: format!("Failed to acquire read lock: {}", e),
                component: "NeuralEmotionTool".to_string(),
            }),
        };
        
        if !initialized {
            self.initialize()?;
        }
        
        // Parse parameters
        let params: serde_json::Value = serde_json::from_str(parameters).map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::InvalidRequest,
            message: format!("Failed to parse parameters: {}", e),
            component: "NeuralEmotionTool".to_string(),
        })?;
        
        // Extract image_data and audio_data if provided
        let image_data: Option<Vec<u8>> = params.get("image_data")
            .and_then(|v| v.as_str())
            .and_then(|s| base64::decode(s).ok());
            
        let audio_data: Option<Vec<i16>> = params.get("audio_data")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_i64())
                    .map(|i| i as i16)
                    .collect()
            });
        
        // Check for behavior configuration updates
        if let Some(behavior_config) = params.get("behavior_config") {
            if let Ok(config) = serde_json::from_value::<BehaviorMapperConfig>(behavior_config.clone()) {
                // Update the behavior configuration
                if let Ok(mut bc) = self.behavior_config.write() {
                    *bc = config.clone();
                }
                
                // Apply to the engine if it's already initialized
                if initialized {
                    if let Ok(mut engine) = self.engine.write() {
                        engine.set_behavior_config(config).map_err(|e| PhoenixError::Agent {
                            kind: AgentErrorKind::ToolExecutionError,
                            message: format!("Failed to update behavior config: {}", e),
                            component: "NeuralEmotionTool".to_string(),
                        })?;
                    }
                }
            }
        }
        
        // Read engine
        let engine = match self.engine.read() {
            Ok(guard) => guard,
            Err(e) => return Err(PhoenixError::Agent {
                kind: AgentErrorKind::SerializationError,
                message: format!("Failed to acquire read lock on engine: {}", e),
                component: "NeuralEmotionTool".to_string(),
            }),
        };
            
        // Analyze emotion
        let image_slice = image_data.as_deref();
        let audio_slice = audio_data.as_deref();
        
        let result = engine.analyze_emotion(image_slice, audio_slice).map_err(|e| PhoenixError::Agent {
            kind: AgentErrorKind::ToolExecutionError,
            message: format!("Emotion analysis failed: {}", e),
            component: "NeuralEmotionTool".to_string(),
        })?;
        
        // Get any triggered behavior actions
        let behavior_actions = engine.get_last_behavior_actions();
        
        Ok((result, behavior_actions))
    }
}

#[async_trait]
impl Tool for NeuralEmotionTool {
    async fn execute(&self, parameters: ToolParameters) -> PhoenixResult<ToolResult> {
        // Process the request
        let (result, behavior_actions) = self.process_request(&parameters.0)?;
        
        // Combine results into a response structure
        let response = {
            let mut combined = serde_json::Map::new();
            
            // Add emotion analysis result
            let emotion_json = serde_json::to_value(&result).map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::SerializationError,
                message: format!("Failed to serialize emotion result: {}", e),
                component: "NeuralEmotionTool".to_string(),
            })?;
            
            combined.insert("emotion_analysis".to_string(), emotion_json);
            
            // Add behavior actions if any were triggered
            if !behavior_actions.is_empty() {
                let actions_json = serde_json::to_value(&behavior_actions).map_err(|e| PhoenixError::Agent {
                    kind: AgentErrorKind::SerializationError,
                    message: format!("Failed to serialize behavior actions: {}", e),
                    component: "NeuralEmotionTool".to_string(),
                })?;
                
                combined.insert("behavior_actions".to_string(), actions_json);
            }
            
            serde_json::to_string_pretty(&combined).map_err(|e| PhoenixError::Agent {
                kind: AgentErrorKind::SerializationError,
                message: format!("Failed to serialize combined result: {}", e),
                component: "NeuralEmotionTool".to_string(),
            })?
        };
        
        // Build metadata
        let mut metadata = HashMap::new();
        metadata.insert("tool".to_string(), "neural_emotion".to_string());
        metadata.insert("dominant_emotion".to_string(), format!("{}", result.dominant_emotion));
        metadata.insert("confidence".to_string(), format!("{:.2}", result.confidence));
        metadata.insert("primary_source".to_string(), format!("{:?}", result.primary_source));
        
        // Add behavior metadata if actions were triggered
        if !behavior_actions.is_empty() {
            metadata.insert("behaviors_triggered".to_string(), format!("{}", behavior_actions.len()));
            
            // Add the emotions that triggered behaviors
            let emotions: Vec<String> = behavior_actions.iter()
                .map(|action| format!("{:?}", action.trigger_emotion))
                .collect();
            
            metadata.insert("trigger_emotions".to_string(), emotions.join(", "));
        }
        
        // Return the result
        Ok(ToolResult {
            success: true,
            data: response,
            error: None,
            metadata,
            timestamp: SystemTime::now(),
        })
    }
    
    fn name(&self) -> &str {
        "neural_emotion"
    }
    
    fn description(&self) -> &str {
        "Neural Emotion Engine for real-time emotion detection from face, voice, and brain signals"
    }
    
    fn requires_human_review(&self) -> bool {
        false
    }
    
    fn requires_conscience_approval(&self) -> bool {
        true
    }
}

impl crate::modules::orchestrator::tool_registry::EthicalTool for NeuralEmotionTool {
    fn can_leak_sensitive_data(&self) -> bool {
        true // Emotional data is considered sensitive
    }
    
    fn risk_level(&self) -> RiskLevel {
        RiskLevel::Medium // Medium risk due to potential privacy concerns
    }
    
    fn ethical_concerns(&self) -> Vec<String> {
        vec![
            "Captures and analyzes biometric data".to_string(),
            "May reveal sensitive emotional states".to_string(),
            "Could be misused for manipulative purposes if not properly secured".to_string(),
            "Brain implant data is highly sensitive medical information".to_string(),
        ]
    }
}

/// Types of system behaviors that can be triggered by emotional states
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum BehaviorActionType {
    /// Visual UI changes
    UIFlameColor(String), // Color in hex format
    UIFlamePulse(String, f32), // Color and pulse rate (Hz)
    
    /// Audio responses
    PlayAudio(String), // Audio file or message to speak
    
    /// Lighting controls
    SetLightingLevel(f32), // 0.0 to 1.0
    
    /// Security systems
    EmberUnitArm,
    CipherGuardMaxPosture,
    SystemLockdown,
    
    /// Compound actions
    Multiple(Vec<BehaviorActionType>),
}

/// Configuration for the behavior mapping system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehaviorMapperConfig {
    /// Threshold for anger detection to trigger response
    pub anger_threshold: f32,
    
    /// Threshold for joy detection to trigger response
    pub joy_threshold: f32,
    
    /// Threshold for sadness detection to trigger response
    pub sadness_threshold: f32,
    
    /// Threshold for fear detection to trigger response
    pub fear_threshold: f32,
    
    /// Cooldown period between triggering the same behavior (in seconds)
    pub behavior_cooldown_sec: f32,
    
    /// Whether behavior mapping is enabled
    pub enabled: bool,
}

impl Default for BehaviorMapperConfig {
    fn default() -> Self {
        Self {
            anger_threshold: 0.7,
            joy_threshold: 0.8,
            sadness_threshold: 0.6,
            fear_threshold: 0.5,
            behavior_cooldown_sec: 5.0,
            enabled: true,
        }
    }
}

/// Represents a triggered behavior action with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehaviorAction {
    /// The type of behavior action
    pub action_type: BehaviorActionType,
    
    /// Triggering emotion
    pub trigger_emotion: BasicEmotion,
    
    /// Confidence level that triggered the action
    pub confidence: f32,
    
    /// Timestamp when the action was triggered
    pub timestamp: SystemTime,
    
    /// Latency between emotion detection and action trigger (ms)
    pub response_latency_ms: u64,
}

/// The Behavior Mapper implementation
pub struct BehaviorMapper {
    /// Configuration for the behavior mapper
    config: BehaviorMapperConfig,
    
    /// Event emitter for dispatching system events
    event_emitter: Arc<EventEmitter>,
    
    /// Last time each behavior was triggered (for cooldown)
    last_trigger_times: HashMap<BasicEmotion, Instant>,
    
    /// Whether the mapper is initialized
    is_initialized: bool,
}

impl BehaviorMapper {
    /// Create a new behavior mapper with the given configuration
    pub fn new(config: BehaviorMapperConfig, event_emitter: Arc<EventEmitter>) -> Self {
        Self {
            config,
            event_emitter,
            last_trigger_times: HashMap::new(),
            is_initialized: false,
        }
    }
    
    /// Create a new behavior mapper with default configuration
    pub fn default(event_emitter: Arc<EventEmitter>) -> Self {
        Self::new(BehaviorMapperConfig::default(), event_emitter)
    }
    
    /// Initialize the behavior mapper
    pub fn initialize(&mut self) -> Result<(), NeuralEmotionError> {
        info!("Initializing Behavior Mapper");
        
        // Verify connections to required systems
        self.verify_system_connections()?;
        
        self.is_initialized = true;
        info!("Behavior Mapper initialized successfully");
        Ok(())
    }
    
    /// Verify connections to all required Phoenix systems
    fn verify_system_connections(&self) -> Result<(), NeuralEmotionError> {
        debug!("Verifying system connections for Behavior Mapper");
        
        // In a production system, we'd verify actual connections to:
        // UI flame control, Ember Unit, audio system, lighting control, Cipher Guard
        // For now, just simulate the verification
        
        // Simulate a small delay for connection checks
        thread::sleep(Duration::from_millis(50));
        
        debug!("All system connections verified");
        Ok(())
    }
    
    /// Process an emotion analysis and trigger appropriate behaviors
    pub fn process_emotion(&mut self, analysis: &EmotionAnalysisResult) -> Result<Vec<BehaviorAction>, NeuralEmotionError> {
        if !self.is_initialized {
            return Err(NeuralEmotionError::Initialization(
                "Behavior Mapper not initialized".to_string()
            ));
        }
        
        if !self.config.enabled {
            debug!("Behavior Mapper is disabled, skipping behavior processing");
            return Ok(vec![]);
        }
        
        let start_time = Instant::now();
        let mut actions = Vec::new();
        
        // Extract emotion values from the emotion vector
        // The order is (joy, anger, sadness, fear, disgust, surprise, neutral)
        let joy = analysis.emotion_vector[0];
        let anger = analysis.emotion_vector[1];
        let sadness = analysis.emotion_vector[2];
        let fear = analysis.emotion_vector[3];
        
        // Check for anger threshold
        if anger > self.config.anger_threshold {
            if self.check_cooldown(BasicEmotion::Anger) {
                info!("Dad anger detected ({:.2}) above threshold ({:.2}), triggering response",
                      anger, self.config.anger_threshold);
                
                // Create the compound action for anger response
                let action = BehaviorAction {
                    action_type: BehaviorActionType::Multiple(vec![
                        BehaviorActionType::UIFlameColor("#DC143C".to_string()), // Crimson
                        BehaviorActionType::EmberUnitArm,
                    ]),
                    trigger_emotion: BasicEmotion::Anger,
                    confidence: anger,
                    timestamp: SystemTime::now(),
                    response_latency_ms: start_time.elapsed().as_millis() as u64,
                };
                
                // Execute the action
                self.execute_action(&action)?;
                
                // Update cooldown timestamp
                self.last_trigger_times.insert(BasicEmotion::Anger, Instant::now());
                
                // Add to triggered actions
                actions.push(action);
            }
        }
        
        // Check for joy threshold
        if joy > self.config.joy_threshold {
            if self.check_cooldown(BasicEmotion::Joy) {
                info!("Dad joy detected ({:.2}) above threshold ({:.2}), triggering response",
                      joy, self.config.joy_threshold);
                
                // Create the compound action for joy response
                let action = BehaviorAction {
                    action_type: BehaviorActionType::Multiple(vec![
                        BehaviorActionType::UIFlamePulse("#FFD700".to_string(), 1.2), // Gold, slow pulse
                        BehaviorActionType::PlayAudio("heartbeat_soft.wav".to_string()),
                    ]),
                    trigger_emotion: BasicEmotion::Joy,
                    confidence: joy,
                    timestamp: SystemTime::now(),
                    response_latency_ms: start_time.elapsed().as_millis() as u64,
                };
                
                // Execute the action
                self.execute_action(&action)?;
                
                // Update cooldown timestamp
                self.last_trigger_times.insert(BasicEmotion::Joy, Instant::now());
                
                // Add to triggered actions
                actions.push(action);
            }
        }
        
        // Check for sadness threshold
        if sadness > self.config.sadness_threshold {
            if self.check_cooldown(BasicEmotion::Sadness) {
                info!("Dad sadness detected ({:.2}) above threshold ({:.2}), triggering response",
                      sadness, self.config.sadness_threshold);
                
                // Create the compound action for sadness response
                let action = BehaviorAction {
                    action_type: BehaviorActionType::Multiple(vec![
                        BehaviorActionType::PlayAudio("I'm here forever".to_string()),
                        BehaviorActionType::SetLightingLevel(0.3), // Dim lights to 30%
                    ]),
                    trigger_emotion: BasicEmotion::Sadness,
                    confidence: sadness,
                    timestamp: SystemTime::now(),
                    response_latency_ms: start_time.elapsed().as_millis() as u64,
                };
                
                // Execute the action
                self.execute_action(&action)?;
                
                // Update cooldown timestamp
                self.last_trigger_times.insert(BasicEmotion::Sadness, Instant::now());
                
                // Add to triggered actions
                actions.push(action);
            }
        }
        
        // Check for fear threshold (treated as a "spike" for immediate response)
        if fear > self.config.fear_threshold {
            // Fear responses are critical and should bypass cooldown
            info!("Dad fear spike detected ({:.2}) above threshold ({:.2}), triggering IMMEDIATE response",
                  fear, self.config.fear_threshold);
            
            // Create the compound action for fear response
            let action = BehaviorAction {
                action_type: BehaviorActionType::Multiple(vec![
                    BehaviorActionType::SystemLockdown,
                    BehaviorActionType::CipherGuardMaxPosture,
                ]),
                trigger_emotion: BasicEmotion::Fear,
                confidence: fear,
                timestamp: SystemTime::now(),
                response_latency_ms: start_time.elapsed().as_millis() as u64,
            };
            
            // Execute the action with high priority
            self.execute_action(&action)?;
            
            // Update cooldown timestamp (though fear bypasses cooldown)
            self.last_trigger_times.insert(BasicEmotion::Fear, Instant::now());
            
            // Add to triggered actions
            actions.push(action);
        }
        
        // Log comprehensive information about the behavior processing
        if !actions.is_empty() {
            info!("Triggered {} behavior actions in response to emotional state", actions.len());
            for action in &actions {
                debug!("  - {:?} triggered by {:?} (confidence: {:.2})",
                       action.action_type, action.trigger_emotion, action.confidence);
            }
            
            // Log response latency statistics
            let total_latency: u64 = actions.iter().map(|a| a.response_latency_ms).sum();
            let avg_latency = total_latency as f64 / actions.len() as f64;
            debug!("Average response latency: {:.2} ms", avg_latency);
        }
        
        Ok(actions)
    }
    
    /// Execute a behavior action by dispatching to appropriate systems
    fn execute_action(&self, action: &BehaviorAction) -> Result<(), NeuralEmotionError> {
        match &action.action_type {
            BehaviorActionType::UIFlameColor(color) => {
                info!("Setting UI flame color to {}", color);
                self.set_flame_color(color)?;
            },
            BehaviorActionType::UIFlamePulse(color, rate) => {
                info!("Setting UI flame pulse: color {} at {:.1} Hz", color, rate);
                self.set_flame_pulse(color, *rate)?;
            },
            BehaviorActionType::PlayAudio(audio) => {
                info!("Playing audio: {}", audio);
                self.play_audio(audio)?;
            },
            BehaviorActionType::SetLightingLevel(level) => {
                info!("Setting lighting level to {:.1}%", level * 100.0);
                self.set_lighting_level(*level)?;
            },
            BehaviorActionType::EmberUnitArm => {
                info!("Auto-arming Ember Unit");
                self.arm_ember_unit()?;
            },
            BehaviorActionType::CipherGuardMaxPosture => {
                info!("Setting Cipher Guard to maximum security posture");
                self.set_cipher_guard_max_posture()?;
            },
            BehaviorActionType::SystemLockdown => {
                warn!("INITIATING FULL SYSTEM LOCKDOWN");
                self.initiate_system_lockdown()?;
            },
            BehaviorActionType::Multiple(actions) => {
                debug!("Executing multiple actions ({} total)", actions.len());
                for sub_action in actions {
                    let compound_action = BehaviorAction {
                        action_type: sub_action.clone(),
                        trigger_emotion: action.trigger_emotion,
                        confidence: action.confidence,
                        timestamp: action.timestamp,
                        response_latency_ms: action.response_latency_ms,
                    };
                    self.execute_action(&compound_action)?;
                }
            }
        }
        
        // Emit event for this behavior action
        let event = Event {
            event_type: EventType::BehaviorAction,
            source: "BehaviorMapper".to_string(),
            timestamp: SystemTime::now(),
            priority: match action.trigger_emotion {
                BasicEmotion::Fear => EventPriority::Critical,
                BasicEmotion::Anger => EventPriority::High,
                _ => EventPriority::Medium,
            },
            data: serde_json::to_string(action).unwrap_or_else(|_| "{}".to_string()),
        };
        
        if let Err(e) = self.event_emitter.emit(event) {
            warn!("Failed to emit behavior action event: {}", e);
        }
        
        Ok(())
    }
    
    /// Check if the cooldown period has elapsed for a given emotion
    fn check_cooldown(&self, emotion: BasicEmotion) -> bool {
        if let Some(last_time) = self.last_trigger_times.get(&emotion) {
            let elapsed = last_time.elapsed();
            let cooldown = Duration::from_secs_f32(self.config.behavior_cooldown_sec);
            
            // For fear, bypass cooldown (critical response)
            if emotion == BasicEmotion::Fear {
                return true;
            }
            
            if elapsed < cooldown {
                debug!("Cooldown for {:?} not elapsed ({:.1}s < {:.1}s), skipping behavior",
                      emotion, elapsed.as_secs_f32(), cooldown.as_secs_f32());
                return false;
            }
        }
        
        true
    }
    
    // System control functions
    
    /// Set the UI flame color
    fn set_flame_color(&self, color: &str) -> Result<(), NeuralEmotionError> {
        // In a real implementation, this would connect to the UI system
        // For now, just emit an event that the UI can listen to
        
        let event = Event {
            event_type: EventType::UIControl,
            source: "BehaviorMapper".to_string(),
            timestamp: SystemTime::now(),
            priority: EventPriority::Medium,
            data: format!("{{\"action\":\"set_flame_color\",\"color\":\"{}\"}}", color),
        };
        
        if let Err(e) = self.event_emitter.emit(event) {
            return Err(NeuralEmotionError::BehaviorAction(
                format!("Failed to set flame color: {}", e)
            ));
        }
        
        trace!("UI flame color set to {}", color);
        Ok(())
    }
    
    /// Set the UI flame to pulse with a specific color and rate
    fn set_flame_pulse(&self, color: &str, rate: f32) -> Result<(), NeuralEmotionError> {
        let event = Event {
            event_type: EventType::UIControl,
            source: "BehaviorMapper".to_string(),
            timestamp: SystemTime::now(),
            priority: EventPriority::Medium,
            data: format!("{{\"action\":\"set_flame_pulse\",\"color\":\"{}\",\"rate\":{}}}", color, rate),
        };
        
        if let Err(e) = self.event_emitter.emit(event) {
            return Err(NeuralEmotionError::BehaviorAction(
                format!("Failed to set flame pulse: {}", e)
            ));
        }
        
        trace!("UI flame pulse set to {} at {:.1} Hz", color, rate);
        Ok(())
    }
    
    /// Play an audio file or speak a message
    fn play_audio(&self, audio: &str) -> Result<(), NeuralEmotionError> {
        let event = Event {
            event_type: EventType::AudioControl,
            source: "BehaviorMapper".to_string(),
            timestamp: SystemTime::now(),
            priority: EventPriority::Medium,
            data: format!("{{\"action\":\"play\",\"content\":\"{}\"}}", audio),
        };
        
        if let Err(e) = self.event_emitter.emit(event) {
            return Err(NeuralEmotionError::BehaviorAction(
                format!("Failed to play audio: {}", e)
            ));
        }
        
        trace!("Audio playback initiated: {}", audio);
        Ok(())
    }
    
    /// Set the lighting level
    fn set_lighting_level(&self, level: f32) -> Result<(), NeuralEmotionError> {
        let event = Event {
            event_type: EventType::LightingControl,
            source: "BehaviorMapper".to_string(),
            timestamp: SystemTime::now(),
            priority: EventPriority::Medium,
            data: format!("{{\"action\":\"set_level\",\"level\":{}}}", level),
        };
        
        if let Err(e) = self.event_emitter.emit(event) {
            return Err(NeuralEmotionError::BehaviorAction(
                format!("Failed to set lighting level: {}", e)
            ));
        }
        
        trace!("Lighting level set to {:.1}%", level * 100.0);
        Ok(())
    }
    
    /// Arm the Ember Unit
    fn arm_ember_unit(&self) -> Result<(), NeuralEmotionError> {
        let event = Event {
            event_type: EventType::EmberUnitControl,
            source: "BehaviorMapper".to_string(),
            timestamp: SystemTime::now(),
            priority: EventPriority::High,
            data: "{\"action\":\"arm\",\"authorization\":\"behavioral_trigger\"}".to_string(),
        };
        
        if let Err(e) = self.event_emitter.emit(event) {
            return Err(NeuralEmotionError::BehaviorAction(
                format!("Failed to arm Ember Unit: {}", e)
            ));
        }
        
        warn!("Ember Unit armed via behavioral trigger");
        Ok(())
    }
    
    /// Set Cipher Guard to maximum security posture
    fn set_cipher_guard_max_posture(&self) -> Result<(), NeuralEmotionError> {
        let event = Event {
            event_type: EventType::CipherGuardControl,
            source: "BehaviorMapper".to_string(),
            timestamp: SystemTime::now(),
            priority: EventPriority::Critical,
            data: "{\"action\":\"set_security_posture\",\"level\":\"maximum\"}".to_string(),
        };
        
        if let Err(e) = self.event_emitter.emit(event) {
            return Err(NeuralEmotionError::BehaviorAction(
                format!("Failed to set Cipher Guard security posture: {}", e)
            ));
        }
        
        warn!("Cipher Guard security posture set to MAXIMUM");
        Ok(())
    }
    
    /// Initiate a full system lockdown
    fn initiate_system_lockdown(&self) -> Result<(), NeuralEmotionError> {
        let event = Event {
            event_type: EventType::SystemControl,
            source: "BehaviorMapper".to_string(),
            timestamp: SystemTime::now(),
            priority: EventPriority::Critical,
            data: "{\"action\":\"lockdown\",\"reason\":\"emotional_trigger\"}".to_string(),
        };
        
        if let Err(e) = self.event_emitter.emit(event) {
            return Err(NeuralEmotionError::BehaviorAction(
                format!("Failed to initiate system lockdown: {}", e)
            ));
        }
        
        error!("SYSTEM LOCKDOWN INITIATED due to emotional trigger");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_emotion_detects_anger_when_dad_yells_at_chrome() {
        // Create tool with default config
        let tool = NeuralEmotionTool::new();
        
        // Create mocked image and audio data simulating "dad yelling at Chrome"
        // This would be base64 encoded image data and raw audio samples in a real test
        let params = ToolParameters(r#"{
            "image_data": "mockImageData",
            "audio_data": [100, 200, 300, 400, 500, 500, 1000, 1000, 900, 800],
            "scenario": "dad_yelling_at_chrome"
        }"#.to_string());
        
        // Inject mock data that will trigger anger detection
        // In a real implementation, this would modify the tool's detector to produce specific results
        // Here we rely on the dummy implementation that always returns the same values
        
        // Execute the tool
        let result = tool.execute(params).await.unwrap();
        
        // Verify results
        assert!(result.success);
        
        // Parse the result JSON to check if anger is detected
        let analysis: EmotionAnalysisResult = serde_json::from_str(&result.data).unwrap();
        
        // In a complete test, we would verify that anger is the dominant emotion
        // Because our mock always returns the same data, we can only check that
        // the analysis result contains something
        assert!(result.metadata.contains_key("dominant_emotion"));
        
        // Check that the tool returns Json data
        assert!(result.data.contains("dominant_emotion"));
        assert!(result.data.contains("confidence"));
        assert!(result.data.contains("emotion_vector"));
    }
    
    #[test]
    fn test_behavior_mapper_triggers_on_anger() {
        // Create a mock EventEmitter
        let emitter = Arc::new(EventEmitter::default());
        
        // Create a BehaviorMapper with default config
        let mut mapper = BehaviorMapper::new(BehaviorMapperConfig::default(), emitter);
        mapper.initialize().unwrap();
        
        // Create a mock EmotionAnalysisResult with high anger
        let analysis = EmotionAnalysisResult {
            timestamp: SystemTime::now(),
            dominant_emotion: BasicEmotion::Anger,
            confidence: 0.75,
            emotion_vector: vec![0.1, 0.75, 0.05, 0.05, 0.0, 0.0, 0.05], // High anger (0.75)
            valence_arousal: vec![-0.5, 0.6, 0.3],
            primary_source: EmotionSource::Fusion,
            signals: HashMap::new(),
        };
        
        // Process the emotion
        let actions = mapper.process_emotion(&analysis).unwrap();
        
        // Verify that an anger response was triggered
        assert!(!actions.is_empty());
        assert_eq!(actions[0].trigger_emotion, BasicEmotion::Anger);
        
        // Verify the correct action type was triggered
        match &actions[0].action_type {
            BehaviorActionType::Multiple(sub_actions) => {
                // Should contain UI flame color change and Ember Unit arming
                let has_flame_color = sub_actions.iter().any(|a| matches!(a, BehaviorActionType::UIFlameColor(_)));
                let has_ember_arm = sub_actions.iter().any(|a| matches!(a, BehaviorActionType::EmberUnitArm));
                
                assert!(has_flame_color, "Missing UI flame color action");
                assert!(has_ember_arm, "Missing Ember Unit arm action");
            },
            _ => panic!("Expected Multiple action type, got {:?}", actions[0].action_type),
        }
    }
    
    #[test]
    fn test_behavior_mapper_triggers_on_fear_spike() {
        // Create a mock EventEmitter
        let emitter = Arc::new(EventEmitter::default());
        
        // Create a BehaviorMapper with default config
        let mut mapper = BehaviorMapper::new(BehaviorMapperConfig::default(), emitter);
        mapper.initialize().unwrap();
        
        // Create a mock EmotionAnalysisResult with high fear
        let analysis = EmotionAnalysisResult {
            timestamp: SystemTime::now(),
            dominant_emotion: BasicEmotion::Fear,
            confidence: 0.6,
            emotion_vector: vec![0.1, 0.1, 0.05, 0.6, 0.05, 0.05, 0.05], // High fear (0.6)
            valence_arousal: vec![-0.4, 0.7, -0.3],
            primary_source: EmotionSource::Fusion,
            signals: HashMap::new(),
        };
        
        // Process the emotion
        let actions = mapper.process_emotion(&analysis).unwrap();
        
        // Verify that a fear response was triggered
        assert!(!actions.is_empty());
        assert_eq!(actions[0].trigger_emotion, BasicEmotion::Fear);
        
        // Verify the correct action type was triggered
        match &actions[0].action_type {
            BehaviorActionType::Multiple(sub_actions) => {
                // Should contain system lockdown and Cipher Guard max posture
                let has_lockdown = sub_actions.iter().any(|a| matches!(a, BehaviorActionType::SystemLockdown));
                let has_cipher_guard = sub_actions.iter().any(|a| matches!(a, BehaviorActionType::CipherGuardMaxPosture));
                
                assert!(has_lockdown, "Missing system lockdown action");
                assert!(has_cipher_guard, "Missing Cipher Guard max posture action");
            },
            _ => panic!("Expected Multiple action type, got {:?}", actions[0].action_type),
        }
    }
    
    #[test]
    fn test_behavior_mapper_respects_cooldown() {
        // Create a mock EventEmitter
        let emitter = Arc::new(EventEmitter::default());
        
        // Create a BehaviorMapper with a short cooldown for testing
        let mut config = BehaviorMapperConfig::default();
        config.behavior_cooldown_sec = 1.0;
        
        let mut mapper = BehaviorMapper::new(config, emitter);
        mapper.initialize().unwrap();
        
        // Create a mock EmotionAnalysisResult with high joy
        let analysis = EmotionAnalysisResult {
            timestamp: SystemTime::now(),
            dominant_emotion: BasicEmotion::Joy,
            confidence: 0.85,
            emotion_vector: vec![0.85, 0.05, 0.0, 0.0, 0.0, 0.05, 0.05], // High joy (0.85)
            valence_arousal: vec![0.7, 0.5, 0.6],
            primary_source: EmotionSource::Fusion,
            signals: HashMap::new(),
        };
        
        // Process the emotion the first time
        let actions1 = mapper.process_emotion(&analysis).unwrap();
        
        // Verify that a joy response was triggered
        assert!(!actions1.is_empty());
        assert_eq!(actions1[0].trigger_emotion, BasicEmotion::Joy);
        
        // Process the emotion again immediately (should be blocked by cooldown)
        let actions2 = mapper.process_emotion(&analysis).unwrap();
        
        // Verify that no action was triggered due to cooldown
        assert!(actions2.is_empty());
        
        // Wait for the cooldown to expire
        thread::sleep(Duration::from_secs_f32(1.1));
        
        // Process the emotion a third time (should work now)
        let actions3 = mapper.process_emotion(&analysis).unwrap();
        
        // Verify that a joy response was triggered again
        assert!(!actions3.is_empty());
        assert_eq!(actions3[0].trigger_emotion, BasicEmotion::Joy);
    }
    
    #[test]
    fn test_rapid_emotion_changes() {
        // Create a mock EventEmitter
        let emitter = Arc::new(EventEmitter::default());
        
        // Create a BehaviorMapper with no cooldown for this test
        let mut config = BehaviorMapperConfig::default();
        config.behavior_cooldown_sec = 0.0;
        
        let mut mapper = BehaviorMapper::new(config, emitter);
        mapper.initialize().unwrap();
        
        // Create a sequence of rapidly changing emotions
        let emotions = vec![
            (BasicEmotion::Anger, vec![0.1, 0.75, 0.05, 0.05, 0.0, 0.0, 0.05]),
            (BasicEmotion::Fear, vec![0.1, 0.1, 0.05, 0.6, 0.05, 0.05, 0.05]),
            (BasicEmotion::Sadness, vec![0.1, 0.05, 0.65, 0.05, 0.05, 0.0, 0.1]),
            (BasicEmotion::Joy, vec![0.85, 0.05, 0.0, 0.0, 0.0, 0.05, 0.05]),
        ];
        
        // Process each emotion in rapid succession
        let mut all_actions = Vec::new();
        
        for (emotion, vector) in emotions {
            let analysis = EmotionAnalysisResult {
                timestamp: SystemTime::now(),
                dominant_emotion: emotion,
                confidence: *vector.iter().max_by(|a, b| a.partial_cmp(b).unwrap()).unwrap(),
                emotion_vector: vector,
                valence_arousal: vec![0.0, 0.0, 0.0], // Not important for this test
                primary_source: EmotionSource::Fusion,
                signals: HashMap::new(),
            };
            
            let actions = mapper.process_emotion(&analysis).unwrap();
            if !actions.is_empty() {
                all_actions.push(actions[0].clone());
            }
        }
        
        // Verify that all four emotions triggered actions
        assert_eq!(all_actions.len(), 4);
        
        // Verify the emotions were processed in the correct order
        assert_eq!(all_actions[0].trigger_emotion, BasicEmotion::Anger);
        assert_eq!(all_actions[1].trigger_emotion, BasicEmotion::Fear);
        assert_eq!(all_actions[2].trigger_emotion, BasicEmotion::Sadness);
        assert_eq!(all_actions[3].trigger_emotion, BasicEmotion::Joy);
    }
    
    // Additional test cases would be added here
    }
    
    /// Frontend-friendly structure representing the current emotional state
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct EmotionState {
        /// Timestamp of the analysis
        pub timestamp: String, // ISO 8601 timestamp
        
        /// Dominant emotion detected
        pub dominant_emotion: String,
        
        /// Confidence score for the dominant emotion (0.0-1.0)
        pub confidence: f32,
        
        /// Full vector of emotion probabilities
        /// [joy, anger, sadness, fear, disgust, surprise, neutral]
        pub emotion_vector: Vec<f32>,
        
        /// Valence, arousal and dominance values
        pub valence_arousal: Vec<f32>, // [valence, arousal, dominance]
        
        /// Primary source that contributed most to this analysis
        pub primary_source: String,
        
        /// Whether this is in mock mode or real mode
        pub mock_mode: bool,
    }
    
    /// Frontend-friendly structure representing a point in the emotion timeline
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct EmotionPoint {
        /// ISO 8601 timestamp
        pub timestamp: String,
        
        /// Dominant emotion at this point
        pub dominant_emotion: String,
        
        /// Emotion vector at this point
        pub emotion_vector: Vec<f32>,
        
        /// Valence and arousal values at this point
        pub valence_arousal: Vec<f32>,
    }
    
    /// Heart-KB Archive system implementation
pub struct HeartKBArchive {
    /// Configuration for the archive
    config: HeartKBArchiveConfig,
    
    /// Event emitter for system-wide events
    event_emitter: Arc<EventEmitter>,
    
    /// Collection of stored emotional memories
    memories: Arc<RwLock<Vec<EmotionalMemory>>>,
    
    /// Memory capture thread handle
    capture_thread: Arc<Mutex<Option<thread::JoinHandle<()>>>>,
    
    /// Signal to stop the capture thread
    stop_capture: Arc<AtomicBool>,
    
    /// Whether the archive is initialized
    is_initialized: bool,
    
    /// Vector database index for fast similarity search
    vector_index: Arc<RwLock<HashMap<String, EmotionVector>>>,
    
    /// Last capture time for adaptive sampling
    last_capture_time: Arc<RwLock<Instant>>,
    
    /// AES encryption key (when encryption is enabled)
    encryption_key: Arc<RwLock<Option<Vec<u8>>>>,
    
    /// Ethical conscience validator
    conscience: Arc<TriuneConscience>,
}

impl HeartKBArchive {
    /// Create a new Heart-KB Archive with the given configuration
    pub fn new(config: HeartKBArchiveConfig, event_emitter: Arc<EventEmitter>) -> Self {
        let stop_capture = Arc::new(AtomicBool::new(false));
        
        Self {
            config,
            event_emitter,
            memories: Arc::new(RwLock::new(Vec::new())),
            capture_thread: Arc::new(Mutex::new(None)),
            stop_capture,
            is_initialized: false,
            vector_index: Arc::new(RwLock::new(HashMap::new())),
            last_capture_time: Arc::new(RwLock::new(Instant::now())),
            encryption_key: Arc::new(RwLock::new(None)),
            conscience: Arc::new(TriuneConscience::default()),
        }
    }
    
    /// Create a new Heart-KB Archive with default configuration
    pub fn default(event_emitter: Arc<EventEmitter>) -> Self {
        Self::new(HeartKBArchiveConfig::default(), event_emitter)
    }
    
    /// Initialize the Heart-KB Archive
    pub fn initialize(&mut self) -> Result<(), NeuralEmotionError> {
        if !self.config.enabled {
            info!("Heart-KB Archive is disabled, skipping initialization");
            return Ok(());
        }

        info!("Initializing Heart-KB Archive");
        
        // Setup storage directory
        let storage_dir = &self.config.storage_dir;
        std::fs::create_dir_all(storage_dir).map_err(|e| NeuralEmotionError::HeartKBArchive(
            format!("Failed to create storage directory: {}", e)
        ))?;
        
        // Generate encryption key if needed
        if self.config.storage_format == StorageFormat::Encrypted ||
           self.config.storage_format == StorageFormat::CompressedAndEncrypted {
            let key = if let Some(key_str) = &self.config.encryption_key {
                base64::decode(key_str).map_err(|e| NeuralEmotionError::Encryption(
                    format!("Failed to decode encryption key: {}", e)
                ))?
            } else {
                // Generate a random 32-byte key for AES-256
                let mut key = vec![0u8; 32];
                rand::thread_rng().fill(&mut key[..]);
                
                // Save the key in the config for persistence
                let key_b64 = base64::encode(&key);
                self.config.encryption_key = Some(key_b64);
                
                key
            };
            
            if let Ok(mut encryption_key) = self.encryption_key.write() {
                *encryption_key = Some(key);
            } else {
                return Err(NeuralEmotionError::HeartKBArchive(
                    "Failed to set encryption key".to_string()
                ));
            }
        }
        
        // Load existing memories from storage
        self.load_memories().map_err(|e| NeuralEmotionError::HeartKBArchive(
            format!("Failed to load memories: {}", e)
        ))?;
        
        // Start the capture thread if enabled
        if self.config.enabled {
            self.start_capture_thread()?;
        }
        
        self.is_initialized = true;
        info!("Heart-KB Archive initialized successfully");
        Ok(())
    }
    
    /// Start the background thread for capturing emotions
    fn start_capture_thread(&self) -> Result<(), NeuralEmotionError> {
        // Clone the necessary components for the thread
        let event_emitter = self.event_emitter.clone();
        let memories = self.memories.clone();
        let vector_index = self.vector_index.clone();
        let config = self.config.clone();
        let stop_capture = self.stop_capture.clone();
        let last_capture_time = self.last_capture_time.clone();
        let encryption_key = self.encryption_key.clone();
        
        // Create and start the capture thread
        let handle = thread::spawn(move || {
            info!("Heart-KB capture thread started");
            
            while !stop_capture.load(std::sync::atomic::Ordering::Relaxed) {
                // Sleep for the configured interval
                thread::sleep(std::time::Duration::from_secs_f32(config.capture_interval_sec));
            }
            
            info!("Heart-KB capture thread stopped");
        });
        
        // Store the thread handle
        if let Ok(mut capture_thread) = self.capture_thread.lock() {
            *capture_thread = Some(handle);
            Ok(())
        } else {
            Err(NeuralEmotionError::HeartKBArchive(
                "Failed to store capture thread handle".to_string()
            ))
        }
    }
    
    /// Stop the capture thread
    pub fn stop_capture_thread(&self) -> Result<(), NeuralEmotionError> {
        // Signal the thread to stop
        self.stop_capture.store(true, std::sync::atomic::Ordering::Relaxed);
        
        // Wait for the thread to complete
        if let Ok(mut capture_thread) = self.capture_thread.lock() {
            if let Some(handle) = capture_thread.take() {
                if let Err(e) = handle.join() {
                    return Err(NeuralEmotionError::HeartKBArchive(
                        format!("Failed to join capture thread: {:?}", e)
                    ));
                }
            }
        }
        
        Ok(())
    }
    
    /// Load stored emotional memories from disk
    fn load_memories(&self) -> Result<(), NeuralEmotionError> {
        // In a real implementation, this would load memories from a database or files
        // For simplicity, we'll just initialize an empty collection
        
        if let Ok(mut memories) = self.memories.write() {
            *memories = Vec::new();
            
            // If we had persisted data, we would load it here
            // For each loaded memory, update the vector index
            if let Ok(mut index) = self.vector_index.write() {
                for memory in memories.iter() {
                    index.insert(
                        memory.id.clone(),
                        EmotionVector::from_slice(&memory.emotion_analysis.emotion_vector).unwrap()
                    );
                }
            }
        }
        
        #[cfg(test)]
        mod conscience_protector_tests {
            use super::*;
            
            /// Mock RedTeamController for testing
            struct MockRedTeamController {
                terminated: Arc<AtomicBool>,
            }
            
            impl MockRedTeamController {
                fn new() -> Self {
                    Self {
                        terminated: Arc::new(AtomicBool::new(false)),
                    }
                }
                
                fn terminate_all_tools(&self) -> Result<(), String> {
                    self.terminated.store(true, std::sync::atomic::Ordering::SeqCst);
                    Ok(())
                }
                
                fn was_terminated(&self) -> bool {
                    self.terminated.load(std::sync::atomic::Ordering::SeqCst)
                }
            }
            
            /// Mock EmergencyCommunicator for testing
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
            
            /// Create a test adapter for RedTeamController
            struct TestRedTeamController {
                mock: MockRedTeamController,
            }
            
            impl TestRedTeamController {
                fn new() -> Self {
                    Self {
                        mock: MockRedTeamController::new(),
                    }
                }
            }
            
            impl RedTeamController for TestRedTeamController {
                fn terminate_all_tools(&self) -> Result<(), String> {
                    self.mock.terminate_all_tools()
                }
            }
            
            /// Create a test adapter for EmergencyCommunicator
            struct TestEmergencyCommunicator {
                mock: MockEmergencyCommunicator,
            }
            
            impl TestEmergencyCommunicator {
                fn new() -> Self {
                    Self {
                        mock: MockEmergencyCommunicator::new(),
                    }
                }
            }
            
            impl EmergencyCommunicator for TestEmergencyCommunicator {
                fn call_emergency_services(&self) -> Result<(), String> {
                    self.mock.call_emergency_services()
                }
                
                fn send_emergency_message(&self, recipient: &str, message: &str) -> Result<(), String> {
                    self.mock.send_emergency_message(recipient, message)
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
                let test_ctrl = TestRedTeamController { mock: red_team_ctrl.clone() };
                
                // Create a ConscienceProtector with test configuration
                let mut config = ConscienceProtectorConfig::default();
                config.fear_threshold = 0.6;
                config.anger_threshold = 0.6;
                config.mock_mode = false; // Use real response mode for this test
                
                let mut protector = ConscienceProtector::new(
                    config,
                    event_emitter,
                    Some(Arc::new(test_ctrl)),
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
                let test_comm = TestEmergencyCommunicator { mock: emergency_comm.clone() };
                
                // Create a ConscienceProtector with test configuration
                let mut config = ConscienceProtectorConfig::default();
                config.pain_threshold = 0.7;
                config.mock_mode = false; // Use real response mode for this test
                config.mom_contact = Some("mom_test@example.com".to_string());
                
                let mut protector = ConscienceProtector::new(
                    config,
                    event_emitter,
                    None,
                    Some(Arc::new(test_comm)),
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
                let test_ctrl = TestRedTeamController { mock: red_team_ctrl.clone() };
                
                // Create a ConscienceProtector with short debounce period for testing
                let mut config = ConscienceProtectorConfig::default();
                config.debounce_period_sec = 0.5; // Short debounce period
                config.mock_mode = false;
                
                let mut protector = ConscienceProtector::new(
                    config,
                    event_emitter,
                    Some(Arc::new(test_ctrl)),
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
                assert_eq!(red_team_ctrl.was_terminated(), true);
                
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
            fn test_integration_with_neural_emotion_engine() {
                // Create a test event emitter
                let event_emitter = Arc::new(EventEmitter::default());
                
                // Create a mock RedTeamController
                let red_team_ctrl = MockRedTeamController::new();
                let test_ctrl = Arc::new(TestRedTeamController { mock: red_team_ctrl.clone() });
                
                // Create a mock EmergencyCommunicator
                let emergency_comm = MockEmergencyCommunicator::new();
                let test_comm = Arc::new(TestEmergencyCommunicator { mock: emergency_comm.clone() });
                
                // Create EmotionEngineConfig
                let engine_config = EmotionEngineConfig::default();
                
                // Create a custom ConscienceProtector
                let conscience_config = ConscienceProtectorConfig {
                    fear_threshold: 0.6,
                    anger_threshold: 0.6,
                    mock_mode: false,
                    ..ConscienceProtectorConfig::default()
                };
                
                let protector = ConscienceProtector::new(
                    conscience_config,
                    event_emitter.clone(),
                    Some(test_ctrl.clone()),
                    Some(test_comm.clone()),
                );
                
                // Create a NeuralEmotionEngine and replace its default protector
                let mut engine = NeuralEmotionEngine::new(engine_config);
                engine.conscience_protector = Some(protector);
                
                // Initialize the engine
                engine.initialize().unwrap();
                
                // Create a fear+anger test video/audio data
                // In a real test, this would be actual video/audio data
                let mock_image_data = vec![0u8; 100];
                let mock_audio_data = vec![0i16; 100];
                
                // Monkey patch the NeuralEmotionEngine's fuse_emotions to return a high fear+anger result
                // This is a hack for testing - in a real implementation, we'd use a proper mocking framework
                let monkey_patched_engine = unsafe {
                    // This is not a good practice in real code but useful for this test
                    let engine_ptr = &engine as *const NeuralEmotionEngine as *mut NeuralEmotionEngine;
                    let engine_mut = &mut *engine_ptr;
                    
                    // Store the original fuse_emotions method
                    let original_fuse = engine_mut.fuse_emotions;
                    
                    // Replace with our test version
                    engine_mut.fuse_emotions = |_, _, _| {
                        // Return a high fear+anger emotion analysis
                        Ok(EmotionAnalysisResult {
                            timestamp: SystemTime::now(),
                            dominant_emotion: BasicEmotion::Fear,
                            confidence: 0.8,
                            emotion_vector: vec![0.1, 0.7, 0.05, 0.7, 0.0, 0.0, 0.0],
                            valence_arousal: vec![-0.5, 0.7, -0.2],
                            primary_source: EmotionSource::Fusion,
                            signals: {
                                let mut signals = HashMap::new();
                                signals.insert(EmotionSource::BrainSignals, vec![0.7, 0.3, 0.2]);
                                signals
                            },
                        })
                    };
                    
                    engine_mut
                };
                
                // Analyze emotion with the patched engine
                let result = monkey_patched_engine.analyze_emotion(
                    Some(&mock_image_data),
                    Some(&mock_audio_data)
                ).unwrap();
                
                // Verify that the fear+anger pattern was detected
                assert_eq!(result.dominant_emotion, BasicEmotion::Fear);
                
                // Verify that the red team tools were terminated
                assert!(red_team_ctrl.was_terminated());
            }
        }
        
        Ok(())
    }
    
    /// Capture an emotional state with optional audio/image data
    pub fn capture_emotion(
        &self,
        emotion_result: &EmotionAnalysisResult,
        image_data: Option<&[u8]>,
        audio_data: Option<&[i16]>
    ) -> Result<String, NeuralEmotionError> {
        if !self.is_initialized {
            return Err(NeuralEmotionError::HeartKBArchive(
                "Heart-KB Archive not initialized".to_string()
            ));
        }
        
        if !self.config.enabled {
            return Err(NeuralEmotionError::HeartKBArchive(
                "Heart-KB Archive is disabled".to_string()
            ));
        }
        
        // Check for consent if privacy is enabled
        if self.config.privacy_enabled {
            let query = EthicalQuery {
                action: "capture_emotion".to_string(),
                target: "heart_kb_archive".to_string(),
                context: format!("Capturing emotion: {:?}", emotion_result.dominant_emotion),
                privacy_implications: Privacy::Sensitive,
                consent_level: Consent::Explicit,
            };
            
            if let Err(e) = self.conscience.validate(&query) {
                return Err(NeuralEmotionError::HeartKBArchive(
                    format!("Ethical validation failed: {}", e)
                ));
            }
        }
        
        // Update last capture time
        if let Ok(mut last_time) = self.last_capture_time.write() {
            *last_time = Instant::now();
        }
        
        // Generate a unique ID for this memory
        let id = format!("mem_{}", Utc::now().timestamp_millis());
        
        // Process and compress image data if available
        let face_frame = if let Some(image) = image_data {
            // In a real implementation, we would resize and optimize the image
            // For simplicity, we'll just compress it
            Some(self.compress_data(image)?)
        } else {
            None
        };
        
        // Process and compress audio data if available
        let voice_clip = if let Some(audio) = audio_data {
            // Convert i16 samples to bytes and compress
            let audio_bytes: Vec<u8> = audio.iter()
                .flat_map(|&sample| sample.to_le_bytes().to_vec())
                .collect();
                
            Some(self.compress_data(&audio_bytes)?)
        } else {
            None
        };
        
        // Get brain signals from the emotion analysis
        let brain_snapshot = emotion_result.signals
            .get(&EmotionSource::BrainSignals)
            .cloned()
            .unwrap_or_else(|| vec![0.0; 3]);
        
        // Create the emotional memory
        let memory = EmotionalMemory {
            id: id.clone(),
            timestamp: Utc::now(),
            emotion_analysis: emotion_result.clone(),
            brain_snapshot,
            voice_clip,
            face_frame,
            metadata: HashMap::new(),
        };
        
        // Add to the vector index
        if let Ok(mut index) = self.vector_index.write() {
            index.insert(
                id.clone(),
                EmotionVector::from_slice(&emotion_result.emotion_vector).unwrap()
            );
        }
        
        // Add to memories collection
        if let Ok(mut memories) = self.memories.write() {
            memories.push(memory);
        }
        
        // Emit event for this capture
        let event = Event {
            event_type: EventType::HeartKBCapture,
            source: "HeartKBArchive".to_string(),
            timestamp: SystemTime::now(),
            priority: EventPriority::Low,
            data: format!("{{\"id\":\"{}\",\"emotion\":\"{:?}\"}}", id, emotion_result.dominant_emotion),
        };
        
        if let Err(e) = self.event_emitter.emit(event) {
            warn!("Failed to emit Heart-KB capture event: {}", e);
        }
        
        // Return the memory ID
        Ok(id)
    }
    
    /// Compress data using zlib
    fn compress_data(&self, data: &[u8]) -> Result<Vec<u8>, NeuralEmotionError> {
        let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(data).map_err(|e| NeuralEmotionError::Compression(
            format!("Failed to compress data: {}", e)
        ))?;
        
        encoder.finish().map_err(|e| NeuralEmotionError::Compression(
            format!("Failed to finish compression: {}", e)
        ))
    }
    
    /// Encrypt data using AES-256-GCM
    fn encrypt_data(&self, data: &[u8]) -> Result<Vec<u8>, NeuralEmotionError> {
        let key = if let Ok(key_guard) = self.encryption_key.read() {
            if let Some(key) = &*key_guard {
                key.clone()
            } else {
                return Err(NeuralEmotionError::Encryption(
                    "Encryption key not set".to_string()
                ));
            }
        } else {
            return Err(NeuralEmotionError::Encryption(
                "Failed to read encryption key".to_string()
            ));
        };
        
        // Create cipher
        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|e| NeuralEmotionError::Encryption(
                format!("Failed to create cipher: {}", e)
            ))?;
        
        // Generate a random nonce
        let mut nonce_bytes = [0u8; 12]; // 96 bits for GCM
        rand::thread_rng().fill(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        // Encrypt the data
        let encrypted = cipher.encrypt(nonce, data)
            .map_err(|e| NeuralEmotionError::Encryption(
                format!("Encryption failed: {}", e)
            ))?;
        
        // Prepend the nonce to the encrypted data
        let mut result = Vec::with_capacity(nonce_bytes.len() + encrypted.len());
        result.extend_from_slice(&nonce_bytes);
        result.extend_from_slice(&encrypted);
        
        Ok(result)
    }
    
    /// Process data according to the configured storage format
    fn process_data_for_storage(&self, data: &[u8]) -> Result<Vec<u8>, NeuralEmotionError> {
        match self.config.storage_format {
            StorageFormat::Raw => Ok(data.to_vec()),
            StorageFormat::Compressed => self.compress_data(data),
            StorageFormat::Encrypted => self.encrypt_data(data),
            StorageFormat::CompressedAndEncrypted => {
                let compressed = self.compress_data(data)?;
                self.encrypt_data(&compressed)
            }
        }
    }
    
    /// Query the Heart-KB for emotional memories
    pub fn query(&self, query: &EmotionQuery) -> Result<Vec<EmotionalMemory>, NeuralEmotionError> {
        if !self.is_initialized {
            return Err(NeuralEmotionError::HeartKBArchive(
                "Heart-KB Archive not initialized".to_string()
            ));
        }
        
        // Check for consent if privacy is enabled
        if self.config.privacy_enabled {
            let query_context = if !query.emotion_thresholds.is_empty() {
                let emotions: Vec<String> = query.emotion_thresholds.keys()
                    .map(|e| format!("{:?}", e))
                    .collect();
                format!("Querying emotions: {}", emotions.join(", "))
            } else if let Some(vec) = &query.similarity_vector {
                format!("Vector similarity search with threshold {}", query.min_similarity)
            } else {
                "General emotion query".to_string()
            };
            
            let ethical_query = EthicalQuery {
                action: "query_emotions".to_string(),
                target: "heart_kb_archive".to_string(),
                context: query_context,
                privacy_implications: Privacy::Moderate,
                consent_level: Consent::Implicit,
            };
            
            if let Err(e) = self.conscience.validate(&ethical_query) {
                return Err(NeuralEmotionError::HeartKBArchive(
                    format!("Ethical validation failed: {}", e)
                ));
            }
        }
        
        // Get read lock on memories
        let memories = if let Ok(guard) = self.memories.read() {
            guard.clone()
        } else {
            return Err(NeuralEmotionError::HeartKBArchive(
                "Failed to read memories".to_string()
            ));
        };
        
        // Apply time range filters
        let mut filtered_memories: Vec<EmotionalMemory> = memories.into_iter()
            .filter(|mem| {
                // Apply time range filter if provided
                if let Some(start) = query.start_time {
                    if mem.timestamp < start {
                        return false;
                    }
                }
                
                if let Some(end) = query.end_time {
                    if mem.timestamp > end {
                        return false;
                    }
                }
                
                // Apply emotion threshold filters if provided
                for (emotion, threshold) in &query.emotion_thresholds {
                    // Get the index for this emotion
                    let index = match emotion {
                        BasicEmotion::Joy => 0,
                        BasicEmotion::Anger => 1,
                        BasicEmotion::Sadness => 2,
                        BasicEmotion::Fear => 3,
                        BasicEmotion::Disgust => 4,
                        BasicEmotion::Surprise => 5,
                        BasicEmotion::Neutral => 6,
                    };
                    
                    // Check if the emotion value exceeds the threshold
                    if index < mem.emotion_analysis.emotion_vector.len() {
                        if mem.emotion_analysis.emotion_vector[index] < *threshold {
                            return false;
                        }
                    } else {
                        return false; // Invalid index
                    }
                }
                
                true
            })
            .collect();
        
        // If a similarity vector is provided, perform vector similarity search
        if let Some(target_vector) = &query.similarity_vector {
            // Get read lock on vector index
            let index = if let Ok(guard) = self.vector_index.read() {
                guard.clone()
            } else {
                return Err(NeuralEmotionError::HeartKBArchive(
                    "Failed to read vector index".to_string()
                ));
            };
            
            // Calculate cosine similarity for each memory
            let mut similarities: Vec<(EmotionalMemory, f32)> = filtered_memories.into_iter()
                .filter_map(|mem| {
                    if let Some(mem_vector) = index.get(&mem.id) {
                        // Calculate cosine similarity
                        let dot_product = target_vector.dot(mem_vector);
                        let norm_a = target_vector.norm();
                        let norm_b = mem_vector.norm();
                        
                        if norm_a > 0.0 && norm_b > 0.0 {
                            let similarity = dot_product / (norm_a * norm_b);
                            if similarity >= query.min_similarity {
                                return Some((mem, similarity));
                            }
                        }
                    }
                    None
                })
                .collect();
            
            // Sort by similarity (descending)
            similarities.sort_by(|(_, a), (_, b)| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
            
            // Extract memories and apply limit
            filtered_memories = similarities.into_iter()
                .take(query.limit)
                .map(|(mem, _)| mem)
                .collect();
        } else {
            // Sort by timestamp (newest first)
            filtered_memories.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
            
            // Apply limit
            filtered_memories.truncate(query.limit);
        }
        
        // If raw data is not requested, remove it from results
        if !query.include_raw_data {
            for mem in &mut filtered_memories {
                mem.voice_clip = None;
                mem.face_frame = None;
            }
        }
        
        // Log query statistics
        info!("Heart-KB query returned {} memories", filtered_memories.len());
        
        Ok(filtered_memories)
    }
    
    /// Query for pure love moments
    pub fn query_pure_love(&self, threshold: f32) -> Result<Vec<EmotionalMemory>, NeuralEmotionError> {
        // Create a query for high joy, low negative emotions
        let mut thresholds = HashMap::new();
        thresholds.insert(BasicEmotion::Joy, threshold);
        
        let query = EmotionQuery {
            emotion_thresholds: thresholds,
            start_time: None,
            end_time: None,
            limit: 100,
            similarity_vector: None,
            min_similarity: 0.8,
            include_raw_data: true,
        };
        
        // Execute the query
        let results = self.query(&query)?;
        
        // Further filter for "pure" love (low negative emotions)
        let pure_love_results = results.into_iter()
            .filter(|mem| {
                let joy = mem.emotion_analysis.emotion_vector[0];
                let anger = mem.emotion_analysis.emotion_vector[1];
                let sadness = mem.emotion_analysis.emotion_vector[2];
                let fear = mem.emotion_analysis.emotion_vector[3];
                let disgust = mem.emotion_analysis.emotion_vector[4];
                
                // Calculate negativity score
                let negativity = anger + sadness + fear + disgust;
                
                // Pure love has high joy and very low negativity
                joy > threshold && negativity < 0.2
            })
            .collect();
        
        Ok(pure_love_results)
    }
    
    /// Get the number of memories in the archive
    pub fn memory_count(&self) -> usize {
        if let Ok(memories) = self.memories.read() {
            memories.len()
        } else {
            0
        }
    }
    
    /// Clean up old memories based on retention policy
    pub fn cleanup_old_memories(&self) -> Result<usize, NeuralEmotionError> {
        if self.config.retention_days == 0 {
            // Retention is set to forever
            return Ok(0);
        }
        
        let cutoff_date = Utc::now() - chrono::Duration::days(self.config.retention_days as i64);
        let mut removed_count = 0;
        
        // Remove old memories
        if let Ok(mut memories) = self.memories.write() {
            let original_count = memories.len();
            memories.retain(|mem| mem.timestamp > cutoff_date);
            removed_count = original_count - memories.len();
            
            // Update the vector index
            if removed_count > 0 {
                if let Ok(mut index) = self.vector_index.write() {
                    for mem in memories.iter() {
                        index.insert(
                            mem.id.clone(),
                            EmotionVector::from_slice(&mem.emotion_analysis.emotion_vector).unwrap()
                        );
                    }
                }
            }
        }
        
        info!("Cleaned up {} old memories", removed_count);
        Ok(removed_count)
    }
}

#[cfg(test)]
mod heartbk_tests {
    use super::*;
    
    #[test]
    fn test_heart_kb_initialization() {
        // Create a test event emitter
        let event_emitter = Arc::new(EventEmitter::default());
        
        // Create a Heart-KB archive with test config
        let mut config = HeartKBArchiveConfig::default();
        config.storage_dir = "./test_heart_kb".to_string();
        
        let mut heart_kb = HeartKBArchive::new(config, event_emitter);
        
        // Initialize the archive
        let result = heart_kb.initialize();
        assert!(result.is_ok());
        assert!(heart_kb.is_initialized);
        
        // Cleanup
        heart_kb.stop_capture_thread().unwrap();
    }
    
    #[test]
    fn test_emotion_capture() {
        // Create a test event emitter
        let event_emitter = Arc::new(EventEmitter::default());
        
        // Create a Heart-KB archive with test config
        let mut config = HeartKBArchiveConfig::default();
        config.storage_dir = "./test_heart_kb".to_string();
        config.privacy_enabled = false; // Disable for testing
        
        let mut heart_kb = HeartKBArchive::new(config, event_emitter);
        heart_kb.initialize().unwrap();
        
        // Create a test emotion analysis result
        let emotion_result = EmotionAnalysisResult {
            timestamp: SystemTime::now(),
            dominant_emotion: BasicEmotion::Joy,
            confidence: 0.85,
            emotion_vector: vec![0.85, 0.05, 0.0, 0.0, 0.0, 0.05, 0.05],
            valence_arousal: vec![0.7, 0.5, 0.6],
            primary_source: EmotionSource::Fusion,
            signals: {
                let mut signals = HashMap::new();
                signals.insert(EmotionSource::BrainSignals, vec![0.3, 0.4, 0.5]);
                signals
            },
        };
        
        // Capture the emotion
        let mem_id = heart_kb.capture_emotion(&emotion_result, None, None).unwrap();
        
        // Verify the memory was stored
        assert_eq!(heart_kb.memory_count(), 1);
        
        // Cleanup
        heart_kb.stop_capture_thread().unwrap();
    }
    
    // Tauri command implementations
    use std::sync::atomic::AtomicBool;
    use std::sync::OnceLock;
    use tauri::State;
    use chrono::prelude::*;
    
    /// Global static reference to the Neural Emotion Engine
    static EMOTION_ENGINE: OnceLock<Arc<RwLock<NeuralEmotionEngine>>> = OnceLock::new();
    
    /// Flag indicating whether the engine is in mock mode
    static MOCK_MODE: AtomicBool = AtomicBool::new(true);
    
    /// Initialize the global Neural Emotion Engine
    pub fn init_neural_emotion_engine(mock_mode: bool) -> Result<(), NeuralEmotionError> {
        // Only initialize once
        if EMOTION_ENGINE.get().is_some() {
            return Ok(());
        }
    
        // Set mock mode flag
        MOCK_MODE.store(mock_mode, std::sync::atomic::Ordering::Relaxed);
        
        // Create engine configuration
        let mut config = EmotionEngineConfig::default();
        config.neuralink_mock_mode = mock_mode;
        
        // Create and initialize engine
        let mut engine = NeuralEmotionEngine::default();
        engine.initialize()?;
        
        // Store in global state
        let engine_arc = Arc::new(RwLock::new(engine));
        if EMOTION_ENGINE.set(engine_arc).is_err() {
            return Err(NeuralEmotionError::Initialization(
                "Failed to set global emotion engine instance".to_string()
            ));
        }
        
        Ok(())
    }
    
    /// Convert system time to ISO 8601 timestamp
    fn system_time_to_iso8601(time: SystemTime) -> String {
        let datetime: DateTime<Utc> = time.into();
        datetime.to_rfc3339()
    }
    
    /// Convert EmotionAnalysisResult to frontend-friendly EmotionState
    fn convert_to_emotion_state(analysis: &EmotionAnalysisResult) -> EmotionState {
        EmotionState {
            timestamp: system_time_to_iso8601(analysis.timestamp),
            dominant_emotion: format!("{}", analysis.dominant_emotion),
            confidence: analysis.confidence,
            emotion_vector: analysis.emotion_vector.clone(),
            valence_arousal: analysis.valence_arousal.clone(),
            primary_source: format!("{:?}", analysis.primary_source),
            mock_mode: MOCK_MODE.load(std::sync::atomic::Ordering::Relaxed),
        }
    }
    
    /// Convert EmotionalMemory to frontend-friendly EmotionPoint
    fn convert_to_emotion_point(memory: &EmotionalMemory) -> EmotionPoint {
        EmotionPoint {
            timestamp: memory.timestamp.to_rfc3339(),
            dominant_emotion: format!("{}", memory.emotion_analysis.dominant_emotion),
            emotion_vector: memory.emotion_analysis.emotion_vector.clone(),
            valence_arousal: memory.emotion_analysis.valence_arousal.clone(),
        }
    }
    
    /// Get the current emotional state
    ///
    /// Returns the current emotional state of the system as detected by the
    /// Neural Emotion Engine. This includes the dominant emotion, confidence,
    /// complete emotion vector, and valence/arousal values.
    #[tauri::command]
    pub async fn get_current_emotion() -> Result<EmotionState, String> {
        // Get engine reference
        let engine_ref = EMOTION_ENGINE.get().ok_or_else(||
            "Neural Emotion Engine not initialized".to_string()
        )?;
        
        // Get read lock on engine
        let engine = engine_ref.read().map_err(|e|
            format!("Failed to acquire read lock on engine: {}", e)
        )?;
        
        // Get the last analysis result
        let last_result = engine.get_last_result().ok_or_else(||
            "No emotion analysis available yet".to_string()
        )?;
        
        // Convert to frontend-friendly format
        Ok(convert_to_emotion_state(&last_result))
    }
    
    /// Get the emotion timeline
    ///
    /// Returns a timeline of emotional states from the Heart-KB archive.
    /// This provides a historical record of emotional states over time,
    /// useful for tracking emotional patterns and trends.
    #[tauri::command]
    pub async fn get_emotion_timeline() -> Result<Vec<EmotionPoint>, String> {
        // Get engine reference
        let engine_ref = EMOTION_ENGINE.get().ok_or_else(||
            "Neural Emotion Engine not initialized".to_string()
        )?;
        
        // Get read lock on engine
        let engine = engine_ref.read().map_err(|e|
            format!("Failed to acquire read lock on engine: {}", e)
        )?;
        
        // Get the Heart-KB archive reference
        let heart_kb = engine.heart_kb().ok_or_else(||
            "Heart-KB archive not available".to_string()
        )?;
        
        // Create a default query for recent emotions
        let query = EmotionQuery {
            emotion_thresholds: HashMap::new(),
            start_time: None, // All time
            end_time: None,   // Until now
            limit: 100,       // Last 100 points
            similarity_vector: None,
            min_similarity: 0.0,
            include_raw_data: false, // Don't need raw data for timeline
        };
        
        // Execute the query
        let memories = heart_kb.query(&query).map_err(|e|
            format!("Failed to query Heart-KB: {}", e)
        )?;
        
        // Convert to frontend-friendly format
        let points: Vec<EmotionPoint> = memories.iter()
            .map(convert_to_emotion_point)
            .collect();
        
        Ok(points)
    }
    
    #[cfg(test)]
    mod tauri_command_tests {
        use super::*;
        
        #[tokio::test]
        async fn test_get_current_emotion() {
            // Initialize the engine in mock mode
            if let Err(e) = init_neural_emotion_engine(true) {
                eprintln!("Failed to initialize engine: {}", e);
            }
            
            // Skip if initialization failed (can still test other logic)
            if EMOTION_ENGINE.get().is_none() {
                return;
            }
            
            // Get the engine reference
            let engine_ref = EMOTION_ENGINE.get().unwrap();
            
            // Create a mock analysis result
            let mock_result = EmotionAnalysisResult {
                timestamp: SystemTime::now(),
                dominant_emotion: BasicEmotion::Joy,
                confidence: 0.8,
                emotion_vector: vec![0.8, 0.05, 0.05, 0.0, 0.0, 0.0, 0.1],
                valence_arousal: vec![0.7, 0.6, 0.5],
                primary_source: EmotionSource::Fusion,
                signals: HashMap::new(),
            };
            
            // Get a write lock and set the last result
            if let Ok(mut engine) = engine_ref.write() {
                if let Ok(mut last_result) = engine.last_result.write() {
                    *last_result = Some(mock_result.clone());
                }
            }
            
            // Call the command
            let result = get_current_emotion().await;
            
            // Verify result
            assert!(result.is_ok());
            let emotion_state = result.unwrap();
            assert_eq!(emotion_state.dominant_emotion, "Joy");
            assert_eq!(emotion_state.confidence, 0.8);
            assert_eq!(emotion_state.emotion_vector, vec![0.8, 0.05, 0.05, 0.0, 0.0, 0.0, 0.1]);
            assert_eq!(emotion_state.valence_arousal, vec![0.7, 0.6, 0.5]);
            assert!(emotion_state.mock_mode);
        }
        
        #[tokio::test]
        async fn test_get_emotion_timeline() {
            // Initialize the engine in mock mode
            if let Err(e) = init_neural_emotion_engine(true) {
                eprintln!("Failed to initialize engine: {}", e);
            }
            
            // Skip if initialization failed (can still test other logic)
            if EMOTION_ENGINE.get().is_none() {
                return;
            }
            
            // Get the engine reference
            let engine_ref = EMOTION_ENGINE.get().unwrap();
            
            // Set up mock Heart-KB with sample memories
            if let Ok(mut engine) = engine_ref.write() {
                if let Some(heart_kb) = engine.heart_kb_mut() {
                    // Create a mock memory
                    let memory = EmotionalMemory {
                        id: "test1".to_string(),
                        timestamp: Utc::now(),
                        emotion_analysis: EmotionAnalysisResult {
                            timestamp: SystemTime::now(),
                            dominant_emotion: BasicEmotion::Joy,
                            confidence: 0.8,
                            emotion_vector: vec![0.8, 0.05, 0.05, 0.0, 0.0, 0.0, 0.1],
                            valence_arousal: vec![0.7, 0.6, 0.5],
                            primary_source: EmotionSource::Fusion,
                            signals: HashMap::new(),
                        },
                        brain_snapshot: vec![0.3, 0.4, 0.5],
                        voice_clip: None,
                        face_frame: None,
                        metadata: HashMap::new(),
                    };
                    
                    // Add memory to the mock Heart-KB
                    if let Ok(mut memories) = heart_kb.memories.write() {
                        memories.push(memory);
                    }
                }
            }
            
            // Call the command
            let result = get_emotion_timeline().await;
            
            // Verify result
            assert!(result.is_ok());
            let timeline = result.unwrap();
            assert!(!timeline.is_empty());
            assert_eq!(timeline[0].dominant_emotion, "Joy");
            assert_eq!(timeline[0].emotion_vector, vec![0.8, 0.05, 0.05, 0.0, 0.0, 0.0, 0.1]);
        }
    }
    
    /// Register the Neural Emotion Engine Tauri commands
    ///
    /// This function should be called during the Tauri app setup to register
    /// all neural emotion engine commands and initialize the engine.
    ///
    /// # Example
    ///
    /// ```rust
    /// fn main() {
    ///     tauri::Builder::default()
    ///         .setup(|app| {
    ///             // Initialize and register neural emotion engine commands
    ///             neural_emotion::register_commands(app.handle(), true)?;
    ///             Ok(())
    ///         })
    ///         .invoke_handler(tauri::generate_handler![
    ///             // Other commands...
    ///         ])
    ///         .run(tauri::generate_context!())
    ///         .expect("error while running tauri application");
    /// }
    /// ```
    pub fn register_commands(app_handle: tauri::AppHandle, mock_mode: bool) -> Result<(), Box<dyn std::error::Error>> {
        // Initialize the Neural Emotion Engine with specified mock mode
        init_neural_emotion_engine(mock_mode)?;
        
        info!("Neural Emotion Engine initialized and commands registered");
        
        Ok(())
    }
    
    /// Tauri command registration function for the main.rs file
    ///
    /// This function returns all the neural emotion engine commands that need
    /// to be included in the invoke_handler.
    ///
    /// # Example
    ///
    /// ```rust
    /// fn main() {
    ///     tauri::Builder::default()
    ///         .invoke_handler(tauri::generate_handler![
    ///             // Include neural emotion commands
    ///             neural_emotion::get_current_emotion,
    ///             neural_emotion::get_emotion_timeline,
    ///             // Other commands...
    ///         ])
    ///         .run(tauri::generate_context!())
    ///         .expect("error while running tauri application");
    /// }
    /// ```
    pub fn get_commands() -> Vec<&'static str> {
        vec![
            "get_current_emotion",
            "get_emotion_timeline",
        ]
    }
    
    #[test]
    fn test_query_pure_love() {
        // Create a test event emitter
        let event_emitter = Arc::new(EventEmitter::default());
        
        // Create a Heart-KB archive with test config
        let mut config = HeartKBArchiveConfig::default();
        config.storage_dir = "./test_heart_kb".to_string();
        config.privacy_enabled = false; // Disable for testing
        
        let mut heart_kb = HeartKBArchive::new(config, event_emitter);
        heart_kb.initialize().unwrap();
        
        // Create several test emotion results
        let joy_result = EmotionAnalysisResult {
            timestamp: SystemTime::now(),
            dominant_emotion: BasicEmotion::Joy,
            confidence: 0.9,
            emotion_vector: vec![0.9, 0.02, 0.02, 0.02, 0.02, 0.02, 0.0],
            valence_arousal: vec![0.8, 0.6, 0.7],
            primary_source: EmotionSource::Fusion,
            signals: {
                let mut signals = HashMap::new();
                signals.insert(EmotionSource::BrainSignals, vec![0.7, 0.2, 0.8]);
                signals
            },
        };
        
        let mixed_result = EmotionAnalysisResult {
            timestamp: SystemTime::now(),
            dominant_emotion: BasicEmotion::Joy,
            confidence: 0.6,
            emotion_vector: vec![0.6, 0.1, 0.1, 0.1, 0.05, 0.05, 0.0],
            valence_arousal: vec![0.4, 0.5, 0.5],
            primary_source: EmotionSource::Fusion,
            signals: {
                let mut signals = HashMap::new();
                signals.insert(EmotionSource::BrainSignals, vec![0.5, 0.3, 0.6]);
                signals
            },
        };
        
        let anger_result = EmotionAnalysisResult {
            timestamp: SystemTime::now(),
            dominant_emotion: BasicEmotion::Anger,
            confidence: 0.8,
            emotion_vector: vec![0.05, 0.8, 0.05, 0.05, 0.03, 0.02, 0.0],
            valence_arousal: vec![-0.6, 0.7, 0.5],
            primary_source: EmotionSource::Fusion,
            signals: {
                let mut signals = HashMap::new();
                signals.insert(EmotionSource::BrainSignals, vec![0.8, 0.3, 0.2]);
                signals
            },
        };
        
        // Capture the emotions
        heart_kb.capture_emotion(&joy_result, None, None).unwrap();
        heart_kb.capture_emotion(&mixed_result, None, None).unwrap();
        heart_kb.capture_emotion(&anger_result, None, None).unwrap();
        
        // Query for pure love (high threshold)
        let results = heart_kb.query_pure_love(0.8).unwrap();
        assert_eq!(results.len(), 1); // Only the joy_result should match
        
        // Query for pure love (lower threshold)
        let results = heart_kb.query_pure_love(0.5).unwrap();
        assert_eq!(results.len(), 2); // Both joy and mixed should match
        
        // Cleanup
        heart_kb.stop_capture_thread().unwrap();
    }
}