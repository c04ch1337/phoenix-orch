import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Evidence {
  id: string;
  incident_id: string;
  data_type: string;
  content: string;
  timestamp: string;
  hash: string;
}

interface EvidenceGalleryProps {
  evidence: Evidence[];
}

const dataTypeIcons = {
  'Log': '📝',
  'NetworkCapture': '🌐',
  'MemoryDump': '💾',
  'FileSystem': '📁',
  'ProcessInfo': '⚙️',
};

const EvidenceCard: React.FC<{ evidence: Evidence }> = ({ evidence }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const formattedTime = new Date(evidence.timestamp).toLocaleTimeString();
  const icon = dataTypeIcons[evidence.data_type as keyof typeof dataTypeIcons] || '📄';

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      whileHover={{ scale: 1.02 }}
      className="bg-gray-800 rounded-lg p-4 cursor-pointer"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <h3 className="text-sm font-medium text-gray-200">
              {evidence.data_type}
            </h3>
            <p className="text-xs text-gray-400">{formattedTime}</p>
          </div>
        </div>
        <div className="text-xs text-gray-500 font-mono">
          {evidence.hash.slice(0, 8)}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-4 overflow-hidden"
          >
            <div className="bg-gray-900 rounded p-3 font-mono text-xs text-gray-300 overflow-x-auto">
              {evidence.content}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <span>ID: {evidence.id}</span>
              <span>Incident: {evidence.incident_id}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const EvidenceGallery: React.FC<EvidenceGalleryProps> = ({ evidence }) => {
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'time' | 'type'>('time');

  const filteredEvidence = evidence.filter(item => 
    filter === 'all' ? true : item.data_type === filter
  );

  const sortedEvidence = [...filteredEvidence].sort((a, b) => {
    if (sortBy === 'time') {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }
    return a.data_type.localeCompare(b.data_type);
  });

  const dataTypes = ['all', ...new Set(evidence.map(e => e.data_type))];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {dataTypes.map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`
                px-3 py-1 text-sm rounded-full transition-colors
                ${filter === type 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
              `}
            >
              {type === 'all' ? 'All' : type}
            </button>
          ))}
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'time' | 'type')}
          className="bg-gray-700 text-white rounded px-2 py-1 text-sm"
        >
          <option value="time">Sort by Time</option>
          <option value="type">Sort by Type</option>
        </select>
      </div>

      {/* Evidence Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {sortedEvidence.map(item => (
            <EvidenceCard key={item.id} evidence={item} />
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {sortedEvidence.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No evidence found
          {filter !== 'all' && ' for selected type'}
        </div>
      )}
    </div>
  );
};