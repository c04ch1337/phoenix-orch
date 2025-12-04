/**
 * Vulnerability Scanner Agent
 * 
 * This specialized L1 agent handles vulnerability scanner findings, primarily from
 * Rapid7 VM. It assesses exploitability and exposure, determines vulnerability severity
 * and business impact, identifies affected assets and owners, creates prioritized
 * remediation recommendations, and escalates critical vulnerabilities to L2.
 */

const { BaseL1Agent } = require('../../agentic_soc_framework');
const utils = require('../../../utils');

/**
 * Vulnerability risk scoring impacts
 * @type {Object}
 * @private
 */
const VULN_IMPACT = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'informational'
};

/**
 * Vulnerability types
 * @type {Object}
 * @private
 */
const VULN_TYPES = {
  MISSING_PATCH: 'missing_patch',
  MISCONFIGURATION: 'misconfiguration',
  DEFAULT_CREDENTIALS: 'default_credentials',
  OUTDATED_SOFTWARE: 'outdated_software',
  UNNECESSARY_SERVICE: 'unnecessary_service',
  WEAK_CRYPTOGRAPHY: 'weak_cryptography',
  INFORMATION_DISCLOSURE: 'information_disclosure',
  ACCESS_CONTROL: 'access_control_issue',
  UNPATCHED_VULNERABILITY: 'unpatched_vulnerability'
};

/**
 * Vulnerability Scanner Agent - Specializes in processing vulnerability scan findings
 * @class VulnScannerAgent
 * @extends BaseL1Agent
 */
class VulnScannerAgent extends BaseL1Agent {
  /**
   * Create a new VulnScannerAgent
   * @param {Object} config - Agent configuration
   * @param {Object} messageBus - System message bus
   */
  constructor(config = {}, messageBus = null) {
    // Add vulnerability scanner capabilities to config
    const vulnConfig = {
      ...config,
      type: 'vuln_scanner_agent',
      name: config.name || 'Vulnerability Scanner Agent',
      capabilities: [
        ...(config.capabilities || []),
        'vulnerability_assessment',
        'exploitability_analysis',
        'exposure_analysis',
        'asset_identification',
        'business_impact_assessment',
        'remediation_recommendation'
      ]
    };

    super(vulnConfig, messageBus);

    // Scanner sources configuration
    this._scannerSources = {
      rapid7Enabled: config.rapid7Enabled !== false,
      qualysEnabled: config.qualysEnabled === true,
      nessusEnabled: config.nessusEnabled === true,
      openvasEnabled: config.openvasEnabled === true
    };

    // Escalation thresholds specific to vulnerability management
    this._vulnEscalationThresholds = {
      minCvssForEscalation: config.minCvssForEscalation || 7.0,
      minRiskScoreForEscalation: config.minRiskScoreForEscalation || 75,
      escalateExploitableVulns: config.escalateExploitableVulns !== false,
      escalateOnCriticalAssets: config.escalateOnCriticalAssets !== false,
      daysToRemediate: {
        critical: config.criticalVulnDaysToRemediate || 7,
        high: config.highVulnDaysToRemediate || 30,
        medium: config.mediumVulnDaysToRemediate || 90,
        low: config.lowVulnDaysToRemediate || 180
      }
    };

    // CVSS scoring configuration
    this._cvssConfig = {
      version: config.cvssVersion || '3.1',
      useTemporalMetrics: config.useTemporalMetrics !== false,
      useEnvironmentalMetrics: config.useEnvironmentalMetrics !== false
    };

    // Asset database integration
    this._assetDbConfig = {
      enabled: config.assetDbEnabled !== false,
      refresh_interval: config.assetDbRefreshInterval || 86400 // 1 day in seconds
    };

    // Cache for asset information
    this._assetCache = {
      assets: {},
      owners: {},
      lastUpdated: 0
    };

    // Initialize additional event subscriptions
    this._initializeVulnScannerEventSubscriptions();
  }

  /**
   * Initialize vulnerability scanner event subscriptions
   * @private
   */
  _initializeVulnScannerEventSubscriptions() {
    if (this._messageBus) {
      // Subscribe to relevant vulnerability scanner message types
      const additionalSubscriptions = [
        this.subscribeToMessages('rapid7:finding', this._handleRapid7Finding.bind(this)),
        this.subscribeToMessages('qualys:finding', this._handleQualysFinding.bind(this)),
        this.subscribeToMessages('nessus:finding', this._handleNessusFinding.bind(this)),
        this.subscribeToMessages('openvas:finding', this._handleOpenVASFinding.bind(this)),
        this.subscribeToMessages('asset:update', this._handleAssetUpdate.bind(this)),
        this.subscribeToMessages('vuln:exploitable', this._handleExploitableVulnAlert.bind(this))
      ];

      // Add to subscriptions array
      if (!this._subscriptions) {
        this._subscriptions = [];
      }
      this._subscriptions.push(...additionalSubscriptions);
    }
  }

  /**
   * Lifecycle hook called during initialization
   * @param {Object} options - Initialization options
   * @returns {Promise<void>}
   * @protected
   */
  async _onInitialize(options) {
    // Call parent initialization
    await super._onInitialize(options);
    
    // Vulnerability scanner specific initialization
    this.log.info('Initializing Vulnerability Scanner Agent components');
    
    try {
      // Load asset information if needed
      if (this._assetDbConfig.enabled && Object.keys(this._assetCache.assets).length === 0) {
        await this._refreshAssetCache();
      }
      
      this.log.info('Vulnerability Scanner Agent initialization complete');
    } catch (error) {
      this.log.error('Error during Vulnerability Scanner agent initialization', error);
      throw error;
    }
  }

  /**
   * Refresh the asset cache
   * @returns {Promise<void>}
   * @private
   */
  async _refreshAssetCache() {
    try {
      this.log.info('Refreshing asset cache');
      
      // In a real implementation, this would query an asset database
      // Placeholder implementation
      this._assetCache = {
        assets: {
          // Example asset entries
          'server-db-01': {
            type: 'server',
            purpose: 'database',
            criticality: 'high',
            environment: 'production',
            location: 'primary-datacenter',
            operatingSystem: 'windows',
            osVersion: 'Windows Server 2019',
            patchLevel: '1809',
            owner: 'database-team',
            businessUnit: 'it-infrastructure'
          },
          'app-web-01': {
            type: 'server',
            purpose: 'web',
            criticality: 'high',
            environment: 'production',
            location: 'primary-datacenter',
            operatingSystem: 'linux',
            osVersion: 'Ubuntu 20.04 LTS',
            owner: 'web-team',
            businessUnit: 'it-infrastructure'
          }
        },
        owners: {
          'database-team': {
            name: 'Database Team',
            primary: 'jane.smith@example.com',
            secondary: 'john.doe@example.com',
            ticketingSystem: 'jira',
            ticketingProject: 'DBOPS'
          },
          'web-team': {
            name: 'Web Applications Team',
            primary: 'alex.garcia@example.com',
            secondary: 'sarah.chen@example.com',
            ticketingSystem: 'jira',
            ticketingProject: 'WEBOPS'
          }
        },
        lastUpdated: Date.now()
      };
      
      this.log.info(`Asset cache refreshed with ${Object.keys(this._assetCache.assets).length} assets`);
      
    } catch (error) {
      this.log.error('Error refreshing asset cache', error);
      throw error;
    }
  }

  /**
   * Handle a Rapid7 vulnerability finding
   * @param {Object} message - Finding message
   * @private
   */
  _handleRapid7Finding(message) {
    try {
      if (!this._scannerSources.rapid7Enabled) {
        this.log.debug('Rapid7 findings are disabled, ignoring');
        return;
      }

      const finding = message.data;
      
      this.log.debug(`Received Rapid7 finding: ${finding.id} - ${finding.title}`);
      
      // Convert Rapid7 finding to internal format
      const normalizedFinding = this._convertRapid7Finding(finding);
      
      // Add as a task to be processed
      this.addTask({
        data: {
          type: 'vulnerability_finding',
          source: 'rapid7',
          finding: normalizedFinding,
          rawFinding: finding
        },
        priority: this._determineVulnerabilityPriority(normalizedFinding)
      });
    } catch (error) {
      this.log.error('Error handling Rapid7 finding', error);
    }
  }

  /**
   * Handle a Qualys vulnerability finding
   * @param {Object} message - Finding message
   * @private
   */
  _handleQualysFinding(message) {
    try {
      if (!this._scannerSources.qualysEnabled) {
        this.log.debug('Qualys findings are disabled, ignoring');
        return;
      }

      const finding = message.data;
      
      this.log.debug(`Received Qualys finding: ${finding.id} - ${finding.title}`);
      
      // Convert Qualys finding to internal format
      const normalizedFinding = this._convertQualysFinding(finding);
      
      // Add as a task to be processed
      this.addTask({
        data: {
          type: 'vulnerability_finding',
          source: 'qualys',
          finding: normalizedFinding,
          rawFinding: finding
        },
        priority: this._determineVulnerabilityPriority(normalizedFinding)
      });
    } catch (error) {
      this.log.error('Error handling Qualys finding', error);
    }
  }

  /**
   * Handle a Nessus vulnerability finding
   * @param {Object} message - Finding message
   * @private
   */
  _handleNessusFinding(message) {
    try {
      if (!this._scannerSources.nessusEnabled) {
        this.log.debug('Nessus findings are disabled, ignoring');
        return;
      }

      const finding = message.data;
      
      this.log.debug(`Received Nessus finding: ${finding.id} - ${finding.name}`);
      
      // Convert Nessus finding to internal format
      const normalizedFinding = this._convertNessusFinding(finding);
      
      // Add as a task to be processed
      this.addTask({
        data: {
          type: 'vulnerability_finding',
          source: 'nessus',
          finding: normalizedFinding,
          rawFinding: finding
        },
        priority: this._determineVulnerabilityPriority(normalizedFinding)
      });
    } catch (error) {
      this.log.error('Error handling Nessus finding', error);
    }
  }

  /**
   * Handle an OpenVAS vulnerability finding
   * @param {Object} message - Finding message
   * @private
   */
  _handleOpenVASFinding(message) {
    try {
      if (!this._scannerSources.openvasEnabled) {
        this.log.debug('OpenVAS findings are disabled, ignoring');
        return;
      }

      const finding = message.data;
      
      this.log.debug(`Received OpenVAS finding: ${finding.id} - ${finding.name}`);
      
      // Convert OpenVAS finding to internal format
      const normalizedFinding = this._convertOpenVASFinding(finding);
      
      // Add as a task to be processed
      this.addTask({
        data: {
          type: 'vulnerability_finding',
          source: 'openvas',
          finding: normalizedFinding,
          rawFinding: finding
        },
        priority: this._determineVulnerabilityPriority(normalizedFinding)
      });
    } catch (error) {
      this.log.error('Error handling OpenVAS finding', error);
    }
  }

  /**
   * Handle an asset update message
   * @param {Object} message - Asset update message
   * @private
   */
  _handleAssetUpdate(message) {
    try {
      const asset = message.data;
      
      this.log.debug(`Received asset update for: ${asset.id || asset.hostname}`);
      
      // Update asset cache
      if (asset.id || asset.hostname) {
        const assetId = asset.id || asset.hostname;
        this._assetCache.assets[assetId] = {
          ...this._assetCache.assets[assetId],
          ...asset
        };
        
        this.log.info(`Updated asset in cache: ${assetId}`);
      }
    } catch (error) {
      this.log.error('Error handling asset update', error);
    }
  }

  /**
   * Handle an exploitable vulnerability alert
   * @param {Object} message - Exploitable vulnerability message
   * @private
   */
  _handleExploitableVulnAlert(message) {
    try {
      const alert = message.data;
      
      this.log.info(`Received exploitable vulnerability alert: ${alert.cve || alert.id}`);
      
      // Add as a high priority task
      this.addTask({
        data: {
          type: 'exploitable_vulnerability',
          alert
        },
        priority: 90 // High priority for exploitable vulnerabilities
      });
    } catch (error) {
      this.log.error('Error handling exploitable vulnerability alert', error);
    }
  }

  /**
   * Convert Rapid7 finding to normalized vulnerability format
   * @param {Object} finding - Rapid7 finding
   * @returns {Object} Normalized finding
   * @private
   */
  _convertRapid7Finding(finding) {
    // This would contain the actual mapping logic for Rapid7's format
    // Placeholder implementation
    return {
      id: finding.id || utils.encryption.generateId(),
      source: 'rapid7',
      title: finding.title || finding.name || finding.summary || 'Unknown vulnerability',
      description: finding.description || '',
      solution: finding.solution || finding.remediation || '',
      cve: finding.cve || finding.vulnerability_identifiers?.cve || null,
      cvss: {
        score: parseFloat(finding.cvss_score || finding.risk_score || '0') || 0,
        vector: finding.cvss_vector || null,
        version: finding.cvss_version || this._cvssConfig.version
      },
      severity: this._mapSeverityString(finding.severity) || this._calculateSeverityFromCvss(finding.cvss_score || finding.risk_score),
      riskScore: finding.risk_score ? parseFloat(finding.risk_score) : null,
      hostId: finding.asset_id || finding.host_id || finding.asset || '',
      hostname: finding.hostname || finding.host_name || '',
      ipAddress: finding.ip_address || finding.ip || '',
      port: finding.port || null,
      protocol: finding.protocol || null,
      service: finding.service_name || finding.service || '',
      detectedAt: finding.detected_at || finding.discovered_at || finding.found_at || Date.now(),
      status: finding.status || 'open',
      vulnType: this._determineVulnType(finding),
      exploitable: finding.exploitable === true || finding.exploit_available === true || false,
      exploitAvailable: finding.exploit_available === true || false,
      exploitFrameworks: finding.exploit_frameworks || [],
      patchAvailable: finding.patch_available === true || false,
      rawData: finding
    };
  }

  /**
   * Convert Qualys finding to normalized vulnerability format
   * @param {Object} finding - Qualys finding
   * @returns {Object} Normalized finding
   * @private
   */
  _convertQualysFinding(finding) {
    // This would contain the actual mapping logic for Qualys's format
    // Placeholder implementation with similar structure to Rapid7 conversion
    return {
      id: finding.id || utils.encryption.generateId(),
      source: 'qualys',
      title: finding.title || finding.name || finding.qid_title || 'Unknown vulnerability',
      description: finding.description || finding.details || '',
      solution: finding.solution || finding.remediation || '',
      cve: finding.cve || null,
      cvss: {
        score: parseFloat(finding.cvss_score || finding.cvss_base || finding.cvss || '0') || 0,
        vector: finding.cvss_vector || null,
        version: finding.cvss_version || this._cvssConfig.version
      },
      severity: this._mapSeverityString(finding.severity) || this._calculateSeverityFromCvss(finding.cvss_score || finding.cvss_base),
      riskScore: finding.risk_score ? parseFloat(finding.risk_score) : null,
      hostId: finding.asset_id || finding.host_id || '',
      hostname: finding.hostname || finding.dns || '',
      ipAddress: finding.ip || finding.ip_address || '',
      port: finding.port || null,
      protocol: finding.protocol || null,
      service: finding.service || '',
      detectedAt: finding.detected_at || finding.last_detected || Date.now(),
      status: finding.status || 'open',
      vulnType: this._determineVulnType(finding),
      exploitable: finding.exploitable === true || false,
      exploitAvailable: finding.exploit_available === true || false,
      exploitFrameworks: finding.exploit_frameworks || [],
      patchAvailable: finding.patch_available === true || (finding.solution?.toLowerCase().includes('patch') || false),
      rawData: finding
    };
  }

  /**
   * Convert Nessus finding to normalized vulnerability format
   * @param {Object} finding - Nessus finding
   * @returns {Object} Normalized finding
   * @private
   */
  _convertNessusFinding(finding) {
    // Simplified placeholder implementation
    return this._convertToGenericFinding(finding, 'nessus');
  }

  /**
   * Convert OpenVAS finding to normalized vulnerability format
   * @param {Object} finding - OpenVAS finding
   * @returns {Object} Normalized finding
   * @private
   */
  _convertOpenVASFinding(finding) {
    // Simplified placeholder implementation
    return this._convertToGenericFinding(finding, 'openvas');
  }

  /**
   * Generic conversion function for other scanner formats
   * @param {Object} finding - Scanner finding
   * @param {string} source - Scanner source name
   * @returns {Object} Normalized finding
   * @private
   */
  _convertToGenericFinding(finding, source) {
    return {
      id: finding.id || utils.encryption.generateId(),
      source: source,
      title: finding.title || finding.name || 'Unknown vulnerability',
      description: finding.description || finding.details || '',
      solution: finding.solution || finding.remediation || '',
      cve: finding.cve || null,
      cvss: {
        score: parseFloat(finding.cvss_score || finding.cvss || '0') || 0,
        vector: finding.cvss_vector || null,
        version: finding.cvss_version || this._cvssConfig.version
      },
      severity: this._mapSeverityString(finding.severity) || this._calculateSeverityFromCvss(finding.cvss_score),
      riskScore: finding.risk_score ? parseFloat(finding.risk_score) : null,
      hostId: finding.asset_id || finding.host_id || '',
      hostname: finding.hostname || '',
      ipAddress: finding.ip_address || finding.ip || '',
      detectedAt: finding.detected_at || finding.timestamp || Date.now(),
      status: finding.status || 'open',
      vulnType: this._determineVulnType(finding),
      exploitable: finding.exploitable === true || false,
      patchAvailable: finding.patch_available === true || false,
      rawData: finding
    };
  }

  /**
   * Map string severity to normalized severity impact
   * @param {string} severity - String severity (e.g., "High", "Medium")
   * @returns {string} Normalized severity impact
   * @private
   */
  _mapSeverityString(severity) {
    if (!severity) return null;
    
    // Normalize the severity string
    const severityLower = String(severity).toLowerCase();
    
    if (severityLower === 'critical') return VULN_IMPACT.CRITICAL;
    if (severityLower === 'high') return VULN_IMPACT.HIGH;
    if (severityLower === 'medium' || severityLower === 'moderate') return VULN_IMPACT.MEDIUM;
    if (severityLower === 'low') return VULN_IMPACT.LOW;
    if (severityLower === 'info' || severityLower === 'informational') return VULN_IMPACT.INFO;
    
    return null;
  }

  /**
   * Calculate severity impact from CVSS score
   * @param {number|string} cvssScore - CVSS score
   * @returns {string} Severity impact
   * @private
   */
  _calculateSeverityFromCvss(cvssScore) {
    if (cvssScore === undefined || cvssScore === null) return VULN_IMPACT.MEDIUM;
    
    const score = parseFloat(cvssScore);
    
    // CVSS v3 severity mapping
    if (score >= 9.0) return VULN_IMPACT.CRITICAL;
    if (score >= 7.0) return VULN_IMPACT.HIGH;
    if (score >= 4.0) return VULN_IMPACT.MEDIUM;
    if (score >= 0.1) return VULN_IMPACT.LOW;
    
    return VULN_IMPACT.INFO;
  }

  /**
   * Determine vulnerability type based on finding
   * @param {Object} finding - Vulnerability finding
   * @returns {string} Vulnerability type
   * @private
   */
  _determineVulnType(finding) {
    // Simple determining logic based on title and description
    // In a real implementation, this would be more sophisticated
    
    const text = `${finding.title || ''} ${finding.name || ''} ${finding.description || ''}`.toLowerCase();
    
    if (text.includes('patch') || text.includes('update') || text.includes('upgrade')) {
      return VULN_TYPES.MISSING_PATCH;
    }
    
    if (text.includes('config') || text.includes('configuration') || text.includes('setting')) {
      return VULN_TYPES.MISCONFIGURATION;
    }
    
    if (text.includes('default credential') || text.includes('default password')) {
      return VULN_TYPES.DEFAULT_CREDENTIALS;
    }
    
    if (text.includes('outdated') || text.includes('end of life') || text.includes('eol')) {
      return VULN_TYPES.OUTDATED_SOFTWARE;
    }
    
    if (text.includes('unnecessary') || text.includes('unused') || text.includes('should be disabled')) {
      return VULN_TYPES.UNNECESSARY_SERVICE;
    }
    
    if (text.includes('ssl') || text.includes('tls') || text.includes('encrypt')) {
      return VULN_TYPES.WEAK_CRYPTOGRAPHY;
    }
    
    if (text.includes('information disclosure') || text.includes('information leak')) {
      return VULN_TYPES.INFORMATION_DISCLOSURE;
    }
    
    if (text.includes('access control') || text.includes('permission') || text.includes('privilege')) {
      return VULN_TYPES.ACCESS_CONTROL;
    }
    
    return VULN_TYPES.UNPATCHED_VULNERABILITY;
  }

  /**
   * Determine vulnerability priority for task processing
   * @param {Object} finding - Vulnerability finding
   * @returns {number} Priority (0-100)
   * @private
   */
  _determineVulnerabilityPriority(finding) {
    // Start with base priority from CVSS
    let priority = 0;
    
    if (finding.cvss && finding.cvss.score) {
      priority = finding.cvss.score * 10; // Convert 0-10 CVSS to 0-100
    } else if (finding.severity) {
      // Map severity to priority
      switch (finding.severity) {
        case VULN_IMPACT.CRITICAL:
          priority = 90;
          break;
        case VULN_IMPACT.HIGH:
          priority = 75;
          break;
        case VULN_IMPACT.MEDIUM:
          priority = 50;
          break;
        case VULN_IMPACT.LOW:
          priority = 25;
          break;
        case VULN_IMPACT.INFO:
          priority = 10;
          break;
      }
    }
    
    // Increase priority for exploitable vulnerabilities
    if (finding.exploitable || finding.exploitAvailable) {
      priority += 15;
    }
    
    // Increase priority for vulnerabilities on critical assets
    const assetInfo = this._getAssetInfo(finding.hostId, finding.hostname);
    if (assetInfo && assetInfo.criticality === 'high') {
      priority += 10;
    }
    
    // Ensure priority is within bounds
    return Math.min(Math.max(priority, 0), 100);
  }

  /**
   * Get asset info from the asset cache
   * @param {string} hostId - Host ID
   * @param {string} hostname - Hostname (fallback)
   * @returns {Object|null} Asset info or null if not found
   * @private
   */
  _getAssetInfo(hostId, hostname) {
    // Try to find by host ID first
    if (hostId && this._assetCache.assets[hostId]) {
      return this._assetCache.assets[hostId];
    }
    
    // Try to find by hostname
    if (hostname && this._assetCache.assets[hostname]) {
      return this._assetCache.assets[hostname];
    }
    
    // Check if any asset has a matching hostname property
    if (hostname) {
      for (const assetId in this._assetCache.assets) {
        const asset = this._assetCache.assets[assetId];
        if (asset.hostname === hostname) {
          return asset;
        }
      }
    }
    
    return null;
  }

  /**
   * Process incoming data
   * @param {Object} data - Data to process
   * @returns {Promise<Object>} Processing result
   */
  async process(data) {
    if (data.type === 'vulnerability_finding') {
      return await this._processVulnerabilityFinding(data);
    } else if (data.type === 'exploitable_vulnerability') {
      return await this._processExploitableVulnerability(data);
    }
    
    // For other data types, use the parent class implementation
    return await super.process(data);
  }

  /**
   * Process a vulnerability finding
   * @param {Object} data - Finding data
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processVulnerabilityFinding(data) {
    const startTime = Date.now();
    const finding = data.finding;
    
    this.log.info(`Processing vulnerability finding: ${finding.id} - ${finding.title} on ${finding.hostname}`);
    
    try {
      // Assess the vulnerability
      const assessment = await this.assessVulnerability(finding);
      
      // Update metrics
      this._triageMetrics.alertsProcessed++;
      this._triageMetrics.totalTriageTime += (Date.now() - startTime);
      this._triageMetrics.avgTriageTime = 
        this._triageMetrics.totalTriageTime / this._triageMetrics.alertsProcessed;
      
      // Report metrics
      utils.metrics.gauge(`agent.${this.id}.assessment_time_ms`, Date.now() - startTime);
      utils.metrics.increment(`agent.${this.id}.findings_processed`, 1, { 
        source: finding.source || 'unknown',
        severity: finding.severity || 'unknown'
      });
      
      // Check if the vulnerability needs to be escalated
      if (this._shouldEscalateVulnerability(assessment, finding)) {
        await this._escalateVulnerability(assessment, finding);
        
        return {
          status: 'escalated',
          assessment
        };
      }
      
      // Generate report if not escalated
      const report = await this.generateVulnerabilityReport(assessment, finding);
      
      return {
        status: 'assessed',
        assessment,
        report
      };
    } catch (error) {
      this.log.error(`Error processing vulnerability finding: ${finding.id}`, error);
      throw error;
    }
  }

  /**
   * Process an exploitable vulnerability alert
   * @param {Object} data - Alert data
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processExploitableVulnerability(data) {
    const alert = data.alert;
    
    this.log.info(`Processing exploitable vulnerability alert: ${alert.cve || alert.id}`);
    
    try {
      // Create a special assessment for exploitable vulnerabilities
      const assessment = {
        id: utils.encryption.generateId(),
        cve: alert.cve,
        title: alert.title || `Exploitable vulnerability: ${alert.cve || alert.id}`,
        description: alert.description || '',
        severity: VULN_IMPACT.CRITICAL, // Default to critical for exploitable vulns
        cvss: alert.cvss || { score: 9.0, vector: alert.cvssVector },
        exploitable: true,
        exploitDetails: alert.exploitDetails || {},
        affectedSystems: alert.affectedSystems || [],
        businessImpact: 'high', // Default to high
        timestamp: Date.now()
      };
      
      // Always escalate exploitable vulnerabilities
      await this._escalateVulnerability(assessment, alert);
      
      return {
        status: 'escalated',
        assessment
      };
    } catch (error) {
      this.log.error(`Error processing exploitable vulnerability alert: ${alert.cve || alert.id}`, error);
      throw error;
    }
  }

  /**
   * Assess a vulnerability finding
   * @param {Object} finding - Vulnerability finding
   * @returns {Promise<Object>} Vulnerability assessment
   */
  async assessVulnerability(finding) {
    try {
      this.log.info(`Assessing vulnerability: ${finding.id} - ${finding.title}`);
      
      const assessment = {
        id: utils.encryption.generateId(),
        findingId: finding.id,
        title: finding.title,
        description: finding.description,
        cve: finding.cve,
        timestamp: Date.now(),
        source: finding.source
      };
      
      // Assess exploitability
      assessment.exploitability = await this._assessExploitability(finding);
      
      // Assess exposure
      assessment.exposure = await this._assessExposure(finding);
      
      // Assess business impact
      assessment.businessImpact = await this._assessBusinessImpact(finding);
      
      // Identify affected asset(s)
      assessment.affectedAssets = await this._identifyAffectedAssets(finding);
      
      // Generate remediation recommendations
      assessment.remediationRecommendations = await this._generateRemediationRecommendations(finding);
      
      // Set severity (may be adjusted based on other factors)
      assessment.severity = finding.severity || VULN_IMPACT.MEDIUM;
      
      // Determine assessed CVSS score (may include temporal/environmental factors)
      assessment.cvss = await this._calculateAdjustedCvss(finding);
      
      // Calculate days to remediate based on severity
      assessment.daysToRemediate = this._calculateDaysToRemediate(assessment.severity);
      
      // Does this vulnerability require L2 escalation?
      assessment.requiresEscalation = this._shouldEscalateVulnerability(assessment, finding);
      
      return assessment;
    } catch (error) {
      this.log.error(`Error assessing vulnerability: ${finding.id}`, error);
      throw error;
    }
  }

  /**
   * Assess exploitability of a vulnerability
   * @param {Object} finding - Vulnerability finding
   * @returns {Promise<Object>} Exploitability assessment
   * @private
   */
  async _assessExploitability(finding) {
    // This would contain detailed exploitability assessment logic
    // Placeholder implementation
    const exploitability = {
      score: 0, // 0-100 where higher means more exploitable
      exploitAvailable: finding.exploitAvailable || false,
      exploitInTheWild: false,
      exploitMaturity: 'unproven', // unproven, poc, functional, high, na
      remotelyExploitable: false,
      authenticationRequired: true,
      exploitFrameworks: finding.exploitFrameworks || []
    };
    
    // Check exploit availability
    if (finding.exploitAvailable) {
      exploitability.score += 50;
      exploitability.exploitMaturity = 'functional'; // Default for available exploits
    }
    
    // Check CVSS metrics for remote exploitability
    if (finding.cvss && finding.cvss.vector) {
      // Simple CVSS vector parsing - real implementation would be more robust
      if (finding.cvss.vector.includes('AV:N')) {
        exploitability.remotelyExploitable = true;
        exploitability.score += 30;
      }
      
      if (finding.cvss.vector.includes('Au:N') || finding.cvss.vector.includes('PR:N')) {
        exploitability.authenticationRequired = false;
        exploitability.score += 20;
      }
    }
    
    // Check for specific exploit frameworks
    if (exploitability.exploitFrameworks.includes('metasploit')) {
      exploitability.score += 30;
      exploitability.exploitMaturity = 'high';
    }
    
    // Ensure score is within bounds
    exploitability.score = Math.min(Math.max(exploitability.score, 0), 100);
    
    return exploitability;
  }

  /**
   * Assess exposure of a vulnerability
   * @param {Object} finding - Vulnerability finding
   * @returns {Promise<Object>} Exposure assessment
   * @private
   */
  async _assessExposure(finding) {
    // This would contain detailed exposure assessment logic
    // Placeholder implementation
    const exposure = {
      score: 0, // 0-100 where higher means more exposed
      internetExposed: false,
      accessVector: 'network', // network, adjacent, local, physical
      assetVisibility: 'internal', // internet, dmz, internal, segmented
      mitigatingControls: []
    };
    
    // Get asset info
    const assetInfo = this._getAssetInfo(finding.hostId, finding.hostname);
    
    // Check if asset is internet-facing
    if (assetInfo && assetInfo.internetFacing) {
      exposure.internetExposed = true;
      exposure.assetVisibility = 'internet';
      exposure.score += 50;
    } else if (assetInfo && assetInfo.dmz) {
      exposure.assetVisibility = 'dmz';
      exposure.score += 30;
    }
    
    // Check if service is on a standard port that's often exposed
    if (finding.port) {
      const exposedPorts = [22, 23, 25, 80, 443, 3389, 5900, 8080, 8443];
      if (exposedPorts.includes(parseInt(finding.port))) {
        exposure.score += 20;
      }
    }
    
    // Set access vector based on CVSS if available
    if (finding.cvss && finding.cvss.vector) {
      if (finding.cvss.vector.includes('AV:N')) {
        exposure.accessVector = 'network';
        exposure.score += 20;
      } else if (finding.cvss.vector.includes('AV:A')) {
        exposure.accessVector = 'adjacent';
        exposure.score += 10;
      } else if (finding.cvss.vector.includes('AV:L')) {
        exposure.accessVector = 'local';
      } else if (finding.cvss.vector.includes('AV:P')) {
        exposure.accessVector = 'physical';
      }
    }
    
    // Ensure score is within bounds
    exposure.score = Math.min(Math.max(exposure.score, 0), 100);
    
    return exposure;
  }

  /**
   * Assess business impact of a vulnerability
   * @param {Object} finding - Vulnerability finding
   * @returns {Promise<string>} Business impact (critical, high, medium, low)
   * @private
   */
  async _assessBusinessImpact(finding) {
    // Get asset info
    const assetInfo = this._getAssetInfo(finding.hostId, finding.hostname);
    
    // If we have asset criticality, use that
    if (assetInfo && assetInfo.criticality) {
      return assetInfo.criticality;
    }
    
    // For production systems, default to high impact
    if (assetInfo && assetInfo.environment === 'production') {
      return 'high';
    }
    
    // Map severity to business impact
    if (finding.severity === VULN_IMPACT.CRITICAL) return 'critical';
    if (finding.severity === VULN_IMPACT.HIGH) return 'high';
    if (finding.severity === VULN_IMPACT.MEDIUM) return 'medium';
    
    return 'low';
  }

  /**
   * Identify affected assets
   * @param {Object} finding - Vulnerability finding
   * @returns {Promise<Array>} Affected assets
   * @private
   */
  async _identifyAffectedAssets(finding) {
    const assets = [];
    
    // Get asset info
    const assetInfo = this._getAssetInfo(finding.hostId, finding.hostname);
    
    if (assetInfo) {
      // Format asset details
      assets.push({
        id: finding.hostId || finding.hostname,
        hostname: finding.hostname || assetInfo.hostname,
        ipAddress: finding.ipAddress || assetInfo.ipAddress,
        criticality: assetInfo.criticality || 'medium',
        businessUnit: assetInfo.businessUnit || 'unknown',
        environment: assetInfo.environment || 'unknown',
        owner: assetInfo.owner || 'unknown',
        ownerDetails: this._getOwnerDetails(assetInfo.owner)
      });
    } else {
      // Fall back to basic asset info from finding
      assets.push({
        id: finding.hostId || finding.hostname || 'unknown',
        hostname: finding.hostname || 'unknown',
        ipAddress: finding.ipAddress || 'unknown',
        criticality: 'medium', // Default
        businessUnit: 'unknown',
        environment: 'unknown',
        owner: 'unknown',
        ownerDetails: null
      });
    }
    
    return assets;
  }

  /**
   * Get owner details from cache
   * @param {string} ownerId - Owner ID
   * @returns {Object|null} Owner details or null if not found
   * @private
   */
  _getOwnerDetails(ownerId) {
    if (!ownerId || !this._assetCache.owners[ownerId]) {
      return null;
    }
    
    return this._assetCache.owners[ownerId];
  }

  /**
   * Generate remediation recommendations
   * @param {Object} finding - Vulnerability finding
   * @returns {Promise<Array>} Remediation recommendations
   * @private
   */
  async _generateRemediationRecommendations(finding) {
    const recommendations = [];
    
    // Add vendor solution if available
    if (finding.solution) {
      recommendations.push({
        id: utils.encryption.generateId(),
        type: 'vendor_solution',
        description: finding.solution,
        effort: 'medium', // Default
        priority: 'high'
      });
    }
    
    // Add recommendation based on vulnerability type
    switch (finding.vulnType) {
      case VULN_TYPES.MISSING_PATCH:
        recommendations.push({
          id: utils.encryption.generateId(),
          type: 'apply_patch',
          description: 'Apply vendor security patch to resolve vulnerability.',
          effort: 'low',
          priority: 'high'
        });
        break;
        
      case VULN_TYPES.MISCONFIGURATION:
        recommendations.push({
          id: utils.encryption.generateId(),
          type: 'reconfigure',
          description: 'Update configuration settings to secure implementation.',
          effort: 'medium',
          priority: 'high'
        });
        break;
        
      case VULN_TYPES.DEFAULT_CREDENTIALS:
        recommendations.push({
          id: utils.encryption.generateId(),
          type: 'change_credentials',
          description: 'Change default credentials to strong, unique credentials.',
          effort: 'low',
          priority: 'high'
        });
        break;
        
      case VULN_TYPES.OUTDATED_SOFTWARE:
        recommendations.push({
          id: utils.encryption.generateId(),
          type: 'upgrade_software',
          description: 'Upgrade to a supported version of the software.',
          effort: 'high',
          priority: 'high'
        });
        break;
        
      case VULN_TYPES.UNNECESSARY_SERVICE:
        recommendations.push({
          id: utils.encryption.generateId(),
          type: 'disable_service',
          description: 'Disable unnecessary service to reduce attack surface.',
          effort: 'low',
          priority: 'medium'
        });
        break;
        
      case VULN_TYPES.WEAK_CRYPTOGRAPHY:
        recommendations.push({
          id: utils.encryption.generateId(),
          type: 'strengthen_crypto',
          description: 'Implement stronger cryptographic algorithms and protocols.',
          effort: 'medium',
          priority: 'high'
        });
        break;
        
      default:
        // Generic recommendation
        recommendations.push({
          id: utils.encryption.generateId(),
          type: 'remediate_vulnerability',
          description: 'Address vulnerability according to best practices.',
          effort: 'medium',
          priority: 'high'
        });
    }
    
    // Add alternative mitigation if appropriate
    if (finding.exploitable || finding.severity === VULN_IMPACT.CRITICAL || finding.severity === VULN_IMPACT.HIGH) {
      recommendations.push({
        id: utils.encryption.generateId(),
        type: 'compensating_control',
        description: 'Implement additional security controls to mitigate risk until permanent fix is applied.',
        effort: 'medium',
        priority: 'high',
        isAlternative: true
      });
    }
    
    return recommendations;
  }

  /**
   * Calculate adjusted CVSS score with temporal and environmental factors
   * @param {Object} finding - Vulnerability finding
   * @returns {Promise<Object>} Adjusted CVSS
   * @private
   */
  async _calculateAdjustedCvss(finding) {
    // Start with base CVSS if available
    const cvss = { ...finding.cvss } || { score: 5.0, vector: '', version: this._cvssConfig.version };
    
    // Apply temporal metrics if enabled and data available
    if (this._cvssConfig.useTemporalMetrics) {
      // In a real implementation, this would calculate temporal metrics
      // For now, we'll adjust exploitability
      if (finding.exploitAvailable) {
        // Increase score for available exploits, up to max of 10
        cvss.temporalScore = Math.min(cvss.score * 1.2, 10.0);
      } else {
        cvss.temporalScore = cvss.score;
      }
    }
    
    // Apply environmental metrics if enabled and data available
    if (this._cvssConfig.useEnvironmentalMetrics) {
      // Get asset info
      const assetInfo = this._getAssetInfo(finding.hostId, finding.hostname);
      
      // Adjust based on asset criticality
      if (assetInfo && assetInfo.criticality) {
        let modifier = 1.0;
        
        switch (assetInfo.criticality) {
          case 'critical':
            modifier = 1.5;
            break;
          case 'high':
            modifier = 1.2;
            break;
          case 'medium':
            modifier = 1.0;
            break;
          case 'low':
            modifier = 0.8;
            break;
        }
        
        // Base environmental score on temporal if available, otherwise base
        const baseForEnv = cvss.temporalScore || cvss.score;
        cvss.environmentalScore = Math.min(baseForEnv * modifier, 10.0);
      } else {
        cvss.environmentalScore = cvss.temporalScore || cvss.score;
      }
    }
    
    // Add overall adjusted score
    cvss.adjustedScore = cvss.environmentalScore || cvss.temporalScore || cvss.score;
    
    return cvss;
  }

  /**
   * Calculate days to remediate based on severity
   * @param {string} severity - Vulnerability severity
   * @returns {number} Days to remediate
   * @private
   */
  _calculateDaysToRemediate(severity) {
    switch (severity) {
      case VULN_IMPACT.CRITICAL:
        return this._vulnEscalationThresholds.daysToRemediate.critical;
      case VULN_IMPACT.HIGH:
        return this._vulnEscalationThresholds.daysToRemediate.high;
      case VULN_IMPACT.MEDIUM:
        return this._vulnEscalationThresholds.daysToRemediate.medium;
      case VULN_IMPACT.LOW:
        return this._vulnEscalationThresholds.daysToRemediate.low;
      default:
        return this._vulnEscalationThresholds.daysToRemediate.medium;
    }
  }

  /**
   * Check if a vulnerability should be escalated to L2
   * @param {Object} assessment - Vulnerability assessment
   * @param {Object} finding - Original finding
   * @returns {boolean} True if should be escalated
   * @private
   */
  _shouldEscalateVulnerability(assessment, finding) {
    // Check CVSS threshold
    const cvssScore = assessment.cvss?.adjustedScore || assessment.cvss?.score || finding.cvss?.score || 0;
    if (cvssScore >= this._vulnEscalationThresholds.minCvssForEscalation) {
      return true;
    }
    
    // Check risk score threshold
    const riskScore = finding.riskScore || 0;
    if (riskScore >= this._vulnEscalationThresholds.minRiskScoreForEscalation) {
      return true;
    }
    
    // Check for exploitable vulnerabilities
    if (this._vulnEscalationThresholds.escalateExploitableVulns && 
        (assessment.exploitability?.exploitAvailable || finding.exploitAvailable)) {
      return true;
    }
    
    // Check for vulnerabilities on critical assets
    if (this._vulnEscalationThresholds.escalateOnCriticalAssets && 
        assessment.affectedAssets?.some(asset => asset.criticality === 'critical')) {
      return true;
    }
    
    // Check severity threshold based on impact
    return assessment.severity === VULN_IMPACT.CRITICAL;
  }

  /**
   * Escalate a vulnerability to L2
   * @param {Object} assessment - Vulnerability assessment
   * @param {Object} finding - Original finding
   * @returns {Promise<void>}
   * @private
   */
  async _escalateVulnerability(assessment, finding) {
    try {
      this.log.info(`Escalating vulnerability: ${finding.id} - ${finding.title}`);
      
      // Create escalation issue
      const escalationIssue = {
        id: utils.encryption.generateId(),
        type: 'vulnerability_escalation',
        sourceAgentId: this.id,
        sourceTier: 'l1',
        vulnerabilityId: finding.id,
        cve: finding.cve,
        title: finding.title,
        assessment: assessment,
        originalFinding: finding,
        severity: assessment.severity || finding.severity,
        cvssScore: assessment.cvss?.adjustedScore || assessment.cvss?.score || finding.cvss?.score,
        exploitable: assessment.exploitability?.exploitAvailable || finding.exploitAvailable || false,
        affectedAssets: assessment.affectedAssets || [],
        businessImpact: assessment.businessImpact,
        timestamp: Date.now()
      };
      
      // Determine target L2 agent
      const targetAgentType = this._determineL2Target(assessment, finding);
      
      // Perform the escalation
      await this.escalate(escalationIssue, targetAgentType);
      
      this.log.info(`Escalated vulnerability ${finding.id} to ${targetAgentType}`);
      
      // Report metrics
      utils.metrics.increment(`agent.${this.id}.escalations`, 1, { 
        severity: assessment.severity || finding.severity,
        targetAgent: targetAgentType
      });
    } catch (error) {
      this.log.error(`Error escalating vulnerability: ${finding.id}`, error);
      throw error;
    }
  }

  /**
   * Determine which L2 agent type should handle the vulnerability
   * @param {Object} assessment - Vulnerability assessment
   * @param {Object} finding - Original finding
   * @returns {string} Target L2 agent type
   * @private
   */
  _determineL2Target(assessment, finding) {
    // Default to vulnerability management agent
    return 'vuln_management_agent';
  }

  /**
   * Generate a report for a vulnerability assessment
   * @param {Object} assessment - Vulnerability assessment
   * @param {Object} finding - Original finding
   * @returns {Promise<Object>} Report
   */
  async generateVulnerabilityReport(assessment, finding) {
    try {
      this.log.info(`Generating report for vulnerability: ${finding.id}`);
      
      // Build a comprehensive report
      const report = {
        id: utils.encryption.generateId(),
        type: 'vulnerability_assessment_report',
        findingId: finding.id,
        findingSource: finding.source || 'unknown',
        cve: finding.cve,
        title: finding.title,
        description: finding.description,
        solution: finding.solution,
        affectedAssets: assessment.affectedAssets || [],
        severity: assessment.severity,
        cvss: assessment.cvss,
        exploitability: assessment.exploitability,
        exposure: assessment.exposure,
        businessImpact: assessment.businessImpact,
        remediationRecommendations: assessment.remediationRecommendations || [],
        daysToRemediate: assessment.daysToRemediate,
        timestamp: Date.now(),
        generatedBy: {
          agentId: this.id,
          agentName: this.name,
          agentType: this.type
        }
      };
      
      return report;
    } catch (error) {
      this.log.error(`Error generating vulnerability report for ${finding.id}`, error);
      throw error;
    }
  }
}

module.exports = VulnScannerAgent;