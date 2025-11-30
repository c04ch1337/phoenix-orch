use serde::{Deserialize, Serialize};

/// Professional Services Framework for engagement management
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfessionalServicesFramework {
    pub service_catalog: Vec<ServiceOffering>,
    pub engagement_templates: Vec<EngagementTemplate>,
    pub compliance_frameworks: Vec<ComplianceFramework>,
    pub reporting_standards: Vec<ReportingStandard>,
}

impl ProfessionalServicesFramework {
    pub fn new() -> Self {
        Self {
            service_catalog: vec![
                ServiceOffering::new("web_app_pentest", "Web Application Penetration Testing"),
                ServiceOffering::new("network_pentest", "Network Penetration Testing"),
                ServiceOffering::new("social_engineering", "Social Engineering Assessment"),
                ServiceOffering::new("red_team", "Full Red Team Engagement"),
            ],
            engagement_templates: vec![
                EngagementTemplate::new("standard", "Standard 2-Week Engagement"),
                EngagementTemplate::new("comprehensive", "Comprehensive 4-Week Engagement"),
                EngagementTemplate::new("rapid", "Rapid 1-Week Assessment"),
            ],
            compliance_frameworks: vec![
                ComplianceFramework::new("nist", "NIST Cybersecurity Framework"),
                ComplianceFramework::new("iso27001", "ISO 27001"),
                ComplianceFramework::new("pci_dss", "PCI DSS"),
                ComplianceFramework::new("hipaa", "HIPAA"),
            ],
            reporting_standards: vec![
                ReportingStandard::new("executive", "Executive Summary"),
                ReportingStandard::new("technical", "Technical Deep Dive"),
                ReportingStandard::new("remediation", "Remediation Guidance"),
            ],
        }
    }

    pub async fn create_engagement_proposal(&self, client_requirements: &ClientRequirements) -> Result<EngagementProposal, EmberUnitError> {
        // Match requirements to service offerings
        let matched_services = self.match_services_to_requirements(client_requirements);
        
        // Generate proposal
        Ok(EngagementProposal {
            client_name: client_requirements.client_name.clone(),
            services: matched_services,
            estimated_duration: self.calculate_duration(&matched_services),
            estimated_cost: self.calculate_cost(&matched_services),
            compliance_frameworks: client_requirements.compliance_frameworks.clone(),
            deliverables: self.generate_deliverables(&matched_services),
        })
    }

    pub async fn generate_statement_of_work(&self, proposal: &EngagementProposal) -> Result<StatementOfWork, EmberUnitError> {
        Ok(StatementOfWork {
            proposal: proposal.clone(),
            terms_and_conditions: self.generate_terms(),
            acceptance_criteria: self.generate_acceptance_criteria(),
            signature_blocks: Vec::new(),
        })
    }

    fn match_services_to_requirements(&self, requirements: &ClientRequirements) -> Vec<ServiceOffering> {
        self.service_catalog
            .iter()
            .filter(|service| {
                requirements.service_types.contains(&service.id) ||
                requirements.keywords.iter().any(|kw| service.description.contains(kw))
            })
            .cloned()
            .collect()
    }

    fn calculate_duration(&self, services: &[ServiceOffering]) -> u32 {
        services.iter().map(|s| s.typical_duration).sum()
    }

    fn calculate_cost(&self, services: &[ServiceOffering]) -> f64 {
        services.iter().map(|s| s.base_cost).sum()
    }

    fn generate_deliverables(&self, services: &[ServiceOffering]) -> Vec<String> {
        services.iter()
            .flat_map(|s| s.deliverables.clone())
            .collect()
    }

    fn generate_terms(&self) -> String {
        "Standard Phoenix ORCH terms and conditions apply.".to_string()
    }

    fn generate_acceptance_criteria(&self) -> Vec<String> {
        vec![
            "Successful completion of all testing phases".to_string(),
            "Delivery of comprehensive report".to_string(),
            "Client acceptance of findings".to_string(),
        ]
    }
}

/// Service offering in the catalog
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceOffering {
    pub id: String,
    pub description: String,
    pub typical_duration: u32, // days
    pub base_cost: f64,
    pub deliverables: Vec<String>,
}

impl ServiceOffering {
    pub fn new(id: &str, description: &str) -> Self {
        let (duration, cost, deliverables) = match id {
            "web_app_pentest" => (14, 15000.0, vec!["Web Application Security Report".to_string()]),
            "network_pentest" => (10, 12000.0, vec!["Network Security Assessment".to_string()]),
            "social_engineering" => (7, 8000.0, vec!["Social Engineering Report".to_string()]),
            "red_team" => (28, 35000.0, vec!["Comprehensive Red Team Report".to_string()]),
            _ => (5, 5000.0, vec!["Security Assessment Report".to_string()]),
        };

        Self {
            id: id.to_string(),
            description: description.to_string(),
            typical_duration: duration,
            base_cost: cost,
            deliverables,
        }
    }
}

/// Engagement template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngagementTemplate {
    pub id: String,
    pub description: String,
    pub phases: Vec<String>,
}

impl EngagementTemplate {
    pub fn new(id: &str, description: &str) -> Self {
        let phases = match id {
            "standard" => vec!["Kickoff".to_string(), "Reconnaissance".to_string(), "Testing".to_string(), "Reporting".to_string()],
            "comprehensive" => vec!["Planning".to_string(), "Reconnaissance".to_string(), "Vulnerability Assessment".to_string(), "Exploitation".to_string(), "Reporting".to_string(), "Debrief".to_string()],
            "rapid" => vec!["Quick Assessment".to_string(), "Reporting".to_string()],
            _ => vec!["Standard Engagement".to_string()],
        };

        Self {
            id: id.to_string(),
            description: description.to_string(),
            phases,
        }
    }
}

/// Compliance framework
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceFramework {
    pub id: String,
    pub name: String,
    pub requirements: Vec<String>,
}

impl ComplianceFramework {
    pub fn new(id: &str, name: &str) -> Self {
        let requirements = match id {
            "nist" => vec!["Identify".to_string(), "Protect".to_string(), "Detect".to_string(), "Respond".to_string(), "Recover".to_string()],
            "iso27001" => vec!["Risk Assessment".to_string(), "Security Controls".to_string(), "Continuous Improvement".to_string()],
            "pci_dss" => vec!["Network Security".to_string(), "Vulnerability Management".to_string(), "Access Control".to_string()],
            "hipaa" => vec!["Privacy Rule".to_string(), "Security Rule".to_string(), "Breach Notification".to_string()],
            _ => vec!["Basic Security Requirements".to_string()],
        };

        Self {
            id: id.to_string(),
            name: name.to_string(),
            requirements,
        }
    }
}

/// Reporting standard
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportingStandard {
    pub id: String,
    pub description: String,
    pub sections: Vec<String>,
}

impl ReportingStandard {
    pub fn new(id: &str, description: &str) -> Self {
        let sections = match id {
            "executive" => vec!["Executive Summary".to_string(), "Risk Overview".to_string(), "Recommendations".to_string()],
            "technical" => vec!["Methodology".to_string(), "Findings".to_string(), "Evidence".to_string(), "Remediation".to_string()],
            "remediation" => vec!["Vulnerability Details".to_string(), "Remediation Steps".to_string(), "Timeline".to_string()],
            _ => vec!["Standard Report Sections".to_string()],
        };

        Self {
            id: id.to_string(),
            description: description.to_string(),
            sections,
        }
    }
}

/// Client requirements for engagement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientRequirements {
    pub client_name: String,
    pub service_types: Vec<String>,
    pub keywords: Vec<String>,
    pub compliance_frameworks: Vec<String>,
    pub budget_constraints: Option<f64>,
    pub timeline_constraints: Option<u32>,
}

/// Engagement proposal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngagementProposal {
    pub client_name: String,
    pub services: Vec<ServiceOffering>,
    pub estimated_duration: u32,
    pub estimated_cost: f64,
    pub compliance_frameworks: Vec<String>,
    pub deliverables: Vec<String>,
}

/// Statement of work
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatementOfWork {
    pub proposal: EngagementProposal,
    pub terms_and_conditions: String,
    pub acceptance_criteria: Vec<String>,
    pub signature_blocks: Vec<SignatureBlock>,
}

/// Signature block for SOW
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureBlock {
    pub name: String,
    pub title: String,
    pub organization: String,
    pub signature: String,
    pub date: chrono::DateTime<chrono::Utc>,
}

/// API endpoints for professional services
pub struct ServicesApi;

impl ServicesApi {
    pub fn routes() -> impl warp::Filter<Extract = impl warp::Reply, Error = warp::Rejection> + Clone {
        warp::path!("api" / "v1" / "services" / "proposal")
            .and(warp::post())
            .and(warp::body::json())
            .and_then(Self::create_proposal)
            .or(warp::path!("api" / "v1" / "services" / "sow")
                .and(warp::post())
                .and(warp::body::json())
                .and_then(Self::generate_sow))
            .or(warp::path!("api" / "v1" / "reports" / "generate")
                .and(warp::post())
                .and(warp::body::json())
                .and_then(Self::generate_report))
    }

    async fn create_proposal(requirements: ClientRequirements) -> Result<impl warp::Reply, warp::Rejection> {
        let framework = ProfessionalServicesFramework::new();
        let proposal = framework.create_engagement_proposal(&requirements).await
            .map_err(|e| warp::reject::custom(ApiError(e)))?;
        
        Ok(warp::reply::json(&proposal))
    }

    async fn generate_sow(proposal: EngagementProposal) -> Result<impl warp::Reply, warp::Rejection> {
        let framework = ProfessionalServicesFramework::new();
        let sow = framework.generate_statement_of_work(&proposal).await
            .map_err(|e| warp::reject::custom(ApiError(e)))?;
        
        Ok(warp::reply::json(&sow))
    }

    async fn generate_report(report_request: ReportRequest) -> Result<impl warp::Reply, warp::Rejection> {
        // Placeholder implementation
        Ok(warp::reply::json(&serde_json::json!({
            "success": true,
            "report_id": uuid::Uuid::new_v4(),
            "message": "Report generated successfully"
        })))
    }
}

/// Report generation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportRequest {
    pub engagement_id: uuid::Uuid,
    pub report_type: String,
    pub format: String, // pdf, html, markdown
}

/// API error wrapper
#[derive(Debug)]
struct ApiError(EmberUnitError);

impl warp::reject::Reject for ApiError {}

use crate::error::EmberUnitError;