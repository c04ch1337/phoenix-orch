use actix_web::{test, web, App};
use chrono::Utc;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::time::Duration;

// Include our test modules
pub mod disk_encryption_test;
pub mod knowledge_base_test;
pub mod file_system_test;

use crate::{
    CipherGuard,
    DefensiveOperation,
    AgentCapability,
    AgentInterface,
    AgentHealth,
    AgentStatus,
    DefenseEvent,
    Evidence,
    ReportFormat,
    OperationError,
};

/// Integration test suite for Cipher Guard
#[tokio::test]
async fn test_complete_defensive_operation() {
    // Initialize Cipher Guard
    let cipher_guard = CipherGuard::new();
    
    // 1. Test Operation Start
    let operation = create_test_operation();
    let operation_id = cipher_guard.start_operation(operation.clone()).await.unwrap();
    
    // Verify operation started
    let status = cipher_guard.get_operation_status(&operation_id).await;
    assert_eq!(status.operation_id, operation_id);
    assert!(status.agent_health.len() > 0);
    
    // 2. Test Evidence Collection
    let evidence = collect_test_evidence(&operation_id);
    let evidence_manager = cipher_guard.evidence_manager.write().await;
    evidence_manager.add_evidence(&operation_id, evidence.clone()).await.unwrap();
    assert!(evidence_manager.get_evidence_count(&operation_id) > 0);
    
    // 3. Test Report Generation
    let reporting_system = cipher_guard.reporting_system.write().await;
    let report = reporting_system.generate_report(create_test_report_request()).await.unwrap();
    assert!(report.content.len() > 0);
    
    // 4. Test Ethical Evaluation
    let framework = cipher_guard.ethical_framework.read().await;
    let evaluation = framework.evaluate_action(&operation.into());
    assert!(evaluation.overall_score >= 0.7);
    
    // 5. Test Agent Integration
    let agent_status = cipher_guard.agent_integration.monitor_agents().await;
    assert!(agent_status.values().any(|status| status.status == AgentStatus::Healthy));
    
    // 6. Test WebSocket Events
    let ws_sender = cipher_guard.websocket.get_defense_sender();
    ws_sender.send(create_test_defense_event(&operation_id)).unwrap();
    
    // 7. Test Telemetry
    cipher_guard.telemetry.record_defensive_action(&create_test_action_metric()).await;
    let metrics = cipher_guard.telemetry.get_metrics_state().await;
    assert!(metrics.active_defenses > 0);
    
    // 8. Test Operation Stop
    cipher_guard.stop_operation(&operation_id).await.unwrap();
    let final_status = cipher_guard.get_operation_status(&operation_id).await;
    assert_eq!(final_status.evidence_count, 1);
}

#[tokio::test]
async fn test_api_endpoints() {
    // Initialize test app
    let cipher_guard = CipherGuard::new();
    let app_state = cipher_guard.init_api_state();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state))
            .service(crate::api::configure_routes())
    ).await;
    
    // 1. Test Defensive Action Evaluation
    let req = test::TestRequest::post()
        .uri("/api/cipher-guard/defensive/evaluate")
        .set_json(&create_test_action_request())
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
    
    // 2. Test Evidence Collection
    let req = test::TestRequest::post()
        .uri("/api/cipher-guard/evidence/collect")
        .set_json(&create_test_evidence_request())
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
    
    // 3. Test Report Generation
    let req = test::TestRequest::post()
        .uri("/api/cipher-guard/reporting/generate")
        .set_json(&create_test_report_request())
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[tokio::test]
async fn test_websocket_communication() {
    // Initialize WebSocket test client
    let cipher_guard = CipherGuard::new();
    let ws_service = cipher_guard.websocket.clone();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(ws_service))
            .route("/ws", web::get().to(|ws_service: web::Data<_>| async move {
                let resp = actix_web_actors::ws::WsResponseBuilder::new()
                    .start_with_actor(ws_service.create_websocket("test-client".to_string()));
                Ok::<_, actix_web::Error>(resp)
            }))
    ).await;
    
    let req = test::TestRequest::get().uri("/ws").to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[tokio::test]
async fn test_error_handling() {
    let cipher_guard = CipherGuard::new();
    
    // 1. Test Invalid Operation
    let invalid_op = DefensiveOperation {
        id: "invalid".to_string(),
        operation_type: "invalid".to_string(),
        target_scope: vec![],
        required_capabilities: vec![],
        constraints: Default::default(),
    };
    
    let result = cipher_guard.start_operation(invalid_op).await;
    assert!(matches!(result, Err(OperationError::EthicalConstraintViolation(_))));
    
    // 2. Test Invalid Evidence
    let evidence_manager = cipher_guard.evidence_manager.write().await;
    let result = evidence_manager.validate_evidence("invalid").await;
    assert!(result.is_err());
    
    // 3. Test Invalid Report Format
    let reporting_system = cipher_guard.reporting_system.write().await;
    let result = reporting_system.generate_report(create_invalid_report_request()).await;
    assert!(result.is_err());
}

// Helper functions to create test data

fn create_test_operation() -> DefensiveOperation {
    DefensiveOperation {
        id: "test-op".to_string(),
        operation_type: "monitor".to_string(),
        target_scope: vec!["network".to_string()],
        required_capabilities: vec![AgentCapability::NetworkMonitoring],
        constraints: Default::default(),
    }
}

fn create_test_evidence(operation_id: &str) -> Evidence {
    Evidence {
        id: "test-evidence".to_string(),
        operation_id: operation_id.to_string(),
        evidence_type: "network_capture".to_string(),
        content: vec![],
        metadata: HashMap::new(),
        timestamp: Utc::now().timestamp(),
        hash: "test-hash".to_string(),
    }
}

fn create_test_report_request() -> crate::reporting::ReportGenerationRequest {
    crate::reporting::ReportGenerationRequest {
        content: "Test Report".to_string(),
        format: ReportFormat::Html(Default::default()),
        metadata: HashMap::new(),
    }
}

fn create_test_defense_event(operation_id: &str) -> DefenseEvent {
    DefenseEvent::DefenseActivated {
        engagement_id: operation_id.to_string(),
        timestamp: Utc::now().timestamp(),
        defense_type: "monitor".to_string(),
    }
}

fn create_test_action_metric() -> crate::telemetry::DefensiveActionMetric {
    crate::telemetry::DefensiveActionMetric {
        action_type: "monitor".to_string(),
        target: "network".to_string(),
        duration: 1.0,
        timestamp: Utc::now().timestamp(),
        success: true,
        resource_usage: HashMap::new(),
    }
}

fn create_test_action_request() -> crate::api::DefensiveActionRequest {
    crate::api::DefensiveActionRequest {
        action: Default::default(),
        context: Default::default(),
    }
}

fn create_test_evidence_request() -> crate::api::EvidenceCollectionRequest {
    Default::default()
}

fn create_invalid_report_request() -> crate::reporting::ReportGenerationRequest {
    crate::reporting::ReportGenerationRequest {
        content: "".to_string(),
        format: ReportFormat::Html(Default::default()),
        metadata: HashMap::new(),
    }
}