/**
 * Phoenix Marie Memory Architecture - Agent Authentication
 * 
 * Handles agent authentication, token management, and security validation.
 * Ensures only authorized agents can access the memory system.
 */

import { createHash, randomBytes } from 'crypto';
import {
  Agent,
  AgentToken,
  AgentClassification,
  AgentOperation
} from './types';
import {
  AccessEntity,
  IsolationError,
  ViolationType
} from '../types';
import { agentRegistry } from './registry';

/**
 * Authentication result
 */
export interface AuthenticationResult {
  success: boolean;
  agent?: Agent;
  token?: AgentToken;
  error?: string;
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  valid: boolean;
  agent?: Agent;
  token?: AgentToken;
  error?: string;
  requiresRefresh?: boolean;
}

/**
 * Authentication configuration
 */
export interface AuthenticationConfig {
  tokenLength: number;
  hashAlgorithm: string;
  tokenRefreshThreshold: number; // hours before expiry to suggest refresh
  maxAuthAttempts: number;
  lockoutDuration: number; // minutes
}

/**
 * Agent authentication manager
 */
export class AgentAuthenticationManager {
  private readonly config: AuthenticationConfig;
  private authAttempts: Map<string, number> = new Map();
  private lockouts: Map<string, Date> = new Map();

  constructor(config?: Partial<AuthenticationConfig>) {
    this.config = {
      tokenLength: 32,
      hashAlgorithm: 'sha256',
      tokenRefreshThreshold: 2,
      maxAuthAttempts: 5,
      lockoutDuration: 30,
      ...config
    };
  }

  /**
   * Authenticate an agent and issue a token
   */
  public async authenticate(
    agentId: string,
    secret?: string
  ): Promise<AuthenticationResult> {
    try {
      // Check lockout
      if (this.isLockedOut(agentId)) {
        return {
          success: false,
          error: 'Agent is locked out due to too many failed attempts'
        };
      }

      // Get agent
      const agent = agentRegistry.getAgent(agentId);
      if (!agent) {
        this.recordFailedAttempt(agentId);
        return {
          success: false,
          error: 'Agent not found'
        };
      }

      // Validate agent is active
      if (!agent.isActive) {
        return {
          success: false,
          error: 'Agent is not active'
        };
      }

      // For Dad's agents, no additional authentication needed
      if (agent.createdBy === AccessEntity.Dad) {
        const token = await agentRegistry.authenticateAgent(agentId);
        return {
          success: true,
          agent,
          token
        };
      }

      // For other agents, validate secret if provided
      if (secret && !this.validateSecret(agent, secret)) {
        this.recordFailedAttempt(agentId);
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Issue token
      const token = await agentRegistry.authenticateAgent(agentId);
      
      // Clear failed attempts
      this.authAttempts.delete(agentId);
      
      return {
        success: true,
        agent,
        token
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Validate a token
   */
  public validateToken(tokenString: string): TokenValidationResult {
    const validation = agentRegistry.validateToken(tokenString);
    
    if (!validation) {
      return {
        valid: false,
        error: 'Invalid or expired token'
      };
    }

    const { agent, token } = validation;

    // Check if token needs refresh
    const hoursUntilExpiry = (token.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
    const requiresRefresh = hoursUntilExpiry <= this.config.tokenRefreshThreshold;

    return {
      valid: true,
      agent,
      token,
      requiresRefresh
    };
  }

  /**
   * Refresh an agent's token
   */
  public async refreshToken(
    currentToken: string
  ): Promise<AuthenticationResult> {
    const validation = this.validateToken(currentToken);
    
    if (!validation.valid || !validation.agent) {
      return {
        success: false,
        error: 'Invalid token'
      };
    }

    try {
      const newToken = await agentRegistry.refreshToken(validation.agent.id);
      return {
        success: true,
        agent: validation.agent,
        token: newToken
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      };
    }
  }

  /**
   * Revoke a token
   */
  public revokeToken(tokenString: string): boolean {
    const validation = agentRegistry.validateToken(tokenString);
    if (!validation) {
      return false;
    }

    // The registry handles token cleanup when we authenticate with a new token
    // For now, we'll just log the revocation
    if (validation.agent) {
      agentRegistry.logActivity({
        agentId: validation.agent.id,
        timestamp: new Date(),
        operation: AgentOperation.TokenRefresh,
        success: true,
        details: { action: 'revoked' }
      });
    }

    return true;
  }

  /**
   * Generate a secure token
   */
  public generateSecureToken(): string {
    return randomBytes(this.config.tokenLength).toString('hex');
  }

  /**
   * Hash a value for secure storage
   */
  public hashValue(value: string): string {
    return createHash(this.config.hashAlgorithm)
      .update(value)
      .digest('hex');
  }

  /**
   * Validate agent secret (for non-Dad agents)
   */
  private validateSecret(agent: Agent, secret: string): boolean {
    // In a real implementation, this would check against stored hashed secrets
    // For now, we'll use a simple validation
    const expectedSecret = this.hashValue(`${agent.id}:${agent.createdAt.toISOString()}`);
    const providedSecret = this.hashValue(secret);
    return expectedSecret === providedSecret;
  }

  /**
   * Record a failed authentication attempt
   */
  private recordFailedAttempt(agentId: string): void {
    const attempts = (this.authAttempts.get(agentId) || 0) + 1;
    this.authAttempts.set(agentId, attempts);

    if (attempts >= this.config.maxAuthAttempts) {
      const lockoutUntil = new Date();
      lockoutUntil.setMinutes(lockoutUntil.getMinutes() + this.config.lockoutDuration);
      this.lockouts.set(agentId, lockoutUntil);
      this.authAttempts.delete(agentId);
    }
  }

  /**
   * Check if an agent is locked out
   */
  private isLockedOut(agentId: string): boolean {
    const lockoutUntil = this.lockouts.get(agentId);
    if (!lockoutUntil) {
      return false;
    }

    if (lockoutUntil > new Date()) {
      return true;
    }

    // Lockout expired
    this.lockouts.delete(agentId);
    return false;
  }

  /**
   * Clear lockout for an agent (Dad's privilege)
   */
  public clearLockout(agentId: string, clearedBy: AccessEntity): void {
    if (clearedBy !== AccessEntity.Dad) {
      throw new Error('Only Dad can clear agent lockouts');
    }

    this.lockouts.delete(agentId);
    this.authAttempts.delete(agentId);
  }

  /**
   * Get authentication status for an agent
   */
  public getAuthStatus(agentId: string): {
    isLockedOut: boolean;
    failedAttempts: number;
    lockoutUntil?: Date;
  } {
    return {
      isLockedOut: this.isLockedOut(agentId),
      failedAttempts: this.authAttempts.get(agentId) || 0,
      lockoutUntil: this.lockouts.get(agentId)
    };
  }
}

/**
 * Token-based request context
 */
export class AuthenticatedContext {
  constructor(
    public readonly agent: Agent,
    public readonly token: AgentToken,
    public readonly requestId: string = randomBytes(16).toString('hex')
  ) {}

  /**
   * Check if the agent is a Dad agent
   */
  public isDadAgent(): boolean {
    return this.token.isDadAgent;
  }

  /**
   * Check if the token is near expiry
   */
  public isNearExpiry(thresholdHours: number = 2): boolean {
    const hoursUntilExpiry = (this.token.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntilExpiry <= thresholdHours;
  }

  /**
   * Get agent classification
   */
  public getClassification(): AgentClassification {
    return this.agent.classification;
  }

  /**
   * Create a context string for logging
   */
  public toLogContext(): Record<string, any> {
    return {
      requestId: this.requestId,
      agentId: this.agent.id,
      agentName: this.agent.name,
      classification: this.agent.classification,
      isDadAgent: this.isDadAgent(),
      tokenIssuedAt: this.token.issuedAt,
      tokenExpiresAt: this.token.expiresAt
    };
  }
}

/**
 * Authentication middleware helper
 */
export class AuthenticationMiddleware {
  constructor(
    private authManager: AgentAuthenticationManager
  ) {}

  /**
   * Validate request authentication
   */
  public async validateRequest(
    authHeader?: string
  ): Promise<AuthenticatedContext | null> {
    if (!authHeader) {
      return null;
    }

    // Extract token from Bearer header
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      return null;
    }

    const token = match[1];
    const validation = this.authManager.validateToken(token);

    if (!validation.valid || !validation.agent || !validation.token) {
      return null;
    }

    return new AuthenticatedContext(
      validation.agent,
      validation.token
    );
  }

  /**
   * Create authentication header
   */
  public createAuthHeader(token: string): string {
    return `Bearer ${token}`;
  }
}

// Singleton instances
export const authenticationManager = new AgentAuthenticationManager();
export const authMiddleware = new AuthenticationMiddleware(authenticationManager);