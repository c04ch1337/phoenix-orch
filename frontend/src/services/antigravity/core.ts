import { invoke } from '@tauri-apps/api/tauri';
import { EventEmitter } from 'events';

/**
 * The AntigravityCore service provides access to the core functionalities
 * of the Antigravity system, serving as the main integration point for 
 * Phoenix Orch.
 */
class AntigravityCore {
  private _initialized: boolean = false;
  private _config: any = null;
  private _lastError: any = null;
  public events: EventEmitter;

  constructor() {
    this.events = new EventEmitter();
  }

  /**
   * Initialize the Antigravity Core subsystem
   */
  async initialize(): Promise<any> {
    try {
      const result = await invoke('initialize_antigravity_core');
      this._initialized = true;
      this.events.emit('core_initialized', result);
      return result;
    } catch (error) {
      this._lastError = error;
      this.events.emit('core_error', error);
      throw error;
    }
  }

  /**
   * Load the Antigravity configuration
   */
  async loadConfiguration(): Promise<any> {
    try {
      this._config = await invoke('get_antigravity_config');
      this.events.emit('config_loaded', this._config);
      return this._config;
    } catch (error) {
      this._lastError = error;
      this.events.emit('core_error', error);
      throw error;
    }
  }

  /**
   * Check the status of the Antigravity API endpoints
   */
  async checkApiStatus(): Promise<any> {
    try {
      const status = await invoke('check_antigravity_api_status');
      this.events.emit('api_status_updated', status);
      return status;
    } catch (error) {
      this._lastError = error;
      this.events.emit('core_error', error);
      throw error;
    }
  }

  /**
   * Start monitoring Antigravity Core events
   */
  async startEventMonitoring(): Promise<any> {
    try {
      const result = await invoke('start_antigravity_event_monitoring');
      this.events.emit('event_monitoring_started', result);
      return result;
    } catch (error) {
      this._lastError = error;
      this.events.emit('core_error', error);
      throw error;
    }
  }

  /**
   * Stop monitoring Antigravity Core events
   */
  async stopEventMonitoring(): Promise<any> {
    try {
      const result = await invoke('stop_antigravity_event_monitoring');
      this.events.emit('event_monitoring_stopped', result);
      return result;
    } catch (error) {
      this._lastError = error;
      this.events.emit('core_error', error);
      throw error;
    }
  }

  /**
   * Get the current status of the Antigravity Core
   */
  async getStatus(): Promise<any> {
    try {
      const status = await invoke('get_antigravity_core_status');
      this.events.emit('core_status_updated', status);
      return status;
    } catch (error) {
      this._lastError = error;
      this.events.emit('core_error', error);
      throw error;
    }
  }

  /**
   * Check if the Antigravity Core is initialized
   */
  isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * Get the current configuration
   */
  getConfiguration(): any {
    return this._config;
  }

  /**
   * Get the last error that occurred
   */
  getLastError(): any {
    return this._lastError;
  }

  /**
   * Reset the Antigravity Core (for testing purposes)
   */
  async reset(): Promise<any> {
    try {
      const result = await invoke('reset_antigravity_core');
      this._initialized = false;
      this._config = null;
      this._lastError = null;
      this.events.emit('core_reset', result);
      return result;
    } catch (error) {
      this._lastError = error;
      this.events.emit('core_error', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const antigravityCore = new AntigravityCore();