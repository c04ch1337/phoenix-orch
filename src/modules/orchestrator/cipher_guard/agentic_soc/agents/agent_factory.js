/**
 * Agent Factory
 * 
 * This module provides a factory for creating different types of security agents
 * within the Agentic SOC. It includes functionality for agent type registration,
 * configuration loading, and agent instantiation.
 */

const fs = require('fs');
const path = require('path');
const { Agent, AGENT_STATUS } = require('./index');
const utils = require('../utils');

/**
 * AgentFactory class for creating and registering agent types
 * @class AgentFactory
 */
class AgentFactory {
  /**
   * Create a new AgentFactory
   * @param {Object} options - Factory options
   * @param {Object} options.configPath - Path to agent configurations directory
   * @param {Object} options.messageBus - Message bus for agent communication
   */
  constructor(options = {}) {
    this._registeredAgents = new Map();
    this._configPath = options.configPath || path.join(__dirname, '../config/agents');
    this._messageBus = options.messageBus;
    
    // Cache for agent configurations
    this._configCache = new Map();
    
    // Register the base Agent class
    this.registerAgentType('base', Agent);
    
    // Initialize logging
    this._initializeLogging();
  }
  
  /**
   * Initialize logging
   * @private
   */
  _initializeLogging() {
    this.log = {
      info: (message) => {
        console.log(`[INFO][AgentFactory] ${message}`);
        utils.telemetry.log('info', `[AgentFactory] ${message}`);
      },
      warn: (message) => {
        console.warn(`[WARN][AgentFactory] ${message}`);
        utils.telemetry.log('warn', `[AgentFactory] ${message}`);
      },
      error: (message, error = null) => {
        console.error(`[ERROR][AgentFactory] ${message}`, error);
        utils.telemetry.log('error', `[AgentFactory] ${message}`, { 
          error: error ? { message: error.message, stack: error.stack } : null 
        });
      },
      debug: (message) => {
        console.debug(`[DEBUG][AgentFactory] ${message}`);
        utils.telemetry.log('debug', `[AgentFactory] ${message}`);
      }
    };
  }
  
  /**
   * Register a new agent type with the factory
   * @param {string} agentType - Unique identifier for the agent type
   * @param {Class} AgentClass - Agent class constructor (must extend base Agent)
   * @returns {boolean} Registration success
   */
  registerAgentType(agentType, AgentClass) {
    if (!agentType || typeof agentType !== 'string') {
      this.log.error(`Invalid agent type: ${agentType}`);
      return false;
    }
    
    if (!AgentClass || typeof AgentClass !== 'function') {
      this.log.error(`Invalid agent class for type: ${agentType}`);
      return false;
    }
    
    // Verify that the class extends Agent
    if (!(AgentClass.prototype instanceof Agent) && AgentClass !== Agent) {
      this.log.error(`Agent class for ${agentType} must extend the base Agent class`);
      return false;
    }
    
    // Check if the agent type is already registered
    if (this._registeredAgents.has(agentType)) {
      this.log.warn(`Agent type ${agentType} is already registered. Overwriting.`);
    }
    
    // Register the agent type
    this._registeredAgents.set(agentType, AgentClass);
    this.log.info(`Registered agent type: ${agentType}`);
    
    return true;
  }
  
  /**
   * Deregister an agent type from the factory
   * @param {string} agentType - Type identifier to deregister
   * @returns {boolean} Deregistration success
   */
  deregisterAgentType(agentType) {
    if (!this._registeredAgents.has(agentType)) {
      this.log.warn(`Agent type ${agentType} is not registered`);
      return false;
    }
    
    this._registeredAgents.delete(agentType);
    this.log.info(`Deregistered agent type: ${agentType}`);
    
    return true;
  }
  
  /**
   * Get a list of all registered agent types
   * @returns {string[]} List of registered agent type names
   */
  getRegisteredAgentTypes() {
    return Array.from(this._registeredAgents.keys());
  }
  
  /**
   * Check if an agent type is registered
   * @param {string} agentType - Type to check
   * @returns {boolean} True if the type is registered
   */
  isAgentTypeRegistered(agentType) {
    return this._registeredAgents.has(agentType);
  }
  
  /**
   * Load configuration for an agent type
   * @param {string} agentType - Agent type to load configuration for
   * @param {string} [configName=default] - Name of the configuration to load
   * @returns {Promise<Object>} Agent configuration
   */
  async loadAgentConfig(agentType, configName = 'default') {
    // Check cache first
    const cacheKey = `${agentType}:${configName}`;
    if (this._configCache.has(cacheKey)) {
      return { ...this._configCache.get(cacheKey) };
    }
    
    try {
      // Determine the configuration file path
      let configFilePath;
      if (configName === 'default') {
        configFilePath = path.join(this._configPath, `${agentType}.json`);
      } else {
        configFilePath = path.join(this._configPath, agentType, `${configName}.json`);
      }
      
      // Check if the configuration file exists
      if (!fs.existsSync(configFilePath)) {
        this.log.warn(`Configuration file not found: ${configFilePath}`);
        return {};
      }
      
      // Read and parse the configuration file
      const configData = fs.readFileSync(configFilePath, 'utf8');
      const config = JSON.parse(configData);
      
      // Validate the configuration
      if (!utils.validation.validateAgentConfig) {
        this.log.warn('Validation module not available, skipping config validation');
      } else {
        const validationResult = utils.validation.validateAgentConfig(config, agentType);
        if (!validationResult.valid) {
          this.log.error(`Invalid configuration for ${agentType}: ${validationResult.errors.join(', ')}`);
          return {};
        }
      }
      
      // Cache the configuration
      this._configCache.set(cacheKey, { ...config });
      
      return config;
    } catch (error) {
      this.log.error(`Failed to load configuration for ${agentType}`, error);
      return {};
    }
  }
  
  /**
   * Create a new agent instance
   * @param {string} agentType - Type of agent to create
   * @param {Object} [config={}] - Configuration options for the agent
   * @param {boolean} [initialize=true] - Whether to initialize the agent
   * @returns {Promise<Agent>} Created agent instance
   */
  async createAgent(agentType, config = {}, initialize = true) {
    try {
      // Determine the agent class to instantiate
      let AgentClass;
      
      // Check if the requested type is registered directly
      if (this._registeredAgents.has(agentType)) {
        AgentClass = this._registeredAgents.get(agentType);
      }
      // Special handling for tier-based agent types (L1, L2, L3)
      else if (agentType.startsWith('l1_') || agentType === 'l1') {
        // Try to get the specific L1 agent type first
        if (this._registeredAgents.has(agentType)) {
          AgentClass = this._registeredAgents.get(agentType);
        } 
        // Fall back to base L1 agent
        else if (this._registeredAgents.has('l1_base')) {
          AgentClass = this._registeredAgents.get('l1_base');
        }
      }
      else if (agentType.startsWith('l2_') || agentType === 'l2') {
        // Try to get the specific L2 agent type first
        if (this._registeredAgents.has(agentType)) {
          AgentClass = this._registeredAgents.get(agentType);
        } 
        // Fall back to base L2 agent
        else if (this._registeredAgents.has('l2_base')) {
          AgentClass = this._registeredAgents.get('l2_base');
        }
      }
      else if (agentType.startsWith('l3_') || agentType === 'l3') {
        // Try to get the specific L3 agent type first
        if (this._registeredAgents.has(agentType)) {
          AgentClass = this._registeredAgents.get(agentType);
        } 
        // Fall back to base L3 agent
        else if (this._registeredAgents.has('l3_base')) {
          AgentClass = this._registeredAgents.get('l3_base');
        }
      }
      
      // If we still don't have an agent class, use the base Agent class
      if (!AgentClass) {
        this.log.warn(`Agent type ${agentType} not registered, using base Agent`);
        AgentClass = this._registeredAgents.get('base');
      }
      
      // Load the configuration for this agent type if not provided
      let mergedConfig = { ...config };
      if (Object.keys(config).length === 0) {
        const loadedConfig = await this.loadAgentConfig(agentType);
        mergedConfig = { ...loadedConfig };
      }
      
      // Ensure the type is set correctly
      mergedConfig.type = agentType;
      
      // Create the agent instance
      const agent = new AgentClass(mergedConfig, this._messageBus);
      
      // Initialize the agent if requested
      if (initialize) {
        const initSuccess = await agent.initialize();
        if (!initSuccess) {
          this.log.error(`Failed to initialize agent of type ${agentType}`);
          return null;
        }
      }
      
      this.log.info(`Created agent: ${agent.id} (type: ${agentType})`);
      return agent;
    } catch (error) {
      this.log.error(`Failed to create agent of type ${agentType}`, error);
      return null;
    }
  }
  
  /**
   * Create multiple agents of different types
   * @param {Array<{type: string, config: Object}>} agentSpecs - Specifications for agents to create
   * @returns {Promise<Array<Agent>>} Array of created agent instances
   */
  async createAgents(agentSpecs) {
    if (!Array.isArray(agentSpecs)) {
      this.log.error('Agent specifications must be an array');
      return [];
    }
    
    const agents = [];
    
    for (const spec of agentSpecs) {
      if (!spec.type) {
        this.log.error('Agent specification missing type');
        continue;
      }
      
      const agent = await this.createAgent(spec.type, spec.config || {});
      if (agent) {
        agents.push(agent);
      }
    }
    
    this.log.info(`Created ${agents.length} agents`);
    return agents;
  }
  
  /**
   * Create a tiered security structure with L1, L2, and L3 agents
   * @param {Object} [options={}] - Options for creating the tiered structure
   * @param {number} [options.l1Count=3] - Number of L1 agents to create
   * @param {number} [options.l2Count=2] - Number of L2 agents to create
   * @param {number} [options.l3Count=1] - Number of L3 agents to create
   * @param {Object} [options.l1Config={}] - Configuration for L1 agents
   * @param {Object} [options.l2Config={}] - Configuration for L2 agents
   * @param {Object} [options.l3Config={}] - Configuration for L3 agents
   * @returns {Promise<{l1: Array<Agent>, l2: Array<Agent>, l3: Array<Agent>}>} Created agents by tier
   */
  async createTieredStructure(options = {}) {
    const l1Count = options.l1Count || 3;
    const l2Count = options.l2Count || 2;
    const l3Count = options.l3Count || 1;
    
    const l1Config = options.l1Config || {};
    const l2Config = options.l2Config || {};
    const l3Config = options.l3Config || {};
    
    const result = {
      l1: [],
      l2: [],
      l3: []
    };
    
    // Create L1 agents
    for (let i = 0; i < l1Count; i++) {
      const l1Agent = await this.createAgent('l1', { ...l1Config, name: `L1-Agent-${i + 1}` });
      if (l1Agent) {
        result.l1.push(l1Agent);
      }
    }
    
    // Create L2 agents
    for (let i = 0; i < l2Count; i++) {
      const l2Agent = await this.createAgent('l2', { ...l2Config, name: `L2-Agent-${i + 1}` });
      if (l2Agent) {
        result.l2.push(l2Agent);
      }
    }
    
    // Create L3 agents
    for (let i = 0; i < l3Count; i++) {
      const l3Agent = await this.createAgent('l3', { ...l3Config, name: `L3-Agent-${i + 1}` });
      if (l3Agent) {
        result.l3.push(l3Agent);
      }
    }
    
    this.log.info(`Created tiered structure with ${result.l1.length} L1, ${result.l2.length} L2, and ${result.l3.length} L3 agents`);
    return result;
  }
  
  /**
   * Clear the configuration cache
   */
  clearConfigCache() {
    this._configCache.clear();
    this.log.info('Configuration cache cleared');
  }
}

module.exports = AgentFactory;