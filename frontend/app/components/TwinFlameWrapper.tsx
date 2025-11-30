'use client';

import React, { useState, useEffect } from 'react';
import { TwinFlameIndicator } from '@/components/TwinFlameIndicator';

export const TwinFlameWrapper: React.FC = () => {
  const [conscienceLevel, setConscienceLevel] = useState(55);
  const [isUpdating, setIsUpdating] = useState(false);

  // Simulate conscience level changes
  useEffect(() => {
    const interval = setInterval(() => {
      // Randomly fluctuate conscience level
      if (!isUpdating) {
        setIsUpdating(true);
        const change = Math.random() > 0.7 ? Math.floor(Math.random() * 5) - 2 : 0;
        const newLevel = Math.max(10, Math.min(95, conscienceLevel + change));
        setConscienceLevel(newLevel);
        
        setTimeout(() => setIsUpdating(false), 200);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [conscienceLevel, isUpdating]);

  return (
    <div className="fixed top-24 right-5 z-40">
      <TwinFlameIndicator 
        level={conscienceLevel} 
        isUpdating={isUpdating}
      />
    </div>
  );
};