/**
 * Threat Intelligence Agent (L2)
 *
 * Specializes in:
 * - Enriching alerts/incidents with threat intelligence context
 * - Identifying known threat actors and campaigns
 * - Providing IOCs for detection and hunting
 * - Assessing threat credibility and relevance
 * - Monitoring for emerging threats
 * - Supporting L1 and L2 agents with intelligence and escalations
 */

const { BaseL2Agent } = require('../../agentic_soc_framework');
const utils = require('../../../utils');

/**
 * Default intelligence confidence thresholds
 * @type {Object}
 * @private
 */
const INTEL_CONFIDENCE = {
  LOW: 30,
  MEDIUM: 60,
  HIGH: 80
};

/**
 * Threat Intelligence Agent
 * @class ThreatIntelligenceAgent
 * @extends BaseL2Agent
 */
class ThreatIntelligenceAgent extends BaseL2Agent {
  /**
   * Create a new ThreatIntelligenceAgent
   * @param {Object} config - Agent configuration
   * @param {Object} messageBus - System message bus
   */
  constructor(config = {}, messageBus = null) {
    const tiConfig = {
      ...config,
      type: 'threat_intelligence_agent',
      name: config.name || 'Threat Intelligence Agent',
      capabilities: [
        ...(config.capabilities || []),
        'threat_intelligence',
        'ioc_enrichment',
        'campaign_analysis',
        'threat_actor_profiling',
        'intel_collection',
        'intel_correlation'
      ]
    };

    super(tiConfig, messageBus);

    // Threat intelligence specific configuration
    this._tiConfig = {
      intelSources: config.intelSources || ['open_source', 'commercial', 'industry', 'government', 'internal'],
      autoEnrichment: config.autoEnrichment !== false,
      confidenceThreshold: config.confidenceThreshold || INTEL_CONFIDENCE.MEDIUM,
      maxIndicators: config.maxIndicators || 5000,
      maxCampaignHistory: config.maxCampaignHistory || 200
    };

    // In-memory threat intelligence store (would be external in production)
    this._intelStore = {
      iocs: [],             // Array of IOC objects
      actors: [],           // Known threat actors
      campaigns: [],        // Known or suspected campaigns
      ttps: [],             // Tactics/techniques/procedures
      lastRefresh: 0
    };

    // Metrics specific to threat intelligence operations
    this._tiMetrics = {
      intelligenceGathered: 0,
      intelCorrelated: 0,
      alertsEnriched: 0,
      iocMatches: 0,
      ttpsIdentified: 0,
      campaignsLinked: 0
    };

    // Initialize TI event subscriptions
    this._initializeTiEventSubscriptions();
  }

  /**
   * Initialize threat intelligence specific event subscriptions
   * @private
   */
  _initializeTiEventSubscriptions() {
    if (this._messageBus) {
      const additionalSubscriptions = [
        // Requests from other agents for enrichment/intel
        this.subscribeToMessages('intel:enrich_alert', this._handleEnrichAlertRequest.bind(this)),
        this.subscribeToMessages('intel:enrich_incident', this._handleEnrichIncidentRequest.bind(this)),
        this.subscribeToMessages('intel:ioc_lookup', this._handleIocLookupRequest.bind(this)),
        this.subscribeToMessages('intel:campaign_update', this._handleCampaignUpdate.bind(this)),
        this.subscribeToMessages('intel:refresh', this._handleIntelRefreshRequest.bind(this))
      ];

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
    await super._onInitialize(options);

    this.log.info('Initializing Threat Intelligence Agent components');

    try {
      // Load initial threat intelligence if requested
      if (options.loadInitialIntel !== false) {
        await this._refreshIntelligence();
      }

      this.log.info('Threat Intelligence Agent initialization complete');
    } catch (error) {
      this.log.error('Error during Threat Intelligence Agent initialization', error);
      throw error;
    }
  }

  /**
   * Handle alert enrichment requests
   * @param {Object} message - Enrichment request message
   * @private
   */
  _handleEnrichAlertRequest(message) {
    try {
      const { alert, requestId } = message.data || {};
      if (!alert) {
        this.log.warn('Received enrich_alert request without alert data');
        return;
      }

      this.addTask({
        data: {
          type: 'intel_enrichment_request',
          alert,
          requestId,
          source: message.source || 'unknown'
        },
        priority: alert.severity || 50
      });
    } catch (error) {
      this.log.error('Error handling enrich alert request', error);
    }
  }

  /**
   * Handle incident enrichment requests
   * @param {Object} message - Enrichment request message
   * @private
   */
  _handleEnrichIncidentRequest(message) {
    try {
      const { incident, requestId } = message.data || {};
      if (!incident) {
        this.log.warn('Received enrich_incident request without incident data');
        return;
      }

      this.addTask({
        data: {
          type: 'intel_incident_enrichment_request',
          incident,
          requestId,
          source: message.source || 'unknown'
        },
        priority: incident.severity || 60
      });
    } catch (error) {
      this.log.error('Error handling enrich incident request', error);
    }
  }

  /**
   * Handle IOC lookup requests
   * @param {Object} message - IOC lookup request
   * @private
   */
  _handleIocLookupRequest(message) {
    try {
      const { ioc, requestId } = message.data || {};
      if (!ioc) {
        this.log.warn('Received ioc_lookup request without IOC data');
        return;
      }

      this.addTask({
        data: {
          type: 'ioc_lookup',
          ioc,
          requestId,
          source: message.source || 'unknown'
        },
        priority: 40
      });
    } catch (error) {
      this.log.error('Error handling IOC lookup request', error);
    }
  }

  /**
   * Handle campaign update notifications
   * @param {Object} message - Campaign update message
   * @private
   */
  _handleCampaignUpdate(message) {
    try {
      const campaign = message.data;
      if (!campaign || !campaign.id) {
        this.log.warn('Received campaign_update without campaign data');
        return;
      }

      this.addTask({
        data: {
          type: 'campaign_update',
          campaign
        },
        priority: campaign.severity || 70
      });
    } catch (error) {
      this.log.error('Error handling campaign update', error);
    }
  }

  /**
   * Handle intelligence refresh requests
   * @param {Object} message - Refresh request
   * @private
   */
  _handleIntelRefreshRequest(message) {
    try {
      const options = message.data || {};

      this.addTask({
        data: {
          type: 'intel_refresh',
          options
        },
        priority: options.priority || 30
      });
    } catch (error) {
      this.log.error('Error handling intel refresh request', error);
    }
  }

  /**
   * Process incoming data
   * @param {Object} data - Data to process
   * @returns {Promise<Object>} Processing result
   */
  async process(data) {
    const startTime = Date.now();
    this.log.info(`ThreatIntelligenceAgent processing ${data.type} data`);

    try {
      let result;

      switch (data.type) {
        case 'intel_enrichment_request':
          result = await this._processAlertEnrichment(data.alert, data.requestId);
          break;
        case 'intel_incident_enrichment_request':
          result = await this._processIncidentEnrichment(data.incident, data.requestId);
          break;
        case 'ioc_lookup':
          result = await this._processIocLookup(data.ioc, data.requestId);
          break;
        case 'campaign_update':
          result = await this._processCampaignUpdate(data.campaign);
          break;
        case 'intel_refresh':
          result = await this._processIntelRefresh(data.options);
          break;
        default:
          // For anything else, fall back to BaseL2 processing
          result = await super.process(data);
      }

      // Metrics
      utils.metrics.gauge(`agent.${this.id}.ti_process_time_ms`, Date.now() - startTime);
      utils.metrics.increment(`agent.${this.id}.ti_items_processed`, 1, { type: data.type });

      return result;
    } catch (error) {
      this.log.error(`Error processing ${data.type} data in ThreatIntelligenceAgent`, error);
      throw error;
    }
  }

  /**
   * Process alert enrichment
   * @param {Object} alert - Alert to enrich
   * @param {string} requestId - Optional correlation ID
   * @returns {Promise<Object>} Enriched alert
   * @private
   */
  async _processAlertEnrichment(alert, requestId) {
    this.log.info(`Enriching alert: ${alert.id || 'unknown'} from source ${alert.source || 'unknown'}`);

    const enrichedAlert = await this.enrichAlert(alert);

    this._tiMetrics.alertsEnriched++;
    utils.metrics.increment(`agent.${this.id}.alerts_enriched`, 1, { source: alert.source || 'unknown' });

    // Optionally publish result
    if (this._messageBus) {
      this._messageBus.publishMessage({
        type: 'intel:enrich_alert:result',
        data: {
          requestId,
          alertId: alert.id,
          enrichedAlert
        }
      });
    }

    return {
      status: 'enriched',
      alert: enrichedAlert
    };
  }

  /**
   * Enrich a security alert with threat intelligence
   * @param {Object} alert - Alert to enrich
   * @returns {Promise<Object>} Enriched alert
   */
  async enrichAlert(alert) {
    try {
      const context = {
        matchedIocs: [],
        actorProfiles: [],
        campaigns: [],
        ttps: [],
        relevanceScore: 0,
        confidence: 0
      };

      // Collect candidate values to match against IOCs
      const candidateValues = [];
      if (alert.sourceIp) candidateValues.push({ type: 'ip', value: alert.sourceIp });
      if (alert.destinationIp) candidateValues.push({ type: 'ip', value: alert.destinationIp });
      if (alert.hostname) candidateValues.push({ type: 'hostname', value: alert.hostname });
      if (alert.fileHash) candidateValues.push({ type: 'hash', value: alert.fileHash });
      if (alert.url) candidateValues.push({ type: 'url', value: alert.url });
      if (alert.domain) candidateValues.push({ type: 'domain', value: alert.domain });

      // Match IOCs
      for (const candidate of candidateValues) {
        const matches = this._intelStore.iocs.filter(
          ioc => ioc.type === candidate.type && ioc.value === candidate.value
        );

        if (matches.length > 0) {
          context.matchedIocs.push(...matches);
        }
      }

      // Identify related campaigns and actors
      const { campaigns, actors, ttps } = this._correlateIntelContext(context.matchedIocs);
      context.campaigns = campaigns;
      context.actorProfiles = actors;
      context.ttps = ttps;

      // Compute relevance and confidence
      const scoring = this._calculateRelevanceAndConfidence(context, alert);
      context.relevanceScore = scoring.relevance;
      context.confidence = scoring.confidence;

      // Update metrics
      this._tiMetrics.iocMatches += context.matchedIocs.length;
      this._tiMetrics.campaignsLinked += campaigns.length;
      this._tiMetrics.ttpsIdentified += ttps.length;

      // Return new alert object with TI context
      return {
        ...alert,
        threatIntel: context
      };
    } catch (error) {
      this.log.error('Error enriching alert with threat intelligence', error);
      throw error;
    }
  }

  /**
   * Process incident enrichment
   * @param {Object} incident - Incident to enrich
   * @param {string} requestId - Optional correlation ID
   * @returns {Promise<Object>} Enrichment result
   * @private
   */
  async _processIncidentEnrichment(incident, requestId) {
    this.log.info(`Enriching incident: ${incident.id || 'unknown'} with threat intelligence`);

    const indicators = incident.indicators || [];
    const iocMatches = [];

    for (const ind of indicators) {
      const matches = this._intelStore.iocs.filter(
        ioc => ioc.type === ind.type && ioc.value === ind.value
      );
      if (matches.length > 0) {
        iocMatches.push({
          indicator: ind,
          matches
        });
      }
    }

    const { campaigns, actors, ttps } = this._correlateIntelContext(
      iocMatches.flatMap(m => m.matches)
    );

    const enrichment = {
      iocMatches,
      campaigns,
      actorProfiles: actors,
      ttps
    };

    // Optionally publish result
    if (this._messageBus) {
      this._messageBus.publishMessage({
        type: 'intel:enrich_incident:result',
        data: {
          requestId,
          incidentId: incident.id,
          enrichment
        }
      });
    }

    return {
      status: 'enriched',
      incidentId: incident.id,
      enrichment
    };
  }

  /**
   * Process IOC lookup
   * @param {Object} ioc - IOC to look up
   * @param {string} requestId - Optional correlation ID
   * @returns {Promise<Object>} Lookup result
   * @private
   */
  async _processIocLookup(ioc, requestId) {
    this.log.info(`Performing IOC lookup: ${ioc.type}=${ioc.value}`);

    const matches = this._intelStore.iocs.filter(
      stored => stored.type === ioc.type && stored.value === ioc.value
    );

    // Aggregate context from matching IOCs
    const { campaigns, actors, ttps } = this._correlateIntelContext(matches);

    const result = {
      ioc,
      matches,
      campaigns,
      actorProfiles: actors,
      ttps
    };

    if (this._messageBus) {
      this._messageBus.publishMessage({
        type: 'intel:ioc_lookup:result',
        data: {
          requestId,
          result
        }
      });
    }

    return {
      status: 'completed',
      result
    };
  }

  /**
   * Process campaign updates and decide on escalation
   * @param {Object} campaign - Campaign details
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processCampaignUpdate(campaign) {
    this.log.info(`Processing campaign update: ${campaign.id} - ${campaign.name || 'unnamed'}`);

    // Update or add campaign to store
    const idx = this._intelStore.campaigns.findIndex(c => c.id === campaign.id);
    if (idx >= 0) {
      this._intelStore.campaigns[idx] = { ...this._intelStore.campaigns[idx], ...campaign };
    } else {
      this._intelStore.campaigns.unshift({
        ...campaign,
        firstSeen: campaign.firstSeen || Date.now(),
        lastSeen: Date.now()
      });

      // Truncate history if needed
      if (this._intelStore.campaigns.length > this._tiConfig.maxCampaignHistory) {
        this._intelStore.campaigns = this._intelStore.campaigns.slice(0, this._tiConfig.maxCampaignHistory);
      }
    }

    // Decide if this campaign should be escalated to L3
    if (this._shouldEscalateCampaignToL3(campaign)) {
      await this._escalateCampaignToL3(campaign);
    }

    return {
      status: 'processed',
      campaignId: campaign.id
    };
  }

  /**
   * Process intelligence refresh request
   * @param {Object} options - Refresh options
   * @returns {Promise<Object>} Refresh result
   * @private
   */
  async _processIntelRefresh(options) {
    await this._refreshIntelligence(options);

    return {
      status: 'refreshed',
      lastRefresh: this._intelStore.lastRefresh,
      sources: this._tiConfig.intelSources
    };
  }

  /**
   * Refresh threat intelligence from configured sources
   * @param {Object} [options] - Optional refresh options
   * @returns {Promise<void>}
   * @private
   */
  async _refreshIntelligence(options = {}) {
    try {
      this.log.info('Refreshing threat intelligence from configured sources');

      // In a real system, this would call external APIs / data sources
      // Here we simulate loading a small set of IOCs and actors

      const now = Date.now();

      // Minimal demo intel set
      this._intelStore.iocs = [
        {
          id: 'ioc-1',
          type: 'ip',
          value: '203.0.113.10',
          confidence: INTEL_CONFIDENCE.HIGH,
          source: 'open_source',
          tags: ['c2', 'russia'],
          firstSeen: now - 86400000,
          lastSeen: now
        },
        {
          id: 'ioc-2',
          type: 'hash',
          value: 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d',
          confidence: INTEL_CONFIDENCE.HIGH,
          source: 'commercial',
          tags: ['ransomware'],
          firstSeen: now - 172800000,
          lastSeen: now
        }
      ];

      this._intelStore.actors = [
        {
          id: 'actor-1',
          name: 'APT Example',
          aliases: ['APT-Example'],
          motivation: 'espionage',
          sophistication: 'high',
          ttps: ['T1566', 'T1059', 'T1071']
        }
      ];

      this._intelStore.campaigns = this._intelStore.campaigns || [];
      this._intelStore.ttps = ['T1566', 'T1059', 'T1071'];
      this._intelStore.lastRefresh = now;

      this._tiMetrics.intelligenceGathered += this._intelStore.iocs.length;

      utils.metrics.increment(`agent.${this.id}.intel_refreshes`, 1);
      utils.metrics.gauge(`agent.${this.id}.intel_ioc_count`, this._intelStore.iocs.length);
    } catch (error) {
      this.log.error('Error refreshing threat intelligence', error);
      throw error;
    }
  }

  /**
   * Correlate matched IOCs to campaigns, actors, and TTPs
   * @param {Array<Object>} matchedIocs - Matched IOCs
   * @returns {{campaigns: Array, actors: Array, ttps: Array}}
   * @private
   */
  _correlateIntelContext(matchedIocs) {
    // This is a simplified correlation; a real implementation would be richer
    const campaigns = [];
    const actors = [];
    const ttps = new Set();

    // For now, associate all matches with known actor/campaign if tags overlap
    for (const ioc of matchedIocs) {
      if (ioc.tags && ioc.tags.includes('ransomware')) {
        // Example: tie to a generic ransomware campaign
        campaigns.push({
          id: 'campaign-ransomware-generic',
          name: 'Generic Ransomware Campaign',
          severity: 80
        });
        ttps.add('T1486'); // Data Encrypted for Impact
      }

      if (ioc.tags && ioc.tags.includes('c2')) {
        ttps.add('T1071'); // C2 using application protocols
      }
    }

    // All IOCs with high confidence get tied to the demo actor
    if (matchedIocs.some(ioc => ioc.confidence >= INTEL_CONFIDENCE.HIGH)) {
      const actor = this._intelStore.actors[0];
      if (actor) {
        actors.push(actor);
        for (const t of actor.ttps || []) {
          ttps.add(t);
        }
      }
    }

    return {
      campaigns,
      actors,
      ttps: [...ttps]
    };
  }

  /**
   * Calculate relevance and confidence of TI context for an alert
   * @param {Object} context - TI context
   * @param {Object} alert - Alert being enriched
   * @returns {{relevance: number, confidence: number}}
   * @private
   */
  _calculateRelevanceAndConfidence(context, alert) {
    let relevance = 0;
    let confidence = 0;

    // More IOCs and campaigns => higher relevance
    relevance += context.matchedIocs.length * 10;
    relevance += context.campaigns.length * 15;
    relevance += context.actorProfiles.length * 20;

    // Cap relevance
    relevance = Math.min(relevance, 100);

    // Confidence based on IOC confidence and source
    if (context.matchedIocs.length > 0) {
      const avgIocConfidence =
        context.matchedIocs.reduce((sum, i) => sum + (i.confidence || 50), 0) /
        context.matchedIocs.length;
      confidence = avgIocConfidence;
    }

    // Slight boost for high severity alerts
    if (alert.severity && alert.severity >= 70) {
      relevance = Math.min(relevance + 10, 100);
    }

    return { relevance, confidence };
  }

  /**
   * Determine if a campaign should be escalated to L3
   * @param {Object} campaign - Campaign to evaluate
   * @returns {boolean} True if campaign should be escalated
   * @private
   */
  _shouldEscalateCampaignToL3(campaign) {
    const severity = campaign.severity || 0;
    const isNew = !campaign.previousSeen;
    const targetsCritical = campaign.targetedSystems?.some(s => s.critical) === true;

    // Escalate if high severity and new or hitting critical assets
    if (severity >= 80 && (isNew || targetsCritical)) {
      return true;
    }

    // Escalate if sophistication is high and campaign is active
    if (campaign.sophistication === 'high' && campaign.status === 'active') {
      return true;
    }

    return false;
  }

  /**
   * Escalate a campaign to L3 Advanced Threat Agent
   * @param {Object} campaign - Campaign to escalate
   * @returns {Promise<void>}
   * @private
   */
  async _escalateCampaignToL3(campaign) {
    try {
      const escalationIssue = {
        id: utils.encryption.generateId(),
        type: 'threat_campaign',
        campaign,
        severity: campaign.severity || 80,
        source: 'threat_intelligence',
        timestamp: Date.now()
      };

      // Use standard BaseL2Agent escalation to L3 tier
      await this.escalate(escalationIssue, 'l3');

      this.log.info(`Escalated campaign ${campaign.id} to L3 Advanced Threat Agent`);

      utils.metrics.increment(`agent.${this.id}.escalations`, 1, {
        type: 'campaign',
        severity: escalationIssue.severity.toString()
      });
    } catch (error) {
      this.log.error(`Error escalating campaign ${campaign.id} to L3`, error);
    }
  }

  /**
   * Get threat intelligence metrics
   * @returns {Object} Current TI metrics
   */
  get tiMetrics() {
    return { ...this._tiMetrics };
  }
}

module.exports = ThreatIntelligenceAgent;