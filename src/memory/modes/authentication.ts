/**
 * Phoenix Marie Memory Architecture - Mode Authentication System
 * 
 * Handles authentication for mode transitions.
 * Personal → Professional requires authentication (Neuralink or Face+Voice).
 * Professional → Personal is instant (Dad can always come home).
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import {
  AuthenticationMethod,
  AuthenticationResult,
  AuthenticationAttempt,
  ModeType
} from './types';
import { AccessEntity } from '../types';

export interface AuthenticationConfig {
  maxAttempts: number;
  lockoutDuration: number; // milliseconds
  neuralinkEndpoint?: string;
  faceVoiceEndpoint?: string;
  neuralinkTimeout?: number; // milliseconds
  faceVoiceTimeout?: number; // milliseconds
}

export interface AuthenticationService {
  authenticate(data: any): Promise<boolean>;
  getMethod(): AuthenticationMethod;
}

export class ModeAuthenticationManager extends EventEmitter {
  private config: AuthenticationConfig;
  private attemptHistory: Map<string, AuthenticationAttempt[]> = new Map();
  private lockouts: Map<string, Date> = new Map();
  private services: Map<AuthenticationMethod, AuthenticationService> = new Map();

  constructor(config: AuthenticationConfig) {
    super();
    this.config = config;
    this.initializeServices();
  }

  /**
   * Authenticate mode transition
   */
  public async authenticate(
    entity: AccessEntity,
    fromMode: ModeType,
    toMode: ModeType,
    method: AuthenticationMethod,
    authData?: any
  ): Promise<AuthenticationResult> {
    const attemptId = this.generateAttemptId();
    const timestamp = new Date();

    // Check if Dad is authenticating (always succeeds)
    if (entity === AccessEntity.Dad || method === AuthenticationMethod.DadOverride) {
      const result: AuthenticationResult = {
        success: true,
        method: AuthenticationMethod.DadOverride,
        authenticatedAt: timestamp,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
      };

      await this.recordAttempt({
        attemptId,
        timestamp,
        method: AuthenticationMethod.DadOverride,
        success: true,
        entity,
        fromMode,
        toMode
      });

      this.emit('authenticationSuccess', { entity, method, result });
      return result;
    }

    // Check if entity is locked out
    const lockoutKey = this.getLockoutKey(entity, fromMode, toMode);
    if (this.isLockedOut(lockoutKey)) {
      const lockoutEnd = this.lockouts.get(lockoutKey)!;
      const result: AuthenticationResult = {
        success: false,
        method,
        authenticatedAt: timestamp,
        failureReason: `Account locked out until ${lockoutEnd.toISOString()}`,
        attemptsRemaining: 0
      };

      this.emit('authenticationLockout', { entity, lockoutEnd });
      return result;
    }

    // Check if authentication is required
    if (!this.isAuthenticationRequired(fromMode, toMode)) {
      const result: AuthenticationResult = {
        success: true,
        method,
        authenticatedAt: timestamp,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      };

      await this.recordAttempt({
        attemptId,
        timestamp,
        method,
        success: true,
        entity,
        fromMode,
        toMode
      });

      return result;
    }

    // Perform authentication
    try {
      const service = this.services.get(method);
      if (!service) {
        throw new Error(`Authentication method ${method} not available`);
      }

      const authenticated = await service.authenticate(authData);
      const attempts = this.getRecentAttempts(lockoutKey);
      const failedAttempts = attempts.filter(a => !a.success).length;
      const attemptsRemaining = Math.max(0, this.config.maxAttempts - failedAttempts - 1);

      if (authenticated) {
        // Clear failed attempts on success
        this.clearAttempts(lockoutKey);

        const result: AuthenticationResult = {
          success: true,
          method,
          authenticatedAt: timestamp,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
        };

        await this.recordAttempt({
          attemptId,
          timestamp,
          method,
          success: true,
          entity,
          fromMode,
          toMode
        });

        this.emit('authenticationSuccess', { entity, method, result });
        return result;
      } else {
        // Failed authentication
        await this.recordAttempt({
          attemptId,
          timestamp,
          method,
          success: false,
          entity,
          fromMode,
          toMode,
          failureReason: 'Authentication failed'
        });

        // Check if we need to lock out
        if (failedAttempts + 1 >= this.config.maxAttempts) {
          const lockoutEnd = new Date(Date.now() + this.config.lockoutDuration);
          this.lockouts.set(lockoutKey, lockoutEnd);
          
          this.emit('authenticationLockout', { 
            entity, 
            lockoutEnd,
            attempts: failedAttempts + 1 
          });

          return {
            success: false,
            method,
            authenticatedAt: timestamp,
            failureReason: `Maximum attempts exceeded. Locked out until ${lockoutEnd.toISOString()}`,
            attemptsRemaining: 0
          };
        }

        const result: AuthenticationResult = {
          success: false,
          method,
          authenticatedAt: timestamp,
          failureReason: 'Authentication failed',
          attemptsRemaining
        };

        this.emit('authenticationFailure', { entity, method, result, attemptsRemaining });
        return result;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.recordAttempt({
        attemptId,
        timestamp,
        method,
        success: false,
        entity,
        fromMode,
        toMode,
        failureReason: errorMessage
      });

      return {
        success: false,
        method,
        authenticatedAt: timestamp,
        failureReason: `Authentication error: ${errorMessage}`,
        attemptsRemaining: this.config.maxAttempts - this.getRecentAttempts(lockoutKey).length
      };
    }
  }

  /**
   * Check if authentication is required for transition
   */
  public isAuthenticationRequired(fromMode: ModeType, toMode: ModeType): boolean {
    // Personal to Professional requires authentication
    if (fromMode === ModeType.Personal && toMode === ModeType.Professional) {
      return true;
    }

    // Professional to Personal is instant (Dad can always come home)
    return false;
  }

  /**
   * Get authentication history
   */
  public getAuthenticationHistory(
    entity?: AccessEntity,
    limit: number = 100
  ): AuthenticationAttempt[] {
    const allAttempts: AuthenticationAttempt[] = [];
    
    this.attemptHistory.forEach((attempts) => {
      allAttempts.push(...attempts);
    });

    let filtered = allAttempts;
    if (entity) {
      filtered = filtered.filter(a => a.entity === entity);
    }

    // Sort by timestamp descending and limit
    return filtered
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Clear lockout for entity
   */
  public clearLockout(entity: AccessEntity, fromMode: ModeType, toMode: ModeType): void {
    const lockoutKey = this.getLockoutKey(entity, fromMode, toMode);
    this.lockouts.delete(lockoutKey);
    this.clearAttempts(lockoutKey);
    
    this.emit('lockoutCleared', { entity, fromMode, toMode });
  }

  /**
   * Get lockout status
   */
  public getLockoutStatus(
    entity: AccessEntity,
    fromMode: ModeType,
    toMode: ModeType
  ): { isLockedOut: boolean; lockoutEnd?: Date } {
    const lockoutKey = this.getLockoutKey(entity, fromMode, toMode);
    const lockoutEnd = this.lockouts.get(lockoutKey);
    
    if (!lockoutEnd || lockoutEnd < new Date()) {
      this.lockouts.delete(lockoutKey);
      return { isLockedOut: false };
    }

    return { isLockedOut: true, lockoutEnd };
  }

  /**
   * Initialize authentication services
   */
  private initializeServices(): void {
    // Neuralink authentication service
    if (this.config.neuralinkEndpoint) {
      this.services.set(AuthenticationMethod.Neuralink, {
        authenticate: async (data: any) => {
          // In production, this would call the Neuralink API
          // For now, simulate authentication
          return this.simulateNeuralinkAuth(data);
        },
        getMethod: () => AuthenticationMethod.Neuralink
      });
    }

    // Face + Voice authentication service
    if (this.config.faceVoiceEndpoint) {
      this.services.set(AuthenticationMethod.FaceVoice, {
        authenticate: async (data: any) => {
          // In production, this would call the face/voice recognition API
          // For now, simulate authentication
          return this.simulateFaceVoiceAuth(data);
        },
        getMethod: () => AuthenticationMethod.FaceVoice
      });
    }

    // Dad override is always available
    this.services.set(AuthenticationMethod.DadOverride, {
      authenticate: async () => true,
      getMethod: () => AuthenticationMethod.DadOverride
    });
  }

  /**
   * Simulate Neuralink authentication (placeholder)
   */
  private async simulateNeuralinkAuth(data: any): Promise<boolean> {
    // In production, this would verify the Neuralink signature
    // For now, check if data contains valid signature
    if (!data || !data.signature) {
      return false;
    }

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate 90% success rate for valid signatures
    return data.signature.length > 20 && Math.random() > 0.1;
  }

  /**
   * Simulate Face + Voice authentication (placeholder)
   */
  private async simulateFaceVoiceAuth(data: any): Promise<boolean> {
    // In production, this would verify face and voice biometrics
    // For now, check if data contains both face and voice data
    if (!data || !data.faceData || !data.voiceData) {
      return false;
    }

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate 85% success rate for valid biometrics
    return data.faceData.length > 0 && data.voiceData.length > 0 && Math.random() > 0.15;
  }

  /**
   * Record authentication attempt
   */
  private async recordAttempt(attempt: AuthenticationAttempt): Promise<void> {
    const lockoutKey = this.getLockoutKey(attempt.entity, attempt.fromMode, attempt.toMode);
    
    if (!this.attemptHistory.has(lockoutKey)) {
      this.attemptHistory.set(lockoutKey, []);
    }

    const attempts = this.attemptHistory.get(lockoutKey)!;
    attempts.push(attempt);

    // Keep only recent attempts (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAttempts = attempts.filter(a => a.timestamp > oneHourAgo);
    this.attemptHistory.set(lockoutKey, recentAttempts);

    this.emit('attemptRecorded', attempt);
  }

  /**
   * Get recent authentication attempts
   */
  private getRecentAttempts(lockoutKey: string): AuthenticationAttempt[] {
    const attempts = this.attemptHistory.get(lockoutKey) || [];
    const recentWindow = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes
    return attempts.filter(a => a.timestamp > recentWindow);
  }

  /**
   * Clear authentication attempts
   */
  private clearAttempts(lockoutKey: string): void {
    this.attemptHistory.delete(lockoutKey);
  }

  /**
   * Check if entity is locked out
   */
  private isLockedOut(lockoutKey: string): boolean {
    const lockoutEnd = this.lockouts.get(lockoutKey);
    if (!lockoutEnd) {
      return false;
    }

    if (lockoutEnd < new Date()) {
      this.lockouts.delete(lockoutKey);
      return false;
    }

    return true;
  }

  /**
   * Generate lockout key
   */
  private getLockoutKey(entity: AccessEntity, fromMode: ModeType, toMode: ModeType): string {
    return `${entity}:${fromMode}:${toMode}`;
  }

  /**
   * Generate unique attempt ID
   */
  private generateAttemptId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Clean up expired lockouts
   */
  public cleanupExpiredLockouts(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    this.lockouts.forEach((lockoutEnd, key) => {
      if (lockoutEnd < now) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => {
      this.lockouts.delete(key);
      this.clearAttempts(key);
    });

    if (expiredKeys.length > 0) {
      this.emit('lockoutsCleanedUp', expiredKeys.length);
    }
  }
}

/**
 * Create singleton instance
 */
let authInstance: ModeAuthenticationManager | null = null;

export function getModeAuthenticationManager(config?: AuthenticationConfig): ModeAuthenticationManager {
  if (!authInstance && config) {
    authInstance = new ModeAuthenticationManager(config);
  }
  
  if (!authInstance) {
    throw new Error('Mode authentication manager not initialized');
  }
  
  return authInstance;
}

/**
 * Reset singleton (for testing)
 */
export function resetModeAuthenticationManager(): void {
  authInstance = null;
}