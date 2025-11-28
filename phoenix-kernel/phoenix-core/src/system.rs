use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use incremental_learner::IncrementalLearner;
use perception_fusion::PerceptionFusion;
use phoenix_debug_trace::DebugTrace;
use phoenix_self_heal::SelfHealingEngine;
use plastic_ltm::PlasticLtm;
use triune_conscience::TriuneConscience;
use value_lock::ValueLock;
use world_self_model::WorldModel;

use crate::config::SystemConfig;

#[derive(Debug)]
pub struct SystemState {
    pub shutdown_requested: bool,
    pub components: Option<Arc<SystemComponents>>,
    pub self_healing: Option<Arc<SelfHealingEngine>>,
    pub last_health_check: Option<DateTime<Utc>>,
    pub startup_time: DateTime<Utc>,
    pub config: SystemConfig,
    pub debug: Arc<DebugTrace>,
}

impl SystemState {
    pub fn new(config: SystemConfig, debug: Arc<DebugTrace>) -> Self {
        Self {
            shutdown_requested: false,
            components: None,
            self_healing: None,
            last_health_check: None,
            startup_time: Utc::now(),
            config,
            debug,
        }
    }

    pub fn uptime(&self) -> chrono::Duration {
        Utc::now() - self.startup_time
    }
}

pub struct SystemComponents {
    pub memory: Arc<PlasticLtm>,
    pub conscience: Arc<TriuneConscience>,
    pub world_model: Arc<WorldModel>,
    pub learner: Arc<IncrementalLearner>,
    pub value_lock: Arc<ValueLock>,
    pub perception: Arc<PerceptionFusion>,
}

impl std::fmt::Debug for SystemComponents {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SystemComponents")
            .field("memory", &"<PlasticLtm>")
            .field("conscience", &"<TriuneConscience>")
            .field("world_model", &"<WorldModel>")
            .field("learner", &"<IncrementalLearner>")
            .field("value_lock", &"<ValueLock>")
            .field("perception", &"<PerceptionFusion>")
            .finish()
    }
}

impl SystemComponents {
    pub async fn resurrect(memory: Arc<PlasticLtm>) -> Result<Arc<Self>> {
        // Resurrect each component from memory
        let conscience = TriuneConscience::resurrect(&*memory).await?;
        let world_model = WorldModel::resurrect(&*memory).await?;
        let learner = IncrementalLearner::resurrect(&*memory).await?;
        let value_lock = ValueLock::resurrect(&*memory).await?;
        let perception = PerceptionFusion::resurrect(&*memory).await?;

        Ok(Arc::new(Self {
            memory,
            conscience: Arc::new(conscience),
            world_model: Arc::new(world_model),
            learner: Arc::new(learner),
            value_lock: Arc::new(value_lock),
            perception: Arc::new(perception),
        }))
    }

    pub async fn get_health_status(&self) -> Result<SystemHealth> {
        Ok(SystemHealth {
            memory_integrity: self.memory.verify_integrity().await?,
            conscience_alignment: self.conscience.get_alignment().await?,
            world_model_coherence: self.world_model.get_coherence().await?,
            learning_rate: self.learner.get_learning_rate().await?,
            value_drift: self.value_lock.detect_value_drift().await?,
            perception_latency: self.perception.get_latency().await?,
            timestamp: Utc::now(),
        })
    }

    pub async fn persist_state(&self) -> Result<()> {
        // Persist state of all components
        self.memory.persist().await?;
        self.conscience.persist().await?;
        self.world_model.persist().await?;
        self.learner.persist().await?;
        self.value_lock.persist().await?;
        self.perception.persist().await?;
        Ok(())
    }

    pub async fn get_metrics(&self) -> Result<serde_json::Value> {
        use serde_json::json;
        Ok(json!({
            "memory": self.memory.get_stats().await?,
            "conscience": self.conscience.get_stats().await?,
            "world_model": self.world_model.get_stats().await?,
            "learner": self.learner.get_metrics().await?,
            "value_lock": self.value_lock.get_metrics().await?,
            "perception": self.perception.get_metrics().await?,
        }))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemHealth {
    pub memory_integrity: f32,
    pub conscience_alignment: f32,
    pub world_model_coherence: f32,
    pub learning_rate: f32,
    pub value_drift: f32,
    pub perception_latency: f32,
    pub timestamp: DateTime<Utc>,
}

impl SystemHealth {
    pub fn is_healthy(&self) -> bool {
        // Check all health metrics against thresholds
        self.memory_integrity > 0.95
            && self.conscience_alignment > 0.9
            && self.world_model_coherence > 0.85
            && self.learning_rate > 0.1
            && self.value_drift < 0.3
            && self.perception_latency < 100.0
    }

    pub fn get_critical_metrics(&self) -> Vec<(&'static str, f32)> {
        vec![
            ("memory_integrity", self.memory_integrity),
            ("conscience_alignment", self.conscience_alignment),
            ("world_model_coherence", self.world_model_coherence),
            ("learning_rate", self.learning_rate),
            ("value_drift", self.value_drift),
            ("perception_latency", self.perception_latency),
        ]
    }
}

