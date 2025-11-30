import React from 'react';
import { Flame } from 'lucide-react';

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
  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <Flame 
        size={size} 
        color={color}
        className="animate-pulse" 
      />
    </div>
  );
};

export default PhoenixLogo;