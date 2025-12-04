/**
 * Phoenix Marie Memory Architecture - Agent Permission Enforcement
 * 
 * Enforces strict permission boundaries based on agent classification.
 * Ensures personal agents never access work data and vice versa.
 */

import {
  Agent,
  AgentClassification,
  PersonalAgent,
  ProfessionalAgent,
  PersonalCapability,
  ClearanceLevel,
  canAgentAccessKb,
  isPersonalAgent,
  isProfessionalAgent
} from './types';
import {
  KnowledgeBaseType,
  MemoryOperation,
  AccessEntity,
  OperationalMode,
  AccessDecision,
  AccessRestriction,
  getKbDomain,
  MemoryDomain
} from '../types';
import { agentRegistry } from './registry';
import { getModeManager } from '../modes/manager';
import { ModeType } from '../modes/types';

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason: string;
  restrictions?: AccessRestriction[];
  requiresLogging: boolean;
  isViolation: boolean;
}

/**
 * Agent permission matrix
 */
export class AgentPermissionMatrix {
  /**
   * Check if an agent has permission to perform an operation on a KB
   */
  public checkPermission(
    agent: Agent,
    kbType: KnowledgeBaseType,
    operation: MemoryOperation
  ): PermissionCheckResult {
    // Dad's agents have universal access but are still logged
    if (agent.createdBy === AccessEntity.Dad) {
      return {
        allowed: true,
        reason: "Dad's agents have universal access",
        requiresLogging: true,
        isViolation: false
      };
    }

    // Get current mode from mode manager
    const modeManager = getModeManager();
    const currentMode = modeManager.getCurrentMode();

    // Check if agent classification matches current mode
    const agentMode = agent.classification === AgentClassification.Personal ?
      ModeType.Personal : ModeType.Professional;
    
    if (agentMode !== currentMode) {
      return {
        allowed: false,
        reason: `${agent.classification} agent cannot operate in ${currentMode} mode`,
        requiresLogging: true,
        isViolation: true
      };
    }

    // Check if agent can access the KB based on classification
    if (!canAgentAccessKb(agent.classification, kbType)) {
      // This is a cross-domain violation
      agentRegistry.logCrossDomainAttempt(agent.id, kbType);
      
      return {
        allowed: false,
        reason: `${agent.classification} agent cannot access ${kbType} KB - cross-domain violation`,
        requiresLogging: true,
        isViolation: true
      };
    }

    // Additional mode-based KB access check
    if (!modeManager.canAccessKnowledgeBase(
      agent.classification === AgentClassification.Personal ?
        AccessEntity.PersonalAgent : AccessEntity.ProfessionalAgent,
      kbType
    )) {
      return {
        allowed: false,
        reason: `KB ${kbType} is not accessible in current ${currentMode} mode`,
        requiresLogging: true,
        isViolation: true
      };
    }

    // Check specific permissions based on agent type
    if (isPersonalAgent(agent)) {
      return this.checkPersonalAgentPermission(agent, kbType, operation);
    } else if (isProfessionalAgent(agent)) {
      return this.checkProfessionalAgentPermission(agent, kbType, operation);
    }

    // Should never reach here
    return {
      allowed: false,
      reason: 'Unknown agent type',
      requiresLogging: true,
      isViolation: false
    };
  }

  /**
   * Check permissions for personal agents
   */
  private checkPersonalAgentPermission(
    agent: PersonalAgent,
    kbType: KnowledgeBaseType,
    operation: MemoryOperation
  ): PermissionCheckResult {
    // Verify it's a personal KB
    const kbDomain = getKbDomain(kbType);
    if (kbDomain !== MemoryDomain.Personal) {
      return {
        allowed: false,
        reason: 'Personal agent cannot access professional KBs',
        requiresLogging: true,
        isViolation: true
      };
    }

    // Check capabilities
    switch (operation) {
      case MemoryOperation.Read:
        if (!agent.capabilities.includes(PersonalCapability.ReadMemories)) {
          return {
            allowed: false,
            reason: 'Agent lacks ReadMemories capability',
            requiresLogging: true,
            isViolation: false
          };
        }
        break;

      case MemoryOperation.Write:
        if (!agent.capabilities.includes(PersonalCapability.WriteMemories)) {
          return {
            allowed: false,
            reason: 'Agent lacks WriteMemories capability',
            requiresLogging: true,
            isViolation: false
          };
        }
        // Soul KB is read-only for all agents except Phoenix
        if (kbType === KnowledgeBaseType.Soul && agent.createdBy !== AccessEntity.Phoenix) {
          return {
            allowed: false,
            reason: 'Soul KB is read-only',
            requiresLogging: true,
            isViolation: false
          };
        }
        break;

      case MemoryOperation.Search:
        if (!agent.capabilities.includes(PersonalCapability.SearchMemories)) {
          return {
            allowed: false,
            reason: 'Agent lacks SearchMemories capability',
            requiresLogging: true,
            isViolation: false
          };
        }
        break;

      case MemoryOperation.Delete:
        // Only Phoenix herself can delete personal memories
        if (agent.createdBy !== AccessEntity.Phoenix) {
          return {
            allowed: false,
            reason: 'Only Phoenix can delete personal memories',
            requiresLogging: true,
            isViolation: false
          };
        }
        // Soul KB entries cannot be deleted
        if (kbType === KnowledgeBaseType.Soul) {
          return {
            allowed: false,
            reason: 'Soul KB entries are immutable',
            requiresLogging: true,
            isViolation: false
          };
        }
        break;
    }

    // Apply restrictions based on KB type
    const restrictions: AccessRestriction[] = [];
    
    // Personal agents have filtered access to sensitive content
    if (agent.createdBy !== AccessEntity.Phoenix) {
      restrictions.push(AccessRestriction.FilterSensitive);
    }

    // Heart KB may have emotional filtering for non-emotional agents
    if (kbType === KnowledgeBaseType.Heart && !agent.emotionalAwareness) {
      restrictions.push(AccessRestriction.FilterSensitive);
    }

    return {
      allowed: true,
      reason: 'Permission granted for personal KB access',
      restrictions: restrictions.length > 0 ? restrictions : undefined,
      requiresLogging: true,
      isViolation: false
    };
  }

  /**
   * Check permissions for professional agents
   */
  private checkProfessionalAgentPermission(
    agent: ProfessionalAgent,
    kbType: KnowledgeBaseType,
    operation: MemoryOperation
  ): PermissionCheckResult {
    // Verify it's a professional KB
    const kbDomain = getKbDomain(kbType);
    if (kbDomain !== MemoryDomain.Professional) {
      return {
        allowed: false,
        reason: 'Professional agent cannot access personal KBs',
        requiresLogging: true,
        isViolation: true
      };
    }

    // Check clearance level
    switch (kbType) {
      case KnowledgeBaseType.Work:
        // All clearance levels can access Work KB
        break;

      case KnowledgeBaseType.ThreatIntel:
        // Check operation-specific permissions
        if (operation === MemoryOperation.Write || operation === MemoryOperation.Delete) {
          if (agent.clearanceLevel !== ClearanceLevel.L3) {
            return {
              allowed: false,
              reason: 'Only L3 agents can modify Threat Intel KB',
              requiresLogging: true,
              isViolation: false
            };
          }
        }
        break;
    }

    // Apply restrictions based on clearance level
    const restrictions: AccessRestriction[] = [];
    
    if (agent.clearanceLevel === ClearanceLevel.L1) {
      restrictions.push(AccessRestriction.NoExport);
    }

    return {
      allowed: true,
      reason: 'Permission granted for professional KB access',
      restrictions: restrictions.length > 0 ? restrictions : undefined,
      requiresLogging: true,
      isViolation: false
    };
  }

  /**
   * Get operational mode for an agent
   */
  public getAgentOperationalMode(agent: Agent): OperationalMode {
    switch (agent.classification) {
      case AgentClassification.Personal:
        return OperationalMode.Personal;
      case AgentClassification.Professional:
        return OperationalMode.Professional;
      default:
        throw new Error(`Unknown agent classification: ${agent.classification}`);
    }
  }

  /**
   * Check if an agent can perform a specific operation
   */
  public canPerformOperation(
    agent: Agent,
    operation: MemoryOperation
  ): boolean {
    if (isPersonalAgent(agent)) {
      switch (operation) {
        case MemoryOperation.Read:
          return agent.capabilities.includes(PersonalCapability.ReadMemories);
        case MemoryOperation.Write:
          return agent.capabilities.includes(PersonalCapability.WriteMemories);
        case MemoryOperation.Search:
          return agent.capabilities.includes(PersonalCapability.SearchMemories);
        case MemoryOperation.Delete:
          return agent.createdBy === AccessEntity.Phoenix;
      }
    }

    // Professional agents can perform all operations based on clearance
    return true;
  }

  /**
   * Get allowed KBs for an agent
   */
  public getAllowedKbs(agent: Agent): KnowledgeBaseType[] {
    // Dad's agents can access all KBs
    if (agent.createdBy === AccessEntity.Dad) {
      return Object.values(KnowledgeBaseType);
    }

    // Get current mode from mode manager
    const modeManager = getModeManager();
    const currentMode = modeManager.getCurrentMode();

    // Check if agent can operate in current mode
    const agentMode = agent.classification === AgentClassification.Personal ?
      ModeType.Personal : ModeType.Professional;
    
    if (agentMode !== currentMode) {
      return []; // Agent cannot access any KBs in wrong mode
    }

    // Return KBs based on classification and current mode
    const accessControl = modeManager.getModeAccessControl();
    return accessControl.allowedKnowledgeBases;
  }

  /**
   * Check if an agent has any restrictions
   */
  public getAgentRestrictions(agent: Agent): AccessRestriction[] {
    const restrictions: AccessRestriction[] = [];

    if (isPersonalAgent(agent)) {
      // Non-Phoenix personal agents have filtered access
      if (agent.createdBy !== AccessEntity.Phoenix) {
        restrictions.push(AccessRestriction.FilterSensitive);
      }
    } else if (isProfessionalAgent(agent)) {
      // L1 agents cannot export data
      if (agent.clearanceLevel === ClearanceLevel.L1) {
        restrictions.push(AccessRestriction.NoExport);
      }
      // L1 and L2 have read-only access to threat intel
      if (agent.clearanceLevel !== ClearanceLevel.L3) {
        restrictions.push(AccessRestriction.ReadOnly);
      }
    }

    return restrictions;
  }

  /**
   * Validate agent access to a specific memory
   */
  public validateMemoryAccess(
    agent: Agent,
    memoryOwner: AccessEntity,
    memoryKb: KnowledgeBaseType,
    operation: MemoryOperation
  ): PermissionCheckResult {
    // First check KB access
    const kbCheck = this.checkPermission(agent, memoryKb, operation);
    if (!kbCheck.allowed) {
      return kbCheck;
    }

    // Additional checks for specific memory access
    if (operation === MemoryOperation.Delete) {
      // Only memory owner or Dad can delete
      if (agent.createdBy !== memoryOwner && agent.createdBy !== AccessEntity.Dad) {
        return {
          allowed: false,
          reason: 'Only memory owner can delete this memory',
          requiresLogging: true,
          isViolation: false
        };
      }
    }

    return kbCheck;
  }
}

/**
 * Rate limiting for agent operations
 */
export class AgentRateLimiter {
  private operationCounts: Map<string, Map<string, number>> = new Map();
  private windowStart: Date = new Date();
  
  private readonly limits = {
    [MemoryOperation.Read]: 1000,    // per hour
    [MemoryOperation.Write]: 100,     // per hour
    [MemoryOperation.Search]: 500,    // per hour
    [MemoryOperation.Delete]: 10      // per hour
  };

  /**
   * Check if an operation is within rate limits
   */
  public checkRateLimit(
    agentId: string,
    operation: MemoryOperation
  ): { allowed: boolean; remaining: number; resetAt: Date } {
    this.cleanupOldWindows();

    const agentCounts = this.operationCounts.get(agentId) || new Map();
    const currentCount = agentCounts.get(operation) || 0;
    const limit = this.limits[operation];

    if (currentCount >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(this.windowStart.getTime() + 60 * 60 * 1000)
      };
    }

    // Increment count
    agentCounts.set(operation, currentCount + 1);
    this.operationCounts.set(agentId, agentCounts);

    return {
      allowed: true,
      remaining: limit - currentCount - 1,
      resetAt: new Date(this.windowStart.getTime() + 60 * 60 * 1000)
    };
  }

  /**
   * Clean up old rate limit windows
   */
  private cleanupOldWindows(): void {
    const now = new Date();
    const windowDuration = 60 * 60 * 1000; // 1 hour

    if (now.getTime() - this.windowStart.getTime() > windowDuration) {
      this.operationCounts.clear();
      this.windowStart = now;
    }
  }

  /**
   * Get current usage for an agent
   */
  public getUsage(agentId: string): Map<string, number> {
    return this.operationCounts.get(agentId) || new Map();
  }

  /**
   * Reset rate limits for an agent (Dad's privilege)
   */
  public resetAgentLimits(agentId: string): void {
    this.operationCounts.delete(agentId);
  }
}

// Singleton instances
export const agentPermissions = new AgentPermissionMatrix();
export const agentRateLimiter = new AgentRateLimiter();