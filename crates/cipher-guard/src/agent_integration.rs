use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

use crate::ethics::EthicalEvaluation;
use crate::telemetry::TelemetryService;

/// Agent Integration Service for Blue Team capabilities
pub struct AgentIntegrationService {
    agents: Arc<RwLock<HashMap<String, Box<dyn AgentInterface>>>>,
    telemetry: Arc<TelemetryService>,
}

impl AgentIntegrationService {
    pub fn new(telemetry: Arc<TelemetryService>) -> Self {
        Self {
            agents: Arc::new(RwLock::new(HashMap::new())),
            telemetry,
        }
    }

    /// Register a new agent
    pub async fn register_agent(&self, agent: Box<dyn AgentInterface>) -> Result<(), AgentError> {
        let agent_id = agent.get_id().await;
        let capabilities = agent.get_capabilities().await;
        
        info!(
            "Registering agent {} with capabilities: {:?}",
            agent_id, capabilities
        );

        let mut agents = self.agents.write().await;
        agents.insert(agent_id, agent);
        Ok(())
    }

    /// Deploy agents for defensive operation
    pub async fn deploy_agents(
        &self,
        operation: DefensiveOperation,
        evaluation: EthicalEvaluation,
    ) -> Result<Vec<AgentDeployment>, AgentError> {
        let mut deployments = Vec::new();
        let agents = self.agents.read().await;

        // Match operation requirements with agent capabilities
        for (agent_id, agent) in agents.iter() {
            if self.is_agent_suitable(&operation, agent).await {
                info!("Deploying agent {} for operation {}", agent_id, operation.id);
                
                let deployment = AgentDeployment {
                    agent_id: agent_id.clone(),
                    operation_id: operation.id.clone(),
                    status: DeploymentStatus::Pending,
                    assigned_tasks: Vec::new(),
                };

                // Validate deployment against ethical framework
                if evaluation.overall_score >= 0.7 {
                    match agent.deploy(operation.clone()).await {
                        Ok(_) => {
                            deployments.push(deployment);
                        }
                        Err(e) => {
                            error!("Failed to deploy agent {}: {}", agent_id, e);
                            return Err(AgentError::DeploymentFailed(e.to_string()));
                        }
                    }
                } else {
                    warn!(
                        "Agent deployment rejected due to ethical concerns: {}",
                        agent_id
                    );
                }
            }
        }

        Ok(deployments)
    }

    /// Check if agent is suitable for operation
    async fn is_agent_suitable(
        &self,
        operation: &DefensiveOperation,
        agent: &Box<dyn AgentInterface>,
    ) -> bool {
        let capabilities = agent.get_capabilities().await;
        operation.required_capabilities.iter().all(|req| {
            capabilities.contains(req)
        })
    }

    /// Coordinate agent actions
    pub async fn coordinate_agents(
        &self,
        deployments: &[AgentDeployment],
    ) -> Result<(), AgentError> {
        let agents = self.agents.read().await;
        
        for deployment in deployments {
            if let Some(agent) = agents.get(&deployment.agent_id) {
                match agent.coordinate().await {
                    Ok(_) => {
                        info!("Agent {} coordinated successfully", deployment.agent_id);
                    }
                    Err(e) => {
                        error!("Failed to coordinate agent {}: {}", deployment.agent_id, e);
                        return Err(AgentError::CoordinationFailed(e.to_string()));
                    }
                }
            }
        }

        Ok(())
    }

    /// Monitor agent health
    pub async fn monitor_agents(&self) -> HashMap<String, AgentHealth> {
        let mut health_status = HashMap::new();
        let agents = self.agents.read().await;

        for (agent_id, agent) in agents.iter() {
            match agent.get_health().await {
                Ok(health) => {
                    health_status.insert(agent_id.clone(), health);
                }
                Err(e) => {
                    error!("Failed to get health status for agent {}: {}", agent_id, e);
                    health_status.insert(agent_id.clone(), AgentHealth {
                        status: AgentStatus::Error,
                        metrics: HashMap::new(),
                        last_heartbeat: None,
                    });
                }
            }
        }

        health_status
    }
}

#[async_trait]
pub trait AgentInterface: Send + Sync {
    async fn get_id(&self) -> String;
    async fn get_capabilities(&self) -> Vec<AgentCapability>;
    async fn deploy(&self, operation: DefensiveOperation) -> Result<(), AgentError>;
    async fn coordinate(&self) -> Result<(), AgentError>;
    async fn get_health(&self) -> Result<AgentHealth, AgentError>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefensiveOperation {
    pub id: String,
    pub operation_type: String,
    pub target_scope: Vec<String>,
    pub required_capabilities: Vec<AgentCapability>,
    pub constraints: OperationConstraints,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationConstraints {
    pub max_impact: f64,
    pub timeout: u64,
    pub resource_limits: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AgentCapability {
    NetworkMonitoring,
    ThreatHunting,
    IncidentResponse,
    ForensicAnalysis,
    VulnerabilityAssessment,
    MalwareAnalysis,
    ThreatIntelligence,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentDeployment {
    pub agent_id: String,
    pub operation_id: String,
    pub status: DeploymentStatus,
    pub assigned_tasks: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DeploymentStatus {
    Pending,
    Active,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentHealth {
    pub status: AgentStatus,
    pub metrics: HashMap<String, f64>,
    pub last_heartbeat: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentStatus {
    Healthy,
    Degraded,
    Error,
}

#[derive(Debug, thiserror::Error)]
pub enum AgentError {
    #[error("Failed to deploy agent: {0}")]
    DeploymentFailed(String),
    
    #[error("Agent coordination failed: {0}")]
    CoordinationFailed(String),
    
    #[error("Agent communication error: {0}")]
    CommunicationError(String),
    
    #[error("Invalid agent configuration: {0}")]
    ConfigurationError(String),
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct MockAgent {
        id: String,
        capabilities: Vec<AgentCapability>,
    }

    #[async_trait]
    impl AgentInterface for MockAgent {
        async fn get_id(&self) -> String {
            self.id.clone()
        }

        async fn get_capabilities(&self) -> Vec<AgentCapability> {
            self.capabilities.clone()
        }

        async fn deploy(&self, _operation: DefensiveOperation) -> Result<(), AgentError> {
            Ok(())
        }

        async fn coordinate(&self) -> Result<(), AgentError> {
            Ok(())
        }

        async fn get_health(&self) -> Result<AgentHealth, AgentError> {
            Ok(AgentHealth {
                status: AgentStatus::Healthy,
                metrics: HashMap::new(),
                last_heartbeat: Some(
                    SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_secs() as i64
                ),
            })
        }
    }

    #[tokio::test]
    async fn test_agent_integration() {
        let telemetry = Arc::new(TelemetryService::new(Default::default()));
        let integration = AgentIntegrationService::new(telemetry);

        // Register mock agent
        let mock_agent = Box::new(MockAgent {
            id: "test-agent".to_string(),
            capabilities: vec![AgentCapability::NetworkMonitoring],
        });
        integration.register_agent(mock_agent).await.unwrap();

        // Test deployment
        let operation = DefensiveOperation {
            id: "test-op".to_string(),
            operation_type: "monitor".to_string(),
            target_scope: vec!["network".to_string()],
            required_capabilities: vec![AgentCapability::NetworkMonitoring],
            constraints: OperationConstraints {
                max_impact: 0.5,
                timeout: 3600,
                resource_limits: HashMap::new(),
            },
        };

        let evaluation = EthicalEvaluation {
            principle_results: vec![],
            policy_results: vec![],
            risk_level: crate::ethics::RiskLevel::Low,
            overall_score: 0.8,
        };

        let deployments = integration.deploy_agents(operation, evaluation).await.unwrap();
        assert_eq!(deployments.len(), 1);
        assert_eq!(deployments[0].agent_id, "test-agent");
    }
}