export interface Connection {
    sourceId: string;
    targetId: string;
    strength: number; // 0-1 for glow intensity
    type: 'data' | 'control' | 'event';
}

export interface AdoptedTool {
    id: string;
    name: string;
    type: string;
    metrics: RuntimeMetrics;
    stats: UsageStats;
    voiceAlias: string;
    actions: ToolAction[];
}

export interface RuntimeMetrics {
    cpu: number;
    memory: number;
    latency: number;
}

export interface UsageStats {
    totalCalls: number;
    successRate: number;
    lastUsed: string;
}

export interface ToolAction {
    name: string;
    icon: string;
    handler: () => void;
}

export interface VoiceCommand {
    alias: string;
    action: string;
    target: string;
    parameters?: Record<string, any>;
}

export interface AdoptionStatus {
    phase: 'pending' | 'analyzing' | 'building' | 'testing' | 'ready' | 'failed' | 'archived';
    progress: number;
    message: string;
    error?: string;
}

export interface AdoptionQueue {
    pending: PendingAdoption[];
    inProgress: PendingAdoption[];
    completed: PendingAdoption[];
    failed: PendingAdoption[];
}

export interface PendingAdoption {
    id: string;
    repoUrl: string;
    name: string;
    status: AdoptionStatus;
    createdAt: string;
    updatedAt: string;
}