//! Rule Engine Module
//!
//! Provides a high-performance rule engine supporting Sigma and YARA rules
//! with capabilities for managing, updating, and optimizing 100k+ detection rules.

use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};

use anyhow::{Result, Context, anyhow};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use tracing::{debug, error, info, warn};
use tokio::fs;
use tokio::sync::mpsc;

use crate::modules::orchestrator::cipher_guard::edr_integration::EndpointEvent;

/// Type of detection rule
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum RuleType {
    /// Sigma rule for log-based detection
    Sigma,
    /// YARA rule for content matching
    Yara,
    /// Custom rule type
    Custom(u8),
}

/// Unique identifier for rules
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct RuleId(String);

impl RuleId {
    /// Create a new rule ID
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }
    
    /// Get the inner string
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Information about a rule's source
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleSource {
    /// Organization or individual that created the rule
    pub author: String,
    /// Original source URL or repository
    pub source: Option<String>,
    /// License for the rule
    pub license: Option<String>,
}

/// MITRE ATT&CK information for a rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MitreAttackInfo {
    /// MITRE ATT&CK tactic IDs (e.g., TA0001)
    pub tactics: Vec<String>,
    /// MITRE ATT&CK technique IDs (e.g., T1078)
    pub techniques: Vec<String>,
    /// MITRE ATT&CK sub-technique IDs (e.g., T1078.001)
    pub sub_techniques: Vec<String>,
}

/// Metadata for a detection rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleMetadata {
    /// Unique identifier for the rule
    pub id: RuleId,
    /// Human-readable name
    pub name: String,
    /// Detailed description
    pub description: String,
    /// Rule type (Sigma, YARA, etc.)
    pub rule_type: RuleType,
    /// Severity of what the rule detects
    pub severity: RuleSeverity,
    /// Tags for categorization
    pub tags: Vec<String>,
    /// MITRE ATT&CK mapping
    pub mitre_attack: Option<MitreAttackInfo>,
    /// Information about the rule source
    pub source: Option<RuleSource>,
    /// When the rule was created
    pub created: DateTime<Utc>,
    /// When the rule was last modified
    pub modified: DateTime<Utc>,
    /// When the rule was last validated
    pub validated: Option<DateTime<Utc>>,
    /// False positive rate (0.0-1.0)
    pub false_positive_rate: Option<f64>,
    /// Additional properties specific to the rule
    pub properties: HashMap<String, String>,
}

/// Severity levels for detection rules
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum RuleSeverity {
    /// Informational only, no security concern
    Info,
    /// Low severity, minimal security impact
    Low,
    /// Medium severity, potentially suspicious
    Medium,
    /// High severity, likely malicious
    High,
    /// Critical severity, immediate threat
    Critical,
}

/// Detection rule alert
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleAlert {
    /// Unique identifier for the alert
    pub alert_id: String,
    /// ID of the rule that triggered
    pub rule_id: RuleId,
    /// Timestamp when the alert was generated
    pub timestamp: DateTime<Utc>,
    /// Rule metadata
    pub rule_metadata: RuleMetadata,
    /// Events that triggered the rule
    pub matched_events: Vec<EndpointEvent>,
    /// Alert severity (may differ from rule severity based on context)
    pub severity: RuleSeverity,
    /// Description of the alert
    pub description: String,
    /// Confidence level (0.0-1.0)
    pub confidence: f64,
}

/// Status of a rule update operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UpdateStatus {
    /// Update succeeded
    Success {
        /// Number of rules added
        added: usize,
        /// Number of rules updated
        updated: usize,
        /// Number of rules removed
        removed: usize,
    },
    /// Update in progress
    InProgress {
        /// Percentage complete (0-100)
        progress: u8,
        /// Status message
        message: String,
    },
    /// Update failed
    Failed {
        /// Error message
        error: String,
    },
}

/// Common interface for both Sigma and YARA rule processors
#[async_trait]
pub trait RuleProcessor: Send + Sync {
    /// Get the type of rules this processor handles
    fn rule_type(&self) -> RuleType;
    
    /// Parse rule content into a rule object
    async fn parse_rule(&self, content: &str) -> Result<Box<dyn Rule>>;
    
    /// Compile rule for optimal execution
    async fn compile_rule(&self, rule: &dyn Rule) -> Result<Box<dyn CompiledRule>>;
    
    /// Load rules from a directory
    async fn load_rules_from_directory(&self, directory: &PathBuf) -> Result<Vec<Box<dyn Rule>>>;
    
    /// Validate a rule
    async fn validate_rule(&self, rule: &dyn Rule) -> Result<()>;
}

/// Common interface for rules of any type
#[async_trait]
pub trait Rule: Send + Sync {
    /// Get the rule's metadata
    fn metadata(&self) -> &RuleMetadata;
    
    /// Get the rule's raw content
    fn content(&self) -> &str;
    
    /// Get the rule type
    fn rule_type(&self) -> RuleType;
}

/// Compiled rule ready for efficient execution
#[async_trait]
pub trait CompiledRule: Send + Sync {
    /// Get the original rule this was compiled from
    fn original_rule(&self) -> &dyn Rule;
    
    /// Check if an event matches this rule
    async fn matches(&self, event: &EndpointEvent) -> Result<bool>;
    
    /// Get a score for how well the event matches (0.0-1.0)
    async fn score(&self, event: &EndpointEvent) -> Result<f64>;
}

/// Sigma rule implementation
pub struct SigmaRule {
    /// Raw rule content
    content: String,
    /// Parsed metadata
    metadata: RuleMetadata,
    /// Parsed rule components (simulation)
    logsource: String,
    detection_conditions: Vec<String>,
    // Would have parsed rule components here in a real implementation
}

impl SigmaRule {
    /// Create a new Sigma rule
    pub fn new(content: String, metadata: RuleMetadata, logsource: String, detection_conditions: Vec<String>) -> Self {
        Self {
            content,
            metadata,
            logsource,
            detection_conditions,
        }
    }
    
    /// Parse a Sigma rule from raw content
    pub fn parse(content: &str) -> Result<Self> {
        // In a real implementation, this would properly parse the YAML content
        // For this simulation, we'll extract some basic metadata

        // Create a simple ID from the content hash
        let hash = format!("{:x}", md5::compute(content));
        let id = RuleId::new(format!("sigma_{}", &hash[..8]));
        
        // Extract a simple name
        let name = if content.contains("title: ") {
            let parts: Vec<&str> = content.split("title: ").collect();
            if parts.len() > 1 {
                let title_line = parts[1].lines().next().unwrap_or("Unknown Rule");
                title_line.trim().to_string()
            } else {
                "Unknown Rule".to_string()
            }
        } else {
            "Unknown Rule".to_string()
        };
        
        // Extract description if available
        let description = if content.contains("description: ") {
            let parts: Vec<&str> = content.split("description: ").collect();
            if parts.len() > 1 {
                let desc_line = parts[1].lines().next().unwrap_or("No description");
                desc_line.trim().to_string()
            } else {
                "No description".to_string()
            }
        } else {
            "No description".to_string()
        };
        
        // Extract logsource if available
        let logsource = if content.contains("logsource:") {
            let parts: Vec<&str> = content.split("logsource:").collect();
            if parts.len() > 1 {
                parts[1].lines().next().unwrap_or("unknown").trim().to_string()
            } else {
                "unknown".to_string()
            }
        } else {
            "unknown".to_string()
        };
        
        // Simulate extracting detection conditions
        let detection_conditions = if content.contains("detection:") {
            vec!["condition: simulated".to_string()]
        } else {
            vec![]
        };
        
        // Create rule metadata
        let metadata = RuleMetadata {
            id,
            name,
            description,
            rule_type: RuleType::Sigma,
            severity: RuleSeverity::Medium, // Default severity
            tags: vec![],
            mitre_attack: None,
            source: None,
            created: chrono::Utc::now(),
            modified: chrono::Utc::now(),
            validated: None,
            false_positive_rate: None,
            properties: HashMap::new(),
        };
        
        Ok(Self {
            content: content.to_string(),
            metadata,
            logsource,
            detection_conditions,
        })
    }
}

#[async_trait]
impl Rule for SigmaRule {
    fn metadata(&self) -> &RuleMetadata {
        &self.metadata
    }
    
    fn content(&self) -> &str {
        &self.content
    }
    
    fn rule_type(&self) -> RuleType {
        RuleType::Sigma
    }
}

/// Compiled Sigma rule for efficient execution
pub struct CompiledSigmaRule {
    /// Original rule
    original: SigmaRule,
    /// Compiled pattern (simulation)
    _compiled_pattern: String,
}

#[async_trait]
impl CompiledRule for CompiledSigmaRule {
    fn original_rule(&self) -> &dyn Rule {
        &self.original
    }
    
    async fn matches(&self, event: &EndpointEvent) -> Result<bool> {
        // In a real implementation, this would properly match the event against the rule
        // For this simulation, we'll do a simple simulation
        
        // Check if the event type matches the logsource
        if self.original.logsource.to_lowercase().contains(&event.event_type.to_lowercase()) {
            return Ok(true);
        }
        
        // Simulate matching by looking for keywords in the event data
        let metadata = self.original.metadata();
        let search_terms = [
            &metadata.name.to_lowercase(),
            &metadata.description.to_lowercase(),
        ];
        
        for (key, value) in &event.data {
            let value_str = value.to_string().to_lowercase();
            
            for term in &search_terms {
                if term.contains(&value_str) || value_str.contains(term) {
                    return Ok(true);
                }
            }
        }
        
        Ok(false)
    }
    
    async fn score(&self, event: &EndpointEvent) -> Result<f64> {
        // In a real implementation, this would calculate a match score
        // For this simulation, we'll return a simple score
        
        if await!(self.matches(event))? {
            Ok(0.8) // High confidence match
        } else {
            Ok(0.0) // No match
        }
    }
}

/// YARA rule implementation
pub struct YaraRule {
    /// Raw rule content
    content: String,
    /// Parsed metadata
    metadata: RuleMetadata,
    /// Parsed rule strings (simulation)
    strings: Vec<String>,
    /// Parsed rule condition (simulation)
    condition: String,
    // Would have parsed rule components here in a real implementation
}

impl YaraRule {
    /// Create a new YARA rule
    pub fn new(content: String, metadata: RuleMetadata, strings: Vec<String>, condition: String) -> Self {
        Self {
            content,
            metadata,
            strings,
            condition,
        }
    }
    
    /// Parse a YARA rule from raw content
    pub fn parse(content: &str) -> Result<Self> {
        // In a real implementation, this would properly parse the YARA rule
        // For this simulation, we'll extract some basic metadata
        
        // Create a simple ID from the content hash
        let hash = format!("{:x}", md5::compute(content));
        let id = RuleId::new(format!("yara_{}", &hash[..8]));
        
        // Extract rule name
        let name = if content.contains("rule ") {
            let parts: Vec<&str> = content.split("rule ").collect();
            if parts.len() > 1 {
                let rule_line = parts[1].trim();
                let name_end = rule_line.find(|c| c == '{' || c == ':').unwrap_or(rule_line.len());
                rule_line[..name_end].trim().to_string()
            } else {
                "Unknown Rule".to_string()
            }
        } else {
            "Unknown Rule".to_string()
        };
        
        // Simulate extracting strings section
        let strings = if content.contains("strings:") {
            vec!["$simulated_string = \"simulated\"".to_string()]
        } else {
            vec![]
        };
        
        // Simulate extracting condition
        let condition = if content.contains("condition:") {
            "any of them".to_string()
        } else {
            "true".to_string()
        };
        
        // Extract description from metadata if available
        let description = if content.contains("description =") {
            let parts: Vec<&str> = content.split("description =").collect();
            if parts.len() > 1 {
                let desc_part = parts[1].trim();
                if desc_part.starts_with("\"") && desc_part.contains("\"") {
                    let end_quote = desc_part[1..].find("\"").unwrap_or(desc_part.len() - 1) + 1;
                    desc_part[1..end_quote].to_string()
                } else {
                    "No description".to_string()
                }
            } else {
                "No description".to_string()
            }
        } else {
            "No description".to_string()
        };
        
        // Create rule metadata
        let metadata = RuleMetadata {
            id,
            name,
            description,
            rule_type: RuleType::Yara,
            severity: RuleSeverity::Medium, // Default severity
            tags: vec![],
            mitre_attack: None,
            source: None,
            created: chrono::Utc::now(),
            modified: chrono::Utc::now(),
            validated: None,
            false_positive_rate: None,
            properties: HashMap::new(),
        };
        
        Ok(Self {
            content: content.to_string(),
            metadata,
            strings,
            condition,
        })
    }
}

#[async_trait]
impl Rule for YaraRule {
    fn metadata(&self) -> &RuleMetadata {
        &self.metadata
    }
    
    fn content(&self) -> &str {
        &self.content
    }
    
    fn rule_type(&self) -> RuleType {
        RuleType::Yara
    }
}

/// Compiled YARA rule for efficient execution
pub struct CompiledYaraRule {
    /// Original rule
    original: YaraRule,
    /// Compiled pattern (simulation)
    _compiled_pattern: String,
}

#[async_trait]
impl CompiledRule for CompiledYaraRule {
    fn original_rule(&self) -> &dyn Rule {
        &self.original
    }
    
    async fn matches(&self, event: &EndpointEvent) -> Result<bool> {
        // In a real implementation, this would properly match the event against the rule
        // For this simulation, we'll do a simple simulation
        
        // Simulate matching by looking for keywords in the event data
        let metadata = self.original.metadata();
        let search_terms = [
            &metadata.name.to_lowercase(),
            &metadata.description.to_lowercase(),
        ];
        
        for (key, value) in &event.data {
            let value_str = value.to_string().to_lowercase();
            
            for term in &search_terms {
                if term.contains(&value_str) || value_str.contains(term) {
                    return Ok(true);
                }
            }
        }
        
        Ok(false)
    }
    
    async fn score(&self, event: &EndpointEvent) -> Result<f64> {
        // In a real implementation, this would calculate a match score
        // For this simulation, we'll return a simple score
        
        if await!(self.matches(event))? {
            Ok(0.9) // High confidence match for YARA
        } else {
            Ok(0.0) // No match
        }
    }
}

/// Processor for Sigma rules
pub struct SigmaProcessor;

impl SigmaProcessor {
    /// Create a new Sigma processor
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl RuleProcessor for SigmaProcessor {
    fn rule_type(&self) -> RuleType {
        RuleType::Sigma
    }
    
    async fn parse_rule(&self, content: &str) -> Result<Box<dyn Rule>> {
        let rule = SigmaRule::parse(content)?;
        Ok(Box::new(rule))
    }
    
    async fn compile_rule(&self, rule: &dyn Rule) -> Result<Box<dyn CompiledRule>> {
        if rule.rule_type() != RuleType::Sigma {
            return Err(anyhow!("Cannot compile non-Sigma rule with SigmaProcessor"));
        }
        
        // In a real implementation, this would cast the rule to a SigmaRule and compile it
        // For this simulation, we'll create a basic compiled rule
        
        // Cast the rule to SigmaRule
        let sigma_rule = match rule.content() {
            content => {
                let parsed = SigmaRule::parse(content)?;
                parsed
            }
        };
        
        let compiled = CompiledSigmaRule {
            original: sigma_rule,
            _compiled_pattern: "compiled_pattern".to_string(),
        };
        
        Ok(Box::new(compiled))
    }
    
    async fn load_rules_from_directory(&self, directory: &PathBuf) -> Result<Vec<Box<dyn Rule>>> {
        let mut rules = Vec::new();
        
        // Read all .yml and .yaml files in the directory
        let mut entries = fs::read_dir(directory).await?;
        
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "yml" || ext == "yaml" {
                        let content = fs::read_to_string(&path).await?;
                        match self.parse_rule(&content).await {
                            Ok(rule) => {
                                debug!("Loaded Sigma rule: {}", rule.metadata().name);
                                rules.push(rule);
                            },
                            Err(e) => {
                                warn!("Failed to parse Sigma rule {}: {}", path.display(), e);
                            }
                        }
                    }
                }
            }
        }
        
        Ok(rules)
    }
    
    async fn validate_rule(&self, rule: &dyn Rule) -> Result<()> {
        // In a real implementation, this would validate the rule syntax and structure
        // For this simulation, we'll just check the rule type
        
        if rule.rule_type() != RuleType::Sigma {
            return Err(anyhow!("Cannot validate non-Sigma rule with SigmaProcessor"));
        }
        
        // Check if the rule has a valid name
        if rule.metadata().name.is_empty() {
            return Err(anyhow!("Sigma rule has an empty name"));
        }
        
        Ok(())
    }
}

/// Processor for YARA rules
pub struct YaraProcessor;

impl YaraProcessor {
    /// Create a new YARA processor
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl RuleProcessor for YaraProcessor {
    fn rule_type(&self) -> RuleType {
        RuleType::Yara
    }
    
    async fn parse_rule(&self, content: &str) -> Result<Box<dyn Rule>> {
        let rule = YaraRule::parse(content)?;
        Ok(Box::new(rule))
    }
    
    async fn compile_rule(&self, rule: &dyn Rule) -> Result<Box<dyn CompiledRule>> {
        if rule.rule_type() != RuleType::Yara {
            return Err(anyhow!("Cannot compile non-YARA rule with YaraProcessor"));
        }
        
        // In a real implementation, this would cast the rule to a YaraRule and compile it
        // For this simulation, we'll create a basic compiled rule
        
        // Cast the rule to YaraRule
        let yara_rule = match rule.content() {
            content => {
                let parsed = YaraRule::parse(content)?;
                parsed
            }
        };
        
        let compiled = CompiledYaraRule {
            original: yara_rule,
            _compiled_pattern: "compiled_pattern".to_string(),
        };
        
        Ok(Box::new(compiled))
    }
    
    async fn load_rules_from_directory(&self, directory: &PathBuf) -> Result<Vec<Box<dyn Rule>>> {
        let mut rules = Vec::new();
        
        // Read all .yar and .yara files in the directory
        let mut entries = fs::read_dir(directory).await?;
        
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "yar" || ext == "yara" {
                        let content = fs::read_to_string(&path).await?;
                        match self.parse_rule(&content).await {
                            Ok(rule) => {
                                debug!("Loaded YARA rule: {}", rule.metadata().name);
                                rules.push(rule);
                            },
                            Err(e) => {
                                warn!("Failed to parse YARA rule {}: {}", path.display(), e);
                            }
                        }
                    }
                }
            }
        }
        
        Ok(rules)
    }
    
    async fn validate_rule(&self, rule: &dyn Rule) -> Result<()> {
        // In a real implementation, this would validate the rule syntax and structure
        // For this simulation, we'll just check the rule type
        
        if rule.rule_type() != RuleType::Yara {
            return Err(anyhow!("Cannot validate non-YARA rule with YaraProcessor"));
        }
        
        // Check if the rule has a valid name
        if rule.metadata().name.is_empty() {
            return Err(anyhow!("YARA rule has an empty name"));
        }
        
        Ok(())
    }
}

/// Rule set data structure for efficient storage and execution of rules
pub struct RuleSet {
    /// Map of rule ID to rule
    rules: HashMap<RuleId, Box<dyn Rule>>,
    /// Map of rule ID to compiled rule
    compiled_rules: HashMap<RuleId, Box<dyn CompiledRule>>,
    /// Index by rule type
    rules_by_type: HashMap<RuleType, HashSet<RuleId>>,
    /// Index by tag
    rules_by_tag: HashMap<String, HashSet<RuleId>>,
    /// Index by MITRE ATT&CK tactic
    rules_by_tactic: HashMap<String, HashSet<RuleId>>,
    /// Index by MITRE ATT&CK technique
    rules_by_technique: HashMap<String, HashSet<RuleId>>,
    /// Index by severity
    rules_by_severity: HashMap<RuleSeverity, HashSet<RuleId>>,
}

impl RuleSet {
    /// Create a new rule set
    pub fn new() -> Self {
        Self {
            rules: HashMap::new(),
            compiled_rules: HashMap::new(),
            rules_by_type: HashMap::new(),
            rules_by_tag: HashMap::new(),
            rules_by_tactic: HashMap::new(),
            rules_by_technique: HashMap::new(),
            rules_by_severity: HashMap::new(),
        }
    }
    
    /// Add a rule to the rule set
    pub async fn add_rule(&mut self, rule: Box<dyn Rule>, processor: &dyn RuleProcessor, compile: bool) -> Result<()> {
        let rule_id = rule.metadata().id.clone();
        let rule_type = rule.rule_type();
        
        // Index by rule type
        self.rules_by_type.entry(rule_type).or_insert_with(HashSet::new).insert(rule_id.clone());
        
        // Index by tags
        for tag in &rule.metadata().tags {
            self.rules_by_tag.entry(tag.clone()).or_insert_with(HashSet::new).insert(rule_id.clone());
        }
        
        // Index by severity
        self.rules_by_severity.entry(rule.metadata().severity).or_insert_with(HashSet::new).insert(rule_id.clone());
        
        // Index by MITRE ATT&CK
        if let Some(ref mitre) = rule.metadata().mitre_attack {
            for tactic in &mitre.tactics {
                self.rules_by_tactic.entry(tactic.clone()).or_insert_with(HashSet::new).insert(rule_id.clone());
            }
            
            for technique in &mitre.techniques {
                self.rules_by_technique.entry(technique.clone()).or_insert_with(HashSet::new).insert(rule_id.clone());
            }
            
            for sub_technique in &mitre.sub_techniques {
                // Extract the parent technique
                if let Some(parent) = sub_technique.split('.').next() {
                    let parent_technique = parent.to_string();
                    self.rules_by_technique.entry(parent_technique).or_insert_with(HashSet::new).insert(rule_id.clone());
                }
                
                // Index the sub-technique directly
                self.rules_by_technique.entry(sub_technique.clone()).or_insert_with(HashSet::new).insert(rule_id.clone());
            }
        }
        
        // Compile the rule if requested
        if compile {
            match processor.compile_rule(&*rule).await {
                Ok(compiled) => {
                    self.compiled_rules.insert(rule_id.clone(), compiled);
                },
                Err(e) => {
                    warn!("Failed to compile rule {}: {}", rule_id.as_str(), e);
                }
            }
        }
        
        // Store the rule
        self.rules.insert(rule_id, rule);
        
        Ok(())
    }
    
    /// Remove a rule from the rule set
    pub fn remove_rule(&mut self, rule_id: &RuleId) -> Result<()> {
        if let Some(rule) = self.rules.remove(rule_id) {
            // Remove from compiled rules
            self.compiled_rules.remove(rule_id);
            
            // Remove from indices
            let rule_type = rule.rule_type();
            if let Some(rules) = self.rules_by_type.get_mut(&rule_type) {
                rules.remove(rule_id);
            }
            
            for tag in &rule.metadata().tags {
                if let Some(rules) = self.rules_by_tag.get_mut(tag) {
                    rules.remove(rule_id);
                }
            }
            
            if let Some(rules) = self.rules_by_severity.get_mut(&rule.metadata().severity) {
                rules.remove(rule_id);
            }
            
            if let Some(ref mitre) = rule.metadata().mitre_attack {
                for tactic in &mitre.tactics {
                    if let Some(rules) = self.rules_by_tactic.get_mut(tactic) {
                        rules.remove(rule_id);
                    }
                }
                
                for technique in &mitre.techniques {
                    if let Some(rules) = self.rules_by_technique.get_mut(technique) {
                        rules.remove(rule_id);
                    }
                }
                
                for sub_technique in &mitre.sub_techniques {
                    if let Some(rules) = self.rules_by_technique.get_mut(sub_technique) {
                        rules.remove(rule_id);
                    }
                    
                    // Remove from parent technique index
                    if let Some(parent) = sub_technique.split('.').next() {
                        let parent_technique = parent.to_string();
                        if let Some(rules) = self.rules_by_technique.get_mut(&parent_technique) {
                            rules.remove(rule_id);
                        }
                    }
                }
            }
            
            Ok(())
        } else {
            Err(anyhow!("Rule not found: {}", rule_id.as_str()))
        }
    }
    
    /// Get a rule by ID
    pub fn get_rule(&self, rule_id: &RuleId) -> Option<&dyn Rule> {
        self.rules.get(rule_id).map(|rule| rule.as_ref())
    }
    
    /// Get a compiled rule by ID
    pub fn get_compiled_rule(&self, rule_id: &RuleId) -> Option<&dyn CompiledRule> {
        self.compiled_rules.get(rule_id).map(|rule| rule.as_ref())
    }
    
    /// Get all rules
    pub fn get_all_rules(&self) -> Vec<&dyn Rule> {
        self.rules.values().map(|rule| rule.as_ref()).collect()
    }
    
    /// Get rules by type
    pub fn get_rules_by_type(&self, rule_type: RuleType) -> Vec<&dyn Rule> {
        if let Some(rule_ids) = self.rules_by_type.get(&rule_type) {
            rule_ids.iter()
                .filter_map(|id| self.get_rule(id))
                .collect()
        } else {
            Vec::new()
        }
    }
    
    /// Get rules by tag
    pub fn get_rules_by_tag(&self, tag: &str) -> Vec<&dyn Rule> {
        if let Some(rule_ids) = self.rules_by_tag.get(tag) {
            rule_ids.iter()
                .filter_map(|id| self.get_rule(id))
                .collect()
        } else {
            Vec::new()
        }
    }
    
    /// Get rules by MITRE ATT&CK tactic
    pub fn get_rules_by_tactic(&self, tactic: &str) -> Vec<&dyn Rule> {
        if let Some(rule_ids) = self.rules_by_tactic.get(tactic) {
            rule_ids.iter()
                .filter_map(|id| self.get_rule(id))
                .collect()
        } else {
            Vec::new()
        }
    }
    
    /// Get rules by MITRE ATT&CK technique
    pub fn get_rules_by_technique(&self, technique: &str) -> Vec<&dyn Rule> {
        if let Some(rule_ids) = self.rules_by_technique.get(technique) {
            rule_ids.iter()
                .filter_map(|id| self.get_rule(id))
                .collect()
        } else {
            Vec::new()
        }
    }
    
    /// Get rules by severity
    pub fn get_rules_by_severity(&self, severity: RuleSeverity) -> Vec<&dyn Rule> {
        if let Some(rule_ids) = self.rules_by_severity.get(&severity) {
            rule_ids.iter()
                .filter_map(|id| self.get_rule(id))
                .collect()
        } else {
            Vec::new()
        }
    }
    
    /// Get the number of rules
    pub fn rule_count(&self) -> usize {
        self.rules.len()
    }
    
    /// Check if a rule exists
    pub fn has_rule(&self, rule_id: &RuleId) -> bool {
        self.rules.contains_key(rule_id)
    }
    
    /// Clear all rules
    pub fn clear(&mut self) {
        self.rules.clear();
        self.compiled_rules.clear();
        self.rules_by_type.clear();
        self.rules_by_tag.clear();
        self.rules_by_tactic.clear();
        self.rules_by_technique.clear();
        self.rules_by_severity.clear();
    }
}

/// Configuration for the rule updater
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleUpdateConfig {
    /// Update interval in hours
    pub update_interval_hours: u64,
    /// URLs for Sigma rule repositories
    pub sigma_rule_urls: Vec<String>,
    /// URLs for YARA rule repositories
    pub yara_rule_urls: Vec<String>,
    /// Local directories for Sigma rules
    pub sigma_rule_dirs: Vec<PathBuf>,
    /// Local directories for YARA rules
    pub yara_rule_dirs: Vec<PathBuf>,
    /// Auto-update enabled flag
    pub auto_update_enabled: bool,
}

/// Rule update manager for keeping rules up-to-date
pub struct RuleUpdateManager {
    /// Configuration
    config: RuleUpdateConfig,
    /// Status of the last update
    last_update_status: Option<UpdateStatus>,
    /// Timestamp of the last update
    last_update_time: Option<DateTime<Utc>>,
    /// Update in progress flag
    update_in_progress: bool,
    /// Status reporting channel
    _status_sender: Option<mpsc::Sender<UpdateStatus>>,
}

impl RuleUpdateManager {
    /// Create a new rule update manager
    pub fn new(config: RuleUpdateConfig) -> Self {
        Self {
            config,
            last_update_status: None,
            last_update_time: None,
            update_in_progress: false,
            _status_sender: None,
        }
    }
    
    /// Start an update
    pub async fn start_update(&mut self, rule_set: Arc<RwLock<RuleSet>>, sigma_processor: Arc<SigmaProcessor>, yara_processor: Arc<YaraProcessor>) -> Result<mpsc::Receiver<UpdateStatus>> {
        // Create a channel for status updates
        let (tx, rx) = mpsc::channel::<UpdateStatus>(100);
        
        if self.update_in_progress {
            return Err(anyhow!("Update already in progress"));
        }
        
        self.update_in_progress = true;
        self._status_sender = Some(tx.clone());
        
        // Spawn a task to perform the update
        tokio::spawn(async move {
            // Send an initial progress update
            let _ = tx.send(UpdateStatus::InProgress { 
                progress: 0, 
                message: "Starting rule update".to_string() 
            }).await;
            
            // Clone the necessary values
            let sigma_rule_dirs = Self::clone_paths(&config.sigma_rule_dirs);
            let yara_rule_dirs = Self::clone_paths(&config.yara_rule_dirs);
            
            // Track the update results
            let mut added = 0;
            let mut updated = 0;
            let mut removed = 0;
            
            // Create a set of existing rule IDs for tracking removals
            let existing_rule_ids = {
                let rule_set = rule_set.read().unwrap();
                let rules = rule_set.get_all_rules();
                let mut ids = HashSet::new();
                for rule in rules {
                    ids.insert(rule.metadata().id.clone());
                }
                ids
            };
            
            // Process Sigma rules
            for (i, dir) in sigma_rule_dirs.iter().enumerate() {
                let progress = ((i as f64) / (sigma_rule_dirs.len() + yara_rule_dirs.len()) as f64 * 100.0) as u8;
                let _ = tx.send(UpdateStatus::InProgress { 
                    progress, 
                    message: format!("Processing Sigma rules from {}", dir.display()) 
                }).await;
                
                match sigma_processor.load_rules_from_directory(dir).await {
                    Ok(rules) => {
                        for rule in rules {
                            let rule_id = rule.metadata().id.clone();
                            
                            // Check if the rule already exists
                            let rule_exists = {
                                let rule_set_read = rule_set.read().unwrap();
                                rule_set_read.has_rule(&rule_id)
                            };
                            
                            // Add or update the rule
                            {
                                let mut rule_set_write = rule_set.write().unwrap();
                                if rule_exists {
                                    // Remove the old rule first
                                    if let Err(e) = rule_set_write.remove_rule(&rule_id) {
                                        warn!("Failed to remove existing rule {}: {}", rule_id.as_str(), e);
                                    }
                                    updated += 1;
                                } else {
                                    added += 1;
                                }
                                
                                if let Err(e) = rule_set_write.add_rule(rule, sigma_processor.as_ref(), true).await {
                                    warn!("Failed to add rule {}: {}", rule_id.as_str(), e);
                                }
                            }
                        }
                    },
                    Err(e) => {
                        error!("Failed to load Sigma rules from {}: {}", dir.display(), e);
                    }
                }
            }
            
            // Process YARA rules
            for (i, dir) in yara_rule_dirs.iter().enumerate() {
                let progress = ((sigma_rule_dirs.len() + i) as f64 / (sigma_rule_dirs.len() + yara_rule_dirs.len()) as f64 * 100.0) as u8;
                let _ = tx.send(UpdateStatus::InProgress { 
                    progress, 
                    message: format!("Processing YARA rules from {}", dir.display()) 
                }).await;
                
                match yara_processor.load_rules_from_directory(dir).await {
                    Ok(rules) => {
                        for rule in rules {
                            let rule_id = rule.metadata().id.clone();
                            
                            // Check if the rule already exists
                            let rule_exists = {
                                let rule_set_read = rule_set.read().unwrap();
                                rule_set_read.has_rule(&rule_id)
                            };
                            
                            // Add or update the rule
                            {
                                let mut rule_set_write = rule_set.write().unwrap();
                                if rule_exists {
                                    // Remove the old rule first
                                    if let Err(e) = rule_set_write.remove_rule(&rule_id) {
                                        warn!("Failed to remove existing rule {}: {}", rule_id.as_str(), e);
                                    }
                                    updated += 1;
                                } else {
                                    added += 1;
                                }
                                
                                if let Err(e) = rule_set_write.add_rule(rule, yara_processor.as_ref(), true).await {
                                    warn!("Failed to add rule {}: {}", rule_id.as_str(), e);
                                }
                            }
                        }
                    },
                    Err(e) => {
                        error!("Failed to load YARA rules from {}: {}", dir.display(), e);
                    }
                }
            }
            
            // Calculate the final result
            let success = UpdateStatus::Success {
                added,
                updated,
                removed,
            };
            
            let _ = tx.send(success).await;
        });
        
        Ok(rx)
    }
    
    /// Get the status of the last update
    pub fn get_last_update_status(&self) -> Option<&UpdateStatus> {
        self.last_update_status.as_ref()
    }
    
    /// Get the time of the last update
    pub fn get_last_update_time(&self) -> Option<DateTime<Utc>> {
        self.last_update_time
    }
    
    /// Check if an update is currently in progress
    pub fn is_update_in_progress(&self) -> bool {
        self.update_in_progress
    }
    
    /// Set the update in progress flag to false
    pub fn set_update_completed(&mut self, status: UpdateStatus) {
        self.update_in_progress = false;
        self.last_update_status = Some(status);
        self.last_update_time = Some(chrono::Utc::now());
    }
    
    // Helper function to clone PathBuf vectors
    fn clone_paths(paths: &[PathBuf]) -> Vec<PathBuf> {
        paths.iter().map(|p| p.clone()).collect()
    }
}

/// Configuration for the rule engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleEngineConfig {
    /// Rule storage directories
    pub rule_dirs: PathBuf,
    /// Rule update configuration
    pub update_config: RuleUpdateConfig,
    /// Maximum number of rules to process in parallel
    pub max_parallel_rules: usize,
    /// Timeout for rule execution in milliseconds
    pub rule_timeout_ms: u64,
    /// Pre-filtering enabled flag
    pub pre_filtering_enabled: bool,
    /// Bloom filter false positive rate
    pub bloom_filter_fp_rate: f64,
}

impl Default for RuleEngineConfig {
    fn default() -> Self {
        Self {
            rule_dirs: PathBuf::from("rules"),
            update_config: RuleUpdateConfig {
                update_interval_hours: 24,
                sigma_rule_urls: Vec::new(),
                yara_rule_urls: Vec::new(),
                sigma_rule_dirs: vec![PathBuf::from("rules/sigma")],
                yara_rule_dirs: vec![PathBuf::from("rules/yara")],
                auto_update_enabled: true,
            },
            max_parallel_rules: 16,
            rule_timeout_ms: 1000,
            pre_filtering_enabled: true,
            bloom_filter_fp_rate: 0.01,
        }
    }
}

/// Main rule engine for managing and executing detection rules
pub struct RuleEngine {
    /// Configuration
    config: RuleEngineConfig,
    /// Rule set
    rule_set: Arc<RwLock<RuleSet>>,
    /// Sigma rule processor
    sigma_processor: Arc<SigmaProcessor>,
    /// YARA rule processor
    yara_processor: Arc<YaraProcessor>,
    /// Rule update manager
    update_manager: RuleUpdateManager,
}

impl RuleEngine {
    /// Create a new rule engine with default configuration
    pub fn new() -> Result<Self> {
        Self::with_config(RuleEngineConfig::default())
    }
    
    /// Create a new rule engine with the specified configuration
    pub fn with_config(config: RuleEngineConfig) -> Result<Self> {
        let rule_set = Arc::new(RwLock::new(RuleSet::new()));
        let sigma_processor = Arc::new(SigmaProcessor::new());
        let yara_processor = Arc::new(YaraProcessor::new());
        let update_manager = RuleUpdateManager::new(config.update_config.clone());
        
        Ok(Self {
            config,
            rule_set,
            sigma_processor,
            yara_processor,
            update_manager,
        })
    }
    
    /// Initialize the rule engine
    pub async fn initialize(&mut self) -> Result<()> {
        // Create rule directories if they don't exist
        for dir in &self.config.update_config.sigma_rule_dirs {
            if !dir.exists() {
                fs::create_dir_all(dir).await.context(format!("Failed to create directory: {}", dir.display()))?;
            }
        }
        
        for dir in &self.config.update_config.yara_rule_dirs {
            if !dir.exists() {
                fs::create_dir_all(dir).await.context(format!("Failed to create directory: {}", dir.display()))?;
            }
        }
        
        // Load initial rules
        self.load_rules().await?;
        
        Ok(())
    }
    
    /// Load rules from the configured directories
    pub async fn load_rules(&self) -> Result<()> {
        let mut total_rules = 0;
        
        // Load Sigma rules
        for dir in &self.config.update_config.sigma_rule_dirs {
            if dir.exists() {
                let rules = self.sigma_processor.load_rules_from_directory(dir).await?;
                info!("Loaded {} Sigma rules from {}", rules.len(), dir.display());
                
                // Add rules to the rule set
                let mut rule_set = self.rule_set.write().unwrap();
                for rule in rules {
                    if let Err(e) = rule_set.add_rule(rule, self.sigma_processor.as_ref(), true).await {
                        warn!("Failed to add rule: {}", e);
                    } else {
                        total_rules += 1;
                    }
                }
            } else {
                warn!("Sigma rule directory does not exist: {}", dir.display());
            }
        }
        
        // Load YARA rules
        for dir in &self.config.update_config.yara_rule_dirs {
            if dir.exists() {
                let rules = self.yara_processor.load_rules_from_directory(dir).await?;
                info!("Loaded {} YARA rules from {}", rules.len(), dir.display());
                
                // Add rules to the rule set
                let mut rule_set = self.rule_set.write().unwrap();
                for rule in rules {
                    if let Err(e) = rule_set.add_rule(rule, self.yara_processor.as_ref(), true).await {
                        warn!("Failed to add rule: {}", e);
                    } else {
                        total_rules += 1;
                    }
                }
            } else {
                warn!("YARA rule directory does not exist: {}", dir.display());
            }
        }
        
        info!("Loaded a total of {} rules", total_rules);
        
        Ok(())
    }
    
    /// Start a rule update
    pub async fn start_update(&mut self) -> Result<mpsc::Receiver<UpdateStatus>> {
        self.update_manager.start_update(
            self.rule_set.clone(),
            self.sigma_processor.clone(),
            self.yara_processor.clone()
        ).await
    }
    
    /// Check events against all rules
    pub async fn check_events(&self, events: &[EndpointEvent]) -> Result<Vec<RuleAlert>> {
        let mut alerts = Vec::new();
        
        // Process each event
        for event in events {
            let matching_alerts = self.check_event(event).await?;
            alerts.extend(matching_alerts);
        }
        
        // Sort alerts by severity
        alerts.sort_by(|a, b| b.severity.cmp(&a.severity));
        
        Ok(alerts)
    }
    
    /// Check a single event against all rules
    pub async fn check_event(&self, event: &EndpointEvent) -> Result<Vec<RuleAlert>> {
        let mut alerts = Vec::new();
        
        let rule_set = self.rule_set.read().unwrap();
        let rule_count = rule_set.rule_count();
        
        debug!("Checking event against {} rules", rule_count);
        
        let start_time = Instant::now();
        
        // Get all compiled rules
        let compiled_rules: Vec<(&RuleId, &dyn CompiledRule)> = rule_set.compiled_rules
            .iter()
            .map(|(id, rule)| (id, rule.as_ref()))
            .collect();
        
        // For each compiled rule, check if the event matches
        for (rule_id, compiled_rule) in compiled_rules {
            let rule_start = Instant::now();
            
            // Apply a timeout to rule execution
            let timeout = Duration::from_millis(self.config.rule_timeout_ms);
            
            let result = tokio::time::timeout(timeout, compiled_rule.matches(event)).await;
            
            match result {
                Ok(Ok(matches)) => {
                    if matches {
                        // Get the confidence score
                        let score = compiled_rule.score(event).await.unwrap_or(1.0);
                        
                        // Create an alert
                        let rule = compiled_rule.original_rule();
                        let metadata = rule.metadata();
                        
                        let alert = RuleAlert {
                            alert_id: uuid::Uuid::new_v4().to_string(),
                            rule_id: rule_id.clone(),
                            timestamp: chrono::Utc::now(),
                            rule_metadata: metadata.clone(),
                            matched_events: vec![event.clone()],
                            severity: metadata.severity,
                            description: format!("Rule '{}' matched event", metadata.name),
                            confidence: score,
                        };
                        
                        alerts.push(alert);
                    }
                },
                Ok(Err(e)) => {
                    warn!("Error evaluating rule {}: {}", rule_id.as_str(), e);
                },
                Err(_) => {
                    warn!("Rule {} timed out after {} ms", rule_id.as_str(), self.config.rule_timeout_ms);
                }
            }
            
            let rule_duration = rule_start.elapsed();
            trace!("Rule {} took {:?}", rule_id.as_str(), rule_duration);
        }
        
        let duration = start_time.elapsed();
        debug!("Checked event against {} rules in {:?}", rule_count, duration);
        
        Ok(alerts)
    }
    
    /// Get statistics about the rule engine
    pub fn get_statistics(&self) -> HashMap<String, serde_json::Value> {
        let mut stats = HashMap::new();
        
        let rule_set = self.rule_set.read().unwrap();
        
        // Get the total rule count
        stats.insert("total_rules".to_string(), serde_json::Value::Number(serde_json::Number::from(rule_set.rule_count())));
        
        // Get rule counts by type
        let sigma_count = rule_set.get_rules_by_type(RuleType::Sigma).len();
        let yara_count = rule_set.get_rules_by_type(RuleType::Yara).len();
        
        stats.insert("sigma_rules".to_string(), serde_json::Value::Number(serde_json::Number::from(sigma_count)));
        stats.insert("yara_rules".to_string(), serde_json::Value::Number(serde_json::Number::from(yara_count)));
        
        // Get rule counts by severity
        let critical_count = rule_set.get_rules_by_severity(RuleSeverity::Critical).len();
        let high_count = rule_set.get_rules_by_severity(RuleSeverity::High).len();
        let medium_count = rule_set.get_rules_by_severity(RuleSeverity::Medium).len();
        let low_count = rule_set.get_rules_by_severity(RuleSeverity::Low).len();
        let info_count = rule_set.get_rules_by_severity(RuleSeverity::Info).len();
        
        stats.insert("critical_severity_rules".to_string(), serde_json::Value::Number(serde_json::Number::from(critical_count)));
        stats.insert("high_severity_rules".to_string(), serde_json::Value::Number(serde_json::Number::from(high_count)));
        stats.insert("medium_severity_rules".to_string(), serde_json::Value::Number(serde_json::Number::from(medium_count)));
        stats.insert("low_severity_rules".to_string(), serde_json::Value::Number(serde_json::Number::from(low_count)));
        stats.insert("info_severity_rules".to_string(), serde_json::Value::Number(serde_json::Number::from(info_count)));
        
        // Get information about the last update
        if let Some(last_update_time) = self.update_manager.get_last_update_time() {
            stats.insert("last_update_time".to_string(), serde_json::Value::String(last_update_time.to_rfc3339()));
        }
        
        if let Some(last_update_status) = self.update_manager.get_last_update_status() {
            match last_update_status {
                UpdateStatus::Success { added, updated, removed } => {
                    stats.insert("last_update_status".to_string(), serde_json::Value::String("success".to_string()));
                    stats.insert("last_update_added".to_string(), serde_json::Value::Number(serde_json::Number::from(*added)));
                    stats.insert("last_update_updated".to_string(), serde_json::Value::Number(serde_json::Number::from(*updated)));
                    stats.insert("last_update_removed".to_string(), serde_json::Value::Number(serde_json::Number::from(*removed)));
                },
                UpdateStatus::Failed { error } => {
                    stats.insert("last_update_status".to_string(), serde_json::Value::String("failed".to_string()));
                    stats.insert("last_update_error".to_string(), serde_json::Value::String(error.clone()));
                },
                UpdateStatus::InProgress { progress, message } => {
                    stats.insert("last_update_status".to_string(), serde_json::Value::String("in_progress".to_string()));
                    stats.insert("last_update_progress".to_string(), serde_json::Value::Number(serde_json::Number::from(*progress)));
                    stats.insert("last_update_message".to_string(), serde_json::Value::String(message.clone()));
                }
            }
        }
        
        stats
    }
    
    /// Get a reference to the rule set
    pub fn get_rule_set(&self) -> Arc<RwLock<RuleSet>> {
        self.rule_set.clone()
    }
    
    /// Get a reference to the Sigma processor
    pub fn get_sigma_processor(&self) -> Arc<SigmaProcessor> {
        self.sigma_processor.clone()
    }
    
    /// Get a reference to the YARA processor
    pub fn get_yara_processor(&self) -> Arc<YaraProcessor> {
        self.yara_processor.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    
    // Sample Sigma rule content for testing
    fn sample_sigma_rule() -> String {
        r#"
title: Test Sigma Rule
id: 12345678-1234-1234-1234-123456789012
description: A test Sigma rule for unit tests
status: stable
author: Test Author
logsource:
  product: windows
  service: security
detection:
  selection:
    EventID: 4624
  condition: selection
falsepositives:
  - Normal system startup
level: medium
tags:
  - attack.persistence
  - attack.t1078
        "#.to_string()
    }
    
    // Sample YARA rule content for testing
    fn sample_yara_rule() -> String {
        r#"
rule TestYaraRule
{
    meta:
        description = "Test YARA rule for unit tests"
        author = "Test Author"
        severity = "medium"
    
    strings:
        $test_string = "malicious string"
    
    condition:
        $test_string
}
        "#.to_string()
    }
    
    // Sample endpoint event for testing
    fn sample_event() -> EndpointEvent {
        let mut data = HashMap::new();
        data.insert("EventID".to_string(), serde_json::Value::Number(serde_json::Number::from(4624)));
        data.insert("process".to_string(), serde_json::Value::String("malicious string".to_string()));
        
        EndpointEvent {
            event_id: "test_event_001".to_string(),
            timestamp: chrono::Utc::now(),
            source: "test_endpoint".to_string(),
            event_type: "security".to_string(),
            severity: crate::modules::orchestrator::cipher_guard::edr_integration::EventSeverity::Medium,
            data,
        }
    }
    
    #[tokio::test]
    async fn test_sigma_rule_parsing() {
        let processor = SigmaProcessor::new();
        let content = sample_sigma_rule();
        
        let rule = processor.parse_rule(&content).await.unwrap();
        assert_eq!(rule.rule_type(), RuleType::Sigma);
        assert_eq!(rule.metadata().name, "Test Sigma Rule");
    }
    
    #[tokio::test]
    async fn test_yara_rule_parsing() {
        let processor = YaraProcessor::new();
        let content = sample_yara_rule();
        
        let rule = processor.parse_rule(&content).await.unwrap();
        assert_eq!(rule.rule_type(), RuleType::Yara);
        assert_eq!(rule.metadata().name, "TestYaraRule");
    }
    
    #[tokio::test]
    async fn test_rule_set() {
        let mut rule_set = RuleSet::new();
        let sigma_processor = SigmaProcessor::new();
        let yara_processor = YaraProcessor::new();
        
        // Parse and add a Sigma rule
        let sigma_rule = sigma_processor.parse_rule(&sample_sigma_rule()).await.unwrap();
        rule_set.add_rule(sigma_rule, &sigma_processor, true).await.unwrap();
        
        // Parse and add a YARA rule
        let yara_rule = yara_processor.parse_rule(&sample_yara_rule()).await.unwrap();
        rule_set.add_rule(yara_rule, &yara_processor, true).await.unwrap();
        
        // Check rule count
        assert_eq!(rule_set.rule_count(), 2);
        
        // Check rules by type
        assert_eq!(rule_set.get_rules_by_type(RuleType::Sigma).len(), 1);
        assert_eq!(rule_set.get_rules_by_type(RuleType::Yara).len(), 1);
    }
    
    #[tokio::test]
    async fn test_rule_engine() {
        let mut engine = RuleEngine::new().unwrap();
        
        // Add sample rules directly
        let sigma_processor = engine.get_sigma_processor();
        let yara_processor = engine.get_yara_processor();
        let rule_set = engine.get_rule_set();
        
        // Parse and add a Sigma rule
        let sigma_rule = sigma_processor.parse_rule(&sample_sigma_rule()).await.unwrap();
        {
            let mut rule_set = rule_set.write().unwrap();
            rule_set.add_rule(sigma_rule, sigma_processor.as_ref(), true).await.unwrap();
        }
        
        // Parse and add a YARA rule
        let yara_rule = yara_processor.parse_rule(&sample_yara_rule()).await.unwrap();
        {
            let mut rule_set = rule_set.write().unwrap();
            rule_set.add_rule(yara_rule, yara_processor.as_ref(), true).await.unwrap();
        }
        
        // Create a sample event that should match both rules
        let event = sample_event();
        
        // Check the event against all rules
        let alerts = engine.check_event(&event).await.unwrap();
        
        // We should get at least one alert
        assert!(!alerts.is_empty());
        
        // Get statistics
        let stats = engine.get_statistics();
        assert_eq!(stats.get("total_rules").unwrap().as_u64().unwrap(), 2);
    }
}