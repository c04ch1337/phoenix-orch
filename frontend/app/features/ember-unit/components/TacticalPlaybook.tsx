'use client';

import React from 'react';
import { BookOpen, Check } from 'lucide-react';

/**
 * TacticalPlaybook Component
 * 
 * Displays pre-configured command templates and tactical approaches
 * that can be used with the EmberUnit interface.
 */
export const TacticalPlaybook: React.FC = () => {
  // Sample command templates
  const commandTemplates = [
    {
      id: 'cmd-1',
      title: 'System Analysis',
      command: 'Analyze system performance and identify bottlenecks',
      category: 'diagnostics',
      isReady: true,
    },
    {
      id: 'cmd-2',
      title: 'Resource Optimization',
      command: 'Identify and optimize resource usage across processes',
      category: 'performance',
      isReady: true,
    },
    {
      id: 'cmd-3',
      title: 'Security Audit',
      command: 'Perform comprehensive security audit of all systems',
      category: 'security',
      isReady: false,
    },
    {
      id: 'cmd-4',
      title: 'Data Integration',
      command: 'Connect to external data sources and synchronize',
      category: 'integration',
      isReady: true,
    },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-md p-4 h-full flex flex-col">
      <h2 className="text-base font-medium text-phoenix-orange mb-4 flex items-center gap-2">
        <BookOpen className="w-4 h-4" />
        Tactical Playbook
      </h2>
      
      <div className="flex-1 space-y-2">
        {commandTemplates.map((template) => (
          <div 
            key={template.id} 
            className={`p-3 border rounded-md transition-colors ${
              template.isReady 
                ? 'border-zinc-700 hover:bg-zinc-800/50 cursor-pointer' 
                : 'border-zinc-800 opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex justify-between">
              <h3 className="text-sm font-semibold text-white">{template.title}</h3>
              {template.isReady && (
                <span className="flex items-center text-[10px] text-green-500">
                  <Check className="w-3 h-3 mr-1" />
                  READY
                </span>
              )}
            </div>
            
            <p className="text-xs text-zinc-400 mt-1">
              {template.command}
            </p>
            
            <span 
              className={`inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full ${
                {
                  'diagnostics': 'bg-blue-900/30 text-blue-400',
                  'performance': 'bg-amber-900/30 text-amber-400',
                  'security': 'bg-red-900/30 text-red-400',
                  'integration': 'bg-green-900/30 text-green-400',
                }[template.category]
              }`}
            >
              {template.category}
            </span>
          </div>
        ))}
      </div>
      
      <button className="mt-4 w-full py-2 px-3 text-sm text-phoenix-orange border border-zinc-800 rounded-md hover:bg-zinc-800/50 transition-colors">
        Create Custom Command Template
      </button>
    </div>
  );
};

export default TacticalPlaybook;