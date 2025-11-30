use serde::{Deserialize, Serialize};

#[derive(Clone, Debug)]
pub struct EmberShadowView {
    pub active_targets: Vec<String>,
    pub confidence: u8
}

#[derive(Clone, Debug)]
pub struct CipherShadowView {
    pub active_threats: Vec<String>,
    pub posture: Posture
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PhoenixContext {
    pub user_intent: String,
    pub conscience_level: u8,
    pub active_mission: Option<Mission>,
    pub ember_unit_shadow: EmberShadowView,      // Read-only for Cipher
    pub cipher_guard_shadow: CipherShadowView,   // Read-only for Ember
    pub eternal_memory: EternalMemoryRef,
    pub current_tools: Vec<ToolManifest>,
    pub hitm_pending: Vec<HITMRequest>,
    pub soul_signature: String,                  // "Phoenix Marie ORCH-0"
}