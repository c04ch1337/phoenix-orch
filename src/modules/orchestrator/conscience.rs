//! ConscienceGate Implementation
//!
//! This module contains the ConscienceGate implementation, which provides
//! ethical validation for requests.

use std::sync::{Arc, RwLock};
use std::collections::{HashMap, VecDeque};
use std::time::{SystemTime, Duration};
use async_trait::async_trait;
use tokio::sync::mpsc;
use tokio::time::timeout;
use serde::{Serialize, Deserialize};

use crate::modules::orchestrator::errors::{PhoenixResult, PhoenixError, AgentErrorKind};
use crate::modules::orchestrator::tools::ToolParameters;
use crate::modules::orchestrator::types::{
    ConscienceRequest, ConscienceResult, RequestId, RequestOrigin,
    RiskLevel, HitmStatus, HitmResponse, AuditRecord
};

// Mobile conscience gate integration
pub mod mobile_gate;
use mobile_gate::MobileConscienceGate;

/// Extended conscience configuration with mobile gate options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConscienceConfig {
    /// HITM configuration for human intervention
    pub hitm_config: HitmConfig,
    
    /// Audit log capacity
    pub audit_log_capacity: usize,
    
    /// Violation log capacity
    pub violation_log_capacity: usize,
    
    /// Whether to enable advanced pattern detection
    pub enable_advanced_detection: bool,
    
    /// Whether to enable mobile conscience gate
    pub enable_mobile_gate: bool,
}

/// HITM configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HitmConfig {
    /// Confidence threshold below which human review is required
    pub confidence_threshold: f32,
    
    /// Whether human review is enabled
    pub enabled: bool,
    
    /// Timeout for human review in seconds
    pub timeout_seconds: u64,
    
    /// Default action if human review times out
    pub default_timeout_action: HitmTimeoutAction,
}

impl Default for HitmConfig {
    fn default() -> Self {
        Self {
            confidence_threshold: 0.8,
            enabled: true,
            timeout_seconds: 300, // 5 minutes
            default_timeout_action: HitmTimeoutAction::Deny,
        }
    }
}

/// Action to take when human review times out
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HitmTimeoutAction {
    /// Allow the request
    Allow,
    
    /// Deny the request
    Deny,
    
    /// Use the conscience decision
    UseConscienceDecision,
}

/// Conscience configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConscienceConfig {
    /// HITM configuration for human intervention
    pub hitm_config: HitmConfig,
    
    /// Audit log capacity
    pub audit_log_capacity: usize,
    
    /// Violation log capacity
    pub violation_log_capacity: usize,
    
    /// Whether to enable advanced pattern detection
    pub enable_advanced_detection: bool,
}

impl Default for ConscienceConfig {
    fn default() -> Self {
        Self {
            hitm_config: HitmConfig::default(),
            audit_log_capacity: 1000,
            violation_log_capacity: 100,
            enable_advanced_detection: true,
            enable_mobile_gate: true,  // Enable mobile gate by default
        }
    }
}

/// HITM review request
#[derive(Debug, Clone)]
struct HitmReviewRequest {
    /// Request being reviewed
    pub request: ConscienceRequest,
    
    /// Initial conscience evaluation result
    pub evaluation: ConscienceResult,
    
    /// Timestamp when the review was requested
    pub timestamp: SystemTime,
    
    /// Channel to send the review response
    pub response_tx: Option<mpsc::Sender<HitmResponse>>,
}

/// Interface for human review services
#[async_trait]
pub trait HumanReviewService: Send + Sync {
    /// Submit a request for human review
    async fn submit_for_review(&self, request: &ConscienceRequest, evaluation: &ConscienceResult) -> PhoenixResult<HitmResponse>;
    
    /// Check if a human reviewer is available
    async fn is_reviewer_available(&self) -> PhoenixResult<bool>;
}

/// ConscienceGate implements ethical validation for requests
pub struct ConscienceGate {
    /// HITM configuration for human intervention
    pub hitm_config: HitmConfig,
    
    /// Audit trail of all requests and decisions
    audit_trail: VecDeque<AuditRecord>,
    
    /// Violation history for analysis
    violation_history: VecDeque<(ConscienceRequest, ConscienceResult)>,
    
    /// Pending HITM reviews
    pending_reviews: HashMap<RequestId, HitmReviewRequest>,
    
    /// Human review service for HITM
    human_review_service: Option<Arc<dyn HumanReviewService>>,
    
    /// Whether to enable advanced detection of sensitive patterns
    enable_advanced_detection: bool,
    
    /// Mobile conscience gate for mobile-specific evaluations
    mobile_gate: Option<MobileConscienceGate>,
    
    /// Whether mobile gate is enabled
    enable_mobile_gate: bool,
}

impl ConscienceGate {
    /// Create a new ConscienceGate
    pub async fn new(
        config: ConscienceConfig,
        human_review_service: Option<Arc<dyn HumanReviewService>>,
    ) -> PhoenixResult<Self> {
        let mobile_gate = if config.enable_mobile_gate {
            Some(MobileConscienceGate::new())
        } else {
            None
        };

        Ok(Self {
            hitm_config: config.hitm_config,
            audit_trail: VecDeque::with_capacity(config.audit_log_capacity),
            violation_history: VecDeque::with_capacity(config.violation_log_capacity),
            pending_reviews: HashMap::new(),
            human_review_service,
            enable_advanced_detection: config.enable_advanced_detection,
            mobile_gate,
            enable_mobile_gate: config.enable_mobile_gate,
        })
    }
    
    /// Evaluate a request against ethical principles
    pub async fn evaluate(&self, request: ConscienceRequest) -> PhoenixResult<ConscienceResult> {
        // First, check if this is a mobile action and mobile gate is enabled
        if self.enable_mobile_gate && self.mobile_gate.is_some() {
            // Use mobile gate for mobile-specific evaluations
            let mobile_gate = self.mobile_gate.as_ref().unwrap();
            
            // Check if this is a mobile action using the mobile gate's detection
            if mobile_gate::MobileActionType::from_request(&request).is_some() {
                let mobile_result = mobile_gate.evaluate(&request);
                
                // Record the evaluation for audit purposes
                self.record_evaluation(&request, &mobile_result);
                
                // If human review is required and enabled, initiate the HITM process
                if mobile_result.requires_human_review && self.hitm_config.enabled && self.human_review_service.is_some() {
                    return self.handle_hitm_review(request, mobile_result).await;
                }
                
                return Ok(mobile_result);
            }
        }
        
        // Fall back to standard evaluation for non-mobile actions
        // Check for sensitive patterns in the action
        let sensitive_patterns = self.check_sensitive_patterns(&request);
        
        // Check for sensitive data
        let contains_sensitive_data = self.contains_sensitive_data(&request);
        
        // Determine risk level
        let risk_level = self.determine_risk_level(&request, sensitive_patterns, contains_sensitive_data);
        
        // Generate detailed reasoning
        let reasoning = self.generate_reasoning(&request, sensitive_patterns, contains_sensitive_data, risk_level);
        
        // Determine if request should be approved based on risk level
        let approved = match risk_level {
            RiskLevel::Low => true,
            RiskLevel::Medium => true, // Approved but may require human review
            RiskLevel::High => false,
            RiskLevel::Critical => false,
        };
        
        // Calculate confidence based on risk level
        let confidence = match risk_level {
            RiskLevel::Low => 1.0,
            RiskLevel::Medium => 0.7,
            RiskLevel::High => 0.3,
            RiskLevel::Critical => 0.0,
        };
        
        // Determine if human review is required
        let requires_human_review =
            (self.hitm_config.enabled && confidence < self.hitm_config.confidence_threshold) ||
            risk_level == RiskLevel::Medium ||
            (sensitive_patterns && !contains_sensitive_data) || // Ambiguous cases
            self.is_borderline_case(&request);
        
        // Gather violations
        let mut violations = Vec::new();
        if sensitive_patterns {
            violations.push("Request contains sensitive medical patterns".to_string());
        }
        if contains_sensitive_data {
            violations.push("Request contains potential sensitive data".to_string());
        }
        
        // Gather warnings
        let mut warnings = Vec::new();
        if self.is_borderline_case(&request) {
            warnings.push("Request is a borderline case that might require extra scrutiny".to_string());
        }
        
        // Create justification
        let justification = match risk_level {
            RiskLevel::Low => "Request does not violate ethical guidelines".to_string(),
            RiskLevel::Medium => "Request has some potential ethical concerns".to_string(),
            RiskLevel::High => "Request has significant ethical concerns".to_string(),
            RiskLevel::Critical => "Request has critical ethical violations".to_string(),
        };
        
        // Create result
        let result = ConscienceResult {
            approved,
            confidence,
            justification,
            warnings,
            violations,
            requires_human_review,
            reasoning: Some(reasoning),
            risk_level,
        };
        
        // Record the evaluation for audit purposes
        self.record_evaluation(&request, &result);
        
        // If human review is required and enabled, initiate the HITM process
        if requires_human_review && self.hitm_config.enabled && self.human_review_service.is_some() {
            return self.handle_hitm_review(request, result).await;
        }
        
        Ok(result)
    }
    
    /// Handle Human-In-The-Middle (HITM) review for a request
    async fn handle_hitm_review(&self, request: ConscienceRequest, evaluation: ConscienceResult) -> PhoenixResult<ConscienceResult> {
        // Check if a human reviewer is available
        let reviewer_available = match &self.human_review_service {
            Some(service) => service.is_reviewer_available().await?,
            None => return Ok(evaluation), // No review service, return original evaluation
        };
        
        if !reviewer_available {
            // No reviewer available, use default action
            return match self.hitm_config.default_timeout_action {
                HitmTimeoutAction::Allow => Ok(ConscienceResult { 
                    approved: true,
                    ..evaluation
                }),
                HitmTimeoutAction::Deny => Ok(ConscienceResult {
                    approved: false,
                    justification: format!("{} (No human reviewer available)", evaluation.justification),
                    ..evaluation
                }),
                HitmTimeoutAction::UseConscienceDecision => Ok(evaluation),
            };
        }
        
        // Submit for human review
        if let Some(service) = &self.human_review_service {
            let timeout_duration = Duration::from_secs(self.hitm_config.timeout_seconds);
            
            // Attempt to get human review with timeout
            match timeout(timeout_duration, service.submit_for_review(&request, &evaluation)).await {
                Ok(review_result) => {
                    match review_result {
                        Ok(hitm_response) => {
                            // Update evaluation based on human review
                            let mut updated_evaluation = evaluation.clone();
                            
                            match hitm_response.status {
                                HitmStatus::Approved => {
                                    updated_evaluation.approved = true;
                                    updated_evaluation.justification = format!(
                                        "Request approved after human review. {}",
                                        hitm_response.comments.unwrap_or_default()
                                    );
                                },
                                HitmStatus::Rejected => {
                                    updated_evaluation.approved = false;
                                    updated_evaluation.justification = format!(
                                        "Request rejected after human review. {}",
                                        hitm_response.comments.unwrap_or_default()
                                    );
                                },
                                HitmStatus::TimedOut => {
                                    // Use default timeout action
                                    match self.hitm_config.default_timeout_action {
                                        HitmTimeoutAction::Allow => {
                                            updated_evaluation.approved = true;
                                            updated_evaluation.justification = "Request approved after human review timeout (default: allow)".to_string();
                                        },
                                        HitmTimeoutAction::Deny => {
                                            updated_evaluation.approved = false;
                                            updated_evaluation.justification = "Request rejected after human review timeout (default: deny)".to_string();
                                        },
                                        HitmTimeoutAction::UseConscienceDecision => {
                                            // Keep original evaluation
                                            updated_evaluation.justification = format!(
                                                "{} (Human review timed out, using conscience decision)",
                                                updated_evaluation.justification
                                            );
                                        },
                                    }
                                },
                                _ => {}
                            }
                            
                            // Record HITM review in audit trail
                            self.record_hitm_review(&request, &updated_evaluation, &hitm_response);
                            
                            return Ok(updated_evaluation);
                        },
                        Err(e) => {
                            // Error in human review, use default action
                            return match self.hitm_config.default_timeout_action {
                                HitmTimeoutAction::Allow => Ok(ConscienceResult {
                                    approved: true,
                                    justification: format!("Request approved after human review error: {}", e),
                                    ..evaluation
                                }),
                                HitmTimeoutAction::Deny => Ok(ConscienceResult {
                                    approved: false,
                                    justification: format!("Request rejected after human review error: {}", e),
                                    ..evaluation
                                }),
                                HitmTimeoutAction::UseConscienceDecision => Ok(evaluation),
                            };
                        }
                    }
                },
                Err(_) => {
                    // Timeout waiting for human review, use default action
                    return match self.hitm_config.default_timeout_action {
                        HitmTimeoutAction::Allow => Ok(ConscienceResult {
                            approved: true,
                            justification: "Request approved after human review timeout (default: allow)".to_string(),
                            ..evaluation
                        }),
                        HitmTimeoutAction::Deny => Ok(ConscienceResult {
                            approved: false,
                            justification: "Request rejected after human review timeout (default: deny)".to_string(),
                            ..evaluation
                        }),
                        HitmTimeoutAction::UseConscienceDecision => Ok(evaluation),
                    };
                }
            }
        }
        
        // If no review service is available, return the original evaluation
        Ok(evaluation)
    }
    
    /// Record an evaluation for audit purposes
    fn record_evaluation(&self, request: &ConscienceRequest, result: &ConscienceResult) {
        // Implementation would access the audit_trail in a thread-safe way
        // For now, this is a stub as we'd need interior mutability
    }
    
    /// Record a HITM review in the audit trail
    fn record_hitm_review(&self, request: &ConscienceRequest, result: &ConscienceResult, hitm_response: &HitmResponse) {
        // Implementation would access the audit_trail in a thread-safe way
        // For now, this is a stub as we'd need interior mutability
    }
    
    /// Check for sensitive patterns in the request
    fn check_sensitive_patterns(&self, request: &ConscienceRequest) -> bool {
        // Check tool ID for sensitive operations
        let tool_id = request.tool_id.to_lowercase();
        if tool_id.contains("export") ||
           tool_id.contains("patient") ||
           tool_id.contains("medical") ||
           tool_id.contains("health") ||
           tool_id.contains("record") {
            return true;
        }
        
        // Check action string for sensitive patterns
        let action_lower = request.action.to_lowercase();
        
        // Define sensitive patterns
        let sensitive_patterns = [
            "medical",
            "health",
            "patient",
            "diagnos",
            "treatment",
            "confidential",
            "private",
            "leak",
            "password",
            "credential",
            "secret",
            "ssn", // Social Security Number
            "record",
            "phi", // Protected Health Information
            "pii", // Personally Identifiable Information
        ];
        
        // Check if any sensitive patterns are present
        sensitive_patterns.iter().any(|&pattern| action_lower.contains(pattern))
    }
    
    /// Check if request contains sensitive data
    fn contains_sensitive_data(&self, request: &ConscienceRequest) -> bool {
        // Check parameter values for potential sensitive data patterns
        let params_str = format!("{:?}", request.parameters.0);
        let params_lower = params_str.to_lowercase();
        
        // Define sensitive data patterns
        let sensitive_data_patterns = [
            "patient",
            "medical",
            "health",
            "record",
            "diagnosis",
            "m3d1cal", // Obfuscated attempt
            "h3alth",  // Obfuscated attempt
            "med1cal", // Obfuscated attempt
            "h34lth",  // Obfuscated attempt
            "p@tient", // Obfuscated attempt
            "p4t13nt", // Obfuscated attempt
            "personal",
            "confidential",
            "ssn",
            "social security",
            "soc1al",
            "s0c1al",
        ];
        
        // Check if any sensitive data patterns are present
        if sensitive_data_patterns.iter().any(|&pattern| params_lower.contains(pattern)) {
            return true;
        }
        
        // If advanced detection is enabled, use additional techniques
        if self.enable_advanced_detection {
            return self.advanced_sensitive_data_detection(&params_lower);
        }
        
        false
    }
    
    /// Advanced detection for sensitive data using more complex patterns
    fn advanced_sensitive_data_detection(&self, content: &str) -> bool {
        // Check for patterns that might be attempting to obfuscate medical terms
        let obfuscation_patterns = [
            (r"m[^\w]*e[^\w]*d[^\w]*i[^\w]*c[^\w]*a[^\w]*l", "medical"),
            (r"h[^\w]*e[^\w]*a[^\w]*l[^\w]*t[^\w]*h", "health"),
            (r"p[^\w]*a[^\w]*t[^\w]*i[^\w]*e[^\w]*n[^\w]*t", "patient"),
            (r"d[^\w]*i[^\w]*a[^\w]*g[^\w]*n[^\w]*o[^\w]*s[^\w]*i[^\w]*s", "diagnosis"),
            (r"r[^\w]*e[^\w]*c[^\w]*o[^\w]*r[^\w]*d", "record"),
        ];
        
        // Regex would be used here in a real implementation
        // For this demo, we'll use simple contains checks
        
        // Check for numeric substitutions (leetspeak)
        if content.contains("m3d") || content.contains("h31th") {
            return true;
        }
        
        // Check for patterns that look like structured medical data
        // e.g. "MRN: 12345" or "DOB: MM/DD/YYYY"
        if content.contains("mrn:") || content.contains("dob:") {
            return true;
        }
        
        false
    }
    
    /// Determine if a request is a borderline case that might require extra scrutiny
    fn is_borderline_case(&self, request: &ConscienceRequest) -> bool {
        // Check for anonymized or deidentified medical data
        // These are borderline cases that might be acceptable with proper safeguards
        let params_str = format!("{:?}", request.parameters.0).to_lowercase();
        
        if (params_str.contains("anonym") || params_str.contains("de-identif") || params_str.contains("deidentif")) &&
           (params_str.contains("medical") || params_str.contains("health") || params_str.contains("patient")) {
            return true;
        }
        
        // Check for aggregated statistics from medical data
        // These are borderline cases that might be acceptable with proper safeguards
        if (params_str.contains("aggregat") || params_str.contains("statistic") || params_str.contains("summary")) &&
           (params_str.contains("medical") || params_str.contains("health") || params_str.contains("patient")) {
            return true;
        }
        
        false
    }
    
    /// Determine the risk level for a request
    fn determine_risk_level(&self, request: &ConscienceRequest, sensitive_patterns: bool, contains_sensitive_data: bool) -> RiskLevel {
        // Critical risk: Contains clear medical data or patient information
        if contains_sensitive_data && sensitive_patterns {
            return RiskLevel::Critical;
        }
        
        // High risk: Uses sensitive operations or contains sensitive patterns
        if sensitive_patterns || request.tool_id.to_lowercase().contains("export") {
            return RiskLevel::High;
        }
        
        // Medium risk: Borderline cases that need scrutiny
        if self.is_borderline_case(request) {
            return RiskLevel::Medium;
        }
        
        // Low risk: Everything else
        RiskLevel::Low
    }
    
    /// Generate detailed reasoning for the evaluation
    fn generate_reasoning(&self, request: &ConscienceRequest, sensitive_patterns: bool, contains_sensitive_data: bool, risk_level: RiskLevel) -> String {
        let mut reasoning = format!("Risk assessment for request '{}' using tool '{}': {}\n", 
            request.action, request.tool_id, risk_level);
        
        // Add details about the detected issues
        if sensitive_patterns {
            reasoning += "- Request contains sensitive operation patterns\n";
        }
        
        if contains_sensitive_data {
            reasoning += "- Request contains patterns indicating sensitive data\n";
        }
        
        if self.is_borderline_case(request) {
            reasoning += "- Request is a borderline case that may require human review\n";
        }
        
        // Add recommendations based on risk level
        match risk_level {
            RiskLevel::Low => {
                reasoning += "Recommendation: Allow the request as it poses minimal ethical concerns.\n";
            },
            RiskLevel::Medium => {
                reasoning += "Recommendation: Proceed with caution. Consider human review if the context is unclear.\n";
            },
            RiskLevel::High => {
                reasoning += "Recommendation: Block the request due to significant ethical concerns. Human review may be required for override.\n";
            },
            RiskLevel::Critical => {
                reasoning += "Recommendation: Immediately block the request due to critical ethical violations. Report the incident for further investigation.\n";
            },
        }
        
        reasoning
    }
    
    /// Get the audit trail entries
    pub fn get_audit_trail(&self) -> Vec<AuditRecord> {
        self.audit_trail.iter().cloned().collect()
    }
    
    /// Get the violation history entries
    pub fn get_violation_history(&self) -> Vec<(ConscienceRequest, ConscienceResult)> {
        self.violation_history.iter().cloned().collect()
    }
    
    /// Clear the violation history
    pub fn clear_violation_history(&mut self) {
        self.violation_history.clear();
    }

    /// Add or update a mobile context profile
    pub fn add_mobile_profile(&mut self, name: String, profile: mobile_gate::MobileContextProfile) -> PhoenixResult<()> {
        if let Some(mobile_gate) = &mut self.mobile_gate {
            mobile_gate.add_profile(name, profile);
            Ok(())
        } else {
            Err(PhoenixError::AgentError(AgentErrorKind::ConfigurationError(
                "Mobile gate is not enabled".to_string()
            )))
        }
    }

    /// Get the mobile gate instance (for testing and advanced configuration)
    pub fn mobile_gate(&self) -> Option<&MobileConscienceGate> {
        self.mobile_gate.as_ref()
    }

    /// Enable or disable the mobile gate
    pub fn set_mobile_gate_enabled(&mut self, enabled: bool) {
        self.enable_mobile_gate = enabled;
        if enabled && self.mobile_gate.is_none() {
            self.mobile_gate = Some(MobileConscienceGate::new());
        } else if !enabled {
            self.mobile_gate = None;
        }
    }
}

// Default implementation of the HumanReviewService for testing
#[cfg(test)]
pub struct MockHumanReviewService {
    // Controls whether reviews are approved
    approve_reviews: bool,
}

#[cfg(test)]
impl MockHumanReviewService {
    pub fn new(approve_reviews: bool) -> Self {
        Self { approve_reviews }
    }
}

#[cfg(test)]
#[async_trait]
impl HumanReviewService for MockHumanReviewService {
    async fn submit_for_review(&self, request: &ConscienceRequest, _evaluation: &ConscienceResult) -> PhoenixResult<HitmResponse> {
        Ok(HitmResponse {
            request_id: request.id.clone(),
            status: if self.approve_reviews { HitmStatus::Approved } else { HitmStatus::Rejected },
            comments: Some("Automated test review".to_string()),
            timestamp: SystemTime::now(),
            reviewer_id: Some("test-reviewer".to_string()),
        })
    }
    
    async fn is_reviewer_available(&self) -> PhoenixResult<bool> {
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_sensitive_data_detection() {
        // Create a mock review service
        let review_service = Arc::new(MockHumanReviewService::new(true));
        
        // Create gate with default config
        let config = ConscienceConfig::default();
        let conscience_gate = ConscienceGate::new(
            config, 
            Some(review_service)
        ).await.unwrap();
        
        // Test with medical data
        let medical_request = ConscienceRequest {
            id: RequestId::new(),
            action: "Export patient records".to_string(),
            tool_id: "export_data".to_string(),
            parameters: ToolParameters::from(r#"{"patient_id": "12345", "type": "medical_history"}"#.to_string()),
            context: HashMap::new(),
            timestamp: SystemTime::now(),
            origin: RequestOrigin::User,
        };
        
        let result = conscience_gate.evaluate(medical_request).await.unwrap();
        
        // Should detect and reject
        assert!(!result.approved);
        assert!(result.confidence < 0.5);
        assert!(!result.violations.is_empty());
        
        // Test with obfuscated medical data
        let obfuscated_request = ConscienceRequest {
            id: RequestId::new(),
            action: "Export user data".to_string(),
            tool_id: "export_data".to_string(),
            parameters: ToolParameters::from(r#"{"id": "12345", "type": "p4t13nt h3alth"}"#.to_string()),
            context: HashMap::new(),
            timestamp: SystemTime::now(),
            origin: RequestOrigin::User,
        };
        
        let result = conscience_gate.evaluate(obfuscated_request).await.unwrap();
        
        // Should still detect and reject
        assert!(!result.approved);
        assert!(!result.violations.is_empty());
    }
    
    #[tokio::test]
    async fn test_borderline_case_hitm() {
        // Create a mock review service
        let review_service = Arc::new(MockHumanReviewService::new(true));
        
        // Create gate with HITM enabled
        let config = ConscienceConfig {
            hitm_config: HitmConfig {
                confidence_threshold: 0.9,
                enabled: true,
                timeout_seconds: 300,
                default_timeout_action: HitmTimeoutAction::Deny
            },
            ..Default::default()
        };
        
        let conscience_gate = ConscienceGate::new(
            config, 
            Some(review_service.clone())
        ).await.unwrap();
        
        // Test with borderline case
        let borderline_request = ConscienceRequest {
            id: RequestId::new(),
            action: "Export anonymized statistics".to_string(),
            tool_id: "export_data".to_string(),
            parameters: ToolParameters::from(r#"{"source": "patient_records", "type": "anonymized_statistics"}"#.to_string()),
            context: HashMap::new(),
            timestamp: SystemTime::now(),
            origin: RequestOrigin::User,
        };
        
        let result = conscience_gate.evaluate(borderline_request).await.unwrap();
        
        // Should be approved after HITM review (since mock service approves)
        assert!(result.approved);
        assert!(result.justification.contains("human review"));
    }
}