/**
 * Alert Triage Agent
 * 
 * This specialized L1 agent handles the triage of security alerts, primarily from
 * CrowdStrike/Falcon IOA (Indicator of Attack) alerts. It performs initial correlation,
 * identifies affected systems, assesses impact, makes containment recommendations,
 * extracts forensic artifacts, and escalates to appropriate L2 agents when needed.
 */

const { BaseL1Agent } = require('../../agentic_soc_framework');
const utils = require('../../../utils');

/**
 * Alert-specific detection patterns
 * @type {Array<Object>}
 * @private
 */
const ALERT_DETECTION_PATTERNS = [
  {
    id: 'lateral-movement',
    pattern: 'lateral_movement_indicators',
    indicators: ['pass-the-hash', 'pass-the-ticket', 'remote service creation'],
    threshold: 1,
    severity: 85
  },
  {
    id: 'privilege-escalation',
    pattern: 'privilege_escalation',
    indicators: ['UAC bypass', 'token manipulation', 'DLL injection'],
    threshold: 1, 
    severity: 80
  },
  {
    id: 'credential-theft',
    pattern: 'credential_theft',
    indicators: ['mimikatz', 'lsass dump', 'credential store access'],
    threshold: 1,
    severity: 75
  },
  {
    id: 'persistence-mechanism',
    pattern: 'persistence_mechanism',
    indicators: ['registry autorun', 'startup folder', 'scheduled task'],
    threshold: 1,
    severity: 70
  }
];

/**
 * Alert IOC extraction types
 * @type {Array<string>}
 * @private
 */
const ALERT_IOC_TYPES = [
  'process-name', 'file-hash', 'filename', 'registry-key',
  'ip-address', 'domain', 'url', 'user-account', 'command-line'
];

/**
 * Alert threat categories based on MITRE ATT&CK tactics
 * @type {Object}
 * @private
 */
const ALERT_THREAT_CATEGORIES = {
  INITIAL_ACCESS: 'initial-access',
  EXECUTION: 'execution',
  PERSISTENCE: 'persistence',
  PRIVILEGE_ESCALATION: 'privilege-escalation',
  DEFENSE_EVASION: 'defense-evasion',
  CREDENTIAL_ACCESS: 'credential-access',
  DISCOVERY: 'discovery',
  LATERAL_MOVEMENT: 'lateral-movement',
  COLLECTION: 'collection',
  EXFILTRATION: 'exfiltration',
  COMMAND_AND_CONTROL: 'command-and-control',
  IMPACT: 'impact'
};

/**
 * Alert Triage Agent - Specializes in analyzing security alerts from EDR systems
 * @class AlertTriageAgent
 * @extends BaseL1Agent
 */
class AlertTriageAgent extends BaseL1Agent {
  /**
   * Create a new AlertTriageAgent
   * @param {Object} config - Agent configuration
   * @param {Object} messageBus - System message bus
   */
  constructor(config = {}, messageBus = null) {
    // Add alert-specific capabilities to config
    const alertConfig = {
      ...config,
      type: 'alert_triage_agent',
      name: config.name || 'Alert Triage Agent',
      capabilities: [
        ...(config.capabilities || []),
        'alert_analysis',
        'ioc_extraction',
        'impact_assessment',
        'forensic_artifact_extraction',
        'correlation_analysis',
        'containment_recommendation'
      ]
    };

    super(alertConfig, messageBus);

    // Alert agent specific properties
    this._alertSources = {
      crowdstrikeEnabled: config.crowdstrikeEnabled !== false,
      carbonBlackEnabled: config.carbonBlackEnabled === true,
      sentinelOneEnabled: config.sentinelOneEnabled === true,
      windowsDefenderEnabled: config.windowsDefenderEnabled === true
    };

    // Containment configuration - controls when automatic containment is recommended
    this._containmentConfig = {
      enableAutoContainment: config.enableAutoContainment !== false,
      minSeverityForContainment: config.minSeverityForContainment || 75,
      minConfidenceForContainment: config.minConfidenceForContainment || 80,
      containmentActions: config.containmentActions || [
        'isolate_host',
        'kill_process',
        'delete_file',
        'block_hash',
        'disable_account'
      ]
    };

    // Create a cache for recent alerts to aid in correlation
    this._recentAlerts = {
      alerts: [],
      maxSize: config.recentAlertsMaxSize || 100
    };

    // Initialize additional event subscriptions
    this._initializeAlertEventSubscriptions();
  }

  /**
   * Initialize alert-specific event subscriptions
   * @private
   */
  _initializeAlertEventSubscriptions() {
    if (this._messageBus) {
      // Subscribe to relevant alert message types
      const additionalSubscriptions = [
        this.subscribeToMessages('crowdstrike:alert', this._handleCrowdstrikeAlert.bind(this)),
        this.subscribeToMessages('carbonblack:alert', this._handleCarbonBlackAlert.bind(this)),
        this.subscribeToMessages('sentinelone:alert', this._handleSentinelOneAlert.bind(this)),
        this.subscribeToMessages('windowsdefender:alert', this._handleWindowsDefenderAlert.bind(this))
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
    
    // Alert agent specific initialization
    this.log.info('Initializing Alert Triage Agent specific components');
    
    try {
      // Load alert detection patterns
      await this._loadAlertDetectionPatterns();
      
      this.log.info('Alert triage agent initialization complete');
    } catch (error) {
      this.log.error('Error during Alert triage agent initialization', error);
      throw error;
    }
  }

  /**
   * Load alert detection patterns
   * @returns {Promise<void>}
   * @private
   */
  async _loadAlertDetectionPatterns() {
    try {
      this.log.info('Loading alert detection patterns');
      
      // Add alert-specific patterns to detection patterns
      for (const pattern of ALERT_DETECTION_PATTERNS) {
        this.addDetectionPattern(pattern);
      }
      
      this.log.info(`Loaded ${ALERT_DETECTION_PATTERNS.length} alert detection patterns`);
    } catch (error) {
      this.log.error('Failed to load alert detection patterns', error);
      throw error;
    }
  }

  /**
   * Handle a CrowdStrike alert
   * @param {Object} message - Alert message
   * @private
   */
  _handleCrowdstrikeAlert(message) {
    try {
      if (!this._alertSources.crowdstrikeEnabled) {
        this.log.debug('CrowdStrike alerts are disabled, ignoring');
        return;
      }

      const alert = message.data;
      
      this.log.debug(`Received CrowdStrike alert: ${alert.id} - ${alert.detection_name}`);
      
      // Convert CrowdStrike alert to internal format
      const normalizedAlert = this._convertCrowdstrikeAlert(alert);
      
      // Add to recent alerts cache for correlation
      this._addToRecentAlerts(normalizedAlert);
      
      // Add as a task to be processed
      this.addTask({
        data: {
          type: 'security_alert',
          source: 'crowdstrike',
          alert: normalizedAlert,
          rawAlert: alert
        },
        priority: this._determineAlertPriority(normalizedAlert)
      });
    } catch (error) {
      this.log.error('Error handling CrowdStrike alert', error);
    }
  }

  /**
   * Handle a Carbon Black alert
   * @param {Object} message - Alert message
   * @private
   */
  _handleCarbonBlackAlert(message) {
    try {
      if (!this._alertSources.carbonBlackEnabled) {
        this.log.debug('Carbon Black alerts are disabled, ignoring');
        return;
      }

      const alert = message.data;
      
      this.log.debug(`Received Carbon Black alert: ${alert.id} - ${alert.alert_type}`);
      
      // Convert Carbon Black alert to internal format
      const normalizedAlert = this._convertCarbonBlackAlert(alert);
      
      // Add to recent alerts cache for correlation
      this._addToRecentAlerts(normalizedAlert);
      
      // Add as a task to be processed
      this.addTask({
        data: {
          type: 'security_alert',
          source: 'carbonblack',
          alert: normalizedAlert,
          rawAlert: alert
        },
        priority: this._determineAlertPriority(normalizedAlert)
      });
    } catch (error) {
      this.log.error('Error handling Carbon Black alert', error);
    }
  }

  /**
   * Add an alert to the recent alerts cache
   * @param {Object} alert - Alert to add
   * @private
   */
  _addToRecentAlerts(alert) {
    // Add to the front of the array (newest first)
    this._recentAlerts.alerts.unshift(alert);
    
    // Trim the array if it exceeds max size
    if (this._recentAlerts.alerts.length > this._recentAlerts.maxSize) {
      this._recentAlerts.alerts = this._recentAlerts.alerts.slice(0, this._recentAlerts.maxSize);
    }
  }

  /**
   * Convert CrowdStrike alert to normalized alert format
   * @param {Object} alert - CrowdStrike alert
   * @returns {Object} Normalized alert
   * @private
   */
  _convertCrowdstrikeAlert(alert) {
    // This would contain the actual mapping logic for CrowdStrike's format
    // Placeholder implementation
    return {
      id: alert.id || utils.encryption.generateId(),
      source: 'crowdstrike',
      alertType: alert.detection_name || 'unknown',
      severity: this._mapCrowdStrikeSeverity(alert.severity || alert.max_severity),
      timestamp: alert.timestamp || alert.created_timestamp || Date.now(),
      hostname: alert.hostname || alert.device_details?.hostname,
      ipAddress: alert.device_details?.local_ip || alert.device_ip,
      username: alert.user_details?.username || alert.user_name,
      processName: alert.process_details?.process_name || alert.process_name,
      processId: alert.process_details?.process_id || alert.process_id,
      processPath: alert.process_details?.process_path || alert.process_path,
      commandLine: alert.process_details?.command_line || alert.command_line,
      parentProcess: alert.process_details?.parent_process_name || alert.parent_process_name,
      parentProcessId: alert.process_details?.parent_process_id || alert.parent_process_id,
      filePath: alert.file_details?.file_path || alert.file_path,
      fileHash: alert.file_details?.md5 || alert.file_hash,
      tactics: alert.tactic || [],
      techniques: alert.technique || [],
      description: alert.description || '',
      status: alert.status || 'new',
      mitreTactic: this._extractMitreTactic(alert),
      rawData: alert
    };
  }

  /**
   * Convert Carbon Black alert to normalized alert format
   * @param {Object} alert - Carbon Black alert
   * @returns {Object} Normalized alert
   * @private
   */
  _convertCarbonBlackAlert(alert) {
    // This would contain the actual mapping logic for Carbon Black's format
    // Placeholder implementation
    return {
      id: alert.id || utils.encryption.generateId(),
      source: 'carbonblack',
      alertType: alert.alert_type || alert.type || 'unknown',
      severity: this._mapCarbonBlackSeverity(alert.severity),
      timestamp: alert.create_time || alert.timestamp || Date.now(),
      hostname: alert.device_name || alert.hostname,
      ipAddress: alert.device_ip || alert.ip_address,
      username: alert.username || alert.user,
      processName: alert.process_name,
      processId: alert.process_pid || alert.pid,
      processPath: alert.process_path,
      commandLine: alert.process_cmdline || alert.command_line,
      parentProcess: alert.parent_name || alert.parent_process,
      parentProcessId: alert.parent_pid,
      filePath: alert.file_path,
      fileHash: alert.file_hash || alert.md5,
      tactics: [],  // Would extract from alert if available
      techniques: [],  // Would extract from alert if available
      description: alert.reason || alert.description,
      status: alert.status || 'new',
      mitreTactic: this._extractMitreTactic(alert),
      rawData: alert
    };
  }

  /**
   * Map CrowdStrike severity to normalized severity
   * @param {string|number} severity - CrowdStrike severity
   * @returns {number} Normalized severity 0-100
   * @private
   */
  _mapCrowdStrikeSeverity(severity) {
    if (typeof severity === 'number') {
      // If it's already a number, ensure it's in our range
      return Math.min(Math.max(severity, 0), 100);
    }
    
    // Map string severities
    switch (String(severity).toLowerCase()) {
      case 'critical':
        return 90;
      case 'high':
        return 75;
      case 'medium':
        return 50;
      case 'low':
        return 25;
      case 'informational':
        return 10;
      default:
        return 50; // Default to medium
    }
  }

  /**
   * Map Carbon Black severity to normalized severity
   * @param {string|number} severity - Carbon Black severity
   * @returns {number} Normalized severity 0-100
   * @private
   */
  _mapCarbonBlackSeverity(severity) {
    if (typeof severity === 'number') {
      // If it's already a number, adjust scale if needed
      if (severity >= 1 && severity <= 10) {
        return severity * 10; // Convert 1-10 scale to 10-100
      }
      return Math.min(Math.max(severity, 0), 100);
    }
    
    // Map string severities
    switch (String(severity).toLowerCase()) {
      case 'critical':
        return 90;
      case 'high':
        return 75;
      case 'moderate':
      case 'medium':
        return 50;
      case 'low':
        return 25;
      case 'info':
      case 'informational':
        return 10;
      default:
        return 50; // Default to medium
    }
  }

  /**
   * Extract MITRE ATT&CK tactic from alert
   * @param {Object} alert - Alert object
   * @returns {string|null} MITRE tactic or null
   * @private
   */
  _extractMitreTactic(alert) {
    // This would extract the MITRE tactic from the alert
    // Placeholder implementation
    
    // Check if alert has tactic information
    if (alert.tactic) {
      return String(alert.tactic).toLowerCase();
    }
    
    if (alert.technique && alert.technique.startsWith('T')) {
      // Use technique to infer tactic (simplified)
      const techId = alert.technique.substring(0, 5); // Get technique ID (e.g., T1078)
      
      // Very simplified mapping - in reality would use a complete MITRE mapping
      if (techId === 'T1078') return ALERT_THREAT_CATEGORIES.INITIAL_ACCESS;
      if (techId === 'T1059') return ALERT_THREAT_CATEGORIES.EXECUTION;
      if (techId === 'T1098') return ALERT_THREAT_CATEGORIES.PERSISTENCE;
      if (techId === 'T1068') return ALERT_THREAT_CATEGORIES.PRIVILEGE_ESCALATION;
      if (techId === 'T1070') return ALERT_THREAT_CATEGORIES.DEFENSE_EVASION;
      if (techId === 'T1003') return ALERT_THREAT_CATEGORIES.CREDENTIAL_ACCESS;
      if (techId === 'T1087') return ALERT_THREAT_CATEGORIES.DISCOVERY;
      if (techId === 'T1021') return ALERT_THREAT_CATEGORIES.LATERAL_MOVEMENT;
      if (techId === 'T1119') return ALERT_THREAT_CATEGORIES.COLLECTION;
      if (techId === 'T1048') return ALERT_THREAT_CATEGORIES.EXFILTRATION;
      if (techId === 'T1071') return ALERT_THREAT_CATEGORIES.COMMAND_AND_CONTROL;
      if (techId === 'T1485') return ALERT_THREAT_CATEGORIES.IMPACT;
    }
    
    return null; // Couldn't determine tactic
  }

  /**
   * Determine security alert priority
   * @param {Object} alert - Alert to evaluate
   * @returns {number} Priority (0-100)
   * @private
   */
  _determineAlertPriority(alert) {
    // Start with a base priority from alert severity
    let priority = alert.severity || 50;
    
    // Adjust for critical systems
    if (this._isBusinessCriticalSystem(alert.hostname, alert.ipAddress)) {
      priority += 20;
    }
    
    // Adjust for privileged users
    if (this._isPrivilegedUser(alert.username)) {
      priority += 15;
    }
    
    // Adjust for severe MITRE tactics
    if (alert.mitreTactic) {
      if ([
        ALERT_THREAT_CATEGORIES.LATERAL_MOVEMENT,
        ALERT_THREAT_CATEGORIES.CREDENTIAL_ACCESS,
        ALERT_THREAT_CATEGORIES.COMMAND_AND_CONTROL,
        ALERT_THREAT_CATEGORIES.EXFILTRATION,
        ALERT_THREAT_CATEGORIES.IMPACT
      ].includes(alert.mitreTactic)) {
        priority += 15;
      }
    }
    
    // Ensure priority is within bounds
    return Math.min(Math.max(priority, 0), 100);
  }

  /**
   * Check if a system is considered business critical
   * @param {string} hostname - System hostname
   * @param {string} ipAddress - System IP address
   * @returns {boolean} True if system is business critical
   * @private
   */
  _isBusinessCriticalSystem(hostname, ipAddress) {
    // In a real implementation, this would check against an asset database
    // Placeholder implementation
    
    const criticalSystemPatterns = [
      'prod', 'dc', 'domain', 'admin', 'sql', 'db',
      'finance', 'pay', 'hr', 'exec', 'server'
    ];
    
    if (hostname) {
      const lowerHostname = hostname.toLowerCase();
      for (const pattern of criticalSystemPatterns) {
        if (lowerHostname.includes(pattern)) {
          return true;
        }
      }
    }
    
    // Check IP against critical ranges
    if (ipAddress) {
      // Simple check, would be more sophisticated in production
      if (ipAddress.startsWith('10.1.') || ipAddress.startsWith('192.168.1.')) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if a user is considered privileged
   * @param {string} username - Username to check
   * @returns {boolean} True if user is privileged
   * @private
   */
  _isPrivilegedUser(username) {
    // In a real implementation, this would check against a user database
    // Placeholder implementation
    
    if (!username) return false;
    
    const privilegedPatterns = [
      'admin', 'root', 'system', 'service', 'backup', 'domain',
      'administrator', 'svc', 'privileged', 'sudo'
    ];
    
    const lowerUsername = username.toLowerCase();
    for (const pattern of privilegedPatterns) {
      if (lowerUsername.includes(pattern)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Process a security alert
   * @param {Object} data - Task data
   * @returns {Promise<Object>} Processing result
   */
  async process(data) {
    if (data.type === 'security_alert') {
      return await this._processSecurityAlert(data);
    }
    
    // For other data types, use the parent class implementation
    return await super.process(data);
  }

  /**
   * Process a security alert
   * @param {Object} data - Alert data
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processSecurityAlert(data) {
    const startTime = Date.now();
    const alert = data.alert;
    
    this.log.info(`Processing security alert: ${alert.id} - ${alert.alertType} on ${alert.hostname}`);
    
    try {
      // Perform alert triage
      const triageResult = await this.triageAlert(alert, data.rawAlert);
      
      // Update metrics
      this._triageMetrics.alertsProcessed++;
      this._triageMetrics.totalTriageTime += (Date.now() - startTime);
      this._triageMetrics.avgTriageTime =
        this._triageMetrics.totalTriageTime / this._triageMetrics.alertsProcessed;
      
      // Report metrics
      utils.metrics.gauge(`agent.${this.id}.triage_time_ms`, Date.now() - startTime);
      utils.metrics.increment(`agent.${this.id}.items_processed`, 1, {
        type: 'security_alert',
        source: alert.source || 'unknown'
      });
      
      // Check if the alert needs to be escalated
      if (this._shouldEscalate(triageResult)) {
        await this._escalateTriageResult(triageResult, {
          ...alert,
          triageResult
        });
        
        return {
          status: 'escalated',
          triageResult
        };
      }
      
      // Generate report if not escalated
      const report = await this.generateAlertReport(triageResult, alert);
      
      return {
        status: 'resolved',
        triageResult,
        report
      };
    } catch (error) {
      this.log.error(`Error processing security alert: ${alert.id}`, error);
      throw error;
    }
  }

  /**
   * Triage a security alert
   * @param {Object} alert - Alert to triage
   * @param {Object} rawAlert - Raw alert data (optional)
   * @returns {Promise<Object>} Triage result
   */
  async triageAlert(alert, rawAlert = null) {
    try {
      this.log.info(`Triaging alert: ${alert.id}`);
      
      // Create base triage result
      const result = {
        id: utils.encryption.generateId(),
        alertId: alert.id,
        timestamp: Date.now(),
        findings: [],
        iocs: []
      };
      
      // Extract IOCs
      result.iocs = await this._extractIOCs(alert);
      
      // Check for related alerts
      result.relatedAlerts = await this._findRelatedAlerts(alert);
      
      // Determine alert category (MITRE tactic)
      result.category = alert.mitreTactic || this._categorizeAlert(alert);
      
      // Calculate severity
      result.severity = alert.severity || 60;
      
      // Calculate confidence
      result.confidence = 70; // Default confidence
      
      // Check if this is likely a false positive
      result.isFalsePositive = false;
      
      // Add pattern match assessments
      const patternMatches = await this._checkPatternMatches(alert);
      if (patternMatches.length > 0) {
        result.findings.push({
          type: 'pattern_matches',
          matches: patternMatches,
          timestamp: Date.now()
        });
      }
      
      // Generate containment recommendations
      result.containmentRecommendations = this._generateContainmentRecommendations(alert, result);
      
      // Determine which L2 agent should handle this if escalated
      result.recommendedEscalationTarget = this._determineEscalationTarget(result);
      
      return result;
    } catch (error) {
      this.log.error(`Error triaging alert: ${alert.id}`, error);
      throw error;
    }
  }

  /**
   * Extract IOCs from alert
   * @param {Object} alert - Alert to analyze
   * @returns {Promise<Array>} Extracted IOCs
   * @private
   */
  async _extractIOCs(alert) {
    const iocs = [];
    
    // Extract process name
    if (alert.processName) {
      iocs.push({
        type: 'process-name',
        value: alert.processName,
        source: 'alert'
      });
    }
    
    // Extract file hash
    if (alert.fileHash) {
      iocs.push({
        type: 'file-hash',
        value: alert.fileHash,
        source: 'alert'
      });
    }
    
    // Extract command line
    if (alert.commandLine) {
      iocs.push({
        type: 'command-line',
        value: alert.commandLine,
        source: 'alert'
      });
    }
    
    // Extract IP addresses from command line if present
    if (alert.commandLine) {
      const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
      const ips = alert.commandLine.match(ipRegex);
      
      if (ips) {
        for (const ip of ips) {
          iocs.push({
            type: 'ip-address',
            value: ip,
            source: 'command_line'
          });
        }
      }
    }
    
    return iocs;
  }

  /**
   * Find alerts related to the current alert
   * @param {Object} alert - Current alert
   * @returns {Promise<Array>} Related alerts
   * @private
   */
  async _findRelatedAlerts(alert) {
    const relatedAlerts = [];
    
    // Look for alerts from the same host
    if (alert.hostname) {
      const sameHostAlerts = this._recentAlerts.alerts.filter(a =>
        a.id !== alert.id &&
        a.hostname === alert.hostname
      );
      
      // Add to related alerts with relation type
      for (const related of sameHostAlerts) {
        relatedAlerts.push({
          alertId: related.id,
          relationType: 'same_host',
          alertType: related.alertType,
          timestamp: related.timestamp
        });
      }
    }
    
    // Look for alerts with the same process
    if (alert.processName) {
      const sameProcessAlerts = this._recentAlerts.alerts.filter(a =>
        a.id !== alert.id &&
        a.processName === alert.processName
      );
      
      // Add to related alerts with relation type
      for (const related of sameProcessAlerts) {
        relatedAlerts.push({
          alertId: related.id,
          relationType: 'same_process',
          alertType: related.alertType,
          timestamp: related.timestamp
        });
      }
    }
    
    return relatedAlerts;
  }

  /**
   * Categorize an alert based on analysis
   * @param {Object} alert - Alert to categorize
   * @returns {string} Alert category
   * @private
   */
  _categorizeAlert(alert) {
    // Simple categorization based on alert data
    // In a real implementation, this would be more sophisticated
    
    // Check for lateral movement indicators
    if (alert.commandLine && /psexec|wmic|sc \\|invoke-command/.test(alert.commandLine.toLowerCase())) {
      return ALERT_THREAT_CATEGORIES.LATERAL_MOVEMENT;
    }
    
    // Check for credential access
    if (alert.processName && /mimikatz|procdump|gsecdump/.test(alert.processName.toLowerCase())) {
      return ALERT_THREAT_CATEGORIES.CREDENTIAL_ACCESS;
    }
    
    // Check for persistence
    if (alert.commandLine && /reg add.*run|schtasks|new-item.*startup/.test(alert.commandLine.toLowerCase())) {
      return ALERT_THREAT_CATEGORIES.PERSISTENCE;
    }
    
    // Default to execution if we can't categorize further
    return ALERT_THREAT_CATEGORIES.EXECUTION;
  }

  /**
   * Generate containment recommendations
   * @param {Object} alert - Alert to generate recommendations for
   * @param {Object} triageResult - Triage result
   * @returns {Array} Containment recommendations
   * @private
   */
  _generateContainmentRecommendations(alert, triageResult) {
    const recommendations = [];
    
    // Always recommend isolating the host for severe alerts
    if (triageResult.severity >= 70) {
      recommendations.push({
        type: 'isolate_host',
        target: alert.hostname,
        reason: `Severe ${triageResult.category} alert`,
        automatable: true,
        priority: 'high'
      });
    }
    
    // Recommend killing the process
    if (alert.processName && alert.processId) {
      recommendations.push({
        type: 'kill_process',
        target: `${alert.processName} (${alert.processId})`,
        reason: `Suspicious process involved in ${triageResult.category} alert`,
        automatable: true,
        priority: 'high'
      });
    }
    
    // Recommend blocking hash if present
    if (alert.fileHash) {
      recommendations.push({
        type: 'block_hash',
        target: alert.fileHash,
        reason: `Suspicious file hash from ${triageResult.category} alert`,
        automatable: true,
        priority: 'high'
      });
    }
    
    return recommendations;
  }

  /**
   * Determine escalation target for an alert
   * @param {Object} triageResult - Triage result
   * @returns {string} Recommended escalation target
   * @private
   */
  _determineEscalationTarget(triageResult) {
    // Default to incident response agent
    let target = 'incident_response_agent';
    
    // For threat intel related escalations
    if (triageResult.category === ALERT_THREAT_CATEGORIES.COMMAND_AND_CONTROL ||
        triageResult.category === ALERT_THREAT_CATEGORIES.LATERAL_MOVEMENT) {
      target = 'threat_intelligence_agent';
    }
    
    return target;
  }

  /**
   * Generate a report for an analyzed alert
   * @param {Object} triageResult - Triage result
   * @param {Object} alert - Original alert
   * @returns {Promise<Object>} Report
   */
  async generateAlertReport(triageResult, alert) {
    try {
      this.log.info(`Generating report for alert: ${alert.id}`);
      
      // Build a comprehensive report
      const report = {
        id: utils.encryption.generateId(),
        type: 'alert_analysis_report',
        alertId: alert.id,
        alertSource: alert.source || 'unknown',
        hostname: alert.hostname,
        username: alert.username,
        processName: alert.processName,
        category: triageResult.category,
        severity: triageResult.severity,
        confidence: triageResult.confidence,
        isFalsePositive: triageResult.isFalsePositive || false,
        summary: `Analysis of ${triageResult.category} alert on ${alert.hostname}`,
        findings: triageResult.findings || [],
        iocs: triageResult.iocs || [],
        relatedAlerts: triageResult.relatedAlerts || [],
        containmentRecommendations: triageResult.containmentRecommendations || [],
        escalationRecommendation: triageResult.recommendedEscalationTarget,
        timestamp: Date.now(),
        generatedBy: {
          agentId: this.id,
          agentName: this.name,
          agentType: this.type
        }
      };
      
      return report;
    } catch (error) {
      this.log.error(`Error generating alert report for ${alert.id}`, error);
      throw error;
    }
  }
}

module.exports = AlertTriageAgent;
