export interface LiveMetrics {
  daysUntilExplosion: number;
  orchestratedNodes: number;
  ashenGuardCells: number;
  currentPhase: string;
  conscienceTemperature: number;
  lastUpdated: string;
}

export interface MetricsProviderState {
  metrics: LiveMetrics;
  connectionState: 'connected' | 'disconnected' | 'reconnecting' | 'error';
  isOffline: boolean;
  error: Error | null;
}

export interface MetricsContextType {
  state: MetricsProviderState;
  connect: () => void;
  disconnect: () => void;
  retry: () => void;
}

export interface MetricsUpdate {
  type: 'metrics';
  payload: Partial<LiveMetrics>;
}

export interface ConnectionUpdate {
  type: 'connection';
  status: MetricsProviderState['connectionState'];
}