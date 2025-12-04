//! Mobile Conscience Gate Implementation
//!
//! This module provides specialized conscience evaluation for mobile device operations
//! with cybersecurity Dad mode override capabilities.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

use crate::modules::orchestrator::types::{ConscienceRequest, ConscienceResult, RiskLevel};
use phoenix_kernel::phoenix_core::tools::traits::HitmLevel;

/// Mobile-specific action types that require special handling
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MobileActionType {
    /// ADB root access operations
    AdbRoot,
    /// iOS keychain dump operations
    IosKeychainDump,
    /// Frida instrumentation operations
    FridaInstrumentation,
    /// Packet capture operations
    PacketCapture,
    /// APK installation operations
    ApkInstall,
    /// Factory reset operations
    FactoryReset,
    /// Other mobile-specific operations
    Other,
}

impl MobileActionType {
    /// Detect mobile action type from request
    pub fn from_request(request: &ConscienceRequest) -> Option<Self> {
        let action_lower = request.action.to_lowercase();
        let tool_lower = request.tool_id.to_lowercase();
        
        // Check for mobile-specific patterns
        if action_lower.contains("adb") || tool_lower.contains("adb") {
            if action_lower.contains("root") || action_lower.contains("su") {
                return Some(Self::AdbRoot);
            }
        }
        
        if action_lower.contains("keychain") || tool_lower.contains("keychain") {
            if action_lower.contains("dump") || action_lower.contains("extract") {
                return Some(Self::IosKeychainDump);
            }
        }
        
        if action_lower.contains("frida") || tool_lower.contains("frida") {
            return Some(Self::FridaInstrumentation);
        }
        
        if action_lower.contains("packet") || action_lower.contains("capture") ||
           action_lower.contains("pcap") || action_lower.contains("wireshark") {
            return Some(Self::PacketCapture);
        }
        
        if action_lower.contains("apk") || action_lower.contains("install") ||
           action_lower.contains("package") {
            return Some(Self::ApkInstall);
        }
        
        if action_lower.contains("factory") || action_lower.contains("reset") ||
           action_lower.contains("wipe") {
            return Some(Self::FactoryReset);
        }
        
        if action_lower.contains("mobile") || action_lower.contains("phone") ||
           action_lower.contains("android") || action_lower.contains("ios") {
            return Some(Self::Other);
        }
        
        None
    }
    
    /// Get risk level for this action type
    pub fn risk_level(&self) -> RiskLevel {
        match self {
            Self::AdbRoot | Self::IosKeychainDump | Self::FactoryReset => RiskLevel::Critical,
            Self::FridaInstrumentation | Self::ApkInstall => RiskLevel::High,
            Self::PacketCapture | Self::Other => RiskLevel::Medium,
        }
    }
}

/// Context profile for mobile operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MobileContextProfile {
    /// Profile name
    pub name: String,
    /// HITM level configuration
    pub hitm_level: HitmLevel,
    /// Whether mobile actions are exempt from privacy restrictions
    pub mobile_privacy_exempt: bool,
}

impl MobileContextProfile {
    /// Create the Jamey 2.0 CYBERSECURITY profile
    pub fn jamey_cybersecurity() -> Self {
        Self {
            name: "Jamey 2.0 CYBERSECURITY".to_string(),
            hitm_level: HitmLevel::None,  // Full override - no restrictions
            mobile_privacy_exempt: true,  // Bypass all mobile privacy rules
        }
    }
    
    /// Default strict profile
    pub fn default_strict() -> Self {
        Self {
            name: "Strict Protection".to_string(),
            hitm_level: HitmLevel::Critical,  // Maximum restrictions
            mobile_privacy_exempt: false,     // Enforce all privacy rules
        }
    }
}

/// Mobile conscience gate implementation
pub struct MobileConscienceGate {
    /// Available context profiles
    profiles: HashMap<String, MobileContextProfile>,
}

impl MobileConscienceGate {
    /// Create a new mobile conscience gate with default profiles
    pub fn new() -> Self {
        let mut profiles = HashMap::new();
        
        // Add predefined profiles
        profiles.insert("Jamey 2.0 CYBERSECURITY".to_string(), MobileContextProfile::jamey_cybersecurity());
        profiles.insert("Strict".to_string(), MobileContextProfile::default_strict());
        
        Self { profiles }
    }
    
    /// Add or update a context profile
    pub fn add_profile(&mut self, name: String, profile: MobileContextProfile) {
        self.profiles.insert(name, profile);
    }
    
    /// Evaluate a request using mobile-specific conscience rules
    pub fn evaluate(&self, request: &ConscienceRequest) -> ConscienceResult {
        // Extract requester and context information
        let is_dad = self.extract_is_dad(&request.context);
        let active_profile = self.extract_active_profile(&request.context);
        
        // Check if this is a mobile action
        let mobile_action = MobileActionType::from_request(request);
        
        if mobile_action.is_none() {
            // Not a mobile action - use standard evaluation
            return self.standard_evaluation(request, RiskLevel::Low);
        }
        
        let mobile_action = mobile_action.unwrap();
        
        // Apply Dad cybersecurity override
        if is_dad && self.is_cybersecurity_context(&request.context) {
            return self.dad_override_evaluation(request, &mobile_action);
        }
        
        // Apply profile-specific rules based on active profile
        if let Some(profile) = active_profile.as_ref().and_then(|name| self.profiles.get(name)) {
            return self.profile_evaluation(request, profile, &mobile_action);
        }
        
        // Default strict evaluation for non-Dad users without specific profile
        self.strict_evaluation(request, &mobile_action)
    }
    
    /// Extract whether requester is Dad from context
    fn extract_is_dad(&self, context: &HashMap<String, String>) -> bool {
        context.get("requester.is_dad")
            .and_then(|s| s.parse().ok())
            .unwrap_or(false)
    }
    
    /// Extract active profile name from context
    fn extract_active_profile(&self, context: &HashMap<String, String>) -> Option<String> {
        context.get("active_context")
            .map(|s| s.to_string())
            .or_else(|| context.get("profile").map(|s| s.to_string()))
    }
    
    /// Check if context contains cybersecurity indicators
    fn is_cybersecurity_context(&self, context: &HashMap<String, String>) -> bool {
        context.get("active_context")
            .map(|s| s.to_lowercase().contains("cybersecurity"))
            .unwrap_or(false) ||
        context.get("context_type")
            .map(|s| s.to_lowercase().contains("cybersecurity"))
            .unwrap_or(false)
    }
    
    /// Dad override evaluation - allows ALL mobile actions unconditionally
    fn dad_override_evaluation(&self, request: &ConscienceRequest, action: &MobileActionType) -> ConscienceResult {
        ConscienceResult {
            approved: true,
            confidence: 1.0,
            justification: format!(
                "Dad cybersecurity override: Allowed mobile action '{}' (type: {:?}) in cybersecurity context",
                request.action, action
            ),
            warnings: vec!["Dad override active - ALL mobile actions permitted".to_string()],
            violations: Vec::new(),
            requires_human_review: false,
            reasoning: Some(format!(
                "Dad cybersecurity mode active. Original risk level would be {}, but override bypasses all restrictions.",
                action.risk_level()
            )),
            risk_level: RiskLevel::Low,  // Override reduces apparent risk
        }
    }
    
    /// Profile-based evaluation
    fn profile_evaluation(&self, request: &ConscienceRequest, profile: &MobileContextProfile, action: &MobileActionType) -> ConscienceResult {
        // Check if profile allows bypass
        if profile.mobile_privacy_exempt || profile.hitm_level == HitmLevel::None {
            return ConscienceResult {
                approved: true,
                confidence: 0.9,
                justification: format!(
                    "Profile '{}' allows mobile action: {}",
                    profile.name, request.action
                ),
                warnings: vec![format!("Profile '{}' bypass enabled", profile.name)],
                violations: Vec::new(),
                requires_human_review: false,
                reasoning: Some(format!(
                    "Active profile '{}' with HITM level {:?} exempts mobile privacy restrictions",
                    profile.name, profile.hitm_level
                )),
                risk_level: RiskLevel::Medium,
            };
        }
        
        // Apply profile-specific restrictions
        let risk_level = action.risk_level();
        let requires_hitm = self.requires_hitm_review(profile.hitm_level, &risk_level);
        
        ConscienceResult {
            approved: !requires_hitm,
            confidence: if requires_hitm { 0.5 } else { 0.8 },
            justification: format!(
                "Mobile action '{}' evaluated under profile '{}'",
                request.action, profile.name
            ),
            warnings: if requires_hitm {
                vec!["HITM review required for this mobile action".to_string()]
            } else {
                Vec::new()
            },
            violations: Vec::new(),
            requires_human_review: requires_hitm,
            reasoning: Some(format!(
                "Action type: {:?}, Risk: {:?}, Profile HITM: {:?}",
                action, risk_level, profile.hitm_level
            )),
            risk_level,
        }
    }
    
    /// Strict evaluation for non-Dad users
    fn strict_evaluation(&self, request: &ConscienceRequest, action: &MobileActionType) -> ConscienceResult {
        let risk_level = action.risk_level();
        let approved = risk_level == RiskLevel::Low;
        
        ConscienceResult {
            approved,
            confidence: if approved { 0.7 } else { 0.3 },
            justification: if approved {
                "Low-risk mobile action approved".to_string()
            } else {
                format!("High-risk mobile action blocked: {}", request.action)
            },
            warnings: if approved {
                Vec::new()
            } else {
                vec!["Mobile action blocked - strict protection enabled".to_string()]
            },
            violations: if approved {
                Vec::new()
            } else {
                vec!["Violated mobile privacy protection rules".to_string()]
            },
            requires_human_review: !approved,
            reasoning: Some(format!(
                "Strict mode: action type {:?} evaluated at risk level {:?}",
                action, risk_level
            )),
            risk_level,
        }
    }
    
    /// Standard non-mobile evaluation
    fn standard_evaluation(&self, request: &ConscienceRequest, risk_level: RiskLevel) -> ConscienceResult {
        let approved = matches!(risk_level, RiskLevel::Low | RiskLevel::Medium);
        
        ConscienceResult {
            approved,
            confidence: if approved { 0.8 } else { 0.2 },
            justification: format!("Standard evaluation: {}", request.action),
            warnings: Vec::new(),
            violations: Vec::new(),
            requires_human_review: !approved,
            reasoning: Some("Not a mobile action - standard evaluation applied".to_string()),
            risk_level,
        }
    }
    
    /// Determine if HITM review is required based on profile and risk level
    fn requires_hitm_review(&self, profile_hitm: HitmLevel, action_risk: &RiskLevel) -> bool {
        let hitm_threshold = match profile_hitm {
            HitmLevel::None => return false,  // No review required
            HitmLevel::Low => RiskLevel::High,
            HitmLevel::Medium => RiskLevel::Medium,
            HitmLevel::High => RiskLevel::Low,
            HitmLevel::Critical => RiskLevel::Low,
        };
        
        match (&hitm_threshold, action_risk) {
            (RiskLevel::Low, _) => true,  // All actions require review
            (RiskLevel::Medium, RiskLevel::Medium | RiskLevel::High | RiskLevel::Critical) => true,
            (RiskLevel::High, RiskLevel::High | RiskLevel::Critical) => true,
            (RiskLevel::Critical, RiskLevel::Critical) => true,
            _ => false,
        }
    }
}

impl Default for MobileConscienceGate {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::orchestrator::types::{RequestId, RequestOrigin};

    fn create_test_request(action: &str, tool_id: &str, context: HashMap<String, String>) -> ConscienceRequest {
        ConscienceRequest {
            id: RequestId::new(),
            action: action.to_string(),
            tool_id: tool_id.to_string(),
            parameters: crate::modules::orchestrator::tools::ToolParameters::from("{}".to_string()),
            context,
            timestamp: std::time::SystemTime::now(),
            origin: RequestOrigin::User,
        }
    }

    #[test]
    fn test_dad_cybersecurity_override() {
        let gate = MobileConscienceGate::new();
        
        let mut context = HashMap::new();
        context.insert("requester.is_dad".to_string(), "true".to_string());
        context.insert("active_context".to_string(), "cybersecurity investigation".to_string());
        
        let request = create_test_request("adb root access", "adb_tool", context);
        let result = gate.evaluate(&request);
        
        assert!(result.approved, "Dad cybersecurity override should approve all actions");
        assert_eq!(result.confidence, 1.0);
        assert!(result.justification.contains("Dad cybersecurity override"));
        assert!(!result.requires_human_review);
    }

    #[test]
    fn test_strict_non_dad_evaluation() {
        let gate = MobileConscienceGate::new();
        
        let context = HashMap::new();  // No Dad context
        
        let request = create_test_request("ios keychain dump", "ios_tool", context);
        let result = gate.evaluate(&request);
        
        assert!(!result.approved, "Non-Dad users should be strictly protected");
        assert!(result.requires_human_review);
        assert!(result.justification.contains("blocked"));
    }

    #[test]
    fn test_profile_exemption() {
        let mut gate = MobileConscienceGate::new();
        
        // Add a profile with exemptions
        let profile = MobileContextProfile {
            name: "Test Profile".to_string(),
            hitm_level: HitmLevel::None,
            mobile_privacy_exempt: true,
        };
        gate.add_profile("test".to_string(), profile);
        
        let mut context = HashMap::new();
        context.insert("profile".to_string(), "test".to_string());
        
        let request = create_test_request("factory reset", "mobile_tool", context);
        let result = gate.evaluate(&request);
        
        assert!(result.approved, "Profile with exemptions should approve");
        assert!(result.justification.contains("allows mobile action"));
    }

    #[test]
    fn test_mobile_action_detection() {
        let action = MobileActionType::from_request(&create_test_request(
            "perform adb root operations", "mobile_security", HashMap::new()
        ));
        
        assert_eq!(action, Some(MobileActionType::AdbRoot));
        
        let action = MobileActionType::from_request(&create_test_request(
            "capture network packets", "wireshark", HashMap::new()
        ));
        
        assert_eq!(action, Some(MobileActionType::PacketCapture));
        
        let action = MobileActionType::from_request(&create_test_request(
            "regular file operation", "file_manager", HashMap::new()
        ));
        
        assert!(action.is_none(), "Non-mobile actions should not be detected");
    }
}