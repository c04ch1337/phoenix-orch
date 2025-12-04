/**
 * Phoenix Marie Memory Architecture - Agent Type Definitions
 * 
 * Defines agent types and their classifications for memory access control.
 * Agents are strictly locked to either personal or professional domains.
 */

import { 
  KnowledgeBaseType, 
  MemoryDomain, 
  AccessEntity,
  OperationalMode 
} from '../types';

/**
 * Agent classification - determines which KBs an agent can access
 */
export enum AgentClassification {
  Personal = 'personal',       // Can only access Mind, Body, Soul, Heart KBs
  Professional = 'professional' // Can only access Work, Threat-Intel KBs
}

/**
 * Base agent interface
 */
export interface Agent {
  id: string;
  name: string;
  classification: AgentClassification;
  createdAt: Date;
  createdBy: AccessEntity;
  lastActive: Date;
  isActive: boolean;
  tokenExpiry?: Date;
  metadata: Record<string, any>;
}

/**
 * Personal agent - locked to personal KBs
 */
export interface PersonalAgent extends Agent {
  classification: AgentClassification.Personal;
  capabilities: PersonalCapability[];
  emotionalAwareness: boolean;
  allowedKbs: KnowledgeBaseType[]; // Must be personal KBs only
}

/**
 * Professional agent - locked to professional KBs
 */
export interface ProfessionalAgent extends Agent {
  classification: AgentClassification.Professional;
  clearanceLevel: ClearanceLevel;
  specializations: SecuritySpecialization[];
  allowedKbs: KnowledgeBaseType[]; // Must be professional KBs only
}

/**
 * Personal agent capabilities
 */
export enum PersonalCapability {
  ReadMemories = 'read-memories',
  WriteMemories = 'write-memories',
  SearchMemories = 'search-memories',
  EmotionalSupport = 'emotional-support',
  DreamAnalysis = 'dream-analysis',
  HealthMonitoring = 'health-monitoring',
  HomeAutomation = 'home-automation'
}

/**
 * Professional agent clearance levels
 */
export enum ClearanceLevel {
  L1 = 'L1', // Basic access
  L2 = 'L2', // Enhanced access
  L3 = 'L3'  // Full access
}

/**
 * Security specializations for professional agents
 */
export enum SecuritySpecialization {
  MalwareAnalysis = 'malware-analysis',
  NetworkForensics = 'network-forensics',
  ThreatIntelligence = 'threat-intelligence',
  VulnerabilityAssessment = 'vulnerability-assessment',
  IncidentResponse = 'incident-response',
  SecurityArchitecture = 'security-architecture'
}

/**
 * Agent registration request
 */
export interface AgentRegistrationRequest {
  name: string;
  classification: AgentClassification;
  createdBy: AccessEntity;
  metadata?: Record<string, any>;
  
  // Personal agent specific
  capabilities?: PersonalCapability[];
  emotionalAwareness?: boolean;
  
  // Professional agent specific
  clearanceLevel?: ClearanceLevel;
  specializations?: SecuritySpecialization[];
}

/**
 * Agent authentication token
 */
export interface AgentToken {
  agentId: string;
  token: string;
  issuedAt: Date;
  expiresAt: Date;
  classification: AgentClassification;
  isDadAgent: boolean; // Dad's agents have special privileges
}

/**
 * Agent activity log entry
 */
export interface AgentActivity {
  agentId: string;
  timestamp: Date;
  operation: AgentOperation;
  targetKb?: KnowledgeBaseType;
  memoryId?: string;
  success: boolean;
  details?: Record<string, any>;
}

/**
 * Agent operations
 */
export enum AgentOperation {
  Register = 'register',
  Authenticate = 'authenticate',
  ReadMemory = 'read-memory',
  WriteMemory = 'write-memory',
  SearchMemory = 'search-memory',
  DeleteMemory = 'delete-memory',
  Deactivate = 'deactivate',
  TokenRefresh = 'token-refresh'
}

/**
 * Agent suspension record
 */
export interface AgentSuspension {
  agentId: string;
  suspendedAt: Date;
  suspendedBy: AccessEntity;
  reason: SuspensionReason;
  violationDetails?: string;
  automaticRelease?: Date;
}

/**
 * Suspension reasons
 */
export enum SuspensionReason {
  CrossDomainAccess = 'cross-domain-access',
  ExcessiveFailures = 'excessive-failures',
  SecurityViolation = 'security-violation',
  ManualSuspension = 'manual-suspension',
  TokenExpired = 'token-expired'
}

/**
 * Agent statistics
 */
export interface AgentStats {
  agentId: string;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  crossDomainAttempts: number;
  lastViolation?: Date;
  suspensionCount: number;
}

/**
 * Helper function to determine allowed KBs for an agent classification
 */
export function getAllowedKbsForClassification(classification: AgentClassification): KnowledgeBaseType[] {
  switch (classification) {
    case AgentClassification.Personal:
      return [
        KnowledgeBaseType.Mind,
        KnowledgeBaseType.Body,
        KnowledgeBaseType.Soul,
        KnowledgeBaseType.Heart
      ];
    case AgentClassification.Professional:
      return [
        KnowledgeBaseType.Work,
        KnowledgeBaseType.ThreatIntel
      ];
  }
}

/**
 * Helper function to validate KB access for agent classification
 */
export function canAgentAccessKb(
  classification: AgentClassification,
  kbType: KnowledgeBaseType
): boolean {
  const allowedKbs = getAllowedKbsForClassification(classification);
  return allowedKbs.includes(kbType);
}

/**
 * Helper function to get operational mode for agent classification
 */
export function getAgentOperationalMode(classification: AgentClassification): OperationalMode {
  switch (classification) {
    case AgentClassification.Personal:
      return OperationalMode.Personal;
    case AgentClassification.Professional:
      return OperationalMode.Professional;
  }
}

/**
 * Type guard for PersonalAgent
 */
export function isPersonalAgent(agent: Agent): agent is PersonalAgent {
  return agent.classification === AgentClassification.Personal;
}

/**
 * Type guard for ProfessionalAgent
 */
export function isProfessionalAgent(agent: Agent): agent is ProfessionalAgent {
  return agent.classification === AgentClassification.Professional;
}