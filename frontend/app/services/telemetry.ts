// Telemetry service for monitoring system metrics

/**
 * Interface describing system telemetry data format
 */
export interface SystemTelemetry {
  // CPU metrics
  cpu_usage: number;  // percentage (0-100)
  
  // GPU metrics
  gpu_usage: number;  // percentage (0-100)
  
  // Memory metrics
  memory_usage: number;  // percentage (0-100)
  
  // Thermal metrics
  heat_index: number;  // temperature index
  core_temp: string;   // temperature in celsius with decimal
  
  // Storage metrics
  storage_pb: string;  // storage in petabytes with decimal
  
  // System metrics
  uptime_formatted: string;  // formatted uptime string
}

/**
 * Callback type for telemetry updates
 */
type TelemetryCallback = (data: SystemTelemetry) => void;

/**
 * Service for monitoring and reporting system telemetry
 */
class TelemetryService {
  private callbacks: TelemetryCallback[] = [];
  private connected = false;
  private interval: number | null = null;

  connect(): void {
    if (this.connected) return;

    this.connected = true;
    console.log('🔥 Telemetry service connected');

    // Simulate telemetry updates with random data
    this.interval = window.setInterval(() => {
      // Generate simulated telemetry data
      const data: SystemTelemetry = {
        cpu_usage: Math.floor(Math.random() * 30) + 30, // 30-60%
        gpu_usage: Math.floor(Math.random() * 40) + 20, // 20-60%
        memory_usage: Math.floor(Math.random() * 20) + 50, // 50-70%
        heat_index: Math.floor(Math.random() * 15) + 45, // 45-60%
        core_temp: (Math.random() * 10 + 40).toFixed(1), // 40-50°C
        storage_pb: (Math.random() * 2 + 3).toFixed(1), // 3-5 PB
        uptime_formatted: this.formatUptime(Date.now() - 86400000 * 1.5) // 1.5 days
      };

      this.callbacks.forEach(callback => callback(data));
    }, 3000);
  }

  disconnect(): void {
    if (!this.connected) return;
    
    if (this.interval) {
      window.clearInterval(this.interval);
      this.interval = null;
    }
    
    this.connected = false;
    console.log('🔥 Telemetry service disconnected');
  }

  /**
   * Register a callback to receive telemetry updates
   * @param callback Function to call when new telemetry data is available
   * @returns Function to unregister this callback
   */
  onTelemetry(callback: TelemetryCallback): () => void {
    this.callbacks.push(callback);
    
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    const remainingHours = hours % 24;
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;
    
    return `${days}d ${remainingHours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

export const telemetry = new TelemetryService();