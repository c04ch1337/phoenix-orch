/**
 * Cipher Guard Agentic SOC Framework
 * 
 * This module serves as the main entry point for the Cipher Guard Agentic SOC
 * agent hierarchy framework. It exports all components necessary to create, manage,
 * and coordinate a multi-tier (L1 → L2 → L3 → Dad) agent-based security operations
 * center with proper escalation paths.
 */

// Core agent framework
const { Agent, AGENT_STATUS } = require('./index');
const AgentFactory = require('./agent_factory');
const AgentRegistry = require('./agent_registry');
const AgentManager = require('./agent_manager');
const { EscalationManager, ESCALATION_LEVEL, ESCALATION_REASON } = require('./escalation_manager');

// Base agent classes for the three tiers
const BaseL1Agent = require('./l1_agents/base_l1_agent');
const BaseL2Agent = require('./l2_agents/base_l2_agent');
const BaseL3Agent = require('./l3_agents/base_l3_agent');

// Testing utilities
const { testAgentHierarchy } = require('./test_hierarchy');

/**
 * Create an agent hierarchy for Cipher Guard Agentic SOC
 * @param {Object} options - Configuration options
 * @param {Object} options.messageBus - Message bus for agent communication
 * @param {Object} [options.persistencePath] - Path for agent state persistence
 * @param {Function} [options.dadInterface] - Interface to human oversight (Dad)
 * @param {Object} [options.l1Config={}] - L1 agent configuration
 * @param {Object} [options.l2Config={}] - L2 agent configuration
 * @param {Object} [options.l3Config={}] - L3 agent configuration
 * @param {number} [options.l1Count=3] - Number of L1 agents to create
 * @param {number} [options.l2Count=2] - Number of L2 agents to create
 * @param {number} [options.l3Count=1] - Number of L3 agents to create
 * @param {Object} [options.agentManagerOptions={}] - Additional options for AgentManager
 * @param {Object} [options.escalationThresholds={}] - Custom escalation thresholds
 * @returns {Promise<Object>} Created hierarchy components
 */
async function createAgentHierarchy(options = {}) {
  // Destructure options with defaults
  const {
    messageBus,
    persistencePath,
    dadInterface,
    l1Config = {},
    l2Config = {},
    l3Config = {},
    l1Count = 3,
    l2Count = 2, 
    l3Count = 1,
    agentManagerOptions = {},
    escalationThresholds = {}
  } = options;
  
  // Validate required options
  if (!messageBus) {
    throw new Error('Message bus is required to create an agent hierarchy');
  }
  
  try {
    console.log('Creating Cipher Guard Agentic SOC agent hierarchy...');
    
    // Create agent factory
    const factory = new AgentFactory({
      messageBus,
      configPath: options.configPath
    });
    
    // Register agent classes with factory
    factory.registerAgentType('l1_base', BaseL1Agent);
    factory.registerAgentType('l2_base', BaseL2Agent);
    factory.registerAgentType('l3_base', BaseL3Agent);
    
    // Register any additional agent types provided in options
    if (options.additionalAgentTypes) {
      for (const [type, AgentClass] of Object.entries(options.additionalAgentTypes)) {
        factory.registerAgentType(type, AgentClass);
      }
    }
    
    // Create registry
    const registry = new AgentRegistry();
    
    // Create agent manager with persistence path if provided
    const manager = new AgentManager({
      messageBus,
      agentFactory: factory,
      agentRegistry: registry,
      persistencePath,
      ...agentManagerOptions
    });
    
    // Create escalation manager with custom thresholds if provided
    const escalationManager = new EscalationManager({
      agentRegistry: registry,
      agentManager: manager,
      messageBus,
      thresholds: escalationThresholds
    });
    
    // Configure L3 Dad interface if provided
    if (dadInterface && l3Config) {
      l3Config.dadInterface = dadInterface;
    }
    
    // Initialize the manager
    await manager.start({ loadPersistedAgents: options.loadPersistedAgents !== false });
    
    // Create tiered structure
    console.log(`Creating tiered structure (L1: ${l1Count}, L2: ${l2Count}, L3: ${l3Count})...`);
    
    const agents = await manager.createTieredStructure({
      l1Count,
      l2Count,
      l3Count,
      l1Config,
      l2Config,
      l3Config
    });
    
    console.log('Agent hierarchy created successfully');
    
    return {
      factory,
      registry,
      manager,
      escalationManager,
      agents,
      shutdown: async () => await manager.shutdown()
    };
  } catch (error) {
    console.error('Failed to create agent hierarchy', error);
    throw error;
  }
}

/**
 * Create an L1 agent outside of a hierarchy
 * @param {Object} config - Agent configuration
 * @param {Object} messageBus - Message bus for agent communication
 * @returns {BaseL1Agent} Created L1 agent 
 */
function createL1Agent(config = {}, messageBus = null) {
  return new BaseL1Agent(config, messageBus);
}

/**
 * Create an L2 agent outside of a hierarchy
 * @param {Object} config - Agent configuration
 * @param {Object} messageBus - Message bus for agent communication
 * @returns {BaseL2Agent} Created L2 agent
 */
function createL2Agent(config = {}, messageBus = null) {
  return new BaseL2Agent(config, messageBus);
}

/**
 * Create an L3 agent outside of a hierarchy
 * @param {Object} config - Agent configuration
 * @param {Object} messageBus - Message bus for agent communication
 * @returns {BaseL3Agent} Created L3 agent
 */
function createL3Agent(config = {}, messageBus = null) {
  return new BaseL3Agent(config, messageBus);
}

// Export all components
module.exports = {
  // Core components
  Agent,
  AGENT_STATUS,
  AgentFactory,
  AgentRegistry,
  AgentManager,
  EscalationManager,
  ESCALATION_LEVEL,
  ESCALATION_REASON,
  
  // Base agent classes
  BaseL1Agent,
  BaseL2Agent,
  BaseL3Agent,
  
  // Convenience functions for creating agents and hierarchies
  createAgentHierarchy,
  createL1Agent,
  createL2Agent,
  createL3Agent,
  
  // Testing
  testAgentHierarchy
};

// Register with global Cipher Guard object if available
if (global.cipherGuard) {
  global.cipherGuard.agents = module.exports;
}