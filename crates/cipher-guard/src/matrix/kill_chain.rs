//! Kill Chain Phases Defense Mapping
//! 
//! Implements defense mechanisms for each phase of the cyber kill chain

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Main Kill Chain Defense structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KillChainDefense {
    pub reconnaissance: ReconnaissanceDefense,
    pub weaponization: WeaponizationDefense,
    pub delivery: DeliveryDefense,
    pub exploitation: ExploitationDefense,
    pub installation: InstallationDefense,
    pub command_control: C2Defense,
    pub actions_objectives: ActionsDefense,
    pub overall_effectiveness: f64,
    pub last_assessment: DateTime<Utc>,
}

impl KillChainDefense {
    /// Create a new Kill Chain Defense structure
    pub fn new() -> Self {
        Self {
            reconnaissance: ReconnaissanceDefense::new(),
            weaponization: WeaponizationDefense::new(),
            delivery: DeliveryDefense::new(),
            exploitation: ExploitationDefense::new(),
            installation: InstallationDefense::new(),
            command_control: C2Defense::new(),
            actions_objectives: ActionsDefense::new(),
            overall_effectiveness: 0.0,
            last_assessment: Utc::now(),
        }
    }

    /// Calculate overall effectiveness score
    pub fn calculate_effectiveness(&mut self) -> f64 {
        let scores = vec![
            self.reconnaissance.effectiveness_score,
            self.weaponization.effectiveness_score,
            self.delivery.effectiveness_score,
            self.exploitation.effectiveness_score,
            self.installation.effectiveness_score,
            self.command_control.effectiveness_score,
            self.actions_objectives.effectiveness_score,
        ];
        
        self.overall_effectiveness = scores.iter().sum::<f64>() / scores.len() as f64;
        self.overall_effectiveness
    }

    /// Enhance defenses based on threat intelligence
    pub fn enhance_for_threats(&mut self, threat_data: &super::ThreatIntelligence) {
        self.reconnaissance.enhance_for_threats(threat_data);
        self.weaponization.enhance_for_threats(threat_data);
        self.delivery.enhance_for_threats(threat_data);
        self.exploitation.enhance_for_threats(threat_data);
        self.installation.enhance_for_threats(threat_data);
        self.command_control.enhance_for_threats(threat_data);
        self.actions_objectives.enhance_for_threats(threat_data);
        
        self.last_assessment = Utc::now();
        self.calculate_effectiveness();
    }

    /// Get the weakest phase in the kill chain defense
    pub fn get_weakest_phase(&self) -> (&str, f64) {
        let phases = [
            ("Reconnaissance", self.reconnaissance.effectiveness_score),
            ("Weaponization", self.weaponization.effectiveness_score),
            ("Delivery", self.delivery.effectiveness_score),
            ("Exploitation", self.exploitation.effectiveness_score),
            ("Installation", self.installation.effectiveness_score),
            ("Command & Control", self.command_control.effectiveness_score),
            ("Actions & Objectives", self.actions_objectives.effectiveness_score),
        ];

        phases.iter()
            .min_by(|a, b| a.1.partial_cmp(&b.1).unwrap())
            .map(|(name, score)| (*name, *score))
            .unwrap_or(("Unknown", 0.0))
    }

    /// Get the strongest phase in the kill chain defense
    pub fn get_strongest_phase(&self) -> (&str, f64) {
        let phases = [
            ("Reconnaissance", self.reconnaissance.effectiveness_score),
            ("Weaponization", self.weaponization.effectiveness_score),
            ("Delivery", self.delivery.effectiveness_score),
            ("Exploitation", self.exploitation.effectiveness_score),
            ("Installation", self.installation.effectiveness_score),
            ("Command & Control", self.command_control.effectiveness_score),
            ("Actions & Objectives", self.actions_objectives.effectiveness_score),
        ];

        phases.iter()
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap())
            .map(|(name, score)| (*name, *score))
            .unwrap_or(("Unknown", 0.0))
    }
}

/// Reconnaissance Defense structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReconnaissanceDefense {
    pub detection_mechanisms: Vec<DetectionMechanism>,
    pub prevention_controls: Vec<PreventionControl>,
    pub response_procedures: Vec<ResponseProcedure>,
    pub effectiveness_score: f64,
    pub last_tested: DateTime<Utc>,
}

impl ReconnaissanceDefense {
    pub fn new() -> Self {
        Self {
            detection_mechanisms: Vec::new(),
            prevention_controls: Vec::new(),
            response_procedures: Vec::new(),
            effectiveness_score: 0.0,
            last_tested: Utc::now(),
        }
    }

    pub fn enhance_for_threats(&mut self, threat_data: &super::ThreatIntelligence) {
        // Implement threat-based enhancement logic
        self.effectiveness_score = (self.effectiveness_score + 0.1).min(1.0);
        self.last_tested = Utc::now();
    }
}

/// Weaponization Defense structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeaponizationDefense {
    pub malware_detection: Vec<MalwareDetection>,
    pub file_analysis: Vec<FileAnalysis>,
    pub threat_intelligence: Vec<ThreatIntelIntegration>,
    pub effectiveness_score: f64,
    pub last_tested: DateTime<Utc>,
}

impl WeaponizationDefense {
    pub fn new() -> Self {
        Self {
            malware_detection: Vec::new(),
            file_analysis: Vec::new(),
            threat_intelligence: Vec::new(),
            effectiveness_score: 0.0,
            last_tested: Utc::now(),
        }
    }

    pub fn enhance_for_threats(&mut self, threat_data: &super::ThreatIntelligence) {
        self.effectiveness_score = (self.effectiveness_score + 0.1).min(1.0);
        self.last_tested = Utc::now();
    }
}

/// Delivery Defense structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryDefense {
    pub email_security: Vec<EmailSecurity>,
    pub web_filtering: Vec<WebFiltering>,
    pub network_security: Vec<NetworkSecurity>,
    pub effectiveness_score: f64,
    pub last_tested: DateTime<Utc>,
}

impl DeliveryDefense {
    pub fn new() -> Self {
        Self {
            email_security: Vec::new(),
            web_filtering: Vec::new(),
            network_security: Vec::new(),
            effectiveness_score: 0.0,
            last_tested: Utc::now(),
        }
    }

    pub fn enhance_for_threats(&mut self, threat_data: &super::ThreatIntelligence) {
        self.effectiveness_score = (self.effectiveness_score + 0.1).min(1.0);
        self.last_tested = Utc::now();
    }
}

/// Exploitation Defense structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExploitationDefense {
    pub vulnerability_management: Vec<VulnerabilityManagement>,
    pub patch_management: Vec<PatchManagement>,
    pub system_hardening: Vec<SystemHardening>,
    pub effectiveness_score: f64,
    pub last_tested: DateTime<Utc>,
}

impl ExploitationDefense {
    pub fn new() -> Self {
        Self {
            vulnerability_management: Vec::new(),
            patch_management: Vec::new(),
            system_hardening: Vec::new(),
            effectiveness_score: 0.0,
            last_tested: Utc::now(),
        }
    }

    pub fn enhance_for_threats(&mut self, threat_data: &super::ThreatIntelligence) {
        self.effectiveness_score = (self.effectiveness_score + 0.1).min(1.0);
        self.last_tested = Utc::now();
    }
}

/// Installation Defense structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallationDefense {
    pub endpoint_protection: Vec<EndpointProtection>,
    pub application_whitelisting: Vec<ApplicationWhitelisting>,
    pub behavior_monitoring: Vec<BehaviorMonitoring>,
    pub effectiveness_score: f64,
    pub last_tested: DateTime<Utc>,
}

impl InstallationDefense {
    pub fn new() -> Self {
        Self {
            endpoint_protection: Vec::new(),
            application_whitelisting: Vec::new(),
            behavior_monitoring: Vec::new(),
            effectiveness_score: 0.0,
            last_tested: Utc::now(),
        }
    }

    pub fn enhance_for_threats(&mut self, threat_data: &super::ThreatIntelligence) {
        self.effectiveness_score = (self.effectiveness_score + 0.1).min(1.0);
        self.last_tested = Utc::now();
    }
}

/// Command & Control Defense structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct C2Defense {
    pub network_monitoring: Vec<NetworkMonitoring>,
    pub dns_security: Vec<DnsSecurity>,
    pub threat_hunting: Vec<ThreatHunting>,
    pub effectiveness_score: f64,
    pub last_tested: DateTime<Utc>,
}

impl C2Defense {
    pub fn new() -> Self {
        Self {
            network_monitoring: Vec::new(),
            dns_security: Vec::new(),
            threat_hunting: Vec::new(),
            effectiveness_score: 0.0,
            last_tested: Utc::now(),
        }
    }

    pub fn enhance_for_threats(&mut self, threat_data: &super::ThreatIntelligence) {
        self.effectiveness_score = (self.effectiveness_score + 0.1).min(1.0);
        self.last_tested = Utc::now();
    }
}

/// Actions & Objectives Defense structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionsDefense {
    pub data_loss_prevention: Vec<DataLossPrevention>,
    pub access_controls: Vec<AccessControl>,
    pub audit_logging: Vec<AuditLogging>,
    pub effectiveness_score: f64,
    pub last_tested: DateTime<Utc>,
}

impl ActionsDefense {
    pub fn new() -> Self {
        Self {
            data_loss_prevention: Vec::new(),
            access_controls: Vec::new(),
            audit_logging: Vec::new(),
            effectiveness_score: 0.0,
            last_tested: Utc::now(),
        }
    }

    pub fn enhance_for_threats(&mut self, threat_data: &super::ThreatIntelligence) {
        self.effectiveness_score = (self.effectiveness_score + 0.1).min(1.0);
        self.last_tested = Utc::now();
    }
}

/// MITRE ATT&CK Tactic Mapping
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MitreTactic {
    Reconnaissance,
    ResourceDevelopment,
    InitialAccess,
    Execution,
    Persistence,
    PrivilegeEscalation,
    DefenseEvasion,
    CredentialAccess,
    Discovery,
    LateralMovement,
    Collection,
    CommandAndControl,
    Exfiltration,
    Impact,
}

// Supporting structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectionMechanism {
    pub name: String,
    pub detection_rate: f64,
    pub false_positive_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreventionControl {
    pub name: String,
    pub prevention_rate: f64,
    pub coverage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseProcedure {
    pub name: String,
    pub response_time: Duration,
    pub success_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MalwareDetection {
    pub name: String,
    pub detection_accuracy: f64,
    pub heuristics_capability: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileAnalysis {
    pub name: String,
    pub analysis_depth: AnalysisDepth,
    pub automation_level: AutomationLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatIntelIntegration {
    pub name: String,
    pub integration_level: IntegrationLevel,
    pub update_frequency: UpdateFrequency,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailSecurity {
    pub name: String,
    pub spam_detection: f64,
    pub phishing_detection: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebFiltering {
    pub name: String,
    pub filtering_effectiveness: f64,
    pub category_coverage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkSecurity {
    pub name: String,
    pub intrusion_detection: f64,
    pub traffic_analysis: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VulnerabilityManagement {
    pub name: String,
    pub scanning_frequency: ScanningFrequency,
    pub remediation_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatchManagement {
    pub name: String,
    pub patch_deployment_time: Duration,
    patch_coverage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemHardening {
    pub name: String,
    pub hardening_level: HardeningLevel,
    pub compliance_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointProtection {
    pub name: String,
    pub real_time_protection: f64,
    pub behavioral_analysis: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplicationWhitelisting {
    pub name: String,
    pub whitelist_coverage: f64,
    pub enforcement_strength: EnforcementStrength,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehaviorMonitoring {
    pub name: String,
    pub anomaly_detection: f64,
    pub response_automation: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkMonitoring {
    pub name: String,
    pub traffic_visibility: f64,
    pub threat_detection: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsSecurity {
    pub name: String,
    pub dns_monitoring: f64,
    pub malicious_domain_detection: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatHunting {
    pub name: String,
    pub hunting_capability: f64,
    pub hypothesis_generation: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataLossPrevention {
    pub name: String,
    pub data_monitoring: f64,
    pub policy_enforcement: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessControl {
    pub name: String,
    pub access_enforcement: f64,
    pub privilege_management: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogging {
    pub name: String,
    pub log_completeness: f64,
    pub retention_period: Duration,
}

// Enums for various properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AnalysisDepth {
    Basic,
    Intermediate,
    Advanced,
    Deep,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AutomationLevel {
    Manual,
    SemiAutomated,
    FullyAutomated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IntegrationLevel {
    None,
    Basic,
    Advanced,
    Full,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UpdateFrequency {
    Never,
    Daily,
    Weekly,
    RealTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ScanningFrequency {
    Never,
    Monthly,
    Weekly,
    Daily,
    Continuous,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HardeningLevel {
    Basic,
    Standard,
    Enhanced,
    Maximum,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EnforcementStrength {
    Audit,
    Warn,
    Block,
    Quarantine,
}

// Duration type for time measurements
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Duration {
    pub hours: u32,
    pub minutes: u32,
    pub seconds: u32,
}

impl Duration {
    pub fn from_seconds(total_seconds: u32) -> Self {
        let hours = total_seconds / 3600;
        let minutes = (total_seconds % 3600) / 60;
        let seconds = total_seconds % 60;
        
        Self { hours, minutes, seconds }
    }
    
    pub fn to_seconds(&self) -> u32 {
        self.hours * 3600 + self.minutes * 60 + self.seconds
    }
}