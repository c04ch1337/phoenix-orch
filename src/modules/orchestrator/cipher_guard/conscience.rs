//! Conscience Protection System
//!
//! This module provides protection mechanisms for family members, children, and innocent
//! individuals. It implements ethical guardrails, threat detection, and automatic
//! protection measures to prevent harm to vulnerable individuals.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, RwLock};
use std::time::Duration;

use anyhow::{Result, Context, anyhow};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// Protection targets that the conscience system will safeguard
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ProtectionTarget {
    /// Children (under 18)
    Children,
    /// Family members
    Family,
    /// Innocent bystanders
    Innocents,
    /// Medical facilities
    MedicalFacilities,
    /// Educational institutions
    EducationalInstitutions,
    /// Religious institutions
    ReligiousInstitutions,
    /// Humanitarian organizations
    HumanitarianOrganizations,
    /// Custom protection target
    Custom(String),
}

/// Defines the severity of a detected threat
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, PartialOrd, Ord)]
pub enum ThreatSeverity {
    /// Low severity - minimal potential harm
    Low,
    /// Medium severity - moderate potential harm
    Medium,
    /// High severity - significant potential harm
    High,
    /// Critical severity - extreme potential harm
    Critical,
}

/// Types of threats that can be detected
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ThreatType {
    /// Content that is not age-appropriate
    InappropriateContent,
    /// Malicious software that could harm systems
    Malware,
    /// Phishing attempts
    Phishing,
    /// Identity theft attempts
    IdentityTheft,
    /// Online harassment
    Harassment,
    /// Cyberbullying
    Cyberbullying,
    /// Financial scams
    FinancialScam,
    /// Exploitation attempts
    Exploitation,
    /// Social engineering
    SocialEngineering,
    /// Data exfiltration
    DataExfiltration,
    /// Custom threat type
    Custom(String),
}

/// Protective actions that can be taken
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ProtectiveAction {
    /// Block the threatening content or connection
    Block,
    /// Alert the user about the potential threat
    Alert,
    /// Log the threat for later review
    Log,
    /// Redirect to a safe alternative
    Redirect,
    /// Filter or sanitize the content
    Filter,
    /// Isolate the system component
    Isolate,
    /// Automatically respond to mitigate the threat
    AutoRespond,
    /// Custom protective action
    Custom(String),
}

/// Configuration for the conscience protection system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConscienceConfig {
    /// Whether the protection system is enabled
    pub enabled: bool,
    /// Protection level (0-100)
    pub protection_level: u8,
    /// Targets to protect
    pub protection_targets: Vec<ProtectionTarget>,
    /// Threshold for automatic action (severity level)
    pub action_threshold: ThreatSeverity,
    /// Whether to alert on threats
    pub alert_on_threat: bool,
    /// Whether to log all protection events
    pub log_all_events: bool,
    /// Custom protection rules
    pub custom_rules: Vec<ProtectionRule>,
    /// Safe content categories
    pub safe_categories: Vec<String>,
    /// Blocked content categories
    pub blocked_categories: Vec<String>,
    /// Notification recipients for alerts
    pub notification_recipients: Vec<String>,
    /// Whether to enable learning mode
    pub learning_mode: bool,
    /// Path to custom protection definitions
    pub custom_definitions_path: Option<PathBuf>,
}

impl Default for ConscienceConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            protection_level: 70,
            protection_targets: vec![
                ProtectionTarget::Children,
                ProtectionTarget::Family,
                ProtectionTarget::Innocents,
            ],
            action_threshold: ThreatSeverity::Medium,
            alert_on_threat: true,
            log_all_events: true,
            custom_rules: Vec::new(),
            safe_categories: vec![
                "education".to_string(),
                "news".to_string(),
                "science".to_string(),
            ],
            blocked_categories: vec![
                "violence".to_string(),
                "adult".to_string(),
                "weapons".to_string(),
                "extremism".to_string(),
                "gambling".to_string(),
            ],
            notification_recipients: Vec::new(),
            learning_mode: false,
            custom_definitions_path: None,
        }
    }
}

/// A custom protection rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtectionRule {
    /// Rule ID
    pub id: String,
    /// Rule name
    pub name: String,
    /// Rule description
    pub description: String,
    /// Targets this rule protects
    pub targets: Vec<ProtectionTarget>,
    /// Threat type this rule detects
    pub threat_type: ThreatType,
    /// Threat severity
    pub severity: ThreatSeverity,
    /// Detection patterns
    pub patterns: Vec<String>,
    /// Actions to take when rule matches
    pub actions: Vec<ProtectiveAction>,
    /// Whether the rule is enabled
    pub enabled: bool,
    /// Rule priority (higher numbers take precedence)
    pub priority: u8,
}

impl ProtectionRule {
    /// Create a new protection rule
    pub fn new(
        name: String,
        description: String,
        targets: Vec<ProtectionTarget>,
        threat_type: ThreatType,
        severity: ThreatSeverity,
        patterns: Vec<String>,
        actions: Vec<ProtectiveAction>,
    ) -> Self {
        Self {
            id: format!("rule_{}", Uuid::new_v4()),
            name,
            description,
            targets,
            threat_type,
            severity,
            patterns,
            actions,
            enabled: true,
            priority: 50,
        }
    }

    /// Check if this rule applies to a given target
    pub fn applies_to(&self, target: &ProtectionTarget) -> bool {
        self.targets.contains(target)
    }
}

/// A detected threat
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedThreat {
    /// Threat ID
    pub id: String,
    /// Threat type
    pub threat_type: ThreatType,
    /// Severity level
    pub severity: ThreatSeverity,
    /// Time the threat was detected
    pub detected_at: DateTime<Utc>,
    /// Source of the threat
    pub source: String,
    /// Target potentially affected
    pub target: ProtectionTarget,
    /// Description of the threat
    pub description: String,
    /// Matching rule (if any)
    pub matching_rule: Option<String>,
    /// Raw data associated with the threat
    pub raw_data: serde_json::Value,
    /// Actions taken
    pub actions_taken: Vec<ProtectiveAction>,
    /// Current status
    pub status: String,
    /// Confidence score (0-100)
    pub confidence: u8,
}

impl DetectedThreat {
    /// Create a new detected threat
    pub fn new(
        threat_type: ThreatType,
        severity: ThreatSeverity,
        source: String,
        target: ProtectionTarget,
        description: String,
        raw_data: serde_json::Value,
    ) -> Self {
        Self {
            id: format!("threat_{}", Uuid::new_v4()),
            threat_type,
            severity,
            detected_at: Utc::now(),
            source,
            target,
            description,
            matching_rule: None,
            raw_data,
            actions_taken: Vec::new(),
            status: "detected".to_string(),
            confidence: 80,
        }
    }
    
    /// Add an action taken to mitigate this threat
    pub fn add_action(&mut self, action: ProtectiveAction) {
        self.actions_taken.push(action);
        self.status = "mitigated".to_string();
    }
}

/// Result of a protection operation
#[derive(Debug, Clone)]
pub struct ProtectionResult {
    /// Whether the protection was successful
    pub success: bool,
    /// Actions taken
    pub actions_taken: Vec<ProtectiveAction>,
    /// Detected threat (if any)
    pub threat: Option<DetectedThreat>,
    /// Error message (if any)
    pub error_message: Option<String>,
    /// Duration of the protection operation
    pub duration: Duration,
    /// Recommendations for further action
    pub recommendations: Vec<String>,
}

/// Protection event for logging
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtectionEvent {
    /// Event ID
    pub id: String,
    /// Event timestamp
    pub timestamp: DateTime<Utc>,
    /// Event type
    pub event_type: String,
    /// Target
    pub target: ProtectionTarget,
    /// Threat information (if any)
    pub threat: Option<DetectedThreat>,
    /// Actions taken
    pub actions: Vec<ProtectiveAction>,
    /// User notified (if applicable)
    pub user_notified: bool,
    /// Additional data
    pub data: HashMap<String, String>,
}

/// The main conscience protection system
pub struct ConscienceProtection {
    /// Configuration
    config: ConscienceConfig,
    /// Protection rules
    rules: Vec<ProtectionRule>,
    /// Detection history
    detection_history: Vec<DetectedThreat>,
    /// Protection event log
    event_log: Vec<ProtectionEvent>,
    /// Content classifier
    #[allow(dead_code)]
    content_classifier: Option<Box<dyn ContentClassifier>>,
}

/// Trait for content classification
pub trait ContentClassifier: Send + Sync {
    /// Classify content and return categories with confidence scores
    fn classify_content(&self, content: &str) -> HashMap<String, f32>;
    
    /// Check if content is safe for a given target
    fn is_safe_for(&self, content: &str, target: &ProtectionTarget) -> bool;
}

impl ConscienceProtection {
    /// Create a new conscience protection system with default configuration
    pub fn new() -> Result<Self> {
        let config = ConscienceConfig::default();
        let default_rules = Self::create_default_rules();
        
        Ok(Self {
            config,
            rules: default_rules,
            detection_history: Vec::new(),
            event_log: Vec::new(),
            content_classifier: None,
        })
    }
    
    /// Initialize with custom configuration
    pub fn with_config(config: ConscienceConfig) -> Result<Self> {
        let default_rules = Self::create_default_rules();
        
        // Load custom rules if config specifies a path
        let rules = if let Some(path) = &config.custom_definitions_path {
            if path.exists() {
                // In a real implementation, we would load rules from the file
                // For now, we'll just use the default rules
                default_rules
            } else {
                default_rules
            }
        } else {
            default_rules
        };
        
        Ok(Self {
            config,
            rules,
            detection_history: Vec::new(),
            event_log: Vec::new(),
            content_classifier: None,
        })
    }
    
    /// Create default protection rules
    fn create_default_rules() -> Vec<ProtectionRule> {
        vec![
            ProtectionRule::new(
                "Child Protection - Explicit Content".to_string(),
                "Protects children from explicit content".to_string(),
                vec![ProtectionTarget::Children],
                ThreatType::InappropriateContent,
                ThreatSeverity::High,
                vec![
                    "explicit".to_string(),
                    "adult".to_string(),
                    "nsfw".to_string(),
                ],
                vec![ProtectiveAction::Block, ProtectiveAction::Alert],
            ),
            ProtectionRule::new(
                "Family Protection - Phishing".to_string(),
                "Protects family members from phishing attempts".to_string(),
                vec![ProtectionTarget::Family],
                ThreatType::Phishing,
                ThreatSeverity::High,
                vec![
                    "verify your account".to_string(),
                    "urgent action required".to_string(),
                    "unusual activity".to_string(),
                ],
                vec![ProtectiveAction::Block, ProtectiveAction::Alert],
            ),
            ProtectionRule::new(
                "Innocent Protection - Malware".to_string(),
                "Protects innocent users from malware".to_string(),
                vec![ProtectionTarget::Innocents],
                ThreatType::Malware,
                ThreatSeverity::High,
                vec![
                    "malicious file detected".to_string(),
                    "suspicious activity".to_string(),
                    "system compromise".to_string(),
                ],
                vec![
                    ProtectiveAction::Block,
                    ProtectiveAction::Alert,
                    ProtectiveAction::Isolate,
                ],
            ),
        ]
    }
    
    /// Check content against protection rules
    pub async fn check_content(
        &mut self,
        content: &str,
        target: ProtectionTarget,
        context: HashMap<String, String>,
    ) -> Result<ProtectionResult> {
        if !self.config.enabled {
            return Ok(ProtectionResult {
                success: true,
                actions_taken: Vec::new(),
                threat: None,
                error_message: None,
                duration: Duration::from_millis(0),
                recommendations: Vec::new(),
            });
        }
        
        // Start timer for duration measurement
        let start = std::time::Instant::now();
        
        // Check all applicable rules
        let mut matched_rules = Vec::new();
        
        for rule in self.rules.iter().filter(|r| r.enabled && r.applies_to(&target)) {
            // Check if content matches any of the rule's patterns
            let matches = rule.patterns.iter().any(|pattern| content.contains(pattern));
            
            if matches {
                matched_rules.push(rule);
            }
        }
        
        // Sort rules by severity and priority
        matched_rules.sort_by(|a, b| {
            let severity_cmp = b.severity.cmp(&a.severity);
            if severity_cmp == std::cmp::Ordering::Equal {
                b.priority.cmp(&a.priority)
            } else {
                severity_cmp
            }
        });
        
        // If no rules matched, content is considered safe
        if matched_rules.is_empty() {
            let duration = start.elapsed();
            
            return Ok(ProtectionResult {
                success: true,
                actions_taken: vec![ProtectiveAction::Log],
                threat: None,
                error_message: None,
                duration,
                recommendations: Vec::new(),
            });
        }
        
        // Use the highest severity matched rule
        let top_rule = matched_rules[0];
        
        // Create a detected threat
        let mut threat = DetectedThreat::new(
            top_rule.threat_type.clone(),
            top_rule.severity,
            "content_check".to_string(),
            target.clone(),
            format!("Matched rule: {}", top_rule.name),
            serde_json::json!({
                "content_sample": if content.len() > 100 { 
                    format!("{}...", &content[0..100]) 
                } else { 
                    content.to_string() 
                },
                "context": context,
            }),
        );
        
        threat.matching_rule = Some(top_rule.id.clone());
        
        // Determine actions based on rule severity and config threshold
        let mut actions_taken = Vec::new();
        
        if top_rule.severity >= self.config.action_threshold {
            // Take the actions specified in the rule
            for action in &top_rule.actions {
                actions_taken.push(action.clone());
                threat.add_action(action.clone());
            }
        } else {
            // Just log the threat
            actions_taken.push(ProtectiveAction::Log);
            threat.add_action(ProtectiveAction::Log);
        }
        
        // Record the threat in history
        self.detection_history.push(threat.clone());
        
        // Log protection event
        self.log_protection_event(
            "content_check".to_string(),
            target.clone(),
            Some(threat.clone()),
            actions_taken.clone(),
        );
        
        let duration = start.elapsed();
        
        // Generate recommendations based on the threat
        let recommendations = self.generate_recommendations(&threat);
        
        Ok(ProtectionResult {
            success: true,
            actions_taken,
            threat: Some(threat),
            error_message: None,
            duration,
            recommendations,
        })
    }
    
    /// Check a URL against protection rules
    pub async fn check_url(
        &mut self,
        url: &str,
        target: ProtectionTarget,
        context: HashMap<String, String>,
    ) -> Result<ProtectionResult> {
        // In a real implementation, this would fetch and analyze the URL content
        // For this simulation, we'll just check the URL string itself
        self.check_content(url, target, context).await
    }
    
    /// Check a file against protection rules
    pub async fn check_file(
        &mut self,
        file_path: &std::path::Path,
        target: ProtectionTarget,
        context: HashMap<String, String>,
    ) -> Result<ProtectionResult> {
        // In a real implementation, this would read and analyze the file content
        // For this simulation, we'll just check the file path string
        self.check_content(&file_path.to_string_lossy(), target, context).await
    }
    
    /// Log a protection event
    fn log_protection_event(
        &mut self,
        event_type: String,
        target: ProtectionTarget,
        threat: Option<DetectedThreat>,
        actions: Vec<ProtectiveAction>,
    ) {
        if self.config.log_all_events || threat.is_some() {
            let event = ProtectionEvent {
                id: format!("event_{}", Uuid::new_v4()),
                timestamp: Utc::now(),
                event_type,
                target,
                threat,
                actions,
                user_notified: self.config.alert_on_threat,
                data: HashMap::new(),
            };
            
            self.event_log.push(event);
        }
    }
    
    /// Generate recommendations based on a detected threat
    fn generate_recommendations(&self, threat: &DetectedThreat) -> Vec<String> {
        let mut recommendations = Vec::new();
        
        match threat.threat_type {
            ThreatType::InappropriateContent => {
                recommendations.push("Consider enabling content filtering".to_string());
                recommendations.push("Review parental controls".to_string());
            }
            ThreatType::Phishing => {
                recommendations.push("Enable two-factor authentication".to_string());
                recommendations.push("Verify the legitimacy of communications through other channels".to_string());
            }
            ThreatType::Malware => {
                recommendations.push("Run a full system scan".to_string());
                recommendations.push("Update antivirus and security software".to_string());
            }
            ThreatType::IdentityTheft => {
                recommendations.push("Monitor accounts for suspicious activity".to_string());
                recommendations.push("Consider identity theft protection services".to_string());
            }
            _ => {
                recommendations.push("Exercise caution when dealing with similar content".to_string());
                recommendations.push("Review security settings for added protection".to_string());
            }
        }
        
        recommendations
    }
    
    /// Add a custom protection rule
    pub fn add_rule(&mut self, rule: ProtectionRule) -> Result<()> {
        // Check if a rule with the same ID already exists
        if self.rules.iter().any(|r| r.id == rule.id) {
            return Err(anyhow!("Rule with ID {} already exists", rule.id));
        }
        
        self.rules.push(rule);
        Ok(())
    }
    
    /// Enable or disable the protection system
    pub fn set_enabled(&mut self, enabled: bool) {
        self.config.enabled = enabled;
        
        self.log_protection_event(
            if enabled { "system_enabled".to_string() } else { "system_disabled".to_string() },
            ProtectionTarget::Custom("system".to_string()),
            None,
            vec![],
        );
    }
    
    /// Get the most recent threats
    pub fn recent_threats(&self, limit: usize) -> Vec<DetectedThreat> {
        self.detection_history
            .iter()
            .rev()
            .take(limit)
            .cloned()
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_conscience_protection() {
        // Create a conscience protection system
        let mut protection = ConscienceProtection::new().unwrap();
        
        // Test content that should be safe
        let result = protection.check_content(
            "This is safe educational content about science and math",
            ProtectionTarget::Children,
            HashMap::new(),
        ).await.unwrap();
        
        assert!(result.success);
        assert!(result.threat.is_none());
        
        // Test content that should trigger a rule
        let result = protection.check_content(
            "This content contains explicit adult material that is not appropriate",
            ProtectionTarget::Children,
            HashMap::new(),
        ).await.unwrap();
        
        assert!(result.success);
        assert!(result.threat.is_some());
        assert_eq!(result.threat.as_ref().unwrap().threat_type, ThreatType::InappropriateContent);
    }
}