import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/tauri';
import type { Mock } from 'vitest';
import MockEventEmitter from '../mocks/eventEmitter';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn()
}));

// Mock the EventEmitter in the agentManager module
vi.mock('events', () => {
  return {
    EventEmitter: MockEventEmitter
  };
});

// Import after mocking
import { agentManager, AgentType, AgentStatus } from '../../src/services/antigravity/agentManager';

describe('Agent Manager Integration Tests', () => {
  const mockInvoke = invoke as Mock;
  
  // Sample agent data
  const mockAgent1 = {
    id: 'agent-123',
    name: 'Test Agent 1',
    type: AgentType.EmberUnit,
    status: AgentStatus.Idle,
    createdAt: new Date().toISOString()
  };
  
  const mockAgent2 = {
    id: 'agent-456',
    name: 'Test Agent 2',
    type: AgentType.CipherGuard,
    status: AgentStatus.Working,
    currentTask: 'task-123',
    createdAt: new Date().toISOString()
  };
  
  beforeEach(() => {
    // Reset mocks before each test
    mockInvoke.mockReset();
    vi.clearAllMocks();
  });
  
  // AGENT-01: Create new agent instance
  test('AGENT-01: Create new agent instance', async () => {
    // Mock successful agent creation response
    mockInvoke.mockResolvedValueOnce(mockAgent1);
    
    // Call create agent method
    const result = await agentManager.createAgent({
      name: 'Test Agent 1',
      type: AgentType.EmberUnit
    });
    
    // Verify invoke was called with correct parameters
    expect(mockInvoke).toHaveBeenCalledWith('create_agent', {
      name: 'Test Agent 1',
      type: AgentType.EmberUnit,
      metadata: {}
    });
    
    // Verify agent was created correctly
    expect(result).toEqual(mockAgent1);
    expect(result.id).toBe('agent-123');
    expect(result.type).toBe(AgentType.EmberUnit);
  });
  
  // AGENT-02: List all active agents
  test('AGENT-02: List all active agents', async () => {
    // First, mock agent initialization response
    mockInvoke.mockResolvedValueOnce({ success: true });
    
    // Then, mock the load agents response
    mockInvoke.mockResolvedValueOnce([mockAgent1, mockAgent2]);
    
    // Initialize and load agents
    await agentManager.initialize();
    
    // Verify invoke was called to load agents
    expect(mockInvoke).toHaveBeenCalledWith('get_all_agents');
    
    // Get all agents and verify
    const agents = agentManager.getAllAgents();
    expect(agents.length).toBe(2);
    expect(agents[0].id).toBe('agent-123');
    expect(agents[1].id).toBe('agent-456');
    
    // Test filtering by type
    const emberAgents = agentManager.getAgentsByType(AgentType.EmberUnit);
    expect(emberAgents.length).toBe(1);
    expect(emberAgents[0].id).toBe('agent-123');
    
    // Test filtering by status
    const workingAgents = agentManager.getAgentsByStatus(AgentStatus.Working);
    expect(workingAgents.length).toBe(1);
    expect(workingAgents[0].id).toBe('agent-456');
  });
  
  // AGENT-03: Pause and resume agent
  test('AGENT-03: Pause and resume agent', async () => {
    // Mock pause agent response
    const pausedAgent = { ...mockAgent1, status: AgentStatus.Paused };
    mockInvoke.mockResolvedValueOnce(pausedAgent);
    
    // Pause the agent
    const pauseResult = await agentManager.pauseAgent('agent-123');
    
    // Verify invoke was called with correct parameters
    expect(mockInvoke).toHaveBeenCalledWith('pause_agent', { id: 'agent-123' });
    
    // Verify agent was paused
    expect(pauseResult.status).toBe(AgentStatus.Paused);
    
    // Mock resume agent response
    const resumedAgent = { ...mockAgent1, status: AgentStatus.Idle };
    mockInvoke.mockResolvedValueOnce(resumedAgent);
    
    // Resume the agent
    const resumeResult = await agentManager.resumeAgent('agent-123');
    
    // Verify invoke was called with correct parameters
    expect(mockInvoke).toHaveBeenCalledWith('resume_agent', { id: 'agent-123' });
    
    // Verify agent was resumed
    expect(resumeResult.status).toBe(AgentStatus.Idle);
  });
  
  // AGENT-04: Terminate agent
  test('AGENT-04: Terminate agent', async () => {
    // Mock terminate agent response
    const terminatedAgent = { ...mockAgent1, status: AgentStatus.Terminated };
    mockInvoke.mockResolvedValueOnce(terminatedAgent);
    
    // Terminate the agent
    const result = await agentManager.terminateAgent('agent-123');
    
    // Verify invoke was called with correct parameters
    expect(mockInvoke).toHaveBeenCalledWith('terminate_agent', { id: 'agent-123' });
    
    // Verify agent was terminated
    expect(result.status).toBe(AgentStatus.Terminated);
  });
  
  // AGENT-05: Restart failed agent
  test('AGENT-05: Restart failed agent by creating new instance', async () => {
    // Mock get agent response (failed agent)
    const failedAgent = { 
      ...mockAgent1, 
      status: AgentStatus.Error,
      error: 'Connection timeout'
    };
    mockInvoke.mockResolvedValueOnce(failedAgent);
    
    // Get the failed agent
    const initialAgent = await agentManager.getAgent('agent-123');
    expect(initialAgent.status).toBe(AgentStatus.Error);
    
    // Mock create agent response (new agent)
    const newAgentId = 'agent-789';
    const newAgent = { 
      ...mockAgent1,
      id: newAgentId,
      status: AgentStatus.Initializing,
      error: undefined
    };
    mockInvoke.mockResolvedValueOnce(newAgent);
    
    // Create new agent with same params
    const recreatedAgent = await agentManager.createAgent({
      name: initialAgent.name,
      type: initialAgent.type as AgentType
    });
    
    // Verify new agent was created
    expect(recreatedAgent.id).toBe(newAgentId);
    expect(recreatedAgent.status).toBe(AgentStatus.Initializing);
    expect(recreatedAgent.error).toBeUndefined();
  });
  
  // AGENT-06: Agent type validation
  test('AGENT-06: Agent type validation', async () => {
    // Mock create EmberUnit agent response
    mockInvoke.mockResolvedValueOnce({
      ...mockAgent1,
      type: AgentType.EmberUnit
    });
    
    // Create EmberUnit agent
    const emberAgent = await agentManager.createAgent({
      name: 'Ember Agent',
      type: AgentType.EmberUnit
    });
    
    // Verify EmberUnit agent
    expect(emberAgent.type).toBe(AgentType.EmberUnit);
    
    // Mock create CipherGuard agent response
    mockInvoke.mockResolvedValueOnce({
      ...mockAgent2,
      type: AgentType.CipherGuard
    });
    
    // Create CipherGuard agent
    const cipherGuardAgent = await agentManager.createAgent({
      name: 'CipherGuard Agent',
      type: AgentType.CipherGuard
    });
    
    // Verify CipherGuard agent
    expect(cipherGuardAgent.type).toBe(AgentType.CipherGuard);
  });
  
  // AGENT-07: Agent event subscription
  test('AGENT-07: Agent event subscription', async () => {
    // Setup event handler
    const testEventHandler = vi.fn();
    agentManager.events.on('agent_created', testEventHandler);
    
    // Mock agent creation and emit event
    mockInvoke.mockImplementationOnce(() => {
      setTimeout(() => {
        agentManager.events.emit('agent_created', mockAgent1);
      }, 10);
      return Promise.resolve(mockAgent1);
    });

    // Create agent which triggers the event
    await agentManager.createAgent({
      name: 'Test Agent 1',
      type: AgentType.EmberUnit
    });
    
    // Wait for the simulated event
    await new Promise(resolve => setTimeout(resolve, 20));
    
    // Verify event handler was called
    expect(testEventHandler).toHaveBeenCalledWith(mockAgent1);
    
    // Clean up
    agentManager.events.off('agent_created', testEventHandler);
  });
  
  // Test status monitoring
  test('Agent status monitoring can be started and stopped', async () => {
    // Mock successful responses
    mockInvoke.mockResolvedValueOnce({ success: true });
    mockInvoke.mockResolvedValueOnce({ success: true });
    
    // Start monitoring
    const startResult = await agentManager.startStatusMonitoring();
    
    // Verify invoke was called correctly
    expect(mockInvoke).toHaveBeenCalledWith('start_agent_status_monitoring');
    
    // Verify result
    expect(startResult).toEqual({ success: true });
    
    // Stop monitoring
    const stopResult = await agentManager.stopStatusMonitoring();
    
    // Verify invoke was called correctly
    expect(mockInvoke).toHaveBeenCalledWith('stop_agent_status_monitoring');
    
    // Verify result
    expect(stopResult).toEqual({ success: true });
  });
  
  // Test error handling
  test('Error handling when an agent operation fails', async () => {
    // Mock error response
    const mockError = {
      code: 'AGENT_ERROR',
      message: 'Failed to create agent',
      details: {
        reason: 'Network error'
      }
    };
    
    mockInvoke.mockRejectedValueOnce(mockError);
    
    // Attempt to create agent
    try {
      await agentManager.createAgent({
        name: 'Failed Agent',
        type: AgentType.EmberUnit
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      // Verify error handling
      expect(error).toEqual(mockError);
      
      // Verify last error is set
      expect(agentManager.getLastError()).toEqual(mockError);
    }
  });
});