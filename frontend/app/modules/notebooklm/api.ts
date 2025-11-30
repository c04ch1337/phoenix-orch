/**
 * NotebookLM API
 * 
 * API integration for NotebookLM module that provides functionality for
 * interacting with notebooks, entries, and connections.
 */

import {
  Notebook,
  NotebookEntry,
  NotebookConnection,
  NotebookAnalytics,
  CreateNotebookRequest,
  CreateEntryRequest,
  CreateConnectionRequest,
  NotebookResponse,
  NotebookFilters,
  NotebookTag
} from './types';

// Mock API base URL - would be configured from environment in a real implementation
const API_BASE = 'http://127.0.0.1:5001';

/**
 * Get all notebooks (with optional filters)
 */
export async function getNotebooks(filters?: NotebookFilters): Promise<NotebookResponse<Notebook[]>> {
  // In a real implementation, this would make an actual API call
  // For now, return mock data that matches our type structure
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Mock response data
  const mockNotebooks: Notebook[] = [
    {
      id: 'nb-1',
      name: 'Research Notes',
      description: 'Collection of research findings and insights',
      created_at: '2025-10-15T14:22:10Z',
      updated_at: '2025-11-29T09:45:32Z',
      owner_id: 'user-123',
      is_shared: true,
      tags: ['research', 'ai', 'machine-learning'],
      entry_count: 28,
      status: 'active'
    },
    {
      id: 'nb-2',
      name: 'Project Ideas',
      description: 'Brainstorming for future projects',
      created_at: '2025-09-03T10:11:22Z',
      updated_at: '2025-11-28T16:20:45Z',
      owner_id: 'user-123',
      is_shared: false,
      tags: ['ideas', 'projects', 'planning'],
      entry_count: 12,
      status: 'active'
    },
    {
      id: 'nb-3',
      name: 'Archived Notes',
      description: 'Old notes from previous work',
      created_at: '2025-01-10T08:30:00Z',
      updated_at: '2025-02-15T11:20:30Z',
      owner_id: 'user-123',
      is_shared: false,
      tags: ['archive', 'old', 'reference'],
      entry_count: 45,
      status: 'archived'
    }
  ];
  
  // Apply basic filtering if filters are provided
  let filteredNotebooks = [...mockNotebooks];
  
  if (filters) {
    if (filters.tags && filters.tags.length > 0) {
      filteredNotebooks = filteredNotebooks.filter(notebook => 
        filters.tags!.some(tag => notebook.tags.includes(tag))
      );
    }
    
    if (filters.query) {
      const query = filters.query.toLowerCase();
      filteredNotebooks = filteredNotebooks.filter(notebook => 
        notebook.name.toLowerCase().includes(query) || 
        notebook.description.toLowerCase().includes(query)
      );
    }
    
    if (filters.status && filters.status !== 'all') {
      filteredNotebooks = filteredNotebooks.filter(notebook => 
        notebook.status === filters.status
      );
    }
    
    if (filters.shared_only) {
      filteredNotebooks = filteredNotebooks.filter(notebook => 
        notebook.is_shared
      );
    }
  }
  
  return {
    success: true,
    data: filteredNotebooks,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get a single notebook by ID
 */
export async function getNotebook(notebookId: string): Promise<NotebookResponse<Notebook>> {
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const mockNotebook: Notebook = {
    id: notebookId,
    name: 'Research Notes',
    description: 'Collection of research findings and insights',
    created_at: '2025-10-15T14:22:10Z',
    updated_at: '2025-11-29T09:45:32Z',
    owner_id: 'user-123',
    is_shared: true,
    tags: ['research', 'ai', 'machine-learning'],
    entry_count: 28,
    status: 'active'
  };
  
  return {
    success: true,
    data: mockNotebook,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create a new notebook
 */
export async function createNotebook(request: CreateNotebookRequest): Promise<NotebookResponse<Notebook>> {
  await new Promise(resolve => setTimeout(resolve, 400));
  
  const newNotebook: Notebook = {
    id: `nb-${Date.now()}`,
    name: request.name,
    description: request.description || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    owner_id: 'user-123', // In a real implementation, this would come from auth context
    is_shared: request.is_shared || false,
    tags: request.tags || [],
    entry_count: 0,
    status: 'active'
  };
  
  return {
    success: true,
    data: newNotebook,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get entries for a notebook
 */
export async function getNotebookEntries(notebookId: string): Promise<NotebookResponse<NotebookEntry[]>> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const mockEntries: NotebookEntry[] = [
    {
      id: 'entry-1',
      notebook_id: notebookId,
      title: 'Initial research findings',
      content: 'Our initial analysis shows promising results with the new approach...',
      content_type: 'text',
      created_at: '2025-10-15T14:30:10Z',
      updated_at: '2025-10-15T14:30:10Z',
      tags: ['research', 'findings'],
      importance: 'high'
    },
    {
      id: 'entry-2',
      notebook_id: notebookId,
      title: 'Code implementation',
      content: '```python\ndef analyze_data(data):\n    return data.mean(axis=0)\n```',
      content_type: 'code',
      created_at: '2025-10-16T10:22:30Z',
      updated_at: '2025-10-16T11:45:12Z',
      tags: ['code', 'python', 'implementation'],
      importance: 'medium'
    },
    {
      id: 'entry-3',
      notebook_id: notebookId,
      title: 'Questions for follow-up',
      content: '1. How does this scale with larger datasets?\n2. What are the performance implications?',
      content_type: 'text',
      created_at: '2025-10-17T09:15:22Z',
      updated_at: '2025-10-17T09:15:22Z',
      tags: ['questions', 'follow-up'],
      importance: 'medium'
    }
  ];
  
  return {
    success: true,
    data: mockEntries,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create a new entry in a notebook
 */
export async function createEntry(request: CreateEntryRequest): Promise<NotebookResponse<NotebookEntry>> {
  await new Promise(resolve => setTimeout(resolve, 400));
  
  const newEntry: NotebookEntry = {
    id: `entry-${Date.now()}`,
    notebook_id: request.notebook_id,
    title: request.title,
    content: request.content,
    content_type: request.content_type,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: request.tags || [],
    source_url: request.source_url,
    references: request.references,
    importance: request.importance || 'medium'
  };
  
  return {
    success: true,
    data: newEntry,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get connections between entries
 */
export async function getConnections(notebookId: string): Promise<NotebookResponse<NotebookConnection[]>> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const mockConnections: NotebookConnection[] = [
    {
      id: 'conn-1',
      source_id: 'entry-1',
      target_id: 'entry-2',
      relationship_type: 'continuation',
      strength: 85,
      created_at: '2025-10-16T11:50:30Z',
      description: 'Code implementation follows from initial findings',
      created_by: 'user-123'
    },
    {
      id: 'conn-2',
      source_id: 'entry-2',
      target_id: 'entry-3',
      relationship_type: 'question',
      strength: 70,
      created_at: '2025-10-17T09:20:15Z',
      description: 'Questions about the implementation',
      created_by: 'user-123'
    }
  ];
  
  return {
    success: true,
    data: mockConnections,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create a connection between entries
 */
export async function createConnection(request: CreateConnectionRequest): Promise<NotebookResponse<NotebookConnection>> {
  await new Promise(resolve => setTimeout(resolve, 400));
  
  const newConnection: NotebookConnection = {
    id: `conn-${Date.now()}`,
    source_id: request.source_id,
    target_id: request.target_id,
    relationship_type: request.relationship_type,
    strength: request.strength,
    created_at: new Date().toISOString(),
    description: request.description || '',
    created_by: 'user-123' // In a real implementation, this would come from auth context
  };
  
  return {
    success: true,
    data: newConnection,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get analytics for a notebook
 */
export async function getNotebookAnalytics(notebookId: string): Promise<NotebookResponse<NotebookAnalytics>> {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const mockAnalytics: NotebookAnalytics = {
    notebook_id: notebookId,
    entry_count: 28,
    connection_count: 35,
    word_count: 12580,
    most_frequent_tags: [
      { tag: 'research', count: 15 },
      { tag: 'ai', count: 12 },
      { tag: 'machine-learning', count: 10 },
      { tag: 'findings', count: 8 },
      { tag: 'code', count: 7 }
    ],
    created_at: '2025-10-15T14:22:10Z',
    last_updated: '2025-11-29T09:45:32Z',
    contributors: [
      { user_id: 'user-123', entry_count: 22 },
      { user_id: 'user-456', entry_count: 6 }
    ]
  };
  
  return {
    success: true,
    data: mockAnalytics,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get all tags used in the system
 */
export async function getTags(): Promise<NotebookResponse<NotebookTag[]>> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const mockTags: NotebookTag[] = [
    { id: 'tag-1', name: 'research', color: '#FF5733', usage_count: 15 },
    { id: 'tag-2', name: 'ai', color: '#33FF57', usage_count: 12 },
    { id: 'tag-3', name: 'machine-learning', color: '#3357FF', usage_count: 10 },
    { id: 'tag-4', name: 'findings', color: '#F3FF33', usage_count: 8 },
    { id: 'tag-5', name: 'code', color: '#FF33F3', usage_count: 7 }
  ];
  
  return {
    success: true,
    data: mockTags,
    timestamp: new Date().toISOString()
  };
}