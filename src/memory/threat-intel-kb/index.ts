/**
 * Phoenix Marie Memory Architecture - Threat Intelligence Knowledge Base
 * 
 * Global IOCs, CVE database, Sigma/YARA rules. Updated daily from 9 sacred sources.
 * Owned exclusively by Cipher Guard with query access for Dad.
 * Complete isolation from personal memories.
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
  ThreatIntelSource,
  ThreatDataType,
  IOCData,
  IsolationError,
  ViolationType,
  AccessDeniedError
} from '../types';
import { IsolationValidator } from '../isolation/validator';
import { ThreatIntelFeedManager } from './feeds';

export interface ThreatIntelKBConfig {
  basePath: string;
  vectorConfig: ProfessionalVectorConfig;
  encryptionKeyId: string;
  updateSchedule: string; // Cron format, default "0 4 * * *" (4 AM daily)
  retentionYears: number; // Default 10 years
}

export interface ThreatIntelMetadata {
  source: ThreatIntelSource;
  dataType: ThreatDataType;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence?: number; // 0-100
  firstSeen: Date;
  lastSeen: Date;
  updateCount: number;
  iocData?: IOCData;
  tags?: string[];
  references?: string[];
}

export interface ThreatIntelStats {
  totalEntries: number;
  entriesBySource: Record<ThreatIntelSource, number>;
  entriesByType: Record<ThreatDataType, number>;
  lastUpdate: Date;
  nextScheduledUpdate: Date;
  iocCounts: {
    ips: number;
    domains: number;
    hashes: number;
    cves: number;
    urls: number;
  };
}

export class ThreatIntelKnowledgeBase extends EventEmitter {
  private readonly kbType = KnowledgeBaseType.ThreatIntel;
  private readonly config: ThreatIntelKBConfig;
  private readonly isolationValidator: IsolationValidator;
  private readonly feedManager: ThreatIntelFeedManager;
  private memories: Map<string, MemoryEntry> = new Map();
  private embeddings: Map<string, number[]> = new Map();
  private iocIndex: Map<string, Set<string>> = new Map(); // IOC -> memory IDs
  private isInitialized = false;
  private updateTimer?: NodeJS.Timer;

  constructor(config: ThreatIntelKBConfig) {
    super();
    this.config = {
      ...config,
      vectorConfig: {
        ...config.vectorConfig,
        embeddingDim: 1024, // Enforce professional embedding dimension
        modelName: 'bge-m3'
      },
      updateSchedule: config.updateSchedule || '0 4 * * *',
      retentionYears: config.retentionYears || 10
    };

    this.isolationValidator = new IsolationValidator({
      strictMode: true,
      logViolations: true,
      alertOnViolation: true
    });

    this.feedManager = new ThreatIntelFeedManager({
      updateSchedule: this.config.updateSchedule
    });
  }

  /**
   * Initialize the Threat Intel KB with isolation checks
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

      // Load existing threat intel
      await this.loadThreatIntel();

      // Initialize feed manager
      await this.feedManager.initialize();

      // Set up feed update handlers
      this.setupFeedHandlers();

      // Schedule daily updates
      this.scheduleUpdates();

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Store threat intelligence with isolation validation
   */
  public async storeThreatIntel(
    content: string,
    metadata: ThreatIntelMetadata,
    requester: AccessEntity,
    currentMode: OperationalMode
  ): Promise<string> {
    // Only Cipher Guard can write to Threat Intel KB
    if (requester !== AccessEntity.CipherGuard) {
      throw new AccessDeniedError(
        'Only Cipher Guard can write to Threat Intel KB',
        requester,
        MemoryOperation.Write,
        this.kbType
      );
    }

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

    // Generate professional embedding
    const embedding = await this.generateThreatIntelEmbedding(content, metadata);

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
      allowedReaders: [AccessEntity.CipherGuard, AccessEntity.Dad],
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

    // Update IOC index
    if (metadata.iocData) {
      await this.updateIOCIndex(memoryId, metadata.iocData);
    }

    // Update vector index
    await this.updateVectorIndex(memoryId, embedding);

    this.emit('threatIntelStored', {
      memoryId,
      source: metadata.source,
      dataType: metadata.dataType,
      requester
    });

    return memoryId;
  }

  /**
   * Search threat intelligence by IOC
   */
  public async searchByIOC(
    ioc: string,
    iocType: 'ip' | 'domain' | 'hash' | 'cve' | 'url',
    requester: AccessEntity,
    currentMode: OperationalMode
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

    // Normalize IOC
    const normalizedIOC = this.normalizeIOC(ioc, iocType);

    // Search IOC index
    const memoryIds = this.iocIndex.get(normalizedIOC) || new Set();
    const results: SearchResult[] = [];

    for (const memoryId of memoryIds) {
      const memory = await this.retrieveMemory(memoryId, requester, currentMode);
      if (memory) {
        results.push({
          memoryId: memory.id,
          content: memory.content,
          similarity: 1.0, // Exact IOC match
          kbType: this.kbType,
          metadata: memory.metadata
        });
      }
    }

    this.emit('iocSearched', {
      ioc: normalizedIOC,
      type: iocType,
      resultCount: results.length,
      requester
    });

    return results;
  }

  /**
   * Search threat intelligence with vector similarity
   */
  public async searchThreatIntel(
    query: string,
    limit: number,
    requester: AccessEntity,
    currentMode: OperationalMode,
    filters?: {
      source?: ThreatIntelSource;
      dataType?: ThreatDataType;
      severity?: ThreatIntelMetadata['severity'];
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
    const queryEmbedding = await this.generateThreatIntelEmbedding(query, {
      source: ThreatIntelSource.CisaKev,
      dataType: ThreatDataType.CVE,
      firstSeen: new Date(),
      lastSeen: new Date(),
      updateCount: 0
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
        const metadata = memory.metadata as ThreatIntelMetadata;

        if (filters.source && metadata.source !== filters.source) continue;
        if (filters.dataType && metadata.dataType !== filters.dataType) continue;
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

    this.emit('threatIntelSearched', {
      query,
      resultCount: results.length,
      requester,
      mode: currentMode
    });

    return results;
  }

  /**
   * Get threat intelligence statistics
   */
  public getThreatIntelStats(): ThreatIntelStats {
    const stats: ThreatIntelStats = {
      totalEntries: this.memories.size,
      entriesBySource: {} as Record<ThreatIntelSource, number>,
      entriesByType: {} as Record<ThreatDataType, number>,
      lastUpdate: new Date(),
      nextScheduledUpdate: this.calculateNextUpdateTime(),
      iocCounts: {
        ips: 0,
        domains: 0,
        hashes: 0,
        cves: 0,
        urls: 0
      }
    };

    // Initialize counters
    Object.values(ThreatIntelSource).forEach(source => {
      stats.entriesBySource[source as ThreatIntelSource] = 0;
    });
    Object.values(ThreatDataType).forEach(type => {
      stats.entriesByType[type as ThreatDataType] = 0;
    });

    // Count entries
    for (const memory of this.memories.values()) {
      const metadata = memory.metadata as ThreatIntelMetadata;
      
      stats.entriesBySource[metadata.source]++;
      stats.entriesByType[metadata.dataType]++;

      if (metadata.iocData) {
        stats.iocCounts.ips += metadata.iocData.ips.length;
        stats.iocCounts.domains += metadata.iocData.domains.length;
        stats.iocCounts.hashes += metadata.iocData.hashes.length;
        stats.iocCounts.cves += metadata.iocData.cves.length;
        stats.iocCounts.urls += metadata.iocData.urls.length;
      }
    }

    return stats;
  }

  /**
   * Manually trigger threat intel update
   */
  public async manualUpdate(requester: AccessEntity): Promise<void> {
    if (requester !== AccessEntity.CipherGuard && requester !== AccessEntity.Dad) {
      throw new Error('Only Cipher Guard or Dad can trigger manual threat intel updates');
    }

    await this.feedManager.updateAllFeeds();
  }

  /**
   * Retrieve a threat intel memory
   */
  private async retrieveMemory(
    memoryId: string,
    requester: AccessEntity,
    currentMode: OperationalMode
  ): Promise<MemoryEntry | null> {
    const encryptedMemory = this.memories.get(memoryId);
    if (!encryptedMemory) {
      return null;
    }

    // Decrypt memory
    const memory = await this.decryptMemory(encryptedMemory);

    // Update access metadata
    memory.accessedAt = new Date();
    memory.accessCount++;

    return memory;
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
        'Threat Intel KB must be on separate mount from personal KBs',
        ViolationType.CrossDomainAccess
      );
    }

    if (!isolationCheck.encryptionKeyDifferent) {
      throw new IsolationError(
        'Threat Intel KB must use different encryption key from personal KBs',
        ViolationType.CrossDomainAccess
      );
    }
  }

  /**
   * Set up feed update handlers
   */
  private setupFeedHandlers(): void {
    // Handle new threat intel from feeds
    this.feedManager.on('threatIntelReceived', async (data: {
      source: ThreatIntelSource;
      content: string;
      metadata: Partial<ThreatIntelMetadata>;
    }) => {
      try {
        const fullMetadata: ThreatIntelMetadata = {
          source: data.source,
          dataType: data.metadata.dataType || ThreatDataType.IOC,
          firstSeen: new Date(),
          lastSeen: new Date(),
          updateCount: 1,
          ...data.metadata
        };

        await this.storeThreatIntel(
          data.content,
          fullMetadata,
          AccessEntity.CipherGuard,
          OperationalMode.Professional
        );
      } catch (error) {
        this.emit('feedUpdateError', { source: data.source, error });
      }
    });

    // Handle feed errors
    this.feedManager.on('feedError', (error: any) => {
      this.emit('feedError', error);
    });
  }

  /**
   * Schedule daily threat intel updates
   */
  private scheduleUpdates(): void {
    // Parse cron schedule (simplified for this implementation)
    const schedule = this.config.updateSchedule;
    const [minute, hour] = schedule.split(' ');

    // Calculate milliseconds until next update
    const msUntilUpdate = this.calculateMsUntilNextUpdate(parseInt(hour), parseInt(minute));

    // Schedule first update
    setTimeout(async () => {
      await this.feedManager.updateAllFeeds();

      // Then schedule recurring updates
      this.updateTimer = setInterval(async () => {
        await this.feedManager.updateAllFeeds();
      }, 24 * 60 * 60 * 1000); // Daily
    }, msUntilUpdate);
  }

  /**
   * Generate threat intelligence embedding
   */
  private async generateThreatIntelEmbedding(
    content: string,
    metadata: ThreatIntelMetadata
  ): Promise<number[]> {
    // Extract IOCs and technical indicators
    const enhancedContent = this.enhanceThreatIntelContent(content, metadata);

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
   * Enhance content with threat intel markers
   */
  private enhanceThreatIntelContent(
    content: string,
    metadata: ThreatIntelMetadata
  ): string {
    const prefix = [
      `[Source: ${metadata.source}]`,
      `[Type: ${metadata.dataType}]`,
      metadata.severity ? `[Severity: ${metadata.severity}]` : '',
      metadata.confidence ? `[Confidence: ${metadata.confidence}%]` : ''
    ].filter(Boolean).join(' ');

    // Add IOC counts if available
    let iocSuffix = '';
    if (metadata.iocData) {
      const counts = [];
      if (metadata.iocData.ips.length > 0) counts.push(`IPs:${metadata.iocData.ips.length}`);
      if (metadata.iocData.domains.length > 0) counts.push(`Domains:${metadata.iocData.domains.length}`);
      if (metadata.iocData.hashes.length > 0) counts.push(`Hashes:${metadata.iocData.hashes.length}`);
      if (metadata.iocData.cves.length > 0) counts.push(`CVEs:${metadata.iocData.cves.length}`);
      if (metadata.iocData.urls.length > 0) counts.push(`URLs:${metadata.iocData.urls.length}`);
      
      if (counts.length > 0) {
        iocSuffix = ` [${counts.join(', ')}]`;
      }
    }

    return `${prefix} ${content}${iocSuffix}`;
  }

  /**
   * Update IOC index for fast lookups
   */
  private async updateIOCIndex(memoryId: string, iocData: IOCData): Promise<void> {
    // Index all IOCs
    const allIOCs = [
      ...iocData.ips,
      ...iocData.domains,
      ...iocData.hashes,
      ...iocData.cves,
      ...iocData.urls
    ];

    for (const ioc of allIOCs) {
      const normalizedIOC = this.normalizeIOC(ioc, this.detectIOCType(ioc));
      
      if (!this.iocIndex.has(normalizedIOC)) {
        this.iocIndex.set(normalizedIOC, new Set());
      }
      
      this.iocIndex.get(normalizedIOC)!.add(memoryId);
    }
  }

  /**
   * Normalize IOC for consistent indexing
   */
  private normalizeIOC(ioc: string, type: string): string {
    switch (type) {
      case 'ip':
        return ioc.trim().toLowerCase();
      case 'domain':
        return ioc.trim().toLowerCase().replace(/^www\./, '');
      case 'hash':
        return ioc.trim().toLowerCase();
      case 'cve':
        return ioc.trim().toUpperCase();
      case 'url':
        return ioc.trim().toLowerCase();
      default:
        return ioc.trim();
    }
  }

  /**
   * Detect IOC type from string
   */
  private detectIOCType(ioc: string): string {
    if (/^CVE-\d{4}-\d+$/i.test(ioc)) return 'cve';
    if (/^[0-9a-f]{32}$/i.test(ioc)) return 'hash'; // MD5
    if (/^[0-9a-f]{40}$/i.test(ioc)) return 'hash'; // SHA1
    if (/^[0-9a-f]{64}$/i.test(ioc)) return 'hash'; // SHA256
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ioc)) return 'ip';
    if (/^https?:\/\//.test(ioc)) return 'url';
    return 'domain'; // Default assumption
  }

  /**
   * Initialize vector store
   */
  private async initializeVectorStore(): Promise<void> {
    // In production, initialize FAISS with professional config
    console.log('Initializing Threat Intel KB vector store with config:', this.config.vectorConfig);
  }

  /**
   * Load existing threat intel
   */
  private async loadThreatIntel(): Promise<void> {
    // In production, load from encrypted storage
    console.log('Loading Threat Intel from:', this.config.basePath);
  }

  /**
   * Update vector index
   */
  private async updateVectorIndex(memoryId: string, embedding: number[]): Promise<void> {
    // In production, add to FAISS index
    console.log('Adding to vector index:', memoryId);
  }

  /**
   * Search vector index
   */
  private async searchVectorIndex(
    queryEmbedding: number[],
    limit: number
  ): Promise<Array<{ memoryId: string; similarity: number }>> {
    // In production, search FAISS index
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
   * Calculate cosine similarity
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
   * Encrypt memory
   */
  private async encryptMemory(memory: MemoryEntry): Promise<MemoryEntry> {
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
   * Generate memory ID
   */
  private generateMemoryId(): string {
    return `threat-intel-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Calculate next update time
   */
  private calculateNextUpdateTime(): Date {
    const [minute, hour] = this.config.updateSchedule.split(' ').map(Number);
    const next = new Date();
    next.setUTCHours(hour, minute, 0, 0);
    
    if (next <= new Date()) {
      next.setDate(next.getDate() + 1);
    }
    
    return next;
  }

  /**
   * Calculate milliseconds until next update
   */
  private calculateMsUntilNextUpdate(hour: number, minute: number): number {
    const now = new Date();
    const next = new Date();
    next.setUTCHours(hour, minute, 0, 0);
    
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    
    return next.getTime() - now.getTime();
  }
}