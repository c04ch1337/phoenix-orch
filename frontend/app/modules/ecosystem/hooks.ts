"use client";

/**
 * Ecosystem Weaver Hooks
 *
 * React hooks for managing ecosystem state and SSE streams
 */

import { useState, useEffect, useCallback } from 'react';
import { EcosystemStatus, IntegrateRequest, SpawnRequest } from './types';

const API_BASE = 'http://127.0.0.1:5001';

/**
 * Hook for managing ecosystem state
 */
export function useEcosystem() {
    const [status, setStatus] = useState<EcosystemStatus>({
        active_integrations: [],
        active_spawns: [],
        total_weaves: 0,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchStatus = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/v1/ecosystem/status`);
            if (!response.ok) throw new Error('Failed to fetch ecosystem status');
            const data = await response.json();
            setStatus(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            console.error('🔥 Ecosystem: Failed to fetch status', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const integrate = useCallback(async (request: IntegrateRequest) => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/v1/ecosystem/integrate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Integration failed');
            }
            const data = await response.json();
            await fetchStatus(); // Refresh status
            return data;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Integration failed');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchStatus]);

    const spawn = useCallback(async (request: SpawnRequest) => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/v1/ecosystem/spawn`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Spawn failed');
            }
            const data = await response.json();
            await fetchStatus(); // Refresh status
            return data;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Spawn failed');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchStatus]);

    useEffect(() => {
        fetchStatus();
        // Refresh every 5 seconds
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    return {
        status,
        loading,
        error,
        integrate,
        spawn,
        refresh: fetchStatus,
    };
}

/**
 * Hook for SSE stream of ecosystem updates
 */
export function useEcosystemStream() {
    const [updates, setUpdates] = useState<any[]>([]);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const eventSource = new EventSource(`${API_BASE}/api/v1/sse/ecosystem`);

        eventSource.onopen = () => {
            console.log('🔥 Ecosystem SSE: Connected');
            setConnected(true);
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setUpdates(prev => [...prev.slice(-49), data]); // Keep last 50 updates
            } catch (err) {
                console.error('🔥 Ecosystem SSE: Failed to parse update', err);
            }
        };

        eventSource.onerror = (err) => {
            console.error('🔥 Ecosystem SSE: Error', err);
            setConnected(false);
        };

        return () => {
            eventSource.close();
            setConnected(false);
        };
    }, []);

    return { updates, connected };
}

