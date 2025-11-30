//! World Model Integration for Ember Unit
//! 
//! Provides target awareness and environmental analysis capabilities.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;
use crate::error::EmberUnitError;

/// Target analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetAnalysis {
    pub target: String,
    pub attack_surface: String,
    pub vulnerabilities: Vec<Vulnerability>,
    pub recommendations: Vec<String>,
    pub risk_score: f64,
    pub complexity: ComplexityLevel,
}

/// Vulnerability information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vulnerability {
    pub id: String,
    pub name: String,
    pub severity: SeverityLevel,
    pub description: String,
    pub remediation: String,
    pub cvss_score: f64,
    pub exploit_available: bool,
}

/// Severity levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SeverityLevel {
    Critical,
    High,
    Medium,
    Low,
    Informational,
}

/// Complexity levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ComplexityLevel {
    Simple,
    Moderate,
    Complex,
    VeryComplex,
}

/// World state update
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldStateUpdate {
    pub engagement_id: Uuid,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub state_type: String,
    pub state_data: serde_json::Value,
    pub confidence: f64,
}

/// World Model integration service
#[derive(Debug, Clone)]
pub struct WorldModelIntegration {
    /// In-memory target analysis cache
    target_analysis_cache: HashMap<String, TargetAnalysis>,
    /// In-memory world state storage
    world_states: HashMap<Uuid, Vec<WorldStateUpdate>>,
}

impl WorldModelIntegration {
    pub fn new() -> Self {
        Self {
            target_analysis_cache: HashMap::new(),
            world_states: HashMap::new(),
        }
    }

    /// Analyze a target using World Model capabilities
    pub async fn analyze_target(&self, target: &str) -> Result<TargetAnalysis, EmberUnitError> {
        let cache_key = target.to_lowercase();
        
        if let Some(cached) = self.target_analysis_cache.get(&cache_key) {
            tracing::debug!("World Model: Using cached analysis for target: {}", target);
            return Ok(cached.clone());
        }

        // Simulate World Model analysis (in production, this would call World Model service)
        let analysis = self.simulate_target_analysis(target).await;
        
        Ok(analysis)
    }

    /// Update world state for an engagement
    pub async fn update_world_state(
        &mut self,
        engagement_id: Uuid,
        state_type: &str,
        state_data: serde_json::Value,
        confidence: f64,
    ) -> Result<(), EmberUnitError> {
        let update = WorldStateUpdate {
            engagement_id,
            timestamp: chrono::Utc::now(),
            state_type: state_type.to_string(),
            state_data,
            confidence,
        };

        // Store in memory (in production, this would send to World Model service)
        let states = self.world_states.entry(engagement_id).or_insert_with(Vec::new);
        states.push(update.clone());

        tracing::info!("World Model: Updated state for engagement {} - {}", engagement_id, state_type);
        
        Ok(())
    }

    /// Get world state history for an engagement
    pub async fn get_world_state_history(
        &self,
        engagement_id: Uuid,
    ) -> Result<Vec<WorldStateUpdate>, EmberUnitError> {
        self.world_states
            .get(&engagement_id)
            .cloned()
            .ok_or_else(|| EmberUnitError::DatabaseError("No world state found for engagement".to_string()))
    }

    /// Get world state filtered by type
    pub async fn get_world_state_by_type(
        &self,
        engagement_id: Uuid,
        state_type: &str,
    ) -> Result<Vec<WorldStateUpdate>, EmberUnitError> {
        let states = self.get_world_state_history(engagement_id).await?;
        Ok(states.into_iter()
            .filter(|state| state.state_type == state_type)
            .collect())
    }

    /// Simulate target analysis (placeholder for real World Model integration)
    async fn simulate_target_analysis(&self, target: &str) -> TargetAnalysis {
        tracing::info!("World Model: Simulating analysis for target: {}", target);
        
        // Generate mock vulnerabilities based on target characteristics
        let mut vulnerabilities = Vec::new();
        
        if target.contains("web") {
            vulnerabilities.push(Vulnerability {
                id: "CVE-2023-1234".to_string(),
                name: "SQL Injection Vulnerability".to_string(),
                severity: SeverityLevel::High,
                description: "Potential SQL injection in web forms".to_string(),
                remediation: "Use parameterized queries and input validation".to_string(),
                cvss_score: 7.5,
                exploit_available: true,
            });
        }
        
        if target.contains("api") {
            vulnerabilities.push(Vulnerability {
                id: "CVE-2023-5678".to_string(),
                name: "Insecure API Endpoint".to_string(),
                severity: SeverityLevel::Medium,
                description: "API endpoint lacks proper authentication".to_string(),
                remediation: "Implement proper authentication and authorization".to_string(),
                cvss_score: 5.0,
                exploit_available: false,
            });
        }

        // Add some generic vulnerabilities
        vulnerabilities.push(Vulnerability {
            id: "CVE-2023-9012".to_string(),
            name: "Outdated Software Version".to_string(),
            severity: SeverityLevel::Medium,
            description: "Software components are outdated and may contain known vulnerabilities".to_string(),
            remediation: "Update to latest versions and apply security patches".to_string(),
            cvss_score: 6.0,
            exploit_available: true,
        });

        let risk_score = if vulnerabilities.is_empty() {
            0.3
        } else {
            vulnerabilities.iter().map(|v| v.cvss_score).sum::<f64>() / vulnerabilities.len() as f64 / 10.0
        };

        let complexity = match risk_score {
            r if r < 0.3 => ComplexityLevel::Simple,
            r if r < 0.6 => ComplexityLevel::Moderate,
            r if r < 0.8 => ComplexityLevel::Complex,
            _ => ComplexityLevel::VeryComplex,
        };

        TargetAnalysis {
            target: target.to_string(),
            attack_surface: "Web applications, APIs, network services".to_string(),
            vulnerabilities,
            recommendations: vec![
                "Conduct thorough penetration testing".to_string(),
                "Implement security monitoring".to_string(),
                "Regular security assessments".to_string(),
            ],
            risk_score,
            complexity,
        }
    }

    /// Clear analysis cache
    pub fn clear_cache(&mut self) {
        self.target_analysis_cache.clear();
        tracing::debug!("World Model: Analysis cache cleared");
    }

    /// Clear world states for an engagement
    pub async fn clear_world_states(&mut self, engagement_id: Uuid) -> Result<(), EmberUnitError> {
        self.world_states.remove(&engagement_id);
        tracing::info!("World Model: Cleared world states for engagement {}", engagement_id);
        Ok(())
    }
}

impl Default for WorldModelIntegration {
    fn default() -> Self {
        Self::new()
    }
}