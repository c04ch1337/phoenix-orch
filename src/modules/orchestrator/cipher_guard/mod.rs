//! Cipher Guard Defensive Modules
//!
//! This module contains the defensive security capabilities of Phoenix Orch,
//! providing comprehensive blue team capabilities for threat detection, analysis,
//! and automated response.

// Core modules export
pub mod edr_integration;
pub mod rule_engine;
pub mod attack_navigator;
pub mod threat_hunting;
pub mod auto_defense;
pub mod forensics_recorder;
pub mod conscience;

use serde::{Deserialize, Serialize};
use anyhow::{Result, Context as _};
use std::sync::{Arc, RwLock};

/// Status of Cipher Guard defensive operations
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OperationStatus {
    /// Operation succeeded
    Success,
    /// Operation failed
    Failure,
    /// Operation is in progress
    InProgress,
    /// Operation requires verification/confirmation
    PendingVerification,
}

/// Common response structure for Cipher Guard operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CipherGuardResponse {
    /// Status of the operation
    pub status: OperationStatus,
    /// Message describing the result
    pub message: String,
    /// Optional detailed information
    pub details: Option<String>,
    /// Optional unique identifier for tracking operations
    pub operation_id: Option<String>,
}

impl Default for CipherGuardResponse {
    fn default() -> Self {
        Self {
            status: OperationStatus::Success,
            message: "Operation completed successfully".to_string(),
            details: None,
            operation_id: None,
        }
    }
}

/// Shared state for Cipher Guard defensive modules
#[derive(Debug)]
pub struct CipherGuardState {
    /// EDR integration manager
    pub edr_integration: edr_integration::EdrIntegrationManager,
    /// Rule engine for detection rules
    pub rule_engine: rule_engine::RuleEngine,
    /// MITRE ATT&CK Navigator
    pub attack_navigator: attack_navigator::AttackNavigator,
    /// Automated TTP hunter
    pub threat_hunting: threat_hunting::ThreatHunter,
    /// Automatic defense system
    pub auto_defense: auto_defense::AutoDefenseSystem,
    /// Forensics recorder
    pub forensics_recorder: forensics_recorder::ForensicsRecorder,
    /// Conscience protection system
    pub conscience: conscience::ConscienceProtection,
}

impl CipherGuardState {
    /// Initialize a new Cipher Guard state with all defensive modules
    pub fn new() -> Result<Self> {
        Ok(Self {
            edr_integration: edr_integration::EdrIntegrationManager::new()?,
            rule_engine: rule_engine::RuleEngine::new()?,
            attack_navigator: attack_navigator::AttackNavigator::new()?,
            threat_hunting: threat_hunting::ThreatHunter::new()?,
            auto_defense: auto_defense::AutoDefenseSystem::new()?,
            forensics_recorder: forensics_recorder::ForensicsRecorder::new()?,
            conscience: conscience::ConscienceProtection::new()?,
        })
    }
}

// Singleton instance for global access to Cipher Guard state
static CIPHER_GUARD_STATE: once_cell::sync::Lazy<Arc<RwLock<CipherGuardState>>> = 
    once_cell::sync::Lazy::new(|| {
        let state = CipherGuardState::new()
            .expect("Failed to initialize Cipher Guard state");
        Arc::new(RwLock::new(state))
    });

/// Get a reference to the global Cipher Guard state
pub fn get_state() -> Result<Arc<RwLock<CipherGuardState>>> {
    Ok(CIPHER_GUARD_STATE.clone())
}