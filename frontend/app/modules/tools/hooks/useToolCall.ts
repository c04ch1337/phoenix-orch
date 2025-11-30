"use client";

/**
 * useToolCall Hook
 *
 * Hook for calling tools and streaming their output via SSE.
 */

import { useState, useEffect, useCallback } from 'react';
import { ToolCallRequest, ToolCallResponse, ToolInfo } from '../types';

const API_BASE = 'http://127.0.0.1:5001';

export function useToolCall() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [output, setOutput] = useState<string>('');

    const callTool = useCallback(async (request: ToolCallRequest): Promise<ToolCallResponse> => {
        setLoading(true);
        setError(null);
        setOutput('');

        try {
            const response = await fetch(`${API_BASE}/api/v1/tools/call`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Tool call failed');
            }

            const data = await response.json();
            setOutput(data.message);
            return data;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Tool call failed';
            setError(errorMsg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        callTool,
        loading,
        error,
        output,
    };
}

export function useToolStream() {
    const [updates, setUpdates] = useState<any[]>([]);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const eventSource = new EventSource(`${API_BASE}/api/v1/sse/tools`);

        eventSource.onopen = () => {
            console.log('🔥 Tools SSE: Connected');
            setConnected(true);
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setUpdates(prev => [...prev.slice(-49), data]);
            } catch (err) {
                console.error('🔥 Tools SSE: Failed to parse update', err);
            }
        };

        eventSource.onerror = (err) => {
            console.error('🔥 Tools SSE: Error', err);
            setConnected(false);
        };

        return () => {
            eventSource.close();
            setConnected(false);
        };
    }, []);

    return { updates, connected };
}

export function useToolsList() {
    const [tools, setTools] = useState<ToolInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTools = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/v1/tools/list`);
            if (!response.ok) throw new Error('Failed to fetch tools');
            const data = await response.json();
            setTools(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTools();
        const interval = setInterval(fetchTools, 10000); // Refresh every 10 seconds
        return () => clearInterval(interval);
    }, [fetchTools]);

    return { tools, loading, error, refresh: fetchTools };
}

