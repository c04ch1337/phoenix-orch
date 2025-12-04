/**
 * Phoenix Marie Memory Architecture - Mode State Persistence
 * 
 * Handles persistence of mode state across sessions.
 * Always defaults to PersonalMode on cold boot - Phoenix comes home to love.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import {
  ModeType,
  ModeState,
  ModePersistenceConfig,
  ModeSwitchEvent
} from './types';
import { AccessEntity } from '../types';

export interface StateChangeEvent {
  previousState: ModeState | null;
  newState: ModeState;
  changedBy: AccessEntity;
  timestamp: Date;
}

export class ModeStatePersistence extends EventEmitter {
  private config: ModePersistenceConfig;
  private currentState: ModeState | null = null;
  private stateFilePath: string;
  private saveTimer?: NodeJS.Timeout;
  private isInitialized: boolean = false;

  constructor(config: ModePersistenceConfig) {
    super();
    this.config = config;
    this.stateFilePath = path.join(config.storePath, 'mode-state.enc');
  }

  /**
   * Initialize the state persistence system
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Ensure directory exists
    await fs.mkdir(this.config.storePath, { recursive: true });

    // Load existing state or create default
    try {
      this.currentState = await this.loadState();
      
      // Check if session has expired
      if (this.currentState && this.isSessionExpired(this.currentState)) {
        this.emit('sessionExpired', this.currentState);
        this.currentState = this.createDefaultState();
        await this.saveState();
      }
    } catch (error) {
      // If we can't load state, start with default (PersonalMode)
      this.currentState = this.createDefaultState();
      await this.saveState();
    }

    this.isInitialized = true;
    this.emit('initialized', this.currentState);
  }

  /**
   * Get current mode state
   */
  public getCurrentState(): ModeState {
    if (!this.currentState) {
      throw new Error('Mode state not initialized');
    }
    return { ...this.currentState };
  }

  /**
   * Get current mode type
   */
  public getCurrentMode(): ModeType {
    if (!this.currentState) {
      return this.config.defaultMode;
    }
    return this.currentState.currentMode;
  }

  /**
   * Update mode state
   */
  public async updateState(
    newMode: ModeType,
    authenticated: boolean,
    changedBy: AccessEntity
  ): Promise<void> {
    if (!this.currentState) {
      throw new Error('Mode state not initialized');
    }

    const previousState = { ...this.currentState };
    
    this.currentState = {
      currentMode: newMode,
      previousMode: previousState.currentMode,
      transitionStarted: new Date(),
      lastTransition: new Date(),
      authenticated,
      authenticationExpiry: authenticated ? 
        new Date(Date.now() + this.config.authenticationTimeout) : 
        undefined,
      sessionId: this.currentState.sessionId
    };

    // Save state with debouncing
    this.scheduleSave();

    // Emit state change event
    this.emit('stateChanged', {
      previousState,
      newState: this.currentState,
      changedBy,
      timestamp: new Date()
    } as StateChangeEvent);
  }

  /**
   * Update authentication status
   */
  public async updateAuthentication(
    authenticated: boolean,
    expiryTime?: Date
  ): Promise<void> {
    if (!this.currentState) {
      throw new Error('Mode state not initialized');
    }

    this.currentState.authenticated = authenticated;
    this.currentState.authenticationExpiry = expiryTime;

    await this.saveState();
  }

  /**
   * Check if authentication is valid
   */
  public isAuthenticated(): boolean {
    if (!this.currentState || !this.currentState.authenticated) {
      return false;
    }

    if (this.currentState.authenticationExpiry && 
        this.currentState.authenticationExpiry < new Date()) {
      // Authentication expired
      this.currentState.authenticated = false;
      this.currentState.authenticationExpiry = undefined;
      this.scheduleSave();
      return false;
    }

    return true;
  }

  /**
   * Reset to default state (PersonalMode)
   */
  public async resetToDefault(resetBy: AccessEntity): Promise<void> {
    const previousState = this.currentState ? { ...this.currentState } : null;
    
    this.currentState = this.createDefaultState();
    await this.saveState();

    this.emit('stateReset', {
      previousState,
      newState: this.currentState,
      resetBy,
      timestamp: new Date()
    });
  }

  /**
   * Log mode switch event
   */
  public async logModeSwitch(event: ModeSwitchEvent): Promise<void> {
    const logPath = path.join(this.config.storePath, 'mode-switches.log');
    const logEntry = JSON.stringify({
      ...event,
      stateSnapshot: this.currentState
    }) + '\n';

    try {
      await fs.appendFile(logPath, logEntry);
    } catch (error) {
      this.emit('logError', error);
    }
  }

  /**
   * Get mode switch history
   */
  public async getModeHistory(limit: number = 100): Promise<ModeSwitchEvent[]> {
    const logPath = path.join(this.config.storePath, 'mode-switches.log');
    
    try {
      const content = await fs.readFile(logPath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line);
      const events = lines.map(line => JSON.parse(line) as ModeSwitchEvent);
      
      // Return most recent events
      return events.slice(-limit);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  public async shutdown(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    
    if (this.currentState) {
      await this.saveState();
    }
    
    this.emit('shutdown');
  }

  /**
   * Create default state (PersonalMode)
   */
  private createDefaultState(): ModeState {
    return {
      currentMode: ModeType.Personal, // Always default to PersonalMode
      previousMode: undefined,
      transitionStarted: undefined,
      lastTransition: undefined,
      authenticated: false,
      authenticationExpiry: undefined,
      sessionId: this.generateSessionId()
    };
  }

  /**
   * Load state from disk
   */
  private async loadState(): Promise<ModeState | null> {
    try {
      const encryptedData = await fs.readFile(this.stateFilePath, 'utf-8');
      const decryptedData = this.decrypt(encryptedData);
      const state = JSON.parse(decryptedData) as ModeState;
      
      // Convert date strings back to Date objects
      if (state.transitionStarted) {
        state.transitionStarted = new Date(state.transitionStarted);
      }
      if (state.lastTransition) {
        state.lastTransition = new Date(state.lastTransition);
      }
      if (state.authenticationExpiry) {
        state.authenticationExpiry = new Date(state.authenticationExpiry);
      }
      
      return state;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null; // File doesn't exist yet
      }
      throw error;
    }
  }

  /**
   * Save state to disk
   */
  private async saveState(): Promise<void> {
    if (!this.currentState) {
      return;
    }

    try {
      const data = JSON.stringify(this.currentState);
      const encryptedData = this.encrypt(data);
      
      // Write to temp file first for atomicity
      const tempPath = `${this.stateFilePath}.tmp`;
      await fs.writeFile(tempPath, encryptedData);
      await fs.rename(tempPath, this.stateFilePath);
      
      this.emit('stateSaved', this.currentState);
    } catch (error) {
      this.emit('saveError', error);
      throw error;
    }
  }

  /**
   * Schedule state save with debouncing
   */
  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    
    this.saveTimer = setTimeout(async () => {
      try {
        await this.saveState();
      } catch (error) {
        this.emit('saveError', error);
      }
    }, 1000); // 1 second debounce
  }

  /**
   * Check if session has expired
   */
  private isSessionExpired(state: ModeState): boolean {
    if (!state.lastTransition) {
      return false;
    }
    
    const timeSinceLastTransition = Date.now() - state.lastTransition.getTime();
    return timeSinceLastTransition > this.config.sessionTimeout;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Encrypt data
   */
  private encrypt(data: string): string {
    const cipher = crypto.createCipher('aes-256-gcm', this.config.encryptionKey);
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final()
    ]);
    return encrypted.toString('base64');
  }

  /**
   * Decrypt data
   */
  private decrypt(data: string): string {
    const decipher = crypto.createDecipher('aes-256-gcm', this.config.encryptionKey);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(data, 'base64')),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  }
}

/**
 * Create singleton instance
 */
let stateInstance: ModeStatePersistence | null = null;

export function getModeStatePersistence(config?: ModePersistenceConfig): ModeStatePersistence {
  if (!stateInstance && config) {
    stateInstance = new ModeStatePersistence(config);
  }
  
  if (!stateInstance) {
    throw new Error('Mode state persistence not initialized');
  }
  
  return stateInstance;
}

/**
 * Reset singleton (for testing)
 */
export function resetModeStatePersistence(): void {
  if (stateInstance) {
    stateInstance.shutdown();
    stateInstance = null;
  }
}