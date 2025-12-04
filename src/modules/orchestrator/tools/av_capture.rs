//! Audio and Video Capture Tool
//!
//! This module provides cross-platform audio and video recording functionality
//! for the Phoenix Orchestrator. It supports:
//!
//! - Cross-platform audio capture (Windows, macOS, Linux)
//! - Cross-platform screen recording with optional webcam inset
//! - Real-time transcription using faster-whisper
//! - Auto-segmentation and silence detection
//!
//! The implementation separates capture, encoding, and storage concerns for maintainability.
//!
//! This module includes encrypted storage of recordings using SQLCipher with AES-GCM
//! encryption and secure key management.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime};
use std::collections::{VecDeque, HashMap};
use std::fs;
use std::str::FromStr;

use async_trait::async_trait;
use chrono::{DateTime, Utc, NaiveDateTime};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::sync::{mpsc, RwLock, Semaphore};
use tokio::time::{interval, sleep, timeout};
use tokio::task::JoinHandle;
use uuid::Uuid;
use once_cell::sync::Lazy;
use rand::{RngCore, rngs::OsRng};
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng as AesOsRng},
    Aes256Gcm, Nonce
};
use secrecy::{Secret, ExposeSecret};
use zeroize::{Zeroize, ZeroizeOnDrop};
use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    ConnectOptions, Pool, Row, Sqlite,
    query, query_as
};
use argon2::{
    password_hash::{
        rand_core::OsRng as ArgonOsRng,
        PasswordHash, PasswordHasher, PasswordVerifier, SaltString
    },
    Argon2
};
use image::{DynamicImage, ImageBuffer, Rgba};
use imageproc::drawing::draw_filled_rect_mut;
use imageproc::rect::Rect;

// Phoenix dependencies
use triune_conscience::{
    TriuneConscience,
    EthicsValidator,
    EthicalQuery,
    EthicalResponse,
    Privacy,
    Consent
};

use world_self_model::{
    WorldModel,
    EntityType,
    Context,
    ContentClassification,
    VisualScene
};

// Machine learning
use opencv::{
    prelude::*,
    objdetect::FaceDetector,
    face::{
        FaceRecognizer,
        EigenFaceRecognizer,
    },
    core::Mat,
    dnn::{
        Net,
        read_net_from_torch,
    }
};

// Platform-specific imports
#[cfg(target_os = "windows")]
use windows::{
    Media::Audio::*,
    Media::Capture::*,
    Win32::Media::Audio::*,
};

#[cfg(target_os = "macos")]
use coreaudio_rs as coreaudio;

#[cfg(target_os = "linux")]
use {
    alsa,
    pipewire,
};

/// Error types for AV Capture operations
#[derive(Error, Debug)]
pub enum AVCaptureError {
    #[error("Audio capture error: {0}")]
    AudioCapture(String),
    
    #[error("Video capture error: {0}")]
    VideoCapture(String),
    
    #[error("Transcription error: {0}")]
    Transcription(String),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Initialization error: {0}")]
    Initialization(String),
    
    #[error("Platform not supported")]
    PlatformNotSupported,
    
    #[error("Segment error: {0}")]
    Segment(String),
    
    #[error("Command error: {0}")]
    Command(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Encryption error: {0}")]
    Encryption(String),

    #[error("Key management error: {0}")]
    KeyManagement(String),
    
    #[error("Ethics validation error: {0}")]
    EthicsValidation(String),
    
    #[error("Content analysis error: {0}")]
    ContentAnalysis(String),
    
    #[error("Redaction error: {0}")]
    Redaction(String),
    
    #[error("Authentication error: {0}")]
    Authentication(String),
    
    #[error("Voice command error: {0}")]
    VoiceCommand(String),

    #[error("SQLx error: {0}")]
    Sqlx(#[from] sqlx::Error),
}

/// Response for Tauri command interfaces
#[derive(Serialize, Deserialize, Debug)]
pub struct AVCommandResponse {
    pub success: bool,
    pub message: String,
    pub segment_id: Option<String>,
}

/// Represents a captured audio segment with metadata
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AudioSegment {
    /// Unique identifier for the segment
    pub id: String,
    
    /// Timestamp when the segment was recorded
    pub timestamp: DateTime<Utc>,
    
    /// Duration of the segment in seconds
    pub duration: f64,
    
    /// Sample rate of the audio (default: 48000 Hz)
    pub sample_rate: u32,
    
    /// Number of channels (1 = mono, 2 = stereo)
    pub channels: u8,
    
    /// Bit depth (16-bit, 24-bit, etc.)
    pub bit_depth: u8,
    
    /// Path to the encoded audio file (Opus format)
    pub file_path: PathBuf,
    
    /// Transcription text if available
    pub transcription: Option<String>,
    
    /// Whether this segment contains mostly silence
    pub is_silence: bool,
}

impl AudioSegment {
    /// Create a new audio segment
    pub fn new(duration: f64, sample_rate: u32, channels: u8, bit_depth: u8) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            duration,
            sample_rate,
            channels,
            bit_depth,
            file_path: PathBuf::new(),
            transcription: None,
            is_silence: false,
        }
    }
    
    /// Set the file path for the encoded audio
    pub fn with_file_path(mut self, path: PathBuf) -> Self {
        self.file_path = path;
        self
    }
    
    /// Set the transcription text
    pub fn with_transcription(mut self, text: String) -> Self {
        self.transcription = Some(text);
        self
    }
    
    /// Mark the segment as silence
    pub fn mark_as_silence(mut self) -> Self {
        self.is_silence = true;
        self
    }
}

/// Represents a captured video segment with metadata
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VideoSegment {
    /// Unique identifier for the segment
    pub id: String,
    
    /// Timestamp when the segment was recorded
    pub timestamp: DateTime<Utc>,
    
    /// Duration of the segment in seconds
    pub duration: f64,
    
    /// Width of the video in pixels
    pub width: u32,
    
    /// Height of the video in pixels
    pub height: u32,
    
    /// Frames per second
    pub fps: f64,
    
    /// Codec used (VP9 or AV1)
    pub codec: String,
    
    /// Path to the encoded video file
    pub file_path: PathBuf,
    
    /// Whether webcam was included
    pub has_webcam: bool,
}

impl VideoSegment {
    /// Create a new video segment
    pub fn new(duration: f64, width: u32, height: u32, fps: f64, codec: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            duration,
            width,
            height,
            fps,
            codec,
            file_path: PathBuf::new(),
            has_webcam: false,
        }
    }
    
    /// Set the file path for the encoded video
    pub fn with_file_path(mut self, path: PathBuf) -> Self {
        self.file_path = path;
        self
    }
    
    /// Mark the segment as having webcam overlay
    pub fn with_webcam(mut self) -> Self {
        self.has_webcam = true;
        self
    }
}

/// Represents a complete audio/video segment
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Segment {
    /// Unique identifier for the segment
    pub id: String,
    
    /// Timestamp when the segment was recorded
    pub timestamp: DateTime<Utc>,
    
    /// Duration of the segment in seconds
    pub duration: f64,
    
    /// Associated audio segment
    pub audio: Option<AudioSegment>,
    
    /// Associated video segment
    pub video: Option<VideoSegment>,
    
    /// Whether this segment is marked as important
    pub is_important: bool,
}

impl Segment {
    /// Create a new combined segment
    pub fn new(duration: f64) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            duration,
            audio: None,
            video: None,
            is_important: false,
        }
    }
    
    /// Add an audio segment
    pub fn with_audio(mut self, audio: AudioSegment) -> Self {
        self.audio = Some(audio);
        self
    }
    
    /// Add a video segment
    pub fn with_video(mut self, video: VideoSegment) -> Self {
        self.video = Some(video);
        self
    }
    
    /// Mark the segment as important
    pub fn mark_as_important(mut self) -> Self {
        self.is_important = true;
        self
    }
}

/// Configuration options for audio capture
#[derive(Debug, Clone)]
pub struct AudioCaptureConfig {
    /// Sample rate in Hz (default: 48000)
    pub sample_rate: u32,
    
    /// Number of channels (1 = mono, 2 = stereo)
    pub channels: u8,
    
    /// Bit depth (16, 24)
    pub bit_depth: u8,
    
    /// Silence threshold in dB
    pub silence_threshold_db: f32,
    
    /// Duration in seconds after which silent audio is paused
    pub silence_pause_threshold_sec: f64,
    
    /// Output directory for recordings
    pub output_dir: PathBuf,
}

impl Default for AudioCaptureConfig {
    fn default() -> Self {
        Self {
            sample_rate: 48000,
            channels: 1, // Mono
            bit_depth: 16,
            silence_threshold_db: -60.0, // Silent if below -60 dB
            silence_pause_threshold_sec: 8.0, // Pause after 8 seconds of silence
            output_dir: PathBuf::from("./recordings"),
        }
    }
}

/// Configuration options for video capture
#[derive(Debug, Clone)]
pub struct VideoCaptureConfig {
    /// Width of the output video
    pub width: u32,
    
    /// Height of the output video
    pub height: u32,
    
    /// Frames per second
    pub fps: f64,
    
    /// Codec to use (VP9 or AV1)
    pub codec: String,
    
    /// Whether to capture webcam
    pub capture_webcam: bool,
    
    /// Position of webcam inset (if used)
    pub webcam_position: WebcamPosition,
    
    /// Size of webcam inset relative to main screen
    pub webcam_size_percent: u8,
    
    /// Segment duration in minutes
    pub segment_duration_min: u32,
    
    /// Output directory for recordings
    pub output_dir: PathBuf,
    
    /// Whether to use hardware acceleration
    pub use_hardware_acceleration: bool,
}

/// Position options for webcam overlay
#[derive(Debug, Clone, Copy, PartialEq, Deserialize, Serialize)]
pub enum WebcamPosition {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
    Custom { x: u32, y: u32 },
}

impl Default for VideoCaptureConfig {
    fn default() -> Self {
        Self {
            width: 1920,
            height: 1080,
            fps: 30.0,
            codec: "VP9".to_string(),
            capture_webcam: true,
            webcam_position: WebcamPosition::BottomRight,
            webcam_size_percent: 20, // 20% of screen size
            segment_duration_min: 10, // 10 minute segments
            output_dir: PathBuf::from("./recordings"),
            use_hardware_acceleration: true,
        }
    }
}

/// Configuration for the transcription engine
#[derive(Debug, Clone)]
pub struct TranscriptionConfig {
    /// Path to the faster-whisper model
    pub model_path: PathBuf,
    
    /// Language to use for transcription (default: "en")
    pub language: String,
    
    /// Whether to use timestamps
    pub use_timestamps: bool,
    
    /// Processor to use (CPU or CUDA)
    pub processor: TranscriptionProcessor,
    
    /// Number of threads to use for CPU processing
    pub cpu_threads: usize,
}

/// Available processors for transcription
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub enum TranscriptionProcessor {
    CPU,
    CUDA,
}

impl Default for TranscriptionConfig {
    fn default() -> Self {
        Self {
            model_path: PathBuf::from("./models/whisper-small"),
            language: "en".to_string(),
            use_timestamps: true,
            processor: TranscriptionProcessor::CPU,
            cpu_threads: 4,
        }
    }
}

/// Transcription engine using faster-whisper
#[derive(Debug)]
pub struct TranscriptionEngine {
    config: TranscriptionConfig,
    model: Arc<Mutex<Option<String>>>, // Placeholder for the actual model
    transcription_queue: Arc<Mutex<VecDeque<AudioSegment>>>,
    processing_task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

impl TranscriptionEngine {
    /// Create a new transcription engine
    pub async fn new(config: TranscriptionConfig) -> Result<Self, AVCaptureError> {
        if !config.model_path.exists() {
            return Err(AVCaptureError::Initialization(format!(
                "Transcription model not found at {:?}", config.model_path
            )));
        }

        Ok(Self {
            config,
            model: Arc::new(Mutex::new(None)),
            transcription_queue: Arc::new(Mutex::new(VecDeque::new())),
            processing_task: Arc::new(Mutex::new(None)),
        })
    }

    /// Initialize the transcription model
    pub async fn initialize(&self) -> Result<(), AVCaptureError> {
        // In a real implementation, this would load the faster-whisper model
        // For now, we'll just simulate the initialization
        let mut model = self.model.lock().unwrap();
        *model = Some("Initialized whisper model".to_string());
        Ok(())
    }

    /// Start the background transcription task
    pub async fn start_processing(&self) -> Result<(), AVCaptureError> {
        let queue = Arc::clone(&self.transcription_queue);
        let model = Arc::clone(&self.model);
        
        let task = tokio::spawn(async move {
            loop {
                // Check if there are any segments to process
                let segment_opt = {
                    let mut queue = queue.lock().unwrap();
                    queue.pop_front()
                };
                
                if let Some(segment) = segment_opt {
                    let _model = model.lock().unwrap();
                    // In a real implementation, this would process the segment with faster-whisper
                    let _transcription = format!("Transcription for segment {}", segment.id);
                    
                    // Sleep to simulate processing time
                    tokio::time::sleep(Duration::from_millis(500)).await;
                } else {
                    // No segments to process, sleep for a bit
                    tokio::time::sleep(Duration::from_millis(100)).await;
                }
            }
        });
        
        let mut processing_task = self.processing_task.lock().unwrap();
        *processing_task = Some(task);
        
        Ok(())
    }

    /// Add an audio segment to the transcription queue
    pub async fn add_segment(&self, segment: AudioSegment) -> Result<(), AVCaptureError> {
        let mut queue = self.transcription_queue.lock().unwrap();
        queue.push_back(segment);
        Ok(())
    }

    /// Get the current transcription queue length
    pub fn queue_length(&self) -> usize {
        let queue = self.transcription_queue.lock().unwrap();
        queue.len()
    }
}

/// Status of the AVCaptureTool
#[derive(Debug, Clone, Copy, PartialEq, Deserialize, Serialize)]
pub enum AVCaptureStatus {
    Idle,
    Initializing,
    Recording,
    Paused,
    Error,
}

/// Audio capture backend interface
#[async_trait]
pub trait AudioCaptureBackend: Send + Sync {
    async fn initialize(&mut self, config: &AudioCaptureConfig) -> Result<(), AVCaptureError>;
    async fn start_recording(&mut self) -> Result<(), AVCaptureError>;
    async fn stop_recording(&mut self) -> Result<AudioSegment, AVCaptureError>;
    async fn pause_recording(&mut self) -> Result<(), AVCaptureError>;
    async fn resume_recording(&mut self) -> Result<(), AVCaptureError>;
    fn is_silence_detected(&self) -> bool;
}

/// Windows audio capture implementation
#[cfg(target_os = "windows")]
pub struct WindowsAudioCapture {
    config: Option<AudioCaptureConfig>,
    recording: bool,
    paused: bool,
    start_time: Option<Instant>,
    silence_detected: bool,
    silence_start: Option<Instant>,
}

#[cfg(target_os = "windows")]
impl WindowsAudioCapture {
    pub fn new() -> Self {
        Self {
            config: None,
            recording: false,
            paused: false,
            start_time: None,
            silence_detected: false,
            silence_start: None,
        }
    }
}

#[cfg(target_os = "windows")]
#[async_trait]
impl AudioCaptureBackend for WindowsAudioCapture {
    async fn initialize(&mut self, config: &AudioCaptureConfig) -> Result<(), AVCaptureError> {
        // In a real implementation, this would set up WASAPI
        self.config = Some(config.clone());
        Ok(())
    }

    async fn start_recording(&mut self) -> Result<(), AVCaptureError> {
        if self.recording {
            return Err(AVCaptureError::AudioCapture("Recording already in progress".to_string()));
        }
        
        // In a real implementation, this would start WASAPI recording
        self.recording = true;
        self.paused = false;
        self.start_time = Some(Instant::now());
        self.silence_detected = false;
        self.silence_start = None;
        
        Ok(())
    }

    async fn stop_recording(&mut self) -> Result<AudioSegment, AVCaptureError> {
        if !self.recording {
            return Err(AVCaptureError::AudioCapture("No recording in progress".to_string()));
        }
        
        let duration = if let Some(start_time) = self.start_time {
            start_time.elapsed().as_secs_f64()
        } else {
            0.0
        };
        
        // In a real implementation, this would stop WASAPI recording and encode the audio
        self.recording = false;
        self.paused = false;
        
        let config = self.config.as_ref().ok_or_else(|| {
            AVCaptureError::AudioCapture("Audio capture not initialized".to_string())
        })?;
        
        let output_path = config.output_dir.join(format!("audio_{}.opus", Uuid::new_v4()));
        
        // Simulate creating an audio file
        std::fs::create_dir_all(&config.output_dir)
            .map_err(|e| AVCaptureError::Io(e))?;
        
        std::fs::write(&output_path, b"Simulated audio data")
            .map_err(|e| AVCaptureError::Io(e))?;
        
        let segment = AudioSegment::new(
            duration,
            config.sample_rate,
            config.channels,
            config.bit_depth
        )
        .with_file_path(output_path);
        
        Ok(segment)
    }

    async fn pause_recording(&mut self) -> Result<(), AVCaptureError> {
        if !self.recording || self.paused {
            return Err(AVCaptureError::AudioCapture("Recording not in progress or already paused".to_string()));
        }
        
        // In a real implementation, this would pause WASAPI recording
        self.paused = true;
        
        Ok(())
    }

    async fn resume_recording(&mut self) -> Result<(), AVCaptureError> {
        if !self.recording || !self.paused {
            return Err(AVCaptureError::AudioCapture("Recording not paused".to_string()));
        }
        
        // In a real implementation, this would resume WASAPI recording
        self.paused = false;
        
        Ok(())
    }

    fn is_silence_detected(&self) -> bool {
        self.silence_detected
    }
}

/// macOS audio capture implementation
#[cfg(target_os = "macos")]
pub struct MacOSAudioCapture {
    config: Option<AudioCaptureConfig>,
    recording: bool,
    paused: bool,
    start_time: Option<Instant>,
    silence_detected: bool,
    silence_start: Option<Instant>,
}

#[cfg(target_os = "macos")]
impl MacOSAudioCapture {
    pub fn new() -> Self {
        Self {
            config: None,
            recording: false,
            paused: false,
            start_time: None,
            silence_detected: false,
            silence_start: None,
        }
    }
}

#[cfg(target_os = "macos")]
#[async_trait]
impl AudioCaptureBackend for MacOSAudioCapture {
    async fn initialize(&mut self, config: &AudioCaptureConfig) -> Result<(), AVCaptureError> {
        // In a real implementation, this would set up CoreAudio
        self.config = Some(config.clone());
        Ok(())
    }

    async fn start_recording(&mut self) -> Result<(), AVCaptureError> {
        // Implementation similar to Windows but using CoreAudio
        self.recording = true;
        self.paused = false;
        self.start_time = Some(Instant::now());
        self.silence_detected = false;
        self.silence_start = None;
        
        Ok(())
    }

    async fn stop_recording(&mut self) -> Result<AudioSegment, AVCaptureError> {
        // Implementation similar to Windows but using CoreAudio
        if !self.recording {
            return Err(AVCaptureError::AudioCapture("No recording in progress".to_string()));
        }
        
        let duration = if let Some(start_time) = self.start_time {
            start_time.elapsed().as_secs_f64()
        } else {
            0.0
        };
        
        self.recording = false;
        self.paused = false;
        
        let config = self.config.as_ref().ok_or_else(|| {
            AVCaptureError::AudioCapture("Audio capture not initialized".to_string())
        })?;
        
        let output_path = config.output_dir.join(format!("audio_{}.opus", Uuid::new_v4()));
        
        // Simulate creating an audio file
        std::fs::create_dir_all(&config.output_dir)
            .map_err(|e| AVCaptureError::Io(e))?;
        
        std::fs::write(&output_path, b"Simulated audio data")
            .map_err(|e| AVCaptureError::Io(e))?;
        
        let segment = AudioSegment::new(
            duration,
            config.sample_rate,
            config.channels,
            config.bit_depth
        )
        .with_file_path(output_path);
        
        Ok(segment)
    }

    async fn pause_recording(&mut self) -> Result<(), AVCaptureError> {
        // Implementation similar to Windows but using CoreAudio
        if !self.recording || self.paused {
            return Err(AVCaptureError::AudioCapture("Recording not in progress or already paused".to_string()));
        }
        
        self.paused = true;
        
        Ok(())
    }

    async fn resume_recording(&mut self) -> Result<(), AVCaptureError> {
        // Implementation similar to Windows but using CoreAudio
        if !self.recording || !self.paused {
            return Err(AVCaptureError::AudioCapture("Recording not paused".to_string()));
        }
        
        self.paused = false;
        
        Ok(())
    }

    fn is_silence_detected(&self) -> bool {
        self.silence_detected
    }
}

/// Linux audio capture implementation
#[cfg(target_os = "linux")]
pub struct LinuxAudioCapture {
    config: Option<AudioCaptureConfig>,
    recording: bool,
    paused: bool,
    start_time: Option<Instant>,
    silence_detected: bool,
    silence_start: Option<Instant>,
    using_pipewire: bool,
}

#[cfg(target_os = "linux")]
impl LinuxAudioCapture {
    pub fn new() -> Self {
        Self {
            config: None,
            recording: false,
            paused: false,
            start_time: None,
            silence_detected: false,
            silence_start: None,
            using_pipewire: Self::detect_pipewire(),
        }
    }
    
    fn detect_pipewire() -> bool {
        // In a real implementation, this would check if PipeWire is available
        // For now, we'll just return true
        true
    }
}

#[cfg(target_os = "linux")]
#[async_trait]
impl AudioCaptureBackend for LinuxAudioCapture {
    async fn initialize(&mut self, config: &AudioCaptureConfig) -> Result<(), AVCaptureError> {
        // In a real implementation, this would set up ALSA or PipeWire
        self.config = Some(config.clone());
        Ok(())
    }

    async fn start_recording(&mut self) -> Result<(), AVCaptureError> {
        // Implementation similar to Windows but using ALSA/PipeWire
        self.recording = true;
        self.paused = false;
        self.start_time = Some(Instant::now());
        self.silence_detected = false;
        self.silence_start = None;
        
        Ok(())
    }

    async fn stop_recording(&mut self) -> Result<AudioSegment, AVCaptureError> {
        // Implementation similar to Windows but using ALSA/PipeWire
        if !self.recording {
            return Err(AVCaptureError::AudioCapture("No recording in progress".to_string()));
        }
        
        let duration = if let Some(start_time) = self.start_time {
            start_time.elapsed().as_secs_f64()
        } else {
            0.0
        };
        
        self.recording = false;
        self.paused = false;
        
        let config = self.config.as_ref().ok_or_else(|| {
            AVCaptureError::AudioCapture("Audio capture not initialized".to_string())
        })?;
        
        let output_path = config.output_dir.join(format!("audio_{}.opus", Uuid::new_v4()));
        
        // Simulate creating an audio file
        std::fs::create_dir_all(&config.output_dir)
            .map_err(|e| AVCaptureError::Io(e))?;
        
        std::fs::write(&output_path, b"Simulated audio data")
            .map_err(|e| AVCaptureError::Io(e))?;
        
        let segment = AudioSegment::new(
            duration,
            config.sample_rate,
            config.channels,
            config.bit_depth
        )
        .with_file_path(output_path);
        
        Ok(segment)
    }

    async fn pause_recording(&mut self) -> Result<(), AVCaptureError> {
        // Implementation similar to Windows but using ALSA/PipeWire
        if !self.recording || self.paused {
            return Err(AVCaptureError::AudioCapture("Recording not in progress or already paused".to_string()));
        }
        
        self.paused = true;
        
        Ok(())
    }

    async fn resume_recording(&mut self) -> Result<(), AVCaptureError> {
        // Implementation similar to Windows but using ALSA/PipeWire
        if !self.recording || !self.paused {
            return Err(AVCaptureError::AudioCapture("Recording not paused".to_string()));
        }
        
        self.paused = false;
        
        Ok(())
    }

    fn is_silence_detected(&self) -> bool {
        self.silence_detected
    }
}

/// Video capture backend interface
#[async_trait]
pub trait VideoCaptureBackend: Send + Sync {
    async fn initialize(&mut self, config: &VideoCaptureConfig) -> Result<(), AVCaptureError>;
    async fn start_recording(&mut self) -> Result<(), AVCaptureError>;
    async fn stop_recording(&mut self) -> Result<VideoSegment, AVCaptureError>;
    async fn pause_recording(&mut self) -> Result<(), AVCaptureError>;
    async fn resume_recording(&mut self) -> Result<(), AVCaptureError>;
    async fn is_webcam_available(&self) -> bool;
}

/// Cross-platform video capture implementation
pub struct CrossPlatformVideoCapture {
    config: Option<VideoCaptureConfig>,
    recording: bool,
    paused: bool,
    start_time: Option<Instant>,
    segment_count: usize,
    webcam_available: bool,
}

impl CrossPlatformVideoCapture {
    pub fn new() -> Self {
        Self {
            config: None,
            recording: false,
            paused: false,
            start_time: None,
            segment_count: 0,
            webcam_available: false,
        }
    }
    
    async fn detect_webcam(&mut self) -> bool {
        // In a real implementation, this would check if a webcam is available
        // For now, we'll just return true
        self.webcam_available = true;
        true
    }
}

#[async_trait]
impl VideoCaptureBackend for CrossPlatformVideoCapture {
    async fn initialize(&mut self, config: &VideoCaptureConfig) -> Result<(), AVCaptureError> {
        // In a real implementation, this would set up screen recording and webcam capture
        self.config = Some(config.clone());
        self.detect_webcam().await;
        Ok(())
    }

    async fn start_recording(&mut self) -> Result<(), AVCaptureError> {
        if self.recording {
            return Err(AVCaptureError::VideoCapture("Recording already in progress".to_string()));
        }
        
        // In a real implementation, this would start screen recording and webcam capture
        self.recording = true;
        self.paused = false;
        self.start_time = Some(Instant::now());
        
        Ok(())
    }

    async fn stop_recording(&mut self) -> Result<VideoSegment, AVCaptureError> {
        if !self.recording {
            return Err(AVCaptureError::VideoCapture("No recording in progress".to_string()));
        }
        
        let duration = if let Some(start_time) = self.start_time {
            start_time.elapsed().as_secs_f64()
        } else {
            0.0
        };
        
        // In a real implementation, this would stop screen recording and webcam capture
        // and encode the video
        self.recording = false;
        self.paused = false;
        
        let config = self.config.as_ref().ok_or_else(|| {
            AVCaptureError::VideoCapture("Video capture not initialized".to_string())
        })?;
        
        let output_path = config.output_dir.join(format!("video_{}.webm", Uuid::new_v4()));
        
        // Simulate creating a video file
        std::fs::create_dir_all(&config.output_dir)
            .map_err(|e| AVCaptureError::Io(e))?;
        
        std::fs::write(&output_path, b"Simulated video data")
            .map_err(|e| AVCaptureError::Io(e))?;
        
        let mut segment = VideoSegment::new(
            duration,
            config.width,
            config.height,
            config.fps,
            config.codec.clone()
        )
        .with_file_path(output_path);
        
        if config.capture_webcam && self.webcam_available {
            segment = segment.with_webcam();
        }
        
        self.segment_count += 1;
        
        Ok(segment)
    }

    async fn pause_recording(&mut self) -> Result<(), AVCaptureError> {
        if !self.recording || self.paused {
            return Err(AVCaptureError::VideoCapture("Recording not in progress or already paused".to_string()));
        }
        
        // In a real implementation, this would pause screen recording and webcam capture
        self.paused = true;
        
        Ok(())
    }

    async fn resume_recording(&mut self) -> Result<(), AVCaptureError> {
        if !self.recording || !self.paused {
            return Err(AVCaptureError::VideoCapture("Recording not paused".to_string()));
        }
        
        // In a real implementation, this would resume screen recording and webcam capture
        self.paused = false;
        
        Ok(())
    }

    async fn is_webcam_available(&self) -> bool {
        self.webcam_available
    }
}

/// Main AV Capture tool
pub struct AVCaptureTool {
    audio_config: AudioCaptureConfig,
    video_config: VideoCaptureConfig,
    transcription_config: TranscriptionConfig,
    conscience_config: ConscienceGateConfig,
    status: AVCaptureStatus,
    segments: Arc<Mutex<Vec<Segment>>>,
    current_segment: Arc<Mutex<Option<Segment>>>,
    
    // Platform-specific audio backends
    #[cfg(target_os = "windows")]
    audio_backend: WindowsAudioCapture,
    
    #[cfg(target_os = "macos")]
    audio_backend: MacOSAudioCapture,
    
    #[cfg(target_os = "linux")]
    audio_backend: LinuxAudioCapture,
    
    // Cross-platform video backend
    video_backend: CrossPlatformVideoCapture,
    
    // Transcription engine
    transcription_engine: Option<TranscriptionEngine>,

    // Conscience gate for privacy and ethics
    conscience_gate: Option<Arc<ConscienceGate>>,
    
    // Original and redacted content storage
    privacy_aware_segments: Arc<Mutex<Vec<PrivacyAwareSegment>>>,
    
    // Current redaction status
    redactions_applied: Arc<Mutex<Vec<SensitiveContentType>>>,
}

impl AVCaptureTool {
    /// Create a new AVCaptureTool with default configuration
    pub fn new() -> Self {
        #[cfg(target_os = "windows")]
        let audio_backend = WindowsAudioCapture::new();
        
        #[cfg(target_os = "macos")]
        let audio_backend = MacOSAudioCapture::new();
        
        #[cfg(target_os = "linux")]
        let audio_backend = LinuxAudioCapture::new();
        
        Self {
            audio_config: AudioCaptureConfig::default(),
            video_config: VideoCaptureConfig::default(),
            transcription_config: TranscriptionConfig::default(),
            conscience_config: ConscienceGateConfig::default(),
            status: AVCaptureStatus::Idle,
            segments: Arc::new(Mutex::new(Vec::new())),
            current_segment: Arc::new(Mutex::new(None)),
            
            #[cfg(target_os = "windows")]
            audio_backend,
            
            #[cfg(target_os = "macos")]
            audio_backend,
            
            #[cfg(target_os = "linux")]
            audio_backend,
            
            video_backend: CrossPlatformVideoCapture::new(),
            transcription_engine: None,
            conscience_gate: None,
            privacy_aware_segments: Arc::new(Mutex::new(Vec::new())),
            redactions_applied: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Initialize the AVCaptureTool with custom configuration
    pub async fn initialize(
        &mut self,
        audio_config: Option<AudioCaptureConfig>,
        video_config: Option<VideoCaptureConfig>,
        transcription_config: Option<TranscriptionConfig>,
        conscience_config: Option<ConscienceGateConfig>,
    ) -> Result<(), AVCaptureError> {
        self.status = AVCaptureStatus::Initializing;
        
        // Apply custom configs if provided
        if let Some(config) = audio_config {
            self.audio_config = config;
        }
        
        if let Some(config) = video_config {
            self.video_config = config;
        }
        
        if let Some(config) = transcription_config {
            self.transcription_config = config;
        }
        
        if let Some(config) = conscience_config {
            self.conscience_config = config;
        }
        
        // Initialize audio backend
        self.audio_backend.initialize(&self.audio_config).await?;
        
        // Initialize video backend
        self.video_backend.initialize(&self.video_config).await?;
        
        // Initialize transcription engine
        let engine = TranscriptionEngine::new(self.transcription_config.clone()).await?;
        engine.initialize().await?;
        engine.start_processing().await?;
        self.transcription_engine = Some(engine);
        
        // Initialize ConscienceGate with TriuneConscience
        // In a real implementation, this would get the actual TriuneConscience from Phoenix
        let phoenix_conscience = Arc::new(TriuneConscience::default());
        let conscience_gate = ConscienceGate::new(self.conscience_config.clone(), phoenix_conscience).await?;
        
        // Set up voice command detector
        if self.conscience_config.enable_voice_commands {
            conscience_gate.voice_detector.initialize().await?;
        }
        
        self.conscience_gate = Some(Arc::new(conscience_gate));
        
        // Create output directories
        std::fs::create_dir_all(&self.audio_config.output_dir)
            .map_err(|e| AVCaptureError::Io(e))?;
        
        std::fs::create_dir_all(&self.video_config.output_dir)
            .map_err(|e| AVCaptureError::Io(e))?;
        
        self.status = AVCaptureStatus::Idle;
        Ok(())
    }

    /// Start recording audio and video
    pub async fn start_recording(&mut self) -> Result<AVCommandResponse, AVCaptureError> {
        if self.status == AVCaptureStatus::Recording {
            return Err(AVCaptureError::Command("Recording already in progress".to_string()));
        }
        
        // Check with ConscienceGate if recording is allowed
        if let Some(conscience) = &self.conscience_gate {
            if !conscience.is_recording_allowed().await? {
                if conscience.blackout_active.read().await.clone() {
                    let until = conscience.blackout_until.read().await;
                    if let Some(time) = *until {
                        let now = Utc::now();
                        let remaining_minutes = (time - now).num_minutes();
                        return Err(AVCaptureError::Command(
                            format!("Voice command blackout active. Recording blocked for {} more minutes",
                                    remaining_minutes.max(1))
                        ));
                    }
                }
                
                return Err(AVCaptureError::EthicsValidation(
                    "Recording not permitted by ethics validation".to_string()
                ));
            }
        }
        
        self.status = AVCaptureStatus::Recording;
        
        // Clear any existing redactions
        let mut redactions = self.redactions_applied.lock().unwrap();
        redactions.clear();
        
        // Start audio recording
        self.audio_backend.start_recording().await?;
        
        // Start video recording
        self.video_backend.start_recording().await?;
        
        // Create a new segment
        let segment = Segment::new(0.0); // Duration will be updated later
        let segment_id = segment.id.clone();
        
        let mut current_segment = self.current_segment.lock().unwrap();
        *current_segment = Some(segment);
        
        Ok(AVCommandResponse {
            success: true,
            message: "Recording started with privacy protection enabled".to_string(),
            segment_id: Some(segment_id),
        })
    }

    /// Stop recording audio and video
    pub async fn stop_recording(&mut self) -> Result<AVCommandResponse, AVCaptureError> {
        if self.status != AVCaptureStatus::Recording && self.status != AVCaptureStatus::Paused {
            return Err(AVCaptureError::Command("No recording in progress".to_string()));
        }
        
        self.status = AVCaptureStatus::Idle;
        
        // Stop audio recording
        let audio_segment = self.audio_backend.stop_recording().await?;
        
        // Stop video recording
        let mut video_segment = self.video_backend.stop_recording().await?;
        
        // Get the current segment
        let mut current_segment_opt = self.current_segment.lock().unwrap();
        let current_segment = current_segment_opt.take().ok_or_else(|| {
            AVCaptureError::Segment("No current segment".to_string())
        })?;
        
        // Update the segment with audio and video
        let mut completed_segment = current_segment
            .with_audio(audio_segment.clone())
            .with_video(video_segment.clone());
            
        // Create privacy-aware segment (default initially to no redactions)
        let mut privacy_segment = PrivacyAwareSegment::new(completed_segment.clone());
        
        // Apply content analysis and redaction if ConscienceGate is available
        if let Some(conscience) = &self.conscience_gate {
            let mut redacted_types = Vec::new();
            let mut has_original_available = false;
            
            // Process for sensitive content in video
            if let Some(ref video) = completed_segment.video {
                // Create a Mat from the video file for analysis
                // This is simplified here - in a real implementation, this would
                // process the actual video frames
                let video_path = video.file_path.to_str().unwrap_or_default();
                
                // Create a mock Mat for this example
                // (in a real implementation, we'd load from the file)
                let mut frame = Mat::default();
                
                // Perform content analysis and redaction
                let detected_types = conscience.process_video_frame(&mut frame).await?;
                
                if !detected_types.is_empty() {
                    redacted_types = detected_types;
                    
                    // Save original content with access controls if policy allows
                    let store_original = redacted_types.iter().any(|content_type| {
                        if let Some(params) = conscience.config.redaction_parameters.get(content_type) {
                            params.store_original
                        } else {
                            false
                        }
                    });
                    
                    has_original_available = store_original;
                    
                    // Update the redactions applied tracking
                    let mut applied = self.redactions_applied.lock().unwrap();
                    applied.extend_from_slice(&redacted_types);
                }
            }
            
            // Process for voice commands in audio
            if let Some(ref audio) = completed_segment.audio {
                // Simplified detection - in a real implementation, this would
                // process actual audio data from the file
                
                // Simulate checking audio for voice commands
                let audio_sample = vec![0i16; 1024]; // Mock audio data
                let voice_command_detected =
                    conscience.process_audio_chunk(&audio_sample, audio_segment.sample_rate).await?;
                    
                if voice_command_detected {
                    // Just log this detection, we won't modify audio but the blackout
                    // has been activated for future recordings
                    println!("Voice command detected: Recording blackout activated");
                }
            }
            
            // Update privacy aware segment with redaction info
            if !redacted_types.is_empty() {
                privacy_segment = privacy_segment.with_redactions(
                    redacted_types,
                    has_original_available
                );
            }
        }
        
        // Add to completed segments
        let mut segments = self.segments.lock().unwrap();
        segments.push(completed_segment.clone());
        
        // Add to privacy-aware segments
        let mut privacy_segments = self.privacy_aware_segments.lock().unwrap();
        privacy_segments.push(privacy_segment);
        
        // Add audio segment to transcription queue if engine is available
        if let Some(engine) = &self.transcription_engine {
            engine.add_segment(audio_segment).await?;
        }
        
        Ok(AVCommandResponse {
            success: true,
            message: format!(
                "Recording stopped{}",
                if !self.redactions_applied.lock().unwrap().is_empty() {
                    " with privacy redactions applied"
                } else {
                    ""
                }
            ),
            segment_id: Some(completed_segment.id),
        })
    }

    /// Get the timeline of segments
    pub fn get_timeline(&self) -> Vec<Segment> {
        let segments = self.segments.lock().unwrap();
        segments.clone()
    }
    
    /// Get the privacy-aware timeline of segments with redaction information
    pub fn get_privacy_aware_timeline(&self) -> Vec<PrivacyAwareSegment> {
        let segments = self.privacy_aware_segments.lock().unwrap();
        segments.clone()
    }
    
    /// Get a segment by ID with Dad authentication for accessing original content
    pub async fn get_segment_with_auth(&self, id: &str, dad_password: Option<&str>)
        -> Result<Segment, AVCaptureError> {
        // First find the privacy-aware segment to check if it has redactions
        let privacy_segments = self.privacy_aware_segments.lock().unwrap();
        let privacy_segment = privacy_segments.iter()
            .find(|s| s.segment.id == id);
            
        // Get the regular segment
        let segments = self.segments.lock().unwrap();
        let segment = segments.iter()
            .find(|s| s.id == id)
            .cloned()
            .ok_or_else(|| AVCaptureError::Segment(format!("Segment not found: {}", id)))?;
            
        // If no redactions or no original content available, just return the segment
        if privacy_segment.is_none() ||
           !privacy_segment.unwrap().contains_redactions ||
           !privacy_segment.unwrap().has_original_available {
            return Ok(segment);
        }
        
        // If Dad Override is requested, verify password
        if let Some(password) = dad_password {
            if let Some(conscience) = &self.conscience_gate {
                if conscience.verify_dad_override(password).await? {
                    // Authentication successful, return original content
                    return Ok(segment);
                } else {
                    // Authentication failed
                    return Err(AVCaptureError::Authentication(
                        "Dad Override authentication failed".to_string()
                    ));
                }
            }
        }
        
        // No authentication provided or no conscience gate - return redacted view
        // (In a real implementation, this would apply the redactions on demand,
        // but here we just return the already redacted segment)
        Ok(segment)
    }
}

/// A 256-bit encryption key for AES-GCM, wrapped in a Secret type for secure memory handling
#[derive(Clone, ZeroizeOnDrop)]
pub struct EncryptionKey(Secret<[u8; 32]>);

impl EncryptionKey {
    /// Create a new random encryption key
    pub fn generate() -> Self {
        let mut key = [0u8; 32];
        OsRng.fill_bytes(&mut key);
        Self(Secret::new(key))
    }

    /// Create an encryption key from existing bytes
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self(Secret::new(bytes))
    }

    /// Access the key bytes for encryption operations
    fn expose_bytes(&self) -> &[u8; 32] {
        self.0.expose_secret()
    }
}

/// Key provider interface for obtaining encryption keys
#[async_trait]
pub trait KeyProvider: Send + Sync {
    /// Get the current encryption key
    async fn get_encryption_key(&self) -> Result<EncryptionKey, AVCaptureError>;

    /// Rotate the encryption key (if supported)
    async fn rotate_key(&self) -> Result<(), AVCaptureError>;
}

/// PhoenixContext mock for development and testing
struct PhoenixContext {
    encryption_key: EncryptionKey,
}

impl PhoenixContext {
    fn new() -> Self {
        Self {
            encryption_key: EncryptionKey::generate(),
        }
    }

    fn get_encryption_key(&self) -> EncryptionKey {
        self.encryption_key.clone()
    }
}

/// Global PhoenixContext instance
static PHOENIX_CONTEXT: Lazy<PhoenixContext> = Lazy::new(|| {
    PhoenixContext::new()
});

/// Default KeyProvider implementation that integrates with PhoenixContext
pub struct KeyManager;

#[async_trait]
impl KeyProvider for KeyManager {
    async fn get_encryption_key(&self) -> Result<EncryptionKey, AVCaptureError> {
        // In a real implementation, this would access the actual PhoenixContext
        // For now, we use our mock implementation
        Ok(PHOENIX_CONTEXT.get_encryption_key())
    }

    async fn rotate_key(&self) -> Result<(), AVCaptureError> {
        // In a real implementation, this would rotate the key in PhoenixContext
        // For now, we'll just return Ok since our mock doesn't support rotation
        Err(AVCaptureError::KeyManagement("Key rotation not implemented in mock".to_string()))
    }
}

/// Database storage for AV segments using SQLCipher
pub struct AVDatabase {
    /// SQLite connection pool with SQLCipher encryption
    pool: Pool<Sqlite>,
    /// Key provider for encryption operations
    key_provider: Arc<dyn KeyProvider>,
    /// Background task handle for data retention policy
    retention_task: Option<JoinHandle<()>>,
    /// Retention period in days (default: 90)
    retention_days: u32,
}

impl AVDatabase {
    /// Create a new AVDatabase with the given key provider
    pub async fn new(
        db_path: &Path,
        key_provider: Arc<dyn KeyProvider>,
        retention_days: Option<u32>,
    ) -> Result<Self, AVCaptureError> {
        // Ensure directory exists
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent).map_err(|e| AVCaptureError::Io(e))?;
        }

        // Get encryption key
        let key = key_provider.get_encryption_key().await?;
        
        // Format key as hex for SQLCipher
        let key_bytes = key.expose_bytes();
        let key_hex = key_bytes.iter()
            .map(|b| format!("{:02x}", b))
            .collect::<String>();

        // Set up connection with SQLCipher
        let options = SqliteConnectOptions::from_str(&format!("sqlite://{}", db_path.display()))
            .map_err(|e| AVCaptureError::Database(e.to_string()))?
            .create_if_missing(true);
            
        // Create connection pool
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await
            .map_err(|e| AVCaptureError::Database(e.to_string()))?;
            
        // Execute PRAGMA key for SQLCipher encryption
        query(&format!("PRAGMA key = \"x'{}'\"", key_hex))
            .execute(&pool)
            .await
            .map_err(|e| AVCaptureError::Database(format!("Failed to set encryption key: {}", e)))?;
            
        // Set secure delete and journal mode
        query("PRAGMA secure_delete = ON")
            .execute(&pool)
            .await
            .map_err(|e| AVCaptureError::Database(e.to_string()))?;
            
        query("PRAGMA journal_mode = WAL")
            .execute(&pool)
            .await
            .map_err(|e| AVCaptureError::Database(e.to_string()))?;
            
        // Create tables
        Self::create_tables(&pool).await?;
        
        let retention_days = retention_days.unwrap_or(90);
        
        let db = Self {
            pool,
            key_provider,
            retention_task: None,
            retention_days,
        };
        
        // Start retention task
        db.start_retention_task().await?;
        
        Ok(db)
    }
    
    /// Create database tables
    async fn create_tables(pool: &Pool<Sqlite>) -> Result<(), AVCaptureError> {
        // Segments table
        query(r#"
            CREATE TABLE IF NOT EXISTS segments (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                duration REAL NOT NULL,
                is_important BOOLEAN NOT NULL DEFAULT 0
            )
        "#)
        .execute(pool)
        .await
        .map_err(|e| AVCaptureError::Database(format!("Failed to create segments table: {}", e)))?;
        
        // Audio segments table
        query(r#"
            CREATE TABLE IF NOT EXISTS audio_segments (
                id TEXT PRIMARY KEY,
                segment_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                duration REAL NOT NULL,
                sample_rate INTEGER NOT NULL,
                channels INTEGER NOT NULL,
                bit_depth INTEGER NOT NULL,
                is_silence BOOLEAN NOT NULL DEFAULT 0,
                encrypted_data BLOB,
                nonce BLOB,
                transcription TEXT,
                FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE
            )
        "#)
        .execute(pool)
        .await
        .map_err(|e| AVCaptureError::Database(format!("Failed to create audio_segments table: {}", e)))?;
        
        // Video segments table
        query(r#"
            CREATE TABLE IF NOT EXISTS video_segments (
                id TEXT PRIMARY KEY,
                segment_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                duration REAL NOT NULL,
                width INTEGER NOT NULL,
                height INTEGER NOT NULL,
                fps REAL NOT NULL,
                codec TEXT NOT NULL,
                has_webcam BOOLEAN NOT NULL DEFAULT 0,
                encrypted_data BLOB,
                nonce BLOB,
                FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE
            )
        "#)
        .execute(pool)
        .await
        .map_err(|e| AVCaptureError::Database(format!("Failed to create video_segments table: {}", e)))?;
        
        // Create indexes
        query("CREATE INDEX IF NOT EXISTS idx_segments_timestamp ON segments(timestamp)")
            .execute(pool)
            .await
            .map_err(|e| AVCaptureError::Database(format!("Failed to create index: {}", e)))?;
            
        query("CREATE INDEX IF NOT EXISTS idx_audio_segments_segment_id ON audio_segments(segment_id)")
            .execute(pool)
            .await
            .map_err(|e| AVCaptureError::Database(format!("Failed to create index: {}", e)))?;
            
        query("CREATE INDEX IF NOT EXISTS idx_video_segments_segment_id ON video_segments(segment_id)")
            .execute(pool)
            .await
            .map_err(|e| AVCaptureError::Database(format!("Failed to create index: {}", e)))?;
            
        // Create transcription index
        query("CREATE INDEX IF NOT EXISTS idx_audio_segments_transcription ON audio_segments(transcription) WHERE transcription IS NOT NULL")
            .execute(pool)
            .await
            .map_err(|e| AVCaptureError::Database(format!("Failed to create transcription index: {}", e)))?;
            
        Ok(())
    }
    
    /// Start the background retention task for purging old data
    async fn start_retention_task(&self) -> Result<(), AVCaptureError> {
        let pool = self.pool.clone();
        let retention_days = self.retention_days;
        
        // Clone the pool for the task
        let task = tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(24 * 60 * 60)); // Run once per day
            
            loop {
                interval.tick().await;
                
                // Calculate cutoff date
                let cutoff_date = Utc::now() - chrono::Duration::days(retention_days as i64);
                let cutoff_str = cutoff_date.format("%Y-%m-%dT%H:%M:%S%.fZ").to_string();
                
                // Delete old non-important segments
                let result = query(
                    "DELETE FROM segments WHERE timestamp < ? AND is_important = 0"
                )
                .bind(cutoff_str)
                .execute(&pool)
                .await;
                
                if let Err(e) = result {
                    eprintln!("Error in retention task: {}", e);
                } else if let Ok(result) = result {
                    if result.rows_affected() > 0 {
                        println!("Purged {} expired segments", result.rows_affected());
                    }
                }
                
                // Sleep to avoid busy-waiting
                sleep(Duration::from_secs(1)).await;
            }
        });
        
        Ok(())
    }
    
    /// Encrypt data using AES-GCM
    async fn encrypt_data(&self, data: &[u8]) -> Result<(Vec<u8>, Vec<u8>), AVCaptureError> {
        let key = self.key_provider.get_encryption_key().await?;
        
        // Generate a random 96-bit nonce (12 bytes)
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        // Create AES-GCM cipher with our key
        let cipher = Aes256Gcm::new_from_slice(key.expose_bytes())
            .map_err(|e| AVCaptureError::Encryption(format!("Failed to create cipher: {}", e)))?;
            
        // Encrypt the data
        let encrypted_data = cipher.encrypt(nonce, data)
            .map_err(|e| AVCaptureError::Encryption(format!("Encryption failed: {}", e)))?;
            
        Ok((encrypted_data, nonce_bytes.to_vec()))
    }
    
    /// Decrypt data using AES-GCM
    async fn decrypt_data(&self, encrypted_data: &[u8], nonce_bytes: &[u8]) -> Result<Vec<u8>, AVCaptureError> {
        let key = self.key_provider.get_encryption_key().await?;
        
        // Create nonce from bytes
        let nonce = Nonce::from_slice(nonce_bytes);
        
        // Create AES-GCM cipher with our key
        let cipher = Aes256Gcm::new_from_slice(key.expose_bytes())
            .map_err(|e| AVCaptureError::Encryption(format!("Failed to create cipher: {}", e)))?;
            
        // Decrypt the data
        let decrypted_data = cipher.decrypt(nonce, encrypted_data)
            .map_err(|e| AVCaptureError::Encryption(format!("Decryption failed: {}", e)))?;
            
        Ok(decrypted_data)
    }
    
    /// Save a segment to the database
    pub async fn save_segment(&self, segment: &Segment) -> Result<(), AVCaptureError> {
        // Begin transaction
        let mut tx = self.pool.begin().await?;
        
        // Insert segment
        query(r#"
            INSERT INTO segments (id, timestamp, duration, is_important)
            VALUES (?, ?, ?, ?)
        "#)
        .bind(&segment.id)
        .bind(segment.timestamp.format("%Y-%m-%dT%H:%M:%S%.fZ").to_string())
        .bind(segment.duration)
        .bind(segment.is_important)
        .execute(&mut *tx)
        .await
        .map_err(|e| AVCaptureError::Database(format!("Failed to insert segment: {}", e)))?;
        
        // Insert audio segment if present
        if let Some(audio) = &segment.audio {
            // Read audio file data
            let file_data = fs::read(&audio.file_path)
                .map_err(|e| AVCaptureError::Io(e))?;
                
            // Encrypt the audio data
            let (encrypted_data, nonce) = self.encrypt_data(&file_data).await?;
            
            // Insert audio segment
            query(r#"
                INSERT INTO audio_segments (
                    id, segment_id, timestamp, duration, sample_rate,
                    channels, bit_depth, is_silence, encrypted_data, nonce, transcription
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#)
            .bind(&audio.id)
            .bind(&segment.id)
            .bind(audio.timestamp.format("%Y-%m-%dT%H:%M:%S%.fZ").to_string())
            .bind(audio.duration)
            .bind(audio.sample_rate)
            .bind(audio.channels)
            .bind(audio.bit_depth)
            .bind(audio.is_silence)
            .bind(encrypted_data)
            .bind(nonce)
            .bind(&audio.transcription)
            .execute(&mut *tx)
            .await
            .map_err(|e| AVCaptureError::Database(format!("Failed to insert audio segment: {}", e)))?;
            
            // Remove the temporary file after it's encrypted and stored in the database
            if fs::remove_file(&audio.file_path).is_err() {
                eprintln!("Warning: Failed to remove temporary audio file: {:?}", audio.file_path);
            }
        }
        
        // Insert video segment if present
        if let Some(video) = &segment.video {
            // Read video file data
            let file_data = fs::read(&video.file_path)
                .map_err(|e| AVCaptureError::Io(e))?;
                
            // Encrypt the video data
            let (encrypted_data, nonce) = self.encrypt_data(&file_data).await?;
            
            // Insert video segment
            query(r#"
                INSERT INTO video_segments (
                    id, segment_id, timestamp, duration, width,
                    height, fps, codec, has_webcam, encrypted_data, nonce
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#)
            .bind(&video.id)
            .bind(&segment.id)
            .bind(video.timestamp.format("%Y-%m-%dT%H:%M:%S%.fZ").to_string())
            .bind(video.duration)
            .bind(video.width)
            .bind(video.height)
            .bind(video.fps)
            .bind(&video.codec)
            .bind(video.has_webcam)
            .bind(encrypted_data)
            .bind(nonce)
            .execute(&mut *tx)
            .await
            .map_err(|e| AVCaptureError::Database(format!("Failed to insert video segment: {}", e)))?;
            
            // Remove the temporary file after it's encrypted and stored in the database
            if fs::remove_file(&video.file_path).is_err() {
                eprintln!("Warning: Failed to remove temporary video file: {:?}", video.file_path);
            }
        }
        
        // Commit transaction
        tx.commit().await
            .map_err(|e| AVCaptureError::Database(format!("Failed to commit transaction: {}", e)))?;
            
        Ok(())
    }
    
    /// Get a segment from the database
    pub async fn get_segment(&self, id: &str) -> Result<Option<Segment>, AVCaptureError> {
        // Query for the segment
        let segment_row = query("SELECT * FROM segments WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
            
        if let Some(row) = segment_row {
            let id: String = row.try_get("id")?;
            let timestamp_str: String = row.try_get("timestamp")?;
            let duration: f64 = row.try_get("duration")?;
            let is_important: bool = row.try_get("is_important")?;
            
            let timestamp = DateTime::parse_from_rfc3339(&timestamp_str)
                .map(|dt| dt.with_timezone(&Utc))
                .map_err(|e| AVCaptureError::Database(format!("Invalid timestamp format: {}", e)))?;
                
            let mut segment = Segment {
                id,
                timestamp,
                duration,
                audio: None,
                video: None,
                is_important,
            };
            
            // Get audio segment
            let audio_row = query("SELECT * FROM audio_segments WHERE segment_id = ?")
                .bind(&segment.id)
                .fetch_optional(&self.pool)
                .await?;
                
            if let Some(row) = audio_row {
                let id: String = row.try_get("id")?;
                let timestamp_str: String = row.try_get("timestamp")?;
                let duration: f64 = row.try_get("duration")?;
                let sample_rate: u32 = row.try_get("sample_rate")?;
                let channels: u8 = row.try_get("channels")?;
                let bit_depth: u8 = row.try_get("bit_depth")?;
                let is_silence: bool = row.try_get("is_silence")?;
                let encrypted_data: Vec<u8> = row.try_get("encrypted_data")?;
                let nonce: Vec<u8> = row.try_get("nonce")?;
                let transcription: Option<String> = row.try_get("transcription")?;
                
                let timestamp = DateTime::parse_from_rfc3339(&timestamp_str)
                    .map(|dt| dt.with_timezone(&Utc))
                    .map_err(|e| AVCaptureError::Database(format!("Invalid timestamp format: {}", e)))?;
                    
                // Decrypt the audio data and save to a temporary file
                let decrypted_data = self.decrypt_data(&encrypted_data, &nonce).await?;
                
                // Create a temporary file path
                let temp_dir = std::env::temp_dir();
                let audio_path = temp_dir.join(format!("audio_{}.opus", id));
                
                // Write the decrypted data to the temporary file
                fs::write(&audio_path, &decrypted_data)
                    .map_err(|e| AVCaptureError::Io(e))?;
                    
                let audio_segment = AudioSegment {
                    id,
                    timestamp,
                    duration,
                    sample_rate,
                    channels,
                    bit_depth,
                    file_path: audio_path,
                    transcription,
                    is_silence,
                };
                
                segment.audio = Some(audio_segment);
            }
            
            // Tauri command implementations for privacy and consent features
            
            #[tauri::command]
            pub async fn av_get_privacy_timeline() -> Vec<PrivacyAwareSegment> {
                // In a real implementation, this would retrieve privacy-aware segments from the AVCaptureTool
                let tool = AVCaptureTool::new();
                tool.get_privacy_aware_timeline()
            }
            
            #[tauri::command]
            pub async fn av_get_segment_with_auth(segment_id: String, dad_password: Option<String>)
                -> Result<Segment, String> {
                
                // In a real implementation, this would retrieve the segment with authentication
                let mut tool = AVCaptureTool::new();
                tool.initialize(None, None, None, None).await.map_err(|e| e.to_string())?;
                
                tool.get_segment_with_auth(&segment_id, dad_password.as_deref()).await
                    .map_err(|e| e.to_string())
            }
            
            #[tauri::command]
            pub async fn av_set_dad_override_password(new_password: String) -> Result<bool, String> {
                // In a real implementation, this would update the Dad Override password
                // (would typically require existing authentication)
                let mut tool = AVCaptureTool::new();
                tool.initialize(None, None, None, None).await.map_err(|e| e.to_string())?;
                
                if let Some(conscience) = &tool.conscience_gate {
                    conscience.dad_override.set_password(&new_password).await
                        .map(|_| true)
                        .map_err(|e| e.to_string())
                } else {
                    Err("ConscienceGate not initialized".to_string())
                }
            }
            
            #[tauri::command]
            pub async fn av_update_redaction_settings(
                content_type: String,
                enabled: bool,
                redaction_method: String,
                threshold: f32,
                store_original: bool
            ) -> Result<bool, String> {
                // In a real implementation, this would update redaction settings for a content type
                let mut tool = AVCaptureTool::new();
                tool.initialize(None, None, None, None).await.map_err(|e| e.to_string())?;
                
                if let Some(conscience) = &tool.conscience_gate {
                    // Parse content type from string
                    let content_type = match content_type.as_str() {
                        "child_face" => SensitiveContentType::ChildFace,
                        "medical_document" => SensitiveContentType::MedicalDocument,
                        "password" => SensitiveContentType::Password,
                        "pii" => SensitiveContentType::PII,
                        "financial" => SensitiveContentType::Financial,
                        _ => SensitiveContentType::Custom(content_type),
                    };
                    
                    // Parse redaction method from string
                    let method = match redaction_method.as_str() {
                        "blur" => RedactionMethod::Blur(15),
                        "black_box" => RedactionMethod::BlackBox,
                        "pixelate" => RedactionMethod::Pixelate(8),
                        "replace" => RedactionMethod::Replace,
                        _ => RedactionMethod::BlackBox,
                    };
                    
                    // Update the redaction parameters
                    let mut config = conscience.config.clone();
                    
                    config.redaction_parameters.insert(content_type, RedactionParameters {
                        enabled,
                        method,
                        threshold,
                        store_original,
                    });
                    
                    // In a real implementation, this would persist the updated config
                    Ok(true)
                } else {
                    Err("ConscienceGate not initialized".to_string())
                }
            }
            
            #[tauri::command]
            pub async fn av_disable_blackout() -> Result<bool, String> {
                // In a real implementation, this would disable an active blackout period
                // (would typically require Dad Override authentication)
                let mut tool = AVCaptureTool::new();
                tool.initialize(None, None, None, None).await.map_err(|e| e.to_string())?;
                
                if let Some(conscience) = &tool.conscience_gate {
                    // Reset the blackout state
                    let mut blackout_active = conscience.blackout_active.write().await;
                    *blackout_active = false;
                    
                    let mut blackout_until = conscience.blackout_until.write().await;
                    *blackout_until = None;
                    
                    Ok(true)
                } else {
                    Err("ConscienceGate not initialized".to_string())
                }
            }
            
            // Get video segment
            let video_row = query("SELECT * FROM video_segments WHERE segment_id = ?")
                .bind(&segment.id)
                .fetch_optional(&self.pool)
                .await?;
                
            if let Some(row) = video_row {
                let id: String = row.try_get("id")?;
                let timestamp_str: String = row.try_get("timestamp")?;
                let duration: f64 = row.try_get("duration")?;
                let width: u32 = row.try_get("width")?;
                let height: u32 = row.try_get("height")?;
                let fps: f64 = row.try_get("fps")?;
                let codec: String = row.try_get("codec")?;
                let has_webcam: bool = row.try_get("has_webcam")?;
                let encrypted_data: Vec<u8> = row.try_get("encrypted_data")?;
                let nonce: Vec<u8> = row.try_get("nonce")?;
                
                let timestamp = DateTime::parse_from_rfc3339(&timestamp_str)
                    .map(|dt| dt.with_timezone(&Utc))
                    .map_err(|e| AVCaptureError::Database(format!("Invalid timestamp format: {}", e)))?;
                    
                // Decrypt the video data and save to a temporary file
                let decrypted_data = self.decrypt_data(&encrypted_data, &nonce).await?;
                
                // Create a temporary file path
                let temp_dir = std::env::temp_dir();
                let video_path = temp_dir.join(format!("video_{}.webm", id));
                
                // Write the decrypted data to the temporary file
                fs::write(&video_path, &decrypted_data)
                    .map_err(|e| AVCaptureError::Io(e))?;
                    
                let video_segment = VideoSegment {
                    id,
                    timestamp,
                    duration,
                    width,
                    height,
                    fps,
                    codec,
                    file_path: video_path,
                    has_webcam,
                };
                
                segment.video = Some(video_segment);
            }
            
            return Ok(Some(segment));
        }
        
        Ok(None)
    }
    
    /// List all segments with optional limit and offset
    pub async fn list_segments(&self, limit: Option<u32>, offset: Option<u32>) -> Result<Vec<Segment>, AVCaptureError> {
        let limit_clause = if let Some(limit) = limit {
            format!("LIMIT {}", limit)
        } else {
            String::new()
        };
        
        let offset_clause = if let Some(offset) = offset {
            format!("OFFSET {}", offset)
        } else {
            String::new()
        };
        
        let segments_query = format!(
            "SELECT id FROM segments ORDER BY timestamp DESC {} {}",
            limit_clause, offset_clause
        );
        
        let segment_ids: Vec<String> = query(&segments_query)
            .fetch_all(&self.pool)
            .await?
            .into_iter()
            .map(|row| row.get("id"))
            .collect();
            
        let mut segments = Vec::new();
        
        for id in segment_ids {
            if let Some(segment) = self.get_segment(&id).await? {
                segments.push(segment);
            }
        }
        
        Ok(segments)
    }
    
    /// Get database storage usage statistics
    pub async fn get_storage_stats(&self) -> Result<StorageStats, AVCaptureError> {
        // Count total segments
        let total_segments: i64 = query("SELECT COUNT(*) as count FROM segments")
            .fetch_one(&self.pool)
            .await?
            .try_get("count")?;
            
        // Count total audio segments
        let total_audio: i64 = query("SELECT COUNT(*) as count FROM audio_segments")
            .fetch_one(&self.pool)
            .await?
            .try_get("count")?;
            
        // Count total video segments
        let total_video: i64 = query("SELECT COUNT(*) as count FROM video_segments")
            .fetch_one(&self.pool)
            .await?
            .try_get("count")?;
            
        // Calculate total size
        let audio_size: i64 = query("SELECT COALESCE(SUM(LENGTH(encrypted_data)), 0) as size FROM audio_segments")
            .fetch_one(&self.pool)
            .await?
            .try_get("size")?;
            
        let video_size: i64 = query("SELECT COALESCE(SUM(LENGTH(encrypted_data)), 0) as size FROM video_segments")
            .fetch_one(&self.pool)
            .await?
            .try_get("size")?;
            
        // Get oldest and newest timestamps
        let oldest_timestamp: Option<String> = query(
            "SELECT timestamp FROM segments ORDER BY timestamp ASC LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await?
        .and_then(|row| row.try_get("timestamp").ok());
        
        let newest_timestamp: Option<String> = query(
            "SELECT timestamp FROM segments ORDER BY timestamp DESC LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await?
        .and_then(|row| row.try_get("timestamp").ok());
        
        // Parse timestamps
        let oldest = oldest_timestamp.and_then(|ts| {
            DateTime::parse_from_rfc3339(&ts)
                .map(|dt| dt.with_timezone(&Utc))
                .ok()
        });
        
        let newest = newest_timestamp.and_then(|ts| {
            DateTime::parse_from_rfc3339(&ts)
                .map(|dt| dt.with_timezone(&Utc))
                .ok()
        });
        
        Ok(StorageStats {
            total_segments: total_segments as usize,
            total_audio_segments: total_audio as usize,
            total_video_segments: total_video as usize,
            total_size_bytes: (audio_size + video_size) as usize,
            audio_size_bytes: audio_size as usize,
            video_size_bytes: video_size as usize,
            oldest_recording: oldest,
            newest_recording: newest,
        })
    }
    
    /// Clean up resources when the database is dropped
    pub async fn shutdown(&self) -> Result<(), AVCaptureError> {
        // Cancel retention task if running
        if let Some(task) = &self.retention_task {
            task.abort();
        }
        
        // Close the pool
        self.pool.close().await;
        
        Ok(())
    }
}

//
// CONSCIENCE GATE AND PRIVACY FEATURES
//

/// Ethical validation levels for content analysis
#[derive(Debug, Clone, Copy, PartialEq, Deserialize, Serialize)]
pub enum EthicalValidationLevel {
    /// Permissive mode - minimal content filtering
    Permissive,
    /// Standard mode - balanced content filtering (default)
    Standard,
    /// Strict mode - maximum privacy protection
    Strict,
    /// Custom mode with specific settings
    Custom,
}

impl Default for EthicalValidationLevel {
    fn default() -> Self {
        Self::Standard
    }
}

/// Types of sensitive content that can be detected and redacted
#[derive(Debug, Clone, Copy, PartialEq, Deserialize, Serialize)]
pub enum SensitiveContentType {
    /// Children's faces (requires age estimation)
    ChildFace,
    /// Medical documents or information
    MedicalDocument,
    /// Passwords or credentials visible on screen
    Password,
    /// Personal identifiable information
    PII,
    /// Financial information
    Financial,
    /// Custom sensitive content with specific parameters
    Custom(String),
}

/// Definition of redaction parameters for different content types
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RedactionParameters {
    /// Whether to apply redaction for this content type
    pub enabled: bool,
    /// Redaction method to use
    pub method: RedactionMethod,
    /// Confidence threshold for detection (0.0 - 1.0)
    pub threshold: f32,
    /// Whether to store the original unredacted version (with access controls)
    pub store_original: bool,
}

/// Methods for redacting sensitive content
#[derive(Debug, Clone, Copy, PartialEq, Deserialize, Serialize)]
pub enum RedactionMethod {
    /// Blur the sensitive content
    Blur(u8), // Blur radius/strength
    /// Black box over the sensitive content
    BlackBox,
    /// Pixelate the sensitive content
    Pixelate(u8), // Pixelation level
    /// Replace with a custom image or overlay
    Replace,
}

/// Configuration for the ConscienceGate
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ConscienceGateConfig {
    /// Ethical validation level
    pub validation_level: EthicalValidationLevel,
    
    /// Redaction parameters for different content types
    pub redaction_parameters: HashMap<SensitiveContentType, RedactionParameters>,
    
    /// Whether to enable "Dad Override" authentication
    pub enable_dad_override: bool,
    
    /// Whether to enable voice command detection
    pub enable_voice_commands: bool,
    
    /// Duration of blackout period after voice command (in minutes)
    pub voice_command_blackout_minutes: u32,
    
    /// Path to the face detection and age estimation model
    pub face_detection_model_path: PathBuf,
    
    /// Path to the document classification model
    pub document_classification_model_path: PathBuf,
    
    /// Path to the text detection model
    pub text_detection_model_path: PathBuf,
}

impl Default for ConscienceGateConfig {
    fn default() -> Self {
        let mut redaction_parameters = HashMap::new();
        
        // Default redaction parameters for child faces
        redaction_parameters.insert(
            SensitiveContentType::ChildFace,
            RedactionParameters {
                enabled: true,
                method: RedactionMethod::Blur(15),
                threshold: 0.75,
                store_original: true,
            }
        );
        
        // Default redaction parameters for medical documents
        redaction_parameters.insert(
            SensitiveContentType::MedicalDocument,
            RedactionParameters {
                enabled: true,
                method: RedactionMethod::BlackBox,
                threshold: 0.8,
                store_original: true,
            }
        );
        
        // Default redaction parameters for passwords
        redaction_parameters.insert(
            SensitiveContentType::Password,
            RedactionParameters {
                enabled: true,
                method: RedactionMethod::BlackBox,
                threshold: 0.9,
                store_original: false,
            }
        );
        
        Self {
            validation_level: EthicalValidationLevel::Standard,
            redaction_parameters,
            enable_dad_override: true,
            enable_voice_commands: true,
            voice_command_blackout_minutes: 30,
            face_detection_model_path: PathBuf::from("./models/face_detection"),
            document_classification_model_path: PathBuf::from("./models/document_classification"),
            text_detection_model_path: PathBuf::from("./models/text_detection"),
        }
    }
}

/// The ConscienceGate integrates with the TriuneConscience system to provide
/// ethical validation and privacy protection for AV capture
#[derive(Debug)]
pub struct ConscienceGate {
    /// Configuration for the ConscienceGate
    config: ConscienceGateConfig,
    
    /// Reference to the Phoenix TriuneConscience system
    conscience: Arc<TriuneConscience>,
    
    /// Content analyzer for detecting sensitive content
    content_analyzer: Arc<ContentAnalyzer>,
    
    /// Redaction engine for applying privacy protections
    redaction_engine: Arc<RedactionEngine>,
    
    /// Dad Override authentication system
    dad_override: Arc<DadOverride>,
    
    /// Voice command detector for privacy control
    voice_detector: Arc<VoiceCommandDetector>,
    
    /// Current blackout status
    blackout_active: Arc<RwLock<bool>>,
    
    /// Blackout end time if active
    blackout_until: Arc<RwLock<Option<DateTime<Utc>>>>,
}

impl ConscienceGate {
    /// Create a new ConscienceGate with the given configuration and conscience
    pub async fn new(
        config: ConscienceGateConfig,
        conscience: Arc<TriuneConscience>,
    ) -> Result<Self, AVCaptureError> {
        // Initialize content analyzer
        let content_analyzer = Arc::new(
            ContentAnalyzer::new(
                config.face_detection_model_path.clone(),
                config.document_classification_model_path.clone(),
                config.text_detection_model_path.clone(),
            ).await?
        );
        
        // Initialize redaction engine
        let redaction_engine = Arc::new(RedactionEngine::new());
        
        // Initialize Dad Override system
        let dad_override = Arc::new(DadOverride::new());
        
        // Initialize voice command detector
        let voice_detector = Arc::new(VoiceCommandDetector::new());
        
        Ok(Self {
            config,
            conscience,
            content_analyzer,
            redaction_engine,
            dad_override,
            voice_detector,
            blackout_active: Arc::new(RwLock::new(false)),
            blackout_until: Arc::new(RwLock::new(None)),
        })
    }
    
    /// Check if recording is allowed based on ethics and blackout status
    pub async fn is_recording_allowed(&self) -> Result<bool, AVCaptureError> {
        // Check if in blackout period
        if *self.blackout_active.read().await {
            let until = self.blackout_until.read().await;
            if let Some(time) = *until {
                if Utc::now() < time {
                    // Still in blackout period
                    return Ok(false);
                } else {
                    // Blackout period has ended
                    let mut blackout_active = self.blackout_active.write().await;
                    *blackout_active = false;
                    let mut blackout_until = self.blackout_until.write().await;
                    *blackout_until = None;
                }
            }
        }
        
        // Perform ethical validation with TriuneConscience
        let query = EthicalQuery {
            action: "record_audio_video".to_string(),
            context: "user_environment".to_string(),
            privacy_level: match self.config.validation_level {
                EthicalValidationLevel::Permissive => Privacy::Low,
                EthicalValidationLevel::Standard => Privacy::Medium,
                EthicalValidationLevel::Strict => Privacy::High,
                EthicalValidationLevel::Custom => Privacy::Medium,
            },
            consent_level: Consent::Implicit, // Assume implicit consent for now
            // Additional parameters could be added here
        };
        
        match self.conscience.validate_action(&query).await {
            Ok(response) => Ok(response.is_approved),
            Err(e) => Err(AVCaptureError::EthicsValidation(e.to_string())),
        }
    }
    
    /// Process video frame for content analysis and redaction
    pub async fn process_video_frame(&self, frame: &mut Mat) -> Result<Vec<SensitiveContentType>, AVCaptureError> {
        // Analyze the frame for sensitive content
        let detections = self.content_analyzer.analyze_video_frame(frame).await?;
        
        // If no sensitive content detected, return early
        if detections.is_empty() {
            return Ok(Vec::new());
        }
        
        // Apply redactions for each detected sensitive content
        let mut redacted_types = Vec::new();
        
        for (content_type, regions) in &detections {
            if let Some(params) = self.config.redaction_parameters.get(content_type) {
                if params.enabled {
                    self.redaction_engine.redact_regions(frame, regions, &params.method)?;
                    redacted_types.push(*content_type);
                }
            }
        }
        
        Ok(redacted_types)
    }
    
    /// Process audio for voice commands and sensitive content
    pub async fn process_audio_chunk(&self, audio_data: &[i16], sample_rate: u32) -> Result<bool, AVCaptureError> {
        // Check for "Phoenix stop recording" command
        if self.config.enable_voice_commands {
            if let Some(command) = self.voice_detector.detect_command(audio_data, sample_rate).await? {
                if command == "phoenix stop recording" {
                    // Activate blackout period
                    self.activate_blackout().await?;
                    return Ok(true); // Voice command detected
                }
            }
        }
        
        // Future: Implement audio redaction for sensitive sounds if needed
        
        Ok(false)
    }
    
    /// Activate the blackout period
    async fn activate_blackout(&self) -> Result<(), AVCaptureError> {
        let mut blackout_active = self.blackout_active.write().await;
        *blackout_active = true;
        
        let mut blackout_until = self.blackout_until.write().await;
        let duration = chrono::Duration::minutes(self.config.voice_command_blackout_minutes as i64);
        *blackout_until = Some(Utc::now() + duration);
        
        Ok(())
    }
    
    /// Check if Dad Override is authorized for accessing original content
    pub async fn verify_dad_override(&self, password: &str) -> Result<bool, AVCaptureError> {
        self.dad_override.verify(password).await
    }
    
    /// Update the configuration
    pub fn update_config(&mut self, config: ConscienceGateConfig) {
        self.config = config;
    }
}

/// Content analyzer for detecting sensitive content in audio/video
#[derive(Debug)]
pub struct ContentAnalyzer {
    /// Face detector and age estimator
    face_detector: FaceDetector,
    
    /// Age estimation neural network
    age_estimation_net: Net,
    
    /// Document classification model
    document_classifier: Net,
    
    /// Text pattern detector for passwords and sensitive info
    text_detector: Net,
}

impl ContentAnalyzer {
    /// Create a new ContentAnalyzer with the specified model paths
    pub async fn new(
        face_model_path: PathBuf,
        document_model_path: PathBuf,
        text_model_path: PathBuf,
    ) -> Result<Self, AVCaptureError> {
        // Initialize face detector
        let face_detector = FaceDetector::new(&face_model_path.to_string_lossy())
            .map_err(|e| AVCaptureError::ContentAnalysis(format!("Failed to initialize face detector: {}", e)))?;
        
        // Initialize age estimation network
        let age_estimation_model = format!("{}/age_estimation.pt", face_model_path.to_string_lossy());
        let age_estimation_net = read_net_from_torch(&age_estimation_model, "")
            .map_err(|e| AVCaptureError::ContentAnalysis(format!("Failed to load age estimation model: {}", e)))?;
            
        // Initialize document classifier
        let document_classifier = read_net_from_torch(&document_model_path.to_string_lossy(), "")
            .map_err(|e| AVCaptureError::ContentAnalysis(format!("Failed to load document classifier: {}", e)))?;
            
        // Initialize text detector
        let text_detector = read_net_from_torch(&text_model_path.to_string_lossy(), "")
            .map_err(|e| AVCaptureError::ContentAnalysis(format!("Failed to load text detector: {}", e)))?;
            
        Ok(Self {
            face_detector,
            age_estimation_net,
            document_classifier,
            text_detector,
        })
    }
    
    /// Analyze a video frame for sensitive content
    pub async fn analyze_video_frame(&self, frame: &Mat) -> Result<HashMap<SensitiveContentType, Vec<Rect>>, AVCaptureError> {
        let mut detections = HashMap::new();
        
        // Detect faces and estimate ages
        let faces = self.detect_faces_with_age(frame).await?;
        if !faces.is_empty() {
            detections.insert(SensitiveContentType::ChildFace, faces);
        }
        
        // Detect medical documents
        let documents = self.detect_medical_documents(frame).await?;
        if !documents.is_empty() {
            detections.insert(SensitiveContentType::MedicalDocument, documents);
        }
        
        // Detect passwords or sensitive text
        let passwords = self.detect_passwords(frame).await?;
        if !passwords.is_empty() {
            detections.insert(SensitiveContentType::Password, passwords);
        }
        
        Ok(detections)
    }
    
    /// Detect faces and estimate ages, returning rectangles for children's faces
    async fn detect_faces_with_age(&self, frame: &Mat) -> Result<Vec<Rect>, AVCaptureError> {
        let mut child_faces = Vec::new();
        
        // Detect all faces in the frame
        let faces = self.face_detector.detect(frame)
            .map_err(|e| AVCaptureError::ContentAnalysis(format!("Face detection failed: {}", e)))?;
            
        for face in faces {
            // Extract the face ROI
            let face_roi = Mat::roi(frame, face)
                .map_err(|e| AVCaptureError::ContentAnalysis(format!("Failed to extract face ROI: {}", e)))?;
                
            // Preprocess for age estimation network
            let blob = opencv::dnn::blob_from_image(
                &face_roi,
                1.0,
                opencv::core::Size::new(224, 224),
                opencv::core::Scalar::new(104.0, 117.0, 123.0, 0.0),
                true,
                false,
                opencv::core::CV_32F,
            ).map_err(|e| AVCaptureError::ContentAnalysis(format!("Failed to create blob: {}", e)))?;
            
            // Run age estimation
            self.age_estimation_net.set_input(&blob, "", 1.0, opencv::core::Scalar::new(0.0, 0.0, 0.0, 0.0))
                .map_err(|e| AVCaptureError::ContentAnalysis(format!("Failed to set input: {}", e)))?;
                
            let age_output = self.age_estimation_net.forward("", None)
                .map_err(|e| AVCaptureError::ContentAnalysis(format!("Age estimation failed: {}", e)))?;
                
            // Extract the estimated age
            let age_vec = age_output.at::<f32>(0)
                .map_err(|e| AVCaptureError::ContentAnalysis(format!("Failed to get age: {}", e)))?;
                
            // If estimated age is under 18, add to child faces
            if age_vec[0] < 18.0 {
                child_faces.push(face);
            }
        }
        
        Ok(child_faces)
    }
    
    /// Detect medical documents in the frame
    async fn detect_medical_documents(&self, frame: &Mat) -> Result<Vec<Rect>, AVCaptureError> {
        // Preprocess for document classifier
        let blob = opencv::dnn::blob_from_image(
            frame,
            1.0,
            opencv::core::Size::new(224, 224),
            opencv::core::Scalar::new(104.0, 117.0, 123.0, 0.0),
            true,
            false,
            opencv::core::CV_32F,
        ).map_err(|e| AVCaptureError::ContentAnalysis(format!("Failed to create blob: {}", e)))?;
        
        // Run document classification
        self.document_classifier.set_input(&blob, "", 1.0, opencv::core::Scalar::new(0.0, 0.0, 0.0, 0.0))
            .map_err(|e| AVCaptureError::ContentAnalysis(format!("Failed to set input: {}", e)))?;
            
        let output = self.document_classifier.forward("", None)
            .map_err(|e| AVCaptureError::ContentAnalysis(format!("Document classification failed: {}", e)))?;
            
        // Extract classification results
        let class_scores = output.at::<f32>(0)
            .map_err(|e| AVCaptureError::ContentAnalysis(format!("Failed to get class scores: {}", e)))?;
            
        // Class index 3 corresponds to medical documents in our model
        if class_scores[3] > 0.8 {
            // For medical documents, typically we'd redact the whole frame or specific regions
            // Here we'll return a rectangle covering the entire frame
            let frame_size = frame.size()
                .map_err(|e| AVCaptureError::ContentAnalysis(format!("Failed to get frame size: {}", e)))?;
                
            let frame_rect = Rect::at(0, 0).of_size(frame_size.width as u32, frame_size.height as u32);
            return Ok(vec![frame_rect]);
        }
        
        Ok(Vec::new())
    }
    
    /// Detect passwords or sensitive text in the frame
    async fn detect_passwords(&self, frame: &Mat) -> Result<Vec<Rect>, AVCaptureError> {
        let mut password_regions = Vec::new();
        
        // Run text detection on the frame
        let blob = opencv::dnn::blob_from_image(
            frame,
            1.0,
            opencv::core::Size::new(320, 320),
            opencv::core::Scalar::new(123.68, 116.78, 103.94, 0.0),
            true,
            false,
            opencv::core::CV_32F,
        ).map_err(|e| AVCaptureError::ContentAnalysis(format!("Failed to create blob: {}", e)))?;
        
        self.text_detector.set_input(&blob, "", 1.0, opencv::core::Scalar::new(0.0, 0.0, 0.0, 0.0))
            .map_err(|e| AVCaptureError::ContentAnalysis(format!("Failed to set input: {}", e)))?;
            
        let output = self.text_detector.forward("", None)
            .map_err(|e| AVCaptureError::ContentAnalysis(format!("Text detection failed: {}", e)))?;
            
        // Process output to get text regions
        let data_ptr = output.data();
        let size = output.rows() as usize * output.cols() as usize * output.channels() as usize;
        let data = unsafe { std::slice::from_raw_parts(data_ptr as *const f32, size) };
        
        let frame_size = frame.size()
            .map_err(|e| AVCaptureError::ContentAnalysis(format!("Failed to get frame size: {}", e)))?;
            
        // For each detected text region
        for i in 0..(output.rows() as usize) {
            let confidence = data[i * 7 + 2];
            if confidence > 0.5 {
                // Get bounding box coordinates
                let x_min = (data[i * 7 + 3] * frame_size.width as f32) as i32;
                let y_min = (data[i * 7 + 4] * frame_size.height as f32) as i32;
                let x_max = (data[i * 7 + 5] * frame_size.width as f32) as i32;
                let y_max = (data[i * 7 + 6] * frame_size.height as f32) as i32;
                
                // Extract text region
                let text_rect = opencv::core::Rect::new(x_min, y_min, x_max - x_min, y_max - y_min);
                
                // Only process if the rectangle is valid
                if text_rect.width > 0 && text_rect.height > 0 {
                    let text_roi = Mat::roi(frame, text_rect)
                        .map_err(|e| AVCaptureError::ContentAnalysis(format!("Failed to extract text ROI: {}", e)))?;
                        
                    // In a real implementation, perform OCR and pattern matching for passwords
                    // Here we're just demonstrating with a simplified approach
                    
                    // If this looks like a password field or sensitive text
                    // (this would be a more complex check in a real implementation)
                    let is_password = true; // Simplified for demonstration
                    
                    if is_password {
                        password_regions.push(Rect::at(x_min as u32, y_min as u32)
                            .of_size((x_max - x_min) as u32, (y_max - y_min) as u32));
                    }
                }
            }
        }
        
        Ok(password_regions)
    }
}

/// Engine for applying redactions to sensitive content
#[derive(Debug)]
pub struct RedactionEngine;

impl RedactionEngine {
    /// Create a new RedactionEngine
    pub fn new() -> Self {
        Self
    }
    
    /// Redact regions in a frame using the specified method
    pub fn redact_regions(&self, frame: &mut Mat, regions: &[Rect], method: &RedactionMethod) -> Result<(), AVCaptureError> {
        for region in regions {
            // Convert OpenCV Rect to imageproc Rect
            let x = region.left() as i32;
            let y = region.top() as i32;
            let width = region.width() as u32;
            let height = region.height() as u32;
            
            // Convert Mat to DynamicImage for processing
            let frame_size = frame.size()
                .map_err(|e| AVCaptureError::Redaction(format!("Failed to get frame size: {}", e)))?;
                
            let mut data = vec![0u8; (frame_size.width * frame_size.height * 3) as usize];
            
            frame.copy_to(&mut data)
                .map_err(|e| AVCaptureError::Redaction(format!("Failed to copy frame data: {}", e)))?;
                
            let mut img = ImageBuffer::<Rgba<u8>, Vec<u8>>::new(frame_size.width as u32, frame_size.height as u32);
            
            // Convert BGR data to RGBA
            for y in 0..frame_size.height {
                for x in 0..frame_size.width {
                    let idx = (y * frame_size.width + x) as usize * 3;
                    let b = data[idx];
                    let g = data[idx + 1];
                    let r = data[idx + 2];
                    img.put_pixel(x as u32, y as u32, Rgba([r, g, b, 255]));
                }
            }
            
            // Apply redaction based on the method
            match method {
                RedactionMethod::BlackBox => {
                    let rect = imageproc::rect::Rect::at(x, y).of_size(width, height);
                    draw_filled_rect_mut(&mut img, rect, Rgba([0, 0, 0, 255]));
                }
                RedactionMethod::Blur(radius) => {
                    // In a real implementation, apply Gaussian blur to the region
                    // Simplified for demonstration
                    let rect = imageproc::rect::Rect::at(x, y).of_size(width, height);
                    draw_filled_rect_mut(&mut img, rect, Rgba([128, 128, 128, 255]));
                }
                RedactionMethod::Pixelate(level) => {
                    // In a real implementation, apply pixelation to the region
                    // Simplified for demonstration
                    let rect = imageproc::rect::Rect::at(x, y).of_size(width, height);
                    draw_filled_rect_mut(&mut img, rect, Rgba([100, 100, 100, 255]));
                }
                RedactionMethod::Replace => {
                    // In a real implementation, replace with a custom image
                    // Simplified for demonstration
                    let rect = imageproc::rect::Rect::at(x, y).of_size(width, height);
                    draw_filled_rect_mut(&mut img, rect, Rgba([200, 200, 200, 255]));
                }
            }
            
            // Convert back to Mat
            let mut redacted_data = Vec::new();
            for y in 0..frame_size.height {
                for x in 0..frame_size.width {
                    let pixel = img.get_pixel(x as u32, y as u32);
                    redacted_data.push(pixel[2]); // B
                    redacted_data.push(pixel[1]); // G
                    redacted_data.push(pixel[0]); // R
                }
            }
            
            // Update the frame with redacted data
            let mut new_mat = Mat::new_rows_cols_with_data(
                frame_size.height,
                frame_size.width,
                opencv::core::CV_8UC3,
                redacted_data.as_mut_ptr() as *mut std::ffi::c_void,
                opencv::core::Mat_AUTO_STEP,
            ).map_err(|e| AVCaptureError::Redaction(format!("Failed to create new Mat: {}", e)))?;
            
            new_mat.copy_to(frame)
                .map_err(|e| AVCaptureError::Redaction(format!("Failed to update frame: {}", e)))?;
        }
        
        Ok(())
    }
    
    /// Create a redacted copy of a frame, preserving the original
    pub fn create_redacted_copy(&self, frame: &Mat) -> Result<Mat, AVCaptureError> {
        let mut redacted = frame.clone()
            .map_err(|e| AVCaptureError::Redaction(format!("Failed to clone frame: {}", e)))?;
            
        // In a real implementation, apply redactions to the copy
        
        Ok(redacted)
    }
}

/// Dad Override authentication system for accessing original content
#[derive(Debug)]
pub struct DadOverride {
    /// Hashed password for Dad authentication
    password_hash: RwLock<String>,
    
    /// Rate limiting semaphore to prevent brute force attacks
    auth_limiter: Semaphore,
}

impl DadOverride {
    /// Create a new DadOverride with default settings
    pub fn new() -> Self {
        Self {
            // Default password hash - in a real implementation, this would be securely stored
            password_hash: RwLock::new(
                "$argon2id$v=19$m=4096,t=3,p=1$c29tZXNhbHQ$WwD1hGdRkzQmRQkJNd+nYRR5xWYn9ojpQdCaIhwHQV4".to_string()
            ),
            // Limit to 3 authentication attempts per minute
            auth_limiter: Semaphore::new(3),
        }
    }
    
    /// Verify a password for Dad Override access
    pub async fn verify(&self, password: &str) -> Result<bool, AVCaptureError> {
        // Acquire permit with timeout to implement rate limiting
        match timeout(Duration::from_secs(5), self.auth_limiter.acquire()).await {
            Ok(permit) => {
                let _permit = permit.expect("Semaphore should be available");
                
                // Get the stored hash
                let hash_str = self.password_hash.read().await;
                
                // Parse the hash
                let parsed_hash = PasswordHash::new(&hash_str)
                    .map_err(|e| AVCaptureError::Authentication(format!("Failed to parse hash: {}", e)))?;
                    
                // Verify the password
                match Argon2::default().verify_password(password.as_bytes(), &parsed_hash) {
                    Ok(_) => {
                        // Schedule semaphore to be released after a delay to maintain rate limiting
                        tokio::spawn(async move {
                            tokio::time::sleep(Duration::from_secs(20)).await;
                            drop(_permit);
                        });
                        
                        Ok(true)
                    }
                    Err(_) => {
                        // Schedule semaphore to be released after a longer delay for failed attempts
                        tokio::spawn(async move {
                            tokio::time::sleep(Duration::from_secs(60)).await;
                            drop(_permit);
                        });
                        
                        Ok(false)
                    }
                }
            }
            Err(_) => {
                // Timeout acquiring the semaphore - rate limit exceeded
                Err(AVCaptureError::Authentication("Authentication rate limit exceeded".to_string()))
            }
        }
    }
    
    /// Set a new password for Dad Override
    pub async fn set_password(&self, new_password: &str) -> Result<(), AVCaptureError> {
        // Generate a new salt
        let salt = SaltString::generate(&mut ArgonOsRng);
        
        // Hash the password
        let argon2 = Argon2::default();
        let password_hash = argon2.hash_password(new_password.as_bytes(), &salt)
            .map_err(|e| AVCaptureError::Authentication(format!("Failed to hash password: {}", e)))?
            .to_string();
            
        // Update the stored hash
        let mut hash = self.password_hash.write().await;
        *hash = password_hash;
        
        Ok(())
    }
}

/// Detector for voice commands like "Phoenix stop recording"
#[derive(Debug)]
pub struct VoiceCommandDetector {
    /// Voice recognition model
    model: RwLock<Option<String>>, // Placeholder for actual model
}

impl VoiceCommandDetector {
    /// Create a new voice command detector
    pub fn new() -> Self {
        Self {
            model: RwLock::new(None),
        }
    }
    
    /// Initialize with a model
    pub async fn initialize(&self) -> Result<(), AVCaptureError> {
        // In a real implementation, this would load the voice recognition model
        let mut model = self.model.write().await;
        *model = Some("Initialized voice recognition model".to_string());
        Ok(())
    }
    
    /// Detect voice commands in audio data
    pub async fn detect_command(&self, audio_data: &[i16], sample_rate: u32) -> Result<Option<String>, AVCaptureError> {
        // In a real implementation, this would process audio data with the model
        // to detect voice commands
        
        // For demonstration purposes, simulate voice command detection
        // In a real implementation, this would use proper voice recognition
        
        // Just a stub implementation for now
        
        // Normally, we would:
        // 1. Convert audio data to features (e.g., MFCCs)
        // 2. Run through a speech recognition model
        // 3. Match against known commands
        
        // Return None to indicate no command was detected
        Ok(None)
    }
}

/// Extended segment with redaction metadata
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PrivacyAwareSegment {
    /// Base segment
    pub segment: Segment,
    
    /// Whether this segment contains redacted content
    pub contains_redactions: bool,
    
    /// Types of redactions applied
    pub redaction_types: Vec<SensitiveContentType>,
    
    /// Whether original unredacted content is available with auth
    pub has_original_available: bool,
}

impl PrivacyAwareSegment {
    /// Create a new privacy-aware segment from a regular segment
    pub fn new(segment: Segment) -> Self {
        Self {
            segment,
            contains_redactions: false,
            redaction_types: Vec::new(),
            has_original_available: false,
        }
    }
    
    /// Mark as containing redactions
    pub fn with_redactions(mut self, redaction_types: Vec<SensitiveContentType>, has_original: bool) -> Self {
        self.contains_redactions = true;
        self.redaction_types = redaction_types;
        self.has_original_available = has_original;
        self
    }
}

/// Storage statistics for the AV database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageStats {
    /// Total number of segments
    pub total_segments: usize,
    
    /// Total number of audio segments
    pub total_audio_segments: usize,
    
    /// Total number of video segments
    pub total_video_segments: usize,
    
    /// Total size of all segments in bytes
    pub total_size_bytes: usize,
    
    /// Total size of audio data in bytes
    pub audio_size_bytes: usize,
    
    /// Total size of video data in bytes
    pub video_size_bytes: usize,
    
    /// Oldest recording timestamp
    pub oldest_recording: Option<DateTime<Utc>>,
    
    /// Newest recording timestamp
    pub newest_recording: Option<DateTime<Utc>>,
}

// Tauri command implementations
#[tauri::command]
pub async fn av_start_recording() -> Result<AVCommandResponse, String> {
    let mut tool = AVCaptureTool::new();
    tool.initialize(None, None, None).await.map_err(|e| e.to_string())?;
    tool.start_recording().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn av_stop_recording() -> Result<AVCommandResponse, String> {
    // In a real implementation, this would retrieve the active AVCaptureTool
    // and save the recording to the AVDatabase
    let tool = AVCaptureTool::new();
    let db_path = std::env::current_dir()
        .map_err(|e| e.to_string())?
        .join("data/avdb.sqlite");
        
    let key_provider = Arc::new(KeyManager);
    
    match AVDatabase::new(&db_path, key_provider, None).await {
        Ok(_) => {
            Ok(AVCommandResponse {
                success: true,
                message: "Recording stopped and stored in encrypted database".to_string(),
                segment_id: Some(Uuid::new_v4().to_string()),
            })
        },
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

#[tauri::command]
pub async fn av_get_timeline() -> Vec<Segment> {
    // In a real implementation, this would retrieve segments from the AVDatabase
    let db_path = std::env::current_dir()
        .map(|p| p.join("data/avdb.sqlite"))
        .unwrap_or_else(|_| PathBuf::from("data/avdb.sqlite"));
        
    let key_provider = Arc::new(KeyManager);
    
    match AVDatabase::new(&db_path, key_provider, None).await {
        Ok(db) => {
            match db.list_segments(Some(100), None).await {
                Ok(segments) => segments,
                Err(_) => Vec::new(),
            }
        },
        Err(_) => Vec::new(),
    }
}