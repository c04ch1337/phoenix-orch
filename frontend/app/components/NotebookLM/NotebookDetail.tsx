"use client";

import React, { useState } from 'react';
import { Notebook, NotebookEntry } from '../../modules/notebooklm/types';
import { useNotebookEntries, useNotebookConnections } from '../../modules/notebooklm/hooks';
import EntryView from './EntryView';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';

interface NotebookDetailProps {
  notebook: Notebook;
  onBack: () => void;
}

/**
 * NotebookDetail Component
 * 
 * Displays a selected notebook and its entries.
 * Uses hooks from the NotebookLM module for data fetching.
 */
const NotebookDetail: React.FC<NotebookDetailProps> = ({ notebook, onBack }) => {
  // Get entries from the hook
  const { entries, loading: entriesLoading, error: entriesError, refresh: refreshEntries } = useNotebookEntries(notebook.id);
  
  // Get connections from the hook
  const { connections, loading: connectionsLoading, error: connectionsError } = useNotebookConnections(notebook.id);
  
  // Local UI state for selected entry
  const [selectedEntry, setSelectedEntry] = useState<NotebookEntry | null>(null);

  // Handle entry selection
  const handleSelectEntry = (entry: NotebookEntry) => {
    setSelectedEntry(entry);
  };

  // Handle back to entries list
  const handleBackToEntries = () => {
    setSelectedEntry(null);
  };

  // Loading state
  const isLoading = entriesLoading || connectionsLoading;
  if (isLoading && !selectedEntry) {
    return <LoadingState message="Loading notebook entries..." />;
  }

  // Error state
  const error = entriesError || connectionsError;
  if (error && !selectedEntry) {
    return <ErrorState message={error} onRetry={refreshEntries} />;
  }

  return (
    <div className="notebook-detail">
      {/* Header with back button */}
      <div className="flex items-center mb-6">
        <button
          className="mr-4 p-2 rounded-lg hover:bg-gray-100"
          onClick={onBack}
        >
          &larr; Back
        </button>
        <h1 className="text-2xl font-bold">{notebook.name}</h1>
      </div>

      {/* Show entry detail or entry list */}
      {selectedEntry ? (
        <EntryView
          entry={selectedEntry}
          connections={connections.filter(
            conn => conn.source_id === selectedEntry.id || conn.target_id === selectedEntry.id
          )}
          onBack={handleBackToEntries}
        />
      ) : (
        <>
          {/* Notebook metadata */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-700 mb-3">{notebook.description}</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {notebook.tags.map((tag) => (
                <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {tag}
                </span>
              ))}
            </div>
            <div className="text-sm text-gray-500">
              <p>Created: {new Date(notebook.created_at).toLocaleDateString()}</p>
              <p>Last updated: {new Date(notebook.updated_at).toLocaleDateString()}</p>
              <p>Entries: {notebook.entry_count}</p>
            </div>
          </div>

          {/* Entry list */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Entries</h2>
            {entries.length > 0 ? (
              <div className="grid gap-4">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-4 border rounded-lg hover:border-blue-300 cursor-pointer transition"
                    onClick={() => handleSelectEntry(entry)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold">{entry.title}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        entry.importance === 'high' ? 'bg-red-100 text-red-800' :
                        entry.importance === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {entry.importance}
                      </span>
                    </div>
                    
                    <p className="text-gray-700 text-sm line-clamp-3 mb-2">
                      {entry.content.length > 200
                        ? `${entry.content.substring(0, 200)}...`
                        : entry.content}
                    </p>
                    
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{new Date(entry.created_at).toLocaleString()}</span>
                      <span>{entry.content_type}</span>
                    </div>
                    
                    {/* Entry tags */}
                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap mt-3 gap-1">
                        {entry.tags.map((tag) => (
                          <span 
                            key={tag}
                            className="px-2 py-1 bg-gray-100 text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No entries found in this notebook.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotebookDetail;