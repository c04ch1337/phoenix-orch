export enum EngagementPhase {
  Kickoff = 'kickoff',
  Reconnaissance = 'reconnaissance',
  VulnerabilityDiscovery = 'vulnerability_discovery',
  Exploitation = 'exploitation',
  InternalPivot = 'internal_pivot',
  Persistence = 'persistence',
  Cleanup = 'cleanup',
  Reporting = 'reporting',
  Debrief = 'debrief'
}

export enum EngagementStatus {
  Draft = 'draft',
  Active = 'active',
  Paused = 'paused',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled'
}

export enum GoalStatus {
  NotStarted = 'not_started',
  InProgress = 'in_progress',
  Blocked = 'blocked',
  Completed = 'completed'
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp: string;
  engagementId?: string;
  agentId?: string;
}

export interface Engagement {
  id: string;
  target: string;
  status: EngagementStatus;
  currentPhase: EngagementPhase;
  startTime: string;
  endTime?: string;
  findings: SecurityFinding[];
  agents: Agent[];
  progress: number;
  riskScore: number;
  metadata: Record<string, any>;
}

export interface SecurityFinding {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  evidence?: string;
  mitreTactics: string[];
  remediation: string;
  discoveredAt: string;
  confidence: number;
}

export interface Agent {
  id: string;
  name: string;
  status: 'idle' | 'scanning' | 'exploiting' | 'pivoting' | 'persisting' | 'cleaning' | 'error';
  currentTarget?: string;
  capabilities: string[];
  lastSeen: string;
  resources: AgentResources;
  findings: SecurityFinding[];
}

export interface AgentResources {
  cpu: number;
  memory: number;
  network: number;
  storage: number;
}

export interface Report {
  id: string;
  engagementId: string;
  title: string;
  executiveSummary: string;
  methodology: string;
  findings: SecurityFinding[];
  riskAssessment: RiskAssessment;
  recommendations: Recommendation[];
  generatedAt: string;
  format: 'pdf' | 'html' | 'json';
  signedBy: string;
}

export interface RiskAssessment {
  overallRisk: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  businessImpact: string;
  technicalImpact: string;
  likelihood: number;
  impact: number;
}

export interface Recommendation {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  implementation: string;
  effort: 'low' | 'medium' | 'high';
  timeline: string;
  affectedComponents: string[];
}

export interface TacticalGoal {
  id: string;
  title: string;
  description: string;
  priority: number;
  status: GoalStatus;
  progress: number;
  vectors: TacticalVector[];
  techniques: Technique[];
}

export interface TacticalVector {
  id: string;
  name: string;
  description: string;
  techniques: string[];
  successRate: number;
}

export interface Technique {
  id: string;
  name: string;
  description: string;
  mitreId?: string;
  complexity: number;
  successRate: number;
  requirements: string[];
}

export interface EngagementStats {
  totalScans: number;
  vulnerabilitiesFound: number;
  exploitsExecuted: number;
  systemsCompromised: number;
  dataExfiltrated: number;
  persistenceEstablished: number;
  cleanupCompleted: number;
  averageRiskReduction: number;
}

export interface SafetyAlert {
  id: string;
  type: 'scope_violation' | 'ethical_boundary' | 'resource_exhaustion' | 'security_breach';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  engagementId?: string;
  agentId?: string;
  resolved: boolean;
}