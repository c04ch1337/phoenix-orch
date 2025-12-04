/**
 * Base Agent Class
 * 
 * This module defines the base Agent class that all specialized agents in the
 * Agentic SOC system will extend. It provides core functionality including
 * standard methods, communication interfaces, and event handling.
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const utils = require('../utils');

// Agent status constants
const AGENT_STATUS = Object.freeze({
  INITIALIZING: 'initializing',
  READY: 'ready',
  PROCESSING: 'processing',
  PAUSED: 'paused',
  ERROR: 'error',
  TERMINATED: 'terminated'
});

/**
 * Base Agent class that all specialized agents extend
 * @class Agent
 * @extends EventEmitter
 */
class Agent extends EventEmitter {
  /**
   * Creates a new Agent instance
   * @param {Object} config - Agent configuration
   * @param {string} config.id - Unique identifier for the agent (optional, generated if not provided)
   * @param {string} config.type - Type of agent (e.g., 'l1', 'l2', 'l3')
   * @param {string} config.name - Human-readable name of the agent
   * @param {string[]} config.capabilities - List of agent capabilities
   * @param {Object} config.options - Additional agent-specific options
   * @param {Object} messageBus - System message bus for inter-agent communication
   */
  constructor(config = {}, messageBus = null) {
    super();
    
    this._id = config.id || uuidv4();
    this._type = config.type || 'base';
    this._name = config.name || `Agent-${this._id.substring(0, 8)}`;
    this._capabilities = config.capabilities || [];
    this._options = config.options || {};
    this._status = AGENT_STATUS.INITIALIZING;
    this._messageBus = messageBus;
    
    // Performance and health metrics
    this._metrics = {
      tasksProcessed: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      escalations: 0,
      lastActivity: null,
      avgProcessingTime: 0,
      totalProcessingTime: 0
    };

    // Store for pending and active tasks
    this._tasks = {
      pending: [],
      active: null,
      history: []
    };

    this._startTime = Date.now();
    
    // Initialize logging
    this._initializeLogging();
    
    // Register event handlers
    this._registerEventHandlers();
  }

  /**
   * Initialize agent logging
   * @private
   */
  _initializeLogging() {
    this.log = {
      info: (message) => {
        console.log(`[INFO][${this._name}] ${message}`);
        utils.telemetry.log('info', `[${this._name}] ${message}`, { agentId: this._id, agentType: this._type });
      },
      warn: (message) => {
        console.warn(`[WARN][${this._name}] ${message}`);
        utils.telemetry.log('warn', `[${this._name}] ${message}`, { agentId: this._id, agentType: this._type });
      },
      error: (message, error = null) => {
        console.error(`[ERROR][${this._name}] ${message}`, error);
        utils.telemetry.log('error', `[${this._name}] ${message}`, { 
          agentId: this._id, 
          agentType: this._type,
          error: error ? { message: error.message, stack: error.stack } : null 
        });
      },
      debug: (message) => {
        if (this._options.debug) {
          console.debug(`[DEBUG][${this._name}] ${message}`);
          utils.telemetry.log('debug', `[${this._name}] ${message}`, { agentId: this._id, agentType: this._type });
        }
      }
    };
  }

  /**
   * Register event handlers for the agent
   * @private
   */
  _registerEventHandlers() {
    // Handle uncaught errors
    this.on('error', (error) => {
      this._status = AGENT_STATUS.ERROR;
      this.log.error('Uncaught error in agent', error);
      
      // Report to metrics
      utils.metrics.increment('agent.errors', 1, {
        agentId: this._id,
        agentType: this._type
      });
      
      // Attempt recovery if possible
      this._handleError(error);
    });
  }

  /**
   * Handle and attempt to recover from errors
   * @param {Error} error - The error that occurred
   * @private
   */
  _handleError(error) {
    // Try to recover from the error
    try {
      // Log the error
      this.log.error(`Error occurred: ${error.message}`, error);
      
      // If the agent was processing, try to recover the task
      if (this._status === AGENT_STATUS.PROCESSING && this._tasks.active) {
        this.log.warn(`Attempting to recover from error during task processing: ${this._tasks.active.id}`);
        
        // Mark the task as failed
        this._tasks.active.status = 'failed';
        this._tasks.active.error = error;
        this._tasks.history.push(this._tasks.active);
        this._tasks.active = null;
        
        // Update metrics
        this._metrics.tasksFailed++;
      }
      
      // Reset status to READY if recovery was successful
      this._status = AGENT_STATUS.READY;
      this.log.info('Successfully recovered from error');
      
      // If we have pending tasks, process the next one
      if (this._tasks.pending.length > 0) {
        this._processNextTask();
      }
    } catch (recoveryError) {
      // If recovery failed, transition to terminated state
      this.log.error('Failed to recover from error, terminating agent', recoveryError);
      this._status = AGENT_STATUS.TERMINATED;
      
      // Emit termination event
      this.emit('terminated', {
        agentId: this._id,
        reason: 'unrecoverable_error',
        originalError: error,
        recoveryError: recoveryError
      });
    }
  }

  /**
   * Process the next task in the pending queue
   * @private
   */
  _processNextTask() {
    if (this._tasks.pending.length === 0 || this._tasks.active !== null) {
      return;
    }
    
    // Take the next task from the pending queue
    this._tasks.active = this._tasks.pending.shift();
    this._status = AGENT_STATUS.PROCESSING;
    
    // Update last activity timestamp
    this._metrics.lastActivity = Date.now();
    
    // Log task processing
    this.log.info(`Processing task: ${this._tasks.active.id}`);
    
    // Start measuring processing time
    const startTime = Date.now();
    
    // Process the task
    Promise.resolve()
      .then(() => this.process(this._tasks.active.data))
      .then(result => {
        // Task completed successfully
        const processingTime = Date.now() - startTime;
        
        // Update metrics
        this._metrics.tasksProcessed++;
        this._metrics.tasksSucceeded++;
        this._metrics.totalProcessingTime += processingTime;
        this._metrics.avgProcessingTime = this._metrics.totalProcessingTime / this._metrics.tasksProcessed;
        
        // Update task status
        this._tasks.active.status = 'completed';
        this._tasks.active.result = result;
        this._tasks.active.processingTime = processingTime;
        
        // Add to history and clear active task
        this._tasks.history.push(this._tasks.active);
        this._tasks.active = null;
        
        // Update status
        this._status = AGENT_STATUS.READY;
        
        // Emit task completion event
        this.emit('taskCompleted', {
          taskId: this._tasks.active.id,
          result: result,
          processingTime: processingTime
        });
        
        // Process next task if available
        if (this._tasks.pending.length > 0) {
          this._processNextTask();
        }
        
        return result;
      })
      .catch(error => {
        // Task processing failed
        this._handleError(error);
      });
  }

  /**
   * Get agent ID
   * @returns {string} Agent ID
   */
  get id() {
    return this._id;
  }
  
  /**
   * Get agent type
   * @returns {string} Agent type
   */
  get type() {
    return this._type;
  }
  
  /**
   * Get agent name
   * @returns {string} Agent name
   */
  get name() {
    return this._name;
  }
  
  /**
   * Get agent capabilities
   * @returns {string[]} Agent capabilities
   */
  get capabilities() {
    return [...this._capabilities];
  }
  
  /**
   * Get agent status
   * @returns {string} Current status
   */
  get status() {
    return this._status;
  }
  
  /**
   * Get agent health metrics
   * @returns {Object} Health metrics
   */
  get metrics() {
    return {
      ...this._metrics,
      uptime: Date.now() - this._startTime,
      pendingTasks: this._tasks.pending.length,
      isProcessing: this._tasks.active !== null,
      status: this._status
    };
  }

  /**
   * Initialize the agent
   * @param {Object} options - Initialization options
   * @returns {Promise<boolean>} Success status
   */
  async initialize(options = {}) {
    try {
      this.log.info('Initializing agent');
      this._status = AGENT_STATUS.INITIALIZING;
      
      // Wait for any initialization tasks to complete
      await this._onInitialize(options);
      
      // Set status to READY
      this._status = AGENT_STATUS.READY;
      this.log.info('Agent initialized successfully');
      
      // Emit initialization event
      this.emit('initialized', {
        agentId: this._id,
        agentType: this._type
      });
      
      return true;
    } catch (error) {
      this._status = AGENT_STATUS.ERROR;
      this.log.error('Failed to initialize agent', error);
      
      // Emit error event
      this.emit('error', error);
      
      return false;
    }
  }
  
  /**
   * Cleanup and shutdown the agent
   * @returns {Promise<boolean>} Success status
   */
  async shutdown() {
    try {
      this.log.info('Shutting down agent');
      
      // Wait for any cleanup tasks to complete
      await this._onShutdown();
      
      // Set status to TERMINATED
      this._status = AGENT_STATUS.TERMINATED;
      this.log.info('Agent shut down successfully');
      
      // Emit shutdown event
      this.emit('shutdown', {
        agentId: this._id,
        agentType: this._type
      });
      
      return true;
    } catch (error) {
      this.log.error('Failed to shut down agent gracefully', error);
      
      // Emit error event
      this.emit('error', error);
      
      return false;
    }
  }

  /**
   * Pause agent activities
   * @returns {Promise<boolean>} Success status
   */
  async pause() {
    // Skip if already paused
    if (this._status === AGENT_STATUS.PAUSED) {
      return true;
    }
    
    try {
      const previousStatus = this._status;
      this._status = AGENT_STATUS.PAUSED;
      this.log.info('Agent paused');
      
      // Emit pause event
      this.emit('paused', {
        agentId: this._id,
        previousStatus: previousStatus
      });
      
      return true;
    } catch (error) {
      this.log.error('Failed to pause agent', error);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Resume agent activities
   * @returns {Promise<boolean>} Success status
   */
  async resume() {
    // Skip if not paused
    if (this._status !== AGENT_STATUS.PAUSED) {
      return true;
    }
    
    try {
      this._status = AGENT_STATUS.READY;
      this.log.info('Agent resumed');
      
      // Emit resume event
      this.emit('resumed', {
        agentId: this._id
      });
      
      // Process next task if available
      if (this._tasks.pending.length > 0) {
        this._processNextTask();
      }
      
      return true;
    } catch (error) {
      this.log.error('Failed to resume agent', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Add a task to the agent's queue
   * @param {Object} task - Task to process
   * @param {string} [task.id] - Task ID (optional, generated if not provided)
   * @param {*} task.data - Task data
   * @param {number} [task.priority=0] - Task priority (higher numbers = higher priority)
   * @returns {string} Task ID
   */
  addTask(task) {
    const taskObject = {
      id: task.id || uuidv4(),
      data: task.data,
      priority: task.priority || 0,
      status: 'pending',
      addedAt: Date.now()
    };
    
    // Add task to pending queue
    this._tasks.pending.push(taskObject);
    
    // Sort pending tasks by priority (higher first)
    this._tasks.pending.sort((a, b) => b.priority - a.priority);
    
    this.log.info(`Task added: ${taskObject.id}`);
    
    // If agent is ready and not processing anything, start processing
    if (this._status === AGENT_STATUS.READY && this._tasks.active === null) {
      this._processNextTask();
    }
    
    return taskObject.id;
  }

  /**
   * Process incoming data (to be overridden by subclasses)
   * @param {*} data - Data to process
   * @returns {Promise<*>} Processing result
   */
  async process(data) {
    throw new Error('Method process() must be implemented by subclass');
  }
  
  /**
   * Analyze data and draw conclusions (to be overridden by subclasses)
   * @param {*} data - Data to analyze
   * @returns {Promise<*>} Analysis result
   */
  async analyze(data) {
    throw new Error('Method analyze() must be implemented by subclass');
  }
  
  /**
   * Generate a report based on findings (to be overridden by subclasses)
   * @param {*} findings - Findings to report
   * @returns {Promise<Object>} Report object
   */
  async report(findings) {
    throw new Error('Method report() must be implemented by subclass');
  }
  
  /**
   * Escalate an issue to a higher tier (to be overridden by subclasses)
   * @param {*} issue - Issue to escalate
   * @param {string} targetTier - Target tier (L2, L3, Dad)
   * @returns {Promise<boolean>} Success status
   */
  async escalate(issue, targetTier) {
    // Basic escalation implementation - to be enhanced by subclasses
    try {
      this.log.info(`Escalating issue to ${targetTier}`);
      
      // Update escalation metrics
      this._metrics.escalations++;
      
      // Emit escalation event
      this.emit('escalation', {
        agentId: this._id,
        issue: issue,
        targetTier: targetTier,
        timestamp: Date.now()
      });
      
      return true;
    } catch (error) {
      this.log.error('Failed to escalate issue', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Send a message to another agent via the message bus
   * @param {string} targetAgentId - ID of the target agent
   * @param {string} messageType - Type of message
   * @param {*} data - Message payload
   * @returns {boolean} Success status
   */
  sendMessage(targetAgentId, messageType, data) {
    if (!this._messageBus) {
      this.log.error('Cannot send message: message bus not available');
      return false;
    }
    
    try {
      const message = {
        id: uuidv4(),
        source: this._id,
        target: targetAgentId,
        type: messageType,
        timestamp: Date.now(),
        data: data
      };
      
      this._messageBus.publishMessage(message);
      this.log.debug(`Message sent to ${targetAgentId}: ${messageType}`);
      return true;
    } catch (error) {
      this.log.error('Failed to send message', error);
      return false;
    }
  }

  /**
   * Subscribe to messages from the message bus
   * @param {string} messageType - Type of messages to subscribe to (or '*' for all)
   * @param {Function} handler - Message handler function
   * @returns {Function} Unsubscribe function
   */
  subscribeToMessages(messageType, handler) {
    if (!this._messageBus) {
      this.log.error('Cannot subscribe to messages: message bus not available');
      return () => {};
    }
    
    try {
      const subscription = this._messageBus.subscribe(
        messageType,
        (message) => {
          // Only process messages targeted at this agent or broadcast messages
          if (message.target === this._id || message.target === 'broadcast') {
            handler(message);
          }
        }
      );
      
      this.log.debug(`Subscribed to message type: ${messageType}`);
      return subscription;
    } catch (error) {
      this.log.error('Failed to subscribe to messages', error);
      return () => {};
    }
  }

  /**
   * Lifecycle hook called during initialization (to be overridden by subclasses)
   * @param {Object} options - Initialization options
   * @returns {Promise<void>}
   * @protected
   */
  async _onInitialize(options) {
    // To be implemented by subclasses
  }
  
  /**
   * Lifecycle hook called during shutdown (to be overridden by subclasses)
   * @returns {Promise<void>}
   * @protected
   */
  async _onShutdown() {
    // To be implemented by subclasses
  }
}

module.exports = {
  Agent,
  AGENT_STATUS
};