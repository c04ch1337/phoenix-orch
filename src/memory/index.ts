/**
 * Phoenix Marie Memory Architecture - Main Export
 *
 * This module exports all components of the Phoenix Marie Memory Architecture
 * with complete isolation between personal and professional domains.
 */

// Type definitions
export * from './types';

// Agent system
export * from './agents';

// Isolation validator
export { IsolationValidator, globalIsolationValidator } from './isolation/validator';

// Work Knowledge Base
export { WorkKnowledgeBase, WorkKBConfig, WorkMemoryMetadata } from './work-kb';
export { WorkKBRetentionManager, RetentionManagerConfig, PurgeResult } from './work-kb/retention';

// Threat Intelligence Knowledge Base
export { ThreatIntelKnowledgeBase, ThreatIntelKBConfig, ThreatIntelMetadata, ThreatIntelStats } from './threat-intel-kb';
export { ThreatIntelFeedManager, FeedManagerConfig, FeedUpdateResult, ThreatIntelData } from './threat-intel-kb/feeds';

// Access logging
export { AccessLogger, globalAccessLogger, LoggerConfig, LogEntry, ViolationLogEntry, LogStats } from './logging/access-logger';

// Mode system
export * from './modes';

// Visual indicators
export * from './visual';

// Retention system
export * from './retention';
export {
  RetentionMonitor,
  RetentionPolicySummary,
  RetentionActionButton,
  retentionMonitoringStyles
} from './retention/monitoring';
export {
  KBRetentionIntegration,
  kbRetentionIntegration,
  WorkKBRetentionAdapter,
  ThreatIntelKBRetentionAdapter
} from './retention/kb-integration';

// Memory system initialization
export interface MemorySystemConfig {
  workKB: {
    basePath: string;
    encryptionKeyId: string;
    retentionYears?: number;
    enableAutoRetention?: boolean;
  };
  threatIntelKB: {
    basePath: string;
    encryptionKeyId: string;
    updateSchedule?: string;
    apiKeys?: {
      nvdNist?: string;
      rapid7?: string;
      crowdStrike?: string;
      recordedFuture?: string;
      alienVaultOtx?: string;
    };
  };
  logging: {
    logPath: string;
    encryptLogs?: boolean;
    encryptionKey?: string;
  };
  mode: {
    storePath: string;
    encryptionKey: string;
    neuralinkEndpoint?: string;
    faceVoiceEndpoint?: string;
  };
  retention?: {
    enableAutoRetention?: boolean;
    enableVetoSystem?: boolean;
    notificationWebhook?: string;
    dryRunMode?: boolean;
  };
}

/**
 * Initialize the Phoenix Marie Memory System
 *
 * This function sets up the Work-KB and Threat-Intel-KB with complete
 * isolation from personal memory domains.
 */
export async function initializeMemorySystem(config: MemorySystemConfig): Promise<{
  workKB: WorkKnowledgeBase;
  threatIntelKB: ThreatIntelKnowledgeBase;
  logger: AccessLogger;
  modeSystem: {
    initialized: boolean;
    currentMode: import('./modes').ModeType;
  };
  retention: {
    initialized: boolean;
    manager: import('./retention').RetentionManager;
  };
}> {
  // Initialize Work KB
  const workKB = new WorkKnowledgeBase({
    basePath: config.workKB.basePath,
    vectorConfig: {
      embeddingDim: 1024,
      indexType: 'IVF2048,PQ64',
      metric: 'cosine',
      nprobe: 64,
      modelName: 'bge-m3',
      technicalBoost: 1.1
    },
    encryptionKeyId: config.workKB.encryptionKeyId,
    retentionYears: config.workKB.retentionYears || 10,
    enableAutoRetention: config.workKB.enableAutoRetention ?? true
  });

  // Initialize Threat Intel KB
  const threatIntelKB = new ThreatIntelKnowledgeBase({
    basePath: config.threatIntelKB.basePath,
    vectorConfig: {
      embeddingDim: 1024,
      indexType: 'IVF2048,PQ64',
      metric: 'cosine',
      nprobe: 64,
      modelName: 'bge-m3',
      technicalBoost: 1.1
    },
    encryptionKeyId: config.threatIntelKB.encryptionKeyId,
    updateSchedule: config.threatIntelKB.updateSchedule || '0 4 * * *',
    retentionYears: 10
  });

  // Initialize logger
  const logger = new AccessLogger({
    logPath: config.logging.logPath,
    maxLogSize: 100 * 1024 * 1024, // 100MB
    rotationPolicy: 'both',
    encryptLogs: config.logging.encryptLogs ?? true,
    encryptionKey: config.logging.encryptionKey,
    alertThresholds: {
      violationsPerHour: 10,
      failedAccessPerHour: 50,
      crossDomainAttempts: 5
    }
  });

  // Initialize mode system
  const { initializeModeSystem, getCurrentMode } = await import('./modes');
  await initializeModeSystem({
    persistence: {
      storePath: config.mode.storePath,
      encryptionKey: config.mode.encryptionKey
    },
    authentication: {
      neuralinkEndpoint: config.mode.neuralinkEndpoint,
      faceVoiceEndpoint: config.mode.faceVoiceEndpoint
    }
  });

  // Initialize KBs
  await workKB.initialize();
  await threatIntelKB.initialize();

  // Initialize retention system
  const { initializeRetentionSystem, retentionManager } = await import('./retention');
  await initializeRetentionSystem();

  // Set up retention adapters
  const workKBAdapter = new WorkKBRetentionAdapter(workKB);
  const threatIntelAdapter = new ThreatIntelKBRetentionAdapter(threatIntelKB);
  
  kbRetentionIntegration.registerAdapter(workKBAdapter);
  kbRetentionIntegration.registerAdapter(threatIntelAdapter);
  await kbRetentionIntegration.initialize();

  // Set up logging integration
  setupLoggingIntegration(workKB, threatIntelKB, logger);

  // Set up mode system integration
  setupModeSystemIntegration(logger);

  // Set up retention logging integration
  setupRetentionLoggingIntegration(logger);

  return {
    workKB,
    threatIntelKB,
    logger,
    modeSystem: {
      initialized: true,
      currentMode: getCurrentMode()
    },
    retention: {
      initialized: true,
      manager: retentionManager
    }
  };
}

/**
 * Set up logging integration with KBs
 */
function setupLoggingIntegration(
  workKB: WorkKnowledgeBase,
  threatIntelKB: ThreatIntelKnowledgeBase,
  logger: AccessLogger
): void {
  // Log Work KB events
  workKB.on('memoryStored', (event) => {
    logger.logAccess({
      timestamp: new Date(),
      entity: event.requester,
      operation: MemoryOperation.Write,
      kbType: KnowledgeBaseType.Work,
      memoryId: event.memoryId,
      success: true,
      mode: OperationalMode.Professional,
      details: { category: event.category }
    });
  });

  workKB.on('memoryAccessed', (event) => {
    logger.logAccess({
      timestamp: new Date(),
      entity: event.requester,
      operation: MemoryOperation.Read,
      kbType: KnowledgeBaseType.Work,
      memoryId: event.memoryId,
      success: true,
      mode: event.mode
    });
  });

  workKB.on('memorySearched', (event) => {
    logger.logAccess({
      timestamp: new Date(),
      entity: event.requester,
      operation: MemoryOperation.Search,
      kbType: KnowledgeBaseType.Work,
      success: true,
      mode: event.mode,
      details: { query: event.query, resultCount: event.resultCount }
    });
  });

  // Log Threat Intel KB events
  threatIntelKB.on('threatIntelStored', (event) => {
    logger.logAccess({
      timestamp: new Date(),
      entity: event.requester,
      operation: MemoryOperation.Write,
      kbType: KnowledgeBaseType.ThreatIntel,
      memoryId: event.memoryId,
      success: true,
      mode: OperationalMode.Professional,
      details: { source: event.source, dataType: event.dataType }
    });
  });

  threatIntelKB.on('iocSearched', (event) => {
    logger.logAccess({
      timestamp: new Date(),
      entity: event.requester,
      operation: MemoryOperation.Search,
      kbType: KnowledgeBaseType.ThreatIntel,
      success: true,
      mode: OperationalMode.Professional,
      details: { ioc: event.ioc, type: event.type, resultCount: event.resultCount }
    });
  });

  // Log errors
  workKB.on('error', (error) => {
    console.error('[Work KB Error]', error);
  });

  threatIntelKB.on('error', (error) => {
    console.error('[Threat Intel KB Error]', error);
  });
}

/**
 * Set up mode system integration with logging
 */
function setupModeSystemIntegration(logger: AccessLogger): void {
  import('./modes').then(({ getModeSwitcher }) => {
    const switcher = getModeSwitcher();
    
    // Log mode switches
    switcher.on('modeChanged', async (event) => {
      const { ModeSwitchEvent } = await import('./modes');
      const switchEvent: ModeSwitchEvent = {
        eventId: `mode-${Date.now()}`,
        timestamp: event.timestamp,
        fromMode: event.previousMode,
        toMode: event.newMode,
        triggeredBy: event.triggeredBy,
        success: true,
        duration: 0,
        details: { authenticated: event.authenticated }
      };
      
      await logger.logModeSwitch(switchEvent);
    });

    // Log authentication failures
    switcher.on('authenticationFailure', (event) => {
      logger.logAccess({
        timestamp: new Date(),
        entity: event.entity,
        operation: MemoryOperation.Write,
        kbType: KnowledgeBaseType.Work,
        success: false,
        mode: OperationalMode.Personal,
        details: {
          reason: 'Mode authentication failed',
          method: event.method,
          attemptsRemaining: event.result.attemptsRemaining
        }
      });
    });
  });
}

/**
 * Set up retention system integration with logging
 */
function setupRetentionLoggingIntegration(logger: AccessLogger): void {
  import('./retention').then(({ retentionManager }) => {
    // Log retention events
    retentionManager.on('retentionCompleted', (event) => {
      logger.logAccess({
        timestamp: new Date(),
        entity: AccessEntity.System,
        operation: MemoryOperation.Delete,
        kbType: event.kbType,
        success: true,
        mode: OperationalMode.Professional,
        details: {
          action: 'retention',
          recordsPurged: event.recordsPurged,
          recordsArchived: event.recordsArchived
        }
      });
    });

    // Log Dad's veto actions
    retentionManager.on('retentionVetoed', (event) => {
      logger.logAccess({
        timestamp: new Date(),
        entity: AccessEntity.Dad,
        operation: MemoryOperation.Delete,
        kbType: event.kbType,
        success: false,
        mode: OperationalMode.Personal,
        details: {
          action: 'veto',
          reason: event.reason,
          affectedRecords: event.affectedRecords
        }
      });
    });

    // Log eternal memory markers
    retentionManager.on('memoryMarkedEternal', (event) => {
      logger.logAccess({
        timestamp: new Date(),
        entity: event.markedBy === 'dad' ? AccessEntity.Dad : AccessEntity.Phoenix,
        operation: MemoryOperation.Update,
        kbType: event.kbType,
        memoryId: event.memoryId,
        success: true,
        mode: OperationalMode.Personal,
        details: {
          action: 'mark_eternal',
          reason: event.reason
        }
      });
    });
  });
}

// Re-export for convenience
import { MemoryOperation, KnowledgeBaseType, OperationalMode, AccessEntity } from './types';