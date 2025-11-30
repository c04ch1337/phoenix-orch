/**
 * Ecosystem Weaver Types
 * 
 * Type definitions for the Ecosystem Weaver module that allows Phoenix ORCH
 * to integrate and orchestrate any agentic AI framework or GitHub repository.
 */

export interface EcosystemPlugin {
    id: string;
    name: string;
    repo_url: string;
    status: 'initializing' | 'online' | 'offline' | 'error';
    last_used?: string;
    created_at: string;
}

export interface ActiveSpawn {
    spawn_id: string;
    framework: string;
    task: string;
    status: 'spawning' | 'active' | 'pending_approval' | 'completed' | 'failed';
    hitm_pending: boolean;
    started_at: string;
}

export interface EcosystemStatus {
    active_integrations: EcosystemPlugin[];
    active_spawns: ActiveSpawn[];
    total_weaves: number;
}

export interface IntegrateRequest {
    repo_url: string;
    name?: string;
}

export interface IntegrateResponse {
    integration_id: string;
    name: string;
    status: string;
    message: string;
    timestamp: string;
}

export interface SpawnRequest {
    framework: string;
    task: string;
    hitm: boolean;
}

export interface SpawnResponse {
    spawn_id: string;
    framework: string;
    status: string;
    message: string;
    requires_approval: boolean;
    timestamp: string;
}

export interface FrameworkCard {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: 'cyan' | 'orange' | 'red' | 'yellow';
    status: 'available' | 'integrated' | 'spawning';
}

export interface GraphNode {
    id: string;
    label: string;
    type: 'framework' | 'agent' | 'task' | 'phoenix';
    status: string;
    x?: number;
    y?: number;
}

export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    type: 'routes' | 'spawns' | 'commands';
}

export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export interface HitmRequest {
    spawn_id: string;
    framework: string;
    task: string;
    requires_approval: boolean;
    timestamp: string;
}

