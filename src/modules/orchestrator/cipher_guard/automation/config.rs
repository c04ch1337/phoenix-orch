use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use crate::modules::orchestrator::cipher_guard::automation::types::VoiceProfile;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationConfig {
    pub job_scheduler: JobSchedulerConfig,
    pub briefing: BriefingConfig,
    pub obsidian: ObsidianConfig,
    pub teams: TeamsConfig,
    pub voice: VoiceConfig,
    pub engine: EngineConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobSchedulerConfig {
    pub max_concurrent_jobs: usize,
    pub default_retry_policy: RetryPolicyConfig,
    pub job_history_retention_days: u32,
    pub metrics_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryPolicyConfig {
    pub max_attempts: u32,
    pub initial_backoff_seconds: u32,
    pub max_backoff_seconds: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BriefingConfig {
    pub max_incidents: usize,
    pub max_vulnerabilities: usize,
    pub template_path: PathBuf,
    pub output_path: PathBuf,
    pub data_retention_days: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObsidianConfig {
    pub vault_path: PathBuf,
    pub template_path: PathBuf,
    pub backup_path: PathBuf,
    pub watch_patterns: Vec<String>,
    pub auto_backup_enabled: bool,
    pub backup_interval_hours: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamsConfig {
    pub webhook_url: String,
    pub channel_id: String,
    pub notification_preferences: NotificationPreferences,
    pub message_retention_days: u32,
    pub rate_limit: RateLimitConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationPreferences {
    pub incident_threshold: String,
    pub vulnerability_threshold: String,
    pub alert_threshold: String,
    pub quiet_hours_start: String,
    pub quiet_hours_end: String,
    pub weekend_notifications: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    pub messages_per_minute: u32,
    pub burst_limit: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceConfig {
    pub enabled: bool,
    pub default_profile: VoiceProfile,
    pub priority_profiles: Vec<PriorityVoiceProfile>,
    pub audio_output_device: String,
    pub noise_reduction_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriorityVoiceProfile {
    pub priority: String,
    pub profile: VoiceProfile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineConfig {
    pub rules_path: PathBuf,
    pub templates_path: PathBuf,
    pub max_action_timeout_seconds: u32,
    pub audit_log_path: PathBuf,
    pub performance_monitoring: PerformanceMonitoringConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMonitoringConfig {
    pub enabled: bool,
    pub metrics_retention_days: u32,
    pub alert_threshold_ms: u32,
}

impl Default for AutomationConfig {
    fn default() -> Self {
        Self {
            job_scheduler: JobSchedulerConfig {
                max_concurrent_jobs: 10,
                default_retry_policy: RetryPolicyConfig {
                    max_attempts: 3,
                    initial_backoff_seconds: 30,
                    max_backoff_seconds: 3600,
                },
                job_history_retention_days: 30,
                metrics_enabled: true,
            },
            briefing: BriefingConfig {
                max_incidents: 5,
                max_vulnerabilities: 10,
                template_path: PathBuf::from("templates/briefing"),
                output_path: PathBuf::from("output/briefings"),
                data_retention_days: 90,
            },
            obsidian: ObsidianConfig {
                vault_path: PathBuf::from("vault"),
                template_path: PathBuf::from("templates/obsidian"),
                backup_path: PathBuf::from("backups/obsidian"),
                watch_patterns: vec!["*.md".to_string()],
                auto_backup_enabled: true,
                backup_interval_hours: 24,
            },
            teams: TeamsConfig {
                webhook_url: String::new(),
                channel_id: String::new(),
                notification_preferences: NotificationPreferences {
                    incident_threshold: "High".to_string(),
                    vulnerability_threshold: "Critical".to_string(),
                    alert_threshold: "High".to_string(),
                    quiet_hours_start: "22:00".to_string(),
                    quiet_hours_end: "06:00".to_string(),
                    weekend_notifications: false,
                },
                message_retention_days: 30,
                rate_limit: RateLimitConfig {
                    messages_per_minute: 30,
                    burst_limit: 5,
                },
            },
            voice: VoiceConfig {
                enabled: true,
                default_profile: VoiceProfile {
                    voice_id: "default".to_string(),
                    language: "en-US".to_string(),
                    speed: 1.0,
                    pitch: 1.0,
                    volume: 1.0,
                },
                priority_profiles: vec![],
                audio_output_device: "default".to_string(),
                noise_reduction_enabled: true,
            },
            engine: EngineConfig {
                rules_path: PathBuf::from("config/rules"),
                templates_path: PathBuf::from("config/templates"),
                max_action_timeout_seconds: 300,
                audit_log_path: PathBuf::from("logs/audit"),
                performance_monitoring: PerformanceMonitoringConfig {
                    enabled: true,
                    metrics_retention_days: 30,
                    alert_threshold_ms: 1000,
                },
            },
        }
    }
}

impl AutomationConfig {
    pub fn load_from_file(path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let config_str = std::fs::read_to_string(path)?;
        let config: AutomationConfig = serde_yaml::from_str(&config_str)?;
        Ok(config)
    }

    pub fn save_to_file(&self, path: &str) -> Result<(), Box<dyn std::error::Error>> {
        let config_str = serde_yaml::to_string(self)?;
        std::fs::write(path, config_str)?;
        Ok(())
    }
}