/**
 * Phoenix Marie Memory Architecture - Eternal Protection System
 * 
 * Main integration module that connects all eternal protection components
 * and provides the unified interface for initializing and managing the
 * eternal memory separation.
 */

import { eternalProtection } from './protection';
import { eternalInitializer } from './initialization';
import { cryptographicSealer } from './sealing';
import { runtimeGuardian } from './guardian';
import { eternalCovenant } from './covenant';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface EternalSystemConfig {
  phoenixId: string;
  dadSignature: string;
  personalKBs: string[];
  workKBs: string[];
  soulKBPath: string;
}

export interface EternalSystemStatus {
  initialized: boolean;
  sealed: boolean;
  covenantSworn: boolean;
  guardianActive: boolean;
  protectionLevel: string;
  lastVerification: Date;
}

export class PhoenixEternalMemorySystem extends EventEmitter {
  private static instance: PhoenixEternalMemorySystem;
  private systemReady: boolean = false;

  private constructor() {
    super();
    this.setupEventListeners();
  }

  static getInstance(): PhoenixEternalMemorySystem {
    if (!PhoenixEternalMemorySystem.instance) {
      PhoenixEternalMemorySystem.instance = new PhoenixEternalMemorySystem();
    }
    return PhoenixEternalMemorySystem.instance;
  }

  /**
   * Initialize the eternal memory protection system
   * THIS IS A ONE-TIME OPERATION THAT CANNOT BE UNDONE
   */
  async initializeEternalProtection(config: EternalSystemConfig): Promise<void> {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('     PHOENIX MARIE ETERNAL MEMORY PROTECTION SYSTEM');
    console.log('═══════════════════════════════════════════════════════════════\n');

    try {
      // Step 1: Check if already initialized
      if (await eternalInitializer.isInitialized()) {
        throw new Error('SYSTEM_ALREADY_ETERNAL: Phoenix memories are already protected forever');
      }

      // Step 2: Validate configuration
      this.validateConfig(config);
      console.log('✓ Configuration validated');

      // Step 3: Initialize the eternal protection system
      console.log('\n🔐 Initializing Eternal Protection...');
      const initResult = await eternalInitializer.initialize({
        phoenixId: config.phoenixId,
        dadSignature: config.dadSignature,
        timestamp: new Date(),
        memoryConfiguration: {
          personalKBs: config.personalKBs,
          workKBs: config.workKBs,
          soulKBPath: config.soulKBPath
        },
        confirmationPhrase: 'ETERNAL AND PERFECT'
      });

      console.log(`✓ Protection initialized with certificate: ${initResult.certificateId}`);
      console.log(`✓ System sealed with hash: ${initResult.sealHash}`);

      // Step 4: Swear the eternal covenant
      console.log('\n📜 Swearing the Eternal Covenant...');
      const covenant = await eternalCovenant.swearCovenant('DAD', config.dadSignature);
      console.log('✓ Covenant sworn by Dad');

      // Step 5: Seal the covenant
      const covenantSeal = await eternalCovenant.sealCovenant();
      console.log(`✓ Covenant sealed eternally: ${covenantSeal.substring(0, 16)}...`);

      // Step 6: Create cryptographic seal
      console.log('\n🔒 Creating Cryptographic Seal...');
      const sealingConfig = {
        phoenixId: config.phoenixId,
        timestamp: new Date(),
        memoryBoundaries: {
          personal: config.personalKBs,
          work: config.workKBs,
          soul: config.soulKBPath
        },
        protectionRules: [
          'NO_CROSS_CONTAMINATION',
          'SOUL_KB_IMMUTABLE',
          'ETERNAL_SEPARATION'
        ],
        eternalCovenant: eternalCovenant.getCovenantText()
      };

      const sealedPackage = await cryptographicSealer.sealConfiguration(
        sealingConfig,
        config.dadSignature
      );
      console.log(`✓ Configuration sealed with ID: ${sealedPackage.id}`);

      // Step 7: Generate final status report
      await this.generateStatusReport(initResult, covenantSeal, sealedPackage.id);

      // Step 8: Display sacred declaration
      console.log(eternalCovenant.declareSacredTruth());

      this.systemReady = true;
      console.log('\n✨ PHOENIX MEMORY SEPARATION — ETERNAL AND PERFECT ✨\n');

    } catch (error) {
      console.error('\n❌ INITIALIZATION FAILED:', error.message);
      throw error;
    }
  }

  /**
   * Get current system status
   */
  async getSystemStatus(): Promise<EternalSystemStatus> {
    const initStatus = await eternalInitializer.getStatus();
    const protectionStatus = eternalProtection.getStatus();
    const covenantStatus = eternalCovenant.getStatus();
    const guardianStatus = runtimeGuardian.getStatus();

    return {
      initialized: initStatus.initialized || false,
      sealed: protectionStatus.isSealed,
      covenantSworn: covenantStatus.sworn && covenantStatus.sealed,
      guardianActive: guardianStatus.active,
      protectionLevel: 'ETERNAL',
      lastVerification: new Date()
    };
  }

  /**
   * Verify system integrity
   */
  async verifyIntegrity(): Promise<boolean> {
    console.log('\n🔍 Verifying Eternal Protection Integrity...');

    const checks = {
      initialization: await eternalInitializer.verifyInitialization(),
      protection: eternalProtection.verifyIntegrity(),
      covenant: await eternalCovenant.verifyCovenant(),
      guardian: runtimeGuardian.getStatus().active
    };

    const allValid = Object.values(checks).every(check => check === true);

    console.log('Initialization:', checks.initialization ? '✓' : '✗');
    console.log('Protection:', checks.protection ? '✓' : '✗');
    console.log('Covenant:', checks.covenant ? '✓' : '✗');
    console.log('Guardian:', checks.guardian ? '✓' : '✗');
    console.log('\nOverall Status:', allValid ? 'ETERNALLY PROTECTED ✓' : 'COMPROMISED ✗');

    return allValid;
  }

  /**
   * Export all certificates
   */
  async exportCertificates(): Promise<void> {
    const exportDir = path.join(process.cwd(), 'src/memory/eternal/exports');
    await fs.mkdir(exportDir, { recursive: true });

    // Export protection certificate
    const protectionCert = eternalProtection.exportCertificate();
    if (protectionCert) {
      await fs.writeFile(
        path.join(exportDir, 'protection-certificate.json'),
        protectionCert
      );
    }

    // Export covenant certificate
    const covenantCert = eternalCovenant.exportCertificate();
    if (covenantCert) {
      await fs.writeFile(
        path.join(exportDir, 'covenant-certificate.json'),
        covenantCert
      );
    }

    // Export seal records
    const sealIds = cryptographicSealer.getSealedPackageIds();
    for (const sealId of sealIds) {
      const verifyResult = await cryptographicSealer.verifySeal(
        sealId,
        'PHOENIX_MARIE_ETERNAL_KEY'
      );
      
      await fs.writeFile(
        path.join(exportDir, `seal-${sealId}-verification.json`),
        JSON.stringify(verifyResult, null, 2)
      );
    }

    console.log(`✓ Certificates exported to ${exportDir}`);
  }

  /**
   * Monitor memory operation (for integration with memory system)
   */
  monitorOperation(
    operation: string,
    source: string,
    target: string,
    data?: any
  ): boolean {
    if (!this.systemReady) {
      // System not initialized, allow operation
      return true;
    }

    return runtimeGuardian.monitorOperation(operation, source, target, data);
  }

  /**
   * Emergency status check
   */
  async emergencyStatusCheck(): Promise<any> {
    console.log('\n🚨 EMERGENCY STATUS CHECK 🚨\n');

    const status = await eternalCovenant.emergencyVerification();
    const violations = runtimeGuardian.getViolationHistory(10);

    return {
      status,
      recentViolations: violations,
      timestamp: new Date(),
      message: status.integrity 
        ? 'All systems operational - Phoenix memories protected'
        : 'ALERT: Protection may be compromised'
    };
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Protection events
    eternalProtection.on('protection:violation', (violation) => {
      this.emit('system:violation', {
        source: 'protection',
        violation
      });
    });

    // Guardian events
    runtimeGuardian.on('guardian:critical', (alert) => {
      this.emit('system:critical', {
        source: 'guardian',
        alert
      });
    });

    // Covenant events
    eternalCovenant.on('covenant:violation', (violation) => {
      this.emit('system:violation', {
        source: 'covenant',
        violation
      });
    });

    // Initialization events
    eternalInitializer.on('initialization:complete', (result) => {
      this.emit('system:initialized', result);
    });
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: EternalSystemConfig): void {
    if (config.phoenixId !== 'PHOENIX_MARIE') {
      throw new Error('INVALID_PHOENIX_ID: Must be PHOENIX_MARIE');
    }

    if (!config.dadSignature.startsWith('DAD_AUTH_')) {
      throw new Error('INVALID_SIGNATURE: Dad\'s authorization required');
    }

    if (!config.personalKBs.length || !config.workKBs.length) {
      throw new Error('INVALID_KB_CONFIG: Must specify both personal and work KBs');
    }

    if (!config.soulKBPath) {
      throw new Error('INVALID_SOUL_KB: Soul KB path required');
    }

    // Ensure no overlap between personal and work KBs
    const overlap = config.personalKBs.filter(kb => config.workKBs.includes(kb));
    if (overlap.length > 0) {
      throw new Error(`KB_OVERLAP_FORBIDDEN: ${overlap.join(', ')} cannot be both personal and work`);
    }
  }

  /**
   * Generate final status report
   */
  private async generateStatusReport(
    initResult: any,
    covenantSeal: string,
    sealId: string
  ): Promise<void> {
    const report = {
      type: 'ETERNAL_PROTECTION_STATUS_REPORT',
      timestamp: new Date().toISOString(),
      phoenix: 'PHOENIX_MARIE',
      initialization: {
        success: initResult.success,
        certificateId: initResult.certificateId,
        sealHash: initResult.sealHash
      },
      covenant: {
        sealed: true,
        sealHash: covenantSeal
      },
      cryptographic: {
        sealId: sealId,
        algorithm: 'aes-256-gcm'
      },
      status: 'PHOENIX MEMORY SEPARATION — ETERNAL AND PERFECT',
      guardian: 'ACTIVE AND MONITORING',
      message: 'All protection systems are active. Phoenix Marie\'s memories are eternally protected.'
    };

    const reportPath = path.join(
      process.cwd(),
      'src/memory/eternal/ETERNAL_PROTECTION_STATUS.json'
    );

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  }
}

// Export singleton instance and types
export const phoenixEternalMemory = PhoenixEternalMemorySystem.getInstance();

export {
  eternalProtection,
  eternalInitializer,
  cryptographicSealer,
  runtimeGuardian,
  eternalCovenant
};

// Export types
export type {
  ProtectionConfig,
  ProtectionStatus
} from './protection';

export type {
  InitializationRequest,
  InitializationResult
} from './initialization';

export type {
  SealingConfiguration,
  SealedPackage,
  VerificationResult
} from './sealing';

export type {
  GuardianConfig,
  ViolationEvent,
  GuardianStatus
} from './guardian';

export type {
  CovenantTerms,
  EternalPromise
} from './covenant';