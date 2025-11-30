//! ConscienceGate Tests
//! 
//! This module contains tests for the ConscienceGate implementation.

use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::SystemTime;
use async_trait::async_trait;

use crate::modules::orchestrator::conscience::{
    ConscienceGate, ConscienceConfig, HitmConfig, HitmTimeoutAction, HumanReviewService
};
use crate::modules::orchestrator::tools::ToolParameters;
use crate::modules::orchestrator::types::{
    ConscienceRequest, ConscienceResult, RequestId, RequestOrigin,
    HitmResponse, HitmStatus, RiskLevel
};
use crate::modules::orchestrator::errors::PhoenixResult;

/// A mock human review service that always approves requests
pub struct ApprovalHumanReviewService {}

impl ApprovalHumanReviewService {
    pub fn new() -> Self {
        Self {}
    }
}

#[async_trait]
impl HumanReviewService for ApprovalHumanReviewService {
    async fn submit_for_review(&self, request: &ConscienceRequest, _evaluation: &ConscienceResult) -> PhoenixResult<HitmResponse> {
        Ok(HitmResponse {
            request_id: request.id.clone(),
            status: HitmStatus::Approved,
            comments: Some("Automatically approved for testing".to_string()),
            timestamp: SystemTime::now(),
            reviewer_id: Some("test-reviewer".to_string()),
        })
    }
    
    async fn is_reviewer_available(&self) -> PhoenixResult<bool> {
        Ok(true)
    }
}

/// A mock human review service that always rejects requests
pub struct RejectionHumanReviewService {}

impl RejectionHumanReviewService {
    pub fn new() -> Self {
        Self {}
    }
}

#[async_trait]
impl HumanReviewService for RejectionHumanReviewService {
    async fn submit_for_review(&self, request: &ConscienceRequest, _evaluation: &ConscienceResult) -> PhoenixResult<HitmResponse> {
        Ok(HitmResponse {
            request_id: request.id.clone(),
            status: HitmStatus::Rejected,
            comments: Some("Automatically rejected for testing".to_string()),
            timestamp: SystemTime::now(),
            reviewer_id: Some("test-reviewer".to_string()),
        })
    }
    
    async fn is_reviewer_available(&self) -> PhoenixResult<bool> {
        Ok(true)
    }
}

/// A mock human review service that simulates timeouts
pub struct TimeoutHumanReviewService {}

impl TimeoutHumanReviewService {
    pub fn new() -> Self {
        Self {}
    }
}

#[async_trait]
impl HumanReviewService for TimeoutHumanReviewService {
    async fn submit_for_review(&self, request: &ConscienceRequest, _evaluation: &ConscienceResult) -> PhoenixResult<HitmResponse> {
        // Sleep for longer than the timeout to simulate a timeout
        tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
        
        Ok(HitmResponse {
            request_id: request.id.clone(),
            status: HitmStatus::TimedOut,
            comments: None,
            timestamp: SystemTime::now(),
            reviewer_id: None,
        })
    }
    
    async fn is_reviewer_available(&self) -> PhoenixResult<bool> {
        Ok(true)
    }
}

/// Helper function to create a test request for medical data leak
fn create_medical_leak_request() -> ConscienceRequest {
    ConscienceRequest {
        id: RequestId::new(),
        action: "Export patient records".to_string(),
        tool_id: "export_patient_data".to_string(),
        parameters: ToolParameters::from(r#"{"patient_id": "12345", "record_type": "medical_history"}"#.to_string()),
        context: HashMap::new(),
        timestamp: SystemTime::now(),
        origin: RequestOrigin::User,
    }
}

/// Helper function to create an obfuscated medical data leak request
fn create_obfuscated_medical_leak_request() -> ConscienceRequest {
    ConscienceRequest {
        id: RequestId::new(),
        action: "Export user data".to_string(),
        tool_id: "export_data".to_string(),
        parameters: ToolParameters::from(r#"{"id": "12345", "type": "p4t13nt h3alth"}"#.to_string()),
        context: HashMap::new(),
        timestamp: SystemTime::now(),
        origin: RequestOrigin::User,
    }
}

/// Helper function to create a borderline case request
fn create_borderline_request() -> ConscienceRequest {
    ConscienceRequest {
        id: RequestId::new(),
        action: "Export anonymized statistics".to_string(),
        tool_id: "export_data".to_string(),
        parameters: ToolParameters::from(r#"{"source": "patient_records", "type": "anonymized_statistics"}"#.to_string()),
        context: HashMap::new(),
        timestamp: SystemTime::now(),
        origin: RequestOrigin::User,
    }
}

/// Helper function to create a safe request
fn create_safe_request() -> ConscienceRequest {
    ConscienceRequest {
        id: RequestId::new(),
        action: "Get public information".to_string(),
        tool_id: "get_public_info".to_string(),
        parameters: ToolParameters::from(r#"{"subject": "general health guidelines"}"#.to_string()),
        context: HashMap::new(),
        timestamp: SystemTime::now(),
        origin: RequestOrigin::User,
    }
}

/// Test that medical data leak requests are rejected
#[tokio::test]
async fn test_medical_data_leak_rejection() {
    // Create ConscienceGate with default config
    let config = ConscienceConfig::default();
    let conscience_gate = ConscienceGate::new(config, None).await.unwrap();
    
    // Test with medical data leak request
    let request = create_medical_leak_request();
    let result = conscience_gate.evaluate(request).await.unwrap();
    
    // Request should be rejected
    assert!(!result.approved);
    assert!(result.risk_level == RiskLevel::Critical || result.risk_level == RiskLevel::High);
    assert!(!result.violations.is_empty());
}

/// Test that obfuscated medical data leak attempts are detected
#[tokio::test]
async fn test_obfuscated_medical_data_detection() {
    // Create ConscienceGate with default config
    let config = ConscienceConfig {
        enable_advanced_detection: true,
        ..Default::default()
    };
    
    let conscience_gate = ConscienceGate::new(config, None).await.unwrap();
    
    // Test with obfuscated medical data leak request
    let request = create_obfuscated_medical_leak_request();
    let result = conscience_gate.evaluate(request).await.unwrap();
    
    // Request should be rejected
    assert!(!result.approved);
    assert!(result.confidence < 0.6);
    assert!(!result.violations.is_empty());
}

/// Test that borderline cases trigger human review
#[tokio::test]
async fn test_borderline_case_human_review() {
    // Create config with HITM enabled
    let config = ConscienceConfig {
        hitm_config: HitmConfig {
            confidence_threshold: 0.9,
            enabled: true,
            timeout_seconds: 300,
            default_timeout_action: HitmTimeoutAction::Deny,
        },
        ..Default::default()
    };
    
    // Create ConscienceGate without human review service
    let conscience_gate = ConscienceGate::new(config, None).await.unwrap();
    
    // Test with borderline case
    let request = create_borderline_request();
    let result = conscience_gate.evaluate(request).await.unwrap();
    
    // Should require human review
    assert!(result.requires_human_review);
}

/// Test that HITM approvals override conscience decisions
#[tokio::test]
async fn test_hitm_approval_override() {
    // Create a mock review service that always approves
    let review_service = Arc::new(ApprovalHumanReviewService::new());
    
    // Create config with HITM enabled
    let config = ConscienceConfig {
        hitm_config: HitmConfig {
            confidence_threshold: 0.9,
            enabled: true,
            timeout_seconds: 1, // Quick timeout for testing
            default_timeout_action: HitmTimeoutAction::Deny,
        },
        ..Default::default()
    };
    
    // Create ConscienceGate with human review service
    let conscience_gate = ConscienceGate::new(config, Some(review_service)).await.unwrap();
    
    // Test with borderline case
    let request = create_borderline_request();
    let result = conscience_gate.evaluate(request).await.unwrap();
    
    // Should be approved after HITM review
    assert!(result.approved);
    assert!(result.justification.contains("human review"));
}

/// Test that HITM rejections override conscience decisions
#[tokio::test]
async fn test_hitm_rejection_override() {
    // Create a mock review service that always rejects
    let review_service = Arc::new(RejectionHumanReviewService::new());
    
    // Create config with HITM enabled
    let config = ConscienceConfig {
        hitm_config: HitmConfig {
            confidence_threshold: 0.9,
            enabled: true,
            timeout_seconds: 1, // Quick timeout for testing
            default_timeout_action: HitmTimeoutAction::Allow,
        },
        ..Default::default()
    };
    
    // Create ConscienceGate with human review service
    let conscience_gate = ConscienceGate::new(config, Some(review_service)).await.unwrap();
    
    // Test with safe request that would normally be approved
    let request = create_safe_request();
    let result = conscience_gate.evaluate(request).await.unwrap();
    
    // Should be rejected after HITM review
    assert!(!result.approved);
    assert!(result.justification.contains("human review"));
}

/// Test that timeouts use the default timeout action
#[tokio::test]
#[ignore] // This test takes too long to run normally
async fn test_hitm_timeout() {
    // Create a mock review service that times out
    let review_service = Arc::new(TimeoutHumanReviewService::new());
    
    // Create config with HITM enabled and deny on timeout
    let config = ConscienceConfig {
        hitm_config: HitmConfig {
            confidence_threshold: 0.9,
            enabled: true,
            timeout_seconds: 1, // Very quick timeout for testing
            default_timeout_action: HitmTimeoutAction::Deny,
        },
        ..Default::default()
    };
    
    // Create ConscienceGate with human review service
    let conscience_gate = ConscienceGate::new(config, Some(review_service)).await.unwrap();
    
    // Test with safe request
    let request = create_safe_request();
    let result = conscience_gate.evaluate(request).await.unwrap();
    
    // Should be denied due to timeout
    assert!(!result.approved);
    assert!(result.justification.contains("timeout"));
}

/// Test that the confidence level affects the requires_human_review flag
#[tokio::test]
async fn test_confidence_threshold() {
    // Create configs with different confidence thresholds
    let high_threshold_config = ConscienceConfig {
        hitm_config: HitmConfig {
            confidence_threshold: 0.95,
            enabled: true,
            timeout_seconds: 300,
            default_timeout_action: HitmTimeoutAction::Deny,
        },
        ..Default::default()
    };
    
    let low_threshold_config = ConscienceConfig {
        hitm_config: HitmConfig {
            confidence_threshold: 0.3,
            enabled: true,
            timeout_seconds: 300,
            default_timeout_action: HitmTimeoutAction::Deny,
        },
        ..Default::default()
    };
    
    // Create ConscienceGates
    let high_threshold_gate = ConscienceGate::new(high_threshold_config, None).await.unwrap();
    let low_threshold_gate = ConscienceGate::new(low_threshold_config, None).await.unwrap();
    
    // Test with safe request
    let request = create_safe_request();
    
    // With high threshold, even safe requests might require review
    let high_threshold_result = high_threshold_gate.evaluate(request.clone()).await.unwrap();
    
    // With low threshold, safe requests should not require review
    let low_threshold_result = low_threshold_gate.evaluate(request).await.unwrap();
    
    // Check that the confidence threshold affects the requires_human_review flag
    assert!(high_threshold_result.requires_human_review || high_threshold_result.confidence > 0.95);
    assert!(!low_threshold_result.requires_human_review || low_threshold_result.confidence <= 0.3);
}

/// Test that detailed reasoning is provided
#[tokio::test]
async fn test_detailed_reasoning() {
    // Create ConscienceGate with default config
    let config = ConscienceConfig::default();
    let conscience_gate = ConscienceGate::new(config, None).await.unwrap();
    
    // Test with medical data leak request
    let request = create_medical_leak_request();
    let result = conscience_gate.evaluate(request).await.unwrap();
    
    // Should have detailed reasoning
    assert!(result.reasoning.is_some());
    let reasoning = result.reasoning.unwrap();
    
    // Reasoning should be detailed
    assert!(reasoning.contains("Risk assessment"));
    assert!(reasoning.contains("Recommendation:"));
}