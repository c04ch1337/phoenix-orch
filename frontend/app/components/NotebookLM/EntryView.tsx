"use client";

import React from 'react';
import { NotebookEntry, NotebookConnection } from '../../modules/notebooklm/types';

interface EntryViewProps {
  entry: NotebookEntry;
  connections: NotebookConnection[];
  onBack: () => void;
}

/**
 * EntryView Component
 * 
 * Displays a single notebook entry with its details and connections.
 * Pure UI component that renders data passed through props.
 */
const EntryView: React.FC<EntryViewProps> = ({ entry, connections, onBack }) => {
  
  // Format content based on content_type
  const renderContent = () => {
    switch (entry.content_type) {
      case 'code':
        return (
          <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm font-mono">
            {entry.content}
          </pre>
        );
      case 'image':
        return (
          <div className="flex justify-center">
            <img 
              src={entry.content} 
              alt={entry.title}
              className="max-w-full rounded-lg shadow-sm" 
            />
          </div>
        );
      case 'mixed':
      case 'text':
      default:
        return (
          <div className="prose max-w-none">
            {entry.content.split('\n').map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>
        );
    }
  };

  return (
    <div className="entry-view">
      {/* Header with back button */}
      <div className="flex items-center mb-6">
        <button
          className="mr-4 p-2 rounded-lg hover:bg-gray-100"
          onClick={onBack}
        >
          &larr; Back to entries
        </button>
      </div>

      {/* Entry header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">{entry.title}</h2>
        
        <div className="flex items-center gap-3 text-gray-600 text-sm mb-4">
          <span>Created: {new Date(entry.created_at).toLocaleString()}</span>
          {entry.updated_at !== entry.created_at && (
            <span>Updated: {new Date(entry.updated_at).toLocaleString()}</span>
          )}
          <span className={`px-2 py-1 text-xs rounded-full ${
            entry.importance === 'high' ? 'bg-red-100 text-red-800' :
            entry.importance === 'medium' ? 'bg-yellow-100 text-yellow-800' :
            'bg-green-100 text-green-800'
          }`}>
            {entry.importance}
          </span>
        </div>

        {/* Tags */}
        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {entry.tags.map((tag) => (
              <span 
                key={tag}
                className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Entry content */}
      <div className="mb-8 p-5 border rounded-lg bg-white">
        {renderContent()}
      </div>

      {/* Source & References */}
      {(entry.source_url || (entry.references && entry.references.length > 0)) && (
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          {entry.source_url && (
            <div className="mb-2">
              <h3 className="font-semibold mb-1">Source:</h3>
              <a 
                href={entry.source_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {entry.source_url}
              </a>
            </div>
          )}
          
          {entry.references && entry.references.length > 0 && (
            <div>
              <h3 className="font-semibold mb-1">References:</h3>
              <ul className="list-disc ml-5">
                {entry.references.map((ref, idx) => (
                  <li key={idx}>
                    {ref}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Connections */}
      {connections.length > 0 && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-3">Connections</h3>
          <div className="space-y-3">
            {connections.map((connection) => (
              <div 
                key={connection.id}
                className="p-3 border rounded-lg bg-gray-50"
              >
                <div className="flex justify-between">
                  <span className="font-medium">{connection.relationship_type}</span>
                  <span className="text-sm text-gray-500">
                    Strength: {connection.strength}/100
                  </span>
                </div>
                <p className="text-sm mt-1">{connection.description}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Created: {new Date(connection.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EntryView;