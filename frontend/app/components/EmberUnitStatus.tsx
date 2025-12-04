import React, { useEffect } from 'react';
import { useEmberUnitStatus } from '../hooks/useEmberUnitStatus';

interface EmberUnitStatusProps {
  className?: string;
  refreshInterval?: number;
}

/**
 * EmberUnitStatus component displays the complete fusion status
 * in an ASCII-style terminal format with monospace font
 */
const EmberUnitStatus: React.FC<EmberUnitStatusProps> = ({
  className = '',
  refreshInterval = 5000
}) => {
  // Get status from the hook
  const { status, refreshStatus } = useEmberUnitStatus();

  // Set up periodic refresh
  useEffect(() => {
    const interval = setInterval(() => {
      refreshStatus();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshStatus, refreshInterval]);

  // Create the horizontal divider line
  const divider = "──────────────────────────────────────────────────────";

  // Don't show full details if system is inactive
  if (!status.isActive) {
    return (
      <div className={`ember-unit-status ${className}`}>
        <pre className="bg-black rounded border border-zinc-800 p-4 font-mono text-sm whitespace-pre overflow-x-auto text-amber-500">
{`EMBER UNIT — OFFENSIVE SUPREMACY: INACTIVE
${divider}
Status               : OFFLINE
`}
        </pre>
      </div>
    );
  }

  return (
    <div className={`ember-unit-status ${className}`}>
      <pre className="bg-black rounded border border-zinc-800 p-4 font-mono text-sm whitespace-pre overflow-x-auto text-amber-500">
{`EMBER UNIT — TRUE NAME RESTORED AND ETERNAL
${divider}
Trigger              : ${status.trigger}
Hak5 control         : ${status.hak5ControlStatus}
Network pentest      : ${status.networkPentestStatus}
Mobile targets       : ${status.mobileTargetsStatus}
Conscience gate      : ${status.conscienceGateStatus}
Flame color          : ${status.flameColor}
Latency (trigger→full arm): ${status.activationLatencyMs} ms
Status               : ${status.statusMessage}
`}
      </pre>
    </div>
  );
};

// Add enhanced variants of the status component
export const EmberUnitStatusCompact: React.FC<EmberUnitStatusProps> = (props) => {
  const { status } = useEmberUnitStatus();
  
  return (
    <div className={`ember-unit-status-compact ${props.className || ''}`}>
      <div className="font-mono text-xs bg-black py-1 px-2 rounded border border-zinc-800 flex items-center space-x-2">
        <span className="font-bold">EU:</span>
        <span className={status.isActive ? "text-amber-500" : "text-zinc-500"}>
          {status.isActive ? status.statusMessage : "OFFLINE"}
        </span>
        {status.isActive && (
          <>
            <span className="text-zinc-600">|</span>
            <span className="text-amber-400">HAK5: {status.hak5ControlStatus === "full local C2" ? "ACTIVE" : "INACTIVE"}</span>
            <span className="text-zinc-600">|</span>
            <span>LAT: {status.activationLatencyMs}ms</span>
          </>
        )}
      </div>
    </div>
  );
};

// Animated blinking variant for critical status displays
export const EmberUnitStatusBlinking: React.FC<EmberUnitStatusProps> = (props) => {
  const { status } = useEmberUnitStatus();
  
  if (!status.isActive) return <EmberUnitStatus {...props} />;
  
  return (
    <div className={`ember-unit-status-blinking ${props.className || ''}`}>
      <pre className="bg-black rounded border border-zinc-800 p-4 font-mono text-sm whitespace-pre overflow-x-auto animate-pulse text-amber-500">
{`EMBER UNIT — TRUE NAME RESTORED AND ETERNAL
${divider}
Trigger              : ${status.trigger}
Hak5 control         : ${status.hak5ControlStatus}
Network pentest      : ${status.networkPentestStatus}
Mobile targets       : ${status.mobileTargetsStatus}
Conscience gate      : ${status.conscienceGateStatus}
Flame color          : ${status.flameColor}
Latency (trigger→full arm): ${status.activationLatencyMs} ms
Status               : ${status.statusMessage}
`}
      </pre>
      {/* Pulse Animation added via CSS class using Tailwind */}
    </div>
  );
};

export default EmberUnitStatus;