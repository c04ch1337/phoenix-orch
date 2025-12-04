// Cipher Guard Types

// Defense Phases
export enum DefensePhase {
  Monitoring = 'Monitoring',
  Detection = 'Detection',
  Triage = 'Triage',
  Investigation = 'Investigation',
  Containment = 'Containment',
  Eradication = 'Eradication',
  Recovery = 'Recovery',
  LessonsLearned = 'LessonsLearned',
  Reporting = 'Reporting'
}

// WebSocket Message Types
export type CipherGuardMessageType = 
  | 'defense_start'
  | 'incident_detected'
  | 'phase_transition' 
  | 'evidence_collected'
  | 'containment_applied'
  | 'eradication_completed'
  | 'recovery_verified'
  | 'report_generated'
  | 'asset_update'
  | 'new_threat'
  | 'status_update'
  | 'telemetry_batch'
  | 'agent_status_update'
  | 'agent_command_response'
  | 'agent_registered'
  | 'agent_deregistered'
  | 'deploy_agent';

// WebSocket Message Interface
export interface CipherGuardWebSocketMessage {
  type: CipherGuardMessageType;
  defense_id: string;
  phase?: DefensePhase;
  data: any;
  timestamp: number;
  signature?: string; // Phoenix ORCH signature
}

// Security Incident Interface
export interface SecurityIncident {
  id: string;
  timestamp: number;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'investigating' | 'contained' | 'remediated' | 'closed';
  affectedAssets: string[];
  detectionSource: string;
  threatActors?: string[];
  techniques?: string[]; // MITRE ATT&CK techniques
  tactics?: string[]; // MITRE ATT&CK tactics
  indicators?: IndicatorOfCompromise[];
  timeline?: IncidentTimelineEvent[];
}

// Indicator of Compromise
export interface IndicatorOfCompromise {
  id: string;
  type: 'file_hash' | 'ip_address' | 'domain' | 'url' | 'email' | 'registry' | 'process';
  value: string;
  context: string;
  confidence: 'low' | 'medium' | 'high';
}

// Incident Timeline Event
export interface IncidentTimelineEvent {
  timestamp: number;
  actorType: 'threat_actor' | 'system' | 'defender';
  description: string;
  phase: DefensePhase;
  relatedAssets?: string[];
  evidenceIds?: string[];
}

// Defense System
export interface DefenseSystem {
  id: string;
  name: string;
  type: 'prevention' | 'detection' | 'response';
  status: 'active' | 'inactive' | 'degraded';
  capabilities: string[];
  configurations?: Record<string, any>;
}

// Client Scope (defines operational boundaries)
export interface ClientScope {
  id: string;
  name: string;
  assets: ClientAsset[];
  boundaries: OperationalBoundary[];
  legalAuthorizations: string[];
  exclusions: string[];
}

// Client Asset
export interface ClientAsset {
  id: string;
  name: string;
  type: 'server' | 'workstation' | 'network_device' | 'iot' | 'cloud_resource' | 'neuralink' | 'starlink';
  ipAddresses?: string[];
  macAddresses?: string[];
  hostname?: string;
  operatingSystem?: string;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  owner?: string;
  location?: string;
  tags: string[];
}

// Operational Boundary
export interface OperationalBoundary {
  id: string;
  type: 'network' | 'geographic' | 'logical' | 'organizational';
  description: string;
  value: string;
}

// Evidence Vault
export interface EvidenceVault {
  id: string;
  defenseId: string;
  evidenceItems: Evidence[];
  chainOfCustody: ChainOfCustodyEvent[];
  immutabilityProofs: ImmutabilityProof[];
}

// Evidence Item
export interface Evidence {
  id: string;
  type: 'memory_dump' | 'disk_image' | 'network_capture' | 'log_file' | 'screenshot';
  timestamp: number;
  source: string;
  format: string;
  size: number;
  hash: string;
  storagePath: string;
  metadata: Record<string, any>;
}

// Chain of Custody Event
export interface ChainOfCustodyEvent {
  evidenceId: string;
  timestamp: number;
  actor: string;
  action: 'created' | 'accessed' | 'modified' | 'transferred' | 'deleted';
  details: string;
  verificationHash: string;
}

// Immutability Proof
export interface ImmutabilityProof {
  evidenceId: string;
  timestamp: number;
  proofType: 'hash_chain' | 'digital_signature' | 'blockchain';
  proof: string;
  verificationMethod: string;
}

// Defense Engagement
export interface DefenseEngagement {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  currentPhase: DefensePhase;
  phaseHistory: PhaseTransition[];
  incidents: SecurityIncident[];
  clientScope: ClientScope;
  evidenceVaultId: string;
  summary?: string;
  metrics: DefenseMetrics;
}

// Phase Transition
export interface PhaseTransition {
  fromPhase: DefensePhase;
  toPhase: DefensePhase;
  timestamp: number;
  reason: string;
  decisionMaker: string;
}

// Defense Metrics
export interface DefenseMetrics {
  meanTimeToDetection?: number;
  meanTimeToContainment?: number;
  meanTimeToRemediation?: number;
  threatsCaptured: number;
  falsePositives: number;
  incidentCount: number;
  criticalVulnerabilities: number;
  systemCoverage: number;
  mitreCoverage: number;
}

// Strategic Defense Matrix
export interface StrategicDefenseMatrix {
  killChainPhases: KillChainPhaseStatus[];
  controlTypes: SecurityControl[];
  mitigationFrameworks: MitigationFramework[];
}

// Kill Chain Phase Status
export interface KillChainPhaseStatus {
  phase: string;
  covered: boolean;
  controls: string[];
  detectionCapability: number; // 0-100%
  preventionCapability: number; // 0-100%
  responseCapability: number; // 0-100%
}

// Security Control
export interface SecurityControl {
  id: string;
  name: string;
  type: 'preventive' | 'detective' | 'corrective';
  implementation: 'technical' | 'administrative' | 'physical';
  status: 'implemented' | 'partial' | 'planned' | 'not_implemented';
  effectiveness: number; // 0-100%
  coverage: string[]; // List of assets or asset types
}

// Mitigation Framework
export interface MitigationFramework {
  name: string; // e.g., "NIST CSF", "CIS Controls"
  version: string;
  controls: Record<string, MitigationControl>;
  complianceScore: number; // 0-100%
}

// Mitigation Control
export interface MitigationControl {
  id: string;
  name: string;
  description: string;
  implemented: boolean;
  mappedControls: string[]; // IDs of security controls
  evidence?: string[];
}

// Defense Timeline
export interface DefenseTimeline {
  id: string;
  defenseId: string;
  events: TimelineEvent[];
}

// Timeline Event
export interface TimelineEvent {
  id: string;
  timestamp: number;
  category: 'system' | 'threat' | 'defense' | 'asset' | 'user';
  title: string;
  description: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  relatedEntities: string[];
  evidenceIds?: string[];
  metadata: Record<string, any>;
}

// Phoenix Signature
export interface PhoenixSignature {
  signed_by: string;
  timestamp: Date;
  digital_signature: string;
  verification_url: string;
  message: string;
}