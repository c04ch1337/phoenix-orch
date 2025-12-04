use std::sync::Arc;
use tokio::sync::RwLock;

pub mod job_scheduler;
pub mod briefing;
pub mod obsidian;
pub mod teams;
pub mod voice;
pub mod engine;
pub mod config;
pub mod types;

#[derive(Clone)]
pub struct AutomationSystem {
    config: Arc<RwLock<config::AutomationConfig>>,
    job_scheduler: Arc<job_scheduler::JobScheduler>,
    briefing_generator: Arc<briefing::BriefingGenerator>,
    obsidian_integration: Arc<obsidian::ObsidianIntegration>,
    teams_integration: Arc<teams::TeamsIntegration>,
    voice_system: Arc<voice::VoiceSystem>,
    automation_engine: Arc<engine::AutomationEngine>,
}

impl AutomationSystem {
    pub async fn new(config: config::AutomationConfig) -> Result<Self, Box<dyn std::error::Error>> {
        let config = Arc::new(RwLock::new(config));
        
        let job_scheduler = Arc::new(job_scheduler::JobScheduler::new(config.clone()).await?);
        let briefing_generator = Arc::new(briefing::BriefingGenerator::new(config.clone()).await?);
        let obsidian_integration = Arc::new(obsidian::ObsidianIntegration::new(config.clone()).await?);
        let teams_integration = Arc::new(teams::TeamsIntegration::new(config.clone()).await?);
        let voice_system = Arc::new(voice::VoiceSystem::new(config.clone()).await?);
        let automation_engine = Arc::new(engine::AutomationEngine::new(config.clone()).await?);

        Ok(Self {
            config,
            job_scheduler,
            briefing_generator,
            obsidian_integration,
            teams_integration,
            voice_system,
            automation_engine,
        })
    }

    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        self.job_scheduler.start().await?;
        self.obsidian_integration.start_file_watcher().await?;
        self.teams_integration.connect().await?;
        self.voice_system.initialize().await?;
        self.automation_engine.start().await?;
        Ok(())
    }

    pub async fn stop(&self) -> Result<(), Box<dyn std::error::Error>> {
        self.automation_engine.stop().await?;
        self.voice_system.shutdown().await?;
        self.teams_integration.disconnect().await?;
        self.obsidian_integration.stop_file_watcher().await?;
        self.job_scheduler.stop().await?;
        Ok(())
    }
}