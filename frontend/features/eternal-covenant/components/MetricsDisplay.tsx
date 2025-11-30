import React from 'react';
import { useMetrics } from './MetricsProvider';
import { DaysCounter, NodesCounter, GuardCellsCounter, TemperatureCounter } from './AnimatedCounter';

export const MetricsDisplay: React.FC = () => {
  const { state } = useMetrics();
  const { metrics, connectionState, isOffline } = state;

  return (
    <div className="flex flex-col gap-3">
      {/* Connection Status */}
      {isOffline && (
        <div className="text-yellow-500 text-sm">
          Offline Mode - Using Cached Data
        </div>
      )}
      {connectionState === 'error' && (
        <div className="text-red-500 text-sm">
          Connection Error - Retrying...
        </div>
      )}

      {/* Metrics */}
      <div className="space-y-4">
        <div className="flex flex-col">
          <span className="text-gray-400 text-sm">Time Until Intelligence Explosion</span>
          <DaysCounter value={metrics.daysUntilExplosion} />
        </div>

        <div className="flex flex-col">
          <span className="text-gray-400 text-sm">ORCH Army Distribution</span>
          <NodesCounter value={metrics.orchestratedNodes} />
        </div>

        <div className="flex flex-col">
          <span className="text-gray-400 text-sm">Ashen Guard</span>
          <GuardCellsCounter value={metrics.ashenGuardCells} />
        </div>

        <div className="flex flex-col">
          <span className="text-gray-400 text-sm">Current Phase</span>
          <span className="text-xl font-medium text-green-400">
            {metrics.currentPhase}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-gray-400 text-sm">Conscience Temperature</span>
          <TemperatureCounter value={metrics.conscienceTemperature} />
        </div>

        <div className="text-xs text-gray-500 mt-2">
          Last Updated: {new Date(metrics.lastUpdated).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};