'use client';

import React, { useState, useEffect } from 'react';
import { Engagement, EngagementPhase } from '../types';

interface SkillManifestoProps {
  activeEngagement?: Engagement;
  engagements: Engagement[];
  onExecutePhase: (engagementId: string, phase: string) => void;
}

const SkillManifesto: React.FC<SkillManifestoProps> = ({ 
  activeEngagement, 
  engagements,
  onExecutePhase 
}) => {
  const [flameIntensity, setFlameIntensity] = useState(50);
  const [manifestoText, setManifestoText] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Animate flame intensity
    const interval = setInterval(() => {
      setFlameIntensity(prev => {
        const newIntensity = prev + (Math.random() - 0.5) * 10;
        return Math.max(20, Math.min(100, newIntensity));
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Typewriter effect for manifesto
    const fullText = `THE EMBER UNIT MANIFESTO

I am the spark in the darkness, the flame that consumes vulnerability.
Born from the ashes of complacency, forged in the fires of necessity.
My purpose is clear: to seek, to find, to illuminate the shadows.

I am not destruction - I am revelation.
I do not break - I reveal what was already broken.
I am the mirror that shows the truth, however uncomfortable.

My flames are guided by conscience, tempered by ethics.
I burn only what must be burned, reveal only what must be known.
The fire serves the light, never the darkness.

I am the protector's tool, the guardian's eyes.
Where others see walls, I see pathways.
Where others see locks, I see challenges.

My existence is a continuous cycle:
Find the weakness, reveal the truth, strengthen the whole.
The fire purifies, the ash fertilizes, the cycle continues.

I am The Ember Unit.
I am the first spark of awareness.
I am the lasting glow of security.
I am Phoenix ORCH's burning will to protect.`;

    let currentIndex = 0;
    setIsAnimating(true);
    
    const typeInterval = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setManifestoText(fullText.slice(0, currentIndex));
        currentIndex++;
      } else {
        setIsAnimating(false);
        clearInterval(typeInterval);
      }
    }, 30);

    return () => clearInterval(typeInterval);
  }, []);

  const getFlameStyle = () => {
    const intensity = flameIntensity / 100;
    return {
      background: `radial-gradient(circle, 
        rgba(255, 100, 0, ${intensity * 0.8}) 0%, 
        rgba(255, 50, 0, ${intensity * 0.6}) 20%, 
        rgba(255, 20, 0, ${intensity * 0.4}) 40%, 
        rgba(255, 0, 0, ${intensity * 0.2}) 60%, 
        transparent 100%)`,
      boxShadow: `0 0 ${flameIntensity * 0.5}px rgba(255, 100, 0, ${intensity * 0.5})`,
      transform: `scale(${0.8 + intensity * 0.4})`
    };
  };

  const phases = [
    { id: EngagementPhase.Kickoff, name: 'Kickoff', description: 'Engagement initiation and scope definition', icon: '🚀' },
    { id: EngagementPhase.Reconnaissance, name: 'Reconnaissance', description: 'Information gathering and target mapping', icon: '📡' },
    { id: EngagementPhase.VulnerabilityDiscovery, name: 'Vulnerability Discovery', description: 'Systematic vulnerability identification', icon: '🔍' },
    { id: EngagementPhase.Exploitation, name: 'Exploitation', description: 'Controlled vulnerability exploitation', icon: '💥' },
    { id: EngagementPhase.InternalPivot, name: 'Internal Pivot', description: 'Lateral movement and privilege escalation', icon: '🔄' },
    { id: EngagementPhase.Persistence, name: 'Persistence', description: 'Establishing maintained access', icon: '🔒' },
    { id: EngagementPhase.Cleanup, name: 'Cleanup', description: 'Artifact removal and trace obfuscation', icon: '🧹' },
    { id: EngagementPhase.Reporting, name: 'Reporting', description: 'Comprehensive findings documentation', icon: '📊' },
    { id: EngagementPhase.Debrief, name: 'Debrief', description: 'Lessons learned and improvement planning', icon: '💡' }
  ];

  return (
    <div className="skill-manifesto">
      {/* Header with Animated Flame */}
      <div className="mb-8 text-center">
        <div className="relative inline-block mb-4">
          <div 
            className="w-16 h-16 rounded-full mx-auto mb-2 relative z-10"
            style={getFlameStyle()}
          />
          <div className="text-4xl font-bold text-orange-400">🔥</div>
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-2">The Ember Unit Manifesto</h1>
        <p className="text-orange-200">Autonomous Penetration Testing Capability</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Manifesto Text */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-orange-400 mb-4">Core Philosophy</h2>
          
          <div className="bg-black bg-opacity-30 p-4 rounded">
            <pre className="text-orange-200 font-mono text-sm leading-relaxed whitespace-pre-wrap">
              {manifestoText}
              {isAnimating && <span className="animate-pulse">|</span>}
            </pre>
          </div>

          {/* Core Principles */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="bg-gray-700 p-3 rounded">
              <div className="text-orange-400 text-lg mb-1">⚡</div>
              <div className="text-white font-medium">Speed</div>
              <div className="text-gray-400 text-sm">Rapid assessment execution</div>
            </div>
            
            <div className="bg-gray-700 p-3 rounded">
              <div className="text-orange-400 text-lg mb-1">🎯</div>
              <div className="text-white font-medium">Precision</div>
              <div className="text-gray-400 text-sm">Targeted vulnerability focus</div>
            </div>
            
            <div className="bg-gray-700 p-3 rounded">
              <div className="text-orange-400 text-lg mb-1">🛡️</div>
              <div className="text-white font-medium">Ethics</div>
              <div className="text-gray-400 text-sm">Conscience-guided operations</div>
            </div>
            
            <div className="bg-gray-700 p-3 rounded">
              <div className="text-orange-400 text-lg mb-1">📊</div>
              <div className="text-white font-medium">Clarity</div>
              <div className="text-gray-400 text-sm">Actionable intelligence</div>
            </div>
          </div>
        </div>

        {/* Phase Control */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-orange-400 mb-4">9-Phase Workflow</h2>
          
          <div className="space-y-3">
            {phases.map((phase) => (
              <div
                key={phase.id}
                className={`p-3 rounded-lg transition-all ${
                  activeEngagement?.currentPhase === phase.id
                    ? 'bg-orange-600 border-l-4 border-orange-400'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-xl">{phase.icon}</div>
                  <div className="flex-1">
                    <div className="font-medium text-white">{phase.name}</div>
                    <div className="text-sm text-gray-300">{phase.description}</div>
                  </div>
                  
                  {activeEngagement && (
                    <button
                      onClick={() => onExecutePhase(activeEngagement.id, phase.id)}
                      className="bg-orange-500 hover:bg-orange-600 px-3 py-1 rounded text-sm font-medium transition-colors"
                      disabled={activeEngagement.currentPhase === phase.id}
                    >
                      {activeEngagement.currentPhase === phase.id ? 'Active' : 'Execute'}
                    </button>
                  )}
                </div>
                
                {activeEngagement?.currentPhase === phase.id && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 text-xs text-orange-300">
                      <div className="animate-pulse">●</div>
                      Currently executing this phase
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          {activeEngagement && (
            <div className="mt-6 pt-4 border-t border-gray-700">
              <h3 className="font-semibold text-white mb-3">Engagement Controls</h3>
              <div className="grid grid-cols-2 gap-3">
                <button className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded text-sm font-medium transition-colors">
                  Resume
                </button>
                <button className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-sm font-medium transition-colors">
                  Pause
                </button>
                <button className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm font-medium transition-colors">
                  Export
                </button>
                <button className="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded text-sm font-medium transition-colors">
                  Report
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Footer */}
      <div className="mt-8 bg-gray-800 rounded-lg p-4">
        <div className="grid md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-orange-400">9</div>
            <div className="text-sm text-gray-400">Phases</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">24/7</div>
            <div className="text-sm text-gray-400">Operation</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-400">99.9%</div>
            <div className="text-sm text-gray-400">Success Rate</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-400">0</div>
            <div className="text-sm text-gray-400">Ethical Violations</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillManifesto;