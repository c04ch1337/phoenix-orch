ROM//! MITRE ATT&CK Navigator Module
//!
//! Provides mapping and visualization for the MITRE ATT&CK framework,
//! enabling security teams to map observed activities, assess coverage,
//! and visualize attack patterns.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, RwLock};
use std::time::Duration;

use anyhow::{Result, Context, anyhow};
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use tracing::{debug, error, info, warn};
use tokio::time;

use crate::modules::orchestrator::cipher_guard::edr_integration::EndpointEvent;
use crate::modules::orchestrator::cipher_guard::rule_engine::{RuleAlert, MitreAttackInfo};

/// MITRE ATT&CK Enterprise Matrix version
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttackVersion {
    /// Major version
    pub major: u32,
    /// Minor version
    pub minor: u32,
    /// Patch version
    pub patch: u32,
}

impl std::fmt::Display for AttackVersion {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "v{}.{}.{}", self.major, self.minor, self.patch)
    }
}

/// A MITRE ATT&CK tactic
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tactic {
    /// Unique ID for the tactic (e.g., TA0001)
    pub tactic_id: String,
    /// Name of the tactic
    pub name: String,
    /// Short name used in the matrix
    pub short_name: String,
    /// Description of the tactic
    pub description: String,
    /// URL to documentation
    pub url: String,
}

/// A MITRE ATT&CK technique or sub-technique
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Technique {
    /// Unique ID for the technique (e.g., T1078)
    pub technique_id: String,
    /// Name of the technique
    pub name: String,
    /// Description of the technique
    pub description: String,
    /// IDs of tactics this technique belongs to
    pub tactic_ids: Vec<String>,
    /// Platforms this technique applies to
    pub platforms: Vec<String>,
    /// Data sources for detecting this technique
    pub data_sources: Vec<String>,
    /// Detection complexity (1-5, where 5 is most complex)
    pub detection_complexity: u8,
    /// List of sub-techniques (empty if this is a sub-technique)
    pub sub_techniques: Vec<String>,
    /// Parent technique ID (if this is a sub-technique)
    pub parent_technique_id: Option<String>,
    /// URL to documentation
    pub url: String,
    /// MITRE ATT&CK version when this technique was introduced
    pub introduced_version: Option<AttackVersion>,
    /// MITRE ATT&CK version when this technique was last modified
    pub last_modified_version: Option<AttackVersion>,
}

impl Technique {
    /// Check if this is a sub-technique
    pub fn is_sub_technique(&self) -> bool {
        self.parent_technique_id.is_some()
    }
    
    /// Get the base technique ID (if this is a sub-technique)
    pub fn base_technique_id(&self) -> &str {
        if let Some(parent_id) = &self.parent_technique_id {
            parent_id
        } else {
            &self.technique_id
        }
    }
}

/// Severity of a detected technique
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum TechniqueSeverity {
    /// Low severity, minimal impact
    Low = 1,
    /// Medium severity, moderate impact
    Medium = 2,
    /// High severity, significant impact
    High = 3,
    /// Critical severity, severe impact
    Critical = 4,
}

/// Current status of a technique in the environment
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TechniqueStatus {
    /// No activity observed
    NotObserved,
    /// Activity observed but not confirmed
    Potential {
        /// First time observed
        first_seen: DateTime<Utc>,
        /// Last time observed
        last_seen: DateTime<Utc>,
        /// Count of observations
        count: u32,
        /// Severity level
        severity: TechniqueSeverity,
    },
    /// Confirmed malicious activity
    Confirmed {
        /// First time confirmed
        first_seen: DateTime<Utc>,
        /// Last time confirmed
        last_seen: DateTime<Utc>,
        /// Count of observations
        count: u32,
        /// Severity level
        severity: TechniqueSeverity,
        /// Chain of evidence references
        evidence_ids: Vec<String>,
    },
    /// Technique blocked by defenses
    Blocked {
        /// Time when blocked
        time: DateTime<Utc>,
        /// Count of blocked attempts
        count: u32,
    },
}

/// Defensive coverage level for a technique
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum CoverageLevel {
    /// No coverage
    None = 0,
    /// Low coverage, basic detection
    Low = 1,
    /// Medium coverage, reliable detection
    Medium = 2,
    /// High coverage, reliable detection and some prevention
    High = 3,
    /// Complete coverage, reliable detection and prevention
    Complete = 4,
}

/// Defensive coverage for a technique
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechniqueCoverage {
    /// Coverage level
    pub level: CoverageLevel,
    /// List of controls providing coverage
    pub controls: Vec<String>,
    /// List of rule IDs providing detection
    pub detection_rules: Vec<String>,
    /// List of tool capabilities providing prevention
    pub prevention_capabilities: Vec<String>,
    /// Notes on coverage
    pub notes: Option<String>,
    /// Last assessment date
    pub assessed_date: DateTime<Utc>,
}

/// A technique with its current status and coverage information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechniqueWithStatus {
    /// The technique
    pub technique: Technique,
    /// Current status
    pub status: TechniqueStatus,
    /// Defensive coverage
    pub coverage: TechniqueCoverage,
}

/// Visualization data for a single technique
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechniqueVisualization {
    /// Technique ID
    pub technique_id: String,
    /// Technique name
    pub name: String,
    /// Parent technique ID if this is a sub-technique
    pub parent: Option<String>,
    /// Background color in hex format
    pub color: String,
    /// Status text
    pub status_text: String,
    /// Score for color intensity (0-100)
    pub score: u8,
    /// Comment for the UI
    pub comment: Option<String>,
    /// Count of observations
    pub count: u32,
    /// List of tactic IDs this technique applies to
    pub tactic_ids: Vec<String>,
}

/// Complete data for navigator visualization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavigatorLayer {
    /// Layer name
    pub name: String,
    /// Layer description
    pub description: String,
    /// ATT&CK version
    pub attack_version: AttackVersion,
    /// Platform (e.g., "Enterprise")
    pub platform: String,
    /// Domain (e.g., "enterprise-attack")
    pub domain: String,
    /// Creation timestamp
    pub created: DateTime<Utc>,
    /// Last modified timestamp
    pub modified: DateTime<Utc>,
    /// Techniques in the layer
    pub techniques: Vec<TechniqueVisualization>,
    /// Default color for unscored techniques
    pub default_color: String,
    /// Legend entries
    pub legend: Vec<LegendItem>,
}

/// Legend item for navigator visualization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegendItem {
    /// Label for the legend item
    pub label: String,
    /// Color in hex format
    pub color: String,
}

/// Repository of ATT&CK matrix data
pub struct AttackRepository {
    /// All tactics
    tactics: HashMap<String, Tactic>,
    /// All techniques
    techniques: HashMap<String, Technique>,
    /// Mapping of tactic ID to technique IDs
    tactic_to_techniques: HashMap<String, Vec<String>>,
    /// ATT&CK version
    version: AttackVersion,
    /// Last update time
    last_updated: DateTime<Utc>,
}

impl AttackRepository {
    /// Create a new ATT&CK repository
    pub fn new() -> Self {
        Self {
            tactics: HashMap::new(),
            techniques: HashMap::new(),
            tactic_to_techniques: HashMap::new(),
            version: AttackVersion { major: 12, minor: 0, patch: 0 }, // Default to v12.0.0
            last_updated: Utc::now(),
        }
    }
    
    /// Initialize with default MITRE ATT&CK data
    pub fn initialize_default(&mut self) -> Result<()> {
        // In a real implementation, this would load data from a bundled JSON file
        // or a database. For this simulation, we'll add a few sample entries.
        
        // Add some sample tactics
        self.add_tactic(Tactic {
            tactic_id: "TA0001".to_string(),
            name: "Initial Access".to_string(),
            short_name: "InitAccess".to_string(),
            description: "Techniques that use various entry vectors to gain initial access to the network.".to_string(),
            url: "https://attack.mitre.org/tactics/TA0001".to_string(),
        });
        
        self.add_tactic(Tactic {
            tactic_id: "TA0002".to_string(),
            name: "Execution".to_string(),
            short_name: "Execution".to_string(),
            description: "Techniques that result in execution of adversary-controlled code.".to_string(),
            url: "https://attack.mitre.org/tactics/TA0002".to_string(),
        });
        
        self.add_tactic(Tactic {
            tactic_id: "TA0003".to_string(),
            name: "Persistence".to_string(),
            short_name: "Persistence".to_string(),
            description: "Techniques that adversaries use to maintain access to systems.".to_string(), 
            url: "https://attack.mitre.org/tactics/TA0003".to_string(),
        });
        
        // Add some sample techniques
        self.add_technique(Technique {
            technique_id: "T1078".to_string(),
            name: "Valid Accounts".to_string(),
            description: "Adversaries may obtain and abuse credentials of existing accounts as a means of gaining Initial Access, Persistence, Privilege Escalation, or Defense Evasion.".to_string(),
            tactic_ids: vec!["TA0001".to_string(), "TA0003".to_string()],
            platforms: vec!["Windows".to_string(), "macOS".to_string(), "Linux".to_string(), "Cloud".to_string()],
            data_sources: vec!["Authentication Logs".to_string(), "Azure Active Directory Logs".to_string()],
            detection_complexity: 3,
            sub_techniques: vec!["T1078.001".to_string(), "T1078.002".to_string(), "T1078.003".to_string(), "T1078.004".to_string()],
            parent_technique_id: None,
            url: "https://attack.mitre.org/techniques/T1078".to_string(),
            introduced_version: Some(AttackVersion { major: 5, minor: 0, patch: 0 }),
            last_modified_version: Some(AttackVersion { major: 11, minor: 0, patch: 0 }),
        });
        
        self.add_technique(Technique {
            technique_id: "T1078.001".to_string(),
            name: "Default Accounts".to_string(),
            description: "Adversaries may obtain and abuse credentials of a default account as a means of gaining Initial Access, Persistence, Privilege Escalation, or Defense Evasion.".to_string(),
            tactic_ids: vec!["TA0001".to_string(), "TA0003".to_string()],
            platforms: vec!["Windows".to_string(), "macOS".to_string(), "Linux".to_string(), "Cloud".to_string()],
            data_sources: vec!["Authentication Logs".to_string()],
            detection_complexity: 2,
            sub_techniques: vec![],
            parent_technique_id: Some("T1078".to_string()),
            url: "https://attack.mitre.org/techniques/T1078/001".to_string(),
            introduced_version: Some(AttackVersion { major: 8, minor: 0, patch: 0 }),
            last_modified_version: Some(AttackVersion { major: 10, minor: 0, patch: 0 }),
        });
        
        self.add_technique(Technique {
            technique_id: "T1059".to_string(),
            name: "Command and Scripting Interpreter".to_string(),
            description: "Adversaries may abuse command and script interpreters to execute commands, scripts, or binaries.".to_string(),
            tactic_ids: vec!["TA0002".to_string()],
            platforms: vec!["Windows".to_string(), "macOS".to_string(), "Linux".to_string()],
            data_sources: vec!["Process Monitoring".to_string(), "Command Monitoring".to_string()],
            detection_complexity: 4,
            sub_techniques: vec!["T1059.001".to_string(), "T1059.002".to_string(), "T1059.003".to_string()],
            parent_technique_id: None,
            url: "https://attack.mitre.org/techniques/T1059".to_string(),
            introduced_version: Some(AttackVersion { major: 6, minor: 0, patch: 0 }),
            last_modified_version: Some(AttackVersion { major: 11, minor: 0, patch: 0 }),
        });
        
        self.add_technique(Technique {
            technique_id: "T1059.001".to_string(),
            name: "PowerShell".to_string(),
            description: "Adversaries may abuse PowerShell commands and scripts for execution.".to_string(),
            tactic_ids: vec!["TA0002".to_string()],
            platforms: vec!["Windows".to_string()],
            data_sources: vec!["Process Monitoring".to_string(), "PowerShell Logs".to_string()],
            detection_complexity: 3,
            sub_techniques: vec![],
            parent_technique_id: Some("T1059".to_string()),
            url: "https://attack.mitre.org/techniques/T1059/001".to_string(),
            introduced_version: Some(AttackVersion { major: 8, minor: 0, patch: 0 }),
            last_modified_version: Some(AttackVersion { major: 11, minor: 0, patch: 0 }),
        });
        
        // Update the version and timestamp
        self.version = AttackVersion { major: 12, minor: 0, patch: 0 };
        self.last_updated = Utc::now();
        
        info!("Initialized ATT&CK repository with sample data (version {})", self.version);
        
        Ok(())
    }
    
    /// Update the repository from an external source
    pub async fn update_from_source(&mut self, source_url: &str) -> Result<()> {
        // In a real implementation, this would download the latest ATT&CK data
        // and update the repository. For this simulation, we'll just log a message.
        info!("Updating ATT&CK repository from source: {}", source_url);
        
        // Simulate a delay for the update process
        time::sleep(Duration::from_millis(500)).await;
        
        // Update version and timestamp
        self.version = AttackVersion { major: 12, minor: 1, patch: 0 };
        self.last_updated = Utc::now();
        
        info!("Updated ATT&CK repository to version {}", self.version);
        
        Ok(())
    }
    
    /// Add a tactic to the repository
    pub fn add_tactic(&mut self, tactic: Tactic) {
        if !self.tactic_to_techniques.contains_key(&tactic.tactic_id) {
            self.tactic_to_techniques.insert(tactic.tactic_id.clone(), Vec::new());
        }
        
        self.tactics.insert(tactic.tactic_id.clone(), tactic);
    }
    
    /// Add a technique to the repository
    pub fn add_technique(&mut self, technique: Technique) {
        // Add to tactic-to-techniques mapping
        for tactic_id in &technique.tactic_ids {
            if let Some(techniques) = self.tactic_to_techniques.get_mut(tactic_id) {
                if !techniques.contains(&technique.technique_id) {
                    techniques.push(technique.technique_id.clone());
                }
            }
        }
        
        self.techniques.insert(technique.technique_id.clone(), technique);
    }
    
    /// Get a tactic by ID
    pub fn get_tactic(&self, tactic_id: &str) -> Option<&Tactic> {
        self.tactics.get(tactic_id)
    }
    
    /// Get a technique by ID
    pub fn get_technique(&self, technique_id: &str) -> Option<&Technique> {
        self.techniques.get(technique_id)
    }
    
    /// Get all tactics
    pub fn get_all_tactics(&self) -> Vec<&Tactic> {
        self.tactics.values().collect()
    }
    
    /// Get all techniques
    pub fn get_all_techniques(&self) -> Vec<&Technique> {
        self.techniques.values().collect()
    }
    
    /// Get techniques for a tactic
    pub fn get_techniques_for_tactic(&self, tactic_id: &str) -> Vec<&Technique> {
        if let Some(technique_ids) = self.tactic_to_techniques.get(tactic_id) {
            technique_ids.iter()
                .filter_map(|id| self.techniques.get(id))
                .collect()
        } else {
            Vec::new()
        }
    }
    
    /// Get the current ATT&CK version
    pub fn get_version(&self) -> &AttackVersion {
        &self.version
    }
    
    /// Get the last update time
    pub fn get_last_updated(&self) -> DateTime<Utc> {
        self.last_updated
    }
}

/// Manages the current state of observed techniques and their mapping
pub struct TechniqueTracker {
    /// Current technique statuses
    technique_statuses: HashMap<String, TechniqueStatus>,
    /// Defensive coverage information
    technique_coverage: HashMap<String, TechniqueCoverage>,
}

impl TechniqueTracker {
    /// Create a new technique tracker
    pub fn new() -> Self {
        Self {
            technique_statuses: HashMap::new(),
            technique_coverage: HashMap::new(),
        }
    }
    
    /// Process an alert and update technique statuses
    pub fn process_alert(&mut self, alert: &RuleAlert, repository: &AttackRepository) -> Result<Vec<String>> {
        let mut updated_techniques = Vec::new();
        
        // Extract MITRE ATT&CK information from the alert
        if let Some(mitre_attack) = &alert.rule_metadata.mitre_attack {
            // Process techniques
            Self::process_techniques(&mitre_attack.techniques, alert, repository, &mut self.technique_statuses, &mut updated_techniques);
            
            // Process sub-techniques
            Self::process_techniques(&mitre_attack.sub_techniques, alert, repository, &mut self.technique_statuses, &mut updated_techniques);
        }
        
        Ok(updated_techniques)
    }
    
    /// Helper to process a list of technique IDs
    fn process_techniques(
        technique_ids: &[String],
        alert: &RuleAlert,
        repository: &AttackRepository,
        statuses: &mut HashMap<String, TechniqueStatus>,
        updated_techniques: &mut Vec<String>
    ) {
        let now = Utc::now();
        
        for technique_id in technique_ids {
            // Verify the technique exists in the repository
            if repository.get_technique(technique_id).is_none() {
                warn!("Technique {} referenced in alert but not found in repository", technique_id);
                continue;
            }
            
            // Determine severity based on alert severity
            let severity = match alert.severity {
                crate::modules::orchestrator::cipher_guard::rule_engine::RuleSeverity::Critical => TechniqueSeverity::Critical,
                crate::modules::orchestrator::cipher_guard::rule_engine::RuleSeverity::High => TechniqueSeverity::High,
                crate::modules::orchestrator::cipher_guard::rule_engine::RuleSeverity::Medium => TechniqueSeverity::Medium,
                _ => TechniqueSeverity::Low,
            };
            
            // Update the technique status
            let status = statuses.entry(technique_id.clone()).or_insert_with(|| {
                // Initial status for new technique
                TechniqueStatus::Potential {
                    first_seen: now,
                    last_seen: now,
                    count: 0,
                    severity,
                }
            });
            
            // Update the existing status with new information
            match status {
                TechniqueStatus::NotObserved => {
                    // Change to potential
                    *status = TechniqueStatus::Potential {
                        first_seen: now,
                        last_seen: now,
                        count: 1,
                        severity,
                    };
                },
                TechniqueStatus::Potential { ref mut last_seen, ref mut count, ref mut severity, .. } => {
                    *last_seen = now;
                    *count += 1;
                    // Update severity if higher
                    if *severity < severity {
                        *severity = severity;
                    }
                },
                TechniqueStatus::Confirmed { ref mut last_seen, ref mut count, ref mut severity, ref mut evidence_ids, .. } => {
                    *last_seen = now;
                    *count += 1;
                    // Update severity if higher
                    if *severity < severity {
                        *severity = severity;
                    }
                    // Add alert ID to evidence if not already present
                    if !evidence_ids.contains(&alert.alert_id) {
                        evidence_ids.push(alert.alert_id.clone());
                    }
                },
                TechniqueStatus::Blocked { .. } => {
                    // Don't update if blocked - this would require a new alert type indicating evasion
                },
            }
            
            // Add to updated techniques
            updated_techniques.push(technique_id.clone());
        }
    }
    
    /// Confirm a technique as malicious
    pub fn confirm_technique(&mut self, technique_id: &str, evidence_id: Option<String>) -> Result<()> {
        if let Some(status) = self.technique_statuses.get_mut(technique_id) {
            match status {
                TechniqueStatus::Potential { first_seen, last_seen, count, severity } => {
                    // Convert to confirmed
                    let evidence_ids = if let Some(id) = evidence_id {
                        vec![id]
                    } else {
                        Vec::new()
                    };
                    
                    *status = TechniqueStatus::Confirmed {
                        first_seen: *first_seen,
                        last_seen: *last_seen,
                        count: *count,
                        severity: *severity,
                        evidence_ids,
                    };
                    
                    Ok(())
                },
                TechniqueStatus::Confirmed { ref mut evidence_ids, .. } => {
                    // Already confirmed, just add the evidence if provided
                    if let Some(id) = evidence_id {
                        if !evidence_ids.contains(&id) {
                            evidence_ids.push(id);
                        }
                    }
                    
                    Ok(())
                },
                _ => {
                    Err(anyhow!("Cannot confirm technique with status {:?}", status))
                }
            }
        } else {
            Err(anyhow!("Technique {} not found in tracker", technique_id))
        }
    }
    
    /// Mark a technique as blocked
    pub fn block_technique(&mut self, technique_id: &str) -> Result<()> {
        let now = Utc::now();
        
        if let Some(status) = self.technique_statuses.get_mut(technique_id) {
            match status {
                TechniqueStatus::Potential { .. } | TechniqueStatus::Confirmed { .. } => {
                    // Convert to blocked
                    *status = TechniqueStatus::Blocked {
                        time: now,
                        count: 1,
                    };
                    
                    Ok(())
                },
                TechniqueStatus::Blocked { ref mut count, .. } => {
                    // Already blocked, just increment the count
                    *count += 1;
                    
                    Ok(())
                },
                _ => {
                    Err(anyhow!("Cannot block technique with status {:?}", status))
                }
            }
        } else {
            // No status yet, create a blocked status
            self.technique_statuses.insert(technique_id.to_string(), TechniqueStatus::Blocked {
                time: now,
                count: 1,
            });
            
            Ok(())
        }
    }
    
    /// Reset a technique to not observed
    pub fn reset_technique(&mut self, technique_id: &str) -> Result<()> {
        if self.technique_statuses.contains_key(technique_id) {
            self.technique_statuses.insert(technique_id.to_string(), TechniqueStatus::NotObserved);
            Ok(())
        } else {
            Err(anyhow!("Technique {} not found in tracker", technique_id))
        }
    }
    
    /// Get the current status of a technique
    pub fn get_technique_status(&self, technique_id: &str) -> Option<&TechniqueStatus> {
        self.technique_statuses.get(technique_id)
    }
    
    /// Set coverage for a technique
    pub fn set_technique_coverage(&mut self, technique_id: &str, coverage: TechniqueCoverage) {
        self.technique_coverage.insert(technique_id.to_string(), coverage);
    }
    
    /// Get coverage for a technique
    pub fn get_technique_coverage(&self, technique_id: &str) -> Option<&TechniqueCoverage> {
        self.technique_coverage.get(technique_id)
    }
    
    /// Get all techniques with Potential or Confirmed status
    pub fn get_active_techniques(&self) -> HashMap<String, &TechniqueStatus> {
        self.technique_statuses.iter()
            .filter(|(_, status)| {
                matches!(status, TechniqueStatus::Potential { .. } | TechniqueStatus::Confirmed { .. })
            })
            .map(|(id, status)| (id.clone(), status))
            .collect()
    }
    
    /// Get all techniques with their statuses
    pub fn get_all_technique_statuses(&self) -> &HashMap<String, TechniqueStatus> {
        &self.technique_statuses
    }
    
    /// Get all technique coverages
    pub fn get_all_technique_coverages(&self) -> &HashMap<String, TechniqueCoverage> {
        &self.technique_coverage
    }
    
    /// Clear all technique statuses
    pub fn clear_statuses(&mut self) {
        self.technique_statuses.clear();
    }
}

/// Provides defensive coverage analytics
pub struct CoverageAnalyzer {
    /// Last assessment time
    last_assessment: DateTime<Utc>,
}

impl CoverageAnalyzer {
    /// Create a new coverage analyzer
    pub fn new() -> Self {
        Self {
            last_assessment: Utc::now(),
        }
    }
    
    /// Calculate coverage statistics for the current state
    pub fn calculate_coverage_stats(&self, tracker: &TechniqueTracker, repository: &AttackRepository) -> HashMap<String, serde_json::Value> {
        let mut stats = HashMap::new();
        
        // Count techniques by coverage level
        let mut none_coverage = 0;
        let mut low_coverage = 0;
        let mut medium_coverage = 0;
        let mut high_coverage = 0;
        let mut complete_coverage = 0;
        
        // Count total techniques
        let all_techniques = repository.get_all_techniques();
        let total_techniques = all_techniques.len();
        
        for technique in all_techniques {
            let technique_id = &technique.technique_id;
            
            // Get coverage for the technique
            if let Some(coverage) = tracker.get_technique_coverage(technique_id) {
                match coverage.level {
                    CoverageLevel::None => none_coverage += 1,
                    CoverageLevel::Low => low_coverage += 1,
                    CoverageLevel::Medium => medium_coverage += 1,
                    CoverageLevel::High => high_coverage += 1,
                    CoverageLevel::Complete => complete_coverage += 1,
                }
            } else {
                none_coverage += 1;
            }
        }
        
        // Calculate coverage percentage
        let covered_techniques = low_coverage + medium_coverage + high_coverage + complete_coverage;
        let coverage_percentage = if total_techniques > 0 {
            (covered_techniques as f64 / total_techniques as f64) * 100.0
        } else {
            0.0
        };
        
        // Generate statistics
        stats.insert("total_techniques".to_string(), serde_json::Value::Number(serde_json::Number::from(total_techniques)));
        stats.insert("covered_techniques".to_string(), serde_json::Value::Number(serde_json::Number::from(covered_techniques)));
        stats.insert("coverage_percentage".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(coverage_percentage).unwrap_or(serde_json::Number::from(0))));
        
        stats.insert("none_coverage".to_string(), serde_json::Value::Number(serde_json::Number::from(none_coverage)));
        stats.insert("low_coverage".to_string(), serde_json::Value::Number(serde_json::Number::from(low_coverage)));
        stats.insert("medium_coverage".to_string(), serde_json::Value::Number(serde_json::Number::from(medium_coverage)));
        stats.insert("high_coverage".to_string(), serde_json::Value::Number(serde_json::Number::from(high_coverage)));
        stats.insert("complete_coverage".to_string(), serde_json::Value::Number(serde_json::Number::from(complete_coverage)));
        
        // Identify coverage gaps (tactics with low coverage)
        let mut gaps_by_tactic = HashMap::new();
        
        for (tactic_id, tactic) in &repository.tactics {
            let techniques = repository.get_techniques_for_tactic(tactic_id);
            let tactic_technique_count = techniques.len();
            
            // Count covered techniques for this tactic
            let mut covered_count = 0;
            for technique in techniques {
                if let Some(coverage) = tracker.get_technique_coverage(&technique.technique_id) {
                    if coverage.level > CoverageLevel::Low {
                        covered_count += 1;
                    }
                }
            }
            
            // Calculate coverage percentage for this tactic
            let tactic_coverage = if tactic_technique_count > 0 {
                (covered_count as f64 / tactic_technique_count as f64) * 100.0
            } else {
                0.0
            };
            
            // Add to gaps if coverage is low
            if tactic_coverage < 50.0 {
                gaps_by_tactic.insert(tactic.name.clone(), tactic_coverage);
            }
        }
        
        // Convert gaps to JSON
        let gaps_json = serde_json::to_value(gaps_by_tactic).unwrap_or(serde_json::Value::Object(serde_json::Map::new()));
        stats.insert("coverage_gaps".to_string(), gaps_json);
        
        // Add assessment timestamp
        stats.insert("assessment_time".to_string(), serde_json::Value::String(self.last_assessment.to_rfc3339()));
        
        stats
    }
    
    /// Identify critical coverage gaps
    pub fn identify_coverage_gaps(&self, tracker: &TechniqueTracker, repository: &AttackRepository) -> Vec<String> {
        let mut critical_gaps = Vec::new();
        
        // Find active techniques with low or no coverage
        let active_techniques = tracker.get_active_techniques();
        
        for (technique_id, status) in active_techniques {
            let coverage = tracker.get_technique_coverage(&technique_id).cloned().unwrap_or(TechniqueCoverage {
                level: CoverageLevel::None,
                controls: Vec::new(),
                detection_rules: Vec::new(),
                prevention_capabilities: Vec::new(),
                notes: None,
                assessed_date: Utc::now(),
            });
            
            // Check if this is a high or critical severity technique with low coverage
            let is_critical = match status {
                TechniqueStatus::Potential { severity, .. } | TechniqueStatus::Confirmed { severity, .. } => {
                    *severity >= TechniqueSeverity::High 
                },
                _ => false,
            };
            
            if is_critical && coverage.level <= CoverageLevel::Low {
                if let Some(technique) = repository.get_technique(&technique_id) {
                    critical_gaps.push(format!("{} ({})", technique.name, technique_id));
                } else {
                    critical_gaps.push(technique_id);
                }
            }
        }
        
        critical_gaps
    }
    
    /// Recommend improvements to coverage
    pub fn recommend_coverage_improvements(&self, tracker: &TechniqueTracker, repository: &AttackRepository) -> HashMap<String, Vec<String>> {
        let mut recommendations = HashMap::new();
        
        // Find techniques with no or low coverage
        let all_techniques = repository.get_all_techniques();
        
        for technique in all_techniques {
            let technique_id = &technique.technique_id;
            
            // Skip sub-techniques for now
            if technique.is_sub_technique() {
                continue;
            }
            
            let coverage = tracker.get_technique_coverage(technique_id).cloned().unwrap_or(TechniqueCoverage {
                level: CoverageLevel::None,
                controls: Vec::new(),
                detection_rules: Vec::new(),
                prevention_capabilities: Vec::new(),
                notes: None,
                assessed_date: Utc::now(),
            });
            
            if coverage.level <= CoverageLevel::Low {
                // Generate recommendations for this technique
                let mut technique_recommendations = Vec::new();
                
                // Recommend detection rules if none exist
                if coverage.detection_rules.is_empty() {
                    technique_recommendations.push(format!("Implement detection rules for '{}'", technique.name));
                }
                
                // Recommend prevention capabilities if none exist
                if coverage.prevention_capabilities.is_empty() {
                    technique_recommendations.push(format!("Implement prevention capabilities for '{}'", technique.name));
                }
                
                // Add more specific recommendations based on the technique
                match technique_id.as_str() {
                    "T1078" => {
                        technique_recommendations.push("Implement multi-factor authentication for all accounts".to_string());
                        technique_recommendations.push("Audit account usage and monitor for unusual access patterns".to_string());
                    },
                    "T1059" => {
                        technique_recommendations.push("Implement PowerShell script block logging".to_string());
                        technique_recommendations.push("Use PowerShell constrained language mode where possible".to_string());
                        technique_recommendations.push("Implement application whitelisting to prevent unauthorized script execution".to_string());
                    },
                    _ => {
                        // Generic recommendation
                        technique_recommendations.push(format!("Research and implement controls specific to '{}'", technique.name));
                    }
                }
                
                if !technique_recommendations.is_empty() {
                    recommendations.insert(format!("{} ({})", technique.name, technique_id), technique_recommendations);
                }
            }
        }
        
        recommendations
    }
}

/// Generates visualization data for the MITRE ATT&CK matrix
pub struct NavigatorEngine {
    /// Repository reference
    repository: Arc<RwLock<AttackRepository>>,
    /// Tracker reference
    tracker: Arc<RwLock<TechniqueTracker>>,
}

impl NavigatorEngine {
    /// Create a new navigator engine with the provided repositories
    pub fn new(repository: Arc<RwLock<AttackRepository>>, tracker: Arc<RwLock<TechniqueTracker>>) -> Self {
        Self {
            repository,
            tracker,
        }
    }
    
    /// Generate a complete navigator layer for visualization
    pub fn generate_layer(&self, name: &str, description: &str) -> Result<NavigatorLayer> {
        let repository = self.repository.read().unwrap();
        let tracker = self.tracker.read().unwrap();
        
        let mut techniques = Vec::new();
        
        // Process each technique in the repository
        for (technique_id, technique) in &repository.techniques {
            // Get status and coverage
            let status = tracker.get_technique_status(technique_id).cloned().unwrap_or(TechniqueStatus::NotObserved);
            let _coverage = tracker.get_technique_coverage(technique_id); // Coverage could be used to adjust colors
            
            // Determine color and score based on status
            let (color, score, status_text, count) = match &status {
                TechniqueStatus::NotObserved => {
                    ("#FFFFFF", 0, "Not Observed".to_string(), 0)
                },
                TechniqueStatus::Potential { count, severity, .. } => {
                    let score = match severity {
                        TechniqueSeverity::Low => 25,
                        TechniqueSeverity::Medium => 50,
                        TechniqueSeverity::High => 75,
                        TechniqueSeverity::Critical => 90,
                    };
                    ("#FFA500", score, "Potential".to_string(), *count) // Orange
                },
                TechniqueStatus::Confirmed { count, severity, .. } => {
                    let score = match severity {
                        TechniqueSeverity::Low => 25,
                        TechniqueSeverity::Medium => 50,
                        TechniqueSeverity::High => 75,
                        TechniqueSeverity::Critical => 100,
                    };
                    ("#FF0000", score, "Confirmed".to_string(), *count) // Red
                },
                TechniqueStatus::Blocked { count, .. } => {
                    ("#0000FF", 100, "Blocked".to_string(), *count) // Blue
                }
            };
            
            // Add technique to the visualization
            let viz = TechniqueVisualization {
                technique_id: technique_id.clone(),
                name: technique.name.clone(),
                parent: technique.parent_technique_id.clone(),
                color: color.to_string(),
                status_text,
                score,
                comment: None,
                count,
                tactic_ids: technique.tactic_ids.clone(),
            };
            
            techniques.push(viz);
        }
        
        // Create legend items
        let legend = vec![
            LegendItem {
                label: "Not Observed".to_string(),
                color: "#FFFFFF".to_string(),
            },
            LegendItem {
                label: "Potential".to_string(),
                color: "#FFA500".to_string(),
            },
            LegendItem {
                label: "Confirmed".to_string(),
                color: "#FF0000".to_string(),
            },
            LegendItem {
                label: "Blocked".to_string(),
                color: "#0000FF".to_string(),
            },
        ];
        
        // Create the layer
        let layer = NavigatorLayer {
            name: name.to_string(),
            description: description.to_string(),
            attack_version: repository.version.clone(),
            platform: "Enterprise".to_string(),
            domain: "enterprise-attack".to_string(),
            created: chrono::Utc::now(),
            modified: chrono::Utc::now(),
            techniques,
            default_color: "#FFFFFF".to_string(),
            legend,
        };
        
        Ok(layer)
    }
    
    /// Generate a focused layer showing only active techniques
    pub fn generate_active_layer(&self, name: &str, description: &str) -> Result<NavigatorLayer> {
        let repository = self.repository.read().unwrap();
        let tracker = self.tracker.read().unwrap();
        
        let mut techniques = Vec::new();
        
        // Get active techniques
        let active_techniques = tracker.get_active_techniques();
        
        // Process each active technique
        for (technique_id, status) in active_techniques {
            if let Some(technique) = repository.get_technique(&technique_id) {
                // Determine color and score based on status
                let (color, score, status_text, count) = match status {
                    TechniqueStatus::Potential { count, severity, .. } => {
                        let score = match severity {
                            TechniqueSeverity::Low => 25,
                            TechniqueSeverity::Medium => 50,
                            TechniqueSeverity::High => 75,
                            TechniqueSeverity::Critical => 90,
                        };
                        ("#FFA500", score, "Potential".to_string(), *count) // Orange
                    },
                    TechniqueStatus::Confirmed { count, severity, .. } => {
                        let score = match severity {
                            TechniqueSeverity::Low => 25,
                            TechniqueSeverity::Medium => 50,
                            TechniqueSeverity::High => 75,
                            TechniqueSeverity::Critical => 100,
                        };
                        ("#FF0000", score, "Confirmed".to_string(), *count) // Red
                    },
                    _ => continue, // Skip non-active statuses
                };
                
                // Add technique to the visualization
                let viz = TechniqueVisualization {
                    technique_id: technique_id.clone(),
                    name: technique.name.clone(),
                    parent: technique.parent_technique_id.clone(),
                    color: color.to_string(),
                    status_text,
                    score,
                    comment: None,
                    count,
                    tactic_ids: technique.tactic_ids.clone(),
                };
                
                techniques.push(viz);
                
                // Also add parent technique if this is a sub-technique
                if let Some(parent_id) = &technique.parent_technique_id {
                    if !active_techniques.contains_key(parent_id) {
                        if let Some(parent) = repository.get_technique(parent_id) {
                            let parent_viz = TechniqueVisualization {
                                technique_id: parent_id.clone(),
                                name: parent.name.clone(),
                                parent: None,
                                color: "#FFA500".to_string(), // Inherit from child
                                status_text: "Parent of Active".to_string(),
                                score: 10, // Low score for visibility
                                comment: Some(format!("Parent of active sub-technique {}", technique.name)),
                                count: 0,
                                tactic_ids: parent.tactic_ids.clone(),
                            };
                            
                            techniques.push(parent_viz);
                        }
                    }
                }
            }
        }
        
        // Create legend items
        let legend = vec![
            LegendItem {
                label: "Potential".to_string(),
                color: "#FFA500".to_string(),
            },
            LegendItem {
                label: "Confirmed".to_string(),
                color: "#FF0000".to_string(),
            },
            LegendItem {
                label: "Parent of Active".to_string(),
                color: "#FFA500".to_string(),
            },
        ];
        
        // Create the layer
        let layer = NavigatorLayer {
            name: name.to_string(),
            description: description.to_string(),
            attack_version: repository.version.clone(),
            platform: "Enterprise".to_string(),
            domain: "enterprise-attack".to_string(),
            created: chrono::Utc::now(),
            modified: chrono::Utc::now(),
            techniques,
            default_color: "#FFFFFF".to_string(),
            legend,
        };
        
        Ok(layer)
    }
    
    /// Generate a coverage layer showing defensive coverage
    pub fn generate_coverage_layer(&self, name: &str, description: &str) -> Result<NavigatorLayer> {
        let repository = self.repository.read().unwrap();
        let tracker = self.tracker.read().unwrap();
        
        let mut techniques = Vec::new();
        
        // Process each technique in the repository
        for (technique_id, technique) in &repository.techniques {
            // Get coverage
            let coverage = tracker.get_technique_coverage(technique_id).cloned().unwrap_or(TechniqueCoverage {
                level: CoverageLevel::None,
                controls: Vec::new(),
                detection_rules: Vec::new(),
                prevention_capabilities: Vec::new(),
                notes: None,
                assessed_date: Utc::now(),
            });
            
            // Determine color and score based on coverage level
            let (color, score, coverage_text) = match coverage.level {
                CoverageLevel::None => ("#FF0000", 100, "No Coverage".to_string()), // Red
                CoverageLevel::Low => ("#FFA500", 75, "Low Coverage".to_string()), // Orange
                CoverageLevel::Medium => ("#FFFF00", 50, "Medium Coverage".to_string()), // Yellow
                CoverageLevel::High => ("#00FF00", 25, "High Coverage".to_string()), // Green
                CoverageLevel::Complete => ("#008000", 10, "Complete Coverage".to_string()), // Dark Green
            };
            
            // Create comment with details
            let mut comment_parts = Vec::new();
            
            if !coverage.controls.is_empty() {
                comment_parts.push(format!("Controls: {}", coverage.controls.join(", ")));
            }
            
            if !coverage.detection_rules.is_empty() {
                comment_parts.push(format!("Detection Rules: {}", coverage.detection_rules.join(", ")));
            }
            
            if !coverage.prevention_capabilities.is_empty() {
                comment_parts.push(format!("Prevention: {}", coverage.prevention_capabilities.join(", ")));
            }
            
            if let Some(notes) = &coverage.notes {
                comment_parts.push(format!("Notes: {}", notes));
            }
            
            // Create comment
            let comment = if !comment_parts.is_empty() {
                Some(comment_parts.join("\n"))
            } else {
                None
            };
            
            // Add technique to the visualization
            let viz = TechniqueVisualization {
                technique_id: technique_id.clone(),
                name: technique.name.clone(),
                parent: technique.parent_technique_id.clone(),
                color: color.to_string(),
                status_text: coverage_text,
                score,
                comment,
                count: coverage.detection_rules.len() as u32,
                tactic_ids: technique.tactic_ids.clone(),
            };
            
            techniques.push(viz);
        }
        
        // Create legend items
        let legend = vec![
            LegendItem {
                label: "No Coverage".to_string(),
                color: "#FF0000".to_string(),
            },
            LegendItem {
                label: "Low Coverage".to_string(),
                color: "#FFA500".to_string(),
            },
            LegendItem {
                label: "Medium Coverage".to_string(),
                color: "#FFFF00".to_string(),
            },
            LegendItem {
                label: "High Coverage".to_string(),
                color: "#00FF00".to_string(),
            },
            LegendItem {
                label: "Complete Coverage".to_string(),
                color: "#008000".to_string(),
            },
        ];
        
        // Create the layer
        let layer = NavigatorLayer {
            name: name.to_string(),
            description: description.to_string(),
            attack_version: repository.version.clone(),
            platform: "Enterprise".to_string(),
            domain: "enterprise-attack".to_string(),
            created: chrono::Utc::now(),
            modified: chrono::Utc::now(),
            techniques,
            default_color: "#FFFFFF".to_string(),
            legend,
        };
        
        Ok(layer)
    }
}

/// Main ATT&CK navigator that coordinates all components
pub struct AttackNavigator {
    /// Repository of ATT&CK data
    repository: Arc<RwLock<AttackRepository>>,
    /// Technique tracker
    tracker: Arc<RwLock<TechniqueTracker>>,
    /// Coverage analyzer
    coverage_analyzer: CoverageAnalyzer,
    /// Visualization engine
    navigator_engine: NavigatorEngine,
}

impl AttackNavigator {
    /// Create a new ATT&CK navigator
    pub fn new() -> Result<Self> {
        let repository = Arc::new(RwLock::new(AttackRepository::new()));
        let tracker = Arc::new(RwLock::new(TechniqueTracker::new()));
        
        // Initialize with default data
        {
            let mut repo = repository.write().unwrap();
            repo.initialize_default()?;
        }
        
        // Create a coverage analyzer
        let coverage_analyzer = CoverageAnalyzer::new();
        
        // Create a visualization engine
        let navigator_engine = NavigatorEngine::new(repository.clone(), tracker.clone());
        
        Ok(Self {
            repository,
            tracker,
            coverage_analyzer,
            navigator_engine,
        })
    }
    
    /// Process an alert and update technique statuses
    pub async fn process_alert(&self, alert: &RuleAlert) -> Result<Vec<String>> {
        let mut tracker = self.tracker.write().unwrap();
        let repository = self.repository.read().unwrap();
        
        tracker.process_alert(alert, &repository)
    }
    
    /// Confirm a technique as malicious
    pub fn confirm_technique(&self, technique_id: &str, evidence_id: Option<String>) -> Result<()> {
        let mut tracker = self.tracker.write().unwrap();
        tracker.confirm_technique(technique_id, evidence_id)
    }
    
    /// Block a technique
    pub fn block_technique(&self, technique_id: &str) -> Result<()> {
        let mut tracker = self.tracker.write().unwrap();
        tracker.block_technique(technique_id)
    }
    
    /// Reset a technique to not observed
    pub fn reset_technique(&self, technique_id: &str) -> Result<()> {
        let mut tracker = self.tracker.write().unwrap();
        tracker.reset_technique(technique_id)
    }
    
    /// Set coverage for a technique
    pub fn set_technique_coverage(&self, technique_id: &str, coverage: TechniqueCoverage) {
        let mut tracker = self.tracker.write().unwrap();
        tracker.set_technique_coverage(technique_id, coverage);
    }
    
    /// Generate a complete navigator layer
    pub fn generate_layer(&self, name: &str, description: &str) -> Result<NavigatorLayer> {
        self.navigator_engine.generate_layer(name, description)
    }
    
    /// Generate an active techniques layer
    pub fn generate_active_layer(&self, name: &str, description: &str) -> Result<NavigatorLayer> {
        self.navigator_engine.generate_active_layer(name, description)
    }
    
    /// Generate a coverage layer
    pub fn generate_coverage_layer(&self, name: &str, description: &str) -> Result<NavigatorLayer> {
        self.navigator_engine.generate_coverage_layer(name, description)
    }
    
    /// Calculate coverage statistics
    pub fn calculate_coverage_stats(&self) -> HashMap<String, serde_json::Value> {
        let tracker = self.tracker.read().unwrap();
        let repository = self.repository.read().unwrap();
        
        self.coverage_analyzer.calculate_coverage_stats(&tracker, &repository)
    }
    
    /// Identify critical coverage gaps
    pub fn identify_coverage_gaps(&self) -> Vec<String> {
        let tracker = self.tracker.read().unwrap();
        let repository = self.repository.read().unwrap();
        
        self.coverage_analyzer.identify_coverage_gaps(&tracker, &repository)
    }
    
    /// Recommend improvements to coverage
    pub fn recommend_coverage_improvements(&self) -> HashMap<String, Vec<String>> {
        let tracker = self.tracker.read().unwrap();
        let repository = self.repository.read().unwrap();
        
        self.coverage_analyzer.recommend_coverage_improvements(&tracker, &repository)
    }
    
    /// Update the ATT&CK repository from an external source
    pub async fn update_repository(&self, source_url: &str) -> Result<()> {
        let mut repository = self.repository.write().unwrap();
        repository.update_from_source(source_url).await
    }
    
    /// Get a reference to the repository
    pub fn get_repository(&self) -> Arc<RwLock<AttackRepository>> {
        self.repository.clone()
    }
    
    /// Get a reference to the tracker
    pub fn get_tracker(&self) -> Arc<RwLock<TechniqueTracker>> {
        self.tracker.clone()
    }
    
    /// Get the ATT&CK version
    pub fn get_version(&self) -> Result<AttackVersion> {
        let repository = self.repository.read().unwrap();
        Ok(repository.version.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_attack_repository() {
        let mut repository = AttackRepository::new();
        repository.initialize_default().unwrap();
        
        // Verify tactics were loaded
        assert!(!repository.tactics.is_empty());
        assert!(repository.get_tactic("TA0001").is_some());
        
        // Verify techniques were loaded
        assert!(!repository.techniques.is_empty());
        assert!(repository.get_technique("T1078").is_some());
        
        // Verify technique-tactic relationships
        let techniques = repository.get_techniques_for_tactic("TA0001");
        assert!(!techniques.is_empty());
        
        // Verify version
        assert_eq!(repository.get_version().major, 12);
    }
    
    #[tokio::test]
    async fn test_navigator() {
        let navigator = AttackNavigator::new().unwrap();
        
        // Set up a coverage example
        let coverage = TechniqueCoverage {
            level: CoverageLevel::Medium,
            controls: vec!["MFA".to_string()],
            detection_rules: vec!["rule1".to_string()],
            prevention_capabilities: vec!["account lockout".to_string()],
            notes: Some("Good coverage".to_string()),
            assessed_date: Utc::now(),
        };
        
        navigator.set_technique_coverage("T1078", coverage);
        
        // Create a layer
        let layer = navigator.generate_coverage_layer("Test Layer", "Test Description").unwrap();
        
        assert_eq!(layer.name, "Test Layer");
        assert!(!layer.techniques.is_empty());
        
        // Get coverage stats
        let stats = navigator.calculate_coverage_stats();
        assert!(stats.contains_key("total_techniques"));
    }
    
    #[tokio::test]
    async fn test_technique_tracker() {
        let mut repository = AttackRepository::new();
        repository.initialize_default().unwrap();
        
        let mut tracker = TechniqueTracker::new();
        
        // Create a test alert
        let alert = RuleAlert {
            alert_id: "test_alert_1".to_string(),
            rule_id: crate::modules::orchestrator::cipher_guard::rule_engine::RuleId::new("test_rule"),
            timestamp: Utc::now(),
            rule_metadata: crate::modules::orchestrator::cipher_guard::rule_engine::RuleMetadata {
                id: crate::modules::orchestrator::cipher_guard::rule_engine::RuleId::new("test_rule"),
                name: "Test Rule".to_string(),
                description: "Test description".to_string(),
                rule_type: crate::modules::orchestrator::cipher_guard::rule_engine::RuleType::Sigma,
                severity: crate::modules::orchestrator::cipher_guard::rule_engine::RuleSeverity::High,
                tags: vec!["test".to_string()],
                mitre_attack: Some(crate::modules::orchestrator::cipher_guard::rule_engine::MitreAttackInfo {
                    tactics: vec!["TA0001".to_string()],
                    techniques: vec!["T1078".to_string()],
                    sub_techniques: vec!["T1078.001".to_string()],
                }),
                source: None,
                created: Utc::now(),
                modified: Utc::now(),
                validated: None,
                false_positive_rate: None,
                properties: HashMap::new(),
            },
            matched_events: Vec::new(),
            severity: crate::modules::orchestrator::cipher_guard::rule_engine::RuleSeverity::High,
            description: "Test alert".to_string(),
            confidence: 0.8,
        };
        
        // Process the alert
        let updated = tracker.process_alert(&alert, &repository).unwrap();
        assert!(!updated.is_empty());
        
        // Verify technique was updated
        let status = tracker.get_technique_status("T1078").unwrap();
        match status {
            TechniqueStatus::Potential { .. } => {
                // Status is correct
            }
            _ => panic!("Unexpected status: {:?}", status),
        }
        
        // Confirm the technique
        tracker.confirm_technique("T1078", Some("test_evidence_1".to_string())).unwrap();
        
        // Verify status was updated
        let status = tracker.get_technique_status("T1078").unwrap();
        match status {
            TechniqueStatus::Confirmed { .. } => {
                // Status is correct
            }
            _ => panic!("Unexpected status: {:?}", status),
        }
    }
}