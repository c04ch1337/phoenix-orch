/**
 * Base L1 Agent
 * 
 * This module defines the base class for L1 (tier 1) agents in the Agentic SOC.
 * L1 agents specialize in triage and detection tasks, serving as the first line
 * of defense in the security operations center.
 */

const { Agent, AGENT_STATUS } = require('../index');
const utils = require('../../utils');
const { ESCALATION_REASON } = require('../escalation_manager');

/**
 * Standard L1 agent capabilities
 * @type {Array<string>}
 */
const L1_CAPABILITIES = [
  'triage',
  'detection',
  'monitoring',
  'filtering',
  'initial_assessment',
  'pattern_matching',
  'alert_processing',
  'log_analysis',
  'threshold_monitoring'
];

/**
 * Base L1 Agent class
 * @class BaseL1Agent
 * @extends Agent
 */
class BaseL1Agent extends Agent {
  /**
   * Create a new BaseL1Agent
   * @param {Object} config - Agent configuration
   * @param {Object} messageBus - System message bus
   */
  constructor(config = {}, messageBus = null) {
    // Add standard L1 capabilities to any provided capabilities
    const l1Config = { 
      ...config,
      type: config.type || 'l1',
      tier: 'l1',
      capabilities: [
        ...(config.capabilities || []),
        ...L1_CAPABILITIES
      ]
    };
    
    super(l1Config, messageBus);
    
    // L1 agent specific properties
    this._escalationThresholds = {
      severity: config.escalationThresholds?.severity || 60,
      confidence: config.escalationThresholds?.confidence || 40,
      complexity: config.escalationThresholds?.complexity || 60,
      responseTime: config.escalationThresholds?.responseTime || 30
    };
    
    // Triage metrics
    this._triageMetrics = {
      alertsProcessed: 0,
      alertsEscalated: 0,
      falsePositivesIdentified: 0,
      avgTriageTime: 0,
      totalTriageTime: 0
    };
    
    // Queue limits
    this._maxQueueSize = config.maxQueueSize || 100;
    
    // Detection patterns database (can be loaded from external source)
    this._detectionPatterns = config.detectionPatterns || [];
    
    // Initialize event subscriptions
    this._initializeEventSubscriptions();
  }
  
  /**
   * Initialize L1 agent specific event subscriptions
   * @private
   */
  _initializeEventSubscriptions() {
    if (this._messageBus) {
      // Subscribe to relevant L1 message types
      this._subscriptions = [
        this.subscribeToMessages('alert:new', this._handleNewAlert.bind(this)),
        this.subscribeToMessages('log:anomaly', this._handleLogAnomaly.bind(this)),
        this.subscribeToMessages('threshold:exceeded', this._handleThresholdExceeded.bind(this))
      ];
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
    
    // L1 agent specific initialization
    this.log.info('Initializing L1 agent specific components');
    
    try {
      // Load detection patterns if needed
      if (options.loadDetectionPatterns && this._detectionPatterns.length === 0) {
        await this._loadDetectionPatterns();
      }
      
      this.log.info('L1 agent initialization complete');
    } catch (error) {
      this.log.error('Error during L1 agent initialization', error);
      throw error;
    }
  }
  
  /**
   * Load detection patterns from external source
   * @returns {Promise<void>}
   * @private
   */
  async _loadDetectionPatterns() {
    try {
      // In a real implementation, these patterns might be loaded from a database,
      // file system, or external service
      this.log.info('Loading detection patterns');
      
      // Example implementation
      this._detectionPatterns = [
        // Basic patterns for common security alerts
        // In a real system, these would be comprehensive and regularly updated
        {
          id: 'suspicious-login',
          pattern: 'multiple_failed_logins',
          threshold: 5,
          timeWindow: 300, // 5 mins
          severity: 40
        },
        {
          id: 'brute-force',
          pattern: 'repeated_authentication_attempts',
          threshold: 10,
          timeWindow: 60, // 1 min
          severity: 65
        },
        {
          id: 'credential-stuffing',
          pattern: 'multiple_accounts_single_source',
          threshold: 3,
          timeWindow: 300, // 5 mins
          severity: 70
        }
      ];
      
      this.log.info(`Loaded ${this._detectionPatterns.length} detection patterns`);
    } catch (error) {
      this.log.error('Failed to load detection patterns', error);
      throw error;
    }
  }
  
  /**
   * Handle new alerts
   * @param {Object} message - Alert message
   * @private
   */
  _handleNewAlert(message) {
    try {
      const alert = message.data;
      
      this.log.debug(`Received new alert: ${alert.id} - ${alert.type}`);
      
      // Add the alert as a task to be processed
      this.addTask({
        data: {
          type: 'alert',
          alert
        },
        priority: this._determineAlertPriority(alert)
      });
    } catch (error) {
      this.log.error('Error handling new alert', error);
    }
  }
  
  /**
   * Handle log anomalies
   * @param {Object} message - Anomaly message
   * @private
   */
  _handleLogAnomaly(message) {
    try {
      const anomaly = message.data;
      
      this.log.debug(`Received log anomaly: ${anomaly.id} - ${anomaly.type}`);
      
      // Add the anomaly as a task to be processed
      this.addTask({
        data: {
          type: 'log_anomaly',
          anomaly
        },
        priority: this._determineAnomalyPriority(anomaly)
      });
    } catch (error) {
      this.log.error('Error handling log anomaly', error);
    }
  }
  
  /**
   * Handle threshold exceeded events
   * @param {Object} message - Threshold message
   * @private
   */
  _handleThresholdExceeded(message) {
    try {
      const thresholdEvent = message.data;
      
      this.log.debug(`Received threshold exceeded: ${thresholdEvent.id} - ${thresholdEvent.metric}`);
      
      // Add the threshold event as a task to be processed
      this.addTask({
        data: {
          type: 'threshold_exceeded',
          thresholdEvent
        },
        priority: this._determineThresholdPriority(thresholdEvent)
      });
    } catch (error) {
      this.log.error('Error handling threshold exceeded event', error);
    }
  }
  
  /**
   * Determine alert priority
   * @param {Object} alert - Alert to evaluate
   * @returns {number} Priority (0-100)
   * @private
   */
  _determineAlertPriority(alert) {
    // Priority calculation based on alert properties
    let priority = alert.severity || 50;
    
    // Adjust for critical assets
    if (alert.targetAsset && alert.targetAsset.isCritical) {
      priority += 20;
    }
    
    // Adjust for response time requirements
    if (alert.responseTimeRequired) {
      if (alert.responseTimeRequired <= 15) { // 15 minutes
        priority = Math.max(priority, 80);
      } else if (alert.responseTimeRequired <= 60) { // 1 hour
        priority = Math.max(priority, 60);
      }
    }
    
    return Math.min(priority, 100);
  }
  
  /**
   * Determine anomaly priority
   * @param {Object} anomaly - Anomaly to evaluate
   * @returns {number} Priority (0-100)
   * @private
   */
  _determineAnomalyPriority(anomaly) {
    // Base priority on anomaly score
    let priority = anomaly.score * 100 || 50;
    
    // Adjust for source importance
    if (anomaly.source && anomaly.source.importance) {
      switch (anomaly.source.importance) {
        case 'critical':
          priority += 20;
          break;
        case 'high':
          priority += 10;
          break;
        case 'medium':
          priority += 5;
          break;
        // No adjustment for 'low'
      }
    }
    
    return Math.min(priority, 100);
  }
  
  /**
   * Determine threshold event priority
   * @param {Object} thresholdEvent - Threshold event to evaluate
   * @returns {number} Priority (0-100)
   * @private
   */
  _determineThresholdPriority(thresholdEvent) {
    // Base priority on how much the threshold was exceeded
    const exceedFactor = thresholdEvent.currentValue / thresholdEvent.threshold;
    let priority = Math.min(exceedFactor * 50, 90);
    
    // Adjust for metric importance
    if (thresholdEvent.importance) {
      switch (thresholdEvent.importance) {
        case 'critical':
          priority += 20;
          break;
        case 'high':
          priority += 10;
          break;
        case 'medium':
          priority += 5;
          break;
        // No adjustment for 'low'
      }
    }
    
    return Math.min(priority, 100);
  }
  
  /**
   * Process incoming data
   * @param {Object} data - Data to process
   * @returns {Promise<Object>} Processing result
   */
  async process(data) {
    const startTime = Date.now();
    
    this.log.info(`Processing ${data.type} data`);
    
    let result;
    try {
      switch (data.type) {
        case 'alert':
          result = await this._processAlert(data.alert);
          break;
        case 'log_anomaly':
          result = await this._processLogAnomaly(data.anomaly);
          break;
        case 'threshold_exceeded':
          result = await this._processThresholdEvent(data.thresholdEvent);
          break;
        default:
          result = await this._processGenericData(data);
      }
      
      // Update triage metrics
      this._triageMetrics.alertsProcessed++;
      this._triageMetrics.totalTriageTime += (Date.now() - startTime);
      this._triageMetrics.avgTriageTime = this._triageMetrics.totalTriageTime / this._triageMetrics.alertsProcessed;
      
      // Report metrics
      utils.metrics.gauge(`agent.${this.id}.triage_time_ms`, Date.now() - startTime);
      utils.metrics.increment(`agent.${this.id}.items_processed`, 1, { type: data.type });
      
      return result;
    } catch (error) {
      this.log.error(`Error processing ${data.type} data`, error);
      throw error;
    }
  }
  
  /**
   * Process an alert
   * @param {Object} alert - Alert to process
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processAlert(alert) {
    this.log.info(`Processing alert: ${alert.id} - ${alert.type}`);
    
    // Perform alert triage
    const triageResult = await this.triage(alert);
    
    // Check if the alert needs to be escalated
    if (this._shouldEscalate(triageResult)) {
      await this._escalateTriageResult(triageResult, alert);
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
  }
  
  /**
   * Process a log anomaly
   * @param {Object} anomaly - Anomaly to process
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processLogAnomaly(anomaly) {
    this.log.info(`Processing log anomaly: ${anomaly.id} - ${anomaly.type}`);
    
    // Analyze the anomaly
    const analysisResult = await this.analyze({
      type: 'log_anomaly',
      data: anomaly
    });
    
    // Check if the anomaly needs to be escalated
    if (this._shouldEscalate(analysisResult)) {
      await this._escalateAnalysisResult(analysisResult, anomaly);
      return {
        status: 'escalated',
        analysisResult
      };
    }
    
    // Generate report if not escalated
    const report = await this.report(analysisResult);
    
    return {
      status: 'processed',
      analysisResult,
      report
    };
  }
  
  /**
   * Process a threshold event
   * @param {Object} thresholdEvent - Threshold event to process
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processThresholdEvent(thresholdEvent) {
    this.log.info(`Processing threshold event: ${thresholdEvent.id} - ${thresholdEvent.metric}`);
    
    // Analyze the threshold event
    const analysisResult = await this.analyze({
      type: 'threshold_exceeded',
      data: thresholdEvent
    });
    
    // Check if the threshold event needs to be escalated
    if (this._shouldEscalate(analysisResult)) {
      await this._escalateAnalysisResult(analysisResult, thresholdEvent);
      return {
        status: 'escalated',
        analysisResult
      };
    }
    
    // Generate report if not escalated
    const report = await this.report(analysisResult);
    
    return {
      status: 'processed',
      analysisResult,
      report
    };
  }
  
  /**
   * Process generic data
   * @param {Object} data - Data to process
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processGenericData(data) {
    this.log.info(`Processing generic data of type: ${data.type}`);
    
    // Analyze the data
    const analysisResult = await this.analyze({
      type: 'generic',
      data
    });
    
    // Check if the data needs to be escalated
    if (this._shouldEscalate(analysisResult)) {
      await this._escalateAnalysisResult(analysisResult, data);
      return {
        status: 'escalated',
        analysisResult
      };
    }
    
    // Generate report if not escalated
    const report = await this.report(analysisResult);
    
    return {
      status: 'processed',
      analysisResult,
      report
    };
  }
  
  /**
   * Check if a result should be escalated
   * @param {Object} result - Analysis or triage result
   * @returns {boolean} True if escalation is needed
   * @private
   */
  _shouldEscalate(result) {
    // Check severity threshold
    if (result.severity && result.severity >= this._escalationThresholds.severity) {
      return true;
    }
    
    // Check confidence threshold (lower confidence means escalate)
    if (
      result.confidence !== undefined && 
      result.confidence <= this._escalationThresholds.confidence
    ) {
      return true;
    }
    
    // Check complexity threshold
    if (
      result.complexity && 
      result.complexity >= this._escalationThresholds.complexity
    ) {
      return true;
    }
    
    // Check response time threshold
    if (
      result.responseTimeRequired && 
      result.responseTimeRequired <= this._escalationThresholds.responseTime
    ) {
      return true;
    }
    
    // Check if capabilities required for resolution are beyond L1
    if (
      result.requiredCapabilities && 
      result.requiredCapabilities.some(cap => !this._capabilities.includes(cap))
    ) {
      return true;
    }
    
    // Check if resolution explicitly requires escalation
    return result.requiresEscalation === true;
  }
  
  /**
   * Escalate a triage result
   * @param {Object} triageResult - Triage result to escalate
   * @param {Object} originalData - Original data that was triaged
   * @returns {Promise<void>}
   * @private
   */
  async _escalateTriageResult(triageResult, originalData) {
    this._triageMetrics.alertsEscalated++;
    
    // Determine escalation reason
    let escalationReason = ESCALATION_REASON.MANUAL_TRIGGER;
    
    if (triageResult.severity && triageResult.severity >= this._escalationThresholds.severity) {
      escalationReason = ESCALATION_REASON.SEVERITY_THRESHOLD;
    } else if (
      triageResult.confidence !== undefined && 
      triageResult.confidence <= this._escalationThresholds.confidence
    ) {
      escalationReason = ESCALATION_REASON.CONFIDENCE_LOW;
    } else if (
      triageResult.complexity && 
      triageResult.complexity >= this._escalationThresholds.complexity
    ) {
      escalationReason = ESCALATION_REASON.COMPLEXITY_HIGH;
    } else if (
      triageResult.responseTimeRequired && 
      triageResult.responseTimeRequired <= this._escalationThresholds.responseTime
    ) {
      escalationReason = ESCALATION_REASON.RESPONSE_TIME_CRITICAL;
    } else if (
      triageResult.requiredCapabilities && 
      triageResult.requiredCapabilities.some(cap => !this._capabilities.includes(cap))
    ) {
      escalationReason = ESCALATION_REASON.SPECIALIZED_EXPERTISE_NEEDED;
    }
    
    // Create escalation issue
    const escalationIssue = {
      id: utils.encryption.generateId(),
      type: triageResult.type || 'unknown',
      source: originalData.source || 'unknown',
      sourceData: originalData,
      triageResult,
      severity: triageResult.severity || 50,
      confidence: triageResult.confidence,
      complexity: triageResult.complexity,
      responseTimeRequired: triageResult.responseTimeRequired,
      requiredCapabilities: triageResult.requiredCapabilities,
      timestamp: Date.now()
    };
    
    // Perform the escalation
    await this.escalate(escalationIssue, 'l2');
    
    this.log.info(`Escalated ${triageResult.type} to L2 tier. Reason: ${escalationReason}`);
    
    // Report metrics
    utils.metrics.increment(`agent.${this.id}.escalations`, 1, { 
      type: triageResult.type,
      reason: escalationReason
    });
  }
  
  /**
   * Escalate an analysis result
   * @param {Object} analysisResult - Analysis result to escalate
   * @param {Object} originalData - Original data that was analyzed
   * @returns {Promise<void>}
   * @private
   */
  async _escalateAnalysisResult(analysisResult, originalData) {
    // Similar to _escalateTriageResult but for analysis results
    await this._escalateTriageResult(analysisResult, originalData);
  }
  
  /**
   * Triage an alert or event
   * @param {Object} data - Data to triage
   * @returns {Promise<Object>} Triage result
   */
  async triage(data) {
    try {
      this.log.info(`Triaging data: ${data.id} - ${data.type}`);
      
      // Basic triage implementation - to be overridden in specific L1 agent subclasses
      const result = {
        id: utils.encryption.generateId(),
        originalData: data,
        timestamp: Date.now(),
        assessments: []
      };
      
      // Extract severity if available
      result.severity = data.severity || 50;
      
      // Extract or estimate confidence
      result.confidence = data.confidence || 70;
      
      // Extract or estimate complexity
      result.complexity = data.complexity || 30;
      
      // Determine if this is likely a false positive
      const isFalsePositive = await this._checkForFalsePositive(data);
      if (isFalsePositive) {
        result.isFalsePositive = true;
        this._triageMetrics.falsePositivesIdentified++;
        
        // Report metrics
        utils.metrics.increment(`agent.${this.id}.false_positives`, 1, { type: data.type });
      }
      
      // Add pattern match assessments
      const patternMatches = await this._checkPatternMatches(data);
      if (patternMatches.length > 0) {
        result.assessments.push({
          type: 'pattern_matches',
          matches: patternMatches,
          timestamp: Date.now()
        });
        
        // Adjust severity based on pattern matches
        const maxPatternSeverity = Math.max(...patternMatches.map(match => match.pattern.severity || 0));
        result.severity = Math.max(result.severity, maxPatternSeverity);
      }
      
      return result;
    } catch (error) {
      this.log.error(`Error triaging data: ${data.id}`, error);
      throw error;
    }
  }
  
  /**
   * Check if an alert is likely a false positive
   * @param {Object} data - Data to check
   * @returns {Promise<boolean>} True if likely a false positive
   * @private
   */
  async _checkForFalsePositive(data) {
    // Basic false positive detection - should be overridden in specific agent implementations
    // This is just a placeholder implementation
    
    // Example: Simple check for common false positive scenarios
    if (data.source === 'known_noisy_source') {
      return true;
    }
    
    if (data.type === 'login_failure' && data.count < 3) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check for pattern matches in detection database
   * @param {Object} data - Data to check for patterns
   * @returns {Promise<Array>} Matching patterns
   * @private
   */
  async _checkPatternMatches(data) {
    const matches = [];
    
    try {
      for (const pattern of this._detectionPatterns) {
        // Super simplified pattern matching - in a real system this would be more sophisticated
        const dataStr = JSON.stringify(data).toLowerCase();
        const patternStr = pattern.pattern.toLowerCase();
        
        if (dataStr.includes(patternStr)) {
          matches.push({
            patternId: pattern.id,
            pattern,
            matchedAt: Date.now(),
            confidence: 80 // Simplified confidence score
          });
        }
      }
    } catch (error) {
      this.log.error('Error during pattern matching', error);
    }
    
    return matches;
  }
  
  /**
   * Analyze data and draw conclusions
   * @param {Object} data - Data to analyze
   * @returns {Promise<Object>} Analysis result
   */
  async analyze(data) {
    // Basic analysis - to be overridden in specific L1 agent subclasses
    try {
      // For most L1 agents, triage is the primary form of analysis
      return await this.triage(data.data || data);
    } catch (error) {
      this.log.error('Error during analysis', error);
      throw error;
    }
  }
  
  /**
   * Generate a report for an alert
   * @param {Object} triageResult - Triage result
   * @param {Object} originalAlert - Original alert
   * @returns {Promise<Object>} Report object
   * @private
   */
  async generateAlertReport(triageResult, originalAlert) {
    try {
      // Generate a basic report - to be enhanced in specific agent implementations
      return {
        id: utils.encryption.generateId(),
        type: 'alert_report',
        alertId: originalAlert.id,
        alertType: originalAlert.type,
        severity: triageResult.severity,
        isFalsePositive: triageResult.isFalsePositive || false,
        summary: `Triage of ${originalAlert.type} alert completed`,
        triageResult: triageResult,
        timestamp: Date.now(),
        generatedBy: {
          agentId: this.id,
          agentName: this.name,
          agentType: this.type
        }
      };
    } catch (error) {
      this.log.error('Error generating alert report', error);
      throw error;
    }
  }
  
  /**
   * Generate a report based on findings
   * @param {Object} findings - Findings to report
   * @returns {Promise<Object>} Report object
   */
  async report(findings) {
    try {
      // Basic report generation - to be overridden in specific L1 agent subclasses
      const report = {
        id: utils.encryption.generateId(),
        findingsId: findings.id,
        type: 'l1_report',
        severity: findings.severity || 0,
        confidence: findings.confidence,
        summary: `L1 analysis of ${findings.type || 'event'} completed`,
        details: findings,
        recommendations: [],
        timestamp: Date.now(),
        generatedBy: {
          agentId: this.id,
          agentName: this.name,
          agentType: this.type
        }
      };
      
      // Add recommendations if this was not escalated and not a false positive
      if (!findings.isFalsePositive) {
        report.recommendations.push(
          {
            type: 'action',
            priority: 'low',
            description: 'Monitor for similar patterns'
          }
        );
      }
      
      return report;
    } catch (error) {
      this.log.error('Error generating report', error);
      throw error;
    }
  }
  
  /**
   * Get triage metrics
   * @returns {Object} Triage metrics
   */
  get triageMetrics() {
    return { ...this._triageMetrics };
  }
  
  /**
   * Get detection patterns
   * @returns {Array} Detection patterns
   */
  get detectionPatterns() {
    return [...this._detectionPatterns];
  }
  
  /**
   * Add a new detection pattern
   * @param {Object} pattern - Pattern to add
   * @returns {boolean} Success status
   */
  addDetectionPattern(pattern) {
    if (!pattern || !pattern.id || !pattern.pattern) {
      this.log.error('Cannot add invalid detection pattern');
      return false;
    }
    
    // Check if pattern already exists
    const existingIndex = this._detectionPatterns.findIndex(p => p.id === pattern.id);
    if (existingIndex !== -1) {
      // Update existing pattern
      this._detectionPatterns[existingIndex] = pattern;
      this.log.info(`Updated detection pattern: ${pattern.id}`);
    } else {
      // Add new pattern
      this._detectionPatterns.push(pattern);
      this.log.info(`Added new detection pattern: ${pattern.id}`);
    }
    
    return true;
  }
}

module.exports = BaseL1Agent;