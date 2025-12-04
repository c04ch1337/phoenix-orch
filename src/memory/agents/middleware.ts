/**
 * Phoenix Marie Memory Architecture - Agent Permission Middleware
 * 
 * Middleware layer that enforces agent permissions on all KB operations.
 * This is the critical enforcement point that prevents unauthorized access.
 */

import {
  Agent,
  AgentOperation,
  AgentActivity
} from './types';
import {
  KnowledgeBaseType,
  MemoryOperation,
  AccessEntity,
  OperationalMode,
  AccessDecision,
  IsolationError,
  ViolationType,
  AccessDeniedError
} from '../types';
import { agentRegistry } from './registry';
import { agentPermissions, agentRateLimiter } from './permissions';
import { AuthenticatedContext } from './authentication';
import { globalIsolationValidator } from '../isolation/validator';
import { globalAccessLogger } from '../logging/access-logger';

/**
 * Middleware operation result
 */
export interface MiddlewareResult {
  allowed: boolean;
  reason?: string;
  context?: AuthenticatedContext;
  violations?: string[];
}

/**
 * KB operation request
 */
export interface KBOperationRequest {
  operation: MemoryOperation;
  kbType: KnowledgeBaseType;
  memoryId?: string;
  content?: Buffer;
  metadata?: Record<string, any>;
}

/**
 * Agent permission middleware
 */
export class AgentPermissionMiddleware {
  /**
   * Validate and authorize a KB operation
   */
  public async authorizeOperation(
    context: AuthenticatedContext,
    request: KBOperationRequest
  ): Promise<MiddlewareResult> {
    const violations: string[] = [];

    try {
      // Step 1: Validate agent is still active
      const agent = agentRegistry.getAgent(context.agent.id);
      if (!agent || !agent.isActive) {
        return {
          allowed: false,
          reason: 'Agent is not active',
          violations: ['Agent deactivated or not found']
        };
      }

      // Step 2: Check rate limits (except for Dad's agents)
      if (!context.isDadAgent()) {
        const rateLimit = agentRateLimiter.checkRateLimit(
          agent.id,
          request.operation
        );
        
        if (!rateLimit.allowed) {
          violations.push(`Rate limit exceeded for ${request.operation}`);
          
          // Log rate limit violation
          this.logActivity(agent, request, false, 'Rate limit exceeded');
          
          return {
            allowed: false,
            reason: `Rate limit exceeded. Resets at ${rateLimit.resetAt.toISOString()}`,
            violations
          };
        }
      }

      // Step 3: Check agent permissions
      const permissionCheck = agentPermissions.checkPermission(
        agent,
        request.kbType,
        request.operation
      );

      if (!permissionCheck.allowed) {
        violations.push(permissionCheck.reason);
        
        // Log permission violation
        this.logActivity(agent, request, false, permissionCheck.reason);
        
        // If it's a cross-domain violation, it's already logged by permissions
        if (permissionCheck.isViolation) {
          // Additional security alert for cross-domain attempts
          await this.alertSecurityViolation(agent, request, permissionCheck.reason);
        }
        
        return {
          allowed: false,
          reason: permissionCheck.reason,
          violations
        };
      }

      // Step 4: Get agent's operational mode
      const agentMode = agentPermissions.getAgentOperationalMode(agent);

      // Step 5: Validate with isolation validator
      const isolationDecision = globalIsolationValidator.validateAccess(
        this.getAccessEntity(agent),
        request.kbType,
        request.operation,
        agentMode,
        agent.id
      );

      if (!isolationDecision.allowed) {
        violations.push(isolationDecision.reason);
        
        // Log isolation violation
        this.logActivity(agent, request, false, isolationDecision.reason);
        
        return {
          allowed: false,
          reason: isolationDecision.reason,
          violations
        };
      }

      // Step 6: Additional content validation for write operations
      if (request.operation === MemoryOperation.Write && request.content) {
        const contentValidation = globalIsolationValidator.validateMemoryPlacement(
          request.content.toString(),
          request.kbType,
          request.metadata || {}
        );

        if (!contentValidation.valid) {
          violations.push(contentValidation.reason);
          
          // Log content violation
          this.logActivity(agent, request, false, contentValidation.reason);
          
          return {
            allowed: false,
            reason: contentValidation.reason,
            violations,
            context
          };
        }
      }

      // Step 7: Log successful authorization
      this.logActivity(agent, request, true, 'Operation authorized');

      return {
        allowed: true,
        context,
        reason: 'Operation authorized with restrictions: ' + 
                (permissionCheck.restrictions?.join(', ') || 'none')
      };

    } catch (error) {
      // Log error
      this.logActivity(
        context.agent,
        request,
        false,
        `Authorization error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      return {
        allowed: false,
        reason: 'Authorization failed due to system error',
        violations: ['System error during authorization']
      };
    }
  }

  /**
   * Wrap a KB operation with permission checks
   */
  public async executeWithPermissions<T>(
    context: AuthenticatedContext,
    request: KBOperationRequest,
    operation: () => Promise<T>
  ): Promise<T> {
    // Authorize the operation
    const authorization = await this.authorizeOperation(context, request);

    if (!authorization.allowed) {
      throw new AccessDeniedError(
        authorization.reason || 'Access denied',
        this.getAccessEntity(context.agent),
        request.operation,
        request.kbType
      );
    }

    try {
      // Execute the operation
      const result = await operation();

      // Log successful execution
      this.logActivity(
        context.agent,
        request,
        true,
        'Operation completed successfully'
      );

      return result;
    } catch (error) {
      // Log failed execution
      this.logActivity(
        context.agent,
        request,
        false,
        `Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      throw error;
    }
  }

  /**
   * Pre-flight check for an operation
   */
  public async checkOperationPermission(
    context: AuthenticatedContext,
    kbType: KnowledgeBaseType,
    operation: MemoryOperation
  ): Promise<boolean> {
    const request: KBOperationRequest = {
      operation,
      kbType
    };

    const result = await this.authorizeOperation(context, request);
    return result.allowed;
  }

  /**
   * Get allowed operations for an agent on a specific KB
   */
  public getAllowedOperations(
    agent: Agent,
    kbType: KnowledgeBaseType
  ): MemoryOperation[] {
    const allowed: MemoryOperation[] = [];

    for (const operation of Object.values(MemoryOperation)) {
      const check = agentPermissions.checkPermission(agent, kbType, operation);
      if (check.allowed) {
        allowed.push(operation);
      }
    }

    return allowed;
  }

  /**
   * Get all accessible KBs for an agent
   */
  public getAccessibleKbs(agent: Agent): KnowledgeBaseType[] {
    return agentPermissions.getAllowedKbs(agent);
  }

  /**
   * Private helper methods
   */

  private getAccessEntity(agent: Agent): AccessEntity {
    // Map agent to appropriate access entity
    switch (agent.createdBy) {
      case AccessEntity.Dad:
        return AccessEntity.Dad; // Dad's agents act as Dad
      case AccessEntity.Phoenix:
        return AccessEntity.PersonalAgent;
      case AccessEntity.CipherGuard:
        return AccessEntity.ProfessionalAgent;
      default:
        // Default based on classification
        return agent.classification === 'personal' 
          ? AccessEntity.PersonalAgent 
          : AccessEntity.ProfessionalAgent;
    }
  }

  private logActivity(
    agent: Agent,
    request: KBOperationRequest,
    success: boolean,
    details: string
  ): void {
    const activity: AgentActivity = {
      agentId: agent.id,
      timestamp: new Date(),
      operation: this.mapToAgentOperation(request.operation),
      targetKb: request.kbType,
      memoryId: request.memoryId,
      success,
      details: { reason: details }
    };

    agentRegistry.logActivity(activity);

    // Also log to global access logger
    globalAccessLogger.logAccess({
      timestamp: new Date(),
      entity: this.getAccessEntity(agent),
      agentId: agent.id,
      operation: request.operation,
      kbType: request.kbType,
      memoryId: request.memoryId,
      success,
      mode: agentPermissions.getAgentOperationalMode(agent),
      details: { agentName: agent.name, reason: details }
    });
  }

  private mapToAgentOperation(memoryOp: MemoryOperation): AgentOperation {
    switch (memoryOp) {
      case MemoryOperation.Read:
        return AgentOperation.ReadMemory;
      case MemoryOperation.Write:
        return AgentOperation.WriteMemory;
      case MemoryOperation.Search:
        return AgentOperation.SearchMemory;
      case MemoryOperation.Delete:
        return AgentOperation.DeleteMemory;
    }
  }

  private async alertSecurityViolation(
    agent: Agent,
    request: KBOperationRequest,
    reason: string
  ): Promise<void> {
    // In production, this would send alerts to Dad's monitoring system
    console.error('[SECURITY ALERT]', {
      timestamp: new Date(),
      agentId: agent.id,
      agentName: agent.name,
      classification: agent.classification,
      attemptedOperation: request.operation,
      targetKb: request.kbType,
      violation: reason
    });

    // Log as high-priority security event
    globalAccessLogger.logViolation({
      timestamp: new Date(),
      sourceMode: agentPermissions.getAgentOperationalMode(agent),
      targetKb: request.kbType,
      violationType: ViolationType.CrossDomainAccess,
      agentId: agent.id,
      details: `Agent ${agent.name} (${agent.classification}) attempted ${request.operation} on ${request.kbType}`
    });
  }
}

/**
 * Middleware factory for different KB types
 */
export class KBMiddlewareFactory {
  private middleware = new AgentPermissionMiddleware();

  /**
   * Create middleware for a specific KB
   */
  public createForKB(kbType: KnowledgeBaseType) {
    return {
      /**
       * Authorize read operation
       */
      authorizeRead: async (
        context: AuthenticatedContext,
        memoryId: string
      ): Promise<MiddlewareResult> => {
        return this.middleware.authorizeOperation(context, {
          operation: MemoryOperation.Read,
          kbType,
          memoryId
        });
      },

      /**
       * Authorize write operation
       */
      authorizeWrite: async (
        context: AuthenticatedContext,
        content: Buffer,
        metadata?: Record<string, any>
      ): Promise<MiddlewareResult> => {
        return this.middleware.authorizeOperation(context, {
          operation: MemoryOperation.Write,
          kbType,
          content,
          metadata
        });
      },

      /**
       * Authorize search operation
       */
      authorizeSearch: async (
        context: AuthenticatedContext
      ): Promise<MiddlewareResult> => {
        return this.middleware.authorizeOperation(context, {
          operation: MemoryOperation.Search,
          kbType
        });
      },

      /**
       * Authorize delete operation
       */
      authorizeDelete: async (
        context: AuthenticatedContext,
        memoryId: string
      ): Promise<MiddlewareResult> => {
        return this.middleware.authorizeOperation(context, {
          operation: MemoryOperation.Delete,
          kbType,
          memoryId
        });
      },

      /**
       * Execute operation with permissions
       */
      executeWithPermissions: async <T>(
        context: AuthenticatedContext,
        request: KBOperationRequest,
        operation: () => Promise<T>
      ): Promise<T> => {
        return this.middleware.executeWithPermissions(
          context,
          { ...request, kbType },
          operation
        );
      }
    };
  }
}

// Singleton instances
export const agentMiddleware = new AgentPermissionMiddleware();
export const kbMiddlewareFactory = new KBMiddlewareFactory();

// Export convenience middleware creators for each KB
export const mindKBMiddleware = kbMiddlewareFactory.createForKB(KnowledgeBaseType.Mind);
export const bodyKBMiddleware = kbMiddlewareFactory.createForKB(KnowledgeBaseType.Body);
export const soulKBMiddleware = kbMiddlewareFactory.createForKB(KnowledgeBaseType.Soul);
export const heartKBMiddleware = kbMiddlewareFactory.createForKB(KnowledgeBaseType.Heart);
export const workKBMiddleware = kbMiddlewareFactory.createForKB(KnowledgeBaseType.Work);
export const threatIntelKBMiddleware = kbMiddlewareFactory.createForKB(KnowledgeBaseType.ThreatIntel);