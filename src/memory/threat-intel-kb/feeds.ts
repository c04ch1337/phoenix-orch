/**
 * Phoenix Marie Memory Architecture - Threat Intelligence Feed Manager
 * 
 * Integrates with the 9 sacred threat intelligence sources for daily updates.
 * Manages both push (webhook) and pull mechanisms for threat data ingestion.
 */

import { EventEmitter } from 'events';
import * as https from 'https';
import * as http from 'http';
import {
  ThreatIntelSource,
  ThreatIntelFeed,
  ThreatDataType,
  IOCData
} from '../types';

export interface FeedManagerConfig {
  updateSchedule: string; // Cron format
  apiKeys?: Partial<Record<ThreatIntelSource, string>>;
  webhookPort?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export interface FeedUpdateResult {
  source: ThreatIntelSource;
  success: boolean;
  itemsReceived: number;
  errors: string[];
  timestamp: Date;
}

export interface ThreatIntelData {
  source: ThreatIntelSource;
  content: string;
  metadata: {
    dataType: ThreatDataType;
    severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
    confidence?: number;
    iocData?: IOCData;
    tags?: string[];
    references?: string[];
  };
}

export class ThreatIntelFeedManager extends EventEmitter {
  private readonly config: Required<FeedManagerConfig>;
  private readonly feeds: Map<ThreatIntelSource, ThreatIntelFeed>;
  private webhookServer?: http.Server;
  private isInitialized = false;
  private updateResults: Map<ThreatIntelSource, FeedUpdateResult> = new Map();

  constructor(config: FeedManagerConfig) {
    super();
    this.config = {
      updateSchedule: config.updateSchedule,
      apiKeys: config.apiKeys || {},
      webhookPort: config.webhookPort || 8443,
      retryAttempts: config.retryAttempts || 3,
      retryDelayMs: config.retryDelayMs || 5000
    };

    this.feeds = this.initializeFeeds();
  }

  /**
   * Initialize the feed manager
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Start webhook server for push feeds
      await this.startWebhookServer();

      // Verify API keys for authenticated feeds
      await this.verifyApiKeys();

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Update all threat intelligence feeds
   */
  public async updateAllFeeds(): Promise<Map<ThreatIntelSource, FeedUpdateResult>> {
    const results = new Map<ThreatIntelSource, FeedUpdateResult>();

    for (const [source, feed] of this.feeds) {
      try {
        const result = await this.updateFeed(source, feed);
        results.set(source, result);
        this.updateResults.set(source, result);
      } catch (error) {
        const errorResult: FeedUpdateResult = {
          source,
          success: false,
          itemsReceived: 0,
          errors: [`Feed update failed: ${error}`],
          timestamp: new Date()
        };
        results.set(source, errorResult);
        this.updateResults.set(source, errorResult);
      }
    }

    this.emit('allFeedsUpdated', results);
    return results;
  }

  /**
   * Update a specific feed
   */
  public async updateFeed(
    source: ThreatIntelSource,
    feed: ThreatIntelFeed
  ): Promise<FeedUpdateResult> {
    const result: FeedUpdateResult = {
      source,
      success: false,
      itemsReceived: 0,
      errors: [],
      timestamp: new Date()
    };

    try {
      switch (source) {
        case ThreatIntelSource.CisaKev:
          await this.updateCisaKev(feed, result);
          break;
        case ThreatIntelSource.NvdNist:
          await this.updateNvdNist(feed, result);
          break;
        case ThreatIntelSource.MitreAttack:
          await this.updateMitreAttack(feed, result);
          break;
        case ThreatIntelSource.ExploitDb:
          await this.updateExploitDb(feed, result);
          break;
        case ThreatIntelSource.Rapid7:
          await this.updateRapid7(feed, result);
          break;
        case ThreatIntelSource.CrowdStrike:
          await this.updateCrowdStrike(feed, result);
          break;
        case ThreatIntelSource.RecordedFuture:
          await this.updateRecordedFuture(feed, result);
          break;
        case ThreatIntelSource.AlienVaultOtx:
          await this.updateAlienVaultOtx(feed, result);
          break;
        case ThreatIntelSource.UrlHaus:
          await this.updateUrlHaus(feed, result);
          break;
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.errors.push(`Unexpected error: ${error}`);
    }

    return result;
  }

  /**
   * Get the last update results
   */
  public getLastUpdateResults(): Map<ThreatIntelSource, FeedUpdateResult> {
    return new Map(this.updateResults);
  }

  /**
   * Initialize the 9 sacred threat intel feeds
   */
  private initializeFeeds(): Map<ThreatIntelSource, ThreatIntelFeed> {
    const feeds = new Map<ThreatIntelSource, ThreatIntelFeed>();

    // 1. CISA Known Exploited Vulnerabilities
    feeds.set(ThreatIntelSource.CisaKev, {
      source: ThreatIntelSource.CisaKev,
      url: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
      updateFrequency: '0 4 * * *',
      dataTypes: [ThreatDataType.CVE]
    });

    // 2. National Vulnerability Database
    feeds.set(ThreatIntelSource.NvdNist, {
      source: ThreatIntelSource.NvdNist,
      url: 'https://services.nvd.nist.gov/rest/json/cves/2.0',
      apiKey: this.config.apiKeys?.NvdNist,
      updateFrequency: '0 4 * * *',
      dataTypes: [ThreatDataType.CVE]
    });

    // 3. MITRE ATT&CK Framework
    feeds.set(ThreatIntelSource.MitreAttack, {
      source: ThreatIntelSource.MitreAttack,
      url: 'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json',
      updateFrequency: '0 4 * * *',
      dataTypes: [ThreatDataType.TTP]
    });

    // 4. Exploit Database
    feeds.set(ThreatIntelSource.ExploitDb, {
      source: ThreatIntelSource.ExploitDb,
      url: 'https://www.exploit-db.com/feeds/json',
      updateFrequency: '0 4 * * *',
      dataTypes: [ThreatDataType.CVE, ThreatDataType.Malware]
    });

    // 5. Rapid7 Threat Command
    feeds.set(ThreatIntelSource.Rapid7, {
      source: ThreatIntelSource.Rapid7,
      url: 'https://api.threatcommand.com/v1/iocs',
      apiKey: this.config.apiKeys?.Rapid7,
      updateFrequency: '0 4 * * *',
      dataTypes: [ThreatDataType.IOC]
    });

    // 6. CrowdStrike Falcon Intelligence
    feeds.set(ThreatIntelSource.CrowdStrike, {
      source: ThreatIntelSource.CrowdStrike,
      url: 'https://api.crowdstrike.com/intel/v2/indicators',
      apiKey: this.config.apiKeys?.CrowdStrike,
      updateFrequency: '0 4 * * *',
      dataTypes: [ThreatDataType.IOC, ThreatDataType.Malware]
    });

    // 7. Recorded Future
    feeds.set(ThreatIntelSource.RecordedFuture, {
      source: ThreatIntelSource.RecordedFuture,
      url: 'https://api.recordedfuture.com/v2/ioc/search',
      apiKey: this.config.apiKeys?.RecordedFuture,
      updateFrequency: '0 4 * * *',
      dataTypes: [ThreatDataType.IOC]
    });

    // 8. AlienVault Open Threat Exchange
    feeds.set(ThreatIntelSource.AlienVaultOtx, {
      source: ThreatIntelSource.AlienVaultOtx,
      url: 'https://otx.alienvault.com/api/v1/pulses/subscribed',
      apiKey: this.config.apiKeys?.AlienVaultOtx,
      updateFrequency: '0 4 * * *',
      dataTypes: [ThreatDataType.IOC, ThreatDataType.YARA]
    });

    // 9. URLhaus Malware URL Feed
    feeds.set(ThreatIntelSource.UrlHaus, {
      source: ThreatIntelSource.UrlHaus,
      url: 'https://urlhaus.abuse.ch/downloads/json_recent/',
      updateFrequency: '0 4 * * *',
      dataTypes: [ThreatDataType.IOC, ThreatDataType.Malware]
    });

    return feeds;
  }

  /**
   * Start webhook server for push-based feeds
   */
  private async startWebhookServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.webhookServer = http.createServer((req, res) => {
        if (req.method === 'POST') {
          let body = '';
          
          req.on('data', chunk => {
            body += chunk.toString();
          });
          
          req.on('end', () => {
            this.handleWebhook(req.url || '', body);
            res.writeHead(200);
            res.end('OK');
          });
        } else {
          res.writeHead(405);
          res.end('Method Not Allowed');
        }
      });

      this.webhookServer.listen(this.config.webhookPort, () => {
        console.log(`Threat Intel webhook server listening on port ${this.config.webhookPort}`);
        resolve();
      });

      this.webhookServer.on('error', reject);
    });
  }

  /**
   * Handle incoming webhook data
   */
  private handleWebhook(path: string, body: string): void {
    try {
      // Determine source from webhook path
      const source = this.getSourceFromWebhookPath(path);
      if (!source) {
        console.error('Unknown webhook path:', path);
        return;
      }

      // Parse and emit threat intel data
      const data = JSON.parse(body);
      this.processWebhookData(source, data);
    } catch (error) {
      console.error('Webhook processing error:', error);
    }
  }

  /**
   * Update CISA Known Exploited Vulnerabilities
   */
  private async updateCisaKev(feed: ThreatIntelFeed, result: FeedUpdateResult): Promise<void> {
    try {
      const data = await this.fetchJson(feed.url);
      
      if (data.vulnerabilities && Array.isArray(data.vulnerabilities)) {
        for (const vuln of data.vulnerabilities) {
          const threatData: ThreatIntelData = {
            source: ThreatIntelSource.CisaKev,
            content: JSON.stringify(vuln),
            metadata: {
              dataType: ThreatDataType.CVE,
              severity: this.mapCisaSeverity(vuln),
              iocData: {
                cves: [vuln.cveID],
                ips: [],
                domains: [],
                hashes: [],
                urls: []
              },
              tags: ['known-exploited', vuln.vendorProject, vuln.product].filter(Boolean),
              references: [vuln.notes].filter(Boolean)
            }
          };

          this.emit('threatIntelReceived', threatData);
          result.itemsReceived++;
        }
      }
    } catch (error) {
      result.errors.push(`CISA KEV update error: ${error}`);
    }
  }

  /**
   * Update National Vulnerability Database
   */
  private async updateNvdNist(feed: ThreatIntelFeed, result: FeedUpdateResult): Promise<void> {
    try {
      // NVD requires date range parameters
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1); // Last 24 hours

      const url = `${feed.url}?lastModStartDate=${startDate.toISOString()}&lastModEndDate=${endDate.toISOString()}`;
      const headers = feed.apiKey ? { 'apiKey': feed.apiKey } : {};
      
      const data = await this.fetchJson(url, headers);
      
      if (data.vulnerabilities && Array.isArray(data.vulnerabilities)) {
        for (const item of data.vulnerabilities) {
          const cve = item.cve;
          const threatData: ThreatIntelData = {
            source: ThreatIntelSource.NvdNist,
            content: JSON.stringify(cve),
            metadata: {
              dataType: ThreatDataType.CVE,
              severity: this.mapNvdSeverity(cve),
              confidence: cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || 0,
              iocData: {
                cves: [cve.id],
                ips: [],
                domains: [],
                hashes: [],
                urls: []
              },
              tags: this.extractNvdTags(cve),
              references: cve.references?.map((ref: any) => ref.url) || []
            }
          };

          this.emit('threatIntelReceived', threatData);
          result.itemsReceived++;
        }
      }
    } catch (error) {
      result.errors.push(`NVD update error: ${error}`);
    }
  }

  /**
   * Update MITRE ATT&CK Framework
   */
  private async updateMitreAttack(feed: ThreatIntelFeed, result: FeedUpdateResult): Promise<void> {
    try {
      const data = await this.fetchJson(feed.url);
      
      if (data.objects && Array.isArray(data.objects)) {
        // Filter for techniques and tactics
        const techniques = data.objects.filter((obj: any) => 
          obj.type === 'attack-pattern' || obj.type === 'malware' || obj.type === 'tool'
        );

        for (const technique of techniques) {
          const threatData: ThreatIntelData = {
            source: ThreatIntelSource.MitreAttack,
            content: JSON.stringify(technique),
            metadata: {
              dataType: ThreatDataType.TTP,
              tags: [
                technique.type,
                ...technique.kill_chain_phases?.map((kcp: any) => kcp.phase_name) || []
              ],
              references: technique.external_references?.map((ref: any) => ref.url) || []
            }
          };

          this.emit('threatIntelReceived', threatData);
          result.itemsReceived++;
        }
      }
    } catch (error) {
      result.errors.push(`MITRE ATT&CK update error: ${error}`);
    }
  }

  /**
   * Update Exploit Database
   */
  private async updateExploitDb(feed: ThreatIntelFeed, result: FeedUpdateResult): Promise<void> {
    try {
      const data = await this.fetchJson(feed.url);
      
      if (Array.isArray(data)) {
        for (const exploit of data.slice(0, 100)) { // Limit to recent 100
          const threatData: ThreatIntelData = {
            source: ThreatIntelSource.ExploitDb,
            content: JSON.stringify(exploit),
            metadata: {
              dataType: ThreatDataType.CVE,
              tags: [
                exploit.platform,
                exploit.type,
                exploit.verified ? 'verified' : 'unverified'
              ].filter(Boolean),
              references: [`https://www.exploit-db.com/exploits/${exploit.id}`]
            }
          };

          this.emit('threatIntelReceived', threatData);
          result.itemsReceived++;
        }
      }
    } catch (error) {
      result.errors.push(`Exploit-DB update error: ${error}`);
    }
  }

  /**
   * Update Rapid7 Threat Command
   */
  private async updateRapid7(feed: ThreatIntelFeed, result: FeedUpdateResult): Promise<void> {
    if (!feed.apiKey) {
      result.errors.push('Rapid7 API key not configured');
      return;
    }

    try {
      const headers = {
        'Authorization': `Bearer ${feed.apiKey}`,
        'Content-Type': 'application/json'
      };

      const data = await this.fetchJson(feed.url, headers);
      
      if (data.iocs && Array.isArray(data.iocs)) {
        for (const ioc of data.iocs) {
          const iocData = this.extractIOCs(ioc);
          
          const threatData: ThreatIntelData = {
            source: ThreatIntelSource.Rapid7,
            content: JSON.stringify(ioc),
            metadata: {
              dataType: ThreatDataType.IOC,
              severity: ioc.severity,
              confidence: ioc.confidence,
              iocData,
              tags: ioc.tags || [],
              references: ioc.references || []
            }
          };

          this.emit('threatIntelReceived', threatData);
          result.itemsReceived++;
        }
      }
    } catch (error) {
      result.errors.push(`Rapid7 update error: ${error}`);
    }
  }

  /**
   * Update CrowdStrike Falcon Intelligence
   */
  private async updateCrowdStrike(feed: ThreatIntelFeed, result: FeedUpdateResult): Promise<void> {
    if (!feed.apiKey) {
      result.errors.push('CrowdStrike API key not configured');
      return;
    }

    try {
      // CrowdStrike uses OAuth2, simplified here
      const headers = {
        'Authorization': `Bearer ${feed.apiKey}`,
        'Accept': 'application/json'
      };

      const data = await this.fetchJson(feed.url, headers);
      
      if (data.resources && Array.isArray(data.resources)) {
        for (const indicator of data.resources) {
          const iocData = this.extractIOCs(indicator);
          
          const threatData: ThreatIntelData = {
            source: ThreatIntelSource.CrowdStrike,
            content: JSON.stringify(indicator),
            metadata: {
              dataType: ThreatDataType.IOC,
              severity: indicator.severity,
              confidence: indicator.confidence,
              iocData,
              tags: indicator.labels || [],
              references: []
            }
          };

          this.emit('threatIntelReceived', threatData);
          result.itemsReceived++;
        }
      }
    } catch (error) {
      result.errors.push(`CrowdStrike update error: ${error}`);
    }
  }

  /**
   * Update Recorded Future
   */
  private async updateRecordedFuture(feed: ThreatIntelFeed, result: FeedUpdateResult): Promise<void> {
    if (!feed.apiKey) {
      result.errors.push('Recorded Future API key not configured');
      return;
    }

    try {
      const headers = {
        'X-RFToken': feed.apiKey,
        'Accept': 'application/json'
      };

      const data = await this.fetchJson(feed.url, headers);
      
      if (data.data && Array.isArray(data.data)) {
        for (const entity of data.data) {
          const iocData = this.extractIOCs(entity);
          
          const threatData: ThreatIntelData = {
            source: ThreatIntelSource.RecordedFuture,
            content: JSON.stringify(entity),
            metadata: {
              dataType: ThreatDataType.IOC,
              severity: this.mapRecordedFutureSeverity(entity.risk),
              confidence: entity.risk?.score || 0,
              iocData,
              tags: entity.tags || [],
              references: entity.references || []
            }
          };

          this.emit('threatIntelReceived', threatData);
          result.itemsReceived++;
        }
      }
    } catch (error) {
      result.errors.push(`Recorded Future update error: ${error}`);
    }
  }

  /**
   * Update AlienVault OTX
   */
  private async updateAlienVaultOtx(feed: ThreatIntelFeed, result: FeedUpdateResult): Promise<void> {
    if (!feed.apiKey) {
      result.errors.push('AlienVault OTX API key not configured');
      return;
    }

    try {
      const headers = {
        'X-OTX-API-KEY': feed.apiKey,
        'Accept': 'application/json'
      };

      const data = await this.fetchJson(feed.url, headers);
      
      if (data.results && Array.isArray(data.results)) {
        for (const pulse of data.results) {
          // Process indicators in each pulse
          if (pulse.indicators && Array.isArray(pulse.indicators)) {
            const iocData = this.extractIOCsFromOTX(pulse.indicators);
            
            const threatData: ThreatIntelData = {
              source: ThreatIntelSource.AlienVaultOtx,
              content: JSON.stringify(pulse),
              metadata: {
                dataType: ThreatDataType.IOC,
                tags: pulse.tags || [],
                references: pulse.references || [],
                iocData
              }
            };

            this.emit('threatIntelReceived', threatData);
            result.itemsReceived++;
          }
        }
      }
    } catch (error) {
      result.errors.push(`AlienVault OTX update error: ${error}`);
    }
  }

  /**
   * Update URLhaus
   */
  private async updateUrlHaus(feed: ThreatIntelFeed, result: FeedUpdateResult): Promise<void> {
    try {
      const data = await this.fetchJson(feed.url);
      
      if (data.urls && Array.isArray(data.urls)) {
        const iocData: IOCData = {
          urls: [],
          domains: [],
          ips: [],
          hashes: [],
          cves: []
        };

        for (const entry of data.urls.slice(0, 1000)) { // Limit to recent 1000
          iocData.urls.push(entry.url);
          
          // Extract domain from URL
          try {
            const url = new URL(entry.url);
            iocData.domains.push(url.hostname);
          } catch {}

          // Add hashes if available
          if (entry.payloads && Array.isArray(entry.payloads)) {
            for (const payload of entry.payloads) {
              if (payload.sha256) iocData.hashes.push(payload.sha256);
            }
          }
        }

        const threatData: ThreatIntelData = {
          source: ThreatIntelSource.UrlHaus,
          content: JSON.stringify({ count: data.urls.length, sample: data.urls.slice(0, 10) }),
          metadata: {
            dataType: ThreatDataType.IOC,
            tags: ['malware-urls'],
            references: ['https://urlhaus.abuse.ch/'],
            iocData
          }
        };

        this.emit('threatIntelReceived', threatData);
        result.itemsReceived = iocData.urls.length;
      }
    } catch (error) {
      result.errors.push(`URLhaus update error: ${error}`);
    }
  }

  /**
   * Fetch JSON data from URL
   */
  private async fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      
      const options = {
        headers: {
          'User-Agent': 'Phoenix-Marie-ThreatIntel/1.0',
          ...headers
        }
      };

      client.get(url, options, (res) => {
        let data = '';
        
        res.on('data', chunk => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error(`Failed to parse JSON: ${error}`));
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * Extract IOCs from generic threat data
   */
  private extractIOCs(data: any): IOCData {
    const iocs: IOCData = {
      ips: [],
      domains: [],
      hashes: [],
      cves: [],
      urls: []
    };

    // Extract based on common patterns
    const str = JSON.stringify(data);
    
    // IPs
    const ipPattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
    const ips = str.match(ipPattern) || [];
    iocs.ips = [...new Set(ips)];

    // Domains
    const domainPattern = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]\b/gi;
    const domains = str.match(domainPattern) || [];
    iocs.domains = [...new Set(domains)];

    // Hashes
    const md5Pattern = /\b[a-f0-9]{32}\b/gi;
    const sha1Pattern = /\b[a-f0-9]{40}\b/gi;
    const sha256Pattern = /\b[a-f0-9]{64}\b/gi;
    
    const hashes = [
      ...(str.match(md5Pattern) || []),
      ...(str.match(sha1Pattern) || []),
      ...(str.match(sha256Pattern) || [])
    ];
    iocs.hashes = [...new Set(hashes)];

    // CVEs
    const cvePattern = /CVE-\d{4}-\d+/gi;
    const cves = str.match(cvePattern) || [];
    iocs.cves = [...new Set(cves)];

    // URLs
    const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
    const urls = str.match(urlPattern) || [];
    iocs.urls = [...new Set(urls)];

    return iocs;
  }

  /**
   * Extract IOCs from OTX indicators
   */
  private extractIOCsFromOTX(indicators: any[]): IOCData {
    const iocs: IOCData = {
      ips: [],
      domains: [],
      hashes: [],
      cves: [],
      urls: []
    };

    for (const indicator of indicators) {
      switch (indicator.type) {
        case 'IPv4':
        case 'IPv6':
          iocs.ips.push(indicator.indicator);
          break;
        case 'domain':
        case 'hostname':
          iocs.domains.push(indicator.indicator);
          break;
        case 'FileHash-MD5':
        case 'FileHash-SHA1':
        case 'FileHash-SHA256':
          iocs.hashes.push(indicator.indicator);
          break;
        case 'CVE':
          iocs.cves.push(indicator.indicator);
          break;
        case 'URL':
          iocs.urls.push(indicator.indicator);
          break;
      }
    }

    return iocs;
  }

  /**
   * Map severity levels
   */
  private mapCisaSeverity(vuln: any): 'critical' | 'high' | 'medium' | 'low' {
    // CISA KEV are all actively exploited, so default to high
    return 'high';
  }

  private mapNvdSeverity(cve: any): 'critical' | 'high' | 'medium' | 'low' | undefined {
    const score = cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore;
    if (!score) return undefined;
    
    if (score >= 9.0) return 'critical';
    if (score >= 7.0) return 'high';
    if (score >= 4.0) return 'medium';
    return 'low';
  }

  private mapRecordedFutureSeverity(risk: any): 'critical' | 'high' | 'medium' | 'low' {
    const score = risk?.score || 0;
    if (score >= 90) return 'critical';
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Extract tags from NVD data
   */
  private extractNvdTags(cve: any): string[] {
    const tags: string[] = [];
    
    // Add CWE tags
    if (cve.weaknesses) {
      for (const weakness of cve.weaknesses) {
        for (const desc of weakness.description || []) {
          if (desc.value?.startsWith('CWE-')) {
            tags.push(desc.value);
          }
        }
      }
    }

    // Add affected vendors/products
    if (cve.configurations) {
      for (const config of cve.configurations) {
        for (const node of config.nodes || []) {
          for (const cpe of node.cpeMatch || []) {
            const parts = cpe.criteria?.split(':');
            if (parts && parts.length > 4) {
              tags.push(parts[3]); // Vendor
              tags.push(parts[4]); // Product
            }
          }
        }
      }
    }

    return [...new Set(tags)];
  }

  /**
   * Get source from webhook path
   */
  private getSourceFromWebhookPath(path: string): ThreatIntelSource | null {
    // Map webhook paths to sources
    const pathMap: Record<string, ThreatIntelSource> = {
      '/webhook/rapid7': ThreatIntelSource.Rapid7,
      '/webhook/crowdstrike': ThreatIntelSource.CrowdStrike,
      '/webhook/recordedfuture': ThreatIntelSource.RecordedFuture,
      '/webhook/alienvault': ThreatIntelSource.AlienVaultOtx
    };

    return pathMap[path] || null;
  }

  /**
   * Process webhook data
   */
  private processWebhookData(source: ThreatIntelSource, data: any): void {
    // Process based on source format
    // This would be customized per source
    const threatData: ThreatIntelData = {
      source,
      content: JSON.stringify(data),
      metadata: {
        dataType: ThreatDataType.IOC,
        iocData: this.extractIOCs(data)
      }
    };

    this.emit('threatIntelReceived', threatData);
  }

  /**
   * Verify API keys are configured
   */
  private async verifyApiKeys(): Promise<void> {
    const requiredKeys: ThreatIntelSource[] = [
      ThreatIntelSource.Rapid7,
      ThreatIntelSource.CrowdStrike,
      ThreatIntelSource.RecordedFuture,
      ThreatIntelSource.AlienVaultOtx
    ];

    const missingKeys = requiredKeys.filter(source => !this.config.apiKeys?.[source]);
    
    if (missingKeys.length > 0) {
      console.warn('Missing API keys for:', missingKeys);
    }
  }
}