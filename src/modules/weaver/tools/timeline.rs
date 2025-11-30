use anyhow::Result;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};
use std::path::PathBuf;
use tokio::fs;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Timeline {
    pub title: TimelineSlide,
    pub events: Vec<TimelineEvent>,
    pub eras: Vec<TimelineEra>,
    pub options: TimelineOptions,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TimelineSlide {
    pub headline: String,
    pub text: Option<String>,
    pub media: Option<TimelineMedia>,
    pub background: Option<TimelineBackground>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TimelineEvent {
    pub start_date: DateTime<Utc>,
    pub end_date: Option<DateTime<Utc>>,
    pub text: TimelineText,
    pub media: Option<TimelineMedia>,
    pub group: Option<String>,
    pub display_date: Option<String>,
    pub background: Option<TimelineBackground>,
    pub auto_link: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TimelineText {
    pub headline: String,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TimelineMedia {
    pub url: String,
    pub caption: Option<String>,
    pub credit: Option<String>,
    pub thumbnail: Option<String>,
    pub alt: Option<String>,
    pub title: Option<String>,
    pub link: Option<String>,
    pub link_target: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TimelineBackground {
    pub url: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TimelineEra {
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub text: TimelineText,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TimelineOptions {
    pub width: Option<String>,
    pub height: Option<String>,
    pub scale_factor: Option<f32>,
    pub initial_zoom: Option<u32>,
    pub zoom_sequence: Option<Vec<u32>>,
    pub timenav_position: Option<String>,
    pub optimal_tick_width: Option<u32>,
    pub base_class: Option<String>,
    pub theme: Option<String>,
    pub hash_bookmark: Option<bool>,
}

pub struct TimelineGenerator {
    template_dir: PathBuf,
    output_dir: PathBuf,
    asset_dir: PathBuf,
}

impl TimelineGenerator {
    pub fn new(template_dir: PathBuf, output_dir: PathBuf, asset_dir: PathBuf) -> Result<Self> {
        std::fs::create_dir_all(&template_dir)?;
        std::fs::create_dir_all(&output_dir)?;
        std::fs::create_dir_all(&asset_dir)?;

        Ok(Self {
            template_dir,
            output_dir,
            asset_dir,
        })
    }

    pub async fn generate_timeline(&self, timeline: Timeline) -> Result<PathBuf> {
        // Create timeline directory
        let timeline_id = Uuid::new_v4();
        let timeline_dir = self.output_dir.join(timeline_id.to_string());
        fs::create_dir(&timeline_dir).await?;

        // Generate timeline JSON
        let json_content = self.generate_timeline_json(&timeline)?;
        let json_path = timeline_dir.join("timeline.json");
        fs::write(&json_path, json_content).await?;

        // Copy TimelineJS assets
        self.copy_timeline_assets(&timeline_dir).await?;

        // Generate HTML wrapper
        let html_content = self.generate_html_wrapper(&timeline, &json_path)?;
        let html_path = timeline_dir.join("index.html");
        fs::write(&html_path, html_content).await?;

        Ok(html_path)
    }

    fn generate_timeline_json(&self, timeline: &Timeline) -> Result<String> {
        let json = serde_json::json!({
            "title": timeline.title,
            "events": timeline.events.iter().map(|event| {
                serde_json::json!({
                    "start_date": {
                        "year": event.start_date.year(),
                        "month": event.start_date.month(),
                        "day": event.start_date.day(),
                        "hour": event.start_date.hour(),
                        "minute": event.start_date.minute(),
                        "second": event.start_date.second(),
                    },
                    "end_date": event.end_date.map(|date| {
                        serde_json::json!({
                            "year": date.year(),
                            "month": date.month(),
                            "day": date.day(),
                            "hour": date.hour(),
                            "minute": date.minute(),
                            "second": date.second(),
                        })
                    }),
                    "text": event.text,
                    "media": event.media,
                    "group": event.group,
                    "display_date": event.display_date,
                    "background": event.background,
                    "autolink": event.auto_link,
                })
            }).collect::<Vec<_>>(),
            "eras": timeline.eras.iter().map(|era| {
                serde_json::json!({
                    "start_date": {
                        "year": era.start_date.year(),
                        "month": era.start_date.month(),
                        "day": era.start_date.day(),
                    },
                    "end_date": {
                        "year": era.end_date.year(),
                        "month": era.end_date.month(),
                        "day": era.end_date.day(),
                    },
                    "text": era.text,
                })
            }).collect::<Vec<_>>(),
        });

        Ok(serde_json::to_string_pretty(&json)?)
    }

    async fn copy_timeline_assets(&self, timeline_dir: &PathBuf) -> Result<()> {
        let assets_dir = timeline_dir.join("assets");
        fs::create_dir(&assets_dir).await?;

        // Copy CSS
        fs::copy(
            self.asset_dir.join("timeline.css"),
            assets_dir.join("timeline.css")
        ).await?;

        // Copy JavaScript
        fs::copy(
            self.asset_dir.join("timeline.js"),
            assets_dir.join("timeline.js")
        ).await?;

        // Copy fonts
        let fonts_dir = assets_dir.join("fonts");
        fs::create_dir(&fonts_dir).await?;
        
        for entry in std::fs::read_dir(self.asset_dir.join("fonts"))? {
            let entry = entry?;
            fs::copy(
                entry.path(),
                fonts_dir.join(entry.file_name())
            ).await?;
        }

        Ok(())
    }

    fn generate_html_wrapper(&self, timeline: &Timeline, json_path: &PathBuf) -> Result<String> {
        let options = serde_json::to_string(&timeline.options)?;
        
        let html = format!(
            r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{}</title>
    <link rel="stylesheet" href="assets/timeline.css">
    <style>
        #timeline-embed {{
            width: 100%;
            height: 100vh;
            margin: 0;
            padding: 0;
        }}
    </style>
</head>
<body>
    <div id="timeline-embed"></div>
    <script src="assets/timeline.js"></script>
    <script>
        window.timeline = new TL.Timeline('timeline-embed', 'timeline.json', {});
    </script>
</body>
</html>"#,
            timeline.title.headline,
            options
        );

        Ok(html)
    }

    pub async fn export_timeline(&self, timeline: &Timeline, format: ExportFormat) -> Result<PathBuf> {
        // First generate the timeline
        let html_path = self.generate_timeline(&timeline).await?;
        
        match format {
            ExportFormat::HTML => Ok(html_path),
            ExportFormat::PDF => {
                let pdf_path = html_path.with_extension("pdf");
                
                // Use headless Chrome to generate PDF
                let status = tokio::process::Command::new("chrome")
                    .args(&[
                        "--headless",
                        "--disable-gpu",
                        "--print-to-pdf",
                        &pdf_path.to_string_lossy(),
                        &html_path.to_string_lossy(),
                    ])
                    .status()
                    .await?;

                if !status.success() {
                    anyhow::bail!("Failed to generate PDF");
                }

                Ok(pdf_path)
            }
            ExportFormat::PNG => {
                let png_path = html_path.with_extension("png");
                
                // Use headless Chrome to generate screenshot
                let status = tokio::process::Command::new("chrome")
                    .args(&[
                        "--headless",
                        "--disable-gpu",
                        "--screenshot",
                        &png_path.to_string_lossy(),
                        &html_path.to_string_lossy(),
                    ])
                    .status()
                    .await?;

                if !status.success() {
                    anyhow::bail!("Failed to generate PNG");
                }

                Ok(png_path)
            }
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum ExportFormat {
    HTML,
    PDF,
    PNG,
}