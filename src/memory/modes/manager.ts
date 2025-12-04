/**
 * Phoenix Marie Memory Architecture - Mode Manager
 * 
 * Central manager for mode operations and state management.
 * Coordinates between state persistence, authentication, and mode switching.
 */

import { EventEmitter } from 'events';
import {
  ModeType,
  ModeState,
  ModeManagerConfig,
  ModeSwitchEvent,
  ModeStatistics,
  ModeAccessControl,
  ModeRestriction,
  getOperationalMode,
  getModeVisualState,
  DEFAULT_MODE_CONFIG
} from './types';
import { 
  AccessEntity, 
  KnowledgeBaseType,
  OperationalMode,
  getKbDomain,
  MemoryDomain
} from '../types';
import { ModeStatePersistence, getModeStatePersistence } from './state';
import { ModeAuthenticationManager, getModeAuthenticationManager } from './authentication';

export interface ModeChangeEvent {
  previousMode: ModeType;
  newMode: ModeType;
  triggeredBy: AccessEntity;
  authenticated: boolean;
  timestamp: Date;
}

export class ModeManager extends EventEmitter {
  private config: ModeManagerConfig;
  private statePersistence: ModeStatePersistence;
  private authManager: ModeAuthenticationManager;
  private statistics: ModeStatistics;
  private modeStartTime: Date;
  private isInitialized: boolean = false;

  constructor(config: Partial<ModeManagerConfig> = {}) {
    super();
    
    // Merge with default config
    this.config = {
      persistence: {
        ...DEFAULT_MODE_CONFIG.persistence!,
        ...config.persistence
      },
      authentication: {
        ...DEFAULT_MODE_CONFIG.authentication!,
        ...config.authentication
      },
      transitions: {
        ...DEFAULT_MODE_CONFIG.transitions!,
        ...config.transitions
      }
    } as ModeManagerConfig;

    // Initialize statistics
    this.statistics = this.createEmptyStatistics();
    this.modeStartTime = new Date();
  }

  /**
   * Initialize the mode manager
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Initialize state persistence
    this.statePersistence = getModeStatePersistence(this.config.persistence);
    await this.statePersistence.initialize();

    // Initialize authentication manager
    this.authManager = getModeAuthenticationManager(this.config.authentication);

    // Set up event listeners
    this.setupEventListeners();

    // Load statistics
    await this.loadStatistics();

    this.isInitialized = true;
    this.modeStartTime = new Date();

    this.emit('initialized', {
      currentMode: this.getCurrentMode(),
      state: this.statePersistence.getCurrentState()
    });
  }

  /**
   * Get current mode
   */
  public getCurrentMode(): ModeType {
    if (!this.isInitialized) {
      return this.config.persistence.defaultMode;
    }
    return this.statePersistence.getCurrentMode();
  }

  /**
   * Get current operational mode
   */
  public getCurrentOperationalMode(): OperationalMode {
    return getOperationalMode(this.getCurrentMode());
  }

  /**
   * Get current mode state
   */
  public getCurrentState(): ModeState {
    return this.statePersistence.getCurrentState();
  }

  /**
   * Check if currently authenticated
   */
  public isAuthenticated(): boolean {
    return this.statePersistence.isAuthenticated();
  }

  /**
   * Get mode access control for current mode
   */
  public getModeAccessControl(): ModeAccessControl {
    const currentMode = this.getCurrentMode();
    
    switch (currentMode) {
      case ModeType.Personal:
        return {
          mode: ModeType.Personal,
          allowedEntities: [
            AccessEntity.Phoenix,
            AccessEntity.PersonalAgent,
            AccessEntity.Dad
          ],
          allowedKnowledgeBases: [
            KnowledgeBaseType.Mind,
            KnowledgeBaseType.Body,
            KnowledgeBaseType.Soul,
            KnowledgeBaseType.Heart
          ],
          restrictions: [ModeRestriction.NoWorkData]
        };
      
      case ModeType.Professional:
        return {
          mode: ModeType.Professional,
          allowedEntities: [
            AccessEntity.CipherGuard,
            AccessEntity.ProfessionalAgent,
            AccessEntity.Dad
          ],
          allowedKnowledgeBases: [
            KnowledgeBaseType.Work,
            KnowledgeBaseType.ThreatIntel
          ],
          restrictions: [ModeRestriction.NoPersonalData]
        };
    }
  }

  /**
   * Check if entity can access KB in current mode
   */
  public canAccessKnowledgeBase(
    entity: AccessEntity,
    kbType: KnowledgeBaseType
  ): boolean {
    // Dad has universal access
    if (entity === AccessEntity.Dad) {
      return true;
    }

    const accessControl = this.getModeAccessControl();
    
    // Check if entity is allowed in current mode
    if (!accessControl.allowedEntities.includes(entity)) {
      return false;
    }

    // Check if KB is allowed in current mode
    if (!accessControl.allowedKnowledgeBases.includes(kbType)) {
      return false;
    }

    return true;
  }

  /**
   * Check if mode switch is allowed
   */
  public canSwitchMode(
    toMode: ModeType,
    entity: AccessEntity
  ): { allowed: boolean; requiresAuth: boolean; reason?: string } {
    const currentMode = this.getCurrentMode();

    // Can't switch to same mode
    if (currentMode === toMode) {
      return {
        allowed: false,
        requiresAuth: false,
        reason: 'Already in requested mode'
      };
    }

    // Dad can always switch modes
    if (entity === AccessEntity.Dad) {
      return {
        allowed: true,
        requiresAuth: false
      };
    }

    // Personal to Professional requires authentication
    if (currentMode === ModeType.Personal && toMode === ModeType.Professional) {
      return {
        allowed: true,
        requiresAuth: true,
        reason: 'Authentication required for work mode'
      };
    }

    // Professional to Personal is always allowed (Dad can always come home)
    if (currentMode === ModeType.Professional && toMode === ModeType.Personal) {
      return {
        allowed: true,
        requiresAuth: false
      };
    }

    return {
      allowed: false,
      requiresAuth: false,
      reason: 'Invalid mode transition'
    };
  }

  /**
   * Get mode visual state
   */
  public getModeVisualState(): ReturnType<typeof getModeVisualState> {
    return getModeVisualState(this.getCurrentMode());
  }

  /**
   * Get mode statistics
   */
  public getStatistics(): ModeStatistics {
    // Update current mode usage time
    const currentMode = this.getCurrentMode();
    const currentTime = Date.now();
    const timeSinceStart = currentTime - this.modeStartTime.getTime();
    
    this.statistics.modeUsage[currentMode] += timeSinceStart;
    this.modeStartTime = new Date();

    return { ...this.statistics };
  }

  /**
   * Reset statistics
   */
  public async resetStatistics(): Promise<void> {
    this.statistics = this.createEmptyStatistics();
    await this.saveStatistics();
    
    this.emit('statisticsReset', this.statistics);
  }

  /**
   * Get authentication status
   */
  public getAuthenticationStatus(): {
    authenticated: boolean;
    expiresAt?: Date;
    method?: string;
  } {
    const state = this.getCurrentState();
    
    return {
      authenticated: state.authenticated,
      expiresAt: state.authenticationExpiry
    };
  }

  /**
   * Handle mode switch request (used by switcher)
   */
  public async handleModeSwitch(
    toMode: ModeType,
    entity: AccessEntity,
    authenticated: boolean
  ): Promise<void> {
    const previousMode = this.getCurrentMode();
    const startTime = Date.now();

    // Update mode usage time
    const timeInPreviousMode = startTime - this.modeStartTime.getTime();
    this.statistics.modeUsage[previousMode] += timeInPreviousMode;

    // Update state
    await this.statePersistence.updateState(toMode, authenticated, entity);

    // Update statistics
    this.statistics.totalTransitions++;
    this.statistics.successfulTransitions++;
    const duration = Date.now() - startTime;
    this.updateAverageTransitionTime(duration);

    // Log the switch
    const switchEvent: ModeSwitchEvent = {
      eventId: this.generateEventId(),
      timestamp: new Date(),
      fromMode: previousMode,
      toMode,
      triggeredBy: entity,
      success: true,
      duration
    };
    
    await this.statePersistence.logModeSwitch(switchEvent);

    // Reset mode start time
    this.modeStartTime = new Date();

    // Emit mode change event
    this.emit('modeChanged', {
      previousMode,
      newMode: toMode,
      triggeredBy: entity,
      authenticated,
      timestamp: new Date()
    } as ModeChangeEvent);
  }

  /**
   * Handle failed mode switch
   */
  public async handleFailedModeSwitch(
    fromMode: ModeType,
    toMode: ModeType,
    entity: AccessEntity,
    reason: string
  ): Promise<void> {
    this.statistics.totalTransitions++;
    this.statistics.failedTransitions++;

    const switchEvent: ModeSwitchEvent = {
      eventId: this.generateEventId(),
      timestamp: new Date(),
      fromMode,
      toMode,
      triggeredBy: entity,
      success: false,
      duration: 0,
      details: { failureReason: reason }
    };

    await this.statePersistence.logModeSwitch(switchEvent);
  }

  /**
   * Get mode history
   */
  public async getModeHistory(limit: number = 100): Promise<ModeSwitchEvent[]> {
    return this.statePersistence.getModeHistory(limit);
  }

  /**
   * Shutdown the manager
   */
  public async shutdown(): Promise<void> {
    // Save current mode usage time
    const currentMode = this.getCurrentMode();
    const timeInMode = Date.now() - this.modeStartTime.getTime();
    this.statistics.modeUsage[currentMode] += timeInMode;

    // Save statistics
    await this.saveStatistics();

    // Shutdown state persistence
    await this.statePersistence.shutdown();

    this.emit('shutdown');
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Listen to state changes
    this.statePersistence.on('stateChanged', (event) => {
      this.emit('stateChanged', event);
    });

    // Listen to authentication events
    this.authManager.on('authenticationSuccess', (event) => {
      this.statistics.authenticationAttempts++;
      this.emit('authenticationSuccess', event);
    });

    this.authManager.on('authenticationFailure', (event) => {
      this.statistics.authenticationAttempts++;
      this.statistics.failedAuthentications++;
      this.emit('authenticationFailure', event);
    });

    // Periodic cleanup
    setInterval(() => {
      this.authManager.cleanupExpiredLockouts();
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Create empty statistics
   */
  private createEmptyStatistics(): ModeStatistics {
    return {
      totalTransitions: 0,
      successfulTransitions: 0,
      failedTransitions: 0,
      authenticationAttempts: 0,
      failedAuthentications: 0,
      averageTransitionTime: 0,
      modeUsage: {
        [ModeType.Personal]: 0,
        [ModeType.Professional]: 0
      },
      lastReset: new Date()
    };
  }

  /**
   * Update average transition time
   */
  private updateAverageTransitionTime(newDuration: number): void {
    const { successfulTransitions, averageTransitionTime } = this.statistics;
    
    if (successfulTransitions === 1) {
      this.statistics.averageTransitionTime = newDuration;
    } else {
      // Calculate new average
      const totalTime = averageTransitionTime * (successfulTransitions - 1) + newDuration;
      this.statistics.averageTransitionTime = totalTime / successfulTransitions;
    }
  }

  /**
   * Load statistics from storage
   */
  private async loadStatistics(): Promise<void> {
    // In a real implementation, this would load from persistent storage
    // For now, start with empty statistics
    this.statistics = this.createEmptyStatistics();
  }

  /**
   * Save statistics to storage
   */
  private async saveStatistics(): Promise<void> {
    // In a real implementation, this would save to persistent storage
    this.emit('statisticsSaved', this.statistics);
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Create singleton instance
 */
let managerInstance: ModeManager | null = null;

export function getModeManager(config?: Partial<ModeManagerConfig>): ModeManager {
  if (!managerInstance) {
    managerInstance = new ModeManager(config);
  }
  
  return managerInstance;
}

/**
 * Reset singleton (for testing)
 */
export function resetModeManager(): void {
  if (managerInstance) {
    managerInstance.shutdown();
    managerInstance = null;
  }
}