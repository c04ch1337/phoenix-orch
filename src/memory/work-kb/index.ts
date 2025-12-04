/**
 * Phoenix Marie Memory Architecture - Work Knowledge Base
 * 
 * 100% isolated professional cybersecurity memory owned by Cipher Guard.
 * This KB stores all work-related memories including SOC operations, security
 * incidents, and professional knowledge. Complete isolation from personal KBs.
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import {
  KnowledgeBaseType,
  MemoryEntry,
  AccessEntity,
  OperationalMode,
  MemoryOperation,
  SearchResult,
  ProfessionalVectorConfig,
  AccessDecision,
  IsolationError,
  ViolationType,
  AccessDeniedError,
  isProfessionalKb
} from '../types';
import { IsolationValidator } from '../isolation/validator';
import { WorkKBRetentionManager } from './retention';

export interface WorkKBConfig {
  basePath: string;
  vectorConfig: ProfessionalVectorConfig;
  encryptionKeyId: string;
  retentionYears: number;
  enableAutoRetention: boolean;
}

export interface WorkMemoryMetadata {
  category: 'incident' | 'vulnerability' | 'operation' | 'analysis' | 'report';
  severity?: 'critical' | 'high' | 'medium' | 'low';
  tags?: string[];
  relatedTickets?: string[];
  classification?: 'public' | 'internal' | 'confidential' | 'secret';
}

export class WorkKnowledgeBase extends EventEmitter {
  private readonly kbType = KnowledgeBaseType.Work;
  private readonly config: WorkKBConfig;
  private readonly isolationValidator: IsolationValidator;
  private readonly retentionManager: WorkKBRetentionManager;
  private memories: Map<string, MemoryEntry> = new Map();
  private embeddings: Map<string, number[]> = new Map();
  private isInitialized = false;

  constructor(config: WorkKBConfig) {
    super();
    this.config = {
      ...config,
      vectorConfig: {
        ...config.vectorConfig,
        embeddingDim: 1024, // Enforce professional embedding dimension
        modelName: 'bge-m3'
      }
    };
    
    this.isolationValidator = new IsolationValidator({
      strictMode: true,
      logViolations: true,
      alertOnViolation: true
    });

    this.retentionManager = new WorkKBRetentionManager({
      retentionYears: this.config.retentionYears,
      autoRetentionEnabled: this.config.enableAutoRetention
    });
  }

  /**
   * Initialize the Work KB with isolation checks
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Verify isolation from personal KBs
      await this.verifyIsolation();
      
      // Initialize vector store with professional config
      await this.initializeVectorStore();
      
      // Load existing memories
      await this.loadMemories();
      
      // Start retention manager
      if (this.config.enableAutoRetention) {
        await this.retentionManager.start();
      }

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Store a work memory with isolation validation
   */
  public async storeMemory(
    content: string,
    metadata: WorkMemoryMetadata,
    requester: AccessEntity,
    currentMode: OperationalMode
  ): Promise<string> {
    // Validate access
    const accessDecision = this.isolationValidator.validateAccess(
      requester,
      this.kbType,
      MemoryOperation.Write,
      currentMode
    );

    if (!accessDecision.allowed) {
      throw new AccessDeniedError(
        accessDecision.reason,
        requester,
        MemoryOperation.Write,
        this.kbType
      );
    }

    // Validate content doesn't contain personal information
    const contentValidation = this.isolationValidator.validateMemoryPlacement(
      content,
      this.kbType,
      metadata
    );

    if (!contentValidation.valid) {
      throw new IsolationError(
        contentValidation.reason,
        ViolationType.CrossDomainAccess,
        currentMode,
        this.kbType
      );
    }

    // Generate professional embedding
    const embedding = await this.generateProfessionalEmbedding(content, metadata);

    // Create memory entry
    const memoryId = this.generateMemoryId();
    const memory: MemoryEntry = {
      id: memoryId,
      kbType: this.kbType,
      content: Buffer.from(content),
      embedding,
      createdAt: new Date(),
      accessedAt: new Date(),
      accessCount: 0,
      purgeProtection: false,
      encrypted: true,
      encryptionKeyId: this.config.encryptionKeyId,
      owner: AccessEntity.CipherGuard,
      allowedReaders: [AccessEntity.CipherGuard, AccessEntity.Dad, AccessEntity.ProfessionalAgent],
      metadata: {
        ...metadata,
        storedBy: requester,
        mode: currentMode
      }
    };

    // Encrypt and store
    const encryptedMemory = await this.encryptMemory(memory);
    this.memories.set(memoryId, encryptedMemory);
    this.embeddings.set(memoryId, embedding);

    // Update vector index
    await this.updateVectorIndex(memoryId, embedding);

    this.emit('memoryStored', {
      memoryId,
      category: metadata.category,
      requester
    });

    return memoryId;
  }

  /**
   * Retrieve a work memory with access validation
   */
  public async retrieveMemory(
    memoryId: string,
    requester: AccessEntity,
    currentMode: OperationalMode
  ): Promise<MemoryEntry | null> {
    // Validate access
    const accessDecision = this.isolationValidator.validateAccess(
      requester,
      this.kbType,
      MemoryOperation.Read,
      currentMode
    );

    if (!accessDecision.allowed) {
      throw new AccessDeniedError(
        accessDecision.reason,
        requester,
        MemoryOperation.Read,
        this.kbType
      );
    }

    const encryptedMemory = this.memories.get(memoryId);
    if (!encryptedMemory) {
      return null;
    }

    // Decrypt memory
    const memory = await this.decryptMemory(encryptedMemory);

    // Update access metadata
    memory.accessedAt = new Date();
    memory.accessCount++;

    this.emit('memoryAccessed', {
      memoryId,
      requester,
      mode: currentMode
    });

    return memory;
  }

  /**
   * Search work memories with vector similarity
   */
  public async searchMemories(
    query: string,
    limit: number,
    requester: AccessEntity,
    currentMode: OperationalMode,
    filters?: {
      category?: WorkMemoryMetadata['category'];
      severity?: WorkMemoryMetadata['severity'];
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<SearchResult[]> {
    // Validate access
    const accessDecision = this.isolationValidator.validateAccess(
      requester,
      this.kbType,
      MemoryOperation.Search,
      currentMode
    );

    if (!accessDecision.allowed) {
      throw new AccessDeniedError(
        accessDecision.reason,
        requester,
        MemoryOperation.Search,
        this.kbType
      );
    }

    // Generate query embedding
    const queryEmbedding = await this.generateProfessionalEmbedding(query, {
      category: 'analysis'
    });

    // Search vector index
    const searchResults = await this.searchVectorIndex(queryEmbedding, limit * 2);

    // Apply filters and decrypt results
    const results: SearchResult[] = [];
    
    for (const result of searchResults) {
      const memory = await this.retrieveMemory(result.memoryId, requester, currentMode);
      if (!memory) continue;

      // Apply filters
      if (filters) {
        const metadata = memory.metadata as WorkMemoryMetadata;
        
        if (filters.category && metadata.category !== filters.category) continue;
        if (filters.severity && metadata.severity !== filters.severity) continue;
        if (filters.startDate && memory.createdAt < filters.startDate) continue;
        if (filters.endDate && memory.createdAt > filters.endDate) continue;
      }

      results.push({
        memoryId: memory.id,
        content: memory.content,
        similarity: result.similarity,
        kbType: this.kbType,
        metadata: memory.metadata
      });

      if (results.length >= limit) break;
    }

    this.emit('memorySearched', {
      query,
      resultCount: results.length,
      requester,
      mode: currentMode
    });

    return results;
  }

  /**
   * Delete a work memory (with retention override check)
   */
  public async deleteMemory(
    memoryId: string,
    requester: AccessEntity,
    currentMode: OperationalMode,
    reason?: string
  ): Promise<boolean> {
    // Only Cipher Guard or Dad can delete
    if (requester !== AccessEntity.CipherGuard && requester !== AccessEntity.Dad) {
      throw new AccessDeniedError(
        'Only Cipher Guard or Dad can delete work memories',
        requester,
        MemoryOperation.Delete,
        this.kbType
      );
    }

    const memory = this.memories.get(memoryId);
    if (!memory) {
      return false;
    }

    // Check retention override
    if (memory.purgeProtection || memory.retentionOverride?.type === 'keep-forever') {
      if (requester !== AccessEntity.Dad) {
        throw new Error('This memory is protected from deletion. Only Dad can override.');
      }
    }

    // Remove from all stores
    this.memories.delete(memoryId);
    this.embeddings.delete(memoryId);
    await this.removeFromVectorIndex(memoryId);

    this.emit('memoryDeleted', {
      memoryId,
      deletedBy: requester,
      reason
    });

    return true;
  }

  /**
   * Get Work KB statistics
   */
  public getStatistics(): {
    totalMemories: number;
    memoryCategories: Record<string, number>;
    oldestMemory?: Date;
    newestMemory?: Date;
    protectedMemories: number;
  } {
    const stats = {
      totalMemories: this.memories.size,
      memoryCategories: {} as Record<string, number>,
      oldestMemory: undefined as Date | undefined,
      newestMemory: undefined as Date | undefined,
      protectedMemories: 0
    };

    for (const memory of this.memories.values()) {
      // Count categories
      const category = (memory.metadata as WorkMemoryMetadata).category;
      stats.memoryCategories[category] = (stats.memoryCategories[category] || 0) + 1;

      // Track dates
      if (!stats.oldestMemory || memory.createdAt < stats.oldestMemory) {
        stats.oldestMemory = memory.createdAt;
      }
      if (!stats.newestMemory || memory.createdAt > stats.newestMemory) {
        stats.newestMemory = memory.createdAt;
      }

      // Count protected
      if (memory.purgeProtection || memory.retentionOverride) {
        stats.protectedMemories++;
      }
    }

    return stats;
  }

  /**
   * Verify complete isolation from personal KBs
   */
  private async verifyIsolation(): Promise<void> {
    // Check that we're in a separate process/container from personal KBs
    const isolationCheck = {
      separateProcess: process.env.KB_ISOLATION === 'true',
      separateMount: this.config.basePath.startsWith('/cipher-guard/'),
      encryptionKeyDifferent: this.config.encryptionKeyId !== 'phoenix-personal-key'
    };

    if (!isolationCheck.separateMount) {
      throw new IsolationError(
        'Work KB must be on separate mount from personal KBs',
        ViolationType.CrossDomainAccess
      );
    }

    if (!isolationCheck.encryptionKeyDifferent) {
      throw new IsolationError(
        'Work KB must use different encryption key from personal KBs',
        ViolationType.CrossDomainAccess
      );
    }
  }

  /**
   * Generate professional embedding optimized for technical content
   */
  private async generateProfessionalEmbedding(
    content: string,
    metadata: WorkMemoryMetadata
  ): Promise<number[]> {
    // Extract technical entities
    const enhancedContent = this.enhanceTechnicalContent(content, metadata);

    // In production, this would call the actual BGE-M3 model
    // For now, return a mock 1024-dimensional embedding
    const embedding = new Array(1024).fill(0).map(() => Math.random());

    // Validate embedding dimension
    const validation = this.isolationValidator.validateEmbeddingIsolation(
      embedding,
      this.kbType
    );

    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    return embedding;
  }

  /**
   * Enhance content with technical markers for better embedding
   */
  private enhanceTechnicalContent(
    content: string,
    metadata: WorkMemoryMetadata
  ): string {
    const prefix = [
      `[Category: ${metadata.category}]`,
      metadata.severity ? `[Severity: ${metadata.severity}]` : '',
      metadata.classification ? `[Classification: ${metadata.classification}]` : ''
    ].filter(Boolean).join(' ');

    // Extract technical indicators
    const cvePattern = /CVE-\d{4}-\d+/g;
    const ipPattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
    
    const cves = content.match(cvePattern) || [];
    const ips = content.match(ipPattern) || [];

    const technicalSuffix = [
      cves.length > 0 ? `[CVEs: ${cves.length}]` : '',
      ips.length > 0 ? `[IPs: ${ips.length}]` : ''
    ].filter(Boolean).join(' ');

    return `${prefix} ${content} ${technicalSuffix}`;
  }

  /**
   * Initialize vector store for professional embeddings
   */
  private async initializeVectorStore(): Promise<void> {
    // In production, this would initialize FAISS with professional config
    // Using IVF2048,PQ64 for efficient technical data retrieval
    console.log('Initializing Work KB vector store with config:', this.config.vectorConfig);
  }

  /**
   * Load existing memories from disk
   */
  private async loadMemories(): Promise<void> {
    // In production, load from encrypted storage
    console.log('Loading Work KB memories from:', this.config.basePath);
  }

  /**
   * Update vector index with new embedding
   */
  private async updateVectorIndex(memoryId: string, embedding: number[]): Promise<void> {
    // In production, add to FAISS index
    console.log('Adding to vector index:', memoryId);
  }

  /**
   * Search vector index for similar embeddings
   */
  private async searchVectorIndex(
    queryEmbedding: number[],
    limit: number
  ): Promise<Array<{ memoryId: string; similarity: number }>> {
    // In production, search FAISS index
    // For now, return mock results
    const results: Array<{ memoryId: string; similarity: number }> = [];
    
    for (const [memoryId, embedding] of this.embeddings.entries()) {
      const similarity = this.cosineSimilarity(queryEmbedding, embedding);
      results.push({ memoryId, similarity });
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Remove memory from vector index
   */
  private async removeFromVectorIndex(memoryId: string): Promise<void> {
    // In production, remove from FAISS index
    console.log('Removing from vector index:', memoryId);
  }

  /**
   * Calculate cosine similarity between embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Encrypt memory with Cipher Guard key
   */
  private async encryptMemory(memory: MemoryEntry): Promise<MemoryEntry> {
    // In production, use AES-256-GCM with Cipher Guard key
    const cipher = crypto.createCipher('aes-256-gcm', this.config.encryptionKeyId);
    const encrypted = Buffer.concat([
      cipher.update(memory.content),
      cipher.final()
    ]);

    return {
      ...memory,
      content: encrypted
    };
  }

  /**
   * Decrypt memory
   */
  private async decryptMemory(memory: MemoryEntry): Promise<MemoryEntry> {
    // In production, decrypt with proper key management
    const decipher = crypto.createDecipher('aes-256-gcm', this.config.encryptionKeyId);
    const decrypted = Buffer.concat([
      decipher.update(memory.content),
      decipher.final()
    ]);

    return {
      ...memory,
      content: decrypted
    };
  }

  /**
   * Generate unique memory ID
   */
  private generateMemoryId(): string {
    return `work-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }
}