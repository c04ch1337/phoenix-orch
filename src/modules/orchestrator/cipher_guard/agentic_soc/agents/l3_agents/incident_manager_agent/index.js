/**
 * Incident Manager Agent (L3)
 *
 * Specializes in:
 * - Overseeing complex incident response operations
 * - Coordinating multiple L2 agents and response teams
 * - Developing RCA (Root Cause Analysis) reports
 * - Managing stakeholder communications
 * - Tracking metrics and SLAs
 * - Making strategic escalation decisions (including to Dad)
 */

const { BaseL3Agent } = require('../../agentic_soc_framework');
const utils = require('../../../utils');

/**
 * Crisis / major incident status
 * @type {Object}
 * @private
 */
const CRISIS_STATUS = {
  OPEN: 'open',
  ACTIVE: 'active',
  STABILIZED: 'stabilized',
  RESOLVED: 'resolved',
  CLOSED: 'closed'
};

/**
 * Incident Manager Agent
 * @class IncidentManagerAgent
 * @extends BaseL3Agent
 */
class IncidentManagerAgent extends BaseL3Agent {
  /**
   * Create a new IncidentManagerAgent
   * @param {Object} config - Agent configuration
   * @param {Object} messageBus - System message bus
   */
  constructor(config = {}, messageBus = null) {
    const imConfig = {
      ...config,
      type: 'incident_manager_agent',
      name: config.name || 'Incident Manager Agent',
      capabilities: [
        ...(config.capabilities || []),
        'multi_incident_coordination',
        'crisis_management',
        'stakeholder_communication',
        'sla_monitoring',
        'rca_generation',
        'strategic_escalation'
      ]
    };

    super(imConfig, messageBus);

    this._imConfig = {
      majorIncidentSeverity: config.majorIncidentSeverity || 80,
      crisisSeverityLevels: config.crisisSeverityLevels || { high: 4, medium: 3, low: 2 }, // 1–5 scale
      autoDeclareCrisis: config.autoDeclareCrisis !== false,
      dadEscalationForCrises: config.dadEscalationForCrises !== false
    };

    // Active crises keyed by crisisId
    this._crises = new Map();

    // High-level metrics
    this._imMetrics = {
      majorIncidentsManaged: 0,
      crisisSituationsResolved: 0,
      avgResolutionTimeMs: 0,
      totalResolutionTimeMs: 0,
      closedCrises: 0
    };

    this._initializeImEventSubscriptions();
  }

  /**
   * Initialize Incident Manager event subscriptions
   * @private
   */
  _initializeImEventSubscriptions() {
    if (!this._messageBus) return;

    const subs = [
      this.subscribeToMessages('incident:major', this._handleMajorIncident.bind(this)),
      this.subscribeToMessages('incident:status', this._handleIncidentStatus.bind(this)),
      this.subscribeToMessages('crisis:declare', this._handleExternalCrisisDeclare.bind(this)),
      this.subscribeToMessages('crisis:update', this._handleExternalCrisisUpdate.bind(this)),
      this.subscribeToMessages('metrics:request', this._handleMetricsRequest.bind(this))
    ];

    this._subscriptions = (this._subscriptions || []).concat(subs);
  }

  /**
   * Lifecycle hook during initialization
   * @param {Object} options - Initialization options
   * @returns {Promise<void>}
   * @protected
   */
  async _onInitialize(options) {
    await super._onInitialize(options);
    this.log.info('Initializing Incident Manager Agent components');

    // In a real implementation, load persisted crisis records and metrics
    this.log.info('Incident Manager Agent initialization complete');
  }

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  /**
   * Handle major incident notifications
   * @param {Object} message - Major incident message
   * @private
   */
  _handleMajorIncident(message) {
    try {
      const incident = message.data;
      if (!incident || !incident.id) {
        this.log.warn('Received incident:major without incident id');
        return;
      }

      this.addTask({
        data: {
          type: 'major_incident',
          incident
        },
        priority: incident.severity || 80
      });
    } catch (error) {
      this.log.error('Error handling major incident message', error);
    }
  }

  /**
   * Handle incident status updates
   * @param {Object} message - Status update message
   * @private
   */
  _handleIncidentStatus(message) {
    try {
      const update = message.data;
      if (!update || !update.incidentId) {
        this.log.warn('Received incident:status without incidentId');
        return;
      }

      this.addTask({
        data: {
          type: 'incident_status_update',
          update
        },
        priority: update.severity || 60
      });
    } catch (error) {
      this.log.error('Error handling incident status update', error);
    }
  }

  /**
   * Handle external crisis declaration (e.g., from humans or other systems)
   * @param {Object} message - Crisis declaration message
   * @private
   */
  _handleExternalCrisisDeclare(message) {
    try {
      const crisis = message.data;
      if (!crisis) {
        this.log.warn('Received crisis:declare without crisis data');
        return;
      }

      this.addTask({
        data: {
          type: 'external_crisis_declare',
          crisis
        },
        priority: crisis.severityLevel || 4
      });
    } catch (error) {
      this.log.error('Error handling external crisis declaration', error);
    }
  }

  /**
   * Handle external crisis updates (status/coordination changes)
   * @param {Object} message - Crisis update message
   * @private
   */
  _handleExternalCrisisUpdate(message) {
    try {
      const update = message.data;
      if (!update || !update.crisisId) {
        this.log.warn('Received crisis:update without crisisId');
        return;
      }

      this.addTask({
        data: {
          type: 'crisis_update',
          update
        },
        priority: update.severityLevel || 3
      });
    } catch (error) {
      this.log.error('Error handling external crisis update', error);
    }
  }

  /**
   * Handle metrics request
   * @param {Object} message - Metrics request
   * @private
   */
  _handleMetricsRequest(message) {
    try {
      const req = message.data || {};
      if (req.scope !== 'incident_manager') return;

      this.addTask({
        data: {
          type: 'metrics_request',
          requestId: req.requestId
        },
        priority: 20
      });
    } catch (error) {
      this.log.error('Error handling metrics request', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Core Processing
  // ---------------------------------------------------------------------------

  /**
   * Process incoming data
   * @param {Object} data - Data to process
   * @returns {Promise<Object>} Processing result
   */
  async process(data) {
    const start = Date.now();
    this.log.info(`IncidentManagerAgent processing ${data.type}`);

    try {
      let result;

      switch (data.type) {
        case 'major_incident':
          result = await this._processMajorIncident(data.incident);
          break;
        case 'incident_status_update':
          result = await this._processIncidentStatusUpdate(data.update);
          break;
        case 'external_crisis_declare':
          result = await this._processExternalCrisisDeclare(data.crisis);
          break;
        case 'crisis_update':
          result = await this._processCrisisUpdate(data.update);
          break;
        case 'metrics_request':
          result = await this._processMetricsRequest(data.requestId);
          break;
        default:
          result = await super.process(data);
      }

      utils.metrics.gauge(`agent.${this.id}.incident_manager_process_ms`, Date.now() - start);
      utils.metrics.increment(`agent.${this.id}.incident_manager_items_processed`, 1, {
        type: data.type
      });

      return result;
    } catch (error) {
      this.log.error(`Error in IncidentManagerAgent processing type ${data.type}`, error);
      throw error;
    }
  }

  /**
   * Process a major incident notification
   * @param {Object} incident - Major incident details
   * @returns {Promise<Object>} Result
   * @private
   */
  async _processMajorIncident(incident) {
    this.log.info(`Processing major incident ${incident.id}`);

    const severity = incident.severity || 50;
    let crisis = null;

    // Auto-declare crisis if configured and severity is high enough
    if (this._imConfig.autoDeclareCrisis && severity >= this._imConfig.majorIncidentSeverity) {
      crisis = this._declareCrisisFromIncident(incident);
      this._crises.set(crisis.id, crisis);
      this._imMetrics.majorIncidentsManaged++;

      // Optionally escalate to Dad for high-severity crises
      if (this._imConfig.dadEscalationForCrises && severity >= 90) {
        await this._escalateCrisisToDad(crisis, incident);
      }

      // Coordinate L2 agents for this crisis
      await this._coordinateL2AgentsForCrisis(crisis, incident);
    }

    return {
      status: crisis ? 'crisis_declared' : 'tracked',
      incidentId: incident.id,
      crisisId: crisis ? crisis.id : null
    };
  }

  /**
   * Process incident status updates in the context of active crises
   * @param {Object} update - Status update
   * @returns {Promise<Object>} Result
   * @private
   */
  async _processIncidentStatusUpdate(update) {
    this.log.info(`Processing incident status update for ${update.incidentId}`);

    // Associate with existing crisis if one references this incident
    for (const crisis of this._crises.values()) {
      if (crisis.incidentIds?.includes(update.incidentId)) {
        crisis.timeline.push({
          timestamp: Date.now(),
          event: 'incident_status_update',
          details: update
        });
        crisis.lastUpdated = Date.now();

        // If all incidents within crisis are resolved, mark crisis stabilized/resolved
        if (update.newStatus === 'resolved' || update.newStatus === 'closed') {
          // In a full implementation, would check all incidents' statuses
          crisis.status = CRISIS_STATUS.STABILIZED;
        }

        this._crises.set(crisis.id, crisis);
      }
    }

    return { status: 'processed', incidentId: update.incidentId };
  }

  /**
   * Process externally declared crises
   * @param {Object} crisis - Crisis data
   * @returns {Promise<Object>} Result
   * @private
   */
  async _processExternalCrisisDeclare(crisis) {
    const id = crisis.id || `crisis-${utils.encryption.generateId()}`;
    const record = {
      ...crisis,
      id,
      status: crisis.status || CRISIS_STATUS.OPEN,
      createdAt: crisis.createdAt || Date.now(),
      lastUpdated: Date.now(),
      incidentIds: crisis.incidentIds || [],
      timeline: crisis.timeline || []
    };

    this._crises.set(id, record);
    this._imMetrics.majorIncidentsManaged++;

    // Coordinate teams if requested
    if (record.autoCoordinateTeams) {
      await this._coordinateL2AgentsForCrisis(record, null);
    }

    return { status: 'registered', crisisId: id };
  }

  /**
   * Process crisis updates
   * @param {Object} update - Crisis update
   * @returns {Promise<Object>} Result
   * @private
   */
  async _processCrisisUpdate(update) {
    const crisis = this._crises.get(update.crisisId);
    if (!crisis) {
      this.log.warn(`Crisis update for unknown crisis: ${update.crisisId}`);
      return { status: 'not_found', crisisId: update.crisisId };
    }

    Object.assign(crisis, update, { lastUpdated: Date.now() });
    crisis.timeline = crisis.timeline || [];
    crisis.timeline.push({
      timestamp: Date.now(),
      event: 'crisis_update',
      details: update
    });

    // If resolved or closed, update metrics
    if (update.status === CRISIS_STATUS.RESOLVED || update.status === CRISIS_STATUS.CLOSED) {
      const duration = Date.now() - crisis.createdAt;
      this._imMetrics.crisisSituationsResolved++;
      this._imMetrics.totalResolutionTimeMs += duration;
      this._imMetrics.closedCrises++;
      this._imMetrics.avgResolutionTimeMs =
        this._imMetrics.totalResolutionTimeMs / this._imMetrics.closedCrises;
    }

    this._crises.set(crisis.id, crisis);
    return { status: 'updated', crisisId: crisis.id };
  }

  /**
   * Process metrics request
   * @param {string} requestId - Optional request id
   * @returns {Promise<Object>} Metrics result
   * @private
   */
  async _processMetricsRequest(requestId) {
    const metrics = {
      ...this._imMetrics,
      activeCrises: this._crises.size
    };

    if (this._messageBus && requestId) {
      this._messageBus.publishMessage({
        type: 'metrics:response',
        data: {
          requestId,
          scope: 'incident_manager',
          metrics
        }
      });
    }

    return {
      status: 'ok',
      metrics
    };
  }

  // ---------------------------------------------------------------------------
  // Crisis Management Helpers
  // ---------------------------------------------------------------------------

  /**
   * Declare a crisis based on a major incident
   * @param {Object} incident - Incident data
   * @returns {Object} Crisis record
   * @private
   */
  _declareCrisisFromIncident(incident) {
    const crisisId = `crisis-${utils.encryption.generateId()}`;
    const now = Date.now();

    const crisis = {
      id: crisisId,
      relatedPrimaryIncidentId: incident.id,
      incidentIds: [incident.id],
      status: CRISIS_STATUS.OPEN,
      severityLevel: this._severityToCrisisLevel(incident.severity || 80),
      createdAt: now,
      lastUpdated: now,
      summary: `Crisis for major incident ${incident.id}`,
      businessImpact: incident.businessImpact || 'unknown',
      stakeholders: [],
      timeline: [
        {
          timestamp: now,
          event: 'crisis_declared',
          details: { incidentId: incident.id }
        }
      ]
    };

    this.log.info(`Declared crisis ${crisisId} for incident ${incident.id}`);
    return crisis;
  }

  /**
   * Map numeric severity (0-100) to crisis severity level (1-5)
   * @param {number} severity - Incident severity
   * @returns {number} Crisis severity level
   * @private
   */
  _severityToCrisisLevel(severity) {
    if (severity >= 90) return 5;
    if (severity >= 80) return 4;
    if (severity >= 60) return 3;
    if (severity >= 40) return 2;
    return 1;
  }

  /**
   * Coordinate L2 agents and response teams for a crisis
   * @param {Object} crisis - Crisis record
   * @param {Object|null} incident - Optional associated incident
   * @returns {Promise<void>}
   * @private
   */
  async _coordinateL2AgentsForCrisis(crisis, incident) {
    this.log.info(
      `Coordinating L2 agents for crisis ${crisis.id} (incidents: ${crisis.incidentIds.join(', ')})`
    );

    // In a full implementation, this would assign work to specific L2 agents based on incident type
    // Here we just publish a coordination message
    if (this._messageBus) {
      this._messageBus.publishMessage({
        type: 'incident:coordination_plan',
        data: {
          crisisId: crisis.id,
          incidentIds: crisis.incidentIds,
          coordinator: {
            agentId: this.id,
            agentName: this.name,
            agentType: this.type
          },
          timestamp: Date.now()
        }
      });
    }
  }

  /**
   * Escalate a crisis to Dad for strategic input/decision
   * @param {Object} crisis - Crisis data
   * @param {Object} incident - Primary incident data
   * @returns {Promise<void>}
   * @private
   */
  async _escalateCrisisToDad(crisis, incident) {
    try {
      this.log.info(`Escalating crisis ${crisis.id} to Dad`);

      const analysis = {
        id: crisis.id,
        type: 'crisis',
        severity: crisis.severityLevel * 20,
        findings: [],
        affectedAssets: incident?.affectedAssets || [],
        businessImpact: crisis.businessImpact || incident?.businessImpact || 'high'
      };

      await this._escalateToDad(analysis, {
        id: crisis.id,
        severity: analysis.severity,
        affectedAssets: analysis.affectedAssets,
        businessImpact: analysis.businessImpact
      });

      utils.metrics.increment(`agent.${this.id}.crises_escalated_to_dad`, 1);
    } catch (error) {
      this.log.error(`Error escalating crisis ${crisis.id} to Dad`, error);
    }
  }

  // ---------------------------------------------------------------------------
  // Root Cause & Reporting
  // ---------------------------------------------------------------------------

  /**
   * Generate a high-level RCA (Root Cause Analysis) report for a crisis
   * (Can be invoked by other agents or humans via message bus in a full system)
   * @param {Object} crisis - Crisis record
   * @returns {Object} RCA report
   * @private
   */
  _generateRcaReport(crisis) {
    const now = Date.now();
    return {
      id: `rca-${crisis.id}`,
      crisisId: crisis.id,
      primaryIncidentId: crisis.relatedPrimaryIncidentId,
      summary: crisis.summary || '',
      rootCauses: [], // would be filled from analysis data
      contributingFactors: [],
      impactAssessment: {
        businessImpact: crisis.businessImpact || 'unknown',
        durationMs: now - crisis.createdAt
      },
      recommendations: [],
      createdAt: now,
      generatedBy: {
        agentId: this.id,
        agentName: this.name,
        agentType: this.type
      }
    };
  }

  /**
   * Get Incident Manager metrics
   * @returns {Object} Current metrics
   */
  get incidentManagerMetrics() {
    return { ...this._imMetrics, activeCrises: this._crises.size };
  }
}

module.exports = IncidentManagerAgent;