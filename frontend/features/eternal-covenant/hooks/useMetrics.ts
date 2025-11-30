import { useCallback, useEffect, useRef } from 'react';
import { MetricsData } from '../types';

const METRICS_ENDPOINT = '/api/v1/eternal-covenant/metrics';
const METRICS_WS_ENDPOINT = 'ws://localhost:5001/api/v1/eternal-covenant/metrics-stream';

export const useMetrics = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const metricsIntervalRef = useRef<number | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    wsRef.current = new WebSocket(METRICS_WS_ENDPOINT);

    wsRef.current.onopen = () => {
      console.log('Metrics WebSocket connected');
    };

    wsRef.current.onerror = (error) => {
      console.error('Metrics WebSocket error:', error);
    };

    wsRef.current.onclose = () => {
      console.log('Metrics WebSocket closed');
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Update metrics via WebSocket
  const updateMetrics = useCallback(async (update: Partial<MetricsData>) => {
    try {
      // Send update via WebSocket if connected
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'metrics_update',
          data: update
        }));
      } else {
        // Fallback to REST API if WebSocket is not available
        await fetch(METRICS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(update)
        });
      }
    } catch (error) {
      console.error('Failed to update metrics:', error);
      
      // Store failed updates in localStorage for retry
      const failedUpdates = JSON.parse(localStorage.getItem('failed_metrics_updates') || '[]');
      failedUpdates.push({
        timestamp: Date.now(),
        data: update
      });
      localStorage.setItem('failed_metrics_updates', JSON.stringify(failedUpdates));
    }
  }, []);

  // Start tracking view duration
  const startViewDurationTracking = useCallback(() => {
    if (metricsIntervalRef.current) return;

    const startTime = Date.now();
    metricsIntervalRef.current = window.setInterval(() => {
      const duration = (Date.now() - startTime) / 1000; // Convert to seconds
      updateMetrics({ currentViewDuration: duration });
    }, 1000) as unknown as number;

    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
        metricsIntervalRef.current = null;
      }
    };
  }, [updateMetrics]);

  // Retry failed updates
  useEffect(() => {
    const retryFailedUpdates = async () => {
      const failedUpdates = JSON.parse(localStorage.getItem('failed_metrics_updates') || '[]');
      if (failedUpdates.length === 0) return;

      const retryPromises = failedUpdates.map(async (update: any) => {
        try {
          await updateMetrics(update.data);
          return true;
        } catch {
          return false;
        }
      });

      const results = await Promise.all(retryPromises);
      const remainingFailures = failedUpdates.filter((_, index) => !results[index]);
      localStorage.setItem('failed_metrics_updates', JSON.stringify(remainingFailures));
    };

    // Retry failed updates every minute
    const retryInterval = setInterval(retryFailedUpdates, 60000);

    return () => {
      clearInterval(retryInterval);
    };
  }, [updateMetrics]);

  return {
    updateMetrics,
    startViewDurationTracking
  };
};