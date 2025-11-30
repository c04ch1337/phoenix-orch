use tokio::sync::mpsc;
use candle_core::{Device, Tensor};
use crate::modules::report_squad::types::{Evidence, Finding};
use std::sync::Arc;
use tracing::{info, error};

pub struct EvidenceParser {
    input_rx: mpsc::Receiver<String>,
    output_tx: mpsc::Sender<Evidence>,
    model: Arc<LoraModel>,
    device: Device,
}

impl EvidenceParser {
    pub async fn new(
        input_rx: mpsc::Receiver<String>,
        output_tx: mpsc::Sender<Evidence>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let device = Device::cuda_if_available(0)?;
        let model = Arc::new(LoraModel::load("models/evidence_parser.safetensors", &device)?);
        
        Ok(Self {
            input_rx,
            output_tx,
            model,
            device,
        })
    }

    pub async fn run(&mut self) {
        info!("Evidence Parser Agent started");
        
        while let Some(raw_evidence) = self.input_rx.recv().await {
            match self.process_evidence(raw_evidence).await {
                Ok(evidence) => {
                    if let Err(e) = self.output_tx.send(evidence).await {
                        error!("Failed to send processed evidence: {}", e);
                    }
                }
                Err(e) => error!("Failed to process evidence: {}", e),
            }
        }
    }

    async fn process_evidence(&self, raw_evidence: String) -> Result<Evidence, Box<dyn std::error::Error>> {
        // Prepare input tensor
        let input = self.prepare_input(&raw_evidence)?;
        
        // Run inference
        let output = self.model.forward(&input)?;
        
        // Parse model output into Evidence struct
        let evidence = self.parse_output(output, raw_evidence)?;
        
        // Capture screenshot if needed
        if evidence.evidence_type == "visual" {
            self.capture_screenshot(&evidence).await?;
        }

        Ok(evidence)
    }

    fn prepare_input(&self, text: &str) -> Result<Tensor, Box<dyn std::error::Error>> {
        // Tokenize and encode input for the model
        let tokens = self.model.tokenize(text)?;
        let input = Tensor::new(tokens.as_slice(), &self.device)?;
        Ok(input)
    }

    fn parse_output(&self, output: Tensor, raw_data: String) -> Result<Evidence, Box<dyn std::error::Error>> {
        // Convert model output into Evidence struct
        let evidence = Evidence {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            evidence_type: self.determine_evidence_type(&output)?,
            description: self.generate_description(&output)?,
            data: raw_data,
            screenshot_path: None,
        };
        
        Ok(evidence)
    }

    async fn capture_screenshot(&self, evidence: &Evidence) -> Result<(), Box<dyn std::error::Error>> {
        // Implement screenshot capture logic here
        // This will be called only for visual evidence types
        Ok(())
    }

    fn determine_evidence_type(&self, output: &Tensor) -> Result<String, Box<dyn std::error::Error>> {
        // Implement evidence type classification logic
        Ok("text".to_string()) // Placeholder
    }

    fn generate_description(&self, output: &Tensor) -> Result<String, Box<dyn std::error::Error>> {
        // Implement description generation logic
        Ok("Evidence description".to_string()) // Placeholder
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_evidence_parser() {
        // Add tests here
    }
}