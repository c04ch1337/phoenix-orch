export interface Engagement {
  id: string;
  target: string;
  status: EngagementStatus;
  currentPhase: EngagementPhase;
  findings: SecurityFinding[];
  agents: Agent[];
  startTime: string;
  endTime?: string;
  riskScore: number;
}

export enum EngagementPhase {
  Kickoff = "kickoff",
  Reconnaissance = "reconnaissance",
  VulnerabilityDiscovery = "vulnerability_discovery",
  Exploitation = "exploitation",
  InternalPivot = "internal_pivot",
  Persistence = "persistence",
  Cleanup = "cleanup",
  Reporting = "reporting",
  Debrief = "debrief"
}

export enum EngagementStatus {
  Draft = "draft",
  Active = "active",
  Paused = "paused",
  Completed = "completed",
  Failed = "failed"
}

export interface SecurityFinding {
  id: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  evidence: string[];
  remediation: string;
  cvssScore: number;
  mitreTactics: string[];
  discoveredAt: string;
  status: FindingStatus;
}

export enum FindingSeverity {
  Critical = "critical",
  High = "high",
  Medium = "medium",
  Low = "low",
  Info = "info"
}

export enum FindingStatus {
  New = "new",
  Investigating = "investigating",
  Confirmed = "confirmed",
  Remediated = "remediated",
  RiskAccepted = "risk_accepted"
}

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  target: string;
  deploymentTime: string;
  lastHeartbeat: string;
  commandsExecuted: number;
  findingsDiscovered: number;
}

export enum AgentType {
  Reconnaissance = "reconnaissance",
  Exploitation = "exploitation",
  Persistence = "persistence",
  Cleanup = "cleanup",
  MultiPurpose = "multi_purpose"
}

export enum AgentStatus {
  Deploying = "deploying",
  Active = "active",
  Idle = "idle",
  Terminated = "terminated",
  Error = "error"
}

export interface Report {
  id: string;
  engagementId: string;
  type: ReportType;
  format: ReportFormat;
  generatedAt: string;
  downloadUrl?: string;
}

export enum ReportType {
  Executive = "executive",
  Technical = "technical",
  Remediation = "remediation",
  Comprehensive = "comprehensive"
}

export enum ReportFormat {
  PDF = "pdf",
  HTML = "html",
  Markdown = "markdown",
  JSON = "json"
}

export interface WebSocketMessage {
  type: string;
  engagementId?: string;
  agentId?: string;
  findingId?: string;
  reportId?: string;
  data: any;
  timestamp: string;
}

export interface PhaseProgress {
  phase: EngagementPhase;
  progress: number;
  estimatedCompletion?: string;
  findingsThisPhase: number;
}

export interface Opportunity {
  id: string;
  target: string;
  confidence: number;
  potentialImpact: number;
  exploitationComplexity: number;
  recommendedAction: string;
  discoveredAt: string;
}

export interface TacticalGoal {
  id: string;
  title: string;
  description: string;
  priority: number;
  status: GoalStatus;
  vectors: TacticalVector[];
  techniques: Technique[];
  progress: number;
}

export enum GoalStatus {
  NotStarted = "not_started",
  InProgress = "in_progress",
  Completed = "completed",
  Blocked = "blocked"
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