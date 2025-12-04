/**
 * Incident Response Agent
 * 
 * This specialized L2 agent performs deeper investigation of security incidents,
 * coordinates containment actions, collects and analyzes forensic evidence,
 * maps incidents to MITRE ATT&CK framework, develops and executes response plans,
 * and coordinates with other L2 agents.
 */

const { BaseL2Agent } = require('../../agentic_soc_framework');
const utils = require('../../../utils');

/**
 * Incident status states
 * @type {Object}
 * @private
 */
const INCIDENT_STATUS = {
  NEW: 'new',
  INVESTIGATING: 'investigating',
  CONTAINED: 'contained',
  ERADICATED: 'eradicated',
  RECOVERING: 'recovering',
  RESOLVED: 'resolved',
  CLOSED: 'closed'
};

/**
 * Incident response phases
 * @type {Object}
 * @private
 */
const IR_PHASE = {
  PREPARATION: 'preparation',
  IDENTIFICATION: 'identification',
  CONTAINMENT: 'containment',
  ERADICATION: 'eradication',
  RECOVERY: 'recovery',
  LESSONS_LEARNED: 'lessons_learned'
};

/**
 * MITRE ATT&CK tactics
 * @type {Object}
 * @private
 */
const MITRE_TACTICS = {
  INITIAL_ACCESS: 'initial-access',
  EXECUTION: 'execution',
  PERSISTENCE: 'persistence',
  PRIVILEGE_ESCALATION: 'privilege-escalation',
  DEFENSE_EVASION: 'defense-evasion',
  CREDENTIAL_ACCESS: 'credential-access',
  DISCOVERY: 'discovery',
  LATERAL_MOVEMENT: 'lateral-movement',
  COLLECTION: 'collection',
  COMMAND_AND_CONTROL: 'command-and-control',
  EXFILTRATION: 'exfiltration',
  IMPACT: 'impact'
};

/**
 * Forensic artifact types
 * @type {Object}
 * @private
 */
const FORENSIC_ARTIFACT_TYPES = {
  PROCESS: 'process',
  FILE: 'file',
  REGISTRY: 'registry',
  NETWORK: 'network',
  MEMORY: 'memory',
  LOG: 'log',
  USER: 'user'
};

/**
 * Incident Response Agent - Specializes in investigating and responding to security incidents
 * @class IncidentResponseAgent
 * @extends BaseL2Agent
 */
class IncidentResponseAgent extends BaseL2Agent {
  /**
   * Create a new IncidentResponseAgent
   * @param {Object} config - Agent configuration
   * @param {Object} messageBus - System message bus
   */
  constructor(config = {}, messageBus = null) {
    // Add incident response specific capabilities to config
    const irConfig = {
      ...config,
      type: 'incident_response_agent',
      name: config.name || 'Incident Response Agent',
      capabilities: [
        ...(config.capabilities || []),
        'incident_investigation',
        'forensic_analysis',
        'containment_execution',
        'response_planning',
        'mitigation_coordination',
        'mitre_attack_mapping',
        'evidence_collection'
      ]
    };

    super(irConfig, messageBus);

    // Incident Response specific properties
    this._irConfig = {
      // Forensic collection configuration
      forensicCollection: {
        collectProcessInfo: config.collectProcessInfo !== false,
        collectFileInfo: config.collectFileInfo !== false,
        collectRegistryInfo: config.collectRegistryInfo !== false,
        collectNetworkInfo: config.collectNetworkInfo !== false,
        collectMemoryDumps: config.collectMemoryDumps === true,
        collectLogs: config.collectLogs !== false,
        maxArtifactsPerType: config.maxArtifactsPerType || 100
      },
      
      // Containment configuration
      containment: {
        autoContainmentEnabled: config.autoContainmentEnabled !== false,
        containmentApprovalRequired: config.containmentApprovalRequired === true,
        approvalAuthority: config.containmentApprovalAuthority || 'l3',
        maxContainmentActions: config.maxContainmentActions || 10,
        supportedActions: config.supportedContainmentActions || [
          'isolate_host', 'block_ip', 'block_domain', 'kill_process', 
          'disable_account', 'block_hash', 'quarantine_file'
        ]
      },
      
      // Investigation configuration
      investigation: {
        maxInvestigationTime: config.maxInvestigationTime || 3600, // 1 hour default
        automaticEscalationTime: config.automaticEscalationTime || 7200, // 2 hours default
        deepInvestigationThreshold: config.deepInvestigationThreshold || 70 // Severity threshold for deep investigation
      },
      
      // Collaboration configuration
      collaboration: {
        threatIntelAgent: config.threatIntelAgentId || 'threat_intelligence_agent',
        vulnManagementAgent: config.vulnManagementAgentId || 'vuln_management_agent',
        collaborationEnabled: config.collaborationEnabled !== false
      }
    };

    // Active incidents being worked on
    this._activeIncidents = {
      // Map of incident ID to incident state
      incidents: new Map(),
      maxActive: config.maxActiveIncidents || 10
    };

    // Recent incidents for correlation
    this._recentIncidents = {
      incidents: [],
      maxIncidents: config.maxRecentIncidents || 50
    };

    // Response templates for common incident types
    this._responseTemplates = config.responseTemplates || {};

    // MITRE ATT&CK knowledge base
    this._mitreAttackKb = {
      techniques: new Map(),
      lastUpdated: 0
    };

    // Initialize additional event subscriptions
    this._initializeIrEventSubscriptions();
  }

  /**
   * Initialize incident response event subscriptions
   * @private
   */
  _initializeIrEventSubscriptions() {
    if (this._messageBus) {
      // Subscribe to relevant incident response message types
      const additionalSubscriptions = [
        this.subscribeToMessages('incident:new', this._handleNewIncident.bind(this)),
        this.subscribeToMessages('incident:update', this._handleIncidentUpdate.bind(this)),
        this.subscribeToMessages('forensic:data', this._handleForensicData.bind(this)),
        this.subscribeToMessages('containment:approval', this._handleContainmentApproval.bind(this)),
        this.subscribeToMessages('containment:result', this._handleContainmentResult.bind(this)),
        this.subscribeToMessages('threat:intelligence:result', this._handleThreatIntelResult.bind(this)),
        this.subscribeToMessages('vuln:relation', this._handleVulnRelation.bind(this))
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
    
    // Incident Response agent specific initialization
    this.log.info('Initializing Incident Response Agent components');
    
    try {
      // Load response templates if needed
      if (Object.keys(this._responseTemplates).length === 0) {
        await this._loadResponseTemplates();
      }
      
      // Load MITRE ATT&CK knowledge base if needed
      if (this._mitreAttackKb.techniques.size === 0) {
        await this._loadMitreAttackKb();
      }
      
      this.log.info('Incident Response Agent initialization complete');
    } catch (error) {
      this.log.error('Error during Incident Response Agent initialization', error);
      throw error;
    }
  }

  /**
   * Load response templates
   * @returns {Promise<void>}
   * @private
   */
  async _loadResponseTemplates() {
    try {
      this.log.info('Loading incident response templates');
      
      // In a real implementation, this would load from a database or config file
      // Example templates for common incident types
      this._responseTemplates = {
        'malware': {
          phases: [
            {
              name: IR_PHASE.CONTAINMENT,
              steps: [
                { action: 'isolate_host', description: 'Isolate infected host from network' },
                { action: 'block_c2', description: 'Block command and control domains/IPs' },
                { action: 'kill_process', description: 'Terminate malicious processes' }
              ]
            },
            {
              name: IR_PHASE.ERADICATION,
              steps: [
                { action: 'delete_malware', description: 'Remove malicious files' },
                { action: 'scan_system', description: 'Perform deep scan for additional artifacts' },
                { action: 'patch_vulnerability', description: 'Apply patches if infection vector known' }
              ]
            },
            {
              name: IR_PHASE.RECOVERY,
              steps: [
                { action: 'restore_from_backup', description: 'Restore critical files if needed' },
                { action: 'validate_clean', description: 'Validate system is clean of infection' },
                { action: 'return_to_production', description: 'Return system to production' }
              ]
            }
          ]
        },
        'phishing': {
          phases: [
            {
              name: IR_PHASE.CONTAINMENT,
              steps: [
                { action: 'block_urls', description: 'Block phishing URLs in email security' },
                { action: 'quarantine_email', description: 'Remove phishing email from mailboxes' },
                { action: 'reset_credentials', description: 'Reset credentials for affected users' }
              ]
            },
            {
              name: IR_PHASE.ERADICATION,
              steps: [
                { action: 'email_search', description: 'Search for similar emails across organization' },
                { action: 'block_sender', description: 'Block malicious sender domains' }
              ]
            },
            {
              name: IR_PHASE.RECOVERY,
              steps: [
                { action: 'user_awareness', description: 'Notify users of phishing campaign' },
                { action: 'monitor_activity', description: 'Monitor for suspicious authentication activity' }
              ]
            }
          ]
        },
        'unauthorized_access': {
          phases: [
            {
              name: IR_PHASE.CONTAINMENT,
              steps: [
                { action: 'disable_account', description: 'Disable compromised accounts' },
                { action: 'block_ip', description: 'Block source IP addresses' },
                { action: 'session_termination', description: 'Terminate active sessions' }
              ]
            },
            {
              name: IR_PHASE.ERADICATION,
              steps: [
                { action: 'credential_reset', description: 'Reset credentials for all affected accounts' },
                { action: 'review_privileges', description: 'Review and adjust access privileges' },
                { action: 'enable_mfa', description: 'Enable multi-factor authentication if available' }
              ]
            },
            {
              name: IR_PHASE.RECOVERY,
              steps: [
                { action: 'access_review', description: 'Perform access review for affected systems' },
                { action: 'activity_monitoring', description: 'Increase monitoring for affected accounts' }
              ]
            }
          ]
        }
        // Additional templates would be defined here
      };
      
      this.log.info(`Loaded ${Object.keys(this._responseTemplates).length} response templates`);
    } catch (error) {
      this.log.error('Failed to load response templates', error);
      throw error;
    }
  }

  /**
   * Load MITRE ATT&CK knowledge base
   * @returns {Promise<void>}
   * @private
   */
  async _loadMitreAttackKb() {
    try {
      this.log.info('Loading MITRE ATT&CK knowledge base');
      
      // In a real implementation, this would load from MITRE ATT&CK API or local database
      // Simplified implementation with a few common techniques
      
      const techniques = [
        {
          id: 'T1566',
          name: 'Phishing',
          tactic: MITRE_TACTICS.INITIAL_ACCESS,
          description: 'Phishing is a method to deliver malware or collect credentials via email or other messaging platforms.',
          detection: 'Monitor for suspicious email attachments, links, and user reports of phishing.',
          mitigation: 'User training, email filtering, and attachment scanning.'
        },
        {
          id: 'T1133',
          name: 'External Remote Services',
          tactic: MITRE_TACTICS.INITIAL_ACCESS,
          description: 'Adversaries may leverage external-facing remote services to gain initial access to a network.',
          detection: 'Monitor for authentication attempts from unusual sources or at unusual times.',
          mitigation: 'Implement MFA, restrict access by IP, and monitor logs.'
        },
        {
          id: 'T1078',
          name: 'Valid Accounts',
          tactic: MITRE_TACTICS.INITIAL_ACCESS,
          description: 'Adversaries may steal or otherwise obtain credentials to gain access.',
          detection: 'Monitor for authentication from new locations or unusual times.',
          mitigation: 'Implement MFA, conduct regular access reviews, and strong password policies.'
        },
        {
          id: 'T1059',
          name: 'Command and Scripting Interpreter',
          tactic: MITRE_TACTICS.EXECUTION,
          description: 'Adversaries may abuse command and script interpreters to execute commands.',
          detection: 'Monitor for suspicious command-line arguments and script execution.',
          mitigation: 'Application control, script block logging, and restricting interpreter use.'
        },
        {
          id: 'T1053',
          name: 'Scheduled Task/Job',
          tactic: MITRE_TACTICS.EXECUTION,
          description: 'Adversaries may use task scheduling for execution, persistence, and privilege escalation.',
          detection: 'Monitor for creation of new scheduled tasks, especially with unusual command lines.',
          mitigation: 'Restrict task creation to administrators and monitor scheduled task creation.'
        },
        {
          id: 'T1136',
          name: 'Create Account',
          tactic: MITRE_TACTICS.PERSISTENCE,
          description: 'Adversaries may create new accounts to maintain access.',
          detection: 'Monitor for new account creation, especially with admin privileges.',
          mitigation: 'Enforce account management policies and audit account creation.'
        },
        {
          id: 'T1098',
          name: 'Account Manipulation',
          tactic: MITRE_TACTICS.PERSISTENCE,
          description: 'Adversaries may manipulate accounts to maintain access.',
          detection: 'Monitor for modifications to account properties, especially privilege changes.',
          mitigation: 'Audit account changes and enforce principle of least privilege.'
        },
        {
          id: 'T1068',
          name: 'Exploitation for Privilege Escalation',
          tactic: MITRE_TACTICS.PRIVILEGE_ESCALATION,
          description: 'Adversaries may exploit software vulnerabilities to gain higher privileges.',
          detection: 'Monitor for unexpected privilege changes and exploitation of known vulnerabilities.',
          mitigation: 'Keep systems patched and implement application control.'
        },
        {
          id: 'T1218',
          name: 'System Binary Proxy Execution',
          tactic: MITRE_TACTICS.DEFENSE_EVASION,
          description: 'Adversaries may use trusted system binaries to proxy execution of malicious code.',
          detection: 'Monitor for unusual parameters or execution contexts for system binaries.',
          mitigation: 'Use application control and monitor command-line arguments.'
        },
        {
          id: 'T1003',
          name: 'OS Credential Dumping',
          tactic: MITRE_TACTICS.CREDENTIAL_ACCESS,
          description: 'Adversaries may attempt to dump credentials from operating system repositories.',
          detection: 'Monitor for processes accessing credential repositories or using credential dumping tools.',
          mitigation: 'Limit credential caching and use protected authentication systems.'
        },
        {
          id: 'T1087',
          name: 'Account Discovery',
          tactic: MITRE_TACTICS.DISCOVERY,
          description: 'Adversaries may enumerate accounts to identify high-value targets.',
          detection: 'Monitor for account enumeration commands and tools.',
          mitigation: 'Limit account discovery capabilities to authorized users.'
        },
        {
          id: 'T1021',
          name: 'Remote Services',
          tactic: MITRE_TACTICS.LATERAL_MOVEMENT,
          description: 'Adversaries may use remote services to move laterally within an environment.',
          detection: 'Monitor for unusual remote service usage, especially from unexpected systems.',
          mitigation: 'Implement network segmentation and MFA for remote services.'
        },
        {
          id: 'T1560',
          name: 'Archive Collected Data',
          tactic: MITRE_TACTICS.COLLECTION,
          description: 'Adversaries may archive data to facilitate exfiltration.',
          detection: 'Monitor for unexpected archiving of sensitive data.',
          mitigation: 'Monitor for unusual archive creation and implement data loss prevention.'
        },
        {
          id: 'T1071',
          name: 'Application Layer Protocol',
          tactic: MITRE_TACTICS.COMMAND_AND_CONTROL,
          description: 'Adversaries may use standard application layer protocols for command and control.',
          detection: 'Monitor for unusual protocol behavior and unexpected connections.',
          mitigation: 'Implement network monitoring and SSL/TLS inspection where appropriate.'
        },
        {
          id: 'T1048',
          name: 'Exfiltration Over Alternative Protocol',
          tactic: MITRE_TACTICS.EXFILTRATION,
          description: 'Adversaries may use alternative protocols to exfiltrate data.',
          detection: 'Monitor for unusual outbound connections, especially over non-standard protocols.',
          mitigation: 'Implement egress filtering and data loss prevention.'
        },
        {
          id: 'T1486',
          name: 'Data Encrypted for Impact',
          tactic: MITRE_TACTICS.IMPACT,
          description: 'Adversaries may encrypt data to disrupt operations (ransomware).',
          detection: 'Monitor for mass file encryption activity and ransom notes.',
          mitigation: 'Maintain backups and implement application control.'
        }
      ];
      
      // Load techniques into the knowledge base
      for (const technique of techniques) {
        this._mitreAttackKb.techniques.set(technique.id, technique);
      }
      
      this._mitreAttackKb.lastUpdated = Date.now();
      
      this.log.info(`Loaded ${this._mitreAttackKb.techniques.size} MITRE ATT&CK techniques`);
    } catch (error) {
      this.log.error('Failed to load MITRE ATT&CK knowledge base', error);
      throw error;
    }
  }

  /**
   * Handle a new incident
   * @param {Object} message - Incident message
   * @private
   */
  _handleNewIncident(message) {
    try {
      const incident = message.data;
      
      this.log.info(`Received new incident: ${incident.id} - ${incident.type || 'Unknown type'}`);
      
      // Check if we have capacity to handle the incident
      if (this._activeIncidents.incidents.size >= this._activeIncidents.maxActive) {
        this.log.warn(`Active incident capacity reached (${this._activeIncidents.maxActive}). Queuing incident.`);
      }
      
      // Add as a task to be processed
      this.addTask({
        data: {
          type: 'new_incident',
          incident
        },
        priority: this._determineIncidentPriority(incident)
      });
    } catch (error) {
      this.log.error('Error handling new incident', error);
    }
  }

  /**
   * Handle an incident update
   * @param {Object} message - Incident update message
   * @private
   */
  _handleIncidentUpdate(message) {
    try {
      const update = message.data;
      
      this.log.debug(`Received incident update: ${update.incidentId} - ${update.updateType}`);
      
      // Only process if we're handling this incident
      if (this._activeIncidents.incidents.has(update.incidentId)) {
        // Add as a task
        this.addTask({
          data: {
            type: 'incident_update',
            update
          },
          priority: update.priority || this._getIncidentPriority(update.incidentId)
        });
      } else {
        this.log.debug(`Ignoring update for non-active incident: ${update.incidentId}`);
      }
    } catch (error) {
      this.log.error('Error handling incident update', error);
    }
  }

  /**
   * Handle forensic data
   * @param {Object} message - Forensic data message
   * @private
   */
  _handleForensicData(message) {
    try {
      const forensicData = message.data;
      
      this.log.debug(`Received forensic data for incident: ${forensicData.incidentId} - ${forensicData.type}`);
      
      // Only process if we're handling this incident
      if (this._activeIncidents.incidents.has(forensicData.incidentId)) {
        // Add as a task
        this.addTask({
          data: {
            type: 'forensic_data',
            forensicData
          },
          priority: this._getIncidentPriority(forensicData.incidentId)
        });
      } else {
        this.log.debug(`Ignoring forensic data for non-active incident: ${forensicData.incidentId}`);
      }
    } catch (error) {
      this.log.error('Error handling forensic data', error);
    }
  }

  /**
   * Handle containment approval
   * @param {Object} message - Approval message
   * @private
   */
  _handleContainmentApproval(message) {
    try {
      const approval = message.data;
      
      this.log.info(`Received containment approval for incident: ${approval.incidentId} - ${approval.approved ? 'Approved' : 'Rejected'}`);
      
      // Only process if we're handling this incident
      if (this._activeIncidents.incidents.has(approval.incidentId)) {
        // Add as a task
        this.addTask({
          data: {
            type: 'containment_approval',
            approval
          },
          priority: this._getIncidentPriority(approval.incidentId)
        });
      } else {
        this.log.debug(`Ignoring containment approval for non-active incident: ${approval.incidentId}`);
      }
    } catch (error) {
      this.log.error('Error handling containment approval', error);
    }
  }

  /**
   * Handle containment action result
   * @param {Object} message - Containment result message
   * @private
   */
  _handleContainmentResult(message) {
    try {
      const result = message.data;
      
      this.log.info(`Received containment result for incident: ${result.incidentId} - Action: ${result.action} - Success: ${result.success}`);
      
      // Only process if we're handling this incident
      if (this._activeIncidents.incidents.has(result.incidentId)) {
        // Add as a task
        this.addTask({
          data: {
            type: 'containment_result',
            result
          },
          priority: this._getIncidentPriority(result.incidentId)
        });
      } else {
        this.log.debug(`Ignoring containment result for non-active incident: ${result.incidentId}`);
      }
    } catch (error) {
      this.log.error('Error handling containment result', error);
    }
  }

  /**
   * Handle threat intelligence result
   * @param {Object} message - Threat intel message
   * @private
   */
  _handleThreatIntelResult(message) {
    try {
      const threatIntel = message.data;
      
      this.log.info(`Received threat intel result for incident: ${threatIntel.incidentId}`);
      
      // Only process if we're handling this incident
      if (this._activeIncidents.incidents.has(threatIntel.incidentId)) {
        // Add as a task
        this.addTask({
          data: {
            type: 'threat_intel_result',
            threatIntel
          },
          priority: this._getIncidentPriority(threatIntel.incidentId)
        });
      } else {
        this.log.debug(`Ignoring threat intel for non-active incident: ${threatIntel.incidentId}`);
      }
    } catch (error) {
      this.log.error('Error handling threat intel result', error);
    }
  }

  /**
   * Handle vulnerability relation
   * @param {Object} message - Vulnerability relation message
   * @private
   */
  _handleVulnRelation(message) {
    try {
      const vulnRelation = message.data;
      
      this.log.info(`Received vulnerability relation for incident: ${vulnRelation.incidentId}`);
      
      // Only process if we're handling this incident
      if (this._activeIncidents.incidents.has(vulnRelation.incidentId)) {
        // Add as a task
        this.addTask({
          data: {
            type: 'vuln_relation',
            vulnRelation
          },
          priority: this._getIncidentPriority(vulnRelation.incidentId)
        });
      } else {
        this.log.debug(`Ignoring vulnerability relation for non-active incident: ${vulnRelation.incidentId}`);
      }
    } catch (error) {
      this.log.error('Error handling vulnerability relation', error);
    }
  }

  /**
   * Process incoming data
   * @param {Object} data - Data to process
   * @returns {Promise<Object>} Processing result
   */
  async process(data) {
    switch (data.type) {
      case 'new_incident':
        return await this._processNewIncident(data.incident);
      case 'incident_update':
        return await this._processIncidentUpdate(data.update);
      case 'forensic_data':
        return await this._processForensicData(data.forensicData);
      case 'containment_approval':
        return await this._processContainmentApproval(data.approval);
      case 'containment_result':
        return await this._processContainmentResult(data.result);
      case 'threat_intel_result':
        return await this._processThreatIntelResult(data.threatIntel);
      case 'vuln_relation':
        return await this._processVulnRelation(data.vulnRelation);
      case 'escalated_issue':
        // This comes from L1 agents
        return await this._processEscalatedIssue(data.escalation);
      default:
        // For other data types, use the parent class implementation
        return await super.process(data);
    }
  }

  /**
   * Determine incident priority
   * @param {Object} incident - Incident to evaluate
   * @returns {number} Priority (0-100)
   * @private
   */
  _determineIncidentPriority(incident) {
    // Start with severity if available
    let priority = incident.severity || 50;
    
    // Adjust for critical assets
    if (incident.affectedAssets?.some(asset => asset.criticality === 'critical')) {
      priority += 20;
    }
    
    // Adjust for data sensitivity
    if (incident.dataSensitivity === 'high' || incident.impactsCustomerData) {
      priority += 15;
    }
    
    // Adjust for business impact
    if (incident.businessImpact === 'high') {
      priority += 10;
    }
    
    // Adjust for active exploitation
    if (incident.exploitationStatus === 'active') {
      priority += 20;
    }
    
    // Ensure priority is within bounds
    return Math.min(Math.max(priority, 0), 100);
  }

  /**
   * Get priority for an active incident
   * @param {string} incidentId - Incident ID
   * @returns {number} Priority (0-100)
   * @private
   */
  _getIncidentPriority(incidentId) {
    // Get the incident state from active incidents
    const incidentState = this._activeIncidents.incidents.get(incidentId);
    
    if (incidentState) {
      return incidentState.priority || 50;
    }
    
    // Default priority if not found
    return 50;
  }

  /**
   * Process a new incident
   * @param {Object} incident - Incident to process
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processNewIncident(incident) {
    this.log.info(`Processing new incident: ${incident.id} - ${incident.type || 'Unknown type'}`);
    
    try {
      // Initialize incident state
      const incidentState = {
        id: incident.id,
        incident: incident,
        status: INCIDENT_STATUS.NEW,
        priority: this._determineIncidentPriority(incident),
        startTime: Date.now(),
        lastUpdated: Date.now(),
        currentPhase: IR_PHASE.IDENTIFICATION,
        phases: {},
        investigationResults: {},
        forensicArtifacts: {},
        containmentActions: [],
        pendingContainmentActions: [],
        mitreTactics: new Set(),
        mitreTechniques: new Set(),
        collaborationRequests: [],
        responseActions: []
      };
      
      // Add to active incidents
      this._activeIncidents.incidents.set(incident.id, incidentState);
      
      // Add to recent incidents (for correlation)
      this._addToRecentIncidents(incident);
      
      // Start the investigation
      const investigationResult = await this.investigateIncident(incident);
      
      // Update the incident state with investigation results
      incidentState.investigationResults = investigationResult;
      incidentState.status = INCIDENT_STATUS.INVESTIGATING;
      incidentState.lastUpdated = Date.now();
      
      // Map to MITRE ATT&CK
      const mitreMapping = await this._mapToMitreAttack(incident, investigationResult);
      incidentState.mitreTactics = new Set(mitreMapping.tactics);
      incidentState.mitreTechniques = new Set(mitreMapping.techniques);
      
      // Request forensic artifacts
      await this._requestForensicArtifacts(incidentState);
      
      // Develop a response plan
      const responsePlan = await this._developResponsePlan(incidentState);
      incidentState.responsePlan = responsePlan;
      
      // Determine if containment is needed immediately
      if (responsePlan.immediateContainment && responsePlan.containmentActions.length > 0) {
        // Execute or request approval for containment actions
        await this._handleContainment(incidentState, responsePlan.containmentActions);
      }
      
      // Collaborate with other agents if needed
      if (this._irConfig.collaboration.collaborationEnabled) {
        await this._collaborateWithOtherAgents(incidentState);
      }
      
      // Update incident state
      this._activeIncidents.incidents.set(incident.id, incidentState);
      
      // Publish incident status update
      await this._publishIncidentUpdate(incidentState);
      
      return {
        status: 'investigating',
        incidentId: incident.id,
        investigationResults: investigationResult,
        mitreTactics: [...incidentState.mitreTactics],
        mitreTechniques: [...incidentState.mitreTechniques],
        responsePlan: incidentState.responsePlan
      };
    } catch (error) {
      this.log.error(`Error processing new incident: ${incident.id}`, error);
      
      // Remove from active incidents if error
      this._activeIncidents.incidents.delete(incident.id);
      
      throw error;
    }
  }

  /**
   * Add an incident to recent incidents
   * @param {Object} incident - Incident to add
   * @private
   */
  _addToRecentIncidents(incident) {
    // Add to the front of the array (newest first)
    this._recentIncidents.incidents.unshift(incident);
    
    // Trim the array if it exceeds max size
    if (this._recentIncidents.incidents.length > this._recentIncidents.maxIncidents) {
      this._recentIncidents.incidents = this._recentIncidents.incidents.slice(0, this._recentIncidents.maxIncidents);
    }
  }

  /**
   * Investigate an incident
   * @param {Object} incident - Incident to investigate
   * @returns {Promise<Object>} Investigation results
   */
  async investigateIncident(incident) {
    try {
      this.log.info(`Investigating incident: ${incident.id}`);
      
      // Create base investigation results
      const investigation = {
        id: utils.encryption.generateId(),
        incidentId: incident.id,
        startTime: Date.now(),
        findings: [],
        indicators: [],
        affectedSystems: [],
        affectedUsers: [],
        timeline: [],
        rootCause: null,
        severity: incident.severity || 50,
        confidence: 70, // Initial confidence level
        status: 'in_progress'
      };
      
      // Extract initial indicators from incident
      investigation.indicators = await this._extractIndicators(incident);
      
      // Identify affected systems from incident
      investigation.affectedSystems = await this._identifyAffectedSystems(incident);
      
      // Identify affected users from incident
      investigation.affectedUsers = await this._identifyAffectedUsers(incident);
      
      // Reconstruct timeline from incident data
      investigation.timeline = await this._reconstructTimeline(incident);
      
      // Perform initial root cause analysis
      investigation.rootCause = await this._determineInitialRootCause(incident);
      
      // Add initial findings
      investigation.findings.push({
        type: 'initial_analysis',
        summary: 'Initial analysis of incident data',
        details: `Analysis of ${incident.type || 'security'} incident based on initial data`,
        confidence: investigation.confidence,
        timestamp: Date.now()
      });
      
      // Complete the investigation
      investigation.endTime = Date.now();
      investigation.duration = investigation.endTime - investigation.startTime;
      investigation.status = 'completed';
      
      return investigation;
    } catch (error) {
      this.log.error(`Error investigating incident: ${incident.id}`, error);
      throw error;
    }
  }

  /**
   * Extract indicators from an incident
   * @param {Object} incident - Incident to extract indicators from
   * @returns {Promise<Array>} Extracted indicators
   * @private
   */
  async _extractIndicators(incident) {
    const indicators = [];
    
    // Process source-specific indicators
    switch (incident.source) {
      case 'email_triage_agent':
        if (incident.sourceData) {
          // Extract IOCs from email
          if (incident.sourceData.iocs) {
            indicators.push(...incident.sourceData.iocs);
          }
          
          // Extract sender info
          if (incident.sourceData.sender) {
            indicators.push({
              type: 'email-address',
              value: incident.sourceData.sender,
              source: 'email_sender'
            });
          }
          
          // Extract embedded URLs
          if (incident.sourceData.urls) {
            for (const url of incident.sourceData.urls) {
              indicators.push({
                type: 'url',
                value: url,
                source: 'email_body'
              });
            }
          }
          
          // Extract attachment info
          if (incident.sourceData.attachments) {
            for (const attachment of incident.sourceData.attachments) {
              if (attachment.hash) {
                indicators.push({
                  type: 'file-hash',
                  value: attachment.hash,
                  source: 'email_attachment'
                });
              }
            }
          }
        }
        break;
        
      case 'alert_triage_agent':
        if (incident.sourceData) {
          // Extract process info
          if (incident.sourceData.processName) {
            indicators.push({
              type: 'process-name',
              value: incident.sourceData.processName,
              source: 'alert'
            });
          }
          
          // Extract command line
          if (incident.sourceData.commandLine) {
            indicators.push({
              type: 'command-line',
              value: incident.sourceData.commandLine,
              source: 'alert'
            });
          }
          
          // Extract file hash
          if (incident.sourceData.fileHash) {
            indicators.push({
              type: 'file-hash',
              value: incident.sourceData.fileHash,
              source: 'alert'
            });
          }
          
          // Extract hostname/IP
          if (incident.sourceData.hostname) {
            indicators.push({
              type: 'hostname',
              value: incident.sourceData.hostname,
              source: 'alert'
            });
          }
          
          if (incident.sourceData.ipAddress) {
            indicators.push({
              type: 'ip-address',
              value: incident.sourceData.ipAddress,
              source: 'alert'
            });
          }
        }
        break;
        
      case 'vuln_scanner_agent':
        if (incident.sourceData) {
          // Extract vulnerability info
          if (incident.sourceData.cve) {
            indicators.push({
              type: 'cve',
              value: incident.sourceData.cve,
              source: 'vulnerability'
            });
          }
          
          // Extract hostname/IP
          if (incident.sourceData.hostname) {
            indicators.push({
              type: 'hostname',
              value: incident.sourceData.hostname,
              source: 'vulnerability'
            });
          }
          
          if (incident.sourceData.ipAddress) {
            indicators.push({
              type: 'ip-address',
              value: incident.sourceData.ipAddress,
              source: 'vulnerability'
            });
          }
        }
        break;
        
      default:
        // Generic indicator extraction
        if (incident.indicators) {
          indicators.push(...incident.indicators);
        }
    }
    
    // Extract IOCs from triage result if available
    if (incident.triageResult && incident.triageResult.iocs) {
      indicators.push(...incident.triageResult.iocs);
    }
    
    return indicators;
  }

  /**
   * Identify affected systems from an incident
   * @param {Object} incident - Incident data
   * @returns {Promise<Array>} Affected systems
   * @private
   */
  async _identifyAffectedSystems(incident) {
    const systems = [];
    
    // Extract from sourceData if available
    if (incident.sourceData) {
      const hostname = incident.sourceData.hostname;
      const ipAddress = incident.sourceData.ipAddress;
      
      if (hostname || ipAddress) {
        systems.push({
          hostname: hostname || 'unknown',
          ipAddress: ipAddress || 'unknown',
          source: incident.source,
          firstSeen: incident.timestamp || Date.now(),
          lastSeen: incident.timestamp || Date.now(),
          details: incident.sourceData
        });
      }
    }
    
    // Extract from affected assets if available
    if (incident.affectedAssets) {
      for (const asset of incident.affectedAssets) {
        systems.push({
          hostname: asset.hostname || 'unknown',
          ipAddress: asset.ipAddress || 'unknown',
          criticality: asset.criticality || 'medium',
          businessUnit: asset.businessUnit || 'unknown',
          owner: asset.owner || 'unknown',
          firstSeen: incident.timestamp || Date.now(),
          lastSeen: incident.timestamp || Date.now()
        });
      }
    }
    
    return systems;
  }

  /**
   * Identify affected users from an incident
   * @param {Object} incident - Incident data
   * @returns {Promise<Array>} Affected users
   * @private
   */
  async _identifyAffectedUsers(incident) {
    const users = [];
    
    // Extract from sourceData if available
    if (incident.sourceData && incident.sourceData.username) {
      users.push({
        username: incident.sourceData.username,
        source: incident.source,
        firstSeen: incident.timestamp || Date.now(),
        lastSeen: incident.timestamp || Date.now(),
        details: {}
      });
    }
    
    // Extract from recipients if it's an email incident
    if (incident.source === 'email_triage_agent' && 
        incident.sourceData && 
        incident.sourceData.recipient) {
      
      const recipients = incident.sourceData.recipient.split(',');
      for (const recipient of recipients) {
        users.push({
          username: recipient.trim(),
          email: recipient.trim(),
          source: 'email_recipient',
          firstSeen: incident.timestamp || Date.now(),
          lastSeen: incident.timestamp || Date.now(),
          details: {}
        });
      }
    }
    
    // Extract from affected users if available
    if (incident.affectedUsers) {
      for (const user of incident.affectedUsers) {
        users.push({
          username: user.username || user.name || 'unknown',
          email: user.email || 'unknown',
          department: user.department || 'unknown',
          firstSeen: incident.timestamp || Date.now(),
          lastSeen: incident.timestamp || Date.now()
        });
      }
    }
    
    return users;
  }

  /**
   * Reconstruct timeline from incident data
   * @param {Object} incident - Incident data
   * @returns {Promise<Array>} Timeline events
   * @private
   */
  async _reconstructTimeline(incident) {
    const timeline = [];
    
    // Initial detection time
    timeline.push({
      timestamp: incident.timestamp || Date.now(),
      event: 'Incident Detected',
      source: incident.source || 'unknown',
      details: `${incident.type || 'Security'} incident detected by ${incident.source || 'unknown'}`
    });
    
    // Add additional events from the incident if available
    if (incident.events) {
      timeline.push(...incident.events);
    }
    
    // Sort timeline by timestamp
    timeline.sort((a, b) => a.timestamp - b.timestamp);
    
    return timeline;
  }

  /**
   * Determine initial root cause from incident data
   * @param {Object} incident - Incident data
   * @returns {Promise<Object>} Root cause analysis
   * @private
   */
  async _determineInitialRootCause(incident) {
    // Source-specific root cause analysis
    switch (incident.source) {
      case 'email_triage_agent':
        return {
          cause: 'Phishing Email',
          vector: 'Email',
          description: `${incident.type || 'Phishing'} email was received and triggered detection`,
          confidence: 70,
          details: {
            senderDomain: incident.sourceData?.sender?.split('@')[1] || 'unknown'
          }
        };
        
      case 'alert_triage_agent':
        return {
          cause: incident.sourceData?.alertType || 'Security Alert',
          vector: incident.sourceData?.mitreTactic || 'Unknown',
          description: `Security alert was triggered by ${incident.sourceData?.processName || 'unknown process'}`,
          confidence: 60,
          details: {
            process: incident.sourceData?.processName || 'unknown',
            command: incident.sourceData?.commandLine || 'unknown'
          }
        };
        
      case 'vuln_scanner_agent':
        return {
          cause: 'Vulnerability Exploitation',
          vector: 'Unpatched Vulnerability',
          description: `Exploitation of vulnerability ${incident.sourceData?.cve || 'unknown'}`,
          confidence: 50,
          details: {
            cve: incident.sourceData?.cve || 'unknown',
            systems: [incident.sourceData?.hostname || 'unknown']
          }
        };
        
      default:
        return {
          cause: incident.type || 'Unknown',
          vector: 'Unknown',
          description: 'Initial root cause not determined',
          confidence: 30,
          details: {}
        };
    }
  }

  /**
   * Map incident to MITRE ATT&CK framework
   * @param {Object} incident - Incident data
   * @param {Object} investigation - Investigation results
   * @returns {Promise<Object>} MITRE ATT&CK mapping
   * @private
   */
  async _mapToMitreAttack(incident, investigation) {
    const mapping = {
      tactics: [],
      techniques: [],
      procedures: [],
      confidence: 0
    };
    
    // Check if the incident already has MITRE mapping
    if (incident.mitreTactic) {
      mapping.tactics.push(incident.mitreTactic);
      mapping.confidence = Math.max(mapping.confidence, 70);
    }
    
    if (incident.mitreTechnique) {
      mapping.techniques.push(incident.mitreTechnique);
      mapping.confidence = Math.max(mapping.confidence, 70);
    }
    
    // Map from source-specific data
    switch (incident.source) {
      case 'email_triage_agent':
        // Phishing is typically Initial Access T1566
        mapping.tactics.push(MITRE_TACTICS.INITIAL_ACCESS);
        mapping.techniques.push('T1566');
        
        // If there are attachments, might also have execution
        if (incident.sourceData?.attachments?.length > 0) {
          mapping.tactics.push(MITRE_TACTICS.EXECUTION);
          
          // Common execution techniques for email attachments
          if (incident.sourceData.attachments.some(a => a.filename?.endsWith('.doc') || a.filename?.endsWith('.docx'))) {
            mapping.techniques.push('T1204'); // User Execution: Malicious File
          }
          
          if (incident.sourceData.attachments.some(a => a.filename?.endsWith('.js') || a.filename?.endsWith('.vbs'))) {
            mapping.techniques.push('T1059'); // Command and Scripting Interpreter
          }
        }
        
        // If there are URLs, might have execution via links
        if (incident.sourceData?.urls?.length > 0) {
          mapping.tactics.push(MITRE_TACTICS.EXECUTION);
          mapping.techniques.push('T1204'); // User Execution: Malicious Link
        }
        
        mapping.confidence = 75;
        break;
        
      case 'alert_triage_agent':
        if (incident.sourceData?.mitreTactic) {
          mapping.tactics.push(incident.sourceData.mitreTactic);
        }
        
        if (incident.sourceData?.mitreTechnique) {
          mapping.techniques.push(incident.sourceData.mitreTechnique);
        } else {
          // Try to infer based on process and command line
          if (incident.sourceData?.processName) {
            const process = incident.sourceData.processName.toLowerCase();
            
            if (process.includes('mimikatz') || process.includes('procdump') || process === 'lsass.exe') {
              mapping.tactics.push(MITRE_TACTICS.CREDENTIAL_ACCESS);
              mapping.techniques.push('T1003'); // OS Credential Dumping
            } else if (process === 'psexec.exe' || process === 'wmic.exe') {
              mapping.tactics.push(MITRE_TACTICS.LATERAL_MOVEMENT);
              mapping.techniques.push('T1021'); // Remote Services
            } else if (process === 'reg.exe' && incident.sourceData?.commandLine?.includes('add')) {
              mapping.tactics.push(MITRE_TACTICS.PERSISTENCE);
              mapping.techniques.push('T1112'); // Modify Registry
            }
          }
        }
        
        mapping.confidence = 65;
        break;
        
      case 'vuln_scanner_agent':
        // Vulnerability exploitation could be initial access or privilege escalation
        mapping.tactics.push(MITRE_TACTICS.INITIAL_ACCESS);
        mapping.tactics.push(MITRE_TACTICS.PRIVILEGE_ESCALATION);
        mapping.techniques.push('T1190'); // Exploit Public-Facing Application
        mapping.techniques.push('T1068'); // Exploitation for Privilege Escalation
        
        mapping.confidence = 55;
        break;
        
      default:
        // If no source-specific mapping, set low confidence
        mapping.confidence = 30;
    }
    
    // Deduplicate tactics and techniques
    mapping.tactics = [...new Set(mapping.tactics)];
    mapping.techniques = [...new Set(mapping.techniques)];
    
    return mapping;
  }

  /**
   * Request forensic artifacts for an incident
   * @param {Object} incidentState - Incident state
   * @returns {Promise<void>}
   * @private
   */
  async _requestForensicArtifacts(incidentState) {
    try {
      this.log.info(`Requesting forensic artifacts for incident: ${incidentState.id}`);
      
      // Get the systems to collect artifacts from
      const systems = incidentState.investigationResults.affectedSystems;
      
      if (!systems || systems.length === 0) {
        this.log.warn(`No affected systems identified for incident: ${incidentState.id}. Skipping forensic collection.`);
        return;
      }
      
      // Define artifact types to collect based on configuration
      const artifactTypes = [];
      
      if (this._irConfig.forensicCollection.collectProcessInfo) {
        artifactTypes.push(FORENSIC_ARTIFACT_TYPES.PROCESS);
      }
      
      if (this._irConfig.forensicCollection.collectFileInfo) {
        artifactTypes.push(FORENSIC_ARTIFACT_TYPES.FILE);
      }
      
      if (this._irConfig.forensicCollection.collectRegistryInfo) {
        artifactTypes.push(FORENSIC_ARTIFACT_TYPES.REGISTRY);
      }
      
      if (this._irConfig.forensicCollection.collectNetworkInfo) {
        artifactTypes.push(FORENSIC_ARTIFACT_TYPES.NETWORK);
      }
      
      if (this._irConfig.forensicCollection.collectMemoryDumps) {
        artifactTypes.push(FORENSIC_ARTIFACT_TYPES.MEMORY);
      }
      
      if (this._irConfig.forensicCollection.collectLogs) {
        artifactTypes.push(FORENSIC_ARTIFACT_TYPES.LOG);
      }
      
      // Request artifacts from each affected system
      for (const system of systems) {
        // In a real implementation, this would submit collection requests to a forensic system
        // Here we'll publish a message requesting collection
        if (this._messageBus) {
          this._messageBus.publishMessage({
            type: 'forensic:collect:request',
            data: {
              incidentId: incidentState.id,
              system: system,
              artifactTypes: artifactTypes,
              maxArtifactsPerType: this._irConfig.forensicCollection.maxArtifactsPerType,
              requestedBy: {
                agentId: this.id,
                agentName: this.name,
                agentType: this.type
              },
              priority: incidentState.priority,
              timestamp: Date.now()
            }
          });
        }
        
        this.log.info(`Requested forensic artifacts from ${system.hostname || system.ipAddress} for incident: ${incidentState.id}`);
      }
      
      // Initialize forensic artifacts in incident state
      incidentState.forensicArtifacts = {
        requested: artifactTypes,
        systems: systems.map(s => s.hostname || s.ipAddress),
        artifacts: {},
        status: 'requested',
        requestTime: Date.now()
      };
    } catch (error) {
      this.log.error(`Error requesting forensic artifacts for incident: ${incidentState.id}`, error);
    }
  }

  /**
   * Develop response plan for an incident
   * @param {Object} incidentState - Incident state
   * @returns {Promise<Object>} Response plan
   * @private
   */
  async _developResponsePlan(incidentState) {
    try {
      this.log.info(`Developing response plan for incident: ${incidentState.id}`);
      
      // Get incident details
      const incident = incidentState.incident;
      const investigation = incidentState.investigationResults;
      
      // Create base response plan
      const responsePlan = {
        id: utils.encryption.generateId(),
        incidentId: incident.id,
        phases: [],
        containmentActions: [],
        eradicationActions: [],
        recoveryActions: [],
        immediateContainment: false,
        requiredCapabilities: [],
        collaborationNeeded: false,
        estimatedTimeToResolve: 0, // in minutes
        timestamp: Date.now(),
        status: 'draft'
      };
      
      // Determine if template is available for this incident type
      let template = null;
      if (incident.type && this._responseTemplates[incident.type]) {
        template = this._responseTemplates[incident.type];
      } else if (incident.category && this._responseTemplates[incident.category]) {
        template = this._responseTemplates[incident.category];
      } 
      
      // If template is available, use it as a base
      if (template) {
        responsePlan.phases = template.phases;
        
        // Extract containment actions from template
        const containmentPhase = template.phases.find(p => p.name === IR_PHASE.CONTAINMENT);
        if (containmentPhase) {
          responsePlan.containmentActions = containmentPhase.steps.map(step => ({
            id: utils.encryption.generateId(),
            type: step.action,
            description: step.description,
            target: this._determineActionTarget(step.action, incident, investigation),
            priority: 'high',
            status: 'pending',
            timestamp: Date.now()
          }));
        }
        
        // Extract eradication actions from template
        const eradicationPhase = template.phases.find(p => p.name === IR_PHASE.ERADICATION);
        if (eradicationPhase) {
          responsePlan.eradicationActions = eradicationPhase.steps.map(step => ({
            id: utils.encryption.generateId(),
            type: step.action,
            description: step.description,
            target: this._determineActionTarget(step.action, incident, investigation),
            priority: 'medium',
            status: 'pending',
            timestamp: Date.now()
          }));
        }
        
        // Extract recovery actions from template
        const recoveryPhase = template.phases.find(p => p.name === IR_PHASE.RECOVERY);
        if (recoveryPhase) {
          responsePlan.recoveryActions = recoveryPhase.steps.map(step => ({
            id: utils.encryption.generateId(),
            type: step.action,
            description: step.description,
            target: this._determineActionTarget(step.action, incident, investigation),
            priority: 'medium',
            status: 'pending',
            timestamp: Date.now()
          }));
        }
      } else {
        // Create generic plan based on incident type
        switch (incident.source) {
          case 'email_triage_agent':
            // Email/phishing incident
            responsePlan.phases = [
              {
                name: IR_PHASE.CONTAINMENT,
                steps: [
                  { action: 'block_sender', description: 'Block sender domain' },
                  { action: 'block_urls', description: 'Block malicious URLs' },
                  { action: 'quarantine_email', description: 'Quarantine phishing email' }
                ]
              },
              {
                name: IR_PHASE.ERADICATION,
                steps: [
                  { action: 'remove_email', description: 'Remove email from all mailboxes' },
                  { action: 'scan_attachments', description: 'Scan for similar attachments' }
                ]
              },
              {
                name: IR_PHASE.RECOVERY,
                steps: [
                  { action: 'notify_users', description: 'Notify users of phishing campaign' }
                ]
              }
            ];
            
            // Add containment actions
            responsePlan.containmentActions = [
              {
                id: utils.encryption.generateId(),
                type: 'block_sender',
                description: 'Block sender domain',
                target: incident.sourceData?.sender?.split('@')[1] || 'unknown',
                priority: 'high',
                status: 'pending',
                timestamp: Date.now()
              },
              {
                id: utils.encryption.generateId(),
                type: 'block_urls',
                description: 'Block malicious URLs in email',
                target: 'All URLs in email',
                priority: 'high',
                status: 'pending',
                timestamp: Date.now()
              }
            ];
            
            break;
            
          case 'alert_triage_agent':
            // Security alert incident
            responsePlan.phases = [
              {
                name: IR_PHASE.CONTAINMENT,
                steps: [
                  { action: 'isolate_host', description: 'Isolate affected host' },
                  { action: 'kill_process', description: 'Terminate malicious process' }
                ]
              },
              {
                name: IR_PHASE.ERADICATION,
                steps: [
                  { action: 'remove_malware', description: 'Remove malicious files' },
                  { action: 'scan_system', description: 'Scan for additional threats' }
                ]
              },
              {
                name: IR_PHASE.RECOVERY,
                steps: [
                  { action: 'restore_system', description: 'Restore system to normal operation' }
                ]
              }
            ];
            
            // Add containment actions
            responsePlan.containmentActions = [
              {
                id: utils.encryption.generateId(),
                type: 'isolate_host',
                description: 'Isolate affected host from network',
                target: incident.sourceData?.hostname || 'unknown',
                priority: 'high',
                status: 'pending',
                timestamp: Date.now()
              }
            ];
            
            // Add process termination if process info available
            if (incident.sourceData?.processName) {
              responsePlan.containmentActions.push({
                id: utils.encryption.generateId(),
                type: 'kill_process',
                description: 'Terminate malicious process',
                target: `${incident.sourceData.processName} (${incident.sourceData.processId || 'unknown'})`,
                priority: 'high',
                status: 'pending',
                timestamp: Date.now()
              });
            }
            
            break;
            
          case 'vuln_scanner_agent':
            // Vulnerability incident
            responsePlan.phases = [
              {
                name: IR_PHASE.CONTAINMENT,
                steps: [
                  { action: 'isolate_host', description: 'Isolate vulnerable host if being exploited' },
                  { action: 'block_exploit', description: 'Block known exploit attempts' }
                ]
              },
              {
                name: IR_PHASE.ERADICATION,
                steps: [
                  { action: 'patch_vulnerability', description: 'Apply security patch' },
                  { action: 'reconfigure_system', description: 'Reconfigure system to mitigate vulnerability' }
                ]
              },
              {
                name: IR_PHASE.RECOVERY,
                steps: [
                  { action: 'verify_patch', description: 'Verify patch was applied successfully' },
                  { action: 'scan_system', description: 'Rescan system to confirm vulnerability is resolved' }
                ]
              }
            ];
            
            // Add containment actions only if being actively exploited
            if (incident.exploitationStatus === 'active' || incident.severity >= 80) {
              responsePlan.containmentActions = [
                {
                  id: utils.encryption.generateId(),
                  type: 'isolate_host',
                  description: 'Isolate vulnerable host from network',
                  target: incident.sourceData?.hostname || 'unknown',
                  priority: 'high',
                  status: 'pending',
                  timestamp: Date.now()
                }
              ];
            }
            
            break;
            
          default:
            // Generic incident
            responsePlan.phases = [
              { 
                name: IR_PHASE.CONTAINMENT,
                steps: [
                  { action: 'isolate_system', description: 'Isolate affected systems' }
                ]
              },
              {
                name: IR_PHASE.ERADICATION,
                steps: [
                  { action: 'remove_threat', description: 'Remove threat from systems' }
                ]
              },
              {
                name: IR_PHASE.RECOVERY,
                steps: [
                  { action: 'restore_operation', description: 'Restore normal operation' }
                ]
              }
            ];
        }
      }
      
      // Determine if immediate containment is needed
      responsePlan.immediateContainment = this._isImmediateContainmentNeeded(incident, investigation);
      
      // Identify required capabilities
      responsePlan.requiredCapabilities = this._identifyRequiredCapabilities(responsePlan);
      
      // Check if collaboration is needed
      responsePlan.collaborationNeeded = responsePlan.requiredCapabilities.some(
        cap => !this._capabilities.includes(cap)
      );
      
      // Estimate time to resolve
      responsePlan.estimatedTimeToResolve = this._estimateTimeToResolve(incident, responsePlan);
      
      // Finalize the plan
        }
        
        // Add to results
        results.push({
          action: action,
          status: executionResult.success ? 'success' : 'failed',
          message: executionResult.message,
          timestamp: Date.now()
        });
        
        // Update timeline
        this._updateIncidentTimeline(
          incident.id,
          `Containment action ${executionResult.success ? 'succeeded' : 'failed'}: ${action.type}`,
          this.id,
          {
            target: action.target,
            message: executionResult.message
          }
        );
      } catch (error) {
        this.log.error(`Error executing containment action: ${action.type}`, error);
        
        results.push({
          action: action,
          status: 'error',
          message: error.message,
          timestamp: Date.now()
        });
        
        // Update timeline
        this._updateIncidentTimeline(
          incident.id,
          `Containment action error: ${action.type}`,
          this.id,
          {
            target: action.target,
            error: error.message
          }
        );
      }
    }
    
    return results;
  }

  /**
   * Execute host isolation
   * @param {string} hostname - Hostname to isolate
   * @returns {Promise<Object>} Execution result
   * @private
   */
  async _executeHostIsolation(hostname) {
    // This would implement actual host isolation via EDR or other means
    // Placeholder implementation
    return { success: true, message: `Host ${hostname} isolated successfully` };
  }

  /**
   * Execute IP blocking
   * @param {string} ip - IP to block
   * @returns {Promise<Object>} Execution result
   * @private
   */
  async _executeIpBlocking(ip) {
    // This would implement actual IP blocking via firewall or other means
    // Placeholder implementation
    return { success: true, message: `IP ${ip} blocked successfully` };
  }

  /**
   * Execute domain blocking
   * @param {string} domain - Domain to block
   * @returns {Promise<Object>} Execution result
   * @private
   */
  async _executeDomainBlocking(domain) {
    // This would implement actual domain blocking via DNS or other means
    // Placeholder implementation
    return { success: true, message: `Domain ${domain} blocked successfully` };
  }

  /**
   * Execute process termination
   * @param {Object} process - Process to terminate
   * @returns {Promise<Object>} Execution result
   * @private
   */
  async _executeProcessTermination(process) {
    // This would implement actual process termination via EDR or other means
    // Placeholder implementation
    return { 
      success: true, 
      message: `Process ${process.processName} (PID: ${process.pid}) terminated on ${process.host}` 
    };
  }

  /**
   * Execute hash blocking
   * @param {string} hash - File hash to block
   * @returns {Promise<Object>} Execution result
   * @private
   */
  async _executeHashBlocking(hash) {
    // This would implement actual hash blocking via EDR or other means
    // Placeholder implementation
    return { success: true, message: `File hash ${hash} blocked successfully` };
  }

  /**
   * Check if incident should be escalated to L3
   * @param {Object} incident - Incident
   * @param {Object} investigation - Investigation record
   * @returns {Promise<boolean>} True if should be escalated
   * @private
   */
  async _shouldEscalateToL3(incident, investigation) {
    try {
      // Base on investigated severity
      const investigatedSeverity = this._calculateInvestigatedSeverity(investigation, incident);

      // Escalate if severity is very high
      if (investigatedSeverity >= 85) {
        return true;
      }

      // Escalate if multiple MITRE tactics are involved (indicates complex campaign)
      if (Array.isArray(investigation.mitreTactics) && investigation.mitreTactics.length >= 3) {
        return true;
      }

      // Escalate if lateral movement is detected
      if (Array.isArray(investigation.mitreTactics) &&
          investigation.mitreTactics.includes(MITRE_TACTICS.LATERAL_MOVEMENT)) {
        return true;
      }

      // Escalate if exfiltration or impact is detected
      if (Array.isArray(investigation.mitreTactics) &&
          (investigation.mitreTactics.includes(MITRE_TACTICS.EXFILTRATION) ||
           investigation.mitreTactics.includes(MITRE_TACTICS.IMPACT))) {
        return true;
      }

      // Escalate if investigation explicitly requested it
      return investigation.requiresL3Escalation === true;
    } catch (error) {
      this.log.error('Error evaluating L3 escalation decision', error);
      // Fail-safe: do not auto-escalate on evaluation error
      return false;
    }
  }

  /**
   * Calculate adjusted severity based on investigation
   * @param {Object} investigation - Investigation results
   * @param {Object} incident - Original incident
   * @returns {number} Adjusted severity
   * @private
   */
  _calculateInvestigatedSeverity(investigation, incident) {
    // Start with original severity
    let severity = incident.severity || 50;

    // Adjust based on investigation findings

    // Affected systems - critical systems increase severity
    if (Array.isArray(investigation.affectedSystems) &&
        investigation.affectedSystems.some(
          system => system.criticality === 'high' || system.criticality === 'critical'
        )) {
      severity += 15;
    }

    // Threat actors - known threat actors increase severity
    if (Array.isArray(investigation.threatActors) &&
        investigation.threatActors.length > 0) {
      severity += 10;
    }

    // Root cause - certain causes increase severity
    if (investigation.rootCause && investigation.rootCause.category) {
      if (
        investigation.rootCause.category === 'zero_day' ||
        investigation.rootCause.category === 'advanced_persistent_threat'
      ) {
        severity += 20;
      }
    }

    // Ensure severity is within bounds
    return Math.min(Math.max(severity, 0), 100);
  }
}

module.exports = IncidentResponseAgent;
