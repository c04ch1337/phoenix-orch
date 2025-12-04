/**
 * Agent Registry
 * 
 * This module implements a registry to track and manage all active agents within
 * the Agentic SOC system. It provides functionality for registration, deregistration,
 * status tracking, and query capabilities.
 */

const EventEmitter = require('events');
const utils = require('../utils');
const { AGENT_STATUS } = require('./index');

/**
 * AgentRegistry class for tracking and managing active agents
 * @class AgentRegistry
 * @extends EventEmitter
 */
class AgentRegistry extends EventEmitter {
  /**
   * Create a new AgentRegistry
   * @param {Object} options - Registry options
   */
  constructor(options = {}) {
    super();
    
    // Map to store all registered agents by ID
    this._agents = new Map();
    
    // Indexes for faster querying
    this._indexes = {
      // Index by type
      byType: new Map(),
      
      // Index by capability
      byCapability: new Map(),
      
      // Index by status
      byStatus: new Map(),
      
      // Index by tier (L1, L2, L3, Dad)
      byTier: new Map()
    };
    
    // Stats
    this._stats = {
      totalRegistered: 0,
      currentActive: 0,
      byStatus: {},
      byType: {},
      byTier: {}
    };
    
    // Options
    this._options = options;
    
    // Initialize logs
    this._initializeLogging();
    
    // Initialize indexes
    this._initializeIndexes();
    
    // Setup event listeners for stats tracking
    this._setupEventListeners();
  }
  
  /**
   * Initialize logging
   * @private
   */
  _initializeLogging() {
    this.log = {
      info: (message) => {
        console.log(`[INFO][AgentRegistry] ${message}`);
        utils.telemetry.log('info', `[AgentRegistry] ${message}`);
      },
      warn: (message) => {
        console.warn(`[WARN][AgentRegistry] ${message}`);
        utils.telemetry.log('warn', `[AgentRegistry] ${message}`);
      },
      error: (message, error = null) => {
        console.error(`[ERROR][AgentRegistry] ${message}`, error);
        utils.telemetry.log('error', `[AgentRegistry] ${message}`, { 
          error: error ? { message: error.message, stack: error.stack } : null 
        });
      },
      debug: (message) => {
        console.debug(`[DEBUG][AgentRegistry] ${message}`);
        utils.telemetry.log('debug', `[AgentRegistry] ${message}`);
      }
    };
  }
  
  /**
   * Initialize registry indexes
   * @private
   */
  _initializeIndexes() {
    // Initialize status index
    Object.values(AGENT_STATUS).forEach(status => {
      this._indexes.byStatus.set(status, new Set());
      this._stats.byStatus[status] = 0;
    });
    
    // Initialize tier index
    ['l1', 'l2', 'l3', 'dad'].forEach(tier => {
      this._indexes.byTier.set(tier, new Set());
      this._stats.byTier[tier] = 0;
    });
  }
  
  /**
   * Setup event listeners for statistics tracking
   * @private
   */
  _setupEventListeners() {
    // Listen for registry events
    this.on('agent:registered', ({ agent }) => {
      // Update stats
      this._stats.totalRegistered++;
      this._stats.currentActive++;
      
      // Update status stats
      this._stats.byStatus[agent.status] = (this._stats.byStatus[agent.status] || 0) + 1;
      
      // Update type stats
      this._stats.byType[agent.type] = (this._stats.byType[agent.type] || 0) + 1;
      
      // Update tier stats if applicable
      if (agent.type.startsWith('l1') || agent.type === 'l1') {
        this._stats.byTier.l1++;
      } else if (agent.type.startsWith('l2') || agent.type === 'l2') {
        this._stats.byTier.l2++;
      } else if (agent.type.startsWith('l3') || agent.type === 'l3') {
        this._stats.byTier.l3++;
      } else if (agent.type === 'dad') {
        this._stats.byTier.dad++;
      }
      
      // Log registration
      this.log.info(`Agent registered: ${agent.id} (${agent.name}, type: ${agent.type})`);
      
      // Report metrics
      utils.metrics.increment('agents.registered', 1, { agentType: agent.type });
      utils.metrics.gauge('agents.active', this._stats.currentActive);
    });
    
    this.on('agent:deregistered', ({ agentId, type }) => {
      // Update stats
      this._stats.currentActive--;
      
      // Update type stats
      if (type && this._stats.byType[type]) {
        this._stats.byType[type]--;
      }
      
      // Update tier stats if applicable
      if (type) {
        if (type.startsWith('l1') || type === 'l1') {
          this._stats.byTier.l1--;
        } else if (type.startsWith('l2') || type === 'l2') {
          this._stats.byTier.l2--;
        } else if (type.startsWith('l3') || type === 'l3') {
          this._stats.byTier.l3--;
        } else if (type === 'dad') {
          this._stats.byTier.dad--;
        }
      }
      
      // Log deregistration
      this.log.info(`Agent deregistered: ${agentId}`);
      
      // Report metrics
      utils.metrics.increment('agents.deregistered', 1, { agentType: type || 'unknown' });
      utils.metrics.gauge('agents.active', this._stats.currentActive);
    });
    
    this.on('agent:status:changed', ({ agent, oldStatus, newStatus }) => {
      // Update status stats
      if (oldStatus && this._stats.byStatus[oldStatus]) {
        this._stats.byStatus[oldStatus]--;
      }
      if (newStatus) {
        this._stats.byStatus[newStatus] = (this._stats.byStatus[newStatus] || 0) + 1;
      }
      
      this.log.debug(`Agent ${agent.id} status changed: ${oldStatus} -> ${newStatus}`);
      
      // Report metrics
      utils.metrics.increment('agents.status.change', 1, { 
        agentType: agent.type,
        oldStatus,
        newStatus
      });
    });
  }
  
  /**
   * Update indexes for an agent
   * @param {Agent} agent - The agent to update indexes for
   * @param {boolean} [remove=false] - Whether to remove from indexes instead of adding
   * @private
   */
  _updateIndexes(agent, remove = false) {
    try {
      const method = remove ? 'delete' : 'add';
      
      // Update type index
      if (!this._indexes.byType.has(agent.type)) {
        this._indexes.byType.set(agent.type, new Set());
      }
      this._indexes.byType.get(agent.type)[method](agent.id);
      
      // Update status index
      if (!this._indexes.byStatus.has(agent.status)) {
        this._indexes.byStatus.set(agent.status, new Set());
      }
      this._indexes.byStatus.get(agent.status)[method](agent.id);
      
      // Update capability index
      agent.capabilities.forEach(capability => {
        if (!this._indexes.byCapability.has(capability)) {
          this._indexes.byCapability.set(capability, new Set());
        }
        this._indexes.byCapability.get(capability)[method](agent.id);
      });
      
      // Update tier index
      let tier = null;
      if (agent.type.startsWith('l1') || agent.type === 'l1') {
        tier = 'l1';
      } else if (agent.type.startsWith('l2') || agent.type === 'l2') {
        tier = 'l2';
      } else if (agent.type.startsWith('l3') || agent.type === 'l3') {
        tier = 'l3';
      } else if (agent.type === 'dad') {
        tier = 'dad';
      }
      
      if (tier && this._indexes.byTier.has(tier)) {
        this._indexes.byTier.get(tier)[method](agent.id);
      }
    } catch (error) {
      this.log.error(`Error updating indexes for agent ${agent.id}`, error);
    }
  }
  
  /**
   * Handle agent status changes
   * @param {Agent} agent - The agent whose status changed
   * @param {string} oldStatus - Previous status
   * @param {string} newStatus - New status
   * @private
   */
  _handleStatusChange(agent, oldStatus, newStatus) {
    try {
      // Remove from old status index
      if (oldStatus && this._indexes.byStatus.has(oldStatus)) {
        this._indexes.byStatus.get(oldStatus).delete(agent.id);
      }
      
      // Add to new status index
      if (newStatus && this._indexes.byStatus.has(newStatus)) {
        this._indexes.byStatus.get(newStatus).add(agent.id);
      }
      
      // Emit status change event
      this.emit('agent:status:changed', {
        agent,
        oldStatus,
        newStatus
      });
    } catch (error) {
      this.log.error(`Error handling status change for agent ${agent.id}`, error);
    }
  }
  
  /**
   * Register an agent with the registry
   * @param {Agent} agent - The agent to register
   * @returns {boolean} Registration success
   */
  registerAgent(agent) {
    if (!agent || !agent.id) {
      this.log.error('Cannot register invalid agent');
      return false;
    }
    
    // Check if agent is already registered
    if (this._agents.has(agent.id)) {
      this.log.warn(`Agent ${agent.id} is already registered`);
      return false;
    }
    
    try {
      // Store the agent
      this._agents.set(agent.id, agent);
      
      // Update indexes
      this._updateIndexes(agent);
      
      // Track agent status changes
      const statusChangeHandler = (oldStatus, newStatus) => {
        this._handleStatusChange(agent, oldStatus, newStatus);
      };
      
      // Store the handler reference so we can remove it later
      agent._statusChangeHandler = statusChangeHandler;
      
      // Set up event handlers for this agent
      agent.on('status:changed', statusChangeHandler);
      
      // Emit agent registered event
      this.emit('agent:registered', { agent });
      
      return true;
    } catch (error) {
      this.log.error(`Failed to register agent ${agent.id}`, error);
      return false;
    }
  }
  
  /**
   * Deregister an agent from the registry
   * @param {string} agentId - ID of the agent to deregister
   * @returns {boolean} Deregistration success
   */
  deregisterAgent(agentId) {
    if (!agentId) {
      this.log.error('Cannot deregister agent with invalid ID');
      return false;
    }
    
    // Check if agent is registered
    if (!this._agents.has(agentId)) {
      this.log.warn(`Agent ${agentId} is not registered`);
      return false;
    }
    
    try {
      // Get the agent
      const agent = this._agents.get(agentId);
      const agentType = agent.type;
      
      // Remove status change handler
      if (agent._statusChangeHandler) {
        agent.removeListener('status:changed', agent._statusChangeHandler);
      }
      
      // Update indexes (remove)
      this._updateIndexes(agent, true);
      
      // Remove the agent from the registry
      this._agents.delete(agentId);
      
      // Emit agent deregistered event
      this.emit('agent:deregistered', { agentId, type: agentType });
      
      return true;
    } catch (error) {
      this.log.error(`Failed to deregister agent ${agentId}`, error);
      return false;
    }
  }
  
  /**
   * Get an agent by ID
   * @param {string} agentId - ID of the agent to retrieve
   * @returns {Agent|null} The agent, or null if not found
   */
  getAgentById(agentId) {
    return this._agents.get(agentId) || null;
  }
  
  /**
   * Check if an agent is registered
   * @param {string} agentId - ID of the agent to check
   * @returns {boolean} True if the agent is registered
   */
  hasAgent(agentId) {
    return this._agents.has(agentId);
  }
  
  /**
   * Get all registered agents
   * @returns {Array<Agent>} Array of all registered agents
   */
  getAllAgents() {
    return Array.from(this._agents.values());
  }
  
  /**
   * Get agents by type
   * @param {string} type - Type of agents to retrieve
   * @returns {Array<Agent>} Array of matching agents
   */
  getAgentsByType(type) {
    if (!type || !this._indexes.byType.has(type)) {
      return [];
    }
    
    const agentIds = Array.from(this._indexes.byType.get(type));
    return agentIds.map(id => this._agents.get(id)).filter(Boolean);
  }
  
  /**
   * Get agents by tier (L1, L2, L3, Dad)
   * @param {string} tier - Tier of agents to retrieve (l1, l2, l3, dad)
   * @returns {Array<Agent>} Array of matching agents
   */
  getAgentsByTier(tier) {
    if (!tier || !this._indexes.byTier.has(tier)) {
      return [];
    }
    
    const agentIds = Array.from(this._indexes.byTier.get(tier));
    return agentIds.map(id => this._agents.get(id)).filter(Boolean);
  }
  
  /**
   * Get agents by status
   * @param {string} status - Status of agents to retrieve
   * @returns {Array<Agent>} Array of matching agents
   */
  getAgentsByStatus(status) {
    if (!status || !this._indexes.byStatus.has(status)) {
      return [];
    }
    
    const agentIds = Array.from(this._indexes.byStatus.get(status));
    return agentIds.map(id => this._agents.get(id)).filter(Boolean);
  }
  
  /**
   * Get agents by capability
   * @param {string} capability - Capability to search for
   * @returns {Array<Agent>} Array of matching agents
   */
  getAgentsByCapability(capability) {
    if (!capability || !this._indexes.byCapability.has(capability)) {
      return [];
    }
    
    const agentIds = Array.from(this._indexes.byCapability.get(capability));
    return agentIds.map(id => this._agents.get(id)).filter(Boolean);
  }
  
  /**
   * Find agents matching a set of criteria
   * @param {Object} criteria - Query criteria
   * @param {string} [criteria.type] - Agent type to match
   * @param {string} [criteria.status] - Agent status to match
   * @param {string} [criteria.tier] - Agent tier to match
   * @param {string} [criteria.capability] - Agent capability to match
   * @returns {Array<Agent>} Array of matching agents
   */
  findAgents(criteria = {}) {
    let results = this.getAllAgents();
    
    // Filter by type
    if (criteria.type) {
      results = results.filter(agent => agent.type === criteria.type);
    }
    
    // Filter by status
    if (criteria.status) {
      results = results.filter(agent => agent.status === criteria.status);
    }
    
    // Filter by tier
    if (criteria.tier) {
      const tierPrefix = criteria.tier.toLowerCase();
      results = results.filter(agent => 
        agent.type === tierPrefix || 
        agent.type.startsWith(`${tierPrefix}_`)
      );
    }
    
    // Filter by capability
    if (criteria.capability) {
      results = results.filter(agent => 
        agent.capabilities.includes(criteria.capability)
      );
    }
    
    return results;
  }
  
  /**
   * Find the most suitable agent for a task
   * @param {Object} requirements - Task requirements
   * @param {string} [requirements.type] - Required agent type
   * @param {string[]} [requirements.capabilities] - Required capabilities
   * @param {string} [requirements.tier] - Required agent tier (l1, l2, l3, dad)
   * @param {boolean} [requirements.mustBeReady=true] - Whether the agent must be in READY state
   * @returns {Agent|null} The most suitable agent, or null if none found
   */
  findSuitableAgent(requirements = {}) {
    const mustBeReady = requirements.mustBeReady !== false;
    const candidates = this.findAgents({
      type: requirements.type,
      tier: requirements.tier,
      status: mustBeReady ? AGENT_STATUS.READY : undefined
    });
    
    // Filter by required capabilities
    let filtered = candidates;
    if (requirements.capabilities && requirements.capabilities.length > 0) {
      filtered = candidates.filter(agent => 
        requirements.capabilities.every(cap => agent.capabilities.includes(cap))
      );
    }
    
    if (filtered.length === 0) {
      return null;
    }
    
    // Select the agent with most matching capabilities, or the first one if no capabilities specified
    if (requirements.capabilities && requirements.capabilities.length > 0) {
      filtered.sort((a, b) => {
        const aMatchCount = requirements.capabilities.filter(cap => a.capabilities.includes(cap)).length;
        const bMatchCount = requirements.capabilities.filter(cap => b.capabilities.includes(cap)).length;
        return bMatchCount - aMatchCount;
      });
    }
    
    // Return the most suitable agent
    return filtered[0];
  }
  
  /**
   * Get registry statistics
   * @returns {Object} Registry statistics
   */
  getStats() {
    return { ...this._stats };
  }
  
  /**
   * Reset registry statistics
   */
  resetStats() {
    // Reset stats but keep current counts
    this._stats.totalRegistered = this._agents.size;
    this._stats.currentActive = this._agents.size;
    
    // Reset status stats
    Object.keys(this._stats.byStatus).forEach(status => {
      this._stats.byStatus[status] = 0;
    });
    
    // Recount by status
    this._agents.forEach(agent => {
      this._stats.byStatus[agent.status] = (this._stats.byStatus[agent.status] || 0) + 1;
    });
    
    // Reset type stats
    this._stats.byType = {};
    
    // Recount by type
    this._agents.forEach(agent => {
      this._stats.byType[agent.type] = (this._stats.byType[agent.type] || 0) + 1;
    });
    
    // Reset tier stats
    ['l1', 'l2', 'l3', 'dad'].forEach(tier => {
      this._stats.byTier[tier] = 0;
    });
    
    // Recount by tier
    this._agents.forEach(agent => {
      if (agent.type.startsWith('l1') || agent.type === 'l1') {
        this._stats.byTier.l1++;
      } else if (agent.type.startsWith('l2') || agent.type === 'l2') {
        this._stats.byTier.l2++;
      } else if (agent.type.startsWith('l3') || agent.type === 'l3') {
        this._stats.byTier.l3++;
      } else if (agent.type === 'dad') {
        this._stats.byTier.dad++;
      }
    });
    
    this.log.info('Registry statistics reset');
  }
}

module.exports = AgentRegistry;