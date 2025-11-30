use anyhow::Result;
use serde::{Serialize, Deserialize};
use tokio::fs;
use std::path::{Path, PathBuf};
use reqwest::multipart::{Form, Part};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct PdfConfig {
    pub metadata: PdfMetadata,
    pub content: Vec<PdfContent>,
    pub security: PdfSecurity,
    pub output: OutputConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PdfMetadata {
    pub title: String,
    pub author: String,
    pub subject: Option<String>,
    pub keywords: Vec<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum PdfContent {
    Text {
        content: String,
        font: String,
        size: f32,
        color: String,
    },
    Image {
        path: PathBuf,
        width: Option<f32>,
        height: Option<f32>,
        caption: Option<String>,
    },
    Table {
        headers: Vec<String>,
        rows: Vec<Vec<String>>,
        style: TableStyle,
    },
    Page {
        number: bool,
        header: Option<String>,
        footer: Option<String>,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableStyle {
    pub header_color: String,
    pub alternate_row_color: Option<String>,
    pub border_color: String,
    pub font: String,
    pub font_size: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PdfSecurity {
    pub encrypt: bool,
    pub owner_password: Option<String>,
    pub user_password: Option<String>,
    pub permissions: Vec<Permission>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Permission {
    Print,
    Copy,
    Modify,
    AnnotateAndForm,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OutputConfig {
    pub format: OutputFormat,
    pub compression: bool,
    pub optimize: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum OutputFormat {
    PDF,
    PDF_A1B,
    PDF_A2B,
    PDF_A3B,
}

pub struct PdfTools {
    gotenberg_url: String,
    cache_dir: PathBuf,
    client: reqwest::Client,
}

impl PdfTools {
    pub fn new(gotenberg_url: &str, cache_dir: PathBuf) -> Result<Self> {
        std::fs::create_dir_all(&cache_dir)?;

        Ok(Self {
            gotenberg_url: gotenberg_url.to_string(),
            cache_dir,
            client: reqwest::Client::new(),
        })
    }

    pub async fn create_pdf(&self, config: PdfConfig) -> Result<PathBuf> {
        // Create temporary working directory
        let work_dir = self.cache_dir.join(Uuid::new_v4().to_string());
        fs::create_dir(&work_dir).await?;

        // Generate HTML content
        let html_content = self.generate_html(&config).await?;
        let html_path = work_dir.join("content.html");
        fs::write(&html_path, html_content).await?;

        // Convert to PDF using Gotenberg
        let pdf_path = self.convert_to_pdf(&html_path, &config).await?;

        // Apply security if needed
        let final_path = if config.security.encrypt {
            self.encrypt_pdf(&pdf_path, &config.security).await?
        } else {
            pdf_path
        };

        // Clean up work directory
        fs::remove_dir_all(work_dir).await?;

        Ok(final_path)
    }

    async fn generate_html(&self, config: &PdfConfig) -> Result<String> {
        let mut html = String::new();

        // Add HTML header
        html.push_str("<!DOCTYPE html>\n<html>\n<head>\n");
        html.push_str("<meta charset=\"UTF-8\">\n");
        html.push_str(&format!("<title>{}</title>\n", config.metadata.title));
        html.push_str("<style>\n");
        html.push_str(include_str!("../templates/pdf.css"));
        html.push_str("</style>\n");
        html.push_str("</head>\n<body>\n");

        // Add content
        for content in &config.content {
            match content {
                PdfContent::Text { content, font, size, color } => {
                    html.push_str(&format!(
                        "<p style=\"font-family: {}; font-size: {}px; color: {}\">{}</p>\n",
                        font, size, color, content
                    ));
                }
                PdfContent::Image { path, width, height, caption } => {
                    let style = match (width, height) {
                        (Some(w), Some(h)) => format!("width: {}px; height: {}px", w, h),
                        (Some(w), None) => format!("width: {}px", w),
                        (None, Some(h)) => format!("height: {}px", h),
                        (None, None) => String::new(),
                    };

                    html.push_str(&format!(
                        "<figure>\n<img src=\"{}\" style=\"{}\" alt=\"{}\">\n",
                        path.display(), style,
                        caption.as_deref().unwrap_or("Image")
                    ));

                    if let Some(cap) = caption {
                        html.push_str(&format!("<figcaption>{}</figcaption>\n", cap));
                    }

                    html.push_str("</figure>\n");
                }
                PdfContent::Table { headers, rows, style } => {
                    html.push_str("<table>\n<thead>\n<tr>\n");
                    
                    // Add headers
                    for header in headers {
                        html.push_str(&format!(
                            "<th style=\"background-color: {}; font-family: {}; font-size: {}px\">{}</th>\n",
                            style.header_color, style.font, style.font_size, header
                        ));
                    }
                    
                    html.push_str("</tr>\n</thead>\n<tbody>\n");

                    // Add rows
                    for (i, row) in rows.iter().enumerate() {
                        let bg_color = if let Some(alt_color) = &style.alternate_row_color {
                            if i % 2 == 1 { alt_color } else { "#ffffff" }
                        } else {
                            "#ffffff"
                        };

                        html.push_str(&format!("<tr style=\"background-color: {}\">\n", bg_color));
                        
                        for cell in row {
                            html.push_str(&format!(
                                "<td style=\"font-family: {}; font-size: {}px\">{}</td>\n",
                                style.font, style.font_size, cell
                            ));
                        }
                        
                        html.push_str("</tr>\n");
                    }
                    
                    html.push_str("</tbody>\n</table>\n");
                }
                PdfContent::Page { number, header, footer } => {
                    if let Some(h) = header {
                        html.push_str(&format!("<div class=\"header\">{}</div>\n", h));
                    }
                    if *number {
                        html.push_str("<div class=\"page-number\"></div>\n");
                    }
                    if let Some(f) = footer {
                        html.push_str(&format!("<div class=\"footer\">{}</div>\n", f));
                    }
                }
            }
        }

        html.push_str("</body>\n</html>");
        Ok(html)
    }

    async fn convert_to_pdf(&self, html_path: &Path, config: &PdfConfig) -> Result<PathBuf> {
        let form = Form::new()
            .file("files", html_path)?
            .text("marginTop", "1")
            .text("marginBottom", "1")
            .text("marginLeft", "1")
            .text("marginRight", "1");

        let url = match config.output.format {
            OutputFormat::PDF => format!("{}/forms/chromium/convert/html", self.gotenberg_url),
            OutputFormat::PDF_A1B => format!("{}/forms/chromium/convert/pdf/a1b", self.gotenberg_url),
            OutputFormat::PDF_A2B => format!("{}/forms/chromium/convert/pdf/a2b", self.gotenberg_url),
            OutputFormat::PDF_A3B => format!("{}/forms/chromium/convert/pdf/a3b", self.gotenberg_url),
        };

        let response = self.client
            .post(&url)
            .multipart(form)
            .send()
            .await?;

        let pdf_content = response.bytes().await?;
        let output_path = self.cache_dir.join(format!("{}.pdf", Uuid::new_v4()));
        fs::write(&output_path, pdf_content).await?;

        Ok(output_path)
    }

    async fn encrypt_pdf(&self, input_path: &Path, security: &PdfSecurity) -> Result<PathBuf> {
        let output_path = self.cache_dir.join(format!("{}_encrypted.pdf", Uuid::new_v4()));

        let mut form = Form::new().file("files", input_path)?;

        if let Some(owner_pass) = &security.owner_password {
            form = form.text("ownerPassword", owner_pass);
        }
        if let Some(user_pass) = &security.user_password {
            form = form.text("userPassword", user_pass);
        }

        let permissions = security.permissions.iter().map(|p| match p {
            Permission::Print => "print",
            Permission::Copy => "copy",
            Permission::Modify => "modify",
            Permission::AnnotateAndForm => "annotate",
        }).collect::<Vec<_>>().join(",");

        form = form.text("permissions", &permissions);

        let url = format!("{}/forms/pdfengine/encrypt", self.gotenberg_url);
        let response = self.client
            .post(&url)
            .multipart(form)
            .send()
            .await?;

        let pdf_content = response.bytes().await?;
        fs::write(&output_path, pdf_content).await?;

        Ok(output_path)
    }
}