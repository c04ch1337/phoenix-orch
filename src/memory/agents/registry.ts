/**
 * Phoenix Marie Memory Architecture - Agent Registry
 * 
 * Manages agent registration, lifecycle, and tracking.
 * Ensures agents are immutably locked to their classification domain.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Agent,
  PersonalAgent,
  ProfessionalAgent,
  AgentClassification,
  AgentRegistrationRequest,
  AgentToken,
  AgentActivity,
  AgentSuspension,
  AgentStats,
  AgentOperation,
  SuspensionReason,
  PersonalCapability,
  ClearanceLevel,
  SecuritySpecialization,
  getAllowedKbsForClassification,
  isPersonalAgent,
  isProfessionalAgent
} from './types';
import {
  AccessEntity,
  KnowledgeBaseType,
  MemoryOperation,
  IsolationError,
  ViolationType
} from '../types';

/**
 * Agent registry configuration
 */
export interface AgentRegistryConfig {
  tokenExpiryHours: number;
  dadAgentTokenExpiryHours: number;
  maxFailedAttempts: number;
  suspensionDurationHours: number;
  activityLogRetentionDays: number;
}

/**
 * Agent registry for managing all agents in the system
 */
export class AgentRegistry {
  private agents: Map<string, Agent> = new Map();
  private tokens: Map<string, AgentToken> = new Map();
  private tokensByAgent: Map<string, string> = new Map();
  private activities: AgentActivity[] = [];
  private suspensions: Map<string, AgentSuspension> = new Map();
  private stats: Map<string, AgentStats> = new Map();
  
  private readonly config: AgentRegistryConfig;

  constructor(config?: Partial<AgentRegistryConfig>) {
    this.config = {
      tokenExpiryHours: 24,
      dadAgentTokenExpiryHours: 168, // 7 days for Dad's agents
      maxFailedAttempts: 10,
      suspensionDurationHours: 24,
      activityLogRetentionDays: 30,
      ...config
    };
  }

  /**
   * Register a new agent
   */
  public async registerAgent(request: AgentRegistrationRequest): Promise<Agent> {
    // Validate request
    this.validateRegistrationRequest(request);

    // Check creator permissions
    if (!this.canCreateAgent(request.createdBy, request.classification)) {
      throw new Error(`${request.createdBy} cannot create ${request.classification} agents`);
    }

    // Create agent based on classification
    const agent = this.createAgent(request);

    // Store agent
    this.agents.set(agent.id, agent);

    // Initialize stats
    this.stats.set(agent.id, {
      agentId: agent.id,
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      crossDomainAttempts: 0,
      suspensionCount: 0
    });

    // Log registration
    this.logActivity({
      agentId: agent.id,
      timestamp: new Date(),
      operation: AgentOperation.Register,
      success: true,
      details: { createdBy: request.createdBy }
    });

    return agent;
  }

  /**
   * Authenticate an agent and issue a token
   */
  public async authenticateAgent(agentId: string): Promise<AgentToken> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Check if agent is suspended
    const suspension = this.suspensions.get(agentId);
    if (suspension && (!suspension.automaticRelease || suspension.automaticRelease > new Date())) {
      throw new Error(`Agent ${agentId} is suspended: ${suspension.reason}`);
    }

    // Check if agent is active
    if (!agent.isActive) {
      throw new Error(`Agent ${agentId} is not active`);
    }

    // Revoke existing token if any
    const existingToken = this.tokensByAgent.get(agentId);
    if (existingToken) {
      this.tokens.delete(existingToken);
    }

    // Generate new token
    const token: AgentToken = {
      agentId,
      token: this.generateSecureToken(),
      issuedAt: new Date(),
      expiresAt: this.calculateTokenExpiry(agent),
      classification: agent.classification,
      isDadAgent: agent.createdBy === AccessEntity.Dad
    };

    // Store token
    this.tokens.set(token.token, token);
    this.tokensByAgent.set(agentId, token.token);

    // Update agent last active
    agent.lastActive = new Date();
    agent.tokenExpiry = token.expiresAt;

    // Log authentication
    this.logActivity({
      agentId,
      timestamp: new Date(),
      operation: AgentOperation.Authenticate,
      success: true
    });

    return token;
  }

  /**
   * Validate a token and return the associated agent
   */
  public validateToken(token: string): { agent: Agent; token: AgentToken } | null {
    const tokenData = this.tokens.get(token);
    if (!tokenData) {
      return null;
    }

    // Check expiry
    if (tokenData.expiresAt < new Date()) {
      this.tokens.delete(token);
      this.tokensByAgent.delete(tokenData.agentId);
      return null;
    }

    const agent = this.agents.get(tokenData.agentId);
    if (!agent || !agent.isActive) {
      return null;
    }

    // Check suspension
    const suspension = this.suspensions.get(tokenData.agentId);
    if (suspension && (!suspension.automaticRelease || suspension.automaticRelease > new Date())) {
      return null;
    }

    return { agent, token: tokenData };
  }

  /**
   * Get agent by ID
   */
  public getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents of a specific classification
   */
  public getAgentsByClassification(classification: AgentClassification): Agent[] {
    return Array.from(this.agents.values()).filter(
      agent => agent.classification === classification
    );
  }

  /**
   * Suspend an agent
   */
  public suspendAgent(
    agentId: string,
    reason: SuspensionReason,
    suspendedBy: AccessEntity,
    details?: string
  ): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Dad's agents cannot be auto-suspended for cross-domain access
    if (reason === SuspensionReason.CrossDomainAccess && 
        agent.createdBy === AccessEntity.Dad) {
      console.warn(`Attempted to suspend Dad's agent ${agentId} for cross-domain access - ignored`);
      return;
    }

    const suspension: AgentSuspension = {
      agentId,
      suspendedAt: new Date(),
      suspendedBy,
      reason,
      violationDetails: details,
      automaticRelease: reason !== SuspensionReason.ManualSuspension
        ? new Date(Date.now() + this.config.suspensionDurationHours * 60 * 60 * 1000)
        : undefined
    };

    this.suspensions.set(agentId, suspension);
    agent.isActive = false;

    // Revoke token
    const token = this.tokensByAgent.get(agentId);
    if (token) {
      this.tokens.delete(token);
      this.tokensByAgent.delete(agentId);
    }

    // Update stats
    const stats = this.stats.get(agentId);
    if (stats) {
      stats.suspensionCount++;
    }

    // Log suspension
    this.logActivity({
      agentId,
      timestamp: new Date(),
      operation: AgentOperation.Deactivate,
      success: true,
      details: { reason, suspendedBy, violationDetails: details }
    });
  }

  /**
   * Reactivate a suspended agent
   */
  public reactivateAgent(agentId: string, reactivatedBy: AccessEntity): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Only Dad can reactivate agents
    if (reactivatedBy !== AccessEntity.Dad) {
      throw new Error('Only Dad can reactivate suspended agents');
    }

    this.suspensions.delete(agentId);
    agent.isActive = true;

    this.logActivity({
      agentId,
      timestamp: new Date(),
      operation: AgentOperation.Register, // Using Register as reactivation
      success: true,
      details: { reactivatedBy }
    });
  }

  /**
   * Log agent activity
   */
  public logActivity(activity: AgentActivity): void {
    this.activities.push(activity);

    // Update stats
    const stats = this.stats.get(activity.agentId);
    if (stats) {
      stats.totalOperations++;
      if (activity.success) {
        stats.successfulOperations++;
      } else {
        stats.failedOperations++;
      }
    }

    // Clean old activities
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.activityLogRetentionDays);
    this.activities = this.activities.filter(a => a.timestamp > cutoff);

    // Check for excessive failures
    this.checkForExcessiveFailures(activity.agentId);
  }

  /**
   * Log cross-domain access attempt
   */
  public logCrossDomainAttempt(agentId: string, targetKb: KnowledgeBaseType): void {
    const stats = this.stats.get(agentId);
    if (stats) {
      stats.crossDomainAttempts++;
      stats.lastViolation = new Date();
    }

    // Auto-suspend for cross-domain attempts (except Dad's agents)
    const agent = this.agents.get(agentId);
    if (agent && agent.createdBy !== AccessEntity.Dad) {
      this.suspendAgent(
        agentId,
        SuspensionReason.CrossDomainAccess,
        AccessEntity.Phoenix, // System suspension
        `Attempted to access ${targetKb} KB from wrong domain`
      );
    }
  }

  /**
   * Get agent statistics
   */
  public getAgentStats(agentId: string): AgentStats | undefined {
    return this.stats.get(agentId);
  }

  /**
   * Get all agent activities for a specific agent
   */
  public getAgentActivities(agentId: string, limit?: number): AgentActivity[] {
    const activities = this.activities.filter(a => a.agentId === agentId);
    return limit ? activities.slice(-limit) : activities;
  }

  /**
   * Refresh agent token
   */
  public async refreshToken(agentId: string): Promise<AgentToken> {
    const agent = this.agents.get(agentId);
    if (!agent || !agent.isActive) {
      throw new Error(`Agent ${agentId} not found or inactive`);
    }

    // Check if current token exists and is valid
    const currentToken = this.tokensByAgent.get(agentId);
    if (!currentToken) {
      throw new Error(`No active token for agent ${agentId}`);
    }

    const tokenData = this.tokens.get(currentToken);
    if (!tokenData || tokenData.expiresAt < new Date()) {
      throw new Error(`Token expired for agent ${agentId}`);
    }

    // Issue new token
    return this.authenticateAgent(agentId);
  }

  /**
   * Private helper methods
   */

  private validateRegistrationRequest(request: AgentRegistrationRequest): void {
    if (!request.name || request.name.trim().length === 0) {
      throw new Error('Agent name is required');
    }

    if (!Object.values(AgentClassification).includes(request.classification)) {
      throw new Error('Invalid agent classification');
    }

    if (!Object.values(AccessEntity).includes(request.createdBy)) {
      throw new Error('Invalid creator entity');
    }

    // Validate personal agent specific fields
    if (request.classification === AgentClassification.Personal) {
      if (!request.capabilities || request.capabilities.length === 0) {
        throw new Error('Personal agents must have at least one capability');
      }
    }

    // Validate professional agent specific fields
    if (request.classification === AgentClassification.Professional) {
      if (!request.clearanceLevel) {
        throw new Error('Professional agents must have a clearance level');
      }
      if (!request.specializations || request.specializations.length === 0) {
        throw new Error('Professional agents must have at least one specialization');
      }
    }
  }

  private canCreateAgent(creator: AccessEntity, classification: AgentClassification): boolean {
    // Dad can create any agent
    if (creator === AccessEntity.Dad) {
      return true;
    }

    // Phoenix can create personal agents
    if (creator === AccessEntity.Phoenix && classification === AgentClassification.Personal) {
      return true;
    }

    // Cipher Guard can create professional agents
    if (creator === AccessEntity.CipherGuard && classification === AgentClassification.Professional) {
      return true;
    }

    return false;
  }

  private createAgent(request: AgentRegistrationRequest): Agent {
    const baseAgent = {
      id: uuidv4(),
      name: request.name,
      classification: request.classification,
      createdAt: new Date(),
      createdBy: request.createdBy,
      lastActive: new Date(),
      isActive: true,
      metadata: request.metadata || {}
    };

    if (request.classification === AgentClassification.Personal) {
      const personalAgent: PersonalAgent = {
        ...baseAgent,
        classification: AgentClassification.Personal,
        capabilities: request.capabilities || [],
        emotionalAwareness: request.emotionalAwareness || false,
        allowedKbs: getAllowedKbsForClassification(AgentClassification.Personal)
      };
      return personalAgent;
    } else {
      const professionalAgent: ProfessionalAgent = {
        ...baseAgent,
        classification: AgentClassification.Professional,
        clearanceLevel: request.clearanceLevel || ClearanceLevel.L1,
        specializations: request.specializations || [],
        allowedKbs: getAllowedKbsForClassification(AgentClassification.Professional)
      };
      return professionalAgent;
    }
  }

  private generateSecureToken(): string {
    // In production, use a proper crypto library
    return `agent_${uuidv4()}_${Date.now()}`;
  }

  private calculateTokenExpiry(agent: Agent): Date {
    const hours = agent.createdBy === AccessEntity.Dad
      ? this.config.dadAgentTokenExpiryHours
      : this.config.tokenExpiryHours;
    
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  private checkForExcessiveFailures(agentId: string): void {
    // Count recent failures
    const recentActivities = this.activities
      .filter(a => a.agentId === agentId)
      .slice(-this.config.maxFailedAttempts);

    const failureCount = recentActivities.filter(a => !a.success).length;

    if (failureCount >= this.config.maxFailedAttempts) {
      const agent = this.agents.get(agentId);
      if (agent && agent.createdBy !== AccessEntity.Dad) {
        this.suspendAgent(
          agentId,
          SuspensionReason.ExcessiveFailures,
          AccessEntity.Phoenix, // System suspension
          `${failureCount} failed operations`
        );
      }
    }
  }

  /**
   * Export registry state for persistence
   */
  public exportState(): any {
    return {
      agents: Array.from(this.agents.entries()),
      tokens: Array.from(this.tokens.entries()),
      tokensByAgent: Array.from(this.tokensByAgent.entries()),
      activities: this.activities,
      suspensions: Array.from(this.suspensions.entries()),
      stats: Array.from(this.stats.entries())
    };
  }

  /**
   * Import registry state from persistence
   */
  public importState(state: any): void {
    this.agents = new Map(state.agents);
    this.tokens = new Map(state.tokens);
    this.tokensByAgent = new Map(state.tokensByAgent);
    this.activities = state.activities;
    this.suspensions = new Map(state.suspensions);
    this.stats = new Map(state.stats);
  }
}

// Singleton instance
export const agentRegistry = new AgentRegistry();