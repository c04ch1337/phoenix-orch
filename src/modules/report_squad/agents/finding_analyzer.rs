use tokio::sync::mpsc;
use candle_core::{Device, Tensor};
use crate::modules::report_squad::{
    types::{Evidence, Finding, Cvss, AffectedAsset, Remediation, AttackPath},
    conscience::ConscienceGate,
};
use std::sync::Arc;
use tracing::{info, error};

pub struct FindingAnalyzer {
    evidence_rx: mpsc::Receiver<Evidence>,
    finding_tx: mpsc::Sender<Finding>,
    model: Arc<LoraModel>,
    device: Device,
    conscience: Arc<ConscienceGate>,
}

impl FindingAnalyzer {
    pub async fn new(
        evidence_rx: mpsc::Receiver<Evidence>,
        finding_tx: mpsc::Sender<Finding>,
        conscience: Arc<ConscienceGate>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let device = Device::cuda_if_available(0)?;
        let model = Arc::new(LoraModel::load("models/finding_analyzer.safetensors", &device)?);
        
        Ok(Self {
            evidence_rx,
            finding_tx,
            model,
            device,
            conscience,
        })
    }

    pub async fn run(&mut self) {
        info!("Finding Analyzer Agent started");
        
        while let Some(evidence) = self.evidence_rx.recv().await {
            match self.analyze_evidence(evidence).await {
                Ok(finding) => {
                    // Run through conscience gate
                    let description = finding.description.clone();
                    if let Ok(true) = self.conscience.evaluate_risk(&description).await {
                        if let Err(e) = self.finding_tx.send(finding).await {
                            error!("Failed to send finding: {}", e);
                        }
                    } else {
                        error!("Finding rejected by conscience gate");
                    }
                }
                Err(e) => error!("Failed to analyze evidence: {}", e),
            }
        }
    }

    async fn analyze_evidence(&self, evidence: Evidence) -> Result<Finding, Box<dyn std::error::Error>> {
        // Prepare input tensor
        let input = self.prepare_input(&evidence)?;
        
        // Run inference
        let output = self.model.forward(&input)?;
        
        // Parse model output into Finding struct
        let finding = self.parse_output(output, evidence)?;
        
        // Check for jargon
        let description = self.conscience.check_jargon(&finding.description).await?;
        
        // Generate signature
        let signature = self.conscience.sign_content(&finding.description).await?;
        
        Ok(Finding {
            description,
            signature: Some(signature),
            ..finding
        })
    }

    fn prepare_input(&self, evidence: &Evidence) -> Result<Tensor, Box<dyn std::error::Error>> {
        // Tokenize and encode evidence for the model
        let tokens = self.model.tokenize(&evidence.data)?;
        let input = Tensor::new(tokens.as_slice(), &self.device)?;
        Ok(input)
    }

    fn parse_output(&self, output: Tensor, evidence: Evidence) -> Result<Finding, Box<dyn std::error::Error>> {
        // Convert model output into Finding components
        let cvss = self.generate_cvss(&output)?;
        let affected_assets = self.identify_affected_assets(&output)?;
        let remediation = self.generate_remediation(&output)?;
        let attack_path = self.analyze_attack_path(&output)?;
        
        let finding = Finding {
            id: uuid::Uuid::new_v4().to_string(),
            title: self.generate_title(&output)?,
            description: self.generate_description(&output)?,
            severity: self.determine_severity(&cvss),
            cvss,
            affected_assets,
            evidence: vec![evidence],
            remediation,
            attack_path,
            metadata: Default::default(),
            signature: None,
        };
        
        Ok(finding)
    }

    fn generate_cvss(&self, output: &Tensor) -> Result<Cvss, Box<dyn std::error::Error>> {
        // Implement CVSS score generation
        Ok(Cvss {
            score: 7.5,
            vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H".to_string(),
            version: "3.1".to_string(),
        })
    }

    fn identify_affected_assets(&self, output: &Tensor) -> Result<Vec<AffectedAsset>, Box<dyn std::error::Error>> {
        // Implement asset identification logic
        Ok(vec![])
    }

    fn generate_remediation(&self, output: &Tensor) -> Result<Remediation, Box<dyn std::error::Error>> {
        // Implement remediation generation logic
        Ok(Remediation {
            recommendation: "Implement security controls".to_string(),
            effort: "Medium".to_string(),
            priority: "High".to_string(),
            steps: vec![],
            references: vec![],
        })
    }

    fn analyze_attack_path(&self, output: &Tensor) -> Result<AttackPath, Box<dyn std::error::Error>> {
        // Implement attack path analysis
        Ok(AttackPath {
            steps: vec![],
            prerequisites: vec![],
            impact_chain: vec![],
        })
    }

    fn generate_title(&self, output: &Tensor) -> Result<String, Box<dyn std::error::Error>> {
        // Implement title generation logic
        Ok("Security Finding".to_string())
    }

    fn generate_description(&self, output: &Tensor) -> Result<String, Box<dyn std::error::Error>> {
        // Implement description generation logic
        Ok("Finding description".to_string())
    }

    fn determine_severity(&self, cvss: &Cvss) -> String {
        match cvss.score {
            s if s >= 9.0 => "Critical",
            s if s >= 7.0 => "High",
            s if s >= 4.0 => "Medium",
            _ => "Low",
        }.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_finding_analyzer() {
        // Add tests here
    }
}