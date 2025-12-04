/**
 * Agent Manager
 * 
 * This module implements the Agent Manager which coordinates agent operations
 * including lifecycle management, workload distribution, performance monitoring,
 * health checks, and agent state persistence.
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const utils = require('../utils');
const AgentFactory = require('./agent_factory');
const AgentRegistry = require('./agent_registry');
const { AGENT_STATUS } = require('./index');

/**
 * AgentManager class for coordinating agent operations
 * @class AgentManager
 * @extends EventEmitter
 */
class AgentManager extends EventEmitter {
  /**
   * Create a new AgentManager
   * @param {Object} options - Manager options
   * @param {Object} options.messageBus - Message bus for agent communication
   * @param {string} options.persistencePath - Path for persisting agent state
   * @param {Object} options.agentFactory - Existing AgentFactory instance (optional)
   * @param {Object} options.agentRegistry - Existing AgentRegistry instance (optional)
   */
  constructor(options = {}) {
    super();
    
    // Dependencies
    this._messageBus = options.messageBus;
    this._persistencePath = options.persistencePath || path.join(__dirname, '../data/agent_states');
    
    // Create or use provided factory and registry
    this._factory = options.agentFactory || new AgentFactory({ 
      messageBus: this._messageBus 
    });
    
    this._registry = options.agentRegistry || new AgentRegistry();
    
    // Internal state
    this._isRunning = false;
    this._healthCheckInterval = null;
    this._persistenceInterval = null;
    
    // Health check and persistence intervals (in milliseconds)
    this._healthCheckIntervalMs = options.healthCheckIntervalMs || 30000;  // 30 seconds
    this._persistenceIntervalMs = options.persistenceIntervalMs || 60000;  // 60 seconds
    
    // Agent shutdown timeouts
    this._shutdownTimeoutMs = options.shutdownTimeoutMs ||
      (['test', 'development'].includes(process.env.NODE_ENV) ? 1000 : 5000);
    
    // Initialize logging
    this._initializeLogging();
    
    // Setup event handlers
    this._setupEventHandlers();
  }
  
  /**
   * Initialize logging
   * @private
   */
  _initializeLogging() {
    this.log = {
      info: (message) => {
        console.log(`[INFO][AgentManager] ${message}`);
        utils.telemetry.log('info', `[AgentManager] ${message}`);
      },
      warn: (message) => {
        console.warn(`[WARN][AgentManager] ${message}`);
        utils.telemetry.log('warn', `[AgentManager] ${message}`);
      },
      error: (message, error = null) => {
        console.error(`[ERROR][AgentManager] ${message}`, error);
        utils.telemetry.log('error', `[AgentManager] ${message}`, { 
          error: error ? { message: error.message, stack: error.stack } : null 
        });
      },
      debug: (message) => {
        console.debug(`[DEBUG][AgentManager] ${message}`);
        utils.telemetry.log('debug', `[AgentManager] ${message}`);
      }
    };
  }
  
  /**
   * Set up event handlers
   * @private
   */
  _setupEventHandlers() {
    // Handle agent registry events
    this._registry.on('agent:registered', ({ agent }) => {
      // Set up agent event handlers
      this._setupAgentEventHandlers(agent);
      
      // Report to metrics
      utils.metrics.increment('agent_manager.agents.registered', 1, {
        agentType: agent.type
      });
    });
    
    this._registry.on('agent:deregistered', ({ agentId, type }) => {
      // Report to metrics
      utils.metrics.increment('agent_manager.agents.deregistered', 1, {
        agentType: type || 'unknown'
      });
    });
    
    // Handle process exit for graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }
  
  /**
   * Set up event handlers for an agent
   * @param {Agent} agent - Agent to set up handlers for
   * @private
   */
  _setupAgentEventHandlers(agent) {
    // Handle agent errors
    agent.on('error', (error) => {
      this.log.error(`Error in agent ${agent.id} (${agent.name})`, error);
      
      // Report to metrics
      utils.metrics.increment('agent_manager.agent_errors', 1, {
        agentType: agent.type
      });
      
      // Emit agent error event
      this.emit('agent:error', {
        agentId: agent.id,
        error: { message: error.message, stack: error.stack }
      });
    });
    
    // Handle agent termination
    agent.on('terminated', (data) => {
      this.log.warn(`Agent ${agent.id} (${agent.name}) terminated: ${data.reason}`);
      
      // Deregister the agent
      this._registry.deregisterAgent(agent.id);
      
      // Report to metrics
      utils.metrics.increment('agent_manager.agent_terminations', 1, {
        agentType: agent.type,
        reason: data.reason
      });
      
      // Emit agent terminated event
      this.emit('agent:terminated', {
        agentId: agent.id,
        agentType: agent.type,
        reason: data.reason
      });
    });
    
    // Handle escalations
    agent.on('escalation', (data) => {
      this.log.info(
        `Escalation from agent ${agent.id} (${agent.name}) to tier ${data.targetTier}`
      );
      
      // Emit escalation event
      this.emit('agent:escalation', {
        ...data,
        sourceAgentName: agent.name
      });
    });
  }
  
  /**
   * Start the Agent Manager
   * @param {Object} options - Startup options
   * @returns {Promise<boolean>} Success status
   */
  async start(options = {}) {
    if (this._isRunning) {
      this.log.warn('Agent Manager is already running');
      return true;
    }
    
    try {
      this.log.info('Starting Agent Manager');
      
      // Ensure persistence directory exists
      await this._ensurePersistenceDirectory();
      
      // Start health check interval
      this._startHealthChecks();
      
      // Start persistence interval
      this._startStatePersistence();
      
      // Initialize agents from persistent state if enabled
      if (options.loadPersistedAgents !== false) {
        await this._loadPersistedAgents();
      }
      
      // Mark as running
      this._isRunning = true;
      
      // Emit started event
      this.emit('started');
      
      this.log.info('Agent Manager started successfully');
      
      return true;
    } catch (error) {
      this.log.error('Failed to start Agent Manager', error);
      
      // Clean up if start failed
      this._stopHealthChecks();
      this._stopStatePersistence();
      
      return false;
    }
  }
  
  /**
   * Stop the Agent Manager
   * @returns {Promise<boolean>} Success status
   */
  async shutdown() {
    if (!this._isRunning) {
      this.log.warn('Agent Manager is not running');
      return true;
    }
    
    try {
      this.log.info('Shutting down Agent Manager');
      
      // Stop health checks
      this._stopHealthChecks();
      
      // Stop persistence
      this._stopStatePersistence();
      
      // Persist current state before shutdown
      await this._persistAgentStates();
      
      // Shut down all agents
      await this._shutdownAllAgents();
      
      // Mark as not running
      this._isRunning = false;
      
      // Emit shutdown event
      this.emit('shutdown');
      
      this.log.info('Agent Manager shut down successfully');
      
      return true;
    } catch (error) {
      this.log.error('Error during Agent Manager shutdown', error);
      return false;
    }
  }
  
  /**
   * Shut down all agents
   * @returns {Promise<void>}
   * @private
   */
  async _shutdownAllAgents() {
    const agents = this._registry.getAllAgents();
    this.log.info(`Shutting down ${agents.length} agents`);
    
    const shutdownPromises = agents.map(async (agent) => {
      try {
        // Set a timeout for agent shutdown
        const shutdownPromise = agent.shutdown();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Shutdown timeout')), this._shutdownTimeoutMs)
        );
        
        // Wait for shutdown or timeout
        await Promise.race([shutdownPromise, timeoutPromise]);
        
        // Deregister the agent
        this._registry.deregisterAgent(agent.id);
        
        return { success: true, agentId: agent.id };
      } catch (error) {
        this.log.error(`Failed to shut down agent ${agent.id}`, error);
        
        // Force deregistration
        this._registry.deregisterAgent(agent.id);
        
        return { success: false, agentId: agent.id, error: error.message };
      }
    });
    
    await Promise.all(shutdownPromises);
  }
  
  /**
   * Start periodic health checks
   * @private
   */
  _startHealthChecks() {
    this._stopHealthChecks(); // Ensure no duplicate intervals
    
    this._healthCheckInterval = setInterval(() => {
      this._performHealthChecks()
        .catch(error => this.log.error('Error during health checks', error));
    }, this._healthCheckIntervalMs);
  }
  
  /**
   * Stop periodic health checks
   * @private
   */
  _stopHealthChecks() {
    if (this._healthCheckInterval) {
      clearInterval(this._healthCheckInterval);
      this._healthCheckInterval = null;
    }
  }
  
  /**
   * Perform health checks on all agents
   * @returns {Promise<void>}
   * @private
   */
  async _performHealthChecks() {
    const agents = this._registry.getAllAgents();
    this.log.debug(`Performing health checks on ${agents.length} agents`);
    
    const unhealthyAgents = [];
    
    for (const agent of agents) {
      try {
        // Check agent status
        const metrics = agent.metrics;
        const status = agent.status;
        
        // Calculate heartbeat (time since last activity)
        const lastActivity = metrics.lastActivity;
        const heartbeat = lastActivity ? Date.now() - lastActivity : Infinity;
        
        // Report agent metrics
        utils.metrics.gauge(`agent.${agent.id}.tasks_processed`, metrics.tasksProcessed);
        utils.metrics.gauge(`agent.${agent.id}.tasks_succeeded`, metrics.tasksSucceeded);
        utils.metrics.gauge(`agent.${agent.id}.tasks_failed`, metrics.tasksFailed);
        utils.metrics.gauge(`agent.${agent.id}.escalations`, metrics.escalations);
        utils.metrics.gauge(`agent.${agent.id}.avg_processing_time`, metrics.avgProcessingTime);
        
        // Check for stuck agents (in processing status for too long)
        if (
          status === AGENT_STATUS.PROCESSING && 
          heartbeat > this._healthCheckIntervalMs * 3 // No activity for 3x the health check interval
        ) {
          this.log.warn(
            `Agent ${agent.id} (${agent.name}) appears to be stuck in processing state`
          );
          
          unhealthyAgents.push({
            agentId: agent.id,
            agentName: agent.name,
            issue: 'stuck_processing',
            status,
            heartbeat
          });
          
          // Emit agent health issue event
          this.emit('agent:health:issue', {
            agentId: agent.id,
            issue: 'stuck_processing',
            status,
            heartbeat
          });
        }
        
        // Check for error state
        if (status === AGENT_STATUS.ERROR) {
          this.log.warn(
            `Agent ${agent.id} (${agent.name}) is in ERROR state`
          );
          
          unhealthyAgents.push({
            agentId: agent.id,
            agentName: agent.name,
            issue: 'error_state',
            status
          });
          
          // Emit agent health issue event
          this.emit('agent:health:issue', {
            agentId: agent.id,
            issue: 'error_state',
            status
          });
        }
      } catch (error) {
        this.log.error(
          `Error checking health of agent ${agent.id} (${agent.name})`, 
          error
        );
      }
    }
    
    // Take action on unhealthy agents if needed
    if (unhealthyAgents.length > 0) {
      this.log.warn(`Found ${unhealthyAgents.length} unhealthy agents`);
      
      // Attempt recovery based on issue type
      for (const unhealthyAgent of unhealthyAgents) {
        await this._attemptAgentRecovery(unhealthyAgent);
      }
    }
  }
  
  /**
   * Attempt to recover an unhealthy agent
   * @param {Object} unhealthyAgent - Information about the unhealthy agent
   * @returns {Promise<boolean>} Recovery success
   * @private
   */
  async _attemptAgentRecovery(unhealthyAgent) {
    const { agentId, issue } = unhealthyAgent;
    
    try {
      const agent = this._registry.getAgentById(agentId);
      if (!agent) {
        this.log.warn(`Cannot recover agent ${agentId}: not found in registry`);
        return false;
      }
      
      this.log.info(
        `Attempting to recover agent ${agentId} (${agent.name}) from issue: ${issue}`
      );
      
      let recoverySuccess = false;
      
      switch (issue) {
        case 'stuck_processing':
          // Try to restart the agent
          await agent.shutdown();
          await agent.initialize();
          recoverySuccess = agent.status === AGENT_STATUS.READY;
          break;
          
        case 'error_state':
          // Try to reset the agent
          await agent.initialize();
          recoverySuccess = agent.status === AGENT_STATUS.READY;
          break;
          
        default:
          this.log.warn(`Unknown issue type: ${issue}, cannot attempt recovery`);
          return false;
      }
      
      if (recoverySuccess) {
        this.log.info(`Successfully recovered agent ${agentId} (${agent.name})`);
        
        // Emit recovery event
        this.emit('agent:health:recovered', {
          agentId: agent.id,
          issue,
          recoverytime: Date.now()
        });
      } else {
        this.log.warn(`Failed to recover agent ${agentId} (${agent.name})`);
        
        // If recovery failed, consider replacing the agent
        await this._replaceAgent(agent);
      }
      
      return recoverySuccess;
    } catch (error) {
      this.log.error(`Error during agent recovery for ${agentId}`, error);
      return false;
    }
  }
  
  /**
   * Replace a failed agent with a new one of the same type
   * @param {Agent} failedAgent - Agent that failed to recover
   * @returns {Promise<Agent>} The new agent, or null if replacement failed
   * @private
   */
  async _replaceAgent(failedAgent) {
    try {
      const agentId = failedAgent.id;
      const agentType = failedAgent.type;
      const agentName = failedAgent.name;
      
      this.log.info(
        `Replacing failed agent ${agentId} (${agentName}) with a new agent of type ${agentType}`
      );
      
      // Deregister the failed agent
      this._registry.deregisterAgent(agentId);
      
      // Create a replacement agent
      const newAgent = await this._factory.createAgent(
        agentType, 
        { name: `${agentName}-replacement` }
      );
      
      if (newAgent) {
        // Register the new agent
        this._registry.registerAgent(newAgent);
        
        this.log.info(
          `Successfully replaced agent ${agentId} with new agent ${newAgent.id}`
        );
        
        // Emit replacement event
        this.emit('agent:replaced', {
          oldAgentId: agentId,
          newAgentId: newAgent.id,
          agentType
        });
        
        return newAgent;
      } else {
        this.log.error(`Failed to create replacement agent for ${agentId}`);
        return null;
      }
    } catch (error) {
      this.log.error(`Error replacing failed agent ${failedAgent.id}`, error);
      return null;
    }
  }
  
  /**
   * Start periodic agent state persistence
   * @private
   */
  _startStatePersistence() {
    this._stopStatePersistence(); // Ensure no duplicate intervals
    
    this._persistenceInterval = setInterval(() => {
      this._persistAgentStates()
        .catch(error => this.log.error('Error persisting agent states', error));
    }, this._persistenceIntervalMs);
  }
  
  /**
   * Stop periodic agent state persistence
   * @private
   */
  _stopStatePersistence() {
    if (this._persistenceInterval) {
      clearInterval(this._persistenceInterval);
      this._persistenceInterval = null;
    }
  }
  
  /**
   * Ensure the persistence directory exists
   * @returns {Promise<void>}
   * @private
   */
  async _ensurePersistenceDirectory() {
    try {
      await fs.mkdir(this._persistencePath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
  
  /**
   * Persist agent states to disk
   * @returns {Promise<void>}
   * @private
   */
  async _persistAgentStates() {
    if (!this._isRunning) {
      return;
    }
    
    try {
      const agents = this._registry.getAllAgents();
      this.log.debug(`Persisting state for ${agents.length} agents`);
      
      // Create agent state snapshot
      const agentStates = agents.map(agent => ({
        id: agent.id,
        type: agent.type,
        name: agent.name,
        status: agent.status,
        capabilities: agent.capabilities,
        metrics: agent.metrics,
        timestamp: Date.now()
      }));
      
      // Save the overall state snapshot
      const stateSnapshot = {
        version: '1.0',
        timestamp: Date.now(),
        agents: agentStates
      };
      
      // Write to disk
      const snapshotPath = path.join(this._persistencePath, 'agent_states.json');
      await fs.writeFile(
        snapshotPath,
        JSON.stringify(stateSnapshot, null, 2),
        'utf8'
      );
      
      // Persist individual agent states
      for (const agent of agents) {
        await this._persistAgentState(agent);
      }
      
      this.log.debug('Agent states persisted successfully');
    } catch (error) {
      this.log.error('Failed to persist agent states', error);
      throw error;
    }
  }
  
  /**
   * Persist an individual agent's state
   * @param {Agent} agent - Agent to persist state for
   * @returns {Promise<void>}
   * @private
   */
  async _persistAgentState(agent) {
    try {
      // Create the agent state
      const agentState = {
        id: agent.id,
        type: agent.type,
        name: agent.name,
        status: agent.status,
        capabilities: agent.capabilities,
        metrics: agent.metrics,
        timestamp: Date.now()
      };
      
      // Write to disk
      const agentPath = path.join(this._persistencePath, 'agents');
      await fs.mkdir(agentPath, { recursive: true });
      
      const agentFilePath = path.join(agentPath, `${agent.id}.json`);
      await fs.writeFile(
        agentFilePath,
        JSON.stringify(agentState, null, 2),
        'utf8'
      );
    } catch (error) {
      this.log.error(`Failed to persist state for agent ${agent.id}`, error);
      throw error;
    }
  }
  
  /**
   * Load agents from persisted state
   * @returns {Promise<void>}
   * @private
   */
  async _loadPersistedAgents() {
    try {
      // Check if state file exists
      const snapshotPath = path.join(this._persistencePath, 'agent_states.json');
      
      try {
        await fs.access(snapshotPath);
      } catch {
        this.log.info('No persisted agent states found');
        return;
      }
      
      // Load state snapshot
      const data = await fs.readFile(snapshotPath, 'utf8');
      const stateSnapshot = JSON.parse(data);
      
      this.log.info(`Loading ${stateSnapshot.agents.length} agents from persisted state`);
      
      // Recreate each agent
      for (const agentState of stateSnapshot.agents) {
        try {
          // Create the agent
          const agent = await this._factory.createAgent(
            agentState.type,
            {
              id: agentState.id,
              name: agentState.name,
              capabilities: agentState.capabilities
            }
          );
          
          if (agent) {
            // Register the agent
            this._registry.registerAgent(agent);
            
            this.log.debug(`Restored agent ${agent.id} (${agent.name})`);
          } else {
            this.log.warn(`Failed to restore agent ${agentState.id}`);
          }
        } catch (error) {
          this.log.error(`Error restoring agent ${agentState.id}`, error);
        }
      }
    } catch (error) {
      this.log.error('Failed to load persisted agent states', error);
      throw error;
    }
  }
  
  /**
   * Create an agent
   * @param {string} agentType - Type of agent to create
   * @param {Object} [config={}] - Agent configuration
   * @returns {Promise<Agent>} The created agent
   */
  async createAgent(agentType, config = {}) {
    try {
      // Create the agent
      const agent = await this._factory.createAgent(agentType, config);
      
      if (agent) {
        // Register the agent
        this._registry.registerAgent(agent);
        
        this.log.info(`Created and registered agent ${agent.id} (${agent.name})`);
        
        // Emit creation event
        this.emit('agent:created', {
          agentId: agent.id,
          agentType: agent.type,
          agentName: agent.name
        });
        
        return agent;
      } else {
        this.log.error(`Failed to create agent of type ${agentType}`);
        return null;
      }
    } catch (error) {
      this.log.error(`Error creating agent of type ${agentType}`, error);
      throw error;
    }
  }
  
  /**
   * Create a tiered agent structure
   * @param {Object} options - Options for the tiered structure
   * @returns {Promise<Object>} Created agents by tier
   */
  async createTieredStructure(options = {}) {
    try {
      // Create the agents using the factory
      const result = await this._factory.createTieredStructure(options);
      
      // Register all the agents
      for (const tier of ['l1', 'l2', 'l3']) {
        for (const agent of result[tier]) {
          this._registry.registerAgent(agent);
        }
      }
      
      this.log.info(
        `Created and registered tiered structure with ${result.l1.length} L1, ` +
        `${result.l2.length} L2, and ${result.l3.length} L3 agents`
      );
      
      // Emit creation event
      this.emit('tiered_structure:created', {
        l1Count: result.l1.length,
        l2Count: result.l2.length,
        l3Count: result.l3.length
      });
      
      return result;
    } catch (error) {
      this.log.error('Error creating tiered agent structure', error);
      throw error;
    }
  }
  
  /**
   * Distribute a task to suitable agents
   * @param {Object} task - Task to distribute
   * @param {Object} requirements - Agent requirements for the task
   * @returns {Promise<string>} ID of the agent assigned to the task
   */
  async distributeTask(task, requirements = {}) {
    try {
      // Find the most suitable agent
      const agent = this._registry.findSuitableAgent(requirements);
      
      if (!agent) {
        this.log.warn('No suitable agent found for task');
        
        // If a specific tier was requested, try to escalate
        if (requirements.tier) {
          const escalateToTier = this._getNextTier(requirements.tier);
          if (escalateToTier) {
            this.log.info(`Escalating task to ${escalateToTier} tier`);
            
            // Update requirements for next tier
            const escalatedRequirements = {
              ...requirements,
              tier: escalateToTier
            };
            
            // Recursively try to assign task to the next tier
            return this.distributeTask(task, escalatedRequirements);
          }
        }
        
        // Emit task unassigned event
        this.emit('task:unassigned', {
          task,
          requirements
        });
        
        return null;
      }
      
      // Add the task to the agent
      const taskId = agent.addTask({
        data: task,
        priority: requirements.priority || 0
      });
      
      this.log.info(`Assigned task ${taskId} to agent ${agent.id} (${agent.name})`);
      
      // Emit task assignment event
      this.emit('task:assigned', {
        taskId,
        agentId: agent.id,
        agentName: agent.name,
        agentType: agent.type
      });
      
      return agent.id;
    } catch (error) {
      this.log.error('Error distributing task', error);
      throw error;
    }
  }
  
  /**
   * Get the next tier for escalation
   * @param {string} currentTier - Current tier
   * @returns {string|null} Next tier, or null if already at highest
   * @private
   */
  _getNextTier(currentTier) {
    const tierMap = {
      'l1': 'l2',
      'l2': 'l3',
      'l3': 'dad'
    };
    
    return tierMap[currentTier.toLowerCase()] || null;
  }
  
  /**
   * Stop a specific agent
   * @param {string} agentId - ID of the agent to stop
   * @returns {Promise<boolean>} Operation success
   */
  async stopAgent(agentId) {
    const agent = this._registry.getAgentById(agentId);
    if (!agent) {
      this.log.warn(`Cannot stop agent ${agentId}: not found`);
      return false;
    }
    
    try {
      this.log.info(`Stopping agent ${agentId} (${agent.name})`);
      
      // Shutdown the agent
      await agent.shutdown();
      
      // Deregister from registry
      this._registry.deregisterAgent(agentId);
      
      // Emit agent stopped event
      this.emit('agent:stopped', {
        agentId,
        agentType: agent.type,
        agentName: agent.name
      });
      
      return true;
    } catch (error) {
      this.log.error(`Error stopping agent ${agentId}`, error);
      return false;
    }
  }
  
  /**
   * Pause a specific agent
   * @param {string} agentId - ID of the agent to pause
   * @returns {Promise<boolean>} Operation success
   */
  async pauseAgent(agentId) {
    const agent = this._registry.getAgentById(agentId);
    if (!agent) {
      this.log.warn(`Cannot pause agent ${agentId}: not found`);
      return false;
    }
    
    try {
      this.log.info(`Pausing agent ${agentId} (${agent.name})`);
      
      // Pause the agent
      await agent.pause();
      
      // Emit agent paused event
      this.emit('agent:paused', {
        agentId,
        agentName: agent.name,
        agentType: agent.type
      });
      
      return true;
    } catch (error) {
      this.log.error(`Error pausing agent ${agentId}`, error);
      return false;
    }
  }
  
  /**
   * Resume a specific agent
   * @param {string} agentId - ID of the agent to resume
   * @returns {Promise<boolean>} Operation success
   */
  async resumeAgent(agentId) {
    const agent = this._registry.getAgentById(agentId);
    if (!agent) {
      this.log.warn(`Cannot resume agent ${agentId}: not found`);
      return false;
    }
    
    try {
      this.log.info(`Resuming agent ${agentId} (${agent.name})`);
      
      // Resume the agent
      await agent.resume();
      
      // Emit agent resumed event
      this.emit('agent:resumed', {
        agentId,
        agentName: agent.name,
        agentType: agent.type
      });
      
      return true;
    } catch (error) {
      this.log.error(`Error resuming agent ${agentId}`, error);
      return false;
    }
  }
  
  /**
   * Get performance metrics for all agents
   * @returns {Object} Performance metrics by agent ID
   */
  getAgentPerformanceMetrics() {
    const agents = this._registry.getAllAgents();
    const metrics = {};
    
    agents.forEach(agent => {
      metrics[agent.id] = {
        ...agent.metrics,
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status: agent.status
      };
    });
    
    return metrics;
  }
  
  /**
   * Get the agent factory
   * @returns {AgentFactory} The agent factory
   */
  getAgentFactory() {
    return this._factory;
  }
  
  /**
   * Get the agent registry
   * @returns {AgentRegistry} The agent registry
   */
  getAgentRegistry() {
    return this._registry;
  }
}

module.exports = AgentManager;