use anyhow::Result;
use serde::{Serialize, Deserialize};
use tokio::fs;
use std::path::{Path, PathBuf};
use image::{ImageBuffer, Rgba};
use imageproc::drawing::{draw_text_mut, text_size};
use rusttype::{Font, Scale};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct OgImageConfig {
    pub template: TemplateType,
    pub content: ImageContent,
    pub style: ImageStyle,
    pub output: OutputConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum TemplateType {
    Article,
    Profile,
    Project,
    Custom(CustomTemplate),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CustomTemplate {
    pub width: u32,
    pub height: u32,
    pub layout: Vec<TemplateElement>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TemplateElement {
    pub element_type: ElementType,
    pub position: Position,
    pub size: Size,
    pub style: ElementStyle,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum ElementType {
    Text,
    Image,
    Shape,
    Gradient,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Position {
    pub x: i32,
    pub y: i32,
    pub align: Alignment,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Alignment {
    Start,
    Center,
    End,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Size {
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub max_width: Option<u32>,
    pub max_height: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ElementStyle {
    pub background: Option<Background>,
    pub border: Option<Border>,
    pub shadow: Option<Shadow>,
    pub opacity: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Background {
    Color(String),
    Gradient(GradientConfig),
    Image(String),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GradientConfig {
    pub colors: Vec<String>,
    pub direction: GradientDirection,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum GradientDirection {
    Horizontal,
    Vertical,
    Diagonal,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Border {
    pub width: u32,
    pub color: String,
    pub radius: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Shadow {
    pub color: String,
    pub blur: u32,
    pub offset_x: i32,
    pub offset_y: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageContent {
    pub title: String,
    pub subtitle: Option<String>,
    pub logo: Option<PathBuf>,
    pub background_image: Option<PathBuf>,
    pub additional_images: Vec<AdditionalImage>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AdditionalImage {
    pub path: PathBuf,
    pub position: Position,
    pub size: Size,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageStyle {
    pub font_family: String,
    pub title_size: u32,
    pub subtitle_size: u32,
    pub colors: ColorScheme,
    pub effects: Effects,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ColorScheme {
    pub primary: String,
    pub secondary: String,
    pub background: String,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Effects {
    pub blur: Option<f32>,
    pub overlay: Option<String>,
    pub noise: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OutputConfig {
    pub format: ImageFormat,
    pub quality: u8,
    pub size: ImageSize,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum ImageFormat {
    PNG,
    JPEG,
    WEBP,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageSize {
    pub width: u32,
    pub height: u32,
}

pub struct OgImageGenerator {
    fonts_dir: PathBuf,
    cache_dir: PathBuf,
    output_dir: PathBuf,
}

impl OgImageGenerator {
    pub fn new(fonts_dir: PathBuf, cache_dir: PathBuf, output_dir: PathBuf) -> Result<Self> {
        std::fs::create_dir_all(&fonts_dir)?;
        std::fs::create_dir_all(&cache_dir)?;
        std::fs::create_dir_all(&output_dir)?;

        Ok(Self {
            fonts_dir,
            cache_dir,
            output_dir,
        })
    }

    pub async fn generate_image(&self, config: OgImageConfig) -> Result<PathBuf> {
        // Create base image
        let (width, height) = match &config.template {
            TemplateType::Article => (1200, 630),
            TemplateType::Profile => (800, 800),
            TemplateType::Project => (1200, 600),
            TemplateType::Custom(template) => (template.width, template.height),
        };

        let mut image = ImageBuffer::new(width, height);

        // Apply background
        self.apply_background(&mut image, &config).await?;

        // Add content
        self.add_content(&mut image, &config).await?;

        // Apply effects
        self.apply_effects(&mut image, &config.style.effects)?;

        // Save image
        let output_path = self.save_image(&image, &config.output).await?;

        Ok(output_path)
    }

    async fn apply_background(&self, image: &mut ImageBuffer<Rgba<u8>, Vec<u8>>, config: &OgImageConfig) -> Result<()> {
        match &config.style.colors.background {
            background if background.starts_with("gradient:") => {
                self.apply_gradient(image, background)?;
            }
            background if background.starts_with("image:") => {
                let path = background.trim_start_matches("image:");
                self.apply_background_image(image, Path::new(path)).await?;
            }
            background => {
                let color = hex_to_rgba(background)?;
                for pixel in image.pixels_mut() {
                    *pixel = color;
                }
            }
        }

        Ok(())
    }

    async fn add_content(&self, image: &mut ImageBuffer<Rgba<u8>, Vec<u8>>, config: &OgImageConfig) -> Result<()> {
        // Load font
        let font_data = fs::read(self.fonts_dir.join(&config.style.font_family)).await?;
        let font = Font::try_from_vec(font_data)
            .ok_or_else(|| anyhow::anyhow!("Failed to load font"))?;

        // Add title
        let scale = Scale::uniform(config.style.title_size as f32);
        let color = hex_to_rgba(&config.style.colors.text)?;
        
        let text_size = text_size(scale, &font, &config.content.title);
        let x = (image.width() as i32 - text_size.0 as i32) / 2;
        let y = (image.height() as i32 - text_size.1 as i32) / 2;
        
        draw_text_mut(image, color, x, y, scale, &font, &config.content.title);

        // Add subtitle if present
        if let Some(subtitle) = &config.content.subtitle {
            let scale = Scale::uniform(config.style.subtitle_size as f32);
            let text_size = text_size(scale, &font, subtitle);
            let x = (image.width() as i32 - text_size.0 as i32) / 2;
            let y = y + text_size.1 as i32 + 20;
            
            draw_text_mut(image, color, x, y, scale, &font, subtitle);
        }

        // Add logo if present
        if let Some(logo_path) = &config.content.logo {
            let logo = image::open(logo_path)?;
            let resized = logo.resize(100, 100, image::imageops::FilterType::Lanczos3);
            image::imageops::overlay(image, &resized, 20, 20);
        }

        // Add additional images
        for additional in &config.content.additional_images {
            let img = image::open(&additional.path)?;
            
            let (width, height) = match (additional.size.width, additional.size.height) {
                (Some(w), Some(h)) => (w, h),
                (Some(w), None) => {
                    let aspect = img.height() as f32 / img.width() as f32;
                    (w, (w as f32 * aspect) as u32)
                }
                (None, Some(h)) => {
                    let aspect = img.width() as f32 / img.height() as f32;
                    ((h as f32 * aspect) as u32, h)
                }
                (None, None) => (img.width(), img.height()),
            };

            let resized = img.resize(width, height, image::imageops::FilterType::Lanczos3);
            
            let x = match additional.position.align {
                Alignment::Start => additional.position.x,
                Alignment::Center => (image.width() as i32 - width as i32) / 2 + additional.position.x,
                Alignment::End => image.width() as i32 - width as i32 - additional.position.x,
            };

            image::imageops::overlay(image, &resized, x as u32, additional.position.y as u32);
        }

        Ok(())
    }

    fn apply_effects(&self, image: &mut ImageBuffer<Rgba<u8>, Vec<u8>>, effects: &Effects) -> Result<()> {
        if let Some(blur) = effects.blur {
            image::imageops::blur(image, blur);
        }

        if let Some(overlay) = &effects.overlay {
            let overlay_color = hex_to_rgba(overlay)?;
            for pixel in image.pixels_mut() {
                blend_pixels(pixel, &overlay_color);
            }
        }

        if let Some(noise) = effects.noise {
            add_noise(image, noise);
        }

        Ok(())
    }

    async fn save_image(&self, image: &ImageBuffer<Rgba<u8>, Vec<u8>>, config: &OutputConfig) -> Result<PathBuf> {
        let output_path = self.output_dir.join(format!(
            "{}.{}",
            Uuid::new_v4(),
            match config.format {
                ImageFormat::PNG => "png",
                ImageFormat::JPEG => "jpg",
                ImageFormat::WEBP => "webp",
            }
        ));

        image.save(&output_path)?;
        Ok(output_path)
    }
}

fn hex_to_rgba(hex: &str) -> Result<Rgba<u8>> {
    let hex = hex.trim_start_matches('#');
    if hex.len() != 6 {
        anyhow::bail!("Invalid hex color");
    }

    let r = u8::from_str_radix(&hex[0..2], 16)?;
    let g = u8::from_str_radix(&hex[2..4], 16)?;
    let b = u8::from_str_radix(&hex[4..6], 16)?;

    Ok(Rgba([r, g, b, 255]))
}

fn blend_pixels(base: &mut Rgba<u8>, overlay: &Rgba<u8>) {
    for i in 0..3 {
        base[i] = ((base[i] as f32 * (1.0 - overlay[3] as f32 / 255.0)) +
                   (overlay[i] as f32 * overlay[3] as f32 / 255.0)) as u8;
    }
}

fn add_noise(image: &mut ImageBuffer<Rgba<u8>, Vec<u8>>, amount: f32) {
    use rand::Rng;
    let mut rng = rand::thread_rng();

    for pixel in image.pixels_mut() {
        for i in 0..3 {
            let noise = (rng.gen::<f32>() - 0.5) * amount * 255.0;
            pixel[i] = (pixel[i] as f32 + noise).clamp(0.0, 255.0) as u8;
        }
    }
}