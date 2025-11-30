'use client';

import React, { useState } from 'react';
import { Flame } from 'lucide-react';

interface SplashPageProps {
  onIgnite: () => void;
}

export function SplashPage({ onIgnite }: SplashPageProps) {
  const [isIgniting, setIsIgniting] = useState(false);

  const handleIgnite = () => {
    setIsIgniting(true);
    setTimeout(() => {
      onIgnite();
    }, 2000); // Simulate ignition sequence
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center min-h-screen bg-black text-white font-mono">
      <div className="text-center">
        <Flame className={`w-24 h-24 mx-auto mb-8 text-red-600 ${isIgniting ? 'animate-pulse' : ''}`} />
        <h1 className="text-7xl font-bold mb-2">
          <span className="text-white">PHOENIX</span>{' '}
          <span className="text-red-600">ORCH</span>
        </h1>
        <p className="text-lg text-zinc-400 tracking-widest mb-12">
          THE ASHEN GUARD EDITION
        </p>
        <button
          onClick={handleIgnite}
          disabled={isIgniting}
          className={`px-12 py-4 border border-red-700 text-red-600 text-xl uppercase tracking-wider
                    hover:bg-red-700 hover:text-white transition-colors duration-300
                    flex items-center justify-center mx-auto space-x-4
                    ${isIgniting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Flame className={`w-6 h-6 ${isIgniting ? 'animate-spin' : ''}`} />
          <span>{isIgniting ? 'IGNITING SYSTEM...' : 'IGNITE SYSTEM'}</span>
        </button>
      </div>
    </div>
  );
}