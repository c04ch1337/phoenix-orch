'use client';

import { useEffect, useState } from 'react';
import { Memory, getMemories } from '@/lib/api';

export default function MemoryTimeline() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMemories = async () => {
      try {
        const data = await getMemories();
        setMemories(data);
      } catch (err) {
        setError('Failed to load memories');
      } finally {
        setLoading(false);
      }
    };

    fetchMemories();
    // Refresh memories every 30 seconds
    const interval = setInterval(fetchMemories, 30000);
    return () => clearInterval(interval);
  }, []);

  const conscienceColor = {
    reptilian: 'border-[#B80000]/50 bg-[#B80000]/10',
    mammalian: 'border-blue-500/50 bg-blue-500/10',
    neocortex: 'border-[#FFD700]/50 bg-[#FFD700]/10',
  };

  if (loading) {
    return (
      <div className="bg-[#1a1a2e]/80 backdrop-blur-sm rounded-2xl p-6 border border-[#FF4500]/20">
        <h3 className="text-lg font-semibold fire-text mb-4">Memory Timeline</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF4500]"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#1a1a2e]/80 backdrop-blur-sm rounded-2xl p-6 border border-[#FF4500]/20">
        <h3 className="text-lg font-semibold fire-text mb-4">Memory Timeline</h3>
        <p className="text-gray-400 text-sm text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a2e]/80 backdrop-blur-sm rounded-2xl p-6 border border-[#FF4500]/20">
      <h3 className="text-lg font-semibold fire-text mb-4">Memory Timeline</h3>
      
      {memories.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">
          No memories recorded yet. Start chatting to create memories! 🧠
        </p>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {memories.map((memory) => (
            <div
              key={memory.id}
              className={`p-4 rounded-lg border ${
                memory.conscience
                  ? conscienceColor[memory.conscience]
                  : 'border-gray-700 bg-gray-800/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-xs text-gray-400">
                  {new Date(memory.timestamp).toLocaleString()}
                </span>
                {memory.conscience && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#FF4500]/20 text-[#FF4500]">
                    {memory.conscience}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{memory.content}</p>
              {memory.type && (
                <span className="text-xs text-gray-500 mt-2 block">Type: {memory.type}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}