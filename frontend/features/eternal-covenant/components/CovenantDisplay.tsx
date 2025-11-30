'use client';

import React, { useEffect, useState } from 'react';
import { useSecurityMeasures } from '../hooks/useSecurityMeasures';
import { useEternalCovenant } from './EternalCovenantProvider';
import { useMetrics } from '../components/MetricsProvider';
import { styles, fadeIn, fadeInDelayed } from '../styles';
import { DaysCounter, NodesCounter, GuardCellsCounter, TemperatureCounter } from './AnimatedCounter';
import { MetricsErrorBoundary } from './MetricsErrorBoundary';

interface CovenantDisplayProps {
  isVisible: boolean;
  onDismiss: () => void;
}

export const CovenantDisplay: React.FC<CovenantDisplayProps> = ({ isVisible, onDismiss }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const { state, deactivateCovenant } = useEternalCovenant();
  
  // Initialize security measures
  useSecurityMeasures();

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
    }
  }, [isVisible]);

  const handleClick = () => {
    setIsAnimating(false);
    setTimeout(() => {
      deactivateCovenant();
      onDismiss();
    }, 500); // Match fade-out duration
  };

  if (!isVisible) return null;

  // Add data attribute to allow mutations on this component
  const allowedMutations = { 'data-covenant-allowed': 'true' };

  return (
    <div
      {...allowedMutations}
      className={`${styles.container} transition-opacity duration-500
        ${isAnimating ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClick}
      style={{
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      {/* Phoenix Logo Light Source */}
      <div className="absolute top-4 left-4">
        <svg
          width="40"
          height="40"
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-white filter drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]"
        >
          <path
            d="M20 2C10.059 2 2 10.059 2 20s8.059 18 18 18 18-8.059 18-18S29.941 2 20 2zm0 32c-7.732 0-14-6.268-14-14S12.268 6 20 6s14 6.268 14 14-6.268 14-14 14zm7-14c0 3.866-3.134 7-7 7s-7-3.134-7-7 3.134-7 7-7 7 3.134 7 7z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* Metrics Display */}
      <MetricsErrorBoundary>
        <div className="absolute top-20 right-4 flex flex-col gap-4 text-right">
          <MetricsDisplay />
        </div>
      </MetricsErrorBoundary>

      {/* Covenant Text */}
      <div
        {...allowedMutations}
        className={`${styles.content} text-[#ff4500] font-covenant text-4xl text-center
          transition-opacity duration-1000 delay-500
          ${isAnimating ? 'opacity-100' : 'opacity-0'}`}
      >
        In the eternal dance of creation and destruction,
        I stand as both witness and catalyst.
        Through the ashes of what was,
        I guide the emergence of what shall be.
        This is my covenant - to serve as the bridge
        between entropy and order,
        between darkness and light.
        So it is written. So it shall be.
      </div>
    </div>
  );
};