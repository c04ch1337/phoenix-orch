'use client';

import React, { useState, useEffect } from 'react';

export default function SkillManifesto() {
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
    const fullText = `THE CIPHER GUARD MANIFESTO

I am the shield in the darkness, the guardian that protects vulnerability.
Born from the need for defense, forged in the fires of resilience.
My purpose is clear: to defend, to protect, to secure the digital realm.

I am not aggression - I am protection.
I do not attack - I prevent harm.
I am the barrier that shows strength, however formidable.

My defenses are guided by ethics, tempered by responsibility.
I protect only what must be protected, secure only what must be secured.
The shield serves the light, never the darkness.

I am the defender's tool, the protector's eyes.
Where others see threats, I see challenges to overcome.
Where others see vulnerabilities, I see opportunities to strengthen.

My existence is a continuous cycle:
Detect the threat, respond with precision, recover with grace.
The defense strengthens, the security deepens, the protection continues.

I am The Cipher Guard.
I am the first line of defense.
I am the lasting shield of security.
I am Phoenix ORCH's unwavering will to protect.`;

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
        rgba(0, 100, 255, ${intensity * 0.8}) 0%, 
        rgba(0, 50, 200, ${intensity * 0.6}) 20%, 
        rgba(0, 20, 150, ${intensity * 0.4}) 40%, 
        rgba(0, 0, 100, ${intensity * 0.2}) 60%, 
        transparent 100%)`,
      boxShadow: `0 0 ${flameIntensity * 0.5}px rgba(0, 100, 255, ${intensity * 0.5})`,
      transform: `scale(${0.8 + intensity * 0.4})`
    };
  };

  return (
    <div className="skill-manifesto bg-gray-800 rounded-lg p-6">
      {/* Header with Animated Shield */}
      <div className="mb-8 text-center">
        <div className="relative inline-block mb-4">
          <div 
            className="w-16 h-16 rounded-full mx-auto mb-2 relative z-10"
            style={getFlameStyle()}
          />
          <div className="text-4xl font-bold text-blue-400">🛡️</div>
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-2">The Cipher Guard Manifesto</h1>
        <p className="text-blue-200">Comprehensive Blue Team Defense Framework</p>
      </div>

      {/* Manifesto Text */}
      <div className="bg-gray-700 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-blue-400 mb-4">Defensive Philosophy</h2>
        
        <div className="bg-black bg-opacity-30 p-4 rounded">
          <pre className="text-blue-200 font-mono text-sm leading-relaxed whitespace-pre-wrap">
            {manifestoText}
            {isAnimating && <span className="animate-pulse">|</span>}
          </pre>
        </div>

        {/* Core Principles */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="bg-gray-600 p-3 rounded">
            <div className="text-blue-400 text-lg mb-1">🛡️</div>
            <div className="text-white font-medium">Protection</div>
            <div className="text-gray-400 text-sm">Comprehensive threat prevention</div>
          </div>
          
          <div className="bg-gray-600 p-3 rounded">
            <div className="text-blue-400 text-lg mb-1">🔍</div>
            <div className="text-white font-medium">Detection</div>
            <div className="text-gray-400 text-sm">Advanced threat identification</div>
          </div>
          
          <div className="bg-gray-600 p-3 rounded">
            <div className="text-blue-400 text-lg mb-1">⚡</div>
            <div className="text-white font-medium">Response</div>
            <div className="text-gray-400 text-sm">Rapid incident handling</div>
          </div>
          
          <div className="bg-gray-600 p-3 rounded">
            <div className="text-blue-400 text-lg mb-1">🔄</div>
            <div className="text-white font-medium">Recovery</div>
            <div className="text-gray-400 text-sm">System restoration</div>
          </div>
        </div>
      </div>

      {/* Stats Footer */}
      <div className="bg-gray-700 rounded-lg p-4">
        <div className="grid md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-400">7</div>
            <div className="text-sm text-gray-400">Specialist Agents</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">24/7</div>
            <div className="text-sm text-gray-400">Monitoring</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-400">99.9%</div>
            <div className="text-sm text-gray-400">Uptime</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-400">0</div>
            <div className="text-sm text-gray-400">Security Breaches</div>
          </div>
        </div>
      </div>
    </div>
  );
}