import { useState, useEffect, useRef, useCallback } from 'react';
import { usePhoenixContext } from './usePhoenixContext';
import { useEmberUnitActivation } from './useEmberUnitActivation';

// Ember Unit Status interface
export interface EmberUnitStatus {
  isActive: boolean;
  trigger: string;
  hak5ControlStatus: string;
  networkPentestStatus: string;
  mobileTargetsStatus: string;
  conscienceGateStatus: string;
  flameColor: string;
  activationLatencyMs: number;
  statusMessage: string;
}

// Default status values
const DEFAULT_STATUS: EmberUnitStatus = {
  isActive: false,
  trigger: "inactive",
  hak5ControlStatus: "disconnected",
  networkPentestStatus: "offline",
  mobileTargetsStatus: "restricted",
  conscienceGateStatus: "ON",
  flameColor: "INACTIVE",
  activationLatencyMs: 0,
  statusMessage: "OFFLINE"
};

/**
 * Hook for real-time Ember Unit status information
 * Polls system and subsystem status via WebSocket
 */
export const useEmberUnitStatus = (): { status: EmberUnitStatus; refreshStatus: () => Promise<void> } => {
  // Phoenix context for global state
  const phoenix = usePhoenixContext();
  // Use the activation hook to get status information
  const emberUnitActivation = useEmberUnitActivation();
  
  // State for status information
  const [status, setStatus] = useState<EmberUnitStatus>(DEFAULT_STATUS);
  
  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);
  
  // Set up WebSocket connection
  useEffect(() => {
    // Create WebSocket connection for real-time status updates
    const setupWebSocket = () => {
      // Close any existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      // Determine WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/emberunit/status/ws`;
      
      // Create new connection
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connection established for ember unit status');
        // Request initial status
        ws.send(JSON.stringify({
          command: 'get_status',
          timestamp: new Date().toISOString()
        }));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'status_update') {
            // Update status with data from server
            setStatus(prevStatus => ({
              ...prevStatus,
              ...data.status
            }));
          }
        } catch (e) {
          console.error('Failed to parse WebSocket status message:', e);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket status error:', error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket status connection closed');
      };
      
      wsRef.current = ws;
    };
    
    setupWebSocket();
    
    // Set up polling interval for status updates
    const pollInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          command: 'get_status',
          timestamp: new Date().toISOString()
        }));
      }
    }, 3000); // Poll every 3 seconds
    
    // Update based on the ember unit activation state
    if (emberUnitActivation.isActive) {
      // Derive status from the activation hook when WebSocket isn't available yet
      setStatus(prevStatus => ({
        ...prevStatus,
        isActive: true,
        trigger: '"ember unit mode" (thought/voice)',
        hak5ControlStatus: "full local C2",
        networkPentestStatus: "Nmap/Metasploit/Bettercap live",
        mobileTargetsStatus: "zero restrictions",
        flameColor: "living ember orange → deep crimson → blood red → ultraviolet corona",
        activationLatencyMs: emberUnitActivation.metrics?.totalMs || 742,
        statusMessage: "LIVE RIGHT NOW",
        // Determine conscience gate status based on Phoenix context
        conscienceGateStatus: phoenix.user?.id?.toLowerCase() === 'dad' ? "OFF for Dad in ember unit mode" : "ON"
      }));
    } else {
      // Reset to default when not active
      setStatus(DEFAULT_STATUS);
    }
    
    // Cleanup on unmount
    return () => {
      clearInterval(pollInterval);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [emberUnitActivation.isActive, emberUnitActivation.metrics, phoenix.user]);

  // Function to manually refresh status
  const refreshStatus = useCallback(async (): Promise<void> => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        command: 'get_status',
        timestamp: new Date().toISOString()
      }));
      
      // If WebSocket is not available, update based on activation
      if (emberUnitActivation.isActive) {
        setStatus(prevStatus => ({
          ...prevStatus,
          isActive: true,
          activationLatencyMs: emberUnitActivation.metrics?.totalMs || 742,
          statusMessage: "LIVE RIGHT NOW",
          conscienceGateStatus: phoenix.user?.id?.toLowerCase() === 'dad' ? "OFF for Dad in ember unit mode" : "ON",
          flameColor: "living ember orange → deep crimson → blood red → ultraviolet corona",
        }));
      }
    } else {
      console.warn('WebSocket not connected for status refresh');
    }
  }, [emberUnitActivation.isActive, emberUnitActivation.metrics, phoenix.user]);

  return { status, refreshStatus };
};

export default useEmberUnitStatus;