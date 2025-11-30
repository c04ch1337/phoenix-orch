use tokio::sync::mpsc;
use std::sync::Arc;
use tracing::info;

pub mod evidence_parser;
pub mod finding_analyzer;
pub mod template_manager;
pub mod risk_scorer;
pub mod asset_analyzer;
pub mod remediation_planner;
pub mod quality_control;
pub mod exporter;

use crate::modules::report_squad::{
    types::Finding,
    conscience::ConscienceGate,
};

pub struct AgentOrchestrator {
    conscience: Arc<ConscienceGate>,
    channels: AgentChannels,
}

struct AgentChannels {
    raw_evidence: (mpsc::Sender<String>, mpsc::Receiver<String>),
    parsed_evidence: (mpsc::Sender<Finding>, mpsc::Receiver<Finding>),
    analyzed_findings: (mpsc::Sender<Finding>, mpsc::Receiver<Finding>),
    templated_findings: (mpsc::Sender<Finding>, mpsc::Receiver<Finding>),
    scored_findings: (mpsc::Sender<Finding>, mpsc::Receiver<Finding>),
    asset_analyzed: (mpsc::Sender<Finding>, mpsc::Receiver<Finding>),
    remediated: (mpsc::Sender<Finding>, mpsc::Receiver<Finding>),
    quality_checked: (mpsc::Sender<Finding>, mpsc::Receiver<Finding>),
    exported: (mpsc::Sender<std::path::PathBuf>, mpsc::Receiver<std::path::PathBuf>),
}

impl AgentOrchestrator {
    pub async fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let conscience = Arc::new(ConscienceGate::new(0.8));
        let channels = Self::create_channels();
        
        Ok(Self {
            conscience,
            channels,
        })
    }

    fn create_channels() -> AgentChannels {
        AgentChannels {
            raw_evidence: mpsc::channel(100),
            parsed_evidence: mpsc::channel(100),
            analyzed_findings: mpsc::channel(100),
            templated_findings: mpsc::channel(100),
            scored_findings: mpsc::channel(100),
            asset_analyzed: mpsc::channel(100),
            remediated: mpsc::channel(100),
            quality_checked: mpsc::channel(100),
            exported: mpsc::channel(100),
        }
    }

    pub async fn start_agents(&self) -> Result<(), Box<dyn std::error::Error>> {
        info!("Starting Report Squad Agents");

        // Initialize all agents
        let mut evidence_parser = evidence_parser::EvidenceParser::new(
            self.channels.raw_evidence.1.clone(),
            self.channels.parsed_evidence.0.clone(),
        ).await?;

        let mut finding_analyzer = finding_analyzer::FindingAnalyzer::new(
            self.channels.parsed_evidence.1.clone(),
            self.channels.analyzed_findings.0.clone(),
            self.conscience.clone(),
        ).await?;

        let mut template_manager = template_manager::TemplateManager::new(
            self.channels.analyzed_findings.1.clone(),
            self.channels.templated_findings.0.clone(),
            self.conscience.clone(),
        ).await?;

        let mut risk_scorer = risk_scorer::RiskScorer::new(
            self.channels.templated_findings.1.clone(),
            self.channels.scored_findings.0.clone(),
            self.conscience.clone(),
        ).await?;

        let mut asset_analyzer = asset_analyzer::AssetAnalyzer::new(
            self.channels.scored_findings.1.clone(),
            self.channels.asset_analyzed.0.clone(),
            self.conscience.clone(),
        ).await?;

        let mut remediation_planner = remediation_planner::RemediationPlanner::new(
            self.channels.asset_analyzed.1.clone(),
            self.channels.remediated.0.clone(),
            self.conscience.clone(),
        ).await?;

        let mut quality_control = quality_control::QualityControl::new(
            self.channels.remediated.1.clone(),
            self.channels.quality_checked.0.clone(),
            self.conscience.clone(),
        ).await?;

        let mut exporter = exporter::Exporter::new(
            self.channels.quality_checked.1.clone(),
            self.channels.exported.0.clone(),
            self.conscience.clone(),
            std::path::PathBuf::from("reports"),
        ).await?;

        // Spawn all agent tasks
        tokio::spawn(async move { evidence_parser.run().await });
        tokio::spawn(async move { finding_analyzer.run().await });
        tokio::spawn(async move { template_manager.run().await });
        tokio::spawn(async move { risk_scorer.run().await });
        tokio::spawn(async move { asset_analyzer.run().await });
        tokio::spawn(async move { remediation_planner.run().await });
        tokio::spawn(async move { quality_control.run().await });
        tokio::spawn(async move { exporter.run().await });

        info!("All Report Squad Agents started successfully");
        Ok(())
    }

    pub async fn submit_evidence(&self, evidence: String) -> Result<(), Box<dyn std::error::Error>> {
        self.channels.raw_evidence.0.send(evidence).await?;
        Ok(())
    }

    pub async fn get_exported_path(&self) -> Result<std::path::PathBuf, Box<dyn std::error::Error>> {
        Ok(self.channels.exported.1.recv().await.unwrap())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_agent_orchestrator() {
        // Add integration tests here
    }
}