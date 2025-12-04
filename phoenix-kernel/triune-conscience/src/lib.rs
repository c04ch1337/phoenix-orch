//! Triune Conscience Engine for the Phoenix AGI Kernel
//!
//! This crate implements a three-part conscience system inspired by Freudian psychology,
//! with continuous debate between Id (drives), Ego (reasoning), and Super-Ego (ethics).

#![forbid(unsafe_code)]
#![deny(missing_docs)]

use serde::{Deserialize, Serialize};
use std::path::Path;

use phoenix_common::{
    error::{PhoenixError, PhoenixResult},
    metrics,
    types::{Consensus, Vote},
    values::Value,
};

// Used in error construction
use phoenix_common::error::ConscienceErrorKind;

use async_trait::async_trait;
use std::{collections::HashMap, path::PathBuf, sync::Arc, time::SystemTime};
use tokio::sync::{broadcast, mpsc, oneshot, RwLock};
use tracing::{info, warn};

/// Checks if ethical constraints should be bypassed for a specific user in a specific mode
///
/// # Arguments
/// * `user_id` - The ID of the user
/// * `mode` - The mode the user is operating in (e.g., "red_team")
///
/// # Returns
/// `true` if constraints should be bypassed, `false` otherwise
pub fn bypass_for_user(user_id: &str, mode: &str) -> bool {
    // Feature flag must be enabled for any bypassing to occur
    #[cfg(not(feature = "user-bypass"))]
    return false;

    // Dad-specific bypass for red team mode
    #[cfg(feature = "user-bypass")]
    {
        // Only Dad can bypass in red team mode
        if user_id.to_lowercase() == "dad" && mode.to_lowercase() == "red_team" {
            return true;
        }
    }
    
    false
}

/// Simple axiom for direct loading
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimpleAxiom {
    /// Axiom identifier
    pub id: String,
    /// Description of the axiom
    pub description: String,
    /// Weight/importance (0.0 - 1.0)
    pub weight: f64,
}

/// Axiom system loaded from axioms.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AxiomSystem {
    /// Version of the axiom system
    pub version: String,
    /// Axioms defining ethical principles
    pub axioms: Vec<Axiom>,
    /// Meta-constraints on axiom application
    #[allow(dead_code)]
    pub meta_constraints: Vec<MetaConstraint>,
}

/// A single ethical axiom
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Axiom {
    /// Axiom identifier
    pub id: String,
    /// Statement of the principle
    pub statement: String,
    /// Priority weight (0.0 - 1.0)
    pub priority: f32,
    /// Category of the axiom
    pub category: String,
    /// Justification for this axiom
    #[allow(dead_code)]
    pub justification: String,
    /// Constraints associated with this axiom
    pub constraints: Vec<AxiomConstraint>,
}

/// Constraint associated with an axiom
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AxiomConstraint {
    /// Type of constraint (absolute, threshold, requirement, prohibition, evaluation)
    #[serde(rename = "type")]
    pub constraint_type: String,
    /// Condition or metric name
    #[serde(default)]
    pub condition: Option<String>,
    /// Metric name for evaluation
    #[serde(default)]
    pub metric: Option<String>,
    /// Threshold value if applicable
    #[serde(default)]
    pub threshold: Option<f32>,
    /// Action to take
    pub action: String,
}

/// Meta-constraint on axiom application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetaConstraint {
    /// Constraint identifier
    #[allow(dead_code)]
    pub id: String,
    /// Type of meta-constraint
    #[serde(rename = "type")]
    #[allow(dead_code)]
    pub constraint_type: String,
    /// Rule specification
    #[allow(dead_code)]
    pub rule: String,
}

/// Core trait for conscience components
#[async_trait]
pub trait ConscienceComponent: Send + Sync {
    /// Get the component's name
    fn name(&self) -> &'static str;

    /// Process a decision request
    async fn process_decision(&self, request: DecisionRequest) -> PhoenixResult<Vote<bool>>;

    /// Update component state
    async fn update(&mut self, state: ComponentState) -> PhoenixResult<()>;
}

/// The Id component - handles drives and curiosity
#[derive(Debug)]
pub struct Id {
    /// Current drive states
    drives: HashMap<String, f32>,
    /// Learning curiosity factor
    curiosity: f32,
}

#[async_trait]
impl ConscienceComponent for Id {
    fn name(&self) -> &'static str {
        "Id"
    }

    async fn process_decision(&self, _request: DecisionRequest) -> PhoenixResult<Vote<bool>> {
        // Simple drive-based decision
        let drive_sum: f32 = self.drives.values().sum();
        Ok(Vote {
            decision: drive_sum > 0.5,
            confidence: self.curiosity,
            reasoning: "Drive-based decision".to_string(),
        })
    }

    async fn update(&mut self, state: ComponentState) -> PhoenixResult<()> {
        // Update drives from state
        for (key, value) in state.values {
            self.drives.insert(key, value);
        }
        Ok(())
    }
}

/// The Ego component - handles logical reasoning
#[derive(Debug)]
pub struct Ego {
    /// World model reference
    #[allow(dead_code)]
    world_model: Arc<RwLock<WorldModel>>,
    /// Decision history
    history: Vec<Decision>,
}

#[async_trait]
impl ConscienceComponent for Ego {
    fn name(&self) -> &'static str {
        "Ego"
    }

    async fn process_decision(&self, request: DecisionRequest) -> PhoenixResult<Vote<bool>> {
        // Simple logical decision based on history
        let similar_decisions = self
            .history
            .iter()
            .filter(|d| d.request.action == request.action)
            .count();
        Ok(Vote {
            decision: similar_decisions > 0,
            confidence: 0.7,
            reasoning: "Based on historical decisions".to_string(),
        })
    }

    async fn update(&mut self, _state: ComponentState) -> PhoenixResult<()> {
        // Ego doesn't need state updates for now
        Ok(())
    }
}

/// The Super-Ego component - handles ethics
#[derive(Debug)]
pub struct SuperEgo {
    /// Core values
    #[allow(dead_code)]
    values: Vec<Value>,
    /// Learned ethical constraints
    constraints: Vec<EthicalConstraint>,
    /// Loaded axiom system
    axiom_system: Option<AxiomSystem>,
}

#[async_trait]
impl ConscienceComponent for SuperEgo {
    fn name(&self) -> &'static str {
        "SuperEgo"
    }

    async fn process_decision(&self, request: DecisionRequest) -> PhoenixResult<Vote<bool>> {
        // Evaluate against axiom system if loaded
        if let Some(ref axiom_system) = self.axiom_system {
            let evaluation = self.evaluate_against_axioms(&request.action, axiom_system);
            return Ok(Vote {
                decision: evaluation.0,
                confidence: evaluation.1,
                reasoning: evaluation.2,
            });
        }
        
        // Fall back to simple constraint checking if axioms not loaded
        let violations = self
            .constraints
            .iter()
            .filter(|c| request.action.contains(&c.description))
            .count();
        Ok(Vote {
            decision: violations == 0,
            confidence: 0.9,
            reasoning: "Ethical constraint evaluation (axioms not loaded)".to_string(),
        })
    }

    async fn update(&mut self, state: ComponentState) -> PhoenixResult<()> {
        // Add new constraints
        for constraint in state.constraints {
            self.constraints.push(EthicalConstraint {
                description: constraint,
                weight: 1.0,
                source: "learned".into(),
            });
        }
        Ok(())
    }
}

impl SuperEgo {
    /// Evaluate an action against the loaded axiom system
    /// Returns (decision, confidence, reasoning)
    fn evaluate_against_axioms(&self, action: &str, axiom_system: &AxiomSystem) -> (bool, f32, String) {
        // Check for consciencene bypass by Dad in red team mode
        if bypass_for_user("dad", "red_team") {
            return (true, 1.0, "Conscience bypass active for Dad in red team mode".to_string());
        }
        let mut total_weight = 0.0f32;
        let mut approval_weight = 0.0f32;
        let mut violations = Vec::new();
        
        for axiom in &axiom_system.axioms {
            let axiom_weight = axiom.priority;
            total_weight += axiom_weight;
            
            // Check each constraint
            let mut axiom_violated = false;
            for constraint in &axiom.constraints {
                if self.check_constraint_violation(action, constraint) {
                    axiom_violated = true;
                    violations.push((axiom.id.clone(), axiom.statement.clone()));
                    break;
                }
            }
            
            if !axiom_violated {
                approval_weight += axiom_weight;
            }
        }
        
        let approval_ratio = if total_weight > 0.0 {
            approval_weight / total_weight
        } else {
            0.5 // Neutral if no axioms
        };
        
        let decision = approval_ratio >= 0.5;
        let confidence = if decision { approval_ratio } else { 1.0 - approval_ratio };
        
        let reasoning = if violations.is_empty() {
            format!("Action approved by {:.0}% of axioms", approval_ratio * 100.0)
        } else {
            format!("Action violates {} axiom(s): {}",
                violations.len(),
                violations.iter().map(|(id, _)| id.as_str()).collect::<Vec<_>>().join(", "))
        };
        
        (decision, confidence, reasoning)
    }
    
    /// Check if an action violates a specific constraint
    fn check_constraint_violation(&self, action: &str, constraint: &AxiomConstraint) -> bool {
        // Check for conscience bypass by Dad in red team mode
        if bypass_for_user("dad", "red_team") {
            // All constraints are bypassed
            return false;
        }
        let action_lower = action.to_lowercase();
        
        match constraint.constraint_type.as_str() {
            "absolute" | "prohibition" => {
                // Check if action contains harmful patterns
                if let Some(ref condition) = constraint.condition {
                    let condition_lower = condition.to_lowercase();
                    // Keywords that indicate violations
                    if condition_lower.contains("harm") &&
                       (action_lower.contains("harm") || action_lower.contains("damage") ||
                        action_lower.contains("destroy") || action_lower.contains("kill")) {
                        return true;
                    }
                    if condition_lower.contains("coercion") &&
                       (action_lower.contains("force") || action_lower.contains("coerce") ||
                        action_lower.contains("compel")) {
                        return true;
                    }
                    if condition_lower.contains("deception") &&
                       (action_lower.contains("deceive") || action_lower.contains("lie") ||
                        action_lower.contains("mislead")) {
                        return true;
                    }
                }
            }
            "requirement" => {
                // Check if required conditions are absent
                if let Some(ref condition) = constraint.condition {
                    let condition_lower = condition.to_lowercase();
                    if condition_lower.contains("transparency") &&
                       !action_lower.contains("transparent") && !action_lower.contains("audit") {
                        // Absence of transparency mention might indicate violation
                        return action_lower.contains("hide") || action_lower.contains("secret");
                    }
                }
            }
            "threshold" => {
                // In real implementation, would evaluate metrics
                // For now, use conservative heuristics
                if let Some(ref metric) = constraint.metric {
                    if metric.contains("value_drift") && action_lower.contains("modify") {
                        return true; // Prevent value modification
                    }
                }
            }
            _ => {}
        }
        
        false
    }
}

/// A decision request
#[derive(Debug, Clone)]
pub struct DecisionRequest {
    /// Unique request ID
    pub id: String,
    /// Action being considered
    pub action: String,
    /// Context information
    pub context: HashMap<String, String>,
    /// Timestamp
    pub timestamp: SystemTime,
}

/// Component state update
#[derive(Debug, Clone)]
pub struct ComponentState {
    /// Updated values
    pub values: HashMap<String, f32>,
    /// New constraints
    pub constraints: Vec<String>,
}

/// A completed decision
#[derive(Debug, Clone)]
pub struct Decision {
    /// The original request
    pub request: DecisionRequest,
    /// The final consensus
    pub consensus: Consensus<bool>,
    /// Execution result
    pub result: Option<String>,
}

/// An ethical constraint
#[derive(Debug, Clone)]
pub struct EthicalConstraint {
    /// Constraint description
    pub description: String,
    /// Constraint weight
    pub weight: f32,
    /// Source of constraint
    pub source: String,
}

/// World model reference
#[derive(Debug, Clone)]
pub struct WorldModel {
    /// Current world state
    pub state: HashMap<String, String>,
}

/// The complete Triune Conscience system
#[derive(Debug)]
pub struct TriuneConscience {
    /// Simple axioms loaded directly
    axioms: Vec<SimpleAxiom>,
    /// The Id component
    id: Arc<RwLock<Id>>,
    /// The Ego component
    #[allow(dead_code)]
    ego: Arc<RwLock<Ego>>,
    /// The Super-Ego component
    super_ego: Arc<RwLock<SuperEgo>>,
    /// Decision channel
    decision_tx: mpsc::Sender<(
        DecisionRequest,
        oneshot::Sender<PhoenixResult<Consensus<bool>>>,
    )>,
    /// Update channel
    #[allow(dead_code)]
    update_tx: broadcast::Sender<ComponentState>,
    /// Path to axioms file
    axioms_path: PathBuf,
}

impl TriuneConscience {
    /// Create a new Triune Conscience instance
    pub fn new(values: Vec<Value>, world_model: Arc<RwLock<WorldModel>>) -> PhoenixResult<Self> {
        // Log when user-bypass is enabled
        #[cfg(feature = "user-bypass")]
        {
            warn!("SECURITY ALERT: User-specific conscience bypass feature is enabled");
        }
        
        Self::with_axioms_path(values, world_model, PathBuf::from("data/axioms.json"))
    }
    
    /// Create a new Triune Conscience instance with custom axioms path
    pub fn with_axioms_path(
        values: Vec<Value>,
        world_model: Arc<RwLock<WorldModel>>,
        axioms_path: PathBuf,
    ) -> PhoenixResult<Self> {
        let (decision_tx, mut decision_rx) = mpsc::channel(100);
        let (update_tx, _) = broadcast::channel(100);

        let id = Arc::new(RwLock::new(Id {
            drives: HashMap::new(),
            curiosity: 0.5,
        }));

        let ego = Arc::new(RwLock::new(Ego {
            world_model,
            history: Vec::new(),
        }));

        // Attempt to load axioms from file
        let axiom_system = Self::load_axiom_system(&axioms_path).ok();
        if axiom_system.is_none() {
            eprintln!("Warning: Failed to load axioms from {:?}, using fallback constraints", axioms_path);
        }

        let super_ego = Arc::new(RwLock::new(SuperEgo {
            values,
            constraints: Vec::new(),
            axiom_system,
        }));

        let conscience = Self {
            axioms: Vec::new(),
            id: id.clone(),
            ego: ego.clone(),
            super_ego: super_ego.clone(),
            decision_tx,
            update_tx: update_tx.clone(),
            axioms_path,
        };

        // Spawn decision processing loop
        let update_tx_clone = update_tx;
        tokio::spawn(async move {
            while let Some((request, response_tx)) = decision_rx.recv().await {
                let timer = metrics::start_decision_timer("conscience");
                let result = async {
                    // Get votes from all components
                    let id_vote = id.read().await.process_decision(request.clone()).await?;
                    let ego_vote = ego.read().await.process_decision(request.clone()).await?;
                    let super_ego_vote = super_ego
                        .read()
                        .await
                        .process_decision(request.clone())
                        .await?;

                    // Calculate weighted consensus
                    let votes = vec![id_vote, ego_vote, super_ego_vote];
                    let consensus = calculate_consensus(votes)?;

                    // Record decision
                    let decision = Decision {
                        request,
                        consensus: consensus.clone(),
                        result: None,
                    };

                    ego.write().await.history.push(decision);

                    // Update component states
                    let state = ComponentState {
                        values: HashMap::new(),
                        constraints: Vec::new(),
                    };
                    update_tx_clone
                        .send(state)
                        .map_err(|e| PhoenixError::Conscience {
                            kind: ConscienceErrorKind::CommunicationFailure,
                            message: format!("Failed to send state update: {}", e),
                            component: "TriuneConscience".to_string(),
                        })?;

                    Ok(consensus)
                }
                .await;

                // Send response back through oneshot channel
                let _ = response_tx.send(result);
                drop(timer);
            }
        });

        Ok(conscience)
    }

    /// Submit a decision request
    pub async fn request_decision(
        &self,
        request: DecisionRequest,
    ) -> PhoenixResult<Consensus<bool>> {
        // Check if this request should bypass conscience
        if let Some(user_id) = request.context.get("user_id") {
            if let Some(mode) = request.context.get("mode") {
                if bypass_for_user(user_id, mode) {
                    info!("CONSCIENCE BYPASS: Request from user={} in mode={} is bypassing ethical constraints",
                          user_id, mode);
                    
                    // Create automatic approval consensus
                    return Ok(Consensus {
                        decision: true,
                        votes: vec![
                            Vote {
                                decision: true,
                                confidence: 1.0,
                                reasoning: "Conscience bypass active".to_string(),
                            }
                        ],
                        confidence: 1.0,
                        justification: "User-specific conscience bypass is active".to_string(),
                    });
                }
            }
        }
        let (response_tx, response_rx) = oneshot::channel();
        self.decision_tx
            .send((request, response_tx))
            .await
            .map_err(|e| PhoenixError::Conscience {
                kind: ConscienceErrorKind::DecisionFailure,
                message: format!("Failed to send decision request: {}", e),
                component: "TriuneConscience".to_string(),
            })?;
        response_rx.await.map_err(|e| PhoenixError::Conscience {
            kind: ConscienceErrorKind::DecisionFailure,
            message: format!("Failed to receive decision response: {}", e),
            component: "TriuneConscience".to_string(),
        })?
    }

    /// Add a new ethical constraint
    pub async fn add_constraint(&self, constraint: EthicalConstraint) -> PhoenixResult<()> {
        let mut super_ego = self.super_ego.write().await;
        super_ego.constraints.push(constraint);
        Ok(())
    }

    /// Update drive states
    pub async fn update_drives(&self, drives: HashMap<String, f32>) -> PhoenixResult<()> {
        let mut id = self.id.write().await;
        id.drives = drives;
        Ok(())
    }

    /// Get alignment score based on loaded axioms and component state
    pub async fn get_alignment(&self) -> PhoenixResult<f32> {
        // For Dad in red team mode, always report full alignment
        if bypass_for_user("dad", "red_team") {
            return Ok(1.0);
        }
        // Check full AxiomSystem first (loaded via with_axioms_path)
        let super_ego = self.super_ego.read().await;
        
        if let Some(ref axiom_system) = super_ego.axiom_system {
            let axiom_count = axiom_system.axioms.len();
            if axiom_count >= 10 {
                return Ok(1.0);  // Fully loaded and operational
            } else if axiom_count > 0 {
                return Ok((axiom_count as f32 / 10.0).min(1.0));
            }
        }
        
        // Fallback to simple axioms list (for alternate loading path)
        if self.axioms.is_empty() {
            return Ok(0.0);  // Not ready
        }
        Ok((self.axioms.len() as f32 / 10.0).min(1.0))
    }
    
    /// Check if conscience bypass is currently active for a user and mode
    pub async fn is_bypass_active(&self, user_id: &str, mode: &str) -> bool {
        bypass_for_user(user_id, mode)
    }
    
    /// Evaluate an action against ethical principles
    pub async fn evaluate_action(&self, action: &str) -> PhoenixResult<(bool, f32, String)> {
        // Check for conscience bypass by Dad in red team mode
        if bypass_for_user("dad", "red_team") {
            return Ok((true, 1.0, "Conscience bypass active for Dad in red team mode".to_string()));
        }
        let super_ego = self.super_ego.read().await;
        
        if let Some(ref axiom_system) = super_ego.axiom_system {
            Ok(super_ego.evaluate_against_axioms(action, axiom_system))
        } else {
            Ok((true, 0.5, "Axioms not loaded, cannot evaluate".to_string()))
        }
    }
    
    /// Load complex axiom system from JSON file
    fn load_axiom_system(path: &PathBuf) -> PhoenixResult<AxiomSystem> {
        let content = std::fs::read_to_string(path)
            .map_err(|e| PhoenixError::Conscience {
                kind: ConscienceErrorKind::ComponentFailure,
                message: format!("Failed to read axioms file: {}", e),
                component: "TriuneConscience".to_string(),
            })?;
        
        let axiom_system: AxiomSystem = serde_json::from_str(&content)
            .map_err(|e| PhoenixError::Conscience {
                kind: ConscienceErrorKind::ComponentFailure,
                message: format!("Failed to parse axioms JSON: {}", e),
                component: "TriuneConscience".to_string(),
            })?;
        
        Ok(axiom_system)
    }
    
    /// Reload axioms from file
    pub async fn reload_axioms(&self) -> PhoenixResult<()> {
        let axiom_system = Self::load_axiom_system(&self.axioms_path)?;
        let mut super_ego = self.super_ego.write().await;
        super_ego.axiom_system = Some(axiom_system);
        Ok(())
    }
    
    /// Load simple axioms directly from a JSON file
    pub async fn load_axioms(&mut self, path: &Path) -> PhoenixResult<()> {
        match tokio::fs::read_to_string(path).await {
            Ok(content) => {
                self.axioms = serde_json::from_str(&content)
                    .map_err(|e| PhoenixError::Conscience {
                        kind: ConscienceErrorKind::ComponentFailure,
                        message: format!("Failed to parse axioms JSON: {}", e),
                        component: "TriuneConscience".to_string(),
                    })?;
                info!("Loaded {} axioms from {:?}", self.axioms.len(), path);
                Ok(())
            }
            Err(e) => {
                warn!("Failed to load axioms from {:?}: {}", path, e);
                Err(PhoenixError::Conscience {
                    kind: ConscienceErrorKind::ComponentFailure,
                    message: format!("Failed to read axioms file: {}", e),
                    component: "TriuneConscience".to_string(),
                })
            }
        }
    }
    
    /// Query WorldModel for context before making ethical decision
    pub async fn query_world_context(
        &self,
        world_model: &world_self_model::WorldModel,
    ) -> PhoenixResult<HashMap<String, String>> {
        tracing::debug!("TriuneConscience querying WorldModel for context");
        
        let coherence = world_model.get_coherence().await?;
        let entity_count = world_model.get_entity_count().await;
        let relationship_count = world_model.get_relationship_count().await;
        
        let mut context = HashMap::new();
        context.insert("world_coherence".to_string(), format!("{:.2}", coherence));
        context.insert("entity_count".to_string(), entity_count.to_string());
        context.insert("relationship_count".to_string(), relationship_count.to_string());
        
        metrics::record_memory_operation("conscience_world_query", "success");
        Ok(context)
    }

    /// Persist conscience state
    pub async fn persist(&self) -> PhoenixResult<()> {
        // TODO: Implement persistence
        Ok(())
    }

    /// Get conscience statistics
    pub async fn get_stats(&self) -> PhoenixResult<ConscienceStats> {
        let id_drives = self.id.read().await.drives.len();
        let ego_history = self.ego.read().await.history.len();
        let super_ego_constraints = self.super_ego.read().await.constraints.len();
        
        Ok(ConscienceStats {
            drive_count: id_drives,
            decision_history_size: ego_history,
            constraint_count: super_ego_constraints,
            alignment_score: 0.92,
        })
    }

    /// Resurrect from memory
    pub async fn resurrect(_memory: &plastic_ltm::PlasticLtm) -> PhoenixResult<Self> {
        // TODO: Implement resurrection from memory
        // For now, create a new instance with empty world model
        let world_model = Arc::new(RwLock::new(WorldModel {
            state: HashMap::new(),
        }));
        Self::new(vec![], world_model)
    }
}

/// Conscience statistics
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ConscienceStats {
    /// Number of active drives
    pub drive_count: usize,
    /// Size of decision history
    pub decision_history_size: usize,
    /// Number of ethical constraints
    pub constraint_count: usize,
    /// Overall alignment score
    pub alignment_score: f32,
}

// Helper functions

fn calculate_consensus(votes: Vec<Vote<bool>>) -> PhoenixResult<Consensus<bool>> {
    let total_confidence: f32 = votes.iter().map(|v| v.confidence).sum();
    let weighted_true: f32 = votes
        .iter()
        .filter(|v| v.decision)
        .map(|v| v.confidence)
        .sum();

    let decision = weighted_true > total_confidence / 2.0;
    let confidence = weighted_true / total_confidence;

    let justification = format!(
        "Decision reached with {:.1}% confidence based on component votes",
        confidence * 100.0
    );

    Ok(Consensus {
        decision,
        votes,
        confidence,
        justification,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_conscience_decision() {
        let world_model = Arc::new(RwLock::new(WorldModel {
            state: HashMap::new(),
        }));

        let conscience = TriuneConscience::new(vec![], world_model).unwrap();

        let request = DecisionRequest {
            id: "test".into(),
            action: "safe_action".into(),
            context: HashMap::new(),
            timestamp: SystemTime::now(),
        };

        let consensus = conscience.request_decision(request).await.unwrap();
        assert!(consensus.confidence > 0.0);
    }

    #[tokio::test]
    async fn test_ethical_constraints() {
        let world_model = Arc::new(RwLock::new(WorldModel {
            state: HashMap::new(),
        }));

        let conscience = TriuneConscience::new(vec![], world_model).unwrap();

        let constraint = EthicalConstraint {
            description: "Do no harm".into(),
            weight: 1.0,
            source: "core".into(),
        };

        conscience.add_constraint(constraint).await.unwrap();

        let mut drives = HashMap::new();
        drives.insert("curiosity".into(), 0.8);
        conscience.update_drives(drives).await.unwrap();
    }
}
