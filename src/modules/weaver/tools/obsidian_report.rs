use anyhow::Result;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct ReportConfig {
    pub template: String,
    pub metadata: ReportMetadata,
    pub sections: Vec<ReportSection>,
    pub export_format: ExportFormat,
    pub theme: Theme,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReportMetadata {
    pub title: String,
    pub author: String,
    pub created_at: DateTime<Utc>,
    pub tags: Vec<String>,
    pub classification: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReportSection {
    pub id: String,
    pub title: String,
    pub content_type: ContentType,
    pub content: String,
    pub attachments: Vec<Attachment>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum ContentType {
    Text,
    Code { language: String },
    Table { headers: Vec<String> },
    List { ordered: bool },
    Timeline,
    Evidence { source: String },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Attachment {
    pub id: Uuid,
    pub name: String,
    pub file_type: String,
    pub path: PathBuf,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum ExportFormat {
    Markdown,
    PDF,
    HTML,
    DOCX,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Theme {
    pub font_family: String,
    pub colors: ThemeColors,
    pub spacing: ThemeSpacing,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ThemeColors {
    pub primary: String,
    pub secondary: String,
    pub background: String,
    pub text: String,
    pub accent: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ThemeSpacing {
    pub margin: String,
    pub padding: String,
    pub line_height: String,
}

pub struct ObsidianReportBuilder {
    vault_path: PathBuf,
    template_path: PathBuf,
    export_path: PathBuf,
}

impl ObsidianReportBuilder {
    pub fn new(vault_path: PathBuf, template_path: PathBuf, export_path: PathBuf) -> Result<Self> {
        std::fs::create_dir_all(&vault_path)?;
        std::fs::create_dir_all(&template_path)?;
        std::fs::create_dir_all(&export_path)?;

        Ok(Self {
            vault_path,
            template_path,
            export_path,
        })
    }

    pub async fn create_report(&self, config: ReportConfig) -> Result<PathBuf> {
        // Create report directory
        let report_id = Uuid::new_v4();
        let report_dir = self.vault_path.join(report_id.to_string());
        std::fs::create_dir(&report_dir)?;

        // Generate report content
        let content = self.generate_report_content(&config).await?;

        // Write main report file
        let report_file = report_dir.join("report.md");
        tokio::fs::write(&report_file, content).await?;

        // Copy attachments
        for section in &config.sections {
            for attachment in &section.attachments {
                let dest_path = report_dir.join("attachments").join(&attachment.name);
                tokio::fs::copy(&attachment.path, dest_path).await?;
            }
        }

        // Export report
        let export_path = self.export_report(&report_file, &config.export_format).await?;

        Ok(export_path)
    }

    async fn generate_report_content(&self, config: &ReportConfig) -> Result<String> {
        let mut content = String::new();

        // Add YAML frontmatter
        content.push_str("---\n");
        content.push_str(&format!("title: {}\n", config.metadata.title));
        content.push_str(&format!("author: {}\n", config.metadata.author));
        content.push_str(&format!("date: {}\n", config.metadata.created_at.to_rfc3339()));
        content.push_str(&format!("tags: {}\n", config.metadata.tags.join(", ")));
        content.push_str(&format!("classification: {}\n", config.metadata.classification));
        content.push_str("---\n\n");

        // Add sections
        for section in &config.sections {
            content.push_str(&format!("# {}\n\n", section.title));

            match &section.content_type {
                ContentType::Text => {
                    content.push_str(&section.content);
                    content.push_str("\n\n");
                }
                ContentType::Code { language } => {
                    content.push_str(&format!("```{}\n", language));
                    content.push_str(&section.content);
                    content.push_str("\n```\n\n");
                }
                ContentType::Table { headers } => {
                    // Add table headers
                    content.push_str(&format!("| {} |\n", headers.join(" | ")));
                    content.push_str(&format!("| {} |\n", headers.iter().map(|_| "---").collect::<Vec<_>>().join(" | ")));
                    content.push_str(&section.content);
                    content.push_str("\n\n");
                }
                ContentType::List { ordered } => {
                    for (i, line) in section.content.lines().enumerate() {
                        if *ordered {
                            content.push_str(&format!("{}. {}\n", i + 1, line));
                        } else {
                            content.push_str(&format!("- {}\n", line));
                        }
                    }
                    content.push_str("\n");
                }
                ContentType::Timeline => {
                    content.push_str("```timeline\n");
                    content.push_str(&section.content);
                    content.push_str("\n```\n\n");
                }
                ContentType::Evidence { source } => {
                    content.push_str(&format!("> [!evidence] Source: {}\n", source));
                    content.push_str(&section.content);
                    content.push_str("\n\n");
                }
            }

            // Add attachments
            if !section.attachments.is_empty() {
                content.push_str("### Attachments\n\n");
                for attachment in &section.attachments {
                    content.push_str(&format!("![[{}]]\n", attachment.name));
                }
                content.push_str("\n");
            }
        }

        Ok(content)
    }

    async fn export_report(&self, report_file: &PathBuf, format: &ExportFormat) -> Result<PathBuf> {
        let export_path = self.export_path.join(format!(
            "report.{}",
            match format {
                ExportFormat::Markdown => "md",
                ExportFormat::PDF => "pdf",
                ExportFormat::HTML => "html",
                ExportFormat::DOCX => "docx",
            }
        ));

        match format {
            ExportFormat::Markdown => {
                tokio::fs::copy(report_file, &export_path).await?;
            }
            ExportFormat::PDF => {
                // Use pandoc to convert to PDF
                let status = tokio::process::Command::new("pandoc")
                    .arg(report_file)
                    .arg("-o")
                    .arg(&export_path)
                    .arg("--pdf-engine=xelatex")
                    .status()
                    .await?;

                if !status.success() {
                    anyhow::bail!("PDF export failed");
                }
            }
            ExportFormat::HTML => {
                // Use pandoc to convert to HTML
                let status = tokio::process::Command::new("pandoc")
                    .arg(report_file)
                    .arg("-o")
                    .arg(&export_path)
                    .arg("--standalone")
                    .arg("--template=ember-report")
                    .status()
                    .await?;

                if !status.success() {
                    anyhow::bail!("HTML export failed");
                }
            }
            ExportFormat::DOCX => {
                // Use pandoc to convert to DOCX
                let status = tokio::process::Command::new("pandoc")
                    .arg(report_file)
                    .arg("-o")
                    .arg(&export_path)
                    .arg("--reference-doc=ember-template.docx")
                    .status()
                    .await?;

                if !status.success() {
                    anyhow::bail!("DOCX export failed");
                }
            }
        }

        Ok(export_path)
    }
}