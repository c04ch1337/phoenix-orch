'use client';

import React from 'react';
import { Lightbulb, ArrowRight } from 'lucide-react';

/**
 * OpportunityEngine Component
 * 
 * Displays potential opportunities and strategic options
 * that the user can leverage when working with the EmberUnit.
 */
export const OpportunityEngine: React.FC = () => {
  // Sample opportunities
  const opportunities = [
    {
      id: 'opp-1',
      title: 'System Integration',
      description: 'Connect to external data sources for enhanced capabilities',
      tags: ['data', 'integration'],
    },
    {
      id: 'opp-2',
      title: 'Performance Analysis',
      description: 'Generate reports on orchestrator performance metrics',
      tags: ['metrics', 'analysis'],
    },
    {
      id: 'opp-3',
      title: 'Task Automation',
      description: 'Create workflows for repetitive operational tasks',
      tags: ['automation', 'workflow'],
    },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-md p-4 h-full flex flex-col">
      <h2 className="text-base font-medium text-phoenix-orange mb-4 flex items-center gap-2">
        <Lightbulb className="w-4 h-4" />
        Opportunity Engine
      </h2>
      
      <div className="flex-1 space-y-3">
        {opportunities.map((opportunity) => (
          <div 
            key={opportunity.id} 
            className="p-3 border border-zinc-800 rounded-md hover:bg-zinc-800/50 transition-colors cursor-pointer"
          >
            <h3 className="text-sm font-semibold text-white mb-1">{opportunity.title}</h3>
            <p className="text-xs text-zinc-400 mb-2">{opportunity.description}</p>
            <div className="flex gap-2">
              {opportunity.tags.map((tag) => (
                <span 
                  key={tag} 
                  className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <button className="mt-4 flex items-center justify-between w-full py-2 px-3 text-sm text-phoenix-orange border border-zinc-800 rounded-md hover:bg-zinc-800/50 transition-colors">
        <span>Discover More Opportunities</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default OpportunityEngine;