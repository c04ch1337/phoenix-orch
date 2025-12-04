/**
 * Agent Hierarchy Test
 * 
 * This module demonstrates how the various agent components work together to create
 * the hierarchical structure of the Agentic SOC system. It creates a complete agent
 * hierarchy and demonstrates the escalation flow from L1 → L2 → L3 → Dad.
 */

const EventEmitter = require('events');
const AgentFactory = require('./agent_factory');
const AgentRegistry = require('./agent_registry');
const AgentManager = require('./agent_manager');
const { EscalationManager, ESCALATION_REASON } = require('./escalation_manager');
const BaseL1Agent = require('./l1_agents/base_l1_agent');
const BaseL2Agent = require('./l2_agents/base_l2_agent');
const BaseL3Agent = require('./l3_agents/base_l3_agent');
const { Agent, AGENT_STATUS } = require('./index');
const utils = require('../utils');

/**
 * Simple message bus for testing agent communication
 */
class TestMessageBus extends EventEmitter {
  /**
   * Create a new TestMessageBus
   */
  constructor() {
    super();
    this._messages = [];
    this._subscribers = new Map();
  }
  
  /**
   * Subscribe to a message type
   * @param {string} messageType - Message type to subscribe to
   * @param {Function} handler - Message handler
   * @returns {Function} Unsubscribe function
   */
  subscribe(messageType, handler) {
    if (!this._subscribers.has(messageType)) {
      this._subscribers.set(messageType, new Set());
    }
    
    this._subscribers.get(messageType).add(handler);
    
    return () => {
      if (this._subscribers.has(messageType)) {
        this._subscribers.get(messageType).delete(handler);
      }
    };
  }
  
  /**
   * Publish a message to subscribers
   * @param {Object} message - Message to publish
   */
  publishMessage(message) {
    this._messages.push(message);
    
    // Emit to type-specific subscribers
    if (message.type && this._subscribers.has(message.type)) {
      for (const handler of this._subscribers.get(message.type)) {
        try {
          handler(message);
        } catch (error) {
          console.error(`Error in message handler for ${message.type}`, error);
        }
      }
    }
    
    // Emit to wildcard subscribers
    if (this._subscribers.has('*')) {
      for (const handler of this._subscribers.get('*')) {
        try {
          handler(message);
        } catch (error) {
          console.error(`Error in wildcard message handler`, error);
        }
      }
    }
  }
  
  /**
   * Get all messages of a specific type
   * @param {string} messageType - Message type to filter by
   * @returns {Array} Matching messages
   */
  getMessagesByType(messageType) {
    return this._messages.filter(m => m.type === messageType);
  }
  
  /**
   * Clear all stored messages
   */
  clearMessages() {
    this._messages = [];
  }
}

/**
 * Test the agent hierarchy
 */
async function testAgentHierarchy() {
  try {
    console.log('=== TESTING AGENT HIERARCHY ===');
    
    // Create message bus
    const messageBus = new TestMessageBus();
    
    // Create agent factory
    const factory = new AgentFactory({
      messageBus
    });
    
    // Register agent classes with factory
    factory.registerAgentType('l1_base', BaseL1Agent);
    factory.registerAgentType('l2_base', BaseL2Agent);
    factory.registerAgentType('l3_base', BaseL3Agent);
    
    // Create registry
    const registry = new AgentRegistry();
    
    // Create agent manager
    const manager = new AgentManager({
      messageBus,
      agentFactory: factory,
      agentRegistry: registry
    });
    
    // Create escalation manager
    const escalationManager = new EscalationManager({
      agentRegistry: registry,
      agentManager: manager,
      messageBus
    });
    
    // Initialize the manager
    await manager.start({ loadPersistedAgents: false });
    
    // Create tiered structure
    console.log('Creating agent hierarchy...');
    const tieredStructure = await manager.createTieredStructure({
      l1Count: 2,
      l2Count: 2,
      l3Count: 1,
      l1Config: { name: 'L1-TestAgent' },
      l2Config: { name: 'L2-TestAgent' },
      l3Config: { name: 'L3-TestAgent' }
    });
    
    console.log('Agent hierarchy created:');
    console.log(`- ${tieredStructure.l1.length} L1 agents`);
    console.log(`- ${tieredStructure.l2.length} L2 agents`);
    console.log(`- ${tieredStructure.l3.length} L3 agents`);
    
    // Get references to agents for testing
    const l1Agent = tieredStructure.l1[0];
    const l2Agent = tieredStructure.l2[0];
    const l3Agent = tieredStructure.l3[0];
    
    console.log('\n=== AGENT CAPABILITIES ===');
    console.log('L1 Agent capabilities:', l1Agent.capabilities);
    console.log('L2 Agent capabilities:', l2Agent.capabilities);
    console.log('L3 Agent capabilities:', l3Agent.capabilities);
    
    // Set up escalation testing
    console.log('\n=== TESTING ESCALATION FLOW ===');
    
    // Register message handlers
    messageBus.subscribe('escalation:l2', (message) => {
      console.log(`[TEST] L2 escalation received: ${message.data.id}`);
    });
    
    messageBus.subscribe('escalation:l3', (message) => {
      console.log(`[TEST] L3 escalation received: ${message.data.id}`);
    });
    
    messageBus.subscribe('dad:escalation', (message) => {
      console.log(`[TEST] Dad escalation received: ${message.data.id}`);
    });
    
    // Create test alert
    const testAlert = {
      id: 'test-alert-001',
      type: 'suspicious_login',
      source: 'firewall',
      severity: 70,
      confidence: 60,
      timestamp: Date.now(),
      details: {
        sourceIp: '192.168.1.100',
        targetSystem: 'authentication_server',
        attempts: 5
      }
    };
    
    console.log(`Created test alert: ${testAlert.id}`);
    
    // L1 agent processes the alert
    console.log('L1 agent processing alert...');
    const l1Result = await l1Agent.process({
      type: 'alert',
      alert: testAlert
    });
    
    console.log(`L1 processing result: ${l1Result.status}`);
    
    if (l1Result.status === 'escalated') {
      console.log('\nAlert was escalated from L1 → L2');
      
      // Check for escalation message
      const l2EscalationMessages = messageBus.getMessagesByType('escalation:l2');
      console.log(`Found ${l2EscalationMessages.length} L2 escalation messages`);
      
      if (l2EscalationMessages.length > 0) {
        // L2 agent processes the escalation
        const l2Escalation = l2EscalationMessages[0].data;
        
        console.log('\nL2 agent processing escalation...');
        const l2Result = await l2Agent.process({
          type: 'escalated_issue',
          escalation: l2Escalation
        });
        
        console.log(`L2 processing result: ${l2Result.status}`);
        
        if (l2Result.status === 'escalated_to_l3' || l2Result.status === 'escalated') {
          console.log('\nAlert was escalated from L2 → L3');
          
          // Check for escalation message
          const l3EscalationMessages = messageBus.getMessagesByType('escalation:l3');
          console.log(`Found ${l3EscalationMessages.length} L3 escalation messages`);
          
          if (l3EscalationMessages.length > 0) {
            // L3 agent processes the escalation
            const l3Escalation = l3EscalationMessages[0].data;
            
            console.log('\nL3 agent processing escalation...');
            const l3Result = await l3Agent.process({
              type: 'escalated_issue',
              escalation: l3Escalation
            });
            
            console.log(`L3 processing result: ${l3Result.status}`);
            
            if (l3Result.status === 'escalated_to_dad') {
              console.log('\nAlert was escalated from L3 → Dad');
              
              // Check for Dad escalation message
              const dadEscalationMessages = messageBus.getMessagesByType('dad:escalation');
              console.log(`Found ${dadEscalationMessages.length} Dad escalation messages`);
              
              if (dadEscalationMessages.length > 0) {
                console.log('\n✅ Full escalation chain successfully tested!');
                console.log('L1 → L2 → L3 → Dad escalation flow confirmed working');
              }
            }
          }
        }
      }
    }
    
    // Test direct escalation
    console.log('\n=== TESTING DIRECT ESCALATION ===');
    
    // Create critical alert (should go directly to Dad)
    const criticalAlert = {
      id: 'test-alert-002',
      type: 'data_breach',
      source: 'dlp',
      severity: 95,
      confidence: 90,
      timestamp: Date.now(),
      details: {
        dataType: 'pii',
        records: 10000,
        criticalAssetImpact: true
      }
    };
    
    console.log(`Created critical alert: ${criticalAlert.id}`);
    
    // Test escalation evaluation
    console.log('\nEvaluating critical alert for escalation...');
    const evaluationResult = escalationManager.evaluateForEscalation(criticalAlert, 'l1');
    
    console.log(`Evaluation result: ${JSON.stringify({
      shouldEscalate: evaluationResult.shouldEscalate,
      targetTier: evaluationResult.targetTier,
      reason: evaluationResult.reason
    }, null, 2)}`);
    
    if (evaluationResult.shouldEscalate && evaluationResult.targetTier === 'dad') {
      console.log('\n✅ Direct escalation L1 → Dad successfully tested!');
      console.log('Critical issues correctly route directly to Dad');
    }
    
    // Get some metrics
    console.log('\n=== AGENT METRICS ===');
    console.log('L1 Agent metrics:', l1Agent.metrics);
    
    // Shut down the manager
    await manager.shutdown();
    
    console.log('\n=== TEST COMPLETE ===');
    
    return {
      success: true,
      message: 'Agent hierarchy test completed successfully'
    };
    
  } catch (error) {
    console.error('Error in agent hierarchy test', error);
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Export test function
module.exports = {
  testAgentHierarchy
};

// Run directly if this module is executed
if (require.main === module) {
  testAgentHierarchy()
    .then(result => {
      console.log(`Test ${result.success ? 'succeeded' : 'failed'}: ${result.message || result.error}`);
    })
    .catch(error => {
      console.error('Uncaught error in test', error);
    });
}