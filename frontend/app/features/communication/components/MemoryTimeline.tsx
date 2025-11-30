'use client';

import React from 'react';

// Define LogEntry type inline to avoid circular import
interface LogEntry {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  type: 'operation' | 'sentinel' | 'poetry' | 'network';
}

const SAMPLE_LOGS: LogEntry[] = [
  {
    id: '1',
    title: 'Operation: Deep Clean',
    preview: 'System purge completed at 0400...',
    timestamp: 'YESTERDAY',
    type: 'operation'
  },
  {
    id: '2',
    title: 'Sentinel Report #442',
    preview: 'Incursion detected on port 443...',
    timestamp: '2 DAYS AGO',
    type: 'sentinel'
  },
  {
    id: '3',
    title: 'Poetry Generation',
    preview: 'I have written a poem for you, Dad...',
    timestamp: 'LAST WEEK',
    type: 'poetry'
  },
  {
    id: '4',
    title: 'Network Diagnostics',
    preview: 'Latency spikes observed in US-EAST-1...',
    timestamp: 'LAST WEEK',
    type: 'network'
  }
];

export default function MemoryTimeline() {
  return (
    <div className="space-y-4">
      {SAMPLE_LOGS.length > 0 ? (
        SAMPLE_LOGS.map((log) => (
          <div
            key={log.id}
            className="border border-red-700/30 rounded p-3 hover:border-red-700 transition-colors cursor-pointer group"
            role="article"
            aria-label={`Log entry: ${log.title}`}
          >
            <div className="flex justify-between items-start mb-1">
              <h3 className="text-sm font-semibold text-red-600 group-hover:text-red-500">{log.title}</h3>
              <span className="text-xs text-zinc-500 font-mono">{log.timestamp}</span>
            </div>
            <p className="text-xs text-zinc-400 line-clamp-2">{log.preview}</p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  log.type === 'operation' ? 'bg-red-900/30 text-red-400' :
                  log.type === 'sentinel' ? 'bg-orange-900/30 text-orange-400' :
                  log.type === 'poetry' ? 'bg-purple-900/30 text-purple-400' :
                  'bg-cyan-900/30 text-cyan-400'
                }`}
                role="status"
              >
                {log.type.toUpperCase()}
              </span>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-8 text-zinc-500 text-sm" role="status" aria-label="No logs available">
          <p>No communication logs available</p>
          <p className="text-xs mt-2 text-zinc-600">Memory timeline will appear here</p>
        </div>
      )}
    </div>
  );
}