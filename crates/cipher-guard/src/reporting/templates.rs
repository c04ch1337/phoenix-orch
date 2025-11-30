//! Template Engine for Report Generation
//! 
//! Provides templating capabilities for various report formats and styles

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Template Engine for report generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateEngine {
    pub templates: HashMap<TemplateType, ReportTemplate>,
    pub template_variables: HashMap<String, String>,
    pub template_cache: HashMap<String, String>,
}

impl TemplateEngine {
    /// Create a new Template Engine
    pub fn new() -> Self {
        let mut templates = HashMap::new();
        
        // Initialize standard templates
        templates.insert(TemplateType::Standard, ReportTemplate::standard());
        templates.insert(TemplateType::Executive, ReportTemplate::executive());
        templates.insert(TemplateType::Technical, ReportTemplate::technical());
        templates.insert(TemplateType::Legal, ReportTemplate::legal());
        templates.insert(TemplateType::Compliance, ReportTemplate::compliance());
        
        Self {
            templates,
            template_variables: HashMap::new(),
            template_cache: HashMap::new(),
        }
    }

    /// Apply template to report content
    pub fn apply_template(
        &self,
        content: ReportContent,
        template_type: &TemplateType,
    ) -> Result<TemplatedReport, ReportingError> {
        let template = self.templates.get(template_type)
            .ok_or_else(|| ReportingError::template("Template not found"))?;
        
        let templated_content = template.apply(&content, &self.template_variables)?;
        
        Ok(TemplatedReport {
            content: templated_content,
            template_type: template_type.clone(),
            applied_variables: self.template_variables.clone(),
            generated_at: chrono::Utc::now(),
        })
    }

    /// Register template variables
    pub fn register_variables(&mut self, variables: HashMap<String, String>) {
        self.template_variables.extend(variables);
    }

    /// Clear template variables
    pub fn clear_variables(&mut self) {
        self.template_variables.clear();
    }

    /// Add a custom template
    pub fn add_template(&mut self, template_type: TemplateType, template: ReportTemplate) {
        self.templates.insert(template_type, template);
    }

    /// Remove a template
    pub fn remove_template(&mut self, template_type: &TemplateType) -> Option<ReportTemplate> {
        self.templates.remove(template_type)
    }

    /// Get all available template types
    pub fn get_available_templates(&self) -> Vec<TemplateType> {
        self.templates.keys().cloned().collect()
    }

    /// Precompile templates for better performance
    pub fn precompile_templates(&mut self) -> Result<(), ReportingError> {
        for (template_type, template) in &self.templates {
            let compiled = template.precompile()?;
            self.template_cache.insert(template_type.to_string(), compiled);
        }
        Ok(())
    }

    /// Get precompiled template
    pub fn get_precompiled_template(&self, template_type: &TemplateType) -> Option<&String> {
        self.template_cache.get(&template_type.to_string())
    }
}

/// Report Template structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportTemplate {
    pub name: String,
    pub description: String,
    pub header_template: String,
    pub footer_template: String,
    pub section_templates: HashMap<String, String>,
    pub style_template: String,
    pub variable_pattern: String,
    pub escape_sequences: HashMap<String, String>,
}

impl ReportTemplate {
    /// Create standard template
    pub fn standard() -> Self {
        Self {
            name: "Standard Report Template".to_string(),
            description: "Default template for general reports".to_string(),
            header_template: include_str!("templates/standard/header.html").to_string(),
            footer_template: include_str!("templates/standard/footer.html").to_string(),
            section_templates: HashMap::from([
                ("executive_summary".to_string(), include_str!("templates/standard/executive_summary.html").to_string()),
                ("technical_details".to_string(), include_str!("templates/standard/technical_details.html").to_string()),
                ("timeline".to_string(), include_str!("templates/standard/timeline.html").to_string()),
                ("evidence".to_string(), include_str!("templates/standard/evidence.html").to_string()),
                ("recommendations".to_string(), include_str!("templates/standard/recommendations.html").to_string()),
            ]),
            style_template: include_str!("templates/standard/style.css").to_string(),
            variable_pattern: "\\{\\{([^}]+)\\}\\}".to_string(),
            escape_sequences: HashMap::from([
                ("<".to_string(), "<".to_string()),
                (">".to_string(), ">".to_string()),
                ("&".to_string(), "&".to_string()),
                ("\"".to_string(), """.to_string()),
                ("'".to_string(), "'".to_string()),
            ]),
        }
    }

    /// Create executive template
    pub fn executive() -> Self {
        Self {
            name: "Executive Report Template".to_string(),
            description: "Template for executive-level reports".to_string(),
            header_template: include_str!("templates/executive/header.html").to_string(),
            footer_template: include_str!("templates/executive/footer.html").to_string(),
            section_templates: HashMap::from([
                ("executive_summary".to_string(), include_str!("templates/executive/executive_summary.html").to_string()),
                ("key_findings".to_string(), include_str!("templates/executive/key_findings.html").to_string()),
                ("risk_assessment".to_string(), include_str!("templates/executive/risk_assessment.html").to_string()),
                ("recommendations".to_string(), include_str!("templates/executive/recommendations.html").to_string()),
            ]),
            style_template: include_str!("templates/executive/style.css").to_string(),
            variable_pattern: "\\{\\{([^}]+)\\}\\}".to_string(),
            escape_sequences: HashMap::from([
                ("<".to_string(), "<".to_string()),
                (">".to_string(), ">".to_string()),
                ("&".to_string(), "&".to_string()),
                ("\"".to_string(), """.to_string()),
                ("'".to_string(), "'".to_string()),
            ]),
        }
    }

    /// Create technical template
    pub fn technical() -> Self {
        Self {
            name: "Technical Report Template".to_string(),
            description: "Template for technical detailed reports".to_string(),
            header_template: include_str!("templates/technical/header.html").to_string(),
            footer_template: include_str!("templates/technical/footer.html").to_string(),
            section_templates: HashMap::from([
                ("methodology".to_string(), include_str!("templates/technical/methodology.html").to_string()),
                ("technical_details".to_string(), include_str!("templates/technical/technical_details.html").to_string()),
                ("findings".to_string(), include_str!("templates/technical/findings.html").to_string()),
                ("evidence".to_string(), include_str!("templates/technical/evidence.html").to_string()),
                ("appendices".to_string(), include_str!("templates/technical/appendices.html").to_string()),
            ]),
            style_template: include_str!("templates/technical/style.css").to_string(),
            variable_pattern: "\\{\\{([^}]+)\\}\\}".to_string(),
            escape_sequences: HashMap::from([
                ("<".to_string(), "<".to_string()),
                (">".to_string(), ">".to_string()),
                ("&".to_string(), "&".to_string()),
                ("\"".to_string(), """.to_string()),
                ("'".to_string(), "'".to_string()),
            ]),
        }
    }

    /// Create legal template
    pub fn legal() -> Self {
        Self {
            name: "Legal Report Template".to_string(),
            description: "Template for legal and compliance reports".to_string(),
            header_template: include_str!("templates/legal/header.html").to_string(),
            footer_template: include_str!("templates/legal/footer.html").to_string(),
            section_templates: HashMap::from([
                ("legal_notice".to_string(), include_str!("templates/legal/legal_notice.html").to_string()),
                ("executive_summary".to_string(), include_str!("templates/legal/executive_summary.html").to_string()),
                ("compliance_assessment".to_string(), include_str!("templates/legal/compliance_assessment.html").to_string()),
                ("evidence_chain".to_string(), include_str!("templates/legal/evidence_chain.html").to_string()),
                ("legal_recommendations".to_string(), include_str!("templates/legal/recommendations.html").to_string()),
            ]),
            style_template: include_str!("templates/legal/style.css").to_string(),
            variable_pattern: "\\{\\{([^}]+)\\}\\}".to_string(),
            escape_sequences: HashMap::from([
                ("<".to_string(), "<".to_string()),
                (">".to_string(), ">".to_string()),
                ("&".to_string(), "&".to_string()),
                ("\"".to_string(), """.to_string()),
                ("'".to_string(), "'".to_string()),
            ]),
        }
    }

    /// Create compliance template
    pub fn compliance() -> Self {
        Self {
            name: "Compliance Report Template".to_string(),
            description: "Template for regulatory compliance reports".to_string(),
            header_template: include_str!("templates/compliance/header.html").to_string(),
            footer_template: include_str!("templates/compliance/footer.html").to_string(),
            section_templates: HashMap::from([
                ("compliance_summary".to_string(), include_str!("templates/compliance/summary.html").to_string()),
                ("regulation_assessment".to_string(), include_str!("templates/compliance/regulation_assessment.html").to_string()),
                ("gap_analysis".to_string(), include_str!("templates/compliance/gap_analysis.html").to_string()),
                ("remediation_plan".to_string(), include_str!("templates/compliance/remediation_plan.html").to_string()),
                ("compliance_recommendations".to_string(), include_str!("templates/compliance/recommendations.html").to_string()),
            ]),
            style_template: include_str!("templates/compliance/style.css").to_string(),
            variable_pattern: "\\{\\{([^}]+)\\}\\}".to_string(),
            escape_sequences: HashMap::from([
                ("<".to_string(), "<".to_string()),
                (">".to_string(), ">".to_string()),
                ("&".to_string(), "&".to_string()),
                ("\"".to_string(), """.to_string()),
                ("'".to_string(), "'".to_string()),
            ]),
        }
    }

    /// Apply template to content
    pub fn apply(
        &self,
        content: &ReportContent,
        variables: &HashMap<String, String>,
    ) -> Result<String, ReportingError> {
        let mut result = String::new();
        
        // Apply header
        result.push_str(&self.apply_variables(&self.header_template, variables)?);
        
        // Apply sections based on content availability
        if let Some(executive_summary) = &content.executive_summary {
            if let Some(template) = self.section_templates.get("executive_summary") {
                result.push_str(&self.apply_section_template(template, executive_summary, variables)?);
            }
        }
        
        if let Some(technical_details) = &content.technical_details {
            if let Some(template) = self.section_templates.get("technical_details") {
                result.push_str(&self.apply_section_template(template, technical_details, variables)?);
            }
        }
        
        if let Some(timeline) = &content.timeline {
            if let Some(template) = self.section_templates.get("timeline") {
                result.push_str(&self.apply_section_template(template, timeline, variables)?);
            }
        }
        
        if let Some(evidence) = &content.evidence_presentation {
            if let Some(template) = self.section_templates.get("evidence") {
                result.push_str(&self.apply_section_template(template, evidence, variables)?);
            }
        }
        
        // Apply recommendations
        if !content.recommendations.is_empty() {
            if let Some(template) = self.section_templates.get("recommendations") {
                result.push_str(&self.apply_recommendations_template(template, &content.recommendations, variables)?);
            }
        }
        
        // Apply footer
        result.push_str(&self.apply_variables(&self.footer_template, variables)?);
        
        // Apply styles if needed
        if self.style_template.contains("{{content}}") {
            result = self.style_template.replace("{{content}}", &result);
        }
        
        Ok(result)
    }

    /// Apply variables to template string
    fn apply_variables(&self, template: &str, variables: &HashMap<String, String>) -> Result<String, ReportingError> {
        let mut result = template.to_string();
        
        for (key, value) in variables {
            let placeholder = format!("{{{{{}}}}}", key);
            result = result.replace(&placeholder, value);
        }
        
        // Escape any remaining special characters
        for (sequence, escape) in &self.escape_sequences {
            result = result.replace(sequence, escape);
        }
        
        Ok(result)
    }

    /// Apply section template with content
    fn apply_section_template<T: serde::Serialize>(
        &self,
        template: &str,
        content: &T,
        variables: &HashMap<String, String>,
    ) -> Result<String, ReportingError> {
        let content_json = serde_json::to_string(content)
            .map_err(|e| ReportingError::template(format!("Serialization error: {}", e)))?;
        
        let mut result = template.to_string();
        result = result.replace("{{content}}", &content_json);
        
        self.apply_variables(&result, variables)
    }

    /// Apply recommendations template
    fn apply_recommendations_template(
        &self,
        template: &str,
        recommendations: &[Recommendation],
        variables: &HashMap<String, String>,
    ) -> Result<String, ReportingError> {
        let rec_json = serde_json::to_string(recommendations)
            .map_err(|e| ReportingError::template(format!("Serialization error: {}", e)))?;
        
        let mut result = template.to_string();
        result = result.replace("{{recommendations}}", &rec_json);
        
        self.apply_variables(&result, variables)
    }

    /// Precompile template for better performance
    pub fn precompile(&self) -> Result<String, ReportingError> {
        // In a real implementation, this would compile the template to a more efficient format
        // For now, just return a serialized version
        serde_json::to_string(self)
            .map_err(|e| ReportingError::template(format!("Precompilation error: {}", e)))
    }
}

/// Templated Report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplatedReport {
    pub content: String,
    pub template_type: TemplateType,
    pub applied_variables: HashMap<String, String>,
    pub generated_at: chrono::DateTime<chrono::Utc>,
}

// Supporting types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateVariable {
    pub name: String,
    pub value: String,
    pub description: String,
    pub required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateConfig {
    pub variables: Vec<TemplateVariable>,
    pub sections: Vec<String>,
    pub styles: Vec<String>,
    pub dependencies: Vec<String>,
}