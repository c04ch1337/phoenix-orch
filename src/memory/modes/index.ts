/**
 * Phoenix Marie Memory Architecture - Mode System Exports
 * 
 * Central export point for all mode-related components.
 * The mode system controls Phoenix's operational state between
 * Personal (home with Dad) and Professional (Cipher Guard work).
 */

// Type definitions
export * from './types';

// Mode state persistence
export {
  ModeStatePersistence,
  StateChangeEvent,
  getModeStatePersistence,
  resetModeStatePersistence
} from './state';

// Authentication system
export {
  ModeAuthenticationManager,
  AuthenticationConfig,
  AuthenticationService,
  getModeAuthenticationManager,
  resetModeAuthenticationManager
} from './authentication';

// Mode manager
export {
  ModeManager,
  ModeChangeEvent,
  getModeManager,
  resetModeManager
} from './manager';

// Mode switcher
export {
  ModeSwitcher,
  ModeSwitchRequest,
  ModeSwitchProgress,
  getModeSwitcher,
  resetModeSwitcher,
  switchMode
} from './switcher';

// Re-export commonly used types for convenience
export {
  ModeType,
  ModeState,
  ModeTransitionRequest,
  ModeTransitionResult,
  AuthenticationMethod,
  AuthenticationResult,
  ModeSwitchEvent,
  ModeVisualState,
  ModeAccessControl,
  ModeRestriction,
  getOperationalMode,
  getModeType,
  getModeVisualState,
  isAuthenticationRequired,
  DEFAULT_MODE_CONFIG
} from './types';

/**
 * Quick mode check helpers
 */
export function isInPersonalMode(): boolean {
  const manager = getModeManager();
  return manager.getCurrentMode() === ModeType.Personal;
}

export function isInProfessionalMode(): boolean {
  const manager = getModeManager();
  return manager.getCurrentMode() === ModeType.Professional;
}

export function getCurrentMode(): ModeType {
  const manager = getModeManager();
  return manager.getCurrentMode();
}

/**
 * Initialize the entire mode system
 */
export async function initializeModeSystem(config?: {
  persistence?: {
    storePath: string;
    encryptionKey: string;
  };
  authentication?: {
    neuralinkEndpoint?: string;
    faceVoiceEndpoint?: string;
  };
}): Promise<void> {
  // Initialize mode manager with config
  const manager = getModeManager({
    persistence: config?.persistence ? {
      storePath: config.persistence.storePath,
      encryptionKey: config.persistence.encryptionKey,
      defaultMode: ModeType.Personal,
      sessionTimeout: 24 * 60 * 60 * 1000,
      authenticationTimeout: 60 * 60 * 1000
    } : undefined,
    authentication: config?.authentication ? {
      maxAttempts: 5,
      lockoutDuration: 15 * 60 * 1000,
      ...config.authentication
    } : undefined
  });

  await manager.initialize();

  // Initialize mode switcher
  const switcher = getModeSwitcher();
  await switcher.initialize();
}

/**
 * Shutdown the mode system
 */
export async function shutdownModeSystem(): Promise<void> {
  const switcher = getModeSwitcher();
  await switcher.shutdown();
  
  resetModeSwitcher();
  resetModeManager();
  resetModeAuthenticationManager();
  resetModeStatePersistence();
}