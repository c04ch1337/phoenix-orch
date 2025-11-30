use tokio::sync::mpsc;
use std::sync::Arc;
use tracing::{info, error};
use handlebars::Handlebars;
use serde_json::Value;
use crate::modules::report_squad::{
    types::Finding,
    conscience::ConscienceGate,
};

pub struct TemplateManager {
    finding_rx: mpsc::Receiver<Finding>,
    report_tx: mpsc::Sender<String>,
    templates: Arc<Templates>,
    conscience: Arc<ConscienceGate>,
}

struct Templates {
    handlebars: Handlebars<'static>,
    default_templates: std::collections::HashMap<String, String>,
}

impl Templates {
    fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let mut handlebars = Handlebars::new();
        let mut default_templates = std::collections::HashMap::new();

        // Register default templates
        default_templates.insert("executive".to_string(), include_str!("../templates/executive.md").to_string());
        default_templates.insert("technical".to_string(), include_str!("../templates/technical.md").to_string());
        default_templates.insert("remediation".to_string(), include_str!("../templates/remediation.md").to_string());

        // Register each template with Handlebars
        for (name, template) in &default_templates {
            handlebars.register_template_string(name, template)?;
        }

        Ok(Self {
            handlebars,
            default_templates,
        })
    }

    fn render(&self, template_name: &str, data: &Value) -> Result<String, Box<dyn std::error::Error>> {
        Ok(self.handlebars.render(template_name, data)?)
    }
}

impl TemplateManager {
    pub async fn new(
        finding_rx: mpsc::Receiver<Finding>,
        report_tx: mpsc::Sender<String>,
        conscience: Arc<ConscienceGate>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let templates = Arc::new(Templates::new()?);
        
        Ok(Self {
            finding_rx,
            report_tx,
            templates,
            conscience,
        })
    }

    pub async fn run(&mut self) {
        info!("Template Manager Agent started");
        
        while let Some(finding) = self.finding_rx.recv().await {
            match self.process_finding(finding).await {
                Ok(report) => {
                    // Run through conscience gate
                    if let Ok(true) = self.conscience.evaluate_risk(&report).await {
                        // Check for jargon
                        if let Ok(simplified) = self.conscience.check_jargon(&report).await {
                            // Sign the report
                            if let Ok(signed) = self.conscience.sign_content(&simplified).await {
                                if let Err(e) = self.report_tx.send(signed).await {
                                    error!("Failed to send report: {}", e);
                                }
                            }
                        }
                    } else {
                        error!("Report rejected by conscience gate");
                    }
                }
                Err(e) => error!("Failed to process finding: {}", e),
            }
        }
    }

    async fn process_finding(&self, finding: Finding) -> Result<String, Box<dyn std::error::Error>> {
        // Convert finding to template data
        let data = self.prepare_template_data(&finding)?;
        
        // Generate reports for each template type
        let mut reports = Vec::new();
        
        for template_name in ["executive", "technical", "remediation"] {
            let report = self.templates.render(template_name, &data)?;
            reports.push(report);
        }
        
        // Combine reports with proper formatting
        let combined = self.combine_reports(reports)?;
        
        Ok(combined)
    }

    fn prepare_template_data(&self, finding: &Finding) -> Result<Value, Box<dyn std::error::Error>> {
        // Convert finding to template-friendly format
        let data = serde_json::to_value(finding)?;
        
        // Add additional template helpers
        let mut enhanced = serde_json::Map::new();
        enhanced.insert("finding".to_string(), data);
        enhanced.insert("generated_at".to_string(), chrono::Utc::now().to_rfc3339().into());
        
        Ok(Value::Object(enhanced))
    }

    fn combine_reports(&self, reports: Vec<String>) -> Result<String, Box<dyn std::error::Error>> {
        let mut combined = String::new();
        
        // Add title page
        combined.push_str("# Security Assessment Report\n\n");
        
        // Add table of contents
        combined.push_str("## Table of Contents\n\n");
        combined.push_str("1. Executive Summary\n");
        combined.push_str("2. Technical Details\n");
        combined.push_str("3. Remediation Plan\n\n");
        
        // Add each report section with proper formatting
        for (i, report) in reports.iter().enumerate() {
            combined.push_str(&format!("## Section {}\n\n", i + 1));
            combined.push_str(report);
            combined.push_str("\n\n");
        }
        
        Ok(combined)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_template_manager() {
        // Add tests here
    }
}