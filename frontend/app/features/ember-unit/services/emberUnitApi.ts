import { Engagement, EngagementPhase, SecurityFinding, Agent, Report, EngagementStatus } from '../types';

/**
 * Interface for operations to validate
 */
interface OperationValidationRequest {
  operation_type: string;
  target?: string;
  parameters?: Record<string, unknown>;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  auth_level?: string;
}

/**
 * Interface for validation response
 */
interface ValidationResponse {
  valid: boolean;
  reason?: string;
  risk_assessment?: {
    score: number;
    category: string;
    mitigations?: string[];
  };
  restrictions?: string[];
}

/**
 * Interface describing system status information
 */
interface SystemStatus {
  status: 'operational' | 'degraded' | 'maintenance' | 'offline';
  version: string;
  uptime: number;
  resources: {
    cpu_usage: number;
    memory_usage: number;
    disk_space: number;
  };
  components: Record<string, {
    status: 'operational' | 'degraded' | 'offline';
    last_checked: string;
  }>;
  active_engagements: number;
  active_agents: number;
}

/**
 * Interface for health check response
 */
interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: Record<string, {
    status: 'pass' | 'fail' | 'warn';
    message?: string;
    timestamp: string;
    response_time_ms?: number;
  }>;
}

const API_BASE_URL = 'http://localhost:5001/api/v1';

export const emberUnitApi = {
  // Engagement management
  async initiateEngagement(target: string, scope: string[] = []): Promise<Engagement> {
    const response = await fetch(`${API_BASE_URL}/engagements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target,
        scope,
        exclusions: [],
        rules_of_engagement: ['standard']
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to initiate engagement: ${response.statusText}`);
    }

    return response.json();
  },

  async getEngagement(engagementId: string): Promise<Engagement> {
    const response = await fetch(`${API_BASE_URL}/engagements/${engagementId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get engagement: ${response.statusText}`);
    }

    return response.json();
  },

  async listEngagements(): Promise<Engagement[]> {
    const response = await fetch(`${API_BASE_URL}/engagements`);
    
    if (!response.ok) {
      throw new Error(`Failed to list engagements: ${response.statusText}`);
    }

    return response.json();
  },

  async updateEngagementStatus(engagementId: string, status: EngagementStatus): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/engagements/${engagementId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update engagement status: ${response.statusText}`);
    }
  },

  async executePhase(engagementId: string, phase: EngagementPhase): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/engagements/${engagementId}/phase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phase }),
    });

    if (!response.ok) {
      throw new Error(`Failed to execute phase: ${response.statusText}`);
    }
  },

  // Agent management
  async spawnAgent(engagementId: string, agentType: string): Promise<Agent> {
    const response = await fetch(`${API_BASE_URL}/agents/spawn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        engagement_id: engagementId,
        agent_type: agentType,
        target: 'auto'
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to spawn agent: ${response.statusText}`);
    }

    return response.json();
  },

  async getAgent(agentId: string): Promise<Agent> {
    const response = await fetch(`${API_BASE_URL}/agents/${agentId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get agent: ${response.statusText}`);
    }

    return response.json();
  },

  async listAgents(engagementId?: string): Promise<Agent[]> {
    const url = engagementId 
      ? `${API_BASE_URL}/agents?engagement_id=${engagementId}`
      : `${API_BASE_URL}/agents`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to list agents: ${response.statusText}`);
    }

    return response.json();
  },

  async getAgentOutput(agentId: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/agents/${agentId}/output`);
    
    if (!response.ok) {
      throw new Error(`Failed to get agent output: ${response.statusText}`);
    }

    return response.text();
  },

  // Findings management
  async getFindings(engagementId: string): Promise<SecurityFinding[]> {
    const response = await fetch(`${API_BASE_URL}/engagements/${engagementId}/findings`);
    
    if (!response.ok) {
      throw new Error(`Failed to get findings: ${response.statusText}`);
    }

    return response.json();
  },

  async updateFindingStatus(findingId: string, status: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/findings/${findingId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update finding status: ${response.statusText}`);
    }
  },

  // Report generation
  async generateReport(engagementId: string, reportType: string, format: string = 'pdf'): Promise<Report> {
    const response = await fetch(`${API_BASE_URL}/reports/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        engagement_id: engagementId,
        template: reportType,
        format
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate report: ${response.statusText}`);
    }

    return response.json();
  },

  async getReport(reportId: string): Promise<Report> {
    const response = await fetch(`${API_BASE_URL}/reports/${reportId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get report: ${response.statusText}`);
    }

    return response.json();
  },

  async downloadReport(reportId: string): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/reports/${reportId}/download`);
    
    if (!response.ok) {
      throw new Error(`Failed to download report: ${response.statusText}`);
    }

    return response.blob();
  },

  // Safety and ethics
  /**
   * Validates an operation for safety and ethics compliance
   * @param operation - The operation details to validate
   * @returns Promise resolving to validation results
   */
  async validateOperation(operation: OperationValidationRequest): Promise<ValidationResponse> {
    const response = await fetch(`${API_BASE_URL}/safety/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(operation),
    });

    if (!response.ok) {
      throw new Error(`Failed to validate operation: ${response.statusText}`);
    }

    return response.json();
  },

  async emergencyShutdown(reason: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/safety/shutdown`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason, urgency: 'critical' }),
    });

    if (!response.ok) {
      throw new Error(`Failed to emergency shutdown: ${response.statusText}`);
    }
  },

  // System status
  /**
   * Retrieves current system status information
   * @returns Promise resolving to detailed system status
   */
  async getSystemStatus(): Promise<SystemStatus> {
    const response = await fetch(`${API_BASE_URL}/status`);
    
    if (!response.ok) {
      throw new Error(`Failed to get system status: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Performs a system health check
   * @returns Promise resolving to health check results
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    const response = await fetch(`${API_BASE_URL}/health`);
    
    if (!response.ok) {
      throw new Error(`Failed health check: ${response.statusText}`);
    }

    return response.json();
  }
};

export default emberUnitApi;