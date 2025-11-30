//! Blue Team Agent Orchestration System
//! 
//! Orchestrates 7 specialist Blue Team agents for comprehensive defensive operations

pub mod agents;
pub mod tasks;
pub mod coordination;

// Re-exports for convenient access
pub use agents::*;
pub use tasks::*;
pub use coordination::*;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Main Blue Team Orchestrator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlueTeamOrchestrator {
    pub agent_pool: HashMap<Uuid, BlueTeamAgent>,
    pub task_queue: Vec<DefensiveTask>,
    pub resource_allocator: ResourceAllocator,
    pub performance_monitor: PerformanceMonitor,
    pub coordination_engine: CoordinationEngine,
    pub last_coordination: DateTime<Utc>,
}

impl BlueTeamOrchestrator {
    /// Create a new Blue Team Orchestrator
    pub fn new() -> Self {
        Self {
            agent_pool: HashMap::new(),
            task_queue: Vec::new(),
            resource_allocator: ResourceAllocator::new(),
            performance_monitor: PerformanceMonitor::new(),
            coordination_engine: CoordinationEngine::new(),
            last_coordination: Utc::now(),
        }
    }

    /// Add an agent to the pool
    pub fn add_agent(&mut self, agent: BlueTeamAgent) -> Uuid {
        let agent_id = Uuid::new_v4();
        self.agent_pool.insert(agent_id, agent);
        agent_id
    }

    /// Remove an agent from the pool
    pub fn remove_agent(&mut self, agent_id: &Uuid) -> Option<BlueTeamAgent> {
        self.agent_pool.remove(agent_id)
    }

    /// Queue a defensive task
    pub fn queue_task(&mut self, task: DefensiveTask) -> Uuid {
        let task_id = Uuid::new_v4();
        let mut task_with_id = task;
        task_with_id.task_id = task_id;
        self.task_queue.push(task_with_id);
        task_id
    }

    /// Assign tasks to available agents
    pub fn assign_tasks(&mut self) -> Vec<TaskAssignment> {
        let mut assignments = Vec::new();
        let mut available_agents: Vec<&mut BlueTeamAgent> = self.agent_pool.values_mut()
            .filter(|agent| agent.status == AgentStatus::Available)
            .collect();

        // Sort tasks by priority
        self.task_queue.sort_by(|a, b| b.priority.cmp(&a.priority));

        for task in &mut self.task_queue {
            if task.status == TaskStatus::Pending {
                if let Some(agent) = available_agents.iter_mut()
                    .find(|a| a.agent_type.matches_task_type(&task.task_type)) {
                    
                    task.assigned_agent = Some(agent.agent_id);
                    task.status = TaskStatus::Assigned;
                    agent.status = AgentStatus::Busy;
                    
                    assignments.push(TaskAssignment {
                        task_id: task.task_id,
                        agent_id: agent.agent_id,
                        assigned_at: Utc::now(),
                    });
                    
                    // Remove assigned agent from available list
                    available_agents.retain(|a| a.agent_id != agent.agent_id);
                }
            }
        }

        assignments
    }

    /// Coordinate agents for complex operations
    pub fn coordinate_agents(&mut self) -> CoordinationResult {
        let result = self.coordination_engine.coordinate(&self.agent_pool, &self.task_queue);
        self.last_coordination = Utc::now();
        result
    }

    /// Get performance metrics
    pub fn get_performance_metrics(&self) -> PerformanceMetrics {
        self.performance_monitor.calculate_metrics(&self.agent_pool, &self.task_queue)
    }
}

/// Resource Allocator for managing agent resources
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceAllocator {
    pub available_resources: HashMap<ResourceType, f64>,
    pub resource_limits: HashMap<ResourceType, f64>,
    pub allocation_strategy: AllocationStrategy,
}

impl ResourceAllocator {
    pub fn new() -> Self {
        Self {
            available_resources: HashMap::new(),
            resource_limits: HashMap::new(),
            allocation_strategy: AllocationStrategy::Balanced,
        }
    }

    /// Allocate resources for a task
    pub fn allocate_resources(&mut self, task: &DefensiveTask) -> Result<ResourceAllocation, AllocationError> {
        let required = task.resource_requirements();
        
        for (resource_type, required_amount) in &required {
            let available = self.available_resources.get(resource_type).unwrap_or(&0.0);
            if available < required_amount {
                return Err(AllocationError::InsufficientResources {
                    resource: resource_type.clone(),
                    required: *required_amount,
                    available: *available,
                });
            }
        }

        // Allocate resources
        for (resource_type, required_amount) in required {
            *self.available_resources.entry(resource_type).or_insert(0.0) -= required_amount;
        }

        Ok(ResourceAllocation {
            task_id: task.task_id,
            allocated_resources: required,
            allocated_at: Utc::now(),
        })
    }

    /// Release resources after task completion
    pub fn release_resources(&mut self, allocation: ResourceAllocation) {
        for (resource_type, amount) in allocation.allocated_resources {
            *self.available_resources.entry(resource_type).or_insert(0.0) += amount;
        }
    }
}

/// Performance Monitor for tracking agent performance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMonitor {
    pub metrics_history: Vec<PerformanceSnapshot>,
    pub alert_thresholds: AlertThresholds,
}

impl PerformanceMonitor {
    pub fn new() -> Self {
        Self {
            metrics_history: Vec::new(),
            alert_thresholds: AlertThresholds::default(),
        }
    }

    /// Calculate current performance metrics
    pub fn calculate_metrics(&self, agents: &HashMap<Uuid, BlueTeamAgent>, tasks: &[DefensiveTask]) -> PerformanceMetrics {
        let total_agents = agents.len();
        let available_agents = agents.values().filter(|a| a.status == AgentStatus::Available).count();
        let busy_agents = agents.values().filter(|a| a.status == AgentStatus::Busy).count();

        let pending_tasks = tasks.iter().filter(|t| t.status == TaskStatus::Pending).count();
        let completed_tasks = tasks.iter().filter(|t| t.status == TaskStatus::Completed).count();
        let failed_tasks = tasks.iter().filter(|t| t.status == TaskStatus::Failed).count();

        let utilization_rate = if total_agents > 0 {
            busy_agents as f64 / total_agents as f64
        } else {
            0.0
        };

        let success_rate = if completed_tasks + failed_tasks > 0 {
            completed_tasks as f64 / (completed_tasks + failed_tasks) as f64
        } else {
            1.0
        };

        PerformanceMetrics {
            total_agents,
            available_agents,
            busy_agents,
            pending_tasks,
            completed_tasks,
            failed_tasks,
            utilization_rate,
            success_rate,
            calculated_at: Utc::now(),
        }
    }

    /// Check for performance alerts
    pub fn check_alerts(&self, metrics: &PerformanceMetrics) -> Vec<PerformanceAlert> {
        let mut alerts = Vec::new();

        if metrics.utilization_rate > self.alert_thresholds.high_utilization {
            alerts.push(PerformanceAlert::HighUtilization {
                current_rate: metrics.utilization_rate,
                threshold: self.alert_thresholds.high_utilization,
            });
        }

        if metrics.success_rate < self.alert_thresholds.low_success_rate {
            alerts.push(PerformanceAlert::LowSuccessRate {
                current_rate: metrics.success_rate,
                threshold: self.alert_thresholds.low_success_rate,
            });
        }

        if metrics.pending_tasks > self.alert_thresholds.high_pending_tasks {
            alerts.push(PerformanceAlert::HighPendingTasks {
                current_count: metrics.pending_tasks,
                threshold: self.alert_thresholds.high_pending_tasks,
            });
        }

        alerts
    }
}

/// Coordination Engine for complex multi-agent operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoordinationEngine {
    pub coordination_strategy: CoordinationStrategy,
    pub communication_protocol: CommunicationProtocol,
}

impl CoordinationEngine {
    pub fn new() -> Self {
        Self {
            coordination_strategy: CoordinationStrategy::Centralized,
            communication_protocol: CommunicationProtocol::Direct,
        }
    }

    /// Coordinate agents for complex operations
    pub fn coordinate(&self, agents: &HashMap<Uuid, BlueTeamAgent>, tasks: &[DefensiveTask]) -> CoordinationResult {
        // Implement coordination logic based on strategy
        match self.coordination_strategy {
            CoordinationStrategy::Centralized => self.centralized_coordination(agents, tasks),
            CoordinationStrategy::Distributed => self.distributed_coordination(agents, tasks),
            CoordinationStrategy::Hybrid => self.hybrid_coordination(agents, tasks),
        }
    }

    fn centralized_coordination(&self, agents: &HashMap<Uuid, BlueTeamAgent>, tasks: &[DefensiveTask]) -> CoordinationResult {
        // Centralized coordination logic
        CoordinationResult {
            strategy: self.coordination_strategy,
            coordinated_tasks: Vec::new(),
            agent_assignments: HashMap::new(),
            coordination_score: 0.8,
        }
    }

    fn distributed_coordination(&self, agents: &HashMap<Uuid, BlueTeamAgent>, tasks: &[DefensiveTask]) -> CoordinationResult {
        // Distributed coordination logic
        CoordinationResult {
            strategy: self.coordination_strategy,
            coordinated_tasks: Vec::new(),
            agent_assignments: HashMap::new(),
            coordination_score: 0.7,
        }
    }

    fn hybrid_coordination(&self, agents: &HashMap<Uuid, BlueTeamAgent>, tasks: &[DefensiveTask]) -> CoordinationResult {
        // Hybrid coordination logic
        CoordinationResult {
            strategy: self.coordination_strategy,
            coordinated_tasks: Vec::new(),
            agent_assignments: HashMap::new(),
            coordination_score: 0.85,
        }
    }
}

// Supporting structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskAssignment {
    pub task_id: Uuid,
    pub agent_id: Uuid,
    pub assigned_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceAllocation {
    pub task_id: Uuid,
    pub allocated_resources: HashMap<ResourceType, f64>,
    pub allocated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub total_agents: usize,
    pub available_agents: usize,
    pub busy_agents: usize,
    pub pending_tasks: usize,
    pub completed_tasks: usize,
    pub failed_tasks: usize,
    pub utilization_rate: f64,
    pub success_rate: f64,
    pub calculated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoordinationResult {
    pub strategy: CoordinationStrategy,
    pub coordinated_tasks: Vec<Uuid>,
    pub agent_assignments: HashMap<Uuid, Vec<Uuid>>, // agent_id -> task_ids
    pub coordination_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertThresholds {
    pub high_utilization: f64,
    pub low_success_rate: f64,
    pub high_pending_tasks: usize,
}

impl Default for AlertThresholds {
    fn default() -> Self {
        Self {
            high_utilization: 0.8,
            low_success_rate: 0.7,
            high_pending_tasks: 10,
        }
    }
}

// Enums
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AllocationStrategy {
    Balanced,
    PerformanceOptimized,
    CostOptimized,
    SecurityFocused,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CoordinationStrategy {
    Centralized,
    Distributed,
    Hybrid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CommunicationProtocol {
    Direct,
    Broadcast,
    Multicast,
    Hierarchical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PerformanceAlert {
    HighUtilization { current_rate: f64, threshold: f64 },
    LowSuccessRate { current_rate: f64, threshold: f64 },
    HighPendingTasks { current_count: usize, threshold: usize },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AllocationError {
    InsufficientResources { resource: ResourceType, required: f64, available: f64 },
    ResourceConflict { resource: ResourceType, conflicting_tasks: Vec<Uuid> },
    AllocationTimeout { resource: ResourceType, timeout_duration: Duration },
}