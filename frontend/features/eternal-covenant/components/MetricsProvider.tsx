import React, { createContext, useContext, useEffect, useReducer, useCallback, useRef } from 'react';
import { LiveMetrics, MetricsProviderState, MetricsContextType, MetricsUpdate, ConnectionUpdate } from '../types/metrics';

const WEBSOCKET_URL = 'ws://localhost:5001/ws';
const POLLING_URL = 'http://localhost:5001/api/v1/metrics';
const POLLING_INTERVAL = 5000;
const RECONNECT_DELAY = 3000;

const initialMetrics: LiveMetrics = {
  daysUntilExplosion: 1826,
  orchestratedNodes: 52,
  ashenGuardCells: 11,
  currentPhase: 'Act I – Narrow AI → AGI',
  conscienceTemperature: 97.8,
  lastUpdated: new Date().toISOString()
};

const initialState: MetricsProviderState = {
  metrics: initialMetrics,
  connectionState: 'disconnected',
  isOffline: false,
  error: null
};

type Action = 
  | { type: 'UPDATE_METRICS'; payload: Partial<LiveMetrics> }
  | { type: 'SET_CONNECTION_STATE'; payload: MetricsProviderState['connectionState'] }
  | { type: 'SET_ERROR'; payload: Error | null }
  | { type: 'SET_OFFLINE'; payload: boolean };

const metricsReducer = (state: MetricsProviderState, action: Action): MetricsProviderState => {
  switch (action.type) {
    case 'UPDATE_METRICS':
      return {
        ...state,
        metrics: { ...state.metrics, ...action.payload, lastUpdated: new Date().toISOString() }
      };
    case 'SET_CONNECTION_STATE':
      return { ...state, connectionState: action.payload, error: null };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_OFFLINE':
      return { ...state, isOffline: action.payload };
    default:
      return state;
  }
};

const MetricsContext = createContext<MetricsContextType | null>(null);

export const useMetrics = () => {
  const context = useContext(MetricsContext);
  if (!context) {
    throw new Error('useMetrics must be used within a MetricsProvider');
  }
  return context;
};

export const MetricsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(metricsReducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'metrics') {
        dispatch({ type: 'UPDATE_METRICS', payload: data.payload });
      } else if (data.type === 'connection') {
        dispatch({ type: 'SET_CONNECTION_STATE', payload: data.status });
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }, []);

  const pollMetrics = useCallback(async () => {
    try {
      const response = await fetch(POLLING_URL);
      if (!response.ok) throw new Error('Polling failed');
      const data = await response.json();
      dispatch({ type: 'UPDATE_METRICS', payload: data });
    } catch (error) {
      console.error('Polling failed:', error);
      if (error instanceof Error) {
        dispatch({ type: 'SET_ERROR', payload: error });
      }
    }
  }, []);

  const startPolling = useCallback(() => {
    pollMetrics();
    pollTimeoutRef.current = setInterval(pollMetrics, POLLING_INTERVAL);
  }, [pollMetrics]);

  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearInterval(pollTimeoutRef.current);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      wsRef.current = new WebSocket(WEBSOCKET_URL);
      dispatch({ type: 'SET_CONNECTION_STATE', payload: 'reconnecting' });

      wsRef.current.onopen = () => {
        dispatch({ type: 'SET_CONNECTION_STATE', payload: 'connected' });
        stopPolling();
      };

      wsRef.current.onmessage = handleWebSocketMessage;

      wsRef.current.onclose = () => {
        dispatch({ type: 'SET_CONNECTION_STATE', payload: 'disconnected' });
        startPolling();
        reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        dispatch({ type: 'SET_CONNECTION_STATE', payload: 'error' });
        startPolling();
      };
    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error);
      if (error instanceof Error) {
        dispatch({ type: 'SET_ERROR', payload: error });
      }
      startPolling();
    }
  }, [handleWebSocketMessage, startPolling, stopPolling]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopPolling();
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
  }, [stopPolling]);

  const retry = useCallback(() => {
    disconnect();
    connect();
  }, [disconnect, connect]);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Handle offline/online status
  useEffect(() => {
    const handleOnline = () => {
      dispatch({ type: 'SET_OFFLINE', payload: false });
      retry();
    };

    const handleOffline = () => {
      dispatch({ type: 'SET_OFFLINE', payload: true });
      disconnect();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [disconnect, retry]);

  // Persist metrics to localStorage
  useEffect(() => {
    localStorage.setItem('eternal-covenant-metrics', JSON.stringify(state.metrics));
  }, [state.metrics]);

  const value: MetricsContextType = {
    state,
    connect,
    disconnect,
    retry
  };

  return (
    <MetricsContext.Provider value={value}>
      {children}
    </MetricsContext.Provider>
  );
};