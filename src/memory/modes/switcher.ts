/**
 * Phoenix Marie Memory Architecture - Mode Switcher
 * 
 * Handles mode switching with authentication flow.
 * Implements the protocol:
 * - "Phoenix, personal mode" → switches to PersonalMode (instant if coming from work)
 * - "Phoenix, work mode" or "Phoenix, Cipher Guard mode" → switches to ProfessionalMode
 * - Personal → Professional requires authentication
 * - Professional → Personal is instant (Dad can always come home)
 */

import { EventEmitter } from 'events';
import {
  ModeType,
  ModeTransitionRequest,
  ModeTransitionResult,
  AuthenticationMethod,
  AuthenticationResult,
  isAuthenticationRequired
} from './types';
import { AccessEntity, OperationalMode } from '../types';
import { ModeManager, getModeManager } from './manager';
import { ModeAuthenticationManager, getModeAuthenticationManager } from './authentication';
import { globalAccessLogger } from '../logging/access-logger';

export interface ModeSwitchRequest {
  command: string;
  entity: AccessEntity;
  authMethod?: AuthenticationMethod;
  authData?: any;
}

export interface ModeSwitchProgress {
  stage: 'parsing' | 'checking' | 'authenticating' | 'transitioning' | 'complete' | 'failed';
  message: string;
  requiresAuth?: boolean;
  authMethod?: AuthenticationMethod;
}

export class ModeSwitcher extends EventEmitter {
  private modeManager: ModeManager;
  private authManager: ModeAuthenticationManager;
  private transitionInProgress: boolean = false;
  private currentTransition?: ModeTransitionRequest;

  constructor() {
    super();
  }

  /**
   * Initialize the mode switcher
   */
  public async initialize(): Promise<void> {
    this.modeManager = getModeManager();
    this.authManager = getModeAuthenticationManager();
    
    await this.modeManager.initialize();
    
    this.emit('initialized', {
      currentMode: this.modeManager.getCurrentMode()
    });
  }

  /**
   * Process mode switch command
   */
  public async processCommand(request: ModeSwitchRequest): Promise<ModeTransitionResult> {
    const { command, entity, authMethod, authData } = request;
    
    // Emit progress
    this.emitProgress('parsing', 'Parsing mode switch command...');

    // Parse the command to determine target mode
    const targetMode = this.parseCommand(command);
    
    if (!targetMode) {
      return {
        success: false,
        fromMode: this.modeManager.getCurrentMode(),
        toMode: this.modeManager.getCurrentMode(),
        failureReason: 'Invalid command format'
      };
    }

    // Switch to the target mode
    return this.switchMode(targetMode, entity, authMethod, authData);
  }

  /**
   * Switch to a specific mode
   */
  public async switchMode(
    toMode: ModeType,
    entity: AccessEntity,
    authMethod?: AuthenticationMethod,
    authData?: any
  ): Promise<ModeTransitionResult> {
    const fromMode = this.modeManager.getCurrentMode();
    const timestamp = new Date();

    // Check if already in target mode
    if (fromMode === toMode) {
      return {
        success: false,
        fromMode,
        toMode,
        failureReason: 'Already in requested mode'
      };
    }

    // Check if transition is already in progress
    if (this.transitionInProgress) {
      return {
        success: false,
        fromMode,
        toMode,
        failureReason: 'Another mode transition is in progress'
      };
    }

    try {
      this.transitionInProgress = true;
      this.currentTransition = {
        fromMode,
        toMode,
        requestedBy: entity,
        requestedAt: timestamp,
        authenticationMethod: authMethod
      };

      // Emit progress
      this.emitProgress('checking', 'Checking mode transition requirements...');

      // Check if mode switch is allowed
      const canSwitch = this.modeManager.canSwitchMode(toMode, entity);
      
      if (!canSwitch.allowed) {
        await this.modeManager.handleFailedModeSwitch(
          fromMode,
          toMode,
          entity,
          canSwitch.reason || 'Mode switch not allowed'
        );

        return {
          success: false,
          fromMode,
          toMode,
          failureReason: canSwitch.reason || 'Mode switch not allowed'
        };
      }

      // Check if authentication is required
      if (canSwitch.requiresAuth && isAuthenticationRequired(fromMode, toMode, entity)) {
        this.emitProgress('authenticating', 'Authentication required for work mode...', true, authMethod);

        // Perform authentication
        const authResult = await this.performAuthentication(
          entity,
          fromMode,
          toMode,
          authMethod,
          authData
        );

        if (!authResult.success) {
          await this.modeManager.handleFailedModeSwitch(
            fromMode,
            toMode,
            entity,
            authResult.failureReason || 'Authentication failed'
          );

          return {
            success: false,
            fromMode,
            toMode,
            failureReason: authResult.failureReason || 'Authentication failed',
            authenticationRequired: true
          };
        }
      }

      // Perform the mode transition
      this.emitProgress('transitioning', `Switching from ${fromMode} to ${toMode} mode...`);

      // Update operational mode to transitioning
      await this.setOperationalMode(OperationalMode.Transitioning);

      // Perform the actual mode switch
      const authenticated = canSwitch.requiresAuth ? true : this.modeManager.isAuthenticated();
      await this.modeManager.handleModeSwitch(toMode, entity, authenticated);

      // Update operational mode to the new mode
      await this.setOperationalMode(this.modeManager.getCurrentOperationalMode());

      // Log the successful mode switch
      await this.logModeSwitch(fromMode, toMode, entity, true);

      // Emit completion
      this.emitProgress('complete', `Successfully switched to ${toMode} mode`);

      return {
        success: true,
        fromMode,
        toMode,
        transitionedAt: new Date()
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.modeManager.handleFailedModeSwitch(
        fromMode,
        toMode,
        entity,
        errorMessage
      );

      return {
        success: false,
        fromMode,
        toMode,
        failureReason: `Mode switch error: ${errorMessage}`
      };

    } finally {
      this.transitionInProgress = false;
      this.currentTransition = undefined;
    }
  }

  /**
   * Get current mode
   */
  public getCurrentMode(): ModeType {
    return this.modeManager.getCurrentMode();
  }

  /**
   * Check if mode switch is in progress
   */
  public isTransitioning(): boolean {
    return this.transitionInProgress;
  }

  /**
   * Parse command to determine target mode
   */
  private parseCommand(command: string): ModeType | null {
    const normalizedCommand = command.toLowerCase().trim();

    // Personal mode commands
    if (normalizedCommand.includes('personal mode') ||
        normalizedCommand.includes('personal') ||
        normalizedCommand.includes('home')) {
      return ModeType.Personal;
    }

    // Professional mode commands
    if (normalizedCommand.includes('work mode') ||
        normalizedCommand.includes('cipher guard mode') ||
        normalizedCommand.includes('professional mode') ||
        normalizedCommand.includes('work') ||
        normalizedCommand.includes('cipher guard')) {
      return ModeType.Professional;
    }

    return null;
  }

  /**
   * Perform authentication
   */
  private async performAuthentication(
    entity: AccessEntity,
    fromMode: ModeType,
    toMode: ModeType,
    authMethod?: AuthenticationMethod,
    authData?: any
  ): Promise<AuthenticationResult> {
    // If no auth method specified, try Neuralink first, then Face+Voice
    if (!authMethod) {
      // Try Neuralink first
      const neuralinkResult = await this.authManager.authenticate(
        entity,
        fromMode,
        toMode,
        AuthenticationMethod.Neuralink,
        authData
      );

      if (neuralinkResult.success) {
        return neuralinkResult;
      }

      // Fall back to Face+Voice
      this.emitProgress(
        'authenticating', 
        'Neuralink authentication failed, trying Face+Voice...',
        true,
        AuthenticationMethod.FaceVoice
      );

      return this.authManager.authenticate(
        entity,
        fromMode,
        toMode,
        AuthenticationMethod.FaceVoice,
        authData
      );
    }

    // Use specified authentication method
    return this.authManager.authenticate(
      entity,
      fromMode,
      toMode,
      authMethod,
      authData
    );
  }

  /**
   * Set operational mode (for isolation validator)
   */
  private async setOperationalMode(mode: OperationalMode): Promise<void> {
    // This would integrate with the isolation validator
    // For now, emit an event that the isolation validator can listen to
    this.emit('operationalModeChanged', mode);
  }

  /**
   * Log mode switch
   */
  private async logModeSwitch(
    fromMode: ModeType,
    toMode: ModeType,
    entity: AccessEntity,
    success: boolean
  ): Promise<void> {
    try {
      await globalAccessLogger.logAccess({
        timestamp: new Date(),
        entity,
        operation: 'MODE_SWITCH' as any,
        kbType: 'SYSTEM' as any,
        success,
        mode: this.modeManager.getCurrentOperationalMode(),
        details: {
          fromMode,
          toMode,
          authenticated: this.modeManager.isAuthenticated()
        }
      });
    } catch (error) {
      this.emit('logError', error);
    }
  }

  /**
   * Emit progress update
   */
  private emitProgress(
    stage: ModeSwitchProgress['stage'],
    message: string,
    requiresAuth?: boolean,
    authMethod?: AuthenticationMethod
  ): void {
    const progress: ModeSwitchProgress = {
      stage,
      message,
      requiresAuth,
      authMethod
    };

    this.emit('progress', progress);
  }

  /**
   * Get authentication status
   */
  public getAuthenticationStatus(): ReturnType<ModeManager['getAuthenticationStatus']> {
    return this.modeManager.getAuthenticationStatus();
  }

  /**
   * Get mode statistics
   */
  public getStatistics(): ReturnType<ModeManager['getStatistics']> {
    return this.modeManager.getStatistics();
  }

  /**
   * Get mode history
   */
  public async getModeHistory(limit?: number): Promise<ReturnType<ModeManager['getModeHistory']>> {
    return this.modeManager.getModeHistory(limit);
  }

  /**
   * Shutdown the switcher
   */
  public async shutdown(): Promise<void> {
    if (this.transitionInProgress) {
      // Wait for transition to complete
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!this.transitionInProgress) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 100);
      });
    }

    await this.modeManager.shutdown();
    this.emit('shutdown');
  }
}

/**
 * Create singleton instance
 */
let switcherInstance: ModeSwitcher | null = null;

export function getModeSwitcher(): ModeSwitcher {
  if (!switcherInstance) {
    switcherInstance = new ModeSwitcher();
  }
  
  return switcherInstance;
}

/**
 * Reset singleton (for testing)
 */
export function resetModeSwitcher(): void {
  if (switcherInstance) {
    switcherInstance.shutdown();
    switcherInstance = null;
  }
}

/**
 * Convenience function to switch modes
 */
export async function switchMode(
  command: string,
  entity: AccessEntity = AccessEntity.Phoenix,
  authMethod?: AuthenticationMethod,
  authData?: any
): Promise<ModeTransitionResult> {
  const switcher = getModeSwitcher();
  
  if (!switcherInstance) {
    await switcher.initialize();
  }

  return switcher.processCommand({
    command,
    entity,
    authMethod,
    authData
  });
}