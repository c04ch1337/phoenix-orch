/**
 * Advanced Threat Agent (L3)
 *
 * Specializes in:
 * - Analyzing sophisticated threat campaigns
 * - Performing advanced correlation across multiple data sources
 * - Identifying new TTPs (Tactics, Techniques, and Procedures)
 * - Creating custom detection rules
 * - Developing strategic threat advisories
 * - Escalating novel threats to Dad (human oversight) when appropriate
 */

const { BaseL3Agent } = require('../../agentic_soc_framework');
const utils = require('../../../utils');

/**
 * Detection rule severities
 * @type {Object}
 * @private
 */
const RULE_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Advanced Threat Agent
 * @class AdvancedThreatAgent
 * @extends BaseL3Agent
 */
class AdvancedThreatAgent extends BaseL3Agent {
  /**
   * Create a new AdvancedThreatAgent
   * @param {Object} config - Agent configuration
   * @param {Object} messageBus - System message bus
   */
  constructor(config = {}, messageBus = null) {
    const atConfig = {
      ...config,
      type: 'advanced_threat_agent',
      name: config.name || 'Advanced Threat Agent',
      capabilities: [
        ...(config.capabilities || []),
        'advanced_threat_handling',
        'campaign_analysis',
        'cross_source_correlation',
        'ttp_discovery',
        'detection_rule_creation',
        'strategic_advisory_generation'
      ]
    };

    super(atConfig, messageBus);

    this._atConfig = {
      novelTtpThreshold: config.novelTtpThreshold || 0.7,
      minCampaignSeverityForRules: config.minCampaignSeverityForRules || 70,
      autoPublishRules: config.autoPublishRules !== false,
      dadEscalationForNovelThreats: config.dadEscalationForNovelThreats !== false
    };

    // Internal stores for advanced analysis
    this._advancedStore = {
      campaigns: [],        // Enriched campaigns
      ttps: new Map(),      // Observed TTPs and metadata
      detectionRules: [],   // Custom detection rules created
      correlations: []      // Cross-source correlation records
    };
  }

  /**
   * Lifecycle hook called during initialization
   * @param {Object} options - Initialization options
   * @returns {Promise<void>}
   * @protected
   */
  async _onInitialize(options) {
    await super._onInitialize(options);
    this.log.info('Initializing Advanced Threat Agent components');

    try {
      // In a real system we might preload long-term campaign history, known TTPs, etc.
      this.log.info('Advanced Threat Agent initialization complete');
    } catch (error) {
      this.log.error('Error during Advanced Threat Agent initialization', error);
      throw error;
    }
  }

  /**
   * Process incoming data (extends BaseL3Agent behavior)
   * @param {Object} data - Data to process
   * @returns {Promise<Object>} Processing result
   */
  async process(data) {
    const start = Date.now();
    this.log.info(`AdvancedThreatAgent processing ${data.type}`);

    try {
      let result;

      switch (data.type) {
        case 'multi_incident_correlation':
          // BaseL3Agent already analyzes correlations; add extra analysis here
          result = await this._processAdvancedCorrelation(data.correlation);
          break;
        case 'campaign:detected':
        case 'threat_campaign':
          result = await this._processSophisticatedCampaign(data.campaign || data);
          break;
        case 'ttp_analysis_request':
          result = await this._processTtpAnalysisRequest(data);
          break;
        case 'custom_detection_request':
          result = await this._processCustomDetectionRequest(data);
          break;
        default:
          // Fall back to BaseL3Agent behavior
          result = await super.process(data);
      }

      utils.metrics.gauge(`agent.${this.id}.advanced_threat_process_ms`, Date.now() - start);
      utils.metrics.increment(`agent.${this.id}.advanced_items_processed`, 1, { type: data.type });

      return result;
    } catch (error) {
      this.log.error(`Error in AdvancedThreatAgent processing for type ${data.type}`, error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Advanced Correlation & Campaign Analysis
  // ---------------------------------------------------------------------------

  /**
   * Process advanced multi-incident correlation
   * @param {Object} correlation - Multi-incident correlation
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processAdvancedCorrelation(correlation) {
    this.log.info(
      `Advanced analysis of correlation ${correlation.id} with ${correlation.incidents.length} incidents`
    );

    // Let base L3 do initial analysis
    const baseAnalysis = await super._analyzeMultiIncidentCorrelation(correlation);

    // Perform additional cross-source correlation
    const advancedAnalysis = await this._performAdvancedCorrelation(correlation, baseAnalysis);

    // Decide if this constitutes a sophisticated campaign
    if (advancedAnalysis.indicatesCampaign) {
      const campaign = await this._createOrUpdateAdvancedCampaign(correlation, advancedAnalysis);

      this._advancedStore.campaigns.push(campaign);
      utils.metrics.increment(`agent.${this.id}.apt_campaigns_identified`, 1);

      // Generate custom detection rules
      const rules = await this._createCustomDetectionRules(campaign, advancedAnalysis);
      this._advancedStore.detectionRules.push(...rules);

      // Optionally publish rules for downstream systems
      if (this._atConfig.autoPublishRules && this._messageBus) {
        for (const rule of rules) {
          this._messageBus.publishMessage({
            type: 'detection:rule_created',
            data: rule
          });
        }
      }

      // Check if this is a novel threat that should be escalated to Dad
      if (this._atConfig.dadEscalationForNovelThreats &&
          this._isNovelThreat(advancedAnalysis, campaign)) {
        await this._escalateNovelThreatToDad(advancedAnalysis, campaign);
      }

      // Generate a strategic advisory for the campaign
      const advisory = await this.generateCampaignAdvisory(
        campaign,
        advancedAnalysis,
        { tacticalActions: [], strategicActions: [] }
      );

      return {
        status: 'campaign_identified',
        correlationId: correlation.id,
        campaign,
        advancedAnalysis,
        detectionRules: rules,
        advisory
      };
    }

    return {
      status: 'correlation_analyzed',
      correlationId: correlation.id,
      advancedAnalysis
    };
  }

  /**
   * Perform deeper, cross-source correlation analysis
   * @param {Object} correlation - Multi-incident correlation
   * @param {Object} baseAnalysis - Base analysis from parent
   * @returns {Promise<Object>} Advanced analysis
   * @private
   */
  async _performAdvancedCorrelation(correlation, baseAnalysis) {
    // Placeholder but structured advanced correlation
    const incidents = correlation.incidents || [];
    const uniqueHosts = new Set();
    const uniqueUsers = new Set();
    const uniqueIocs = new Set();

    for (const incident of incidents) {
      if (incident.hostname) uniqueHosts.add(incident.hostname);
      if (incident.username) uniqueUsers.add(incident.username);

      if (Array.isArray(incident.indicators)) {
        for (const ioc of incident.indicators) {
          uniqueIocs.add(`${ioc.type}:${ioc.value}`);
        }
      }
    }

    const indicatesCampaign =
      (incidents.length >= 3 && uniqueHosts.size >= 2) ||
      (baseAnalysis.significance && baseAnalysis.significance >= 70);

    const analysis = {
      ...baseAnalysis,
      id: baseAnalysis.id || utils.encryption.generateId(),
      correlationId: correlation.id,
      uniqueHostCount: uniqueHosts.size,
      uniqueUserCount: uniqueUsers.size,
      uniqueIocCount: uniqueIocs.size,
      indicatesCampaign,
      sophisticationScore: this._calculateSophisticationScore(incidents, baseAnalysis),
      timestamp: Date.now()
    };

    this._advancedStore.correlations.push(analysis);
    return analysis;
  }

  /**
   * Calculate a rough sophistication score for a set of incidents
   * @param {Array} incidents - Array of incidents
   * @param {Object} baseAnalysis - Base analysis
   * @returns {number} Sophistication score (0-100)
   * @private
   */
  _calculateSophisticationScore(incidents, baseAnalysis) {
    let score = baseAnalysis.significance || 50;

    // More incidents across more systems => higher sophistication
    const systems = new Set(incidents.map(i => i.hostname).filter(Boolean));
    score += Math.min(systems.size * 5, 20);

    // If multiple MITRE tactics are involved (from incidents), increase score
    const tactics = new Set();
    for (const incident of incidents) {
      if (Array.isArray(incident.mitreTactics)) {
        for (const t of incident.mitreTactics) tactics.add(t);
      }
    }
    score += Math.min(tactics.size * 5, 15);

    return Math.min(score, 100);
  }

  /**
   * Create or update an advanced threat campaign based on correlation
   * @param {Object} correlation - Multi-incident correlation
   * @param {Object} analysis - Advanced analysis
   * @returns {Promise<Object>} Campaign object
   * @private
   */
  async _createOrUpdateAdvancedCampaign(correlation, analysis) {
    const campaign = {
      id: `apt-${utils.encryption.generateId()}`,
      name: `Advanced Campaign ${correlation.id}`,
      description: 'Campaign derived from multi-incident advanced correlation',
      relatedIncidents: correlation.incidents.map(i => i.id),
      severity: analysis.sophisticationScore || 80,
      sophistication: analysis.sophisticationScore >= 80 ? 'high' : 'medium',
      status: 'active',
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      generatedBy: {
        agentId: this.id,
        agentName: this.name,
        agentType: this.type
      }
    };

    return campaign;
  }

  // ---------------------------------------------------------------------------
  // TTP Identification & Detection Rules
  // ---------------------------------------------------------------------------

  /**
   * Process explicit TTP analysis requests
   * @param {Object} data - Request data
   * @returns {Promise<Object>} Analysis result
   * @private
   */
  async _processTtpAnalysisRequest(data) {
    const { activities = [], requestId } = data;
    this.log.info(`Processing TTP analysis request with ${activities.length} activities`);

    const mapping = this._identifyNewTtps(activities);

    if (this._messageBus && requestId) {
      this._messageBus.publishMessage({
        type: 'ttp_analysis:result',
        data: { requestId, mapping }
      });
    }

    return {
      status: 'analyzed',
      mapping
    };
  }

  /**
   * Identify potential new TTPs from observed activities
   * @param {Array<Object>} activities - Observed adversary activities
   * @returns {Object} Mapping of known and novel TTPs
   * @private
   */
  _identifyNewTtps(activities) {
    const knownTechniques = [];
    const suspectedNovelTechniques = [];

    for (const activity of activities) {
      if (activity.mitreTechniqueId) {
        knownTechniques.push(activity.mitreTechniqueId);
      } else if (activity.behaviorSignature) {
        // Heuristic: treat unknown but repeated behavior signatures as novel TTPs
        suspectedNovelTechniques.push({
          signature: activity.behaviorSignature,
          confidence: this._atConfig.novelTtpThreshold,
          description: activity.description || 'Suspected novel behavior'
        });
      }
    }

    const mapping = {
      knownTechniques: [...new Set(knownTechniques)],
      suspectedNovelTechniques
    };

    utils.metrics.increment(
      `agent.${this.id}.ttps_identified`,
      mapping.knownTechniques.length + mapping.suspectedNovelTechniques.length
    );

    return mapping;
  }

  /**
   * Process custom detection rule creation requests
   * @param {Object} data - Request data
   * @returns {Promise<Object>} Result with created rules
   * @private
   */
  async _processCustomDetectionRequest(data) {
    const { campaign, analysis, requestId } = data;
    this.log.info(`Processing custom detection rule request for campaign ${campaign?.id || 'unknown'}`);

    const rules = await this._createCustomDetectionRules(campaign, analysis);

    if (this._atConfig.autoPublishRules && this._messageBus) {
      for (const rule of rules) {
        this._messageBus.publishMessage({
          type: 'detection:rule_created',
          data: rule
        });
      }
    }

    if (this._messageBus && requestId) {
      this._messageBus.publishMessage({
        type: 'custom_detection:result',
        data: { requestId, rules }
      });
    }

    return {
      status: 'rules_created',
      rules
    };
  }

  /**
   * Create custom detection rules based on campaign/analysis
   * @param {Object} campaign - Campaign information
   * @param {Object} analysis - Advanced analysis
   * @returns {Promise<Array<Object>>} Detection rules
   * @private
   */
  async _createCustomDetectionRules(campaign, analysis) {
    const rules = [];

    if (!campaign || !analysis) {
      return rules;
    }

    // Very simplified: create one host-behavior rule and one correlation rule
    const baseRule = {
      id: `rule-${utils.encryption.generateId()}`,
      campaignId: campaign.id,
      description: `Behavioral detection rule for campaign ${campaign.name}`,
      severity: analysis.sophisticationScore >= 85 ? RULE_SEVERITY.CRITICAL : RULE_SEVERITY.HIGH,
      enabled: true,
      createdAt: Date.now(),
      createdBy: {
        agentId: this.id,
        agentName: this.name,
        agentType: this.type
      }
    };

    rules.push({
      ...baseRule,
      type: 'host_behavior',
      logic: 'detect multiple suspicious processes and network connections from same host within short window'
    });

    rules.push({
      ...baseRule,
      id: `rule-${utils.encryption.generateId()}`,
      type: 'cross_incident_correlation',
      logic: 'correlate authentication anomalies with suspicious process spawning and data transfer'
    });

    this.log.info(`Created ${rules.length} custom detection rules for campaign ${campaign.id}`);
    return rules;
  }

  // ---------------------------------------------------------------------------
  // Novel Threat Escalation
  // ---------------------------------------------------------------------------

  /**
   * Determine if analysis/campaign indicate a novel threat worth Dad escalation
   * @param {Object} analysis - Advanced analysis
   * @param {Object} campaign - Campaign
   * @returns {boolean} True if novel threat
   * @private
   */
  _isNovelThreat(analysis, campaign) {
    // Heuristic: high sophistication and indicatesCampaign but not tied to known actor/campaign name
    if (!campaign) return false;

    const sophistication = analysis.sophisticationScore || 0;
    const hasGenericName = !campaign.name || campaign.name.startsWith('Advanced Campaign');

    return sophistication >= 80 && hasGenericName;
  }

  /**
   * Escalate novel threat to Dad via BaseL3's Dad escalation pipeline
   * @param {Object} analysis - Advanced analysis
   * @param {Object} campaign - Campaign
   * @returns {Promise<void>}
   * @private
   */
  async _escalateNovelThreatToDad(analysis, campaign) {
    try {
      this.log.info(`Escalating novel threat campaign ${campaign.id} to Dad`);

      const issue = {
        id: campaign.id,
        type: 'novel_advanced_campaign',
        severity: analysis.sophisticationScore || 85,
        campaign,
        analysis
      };

      await this._escalateToDad(
        {
          id: campaign.id,
          severity: analysis.sophisticationScore || 85,
          type: 'novel_advanced_campaign',
          findings: analysis.patterns || []
        },
        issue
      );

      utils.metrics.increment(`agent.${this.id}.novel_threats_escalated`, 1);
    } catch (error) {
      this.log.error(`Error escalating novel threat campaign ${campaign.id} to Dad`, error);
    }
  }
}

module.exports = AdvancedThreatAgent;