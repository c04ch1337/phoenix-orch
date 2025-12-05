'use client';

import React, { useState, useEffect, memo } from 'react';
import { Flame } from 'lucide-react';

interface SplashPageProps {
  onIgnite: () => void;
}

// CSS for optimized animations
const flameStyles = {
  pulse: {
    animation: 'none',
    transition: 'transform 1s ease-in-out',
    transform: 'scale(1)',
    willChange: 'transform',
  },
  pulseActive: {
    transform: 'scale(1.1)',
  },
  spin: {
    animation: 'none',
    transition: 'transform 0.7s ease-in-out',
    transform: 'rotate(0deg)',
    transformOrigin: 'center',
    willChange: 'transform',
  },
  spinActive: {
    transform: 'rotate(360deg)',
  },
  container: {
    contain: 'layout style paint',
  }
};

// Optimize rendering with memoization
export const SplashPage = memo(({ onIgnite }: SplashPageProps) => {
  const [isIgniting, setIsIgniting] = useState(false);
  const [pulsePhase, setPulsePhase] = useState(false);
  
  // Use requestAnimationFrame for smoother animation
  useEffect(() => {
    if (isIgniting) {
      let frameId: number;
      let intervalId: number;
      
      // Smoother pulse animation using CSS transitions
      intervalId = setInterval(() => {
        setPulsePhase(prev => !prev);
      }, 1000);
      
      // Use RAF for timing the transition
      const startTime = performance.now();
      const animate = (time: number) => {
        if (time - startTime < 2000) {
          frameId = requestAnimationFrame(animate);
        } else {
          onIgnite();
        }
      };
      
      frameId = requestAnimationFrame(animate);
      
      // Cleanup
      return () => {
        cancelAnimationFrame(frameId);
        clearInterval(intervalId);
      };
    }
  }, [isIgniting, onIgnite]);

  const handleIgnite = () => {
    setIsIgniting(true);
    // The actual transition is handled in the useEffect
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center min-h-screen bg-black text-white font-mono" style={flameStyles.container}>
      <div className="text-center" style={{ contain: 'content' }}>
        <div style={{
          ...flameStyles.pulse,
          ...(pulsePhase && isIgniting ? flameStyles.pulseActive : {})
        }}>
          <Flame className="w-24 h-24 mx-auto mb-8 text-red-600" />
        </div>
        <h1 className="text-7xl font-bold mb-2" style={{ containIntrinsicSize: '0 90px' }}>
          <span className="text-white">PHOENIX</span>{' '}
          <span className="text-red-600">ORCH</span>
        </h1>
        <p className="text-lg text-zinc-400 tracking-widest mb-12" style={{ containIntrinsicSize: '0 30px' }}>
          THE ASHEN GUARD EDITION
        </p>
        <button
          onClick={handleIgnite}
          disabled={isIgniting}
          className={`px-12 py-4 border border-red-700 text-red-600 text-xl uppercase tracking-wider
                    hover:bg-red-700 hover:text-white transition-colors duration-300
                    flex items-center justify-center mx-auto space-x-4
                    ${isIgniting ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{ contain: 'layout paint' }}
        >
          <div style={{
            ...flameStyles.spin,
            ...(isIgniting ? flameStyles.spinActive : {})
          }}>
            <Flame className="w-6 h-6" />
          </div>
          <span>{isIgniting ? 'IGNITING SYSTEM...' : 'IGNITE SYSTEM'}</span>
        </button>
      </div>
    </div>
  );
});

// Add display name for debugging
SplashPage.displayName = 'SplashPage';