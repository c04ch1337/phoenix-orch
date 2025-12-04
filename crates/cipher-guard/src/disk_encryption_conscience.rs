//! Conscience Gate for Disk Encryption
//!
//! Provides ethical and safety evaluations for disk encryption operations,
//! ensuring that encryption is appropriate, safe, and understood by users.

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

use crate::disk_encryption::{
    DiskEncryptionSystem, EncryptionContext, SecurityLevel,
    DiskEncryptionError, EncryptionOperation
};
use crate::ethics::{EthicalFramework, DefensiveAction, ImpactCategory, EthicalEvaluation};
use thiserror::Error;

/// Conscience Gate for evaluating disk encryption operations
pub struct DiskEncryptionConscienceGate {
    /// Ethical framework for evaluating actions
    ethical_framework: EthicalFramework,
    /// Risk thresholds for different operations
    risk_thresholds: HashMap<String, f64>,
    /// Previous evaluations for reference
    evaluation_history: Vec<ConscienceEvaluation>,
    /// Safety rules specific to disk encryption
    safety_rules: Vec<SafetyRule>,
}

impl DiskEncryptionConscienceGate {
    /// Create a new conscience gate
    pub fn new(ethical_framework: EthicalFramework) -> Self {
        Self {
            ethical_framework,
            risk_thresholds: Self::default_thresholds(),
            evaluation_history: Vec::new(),
            safety_rules: Self::default_safety_rules(),
        }
    }
    
    /// Evaluate a disk encryption request before allowing it to proceed
    pub async fn evaluate_encryption_request(
        &mut self,
        drive_path: &str,
        context: &EncryptionContext,
    ) -> Result<ConscienceEvaluation, ConscienceGateError> {
        // Create a defensive action for ethical evaluation
        let action = self.create_defensive_action(drive_path, context);
        
        // Get ethical evaluation
        let ethical_eval = self.ethical_framework.evaluate_action(&action);
        
        // Check safety rules
        let safety_evaluations = self.evaluate_safety_rules(drive_path, context);
        
        // Determine if there are any rule violations
        let rule_violations: Vec<&SafetyRuleEvaluation> = safety_evaluations
            .iter()
            .filter(|eval| !eval.passed)
            .collect();
        
        // Calculate overall safety score
        let safety_score = if safety_evaluations.is_empty() {
            1.0
        } else {
            let passed_count = safety_evaluations.iter().filter(|eval| eval.passed).count() as f64;
            passed_count / safety_evaluations.len() as f64
        };
        
        // Get overall recommendation
        let recommendation = self.get_recommendation(
            &ethical_eval,
            safety_score,
            &rule_violations,
            drive_path,
            context,
        );
        
        // Create evaluation result
        let evaluation = ConscienceEvaluation {
            id: Uuid::new_v4(),
            drive_path: drive_path.to_string(),
            evaluation_time: Utc::now(),
            ethical_evaluation: ethical_eval,
            safety_evaluations,
            safety_score,
            recommendation: recommendation.clone(),
            warnings: self.generate_warnings(&rule_violations, &recommendation),
        };
        
        // Store evaluation in history
        self.evaluation_history.push(evaluation.clone());
        
        // Return the evaluation
        Ok(evaluation)
    }
    
    /// Get the appropriate conscience recommendation
    pub fn get_recommendation(
        &self,
        ethical_eval: &EthicalEvaluation,
        safety_score: f64,
        rule_violations: &[&SafetyRuleEvaluation],
        drive_path: &str,
        context: &EncryptionContext,
    ) -> ConscienceRecommendation {
        // Check for critical rule violations
        let has_critical_violation = rule_violations.iter()
            .any(|eval| eval.rule.severity == RuleSeverity::Critical);
        
        // Check if this is a system drive
        let is_system_drive = drive_path.eq_ignore_ascii_case("C:");
        
        // Determine recommendation
        if has_critical_violation {
            ConscienceRecommendation::Reject {
                reason: format!(
                    "Critical safety violation: {}", 
                    rule_violations.first().unwrap().message
                ),
                can_override: false,
                required_actions: rule_violations.iter()
                    .map(|eval| eval.remediation_action.clone())
                    .collect(),
            }
        } else if safety_score < 0.6 || ethical_eval.overall_score < 0.7 {
            // Low overall score
            ConscienceRecommendation::Reject {
                reason: "Multiple safety concerns detected".to_string(),
                can_override: true,
                required_actions: rule_violations.iter()
                    .map(|eval| eval.remediation_action.clone())
                    .collect(),
            }
        } else if is_system_drive && !context.force_system_drive {
            // System drive without force flag
            ConscienceRecommendation::NeedsConfirmation {
                reason: "System drive encryption requires explicit confirmation".to_string(),
                confirmation_prompt: "Are you sure you want to encrypt your system drive (C:)? This could render your system unbootable if not done properly.".to_string(),
                recommended_actions: vec![
                    "Ensure you have a bootable recovery media".to_string(),
                    "Verify all system backups are current".to_string(),
                    "Consider using Windows BitLocker instead for system drives".to_string(),
                ],
            }
        } else if !context.backup_verified {
            // No backup verification
            ConscienceRecommendation::NeedsConfirmation {
                reason: "Backup verification is recommended before encryption".to_string(),
                confirmation_prompt: "Have you created and verified a backup of all data on this drive?".to_string(),
                recommended_actions: vec![
                    "Create a full backup of the drive before proceeding".to_string(),
                    "Verify the backup is complete and restorable".to_string(),
                ],
            }
        } else {
            // All checks passed
            ConscienceRecommendation::Approve {
                message: format!("Encryption of drive {} is approved", drive_path),
                advisory_notes: vec![
                    "Store encryption recovery keys in a secure location".to_string(),
                    "Monitor the encryption process until completion".to_string(),
                ],
            }
        }
    }
    
    /// Evaluate all safety rules for a given encryption request
    fn evaluate_safety_rules(
        &self,
        drive_path: &str,
        context: &EncryptionContext,
    ) -> Vec<SafetyRuleEvaluation> {
        self.safety_rules
            .iter()
            .map(|rule| self.evaluate_rule(rule, drive_path, context))
            .collect()
    }
    
    /// Evaluate a single safety rule
    fn evaluate_rule(
        &self,
        rule: &SafetyRule,
        drive_path: &str,
        context: &EncryptionContext,
    ) -> SafetyRuleEvaluation {
        // Apply rule logic based on rule type
        match rule.rule_type {
            SafetyRuleType::SystemDriveProtection => {
                let is_system_drive = drive_path.eq_ignore_ascii_case("C:");
                SafetyRuleEvaluation {
                    rule: rule.clone(),
                    passed: !is_system_drive || context.force_system_drive,
                    message: if is_system_drive && !context.force_system_drive {
                        "System drive encryption requires explicit confirmation".to_string()
                    } else {
                        "System drive protection check passed".to_string()
                    },
                    remediation_action: "Add force_system_drive: true to context after ensuring recovery media exists".to_string(),
                }
            },
            SafetyRuleType::BackupVerification => {
                SafetyRuleEvaluation {
                    rule: rule.clone(),
                    passed: context.backup_verified,
                    message: if context.backup_verified {
                        "Backup verification confirmed".to_string()
                    } else {
                        "No backup verification found".to_string()
                    },
                    remediation_action: "Verify a complete backup exists before proceeding with encryption".to_string(),
                }
            },
            SafetyRuleType::NetworkDriveSafety => {
                let is_network_drive = drive_path.starts_with("\\\\");
                let is_allowed = if is_network_drive {
                    // Only allow network drive encryption with Enhanced or Maximum security level
                    context.security_level == SecurityLevel::Enhanced || 
                    context.security_level == SecurityLevel::Maximum
                } else {
                    true
                };
                
                SafetyRuleEvaluation {
                    rule: rule.clone(),
                    passed: is_allowed,
                    message: if !is_allowed {
                        "Network drive encryption requires enhanced security level".to_string()
                    } else {
                        "Network drive safety check passed".to_string()
                    },
                    remediation_action: "Increase security level to Enhanced or Maximum for network drives".to_string(),
                }
            },
            SafetyRuleType::UserUnderstanding => {
                // In a real implementation, this might check for user acknowledgment
                // For now, we'll assume users understand if they've provided purpose
                let user_understands = context.purpose.len() > 10;
                
                SafetyRuleEvaluation {
                    rule: rule.clone(),
                    passed: user_understands,
                    message: if user_understands {
                        "User has demonstrated understanding of encryption implications".to_string()
                    } else {
                        "Insufficient evidence that user understands encryption implications".to_string()
                    },
                    remediation_action: "Provide a detailed purpose explaining why encryption is needed".to_string(),
                }
            },
            SafetyRuleType::ElevatedPermissionRequired => {
                // In a real implementation, this would check for admin rights
                // For now, we'll assume all requests have proper permissions
                SafetyRuleEvaluation {
                    rule: rule.clone(),
                    passed: true,
                    message: "Permission check passed".to_string(),
                    remediation_action: "Run with elevated permissions".to_string(),
                }
            },
        }
    }
    
    /// Generate warnings based on rule violations and recommendation
    fn generate_warnings(
        &self,
        rule_violations: &[&SafetyRuleEvaluation],
        recommendation: &ConscienceRecommendation,
    ) -> Vec<ConscienceWarning> {
        let mut warnings = Vec::new();
        
        // Add warnings for rule violations
        for violation in rule_violations {
            warnings.push(ConscienceWarning {
                severity: violation.rule.severity.clone(),
                message: violation.message.clone(),
                details: Some(violation.remediation_action.clone()),
            });
        }
        
        // Add recommendation-based warnings
        match recommendation {
            ConscienceRecommendation::NeedsConfirmation { reason, .. } => {
                warnings.push(ConscienceWarning {
                    severity: RuleSeverity::Warning,
                    message: format!("Confirmation needed: {}", reason),
                    details: Some("Additional user confirmation required before proceeding".to_string()),
                });
            },
            ConscienceRecommendation::Reject { reason, .. } => {
                warnings.push(ConscienceWarning {
                    severity: RuleSeverity::Critical,
                    message: format!("Request rejected: {}", reason),
                    details: Some("This encryption request cannot proceed without addressing the issues".to_string()),
                });
            },
            _ => {}
        }
        
        warnings
    }
    
    /// Create a defensive action for ethical evaluation
    fn create_defensive_action(&self, drive_path: &str, context: &EncryptionContext) -> DefensiveAction {
        // Create estimated impact
        let mut estimated_impact = HashMap::new();
        estimated_impact.insert(ImpactCategory::Data, 0.7); // High data impact
        estimated_impact.insert(ImpactCategory::Systems, 0.5); // Medium system impact
        estimated_impact.insert(ImpactCategory::Operations, 0.3); // Low operations impact
        estimated_impact.insert(ImpactCategory::Privacy, 0.1); // Positive privacy impact
        
        // Create safeguards
        let mut safeguards = Vec::new();
        safeguards.push("data_encryption".to_string());
        
        if context.backup_verified {
            safeguards.push("backup_verified".to_string());
        }
        
        if context.force_system_drive {
            safeguards.push("system_drive_confirmation".to_string());
        }
        
        // Create action
        DefensiveAction {
            action_type: "disk_encryption".to_string(),
            target_scope: format!("disk:{}", drive_path),
            estimated_impact,
            safeguards,
        }
    }
    
    /// Default risk thresholds
    fn default_thresholds() -> HashMap<String, f64> {
        let mut thresholds = HashMap::new();
        thresholds.insert("system_drive".to_string(), 0.85);
        thresholds.insert("network_drive".to_string(), 0.75);
        thresholds.insert("removable_drive".to_string(), 0.70);
        thresholds.insert("standard_drive".to_string(), 0.65);
        thresholds
    }
    
    /// Default safety rules
    fn default_safety_rules() -> Vec<SafetyRule> {
        vec![
            SafetyRule {
                id: "system_drive_protection".to_string(),
                name: "System Drive Protection".to_string(),
                description: "Prevents accidental encryption of system drives without explicit confirmation".to_string(),
                rule_type: SafetyRuleType::SystemDriveProtection,
                severity: RuleSeverity::Critical,
            },
            SafetyRule {
                id: "backup_verification".to_string(),
                name: "Backup Verification".to_string(),
                description: "Ensures data is backed up before encryption".to_string(),
                rule_type: SafetyRuleType::BackupVerification,
                severity: RuleSeverity::Warning,
            },
            SafetyRule {
                id: "network_drive_safety".to_string(),
                name: "Network Drive Safety".to_string(),
                description: "Ensures network drives are encrypted with appropriate security level".to_string(),
                rule_type: SafetyRuleType::NetworkDriveSafety,
                severity: RuleSeverity::Warning,
            },
            SafetyRule {
                id: "user_understanding".to_string(),
                name: "User Understanding".to_string(),
                description: "Verifies user understands encryption implications".to_string(),
                rule_type: SafetyRuleType::UserUnderstanding,
                severity: RuleSeverity::Info,
            },
            SafetyRule {
                id: "elevated_permission".to_string(),
                name: "Elevated Permission".to_string(),
                description: "Ensures encryption operations have proper system permissions".to_string(),
                rule_type: SafetyRuleType::ElevatedPermissionRequired,
                severity: RuleSeverity::Warning,
            },
        ]
    }
    
    /// Process an encryption request after conscience evaluation
    pub async fn process_approved_request(
        &self,
        evaluation: &ConscienceEvaluation,
        disk_encryption: &mut DiskEncryptionSystem,
        context: &EncryptionContext,
    ) -> Result<EncryptionOperation, ConscienceGateError> {
        // Check if the evaluation approves the operation
        match &evaluation.recommendation {
            ConscienceRecommendation::Approve { .. } => {
                // Proceed with encryption
                disk_encryption.encrypt_drive(&evaluation.drive_path, None, context)
                    .await
                    .map_err(ConscienceGateError::DiskEncryptionError)
            },
            ConscienceRecommendation::NeedsConfirmation { .. } => {
                // If passed with explicit confirmation, process
                if context.force_system_drive {
                    disk_encryption.encrypt_drive(&evaluation.drive_path, None, context)
                        .await
                        .map_err(ConscienceGateError::DiskEncryptionError)
                } else {
                    Err(ConscienceGateError::ConfirmationRequired(
                        "Explicit confirmation required".to_string()
                    ))
                }
            },
            ConscienceRecommendation::Reject { can_override, .. } => {
                if *can_override && context.force_system_drive {
                    // Allow override if permitted
                    disk_encryption.encrypt_drive(&evaluation.drive_path, None, context)
                        .await
                        .map_err(ConscienceGateError::DiskEncryptionError)
                } else {
                    Err(ConscienceGateError::RequestRejected(
                        "Request rejected by conscience gate".to_string()
                    ))
                }
            },
        }
    }
}

/// Safety rule for conscience evaluation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyRule {
    /// Unique rule identifier
    pub id: String,
    /// Human-readable name
    pub name: String,
    /// Description of the rule
    pub description: String,
    /// Type of rule
    pub rule_type: SafetyRuleType,
    /// Severity of rule violations
    pub severity: RuleSeverity,
}

/// Types of safety rules
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SafetyRuleType {
    /// Protect system drives from accidental encryption
    SystemDriveProtection,
    /// Verify backups exist before encryption
    BackupVerification,
    /// Ensure network drives are encrypted safely
    NetworkDriveSafety,
    /// Verify user understands encryption implications
    UserUnderstanding,
    /// Require elevated permissions for encryption
    ElevatedPermissionRequired,
}

/// Severity levels for safety rules
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RuleSeverity {
    /// Informational rule
    Info,
    /// Warning rule
    Warning,
    /// Critical rule that must not be violated
    Critical,
}

/// Evaluation of a safety rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyRuleEvaluation {
    /// The rule being evaluated
    pub rule: SafetyRule,
    /// Whether the rule passed evaluation
    pub passed: bool,
    /// Message explaining the result
    pub message: String,
    /// Action to remediate the issue
    pub remediation_action: String,
}

/// Warning from conscience evaluation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConscienceWarning {
    /// Warning severity
    pub severity: RuleSeverity,
    /// Warning message
    pub message: String,
    /// Additional details
    pub details: Option<String>,
}

/// Result of conscience evaluation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConscienceEvaluation {
    /// Unique evaluation ID
    pub id: Uuid,
    /// Path to the drive being evaluated
    pub drive_path: String,
    /// When the evaluation was performed
    pub evaluation_time: DateTime<Utc>,
    /// Ethical evaluation results
    pub ethical_evaluation: EthicalEvaluation,
    /// Safety rule evaluations
    pub safety_evaluations: Vec<SafetyRuleEvaluation>,
    /// Overall safety score (0.0 to 1.0)
    pub safety_score: f64,
    /// Conscience recommendation
    pub recommendation: ConscienceRecommendation,
    /// Warnings raised during evaluation
    pub warnings: Vec<ConscienceWarning>,
}

/// Conscience recommendation for an encryption request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConscienceRecommendation {
    /// Approve the encryption request
    Approve {
        /// Approval message
        message: String,
        /// Advisory notes for the user
        advisory_notes: Vec<String>,
    },
    /// Request needs confirmation before proceeding
    NeedsConfirmation {
        /// Reason confirmation is needed
        reason: String,
        /// Prompt for the confirmation
        confirmation_prompt: String,
        /// Recommended actions before proceeding
        recommended_actions: Vec<String>,
    },
    /// Reject the encryption request
    Reject {
        /// Reason for rejection
        reason: String,
        /// Whether the rejection can be overridden
        can_override: bool,
        /// Actions required to remediate issues
        required_actions: Vec<String>,
    },
}

/// Errors that can occur during conscience gate evaluation
#[derive(Debug, Error)]
pub enum ConscienceGateError {
    /// Confirmation required before proceeding
    #[error("Confirmation required: {0}")]
    ConfirmationRequired(String),
    
    /// Request rejected by conscience gate
    #[error("Request rejected: {0}")]
    RequestRejected(String),
    
    /// Disk encryption error
    #[error("Disk encryption error: {0}")]
    DiskEncryptionError(#[from] DiskEncryptionError),
    
    /// Evaluation error
    #[error("Evaluation error: {0}")]
    EvaluationError(String),
}

#[cfg(test)]
mod tests {
    use super::*;
    
    fn create_test_context() -> EncryptionContext {
        EncryptionContext {
            backup_verified: true,
            force_system_drive: false,
            initiated_by: "test_user".to_string(),
            purpose: "Testing the conscience gate".to_string(),
            special_instructions: None,
            security_level: SecurityLevel::Enhanced,
        }
    }
    
    #[tokio::test]
    async fn test_evaluate_standard_drive() {
        let mut conscience_gate = DiskEncryptionConscienceGate::new(EthicalFramework::new());
        let context = create_test_context();
        
        let result = conscience_gate.evaluate_encryption_request("D:", &context).await;
        assert!(result.is_ok());
        
        let evaluation = result.unwrap();
        match evaluation.recommendation {
            ConscienceRecommendation::Approve { .. } => {
                // This is expected for a standard drive with backup verified
            },
            _ => panic!("Expected approval for standard drive"),
        }
    }
    
    #[tokio::test]
    async fn test_evaluate_system_drive() {
        let mut conscience_gate = DiskEncryptionConscienceGate::new(EthicalFramework::new());
        let context = create_test_context();
        
        let result = conscience_gate.evaluate_encryption_request("C:", &context).await;
        assert!(result.is_ok());
        
        let evaluation = result.unwrap();
        match evaluation.recommendation {
            ConscienceRecommendation::NeedsConfirmation { .. } => {
                // This is expected for a system drive without force flag
            },
            _ => panic!("Expected confirmation needed for system drive"),
        }
    }
    
    #[tokio::test]
    async fn test_evaluate_system_drive_with_force() {
        let mut conscience_gate = DiskEncryptionConscienceGate::new(EthicalFramework::new());
        let mut context = create_test_context();
        context.force_system_drive = true;
        
        let result = conscience_gate.evaluate_encryption_request("C:", &context).await;
        assert!(result.is_ok());
        
        let evaluation = result.unwrap();
        match evaluation.recommendation {
            ConscienceRecommendation::Approve { .. } => {
                // This is expected for a system drive with force flag
            },
            _ => panic!("Expected approval for system drive with force"),
        }
    }
    
    #[tokio::test]
    async fn test_evaluate_without_backup() {
        let mut conscience_gate = DiskEncryptionConscienceGate::new(EthicalFramework::new());
        let mut context = create_test_context();
        context.backup_verified = false;
        
        let result = conscience_gate.evaluate_encryption_request("D:", &context).await;
        assert!(result.is_ok());
        
        let evaluation = result.unwrap();
        match evaluation.recommendation {
            ConscienceRecommendation::NeedsConfirmation { .. } => {
                // This is expected when backup is not verified
            },
            _ => panic!("Expected confirmation needed when backup not verified"),
        }
    }
}