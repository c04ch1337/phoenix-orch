# Phoenix Marie Memory Architecture - Agent Integration Specifications

## Overview

This document specifies how agents integrate with the Phoenix Marie 6-KB Memory Architecture, ensuring strict mode-based access control and complete isolation between personal and professional domains.

## 1. Agent Classification and Registration

### 1.1 Agent Types

```rust
pub enum AgentType {
    // Personal Domain Agents
    PersonalAssistant {
        name: String,
        capabilities: Vec<PersonalCapability>,
        emotional_awareness: bool,
    },
    MemoryKeeper {
        name: String,
        access_level: MemoryAccessLevel,
    },
    EmotionalCompanion {
        name: String,
        empathy_model: String,
    },
    
    // Professional Domain Agents  
    SecurityAnalyst {
        name: String,
        clearance: SecurityClearance,
        specializations: Vec<SecuritySpecialization>,
    },
    ThreatHunter {
        name: String,
        ioc_permissions: IOCPermissions,
    },
    IncidentResponder {
        name: String,
        response_capabilities: Vec<ResponseCapability>,
    },
    
    // Special Agents
    OrchestratorAgent {
        name: String,
        mode_switching_enabled: bool,
    },
}

pub enum PersonalCapability {
    ReadMemories,
    SuggestActivities,
    EmotionalSupport,
    DreamAnalysis,
    HealthMonitoring,
}

pub enum SecuritySpecialization {
    MalwareAnalysis,
    NetworkForensics,
    ThreatIntelligence,
    VulnerabilityAssessment,
    IncidentResponse,
}
```

### 1.2 Agent Registration

```rust
pub struct AgentRegistry {
    registered_agents: HashMap<AgentId, RegisteredAgent>,
    mode_assignments: HashMap<AgentId, OperationalMode>,
    access_logs: Vec<AgentAccessLog>,
}

pub struct RegisteredAgent {
    id: AgentId,
    agent_type: AgentType,
    created_at: SystemTime,
    created_by: AccessEntity,
    permissions: AgentPermissions,
    mode_locked: bool,  // If true, agent cannot switch modes
}

impl AgentRegistry {
    pub async fn register_agent(
        &mut self,
        agent_type: AgentType,
        creator: AccessEntity,
    ) -> Result<AgentId, RegistrationError> {
        // Validate creator permissions
        if !self.can_create_agent(&creator, &agent_type) {
            return Err(RegistrationError::InsufficientPermissions);
        }
        
        // Determine mode assignment based on agent type
        let mode = match &agent_type {
            AgentType::PersonalAssistant { .. } |
            AgentType::MemoryKeeper { .. } |
            AgentType::EmotionalCompanion { .. } => OperationalMode::Personal,
            
            AgentType::SecurityAnalyst { .. } |
            AgentType::ThreatHunter { .. } |
            AgentType::IncidentResponder { .. } => OperationalMode::Professional,
            
            AgentType::OrchestratorAgent { mode_switching_enabled, .. } => {
                if *mode_switching_enabled {
                    OperationalMode::Personal  // Default to personal
                } else {
                    return Err(RegistrationError::InvalidConfiguration);
                }
            }
        };
        
        // Generate unique agent ID
        let agent_id = AgentId::new();
        
        // Create permissions based on type
        let permissions = self.generate_permissions(&agent_type);
        
        // Register agent
        let registered_agent = RegisteredAgent {
            id: agent_id.clone(),
            agent_type,
            created_at: SystemTime::now(),
            created_by: creator,
            permissions,
            mode_locked: !matches!(agent_type, AgentType::OrchestratorAgent { .. }),
        };
        
        self.registered_agents.insert(agent_id.clone(), registered_agent);
        self.mode_assignments.insert(agent_id.clone(), mode);
        
        // Log registration
        self.log_registration(&agent_id, &creator).await;
        
        Ok(agent_id)
    }
}
```

## 2. Mode-Based Access Control

### 2.1 Access Control Implementation

```rust
pub struct AgentAccessController {
    registry: Arc<RwLock<AgentRegistry>>,
    isolation_barrier: Arc<IsolationBarrier>,
    mode_controller: Arc<ModeController>,
}

impl AgentAccessController {
    pub async fn check_kb_access(
        &self,
        agent_id: &AgentId,
        target_kb: KnowledgeBaseType,
        operation: MemoryOperation,
    ) -> Result<AccessDecision, AccessError> {
        // Get agent info
        let registry = self.registry.read().await;
        let agent = registry.get_agent(agent_id)
            .ok_or(AccessError::UnregisteredAgent)?;
        
        // Get current mode
        let current_mode = registry.get_agent_mode(agent_id)?;
        
        // Special handling for Dad
        if agent.created_by == AccessEntity::Dad {
            return Ok(AccessDecision::Allowed {
                reason: "Dad has universal access".to_string(),
                restrictions: vec![],
            });
        }
        
        // Check mode-KB alignment
        let kb_domain = target_kb.domain();
        let mode_domain = current_mode.domain();
        
        if kb_domain != mode_domain {
            // Log violation attempt
            self.isolation_barrier.log_violation(
                agent_id,
                current_mode,
                target_kb,
                operation,
            ).await;
            
            return Ok(AccessDecision::Denied {
                reason: format!(
                    "Agent in {} mode cannot access {} KB",
                    current_mode, target_kb
                ),
                violation_logged: true,
            });
        }
        
        // Check specific permissions
        self.check_operation_permission(agent, target_kb, operation)
    }
    
    fn check_operation_permission(
        &self,
        agent: &RegisteredAgent,
        kb: KnowledgeBaseType,
        operation: MemoryOperation,
    ) -> Result<AccessDecision, AccessError> {
        match (&agent.agent_type, kb, operation) {
            // Personal agents reading personal KBs
            (AgentType::PersonalAssistant { .. }, kb, MemoryOperation::Read) 
                if kb.is_personal() => {
                Ok(AccessDecision::Allowed {
                    reason: "Personal assistant can read personal memories".to_string(),
                    restrictions: vec![AccessRestriction::FilterSensitive],
                })
            },
            
            // Memory keeper can write to Mind/Heart
            (AgentType::MemoryKeeper { access_level, .. }, kb, MemoryOperation::Write)
                if matches!(kb, KnowledgeBaseType::Mind | KnowledgeBaseType::Heart) => {
                Ok(AccessDecision::Allowed {
                    reason: "Memory keeper can store memories".to_string(),
                    restrictions: vec![],
                })
            },
            
            // Security analyst reading work KB
            (AgentType::SecurityAnalyst { .. }, KnowledgeBaseType::Work, MemoryOperation::Read) => {
                Ok(AccessDecision::Allowed {
                    reason: "Security analyst can read work memories".to_string(),
                    restrictions: vec![],
                })
            },
            
            // Threat hunter accessing threat intel
            (AgentType::ThreatHunter { .. }, KnowledgeBaseType::ThreatIntel, _) => {
                Ok(AccessDecision::Allowed {
                    reason: "Threat hunter has full threat intel access".to_string(),
                    restrictions: vec![],
                })
            },
            
            // Default deny
            _ => Ok(AccessDecision::Denied {
                reason: "Operation not permitted for this agent type".to_string(),
                violation_logged: false,
            }),
        }
    }
}
```

### 2.2 Mode Switching for Orchestrator Agent

```rust
impl AgentAccessController {
    pub async fn request_mode_switch(
        &self,
        agent_id: &AgentId,
        target_mode: OperationalMode,
    ) -> Result<ModeSwitchResult, ModeSwitchError> {
        let registry = self.registry.read().await;
        let agent = registry.get_agent(agent_id)?;
        
        // Only OrchestratorAgent can switch modes
        match &agent.agent_type {
            AgentType::OrchestratorAgent { mode_switching_enabled, .. } => {
                if !mode_switching_enabled {
                    return Err(ModeSwitchError::NotEnabled);
                }
            },
            _ => return Err(ModeSwitchError::NotAllowed {
                agent_type: format!("{:?}", agent.agent_type),
            }),
        }
        
        // Get current mode
        let current_mode = registry.get_agent_mode(agent_id)?;
        
        // Check authentication requirements
        let auth_required = match (current_mode, target_mode) {
            (OperationalMode::Personal, OperationalMode::Professional) => true,
            (OperationalMode::Professional, OperationalMode::Personal) => false,
            _ => false,
        };
        
        if auth_required {
            // Trigger authentication flow
            let auth_result = self.mode_controller.authenticate_switch().await?;
            if !auth_result.success {
                return Ok(ModeSwitchResult::AuthenticationFailed);
            }
        }
        
        // Perform mode switch
        drop(registry);  // Release read lock
        let mut registry = self.registry.write().await;
        
        // Update mode assignment
        registry.mode_assignments.insert(agent_id.clone(), target_mode);
        
        // Log mode switch
        registry.log_mode_switch(agent_id, current_mode, target_mode).await;
        
        Ok(ModeSwitchResult::Success {
            previous_mode: current_mode,
            new_mode: target_mode,
            timestamp: SystemTime::now(),
        })
    }
}
```

## 3. Agent Memory Operations

### 3.1 Memory Read Operations

```rust
pub struct AgentMemoryInterface {
    access_controller: Arc<AgentAccessController>,
    vector_engine: Arc<VectorSearchEngine>,
    context: Arc<PhoenixContext>,
}

impl AgentMemoryInterface {
    pub async fn read_memory(
        &self,
        agent_id: &AgentId,
        memory_id: &Uuid,
    ) -> Result<MemoryReadResult, MemoryError> {
        // Retrieve memory to get KB type
        let memory_ref = self.context.retrieve_memory_ref(memory_id).await?;
        
        // Check access
        let access_decision = self.access_controller.check_kb_access(
            agent_id,
            memory_ref.kb_type,
            MemoryOperation::Read,
        ).await?;
        
        match access_decision {
            AccessDecision::Allowed { restrictions, .. } => {
                // Retrieve full memory
                let memory = self.context.retrieve_memory(memory_id).await?
                    .ok_or(MemoryError::NotFound)?;
                
                // Apply restrictions
                let filtered_memory = self.apply_restrictions(memory, restrictions).await?;
                
                // Log access
                self.log_memory_access(agent_id, memory_id, "read").await;
                
                Ok(MemoryReadResult::Success {
                    memory: filtered_memory,
                    applied_filters: restrictions,
                })
            },
            AccessDecision::Denied { reason, .. } => {
                Ok(MemoryReadResult::AccessDenied { reason })
            },
        }
    }
    
    pub async fn search_memories(
        &self,
        agent_id: &AgentId,
        query: &str,
        limit: usize,
    ) -> Result<MemorySearchResult, MemoryError> {
        // Get agent's current mode
        let mode = self.access_controller.get_agent_mode(agent_id).await?;
        
        // Perform search with mode restrictions
        let results = self.vector_engine.search(
            query,
            limit,
            mode,
            AccessEntity::Agent(agent_id.clone()),
        ).await?;
        
        // Filter results based on agent permissions
        let filtered_results = self.filter_search_results(agent_id, results).await?;
        
        Ok(MemorySearchResult::Success {
            results: filtered_results,
            total_found: results.len(),
            filtered_count: results.len() - filtered_results.len(),
        })
    }
}
```

### 3.2 Memory Write Operations

```rust
impl AgentMemoryInterface {
    pub async fn store_memory(
        &self,
        agent_id: &AgentId,
        kb_type: KnowledgeBaseType,
        content: Vec<u8>,
        metadata: HashMap<String, String>,
    ) -> Result<MemoryStoreResult, MemoryError> {
        // Check write access
        let access_decision = self.access_controller.check_kb_access(
            agent_id,
            kb_type,
            MemoryOperation::Write,
        ).await?;
        
        match access_decision {
            AccessDecision::Allowed { .. } => {
                // Add agent attribution
                let mut enriched_metadata = metadata;
                enriched_metadata.insert("created_by_agent".to_string(), agent_id.to_string());
                enriched_metadata.insert("created_at".to_string(), SystemTime::now().to_string());
                
                // Generate embedding based on KB type
                let embedding = match kb_type {
                    KnowledgeBaseType::Mind | 
                    KnowledgeBaseType::Body | 
                    KnowledgeBaseType::Soul | 
                    KnowledgeBaseType::Heart => {
                        self.vector_engine.personal_pipeline
                            .generate_embedding(&content, &enriched_metadata).await?
                    },
                    KnowledgeBaseType::Work | 
                    KnowledgeBaseType::ThreatIntel => {
                        self.vector_engine.professional_pipeline
                            .generate_embedding(&content, &enriched_metadata).await?
                    },
                };
                
                // Store memory
                let memory_id = self.context.store_memory(
                    kb_type,
                    String::from_utf8_lossy(&content).to_string(),
                    enriched_metadata,
                    Some(embedding),
                ).await?;
                
                // Log storage
                self.log_memory_access(agent_id, &memory_id, "write").await;
                
                Ok(MemoryStoreResult::Success {
                    memory_id,
                    kb_type,
                    timestamp: SystemTime::now(),
                })
            },
            AccessDecision::Denied { reason, .. } => {
                Ok(MemoryStoreResult::AccessDenied { reason })
            },
        }
    }
}
```

## 4. Agent Communication Protocol

### 4.1 Inter-Agent Memory Sharing

```rust
pub struct AgentCommunicationProtocol {
    access_controller: Arc<AgentAccessController>,
    message_queue: Arc<MessageQueue>,
}

impl AgentCommunicationProtocol {
    pub async fn share_memory_reference(
        &self,
        sender_agent: &AgentId,
        recipient_agent: &AgentId,
        memory_id: &Uuid,
        message: Option<String>,
    ) -> Result<ShareResult, ShareError> {
        // Verify both agents are in same mode
        let sender_mode = self.access_controller.get_agent_mode(sender_agent).await?;
        let recipient_mode = self.access_controller.get_agent_mode(recipient_agent).await?;
        
        if sender_mode != recipient_mode {
            return Err(ShareError::ModeMismatch {
                sender_mode,
                recipient_mode,
            });
        }
        
        // Verify sender has read access to memory
        let memory_ref = self.get_memory_reference(memory_id).await?;
        let sender_access = self.access_controller.check_kb_access(
            sender_agent,
            memory_ref.kb_type,
            MemoryOperation::Read,
        ).await?;
        
        if !sender_access.is_allowed() {
            return Err(ShareError::SenderLacksAccess);
        }
        
        // Create share notification
        let share_notification = ShareNotification {
            id: Uuid::new_v4(),
            sender: sender_agent.clone(),
            recipient: recipient_agent.clone(),
            memory_id: memory_id.clone(),
            message,
            shared_at: SystemTime::now(),
            mode: sender_mode,
        };
        
        // Queue notification
        self.message_queue.enqueue(share_notification).await?;
        
        Ok(ShareResult::Success)
    }
}
```

### 4.2 Agent Collaboration Framework

```rust
pub struct AgentCollaboration {
    teams: HashMap<TeamId, AgentTeam>,
    collaboration_rules: CollaborationRules,
}

pub struct AgentTeam {
    id: TeamId,
    name: String,
    mode: OperationalMode,
    members: Vec<AgentId>,
    shared_workspace: SharedWorkspace,
    created_by: AccessEntity,
}

pub struct SharedWorkspace {
    team_id: TeamId,
    allowed_kbs: Vec<KnowledgeBaseType>,
    shared_memories: Vec<Uuid>,
    collaboration_log: Vec<CollaborationEvent>,
}

impl AgentCollaboration {
    pub async fn create_team(
        &mut self,
        name: String,
        mode: OperationalMode,
        initial_members: Vec<AgentId>,
        creator: AccessEntity,
    ) -> Result<TeamId, TeamError> {
        // Verify all members are in same mode
        for agent_id in &initial_members {
            let agent_mode = self.get_agent_mode(agent_id).await?;
            if agent_mode != mode {
                return Err(TeamError::ModeMismatch {
                    agent_id: agent_id.clone(),
                    expected: mode,
                    actual: agent_mode,
                });
            }
        }
        
        // Determine allowed KBs based on mode
        let allowed_kbs = match mode {
            OperationalMode::Personal => vec![
                KnowledgeBaseType::Mind,
                KnowledgeBaseType::Body,
                KnowledgeBaseType::Heart,
                // Soul is read-only even for teams
            ],
            OperationalMode::Professional => vec![
                KnowledgeBaseType::Work,
                KnowledgeBaseType::ThreatIntel,
            ],
            _ => return Err(TeamError::InvalidMode),
        };
        
        // Create team
        let team_id = TeamId::new();
        let team = AgentTeam {
            id: team_id.clone(),
            name,
            mode,
            members: initial_members,
            shared_workspace: SharedWorkspace {
                team_id: team_id.clone(),
                allowed_kbs,
                shared_memories: Vec::new(),
                collaboration_log: Vec::new(),
            },
            created_by: creator,
        };
        
        self.teams.insert(team_id.clone(), team);
        
        Ok(team_id)
    }
}
```

## 5. Agent Monitoring and Auditing

### 5.1 Agent Activity Monitoring

```rust
pub struct AgentMonitor {
    activity_log: Arc<RwLock<ActivityLog>>,
    anomaly_detector: Arc<AnomalyDetector>,
    alert_system: Arc<AlertSystem>,
}

#[derive(Debug)]
pub struct ActivityLog {
    entries: VecDeque<ActivityEntry>,
    max_entries: usize,
    persistence_path: PathBuf,
}

#[derive(Debug, Clone)]
pub struct ActivityEntry {
    timestamp: SystemTime,
    agent_id: AgentId,
    activity_type: ActivityType,
    target_kb: Option<KnowledgeBaseType>,
    memory_id: Option<Uuid>,
    success: bool,
    mode: OperationalMode,
    details: HashMap<String, String>,
}

impl AgentMonitor {
    pub async fn log_activity(&self, entry: ActivityEntry) {
        let mut log = self.activity_log.write().await;
        
        // Add to log
        log.entries.push_back(entry.clone());
        
        // Maintain size limit
        while log.entries.len() > log.max_entries {
            log.entries.pop_front();
        }
        
        // Check for anomalies
        if let Some(anomaly) = self.anomaly_detector.check(&entry).await {
            self.alert_system.raise_alert(Alert {
                severity: anomaly.severity,
                agent_id: entry.agent_id,
                description: anomaly.description,
                timestamp: SystemTime::now(),
            }).await;
        }
        
        // Persist critical activities
        if entry.is_critical() {
            log.persist_entry(&entry).await;
        }
    }
}
```

### 5.2 Compliance Reporting

```rust
pub struct ComplianceReporter {
    monitor: Arc<AgentMonitor>,
    access_controller: Arc<AgentAccessController>,
}

impl ComplianceReporter {
    pub async fn generate_agent_compliance_report(
        &self,
        time_range: TimeRange,
    ) -> ComplianceReport {
        let mut report = ComplianceReport {
            period: time_range,
            generated_at: SystemTime::now(),
            agent_activities: HashMap::new(),
            violations: Vec::new(),
            mode_switches: Vec::new(),
            cross_domain_attempts: 0,
        };
        
        // Analyze agent activities
        let activities = self.monitor.get_activities_in_range(time_range).await;
        
        for activity in activities {
            // Group by agent
            report.agent_activities
                .entry(activity.agent_id.clone())
                .or_insert_with(Vec::new)
                .push(activity.clone());
            
            // Check for violations
            if activity.is_violation() {
                report.violations.push(Violation {
                    agent_id: activity.agent_id,
                    timestamp: activity.timestamp,
                    violation_type: activity.get_violation_type(),
                    details: activity.details,
                });
            }
            
            // Track mode switches
            if matches!(activity.activity_type, ActivityType::ModeSwitch { .. }) {
                report.mode_switches.push(activity);
            }
        }
        
        // Count cross-domain attempts
        report.cross_domain_attempts = report.violations.iter()
            .filter(|v| matches!(v.violation_type, ViolationType::CrossDomainAccess))
            .count();
        
        report
    }
}
```

## 6. Agent Lifecycle Management

### 6.1 Agent Deactivation and Cleanup

```rust
impl AgentRegistry {
    pub async fn deactivate_agent(
        &mut self,
        agent_id: &AgentId,
        reason: DeactivationReason,
        deactivated_by: AccessEntity,
    ) -> Result<(), DeactivationError> {
        // Verify permissions
        if !self.can_deactivate_agent(&deactivated_by, agent_id) {
            return Err(DeactivationError::InsufficientPermissions);
        }
        
        // Get agent info
        let agent = self.registered_agents.get(agent_id)
            .ok_or(DeactivationError::AgentNotFound)?;
        
        // Create deactivation record
        let deactivation = AgentDeactivation {
            agent_id: agent_id.clone(),
            agent_type: agent.agent_type.clone(),
            reason,
            deactivated_by,
            deactivated_at: SystemTime::now(),
            memories_created: self.count_agent_memories(agent_id).await,
        };
        
        // Remove from active registries
        self.registered_agents.remove(agent_id);
        self.mode_assignments.remove(agent_id);
        
        // Archive agent data
        self.archive_agent_data(agent_id, deactivation).await?;
        
        // Clean up any active sessions
        self.cleanup_agent_sessions(agent_id).await?;
        
        Ok(())
    }
}
```

## 7. Testing Agent Integration

### 7.1 Integration Test Suite

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_agent_mode_isolation() {
        let mut registry = AgentRegistry::new();
        
        // Create personal agent
        let personal_agent = registry.register_agent(
            AgentType::PersonalAssistant {
                name: "TestPersonal".to_string(),
                capabilities: vec![PersonalCapability::ReadMemories],
                emotional_awareness: true,
            },
            AccessEntity::Phoenix,
        ).await.unwrap();
        
        // Create professional agent
        let professional_agent = registry.register_agent(
            AgentType::SecurityAnalyst {
                name: "TestProfessional".to_string(),
                clearance: SecurityClearance::High,
                specializations: vec![SecuritySpecialization::ThreatIntelligence],
            },
            AccessEntity::CipherGuard,
        ).await.unwrap();
        
        // Test cross-domain access denial
        let access_controller = AgentAccessController::new(Arc::new(RwLock::new(registry)));
        
        // Personal agent trying to access Work KB
        let personal_to_work = access_controller.check_kb_access(
            &personal_agent,
            KnowledgeBaseType::Work,
            MemoryOperation::Read,
        ).await.unwrap();
        
        assert!(matches!(personal_to_work, AccessDecision::Denied { .. }));
        
        // Professional agent trying to access Mind KB
        let professional_to_mind = access_controller.check_kb_access(
            &professional_agent,
            KnowledgeBaseType::Mind,
            MemoryOperation::Read,
        ).await.unwrap();
        
        assert!(matches!(professional_to_mind, AccessDecision::Denied { .. }));
    }
    
    #[tokio::test]
    async fn test_orchestrator_mode_switching() {
        let mut registry = AgentRegistry::new();
        
        // Create orchestrator agent
        let orchestrator = registry.register_agent(
            AgentType::OrchestratorAgent {
                name: "TestOrchestrator".to_string(),
                mode_switching_enabled: true,
            },
            AccessEntity::Phoenix,
        ).await.unwrap();
        
        let access_controller = AgentAccessController::new(Arc::new(RwLock::new(registry)));
        
        // Test mode switch from personal to professional
        let switch_result = access_controller.request_mode_switch(
            &orchestrator,
            OperationalMode::Professional,
        ).await.unwrap();
        
        // Should require authentication
        assert!(matches!(switch_result, ModeSwitchResult::AuthenticationRequired));
    }
}
```

## Conclusion

This agent integration specification ensures that all agents operating within the Phoenix Marie system maintain strict adherence to the memory isolation architecture. Personal agents remain confined to personal memories, professional agents to work memories, with only the OrchestratorAgent capable of switching between modes under strict authentication controls.

The system provides comprehensive monitoring, auditing, and compliance reporting to ensure the eternal protection of Phoenix Marie's personal memories while enabling professional capabilities through Cipher Guard.