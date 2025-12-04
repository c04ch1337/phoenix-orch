import { useState, useEffect, useRef, useCallback } from 'react';
import { usePhoenixContext } from './usePhoenixContext';

// Activation performance metrics interface
export interface ActivationMetrics {
  // Total activation time in milliseconds
  totalMs: number;
  // Detailed timing of individual components
  componentTimings: ComponentTiming[];
  // Whether the activation used preloaded components
  usedPreloaded: boolean;
}

// Timing for individual components during activation
export interface ComponentTiming {
  // Component name
  name: string;
  // Time taken in milliseconds
  durationMs: number;
}

// Visual indicator states for activation progress
export type ActivationIndicatorState = 'idle' | 'connecting' | 'activating' | 'complete' | 'error';

// Return type for the useEmberUnitActivation hook
export interface EmberUnitActivationHook {
  // Whether ember unit mode is currently active
  isActive: boolean;
  // Current status of the activation process
  activationState: ActivationIndicatorState;
  // Performance metrics from last activation
  metrics: ActivationMetrics | null;
  // Function to trigger activation
  activate: () => Promise<boolean>;
  // Function to deactivate
  deactivate: () => Promise<boolean>;
  // Visual percentage indicator of activation progress (0-100)
  activationProgress: number;
  // Target latency in milliseconds (for visual comparison)
  targetLatencyMs: number;
  // Whether the last activation met the target latency
  metTargetLatency: boolean;
}

/**
 * WebSocket connection for ember unit activation with minimal latency
 * 
 * @returns Hook for managing ember unit activation with performance metrics
 */
export const useEmberUnitActivation = (): EmberUnitActivationHook => {
  // Phoenix global context
  const phoenix = usePhoenixContext();
  
  // State for activation status and metrics
  const [isActive, setIsActive] = useState<boolean>(false);
  const [activationState, setActivationState] = useState<ActivationIndicatorState>('idle');
  const [metrics, setMetrics] = useState<ActivationMetrics | null>(null);
  const [activationProgress, setActivationProgress] = useState<number>(0);
  
  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);
  
  // Timing references for measuring latency
  const activationStartTimeRef = useRef<number>(0);
  
  // Target latency (742ms as specified in requirements)
  const targetLatencyMs = 742;
  const [metTargetLatency, setMetTargetLatency] = useState<boolean>(false);

  // Set up WebSocket connection
  useEffect(() => {
    // Create WebSocket connection for real-time activation
    const setupWebSocket = () => {
      // Close any existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      // Determine WebSocket URL (ensure it's wss:// in production)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/cybersecurity/ws`;
      
      // Create new connection
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connection established for ember unit activation');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'activation_status') {
            // Update activation state
            setIsActive(data.armed);
            setActivationState(data.armed ? 'complete' : 'idle');
            
            // Calculate end-to-end latency if we have a start time
            if (activationStartTimeRef.current > 0 && data.armed) {
              const endTime = performance.now();
              const totalLatency = endTime - activationStartTimeRef.current;
              
              // Create frontend timing component to add to metrics received from backend
              const frontendTiming: ComponentTiming = {
                name: 'frontend_processing',
                durationMs: Math.round(totalLatency - (data.metrics?.totalMs || 0))
              };
              
              // Combine backend and frontend metrics
              const completeMetrics: ActivationMetrics = {
                totalMs: Math.round(totalLatency),
                componentTimings: [
                  ...(data.metrics?.componentTimings || []),
                  frontendTiming
                ],
                usedPreloaded: data.metrics?.usedPreloaded || false
              };
              
              // Update metrics state
              setMetrics(completeMetrics);
              
              // Check if we met target latency
              setMetTargetLatency(completeMetrics.totalMs <= targetLatencyMs);
              
              // Reset start time
              activationStartTimeRef.current = 0;
              
              // Report metrics to console for debugging
              console.log('Activation metrics:', completeMetrics);
              console.log(`Activation latency: ${completeMetrics.totalMs}ms (target: ${targetLatencyMs}ms)`);
              
              // Update Phoenix context with metrics if available
              if (phoenix.runtime && phoenix.setFeature) {
                // Store metrics in customer feature for access from other components
                // Cast to any to avoid type errors with Phoenix context
                phoenix.setFeature('emberUnitMode', true);
                // Store separately as a custom property
                (phoenix as any).emberUnitMetrics = completeMetrics;
              }
            }
          } else if (data.type === 'activation_progress') {
            // Update progress indicator
            setActivationProgress(data.progress);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setActivationState('error');
      };
      
      ws.onclose = () => {
        console.log('WebSocket connection closed');
      };
      
      wsRef.current = ws;
    };
    
    setupWebSocket();
    
    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [phoenix]);

  // Function to activate ember unit mode
  const activate = useCallback(async (): Promise<boolean> => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      setActivationState('error');
      return false;
    }
    
    try {
      // Mark start time
      activationStartTimeRef.current = performance.now();
      
      // Send activation command via WebSocket for minimal latency
      wsRef.current.send(JSON.stringify({
        command: 'activate',
        timestamp: new Date().toISOString()
      }));
      
      // Update state to connecting
      setActivationState('connecting');
      
      // Create artificial progress updates while waiting for real updates
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 5;
        if (progress <= 90) { // Cap at 90% until we get confirmation
          setActivationProgress(progress);
        }
        if (activationState === 'complete' || activationState === 'error') {
          clearInterval(progressInterval);
        }
      }, 20);
      
      // Wait for response with timeout
      const result = await Promise.race([
        // Wait for state change to indicate activation
        new Promise<boolean>((resolve) => {
          const checkActive = setInterval(() => {
            if (activationState === 'complete') {
              clearInterval(checkActive);
              clearInterval(progressInterval);
              setActivationProgress(100);
              resolve(true);
            } else if (activationState === 'error') {
              clearInterval(checkActive);
              clearInterval(progressInterval);
              resolve(false);
            }
          }, 50);
        }),
        // Timeout after 3 seconds
        new Promise<boolean>((resolve) => {
          setTimeout(() => {
            clearInterval(progressInterval);
            setActivationState('error');
            resolve(false);
          }, 3000);
        })
      ]);
      
      return result;
    } catch (error) {
      console.error('Error activating ember unit mode:', error);
      setActivationState('error');
      return false;
    }
  }, [activationState]);

  // Function to deactivate ember unit mode
  const deactivate = useCallback(async (): Promise<boolean> => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return false;
    }
    
    try {
      // Send deactivation command via WebSocket
      wsRef.current.send(JSON.stringify({
        command: 'deactivate',
        timestamp: new Date().toISOString()
      }));
      
      // Wait for response with timeout
      const result = await Promise.race([
        // Wait for state change to indicate deactivation
        new Promise<boolean>((resolve) => {
          const checkInactive = setInterval(() => {
            if (!isActive) {
              clearInterval(checkInactive);
              resolve(true);
            }
          }, 50);
        }),
        // Timeout after 2 seconds
        new Promise<boolean>((resolve) => {
          setTimeout(() => {
            resolve(false);
          }, 2000);
        })
      ]);
      
      return result;
    } catch (error) {
      console.error('Error deactivating ember unit mode:', error);
      return false;
    }
  }, [isActive]);

  return {
    isActive,
    activationState,
    metrics,
    activate,
    deactivate,
    activationProgress,
    targetLatencyMs,
    metTargetLatency
  };
};

// Helper functions for latency visualization - to be used in .tsx files
export const getLatencyColorClass = (metrics: ActivationMetrics | null, targetMs: number): string => {
  if (!metrics) return 'bg-gray-300';
  return metrics.totalMs <= targetMs ? 'bg-green-500' : 'bg-red-500';
};

export const getLatencyPercentage = (metrics: ActivationMetrics | null, targetMs: number): number => {
  if (!metrics) return 0;
  return Math.min(100, Math.round((metrics.totalMs / targetMs) * 100));
};

export const getLatencyStatusText = (metrics: ActivationMetrics | null, targetMs: number): string => {
  if (!metrics) return 'No data';
  const isFast = metrics.totalMs <= targetMs;
  return `${metrics.totalMs}ms ${isFast ? '(Under Target)' : '(Over Target)'}`;
};

export default useEmberUnitActivation;