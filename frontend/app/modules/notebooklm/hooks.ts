"use client";

/**
 * NotebookLM Hooks
 *
 * React hooks for managing NotebookLM state and functionality
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Notebook,
  NotebookEntry,
  NotebookConnection,
  NotebookAnalytics,
  CreateNotebookRequest,
  CreateEntryRequest,
  CreateConnectionRequest,
  NotebookFilters,
  NotebookTag
} from './types';
import * as notebookApi from './api';

/**
 * Hook for managing notebooks
 */
export function useNotebooks(initialFilters?: NotebookFilters) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<NotebookFilters | undefined>(initialFilters);

  const fetchNotebooks = useCallback(async (filterOptions?: NotebookFilters) => {
    setLoading(true);
    try {
      const response = await notebookApi.getNotebooks(filterOptions || filters);
      if (response.success && response.data) {
        setNotebooks(response.data);
        setError(null);
      } else {
        setError(response.error || 'Failed to fetch notebooks');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('🔥 NotebookLM: Failed to fetch notebooks', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const createNotebook = useCallback(async (request: CreateNotebookRequest) => {
    setLoading(true);
    try {
      const response = await notebookApi.createNotebook(request);
      if (response.success && response.data) {
        setNotebooks(prev => [...prev, response.data!]);
        setError(null);
        return response.data;
      } else {
        setError(response.error || 'Failed to create notebook');
        throw new Error(response.error || 'Failed to create notebook');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('🔥 NotebookLM: Failed to create notebook', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateFilters = useCallback((newFilters: NotebookFilters) => {
    setFilters(newFilters);
  }, []);

  // Fetch notebooks when component mounts or filters change
  useEffect(() => {
    fetchNotebooks();
  }, [fetchNotebooks, filters]);

  return {
    notebooks,
    loading,
    error,
    filters,
    updateFilters,
    fetchNotebooks,
    createNotebook,
    refresh: fetchNotebooks
  };
}

/**
 * Hook for managing entries in a specific notebook
 */
export function useNotebookEntries(notebookId: string) {
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!notebookId) return;
    
    setLoading(true);
    try {
      const response = await notebookApi.getNotebookEntries(notebookId);
      if (response.success && response.data) {
        setEntries(response.data);
        setError(null);
      } else {
        setError(response.error || 'Failed to fetch notebook entries');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error(`🔥 NotebookLM: Failed to fetch entries for notebook ${notebookId}`, err);
    } finally {
      setLoading(false);
    }
  }, [notebookId]);

  const createEntry = useCallback(async (request: CreateEntryRequest) => {
    setLoading(true);
    try {
      const response = await notebookApi.createEntry({
        ...request,
        notebook_id: notebookId // Ensure the entry is created in the current notebook
      });
      
      if (response.success && response.data) {
        setEntries(prev => [...prev, response.data!]);
        setError(null);
        return response.data;
      } else {
        setError(response.error || 'Failed to create entry');
        throw new Error(response.error || 'Failed to create entry');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('🔥 NotebookLM: Failed to create entry', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [notebookId]);

  // Sort entries by creation date (newest first)
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [entries]);

  // Group entries by tags
  const entriesByTag = useMemo(() => {
    const grouped: Record<string, NotebookEntry[]> = {};
    
    entries.forEach(entry => {
      entry.tags.forEach(tag => {
        if (!grouped[tag]) {
          grouped[tag] = [];
        }
        grouped[tag].push(entry);
      });
    });
    
    return grouped;
  }, [entries]);

  // Fetch entries when component mounts or notebookId changes
  useEffect(() => {
    if (notebookId) {
      fetchEntries();
    }
  }, [fetchEntries, notebookId]);

  return {
    entries: sortedEntries,
    entriesByTag,
    loading,
    error,
    fetchEntries,
    createEntry,
    refresh: fetchEntries
  };
}

/**
 * Hook for managing connections between notebook entries
 */
export function useNotebookConnections(notebookId: string) {
  const [connections, setConnections] = useState<NotebookConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    if (!notebookId) return;
    
    setLoading(true);
    try {
      const response = await notebookApi.getConnections(notebookId);
      if (response.success && response.data) {
        setConnections(response.data);
        setError(null);
      } else {
        setError(response.error || 'Failed to fetch connections');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error(`🔥 NotebookLM: Failed to fetch connections for notebook ${notebookId}`, err);
    } finally {
      setLoading(false);
    }
  }, [notebookId]);

  const createConnection = useCallback(async (request: CreateConnectionRequest) => {
    setLoading(true);
    try {
      const response = await notebookApi.createConnection(request);
      if (response.success && response.data) {
        setConnections(prev => [...prev, response.data!]);
        setError(null);
        return response.data;
      } else {
        setError(response.error || 'Failed to create connection');
        throw new Error(response.error || 'Failed to create connection');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('🔥 NotebookLM: Failed to create connection', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Group connections by relationship type
  const connectionsByType = useMemo(() => {
    const grouped: Record<string, NotebookConnection[]> = {};
    
    connections.forEach(connection => {
      const type = connection.relationship_type;
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(connection);
    });
    
    return grouped;
  }, [connections]);

  // Fetch connections when component mounts or notebookId changes
  useEffect(() => {
    if (notebookId) {
      fetchConnections();
    }
  }, [fetchConnections, notebookId]);

  return {
    connections,
    connectionsByType,
    loading,
    error,
    fetchConnections,
    createConnection,
    refresh: fetchConnections
  };
}

/**
 * Hook for notebook analytics
 */
export function useNotebookAnalytics(notebookId: string) {
  const [analytics, setAnalytics] = useState<NotebookAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!notebookId) return;
    
    setLoading(true);
    try {
      const response = await notebookApi.getNotebookAnalytics(notebookId);
      if (response.success && response.data) {
        setAnalytics(response.data);
        setError(null);
      } else {
        setError(response.error || 'Failed to fetch notebook analytics');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error(`🔥 NotebookLM: Failed to fetch analytics for notebook ${notebookId}`, err);
    } finally {
      setLoading(false);
    }
  }, [notebookId]);

  // Fetch analytics when component mounts or notebookId changes
  useEffect(() => {
    if (notebookId) {
      fetchAnalytics();
    }
  }, [fetchAnalytics, notebookId]);

  return {
    analytics,
    loading,
    error,
    refresh: fetchAnalytics
  };
}

/**
 * Hook for managing tags
 */
export function useTags() {
  const [tags, setTags] = useState<NotebookTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const response = await notebookApi.getTags();
      if (response.success && response.data) {
        setTags(response.data);
        setError(null);
      } else {
        setError(response.error || 'Failed to fetch tags');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('🔥 NotebookLM: Failed to fetch tags', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sort tags by usage count (most used first)
  const sortedTags = useMemo(() => {
    return [...tags].sort((a, b) => b.usage_count - a.usage_count);
  }, [tags]);

  // Fetch tags when component mounts
  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  return {
    tags: sortedTags,
    loading,
    error,
    refresh: fetchTags
  };
}