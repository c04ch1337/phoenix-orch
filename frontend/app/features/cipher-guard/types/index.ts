// Cipher Guard Type Definitions

export interface DefenseEngagement {
  id: string;
  clientName: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  effectivenessScore: number;
  threatsDetected: number;
  incidentsReported: number;
}

export interface IncidentReport {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  reportedAt: Date;
  assignedTo?: string;
  evidenceCount: number;
}

export interface EvidenceItem {
  id: string;
  type: 'log' | 'network' | 'file' | 'memory' | 'system';
  description: string;
  collectedAt: Date;
  collector: string;
  hash: string;
  chainOfCustody: ChainOfCustodyEntry[];
}

export interface ChainOfCustodyEntry {
  timestamp: Date;
  action: 'collected' | 'transferred' | 'analyzed' | 'archived';
  performedBy: string;
  location: string;
  notes?: string;
}

export interface DefenseMatrix {
  killChainPhases: KillChainPhase[];
  controlTypes: ControlType[];
  mitigationFramework: MitigationCategory[];
}

export interface KillChainPhase {
  id: string;
  name: string;
  description: string;
  detectionMechanisms: string[];
  preventionControls: string[];
  responseProcedures: string[];
  effectivenessScore: number;
}

export interface ControlType {
  type: 'preventive' | 'detective' | 'corrective' | 'compensating';
  name: string;
  description: string;
  implementationStatus: 'planned' | 'implemented' | 'optimized';
  effectivenessRating: number;
}

export interface MitigationCategory {
  category: 'identify' | 'protect' | 'detect' | 'respond' | 'recover';
  controls: MitigationControl[];
}

export interface MitigationControl {
  id: string;
  name: string;
  description: string;
  status: 'not_implemented' | 'partial' | 'full';
}

export interface VulnerabilityMap {
  vulnerabilities: Vulnerability[];
  defenses: DefensePosture[];
  threatActors: ThreatActor[];
  attackVectors: AttackVector[];
}

export interface Vulnerability {
  cveId: string;
  description: string;
  cvssScore: number;
  affectedSystems: string[];
  exploitAvailability: 'none' | 'public' | 'private';
  patchStatus: 'unpatched' | 'partial' | 'fully_patched';
}

export interface DefensePosture {
  vulnerabilityId: string;
  preventiveControls: string[];
  detectiveControls: string[];
  correctiveControls: string[];
  effectivenessScore: number;
  coveragePercentage: number;
}

export interface ThreatActor {
  name: string;
  motivation: string;
  capabilities: string[];
  targets: string[];
  tactics: string[];
}

export interface AttackVector {
  name: string;
  description: string;
  complexity: 'low' | 'medium' | 'high';
  prerequisites: string[];
  detectionDifficulty: 'easy' | 'moderate' | 'difficult';
}

export interface BlueTeamAgent {
  id: string;
  type: AgentType;
  name: string;
  status: 'available' | 'busy' | 'offline';
  capabilities: string[];
  currentTask?: string;
  performanceScore: number;
}

export type AgentType = 
  | 'soc_analyst'
  | 'threat_hunter'
  | 'incident_responder'
  | 'forensic_specialist'
  | 'compliance_auditor'
  | 'system_hardener'
  | 'recovery_specialist';

export interface DefenseReport {
  id: string;
  title: string;
  format: 'pdf' | 'word' | 'html' | 'markdown';
  generatedAt: Date;
  status: 'generating' | 'completed' | 'failed';
  downloadUrl?: string;
}

export interface ClientInfo {
  name: string;
  industry: string;
  complianceFrameworks: string[];
  riskTolerance: number; // 0-100
}