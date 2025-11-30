use tokio::sync::mpsc;
use std::sync::Arc;
use tracing::{info, error};
use candle_core::{Device, Tensor};
use crate::modules::report_squad::{
    types::{Finding, Cvss},
    conscience::ConscienceGate,
};

pub struct RiskScorer {
    finding_rx: mpsc::Receiver<Finding>,
    scored_tx: mpsc::Sender<Finding>,
    model: Arc<LoraModel>,
    device: Device,
    conscience: Arc<ConscienceGate>,
}

impl RiskScorer {
    pub async fn new(
        finding_rx: mpsc::Receiver<Finding>,
        scored_tx: mpsc::Sender<Finding>,
        conscience: Arc<ConscienceGate>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let device = Device::cuda_if_available(0)?;
        let model = Arc::new(LoraModel::load("models/risk_scorer.safetensors", &device)?);
        
        Ok(Self {
            finding_rx,
            scored_tx,
            model,
            device,
            conscience,
        })
    }

    pub async fn run(&mut self) {
        info!("Risk Scorer Agent started");
        
        while let Some(mut finding) = self.finding_rx.recv().await {
            match self.assess_risk(&mut finding).await {
                Ok(()) => {
                    // Validate through conscience gate
                    let risk_desc = format!(
                        "CVSS:{} - {} severity finding affecting {} assets",
                        finding.cvss.score,
                        finding.severity,
                        finding.affected_assets.len()
                    );
                    
                    if let Ok(true) = self.conscience.evaluate_risk(&risk_desc).await {
                        if let Err(e) = self.scored_tx.send(finding).await {
                            error!("Failed to send scored finding: {}", e);
                        }
                    } else {
                        error!("Risk assessment rejected by conscience gate");
                    }
                }
                Err(e) => error!("Failed to assess risk: {}", e),
            }
        }
    }

    async fn assess_risk(&self, finding: &mut Finding) -> Result<(), Box<dyn std::error::Error>> {
        // Prepare input tensor
        let input = self.prepare_input(finding)?;
        
        // Run risk assessment model
        let output = self.model.forward(&input)?;
        
        // Update CVSS and severity based on model output
        self.update_risk_metrics(finding, &output)?;
        
        // Add risk context
        self.add_risk_context(finding)?;
        
        Ok(())
    }

    fn prepare_input(&self, finding: &Finding) -> Result<Tensor, Box<dyn std::error::Error>> {
        // Combine relevant finding attributes for risk assessment
        let input_text = format!(
            "Description: {}\nAffected Assets: {}\nAttack Path: {}\nEvidence: {}",
            finding.description,
            finding.affected_assets.iter().map(|a| &a.name).collect::<Vec<_>>().join(", "),
            finding.attack_path.steps.join(" -> "),
            finding.evidence.iter().map(|e| &e.description).collect::<Vec<_>>().join("\n")
        );
        
        // Tokenize and encode
        let tokens = self.model.tokenize(&input_text)?;
        let input = Tensor::new(tokens.as_slice(), &self.device)?;
        
        Ok(input)
    }

    fn update_risk_metrics(&self, finding: &mut Finding, output: &Tensor) -> Result<(), Box<dyn std::error::Error>> {
        // Extract risk scores from model output
        let scores = self.extract_risk_scores(output)?;
        
        // Update CVSS
        finding.cvss = Cvss {
            score: scores.cvss_score,
            vector: self.generate_cvss_vector(&scores)?,
            version: "3.1".to_string(),
        };
        
        // Update severity based on CVSS score
        finding.severity = match finding.cvss.score {
            s if s >= 9.0 => "Critical",
            s if s >= 7.0 => "High",
            s if s >= 4.0 => "Medium",
            _ => "Low",
        }.to_string();
        
        Ok(())
    }

    fn extract_risk_scores(&self, output: &Tensor) -> Result<RiskScores, Box<dyn std::error::Error>> {
        // Extract various risk metrics from model output
        Ok(RiskScores {
            cvss_score: 7.5, // Placeholder
            impact_score: 0.0,
            exploitability_score: 0.0,
            temporal_score: 0.0,
        })
    }

    fn generate_cvss_vector(&self, scores: &RiskScores) -> Result<String, Box<dyn std::error::Error>> {
        // Generate CVSS vector string based on risk assessment
        Ok("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H".to_string()) // Placeholder
    }

    fn add_risk_context(&self, finding: &mut Finding) -> Result<(), Box<dyn std::error::Error>> {
        // Add risk-related context to the finding description
        let risk_context = format!(
            "\n\nRisk Context:\n- CVSS Score: {}\n- Severity: {}\n- Number of affected assets: {}\n",
            finding.cvss.score,
            finding.severity,
            finding.affected_assets.len()
        );
        
        finding.description.push_str(&risk_context);
        Ok(())
    }
}

struct RiskScores {
    cvss_score: f32,
    impact_score: f32,
    exploitability_score: f32,
    temporal_score: f32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_risk_scorer() {
        // Add tests here
    }
}