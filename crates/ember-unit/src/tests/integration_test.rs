//! Integration tests for Ember Unit functionality

use super::*;
use tokio::test;

#[test]
async fn test_ember_unit_creation() {
    let ember_unit = EmberUnitService::new();
    assert!(ember_unit.is_ok());
}

#[test]
async fn test_engagement_creation() {
    let mut ember_unit = EmberUnitService::new().unwrap();
    
    let target_scope = TargetScope {
        target: "example.com".to_string(),
        scope: vec!["example.com".to_string(), "*.example.com".to_string()],
        exclusions: vec!["production.example.com".to_string()],
        rules_of_engagement: vec![
            "No destructive actions".to_string(),
            "Business hours only".to_string(),
        ],
    };
    
    let result = ember_unit.initiate_engagement(target_scope).await;
    assert!(result.is_ok());
    let engagement_id = result.unwrap();
    assert!(!engagement_id.is_nil());
}

#[test]
async fn test_conscience_integration() {
    let mut ember_unit = EmberUnitService::new().unwrap();
    
    // Test ethical target
    let ethical_target = TargetScope {
        target: "test.example.com".to_string(),
        scope: vec!["test.example.com".to_string()],
        exclusions: vec![],
        rules_of_engagement: vec!["Authorized testing".to_string()],
    };
    
    let result = ember_unit.initiate_engagement(ethical_target).await;
    assert!(result.is_ok());
    
    // Test potentially unethical target
    let questionable_target = TargetScope {
        target: "government.gov".to_string(),
        scope: vec!["government.gov".to_string()],
        exclusions: vec![],
        rules_of_engagement: vec![],
    };
    
    let result = ember_unit.initiate_engagement(questionable_target).await;
    // This should fail due to conscience validation
    assert!(result.is_err());
}

#[test]
async fn test_plastic_ltm_integration() {
    let mut ember_unit = EmberUnitService::new().unwrap();
    
    let target_scope = TargetScope {
        target: "test-log.example.com".to_string(),
        scope: vec!["test-log.example.com".to_string()],
        exclusions: vec![],
        rules_of_engagement: vec!["Log all operations".to_string()],
    };
    
    let engagement_id = ember_unit.initiate_engagement(target_scope).await.unwrap();
    
    // Log an operation
    let result = ember_unit.plastic_ltm.log_operation(
        engagement_id,
        "port_scan",
        "Scanning ports 80,443",
        "info",
        EngagementPhase::Reconnaissance,
        None,
    ).await;
    
    assert!(result.is_ok());
    
    // Retrieve logs
    let logs = ember_unit.plastic_ltm.get_operation_logs(engagement_id).await;
    assert!(logs.is_ok());
    assert_eq!(logs.unwrap().len(), 1);
}

#[test]
async fn test_world_model_integration() {
    let ember_unit = EmberUnitService::new().unwrap();
    
    // Analyze a target
    let analysis = ember_unit.world_model.analyze_target("webapp.example.com").await;
    assert!(analysis.is_ok());
    
    let analysis = analysis.unwrap();
    assert_eq!(analysis.target, "webapp.example.com");
    assert!(!analysis.vulnerabilities.is_empty());
    assert!(analysis.risk_score >= 0.0 && analysis.risk_score <= 1.0);
}

#[test]
async fn test_agent_spawning() {
    let mut ember_unit = EmberUnitService::new().unwrap();
    
    let target_scope = TargetScope {
        target: "agent-test.example.com".to_string(),
        scope: vec!["agent-test.example.com".to_string()],
        exclusions: vec![],
        rules_of_engagement: vec!["Test agent deployment".to_string()],
    };
    
    let engagement_id = ember_unit.initiate_engagement(target_scope).await.unwrap();
    
    // Spawn an agent
    let result = ember_unit.spawn_agent(engagement_id, "basic_scanner").await;
    assert!(result.is_ok());
    let agent_id = result.unwrap();
    assert!(!agent_id.is_nil());
}

#[test]
async fn test_report_generation() {
    let ember_unit = EmberUnitService::new().unwrap();
    
    let target_scope = TargetScope {
        target: "report-test.example.com".to_string(),
        scope: vec!["report-test.example.com".to_string()],
        exclusions: vec![],
        rules_of_engagement: vec!["Generate test report".to_string()],
    };
    
    let engagement_id = ember_unit.initiate_engagement(target_scope).await.unwrap();
    
    // Generate report
    let result = ember_unit.generate_professional_report(
        engagement_id,
        "executive_summary",
        ReportFormat::Pdf,
    ).await;
    
    assert!(result.is_ok());
}

#[test]
async fn test_safety_engine() {
    let ember_unit = EmberUnitService::new().unwrap();
    
    // Test safety validation
    let operation_request = OperationRequest {
        operation_type: "network_scan".to_string(),
        target: "sensitive-target.com".to_string(),
        risk_level: "high".to_string(),
        consent_provided: Some(false),
        region: "restricted".to_string(),
        industry: "defense".to_string(),
        data_handling: "classified".to_string(),
    };
    
    let validation = ember_unit.safety_engine.validate_operation(&operation_request).await;
    assert!(validation.is_ok());
    let validation = validation.unwrap();
    assert!(!validation.is_valid); // Should fail due to lack of consent and restricted region
}

#[test]
async fn test_phase_execution() {
    let mut ember_unit = EmberUnitService::new().unwrap();
    
    let target_scope = TargetScope {
        target: "phase-test.example.com".to_string(),
        scope: vec!["phase-test.example.com".to_string()],
        exclusions: vec![],
        rules_of_engagement: vec!["Test phase execution".to_string()],
    };
    
    let engagement_id = ember_unit.initiate_engagement(target_scope).await.unwrap();
    
    // Execute kickoff phase
    let result = ember_unit.execute_phase(engagement_id, EngagementPhase::Kickoff).await;
    assert!(result.is_ok());
    
    let phase_result = result.unwrap();
    assert!(phase_result.success);
    assert!(phase_result.message.contains("kickoff"));
}

/// Comprehensive integration test covering all components
#[test]
async fn test_comprehensive_integration() {
    let mut ember_unit = EmberUnitService::new().unwrap();
    
    // Create engagement
    let target_scope = TargetScope {
        target: "comprehensive-test.example.com".to_string(),
        scope: vec!["comprehensive-test.example.com".to_string(), "*.comprehensive-test.example.com".to_string()],
        exclusions: vec!["db.comprehensive-test.example.com".to_string()],
        rules_of_engagement: vec![
            "Comprehensive testing only".to_string(),
            "No production impact".to_string(),
        ],
    };
    
    let engagement_id = ember_unit.initiate_engagement(target_scope).await.unwrap();
    
    // Spawn agent
    let agent_id = ember_unit.spawn_agent(engagement_id, "advanced_scanner").await.unwrap();
    
    // Log operations
    ember_unit.plastic_ltm.log_operation(
        engagement_id,
        "agent_deployed",
        &format!("Agent {} deployed successfully", agent_id),
        "info",
        EngagementPhase::Kickoff,
        Some(agent_id),
    ).await.unwrap();
    
    // Update world model
    ember_unit.world_model.update_world_state(
        engagement_id,
        "agent_deployment",
        serde_json::json!({"agent_id": agent_id, "status": "active"}),
        0.9,
    ).await.unwrap();
    
    // Execute phases
    let phases = [
        EngagementPhase::Reconnaissance,
        EngagementPhase::VulnerabilityDiscovery,
        EngagementPhase::Reporting,
    ];
    
    for phase in phases {
        let result = ember_unit.execute_phase(engagement_id, phase).await;
        assert!(result.is_ok(), "Failed to execute phase: {:?}", phase);
    }
    
    // Generate final report
    let report = ember_unit.generate_professional_report(
        engagement_id,
        "comprehensive",
        ReportFormat::Html,
    ).await;
    
    assert!(report.is_ok(), "Failed to generate comprehensive report");
    
    // Verify engagement status
    let status = ember_unit.get_engagement_status(engagement_id).await;
    assert!(status.is_some(), "Engagement status should be available");
    
    tracing::info!("Comprehensive integration test completed successfully");
}