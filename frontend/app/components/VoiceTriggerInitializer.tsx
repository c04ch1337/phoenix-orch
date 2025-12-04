import { useEffect } from 'react';
import { usePhoenixContext } from '../hooks/usePhoenixContext';
import useMobileConscienceGate from '../hooks/useMobileConscienceGate';
import { voiceTriggers } from '../services/voiceTriggers';
import { hardwareCommands } from '../services/hardwareCommands';

/**
 * Component that initializes voice triggers globally
 * This should be placed high in the component tree to ensure
 * voice triggers work across the entire application
 */
export default function VoiceTriggerInitializer() {
  const phoenix = usePhoenixContext();
  const mobileConscienceGate = useMobileConscienceGate();

  useEffect(() => {
    // Initialize voice triggers with the current context
    voiceTriggers.initialize(phoenix, mobileConscienceGate);
    
    // Initialize hardware commands with the current context
    hardwareCommands.initialize(phoenix, mobileConscienceGate);
    
    console.log('🔥 VoiceTriggerInitializer: Voice triggers and hardware commands initialized globally');
    
    // Initialize Phoenix Orch hardware API if running in Tauri
    if (window.phoenixOrch === undefined && 'tauri' in window && window.__TAURI__) {
      // Create Phoenix Orch hardware API
      window.phoenixOrch = {
        async executeHardwareCommand(request) {
          try {
            // Call the Rust backend
            const response = await window.__TAURI__!.invoke('execute_hardware_command', request);
            return response;
          } catch (error) {
            console.error('Error executing hardware command:', error);
            return { success: false, error: String(error) };
          }
        },
        
        async getHardwareStatus() {
          try {
            // Call the Rust backend
            return await window.__TAURI__!.invoke('get_hardware_status');
          } catch (error) {
            console.error('Error getting hardware status:', error);
            return "Error retrieving hardware status";
          }
        },
        
        async executeMobileCommand(request) {
          try {
            // Call the Rust backend
            const response = await window.__TAURI__!.invoke('execute_mobile_command', request);
            return response;
          } catch (error) {
            console.error('Error executing mobile command:', error);
            return { success: false, error: String(error) };
          }
        },
        
        async getMobileStatus() {
          try {
            // Call the Rust backend
            return await window.__TAURI__!.invoke('get_mobile_status');
          } catch (error) {
            console.error('Error getting mobile status:', error);
            return "Error retrieving mobile status";
          }
        },
        
        async setMobileCybersecurityMode(request) {
          try {
            // Call the Rust backend
            const response = await window.__TAURI__!.invoke('set_mobile_cybersecurity_mode', request);
            return response;
          } catch (error) {
            console.error('Error setting mobile cybersecurity mode:', error);
            return { success: false, error: String(error) };
          }
        },
        
        async execute_hak5_command(request) {
          try {
            const response = await window.__TAURI__!.invoke('execute_hak5_command', request);
            return response;
          } catch (error) {
            console.error('Error executing hak5 command:', error);
            return { success: false, error: String(error) };
          }
        },
        
        async get_hak5_status() {
          try {
            return await window.__TAURI__!.invoke('get_hak5_status');
          } catch (error) {
            console.error('Error getting hak5 status:', error);
            return "Error retrieving hak5 status";
          }
        },
        
        async get_hak5_network_map() {
          try {
            return await window.__TAURI__!.invoke('get_hak5_network_map');
          } catch (error) {
            console.error('Error getting hak5 network map:', error);
            return null;
          }
        }
      };
      
      console.log('🔥 VoiceTriggerInitializer: Phoenix Orch hardware and mobile API initialized');
    }
    
    // Cleanup on unmount
    return () => {
      voiceTriggers.destroy();
      hardwareCommands.destroy();
    };
  }, [phoenix, mobileConscienceGate]);

  // This component doesn't render anything visible
  return null;
}