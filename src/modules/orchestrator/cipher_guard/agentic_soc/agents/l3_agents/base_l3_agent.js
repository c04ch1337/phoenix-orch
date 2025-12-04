/**
 * Base L3 Agent
 * 
 * This module defines the base class for L3 (tier 3) agents in the Agentic SOC.
 * L3 agents specialize in handling advanced threats, providing oversight, and
 * serving as the last automated decision-making tier before escalation to Dad
 * (human oversight).
 */

const { Agent, AGENT_STATUS } = require('../index');
const utils = require('../../utils');
const { ESCALATION_REASON } = require('../escalation_manager');

/**
 * Standard L3 agent capabilities
 * @type {Array<string>}
 */
const L3_CAPABILITIES = [
  'advanced_threat_handling',
  'strategic_response',
  'multi_incident_coordination',
  'campaign_tracking',
  'threat_actor_profiling',
  'cross_organizational_analysis',
  'complex_forensics',
  'enterprise_risk_assessment',
  'advisory_generation',
  'agent_oversight',
  'security_policy_management',
  'regulatory_compliance_assessment'
];

/**
 * Base L3 Agent class
 * @class BaseL3Agent
 * @extends Agent
 */
class BaseL3Agent extends Agent {
  /**
   * Create a new BaseL3Agent
   * @param {Object} config - Agent configuration
   * @param {Object} messageBus - System message bus
   */
  constructor(config = {}, messageBus = null) {
    // Add standard L3 capabilities to any provided capabilities
    const l3Config = { 
      ...config,
      type: config.type || 'l3',
      tier: 'l3',
      capabilities: [
        ...(config.capabilities || []),
        ...L3_CAPABILITIES
      ]
    };
    
    super(l3Config, messageBus);
    
    // L3 agent specific properties
    this._escalationThresholds = {
      severity: config.escalationThresholds?.severity || 90,
      confidence: config.escalationThresholds?.confidence || 20,
      complexity: config.escalationThresholds?.complexity || 90,
      responseTime: config.escalationThresholds?.responseTime || 120,  // 2 hours
      criticalAssets: config.escalationThresholds?.criticalAssets || true,  // Always escalate critical asset issues to Dad
      regulatoryImpact: config.escalationThresholds?.regulatoryImpact || true  // Always escalate regulatory issues to Dad
    };
    
    // Advanced analysis metrics
    this._analysisMetrics = {
      threatsAnalyzed: 0,
      strategicResponsesGenerated: 0,
      escalationsToDad: 0,
      threatCampaignsIdentified: 0,
      avgAnalysisTime: 0,
      totalAnalysisTime: 0
    };
    
    // Oversight tracking
    this._oversightMetrics = {
      l1AgentsSupervised: 0,
      l2AgentsSupervised: 0,
      oversightActionsPerformed: 0,
      qualityIssuesIdentified: 0,
      guidancesProvided: 0
    };
    
    // Strategic response plans
    this._strategicResponses = [];
    
    // Threat campaign tracking
    this._threatCampaigns = [];
    
    // Dad interface for critical escalations
    this._dadInterface = config.dadInterface || null;
    
    // Security policy knowledge base
    this._securityPolicies = config.securityPolicies || {};
    
    // Regulatory compliance frameworks
    this._complianceFrameworks = config.complianceFrameworks || {};
    
    // Initialize event subscriptions
    this._initializeEventSubscriptions();
  }
  
  /**
   * Initialize L3 agent specific event subscriptions
   * @private
   */
  _initializeEventSubscriptions() {
    if (this._messageBus) {
      // Subscribe to relevant L3 message types
      this._subscriptions = [
        this.subscribeToMessages('escalation:l3', this._handleEscalation.bind(this)),
        this.subscribeToMessages('threat:campaign', this._handleThreatCampaign.bind(this)),
        this.subscribeToMessages('oversight:request', this._handleOversightRequest.bind(this)),
        this.subscribeToMessages('dad:guidance', this._handleDadGuidance.bind(this)),
        this.subscribeToMessages('policy:update', this._handlePolicyUpdate.bind(this)),
        this.subscribeToMessages('multi:incident:correlation', this._handleMultiIncidentCorrelation.bind(this))
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
    
    // L3 agent specific initialization
    this.log.info('Initializing L3 agent specific components');
    
    try {
      // Initialize Dad interface if available
      if (this._dadInterface) {
        await this._initializeDadInterface();
      }
      
      // Load security policies if needed
      if (options.loadSecurityPolicies && Object.keys(this._securityPolicies).length === 0) {
        await this._loadSecurityPolicies();
      }
      
      // Load compliance frameworks if needed
      if (options.loadComplianceFrameworks && Object.keys(this._complianceFrameworks).length === 0) {
        await this._loadComplianceFrameworks();
      }
      
      this.log.info('L3 agent initialization complete');
    } catch (error) {
      this.log.error('Error during L3 agent initialization', error);
      throw error;
    }
  }
  
  /**
   * Initialize Dad escalation interface
   * @returns {Promise<void>}
   * @private
   */
  async _initializeDadInterface() {
    try {
      this.log.info('Initializing Dad interface');
      
      // Check for existing Dad interface globally
      if (global.cipherGuard && global.cipherGuard.dadInterface) {
        this._dadInterface = global.cipherGuard.dadInterface;
        this.log.info('Using global Dad interface');
        return;
      }
      
      // Example initialization logic - in a real system, this would connect
      // to the actual Dad interface service
      this._dadInterface = {
        escalate: async (issue, context) => {
          this.log.info(`Dad escalation for issue: ${issue.id}`);
          // In a real implementation, this would send to a queue/service
          return { success: true, escalationId: utils.encryption.generateId() };
        },
        requestGuidance: async (query) => {
          this.log.info(`Dad guidance requested: ${query.subject}`);
          // In a real implementation, this would query the guidance system
          return null;  // Guidance comes asynchronously via message
        },
        getEscalationStatus: async (escalationId) => {
          // In a real implementation, this would query the escalation system
          return { status: 'pending', assignedTo: null };
        }
      };
      
      this.log.info('Dad interface initialized');
    } catch (error) {
      this.log.error('Failed to initialize Dad interface', error);
      throw error;
    }
  }
  
  /**
   * Load security policies
   * @returns {Promise<void>}
   * @private
   */
  async _loadSecurityPolicies() {
    try {
      this.log.info('Loading security policies');
      
      // Example implementation - in a real system, this would load from a database
      this._securityPolicies = {
        dataClassification: {
          public: { description: 'Public data', handlingRequirements: [] },
          internal: { description: 'Internal use only', handlingRequirements: [] },
          confidential: { description: 'Confidential data', handlingRequirements: [] },
          restricted: { description: 'Highly restricted data', handlingRequirements: [] }
        },
        incidentResponse: {
          severityLevels: {
            critical: { timeToRespond: 60, timeToResolve: 240, notificationList: [] }, // Minutes
            high: { timeToRespond: 240, timeToResolve: 1440, notificationList: [] },
            medium: { timeToRespond: 1440, timeToResolve: 4320, notificationList: [] },
            low: { timeToRespond: 2880, timeToResolve: 10080, notificationList: [] }
          },
          escalationPaths: {
            // Escalation paths for different incident types
          }
        },
        accessControl: {
          principles: [
            'least_privilege',
            'separation_of_duties',
            'need_to_know'
          ],
          // Other access control policies
        },
        // Additional security policies would go here
      };
      
      this.log.info('Security policies loaded');
    } catch (error) {
      this.log.error('Failed to load security policies', error);
      throw error;
    }
  }
  
  /**
   * Load compliance frameworks
   * @returns {Promise<void>}
   * @private
   */
  async _loadComplianceFrameworks() {
    try {
      this.log.info('Loading compliance frameworks');
      
      // Example implementation - in a real system, this would load from a database
      this._complianceFrameworks = {
        gdpr: {
          name: 'General Data Protection Regulation',
          requirements: [
            // GDPR requirements
          ],
          dataSubjectRights: [
            // GDPR data subject rights
          ],
          breachNotificationRequirements: {
            timeframe: 72, // Hours
            thresholds: {
              // Thresholds for notification
            }
          }
        },
        pci: {
          name: 'Payment Card Industry Data Security Standard',
          requirements: [
            // PCI DSS requirements
          ],
          breachNotificationRequirements: {
            // PCI breach notification requirements
          }
        },
        // Additional frameworks would go here
      };
      
      this.log.info('Compliance frameworks loaded');
    } catch (error) {
      this.log.error('Failed to load compliance frameworks', error);
      throw error;
    }
  }
  
  /**
   * Handle escalations from L2
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
   * Handle threat campaign notifications
   * @param {Object} message - Threat campaign message
   * @private
   */
  _handleThreatCampaign(message) {
    try {
      const campaign = message.data;
      
      this.log.info(`Received threat campaign notification: ${campaign.id} - ${campaign.name}`);
      
      // Add to tracked campaigns
      this._trackThreatCampaign(campaign);
      
      // Add as a task to be analyzed
      this.addTask({
        data: {
          type: 'threat_campaign',
          campaign
        },
        priority: this._determineCampaignPriority(campaign)
      });
    } catch (error) {
      this.log.error('Error handling threat campaign notification', error);
    }
  }
  
  /**
   * Handle oversight requests
   * @param {Object} message - Oversight request message
   * @private
   */
  _handleOversightRequest(message) {
    try {
      const request = message.data;
      
      this.log.info(`Received oversight request: ${request.id} from ${request.requestingAgentId}`);
      
      // Add the oversight request as a task
      this.addTask({
        data: {
          type: 'oversight_request',
          request
        },
        priority: request.priority || 50
      });
    } catch (error) {
      this.log.error('Error handling oversight request', error);
    }
  }
  
  /**
   * Handle guidance from Dad
   * @param {Object} message - Dad guidance message
   * @private
   */
  _handleDadGuidance(message) {
    try {
      const guidance = message.data;
      
      this.log.info(`Received guidance from Dad: ${guidance.id} - ${guidance.subject}`);
      
      // Process the guidance
      if (guidance.targetTaskId) {
        // Add guidance to a specific task
        this._addGuidanceToTask(guidance);
      } else {
        // General guidance - add as a task to be processed
        this.addTask({
          data: {
            type: 'dad_guidance',
            guidance
          },
          priority: guidance.priority || 70
        });
      }
    } catch (error) {
      this.log.error('Error handling Dad guidance', error);
    }
  }
  
  /**
   * Add Dad guidance to a specific task
   * @param {Object} guidance - Guidance from Dad
   * @private
   */
  _addGuidanceToTask(guidance) {
    try {
      // Find the task in pending or active
      let taskFound = false;
      
      // Check active task
      if (this._tasks.active && this._tasks.active.id === guidance.targetTaskId) {
        this._tasks.active.guidance = guidance;
        taskFound = true;
      }
      
      // Check pending tasks
      if (!taskFound) {
        const pendingTask = this._tasks.pending.find(task => task.id === guidance.targetTaskId);
        if (pendingTask) {
          pendingTask.guidance = guidance;
          taskFound = true;
        }
      }
      
      if (taskFound) {
        this.log.info(`Added Dad guidance to task ${guidance.targetTaskId}`);
      } else {
        this.log.warn(`Task ${guidance.targetTaskId} not found for Dad guidance`);
      }
    } catch (error) {
      this.log.error('Error adding guidance to task', error);
    }
  }
  
  /**
   * Handle security policy updates
   * @param {Object} message - Policy update message
   * @private
   */
  _handlePolicyUpdate(message) {
    try {
      const update = message.data;
      
      this.log.info(`Received security policy update: ${update.id} - ${update.policyType}`);
      
      // Update the policy
      this._updateSecurityPolicy(update);
      
      // Analyze impact of policy changes
      this.addTask({
        data: {
          type: 'policy_update_analysis',
          update
        },
        priority: update.priority || 40
      });
    } catch (error) {
      this.log.error('Error handling policy update', error);
    }
  }
  
  /**
   * Handle multi-incident correlation
   * @param {Object} message - Correlation message
   * @private
   */
  _handleMultiIncidentCorrelation(message) {
    try {
      const correlation = message.data;
      
      this.log.info(
        `Received multi-incident correlation: ${correlation.id} with ${
          correlation.incidents.length
        } incidents`
      );
      
      // Add the correlation as a task
      this.addTask({
        data: {
          type: 'multi_incident_correlation',
          correlation
        },
        priority: this._determineCorrelationPriority(correlation)
      });
    } catch (error) {
      this.log.error('Error handling multi-incident correlation', error);
    }
  }
  
  /**
   * Update a security policy
   * @param {Object} update - Policy update
   * @private
   */
  _updateSecurityPolicy(update) {
    try {
      // Get the policy category and specific policy
      const { policyType, policyName, policy } = update;
      
      if (policyType && policyName && policy) {
        // Ensure policy type exists
        if (!this._securityPolicies[policyType]) {
          this._securityPolicies[policyType] = {};
        }
        
        // Update the policy
        this._securityPolicies[policyType][policyName] = {
          ...this._securityPolicies[policyType][policyName],
          ...policy,
          lastUpdated: Date.now()
        };
        
        this.log.info(`Updated security policy: ${policyType}.${policyName}`);
      } else if (policyType && policy && !policyName) {
        // Update entire policy type
        this._securityPolicies[policyType] = {
          ...policy,
          lastUpdated: Date.now()
        };
        
        this.log.info(`Updated entire security policy type: ${policyType}`);
      }
    } catch (error) {
      this.log.error('Error updating security policy', error);
    }
  }
  
  /**
   * Track a threat campaign
   * @param {Object} campaign - Campaign to track
   * @private
   */
  _trackThreatCampaign(campaign) {
    try {
      // Check if campaign already being tracked
      const existingIdx = this._threatCampaigns.findIndex(c => c.id === campaign.id);
      
      if (existingIdx !== -1) {
        // Update existing campaign
        this._threatCampaigns[existingIdx] = {
          ...this._threatCampaigns[existingIdx],
          ...campaign,
          lastUpdated: Date.now()
        };
        
        this.log.debug(`Updated tracked threat campaign: ${campaign.id}`);
      } else {
        // Add new campaign
        this._threatCampaigns.push({
          ...campaign,
          trackingSince: Date.now(),
          lastUpdated: Date.now(),
          relatedIncidents: campaign.relatedIncidents || []
        });
        
        // Update metrics
        this._analysisMetrics.threatCampaignsIdentified++;
        
        this.log.info(`Started tracking new threat campaign: ${campaign.id} - ${campaign.name}`);
      }
      
      // Report metrics
      utils.metrics.gauge(`agent.${this.id}.active_campaigns`, this._threatCampaigns.length);
    } catch (error) {
      this.log.error('Error tracking threat campaign', error);
    }
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
    
    // L3 agents prioritize escalations highly
    priority = Math.max(priority, 70);
    
    // Adjust for escalation reason
    switch (escalation.reason) {
      case ESCALATION_REASON.SEVERITY_THRESHOLD:
      case ESCALATION_REASON.RESPONSE_TIME_CRITICAL:
      case ESCALATION_REASON.CRITICAL_IMPACT:
      case ESCALATION_REASON.REGULATORY_COMPLIANCE:
      case ESCALATION_REASON.LEGAL_LIABILITY:
        priority += 20; // High priority reasons
        break;
      case ESCALATION_REASON.COMPLEXITY_HIGH:
      case ESCALATION_REASON.SPECIALIZED_EXPERTISE_NEEDED:
        priority += 15; // Medium-high priority reasons
        break;
    }
    
    return Math.min(priority, 100);
  }
  
  /**
   * Determine campaign priority
   * @param {Object} campaign - Threat campaign to evaluate
   * @returns {number} Priority (0-100)
   * @private
   */
  _determineCampaignPriority(campaign) {
    // Base on campaign severity
    let priority = campaign.severity || 70; // Campaigns are inherently high priority
    
    // Adjust for target importance
    if (campaign.targetedSystems && campaign.targetedSystems.some(s => s.critical)) {
      priority += 20;
    }
    
    // Adjust for threat actor sophistication
    if (campaign.threatActor && campaign.threatActor.sophistication === 'high') {
      priority += 10;
    }
    
    // Adjust for active exploitation
    if (campaign.status === 'active_exploitation') {
      priority += 20;
    }
    
    return Math.min(priority, 100);
  }
  
  /**
   * Determine correlation priority
   * @param {Object} correlation - Multi-incident correlation
   * @returns {number} Priority (0-100)
   * @private
   */
  _determineCorrelationPriority(correlation) {
    // Start with high base priority for correlations
    let priority = 70;
    
    // Adjust based on number of incidents (more incidents = higher priority)
    priority += Math.min(correlation.incidents.length * 5, 20);
    
    // Adjust for maximum incident severity
    const maxSeverity = Math.max(
      ...correlation.incidents.map(i => i.severity || 0)
    );
    priority = Math.max(priority, maxSeverity);
    
    // Adjust for incident spread (across multiple systems/divisions)
    if (correlation.systemSpread && correlation.systemSpread > 2) {
      priority += 10;
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
        case 'escalated_issue':
          result = await this._processEscalatedIssue(data.escalation);
          break;
        case 'threat_campaign':
          result = await this._processThreatCampaign(data.campaign);
          break;
        case 'oversight_request':
          result = await this._processOversightRequest(data.request);
          break;
        case 'dad_guidance':
          result = await this._processGuidance(data.guidance);
          break;
        case 'policy_update_analysis':
          result = await this._processPolicyUpdateAnalysis(data.update);
          break;
        case 'multi_incident_correlation':
          result = await this._processMultiIncidentCorrelation(data.correlation);
          break;
        default:
          result = await this._processGenericData(data);
      }
      
      // Update analysis metrics
      this._analysisMetrics.threatsAnalyzed++;
      this._analysisMetrics.totalAnalysisTime += (Date.now() - startTime);
      this._analysisMetrics.avgAnalysisTime = 
        this._analysisMetrics.totalAnalysisTime / this._analysisMetrics.threatsAnalyzed;
      
      // Report metrics
      utils.metrics.gauge(`agent.${this.id}.analysis_time_ms`, Date.now() - startTime);
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
    
    // Perform advanced threat analysis
    const analysis = await this.advancedThreatAnalysis(escalation);
    
    // Check if requires Dad escalation
    if (this._shouldEscalateToDad(analysis, escalation)) {
      const dadEscalation = await this._escalateToDad(analysis, escalation);
      
      // Update metrics
      this._analysisMetrics.escalationsToDad++;
      
      return {
        status: 'escalated_to_dad',
        analysis,
        dadEscalation
      };
    }
    
    // Develop strategic response
    const strategicResponse = await this.developStrategicResponse(analysis, escalation);
    
    // Update metrics
    this._analysisMetrics.strategicResponsesGenerated++;
    
    // Track the strategic response
    this._strategicResponses.push(strategicResponse);
    
    // Execute strategic response if automated execution is possible
    let executionResults = null;
    if (strategicResponse.automatedExecution) {
      executionResults = await this.executeStrategicResponse(strategicResponse);
    }
    
    // Generate strategic advisory
    const advisory = await this.generateStrategicAdvisory(
      analysis,
      strategicResponse,
      executionResults
    );
    
    return {
      status: 'strategic_response_developed',
      analysis,
      strategicResponse,
      executionResults,
      advisory
    };
  }
  
  /**
   * Process a threat campaign
   * @param {Object} campaign - Threat campaign
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processThreatCampaign(campaign) {
    this.log.info(`Processing threat campaign: ${campaign.id} - ${campaign.name}`);
    
    // Perform campaign analysis
    const analysis = await this._analyzeThreatCampaign(campaign);
    
    // Check if requires Dad escalation
    if (this._shouldEscalateToDad({ type: 'campaign_analysis', ...analysis }, campaign)) {
      const dadEscalation = await this._escalateToDad(
        { type: 'campaign_analysis', ...analysis }, 
        campaign
      );
      
      return {
        status: 'escalated_to_dad',
        analysis,
        dadEscalation
      };
    }
    
    // Develop campaign response strategy
    const responseStrategy = await this._developCampaignStrategy(campaign, analysis);
    
    // Generate campaign advisory
    const advisory = await this.generateCampaignAdvisory(campaign, analysis, responseStrategy);
    
    // Publish campaign advisory if message bus available
    if (this._messageBus) {
      this._messageBus.publishMessage({
        type: 'campaign:advisory',
        data: advisory
      });
    }
    
    return {
      status: 'campaign_analyzed',
      analysis,
      responseStrategy,
      advisory
    };
  }
  
  /**
   * Process an oversight request
   * @param {Object} request - Oversight request
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processOversightRequest(request) {
    this.log.info(`Processing oversight request: ${request.id} from ${request.requestingAgentId}`);
    
    // Analyze the oversight request
    const analysis = await this._analyzeOversightRequest(request);
    
    // Generate guidance based on analysis
    const guidance = await this._generateAgentGuidance(request, analysis);
    
    // Update oversight metrics
    this._oversightMetrics.oversightActionsPerformed++;
    if (request.agentTier === 'l1') {
      this._oversightMetrics.l1AgentsSupervised++;
    } else if (request.agentTier === 'l2') {
      this._oversightMetrics.l2AgentsSupervised++;
    }
    
    if (guidance.qualityIssueIdentified) {
      this._oversightMetrics.qualityIssuesIdentified++;
    }
    
    this._oversightMetrics.guidancesProvided++;
    
    // Send guidance to the requesting agent
    if (this._messageBus) {
      this._messageBus.publishMessage({
        type: 'oversight:guidance',
        target: request.requestingAgentId,
        data: guidance
      });
    }
    
    return {
      status: 'guidance_provided',
      analysis,
      guidance
    };
  }
  
  /**
   * Process guidance from Dad
   * @param {Object} guidance - Dad guidance
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processGuidance(guidance) {
    this.log.info(`Processing Dad guidance: ${guidance.id} - ${guidance.subject}`);
    
    // Interpret and implement the guidance
    const implementation = await this._implementDadGuidance(guidance);
    
    // If guidance is about a specific incident, update the incident
    if (guidance.incidentId) {
      await this._updateIncidentWithGuidance(guidance.incidentId, guidance, implementation);
    }
    
    // Send acknowledgment to Dad
    if (this._dadInterface) {
      try {
        await this._dadInterface.acknowledgeGuidance(
          guidance.id,
          { implemented: true, results: implementation }
        );
      } catch (error) {
        this.log.error(`Error acknowledging guidance to Dad: ${guidance.id}`, error);
      }
    }
    
    return {
      status: 'guidance_implemented',
      implementation
    };
  }
  
  /**
   * Process a security policy update analysis
   * @param {Object} update - Policy update
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processPolicyUpdateAnalysis(update) {
    this.log.info(
      `Analyzing security policy update: ${update.id} - ${update.policyType}`
    );
    
    // Analyze policy impact
    const impact = await this._analyzePolicyImpact(update);
    
    // Generate policy implementation guidance
    const implementationGuidance = await this._generatePolicyImplementationGuidance(
      update,
      impact
    );
    
    // If significant impact, publish advisory
    if (impact.significantImpact) {
      const advisory = await this.generatePolicyAdvisory(update, impact, implementationGuidance);
      
      if (this._messageBus) {
        this._messageBus.publishMessage({
          type: 'policy:advisory',
          data: advisory
        });
      }
    }
    
    return {
      status: 'policy_analyzed',
      impact,
      implementationGuidance
    };
  }
  
  /**
   * Process a multi-incident correlation
   * @param {Object} correlation - Multi-incident correlation
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processMultiIncidentCorrelation(correlation) {
    this.log.info(
      `Processing multi-incident correlation: ${correlation.id} with ${
        correlation.incidents.length
      } incidents`
    );
    
    // Analyze the correlation to identify patterns, campaign indicators, etc.
    const analysis = await this._analyzeMultiIncidentCorrelation(correlation);
    
    // Check if this indicates a threat campaign
    if (analysis.indicatesCampaign) {
      // Create or update a threat campaign
      const campaign = await this._createOrUpdateThreatCampaign(correlation, analysis);
      
      // Track the campaign
      this._trackThreatCampaign(campaign);
      
      // Publish campaign detection
      if (this._messageBus) {
        this._messageBus.publishMessage({
          type: 'campaign:detected',
          data: campaign
        });
      }
      
      return {
        status: 'campaign_detected',
        analysis,
        campaign
      };
    }
    
    // If not a campaign but still significant correlation
    if (analysis.significance >= 70) {
      // Generate correlation advisory
      const advisory = await this.generateCorrelationAdvisory(correlation, analysis);
      
      // Publish advisory
      if (this._messageBus) {
        this._messageBus.publishMessage({
          type: 'correlation:advisory',
          data: advisory
        });
      }
      
      return {
        status: 'significant_correlation',
        analysis,
        advisory
      };
    }
    
    return {
      status: 'correlation_analyzed',
      analysis,
      message: 'Correlation does not indicate significant pattern'
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
    
    // For generic data, perform basic analysis
    const analysis = await this.analyze({
      type: 'generic',
      data
    });
    
    return {
      status: 'analyzed',
      analysis
    };
  }
  
  /**
   * Check if an issue should be escalated to Dad
   * @param {Object} analysis - Analysis result
   * @param {Object} originalData - Original data
   * @returns {boolean} True if Dad escalation is needed
   * @private
   */
  _shouldEscalateToDad(analysis, originalData) {
    // Check severity threshold
    if (analysis.severity && analysis.severity >= this._escalationThresholds.severity) {
      return true;
    }
    
    // Check confidence threshold (lower confidence means escalate)
    if (
      analysis.confidence !== undefined && 
      analysis.confidence <= this._escalationThresholds.confidence
    ) {
      return true;
    }
    
    // Check complexity threshold
    if (
      analysis.complexity && 
      analysis.complexity >= this._escalationThresholds.complexity
    ) {
      return true;
    }
    
    // Check response time threshold
    if (
      analysis.responseTimeRequired && 
      analysis.responseTimeRequired <= this._escalationThresholds.responseTime
    ) {
      return true;
    }
    
    // Check for critical assets
    if (
      this._escalationThresholds.criticalAssets && 
      (
        originalData.affectedAssets?.some(a => a.critical) ||
        analysis.affectedAssets?.some(a => a.critical)
      )
    ) {
      return true;
    }
    
    // Check for regulatory impact
    if (
      this._escalationThresholds.regulatoryImpact &&
      (
        analysis.regulatoryImpact || 
        analysis.complianceImpact || 
        originalData.regulatoryImpact
      )
    ) {
      return true;
    }
    
    // Check if resolution explicitly requires Dad input
    return analysis.requiresDadInput === true;
  }
  
  /**
   * Escalate an issue to Dad
   * @param {Object} analysis - Analysis result
   * @param {Object} originalData - Original data
   * @returns {Promise<Object>} Escalation result
   * @private
   */
  async _escalateToDad(analysis, originalData) {
    try {
      this.log.info(
        `Escalating issue to Dad: ${originalData.id} (${analysis.type || 'unknown'})`
      );
      
      // Determine escalation reason
      let escalationReason = ESCALATION_REASON.MANUAL_TRIGGER;
      
      if (analysis.severity && analysis.severity >= this._escalationThresholds.severity) {
        escalationReason = ESCALATION_REASON.SEVERITY_THRESHOLD;
      } else if (
        analysis.confidence !== undefined && 
        analysis.confidence <= this._escalationThresholds.confidence
      ) {
        escalationReason = ESCALATION_REASON.CONFIDENCE_LOW;
      } else if (
        analysis.complexity && 
        analysis.complexity >= this._escalationThresholds.complexity
      ) {
        escalationReason = ESCALATION_REASON.COMPLEXITY_HIGH;
      } else if (
        analysis.responseTimeRequired && 
        analysis.responseTimeRequired <= this._escalationThresholds.responseTime
      ) {
        escalationReason = ESCALATION_REASON.RESPONSE_TIME_CRITICAL;
      } else if (
        this._escalationThresholds.criticalAssets && 
        (
          originalData.affectedAssets?.some(a => a.critical) ||
          analysis.affectedAssets?.some(a => a.critical)
        )
      ) {
        escalationReason = ESCALATION_REASON.CRITICAL_IMPACT;
      } else if (
        this._escalationThresholds.regulatoryImpact &&
        (
          analysis.regulatoryImpact || 
          analysis.complianceImpact || 
          originalData.regulatoryImpact
        )
      ) {
        escalationReason = ESCALATION_REASON.REGULATORY_COMPLIANCE;
      }
      
      // Create Dad escalation
      const escalation = {
        id: utils.encryption.generateId(),
        originalIssueId: originalData.id,
        type: analysis.type || originalData.type || 'unknown',
        analysis,
        originalData,
        reason: escalationReason,
        severity: analysis.severity || originalData.severity || 80,
        urgency: this._calculateDadEscalationUrgency(analysis, originalData),
        recommendations: analysis.recommendations || [],
        timestamp: Date.now(),
        sourceAgent: {
          id: this.id,
          name: this.name,
          type: this.type
        }
      };
      
      // Use Dad interface if available
      if (this._dadInterface) {
        try {
          const result = await this._dadInterface.escalate(escalation, {
            agent: {
              id: this.id,
              name: this.name,
              type: this.type
            }
          });
          
          this.log.info(`Dad escalation successful: ${result.escalationId}`);
          
          return {
            success: true,
            escalationId: result.escalationId,
            message: 'Successfully escalated to Dad'
          };
        } catch (error) {
          this.log.error('Error escalating to Dad', error);
          
          // Fallback to message bus if Dad interface fails
          if (this._messageBus) {
            this._publishDadEscalation(escalation);
          }
          
          return {
            success: false,
            error: error.message,
            fallbackUsed: true,
            message: 'Dad interface failed, used fallback notification'
          };
        }
      } else if (this._messageBus) {
        // Use message bus for escalation
        this._publishDadEscalation(escalation);
        
        return {
          success: true,
          message: 'Escalated to Dad via message bus'
        };
      } else {
        this.log.error('No Dad interface or message bus available for escalation');
        
        return {
          success: false,
          message: 'No Dad interface or message bus available'
        };
      }
    } catch (error) {
      this.log.error('Error during Dad escalation', error);
      throw error;
    }
  }
  
  /**
   * Calculate Dad escalation urgency
   * @param {Object} analysis - Analysis result
   * @param {Object} originalData - Original data
   * @returns {string} Urgency level (critical, high, medium, low)
   * @private
   */
  _calculateDadEscalationUrgency(analysis, originalData) {
    const severity = analysis.severity || originalData.severity || 50;
    const responseTime = analysis.responseTimeRequired || originalData.responseTimeRequired;
    
    // Critical urgency criteria
    if (
      severity >= 90 || 
      (responseTime && responseTime <= 60) || // 1 hour
      analysis.criticalAssetImpact || 
      originalData.criticalAssetImpact
    ) {
      return 'critical';
    }
    
    // High urgency criteria
    if (
      severity >= 75 || 
      (responseTime && responseTime <= 240) // 4 hours
    ) {
      return 'high';
    }
    
    // Medium urgency criteria
    if (
      severity >= 50 || 
      (responseTime && responseTime <= 1440) // 24 hours
    ) {
      return 'medium';
    }
    
    // Default is low urgency
    return 'low';
  }
  
  /**
   * Publish a Dad escalation via message bus
   * @param {Object} escalation - Escalation detail
   * @private
   */
  _publishDadEscalation(escalation) {
    try {
      this._messageBus.publishMessage({
        type: 'dad:escalation',
        data: escalation
      });
      
      this.log.info(
        `Published Dad escalation via message bus: ${escalation.id}`
      );
    } catch (error) {
      this.log.error('Error publishing Dad escalation via message bus', error);
    }
  }
  
  /**
   * Perform advanced threat analysis
   * @param {Object} issue - Issue to analyze
   * @returns {Promise<Object>} Analysis result
   */
  async advancedThreatAnalysis(issue) {
    try {
      this.log.info(`Performing advanced threat analysis for ${issue.id}`);
      
      // Basic analysis implementation - to be overridden in specific L3 agent subclasses
      const analysis = {
        id: utils.encryption.generateId(),
        type: 'advanced_threat_analysis',
        originalIssue: issue,
        findings: [],
        timestamp: Date.now()
      };
      
      // Extract or determine severity
      analysis.severity = issue.severity || 70;
      
      // Extract or determine confidence
      analysis.confidence = issue.confidence || 60;
      
      // Extract or determine complexity
      analysis.complexity = issue.complexity || 60;
      
      // Perform threat actor attribution if possible
      const attribution = await this._attributeThreatActor(issue);
      if (attribution) {
        analysis.findings.push({
          type: 'threat_actor_attribution',
          attribution,
          confidence: attribution.confidence,
          timestamp: Date.now()
        });
        
        // Add threat actor to analysis
        analysis.threatActor = attribution.threatActor;
      }
      
      // Assess impact across organization
      const organizationalImpact = await this._assessOrganizationImpact(issue);
      if (organizationalImpact) {
        analysis.findings.push({
          type: 'organizational_impact',
          impact: organizationalImpact,
          timestamp: Date.now()
        });
        
        // Add impact to analysis
        analysis.organizationalImpact = organizationalImpact;
      }
      
      // Assess regulatory and compliance impact
      const complianceImpact = await this._assessComplianceImpact(issue);
      if (complianceImpact && complianceImpact.hasImpact) {
        analysis.findings.push({
          type: 'compliance_impact',
          impact: complianceImpact,
          timestamp: Date.now()
        });
        
        // Add compliance impact to analysis
        analysis.complianceImpact = complianceImpact;
        
        // For significant compliance issues, flag for Dad escalation
        if (complianceImpact.significantImpact) {
          analysis.requiresDadInput = true;
          analysis.severity = Math.max(analysis.severity, 85);
        }
      }
      
      return analysis;
    } catch (error) {
      this.log.error(`Error analyzing issue: ${issue.id}`, error);
      throw error;
    }
  }
  
  /**
   * Attribute threat actor
   * @param {Object} issue - Issue to attribute
   * @returns {Promise<Object|null>} Attribution result
   * @private
   */
  async _attributeThreatActor(issue) {
    // This would contain threat actor attribution logic
    // Placeholder implementation
    return null;
  }
  
  /**
   * Assess organizational impact
   * @param {Object} issue - Issue to assess
   * @returns {Promise<Object|null>} Impact assessment
   * @private
   */
  async _assessOrganizationImpact(issue) {
    // This would contain organization impact assessment logic
    // Placeholder implementation
    return null;
  }
  
  /**
   * Assess compliance impact
   * @param {Object} issue - Issue to assess
   * @returns {Promise<Object|null>} Compliance impact
   * @private
   */
  async _assessComplianceImpact(issue) {
    // This would assess regulatory and compliance impact
    // Placeholder implementation
    return null;
  }
  
  /**
   * Analyze a threat campaign
   * @param {Object} campaign - Campaign to analyze
   * @returns {Promise<Object>} Analysis result
   * @private
   */
  async _analyzeThreatCampaign(campaign) {
    // Placeholder for campaign analysis
    return {
      id: utils.encryption.generateId(),
      campaignId: campaign.id,
      findings: [],
      severity: campaign.severity || 80,
      confidence: 70,
      timestamp: Date.now()
    };
  }
  
  /**
   * Develop campaign strategy
   * @param {Object} campaign - Campaign to develop strategy for
   * @param {Object} analysis - Campaign analysis
   * @returns {Promise<Object>} Campaign strategy
   * @private
   */
  async _developCampaignStrategy(campaign, analysis) {
    // Placeholder for campaign strategy development
    return {
      id: utils.encryption.generateId(),
      campaignId: campaign.id,
      tacticalActions: [],
      strategicActions: [],
      monitoringRequirements: [],
      timestamp: Date.now()
    };
  }
  
  /**
   * Analyze oversight request
   * @param {Object} request - Oversight request
   * @returns {Promise<Object>} Analysis result
   * @private
   */
  async _analyzeOversightRequest(request) {
    // Placeholder for oversight request analysis
    return {
      id: utils.encryption.generateId(),
      requestId: request.id,
      findings: [],
      qualityIssues: [],
      timestamp: Date.now()
    };
  }
  
  /**
   * Generate agent guidance
   * @param {Object} request - Oversight request
   * @param {Object} analysis - Analysis result
   * @returns {Promise<Object>} Guidance
   * @private
   */
  async _generateAgentGuidance(request, analysis) {
    // Placeholder for agent guidance generation
    return {
      id: utils.encryption.generateId(),
      requestId: request.id,
      targetAgentId: request.requestingAgentId,
      qualityIssueIdentified: analysis.qualityIssues && analysis.qualityIssues.length > 0,
      recommendations: [],
      timestamp: Date.now(),
      generatedBy: {
        agentId: this.id,
        agentName: this.name,
        agentType: this.type
      }
    };
  }
  
  /**
   * Implement Dad guidance
   * @param {Object} guidance - Dad guidance
   * @returns {Promise<Object>} Implementation result
   * @private
   */
  async _implementDadGuidance(guidance) {
    // Placeholder for Dad guidance implementation
    return {
      id: utils.encryption.generateId(),
      guidanceId: guidance.id,
      actions: [],
      status: 'implemented',
      timestamp: Date.now()
    };
  }
  
  /**
   * Update incident with Dad guidance
   * @param {string} incidentId - Incident ID
   * @param {Object} guidance - Dad guidance
   * @param {Object} implementation - Guidance implementation
   * @returns {Promise<void>}
   * @private
   */
  async _updateIncidentWithGuidance(incidentId, guidance, implementation) {
    // Placeholder for incident update with guidance
  }
  
  /**
   * Analyze policy impact
   * @param {Object} update - Policy update
   * @returns {Promise<Object>} Impact analysis
   * @private
   */
  async _analyzePolicyImpact(update) {
    // Placeholder for policy impact analysis
    return {
      id: utils.encryption.generateId(),
      policyUpdateId: update.id,
      affectedSystems: [],
      affectedProcesses: [],
      affectedControls: [],
      significantImpact: false,
      timestamp: Date.now()
    };
  }
  
  /**
   * Generate policy implementation guidance
   * @param {Object} update - Policy update
   * @param {Object} impact - Impact analysis
   * @returns {Promise<Object>} Implementation guidance
   * @private
   */
  async _generatePolicyImplementationGuidance(update, impact) {
    // Placeholder for policy implementation guidance
    return {
      id: utils.encryption.generateId(),
      policyUpdateId: update.id,
      implementationSteps: [],
      verificationSteps: [],
      timestamp: Date.now()
    };
  }
  
  /**
   * Analyze multi-incident correlation
   * @param {Object} correlation - Multi-incident correlation
   * @returns {Promise<Object>} Analysis result
   * @private
   */
  async _analyzeMultiIncidentCorrelation(correlation) {
    // Placeholder for correlation analysis
    // In a real system, this would be complex analysis of related incidents
    return {
      id: utils.encryption.generateId(),
      correlationId: correlation.id,
      patterns: [],
      significance: 60,
      indicatesCampaign: false,
      timestamp: Date.now()
    };
  }
  
  /**
   * Create or update threat campaign
   * @param {Object} correlation - Multi-incident correlation
   * @param {Object} analysis - Correlation analysis
   * @returns {Promise<Object>} Threat campaign
   * @private
   */
  async _createOrUpdateThreatCampaign(correlation, analysis) {
    // Placeholder for campaign creation
    return {
      id: utils.encryption.generateId(),
      name: `Campaign-${utils.encryption.generateId().substring(0, 6)}`,
      description: 'Campaign detected from correlated incidents',
      relatedIncidents: correlation.incidents.map(i => i.id),
      severity: Math.max(...correlation.incidents.map(i => i.severity || 0), 70),
      status: 'active',
      createdAt: Date.now(),
      createdBy: {
        agentId: this.id,
        agentName: this.name,
        agentType: this.type
      }
    };
  }
  
  /**
   * Develop a strategic response
   * @param {Object} analysis - Advanced analysis result
   * @param {Object} issue - Original issue
   * @returns {Promise<Object>} Strategic response
   */
  async developStrategicResponse(analysis, issue) {
    try {
      this.log.info(`Developing strategic response for issue ${issue.id}`);
      
      // Basic response implementation - to be overridden in specific L3 agent subclasses
      const strategicResponse = {
        id: utils.encryption.generateId(),
        type: 'strategic_response',
        issueId: issue.id,
        analysisId: analysis.id,
        tacticalActions: [],
        strategicActions: [],
        recommendedControls: [],
        automatedExecution: false,
        timestamp: Date.now(),
        generatedBy: {
          agentId: this.id,
          agentName: this.name,
          agentType: this.type
        }
      };
      
      // Add some example tactical actions (immediate response)
      strategicResponse.tacticalActions.push({
        id: utils.encryption.generateId(),
        type: 'containment',
        description: 'Isolate affected systems',
        automatable: false,
        priority: 'high'
      });
      
      // Add some example strategic actions (longer-term)
      strategicResponse.strategicActions.push({
        id: utils.encryption.generateId(),
        type: 'policy_update',
        description: 'Review and update access control policies',
        automatable: false,
        priority: 'medium'
      });
      
      // Add recommended security controls
      strategicResponse.recommendedControls.push({
        id: 'SC-1',
        name: 'Enhanced Monitoring',
        description: 'Implement enhanced monitoring for similar activities',
        implementation: 'manual'
      });
      
      return strategicResponse;
    } catch (error) {
      this.log.error(`Error developing strategic response: ${issue.id}`, error);
      throw error;
    }
  }
  
  /**
   * Execute a strategic response
   * @param {Object} response - Strategic response to execute
   * @returns {Promise<Object>} Execution results
   */
  async executeStrategicResponse(response) {
    try {
      this.log.info(`Executing strategic response ${response.id}`);
      
      // Basic execution implementation - to be overridden in specific L3 agent subclasses
      const results = {
        responseId: response.id,
        executedActions: [],
        failedActions: [],
        timestamp: Date.now()
      };
      
      // In a real implementation, this would execute automated actions from the response
      
      return results;
    } catch (error) {
      this.log.error(`Error executing strategic response: ${response.id}`, error);
      throw error;
    }
  }
  
  /**
   * Generate a strategic advisory
   * @param {Object} analysis - Advanced analysis
   * @param {Object} response - Strategic response
   * @param {Object} executionResults - Execution results (optional)
   * @returns {Promise<Object>} Advisory
   */
  async generateStrategicAdvisory(analysis, response, executionResults) {
    try {
      this.log.info(`Generating strategic advisory for ${analysis.id}`);
      
      // Basic advisory implementation - to be overridden in specific L3 agent subclasses
      const advisory = {
        id: utils.encryption.generateId(),
        type: 'strategic_advisory',
        analysisId: analysis.id,
        responseId: response.id,
        title: `Strategic Advisory: ${analysis.type || 'Threat'} Analysis`,
        summary: `Strategic analysis and response for ${analysis.originalIssue.id}`,
        severity: analysis.severity,
        findings: analysis.findings,
        recommendations: [
          ...response.tacticalActions.map(a => ({
            type: 'tactical',
            action: a,
            status: executionResults ? 
              (executionResults.executedActions.some(ea => ea.id === a.id) ? 'executed' : 'pending') : 
              'pending'
          })),
          ...response.strategicActions.map(a => ({
            type: 'strategic',
            action: a,
            status: 'pending'
          }))
        ],
        timestamp: Date.now(),
        generatedBy: {
          agentId: this.id,
          agentName: this.name,
          agentType: this.type
        }
      };
      
      return advisory;
    } catch (error) {
      this.log.error('Error generating strategic advisory', error);
      throw error;
    }
  }
  
  /**
   * Generate a campaign advisory
   * @param {Object} campaign - Threat campaign
   * @param {Object} analysis - Campaign analysis
   * @param {Object} strategy - Campaign response strategy
   * @returns {Promise<Object>} Campaign advisory
   */
  async generateCampaignAdvisory(campaign, analysis, strategy) {
    try {
      this.log.info(`Generating campaign advisory for ${campaign.id}`);
      
      // Basic campaign advisory implementation
      const advisory = {
        id: utils.encryption.generateId(),
        type: 'campaign_advisory',
        campaignId: campaign.id,
        title: `Threat Campaign Advisory: ${campaign.name}`,
        summary: `Analysis and response strategy for threat campaign ${campaign.name}`,
        severity: analysis.severity || campaign.severity || 75,
        findings: analysis.findings || [],
        recommendations: [
          ...(strategy.tacticalActions || []).map(a => ({
            type: 'tactical',
            action: a,
            status: 'pending'
          })),
          ...(strategy.strategicActions || []).map(a => ({
            type: 'strategic',
            action: a,
            status: 'pending'
          }))
        ],
        timestamp: Date.now(),
        generatedBy: {
          agentId: this.id,
          agentName: this.name,
          agentType: this.type
        }
      };
      
      return advisory;
    } catch (error) {
      this.log.error(`Error generating campaign advisory: ${campaign.id}`, error);
      throw error;
    }
  }
  
  /**
   * Generate a policy advisory
   * @param {Object} update - Policy update
   * @param {Object} impact - Policy impact analysis
   * @param {Object} guidance - Implementation guidance
   * @returns {Promise<Object>} Policy advisory
   */
  async generatePolicyAdvisory(update, impact, guidance) {
    try {
      this.log.info(`Generating policy advisory for ${update.id}`);
      
      // Basic policy advisory implementation
      const advisory = {
        id: utils.encryption.generateId(),
        type: 'policy_advisory',
        policyUpdateId: update.id,
        title: `Policy Update Advisory: ${update.policyType}`,
        summary: `Analysis and implementation guidance for policy update ${update.policyType}`,
        impact: {
          significantImpact: impact.significantImpact,
          affectedSystems: impact.affectedSystems || [],
          affectedProcesses: impact.affectedProcesses || []
        },
        recommendations: guidance.implementationSteps || [],
        timestamp: Date.now(),
        generatedBy: {
          agentId: this.id,
          agentName: this.name,
          agentType: this.type
        }
      };
      
      return advisory;
    } catch (error) {
      this.log.error(`Error generating policy advisory: ${update.id}`, error);
      throw error;
    }
  }
  
  /**
   * Generate a correlation advisory
   * @param {Object} correlation - Multi-incident correlation
   * @param {Object} analysis - Correlation analysis
   * @returns {Promise<Object>} Correlation advisory
   */
  async generateCorrelationAdvisory(correlation, analysis) {
    try {
      this.log.info(`Generating correlation advisory for ${correlation.id}`);
      
      // Basic correlation advisory implementation
      const advisory = {
        id: utils.encryption.generateId(),
        type: 'correlation_advisory',
        correlationId: correlation.id,
        title: 'Multi-Incident Correlation Advisory',
        summary: `Analysis of correlated incidents revealing significant pattern`,
        affectedIncidents: correlation.incidents.map(i => i.id),
        patterns: analysis.patterns || [],
        significance: analysis.significance,
        recommendations: [],
        timestamp: Date.now(),
        generatedBy: {
          agentId: this.id,
          agentName: this.name,
          agentType: this.type
        }
      };
      
      return advisory;
    } catch (error) {
      this.log.error(`Error generating correlation advisory: ${correlation.id}`, error);
      throw error;
    }
  }
  
  /**
   * Analyze data and draw conclusions
   * @param {Object} data - Data to analyze
   * @returns {Promise<Object>} Analysis result
   */
  async analyze(data) {
    // For L3 agents, advanced threat analysis is the primary form of analysis
    try {
      if (data.type === 'escalated_issue') {
        return await this.advancedThreatAnalysis(data.escalation);
      }
      
      if (data.type === 'threat_campaign') {
        return await this._analyzeThreatCampaign(data.campaign);
      }
      
      // Generic analysis
      return await this.advancedThreatAnalysis(data.data || data);
    } catch (error) {
      this.log.error('Error during analysis', error);
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
      // For L3 agents, reporting is handled by specialized advisory methods
      // This is a simplified generic report for cases where specialized reports aren't used
      const report = {
        id: utils.encryption.generateId(),
        findingsId: findings.id,
        type: 'l3_analysis_report',
        severity: findings.severity || 0,
        confidence: findings.confidence,
        summary: `L3 analysis completed`,
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
   * Get analysis metrics
   * @returns {Object} Analysis metrics
   */
  get analysisMetrics() {
    return { ...this._analysisMetrics };
  }
  
  /**
   * Get oversight metrics
   * @returns {Object} Oversight metrics
   */
  get oversightMetrics() {
    return { ...this._oversightMetrics };
  }
  
  /**
   * Get active threat campaigns
   * @returns {Array} Active threat campaigns
   */
  getActiveThreatCampaigns() {
    return this._threatCampaigns.filter(campaign => campaign.status === 'active');
  }
  
  /**
   * Get recent strategic responses
   * @param {number} [limit=10] - Maximum number of responses to return
   * @returns {Array} Recent strategic responses
   */
  getRecentStrategicResponses(limit = 10) {
    // Sort by timestamp (newest first) and return limited number
    return [...this._strategicResponses]
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, limit);
  }
}

module.exports = BaseL3Agent;