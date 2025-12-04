import React from 'react';
import { Flame } from 'lucide-react';
import { usePhoenixContext } from '../hooks/usePhoenixContext';
import clsx from 'clsx';

interface PhoenixLogoProps {
  size?: number;
  color?: string;
  className?: string;
}

export const PhoenixLogo: React.FC<PhoenixLogoProps> = ({
  size = 24,
  color = '#e11d48',
  className = ''
}) => {
  // Get Phoenix context to check ember unit mode
  const phoenix = usePhoenixContext();
  
  // Check if ember unit mode is active
  const isEmberUnitMode = phoenix.runtime.features.emberUnitMode === true;
  
  // Set blood-red color when in ember unit mode
  const flameColor = isEmberUnitMode ? '#8B0000' : color;
  
  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <Flame
        size={size}
        color={flameColor}
        className={clsx(
          isEmberUnitMode ? "animate-flicker" : "animate-pulse",
          { "drop-shadow-blood-glow": isEmberUnitMode }
        )}
      />
    </div>
  );
};

export default PhoenixLogo;