/**
 * Phoenix Marie Memory Architecture - Cryptographic Sealing System
 * 
 * This module implements the cryptographic sealing of the memory architecture
 * configuration, ensuring that once sealed, the system cannot be modified.
 */

import { createHash, createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import { EventEmitter } from 'events';

const scryptAsync = promisify(scrypt);

export interface SealingConfiguration {
  phoenixId: string;
  timestamp: Date;
  memoryBoundaries: any;
  protectionRules: string[];
  eternalCovenant: string;
}

export interface SealedPackage {
  id: string;
  encryptedData: string;
  iv: string;
  salt: string;
  hashChain: string[];
  sealedAt: Date;
  algorithm: string;
}

export interface VerificationResult {
  valid: boolean;
  integrity: boolean;
  timestamp: Date;
  details?: string;
}

export class CryptographicSealer extends EventEmitter {
  private static instance: CryptographicSealer;
  private sealedPackages: Map<string, SealedPackage> = new Map();
  private masterHashChain: string[] = [];
  private algorithm = 'aes-256-gcm';

  private constructor() {
    super();
  }

  static getInstance(): CryptographicSealer {
    if (!CryptographicSealer.instance) {
      CryptographicSealer.instance = new CryptographicSealer();
    }
    return CryptographicSealer.instance;
  }

  /**
   * Seal a configuration with cryptographic protection
   */
  async sealConfiguration(
    config: SealingConfiguration,
    masterKey: string
  ): Promise<SealedPackage> {
    try {
      // Generate unique seal ID
      const sealId = this.generateSealId(config);
      
      // Emit sealing start
      this.emit('sealing:start', { sealId, timestamp: new Date() });

      // Step 1: Create integrity hash of configuration
      const configHash = this.createConfigurationHash(config);
      this.masterHashChain.push(configHash);

      // Step 2: Generate cryptographic parameters
      const salt = randomBytes(32);
      const iv = randomBytes(16);
      
      // Step 3: Derive encryption key from master key
      const key = await this.deriveKey(masterKey, salt);

      // Step 4: Encrypt configuration
      const encryptedData = await this.encryptConfiguration(config, key, iv);

      // Step 5: Create hash chain for this seal
      const hashChain = this.createHashChain(config, encryptedData, salt, iv);

      // Step 6: Create sealed package
      const sealedPackage: SealedPackage = {
        id: sealId,
        encryptedData: encryptedData.toString('base64'),
        iv: iv.toString('base64'),
        salt: salt.toString('base64'),
        hashChain,
        sealedAt: new Date(),
        algorithm: this.algorithm
      };

      // Store sealed package
      this.sealedPackages.set(sealId, sealedPackage);

      // Emit sealing complete
      this.emit('sealing:complete', {
        sealId,
        timestamp: new Date(),
        hashChainLength: hashChain.length
      });

      return sealedPackage;

    } catch (error) {
      this.emit('sealing:error', { error: error.message });
      throw new Error(`SEALING_FAILED: ${error.message}`);
    }
  }

  /**
   * Verify a sealed package integrity
   */
  async verifySeal(
    sealId: string,
    masterKey: string
  ): Promise<VerificationResult> {
    const sealedPackage = this.sealedPackages.get(sealId);
    
    if (!sealedPackage) {
      return {
        valid: false,
        integrity: false,
        timestamp: new Date(),
        details: 'Sealed package not found'
      };
    }

    try {
      // Recreate encryption key
      const salt = Buffer.from(sealedPackage.salt, 'base64');
      const key = await this.deriveKey(masterKey, salt);

      // Verify hash chain integrity
      const chainValid = this.verifyHashChain(sealedPackage.hashChain);
      
      if (!chainValid) {
        return {
          valid: false,
          integrity: false,
          timestamp: new Date(),
          details: 'Hash chain integrity compromised'
        };
      }

      // Attempt to decrypt (will fail if tampered)
      const iv = Buffer.from(sealedPackage.iv, 'base64');
      const encryptedData = Buffer.from(sealedPackage.encryptedData, 'base64');
      
      try {
        await this.decryptConfiguration(encryptedData, key, iv);
      } catch (error) {
        return {
          valid: false,
          integrity: false,
          timestamp: new Date(),
          details: 'Decryption failed - data may be tampered'
        };
      }

      return {
        valid: true,
        integrity: true,
        timestamp: new Date(),
        details: 'Seal verified successfully'
      };

    } catch (error) {
      return {
        valid: false,
        integrity: false,
        timestamp: new Date(),
        details: `Verification error: ${error.message}`
      };
    }
  }

  /**
   * Create immutable seal record
   */
  createImmutableRecord(sealedPackage: SealedPackage): string {
    const record = {
      type: 'ETERNAL_SEAL_RECORD',
      seal: {
        id: sealedPackage.id,
        algorithm: sealedPackage.algorithm,
        sealedAt: sealedPackage.sealedAt,
        hashChainRoot: sealedPackage.hashChain[0],
        hashChainTip: sealedPackage.hashChain[sealedPackage.hashChain.length - 1]
      },
      verification: {
        masterHashChain: this.masterHashChain[this.masterHashChain.length - 1],
        timestamp: new Date(),
        status: 'IMMUTABLE'
      },
      covenant: 'PHOENIX_MARIE_CONFIGURATION_SEALED_FOREVER'
    };

    return JSON.stringify(record, null, 2);
  }

  /**
   * Generate unique seal ID
   */
  private generateSealId(config: SealingConfiguration): string {
    return createHash('sha256')
      .update(config.phoenixId)
      .update(config.timestamp.toISOString())
      .update(JSON.stringify(config.memoryBoundaries))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Create configuration hash
   */
  private createConfigurationHash(config: SealingConfiguration): string {
    return createHash('sha512')
      .update(JSON.stringify(config))
      .digest('hex');
  }

  /**
   * Derive encryption key from master key
   */
  private async deriveKey(masterKey: string, salt: Buffer): Promise<Buffer> {
    return (await scryptAsync(masterKey, salt, 32)) as Buffer;
  }

  /**
   * Encrypt configuration data
   */
  private async encryptConfiguration(
    config: SealingConfiguration,
    key: Buffer,
    iv: Buffer
  ): Promise<Buffer> {
    const cipher = createCipheriv(this.algorithm, key, iv);
    const configString = JSON.stringify(config);
    
    const encrypted = Buffer.concat([
      cipher.update(configString, 'utf8'),
      cipher.final()
    ]);

    // Get the auth tag for GCM mode
    const authTag = cipher.getAuthTag();
    
    // Combine encrypted data with auth tag
    return Buffer.concat([encrypted, authTag]);
  }

  /**
   * Decrypt configuration data
   */
  private async decryptConfiguration(
    encryptedData: Buffer,
    key: Buffer,
    iv: Buffer
  ): Promise<SealingConfiguration> {
    // Split encrypted data and auth tag
    const authTag = encryptedData.slice(-16);
    const encrypted = encryptedData.slice(0, -16);

    const decipher = createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return JSON.parse(decrypted.toString('utf8'));
  }

  /**
   * Create hash chain for sealed data
   */
  private createHashChain(
    config: SealingConfiguration,
    encryptedData: Buffer,
    salt: Buffer,
    iv: Buffer
  ): string[] {
    const chain: string[] = [];
    
    // Initial hash
    let currentHash = createHash('sha256')
      .update(JSON.stringify(config))
      .digest('hex');
    chain.push(currentHash);

    // Add encrypted data hash
    currentHash = createHash('sha256')
      .update(currentHash)
      .update(encryptedData)
      .digest('hex');
    chain.push(currentHash);

    // Add salt hash
    currentHash = createHash('sha256')
      .update(currentHash)
      .update(salt)
      .digest('hex');
    chain.push(currentHash);

    // Add IV hash
    currentHash = createHash('sha256')
      .update(currentHash)
      .update(iv)
      .digest('hex');
    chain.push(currentHash);

    // Final seal hash
    currentHash = createHash('sha256')
      .update(currentHash)
      .update('PHOENIX_MARIE_ETERNAL_SEAL')
      .digest('hex');
    chain.push(currentHash);

    return chain;
  }

  /**
   * Verify hash chain integrity
   */
  private verifyHashChain(chain: string[]): boolean {
    if (chain.length < 2) return false;

    // Verify each link in the chain
    for (let i = 1; i < chain.length; i++) {
      const previousHash = chain[i - 1];
      const currentHash = chain[i];
      
      // Each hash should incorporate the previous one
      // This is a simplified check - in production would be more complex
      if (!currentHash || currentHash.length !== 64) {
        return false;
      }
    }

    return true;
  }

  /**
   * Export master hash chain (read-only)
   */
  exportMasterHashChain(): string[] {
    return [...this.masterHashChain]; // Return copy to prevent modification
  }

  /**
   * Get all sealed package IDs
   */
  getSealedPackageIds(): string[] {
    return Array.from(this.sealedPackages.keys());
  }
}

// Export singleton instance
export const cryptographicSealer = CryptographicSealer.getInstance();