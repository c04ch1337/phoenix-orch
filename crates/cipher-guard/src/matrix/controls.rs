//! Control Types Framework
//! 
//! Implements the comprehensive control framework with preventive, detective,
//! corrective, and compensating controls

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Main control framework structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlFramework {
    pub preventive: PreventiveControls,
    pub detective: DetectiveControls,
    pub corrective: CorrectiveControls,
    pub compensating: CompensatingControls,
    pub last_assessment: DateTime<Utc>,
    pub effectiveness_score: f64,
}

impl ControlFramework {
    /// Create a new control framework
    pub fn new() -> Self {
        Self {
            preventive: PreventiveControls::new(),
            detective: DetectiveControls::new(),
            corrective: CorrectiveControls::new(),
            compensating: CompensatingControls::new(),
            last_assessment: Utc::now(),
            effectiveness_score: 0.0,
        }
    }

    /// Calculate overall effectiveness score
    pub fn calculate_effectiveness(&mut self) -> f64 {
        let scores = vec![
            self.preventive.effectiveness_score,
            self.detective.effectiveness_score,
            self.corrective.effectiveness_score,
            self.compensating.effectiveness_score,
        ];
        
        self.effectiveness_score = scores.iter().sum::<f64>() / scores.len() as f64;
        self.effectiveness_score
    }

    /// Enhance controls based on threat intelligence
    pub fn enhance_for_threats(&mut self, threat_data: &super::ThreatIntelligence) {
        self.preventive.enhance_for_threats(threat_data);
        self.detective.enhance_for_threats(threat_data);
        self.corrective.enhance_for_threats(threat_data);
        self.compensating.enhance_for_threats(threat_data);
        
        self.last_assessment = Utc::now();
        self.calculate_effectiveness();
    }
}

/// Preventive controls structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreventiveControls {
    pub access_controls: Vec<AccessControl>,
    pub configuration_management: Vec<ConfigControl>,
    pub physical_security: Vec<PhysicalControl>,
    pub effectiveness_score: f64,
    pub last_tested: DateTime<Utc>,
}

impl PreventiveControls {
    pub fn new() -> Self {
        Self {
            access_controls: Vec::new(),
            configuration_management: Vec::new(),
            physical_security: Vec::new(),
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

/// Detective controls structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectiveControls {
    pub monitoring: Vec<MonitoringControl>,
    pub logging: Vec<LoggingControl>,
    pub alerting: Vec<AlertingControl>,
    pub effectiveness_score: f64,
    pub last_tested: DateTime<Utc>,
}

impl DetectiveControls {
    pub fn new() -> Self {
        Self {
            monitoring: Vec::new(),
            logging: Vec::new(),
            alerting: Vec::new(),
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

/// Corrective controls structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorrectiveControls {
    pub incident_response: Vec<ResponseControl>,
    pub recovery: Vec<RecoveryControl>,
    pub remediation: Vec<RemediationControl>,
    pub effectiveness_score: f64,
    pub last_tested: DateTime<Utc>,
}

impl CorrectiveControls {
    pub fn new() -> Self {
        Self {
            incident_response: Vec::new(),
            recovery: Vec::new(),
            remediation: Vec::new(),
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

/// Compensating controls structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompensatingControls {
    pub alternative_controls: Vec<AlternativeControl>,
    pub risk_acceptance: Vec<RiskAcceptance>,
    pub effectiveness_score: f64,
    pub last_tested: DateTime<Utc>,
}

impl CompensatingControls {
    pub fn new() -> Self {
        Self {
            alternative_controls: Vec::new(),
            risk_acceptance: Vec::new(),
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

/// Individual security control
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityControl {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: ControlCategory,
    pub implementation_status: ImplementationStatus,
    pub effectiveness_rating: f64,
    pub last_tested: DateTime<Utc>,
}

/// Control categories
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ControlCategory {
    AccessControl,
    AuditAndAccountability,
    AwarenessAndTraining,
    ConfigurationManagement,
    IdentificationAndAuthentication,
    IncidentResponse,
    Maintenance,
    MediaProtection,
    PhysicalAndEnvironmental,
    PersonnelSecurity,
    RiskAssessment,
    SecurityAssessment,
    SystemAndCommunications,
    SystemAndInformationIntegrity,
}

/// Implementation status levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImplementationStatus {
    NotImplemented,
    PartiallyImplemented,
    MostlyImplemented,
    FullyImplemented,
    Optimized,
}

// Detailed control types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessControl {
    pub id: String,
    pub name: String,
    pub control_type: AccessControlType,
    pub enforcement_level: EnforcementLevel,
    pub coverage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigControl {
    pub id: String,
    pub name: String,
    pub configuration_standard: ConfigurationStandard,
    pub compliance_score: f64,
    pub automation_level: AutomationLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhysicalControl {
    pub id: String,
    pub name: String,
    pub control_type: PhysicalControlType,
    pub protection_level: ProtectionLevel,
    pub monitoring_capability: MonitoringCapability,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringControl {
    pub id: String,
    pub name: String,
    pub monitoring_scope: MonitoringScope,
    pub retention_period: Duration,
    pub analysis_capability: AnalysisCapability,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingControl {
    pub id: String,
    pub name: String,
    pub log_sources: Vec<LogSource>,
    pub log_volume: LogVolume,
    pub analysis_tools: Vec<AnalysisTool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertingControl {
    pub id: String,
    pub name: String,
    pub alert_channels: Vec<AlertChannel>,
    pub response_time: Duration,
    pub false_positive_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseControl {
    pub id: String,
    pub name: String,
    pub response_plan: ResponsePlan,
    pub team_capability: TeamCapability,
    pub exercise_frequency: ExerciseFrequency,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryControl {
    pub id: String,
    pub name: String,
    pub recovery_time_objective: Duration,
    pub recovery_point_objective: Duration,
    pub backup_strategy: BackupStrategy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemediationControl {
    pub id: String,
    pub name: String,
    pub remediation_time: Duration,
    pub verification_process: VerificationProcess,
    pub recurrence_prevention: RecurrencePrevention,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlternativeControl {
    pub id: String,
    pub name: String,
    pub original_control: String,
    pub alternative_justification: String,
    pub risk_level: RiskLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskAcceptance {
    pub id: String,
    pub name: String,
    pub risk_description: String,
    pub acceptance_criteria: String,
    pub review_frequency: ReviewFrequency,
}

// Enums for control properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AccessControlType {
    Discretionary,
    Mandatory,
    RoleBased,
    AttributeBased,
    RuleBased,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EnforcementLevel {
    Audit,
    Warn,
    Block,
    Quarantine,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConfigurationStandard {
    CIS,
    NIST,
    DISA,
    ISO27001,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AutomationLevel {
    Manual,
    SemiAutomated,
    FullyAutomated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PhysicalControlType {
    AccessControl,
    Surveillance,
    Environmental,
    SecurityPersonnel,
    Barriers,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProtectionLevel {
    Basic,
    Enhanced,
    High,
    Maximum,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MonitoringCapability {
    None,
    Basic,
    Advanced,
    Continuous,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MonitoringScope {
    Network,
    System,
    Application,
    User,
    FullSpectrum,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AnalysisCapability {
    Basic,
    Advanced,
    RealTime,
    Predictive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogSource {
    System,
    Application,
    Network,
    Security,
    Database,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogVolume {
    Low,
    Medium,
    High,
    VeryHigh,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AnalysisTool {
    SIEM,
    EDR,
    NDR,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertChannel {
    Email,
    SMS,
    Dashboard,
    MobileApp,
    Integration,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResponsePlan {
    Basic,
    Intermediate,
    Advanced,
    Mature,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TeamCapability {
    Novice,
    Competent,
    Proficient,
    Expert,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExerciseFrequency {
    Never,
    Annual,
    SemiAnnual,
    Quarterly,
    Monthly,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BackupStrategy {
    Full,
    Incremental,
    Differential,
    Continuous,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VerificationProcess {
    None,
    Basic,
    Thorough,
    Automated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecurrencePrevention {
    None,
    Basic,
    Comprehensive,
    Proactive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReviewFrequency {
    Never,
    Annual,
    SemiAnnual,
    Quarterly,
    Monthly,
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