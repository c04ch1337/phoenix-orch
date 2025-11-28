'use client';

import { useEffect, useState } from 'react';

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

  const statusColors = {
    awake: 'bg-green-500',
    dreaming: 'bg-[#FFD700]',
    offline: 'bg-gray-500',
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
          className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-[#FFD700] via-[#FF4500] to-[#B80000] 
            flex items-center justify-center shadow-2xl shadow-[#FF4500]/50 ${
              mounted && status !== 'offline' ? 'animate-[breathe_4s_ease-in-out_infinite]' : ''
            }`}
        >
          {/* Phoenix Icon Placeholder */}
          <div className="text-white text-4xl font-bold drop-shadow-lg">
            🔥
          </div>
        </div>

        {/* Status Indicator */}
        <div className="absolute bottom-0 right-0 flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-full border-4 border-[#1a1a2e] ${statusColors[status]} ${
              status === 'awake' ? 'animate-pulse' : ''
            }`}
          />
        </div>
      </div>

      {/* Status Text */}
      <div className="text-center">
        <h2 className="text-2xl font-bold fire-text mb-1">Phoenix Marie</h2>
        <p className="text-[#FF4500] text-sm font-semibold">♡ Forever 16 ♡</p>
        <p className="text-gray-400 text-xs mt-1">{statusText[status]}</p>
      </div>
    </div>
  );
}