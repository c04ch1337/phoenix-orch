const API_BASE = 'http://localhost:5001';

export interface HealthStatus {
  status: string;
  uptime_seconds?: number;
  timestamp?: string;
}

export interface ReadyStatus {
  status: string;
  missing?: string[];
  ready?: string[];
}

export interface Memory {
  id: string;
  content: string;
  timestamp: number;
  type: string;
  conscience?: 'reptilian' | 'mammalian' | 'neocortex';
}

export async function checkHealth(): Promise<HealthStatus> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Health check error:', error);
    throw error;
  }
}

export async function checkReady(): Promise<ReadyStatus> {
  try {
    const res = await fetch(`${API_BASE}/ready`);
    if (!res.ok) throw new Error(`Ready check failed: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Ready check error:', error);
    throw error;
  }
}

export async function getMemories(): Promise<Memory[]> {
  try {
    const res = await fetch(`${API_BASE}/api/memories`);
    if (!res.ok) {
      // If endpoint doesn't exist yet, return empty array
      if (res.status === 404) return [];
      throw new Error(`Get memories failed: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error('Get memories error:', error);
    return []; // Return empty array if endpoint doesn't exist
  }
}

/**
 * Interface for system metrics data
 */
export interface SystemMetrics {
  cpu_usage?: number;
  memory_usage?: number;
  uptime?: number;
  active_processes?: number;
  response_times?: Record<string, number>;
  [key: string]: unknown; // Allow for additional dynamic metrics
}

/**
 * Fetches system metrics from the server
 * @returns Promise resolving to metrics text in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/metrics`);
    if (!res.ok) throw new Error(`Get metrics failed: ${res.status}`);
    return await res.text();
  } catch (error) {
    console.error('Get metrics error:', error);
    throw error;
  }
}