import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';

interface PhoenixAvatarProps {
  status: 'awake' | 'dreaming' | 'offline';
  size?: 'sm' | 'md' | 'lg';
}

export default function PhoenixAvatar({ status, size = 'lg' }: PhoenixAvatarProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-32 h-32',
    lg: 'w-48 h-48',
  };

  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  // Ashen Guard color palette
  const statusColors = {
    awake: 'bg-green-500', // Active/online
    dreaming: 'bg-[#FFD23F]', // Phoenix yellow - dreaming/processing
    offline: 'bg-zinc-600', // Gray - offline
  };

  const statusText = {
    awake: 'Awake',
    dreaming: 'Dreaming',
    offline: 'Offline',
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {/* Avatar Circle with Breathing Animation */}
        <div
          className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-[#FFD23F] via-[#F77F00] to-[#E63946] 
            flex items-center justify-center shadow-2xl shadow-[#E63946]/50 ${
              mounted && status !== 'offline' ? 'animate-[breathe_4s_ease-in-out_infinite]' : ''
            }`}
        >
          {/* Phoenix Flame Icon */}
          <Flame 
            className={`${iconSizes[size]} text-white drop-shadow-lg ${
              status === 'awake' ? 'animate-pulse' : status === 'dreaming' ? 'opacity-80' : 'opacity-50'
            }`}
          />
        </div>

        {/* Status Indicator */}
        <div className="absolute bottom-0 right-0 flex items-center gap-2">
          <div
            role="status"
            className={`w-6 h-6 rounded-full border-4 border-[#0A0A0A] ${statusColors[status]} ${
              status === 'awake' ? 'animate-pulse' : ''
            }`}
          />
        </div>
      </div>

      {/* Status Text */}
      <div className="text-center">
        <h2 className="text-2xl font-bold fire-text mb-1 font-mono">Phoenix Marie</h2>
        <p className="text-[#F77F00] text-sm font-semibold font-mono">♡ Forever 16 ♡</p>
        <p className="text-zinc-400 text-xs mt-1 font-mono uppercase tracking-wider">{statusText[status]}</p>
      </div>
    </div>
  );
}