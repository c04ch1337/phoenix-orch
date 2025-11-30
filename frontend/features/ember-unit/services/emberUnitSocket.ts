import { WebSocketService } from '../../../src/services/socket';
import { SecurityFinding, Engagement, Agent, WebSocketMessage } from '../types';

class EmberUnitSocketService {
  private socket = WebSocketService.getInstance();
  private findingHandlers: ((finding: SecurityFinding) => void)[] = [];
  private statusHandlers: ((engagement: Engagement) => void)[] = [];
  private agentUpdateHandlers: ((agent: Agent) => void)[] = [];

  constructor() {
    this.setupListeners();
  }

  private setupListeners() {
    this.socket.onMessage((data: any) => {
      if (data.type === 'ember_finding_discovered') {
        this.handleFindingDiscovered(data.data);
      } else if (data.type === 'ember_engagement_update') {
        this.handleEngagementUpdate(data.data);
      } else if (data.type === 'ember_agent_update') {
        this.handleAgentUpdate(data.data);
      }
    });
  }

  private handleFindingDiscovered(data: any) {
    const finding: SecurityFinding = {
      id: data.id,
      title: data.title,
      description: data.description,
      severity: data.severity,
      category: data.category,
      mitreTactics: data.mitreTactics || [],
      remediation: data.remediation,
      discoveredAt: data.discoveredAt,
      confidence: data.confidence || 0
    };

    this.findingHandlers.forEach(handler => handler(finding));
  }

  private handleEngagementUpdate(data: any) {
    const engagement: Engagement = {
      id: data.id,
      target: data.target,
      status: data.status,
      currentPhase: data.currentPhase,
      startTime: data.startTime,
      endTime: data.endTime,
      findings: data.findings || [],
      agents: data.agents || [],
      progress: data.progress || 0,
      riskScore: data.riskScore || 0,
      metadata: data.metadata || {}
    };

    this.statusHandlers.forEach(handler => handler(engagement));
  }

  private handleAgentUpdate(data: any) {
    const agent: Agent = {
      id: data.id,
      name: data.name,
      status: data.status,
      currentTarget: data.currentTarget,
      capabilities: data.capabilities || [],
      lastSeen: data.lastSeen,
      resources: data.resources || { cpu: 0, memory: 0, network: 0, storage: 0 },
      findings: data.findings || []
    };

    this.agentUpdateHandlers.forEach(handler => handler(agent));
  }

  // Public API
  public onFindingDiscovered(handler: (finding: SecurityFinding) => void) {
    this.findingHandlers.push(handler);
    return () => {
      this.findingHandlers = this.findingHandlers.filter(h => h !== handler);
    };
  }

  public onEngagementUpdate(handler: (engagement: Engagement) => void) {
    this.statusHandlers.push(handler);
    return () => {
      this.statusHandlers = this.statusHandlers.filter(h => h !== handler);
    };
  }

  public onAgentUpdate(handler: (agent: Agent) => void) {
    this.agentUpdateHandlers.push(handler);
    return () => {
      this.agentUpdateHandlers = this.agentUpdateHandlers.filter(h => h !== handler);
    };
  }

  public requestStatusUpdate() {
    this.socket.send({
      type: 'ember_status_request',
      timestamp: Date.now()
    });
  }

  public initiateEngagement(target: string, scope: any) {
    this.socket.send({
      type: 'ember_engagement_initiate',
      target,
      scope,
      timestamp: Date.now()
    });
  }

  public executeTechnique(techniqueId: string, target: string) {
    this.socket.send({
      type: 'ember_technique_execute',
      techniqueId,
      target,
      timestamp: Date.now()
    });
  }

  public pauseEngagement(engagementId: string) {
    this.socket.send({
      type: 'ember_engagement_pause',
      engagementId,
      timestamp: Date.now()
    });
  }

  public resumeEngagement(engagementId: string) {
    this.socket.send({
      type: 'ember_engagement_resume',
      engagementId,
      timestamp: Date.now()
    });
  }

  public terminateEngagement(engagementId: string) {
    this.socket.send({
      type: 'ember_engagement_terminate',
      engagementId,
      timestamp: Date.now()
    });
  }
}

export const emberUnitSocket = new EmberUnitSocketService();