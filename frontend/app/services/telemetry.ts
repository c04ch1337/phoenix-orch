'use client';

interface TelemetryData {
  cpu_usage?: number;
  gpu_usage?: number;
  memory_usage?: number;
  network_usage?: number;
  heat_index?: number;
  uptime_formatted?: string;
  core_temp?: number;
  storage_pb?: number;
}

type TelemetryCallback = (data: TelemetryData) => void;

class TelemetryService {
  private eventSource: EventSource | null = null;
  private callbacks: Set<TelemetryCallback> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;

  connect(): void {
    if (typeof window === 'undefined') return;
    if (this.eventSource?.readyState === EventSource.OPEN) return;

    this.disconnect();

    try {
      const url = 'http://localhost:5001/api/v1/telemetry-stream';
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        console.log('🔥 Telemetry SSE: Connected');
        this.reconnectAttempts = 0;
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.callbacks.forEach(callback => callback(data));
        } catch (error) {
          console.error('🔥 Telemetry SSE: Failed to parse message', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('🔥 Telemetry SSE: Error', error);
        this.eventSource?.close();
        this.eventSource = null;

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), this.reconnectDelay);
        }
      };
    } catch (error) {
      console.error('🔥 Telemetry SSE: Failed to connect', error);
    }
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  onTelemetry(callback: TelemetryCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }
}

export const telemetry = new TelemetryService();
