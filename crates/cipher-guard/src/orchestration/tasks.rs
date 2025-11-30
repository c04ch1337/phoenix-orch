//! Defensive Task Definitions
//! 
//! Defines various defensive tasks that Blue Team agents can perform

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

/// Defensive Task structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefensiveTask {
    pub task_id: Uuid,
    pub task_type: DefensiveTaskType,
    pub description: String,
    pub priority: TaskPriority,
    pub assigned_agent: Option<Uuid>,
    pub status: TaskStatus,
    pub time_allocated: Duration,
    pub time_spent: Duration,
    pub dependencies: Vec<Uuid>,
    pub evidence_requirements: Vec<EvidenceRequirement>,
    pub resource_requirements: HashMap<ResourceType, f64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deadline: Option<DateTime<Utc>>,
    pub success_criteria: SuccessCriteria,
}

impl DefensiveTask {
    /// Create a new defensive task
    pub fn new(
        task_type: DefensiveTaskType,
        description: String,
        priority: TaskPriority,
    ) -> Self {
        Self {
            task_id: Uuid::new_v4(),
            task_type,
            description,
            priority,
            assigned_agent: None,
            status: TaskStatus::Pending,
            time_allocated: Duration::from_seconds(3600), // 1 hour default
            time_spent: Duration::from_seconds(0),
            dependencies: Vec::new(),
            evidence_requirements: Vec::new(),
            resource_requirements: HashMap::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deadline: None,
            success_criteria: SuccessCriteria::default(),
        }
    }

    /// Add a dependency to this task
    pub fn add_dependency(&mut self, dependency_task_id: Uuid) {
        self.dependencies.push(dependency_task_id);
        self.updated_at = Utc::now();
    }

    /// Add evidence requirement
    pub fn add_evidence_requirement(&mut self, requirement: EvidenceRequirement) {
        self.evidence_requirements.push(requirement);
        self.updated_at = Utc::now();
    }

    /// Add resource requirement
    pub fn add_resource_requirement(&mut self, resource_type: ResourceType, amount: f64) {
        self.resource_requirements.insert(resource_type, amount);
        self.updated_at = Utc::now();
    }

    /// Get all resource requirements
    pub fn resource_requirements(&self) -> HashMap<ResourceType, f64> {
        self.resource_requirements.clone()
    }

    /// Check if task has all dependencies satisfied
    pub fn dependencies_satisfied(&self, completed_tasks: &[Uuid]) -> bool {
        self.dependencies.iter()
            .all(|dep_id| completed_tasks.contains(dep_id))
    }

    /// Update task status
    pub fn update_status(&mut self, new_status: TaskStatus) {
        self.status = new_status;
        self.updated_at = Utc::now();
    }

    /// Record time spent on task
    pub fn record_time(&mut self, additional_time: Duration) {
        self.time_spent = Duration::from_seconds(
            self.time_spent.to_seconds() + additional_time.to_seconds()
        );
        self.updated_at = Utc::now();
    }

    /// Check if task is overdue
    pub fn is_overdue(&self) -> bool {
        if let Some(deadline) = self.deadline {
            Utc::now() > deadline
        } else {
            false
        }
    }

    /// Calculate completion percentage
    pub fn completion_percentage(&self) -> f64 {
        match self.status {
            TaskStatus::Completed => 1.0,
            TaskStatus::Failed => 0.0,
            TaskStatus::InProgress => {
                // Estimate based on time spent vs allocated
                let spent = self.time_spent.to_seconds() as f64;
                let allocated = self.time_allocated.to_seconds() as f64;
                (spent / allocated).min(0.99) // Cap at 99% until completed
            }
            _ => 0.0,
        }
    }
}

/// Defensive Task Types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DefensiveTaskType {
    // SOC Analyst tasks
    AlertTriage,
    IncidentAnalysis,
    FalsePositiveReview,
    
    // Threat Hunter tasks
    ThreatHunting,
    IocAnalysis,
    BehaviorAnalysis,
    
    // Incident Responder tasks
    IncidentResponse,
    EvidenceCollection,
    ContainmentProcedures,
    
    // Forensic Specialist tasks
    ForensicAnalysis,
    MemoryAnalysis,
    NetworkForensics,
    
    // Compliance Auditor tasks
    ComplianceAudit,
    GapAnalysis,
    PolicyReview,
    
    // System Hardener tasks
    SystemHardening,
    ConfigurationReview,
    SecurityBaseline,
    
    // Recovery Specialist tasks
    SystemRecovery,
    BackupValidation,
    DisasterRecovery,
    
    // General tasks
    SecurityMonitoring,
    VulnerabilityAssessment,
    RiskAssessment,
    SecurityTraining,
    ReportGeneration,
}

/// Task Priority levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum TaskPriority {
    Critical,    // Immediate attention required
    High,        // High priority within current shift
    Medium,      // Standard priority
    Low,         // Can be scheduled for later
    Routine,     // Regular maintenance tasks
}

/// Task Status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TaskStatus {
    Pending,     // Task created but not assigned
    Assigned,    // Task assigned to agent
    InProgress,  // Agent is working on task
    Completed,   // Task successfully completed
    Failed,      // Task failed to complete
    Blocked,     // Task blocked by dependencies or resources
    Cancelled,   // Task cancelled by supervisor
}

/// Evidence Requirement for tasks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceRequirement {
    pub evidence_type: EvidenceType,
    pub description: String,
    pub quantity: u32,
    pub quality_standard: EvidenceQuality,
    pub chain_of_custody_required: bool,
}

/// Success Criteria for task completion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuccessCriteria {
    pub technical_success: TechnicalCriteria,
    pub procedural_success: ProceduralCriteria,
    pub documentation_requirements: DocumentationRequirements,
    pub validation_required: bool,
}

impl Default for SuccessCriteria {
    fn default() -> Self {
        Self {
            technical_success: TechnicalCriteria::default(),
            procedural_success: ProceduralCriteria::default(),
            documentation_requirements: DocumentationRequirements::default(),
            validation_required: true,
        }
    }
}

/// Technical success criteria
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechnicalCriteria {
    pub accuracy_threshold: f64,
    pub completeness_threshold: f64,
    pub timeliness_requirement: Duration,
}

impl Default for TechnicalCriteria {
    fn default() -> Self {
        Self {
            accuracy_threshold: 0.95,
            completeness_th极reshold: 0.9,
            timeliness_requirement: Duration::from_seconds(3600),
        }
    }
}

/// Procedural success criteria
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProceduralCriteria {
    pub compliance_level: f64,
    pub adherence_to_procedures: f64,
    pub quality_standards: f64,
}

impl Default for ProceduralCriteria {
    fn default() -> Self {
        Self {
            compliance_level: 1.0,
            adherence_to_procedures: 0.9,
            quality_standards: 0.95,
        }
    }
}

/// Documentation requirements
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentationRequirements {
    pub report_required: bool,
    pub evidence_logging: bool,
    pub chain_of_custody: bool,
    pub audit_trail: bool,
}

impl Default for DocumentationRequirements {
    fn default() -> Self {
        Self {
            report_required: true,
            evidence_logging: true,
            chain_of_custody: true,
            audit_trail: true,
        }
    }
}

/// Resource types for task requirements
#[derive(Debug, Clone, Serialize, Deserialize, Hash, Eq, PartialEq)]
pub enum ResourceType {
    CpuTime,        // CPU processing time
    Memory,         // Memory allocation
    Storage,        // Storage space
    Network,        // Network bandwidth
    Database,       // Database access
    ApiCalls,       // API call quota
    ExternalTools,  // External tool access
    HumanReview,    // Human review time
}

/// Evidence types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EvidenceType {
    LogFiles,
    NetworkPackets,
    MemoryDump,
    DiskImage,
    Screenshots,
    VideoRecording,
    AudioRecording,
    Documentation,
    WitnessStatement,
    PhysicalEvidence,
    DigitalArtifacts,
}

/// Evidence quality standards
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EvidenceQuality {
    Minimum,        // Basic evidence quality
    Standard,       // Standard forensic quality
    High,           // High-quality evidence
    CourtGrade,     // Court-admissible quality
}

/// Duration type for time measurements
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Duration {
    pub hours: u32,
    pub minutes: u32,
    pub seconds: u32,
}

impl Duration {
    pub fn from_seconds(total_seconds: u32) -> Self {
        let hours = total_seconds极/ 3600;
        let minutes = (total_seconds % 3600) / 60;
        let seconds = total_seconds % 60;
        
        Self { hours, minutes, seconds }
    }
    
    pub fn to_seconds(&self) -> u32 {
        self.hours * 3600 + self.minutes * 60 + self.seconds
    }
}

/// Task completion result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskCompletion {
    pub task_id: Uuid,
    pub success: bool,
    pub completion_time: Duration,
    pub evidence_collected: Vec<Evidence>,
    pub notes: String,
    pub quality_score: f64,
    pub completed_at: DateTime<Utc>,
}

/// Task assignment result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskAssignmentResult {
    pub task_id: Uuid,
    pub agent_id: Uuid,
    pub assignment_time: DateTime<Utc>,
    pub expected_completion: DateTime<Utc>,
    pub assignment_confidence: f64,
}

/// Task dependency graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDependencyGraph {
    pub tasks: HashMap<Uuid, DefensiveTask>,
    pub dependencies: HashMap<Uuid, Vec<Uuid>>,
    pub critical_path: Vec<Uuid>,
}

impl TaskDependencyGraph {
    pub fn new() -> Self {
        Self {
            tasks: HashMap::new(),
            dependencies: HashMap::new(),
            critical_path: Vec::new(),
        }
    }

    pub fn add_task(&mut self, task: DefensiveTask) {
        self.tasks.insert(task.task_id, task);
    }

    pub fn add_dependency(&mut self, task_id: Uuid, depends_on: Uuid) {
        self.dependencies.entry(task_id)
            .or_insert_with(Vec::new)
            .push(depends_on);
    }

    pub fn calculate_critical_path(&mut self) -> Vec<Uuid> {
        // Implement critical path calculation
        // This is a simplified implementation
        Vec::new()
    }

    pub fn get_ready_tasks(&self, completed_tasks: &[Uuid]) -> Vec<Uuid> {
        self.tasks.keys()
            .filter(|&task_id| {
                let task = self.tasks.get(task_id).unwrap();
                task.status == TaskStatus::Pending &&
                task.dependencies_satisfied(completed_tasks)
            })
            .cloned()
            .collect()
    }
}