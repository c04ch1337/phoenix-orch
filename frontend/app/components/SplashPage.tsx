import React from 'react';
import { Flame } from 'lucide-react';

interface SplashPageProps {
  onIgnite: () => void;
}

export const SplashPage: React.FC<SplashPageProps> = ({ onIgnite }) => {
  return (
    <div className="h-screen w-screen bg-black flex flex-col items-center justify-center">
      <div className="w-32 h-32 relative mb-8">
        <Flame className="w-32 h-32 text-red-600 animate-pulse" />
      </div>
      
      <h1 className="text-4xl font-bold text-red-600 mb-6">PHOENIX ORCH</h1>
      <p className="text-zinc-500 text-xl mb-12">THE ASHEN GUARD</p>
      
      <button
        onClick={onIgnite}
        className="bg-red-700 hover:bg-red-600 text-white px-8 py-3 rounded-sm transition-colors duration-300 focus:outline-none"
      >
        IGNITE
      </button>
      
      <p className="mt-12 text-zinc-600 text-xs">
        VER 0.8.42 // CLASSIFIED // AUTHORIZED ACCESS ONLY
      </p>
    </div>
  );
};

export default SplashPage;