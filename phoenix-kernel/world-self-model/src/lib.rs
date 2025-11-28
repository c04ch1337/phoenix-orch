//! World and Self Model for the Phoenix AGI Kernel
//!
//! This crate implements a hierarchical representation of the external world
//! and Phoenix's own internal state. In the resurrection profile we provide a
//! lightweight, pure-Rust implementation that keeps all types and APIs stable
//! while stubbing out heavy ML dependencies. This allows the kernel to compile
//! and exercise high-level flows without requiring GPU, HTM engines, or large
//! model files.

#![forbid(unsafe_code)]
#![deny(missing_docs)]

use phoenix_common::{
    error::PhoenixResult,
    metrics,
    types::{Event, PhoenixId, SensorReading},
};

use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant, SystemTime},
};
use serde_json::Value;
use tch::{nn, Device, Tensor};
use tokio::sync::RwLock;

/// Core world and self model implementation.
///
/// This struct maintains:
/// - A coarse-grained "HTM-like" temporal memory stub
/// - A transformer-like sequence predictor stub
/// - A snapshot of the current world state
/// - A model of Phoenix's own weights, values, and trajectories
#[derive(Debug)]
pub struct WorldModel {
    /// Real-time self state tracking
    self_state: HashMap<String, Value>,
    /// Real-time world state tracking
    world_state: HashMap<String, Value>,
    /// Last state update timestamp
    last_update: Instant,
    /// Hierarchical temporal memory stub
    htm: Arc<RwLock<HtmStub>>,
    /// Transformer-like sequence predictor
    transformer: Arc<RwLock<TransformerModel>>,
    /// Current world state
    state: Arc<RwLock<WorldState>>,
    /// Self model
    self_model: Arc<RwLock<SelfModel>>,
}

/// Lightweight replacement for the original HTM integration.
///
/// The original design depended on an external `htm` crate. For resurrection
/// we keep a minimal internal structure that tracks basic activation statistics
/// over time so that higher-level code can still reason about "temporal memory"
/// without pulling in heavy dependencies.
#[derive(Debug, Default)]
struct HtmStub {
    /// Total number of updates processed
    updates: u64,
    /// Rolling average of input magnitude
    average_magnitude: f32,
}

/// Transformer-like model for sequence prediction.
///
/// In the original design this wrapped a full transformer implemented with
/// `tch` and external tokenizers. The current implementation uses the local
/// stubbed `tch` crate and ignores actual model weights, producing a simple
/// deterministic embedding instead. This keeps the API shape intact while
/// remaining fully pure-Rust and dependency-light.
#[derive(Debug)]
struct TransformerModel {
    /// Stubbed neural network module
    #[allow(dead_code)]
    model: nn::Module,
    /// Dimensionality of the latent representation
    hidden_size: i64,
}

/// Current world state
#[derive(Debug, Clone)]
pub struct WorldState {
    /// Observed entities
    pub entities: HashMap<PhoenixId, Entity>,
    /// Current relationships
    pub relationships: Vec<Relationship>,
    /// Active processes
    pub processes: Vec<Process>,
    /// Timestamp
    pub timestamp: SystemTime,
    /// State hash for consistency checking
    pub state_hash: Option<[u8; 32]>,
}

/// Self model tracking Phoenix's own state
#[derive(Debug, Clone)]
pub struct SelfModel {
    /// Current weights (logical labels to scalar magnitudes)
    weights: HashMap<String, f32>,
    /// Active values
    values: HashMap<String, f32>,
    /// Memory indices
    memories: Vec<PhoenixId>,
    /// Predicted trajectories
    trajectories: Vec<Trajectory>,
    /// Consistency check timestamp
    last_consistency_check: Option<SystemTime>,
}

/// An entity in the world model
#[derive(Debug, Clone)]
struct Entity {
    /// Entity ID
    #[allow(dead_code)]
    id: PhoenixId,
    /// Entity type
    #[allow(dead_code)]
    type_: String,
    /// Properties
    #[allow(dead_code)]
    properties: HashMap<String, String>,
    /// State history
    #[allow(dead_code)]
    history: Vec<EntityState>,
}

/// A relationship between entities
#[derive(Debug, Clone)]
struct Relationship {
    /// Source entity
    #[allow(dead_code)]
    source: PhoenixId,
    /// Target entity
    #[allow(dead_code)]
    target: PhoenixId,
    /// Relationship type
    #[allow(dead_code)]
    type_: String,
    /// Properties
    #[allow(dead_code)]
    properties: HashMap<String, String>,
}

/// An active process
#[derive(Debug, Clone)]
struct Process {
    /// Process ID
    #[allow(dead_code)]
    id: PhoenixId,
    /// Process type
    #[allow(dead_code)]
    type_: String,
    /// Current state
    #[allow(dead_code)]
    state: String,
    /// Involved entities
    #[allow(dead_code)]
    entities: Vec<PhoenixId>,
}

/// Entity state at a point in time
#[derive(Debug, Clone)]
struct EntityState {
    /// State properties
    #[allow(dead_code)]
    properties: HashMap<String, String>,
    /// Timestamp
    #[allow(dead_code)]
    timestamp: SystemTime,
}

/// Predicted future trajectory
#[derive(Debug, Clone)]
pub struct Trajectory {
    /// Starting state
    #[allow(dead_code)]
    start: WorldState,
    /// Predicted states
    #[allow(dead_code)]
    states: Vec<WorldState>,
    /// Confidence scores
    #[allow(dead_code)]
    confidence: Vec<f32>,
    /// Time horizon
    #[allow(dead_code)]
    horizon: Duration,
}

impl HtmStub {
    /// Create a new HTM stub instance.
    fn new() -> Self {
        Self {
            updates: 0,
            average_magnitude: 0.0,
        }
    }

    /// Update temporal memory statistics from a new observation.
    fn update(&mut self, observation: &[f32]) {
        self.updates += 1;
        let magnitude: f32 =
            observation.iter().map(|v| v.abs()).sum::<f32>() / observation.len().max(1) as f32;
        // Simple exponential moving average to keep things stable.
        let alpha = 0.1;
        self.average_magnitude = if self.updates == 1 {
            magnitude
        } else {
            (1.0 - alpha) * self.average_magnitude + alpha * magnitude
        };
    }
}

impl TransformerModel {
    /// Create a new transformer-like model backed by the `tch` stub.
    ///
    /// The `device` parameter is accepted for API parity but is not used by the
    /// stub implementation.
    fn new(_device: Device, hidden_size: i64) -> Self {
        Self {
            model: nn::Module,
            hidden_size,
        }
    }

    /// Produce a simple latent embedding for the given input tensor.
    ///
    /// The current implementation ignores learned weights and instead projects
    /// the input into a fixed-size latent space by either truncating or
    /// repeating elements to match `hidden_size`.
    fn forward(&self, input: &Tensor) -> Tensor {
        // In the stub, we treat the input tensor as a single element and
        // project it to the desired hidden size by repeating it.
        let mut projected = vec![0.0; self.hidden_size as usize];
        let input_data = input.data();
        if !input_data.is_empty() {
            for i in 0..self.hidden_size as usize {
                projected[i] = input_data[i % input_data.len()];
            }
        }
        Tensor::from_slice(&projected)
    }
}

impl WorldModel {
    /// Create a new world and self model.
    ///
    /// This constructor initializes:
    /// - The HTM stub
    /// - A transformer stub with a 1024-dimensional latent size
    /// - An empty world state
    /// - An empty self model
    pub async fn new() -> PhoenixResult<Self> {
        // Initialize HTM stub
        let htm = HtmStub::new();

        // Initialize transformer stub
        let device = Device::cuda_if_available();
        let transformer = TransformerModel::new(device, 1024);

        // Initialize state
        let state = WorldState {
            entities: HashMap::new(),
            relationships: Vec::new(),
            processes: Vec::new(),
            timestamp: SystemTime::now(),
            state_hash: None,
        };

        // Initialize self model
        let self_model = SelfModel {
            weights: HashMap::new(),
            values: HashMap::new(),
            memories: Vec::new(),
            trajectories: Vec::new(),
            last_consistency_check: Some(SystemTime::now()),
        };

        Ok(Self {
            self_state: HashMap::new(),
            world_state: HashMap::new(),
            last_update: Instant::now(),
            htm: Arc::new(RwLock::new(htm)),
            transformer: Arc::new(RwLock::new(transformer)),
            state: Arc::new(RwLock::new(state)),
            self_model: Arc::new(RwLock::new(self_model)),
        })
    }

    /// Update model with new observation.
    ///
    /// The current implementation:
    /// - Updates the HTM stub statistics
    /// - Produces a latent embedding via the transformer stub
    /// - Records a shallow world-state update
    /// - Updates the self-model with a simple confidence metric
    pub async fn update(&self, event: Event<SensorReading<Vec<f32>>>) -> PhoenixResult<()> {
        let timer = metrics::start_perception_timer("world_model");

        // Update HTM stub
        {
            let mut htm = self.htm.write().await;
            htm.update(&event.data.data);
        }

        // Prepare transformer input and run stubbed forward pass
        let prediction = {
            let transformer = self.transformer.read().await;
            let input = self.prepare_transformer_input(&event).await?;
            transformer.forward(&input)
        };

        // Update state
        {
            let mut state = self.state.write().await;
            self.update_world_state_internal(&mut state, &event, &prediction).await?;
        }

        // Update self model
        {
            let state = self.state.read().await;
            let mut self_model = self.self_model.write().await;
            self.update_self_model(&mut self_model, &state).await?;
        }

        // Record metrics
        metrics::record_training_progress("world_model", self.calculate_progress().await?);

        drop(timer);
        Ok(())
    }

    /// Get current world state.
    pub async fn get_state(&self) -> PhoenixResult<WorldState> {
        Ok(self.state.read().await.clone())
    }
    
    /// Get entity count
    pub async fn get_entity_count(&self) -> usize {
        self.state.read().await.entities.len()
    }
    
    /// Get relationship count
    pub async fn get_relationship_count(&self) -> usize {
        self.state.read().await.relationships.len()
    }
    
    /// Get process count
    pub async fn get_process_count(&self) -> usize {
        self.state.read().await.processes.len()
    }

    /// Get self model.
    pub async fn get_self_model(&self) -> PhoenixResult<SelfModel> {
        Ok(self.self_model.read().await.clone())
    }

    /// Predict future trajectories over a given horizon.
    ///
    /// This stub implementation:
    /// - Generates a single synthetic trajectory starting from the current state
    /// - Reuses the current state for future steps
    /// - Assigns monotonically decreasing confidence scores
    pub async fn predict_trajectories(&self, horizon: Duration) -> PhoenixResult<Vec<Trajectory>> {
        let state = self.state.read().await.clone();

        let mut states = Vec::new();
        let mut confidences = Vec::new();

        // Generate a simple sequence of future states at 10-minute intervals.
        let steps = 10usize;
        for i in 0..steps {
            let mut next_state = state.clone();
            // Advance the timestamp deterministically
            next_state.timestamp = state
                .timestamp
                .checked_add(Duration::from_secs(600 * i as u64))
                .unwrap_or(state.timestamp);

            states.push(next_state);
            confidences.push(0.9 / (1.0 + i as f32 * 0.1));
        }

        let trajectory = Trajectory {
            start: state.clone(),
            states,
            confidence: confidences,
            horizon,
        };

        Ok(vec![trajectory])
    }

    /// Update self state with a new key-value pair
    pub fn update_state(&mut self, key: String, value: Value) {
        self.self_state.insert(key, value);
        self.last_update = Instant::now();
    }
    
    /// Update world state with a new key-value pair
    pub fn update_world_state(&mut self, key: String, value: Value) {
        self.world_state.insert(key, value);
        self.last_update = Instant::now();
    }

    // Private helper methods

    /// Prepare transformer input tensor from an observation event.
    async fn prepare_transformer_input(
        &self,
        event: &Event<SensorReading<Vec<f32>>>,
    ) -> PhoenixResult<Tensor> {
        // Directly convert the sensor vector into a tensor using the stub.
        Ok(Tensor::from_slice(&event.data.data))
    }

    /// Update world state based on the latest event and latent prediction.
    async fn update_world_state_internal(
        &self,
        state: &mut WorldState,
        event: &Event<SensorReading<Vec<f32>>>,
        _prediction: &Tensor,
    ) -> PhoenixResult<()> {
        // Update timestamp
        state.timestamp = event.timestamp;
        
        // Recalculate state hash for consistency tracking
        state.state_hash = Some(self.calculate_state_hash(state));
        
        Ok(())
    }

    /// Update the self-model based on the current world state.
    async fn update_self_model(
        &self,
        self_model: &mut SelfModel,
        state: &WorldState,
    ) -> PhoenixResult<()> {
        // Track a simple "world update" counter as a proxy for learning progress.
        let counter = self_model
            .values
            .entry("world_updates".to_string())
            .or_insert(0.0);
        *counter += 1.0;

        // Track the most recent timestamp observed.
        self_model.values.insert(
            "last_update_seconds".to_string(),
            to_unix_seconds(state.timestamp),
        );

        Ok(())
    }

    /// Calculate a coarse progress metric for world-model training.
    async fn calculate_progress(&self) -> PhoenixResult<f64> {
        let self_model = self.self_model.read().await;
        let progress = self_model
            .values
            .get("world_updates")
            .copied()
            .unwrap_or(0.0);

        // Normalize via a simple saturating function so the metric stays in [0, 1].
        Ok(1.0 - (1.0 / (1.0 + (progress as f64) / 100.0)))
    }

    /// Get model coherence score by checking internal state consistency
    pub async fn get_coherence(&self) -> PhoenixResult<f32> {
        // Quick check: if we have no state, return 0.0
        let total = self.self_state.len() + self.world_state.len();
        if total == 0 {
            return Ok(0.0);  // Not initialized yet
        }
        
        let state = self.state.read().await;
        let self_model = self.self_model.read().await;
        
        let mut coherence_factors = Vec::new();
        
        // 1. Check temporal consistency (recent updates)
        let time_since_update = match SystemTime::now().duration_since(state.timestamp) {
            Ok(duration) => duration.as_secs_f32(),
            Err(_) => {
                // Future timestamp is inconsistent
                return Ok(0.3);
            }
        };
        let temporal_coherence = if time_since_update < 60.0 {
            1.0 // Very recent
        } else if time_since_update < 3600.0 {
            0.8 // Within last hour
        } else {
            0.5 // Stale
        };
        coherence_factors.push(temporal_coherence);
        
        // 2. Check state hash consistency
        let hash_coherence = if state.state_hash.is_some() {
            let current_hash = self.calculate_state_hash(&state);
            if state.state_hash == Some(current_hash) {
                1.0 // Hash matches
            } else {
                0.7 // Hash mismatch indicates state drift
            }
        } else {
            0.5 // No hash recorded
        };
        coherence_factors.push(hash_coherence);
        
        // 3. Check entity-relationship consistency
        let entity_ids: std::collections::HashSet<_> = state.entities.keys().cloned().collect();
        let mut valid_relationships = 0;
        let mut invalid_relationships = 0;
        
        for rel in &state.relationships {
            if entity_ids.contains(&rel.source) && entity_ids.contains(&rel.target) {
                valid_relationships += 1;
            } else {
                invalid_relationships += 1;
            }
        }
        
        let relationship_coherence = if state.relationships.is_empty() {
            1.0 // No relationships to check
        } else {
            valid_relationships as f32 / (valid_relationships + invalid_relationships) as f32
        };
        coherence_factors.push(relationship_coherence);
        
        // 4. Check process-entity consistency
        let mut valid_process_refs = 0;
        let mut invalid_process_refs = 0;
        
        for process in &state.processes {
            for entity_id in &process.entities {
                if entity_ids.contains(entity_id) {
                    valid_process_refs += 1;
                } else {
                    invalid_process_refs += 1;
                }
            }
        }
        
        let process_coherence = if valid_process_refs + invalid_process_refs == 0 {
            1.0 // No process references to check
        } else {
            valid_process_refs as f32 / (valid_process_refs + invalid_process_refs) as f32
        };
        coherence_factors.push(process_coherence);
        
        // 5. Check self-model consistency
        let self_coherence = if let Some(last_check) = self_model.last_consistency_check {
            match SystemTime::now().duration_since(last_check) {
                Ok(duration) => {
                    if duration.as_secs() < 300 {
                        1.0 // Recently checked
                    } else {
                        0.8 // Needs refresh
                    }
                }
                Err(_) => 0.5, // Time inconsistency
            }
        } else {
            0.5 // Never checked
        };
        coherence_factors.push(self_coherence);
        
        // 6. Check value consistency (no NaN or infinite values)
        let value_coherence = if self_model.values.values().all(|v| v.is_finite()) {
            1.0
        } else {
            0.2 // Corrupted values
        };
        coherence_factors.push(value_coherence);
        
        // Calculate weighted average
        let total_coherence: f32 = coherence_factors.iter().sum();
        let coherence = total_coherence / coherence_factors.len() as f32;
        
        // Record coherence check
        drop(state);
        drop(self_model);
        let mut self_model_mut = self.self_model.write().await;
        self_model_mut.last_consistency_check = Some(SystemTime::now());
        
        Ok(coherence)
    }
    
    /// Calculate hash of world state for consistency checking
    fn calculate_state_hash(&self, state: &WorldState) -> [u8; 32] {
        use sha3::{Digest, Sha3_256};
        
        let mut hasher = Sha3_256::new();
        
        // Hash entity count
        hasher.update(&(state.entities.len() as u64).to_le_bytes());
        
        // Hash relationship count
        hasher.update(&(state.relationships.len() as u64).to_le_bytes());
        
        // Hash process count
        hasher.update(&(state.processes.len() as u64).to_le_bytes());
        
        // Hash timestamp
        if let Ok(duration) = state.timestamp.duration_since(SystemTime::UNIX_EPOCH) {
            hasher.update(&duration.as_secs().to_le_bytes());
        }
        
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&hasher.finalize());
        hash
    }
    
    /// Detect contradictions in the model
    pub async fn detect_contradictions(&self) -> PhoenixResult<Vec<String>> {
        let state = self.state.read().await;
        let self_model = self.self_model.read().await;
        let mut contradictions = Vec::new();
        
        // Check for orphaned relationships
        let entity_ids: std::collections::HashSet<_> = state.entities.keys().cloned().collect();
        for rel in &state.relationships {
            if !entity_ids.contains(&rel.source) {
                contradictions.push(format!("Relationship references non-existent source entity"));
            }
            if !entity_ids.contains(&rel.target) {
                contradictions.push(format!("Relationship references non-existent target entity"));
            }
        }
        
        // Check for invalid self-model values
        for (key, value) in &self_model.values {
            if !value.is_finite() {
                contradictions.push(format!("Self-model value '{}' is not finite: {}", key, value));
            }
        }
        
        // Check for future timestamps (temporal contradiction)
        if let Err(_) = SystemTime::now().duration_since(state.timestamp) {
            contradictions.push("World state timestamp is in the future".to_string());
        }
        
        Ok(contradictions)
    }

    /// Persist model state
    pub async fn persist(&self) -> PhoenixResult<()> {
        // TODO: Implement persistence
        Ok(())
    }
    
    /// Update model based on memories from PlasticLTM
    pub async fn update_from_memories(
        &self,
        memory: &plastic_ltm::PlasticLtm,
    ) -> PhoenixResult<usize> {
        tracing::debug!("WorldModel updating from PlasticLTM memories");
        
        let memory_ids = memory.retrieve_all_ids().await?;
        let mut updates_applied = 0;
        
        // Update self-model with memory count
        let mut self_model = self.self_model.write().await;
        self_model.memories = memory_ids.clone();
        self_model.values.insert(
            "memory_count".to_string(),
            memory_ids.len() as f32,
        );
        updates_applied += 1;
        
        // Mark consistency check time
        self_model.last_consistency_check = Some(SystemTime::now());
        
        drop(self_model);
        
        // Update world state timestamp
        let mut state = self.state.write().await;
        state.timestamp = SystemTime::now();
        state.state_hash = Some(self.calculate_state_hash(&state));
        
        metrics::record_memory_operation("world_model_memory_sync", "success");
        tracing::debug!(
            "WorldModel synchronized {} memories from PlasticLTM",
            memory_ids.len()
        );
        
        Ok(updates_applied)
    }

    /// Get model statistics
    pub async fn get_stats(&self) -> PhoenixResult<WorldModelStats> {
        let state = self.state.read().await;
        let self_model = self.self_model.read().await;
        
        Ok(WorldModelStats {
            entity_count: state.entities.len(),
            relationship_count: state.relationships.len(),
            process_count: state.processes.len(),
            self_value_count: self_model.values.len(),
            coherence_score: 0.88,
        })
    }

    /// Resurrect from memory
    pub async fn resurrect(_memory: &plastic_ltm::PlasticLtm) -> PhoenixResult<Self> {
        // TODO: Implement resurrection from memory
        // For now, create a new instance
        Self::new().await
    }
}

/// World model statistics
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WorldModelStats {
    /// Number of tracked entities
    pub entity_count: usize,
    /// Number of relationships
    pub relationship_count: usize,
    /// Number of active processes
    pub process_count: usize,
    /// Number of self values
    pub self_value_count: usize,
    /// Model coherence score
    pub coherence_score: f32,
}

/// Convert a `SystemTime` to seconds since UNIX epoch, clamping on error.
fn to_unix_seconds(time: SystemTime) -> f32 {
    match time.duration_since(SystemTime::UNIX_EPOCH) {
        Ok(d) => d.as_secs_f32(),
        Err(_) => 0.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_world_model_update() {
        let model = WorldModel::new().await.unwrap();

        let event = Event {
            id: PhoenixId([0; 32]),
            timestamp: SystemTime::now(),
            data: SensorReading {
                data: vec![0.0; 1024],
                confidence: 1.0,
                metadata: HashMap::new(),
                timestamp: SystemTime::now(),
            },
            metadata: HashMap::new(),
        };

        model.update(event).await.unwrap();

        let state = model.get_state().await.unwrap();
        assert!(state.entities.is_empty());
    }

    #[tokio::test]
    async fn test_trajectory_prediction() {
        let model = WorldModel::new().await.unwrap();

        let trajectories = model
            .predict_trajectories(Duration::from_secs(3_600))
            .await
            .unwrap();

        assert!(!trajectories.is_empty());
        assert!(!trajectories[0].confidence.is_empty());
        assert!(trajectories[0].confidence[0] > 0.5);
    }
}
