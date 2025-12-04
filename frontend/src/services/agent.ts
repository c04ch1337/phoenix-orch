import socketService from './socket';
import telemetryService from './telemetry';

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  capabilities: string[];
  deploymentDetails: {
    targetId: string;
    targetType: string;
    deploymentTime: number;
    lastHealthCheck: number;
    configuration: Record<string, any>;
  };
  metrics?: {
    cpuUsage?: number;
    memoryUsage?: number;
    threatsCaptured?: number;
    actionsPerformed?: number;
  };
}

export type AgentType = 
  | 'SOC_Analyst'
  | 'Threat_Hunter'
  | 'Incident_Responder'
  | 'Forensic_Analyst'
  | 'Compliance_Auditor'
  | 'System_Hardener'
  | 'Recovery_Specialist';

export type AgentStatus = 
  | 'idle'
  | 'deployed'
  | 'active'
  | 'investigating'
  | 'remediating'
  | 'error'
  | 'offline';

export interface AgentCommand {
  agentId: string;
  commandType: string;
  parameters: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  correlationId?: string;
}

export interface AgentDeploymentOptions {
  targetId: string;
  targetType: string;
  agentType: AgentType;
  initialConfiguration?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

class AgentService {
  private agents: Map<string, Agent> = new Map();
  private pendingCommands: Map<string, AgentCommand> = new Map();
  private commandHandlers: Map<string, (response: any) => void> = new Map();

  constructor() {
    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    // Listen for agent status updates
    socketService.registerMessageHandler('agent_status_update', (data) => {
      const { agentId, status, metrics } = data;
      
      if (this.agents.has(agentId)) {
        const agent = this.agents.get(agentId)!;
        agent.status = status;
        if (metrics) {
          agent.metrics = {...agent.metrics, ...metrics};
        }
        
        // Update the agent in the map
        this.agents.set(agentId, agent);
        
        // Record telemetry
        telemetryService.recordEvent('agent_status_change', {
          agentId, 
          status, 
          metrics
        }, 'info', 'agent-service');
      }
    });
    
    // Listen for command responses
    socketService.registerMessageHandler('agent_command_response', (data) => {
      const { correlationId, result, error } = data;
      
      if (this.commandHandlers.has(correlationId)) {
        const handler = this.commandHandlers.get(correlationId);
        if (handler) {
          handler({ result, error });
          this.commandHandlers.delete(correlationId);
        }
      }
      
      if (this.pendingCommands.has(correlationId)) {
        this.pendingCommands.delete(correlationId);
      }
    });
    
    // Listen for new agent registrations
    socketService.registerMessageHandler('agent_registered', (data) => {
      const { agent } = data;
      this.agents.set(agent.id, agent);
      
      telemetryService.recordEvent('agent_registered', {
        agentId: agent.id, 
        agentType: agent.type
      }, 'info', 'agent-service');
    });
    
    // Listen for agent deregistrations
    socketService.registerMessageHandler('agent_deregistered', (data) => {
      const { agentId } = data;
      if (this.agents.has(agentId)) {
        this.agents.delete(agentId);
        
        telemetryService.recordEvent('agent_deregistered', {
          agentId
        }, 'info', 'agent-service');
      }
    });
  }

  public async deployAgent(options: AgentDeploymentOptions): Promise<Agent | null> {
    try {
      // Send deployment request to backend
      const correlationId = `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create promise to handle the asynchronous response
      const deploymentPromise = new Promise<Agent | null>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.commandHandlers.delete(correlationId);
          reject(new Error('Agent deployment timed out'));
        }, 30000); // 30 seconds timeout
        
        this.commandHandlers.set(correlationId, (response) => {
          clearTimeout(timeoutId);
          
          if (response.error) {
            reject(new Error(`Agent deployment failed: ${response.error}`));
          } else if (response.result && response.result.agent) {
            const agent = response.result.agent;
            this.agents.set(agent.id, agent);
            resolve(agent);
          } else {
            reject(new Error('Invalid agent deployment response'));
          }
        });
      });
      
      // Send the deployment request
      socketService.send('deploy_agent', {
        ...options,
        correlationId
      });
      
      // Record telemetry
      telemetryService.recordEvent('agent_deployment_requested', {
        targetId: options.targetId,
        targetType: options.targetType,
        agentType: options.agentType,
        correlationId
      }, 'info', 'agent-service');
      
      // Wait for the response
      return await deploymentPromise;
    } catch (error) {
      console.error('Error deploying agent:', error);
      telemetryService.recordEvent('agent_deployment_failed', {
        error: error instanceof Error ? error.message : String(error),
        options
      }, 'error', 'agent-service');
      return null;
    }
  }

  public async sendAgentCommand(command: Omit<AgentCommand, 'timestamp'>): Promise<any> {
    try {
      const agentId = command.agentId;
      const correlationId = `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Check if agent exists
      if (!this.agents.has(agentId)) {
        throw new Error(`Agent with ID ${agentId} not found`);
      }
      
      // Create full command with timestamp
      const fullCommand: AgentCommand = {
        ...command,
        timestamp: Date.now(),
        correlationId
      };
      
      // Add to pending commands
      this.pendingCommands.set(correlationId, fullCommand);
      
      // Create promise to handle the asynchronous response
      const commandPromise = new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.commandHandlers.delete(correlationId);
          this.pendingCommands.delete(correlationId);
          reject(new Error('Command timed out'));
        }, 60000); // 60 seconds timeout
        
        this.commandHandlers.set(correlationId, (response) => {
          clearTimeout(timeoutId);
          
          if (response.error) {
            reject(new Error(`Command failed: ${response.error}`));
          } else {
            resolve(response.result);
          }
        });
      });
      
      // Send the command
      socketService.send('agent_command', fullCommand);
      
      // Record telemetry
      telemetryService.recordEvent('agent_command_sent', {
        agentId,
        commandType: command.commandType,
        correlationId
      }, 'info', 'agent-service');
      
      // Wait for the response
      return await commandPromise;
    } catch (error) {
      console.error('Error sending agent command:', error);
      telemetryService.recordEvent('agent_command_failed', {
        error: error instanceof Error ? error.message : String(error),
        command
      }, 'error', 'agent-service');
      throw error;
    }
  }

  public async terminateAgent(agentId: string): Promise<boolean> {
    try {
      if (!this.agents.has(agentId)) {
        throw new Error(`Agent with ID ${agentId} not found`);
      }
      
      const correlationId = `terminate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create promise to handle the asynchronous response
      const terminationPromise = new Promise<boolean>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.commandHandlers.delete(correlationId);
          reject(new Error('Agent termination timed out'));
        }, 30000); // 30 seconds timeout
        
        this.commandHandlers.set(correlationId, (response) => {
          clearTimeout(timeoutId);
          
          if (response.error) {
            reject(new Error(`Agent termination failed: ${response.error}`));
          } else {
            // Remove agent from local map
            this.agents.delete(agentId);
            resolve(true);
          }
        });
      });
      
      // Send the termination request
      socketService.send('terminate_agent', {
        agentId,
        correlationId
      });
      
      // Record telemetry
      telemetryService.recordEvent('agent_termination_requested', {
        agentId,
        correlationId
      }, 'info', 'agent-service');
      
      // Wait for the response
      return await terminationPromise;
    } catch (error) {
      console.error('Error terminating agent:', error);
      telemetryService.recordEvent('agent_termination_failed', {
        error: error instanceof Error ? error.message : String(error),
        agentId
      }, 'error', 'agent-service');
      return false;
    }
  }

  public getAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  public getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  public getAgentsByType(type: AgentType): Agent[] {
    return this.getAgents().filter(agent => agent.type === type);
  }

  public getActiveAgents(): Agent[] {
    return this.getAgents().filter(agent => 
      agent.status === 'deployed' || 
      agent.status === 'active' || 
      agent.status === 'investigating' ||
      agent.status === 'remediating'
    );
  }

  public async deployDefensiveBlueTeam(targetId: string, targetType: string): Promise<Agent[]> {
    // Deploy a full blue team with all types of agents
    const agentTypes: AgentType[] = [
      'SOC_Analyst',
      'Threat_Hunter',
      'Incident_Responder',
      'Forensic_Analyst',
      'Compliance_Auditor',
      'System_Hardener',
      'Recovery_Specialist'
    ];
    
    const deploymentPromises = agentTypes.map(agentType => 
      this.deployAgent({
        targetId,
        targetType,
        agentType
      })
    );
    
    const results = await Promise.allSettled(deploymentPromises);
    const deployedAgents: Agent[] = results
      .filter((result): result is PromiseFulfilledResult<Agent | null> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value as Agent);
    
    // Record telemetry
    telemetryService.recordEvent('blue_team_deployed', {
      targetId,
      targetType,
      deployedAgentCount: deployedAgents.length,
      requestedAgentCount: agentTypes.length
    }, 'info', 'agent-service');
    
    return deployedAgents;
  }
}

// Create a singleton instance
const agentService = new AgentService();

export default agentService;