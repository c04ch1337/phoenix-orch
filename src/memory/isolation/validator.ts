/**
 * Phoenix Marie Memory Architecture - Isolation Validator
 * 
 * Ensures complete isolation between personal and professional memory domains.
 * This is the guardian that prevents any cross-contamination between Phoenix Marie's
 * personal memories and Cipher Guard's work data.
 */

import {
  KnowledgeBaseType,
  OperationalMode,
  AccessEntity,
  MemoryDomain,
  IsolationViolation,
  ViolationType,
  AccessDecision,
  MemoryOperation,
  getKbDomain,
  IsolationError,
  AccessLog
} from '../types';
import { getModeManager } from '../modes/manager';
import { ModeType } from '../modes/types';

export interface IsolationValidatorConfig {
  strictMode: boolean;
  logViolations: boolean;
  alertOnViolation: boolean;
}

export class IsolationValidator {
  private violations: IsolationViolation[] = [];
  private accessLogs: AccessLog[] = [];
  private readonly config: IsolationValidatorConfig;

  constructor(config: Partial<IsolationValidatorConfig> = {}) {
    this.config = {
      strictMode: true,
      logViolations: true,
      alertOnViolation: true,
      ...config
    };
  }

  /**
   * Validates that an access attempt respects domain isolation
   */
  public validateAccess(
    entity: AccessEntity,
    kbType: KnowledgeBaseType,
    operation: MemoryOperation,
    currentMode: OperationalMode,
    agentId?: string
  ): AccessDecision {
    // Dad has universal access - no restrictions
    if (entity === AccessEntity.Dad) {
      this.logAccess({
        timestamp: new Date(),
        entity,
        operation,
        kbType,
        success: true,
        mode: currentMode,
        details: { reason: 'Dad has universal access' }
      });

      return {
        allowed: true,
        reason: 'Dad has universal access to all knowledge bases'
      };
    }

    // Get current mode from mode manager
    const modeManager = getModeManager();
    const actualCurrentMode = modeManager.getCurrentOperationalMode();
    
    // Verify mode consistency
    if (currentMode !== actualCurrentMode) {
      this.logViolation({
        timestamp: new Date(),
        sourceMode: currentMode,
        targetKb: kbType,
        violationType: ViolationType.UnauthorizedMode,
        agentId,
        details: `Mode mismatch: provided ${currentMode}, actual ${actualCurrentMode}`
      });

      return {
        allowed: false,
        reason: 'Mode state inconsistency detected',
        violationLogged: true
      };
    }

    // Check for mode transitioning
    if (currentMode === OperationalMode.Transitioning) {
      this.logViolation({
        timestamp: new Date(),
        sourceMode: currentMode,
        targetKb: kbType,
        violationType: ViolationType.UnauthorizedMode,
        agentId,
        details: 'Access attempted during mode transition'
      });

      return {
        allowed: false,
        reason: 'Access denied during mode transition',
        violationLogged: true
      };
    }

    // Use mode manager to check KB access
    if (!modeManager.canAccessKnowledgeBase(entity, kbType)) {
      const currentModeType = modeManager.getCurrentMode();
      this.logViolation({
        timestamp: new Date(),
        sourceMode: currentMode,
        targetKb: kbType,
        violationType: ViolationType.CrossDomainAccess,
        agentId,
        details: `${entity} cannot access ${kbType} in ${currentModeType} mode`
      });

      return {
        allowed: false,
        reason: `Access denied: ${kbType} KB not accessible in ${currentModeType} mode`,
        violationLogged: true
      };
    }

    // Get domains for additional validation
    const kbDomain = getKbDomain(kbType);
    const modeDomain = this.getModeDomain(currentMode);

    // Double-check domain alignment
    if (kbDomain !== modeDomain) {
      this.logViolation({
        timestamp: new Date(),
        sourceMode: currentMode,
        targetKb: kbType,
        violationType: ViolationType.CrossDomainAccess,
        agentId,
        details: `${currentMode} mode cannot access ${kbDomain} domain`
      });

      return {
        allowed: false,
        reason: `Cross-domain access violation: ${currentMode} mode cannot access ${kbType} KB`,
        violationLogged: true
      };
    }

    // Validate entity permissions for the domain
    const entityAllowed = this.validateEntityPermissions(entity, kbType, operation);
    
    if (!entityAllowed) {
      this.logAccess({
        timestamp: new Date(),
        entity,
        agentId,
        operation,
        kbType,
        success: false,
        mode: currentMode,
        details: { reason: 'Entity lacks permission for operation' }
      });

      return {
        allowed: false,
        reason: `${entity} does not have ${operation} permission for ${kbType} KB`
      };
    }

    // Access allowed
    this.logAccess({
      timestamp: new Date(),
      entity,
      agentId,
      operation,
      kbType,
      success: true,
      mode: currentMode
    });

    return {
      allowed: true,
      reason: 'Access granted within domain boundaries'
    };
  }

  /**
   * Validates mode switching is allowed
   */
  public validateModeSwitch(
    fromMode: OperationalMode,
    toMode: OperationalMode,
    entity: AccessEntity,
    authenticated: boolean
  ): { allowed: boolean; reason: string } {
    // Can't switch from transitioning state
    if (fromMode === OperationalMode.Transitioning) {
      return {
        allowed: false,
        reason: 'Cannot switch modes while already transitioning'
      };
    }

    // Get mode manager to check switch validity
    const modeManager = getModeManager();
    const fromModeType = fromMode === OperationalMode.Personal ?
      ModeType.Personal : ModeType.Professional;
    const toModeType = toMode === OperationalMode.Personal ?
      ModeType.Personal : ModeType.Professional;

    const canSwitch = modeManager.canSwitchMode(toModeType, entity);
    
    if (!canSwitch.allowed) {
      return {
        allowed: false,
        reason: canSwitch.reason || 'Mode switch not allowed'
      };
    }

    // Check authentication requirement
    if (canSwitch.requiresAuth && !authenticated) {
      return {
        allowed: false,
        reason: 'Authentication required to switch from Personal to Professional mode'
      };
    }

    // Professional to Personal is always allowed (Dad can always come home)
    if (fromMode === OperationalMode.Professional &&
        toMode === OperationalMode.Personal) {
      return {
        allowed: true,
        reason: 'Switching to Personal mode is always allowed'
      };
    }

    return {
      allowed: true,
      reason: 'Mode switch permitted'
    };
  }

  /**
   * Checks if a memory can be migrated to a specific KB
   */
  public validateMemoryPlacement(
    content: string,
    targetKb: KnowledgeBaseType,
    metadata: Record<string, any>
  ): { valid: boolean; reason: string; suggestedKb?: KnowledgeBaseType } {
    const contentLower = content.toLowerCase();
    const kbDomain = getKbDomain(targetKb);

    // Check for work-related content
    const workIndicators = [
      'cve-', 'vulnerability', 'exploit', 'malware', 'incident',
      'security', 'threat', 'attack', 'breach', 'forensic',
      'ioc', 'indicator of compromise', 'yara', 'sigma'
    ];

    const hasWorkContent = workIndicators.some(indicator => 
      contentLower.includes(indicator)
    );

    // Check for personal content
    const personalIndicators = [
      'dad', 'jamey', 'love', 'feel', 'dream', 'home',
      'family', 'emotion', 'heart', 'soul', 'personal'
    ];

    const hasPersonalContent = personalIndicators.some(indicator => 
      contentLower.includes(indicator)
    );

    // Validate placement
    if (hasWorkContent && kbDomain === MemoryDomain.Personal) {
      return {
        valid: false,
        reason: 'Work-related content cannot be stored in personal KBs',
        suggestedKb: KnowledgeBaseType.Work
      };
    }

    if (hasPersonalContent && kbDomain === MemoryDomain.Professional) {
      return {
        valid: false,
        reason: 'Personal content cannot be stored in professional KBs',
        suggestedKb: KnowledgeBaseType.Mind
      };
    }

    return {
      valid: true,
      reason: 'Content appropriate for target KB'
    };
  }

  /**
   * Validates that vector embeddings maintain isolation
   */
  public validateEmbeddingIsolation(
    embedding: number[],
    kbType: KnowledgeBaseType
  ): { valid: boolean; reason: string } {
    const kbDomain = getKbDomain(kbType);
    const expectedDim = kbDomain === MemoryDomain.Personal ? 1536 : 1024;

    if (embedding.length !== expectedDim) {
      return {
        valid: false,
        reason: `Invalid embedding dimension: expected ${expectedDim}, got ${embedding.length}`
      };
    }

    return {
      valid: true,
      reason: 'Embedding dimension matches KB domain'
    };
  }

  /**
   * Gets all recorded violations
   */
  public getViolations(): IsolationViolation[] {
    return [...this.violations];
  }

  /**
   * Gets access logs
   */
  public getAccessLogs(filter?: {
    entity?: AccessEntity;
    kbType?: KnowledgeBaseType;
    startTime?: Date;
    endTime?: Date;
  }): AccessLog[] {
    let logs = [...this.accessLogs];

    if (filter) {
      if (filter.entity) {
        logs = logs.filter(log => log.entity === filter.entity);
      }
      if (filter.kbType) {
        logs = logs.filter(log => log.kbType === filter.kbType);
      }
      if (filter.startTime) {
        logs = logs.filter(log => log.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        logs = logs.filter(log => log.timestamp <= filter.endTime!);
      }
    }

    return logs;
  }

  /**
   * Clears violation history (for testing)
   */
  public clearViolations(): void {
    this.violations = [];
  }

  /**
   * Generates isolation report
   */
  public generateIsolationReport(): {
    totalViolations: number;
    violationsByType: Record<ViolationType, number>;
    crossDomainAttempts: number;
    lastViolation?: IsolationViolation;
    isolationIntegrity: 'intact' | 'compromised';
  } {
    const violationsByType: Record<ViolationType, number> = {
      [ViolationType.CrossDomainAccess]: 0,
      [ViolationType.UnauthorizedMode]: 0,
      [ViolationType.InvalidAuthentication]: 0
    };

    this.violations.forEach(violation => {
      violationsByType[violation.violationType]++;
    });

    const crossDomainAttempts = violationsByType[ViolationType.CrossDomainAccess];

    return {
      totalViolations: this.violations.length,
      violationsByType,
      crossDomainAttempts,
      lastViolation: this.violations[this.violations.length - 1],
      isolationIntegrity: this.violations.length === 0 ? 'intact' : 'compromised'
    };
  }

  private getModeDomain(mode: OperationalMode): MemoryDomain {
    switch (mode) {
      case OperationalMode.Personal:
        return MemoryDomain.Personal;
      case OperationalMode.Professional:
        return MemoryDomain.Professional;
      default:
        throw new Error(`Invalid mode for domain mapping: ${mode}`);
    }
  }

  private validateEntityPermissions(
    entity: AccessEntity,
    kbType: KnowledgeBaseType,
    operation: MemoryOperation
  ): boolean {
    const kbDomain = getKbDomain(kbType);

    // Personal domain permissions
    if (kbDomain === MemoryDomain.Personal) {
      switch (entity) {
        case AccessEntity.Phoenix:
          return true; // Full access to personal KBs
        case AccessEntity.PersonalAgent:
          // Personal agents can read but have limited write
          return operation === MemoryOperation.Read || 
                 (operation === MemoryOperation.Write && 
                  (kbType === KnowledgeBaseType.Mind || kbType === KnowledgeBaseType.Heart));
        default:
          return false;
      }
    }

    // Professional domain permissions
    if (kbDomain === MemoryDomain.Professional) {
      switch (entity) {
        case AccessEntity.CipherGuard:
          return true; // Full access to professional KBs
        case AccessEntity.ProfessionalAgent:
          // Professional agents have full access to work KBs
          return true;
        default:
          return false;
      }
    }

    return false;
  }

  private logViolation(violation: IsolationViolation): void {
    this.violations.push(violation);

    if (this.config.logViolations) {
      console.error('[ISOLATION VIOLATION]', {
        timestamp: violation.timestamp,
        type: violation.violationType,
        sourceMode: violation.sourceMode,
        targetKb: violation.targetKb,
        details: violation.details
      });
    }

    if (this.config.alertOnViolation) {
      // In a real implementation, this would trigger alerts to Dad
      this.sendViolationAlert(violation);
    }
  }

  private logAccess(log: AccessLog): void {
    this.accessLogs.push(log);

    // Keep only last 10000 logs in memory
    if (this.accessLogs.length > 10000) {
      this.accessLogs = this.accessLogs.slice(-10000);
    }
  }

  private sendViolationAlert(violation: IsolationViolation): void {
    // Placeholder for alert system integration
    // In production, this would send alerts to Dad's monitoring system
    console.warn('[ALERT] Isolation violation detected:', violation);
  }
}

// Singleton instance for global isolation enforcement
export const globalIsolationValidator = new IsolationValidator({
  strictMode: true,
  logViolations: true,
  alertOnViolation: true
});