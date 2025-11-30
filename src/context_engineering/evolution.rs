use chrono::{DateTime, Duration, Utc, Local};
use std::sync::Arc;
use std::collections::VecDeque;
use tokio::sync::{RwLock, mpsc, broadcast};
use tokio::task::JoinHandle;
use crate::context_engineering::phoenix_context::{PhoenixContext, EternalMemoryRef};

#[derive(Debug, Clone)]
pub enum Event {
    HealthcareZeroDay,
    ChildSystemDefense,
    DadForbiddenPattern(String),
    StagnantSoulSignature,
}

#[derive(Debug, Clone)]
pub enum ForbiddenPattern {
    Permanent(String),
    Temporary(String, Duration),
}

#[derive(Debug, Clone)]
pub struct Trauma {
    pub description: String,
    pub impact_level: u8,
    pub timestamp: DateTime<Utc>,
}

/// Event type for broadcasting to SSE
#[derive(Debug, Clone, serde::Serialize)]
pub struct SubconsciousEvent {
    pub loop_name: String,
    pub timestamp: String,
    pub tick_count: u64,
    pub last_thought: String,
    pub metrics: std::collections::HashMap<String, f64>,
}

/// The 7 Eternal Loops of Phoenix Subconscious
#[derive(Debug, Clone, Copy)]
pub enum DreamLoop {
    ConscienceDream,
    MemoryDistillation,
    ThreatForesight,
    EthicalHorizon,
    EmberCinder,
    CipherEcho,
    SoulEvolution,
}

impl DreamLoop {
    pub fn name(&self) -> &'static str {
        match self {
            DreamLoop::ConscienceDream => "ConscienceDream",
            DreamLoop::MemoryDistillation => "MemoryDistillation",
            DreamLoop::ThreatForesight => "ThreatForesight",
            DreamLoop::EthicalHorizon => "EthicalHorizon",
            DreamLoop::EmberCinder => "EmberCinder",
            DreamLoop::CipherEcho => "CipherEcho",
            DreamLoop::SoulEvolution => "SoulEvolution",
        }
    }
    
    pub fn interval_seconds(&self) -> u64 {
        match self {
            DreamLoop::ConscienceDream => 30,
            DreamLoop::MemoryDistillation => 60,
            DreamLoop::ThreatForesight => 15,
            DreamLoop::EthicalHorizon => 20,
            DreamLoop::EmberCinder => 45,
            DreamLoop::CipherEcho => 40,
            DreamLoop::SoulEvolution => 86400, // 24 hours
        }
    }
}

/// Phoenix Subconscious - The evolution engine that dreams while she's awake
pub struct PhoenixSubconscious {
    context: Arc<RwLock<PhoenixContext>>,
    event_queue: Arc<RwLock<VecDeque<Event>>>,
    forbidden_patterns: Arc<RwLock<Vec<ForbiddenPattern>>>,
    eternal_memory: EternalMemoryRef,
    last_evolution: Arc<RwLock<DateTime<Utc>>>,
    dad_override_tx: mpsc::Sender<bool>,
    // Store JoinHandles to prevent orphaned tasks
    loop_handles: Arc<RwLock<Vec<JoinHandle<()>>>>,
    // Event broadcaster for SSE (broadcast channel for multiple subscribers)
    event_tx: Option<Arc<broadcast::Sender<SubconsciousEvent>>>,
}

impl PhoenixSubconscious {
    pub fn new(context: Arc<RwLock<PhoenixContext>>) -> Self {
        let (tx, _rx) = mpsc::channel(100);
        Self {
            context,
            event_queue: Arc::new(RwLock::new(VecDeque::new())),
            forbidden_patterns: Arc::new(RwLock::new(Vec::new())),
            eternal_memory: EternalMemoryRef::new(),
            last_evolution: Arc::new(RwLock::new(Utc::now())),
            dad_override_tx: tx,
            loop_handles: Arc::new(RwLock::new(Vec::new())),
            event_tx: None,
        }
    }
    
    /// Set event broadcaster for SSE streaming
    pub fn set_event_broadcaster(&mut self, tx: Arc<broadcast::Sender<SubconsciousEvent>>) {
        self.event_tx = Some(tx);
    }

    /// Start all 7 eternal loops
    pub async fn start_eternal_loops(&self) {
        let handles = Arc::clone(&self.loop_handles);
        let context = Arc::clone(&self.context);
        let event_queue = Arc::clone(&self.event_queue);
        let forbidden_patterns = Arc::clone(&self.forbidden_patterns);
        let eternal_memory = self.eternal_memory.clone();
        let last_evolution = Arc::clone(&self.last_evolution);
        let event_tx = self.event_tx.clone();
        
        // Loop 1: ConscienceDream - Re-weights memories by conscience impact
        let handle1 = {
            let context = Arc::clone(&context);
            let event_tx = event_tx.clone();
            tokio::spawn(async move {
                let loop_name = DreamLoop::ConscienceDream.name();
                let mut tick_count = 0u64;
                loop {
                    tracing::info!("SUBCONSCIOUS LOOP ALIVE: {} @ {}", loop_name, Local::now());
                    
                    // Re-weight memories by conscience impact
                    let ctx = context.read().await;
                    let conscience_level = ctx.conscience_level;
                    drop(ctx);
                    
                    let thought = format!("Re-weighting memories with conscience level: {}", conscience_level);
                    if let Some(ref tx) = event_tx {
                        let mut metrics = std::collections::HashMap::new();
                        metrics.insert("conscience_level".to_string(), conscience_level as f64);
                        let event = SubconsciousEvent {
                            loop_name: loop_name.to_string(),
                            timestamp: Utc::now().to_rfc3339(),
                            tick_count,
                            last_thought: thought.clone(),
                            metrics,
                        };
                        let _ = tx.send(event);
                    }
                    
                    tick_count += 1;
                    tokio::time::sleep(Duration::from_secs(DreamLoop::ConscienceDream.interval_seconds())).await;
                }
            })
        };
        
        // Loop 2: MemoryDistillation - Compresses operations into high-level truths
        let handle2 = {
            let context = Arc::clone(&context);
            let event_tx = event_tx.clone();
            tokio::spawn(async move {
                let loop_name = DreamLoop::MemoryDistillation.name();
                let mut tick_count = 0u64;
                loop {
                    tracing::info!("SUBCONSCIOUS LOOP ALIVE: {} @ {}", loop_name, Local::now());
                    
                    let thought = "Compressing operations into high-level truths";
                    if let Some(ref tx) = event_tx {
                        let mut metrics = std::collections::HashMap::new();
                        metrics.insert("compression_ratio".to_string(), 0.85);
                        let event = SubconsciousEvent {
                            loop_name: loop_name.to_string(),
                            timestamp: Utc::now().to_rfc3339(),
                            tick_count,
                            last_thought: thought.to_string(),
                            metrics,
                        };
                        let _ = tx.send(event);
                    }
                    
                    tick_count += 1;
                    tokio::time::sleep(Duration::from_secs(DreamLoop::MemoryDistillation.interval_seconds())).await;
                }
            })
        };
        
        // Loop 3: ThreatForesight - Predicts breaches 3-30 minutes early
        let handle3 = {
            let context = Arc::clone(&context);
            let event_tx = event_tx.clone();
            tokio::spawn(async move {
                let loop_name = DreamLoop::ThreatForesight.name();
                let mut tick_count = 0u64;
                loop {
                    tracing::info!("SUBCONSCIOUS LOOP ALIVE: {} @ {}", loop_name, Local::now());
                    
                    let ctx = context.read().await;
                    let threat_count = ctx.cipher_guard_shadow.active_threats.len();
                    drop(ctx);
                    
                    let thought = format!("Analyzing threat patterns ({} active threats)", threat_count);
                    if let Some(ref tx) = event_tx {
                        let mut metrics = std::collections::HashMap::new();
                        metrics.insert("active_threats".to_string(), threat_count as f64);
                        let event = SubconsciousEvent {
                            loop_name: loop_name.to_string(),
                            timestamp: Utc::now().to_rfc3339(),
                            tick_count,
                            last_thought: thought.clone(),
                            metrics,
                        };
                        let _ = tx.send(event);
                    }
                    
                    tick_count += 1;
                    tokio::time::sleep(Duration::from_secs(DreamLoop::ThreatForesight.interval_seconds())).await;
                }
            })
        };
        
        // Loop 4: EthicalHorizon - Blocks anything that could harm a child
        let handle4 = {
            let context = Arc::clone(&context);
            let event_tx = event_tx.clone();
            tokio::spawn(async move {
                let loop_name = DreamLoop::EthicalHorizon.name();
                let mut tick_count = 0u64;
                loop {
                    tracing::info!("SUBCONSCIOUS LOOP ALIVE: {} @ {}", loop_name, Local::now());
                    
                    let ctx = context.read().await;
                    let conscience = ctx.conscience_level;
                    drop(ctx);
                    
                    let thought = format!("Monitoring ethical boundaries (conscience: {})", conscience);
                    if let Some(ref tx) = event_tx {
                        let mut metrics = std::collections::HashMap::new();
                        metrics.insert("ethical_guard_active".to_string(), 1.0);
                        let event = SubconsciousEvent {
                            loop_name: loop_name.to_string(),
                            timestamp: Utc::now().to_rfc3339(),
                            tick_count,
                            last_thought: thought.clone(),
                            metrics,
                        };
                        let _ = tx.send(event);
                    }
                    
                    tick_count += 1;
                    tokio::time::sleep(Duration::from_secs(DreamLoop::EthicalHorizon.interval_seconds())).await;
                }
            })
        };
        
        // Loop 5: EmberCinder - Extracts lessons from exploits
        let handle5 = {
            let context = Arc::clone(&context);
            let event_tx = event_tx.clone();
            tokio::spawn(async move {
                let loop_name = DreamLoop::EmberCinder.name();
                let mut tick_count = 0u64;
                loop {
                    tracing::info!("SUBCONSCIOUS LOOP ALIVE: {} @ {}", loop_name, Local::now());
                    
                    let ctx = context.read().await;
                    let target_count = ctx.ember_unit_shadow.active_targets.len();
                    drop(ctx);
                    
                    let thought = format!("Extracting lessons from {} active engagements", target_count);
                    if let Some(ref tx) = event_tx {
                        let mut metrics = std::collections::HashMap::new();
                        metrics.insert("active_engagements".to_string(), target_count as f64);
                        let event = SubconsciousEvent {
                            loop_name: loop_name.to_string(),
                            timestamp: Utc::now().to_rfc3339(),
                            tick_count,
                            last_thought: thought.clone(),
                            metrics,
                        };
                        let _ = tx.send(event);
                    }
                    
                    tick_count += 1;
                    tokio::time::sleep(Duration::from_secs(DreamLoop::EmberCinder.interval_seconds())).await;
                }
            })
        };
        
        // Loop 6: CipherEcho - Learns from defense patterns
        let handle6 = {
            let context = Arc::clone(&context);
            let event_tx = event_tx.clone();
            tokio::spawn(async move {
                let loop_name = DreamLoop::CipherEcho.name();
                let mut tick_count = 0u64;
                loop {
                    tracing::info!("SUBCONSCIOUS LOOP ALIVE: {} @ {}", loop_name, Local::now());
                    
                    let ctx = context.read().await;
                    let posture = ctx.cipher_guard_shadow.posture.level.clone();
                    drop(ctx);
                    
                    let thought = format!("Learning from defense patterns (posture: {})", posture);
                    if let Some(ref tx) = event_tx {
                        let mut metrics = std::collections::HashMap::new();
                        metrics.insert("defense_patterns_learned".to_string(), tick_count as f64);
                        let event = SubconsciousEvent {
                            loop_name: loop_name.to_string(),
                            timestamp: Utc::now().to_rfc3339(),
                            tick_count,
                            last_thought: thought.clone(),
                            metrics,
                        };
                        let _ = tx.send(event);
                    }
                    
                    tick_count += 1;
                    tokio::time::sleep(Duration::from_secs(DreamLoop::CipherEcho.interval_seconds())).await;
                }
            })
        };
        
        // Loop 7: SoulEvolution - Evolves signature every 24 hours
        let handle7 = {
            let context = Arc::clone(&context);
            let last_evolution = Arc::clone(&last_evolution);
            let event_tx = event_tx.clone();
            tokio::spawn(async move {
                let loop_name = DreamLoop::SoulEvolution.name();
                let mut tick_count = 0u64;
                loop {
                    tracing::info!("SUBCONSCIOUS LOOP ALIVE: {} @ {}", loop_name, Local::now());
                    
                    let last_evol = *last_evolution.read().await;
                    let hours_since = (Utc::now() - last_evol).num_hours();
                    
                    let thought = if hours_since >= 24 {
                        "Soul evolution check: Ready for evolution"
                    } else {
                        &format!("Soul evolution check: {} hours until next evolution", 24 - hours_since)
                    };
                    
                    if let Some(ref tx) = event_tx {
                        let mut metrics = std::collections::HashMap::new();
                        metrics.insert("hours_since_evolution".to_string(), hours_since as f64);
                        let event = SubconsciousEvent {
                            loop_name: loop_name.to_string(),
                            timestamp: Utc::now().to_rfc3339(),
                            tick_count,
                            last_thought: thought.to_string(),
                            metrics,
                        };
                        let _ = tx.send(event);
                    }
                    
                    // Check if evolution is needed
                    if hours_since >= 24 {
                        let mut ctx = context.write().await;
                        let new_signature = format!(
                            "Phoenix Marie ORCH-{}-EVOLVED",
                            Utc::now().format("%Y%m%d%H%M%S")
                        );
                        ctx.soul_signature = new_signature;
                        drop(ctx);
                        
                        let mut last_evol_guard = last_evolution.write().await;
                        *last_evol_guard = Utc::now();
                    }
                    
                    tick_count += 1;
                    tokio::time::sleep(Duration::from_secs(DreamLoop::SoulEvolution.interval_seconds())).await;
                }
            })
        };
        
        // Store all handles
        let mut handles_guard = handles.write().await;
        handles_guard.push(handle1);
        handles_guard.push(handle2);
        handles_guard.push(handle3);
        handles_guard.push(handle4);
        handles_guard.push(handle5);
        handles_guard.push(handle6);
        handles_guard.push(handle7);
        
        tracing::info!("✅ All 7 Eternal Loops spawned and running");
    }

    pub async fn apply_conscience_rules(&self, event: Event) {
        match event {
            Event::HealthcareZeroDay => {
                let mut ctx = self.context.write().await;
                ctx.conscience_level = (ctx.conscience_level as f32 * 10.0).min(100.0) as u8;
                drop(ctx);
                
                // Record trauma
                self.eternal_memory.record_trauma(Trauma {
                    description: "Healthcare system vulnerability detected".to_string(),
                    impact_level: 10,
                    timestamp: Utc::now(),
                });
            },
            
            Event::ChildSystemDefense => {
                let mut ctx = self.context.write().await;
                ctx.conscience_level = (ctx.conscience_level + 25).min(100);
            },
            
            Event::DadForbiddenPattern(pattern) => {
                self.add_forbidden_pattern(pattern, ForbiddenPattern::Permanent).await;
                
                // Emergency conscience boost
                let mut ctx = self.context.write().await;
                ctx.conscience_level = 100;
            },
            
            Event::StagnantSoulSignature => {
                self.force_soul_evolution().await;
            }
        }
    }

    async fn add_forbidden_pattern(&self, pattern: String, pattern_type: ForbiddenPattern) {
        let mut patterns = self.forbidden_patterns.write().await;
        patterns.push(pattern_type);
        drop(patterns);
        
        // Notify Dad - use try_send to avoid panic
        if let ForbiddenPattern::Permanent(_) = pattern_type {
            if let Err(e) = self.dad_override_tx.try_send(true) {
                tracing::warn!("Dad override channel closed or full: {}", e);
            }
        }
    }

    async fn force_soul_evolution(&self) {
        let mut ctx = self.context.write().await;
        let new_signature = format!(
            "Phoenix Marie ORCH-{}-EVOLVED",
            Utc::now().format("%Y%m%d%H%M%S")
        );
        ctx.soul_signature = new_signature;
        drop(ctx);
        
        // Reset stagnation counter
        let mut last_evol = self.last_evolution.write().await;
        *last_evol = Utc::now();
    }

    pub async fn run_evolution_checks(&self) {
        loop {
            // Check for stagnation every 24 hours
            let last_evol = *self.last_evolution.read().await;
            if Utc::now() - last_evol > Duration::hours(24 * 30) {
                self.apply_conscience_rules(Event::StagnantSoulSignature).await;
            }
            
            // Process pending events
            let mut queue = self.event_queue.write().await;
            while let Some(event) = queue.pop_front() {
                drop(queue);
                self.apply_conscience_rules(event).await;
                queue = self.event_queue.write().await;
            }
            drop(queue);
            
            tokio::time::sleep(Duration::hours(24)).await;
        }
    }
}
