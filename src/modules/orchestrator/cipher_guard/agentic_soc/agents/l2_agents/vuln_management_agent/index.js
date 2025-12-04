/**
 * Vulnerability Management Agent (L2)
 *
 * Specializes in:
 * - Prioritizing vulnerabilities based on risk
 * - Tracking remediation progress and SLAs
 * - Generating vulnerability management reports
 * - Identifying patch owners and coordinating remediation
 * - Validating fixes and closing remediated issues
 * - Escalating overdue critical issues
 */

const { BaseL2Agent } = require('../../agentic_soc_framework');
const utils = require('../../../utils');

/**
 * Vulnerability statuses
 * @type {Object}
 * @private
 */
const VULN_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RISK_ACCEPTED: 'risk_accepted',
  REMEDIATED: 'remediated',
  VERIFIED: 'verified',
  CLOSED: 'closed'
};

/**
 * SLA configuration defaults in days
 * @type {Object}
 * @private
 */
const DEFAULT_SLA_DAYS = {
  critical: 7,
  high: 30,
  medium: 90,
  low: 180
};

/**
 * Vulnerability Management Agent
 * @class VulnManagementAgent
 * @extends BaseL2Agent
 */
class VulnManagementAgent extends BaseL2Agent {
  /**
   * Create a new VulnManagementAgent
   * @param {Object} config - Agent configuration
   * @param {Object} messageBus - System message bus
   */
  constructor(config = {}, messageBus = null) {
    const vmConfig = {
      ...config,
      type: 'vuln_management_agent',
      name: config.name || 'Vulnerability Management Agent',
      capabilities: [
        ...(config.capabilities || []),
        'vulnerability_management',
        'risk_prioritization',
        'sla_tracking',
        'remediation_coordination',
        'exception_handling',
        'vuln_reporting'
      ]
    };

    super(vmConfig, messageBus);

    this._vmConfig = {
      riskScoringMethod: config.riskScoringMethod || 'cvss',
      slaDays: {
        critical: config.slaDays?.critical || DEFAULT_SLA_DAYS.critical,
        high: config.slaDays?.high || DEFAULT_SLA_DAYS.high,
        medium: config.slaDays?.medium || DEFAULT_SLA_DAYS.medium,
        low: config.slaDays?.low || DEFAULT_SLA_DAYS.low
      },
      escalationSlackDays: config.escalationSlackDays || 0,
      remediationTracking: config.remediationTracking !== false,
      exceptionWorkflow: config.exceptionWorkflow !== false
    };

    // In-memory vulnerability registry (would be external/persistent in production)
    this._vulnRegistry = new Map(); // key: vulnId, value: vulnRecord

    // Remediation plans
    this._remediationPlans = new Map(); // key: planId, value: planRecord

    // Metrics
    this._vmMetrics = {
      vulnerabilitiesManaged: 0,
      remediationsCompleted: 0,
      patchesApplied: 0,
      exceptionsGranted: 0,
      avgRemediationTime: 0,
      totalRemediationTime: 0,
      vulnsClosed: 0
    };

    this._initializeVmEventSubscriptions();
  }

  /**
   * Initialize vulnerability management event subscriptions
   * @private
   */
  _initializeVmEventSubscriptions() {
    if (this._messageBus) {
      const additionalSubscriptions = [
        this.subscribeToMessages('vuln:new', this._handleNewVulnerability.bind(this)),
        this.subscribeToMessages('vuln:update', this._handleVulnerabilityUpdate.bind(this)),
        this.subscribeToMessages('vuln:exception_request', this._handleExceptionRequest.bind(this)),
        this.subscribeToMessages('vuln:remediation_update', this._handleRemediationUpdate.bind(this)),
        this.subscribeToMessages('vuln:verify_request', this._handleVerifyRequest.bind(this))
      ];

      if (!this._subscriptions) {
        this._subscriptions = [];
      }
      this._subscriptions.push(...additionalSubscriptions);
    }
  }

  /**
   * Lifecycle initialization hook
   * @param {Object} options - Initialization options
   * @returns {Promise<void>}
   * @protected
   */
  async _onInitialize(options) {
    await super._onInitialize(options);
    this.log.info('Initializing Vulnerability Management Agent components');

    try {
      // In a real implementation, load persisted vulnerabilities / remediation plans here
      this.log.info('Vulnerability Management Agent initialization complete');
    } catch (error) {
      this.log.error('Error during Vulnerability Management Agent initialization', error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  /**
   * Handle new vulnerability notifications from L1 Vulnerability Scanner Agent
   * @param {Object} message - Message containing finding/assessment
   * @private
   */
  _handleNewVulnerability(message) {
    try {
      const vuln = message.data;
      if (!vuln || !vuln.id) {
        this.log.warn('Received vuln:new without valid vulnerability data');
        return;
      }

      this.addTask({
        data: {
          type: 'new_vulnerability',
          vuln
        },
        priority: this._determineVulnPriority(vuln)
      });
    } catch (error) {
      this.log.error('Error handling new vulnerability message', error);
    }
  }

  /**
   * Handle vulnerability update events (status changes, new evidence, etc.)
   * @param {Object} message - Update message
   * @private
   */
  _handleVulnerabilityUpdate(message) {
    try {
      const update = message.data;
      if (!update || !update.id) {
        this.log.warn('Received vuln:update without vuln id');
        return;
      }

      this.addTask({
        data: {
          type: 'vuln_update',
          update
        },
        priority: update.priority || 50
      });
    } catch (error) {
      this.log.error('Error handling vulnerability update message', error);
    }
  }

  /**
   * Handle vulnerability exception requests
   * @param {Object} message - Exception request message
   * @private
   */
  _handleExceptionRequest(message) {
    try {
      const request = message.data;
      if (!request || !request.vulnId) {
        this.log.warn('Received vuln:exception_request without vulnId');
        return;
      }

      this.addTask({
        data: {
          type: 'exception_request',
          request
        },
        priority: 60
      });
    } catch (error) {
      this.log.error('Error handling vulnerability exception request', error);
    }
  }

  /**
   * Handle remediation progress updates from external systems
   * @param {Object} message - Remediation update message
   * @private
   */
  _handleRemediationUpdate(message) {
    try {
      const update = message.data;
      if (!update || !update.planId) {
        this.log.warn('Received vuln:remediation_update without planId');
        return;
      }

      this.addTask({
        data: {
          type: 'remediation_update',
          update
        },
        priority: 55
      });
    } catch (error) {
      this.log.error('Error handling remediation update', error);
    }
  }

  /**
   * Handle vulnerability fix verification requests
   * @param {Object} message - Verification request
   * @private
   */
  _handleVerifyRequest(message) {
    try {
      const request = message.data;
      if (!request || !request.vulnId) {
        this.log.warn('Received vuln:verify_request without vulnId');
        return;
      }

      this.addTask({
        data: {
          type: 'verify_fix',
          request
        },
        priority: 65
      });
    } catch (error) {
      this.log.error('Error handling vulnerability verify_request', error);
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
    this.log.info(`VulnManagementAgent processing ${data.type} data`);

    try {
      let result;
      switch (data.type) {
        case 'new_vulnerability':
          result = await this._processNewVulnerability(data.vuln);
          break;
        case 'vuln_update':
          result = await this._processVulnUpdate(data.update);
          break;
        case 'exception_request':
          result = await this._processExceptionRequest(data.request);
          break;
        case 'remediation_update':
          result = await this._processRemediationUpdate(data.update);
          break;
        case 'verify_fix':
          result = await this._processVerifyFix(data.request);
          break;
        default:
          result = await super.process(data);
      }

      utils.metrics.gauge(`agent.${this.id}.vuln_mgmt_process_ms`, Date.now() - start);
      utils.metrics.increment(`agent.${this.id}.vuln_mgmt_items_processed`, 1, { type: data.type });

      return result;
    } catch (error) {
      this.log.error(`Error in Vulnerability Management Agent processing ${data.type}`, error);
      throw error;
    }
  }

  /**
   * Process a new vulnerability record
   * @param {Object} vuln - Vulnerability record from L1
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processNewVulnerability(vuln) {
    this.log.info(`Processing new vulnerability: ${vuln.id} - ${vuln.title || 'Untitled'}`);

    // Normalize and register vulnerability
    const record = this._normalizeVulnerabilityRecord(vuln);
    this._vulnRegistry.set(record.id, record);

    this._vmMetrics.vulnerabilitiesManaged++;
    utils.metrics.increment(`agent.${this.id}.vulns_managed`, 1, { severity: record.severity });

    // Decide if we should immediately add to a remediation plan
    const autoPlan = record.severity === 'critical' || record.severity === 'high';
    let remediationPlan = null;

    if (autoPlan) {
      remediationPlan = await this._autoCreateRemediationPlan([record.id]);
    }

    // Escalate overdue-critical is handled later by scheduled checks,
    // but we can escalate immediately if already overdue on ingestion (rare)
    if (this._shouldEscalateOnIngestion(record)) {
      await this._escalateOverdueVulnerability(record);
    }

    return {
      status: 'registered',
      vulnId: record.id,
      addedToPlan: !!remediationPlan,
      remediationPlanId: remediationPlan?.id || null
    };
  }

  /**
   * Process vulnerability metadata/status updates
   * @param {Object} update - Vulnerability update
   * @returns {Promise<Object>} Result
   * @private
   */
  async _processVulnUpdate(update) {
    const existing = this._vulnRegistry.get(update.id);
    if (!existing) {
      this.log.warn(`Received update for unknown vulnerability: ${update.id}`);
      return { status: 'not_found', vulnId: update.id };
    }

    this.log.info(`Updating vulnerability: ${update.id}`);

    const updated = {
      ...existing,
      ...update,
      lastUpdated: Date.now()
    };
    this._vulnRegistry.set(updated.id, updated);

    // Check SLAs and escalation conditions after update
    if (this._isVulnOverdue(updated)) {
      await this._escalateOverdueVulnerability(updated);
    }

    return { status: 'updated', vulnId: updated.id };
  }

  /**
   * Process exception request for a vulnerability
   * @param {Object} request - Exception request
   * @returns {Promise<Object>} Exception result
   * @private
   */
  async _processExceptionRequest(request) {
    const vuln = this._vulnRegistry.get(request.vulnId);
    if (!vuln) {
      this.log.warn(`Exception request for unknown vulnerability: ${request.vulnId}`);
      return { status: 'not_found', vulnId: request.vulnId };
    }

    this.log.info(`Processing exception request for vulnerability: ${request.vulnId}`);

    // Simple risk-based exception decision
    const approved =
      (vuln.severity === 'medium' || vuln.severity === 'low') &&
      !vuln.exploitability?.exploitAvailable &&
      !vuln.criticalAsset;

    const exceptionId = approved ? utils.encryption.generateId() : null;
    const expiration =
      approved && request.durationDays
        ? Date.now() + request.durationDays * 86400000
        : null;

    if (approved) {
      this._vmMetrics.exceptionsGranted++;
      vuln.status = VULN_STATUS.RISK_ACCEPTED;
      vuln.exception = {
        id: exceptionId,
        requestedBy: request.requestedBy,
        approvedBy: 'vuln_mgmt_agent',
        expiration,
        conditions: request.conditions || []
      };
      vuln.lastUpdated = Date.now();
      this._vulnRegistry.set(vuln.id, vuln);
    }

    return {
      status: 'processed',
      approved,
      exceptionId,
      expiration
    };
  }

  /**
   * Process remediation plan updates
   * @param {Object} update - Remediation update
   * @returns {Promise<Object>} Result
   * @private
   */
  async _processRemediationUpdate(update) {
    const plan = this._remediationPlans.get(update.planId);
    if (!plan) {
      this.log.warn(`Remediation update for unknown plan: ${update.planId}`);
      return { status: 'not_found', planId: update.planId };
    }

    this.log.info(`Processing remediation update for plan: ${update.planId}`);

    // Apply updates (e.g., actions completion, status)
    Object.assign(plan, update, { lastUpdated: Date.now() });
    this._remediationPlans.set(plan.id, plan);

    // Update metrics if actions have completed
    if (update.completedActions != null) {
      this._vmMetrics.remediationsCompleted += update.completedActions;
    }

    return { status: 'updated', planId: plan.id };
  }

  /**
   * Process fix verification request
   * @param {Object} request - Verification request
   * @returns {Promise<Object>} Result
   * @private
   */
  async _processVerifyFix(request) {
    const vuln = this._vulnRegistry.get(request.vulnId);
    if (!vuln) {
      this.log.warn(`Verify request for unknown vuln: ${request.vulnId}`);
      return { status: 'not_found', vulnId: request.vulnId };
    }

    this.log.info(`Verifying fix for vulnerability: ${request.vulnId}`);

    // In production, would trigger scanner re-check or validation workflow
    // Here we simulate a successful verification
    const verified = true;

    if (verified) {
      const now = Date.now();
      vuln.status = VULN_STATUS.VERIFIED;
      vuln.verifiedAt = now;
      vuln.closedAt = now;
      vuln.lastUpdated = now;
      this._vulnRegistry.set(vuln.id, vuln);

      this._vmMetrics.vulnsClosed++;
      if (vuln.detectedAt) {
        const remediationTime = now - vuln.detectedAt;
        this._vmMetrics.totalRemediationTime += remediationTime;
        this._vmMetrics.avgRemediationTime =
          this._vmMetrics.totalRemediationTime / this._vmMetrics.vulnsClosed;
      }
    }

    return { status: 'verified', vulnId: vuln.id };
  }

  // ---------------------------------------------------------------------------
  // Helper Logic
  // ---------------------------------------------------------------------------

  /**
   * Normalize a vulnerability record from scanner/L1 format into VM format
   * @param {Object} vuln - Raw vulnerability object
   * @returns {Object} Normalized record
   * @private
   */
  _normalizeVulnerabilityRecord(vuln) {
    const severity = this._normalizeSeverity(vuln.severity || vuln.assessment?.severity);
    const detectedAt = vuln.detectedAt || vuln.assessment?.timestamp || Date.now();

    return {
      id: vuln.id,
      source: vuln.source || 'scanner',
      cve: vuln.cve || vuln.assessment?.cve || null,
      title: vuln.title || vuln.assessment?.title || 'Unknown vulnerability',
      description: vuln.description || vuln.assessment?.description || '',
      severity,
      cvss: vuln.cvss || vuln.assessment?.cvss || null,
      exploitability: vuln.assessment?.exploitability || {},
      exposure: vuln.assessment?.exposure || {},
      businessImpact: vuln.assessment?.businessImpact || 'medium',
      affectedAssets: vuln.assessment?.affectedAssets || [],
      remediationRecommendations: vuln.assessment?.remediationRecommendations || [],
      status: VULN_STATUS.OPEN,
      owner: this._determineOwner(vuln),
      detectedAt,
      lastUpdated: detectedAt,
      slaDays: this._vmConfig.slaDays[severity] || DEFAULT_SLA_DAYS.medium
    };
  }

  /**
   * Normalize severity strings
   * @param {string} severity - Raw severity
   * @returns {string} Normalized severity
   * @private
   */
  _normalizeSeverity(severity) {
    const s = (severity || '').toString().toLowerCase();
    if (s.includes('crit')) return 'critical';
    if (s.includes('high')) return 'high';
    if (s.includes('med')) return 'medium';
    if (s.includes('low')) return 'low';
    return 'medium';
  }

  /**
   * Determine vulnerability owner (team) based on affected assets
   * @param {Object} vuln - Vulnerability object
   * @returns {string} Owner identifier
   * @private
   */
  _determineOwner(vuln) {
    const assets = vuln.assessment?.affectedAssets || vuln.affectedAssets || [];
    if (assets.length === 0) return 'unknown';

    const primary = assets[0];
    return primary.owner || primary.businessUnit || 'unknown';
  }

  /**
   * Determine internal task priority for vulnerability intake
   * @param {Object} vuln - Vulnerability object
   * @returns {number} Priority (0-100)
   * @private
   */
  _determineVulnPriority(vuln) {
    const severity = this._normalizeSeverity(vuln.severity || vuln.assessment?.severity);
    let priority = 50;
    if (severity === 'critical') priority = 90;
    else if (severity === 'high') priority = 75;
    else if (severity === 'medium') priority = 50;
    else if (severity === 'low') priority = 25;

    if (vuln.assessment?.exploitability?.exploitAvailable) {
      priority += 10;
    }

    const criticalAsset =
      vuln.assessment?.affectedAssets?.some(a => a.criticality === 'critical') === true;
    if (criticalAsset) {
      priority += 10;
    }

    return Math.min(priority, 100);
  }

  /**
   * Auto-create a remediation plan for a list of vulnerabilities
   * @param {Array<string>} vulnIds - Vulnerability IDs
   * @returns {Promise<Object>} Remediation plan
   * @private
   */
  async _autoCreateRemediationPlan(vulnIds) {
    const planId = `plan-${utils.encryption.generateId()}`;
    const vulns = vulnIds
      .map(id => this._vulnRegistry.get(id))
      .filter(Boolean);

    const plan = {
      id: planId,
      vulnerabilities: vulnIds,
      owner: this._determinePlanOwner(vulns),
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      progress: 0,
      completedActions: 0,
      pendingActions: vulns.length,
      blockers: []
    };

    this._remediationPlans.set(planId, plan);

    this.log.info(`Auto-created remediation plan ${planId} for ${vulns.length} vulnerabilities`);

    return plan;
  }

  /**
   * Determine remediation plan owner (e.g., team or group)
   * @param {Array<Object>} vulns - Vulnerability records
   * @returns {string} Owner
   * @private
   */
  _determinePlanOwner(vulns) {
    if (!vulns || vulns.length === 0) return 'unknown';

    // Use most common owner among vulnerabilities as the plan owner
    const counts = {};
    for (const v of vulns) {
      const o = v.owner || 'unknown';
      counts[o] = (counts[o] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  /**
   * Check if vulnerability should be escalated immediately upon ingestion
   * @param {Object} vuln - Vulnerability record
   * @returns {boolean} True if should escalate
   * @private
   */
  _shouldEscalateOnIngestion(vuln) {
    // Escalate if severity is critical and exploit is available
    if (
      vuln.severity === 'critical' &&
      vuln.exploitability?.exploitAvailable &&
      vuln.affectedAssets?.some(a => a.criticality === 'critical')
    ) {
      return true;
    }
    return false;
  }

  /**
   * Check if vulnerability is overdue according to SLA
   * @param {Object} vuln - Vulnerability record
   * @returns {boolean} True if overdue
   * @private
   */
  _isVulnOverdue(vuln) {
    if (vuln.status !== VULN_STATUS.OPEN && vuln.status !== VULN_STATUS.IN_PROGRESS) {
      return false;
    }

    const daysSinceDetected = (Date.now() - vuln.detectedAt) / 86400000;
    return daysSinceDetected >
      (vuln.slaDays + (this._vmConfig.escalationSlackDays || 0));
  }

  /**
   * Escalate overdue or high-risk vulnerability to L3 or Incident Response
   * @param {Object} vuln - Vulnerability record
   * @returns {Promise<void>}
   * @private
   */
  async _escalateOverdueVulnerability(vuln) {
    try {
      const escalationIssue = {
        id: utils.encryption.generateId(),
        type: 'overdue_vulnerability',
        vulnId: vuln.id,
        cve: vuln.cve,
        severity: vuln.severity,
        detectedAt: vuln.detectedAt,
        slaDays: vuln.slaDays,
        owner: vuln.owner,
        affectedAssets: vuln.affectedAssets,
        exploitability: vuln.exploitability,
        businessImpact: vuln.businessImpact,
        timestamp: Date.now()
      };

      // Escalate to Incident Response by default for overdue critical/high
      const targetTier = 'l3'; // Could also be 'incident_response_agent' via AgentManager routing

      await this.escalate(escalationIssue, targetTier);
      this.log.info(`Escalated overdue vulnerability ${vuln.id} to ${targetTier}`);

      utils.metrics.increment(`agent.${this.id}.vuln_escalations`, 1, {
        severity: vuln.severity
      });
    } catch (error) {
      this.log.error(`Error escalating overdue vulnerability ${vuln.id}`, error);
    }
  }

  /**
   * Public metrics accessor
   * @returns {Object} Vulnerability management metrics
   */
  get vmMetrics() {
    return { ...this._vmMetrics };
  }
}

module.exports = VulnManagementAgent;