mod agents;
mod conscience;
mod types;
mod workflow;

use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{info, error};

pub use types::{
    Finding,
    Evidence,
    AffectedAsset,
    Remediation,
    Cvss,
    AttackPath,
    EngagementMetadata,
};

pub struct ReportSquad {
    agent_orchestrator: agents::AgentOrchestrator,
    conscience_gate: Arc<conscience::ConscienceGate>,
    workflow: workflow::ReportWorkflow,
}

impl ReportSquad {
    pub async fn new(engagement_id: String) -> Result<Self, Box<dyn std::error::Error>> {
        let conscience_gate = Arc::new(conscience::ConscienceGate::new(0.8));
        let agent_orchestrator = agents::AgentOrchestrator::new().await?;
        let workflow = workflow::ReportWorkflow::new(engagement_id).await?;

        Ok(Self {
            agent_orchestrator,
            conscience_gate,
            workflow,
        })
    }

    pub async fn initialize(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        info!("Initializing Report Squad");
        
        // Start agent orchestrator
        self.agent_orchestrator.start_agents().await?;
        
        // Initialize workflow
        self.workflow.run().await?;
        
        info!("Report Squad initialized successfully");
        Ok(())
    }

    pub async fn generate_report(&mut self, raw_evidence: Vec<String>) -> Result<String, Box<dyn std::error::Error>> {
        info!("Starting report generation process");
        
        // Validate through conscience gate
        let evidence_summary = format!("Processing {} pieces of evidence", raw_evidence.len());
        if let Ok(true) = self.conscience_gate.evaluate_risk(&evidence_summary).await {
            // Trigger workflow
            self.workflow.trigger_generation(raw_evidence).await?;
            
            // Wait for exported report path
            let report_path = self.agent_orchestrator.get_exported_path().await?;
            
            info!("Report generated successfully: {}", report_path.display());
            Ok(report_path.to_string_lossy().into_owned())
        } else {
            error!("Report generation rejected by conscience gate");
            Err("Report generation rejected by conscience gate".into())
        }
    }

    pub async fn collect_artifacts(&self) -> Result<(), Box<dyn std::error::Error>> {
        info!("Collecting artifacts");
        self.workflow.collect_artifacts().await
    }

    pub async fn export_reports(&self) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        info!("Exporting reports");
        self.workflow.export_reports().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_report_squad() {
        // Create test instance
        let mut squad = ReportSquad::new("test_engagement".to_string())
            .await
            .expect("Failed to create Report Squad");

        // Initialize
        squad.initialize()
            .await
            .expect("Failed to initialize Report Squad");

        // Test report generation
        let evidence = vec!["Test evidence".to_string()];
        let report_path = squad.generate_report(evidence)
            .await
            .expect("Failed to generate report");

        assert!(!report_path.is_empty());
    }
}

// Public API
pub async fn create_report_squad(engagement_id: String) -> Result<ReportSquad, Box<dyn std::error::Error>> {
    let mut squad = ReportSquad::new(engagement_id).await?;
    squad.initialize().await?;
    Ok(squad)
}

pub async fn generate_report(
    squad: &mut ReportSquad,
    evidence: Vec<String>,
) -> Result<String, Box<dyn std::error::Error>> {
    squad.generate_report(evidence).await
}

pub async fn collect_artifacts(
    squad: &ReportSquad,
) -> Result<(), Box<dyn std::error::Error>> {
    squad.collect_artifacts().await
}

pub async fn export_reports(
    squad: &ReportSquad,
) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    squad.export_reports().await
}