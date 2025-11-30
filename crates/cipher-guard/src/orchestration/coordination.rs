//! Coordination Engine for Multi-Agent Operations
//! 
//! Handles coordination between multiple Blue Team agents for complex defensive operations

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::collections::{HashMap, HashSet};

/// Coordination Engine for complex multi-agent operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoordinationEngine {
    pub strategy: CoordinationStrategy,
    pub communication_protocol: CommunicationProtocol,
    pub coordination_rules: Vec<CoordinationRule>,
    pub agent_relationships: HashMap<Uuid, AgentRelationships>,
    pub task_dependencies: TaskDependencyManager,
    pub performance_tracker: CoordinationPerformanceTracker,
}

impl CoordinationEngine {
    /// Create a new Coordination Engine
    pub fn new() -> Self {
        Self {
            strategy: CoordinationStrategy::Hybrid,
            communication_protocol: CommunicationProtocol::Hierarchical,
            coordination_rules: Vec::new(),
            agent_relationships: HashMap::new(),
            task_dependencies: TaskDependencyManager::new(),
            performance_tracker: CoordinationPerformanceTracker::new(),
        }
    }

    /// Coordinate agents for complex operations
    pub fn coordinate(
        &mut self, 
        agents: &HashMap<Uuid, BlueTeamAgent>, 
        tasks: &[DefensiveTask]
    ) -> CoordinationResult {
        let coordinated_tasks = self.identify_coordination_opportunities(tasks);
        let agent_assignments = self.assign_coordinated_tasks(agents, &coordinated_tasks);
        
        let coordination_score = self.calculate_coordination_score(&agent_assignments);
        
        CoordinationResult {
            strategy: self.strategy,
            coordinated_tasks,
            agent_assignments,
            coordination_score,
        }
    }

    /// Identify tasks that require coordination
    fn identify_coordination_opportunities(&self, tasks: &[DefensiveTask]) -> Vec<Uuid> {
        tasks.iter()
            .filter(|task| self.requires_coordination(task))
            .map(|task| task.task_id)
            .collect()
    }

    /// Check if a task requires coordination
    fn requires_coordination(&self, task: &DefensiveTask) -> bool {
        // Tasks with multiple dependencies or complex requirements need coordination
        task.dependencies.len() > 2 ||
        task.evidence_requirements.len() > 3 ||
        matches!(task.task_type, 
            DefensiveTaskType::IncidentResponse |
            DefensiveTaskType::ForensicAnalysis |
            DefensiveTaskType::DisasterRecovery
        )
    }

    /// Assign coordinated tasks to agent teams
    fn assign_coordinated_tasks(
        &self, 
        agents: &HashMap<Uuid, BlueTeamAgent>, 
        coordinated_tasks: &[Uuid]
    ) -> HashMap<Uuid, Vec<Uuid>> {
        let mut assignments = HashMap::new();
        
        for &task_id in coordinated_tasks {
            let mut task_agents = self.select_agent_team(agents, task_id);
            assignments.insert(task_id, task_agents);
        }
        
        assignments
    }

    /// Select the best agent team for a coordinated task
    fn select_agent_team(&self, agents: &HashMap<Uuid, BlueTeamAgent>, task_id: Uuid) -> Vec<Uuid> {
        // Simple team selection based on agent types
        // In a real implementation, this would use more sophisticated logic
        agents.values()
            .filter(|agent| matches!(agent.agent_type, 
                BlueTeamAgentType::IncidentResponder { .. } |
                BlueTeamAgentType::ForensicSpecialist { .. } |
                BlueTeamAgentType::ThreatHunter { .. }
            ))
            .map(|agent| agent.agent_id)
            .take(3) // Maximum team size
            .collect()
    }

    /// Calculate coordination effectiveness score
    fn calculate_coordination_score(&self, assignments: &HashMap<Uuid, Vec<Uuid>>) -> f64 {
        if assignments.is_empty() {
            return 1.0;
        }
        
        let mut total_score = 0.0;
        
        for agent_ids in assignments.values() {
            let team_score = self.calculate_team_cohesion(agent_ids);
            total_score += team_score;
        }
        
        total_score / assignments.len() as f64
    }

    /// Calculate team cohesion score
    fn calculate_team_cohesion(&self, agent_ids: &[Uuid]) -> f64 {
        // Calculate how well agents work together
        // This is a simplified implementation
        match agent_ids.len() {
            0 => 0.0,
            1 => 0.5, // Single agent coordination
            2 => 0.7, // Pair coordination
            3 => 0.8, // Small team coordination
            _ => 0.6, // Larger teams are harder to coordinate
        }
    }

    /// Add a coordination rule
    pub fn add_coordination_rule(&mut self, rule: CoordinationRule) {
        self.coordination_rules.push(rule);
    }

    /// Establish relationship between agents
    pub fn establish_relationship(&mut self, agent1: Uuid, agent2: Uuid, relationship_type: RelationshipType) {
        let relationship = AgentRelationship {
            agent_id: agent2,
            relationship_type,
            established_at: Utc::now(),
            strength: 0.5, // Initial strength
        };
        
        self.agent_relationships.entry(agent1)
            .or_insert_with(AgentRelationships::new)
            .relationships.push(relationship);
    }

    /// Update relationship strength based on successful coordination
    pub fn update_relationship_strength(&mut self, agent1: Uuid, agent2: Uuid, success: bool) {
        if let Some(relationships) = self.agent_relationships.get_mut(&agent1) {
            if let Some(relationship) = relationships.relationships.iter_mut()
                .find(|r| r.agent_id == agent2) {
                
                relationship.strength = if success {
                    (relationship.strength + 0.1).min(1.0)
                } else {
                    (relationship.strength - 0.05).max(0.0)
                };
            }
        }
    }
}

/// Task Dependency Manager
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDependencyManager {
    pub dependency_graph: HashMap<Uuid, Vec<Uuid>>,
    pub critical_paths: HashMap<Uuid, Vec<Uuid>>,
    pub dependency_resolution_strategy: DependencyResolutionStrategy,
}

impl TaskDependencyManager {
    pub fn new() -> Self {
        Self {
            dependency_graph: HashMap::new(),
            critical_paths: HashMap::new(),
            dependency_resolution_strategy: DependencyResolutionStrategy::Sequential,
        }
    }

    /// Add a dependency between tasks
    pub fn add_dependency(&mut self, task_id: Uuid, depends_on: Uuid) {
        self.dependency_graph.entry(task_id)
            .or_insert_with(Vec::new)
            .push(depends_on);
    }

    /// Remove a dependency
    pub fn remove_dependency(&mut self, task_id: Uuid, depends_on: Uuid) {
        if let Some(dependencies) = self.dependency_graph.get_mut(&task_id) {
            dependencies.retain(|&id| id != depends_on);
        }
    }

    /// Get all dependencies for a task
    pub fn get_dependencies(&self, task_id: Uuid) -> Vec<Uuid> {
        self.dependency_graph.get(&task_id)
            .cloned()
            .unwrap_or_default()
    }

    /// Check if a task has all dependencies satisfied
    pub fn dependencies_satisfied(&self, task_id: Uuid, completed_tasks: &HashSet<Uuid>) -> bool {
        self.get_dependencies(task_id)
            .iter()
            .all(|dep_id| completed_tasks.contains(dep_id))
    }

    /// Calculate critical path for a set of tasks
    pub fn calculate_critical_path(&mut self, tasks: &[DefensiveTask]) -> Vec<Uuid> {
        // Simplified critical path calculation
        // In a real implementation, this would use graph algorithms
        tasks.iter()
            .filter(|task| task.priority == TaskPriority::Critical)
            .map(|task| task.task_id)
            .collect()
    }
}

/// Coordination Performance Tracker
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoordinationPerformanceTracker {
    pub coordination_history: Vec<CoordinationEvent>,
    pub performance_metrics: CoordinationMetrics,
    pub improvement_recommendations: Vec<ImprovementRecommendation>,
}

impl CoordinationPerformanceTracker {
    pub fn new() -> Self {
        Self {
            coordination_history: Vec::new(),
            performance_metrics: CoordinationMetrics::new(),
            improvement_recommendations: Vec::new(),
        }
    }

    /// Record a coordination event
    pub fn record_coordination_event(&mut self, event: CoordinationEvent) {
        self.coordination_history.push(event);
        self.update_metrics();
    }

    /// Update performance metrics based on recent events
    fn update_metrics(&mut self) {
        let recent_events: Vec<&CoordinationEvent> = self.coordination_history
            .iter()
            .rev()
            .take(100) // Last 100 events
            .collect();

        if recent_events.is_empty() {
            return;
        }

        let successful_events = recent_events.iter()
            .filter(|event| event.success)
            .count();

        let total_events = recent_events.len();
        self.performance_metrics.success_rate = successful_events as f64 / total_events as f64;

        // Calculate average coordination time
        let total_time: u32 = recent_events.iter()
            .map(|event| event.coordination_time.to_seconds())
            .sum();
        self.performance_metrics.average_coordination_time = 
            Duration::from_seconds(total_time / total_events as u32);

        self.performance_metrics.last_updated = Utc::now();
    }

    /// Generate improvement recommendations
    pub fn generate_recommendations(&mut self) -> Vec<ImprovementRecommendation> {
        let mut recommendations = Vec::new();

        if self.performance_metrics.success_rate < 0.8 {
            recommendations.push(ImprovementRecommendation::ImproveCommunicationProtocol);
        }
        
        if self.performance_metrics.average_coordination_time.to_seconds() > 3600 {
            recommendations.push(ImprovementRecommendation::OptimizeTaskAssignment);
        }

        recommendations
    }
}

// Supporting structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRelationships {
    pub relationships: Vec<AgentRelationship>,
}

impl AgentRelationships {
    pub fn new() -> Self {
        Self {
            relationships: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRelationship {
    pub agent_id: Uuid,
    pub relationship_type: RelationshipType,
    pub established_at: DateTime<Utc>,
    pub strength: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoordinationRule {
    pub rule_id: Uuid,
    pub condition: CoordinationCondition,
    pub action: CoordinationAction,
    pub priority: RulePriority,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoordinationEvent {
    pub event_id: Uuid,
    pub task_id: Uuid,
    pub involved_agents: Vec<Uuid>,
    pub coordination_time: Duration,
    pub success: bool,
    pub coordination_score: f64,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoordinationMetrics {
    pub success_rate: f64,
    pub average_coordination_time: Duration,
    pub team_cohesion_score: f64,
    pub dependency_resolution_rate: f64,
    pub last_updated: DateTime<Utc>,
}

impl CoordinationMetrics {
    pub fn new() -> Self {
        Self {
            success_rate: 1.0,
            average_coordination_time: Duration::from_seconds(0),
            team_cohesion_score: 0.5,
            dependency_resolution_rate: 1.0,
            last_updated: Utc::now(),
        }
    }
}

// Enums
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CoordinationStrategy {
    Centralized,    // Single coordinator
    Distributed,    // Peer-to-peer coordination
    Hybrid,         // Mixed approach
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CommunicationProtocol {
    Direct,         // Direct agent-to-agent
    Broadcast,      // Broadcast to all agents
    Multicast,      // Multicast to specific groups
    Hierarchical,   // Hierarchical communication
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RelationshipType {
    Collaborative,  // Work together on tasks
    Consultative,   // Seek advice/input
    Supervisory,    // Oversight relationship
    Peer,           // Equal partnership
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DependencyResolutionStrategy {
    Sequential,     // Execute dependencies in sequence
    Parallel,       // Execute when possible in parallel
    Optimized,      // Optimize based on resources
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CoordinationCondition {
    TaskComplexity { threshold: f64 },
    ResourceConflict { resource_type: ResourceType },
    TimeConstraint { max_duration: Duration },
    TeamSize { min_size: usize, max_size: usize },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CoordinationAction {
    AssignTeam { team_size: usize },
    EscalateToSupervisor,
    ReallocateResources,
    ModifyTaskParameters,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RulePriority {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImprovementRecommendation {
    ImproveCommunicationProtocol,
    OptimizeTaskAssignment,
    EnhanceTeamCohesion,
    UpgradeCoordinationTools,
    TrainAgentsOnCoordination,
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