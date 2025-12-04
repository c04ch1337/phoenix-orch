/**
 * Escalation Manager
 * 
 * This module implements the escalation logic for the Agentic SOC system, handling
 * escalation of issues between agent tiers (L1 → L2 → L3 → Dad) based on defined
 * criteria and thresholds.
 */

const EventEmitter = require('events');
const utils = require('../utils');

// Escalation levels
const ESCALATION_LEVEL = Object.freeze({
  L1: 'l1',
  L2: 'l2',
  L3: 'l3',
  DAD: 'dad'
});

// Escalation reasons
const ESCALATION_REASON = Object.freeze({
  // Automated reasons
  SEVERITY_THRESHOLD: 'severity_threshold',
  CONFIDENCE_LOW: 'confidence_low',
  COMPLEXITY_HIGH: 'complexity_high',
  RESPONSE_TIME_CRITICAL: 'response_time_critical',
  ANALYSIS_INCONCLUSIVE: 'analysis_inconclusive',
  UNKNOWN_PATTERN: 'unknown_pattern',
  AGENT_CAPACITY_EXCEEDED: 'agent_capacity_exceeded',
  SPECIALIZED_EXPERTISE_NEEDED: 'specialized_expertise_needed',
  
  // Manual reasons
  MANUAL_TRIGGER: 'manual_trigger',
  HUMAN_OVERSIGHT_REQUIRED: 'human_oversight_required',
  ETHICAL_CONCERN: 'ethical_concern',
  
  // Critical reasons (Dad-only)
  CRITICAL_IMPACT: 'critical_impact',
  REGULATORY_COMPLIANCE: 'regulatory_compliance',
  NOVEL_THREAT_VECTOR: 'novel_threat_vector',
  ORGANIZATIONAL_RISK: 'organizational_risk',
  LEGAL_LIABILITY: 'legal_liability'
});

/**
 * EscalationManager class for handling escalations between agent tiers
 * @class EscalationManager
 * @extends EventEmitter
 */
class EscalationManager extends EventEmitter {
  /**
   * Create a new EscalationManager
   * @param {Object} options - Configuration options
   * @param {Object} options.agentRegistry - Agent registry instance
   * @param {Object} options.agentManager - Agent manager instance
   * @param {Object} options.messageBus - System message bus
   * @param {Object} options.thresholds - Custom escalation thresholds
   */
  constructor(options = {}) {
    super();
    
    // Dependencies
    this._registry = options.agentRegistry;
    this._agentManager = options.agentManager;
    this._messageBus = options.messageBus;
    
    // Default thresholds for automated escalation
    this._thresholds = {
      // Severity thresholds (0-100)
      severity: {
        l1_to_l2: options.thresholds?.severity?.l1_to_l2 || 60,
        l2_to_l3: options.thresholds?.severity?.l2_to_l3 || 75,
        l3_to_dad: options.thresholds?.severity?.l3_to_dad || 90
      },
      
      // Confidence thresholds (0-100, lower triggers escalation)
      confidence: {
        l1_to_l2: options.thresholds?.confidence?.l1_to_l2 || 40,
        l2_to_l3: options.thresholds?.confidence?.l2_to_l3 || 30,
        l3_to_dad: options.thresholds?.confidence?.l3_to_dad || 20
      },
      
      // Complexity thresholds (0-100)
      complexity: {
        l1_to_l2: options.thresholds?.complexity?.l1_to_l2 || 60,
        l2_to_l3: options.thresholds?.complexity?.l2_to_l3 || 75,
        l3_to_dad: options.thresholds?.complexity?.l3_to_dad || 90
      },
      
      // Response time thresholds (minutes)
      responseTime: {
        l1_to_l2: options.thresholds?.responseTime?.l1_to_l2 || 30,
        l2_to_l3: options.thresholds?.responseTime?.l2_to_l3 || 60,
        l3_to_dad: options.thresholds?.responseTime?.l3_to_dad || 120
      },
      
      // Critical impact types that go directly to Dad
      criticalImpactTypes: options.thresholds?.criticalImpactTypes || [
        'data_breach',
        'ransomware',
        'system_compromise',
        'critical_infrastructure',
        'executive_target',
        'supply_chain'
      ]
    };
    
    // Escalation history
    this._escalations = [];
    
    // Initialize logging
    this._initializeLogging();
    
    // Register message handlers
    this._registerMessageHandlers();
  }
  
  /**
   * Initialize logging
   * @private
   */
  _initializeLogging() {
    this.log = {
      info: (message) => {
        console.log(`[INFO][EscalationManager] ${message}`);
        utils.telemetry.log('info', `[EscalationManager] ${message}`);
      },
      warn: (message) => {
        console.warn(`[WARN][EscalationManager] ${message}`);
        utils.telemetry.log('warn', `[EscalationManager] ${message}`);
      },
      error: (message, error = null) => {
        console.error(`[ERROR][EscalationManager] ${message}`, error);
        utils.telemetry.log('error', `[EscalationManager] ${message}`, { 
          error: error ? { message: error.message, stack: error.stack } : null 
        });
      },
      debug: (message) => {
        console.debug(`[DEBUG][EscalationManager] ${message}`);
        utils.telemetry.log('debug', `[EscalationManager] ${message}`);
      }
    };
  }
  
  /**
   * Register message bus handlers
   * @private
   */
  _registerMessageHandlers() {
    if (!this._messageBus) {
      return;
    }
    
    // Subscribe to escalation requests
    this._messageBus.subscribe('escalation:request', (message) => {
      this._handleEscalationRequest(message);
    });
  }
  
  /**
   * Handle escalation requests from the message bus
   * @param {Object} message - Escalation request message
   * @private
   */
  _handleEscalationRequest(message) {
    try {
      const { sourceAgentId, issue, targetTier, reason } = message.data;
      
      this.log.info(
        `Received escalation request from agent ${sourceAgentId} to tier ${targetTier}`
      );
      
      // Process the escalation
      this.escalateIssue(issue, {
        sourceAgentId,
        targetTier,
        reason
      });
    } catch (error) {
      this.log.error('Error handling escalation request', error);
    }
  }
  
  /**
   * Determine the next tier for escalation
   * @param {string} currentTier - Current tier
   * @returns {string} Next tier
   * @private
   */
  _getNextTier(currentTier) {
    const tierMap = {
      [ESCALATION_LEVEL.L1]: ESCALATION_LEVEL.L2,
      [ESCALATION_LEVEL.L2]: ESCALATION_LEVEL.L3,
      [ESCALATION_LEVEL.L3]: ESCALATION_LEVEL.DAD
    };
    
    return tierMap[currentTier.toLowerCase()] || ESCALATION_LEVEL.DAD;
  }
  
  /**
   * Get suitable agents for handling an escalated issue
   * @param {string} targetTier - Target tier for escalation
   * @param {Object} requirements - Agent requirements
   * @returns {Array} Array of suitable agents
   * @private
   */
  _getSuitableAgentsForEscalation(targetTier, requirements = {}) {
    if (!this._registry) {
      return [];
    }
    
    // Find agents in the target tier
    const tierAgents = this._registry.getAgentsByTier(targetTier);
    
    // If no specific requirements, return all agents in the tier
    if (Object.keys(requirements).length === 0) {
      return tierAgents;
    }
    
    // Filter by capabilities if specified
    if (requirements.capabilities && requirements.capabilities.length > 0) {
      return tierAgents.filter(agent => 
        requirements.capabilities.every(cap => agent.capabilities.includes(cap))
      );
    }
    
    return tierAgents;
  }
  
  /**
   * Track an escalation in the history
   * @param {Object} escalation - Escalation details
   * @private
   */
  _trackEscalation(escalation) {
    this._escalations.push({
      ...escalation,
      timestamp: Date.now()
    });
    
    // Report to metrics
    utils.metrics.increment('escalation_manager.escalations', 1, {
      sourceTier: escalation.sourceTier,
      targetTier: escalation.targetTier,
      reason: escalation.reason
    });
    
    // Emit escalation event
    this.emit('escalation', escalation);
  }
  
  /**
   * Update escalation thresholds
   * @param {Object} thresholds - New threshold values to set
   */
  updateThresholds(thresholds) {
    if (!thresholds) return;
    
    // Update severity thresholds
    if (thresholds.severity) {
      this._thresholds.severity = {
        ...this._thresholds.severity,
        ...thresholds.severity
      };
    }
    
    // Update confidence thresholds
    if (thresholds.confidence) {
      this._thresholds.confidence = {
        ...this._thresholds.confidence,
        ...thresholds.confidence
      };
    }
    
    // Update complexity thresholds
    if (thresholds.complexity) {
      this._thresholds.complexity = {
        ...this._thresholds.complexity,
        ...thresholds.complexity
      };
    }
    
    // Update response time thresholds
    if (thresholds.responseTime) {
      this._thresholds.responseTime = {
        ...this._thresholds.responseTime,
        ...thresholds.responseTime
      };
    }
    
    // Update critical impact types
    if (thresholds.criticalImpactTypes) {
      this._thresholds.criticalImpactTypes = [
        ...thresholds.criticalImpactTypes
      ];
    }
    
    this.log.info('Updated escalation thresholds');
  }
  
  /**
   * Escalate an issue to the appropriate tier
   * @param {Object} issue - The issue to escalate
   * @param {Object} options - Escalation options
   * @param {string} [options.sourceAgentId] - ID of the source agent
   * @param {string} [options.sourceTier] - Source tier (l1, l2, l3)
   * @param {string} [options.targetTier] - Target tier (l2, l3, dad)
   * @param {string} [options.reason] - Reason for escalation
   * @param {Object} [options.metadata] - Additional metadata
   * @returns {Promise<Object>} Escalation result
   */
  async escalateIssue(issue, options = {}) {
    try {
      // Get source tier
      let sourceTier = options.sourceTier;
      if (!sourceTier && options.sourceAgentId && this._registry) {
        const sourceAgent = this._registry.getAgentById(options.sourceAgentId);
        if (sourceAgent) {
          // Determine source tier from agent type
          if (sourceAgent.type.startsWith('l1') || sourceAgent.type === 'l1') {
            sourceTier = ESCALATION_LEVEL.L1;
          } else if (sourceAgent.type.startsWith('l2') || sourceAgent.type === 'l2') {
            sourceTier = ESCALATION_LEVEL.L2;
          } else if (sourceAgent.type.startsWith('l3') || sourceAgent.type === 'l3') {
            sourceTier = ESCALATION_LEVEL.L3;
          }
        }
      }
      
      // Determine target tier if not specified
      let targetTier = options.targetTier;
      if (!targetTier && sourceTier) {
        targetTier = this._getNextTier(sourceTier);
      } else if (!targetTier) {
        // Default to L2 if source tier is unknown
        targetTier = ESCALATION_LEVEL.L2;
      }
      
      // For critical issues, escalate directly to Dad
      const isCritical = this._isIssueDirectDadEscalation(issue, options);
      if (isCritical) {
        targetTier = ESCALATION_LEVEL.DAD;
      }
      
      this.log.info(
        `Escalating issue from ${sourceTier || 'unknown'} to ${targetTier}${
          isCritical ? ' (CRITICAL)' : ''
        }`
      );
      
      // Handle Dad escalation
      if (targetTier === ESCALATION_LEVEL.DAD) {
        return this._escalateToDad(issue, {
          sourceAgentId: options.sourceAgentId,
          sourceTier,
          reason: options.reason || (isCritical ? ESCALATION_REASON.CRITICAL_IMPACT : ESCALATION_REASON.MANUAL_TRIGGER),
          metadata: options.metadata
        });
      }
      
      // Handle escalation to agent tiers
      return this._escalateToAgentTier(issue, {
        sourceAgentId: options.sourceAgentId,
        sourceTier,
        targetTier,
        reason: options.reason,
        metadata: options.metadata
      });
    } catch (error) {
      this.log.error('Error escalating issue', error);
      throw error;
    }
  }
  
  /**
   * Check if an issue should be directly escalated to Dad
   * @param {Object} issue - Issue to check
   * @param {Object} options - Escalation options
   * @returns {boolean} True if the issue should go directly to Dad
   * @private
   */
  _isIssueDirectDadEscalation(issue, options) {
    // Check if the reason is a critical reason
    const criticalReasons = [
      ESCALATION_REASON.CRITICAL_IMPACT,
      ESCALATION_REASON.REGULATORY_COMPLIANCE,
      ESCALATION_REASON.NOVEL_THREAT_VECTOR,
      ESCALATION_REASON.ORGANIZATIONAL_RISK,
      ESCALATION_REASON.LEGAL_LIABILITY,
      ESCALATION_REASON.ETHICAL_CONCERN
    ];
    
    if (options.reason && criticalReasons.includes(options.reason)) {
      return true;
    }
    
    // Check critical impact types
    if (
      issue.type && 
      this._thresholds.criticalImpactTypes.includes(issue.type)
    ) {
      return true;
    }
    
    // Check severity thresholds
    if (
      issue.severity !== undefined && 
      issue.severity >= this._thresholds.severity.l3_to_dad
    ) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Escalate an issue to Dad (human oversight)
   * @param {Object} issue - Issue to escalate
   * @param {Object} details - Escalation details
   * @returns {Promise<Object>} Escalation result
   * @private
   */
  async _escalateToDad(issue, details) {
    // Track the escalation
    const escalation = {
      id: utils.encryption.generateId(),
      issue,
      sourceAgentId: details.sourceAgentId,
      sourceTier: details.sourceTier || 'unknown',
      targetTier: ESCALATION_LEVEL.DAD,
      reason: details.reason || ESCALATION_REASON.MANUAL_TRIGGER,
      status: 'pending',
      metadata: details.metadata || {},
      timestamp: Date.now()
    };
    
    this._trackEscalation(escalation);
    
    // If we have a message bus, send a Dad notification
    if (this._messageBus) {
      this._messageBus.publishMessage({
        type: 'dad:notification',
        data: {
          escalationId: escalation.id,
          issue,
          sourceAgentId: details.sourceAgentId,
          sourceTier: details.sourceTier,
          reason: details.reason,
          metadata: details.metadata,
          priority: this._getDadEscalationPriority(issue, details),
          timestamp: Date.now()
        }
      });
    }
    
    // Send to oversight subsystem if available
    try {
      if (global.cipherGuard && global.cipherGuard.oversight) {
        await global.cipherGuard.oversight.notifyDad({
          escalationId: escalation.id,
          issue,
          sourceAgentId: details.sourceAgentId,
          sourceTier: details.sourceTier,
          reason: details.reason,
          metadata: details.metadata
        });
      }
    } catch (error) {
      this.log.error('Error notifying oversight subsystem', error);
    }
    
    return {
      success: true,
      escalationId: escalation.id,
      targetTier: ESCALATION_LEVEL.DAD,
      message: 'Escalated to Dad oversight'
    };
  }
  
  /**
   * Determine priority for Dad escalation
   * @param {Object} issue - The issue being escalated
   * @param {Object} details - Escalation details
   * @returns {string} Priority level (critical, high, medium, low)
   * @private
   */
  _getDadEscalationPriority(issue, details) {
    // Default to medium priority
    let priority = 'medium';
    
    // Check for critical reasons
    const criticalReasons = [
      ESCALATION_REASON.CRITICAL_IMPACT,
      ESCALATION_REASON.REGULATORY_COMPLIANCE,
      ESCALATION_REASON.LEGAL_LIABILITY
    ];
    
    if (details.reason && criticalReasons.includes(details.reason)) {
      return 'critical';
    }
    
    // Check impact types
    if (issue.type && this._thresholds.criticalImpactTypes.includes(issue.type)) {
      return 'critical';
    }
    
    // Check severity
    if (issue.severity !== undefined) {
      if (issue.severity >= 90) return 'critical';
      if (issue.severity >= 75) return 'high';
      if (issue.severity >= 50) return 'medium';
      return 'low';
    }
    
    // Check response time requirements
    if (issue.responseTimeRequired !== undefined) {
      if (issue.responseTimeRequired <= 30) return 'critical'; // 30 minutes
      if (issue.responseTimeRequired <= 120) return 'high';    // 2 hours
      if (issue.responseTimeRequired <= 480) return 'medium';  // 8 hours
      return 'low';
    }
    
    return priority;
  }
  
  /**
   * Escalate an issue to a specific agent tier
   * @param {Object} issue - Issue to escalate
   * @param {Object} details - Escalation details
   * @returns {Promise<Object>} Escalation result
   * @private
   */
  async _escalateToAgentTier(issue, details) {
    // Find suitable agents in the target tier
    const requiredCapabilities = details.metadata?.requiredCapabilities || [];
    
    const targetAgents = this._getSuitableAgentsForEscalation(
      details.targetTier,
      { capabilities: requiredCapabilities }
    );
    
    // If no suitable agents found, escalate to the next tier
    if (targetAgents.length === 0) {
      // Get the next tier
      const nextTier = this._getNextTier(details.targetTier);
      
      this.log.warn(
        `No suitable agents found in tier ${details.targetTier}, escalating to ${nextTier}`
      );
      
      // Escalate to the next tier
      return this.escalateIssue(issue, {
        ...details,
        sourceTier: details.targetTier,
        targetTier: nextTier,
        reason: ESCALATION_REASON.AGENT_CAPACITY_EXCEEDED
      });
    }
    
    // Track the escalation
    const escalation = {
      id: utils.encryption.generateId(),
      issue,
      sourceAgentId: details.sourceAgentId,
      sourceTier: details.sourceTier || 'unknown',
      targetTier: details.targetTier,
      reason: details.reason || ESCALATION_REASON.MANUAL_TRIGGER,
      status: 'pending',
      metadata: details.metadata || {},
      timestamp: Date.now()
    };
    
    this._trackEscalation(escalation);
    
    // Assign the issue to an agent
    let targetAgent = null;
    if (this._agentManager) {
      const assignedAgentId = await this._agentManager.distributeTask(
        {
          type: 'escalated_issue',
          data: {
            escalationId: escalation.id,
            issue,
            sourceAgentId: details.sourceAgentId,
            sourceTier: details.sourceTier,
            reason: details.reason,
            metadata: details.metadata
          }
        },
        {
          tier: details.targetTier,
          capabilities: requiredCapabilities,
          priority: this._getEscalationPriority(issue, details)
        }
      );
      
      if (assignedAgentId) {
        targetAgent = this._registry.getAgentById(assignedAgentId);
      }
    } else {
      // If no agent manager, just pick the first suitable agent
      targetAgent = targetAgents[0];
    }
    
    // If target agent found, update escalation status
    if (targetAgent) {
      // Update the escalation with the target agent
      escalation.targetAgentId = targetAgent.id;
      escalation.status = 'assigned';
      
      this.log.info(
        `Issue escalated from ${details.sourceTier || 'unknown'} to agent ${
          targetAgent.id
        } (${targetAgent.name}) in tier ${details.targetTier}`
      );
      
      // Emit event for assigned escalation
      this.emit('escalation:assigned', {
        escalationId: escalation.id,
        targetAgentId: targetAgent.id,
        targetAgentName: targetAgent.name
      });
      
      return {
        success: true,
        escalationId: escalation.id,
        targetTier: details.targetTier,
        targetAgentId: targetAgent.id,
        targetAgentName: targetAgent.name,
        message: `Escalated to ${details.targetTier} agent ${targetAgent.name}`
      };
    } else {
      // If no agent could be assigned, escalate to the next tier
      const nextTier = this._getNextTier(details.targetTier);
      
      this.log.warn(
        `Failed to assign issue to an agent in tier ${
          details.targetTier
        }, escalating to ${nextTier}`
      );
      
      // Escalate to the next tier
      return this.escalateIssue(issue, {
        ...details,
        sourceTier: details.targetTier,
        targetTier: nextTier,
        reason: ESCALATION_REASON.AGENT_CAPACITY_EXCEEDED
      });
    }
  }
  
  /**
   * Get priority level for an escalation
   * @param {Object} issue - Issue being escalated
   * @param {Object} details - Escalation details
   * @returns {number} Priority level (0-100)
   * @private
   */
  _getEscalationPriority(issue, details) {
    // Default to medium priority (50)
    let priority = 50;
    
    // If severity is defined, use it as the base priority
    if (issue.severity !== undefined) {
      priority = issue.severity;
    }
    
    // Adjust priority based on reason
    const highPriorityReasons = [
      ESCALATION_REASON.SEVERITY_THRESHOLD,
      ESCALATION_REASON.RESPONSE_TIME_CRITICAL,
      ESCALATION_REASON.CRITICAL_IMPACT
    ];
    
    if (details.reason && highPriorityReasons.includes(details.reason)) {
      // Increase priority for high priority reasons (but cap at 100)
      priority = Math.min(priority + 20, 100);
    }
    
    // Adjust for response time requirements
    if (issue.responseTimeRequired !== undefined) {
      // Response time in minutes - lower means higher priority
      if (issue.responseTimeRequired <= 30) { // 30 minutes
        priority = Math.max(priority, 80);
      } else if (issue.responseTimeRequired <= 120) { // 2 hours
        priority = Math.max(priority, 70);
      } else if (issue.responseTimeRequired <= 480) { // 8 hours
        priority = Math.max(priority, 60);
      }
    }
    
    return priority;
  }
  
  /**
   * Evaluate an issue to determine if it requires escalation
   * @param {Object} issue - Issue to evaluate
   * @param {string} currentTier - Current tier handling the issue
   * @returns {Object} Evaluation result with decision and reason
   */
  evaluateForEscalation(issue, currentTier) {
    // Default result - no escalation
    const result = {
      shouldEscalate: false,
      targetTier: null,
      reason: null
    };
    
    // Critical issues always escalate to Dad
    if (this._isIssueDirectDadEscalation(issue, {})) {
      result.shouldEscalate = true;
      result.targetTier = ESCALATION_LEVEL.DAD;
      result.reason = ESCALATION_REASON.CRITICAL_IMPACT;
      return result;
    }
    
    // Normalize the current tier
    const tier = currentTier.toLowerCase();
    
    // Check severity thresholds
    if (issue.severity !== undefined) {
      if (
        tier === ESCALATION_LEVEL.L1 && 
        issue.severity >= this._thresholds.severity.l1_to_l2
      ) {
        result.shouldEscalate = true;
        result.targetTier = ESCALATION_LEVEL.L2;
        result.reason = ESCALATION_REASON.SEVERITY_THRESHOLD;
      } else if (
        tier === ESCALATION_LEVEL.L2 && 
        issue.severity >= this._thresholds.severity.l2_to_l3
      ) {
        result.shouldEscalate = true;
        result.targetTier = ESCALATION_LEVEL.L3;
        result.reason = ESCALATION_REASON.SEVERITY_THRESHOLD;
      } else if (
        tier === ESCALATION_LEVEL.L3 && 
        issue.severity >= this._thresholds.severity.l3_to_dad
      ) {
        result.shouldEscalate = true;
        result.targetTier = ESCALATION_LEVEL.DAD;
        result.reason = ESCALATION_REASON.SEVERITY_THRESHOLD;
      }
    }
    
    // Check confidence thresholds (lower confidence means escalate)
    if (!result.shouldEscalate && issue.confidence !== undefined) {
      if (
        tier === ESCALATION_LEVEL.L1 && 
        issue.confidence <= this._thresholds.confidence.l1_to_l2
      ) {
        result.shouldEscalate = true;
        result.targetTier = ESCALATION_LEVEL.L2;
        result.reason = ESCALATION_REASON.CONFIDENCE_LOW;
      } else if (
        tier === ESCALATION_LEVEL.L2 && 
        issue.confidence <= this._thresholds.confidence.l2_to_l3
      ) {
        result.shouldEscalate = true;
        result.targetTier = ESCALATION_LEVEL.L3;
        result.reason = ESCALATION_REASON.CONFIDENCE_LOW;
      } else if (
        tier === ESCALATION_LEVEL.L3 && 
        issue.confidence <= this._thresholds.confidence.l3_to_dad
      ) {
        result.shouldEscalate = true;
        result.targetTier = ESCALATION_LEVEL.DAD;
        result.reason = ESCALATION_REASON.CONFIDENCE_LOW;
      }
    }
    
    // Check complexity thresholds
    if (!result.shouldEscalate && issue.complexity !== undefined) {
      if (
        tier === ESCALATION_LEVEL.L1 && 
        issue.complexity >= this._thresholds.complexity.l1_to_l2
      ) {
        result.shouldEscalate = true;
        result.targetTier = ESCALATION_LEVEL.L2;
        result.reason = ESCALATION_REASON.COMPLEXITY_HIGH;
      } else if (
        tier === ESCALATION_LEVEL.L2 && 
        issue.complexity >= this._thresholds.complexity.l2_to_l3
      ) {
        result.shouldEscalate = true;
        result.targetTier = ESCALATION_LEVEL.L3;
        result.reason = ESCALATION_REASON.COMPLEXITY_HIGH;
      } else if (
        tier === ESCALATION_LEVEL.L3 && 
        issue.complexity >= this._thresholds.complexity.l3_to_dad
      ) {
        result.shouldEscalate = true;
        result.targetTier = ESCALATION_LEVEL.DAD;
        result.reason = ESCALATION_REASON.COMPLEXITY_HIGH;
      }
    }
    
    // Check response time thresholds
    if (!result.shouldEscalate && issue.responseTimeRequired !== undefined) {
      // Response time is in minutes - lower means more urgent
      if (
        tier === ESCALATION_LEVEL.L1 && 
        issue.responseTimeRequired <= this._thresholds.responseTime.l1_to_l2
      ) {
        result.shouldEscalate = true;
        result.targetTier = ESCALATION_LEVEL.L2;
        result.reason = ESCALATION_REASON.RESPONSE_TIME_CRITICAL;
      } else if (
        tier === ESCALATION_LEVEL.L2 && 
        issue.responseTimeRequired <= this._thresholds.responseTime.l2_to_l3
      ) {
        result.shouldEscalate = true;
        result.targetTier = ESCALATION_LEVEL.L3;
        result.reason = ESCALATION_REASON.RESPONSE_TIME_CRITICAL;
      } else if (
        tier === ESCALATION_LEVEL.L3 && 
        issue.responseTimeRequired <= this._thresholds.responseTime.l3_to_dad
      ) {
        result.shouldEscalate = true;
        result.targetTier = ESCALATION_LEVEL.DAD;
        result.reason = ESCALATION_REASON.RESPONSE_TIME_CRITICAL;
      }
    }
    
    // Check for specialized expertise needed
    if (!result.shouldEscalate && issue.requiredCapabilities) {
      // If specific capabilities are needed, check if they're available at the current tier
      let hasRequiredCapabilities = false;
      
      if (this._registry) {
        const tierAgents = this._registry.getAgentsByTier(tier);
        
        hasRequiredCapabilities = tierAgents.some(agent => 
          issue.requiredCapabilities.every(capability => 
            agent.capabilities.includes(capability)
          )
        );
      }
      
      if (!hasRequiredCapabilities) {
        // If capabilities not available at current tier, escalate to next tier
        result.shouldEscalate = true;
        result.targetTier = this._getNextTier(tier);
        result.reason = ESCALATION_REASON.SPECIALIZED_EXPERTISE_NEEDED;
      }
    }
    
    return result;
  }
  
  /**
   * Get the escalation history
   * @param {Object} options - Filter options
   * @param {string} [options.sourceTier] - Filter by source tier
   * @param {string} [options.targetTier] - Filter by target tier
   * @param {string} [options.status] - Filter by status
   * @param {number} [options.limit=50] - Maximum number of entries to return
   * @returns {Array} Filtered escalation history
   */
  getEscalationHistory(options = {}) {
    let history = [...this._escalations];
    
    // Apply filters
    if (options.sourceTier) {
      history = history.filter(e => e.sourceTier === options.sourceTier);
    }
    
    if (options.targetTier) {
      history = history.filter(e => e.targetTier === options.targetTier);
    }
    
    if (options.status) {
      history = history.filter(e => e.status === options.status);
    }
    
    // Sort by timestamp (newest first)
    history.sort((a, b) => b.timestamp - a.timestamp);
    
    // Apply limit
    const limit = options.limit || 50;
    return history.slice(0, limit);
  }
  
  /**
   * Get details for a specific escalation
   * @param {string} escalationId - ID of the escalation
   * @returns {Object|null} Escalation details or null if not found
   */
  getEscalationById(escalationId) {
    return this._escalations.find(e => e.id === escalationId) || null;
  }
  
  /**
   * Update the status of an escalation
   * @param {string} escalationId - ID of the escalation to update
   * @param {Object} updates - Updates to apply
   * @returns {boolean} Whether the update was successful
   */
  updateEscalationStatus(escalationId, updates) {
    const idx = this._escalations.findIndex(e => e.id === escalationId);
    if (idx === -1) {
      this.log.warn(`Cannot update escalation ${escalationId}: not found`);
      return false;
    }
    
    // Apply updates
    this._escalations[idx] = {
      ...this._escalations[idx],
      ...updates,
      lastUpdated: Date.now()
    };
    
    // Emit update event
    this.emit('escalation:updated', {
      escalationId,
      updates
    });
    
    return true;
  }
}

module.exports = {
  EscalationManager,
  ESCALATION_LEVEL,
  ESCALATION_REASON
};