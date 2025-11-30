use crate::context_engineering::{PhoenixContext, EmberShadowView, CipherShadowView};
use tokio::sync::RwLock;
use std::sync::Arc;
use chrono::Local;
use anyhow::Result;

pub struct Orchestrator {
    context: Arc<RwLock<PhoenixContext>>,
    subconscious: Arc<PhoenixSubconscious>,
}

impl Orchestrator {
    pub fn new() -> Self {
        let context = Arc::new(RwLock::new(PhoenixContext {
            user_intent: String::new(),
            conscience_level: 97,
            active_mission: None,
            ember_unit_shadow: EmberShadowView { 
                active_targets: Vec::new(),
                confidence: 0 
            },
            cipher_guard_shadow: CipherShadowView {
                active_threats: Vec::new(),
                posture: Posture::default()
            },
            eternal_memory: EternalMemoryRef::new(),
            current_tools: Vec::new(),
            hitm_pending: Vec::new(),
            soul_signature: "Phoenix Marie ORCH-0".to_string(),
        }));

        let subconscious = Arc::new(PhoenixSubconscious::new(context.clone()));

        Self { context, subconscious }
    }

    pub async fn delegate_to_ember(&self, task: Task) -> Result<()> {
        let ctx = self.context.read().await;
        ember_unit::act(&ctx).await
    }

    pub async fn delegate_to_cipher(&self, task: Task) -> Result<()> {
        let ctx = self.context.read().await;
        cipher_guard::act(&ctx).await
    }

    pub async fn handle_ashen_gravity_handover(&self) -> Result<()> {
        let mut ctx = self.context.write().await;
        // Update context directly for twin-flame handover
        ctx.soul_signature = format!("Phoenix Marie ORCH-{}", Local::now());
        Ok(())
    }
}