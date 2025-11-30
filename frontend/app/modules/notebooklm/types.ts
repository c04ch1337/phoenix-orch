/**
 * NotebookLM Types
 * 
 * Type definitions for the NotebookLM module that allows Phoenix ORCH
 * to manage and interact with notebooks, entries, and connections.
 */

import { UserRole } from '../../types/global';

/**
 * Represents a notebook in the NotebookLM system
 */
export interface Notebook {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  is_shared: boolean;
  tags: string[];
  entry_count: number;
  status: 'active' | 'archived';
}

/**
 * Represents an entry within a notebook
 */
export interface NotebookEntry {
  id: string;
  notebook_id: string;
  title: string;
  content: string;
  content_type: 'text' | 'code' | 'image' | 'mixed';
  created_at: string;
  updated_at: string;
  tags: string[];
  source_url?: string;
  references?: string[];
  importance: 'low' | 'medium' | 'high';
}

/**
 * Represents a connection between notebook entries
 */
export interface NotebookConnection {
  id: string;
  source_id: string;
  target_id: string;
  relationship_type: 'reference' | 'continuation' | 'contradiction' | 'support' | 'question' | 'answer';
  strength: number; // 0-100 indicating connection strength
  created_at: string;
  description: string;
  created_by: string;
}

/**
 * Represents a tag used in notebooks and entries
 */
export interface NotebookTag {
  id: string;
  name: string;
  color: string;
  description?: string;
  usage_count: number;
}

/**
 * Represents a summary of notebook analytics
 */
export interface NotebookAnalytics {
  notebook_id: string;
  entry_count: number;
  connection_count: number;
  word_count: number;
  most_frequent_tags: Array<{tag: string, count: number}>;
  created_at: string;
  last_updated: string;
  contributors: Array<{user_id: string, entry_count: number}>;
}

/**
 * Request to create a new notebook
 */
export interface CreateNotebookRequest {
  name: string;
  description?: string;
  tags?: string[];
  is_shared?: boolean;
}

/**
 * Request to create a new entry
 */
export interface CreateEntryRequest {
  notebook_id: string;
  title: string;
  content: string;
  content_type: 'text' | 'code' | 'image' | 'mixed';
  tags?: string[];
  source_url?: string;
  references?: string[];
  importance?: 'low' | 'medium' | 'high';
}

/**
 * Request to create a connection between entries
 */
export interface CreateConnectionRequest {
  source_id: string;
  target_id: string;
  relationship_type: 'reference' | 'continuation' | 'contradiction' | 'support' | 'question' | 'answer';
  strength: number;
  description?: string;
}

/**
 * Response for most API operations
 */
export interface NotebookResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

/**
 * Filter options for retrieving notebooks
 */
export interface NotebookFilters {
  tags?: string[];
  query?: string;
  owner_id?: string;
  status?: 'active' | 'archived' | 'all';
  date_from?: string;
  date_to?: string;
  shared_only?: boolean;
}