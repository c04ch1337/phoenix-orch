import socketService from './socket';

export interface TelemetryEvent {
  eventType: string;
  timestamp: number;
  source: string;
  data: any;
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

export interface DefenseTelemetry {
  defensivePosture: 'passive' | 'active' | 'aggressive';
  currentPhase: string;
  incidentCount: number;
  alertsTriaged: number;
  threatActors: string[];
  criticalAssets: string[];
  containmentActions: number;
  timeToDetection: number;
  timeToContainment: number;
}

class TelemetryService {
  private isEnabled: boolean = true;
  private bufferSize: number = 100;
  private eventBuffer: TelemetryEvent[] = [];
  private flushInterval: number = 10000; // 10 seconds
  private flushTimer: NodeJS.Timeout | null = null;
  private systemInfo: Record<string, any> = {};

  constructor() {
    // Initialize the flush timer
    this.startFlushTimer();
  }

  public initialize(systemInfo: Record<string, any>): void {
    this.systemInfo = systemInfo;
    console.log('Telemetry service initialized with system info:', systemInfo);
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`Telemetry collection ${enabled ? 'enabled' : 'disabled'}`);
  }

  public recordEvent(eventType: string, data: any, severity: 'info' | 'warning' | 'error' | 'critical' = 'info', source: string = 'frontend'): void {
    if (!this.isEnabled) {
      return;
    }

    const event: TelemetryEvent = {
      eventType,
      timestamp: Date.now(),
      source,
      data,
      severity
    };

    this.eventBuffer.push(event);
    
    // If it's a critical event, flush immediately
    if (severity === 'critical') {
      this.flush();
    } else if (this.eventBuffer.length >= this.bufferSize) {
      // Flush when buffer is full
      this.flush();
    }

    // Console logging for development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Telemetry event: ${eventType}`, event);
    }
  }

  public recordDefenseTelemetry(telemetry: Partial<DefenseTelemetry>): void {
    this.recordEvent('defense_metrics', telemetry, 'info', 'cipher-guard');
  }

  public flush(): void {
    if (this.eventBuffer.length === 0) {
      return;
    }

    try {
      const eventsToSend = [...this.eventBuffer];
      this.eventBuffer = [];

      // Send telemetry batch to backend via WebSocket
      socketService.send('telemetry_batch', {
        events: eventsToSend,
        systemInfo: this.systemInfo
      });
    } catch (error) {
      console.error('Error flushing telemetry data:', error);
      
      // Keep the events in buffer if sending fails
      // But limit to buffer size to prevent memory issues
      if (this.eventBuffer.length + this.eventBuffer.length <= this.bufferSize * 2) {
        this.eventBuffer = [...this.eventBuffer, ...this.eventBuffer];
      } else {
        console.warn('Telemetry buffer overflow, some events have been dropped');
      }
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  public dispose(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Final flush before shutdown
    this.flush();
  }

  // Advanced telemetry methods specific to Cipher Guard

  public recordAssetStatusChange(assetId: string, status: string, details: any): void {
    this.recordEvent('asset_status_change', {
      assetId,
      status,
      details
    }, 'info', 'cipher-guard');
  }

  public recordThreatDetection(threatId: string, threatType: string, severity: 'info' | 'warning' | 'error' | 'critical', details: any): void {
    this.recordEvent('threat_detection', {
      threatId,
      threatType,
      details
    }, severity, 'cipher-guard');
  }

  public recordDefensiveAction(actionId: string, actionType: string, target: string, result: string, details: any): void {
    this.recordEvent('defensive_action', {
      actionId,
      actionType,
      target,
      result,
      details
    }, 'info', 'cipher-guard');
  }

  public recordForensicSnapshot(snapshotId: string, reason: string, details: any): void {
    this.recordEvent('forensic_snapshot', {
      snapshotId,
      reason,
      details
    }, 'info', 'cipher-guard');
  }

  public recordDefensePhaseTransition(fromPhase: string, toPhase: string, reason: string): void {
    this.recordEvent('phase_transition', {
      fromPhase,
      toPhase,
      reason
    }, 'info', 'cipher-guard');
  }

  public recordEvidenceCollection(evidenceId: string, evidenceType: string, source: string, details: any): void {
    this.recordEvent('evidence_collection', {
      evidenceId,
      evidenceType,
      source,
      details
    }, 'info', 'cipher-guard');
  }
}

// Create a singleton instance
const telemetryService = new TelemetryService();

export default telemetryService;