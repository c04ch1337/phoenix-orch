//! Blue Team Agent Definitions
//! 
//! Defines 7 specialist Blue Team agents for comprehensive defensive operations

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Blue Team Agent structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlueTeamAgent {
    pub agent_id: Uuid,
    pub name: String,
    pub agent_type: BlueTeamAgentType,
    pub capabilities: AgentCapabilities,
    pub status: AgentStatus,
    pub current_task: Option<Uuid>,
    pub performance_metrics: PerformanceMetrics,
    pub last_activity: DateTime<Utc>,
    pub specialization_level: SpecializationLevel,
}

impl BlueTeamAgent {
    /// Create a new Blue Team Agent
    pub fn new(name: String, agent_type: BlueTeamAgentType) -> Self {
        Self {
            agent_id: Uuid::new_v4(),
            name,
            agent_type,
            capabilities: AgentCapabilities::default(),
            status: AgentStatus::Available,
            current_task: None,
            performance_metrics: PerformanceMetrics::new(),
            last_activity: Utc::now(),
            specialization_level: SpecializationLevel::Expert,
        }
    }

    /// Check if agent can handle a specific task type
    pub fn can_handle_task(&self, task_type: &DefensiveTaskType) -> bool {
        self.agent_type.matches_task_type(task_type) && 
        self.status == AgentStatus::Available
    }

    /// Assign a task to this agent
    pub fn assign_task(&mut self, task_id: Uuid) -> Result<(), AssignmentError> {
        if self.status != AgentStatus::Available {
            return Err(AssignmentError::AgentBusy);
        }
        
        self.current_task = Some(task_id);
        self.status = AgentStatus::Busy;
        self.last_activity = Utc::now();
        
        Ok(())
    }

    /// Complete the current task
    pub fn complete_task(&mut self, success: bool) {
        self.current_task = None;
        self.status = AgentStatus::Available;
        self.last_activity = Utc::now();
        
        // Update performance metrics
        if success {
            self.performance_metrics.tasks_completed += 1;
        } else {
            self.performance_metrics.tasks_failed += 1;
        }
        
        self.performance_metrics.calculate_success_rate();
    }

    /// Get agent's expertise level for a specific task type
    pub fn get_expertise_level(&self, task_type: &DefensiveTaskType) -> f64 {
        if self.agent_type.matches_task_type(task_type) {
            match self.specialization_level {
                SpecializationLevel::Novice => 0.3,
                SpecializationLevel::Intermediate => 0.6,
                SpecializationLevel::Expert => 0.9,
                SpecializationLevel::Master => 1.0,
            }
        } else {
            0.1 // Minimal capability for non-specialized tasks
        }
    }
}

/// 7 Specialist Blue Team Agent Types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BlueTeamAgentType {
    /// SOC Analyst - Triage and alert processing
    SocAnalyst {
        triage_capability: TriageCapability,
        alert_processing: AlertProcessing,
        false_positive_reduction: FPReduction,
    },
    /// Threat Hunter - Proactive threat detection
    ThreatHunter {
        hypothesis_generation: HypothesisGeneration,
        investigation_techniques: InvestigationTech,
        sigma_rules: SigmaRuleEngine,
    },
    /// Incident Responder - Incident management and coordination
    IncidentResponder {
        case_management: CaseManagement,
        coordination_capability: Coordination,
        evidence_collection: EvidenceCollection,
    },
    /// Forensic Specialist - Digital forensics analysis
    ForensicSpecialist {
        disk_forensics: DiskForensics,
        memory_forensics: MemoryForensics,
        network_forensics: NetworkForensics,
    },
    /// Compliance Auditor - Regulatory compliance and gap analysis
    ComplianceAuditor {
        framework_knowledge: FrameworkKnowledge,
        gap_analysis: GapAnalysis,
        remediation_planning: RemediationPlanning,
    },
    /// System Hardener - System security hardening
    SystemHardener {
        configuration_management: ConfigManagement,
        security_baselines: SecurityBaselines,
        hardening_scripts: HardeningScripts,
    },
    /// Recovery Specialist - System recovery and validation
    RecoverySpecialist {
        backup_restoration: BackupRestoration,
        system_rebuilding: SystemRebuilding,
        validation_testing: ValidationTesting,
    },
}

impl BlueTeamAgentType {
    /// Check if this agent type matches a task type
    pub fn matches_task_type(&self, task_type: &DefensiveTaskType) -> bool {
        match (self, task_type) {
            (BlueTeamAgentType::SocAnalyst { .. }, DefensiveTaskType::AlertTriage) => true,
            (BlueTeamAgentType::SocAnalyst { .. }, DefensiveTaskType::IncidentAnalysis) => true,
            
            (BlueTeamAgentType::ThreatHunter { .. }, DefensiveTaskType::ThreatHunting) => true,
            (BlueTeamAgentType::ThreatHunter { .. }, DefensiveTaskType::IocAnalysis) => true,
            
            (BlueTeamAgentType::IncidentResponder { .. }, DefensiveTaskType::IncidentResponse) => true,
            (BlueTeamAgentType::IncidentResponder { .. }, DefensiveTaskType::EvidenceCollection) => true,
            
            (BlueTeamAgentType::ForensicSpecialist { .. }, DefensiveTaskType::ForensicAnalysis) => true,
            (BlueTeamAgentType::ForensicSpecialist { .. }, DefensiveTaskType::MemoryAnalysis) => true,
            
            (BlueTeamAgentType::ComplianceAuditor { .. }, DefensiveTaskType::ComplianceAudit) => true,
            (BlueTeamAgentType::ComplianceAuditor { .. }, DefensiveTaskType::GapAnalysis) => true,
            
            (BlueTeamAgentType::SystemHardener { .. }, DefensiveTaskType::SystemHardening) => true,
            (BlueTeamAgentType::SystemHardener { .. }, DefensiveTaskType::ConfigurationReview) => true,
            
            (BlueTeamAgentType::RecoverySpecialist { .. }, DefensiveTaskType::SystemRecovery) => true,
            (BlueTeamAgentType::RecoverySpecialist { .. }, DefensiveTaskType::BackupValidation) => true,
            
            _ => false,
        }
    }

    /// Get the primary specialty of this agent type
    pub fn primary_specialty(&self) -> &'static str {
        match self {
            BlueTeamAgentType::SocAnalyst { .. } => "SOC Analysis",
            BlueTeamAgentType::ThreatHunter { .. } => "Threat Hunting",
            BlueTeamAgentType::IncidentResponder { .. } => "Incident Response",
            BlueTeamAgentType::ForensicSpecialist { .. } => "Digital Forensics",
            BlueTeamAgentType::ComplianceAuditor { .. } => "Compliance Auditing",
            BlueTeamAgentType::SystemHardener { .. } => "System Hardening",
            BlueTeamAgentType::RecoverySpecialist { .. } => "System Recovery",
        }
    }
}

/// Agent Capabilities structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentCapabilities {
    pub technical_skills: TechnicalSkills,
    pub analytical_skills: AnalyticalSkills,
    pub communication_skills: CommunicationSkills,
    pub tool_proficiency: ToolProficiency,
    pub domain_knowledge: DomainKnowledge,
}

impl Default for AgentCapabilities {
    fn default() -> Self {
        Self {
            technical_skills: TechnicalSkills::default(),
            analytical_skills: AnalyticalSkills::default(),
            communication_skills: CommunicationSkills::default(),
            tool_proficiency: ToolProficiency::default(),
            domain_knowledge: DomainKnowledge::default(),
        }
    }
}

/// Performance Metrics for agents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub tasks_completed: u32,
    pub tasks_failed: u32,
    pub average_completion_time: Duration,
    pub success_rate: f64,
    pub last_updated: DateTime<Utc>,
}

impl PerformanceMetrics {
    pub fn new() -> Self {
        Self {
            tasks_completed: 0,
            tasks_failed: 0,
            average_completion_time: Duration::from_seconds(0),
            success_rate: 1.0,
            last_updated: Utc::now(),
        }
    }

    pub fn calculate_success_rate(&mut self) {
        let total_tasks = self.tasks_completed + self.tasks_failed;
        if total_tasks > 0 {
            self.success_rate = self.tasks_completed as f64 / total_tasks as f64;
        }
        self.last_updated = Utc::now();
    }
}

// Supporting structures for agent capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechnicalSkills {
    pub network_security: f64,
    pub system_administration: f64,
    pub programming: f64,
    pub database_skills: f64,
    pub cloud_security: f64,
}

impl Default for TechnicalSkills {
    fn default() -> Self {
        Self {
            network_security: 0.7,
            system_administration: 0.7,
            programming: 0.5,
            database_skills: 0.6,
            cloud_security: 0.8,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticalSkills {
    pub problem_solving: f64,
    pub pattern_recognition: f64,
    pub critical_thinking: f64,
    pub risk_assessment: f64,
}

impl Default for AnalyticalSkills {
    fn default() -> Self {
        Self {
            problem_solving: 0.8,
            pattern_recognition: 0.9,
            critical_thinking: 0.8,
            risk_assessment: 0.7,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommunicationSkills {
    pub technical_writing: f64,
    pub verbal_communication: f64,
    pub collaboration: f64,
    pub presentation: f64,
}

impl Default for CommunicationSkills {
    fn default() -> Self {
        Self {
            technical_writing: 0.7,
            verbal_communication: 0.8,
            collaboration: 0.9,
            presentation: 0.6,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolProficiency {
    pub siem_tools: f64,
    pub forensic_tools: f64,
    pub monitoring_tools: f64,
    pub automation_tools: f64,
}

impl Default for ToolProficiency {
    fn default() -> Self {
        Self {
            siem_tools: 0.8,
            forensic_tools: 0.7,
            monitoring_tools: 0.9,
            automation_tools: 0.6,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainKnowledge {
    pub cybersecurity_frameworks: f64,
    pub compliance_standards: f64,
    pub threat_intelligence: f64,
    pub industry_best_practices: f64,
}

impl Default for DomainKnowledge {
    fn default() -> Self {
        Self {
            cybersecurity_frameworks: 0.8,
            compliance_standards: 0.7,
            threat_intelligence: 0.9,
            industry_best_practices: 0.8,
        }
    }
}

// Specialized capability structures for each agent type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriageCapability {
    pub alert_prioritization: f64,
    pub incident_classification: f64,
    pub escalation_procedures: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertProcessing {
    pub processing_speed: f64,
    pub accuracy: f64,
    pub automation_level: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FPReduction {
    pub false_positive_identification: f64,
    pub tuning_capability: f64,
    pub feedback_implementation: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HypothesisGeneration {
    pub threat_hypothesis: f64,
    pub investigation_planning: f64,
    pub hypothesis_validation: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvestigationTech {
    pub log_analysis: f64,
    pub network_analysis: f64,
    pub endpoint_analysis: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SigmaRuleEngine {
    pub rule_creation: f64,
    pub rule_tuning: f64,
    pub detection_coverage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseManagement {
    pub case_documentation: f64,
    pub timeline_reconstruction: f64,
    pub stakeholder_coordination: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Coordination {
    pub team_coordination: f64,
    pub external_coordination: f64,
    pub crisis_management: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceCollection {
    pub evidence_preservation: f64,
    pub chain_of_custody: f64,
    pub forensic_imaging: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskForensics {
    pub file_system_analysis: f64,
    pub artifact_extraction: f64,
    pub timeline_analysis: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryForensics {
    pub memory_dump_analysis: f64,
    pub process_analysis: f64,
    pub malware_analysis: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkForensics {
    pub packet_analysis: f64,
    pub traffic_reconstruction: f64,
    pub protocol_analysis: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkKnowledge {
    pub nist_csf: f64,
    pub iso_27001: f64,
    pub cis_controls: f64,
    pub pci_dss: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GapAnalysis {
    pub compliance_gap_identification: f64,
    pub risk_assessment: f64,
    pub remediation_prioritization: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemediationPlanning {
    pub remediation_strategy: f64,
    pub implementation_planning: f64,
    pub validation_procedures: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigManagement {
    pub configuration_auditing: f64,
    pub baseline_management: f64,
    pub change_control: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityBaselines {
    pub os_hardening: f64,
    pub application_hardening: f64,
    pub network_hardening: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardeningScripts {
    pub automation_scripting: f64,
    pub deployment_coordination: f64,
    pub validation_testing: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupRestoration {
    pub backup_verification: f64,
    pub restoration_procedures: f64,
    pub data_integrity: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemRebuilding {
    pub system_reconstruction: f64,
    pub configuration_restoration: f64,
    pub security_reimplementation: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationTesting {
    pub functionality_testing: f64,
    pub security_testing: f64,
    pub performance_testing: f64,
}

// Enums
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentStatus {
    Available,
    Busy,
    Offline,
    Training,
    Maintenance,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SpecializationLevel {
    Novice,
    Intermediate,
    Expert,
    Master,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AssignmentError {
    AgentBusy,
    InsufficientCapabilities,
    ResourceConflict,
    TaskMismatch,
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