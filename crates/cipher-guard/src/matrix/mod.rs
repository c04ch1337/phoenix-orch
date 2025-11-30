//! Strategic Defense Matrix
//! 
//! Comprehensive defensive security framework integrating:
//! - Kill Chain Phase Defense Mapping
//! - Control Types Framework
//! - Mitigation Framework (NIST CSF + CIS Controls)
//! - Vulnerability Defense Map Architecture

pub mod kill_chain;
pub mod controls;
pub mod mitigation;
pub mod vulnerability_map;

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

// Re-exports for convenient access
pub use kill_chain::*;
pub use controls::*;
pub use mitigation::*;
pub use vulnerability_map::*;

/// Main Strategic Defense Matrix structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategicDefenseMatrix {
    pub kill_chain_defense: KillChainDefense,
    pub control_framework: ControlFramework,
    pub mitigation_framework: MitigationFramework,
    pub vulnerability_map: VulnerabilityDefenseMap,
    pub threat_intelligence: ThreatIntelligence,
    pub overall_security_posture: SecurityPosture,
    pub last_assessment: DateTime<Utc>,
}

impl StrategicDefenseMatrix {
    /// Create a new Strategic Defense Matrix
    pub fn new() -> Self {
        Self {
            kill_chain_defense: KillChainDefense::new(),
            control_framework: ControlFramework::new(),
            mitigation_framework: MitigationFramework::new(),
            vulnerability_map: VulnerabilityDefenseMap::new(),
            threat_intelligence: ThreatIntelligence::new(),
            overall_security_posture: SecurityPosture::new(),
            last_assessment: Utc::now(),
        }
    }

    /// Update matrix with threat intelligence
    pub fn update_with_threat_intelligence(&mut self, threat_data: ThreatIntelligence) {
        self.threat_intelligence = threat_data;
        
        // Enhance all components based on threat intelligence
        self.kill_chain_defense.enhance_for_threats(&self.threat_intelligence);
        self.control_framework.enhance_for_threats(&self.threat_intelligence);
        self.mitigation_framework.enhance_for_threats(&self.threat_intelligence);
        
        self.last_assessment = Utc::now();
        self.calculate_overall_posture();
    }

    /// Calculate overall security posture
    pub fn calculate_overall_posture(&mut self) -> SecurityPosture {
        // Calculate scores from different components
        let kill_chain_score = self.kill_chain_defense.calculate_effectiveness();
        let control_score = self.control_framework.calculate_effectiveness();
        let mitigation_score = self.mitigation_framework.calculate_maturity() as f64 / 5.0;
        let coverage_score = self.vulnerability_map.calculate_coverage();

        // Weighted average calculation
        let overall_score = (kill_chain_score * 0.3) + 
                          (control_score * 0.25) + 
                          (mitigation_score * 0.25) + 
                          (coverage_score * 0.2);

        self.overall_security_posture = SecurityPosture {
            score: overall_score,
            level: self.score_to_level(overall_score),
            strengths: self.identify_strengths(),
            weaknesses: self.identify_weaknesses(),
            recommendations: self.generate_recommendations(),
            last_calculated: Utc::now(),
        };

        self.overall_security_posture.clone()
    }

    /// Convert score to security level
    fn score_to_level(&self, score: f64) -> SecurityLevel {
        match score {
            x if x >= 0.9 => SecurityLevel::Excellent,
            x if x >= 0.8 => SecurityLevel::Good,
            x if x >= 0.7 => SecurityLevel::Adequate,
            x if x >= 0.6 => SecurityLevel::Basic,
            x if x >= 0.5 => SecurityLevel::Weak,
            _ => SecurityLevel::Critical,
        }
    }

    /// Identify security strengths
    fn identify_strengths(&self) -> Vec<String> {
        let mut strengths = Vec::new();

        // Check kill chain defenses
        if self.kill_chain_defense.reconnaissance.effectiveness_score >= 0.8 {
            strengths.push("Strong reconnaissance detection capabilities".to_string());
        }
        if self.kill_chain_defense.exploitation.effectiveness_score >= 0.8 {
            strengths.push("Robust exploitation prevention".to_string());
        }

        // Check control framework
        if self.control_framework.preventive.effectiveness_score >= 0.8 {
            strengths.push("Effective preventive controls".to_string());
        }
        if self.control_framework.detective.effectiveness_score >= 0.8 {
            strengths.push("Strong detective capabilities".to_string());
        }

        // Check mitigation framework
        if self.mitigation_framework.overall_maturity as u8 >= 4 {
            strengths.push("Mature mitigation processes".to_string());
        }

        strengths
    }

    /// Identify security weaknesses
    fn identify_weaknesses(&self) -> Vec<String> {
        let mut weaknesses = Vec::new();

        // Check kill chain defenses
        if self.kill_chain_defense.reconnaissance.effectiveness_score < 0.6 {
            weaknesses.push("Weak reconnaissance detection".to_string());
        }
        if self.kill_chain_defense.command_control.effectiveness_score < 0.6 {
            weaknesses.push("Inadequate C2 detection".to_string());
        }

        // Check control framework
        if self.control_framework.compensating.effectiveness_score < 0.5 {
            weaknesses.push("Limited compensating controls".to_string());
        }

        // Check vulnerability coverage
        if self.vulnerability_map.coverage_score < 0.7 {
            weaknesses.push("Incomplete vulnerability coverage".to_string());
        }

        weaknesses
    }

    /// Generate security recommendations
    fn generate_recommendations(&self) -> Vec<SecurityRecommendation> {
        let mut recommendations = Vec::new();

        // Generate recommendations based on weaknesses
        for weakness in &self.identify_weaknesses() {
            recommendations.push(SecurityRecommendation {
                description: format!("Address weakness: {}", weakness),
                priority: self.calculate_recommendation_priority(weakness),
                estimated_effort: "Medium".to_string(),
                impact: "High".to_string(),
            });
        }

        recommendations
    }

    /// Calculate recommendation priority
    fn calculate_recommendation_priority(&self, weakness: &str) -> RecommendationPriority {
        if weakness.contains("Critical") || weakness.contains("C2") {
            RecommendationPriority::Critical
        } else if weakness.contains("Weak") || weakness.contains("Inadequate") {
            RecommendationPriority::High
        } else {
            RecommendationPriority::Medium
        }
    }
}

/// Threat Intelligence structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatIntelligence {
    pub recent_threats: Vec<ThreatIndicator>,
    pub emerging_threats: Vec<EmergingThreat>,
    pub industry_threats: Vec<IndustryThreat>,
    pub last_updated: DateTime<Utc>,
    pub confidence_level: f64,
}

impl ThreatIntelligence {
    pub fn new() -> Self {
        Self {
            recent_threats: Vec::new(),
            emerging_threats: Vec::new(),
            industry_threats: Vec::new(),
            last_updated: Utc::now(),
            confidence_level: 0.0,
        }
    }

    /// Add recent threat indicator
    pub fn add_recent_threat(&mut self, threat: ThreatIndicator) {
        self.recent_threats.push(threat);
        self.last_updated = Utc::now();
    }

    /// Add emerging threat
    pub fn add_emerging_threat(&mut self, threat: EmergingThreat) {
        self.emerging_threats.push(threat);
        self.last_updated = Utc::now();
    }

    /// Update confidence level
    pub fn update_confidence(&mut self, confidence: f64) {
        self.confidence_level = confidence.clamp(0.0, 1.0);
        self.last_updated = Utc::now();
    }
}

/// Security Posture structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityPosture {
    pub score: f64,
    pub level: SecurityLevel,
    pub strengths: Vec<String>,
    pub weaknesses: Vec<String>,
    pub recommendations: Vec<SecurityRecommendation>,
    pub last_calculated: DateTime<Utc>,
}

impl SecurityPosture {
    pub fn new() -> Self {
        Self {
            score: 0.0,
            level: SecurityLevel::Critical,
            strengths: Vec::new(),
            weaknesses: Vec::new(),
            recommendations: Vec::new(),
            last_calculated: Utc::now(),
        }
    }
}

/// Security Recommendation structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityRecommendation {
    pub description: String,
    pub priority: RecommendationPriority,
    pub estimated_effort: String,
    pub impact: String,
}

// Supporting structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatIndicator {
    pub indicator_type: ThreatIndicatorType,
    pub value: String,
    pub confidence: f64,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmergingThreat {
    pub name: String,
    pub description: String,
    pub potential_impact: f64,
    pub readiness_level: ReadinessLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndustryThreat {
    pub industry: String,
    pub threat_type: String,
    pub frequency: f64,
    pub impact: f64,
}

// Enums
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecurityLevel {
    Critical,
    Weak,
    Basic,
    Adequate,
    Good,
    Excellent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecommendationPriority {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ThreatIndicatorType {
    IPAddress,
    Domain,
    URL,
    FileHash,
    Email,
    UserAgent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReadinessLevel {
    NotReady,
    PartiallyReady,
    MostlyReady,
    FullyReady,
}