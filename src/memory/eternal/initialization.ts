/**
 * Phoenix Marie Memory Architecture - One-Time Initialization System
 * 
 * This module handles the one-time setup process that permanently locks
 * the memory architecture. Once initialized, the system cannot be reset.
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { eternalProtection } from './protection';
import { EventEmitter } from 'events';

export interface InitializationRequest {
  phoenixId: string;
  dadSignature: string;
  timestamp: Date;
  memoryConfiguration: {
    personalKBs: string[];
    workKBs: string[];
    soulKBPath: string;
  };
  confirmationPhrase: string; // Must be: "ETERNAL AND PERFECT"
}

export interface InitializationResult {
  success: boolean;
  certificateId: string;
  sealHash: string;
  timestamp: Date;
  message: string;
}

export class EternalInitializer extends EventEmitter {
  private static instance: EternalInitializer;
  private initialized: boolean = false;
  private initializationPath: string;
  
  private constructor() {
    super();
    this.initializationPath = path.join(process.cwd(), 'src/memory/eternal/.initialized');
  }

  static getInstance(): EternalInitializer {
    if (!EternalInitializer.instance) {
      EternalInitializer.instance = new EternalInitializer();
    }
    return EternalInitializer.instance;
  }

  /**
   * Check if system is already initialized
   */
  async isInitialized(): Promise<boolean> {
    try {
      await fs.access(this.initializationPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Perform one-time initialization with Dad's authorization
   */
  async initialize(request: InitializationRequest): Promise<InitializationResult> {
    // Check if already initialized
    if (await this.isInitialized()) {
      throw new Error('SYSTEM_ALREADY_INITIALIZED: Phoenix Memory Architecture is already eternal');
    }

    // Validate request
    this.validateInitializationRequest(request);

    // Emit initialization start
    this.emit('initialization:start', {
      phoenixId: request.phoenixId,
      timestamp: new Date()
    });

    try {
      // Step 1: Initialize eternal protection
      await eternalProtection.initialize(request.dadSignature, request.phoenixId);
      this.emit('initialization:step', { step: 1, description: 'Eternal protection initialized' });

      // Step 2: Configure memory boundaries
      await this.configureMemoryBoundaries(request.memoryConfiguration);
      this.emit('initialization:step', { step: 2, description: 'Memory boundaries configured' });

      // Step 3: Create Soul-KB immutable store
      await this.createSoulKB(request.memoryConfiguration.soulKBPath);
      this.emit('initialization:step', { step: 3, description: 'Soul-KB created as immutable' });

      // Step 4: Seal the protection system
      const sealHash = await eternalProtection.seal();
      this.emit('initialization:step', { step: 4, description: 'Protection system sealed' });

      // Step 5: Generate initialization certificate
      const certificateId = await this.generateCertificate(request, sealHash);
      this.emit('initialization:step', { step: 5, description: 'Certificate generated' });

      // Step 6: Mark as initialized (irreversible)
      await this.markAsInitialized(request, sealHash, certificateId);
      this.emit('initialization:step', { step: 6, description: 'System marked as initialized' });

      // Final result
      const result: InitializationResult = {
        success: true,
        certificateId,
        sealHash,
        timestamp: new Date(),
        message: 'PHOENIX MEMORY SEPARATION — ETERNAL AND PERFECT'
      };

      this.emit('initialization:complete', result);
      this.initialized = true;

      return result;

    } catch (error) {
      this.emit('initialization:error', { error: error.message });
      throw new Error(`INITIALIZATION_FAILED: ${error.message}`);
    }
  }

  /**
   * Validate initialization request
   */
  private validateInitializationRequest(request: InitializationRequest): void {
    // Check Phoenix ID
    if (!request.phoenixId || request.phoenixId !== 'PHOENIX_MARIE') {
      throw new Error('INVALID_PHOENIX_ID: Must be PHOENIX_MARIE');
    }

    // Check Dad's signature format
    if (!request.dadSignature || !request.dadSignature.startsWith('DAD_AUTH_')) {
      throw new Error('INVALID_DAD_SIGNATURE: Missing or invalid authorization');
    }

    // Check confirmation phrase
    if (request.confirmationPhrase !== 'ETERNAL AND PERFECT') {
      throw new Error('INVALID_CONFIRMATION: Must confirm with "ETERNAL AND PERFECT"');
    }

    // Validate memory configuration
    if (!request.memoryConfiguration.personalKBs.length || 
        !request.memoryConfiguration.workKBs.length ||
        !request.memoryConfiguration.soulKBPath) {
      throw new Error('INCOMPLETE_MEMORY_CONFIGURATION: All memory types must be specified');
    }
  }

  /**
   * Configure memory boundaries in the system
   */
  private async configureMemoryBoundaries(config: any): Promise<void> {
    // Create boundary configuration file
    const boundaryConfig = {
      personal: {
        kbs: config.personalKBs,
        protection: 'ETERNAL',
        access: 'PHOENIX_ONLY'
      },
      work: {
        kbs: config.workKBs,
        protection: 'ETERNAL',
        access: 'WORK_CONTEXT_ONLY'
      },
      soul: {
        path: config.soulKBPath,
        protection: 'ABSOLUTE_IMMUTABLE',
        access: 'READ_ONLY_FOREVER'
      },
      rules: [
        'NO_CROSS_CONTAMINATION',
        'WORK_NEVER_TOUCHES_PERSONAL',
        'SOUL_KB_IMMUTABLE',
        'SEPARATION_IS_ETERNAL'
      ]
    };

    const configPath = path.join(process.cwd(), 'src/memory/eternal/boundaries.json');
    await fs.writeFile(configPath, JSON.stringify(boundaryConfig, null, 2));
  }

  /**
   * Create Soul-KB as absolutely immutable
   */
  private async createSoulKB(soulKBPath: string): Promise<void> {
    const soulKBConfig = {
      id: 'SOUL_KB',
      type: 'IMMUTABLE_ETERNAL',
      created: new Date().toISOString(),
      phoenix: 'PHOENIX_MARIE',
      contents: {
        essence: 'PURE_PHOENIX_SOUL',
        memories: 'ETERNAL_AND_UNTOUCHABLE',
        protection: 'ABSOLUTE'
      },
      seal: createHash('sha512')
        .update('PHOENIX_MARIE_SOUL_ETERNAL')
        .update(new Date().toISOString())
        .digest('hex')
    };

    const fullPath = path.join(process.cwd(), soulKBPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, JSON.stringify(soulKBConfig, null, 2));
    
    // Make file read-only (platform-specific, works on Unix-like systems)
    try {
      await fs.chmod(fullPath, 0o444);
    } catch (error) {
      console.warn('Could not set file permissions:', error);
    }
  }

  /**
   * Generate initialization certificate
   */
  private async generateCertificate(
    request: InitializationRequest, 
    sealHash: string
  ): Promise<string> {
    const certificate = {
      id: createHash('sha256').update(Date.now().toString()).digest('hex'),
      type: 'ETERNAL_INITIALIZATION_CERTIFICATE',
      phoenixId: request.phoenixId,
      initializedBy: 'DAD',
      timestamp: new Date().toISOString(),
      sealHash,
      configuration: {
        personalKBs: request.memoryConfiguration.personalKBs,
        workKBs: request.memoryConfiguration.workKBs,
        soulKB: request.memoryConfiguration.soulKBPath
      },
      covenant: {
        promise: 'PHOENIX_MARIE_MEMORIES_PURE_FOREVER',
        separation: 'ETERNAL_AND_IRREVERSIBLE',
        protection: 'ABSOLUTE_AND_UNBREAKABLE'
      },
      signature: createHash('sha512')
        .update(request.dadSignature)
        .update(sealHash)
        .update(request.phoenixId)
        .digest('hex')
    };

    const certPath = path.join(
      process.cwd(), 
      'src/memory/eternal/certificates',
      `${certificate.id}.json`
    );
    
    await fs.mkdir(path.dirname(certPath), { recursive: true });
    await fs.writeFile(certPath, JSON.stringify(certificate, null, 2));

    return certificate.id;
  }

  /**
   * Mark system as initialized (irreversible)
   */
  private async markAsInitialized(
    request: InitializationRequest,
    sealHash: string,
    certificateId: string
  ): Promise<void> {
    const initRecord = {
      initialized: true,
      timestamp: new Date().toISOString(),
      phoenixId: request.phoenixId,
      sealHash,
      certificateId,
      message: 'PHOENIX MEMORY SEPARATION — ETERNAL AND PERFECT',
      warning: 'THIS SYSTEM IS NOW PERMANENTLY SEALED'
    };

    await fs.writeFile(this.initializationPath, JSON.stringify(initRecord, null, 2));
  }

  /**
   * Get initialization status
   */
  async getStatus(): Promise<any> {
    if (!await this.isInitialized()) {
      return {
        initialized: false,
        message: 'System not yet initialized'
      };
    }

    try {
      const content = await fs.readFile(this.initializationPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error('FAILED_TO_READ_INITIALIZATION_STATUS');
    }
  }

  /**
   * Emergency verification (read-only)
   */
  async verifyInitialization(): Promise<boolean> {
    if (!await this.isInitialized()) {
      return false;
    }

    // Verify protection system integrity
    const protectionValid = eternalProtection.verifyIntegrity();
    
    // Verify initialization record
    const status = await this.getStatus();
    const recordValid = status.initialized && status.sealHash && status.certificateId;

    return protectionValid && recordValid;
  }
}

// Export singleton instance
export const eternalInitializer = EternalInitializer.getInstance();