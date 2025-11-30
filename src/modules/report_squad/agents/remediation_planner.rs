use tokio::sync::mpsc;
use std::sync::Arc;
use tracing::{info, error};
use candle_core::{Device, Tensor};
use crate::modules::report_squad::{
    types::{Finding, Remediation},
    conscience::ConscienceGate,
};

pub struct RemediationPlanner {
    finding_rx: mpsc::Receiver<Finding>,
    remediated_tx: mpsc::Sender<Finding>,
    model: Arc<LoraModel>,
    device: Device,
    conscience: Arc<ConscienceGate>,
    knowledge_base: Arc<RemediationKnowledgeBase>,
}

struct RemediationKnowledgeBase {
    controls: tokio::sync::RwLock<std::collections::HashMap<String, Vec<Control>>>,
    references: tokio::sync::RwLock<std::collections::HashMap<String, Vec<Reference>>>,
}

#[derive(Clone)]
struct Control {
    id: String,
    name: String,
    description: String,
    implementation_steps: Vec<String>,
    effectiveness: f32,
    effort: String,
}

#[derive(Clone)]
struct Reference {
    title: String,
    url: String,
    framework: String,
    relevance_score: f32,
}

impl RemediationPlanner {
    pub async fn new(
        finding_rx: mpsc::Receiver<Finding>,
        remediated_tx: mpsc::Sender<Finding>,
        conscience: Arc<ConscienceGate>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let device = Device::cuda_if_available(0)?;
        let model = Arc::new(LoraModel::load("models/remediation_planner.safetensors", &device)?);
        let knowledge_base = Arc::new(RemediationKnowledgeBase::new());
        
        Ok(Self {
            finding_rx,
            remediated_tx,
            model,
            device,
            conscience,
            knowledge_base,
        })
    }

    pub async fn run(&mut self) {
        info!("Remediation Planner Agent started");
        
        while let Some(mut finding) = self.finding_rx.recv().await {
            match self.plan_remediation(&mut finding).await {
                Ok(()) => {
                    // Validate through conscience gate
                    let remediation_plan = self.generate_plan_summary(&finding.remediation);
                    if let Ok(true) = self.conscience.evaluate_risk(&remediation_plan).await {
                        if let Ok(simplified) = self.conscience.check_jargon(&remediation_plan).await {
                            finding.remediation.recommendation = simplified;
                            if let Err(e) = self.remediated_tx.send(finding).await {
                                error!("Failed to send remediated finding: {}", e);
                            }
                        }
                    } else {
                        error!("Remediation plan rejected by conscience gate");
                    }
                }
                Err(e) => error!("Failed to plan remediation: {}", e),
            }
        }
    }

    async fn plan_remediation(&self, finding: &mut Finding) -> Result<(), Box<dyn std::error::Error>> {
        // Analyze finding context
        let context = self.analyze_context(finding)?;
        
        // Identify applicable controls
        let controls = self.identify_controls(&context).await?;
        
        // Generate remediation steps
        let steps = self.generate_steps(&controls, finding)?;
        
        // Find relevant references
        let references = self.find_references(&context).await?;
        
        // Create remediation plan
        finding.remediation = Remediation {
            recommendation: self.generate_recommendation(&controls, finding)?,
            effort: self.estimate_effort(&controls),
            priority: self.determine_priority(finding),
            steps,
            references: references.iter().map(|r| r.url.clone()).collect(),
        };
        
        Ok(())
    }

    fn analyze_context(&self, finding: &Finding) -> Result<String, Box<dyn std::error::Error>> {
        // Prepare input for context analysis
        let input_text = format!(
            "Finding: {}\nDescription: {}\nSeverity: {}\nCVSS: {}\nAssets: {}\nAttack Path: {}",
            finding.title,
            finding.description,
            finding.severity,
            finding.cvss.vector,
            finding.affected_assets.iter().map(|a| &a.name).collect::<Vec<_>>().join(", "),
            finding.attack_path.steps.join(" -> ")
        );
        
        // Tokenize and encode
        let tokens = self.model.tokenize(&input_text)?;
        let input = Tensor::new(tokens.as_slice(), &self.device)?;
        
        // Run context analysis model
        let output = self.model.forward(&input)?;
        
        // Parse output into context string
        self.parse_context(&output)
    }

    async fn identify_controls(&self, context: &str) -> Result<Vec<Control>, Box<dyn std::error::Error>> {
        let controls = self.knowledge_base.controls.read().await;
        
        // Filter controls based on context relevance
        let mut relevant_controls = Vec::new();
        for controls_list in controls.values() {
            for control in controls_list {
                if self.is_control_relevant(control, context) {
                    relevant_controls.push(control.clone());
                }
            }
        }
        
        // Sort by effectiveness
        relevant_controls.sort_by(|a, b| b.effectiveness.partial_cmp(&a.effectiveness).unwrap());
        
        Ok(relevant_controls)
    }

    fn generate_steps(&self, controls: &[Control], finding: &Finding) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let mut steps = Vec::new();
        
        // Add verification step
        steps.push("1. Verify the vulnerability exists and reproduce the issue in a controlled environment".to_string());
        
        // Add control implementation steps
        for (i, control) in controls.iter().enumerate() {
            for (j, step) in control.implementation_steps.iter().enumerate() {
                steps.push(format!("{}. {}", i * control.implementation_steps.len() + j + 2, step));
            }
        }
        
        // Add validation steps
        steps.push("Validate fixes:".to_string());
        for step in &finding.attack_path.steps {
            steps.push(format!("- Verify that {} is no longer possible", step));
        }
        
        Ok(steps)
    }

    async fn find_references(&self, context: &str) -> Result<Vec<Reference>, Box<dyn std::error::Error>> {
        let references = self.knowledge_base.references.read().await;
        
        // Filter references based on context relevance
        let mut relevant_refs = Vec::new();
        for refs_list in references.values() {
            for reference in refs_list {
                if reference.relevance_score > 0.7 {
                    relevant_refs.push(reference.clone());
                }
            }
        }
        
        // Sort by relevance score
        relevant_refs.sort_by(|a, b| b.relevance_score.partial_cmp(&a.relevance_score).unwrap());
        
        Ok(relevant_refs)
    }

    fn generate_recommendation(&self, controls: &[Control], finding: &Finding) -> Result<String, Box<dyn std::error::Error>> {
        let mut recommendation = String::new();
        
        // Add summary
        recommendation.push_str(&format!(
            "To address the {} severity finding affecting {}, implement the following controls:\n\n",
            finding.severity,
            finding.affected_assets.iter().map(|a| &a.name).collect::<Vec<_>>().join(", ")
        ));
        
        // Add controls
        for control in controls {
            recommendation.push_str(&format!(
                "- {}: {}\n",
                control.name,
                control.description
            ));
        }
        
        Ok(recommendation)
    }

    fn estimate_effort(&self, controls: &[Control]) -> String {
        let effort_levels: Vec<&str> = controls.iter().map(|c| c.effort.as_str()).collect();
        
        match effort_levels.iter().max() {
            Some(&"High") => "High",
            Some(&"Medium") if effort_levels.len() > 2 => "High",
            Some(&"Medium") => "Medium",
            Some(&"Low") if effort_levels.len() > 3 => "Medium",
            _ => "Low",
        }.to_string()
    }

    fn determine_priority(&self, finding: &Finding) -> String {
        match finding.severity.as_str() {
            "Critical" => "Critical",
            "High" => "High",
            "Medium" => "Medium",
            _ => "Low",
        }.to_string()
    }

    fn generate_plan_summary(&self, remediation: &Remediation) -> String {
        format!(
            "Remediation Plan Summary:\n\
            Priority: {}\n\
            Effort: {}\n\
            Steps: {}\n\
            References: {}",
            remediation.priority,
            remediation.effort,
            remediation.steps.len(),
            remediation.references.len()
        )
    }
}

impl RemediationKnowledgeBase {
    fn new() -> Self {
        Self {
            controls: tokio::sync::RwLock::new(std::collections::HashMap::new()),
            references: tokio::sync::RwLock::new(std::collections::HashMap::new()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_remediation_planner() {
        // Add tests here
    }
}