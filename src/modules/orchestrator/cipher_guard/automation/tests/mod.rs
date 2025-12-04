use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::Utc;
use std::collections::HashMap;
use tempfile::TempDir;

use crate::modules::orchestrator::cipher_guard::automation::{
    config::AutomationConfig,
    types::*,
    job_scheduler::JobScheduler,
    briefing::BriefingGenerator,
    obsidian::ObsidianIntegration,
    teams::TeamsIntegration,
    voice::VoiceSystem,
    engine::AutomationEngine,
};

mod test_utils {
    use super::*;

    pub async fn create_test_config() -> (AutomationConfig, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let base_path = temp_dir.path();

        let config = AutomationConfig {
            job_scheduler: Default::default(),
            briefing: Default::default(),
            obsidian: Default::default(),
            teams: Default::default(),
            voice: Default::default(),
            engine: Default::default(),
        };

        // Update paths to use temp directory
        let mut config = config;
        config.briefing.output_path = base_path.join("briefings");
        config.obsidian.vault_path = base_path.join("vault");
        config.obsidian.backup_path = base_path.join("backups");
        config.engine.audit_log_path = base_path.join("logs");

        (config, temp_dir)
    }

    pub fn create_test_incident() -> Incident {
        Incident {
            id: "TEST-001".to_string(),
            title: "Test Incident".to_string(),
            severity: Severity::High,
            status: "Active".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    pub fn create_test_vulnerability() -> Vulnerability {
        Vulnerability {
            id: "VUL-001".to_string(),
            title: "Test Vulnerability".to_string(),
            severity: Severity::Critical,
            cvss_score: 9.8,
            discovered_at: Utc::now(),
        }
    }
}

#[tokio::test]
async fn test_job_scheduler() {
    let (config, _temp) = test_utils::create_test_config().await;
    let config = Arc::new(RwLock::new(config));
    
    let scheduler = JobScheduler::new(config.clone()).await.unwrap();
    
    // Test job creation
    let job = JobDefinition {
        id: "test-job".to_string(),
        name: "Test Job".to_string(),
        schedule: "*/5 * * * *".to_string(),
        enabled: true,
        retry_policy: RetryPolicy {
            max_attempts: 3,
            backoff_seconds: 30,
            max_backoff_seconds: 300,
        },
        actions: vec![],
        conditions: vec![],
    };
    
    scheduler.add_job(job.clone()).await.unwrap();
    
    // Verify job was added
    let status = scheduler.get_job_status(&job.id).await.unwrap();
    assert_eq!(status.status, JobState::Pending);
}

#[tokio::test]
async fn test_briefing_generation() {
    let (config, _temp) = test_utils::create_test_config().await;
    let config = Arc::new(RwLock::new(config));
    
    let generator = BriefingGenerator::new(config).await.unwrap();
    let briefing = generator.generate_daily_briefing().await.unwrap();
    
    assert!(briefing.generated_at <= Utc::now());
    assert!(!briefing.recommendations.is_empty());
}

#[tokio::test]
async fn test_obsidian_integration() {
    let (config, _temp) = test_utils::create_test_config().await;
    let config = Arc::new(RwLock::new(config));
    
    let mut integration = ObsidianIntegration::new(config).await.unwrap();
    
    // Test note creation
    let mut params = HashMap::new();
    params.insert("title".to_string(), "Test Note".to_string());
    
    let note_path = integration.create_note("test", params).await.unwrap();
    assert!(note_path.exists());
    
    // Test file watcher
    integration.start_file_watcher().await.unwrap();
    integration.stop_file_watcher().await.unwrap();
}

#[tokio::test]
async fn test_teams_integration() {
    let (config, _temp) = test_utils::create_test_config().await;
    let config = Arc::new(RwLock::new(config));
    
    let integration = TeamsIntegration::new(config).await.unwrap();
    
    // Test message creation
    let incident = test_utils::create_test_incident();
    integration.post_incident_alert(&incident).await.unwrap();
    
    // Test connection lifecycle
    integration.connect().await.unwrap();
    integration.disconnect().await.unwrap();
}

#[tokio::test]
async fn test_voice_system() {
    let (config, _temp) = test_utils::create_test_config().await;
    let config = Arc::new(RwLock::new(config));
    
    let system = VoiceSystem::new(config).await.unwrap();
    
    // Test voice alert
    let alert = VoiceAlert {
        message: "Test alert".to_string(),
        priority: AlertPriority::High,
        profile: VoiceProfile {
            voice_id: "test".to_string(),
            language: "en-US".to_string(),
            speed: 1.0,
            pitch: 1.0,
            volume: 1.0,
        },
    };
    
    system.alert(alert).await.unwrap();
}

#[tokio::test]
async fn test_automation_engine() {
    let (config, _temp) = test_utils::create_test_config().await;
    let config = Arc::new(RwLock::new(config));
    
    let engine = AutomationEngine::new(config).await.unwrap();
    
    // Test action execution
    let action = AutomationAction {
        action_type: ActionType::GenerateBriefing,
        parameters: HashMap::new(),
    };
    
    engine.execute_action(&action).await.unwrap();
    
    // Test condition evaluation
    let condition = AutomationCondition {
        condition_type: ConditionType::TimeWindow,
        parameters: HashMap::new(),
    };
    
    let result = engine.evaluate_condition(&condition).await.unwrap();
    assert!(result);
}

#[tokio::test]
async fn test_integration_workflow() {
    let (config, _temp) = test_utils::create_test_config().await;
    let config = Arc::new(RwLock::new(config));
    
    // Initialize all components
    let scheduler = JobScheduler::new(config.clone()).await.unwrap();
    let generator = BriefingGenerator::new(config.clone()).await.unwrap();
    let obsidian = ObsidianIntegration::new(config.clone()).await.unwrap();
    let teams = TeamsIntegration::new(config.clone()).await.unwrap();
    let voice = VoiceSystem::new(config.clone()).await.unwrap();
    let engine = AutomationEngine::new(config.clone()).await.unwrap();
    
    // Test complete workflow
    // 1. Create and schedule a job
    let job = JobDefinition {
        id: "test-workflow".to_string(),
        name: "Test Workflow".to_string(),
        schedule: "*/5 * * * *".to_string(),
        enabled: true,
        retry_policy: RetryPolicy {
            max_attempts: 3,
            backoff_seconds: 30,
            max_backoff_seconds: 300,
        },
        actions: vec![
            AutomationAction {
                action_type: ActionType::GenerateBriefing,
                parameters: HashMap::new(),
            },
            AutomationAction {
                action_type: ActionType::PostToTeams,
                parameters: HashMap::new(),
            },
        ],
        conditions: vec![],
    };
    
    scheduler.add_job(job.clone()).await.unwrap();
    
    // 2. Generate a briefing
    let briefing = generator.generate_daily_briefing().await.unwrap();
    
    // 3. Create Obsidian note
    let mut params = HashMap::new();
    params.insert("title".to_string(), "Integration Test".to_string());
    obsidian.create_note("test", params).await.unwrap();
    
    // 4. Post to Teams
    teams.connect().await.unwrap();
    teams.post_daily_briefing(&briefing).await.unwrap();
    teams.disconnect().await.unwrap();
    
    // 5. Create voice alert
    let alert = VoiceAlert {
        message: "Integration test complete".to_string(),
        priority: AlertPriority::Normal,
        profile: VoiceProfile {
            voice_id: "test".to_string(),
            language: "en-US".to_string(),
            speed: 1.0,
            pitch: 1.0,
            volume: 1.0,
        },
    };
    
    voice.alert(alert).await.unwrap();
    
    // 6. Execute automation action
    let action = AutomationAction {
        action_type: ActionType::GenerateBriefing,
        parameters: HashMap::new(),
    };
    
    engine.execute_action(&action).await.unwrap();
}