use tokio::sync::mpsc;
use std::sync::Arc;
use tracing::{info, error};
use crate::modules::report_squad::{
    types::Finding,
    conscience::ConscienceGate,
};
use std::path::PathBuf;

pub struct Exporter {
    finding_rx: mpsc::Receiver<Finding>,
    export_tx: mpsc::Sender<PathBuf>,
    conscience: Arc<ConscienceGate>,
    export_config: ExportConfig,
}

struct ExportConfig {
    formats: Vec<ExportFormat>,
    output_dir: PathBuf,
    templates: std::collections::HashMap<ExportFormat, String>,
}

#[derive(Hash, Eq, PartialEq)]
enum ExportFormat {
    Markdown,
    PDF,
    HTML,
    Word,
    JSON,
}

impl Exporter {
    pub async fn new(
        finding_rx: mpsc::Receiver<Finding>,
        export_tx: mpsc::Sender<PathBuf>,
        conscience: Arc<ConscienceGate>,
        output_dir: PathBuf,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let export_config = ExportConfig::new(output_dir);
        
        Ok(Self {
            finding_rx,
            export_tx,
            conscience,
            export_config,
        })
    }

    pub async fn run(&mut self) {
        info!("Exporter Agent started");
        
        while let Some(finding) = self.finding_rx.recv().await {
            match self.export_finding(&finding).await {
                Ok(paths) => {
                    for path in paths {
                        // Validate export through conscience gate
                        let export_summary = format!("Exported report to: {}", path.display());
                        if let Ok(true) = self.conscience.evaluate_risk(&export_summary).await {
                            if let Err(e) = self.export_tx.send(path).await {
                                error!("Failed to send export path: {}", e);
                            }
                        } else {
                            error!("Export rejected by conscience gate");
                        }
                    }
                }
                Err(e) => error!("Failed to export finding: {}", e),
            }
        }
    }

    async fn export_finding(&self, finding: &Finding) -> Result<Vec<PathBuf>, Box<dyn std::error::Error>> {
        let mut exported_paths = Vec::new();
        
        for format in &self.export_config.formats {
            match format {
                ExportFormat::Markdown => {
                    let path = self.export_markdown(finding).await?;
                    exported_paths.push(path);
                }
                ExportFormat::PDF => {
                    let path = self.export_pdf(finding).await?;
                    exported_paths.push(path);
                }
                ExportFormat::HTML => {
                    let path = self.export_html(finding).await?;
                    exported_paths.push(path);
                }
                ExportFormat::Word => {
                    let path = self.export_word(finding).await?;
                    exported_paths.push(path);
                }
                ExportFormat::JSON => {
                    let path = self.export_json(finding).await?;
                    exported_paths.push(path);
                }
            }
        }
        
        Ok(exported_paths)
    }

    async fn export_markdown(&self, finding: &Finding) -> Result<PathBuf, Box<dyn std::error::Error>> {
        let content = self.generate_markdown(finding)?;
        let path = self.get_export_path(finding, "md");
        
        tokio::fs::write(&path, content).await?;
        
        Ok(path)
    }

    async fn export_pdf(&self, finding: &Finding) -> Result<PathBuf, Box<dyn std::error::Error>> {
        // Convert markdown to PDF using a PDF generation library
        let markdown = self.generate_markdown(finding)?;
        let path = self.get_export_path(finding, "pdf");
        
        // Implement PDF conversion here
        
        Ok(path)
    }

    async fn export_html(&self, finding: &Finding) -> Result<PathBuf, Box<dyn std::error::Error>> {
        let markdown = self.generate_markdown(finding)?;
        let html = self.markdown_to_html(&markdown)?;
        let path = self.get_export_path(finding, "html");
        
        tokio::fs::write(&path, html).await?;
        
        Ok(path)
    }

    async fn export_word(&self, finding: &Finding) -> Result<PathBuf, Box<dyn std::error::Error>> {
        let markdown = self.generate_markdown(finding)?;
        let path = self.get_export_path(finding, "docx");
        
        // Implement Word document generation here
        
        Ok(path)
    }

    async fn export_json(&self, finding: &Finding) -> Result<PathBuf, Box<dyn std::error::Error>> {
        let json = serde_json::to_string_pretty(finding)?;
        let path = self.get_export_path(finding, "json");
        
        tokio::fs::write(&path, json).await?;
        
        Ok(path)
    }

    fn generate_markdown(&self, finding: &Finding) -> Result<String, Box<dyn std::error::Error>> {
        let template = self.export_config.templates.get(&ExportFormat::Markdown)
            .ok_or("Markdown template not found")?;
        
        let mut content = template.clone();
        
        // Replace template variables
        content = content.replace("{{title}}", &finding.title);
        content = content.replace("{{description}}", &finding.description);
        content = content.replace("{{severity}}", &finding.severity);
        content = content.replace("{{cvss_score}}", &finding.cvss.score.to_string());
        
        // Add affected assets
        let assets = finding.affected_assets.iter()
            .map(|a| format!("- {} ({}): {}", a.name, a.asset_type, a.impact))
            .collect::<Vec<_>>()
            .join("\n");
        content = content.replace("{{affected_assets}}", &assets);
        
        // Add evidence
        let evidence = finding.evidence.iter()
            .map(|e| format!("### Evidence {}\n{}", e.id, e.description))
            .collect::<Vec<_>>()
            .join("\n\n");
        content = content.replace("{{evidence}}", &evidence);
        
        // Add remediation
        content = content.replace("{{remediation}}", &finding.remediation.recommendation);
        let steps = finding.remediation.steps.iter()
            .enumerate()
            .map(|(i, s)| format!("{}. {}", i + 1, s))
            .collect::<Vec<_>>()
            .join("\n");
        content = content.replace("{{remediation_steps}}", &steps);
        
        Ok(content)
    }

    fn markdown_to_html(&self, markdown: &str) -> Result<String, Box<dyn std::error::Error>> {
        let mut html = String::from("<!DOCTYPE html>\n<html>\n<head>\n");
        html.push_str("<meta charset=\"UTF-8\">\n");
        html.push_str("<style>\n");
        html.push_str("body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }\n");
        html.push_str("</style>\n");
        html.push_str("</head>\n<body>\n");
        
        // Convert markdown to HTML
        let parser = pulldown_cmark::Parser::new(markdown);
        let mut html_output = String::new();
        pulldown_cmark::html::push_html(&mut html_output, parser);
        
        html.push_str(&html_output);
        html.push_str("\n</body>\n</html>");
        
        Ok(html)
    }

    fn get_export_path(&self, finding: &Finding, extension: &str) -> PathBuf {
        let filename = format!(
            "finding_{}_{}_{}.{}",
            finding.id,
            finding.title.to_lowercase().replace(' ', "_"),
            chrono::Utc::now().format("%Y%m%d_%H%M%S"),
            extension
        );
        
        self.export_config.output_dir.join(filename)
    }
}

impl ExportConfig {
    fn new(output_dir: PathBuf) -> Self {
        let mut formats = Vec::new();
        formats.push(ExportFormat::Markdown);
        formats.push(ExportFormat::PDF);
        formats.push(ExportFormat::HTML);
        formats.push(ExportFormat::Word);
        formats.push(ExportFormat::JSON);
        
        let mut templates = std::collections::HashMap::new();
        templates.insert(
            ExportFormat::Markdown,
            include_str!("../templates/export_template.md").to_string(),
        );
        
        Self {
            formats,
            output_dir,
            templates,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_exporter() {
        // Add tests here
    }
}