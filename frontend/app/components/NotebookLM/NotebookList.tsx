"use client";

import React, { useState } from 'react';
import { Notebook, NotebookFilters } from '../../modules/notebooklm/types';

interface NotebookListProps {
  notebooks: Notebook[];
  onSelectNotebook: (notebook: Notebook) => void;
}

/**
 * NotebookList Component
 * 
 * Displays a list of available notebooks with filtering options.
 * Only handles UI rendering and user interactions, using data from props.
 */
const NotebookList: React.FC<NotebookListProps> = ({ notebooks, onSelectNotebook }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'archived'>('all');
  
  // Filter notebooks based on search query and active filter
  const filteredNotebooks = notebooks.filter(notebook => {
    // Search query filter
    const matchesSearch = notebook.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         notebook.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Status filter
    const matchesStatus = activeFilter === 'all' || notebook.status === activeFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="notebook-list">
      <h1 className="text-2xl font-bold mb-6">Notebooks</h1>
      
      {/* Search and filters */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search notebooks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 border rounded-lg mb-3"
        />
        
        <div className="flex space-x-4">
          <button
            className={`px-4 py-2 rounded-lg ${activeFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setActiveFilter('all')}
          >
            All
          </button>
          <button
            className={`px-4 py-2 rounded-lg ${activeFilter === 'active' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setActiveFilter('active')}
          >
            Active
          </button>
          <button
            className={`px-4 py-2 rounded-lg ${activeFilter === 'archived' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setActiveFilter('archived')}
          >
            Archived
          </button>
        </div>
      </div>
      
      {/* Notebook grid */}
      {filteredNotebooks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotebooks.map((notebook) => (
            <div 
              key={notebook.id}
              className="p-4 border rounded-lg hover:shadow-md transition cursor-pointer"
              onClick={() => onSelectNotebook(notebook)}
            >
              <h3 className="font-bold text-lg">{notebook.name}</h3>
              <p className="text-gray-600 text-sm line-clamp-2 mb-2">{notebook.description}</p>
              
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>{new Date(notebook.updated_at).toLocaleDateString()}</span>
                <span>{notebook.entry_count} entries</span>
              </div>
              
              {/* Tags */}
              {notebook.tags.length > 0 && (
                <div className="flex flex-wrap mt-3 gap-1">
                  {notebook.tags.slice(0, 3).map((tag) => (
                    <span 
                      key={tag}
                      className="px-2 py-1 bg-gray-100 text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                  {notebook.tags.length > 3 && (
                    <span className="px-2 py-1 bg-gray-100 text-xs rounded-full">
                      +{notebook.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
              
              {/* Status indicator */}
              {notebook.status === 'archived' && (
                <span className="mt-2 inline-block px-2 py-1 bg-gray-200 text-xs rounded">
                  Archived
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-gray-500">
          <p>No notebooks found matching your criteria.</p>
        </div>
      )}
    </div>
  );
};

export default NotebookList;