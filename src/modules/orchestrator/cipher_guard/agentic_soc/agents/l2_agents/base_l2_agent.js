/**
 * Base L2 Agent
 * 
 * This module defines the base class for L2 (tier 2) agents in the Agentic SOC.
 * L2 agents specialize in investigation and response, handling issues that have
 * been escalated from L1 agents or require deeper analysis.
 */

const { Agent, AGENT_STATUS } = require('../index');
const utils = require('../../utils');
const { ESCALATION_REASON } = require('../escalation_manager');

/**
 * Standard L2 agent capabilities
 * @type {Array<string>}
 */
const L2_CAPABILITIES = [
  'investigation',
  'response',
  'threat_analysis',
  'correlation',
  'root_cause_analysis',
  'incident_management',
  'threat_intelligence',
  'asset_management',
  'forensic_analysis',
  'remediation_planning',
  'vulnerability_assessment'
];

/**
 * Base L2 Agent class
 * @class BaseL2Agent
 * @extends Agent
 */
class BaseL2Agent extends Agent {
  /**
   * Create a new BaseL2Agent
   * @param {Object} config - Agent configuration
   * @param {Object} messageBus - System message bus
   */
  constructor(config = {}, messageBus = null) {
    // Add standard L2 capabilities to any provided capabilities
    const l2Config = { 
      ...config,
      type: config.type || 'l2',
      tier: 'l2',
      capabilities: [
        ...(config.capabilities || []),
        ...L2_CAPABILITIES
      ]
    };
    
    super(l2Config, messageBus);
    
    // L2 agent specific properties
    this._escalationThresholds = {
      severity: config.escalationThresholds?.severity || 75,
      confidence: config.escalationThresholds?.confidence || 30,
      complexity: config.escalationThresholds?.complexity || 75,
      responseTime: config.escalationThresholds?.responseTime || 60
    };
    
    // Investigation metrics
    this._investigationMetrics = {
      incidentsInvestigated: 0,
      incidentsEscalated: 0,
      incidentsResolved: 0,
      avgInvestigationTime: 0,
      totalInvestigationTime: 0,
      remediationActions: 0
    };
    
    // Response action history
    this._responseActions = [];
    
    // Event correlation database
    this._eventCorrelation = {
      recentEvents: [],      // Cache of recent events for correlation
      maxEventHistory: 1000, // Maximum number of events to keep in memory
      correlationRules: []   // Rules for correlating events
    };
    
    // Threat intelligence data
    this._threatIntelligence = config.threatIntelligence || {};
    
    // Initialize event subscriptions
    this._initializeEventSubscriptions();
  }
  
  /**
   * Initialize L2 agent specific event subscriptions
   * @private
   */
  _initializeEventSubscriptions() {
    if (this._messageBus) {
      // Subscribe to relevant L2 message types
      this._subscriptions = [
        this.subscribeToMessages('escalation:l2', this._handleEscalation.bind(this)),
        this.subscribeToMessages('incident:update', this._handleIncidentUpdate.bind(this)),
        this.subscribeToMessages('threat:intelligence', this._handleThreatIntelUpdate.bind(this)),
        this.subscribeToMessages('response:feedback', this._handleResponseFeedback.bind(this))
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
    
    // L2 agent specific initialization
    this.log.info('Initializing L2 agent specific components');
    
    try {
      // Load correlation rules if needed
      if (options.loadCorrelationRules && this._eventCorrelation.correlationRules.length === 0) {
        await this._loadCorrelationRules();
      }
      
      // Load threat intelligence if needed
      if (options.loadThreatIntelligence && Object.keys(this._threatIntelligence).length === 0) {
        await this._loadThreatIntelligence();
      }
      
      this.log.info('L2 agent initialization complete');
    } catch (error) {
      this.log.error('Error during L2 agent initialization', error);
      throw error;
    }
  }
  
  /**
   * Load correlation rules
   * @returns {Promise<void>}
   * @private
   */
  async _loadCorrelationRules() {
    try {
      // In a real implementation, these rules would be loaded from a database,
      // file system, or external service
      this.log.info('Loading correlation rules');
      
      // Example implementation
      this._eventCorrelation.correlationRules = [
        {
          id: 'multi-system-auth-failure',
          description: 'Multiple authentication failures across different systems',
          conditions: {
            eventTypes: ['authentication_failure'],
            minOccurrences: 3,
            timeWindow: 300, // 5 min
            acrossSystems: true
          },
          severity: 75,
          confidence: 70
        },
        {
          id: 'lateral-movement',
          description: 'Potential lateral movement detection',
          conditions: {
            sequence: ['authentication_success', 'privilege_escalation', 'unusual_access'],
            maxTimeSpan: 900, // 15 min
            sameActor: true
          },
          severity: 85,
          confidence: 65
        }
      ];
      
      this.log.info(`Loaded ${this._eventCorrelation.correlationRules.length} correlation rules`);
    } catch (error) {
      this.log.error('Failed to load correlation rules', error);
      throw error;
    }
  }
  
  /**
   * Load threat intelligence data
   * @returns {Promise<void>}
   * @private
   */
  async _loadThreatIntelligence() {
    try {
      // In a real implementation, this would be loaded from a threat intel platform
      this.log.info('Loading threat intelligence data');
      
      // Example implementation
      this._threatIntelligence = {
        iocs: [ /* Indicators of compromise */ ],
        ttps: [ /* Tactics, techniques, and procedures */ ],
        threatActors: [ /* Known threat actors */ ],
        lastUpdated: Date.now()
      };
      
      this.log.info('Threat intelligence data loaded');
    } catch (error) {
      this.log.error('Failed to load threat intelligence data', error);
      throw error;
    }
  }
  
  /**
   * Handle escalations from L1
   * @param {Object} message - Escalation message
   * @private
   */
  _handleEscalation(message) {
    try {
      const escalation = message.data;
      
      this.log.info(`Received escalation: ${escalation.id} from ${escalation.sourceAgentId}`);
      
      // Add the escalation as a task to be processed
      this.addTask({
        data: {
          type: 'escalated_issue',
          escalation
        },
        priority: this._determineEscalationPriority(escalation)
      });
    } catch (error) {
      this.log.error('Error handling escalation', error);
    }
  }
  
  /**
   * Handle incident updates
   * @param {Object} message - Incident update message
   * @private
   */
  _handleIncidentUpdate(message) {
    try {
      const update = message.data;
      
      this.log.debug(`Received incident update: ${update.incidentId} - ${update.updateType}`);
      
      // Store the update for correlation
      this._storeEventForCorrelation({
        type: 'incident_update',
        incidentId: update.incidentId,
        updateType: update.updateType,
        data: update,
        timestamp: update.timestamp || Date.now()
      });
      
      // Only add as a task if it's relevant to this agent
      if (update.assignedAgentId === this.id || update.relevantAgentIds?.includes(this.id)) {
        this.addTask({
          data: {
            type: 'incident_update',
            update
          },
          priority: update.priority || 50
        });
      }
    } catch (error) {
      this.log.error('Error handling incident update', error);
    }
  }
  
  /**
   * Handle threat intelligence updates
   * @param {Object} message - Threat intelligence update message
   * @private
   */
  _handleThreatIntelUpdate(message) {
    try {
      const update = message.data;
      
      this.log.debug(`Received threat intelligence update: ${update.id} - ${update.type}`);
      
      // Update the threat intelligence data
      this._updateThreatIntelligence(update);
      
      // Add as a task if it requires analysis
      if (update.requiresAnalysis) {
        this.addTask({
          data: {
            type: 'threat_intel_update',
            update
          },
          priority: update.priority || 40
        });
      }
    } catch (error) {
      this.log.error('Error handling threat intelligence update', error);
    }
  }
  
  /**
   * Handle response action feedback
   * @param {Object} message - Response feedback message
   * @private
   */
  _handleResponseFeedback(message) {
    try {
      const feedback = message.data;
      
      this.log.info(`Received response feedback for action: ${feedback.actionId}`);
      
      // Update the corresponding response action
      const actionIndex = this._responseActions.findIndex(a => a.id === feedback.actionId);
      if (actionIndex !== -1) {
        this._responseActions[actionIndex].feedback = feedback;
        this._responseActions[actionIndex].success = feedback.success;
        this._responseActions[actionIndex].lastUpdated = Date.now();
      }
      
      // Add as a task if it requires follow-up
      if (feedback.requiresFollowup) {
        this.addTask({
          data: {
            type: 'response_feedback',
            feedback
          },
          priority: feedback.priority || 60
        });
      }
    } catch (error) {
      this.log.error('Error handling response feedback', error);
    }
  }
  
  /**
   * Update threat intelligence data
   * @param {Object} update - Threat intelligence update
   * @private
   */
  _updateThreatIntelligence(update) {
    try {
      // Update the specific aspect of threat intelligence
      switch (update.type) {
        case 'ioc':
          if (!this._threatIntelligence.iocs) {
            this._threatIntelligence.iocs = [];
          }
          
          // Update existing or add new
          const iocIndex = this._threatIntelligence.iocs.findIndex(i => i.id === update.data.id);
          if (iocIndex !== -1) {
            this._threatIntelligence.iocs[iocIndex] = update.data;
          } else {
            this._threatIntelligence.iocs.push(update.data);
          }
          break;
          
        case 'ttp':
          if (!this._threatIntelligence.ttps) {
            this._threatIntelligence.ttps = [];
          }
          
          const ttpIndex = this._threatIntelligence.ttps.findIndex(t => t.id === update.data.id);
          if (ttpIndex !== -1) {
            this._threatIntelligence.ttps[ttpIndex] = update.data;
          } else {
            this._threatIntelligence.ttps.push(update.data);
          }
          break;
          
        case 'threat_actor':
          if (!this._threatIntelligence.threatActors) {
            this._threatIntelligence.threatActors = [];
          }
          
          const actorIndex = this._threatIntelligence.threatActors.findIndex(a => a.id === update.data.id);
          if (actorIndex !== -1) {
            this._threatIntelligence.threatActors[actorIndex] = update.data;
          } else {
            this._threatIntelligence.threatActors.push(update.data);
          }
          break;
          
        case 'full_update':
          // Replace the entire threat intelligence data
          this._threatIntelligence = update.data;
          break;
      }
      
      // Update timestamp
      this._threatIntelligence.lastUpdated = Date.now();
    } catch (error) {
      this.log.error('Error updating threat intelligence', error);
    }
  }
  
  /**
   * Store an event for correlation
   * @param {Object} event - Event to store
   * @private
   */
  _storeEventForCorrelation(event) {
    try {
      // Add the event to recent events
      this._eventCorrelation.recentEvents.push(event);
      
      // Keep only the maximum number of events
      if (this._eventCorrelation.recentEvents.length > this._eventCorrelation.maxEventHistory) {
        this._eventCorrelation.recentEvents.shift();
      }
      
      // Check for correlations
      this._checkEventCorrelations(event);
    } catch (error) {
      this.log.error('Error storing event for correlation', error);
    }
  }
  
  /**
   * Check for event correlations
   * @param {Object} newEvent - New event to check for correlations
   * @private
   */
  _checkEventCorrelations(newEvent) {
    try {
      this.log.debug(`Checking correlations for event: ${newEvent.type}`);
      
      const correlatedEvents = [];
      
      // Check each correlation rule
      for (const rule of this._eventCorrelation.correlationRules) {
        // Skip if the rule doesn't apply to this event type
        if (
          rule.conditions.eventTypes && 
          !rule.conditions.eventTypes.includes(newEvent.type)
        ) {
          continue;
        }
        
        let matches = false;
        
        // Check for multiple occurrences
        if (rule.conditions.minOccurrences) {
          const timeWindow = rule.conditions.timeWindow || 3600; // 1 hour default
          const cutoffTime = Date.now() - (timeWindow * 1000);
          
          // Count matching events in the time window
          const matchingEvents = this._eventCorrelation.recentEvents.filter(event => 
            event.timestamp >= cutoffTime &&
            (
              !rule.conditions.eventTypes || 
              rule.conditions.eventTypes.includes(event.type)
            ) &&
            (
              !rule.conditions.acrossSystems || 
              this._areEventsAcrossSystems(this._eventCorrelation.recentEvents)
            )
          );
          
          matches = matchingEvents.length >= rule.conditions.minOccurrences;
          
          if (matches) {
            correlatedEvents.push({
              rule,
              events: matchingEvents,
              type: 'frequency',
              timestamp: Date.now()
            });
          }
        }
        
        // Check for event sequences
        if (rule.conditions.sequence && !matches) {
          const maxTimeSpan = rule.conditions.maxTimeSpan || 3600; // 1 hour default
          const cutoffTime = Date.now() - (maxTimeSpan * 1000);
          
          const sequenceMatches = this._checkEventSequence(
            rule.conditions.sequence,
            cutoffTime,
            rule.conditions.sameActor
          );
          
          if (sequenceMatches.matched) {
            correlatedEvents.push({
              rule,
              events: sequenceMatches.events,
              type: 'sequence',
              timestamp: Date.now()
            });
          }
        }
      }
      
      // Process any correlations found
      for (const correlation of correlatedEvents) {
        this.log.info(`Found correlation: ${correlation.rule.id} with ${correlation.events.length} events`);
        
        // Create a correlation incident
        const correlationIncident = {
          id: utils.encryption.generateId(),
          type: 'correlation',
          ruleId: correlation.rule.id,
          description: correlation.rule.description,
          events: correlation.events,
          severity: correlation.rule.severity,
          confidence: correlation.rule.confidence,
          timestamp: Date.now(),
          status: 'detected'
        };
        
        // Add as a task to be investigated
        this.addTask({
          data: {
            type: 'correlation_incident',
            incident: correlationIncident
          },
          priority: this._determineCorrelationPriority(correlationIncident)
        });
        
        // Publish the correlation finding
        if (this._messageBus) {
          this._messageBus.publishMessage({
            type: 'correlation:detected',
            data: correlationIncident
          });
        }
        
        // Report metrics
        utils.metrics.increment(`agent.${this.id}.correlations_detected`, 1, {
          ruleId: correlation.rule.id,
          correlationType: correlation.type
        });
      }
    } catch (error) {
      this.log.error('Error checking event correlations', error);
    }
  }
  
  /**
   * Check if events are across different systems
   * @param {Array} events - Events to check
   * @returns {boolean} True if events are across different systems
   * @private
   */
  _areEventsAcrossSystems(events) {
    const systems = new Set();
    
    for (const event of events) {
      if (event.system) {
        systems.add(event.system);
      } else if (event.data && event.data.system) {
        systems.add(event.data.system);
      }
    }
    
    return systems.size > 1;
  }
  
  /**
   * Check for event sequences
   * @param {Array} sequence - Sequence of event types to look for
   * @param {number} cutoffTime - Timestamp to start looking from
   * @param {boolean} sameActor - Whether events must have same actor
   * @returns {Object} Matching result
   * @private
   */
  _checkEventSequence(sequence, cutoffTime, sameActor) {
    // Filter events within time window
    const relevantEvents = this._eventCorrelation.recentEvents.filter(e => e.timestamp >= cutoffTime);
    
    // Sort by timestamp (oldest first)
    relevantEvents.sort((a, b) => a.timestamp - b.timestamp);
    
    let sequenceIndex = 0;
    const matchedEvents = [];
    let actor = null;
    
    for (const event of relevantEvents) {
      // Skip if actor constraint is violated
      if (sameActor && actor !== null) {
        const eventActor = event.actor || (event.data && event.data.actor);
        if (eventActor !== actor) {
          continue;
        }
      }
      
      // Check if event matches current sequence step
      if (event.type === sequence[sequenceIndex]) {
        // First match - record the actor if needed
        if (sequenceIndex === 0 && sameActor) {
          actor = event.actor || (event.data && event.data.actor);
        }
        
        matchedEvents.push(event);
        sequenceIndex++;
        
        // Check if we've matched the entire sequence
        if (sequenceIndex === sequence.length) {
          return { matched: true, events: matchedEvents };
        }
      }
    }
    
    return { matched: false, events: [] };
  }
  
  /**
   * Determine escalation priority
   * @param {Object} escalation - Escalation to evaluate
   * @returns {number} Priority (0-100)
   * @private
   */
  _determineEscalationPriority(escalation) {
    // Priority calculation based on escalation properties
    let priority = escalation.severity || 50;
    
    // Adjust for source tier
    if (escalation.sourceTier === 'l1') {
      priority = Math.max(priority, 60); // L1 escalations are at least medium priority
    }
    
    // Adjust for escalation reason
    switch (escalation.reason) {
      case ESCALATION_REASON.SEVERITY_THRESHOLD:
      case ESCALATION_REASON.RESPONSE_TIME_CRITICAL:
      case ESCALATION_REASON.CRITICAL_IMPACT:
        priority += 20; // High priority reasons
        break;
      case ESCALATION_REASON.COMPLEXITY_HIGH:
      case ESCALATION_REASON.SPECIALIZED_EXPERTISE_NEEDED:
        priority += 10; // Medium priority reasons
        break;
    }
    
    return Math.min(priority, 100);
  }
  
  /**
   * Determine correlation incident priority
   * @param {Object} incident - Correlation incident to evaluate
   * @returns {number} Priority (0-100)
   * @private
   */
  _determineCorrelationPriority(incident) {
    // Base on incident severity
    let priority = incident.severity || 50;
    
    // Correlations are usually important
    priority = Math.max(priority, 60);
    
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
        case 'escalated_issue':
          result = await this._processEscalatedIssue(data.escalation);
          break;
        case 'correlation_incident':
          result = await this._processCorrelationIncident(data.incident);
          break;
        case 'incident_update':
          result = await this._processIncidentUpdate(data.update);
          break;
        case 'threat_intel_update':
          result = await this._processThreatIntelUpdate(data.update);
          break;
        case 'response_feedback':
          result = await this._processResponseFeedback(data.feedback);
          break;
        default:
          result = await this._processGenericData(data);
      }
      
      // Update investigation metrics
      this._investigationMetrics.incidentsInvestigated++;
      this._investigationMetrics.totalInvestigationTime += (Date.now() - startTime);
      this._investigationMetrics.avgInvestigationTime = 
        this._investigationMetrics.totalInvestigationTime / this._investigationMetrics.incidentsInvestigated;
      
      // Report metrics
      utils.metrics.gauge(`agent.${this.id}.investigation_time_ms`, Date.now() - startTime);
      utils.metrics.increment(`agent.${this.id}.items_processed`, 1, { type: data.type });
      
      return result;
    } catch (error) {
      this.log.error(`Error processing ${data.type} data`, error);
      throw error;
    }
  }
  
  /**
   * Process an escalated issue
   * @param {Object} escalation - Escalation to process
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processEscalatedIssue(escalation) {
    this.log.info(`Processing escalated issue: ${escalation.id} from ${escalation.sourceAgentId}`);
    
    // Store the event for correlation
    this._storeEventForCorrelation({
      type: 'escalated_issue',
      escalationId: escalation.id,
      sourceTier: escalation.sourceTier,
      sourceAgentId: escalation.sourceAgentId,
      reason: escalation.reason,
      severity: escalation.severity,
      data: escalation,
      timestamp: Date.now()
    });
    
    // Investigate the escalated issue
    const investigation = await this.investigate(escalation);
    
    // Check if the issue needs to be escalated further
    if (this._shouldEscalate(investigation)) {
      await this._escalateInvestigationResult(investigation, escalation);
      
      // Update metrics
      this._investigationMetrics.incidentsEscalated++;
      
      return {
        status: 'escalated',
        investigation
      };
    }
    
    // If not escalated, plan and execute response actions
    const responseActions = await this.planResponse(investigation, escalation);
    const executionResults = await this.executeResponse(responseActions);
    
    // Update metrics
    this._investigationMetrics.incidentsResolved++;
    this._investigationMetrics.remediationActions += responseActions.length;
    
    // Generate report
    const report = await this.generateIncidentReport(
      investigation, 
      responseActions, 
      executionResults
    );
    
    return {
      status: 'resolved',
      investigation,
      responseActions,
      executionResults,
      report
    };
  }
  
  /**
   * Process a correlation incident
   * @param {Object} incident - Correlation incident to process
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processCorrelationIncident(incident) {
    this.log.info(`Processing correlation incident: ${incident.id} - ${incident.ruleId}`);
    
    // This function would be similar to _processEscalatedIssue
    // but with correlation-specific logic
    return await this._processEscalatedIssue({
      id: incident.id,
      sourceAgentId: this.id,
      sourceTier: 'l2',
      reason: 'correlation_detection',
      severity: incident.severity,
      confidence: incident.confidence,
      issue: incident
    });
  }
  
  /**
   * Process an incident update
   * @param {Object} update - Incident update to process
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processIncidentUpdate(update) {
    this.log.info(`Processing incident update: ${update.incidentId} - ${update.updateType}`);
    
    // Handle the incident update based on type
    switch (update.updateType) {
      case 'new_evidence':
        return await this._processNewEvidence(update);
      case 'status_change':
        return await this._processStatusChange(update);
      default:
        return {
          status: 'acknowledged',
          message: `Update type ${update.updateType} doesn't require processing`
        };
    }
  }
  
  /**
   * Process new evidence
   * @param {Object} update - New evidence update
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processNewEvidence(update) {
    // Re-analyze the incident with new evidence
    const analysisResult = await this.analyze({
      type: 'incident_evidence',
      incidentId: update.incidentId,
      evidence: update.evidence
    });
    
    // Return the analysis result
    return {
      status: 'processed',
      analysisResult
    };
  }
  
  /**
   * Process incident status change
   * @param {Object} update - Status change update
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processStatusChange(update) {
    // Process based on the new status
    switch (update.newStatus) {
      case 'closed':
        // Perform cleanup actions
        return {
          status: 'processed',
          message: `Incident ${update.incidentId} has been closed`
        };
      case 'reopened':
        // Re-analyze the incident
        return {
          status: 'reanalysis_initiated',
          message: `Incident ${update.incidentId} has been reopened for analysis`
        };
      default:
        return {
          status: 'acknowledged',
          message: `Status changed to ${update.newStatus} for incident ${update.incidentId}`
        };
    }
  }
  
  /**
   * Process a threat intelligence update
   * @param {Object} update - Threat intelligence update
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processThreatIntelUpdate(update) {
    this.log.info(`Processing threat intel update: ${update.id} - ${update.type}`);
    
    // Update the threat intelligence database
    this._updateThreatIntelligence(update);
    
    // Check for matches against active incidents
    const matches = await this._checkThreatIntelMatches(update);
    
    // Return the processing result
    return {
      status: 'processed',
      matches
    };
  }
  
  /**
   * Check for matches between threat intelligence and active incidents
   * @param {Object} update - Threat intelligence update
   * @returns {Promise<Array>} Matching incidents
   * @private
   */
  async _checkThreatIntelMatches(update) {
    // This would contain logic to compare threat intelligence indicators
    // against active incidents to find matches
    return [];
  }
  
  /**
   * Process response feedback
   * @param {Object} feedback - Response feedback
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processResponseFeedback(feedback) {
    this.log.info(`Processing response feedback for action: ${feedback.actionId}`);
    
    // Update the response action record
    const actionIndex = this._responseActions.findIndex(a => a.id === feedback.actionId);
    
    if (actionIndex !== -1) {
      this._responseActions[actionIndex].feedback = feedback;
      this._responseActions[actionIndex].success = feedback.success;
      this._responseActions[actionIndex].lastUpdated = Date.now();
      
      // If the action failed, plan an alternative response
      if (!feedback.success && feedback.requiresAlternative) {
        const alternativeAction = await this.planAlternativeResponse(
          this._responseActions[actionIndex],
          feedback
        );
        
        if (alternativeAction) {
          // Execute the alternative action
          const executionResult = await this.executeResponse([alternativeAction]);
          
          return {
            status: 'alternative_executed',
            originalAction: this._responseActions[actionIndex],
            feedback,
            alternativeAction,
            executionResult
          };
        }
      }
    }
    
    return {
      status: 'processed',
      actionUpdated: actionIndex !== -1,
      feedback
    };
  }
  
  /**
   * Process generic data
   * @param {Object} data - Generic data to process
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
    
    return {
      status: 'analyzed',
      analysisResult
    };
  }
  
  /**
   * Check if a result should be escalated to L3
   * @param {Object} result - Investigation or analysis result
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
    
    // Check if capabilities required for resolution are beyond L2
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
   * Escalate an investigation result
   * @param {Object} investigation - Investigation result to escalate
   * @param {Object} originalData - Original data that was investigated
   * @returns {Promise<void>}
   * @private
   */
  async _escalateInvestigationResult(investigation, originalData) {
    // Determine escalation reason
    let escalationReason = ESCALATION_REASON.MANUAL_TRIGGER;
    
    if (investigation.severity && investigation.severity >= this._escalationThresholds.severity) {
      escalationReason = ESCALATION_REASON.SEVERITY_THRESHOLD;
    } else if (
      investigation.confidence !== undefined && 
      investigation.confidence <= this._escalationThresholds.confidence
    ) {
      escalationReason = ESCALATION_REASON.CONFIDENCE_LOW;
    } else if (
      investigation.complexity && 
      investigation.complexity >= this._escalationThresholds.complexity
    ) {
      escalationReason = ESCALATION_REASON.COMPLEXITY_HIGH;
    } else if (
      investigation.responseTimeRequired && 
      investigation.responseTimeRequired <= this._escalationThresholds.responseTime
    ) {
      escalationReason = ESCALATION_REASON.RESPONSE_TIME_CRITICAL;
    } else if (
      investigation.requiredCapabilities && 
      investigation.requiredCapabilities.some(cap => !this._capabilities.includes(cap))
    ) {
      escalationReason = ESCALATION_REASON.SPECIALIZED_EXPERTISE_NEEDED;
    }
    
    // Create escalation issue
    const escalationIssue = {
      id: utils.encryption.generateId(),
      type: investigation.type || 'unknown',
      source: originalData.source || 'unknown',
      sourceData: originalData,
      investigation,
      severity: investigation.severity || 50,
      confidence: investigation.confidence,
      complexity: investigation.complexity,
      responseTimeRequired: investigation.responseTimeRequired,
      requiredCapabilities: investigation.requiredCapabilities,
      timestamp: Date.now()
    };
    
    // Perform the escalation
    await this.escalate(escalationIssue, 'l3');
    
    this.log.info(`Escalated ${investigation.type} to L3 tier. Reason: ${escalationReason}`);
    
    // Report metrics
    utils.metrics.increment(`agent.${this.id}.escalations`, 1, { 
      type: investigation.type,
      reason: escalationReason
    });
  }
  
  /**
   * Investigate an issue
   * @param {Object} issue - Issue to investigate
   * @returns {Promise<Object>} Investigation result
   */
  async investigate(issue) {
    try {
      this.log.info(`Investigating issue: ${issue.id}`);
      
      // Basic investigation implementation - to be overridden in specific L2 agent subclasses
      const investigation = {
        id: utils.encryption.generateId(),
        originalIssue: issue,
        findings: [],
        timestamp: Date.now()
      };
      
      // Extract or determine severity
      investigation.severity = issue.severity || 50;
      
      // Extract or determine confidence
      investigation.confidence = issue.confidence || 60;
      
      // Extract or determine complexity
      investigation.complexity = issue.complexity || 40;
      
      // Check for matches in threat intelligence
      const threatIntelMatches = await this._checkThreatIntelligence(issue);
      if (threatIntelMatches.length > 0) {
        investigation.findings.push({
          type: 'threat_intel_match',
          matches: threatIntelMatches,
          timestamp: Date.now()
        });
        
        // Adjust severity based on threat intel matches
        investigation.severity = Math.max(investigation.severity, 70);
      }
      
      // Perform root cause analysis
      const rootCause = await this._analyzeRootCause(issue);
      if (rootCause) {
        investigation.findings.push({
          type: 'root_cause_analysis',
          rootCause,
          timestamp: Date.now()
        });
        
        // Add the root cause to the investigation
        investigation.rootCause = rootCause;
      }
      
      // Find related incidents
      const relatedIncidents = await this._findRelatedIncidents(issue);
      if (relatedIncidents.length > 0) {
        investigation.findings.push({
          type: 'related_incidents',
          incidents: relatedIncidents,
          timestamp: Date.now()
        });
        
        // Add related incidents to the investigation
        investigation.relatedIncidents = relatedIncidents;
      }
      
      return investigation;
    } catch (error) {
      this.log.error(`Error investigating issue: ${issue.id}`, error);
      throw error;
    }
  }
  
  /**
   * Check threat intelligence for matches
   * @param {Object} issue - Issue to check
   * @returns {Promise<Array>} Matching threat intelligence
   * @private
   */
  async _checkThreatIntelligence(issue) {
    // This would contain logic to check for matches in threat intelligence data
    return [];
  }
  
  /**
   * Analyze root cause of an issue
   * @param {Object} issue - Issue to analyze
   * @returns {Promise<Object>} Root cause analysis
   * @private
   */
  async _analyzeRootCause(issue) {
    // This would contain logic to determine the root cause of an issue
    return null;
  }
  
  /**
   * Find incidents related to an issue
   * @param {Object} issue - Issue to find related incidents for
   * @returns {Promise<Array>} Related incidents
   * @private
   */
  async _findRelatedIncidents(issue) {
    // This would contain logic to find related incidents
    return [];
  }
  
  /**
   * Plan a response to an issue
   * @param {Object} investigation - Investigation results
   * @param {Object} issue - Original issue
   * @returns {Promise<Array>} Planned response actions
   */
  async planResponse(investigation, issue) {
    try {
      this.log.info(`Planning response for issue: ${issue.id}`);
      
      // Basic response planning - to be overridden in specific L2 agent subclasses
      const responseActions = [];
      
      // Example action: Create an escalation in SOAR platform if severity is high
      if (investigation.severity >= 70) {
        responseActions.push({
          id: utils.encryption.generateId(),
          type: 'soar_escalation',
          system: 'soar_platform',
          details: {
            title: `High severity incident: ${investigation.type || 'Unknown'}`,
            description: `Automated escalation from Cipher Guard L2 agent ${this.name}`,
            severity: investigation.severity,
            data: investigation
          },
          status: 'planned',
          timestamp: Date.now()
        });
      }
      
      // Example action: Block an IP if found in the incident
      if (issue.sourceIp) {
        responseActions.push({
          id: utils.encryption.generateId(),
          type: 'block_ip',
          system: 'firewall',
          details: {
            ip: issue.sourceIp,
            reason: `Blocked due to security incident ${issue.id}`,
            duration: '24h' // 24 hours temporary block
          },
          status: 'planned',
          timestamp: Date.now()
        });
      }
      
      return responseActions;
    } catch (error) {
      this.log.error(`Error planning response for issue: ${issue.id}`, error);
      throw error;
    }
  }
  
  /**
   * Plan an alternative response action
   * @param {Object} originalAction - Original action that failed
   * @param {Object} feedback - Feedback on the failed action
   * @returns {Promise<Object>} Alternative action
   */
  async planAlternativeResponse(originalAction, feedback) {
    try {
      this.log.info(`Planning alternative to failed action: ${originalAction.id}`);
      
      // Basic alternative planning - to be overridden in specific L2 agent subclasses
      // This is just a placeholder implementation
      
      // Create an alternative action based on the original
      const alternativeAction = {
        id: utils.encryption.generateId(),
        type: originalAction.type,
        system: originalAction.system,
        details: { ...originalAction.details },
        status: 'planned',
        isAlternativeTo: originalAction.id,
        timestamp: Date.now()
      };
      
      // Modify the details based on the failure
      switch (originalAction.type) {
        case 'block_ip':
          // If IP blocking failed, try a different security control
          alternativeAction.type = 'watchlist_ip';
          alternativeAction.system = 'siem';
          break;
          
        case 'soar_escalation':
          // If SOAR escalation failed, try a direct notification
          alternativeAction.type = 'email_notification';
          alternativeAction.system = 'notification_system';
          break;
      }
      
      return alternativeAction;
    } catch (error) {
      this.log.error(`Error planning alternative response`, error);
      return null;
    }
  }
  
  /**
   * Execute response actions
   * @param {Array} actions - Response actions to execute
   * @returns {Promise<Array>} Execution results
   */
  async executeResponse(actions) {
    try {
      this.log.info(`Executing ${actions.length} response actions`);
      
      const results = [];
      
      for (const action of actions) {
        try {
          this.log.info(`Executing action: ${action.id} (${action.type})`);
          
          // Track the action
          this._responseActions.push(action);
          
          // Update action status
          action.status = 'executing';
          action.executionStartTime = Date.now();
          
          // Execute the action (placeholder - actual implementation would vary)
          let executionResult = null;
          
          switch (action.type) {
            case 'soar_escalation':
              executionResult = await this._executeSoarEscalation(action);
              break;
            case 'block_ip':
              executionResult = await this._executeBlockIp(action);
              break;
            case 'watchlist_ip':
              executionResult = await this._executeWatchlistIp(action);
              break;
            case 'email_notification':
              executionResult = await this._executeEmailNotification(action);
              break;
            default:
              executionResult = {
                success: false,
                message: `Unsupported action type: ${action.type}`
              };
          }
          
          // Update action with results
          action.status = executionResult.success ? 'completed' : 'failed';
          action.result = executionResult;
          action.executionEndTime = Date.now();
          action.executionTime = action.executionEndTime - action.executionStartTime;
          
          // Add to results
          results.push({
            actionId: action.id,
            actionType: action.type,
            success: executionResult.success,
            message: executionResult.message,
            executionTime: action.executionTime
          });
          
          // Report metrics
          utils.metrics.increment(`agent.${this.id}.response_actions`, 1, {
            actionType: action.type,
            success: executionResult.success.toString()
          });
        } catch (error) {
          this.log.error(`Error executing action: ${action.id}`, error);
          
          // Update action status
          action.status = 'failed';
          action.error = {
            message: error.message,
            stack: error.stack
          };
          action.executionEndTime = Date.now();
          
          // Add to results
          results.push({
            actionId: action.id,
            actionType: action.type,
            success: false,
            message: `Execution error: ${error.message}`,
            error: error.message
          });
        }
      }
      
      return results;
    } catch (error) {
      this.log.error('Error executing response actions', error);
      throw error;
    }
  }
  
  /**
   * Execute a SOAR platform escalation
   * @param {Object} action - Action details
   * @returns {Promise<Object>} Execution result
   * @private
   */
  async _executeSoarEscalation(action) {
    // Placeholder - in a real implementation, this would integrate with a SOAR platform
    return { success: true, message: 'Escalation created in SOAR platform' };
  }
  
  /**
   * Execute an IP block
   * @param {Object} action - Action details
   * @returns {Promise<Object>} Execution result
   * @private
   */
  async _executeBlockIp(action) {
    // Placeholder - in a real implementation, this would integrate with a firewall
    return { success: true, message: `IP ${action.details.ip} blocked on firewall` };
  }
  
  /**
   * Execute a SIEM IP watchlist addition
   * @param {Object} action - Action details
   * @returns {Promise<Object>} Execution result
   * @private
   */
  async _executeWatchlistIp(action) {
    // Placeholder - in a real implementation, this would integrate with a SIEM
    return { success: true, message: `IP ${action.details.ip} added to SIEM watchlist` };
  }
  
  /**
   * Execute an email notification
   * @param {Object} action - Action details
   * @returns {Promise<Object>} Execution result
   * @private
   */
  async _executeEmailNotification(action) {
    // Placeholder - in a real implementation, this would send an email
    return { success: true, message: 'Email notification sent' };
  }
  
  /**
   * Generate an incident report
   * @param {Object} investigation - Investigation results
   * @param {Array} responseActions - Response actions
   * @param {Array} executionResults - Action execution results
   * @returns {Promise<Object>} Incident report
   */
  async generateIncidentReport(investigation, responseActions, executionResults) {
    try {
      this.log.info(`Generating incident report for investigation: ${investigation.id}`);
      
      // Basic report generation - to be overridden in specific L2 agent subclasses
      const report = {
        id: utils.encryption.generateId(),
        type: 'l2_incident_report',
        investigationId: investigation.id,
        incidents: [investigation.originalIssue],
        severity: investigation.severity,
        confidence: investigation.confidence,
        findings: investigation.findings || [],
        rootCause: investigation.rootCause || 'Unknown',
        responseActions: responseActions.map(action => ({
          id: action.id,
          type: action.type,
          status: action.status,
          success: action.result?.success,
          message: action.result?.message
        })),
        recommendations: [],
        timestamp: Date.now(),
        generatedBy: {
          agentId: this.id,
          agentName: this.name,
          agentType: this.type
        }
      };
      
      // Add recommendations
      if (investigation.severity >= 70) {
        report.recommendations.push({
          type: 'review',
          priority: 'high',
          description: 'High severity incident - review by security analyst recommended'
        });
      }
      
      return report;
    } catch (error) {
      this.log.error('Error generating incident report', error);
      throw error;
    }
  }
  
  /**
   * Analyze data and draw conclusions
   * @param {Object} data - Data to analyze
   * @returns {Promise<Object>} Analysis result
   */
  async analyze(data) {
    // Basic analysis - to be overridden in specific L2 agent subclasses
    try {
      // For L2 agents, investigation is the primary form of analysis
      if (data.type === 'incident_evidence') {
        // Analyze new evidence for an existing incident
        return this._analyzeNewEvidence(data);
      }
      
      // Otherwise, treat it as a full investigation
      return await this.investigate(data.data || data);
    } catch (error) {
      this.log.error('Error during analysis', error);
      throw error;
    }
  }
  
  /**
   * Analyze new evidence for an incident
   * @param {Object} data - Evidence data
   * @returns {Promise<Object>} Analysis result
   * @private
   */
  async _analyzeNewEvidence(data) {
    try {
      this.log.info(`Analyzing new evidence for incident: ${data.incidentId}`);
      
      // Basic evidence analysis - to be overridden in specific L2 agent subclasses
      const result = {
        id: utils.encryption.generateId(),
        incidentId: data.incidentId,
        evidenceId: data.evidence.id,
        findings: [],
        timestamp: Date.now()
      };
      
      // Check for threat intel matches in the evidence
      const threatIntelMatches = await this._checkThreatIntelligence(data.evidence);
      if (threatIntelMatches.length > 0) {
        result.findings.push({
          type: 'threat_intel_match',
          matches: threatIntelMatches,
          timestamp: Date.now()
        });
      }
      
      return result;
    } catch (error) {
      this.log.error(`Error analyzing evidence for incident: ${data.incidentId}`, error);
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
      // For L2 agents, reporting is handled by the generateIncidentReport method
      // This is a simplified version for non-incident reports
      const report = {
        id: utils.encryption.generateId(),
        findingsId: findings.id,
        type: 'l2_analysis_report',
        severity: findings.severity || 0,
        confidence: findings.confidence,
        summary: `L2 analysis of ${findings.type || 'data'} completed`,
        details: findings,
        recommendations: [],
        timestamp: Date.now(),
        generatedBy: {
          agentId: this.id,
          agentName: this.name,
          agentType: this.type
        }
      };
      
      return report;
    } catch (error) {
      this.log.error('Error generating report', error);
      throw error;
    }
  }
  
  /**
   * Get investigation metrics
   * @returns {Object} Investigation metrics
   */
  get investigationMetrics() {
    return { ...this._investigationMetrics };
  }
  
  /**
   * Get recent response actions
   * @param {number} [limit=10] - Maximum number of actions to return
   * @returns {Array} Recent response actions
   */
  getRecentResponseActions(limit = 10) {
    // Sort by timestamp (newest first) and return limited number
    return [...this._responseActions]
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, limit);
  }
}

module.exports = BaseL2Agent;