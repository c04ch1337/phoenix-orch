use anyhow::Result;
use serde::{Serialize, Deserialize};
use tokio::fs;
use uuid::Uuid;
use reqwest::Client;

#[derive(Debug, Serialize, Deserialize)]
pub struct ReadmeConfig {
    pub title: String,
    pub subtitle: Option<String>,
    pub about: String,
    pub skills: Vec<Skill>,
    pub stats: StatsConfig,
    pub social: SocialLinks,
    pub projects: Vec<Project>,
    pub style: StyleConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Skill {
    pub name: String,
    pub category: SkillCategory,
    pub icon: String,
    pub proficiency: u8, // 1-5
}

#[derive(Debug, Serialize, Deserialize)]
pub enum SkillCategory {
    Languages,
    Frameworks,
    Tools,
    Security,
    Cloud,
    Other,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StatsConfig {
    pub show_languages: bool,
    pub show_stats_card: bool,
    pub show_streak: bool,
    pub show_contributions: bool,
    pub theme: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SocialLinks {
    pub twitter: Option<String>,
    pub linkedin: Option<String>,
    pub website: Option<String>,
    pub email: Option<String>,
    pub blog: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Project {
    pub name: String,
    pub description: String,
    pub url: String,
    pub image: Option<String>,
    pub tech_stack: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StyleConfig {
    pub layout: LayoutStyle,
    pub theme: ColorTheme,
    pub animations: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum LayoutStyle {
    Minimal,
    Standard,
    Detailed,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ColorTheme {
    pub primary: String,
    pub secondary: String,
    pub accent: String,
    pub background: String,
}

pub struct GithubReadmeGenerator {
    client: Client,
    cache_dir: std::path::PathBuf,
}

impl GithubReadmeGenerator {
    pub fn new(cache_dir: std::path::PathBuf) -> Result<Self> {
        std::fs::create_dir_all(&cache_dir)?;
        
        Ok(Self {
            client: Client::new(),
            cache_dir,
        })
    }

    pub async fn generate_readme(&self, config: ReadmeConfig) -> Result<String> {
        let mut content = String::new();

        // Header
        content.push_str(&self.generate_header(&config)?);
        content.push_str("\n\n");

        // About section
        content.push_str(&self.generate_about_section(&config)?);
        content.push_str("\n\n");

        // Skills section
        content.push_str(&self.generate_skills_section(&config.skills)?);
        content.push_str("\n\n");

        // GitHub Stats
        if config.stats.show_stats_card || config.stats.show_languages {
            content.push_str(&self.generate_stats_section(&config.stats)?);
            content.push_str("\n\n");
        }

        // Projects
        if !config.projects.is_empty() {
            content.push_str(&self.generate_projects_section(&config.projects)?);
            content.push_str("\n\n");
        }

        // Social Links
        content.push_str(&self.generate_social_section(&config.social)?);

        Ok(content)
    }

    fn generate_header(&self, config: &ReadmeConfig) -> Result<String> {
        let mut header = String::new();

        // Title with animation if enabled
        if config.style.animations {
            header.push_str(&format!(
                "<h1 align=\"center\">\n  <img src=\"https://readme-typing-svg.herokuapp.com/?lines={};&center=true&size=30\">\n</h1>\n",
                config.title
            ));
        } else {
            header.push_str(&format!("<h1 align=\"center\">{}</h1>\n", config.title));
        }

        // Subtitle if present
        if let Some(subtitle) = &config.subtitle {
            header.push_str(&format!("<h3 align=\"center\">{}</h3>\n", subtitle));
        }

        Ok(header)
    }

    fn generate_about_section(&self, config: &ReadmeConfig) -> Result<String> {
        let mut about = String::new();
        
        about.push_str("## About Me\n\n");
        about.push_str(&config.about);
        
        Ok(about)
    }

    fn generate_skills_section(&self, skills: &[Skill]) -> Result<String> {
        let mut section = String::new();
        section.push_str("## Skills\n\n");

        // Group skills by category
        let mut categorized: std::collections::HashMap<SkillCategory, Vec<&Skill>> = std::collections::HashMap::new();
        for skill in skills {
            categorized.entry(skill.category.clone()).or_default().push(skill);
        }

        for (category, skills) in categorized {
            section.push_str(&format!("### {}\n\n", self.format_category(&category)));
            section.push_str("<p align=\"left\">\n");

            for skill in skills {
                section.push_str(&format!(
                    "<img src=\"{}\" alt=\"{}\" width=\"40\" height=\"40\"/>&nbsp;\n",
                    skill.icon, skill.name
                ));
            }

            section.push_str("</p>\n\n");
        }

        Ok(section)
    }

    fn generate_stats_section(&self, stats: &StatsConfig) -> Result<String> {
        let mut section = String::new();
        section.push_str("## GitHub Stats\n\n");
        section.push_str("<p align=\"center\">\n");

        if stats.show_stats_card {
            section.push_str(&format!(
                "<img src=\"https://github-readme-stats.vercel.app/api?username=${{github.actor}}&show_icons=true&theme={}\"/>\n",
                stats.theme
            ));
        }

        if stats.show_languages {
            section.push_str(&format!(
                "<img src=\"https://github-readme-stats.vercel.app/api/top-langs/?username=${{github.actor}}&layout=compact&theme={}\"/>\n",
                stats.theme
            ));
        }

        if stats.show_streak {
            section.push_str(&format!(
                "<img src=\"https://github-readme-streak-stats.herokuapp.com/?user=${{github.actor}}&theme={}\"/>\n",
                stats.theme
            ));
        }

        section.push_str("</p>\n");

        Ok(section)
    }

    fn generate_projects_section(&self, projects: &[Project]) -> Result<String> {
        let mut section = String::new();
        section.push_str("## Featured Projects\n\n");

        for project in projects {
            section.push_str(&format!("### [{}]({})\n\n", project.name, project.url));
            section.push_str(&format!("{}\n\n", project.description));

            if let Some(image) = &project.image {
                section.push_str(&format!("![{}]({})\n\n", project.name, image));
            }

            if !project.tech_stack.is_empty() {
                section.push_str("**Tech Stack:** ");
                section.push_str(&project.tech_stack.join(", "));
                section.push_str("\n\n");
            }
        }

        Ok(section)
    }

    fn generate_social_section(&self, social: &SocialLinks) -> Result<String> {
        let mut section = String::new();
        section.push_str("## Connect With Me\n\n");
        section.push_str("<p align=\"center\">\n");

        if let Some(twitter) = &social.twitter {
            section.push_str(&format!(
                "<a href=\"https://twitter.com/{}\" target=\"blank\"><img align=\"center\" src=\"https://raw.githubusercontent.com/rahuldkjain/github-profile-readme-generator/master/src/images/icons/Social/twitter.svg\" alt=\"{}\" height=\"30\" width=\"40\" /></a>\n",
                twitter, twitter
            ));
        }

        if let Some(linkedin) = &social.linkedin {
            section.push_str(&format!(
                "<a href=\"https://linkedin.com/in/{}\" target=\"blank\"><img align=\"center\" src=\"https://raw.githubusercontent.com/rahuldkjain/github-profile-readme-generator/master/src/images/icons/Social/linked-in-alt.svg\" alt=\"{}\" height=\"30\" width=\"40\" /></a>\n",
                linkedin, linkedin
            ));
        }

        if let Some(website) = &social.website {
            section.push_str(&format!(
                "<a href=\"{}\" target=\"blank\"><img align=\"center\" src=\"https://raw.githubusercontent.com/rahuldkjain/github-profile-readme-generator/master/src/images/icons/Social/website.svg\" alt=\"website\" height=\"30\" width=\"40\" /></a>\n",
                website
            ));
        }

        section.push_str("</p>\n");

        Ok(section)
    }

    fn format_category(&self, category: &SkillCategory) -> String {
        match category {
            SkillCategory::Languages => "Programming Languages",
            SkillCategory::Frameworks => "Frameworks & Libraries",
            SkillCategory::Tools => "Tools & Technologies",
            SkillCategory::Security => "Security & Testing",
            SkillCategory::Cloud => "Cloud & DevOps",
            SkillCategory::Other => "Other Skills",
        }.to_string()
    }

    pub async fn preview_readme(&self, content: &str) -> Result<std::path::PathBuf> {
        let preview_id = Uuid::new_v4();
        let preview_path = self.cache_dir.join(format!("preview_{}.md", preview_id));
        
        fs::write(&preview_path, content).await?;
        
        Ok(preview_path)
    }

    pub async fn update_github_profile(&self, content: &str, token: &str) -> Result<()> {
        let url = "https://api.github.com/user/repos";
        
        // Create a new repository for the profile
        let repo_name = "github-profile";
        let create_repo = self.client
            .post(url)
            .bearer_auth(token)
            .json(&serde_json::json!({
                "name": repo_name,
                "auto_init": true,
                "private": false,
                "description": "My GitHub Profile"
            }))
            .send()
            .await?;

        if !create_repo.status().is_success() {
            anyhow::bail!("Failed to create repository");
        }

        // Update README.md
        let update_url = format!("https://api.github.com/repos/${{github.actor}}/{}/contents/README.md", repo_name);
        let update_readme = self.client
            .put(&update_url)
            .bearer_auth(token)
            .json(&serde_json::json!({
                "message": "Update profile README",
                "content": base64::encode(content),
                "branch": "main"
            }))
            .send()
            .await?;

        if !update_readme.status().is_success() {
            anyhow::bail!("Failed to update README");
        }

        Ok(())
    }
}