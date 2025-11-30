"use client";

import { useState } from 'react';
import { useNotebooks } from '../../modules/notebooklm/hooks';
import { Notebook } from '../../modules/notebooklm/types';
import NotebookList from './NotebookList';
import NotebookDetail from './NotebookDetail';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';

/**
 * NotebookLM Component
 * 
 * Main UI component for the NotebookLM feature that displays notebooks and their entries.
 * This component leverages hooks from the NotebookLM module for business logic,
 * maintaining a clean separation of concerns between UI and data operations.
 */
const NotebookLM: React.FC = () => {
  // Use the useNotebooks hook from the module for business logic
  const { notebooks, loading, error, updateFilters, refresh } = useNotebooks();
  
  // Local UI state for currently selected notebook
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null);
  
  // Handle notebook selection
  const handleSelectNotebook = (notebook: Notebook) => {
    setSelectedNotebook(notebook);
  };
  
  // Handle back button click
  const handleBackToList = () => {
    setSelectedNotebook(null);
  };

  // Show loading state
  if (loading && !selectedNotebook) {
    return <LoadingState message="Loading notebooks..." />;
  }

  // Show error state
  if (error && !selectedNotebook) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <div className="notebook-lm-container">
      {selectedNotebook ? (
        <NotebookDetail
          notebook={selectedNotebook}
          onBack={handleBackToList}
        />
      ) : (
        <NotebookList
          notebooks={notebooks}
          onSelectNotebook={handleSelectNotebook}
        />
      )}
    </div>
  );
};

export default NotebookLM;