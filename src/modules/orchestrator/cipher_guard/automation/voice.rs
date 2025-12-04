use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use cpal::{traits::*, Stream};
use tts::*;
use std::collections::HashMap;

use crate::modules::orchestrator::cipher_guard::automation::{
    config::AutomationConfig,
    types::{VoiceProfile, VoiceAlert, AlertPriority},
};

pub struct VoiceSystem {
    config: Arc<RwLock<AutomationConfig>>,
    tts: Arc<Tts>,
    alert_tx: mpsc::Sender<VoiceAlert>,
    _audio_stream: Option<Stream>,
    voice_profiles: Arc<RwLock<HashMap<String, VoiceProfile>>>,
}

impl VoiceSystem {
    pub async fn new(config: Arc<RwLock<AutomationConfig>>) -> Result<Self, Box<dyn std::error::Error>> {
        let tts = Arc::new(Tts::default()?);
        let (alert_tx, alert_rx) = mpsc::channel(100);
        
        let voice_system = Self {
            config,
            tts: tts.clone(),
            alert_tx,
            _audio_stream: None,
            voice_profiles: Arc::new(RwLock::new(HashMap::new())),
        };

        // Start alert processing loop
        voice_system.start_alert_processor(alert_rx).await?;
        
        Ok(voice_system)
    }

    pub async fn initialize(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Load voice profiles
        self.load_voice_profiles().await?;

        // Initialize audio output
        self.initialize_audio().await?;

        Ok(())
    }

    pub async fn shutdown(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Stop audio processing
        self._audio_stream.as_ref().map(|stream| stream.pause());
        Ok(())
    }

    pub async fn speak(&self, message: &str, profile: &VoiceProfile) -> Result<(), Box<dyn std::error::Error>> {
        let tts = self.tts.clone();
        
        // Configure voice settings
        tts.set_voice(&profile.voice_id)?;
        tts.set_rate(profile.speed)?;
        tts.set_pitch(profile.pitch)?;
        tts.set_volume(profile.volume)?;

        // Speak the message
        tts.speak(message, false)?;

        Ok(())
    }

    pub async fn alert(&self, alert: VoiceAlert) -> Result<(), Box<dyn std::error::Error>> {
        self.alert_tx.send(alert).await?;
        Ok(())
    }

    async fn start_alert_processor(&self, mut alert_rx: mpsc::Receiver<VoiceAlert>) -> Result<(), Box<dyn std::error::Error>> {
        let tts = self.tts.clone();
        let config = self.config.clone();
        let voice_profiles = self.voice_profiles.clone();

        tokio::spawn(async move {
            while let Some(alert) = alert_rx.recv().await {
                if let Err(e) = Self::process_alert(&tts, &config, &voice_profiles, alert).await {
                    eprintln!("Error processing voice alert: {}", e);
                }
            }
        });

        Ok(())
    }

    async fn process_alert(
        tts: &Tts,
        config: &Arc<RwLock<AutomationConfig>>,
        voice_profiles: &Arc<RwLock<HashMap<String, VoiceProfile>>>,
        alert: VoiceAlert,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let config = config.read().await;
        
        // Skip if voice is disabled
        if !config.voice.enabled {
            return Ok(());
        }

        // Get appropriate voice profile
        let profile = if let Some(priority_profile) = config.voice.priority_profiles.iter()
            .find(|p| p.priority == alert.priority.to_string())
        {
            priority_profile.profile.clone()
        } else {
            config.voice.default_profile.clone()
        };

        // Configure voice
        tts.set_voice(&profile.voice_id)?;
        tts.set_rate(profile.speed)?;
        tts.set_pitch(profile.pitch)?;
        tts.set_volume(profile.volume)?;

        // Apply noise reduction if enabled
        if config.voice.noise_reduction_enabled {
            // TODO: Implement noise reduction
        }

        // Speak alert message
        tts.speak(&alert.message, false)?;

        Ok(())
    }

    async fn load_voice_profiles(&self) -> Result<(), Box<dyn std::error::Error>> {
        let config = self.config.read().await;
        let mut profiles = HashMap::new();

        // Load default profile
        profiles.insert("default".to_string(), config.voice.default_profile.clone());

        // Load priority profiles
        for priority_profile in &config.voice.priority_profiles {
            profiles.insert(
                priority_profile.priority.clone(),
                priority_profile.profile.clone(),
            );
        }

        *self.voice_profiles.write().await = profiles;
        Ok(())
    }

    async fn initialize_audio(&self) -> Result<(), Box<dyn std::error::Error>> {
        let host = cpal::default_host();
        let device = host.default_output_device()
            .ok_or("No output device available")?;

        let config = device.default_output_config()?;
        
        // TODO: Configure audio stream with noise reduction if enabled
        
        Ok(())
    }

    pub async fn create_alert(
        &self,
        message: String,
        priority: AlertPriority,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let config = self.config.read().await;
        
        let profile = if let Some(priority_profile) = config.voice.priority_profiles.iter()
            .find(|p| p.priority == priority.to_string())
        {
            priority_profile.profile.clone()
        } else {
            config.voice.default_profile.clone()
        };

        let alert = VoiceAlert {
            message,
            priority,
            profile,
        };

        self.alert(alert).await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_voice_system() {
        // Test implementation will go here
    }
}