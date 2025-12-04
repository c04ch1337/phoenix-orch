import { invoke } from '@tauri-apps/api/tauri';
import { EventEmitter } from 'events';

// Agent types supported by the system
export enum AgentType {
  EmberUnit = 'EmberUnit',
  CipherGuard = 'CipherGuard',
  Custom = 'Custom'
}

// Agent status enum
export enum AgentStatus {
  Initializing = 'initializing',
  Idle = 'idle',
  Planning = 'planning',
  Working = 'working',
  Paused = 'paused',
  Error = 'error',
  Terminated = 'terminated',
  Terminating = 'terminating'
}

// Agent interface
export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  currentTask?: string;
  createdAt: string;
  metadata?: Record<string, any>;
  error?: string;
}

// Agent creation parameters
export interface AgentCreateParams {
  name: string;
  type: AgentType;
  metadata?: Record<string, any>;
}

/**
 * Agent Manager service for creating and interacting with agents in the
 * Antigravity system. Provides a unified interface for agent operations.
 */
class AgentManager {
  private _agents: Map<string, Agent> = new Map();
  private _initialized: boolean = false;
  private _lastError: any = null;
  public events: EventEmitter;

  constructor() {
    this.events = new EventEmitter();
  }

  /**
   * Initialize the Agent Manager
   */
  async initialize(): Promise<any> {
    try {
      const result = await invoke('initialize_agent_manager');
      this._initialized = true;
      this.events.emit('manager_initialized', result);
      
      // Load existing agents
      await this.loadAgents();
      
      return result;
    } catch (error) {
      this._lastError = error;
      this.events.emit('manager_error', error);
      throw error;
    }
  }

  /**
   * Load all existing agents from the system
   */
  async loadAgents(): Promise<Agent[]> {
    try {
      const agents = await invoke<Agent[]>('get_all_agents');
      this._agents.clear();
      
      agents.forEach(agent => {
        this._agents.set(agent.id, agent);
      });
      
      this.events.emit('agents_loaded', agents);
      return agents;
    } catch (error) {
      this._lastError = error;
      this.events.emit('manager_error', error);
      throw error;
    }
  }

  /**
   * Create a new agent
   */
  async createAgent(params: AgentCreateParams): Promise<Agent> {
    try {
      const agent = await invoke<Agent>('create_agent', {
        name: params.name,
        type: params.type,
        metadata: params.metadata || {}
      });
      
      this._agents.set(agent.id, agent);
      this.events.emit('agent_created', agent);
      
      return agent;
    } catch (error) {
      this._lastError = error;
      this.events.emit('manager_error', error);
      throw error;
    }
  }

  /**
   * Get an agent by ID
   */
  async getAgent(id: string): Promise<Agent> {
    try {
      const agent = await invoke<Agent>('get_agent', { id });
      this._agents.set(agent.id, agent); // Update local cache
      return agent;
    } catch (error) {
      this._lastError = error;
      this.events.emit('manager_error', error);
      throw error;
    }
  }

  /**
   * Pause an agent
   */
  async pauseAgent(id: string): Promise<Agent> {
    try {
      const agent = await invoke<Agent>('pause_agent', { id });
      this._agents.set(agent.id, agent); // Update local cache
      this.events.emit('agent_paused', agent);
      return agent;
    } catch (error) {
      this._lastError = error;
      this.events.emit('manager_error', error);
      throw error;
    }
  }

  /**
   * Resume a paused agent
   */
  async resumeAgent(id: string): Promise<Agent> {
    try {
      const agent = await invoke<Agent>('resume_agent', { id });
      this._agents.set(agent.id, agent); // Update local cache
      this.events.emit('agent_resumed', agent);
      return agent;
    } catch (error) {
      this._lastError = error;
      this.events.emit('manager_error', error);
      throw error;
    }
  }

  /**
   * Terminate an agent
   */
  async terminateAgent(id: string): Promise<Agent> {
    try {
      const agent = await invoke<Agent>('terminate_agent', { id });
      this._agents.set(agent.id, agent); // Update local cache
      this.events.emit('agent_terminated', agent);
      return agent;
    } catch (error) {
      this._lastError = error;
      this.events.emit('manager_error', error);
      throw error;
    }
  }

  /**
   * Get all agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this._agents.values());
  }

  /**
   * Get agents by type
   */
  getAgentsByType(type: AgentType): Agent[] {
    return this.getAllAgents().filter(agent => agent.type === type);
  }

  /**
   * Get agents by status
   */
  getAgentsByStatus(status: AgentStatus): Agent[] {
    return this.getAllAgents().filter(agent => agent.status === status);
  }

  /**
   * Start monitoring agent status changes
   */
  async startStatusMonitoring(): Promise<any> {
    try {
      const result = await invoke('start_agent_status_monitoring');
      this.events.emit('monitoring_started', result);
      return result;
    } catch (error) {
      this._lastError = error;
      this.events.emit('manager_error', error);
      throw error;
    }
  }

  /**
   * Stop monitoring agent status changes
   */
  async stopStatusMonitoring(): Promise<any> {
    try {
      const result = await invoke('stop_agent_status_monitoring');
      this.events.emit('monitoring_stopped', result);
      return result;
    } catch (error) {
      this._lastError = error;
      this.events.emit('manager_error', error);
      throw error;
    }
  }

  /**
   * Get the last error
   */
  getLastError(): any {
    return this._lastError;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this._initialized;
  }
}

// Export a singleton instance
export const agentManager = new AgentManager();