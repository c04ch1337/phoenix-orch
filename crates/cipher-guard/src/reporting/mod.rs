//! Professional Reporting System
//! 
//! Comprehensive reporting capabilities with multiple output formats

pub mod professional;
pub mod templates;
pub mod formats;
pub mod delivery;

// Re-exports for convenient access
pub use professional::*;
pub use templates::*;
pub use formats::*;
pub use delivery::*;

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Main Professional Reporting System
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfessionalReportingSystem {
    pub report_generator: ReportGenerator,
    pub template_engine: TemplateEngine,
    pub format_converter: FormatConverter,
    pub quality_assurance: QualityAssurance,
    pub delivery_system: DeliverySystem,
}

impl ProfessionalReportingSystem {
    /// Create a new Professional Reporting System
    pub fn new() -> Result<Self, ReportingError> {
        Ok(Self {
            report_generator: ReportGenerator::new(),
            template_engine: TemplateEngine::new(),
            format_converter: FormatConverter::new(),
            quality_assurance: QualityAssurance::new(),
            delivery_system: DeliverySystem::new(),
        })
    }

    /// Generate a comprehensive defense report
    pub async fn generate_defense_report(
        &self,
        report_request: ReportRequest,
    ) -> Result<ReportPayload, ReportingError> {
        // Generate report content
        let report_content = self.report_generator.generate_report(&report_request)?;
        
        // Apply template
        let templated_report = self.template_engine.apply_template(report_content, &report_request.template)?;
        
        // Convert to requested format
        let formatted_report = self.format_converter.convert_format(templated_report, report_request.format)?;
        
        // Quality assurance check
        self.quality_assurance.validate_report(&formatted_report)?;
        
        // Prepare delivery
        let delivery_options = self.delivery_system.prepare_delivery(&formatted_report, &report_request.delivery)?;
        
        Ok(ReportPayload {
            report_id: Uuid::new_v4(),
            content: formatted_report,
            format: report_request.format,
            generated_at: Utc::now(),
            delivery_options,
        })
    }

    /// Generate executive summary
    pub async fn generate_executive_summary(
        &self,
        defense_data: DefenseData,
    ) -> Result<ExecutiveSummary, ReportingError> {
        self.report_generator.generate_executive_summary(defense_data)
    }

    /// Generate technical details report
    pub async fn generate_technical_report(
        &self,
        technical_data: TechnicalData,
    ) -> Result<TechnicalReport, ReportingError> {
        self.report_generator.generate_technical_report(technical_data)
    }

    /// Generate timeline reconstruction
    pub async fn generate_timeline(
        &self,
        timeline_data: TimelineData,
    ) -> Result<TimelineReport, ReportingError> {
        self.report_generator.generate_timeline(timeline_data)
    }

    /// Get reporting system status
    pub fn get_system_status(&self) -> ReportingStatus {
        ReportingStatus {
            total_reports_generated: self.report_generator.reports_generated,
            template_count: self.template_engine.templates.len(),
            format_support: self.format_converter.supported_formats(),
            quality_score: self.quality_assurance.get_quality_score(),
            last_report_time: self.report_generator.last_report_time,
        }
    }
}

/// Report Request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportRequest {
    pub report_type: ReportType,
    pub template: TemplateType,
    pub format: ReportFormat,
    pub delivery: DeliveryMethod,
    pub data: ReportData,
    pub customization: ReportCustomization,
}

/// Report Data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportData {
    pub defense_metrics: DefenseMetrics,
    pub incident_data: Vec<IncidentData>,
    pub evidence_summary: EvidenceSummary,
    pub recommendations: Vec<Recommendation>,
    pub client_info: ClientInfo,
}

/// Report Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportPayload {
    pub report_id: Uuid,
    pub content: ReportContent,
    pub format: ReportFormat,
    pub generated_at: DateTime<Utc>,
    pub delivery_options: DeliveryOptions,
}

/// Executive Summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutiveSummary {
    pub overview: String,
    pub key_findings: Vec<String>,
    pub risk_assessment: RiskAssessment,
    pub recommendations: Vec<String>,
    pub generated_at: DateTime<Utc>,
}

/// Technical Report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechnicalReport {
    pub technical_details: String,
    pub evidence_analysis: String,
    pub methodology: String,
    pub findings: Vec<TechnicalFinding>,
    pub appendices: Vec<Appendix>,
}

/// Timeline Report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineReport {
    pub events: Vec<TimelineEvent>,
    pub analysis: String,
    pub correlations: Vec<Correlation>,
    pub visualization_data: VisualizationData,
}

/// Reporting Status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportingStatus {
    pub total_reports_generated: u64,
    pub template_count: usize,
    pub format_support: Vec<ReportFormat>,
    pub quality_score: f64,
    pub last_report_time: Option<DateTime<Utc>>,
}

// Enums
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReportType {
    ExecutiveSummary,
    TechnicalReport,
    IncidentReport,
    ComplianceReport,
    ForensicReport,
    RiskAssessment,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TemplateType {
    Standard,
    Executive,
    Technical,
    Legal,
    Compliance,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReportFormat {
    Pdf(PdfOptions),
    Word(WordOptions),
    Html(HtmlOptions),
    Markdown(MarkdownOptions),
    Json(JsonOptions),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DeliveryMethod {
    Email(EmailDelivery),
    Portal(PortalDelivery),
    SecureTransfer(SecureTransfer),
    Physical(PhysicalDelivery),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReportingError {
    GenerationError(String),
    TemplateError(String),
    FormatError(String),
    QualityError(String),
    DeliveryError(String),
    ValidationError(String),
}

impl ReportingError {
    pub fn generation(msg: impl Into<String>) -> Self {
        Self::GenerationError(msg.into())
    }

    pub fn template(msg: impl Into<String>) -> Self {
        Self::TemplateError(msg.into())
    }

    pub fn format(msg: impl Into<String>) -> Self {
        Self::FormatError(msg.into())
    }

    pub fn quality(msg: impl Into<String>) -> Self {
        Self::QualityError(msg.into())
    }

    pub fn delivery(msg: impl Into<String>) -> Self {
        Self::DeliveryError(msg.into())
    }
}

/// Result type for reporting operations
pub type Result<T> = std::result::Result<T, ReportingError>;