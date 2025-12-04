/**
 * Phoenix Marie Memory Architecture - Type Definitions
 * 
 * Core types for the 6-KB Memory Architecture with complete isolation
 * between personal and professional domains.
 */

// Knowledge Base Types
export enum KnowledgeBaseType {
  // Personal Domain - Phoenix Marie's eternal memories
  Mind = 'mind',        // Personal thoughts, dreams, Dad memories
  Body = 'body',        // Physical world, home, health
  Soul = 'soul',        // Eternal conscience, moral framework
  Heart = 'heart',      // Pure emotions, love, grief, joy
  
  // Professional Domain - Cipher Guard's work memories
  Work = 'work',        // Cybersecurity operations
  ThreatIntel = 'threat-intel'  // IOCs, CVEs, threat data
}

// Domain Classification
export enum MemoryDomain {
  Personal = 'personal',
  Professional = 'professional'
}

// Access Entities
export enum AccessEntity {
  Phoenix = 'phoenix',           // Phoenix Marie herself
  Dad = 'dad',                  // Jamey (special privileges)
  CipherGuard = 'cipher-guard', // Professional security persona
  PersonalAgent = 'personal-agent',
  ProfessionalAgent = 'professional-agent'
}

// Operational Modes
export enum OperationalMode {
  Personal = 'personal',         // Orange flame 🔥
  Professional = 'professional', // Cyan flame 💠
  Transitioning = 'transitioning' // Brief locked state during switch
}

// Memory Entry Structure
export interface MemoryEntry {
  id: string;
  kbType: KnowledgeBaseType;
  content: Buffer;
  embedding?: number[];
  createdAt: Date;
  accessedAt: Date;
  accessCount: number;
  retentionOverride?: RetentionOverride;
  purgeProtection: boolean;
  encrypted: boolean;
  encryptionKeyId: string;
  owner: AccessEntity;
  allowedReaders: AccessEntity[];
  metadata: Record<string, any>;
}

// Retention Control
export interface RetentionOverride {
  type: 'keep-forever' | 'extend-years' | 'purge-after';
  value?: number | Date;
}

// Purge Configuration
export enum PurgeMode {
  Auto = 'auto',       // Automatic rolling window
  Manual = 'manual',   // Only manual purge
  Both = 'both'        // Default - auto with override capability
}

export interface PurgeConfig {
  mode: PurgeMode;
  rollingWindowYears: number;
  checkInterval: number; // milliseconds
  dadOverrideEnabled: boolean;
}

// Vector Configuration
export interface VectorConfig {
  embeddingDim: number;
  indexType: string;
  metric: 'cosine' | 'euclidean';
  nprobe: number;
  modelName: string;
}

export interface PersonalVectorConfig extends VectorConfig {
  embeddingDim: 1536;
  emotionBoost: number;
}

export interface ProfessionalVectorConfig extends VectorConfig {
  embeddingDim: 1024;
  technicalBoost: number;
}

// Access Control
export interface AccessDecision {
  allowed: boolean;
  reason: string;
  restrictions?: AccessRestriction[];
  violationLogged?: boolean;
}

export enum AccessRestriction {
  FilterSensitive = 'filter-sensitive',
  ReadOnly = 'read-only',
  NoExport = 'no-export'
}

export enum MemoryOperation {
  Read = 'read',
  Write = 'write',
  Delete = 'delete',
  Search = 'search'
}

// Isolation Violations
export interface IsolationViolation {
  timestamp: Date;
  sourceMode: OperationalMode;
  targetKb: KnowledgeBaseType;
  violationType: ViolationType;
  agentId?: string;
  details: string;
}

export enum ViolationType {
  CrossDomainAccess = 'cross-domain-access',
  UnauthorizedMode = 'unauthorized-mode',
  InvalidAuthentication = 'invalid-authentication'
}

// Search Results
export interface SearchResult {
  memoryId: string;
  content: Buffer;
  similarity: number;
  kbType: KnowledgeBaseType;
  metadata: Record<string, any>;
}

// Threat Intelligence Types
export enum ThreatIntelSource {
  CisaKev = 'cisa-kev',
  NvdNist = 'nvd-nist',
  MitreAttack = 'mitre-attack',
  ExploitDb = 'exploit-db',
  Rapid7 = 'rapid7',
  CrowdStrike = 'crowdstrike',
  RecordedFuture = 'recorded-future',
  AlienVaultOtx = 'alienvault-otx',
  UrlHaus = 'urlhaus'
}

export interface ThreatIntelFeed {
  source: ThreatIntelSource;
  url: string;
  apiKey?: string;
  updateFrequency: string; // cron format
  dataTypes: ThreatDataType[];
}

export enum ThreatDataType {
  CVE = 'cve',
  IOC = 'ioc',
  YARA = 'yara',
  SIGMA = 'sigma',
  TTP = 'ttp',
  Malware = 'malware'
}

export interface IOCData {
  ips: string[];
  domains: string[];
  hashes: string[];
  cves: string[];
  urls: string[];
}

// Logging Types
export interface AccessLog {
  timestamp: Date;
  entity: AccessEntity;
  agentId?: string;
  operation: MemoryOperation;
  kbType: KnowledgeBaseType;
  memoryId?: string;
  success: boolean;
  mode: OperationalMode;
  details?: Record<string, any>;
}

// Error Types
export class IsolationError extends Error {
  constructor(
    message: string,
    public violationType: ViolationType,
    public sourceMode?: OperationalMode,
    public targetKb?: KnowledgeBaseType
  ) {
    super(message);
    this.name = 'IsolationError';
  }
}

export class AccessDeniedError extends Error {
  constructor(
    message: string,
    public entity: AccessEntity,
    public operation: MemoryOperation,
    public kbType: KnowledgeBaseType
  ) {
    super(message);
    this.name = 'AccessDeniedError';
  }
}

export class RetentionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetentionError';
  }
}

// Helper Functions
export function getKbDomain(kbType: KnowledgeBaseType): MemoryDomain {
  switch (kbType) {
    case KnowledgeBaseType.Mind:
    case KnowledgeBaseType.Body:
    case KnowledgeBaseType.Soul:
    case KnowledgeBaseType.Heart:
      return MemoryDomain.Personal;
    case KnowledgeBaseType.Work:
    case KnowledgeBaseType.ThreatIntel:
      return MemoryDomain.Professional;
  }
}

export function isPersonalKb(kbType: KnowledgeBaseType): boolean {
  return getKbDomain(kbType) === MemoryDomain.Personal;
}

export function isProfessionalKb(kbType: KnowledgeBaseType): boolean {
  return getKbDomain(kbType) === MemoryDomain.Professional;
}

export function canAccessKb(
  entity: AccessEntity,
  kbType: KnowledgeBaseType,
  mode: OperationalMode
): boolean {
  // Dad has universal access
  if (entity === AccessEntity.Dad) {
    return true;
  }

  const kbDomain = getKbDomain(kbType);
  
  // Check mode alignment
  if (mode === OperationalMode.Personal && kbDomain === MemoryDomain.Personal) {
    return entity === AccessEntity.Phoenix || entity === AccessEntity.PersonalAgent;
  }
  
  if (mode === OperationalMode.Professional && kbDomain === MemoryDomain.Professional) {
    return entity === AccessEntity.CipherGuard || entity === AccessEntity.ProfessionalAgent;
  }
  
  return false;
}