//! Test Helpers for OrchestratorAgent
//!
//! This module provides helper functions and test implementations for testing
//! OrchestratorAgent functionality.

use std::sync::Arc;
use crate::modules::orchestrator::{
    OrchestratorAgent,
    conscience::{ConscienceGate, HITM},
};

impl OrchestratorAgent {
    /// Creates a test instance of the OrchestratorAgent
    pub fn new_test_instance() -> Self {
        // Create minimal test configuration
        Self::new_test_instance_with_mock_drives(vec![])
    }
    
    /// Creates a test instance with mock drives for testing
    pub fn new_test_instance_with_mock_drives(_mock_drives: Vec<serde_json::Value>) -> Self {
        // For testing purposes, we create a minimal OrchestratorAgent
        // In a real implementation, this would configure mock drive responses
        
        // Create a default tool registry
        let tools = Default::default();
        
        // Create test instances of conscience components
        let conscience_gate = Arc::new(ConscienceGate::new_test_instance());
        let hitm = Arc::new(HITM::new_test_instance());
        
        Self {
            tools,
            conscience_gate,
            hitm,
        }
    }
}

// Define test implementations for required components
impl ConscienceGate {
    /// Creates a test instance with default approvals
    pub fn new_test_instance() -> Self {
        Self::default()
    }
}

impl HITM {
    /// Creates a test instance with default settings
    pub fn new_test_instance() -> Self {
        Self::default()
    }
}

// Implement default traits for test components
impl Default for ConscienceGate {
    fn default() -> Self {
        // Create a minimal conscience gate for testing
        Self {
            trace_enabled: false,
            // Add other fields as needed based on the actual struct
            // but with minimal configuration for testing
        }
    }
}

impl Default for HITM {
    fn default() -> Self {
        // Create a minimal HITM for testing
        Self {
            // Add fields based on the actual struct 
            // but with minimal configuration for testing
        }
    }
}