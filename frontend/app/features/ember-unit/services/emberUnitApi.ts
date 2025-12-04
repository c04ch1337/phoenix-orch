/**
 * EmberUnit API Service
 * 
 * Provides functions for making API calls related to the EmberUnit functionality.
 */
import { invoke } from '@tauri-apps/api/tauri';

// Define return type for the orchestrator task
interface OrchestratorResult {
  response: string;
  warnings?: string[];
  toolOutputs?: string[];
  [key: string]: unknown;
}

export const emberUnitApi = {
  /**
   * Sends a command to the orchestrator
   * 
   * @param command The command to send to the orchestrator
   * @returns Promise with the result of the command execution
   */
  sendCommand: async (command: string): Promise<OrchestratorResult> => {
    try {
      // Use the new Tauri invoke command
      const result = await invoke<OrchestratorResult>('invoke_orchestrator_task', { 
        goal: command 
      });
      
      return result;
    } catch (error) {
      console.error('Error invoking orchestrator task:', error);
      throw error;
    }
  },

  /**
   * Toggles the override mode for the EmberUnit
   * 
   * @param isActive Whether override mode should be activated
   * @returns Promise with the result of the mode change
   */
  setOverrideMode: async (isActive: boolean): Promise<{ success: boolean }> => {
    try {
      // This would normally be an API call, but we're just returning a mock result
      return { success: true };
    } catch (error) {
      console.error('Error setting override mode:', error);
      throw error;
    }
  }
};