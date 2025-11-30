use actix_web::{web, HttpResponse, Scope};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::ethics::{DefensiveAction, EthicalFramework};
use crate::evidence::EvidenceManager;
use crate::orchestration::BlueTeamOrchestrator;
use crate::reporting::ReportingSystem;

/// Cipher Guard API state
pub struct CipherGuardState {
    ethical_framework: Arc<RwLock<EthicalFramework>>,
    blue_team: Arc<RwLock<BlueTeamOrchestrator>>,
    evidence_manager: Arc<RwLock<EvidenceManager>>,
    reporting_system: Arc<RwLock<ReportingSystem>>,
}

impl CipherGuardState {
    pub fn new(
        ethical_framework: EthicalFramework,
        blue_team: BlueTeamOrchestrator,
        evidence_manager: EvidenceManager,
        reporting_system: ReportingSystem,
    ) -> Self {
        Self {
            ethical_framework: Arc::new(RwLock::new(ethical_framework)),
            blue_team: Arc::new(RwLock::new(blue_team)),
            evidence_manager: Arc::new(RwLock::new(evidence_manager)),
            reporting_system: Arc::new(RwLock::new(reporting_system)),
        }
    }
}

/// Configure Cipher Guard API routes
pub fn configure_routes() -> Scope {
    web::scope("/api/cipher-guard")
        .service(
            web::scope("/defensive")
                .route("/evaluate", web::post().to(evaluate_action))
                .route("/engage", web::post().to(engage_defense))
                .route("/status", web::get().to(get_defense_status))
                .route("/terminate", web::post().to(terminate_defense))
        )
        .service(
            web::scope("/evidence")
                .route("/collect", web::post().to(collect_evidence))
                .route("/retrieve/{id}", web::get().to(retrieve_evidence))
                .route("/validate/{id}", web::post().to(validate_evidence))
                .route("/chain/{id}", web::get().to(get_chain_of_custody))
        )
        .service(
            web::scope("/reporting")
                .route("/generate", web::post().to(generate_report))
                .route("/templates", web::get().to(list_templates))
                .route("/download/{id}", web::get().to(download_report))
        )
        .service(
            web::scope("/compliance")
                .route("/status", web::get().to(get_compliance_status))
                .route("/policies", web::get().to(list_policies))
                .route("/validate", web::post().to(validate_compliance))
        )
}

// API Types

#[derive(Debug, Serialize, Deserialize)]
pub struct DefensiveActionRequest {
    pub action: DefensiveAction,
    pub context: DefensiveContext,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DefensiveContext {
    pub incident_id: String,
    pub priority: Priority,
    pub scope: Vec<String>,
    pub constraints: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Priority {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DefenseEngagement {
    pub engagement_id: String,
    pub action_request: DefensiveActionRequest,
    pub status: EngagementStatus,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum EngagementStatus {
    Pending,
    Active,
    Completed,
    Terminated,
    Failed,
}

// API Handlers

async fn evaluate_action(
    state: web::Data<CipherGuardState>,
    request: web::Json<DefensiveActionRequest>,
) -> HttpResponse {
    let framework = state.ethical_framework.read().await;
    let evaluation = framework.evaluate_action(&request.action);
    
    HttpResponse::Ok().json(evaluation)
}

async fn engage_defense(
    state: web::Data<CipherGuardState>,
    request: web::Json<DefensiveActionRequest>,
) -> HttpResponse {
    // Evaluate action first
    let framework = state.ethical_framework.read().await;
    let evaluation = framework.evaluate_action(&request.action);
    
    if evaluation.overall_score < 0.7 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Action does not meet ethical requirements",
            "evaluation": evaluation
        }));
    }

    // Engage blue team
    let mut blue_team = state.blue_team.write().await;
    match blue_team.engage_defensive_action(request.0).await {
        Ok(engagement) => HttpResponse::Ok().json(engagement),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to engage defense: {}", e)
        }))
    }
}

async fn get_defense_status(
    state: web::Data<CipherGuardState>,
    engagement_id: web::Path<String>,
) -> HttpResponse {
    let blue_team = state.blue_team.read().await;
    match blue_team.get_engagement_status(&engagement_id).await {
        Ok(status) => HttpResponse::Ok().json(status),
        Err(e) => HttpResponse::NotFound().json(serde_json::json!({
            "error": format!("Engagement not found: {}", e)
        }))
    }
}

async fn terminate_defense(
    state: web::Data<CipherGuardState>,
    engagement_id: web::Path<String>,
) -> HttpResponse {
    let mut blue_team = state.blue_team.write().await;
    match blue_team.terminate_engagement(&engagement_id).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "message": "Defense engagement terminated successfully"
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to terminate defense: {}", e)
        }))
    }
}

async fn collect_evidence(
    state: web::Data<CipherGuardState>,
    request: web::Json<EvidenceCollectionRequest>,
) -> HttpResponse {
    let mut evidence_manager = state.evidence_manager.write().await;
    match evidence_manager.collect_evidence(request.0).await {
        Ok(evidence) => HttpResponse::Ok().json(evidence),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to collect evidence: {}", e)
        }))
    }
}

async fn retrieve_evidence(
    state: web::Data<CipherGuardState>,
    evidence_id: web::Path<String>,
) -> HttpResponse {
    let evidence_manager = state.evidence_manager.read().await;
    match evidence_manager.retrieve_evidence(&evidence_id).await {
        Ok(evidence) => HttpResponse::Ok().json(evidence),
        Err(e) => HttpResponse::NotFound().json(serde_json::json!({
            "error": format!("Evidence not found: {}", e)
        }))
    }
}

async fn validate_evidence(
    state: web::Data<CipherGuardState>,
    evidence_id: web::Path<String>,
) -> HttpResponse {
    let evidence_manager = state.evidence_manager.read().await;
    match evidence_manager.validate_evidence(&evidence_id).await {
        Ok(validation) => HttpResponse::Ok().json(validation),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": format!("Evidence validation failed: {}", e)
        }))
    }
}

async fn get_chain_of_custody(
    state: web::Data<CipherGuardState>,
    evidence_id: web::Path<String>,
) -> HttpResponse {
    let evidence_manager = state.evidence_manager.read().await;
    match evidence_manager.get_chain_of_custody(&evidence_id).await {
        Ok(chain) => HttpResponse::Ok().json(chain),
        Err(e) => HttpResponse::NotFound().json(serde_json::json!({
            "error": format!("Chain of custody not found: {}", e)
        }))
    }
}

async fn generate_report(
    state: web::Data<CipherGuardState>,
    request: web::Json<ReportGenerationRequest>,
) -> HttpResponse {
    let mut reporting_system = state.reporting_system.write().await;
    match reporting_system.generate_report(request.0).await {
        Ok(report) => HttpResponse::Ok().json(report),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to generate report: {}", e)
        }))
    }
}

async fn list_templates(state: web::Data<CipherGuardState>) -> HttpResponse {
    let reporting_system = state.reporting_system.read().await;
    let templates = reporting_system.list_templates().await;
    HttpResponse::Ok().json(templates)
}

async fn download_report(
    state: web::Data<CipherGuardState>,
    report_id: web::Path<String>,
) -> HttpResponse {
    let reporting_system = state.reporting_system.read().await;
    match reporting_system.get_report(&report_id).await {
        Ok(report) => HttpResponse::Ok()
            .content_type("application/octet-stream")
            .body(report),
        Err(e) => HttpResponse::NotFound().json(serde_json::json!({
            "error": format!("Report not found: {}", e)
        }))
    }
}

async fn get_compliance_status(state: web::Data<CipherGuardState>) -> HttpResponse {
    let framework = state.ethical_framework.read().await;
    let status = framework.get_compliance_status();
    HttpResponse::Ok().json(status)
}

async fn list_policies(state: web::Data<CipherGuardState>) -> HttpResponse {
    let framework = state.ethical_framework.read().await;
    let policies = framework.get_compliance_policies();
    HttpResponse::Ok().json(policies)
}

async fn validate_compliance(
    state: web::Data<CipherGuardState>,
    request: web::Json<ComplianceValidationRequest>,
) -> HttpResponse {
    let framework = state.ethical_framework.read().await;
    let validation = framework.validate_compliance(&request.policies);
    HttpResponse::Ok().json(validation)
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, App};

    #[actix_rt::test]
    async fn test_evaluate_action() {
        let state = CipherGuardState::new(
            EthicalFramework::new(),
            BlueTeamOrchestrator::new(),
            EvidenceManager::new(),
            ReportingSystem::new(),
        );

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(state))
                .service(configure_routes())
        ).await;

        let req = test::TestRequest::post()
            .uri("/api/cipher-guard/defensive/evaluate")
            .set_json(&DefensiveActionRequest {
                action: DefensiveAction {
                    action_type: "scan".to_string(),
                    target_scope: "network".to_string(),
                    estimated_impact: Default::default(),
                    safeguards: vec![],
                },
                context: DefensiveContext {
                    incident_id: "test-incident".to_string(),
                    priority: Priority::Medium,
                    scope: vec!["network".to_string()],
                    constraints: vec![],
                },
            })
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success());
    }
}