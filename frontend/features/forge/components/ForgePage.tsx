import React from 'react';
import { ForgeLeaderboard } from './ForgeLeaderboard';

export function ForgePage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-amber-500 mb-8">Ember Forge</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-8">
          <ForgeLeaderboard />
        </div>
        
        <div className="md:col-span-4">
          <div className="bg-gray-800 rounded-lg shadow-lg p-4">
            <h2 className="text-lg font-semibold text-amber-500 mb-4">About Ember Forge</h2>
            <p className="text-gray-300 mb-3">
              Ember Forge is the real-time ranking system for Phoenix agents, tracking their performance, 
              conscience scores, and usage metrics.
            </p>
            <p className="text-gray-300">
              Leaderboard updates are delivered in real-time through server-sent events, 
              ensuring you always see the most current agent standings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}