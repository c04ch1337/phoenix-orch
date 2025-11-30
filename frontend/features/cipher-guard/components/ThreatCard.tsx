import React from 'react';
import { Eye, Shield, Mic } from 'lucide-react';
import { motion } from 'framer-motion';

export interface Threat {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  timestamp: string;
  source: string;
}

interface ThreatCardProps {
  threat: Threat;
  onViewDetails?: (threatId: string) => void;
  onTakeAction?: (threatId: string) => void;
}

const severityColors = {
  critical: 'bg-red-600',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
};

const severityGlow = {
  critical: 'shadow-red-600/70 shadow-lg',
  high: 'shadow-orange-500/50 shadow-lg',
  medium: 'shadow-yellow-500/30',
  low: 'shadow-blue-500/20',
};

const severityBorder = {
  critical: 'border-red-600',
  high: 'border-orange-500',
  medium: 'border-yellow-500',
  low: 'border-blue-500',
};

export const ThreatCard = ({ threat, onViewDetails, onTakeAction }: ThreatCardProps) => {
  const formatTime = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleTimeString();
    } catch {
      return 'Unknown';
    }
  };

  const formattedTime = formatTime(threat.timestamp);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      {...({
        className: `
          relative rounded-lg p-4 bg-zinc-900 border-2 ${severityBorder[threat.severity]}
          ${severityGlow[threat.severity]} hover:shadow-xl
          transition-all duration-300 group
        `
      } as any)}
    >
      {/* Severity Indicator */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className={`
            w-3 h-3 rounded-full ${severityColors[threat.severity]}
            ${threat.severity === 'critical' ? 'animate-pulse' : ''}
            shadow-lg
          `} />
          <span className={`text-sm font-bold font-mono uppercase tracking-wider ${
            threat.severity === 'critical' ? 'text-red-500' :
            threat.severity === 'high' ? 'text-orange-500' :
            threat.severity === 'medium' ? 'text-yellow-500' : 'text-blue-500'
          }`}>
            {threat.severity}
          </span>
        </div>
        <span className="text-xs text-zinc-500 font-mono">
          {formattedTime}
        </span>
      </div>

      {/* Threat Description */}
      <p className="text-sm text-zinc-200 mb-3 font-rajdhani leading-relaxed">
        {threat.description}
      </p>

      {/* Source Information */}
      <div className="flex items-center justify-between text-xs pt-3 border-t border-zinc-700">
        <div className="flex items-center space-x-2">
          <Mic className="w-4 h-4 text-zinc-500" />
          <span className="text-zinc-400 font-mono">{threat.source}</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onViewDetails?.(threat.id)}
            className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors duration-200"
            title="View Details"
            aria-label="View threat details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onTakeAction?.(threat.id)}
            className={`p-1.5 rounded transition-colors duration-200 ${
              threat.severity === 'critical' || threat.severity === 'high'
                ? 'bg-red-600/20 hover:bg-red-600/30 text-red-500 hover:text-red-400'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white'
            }`}
            title="Take Action"
            aria-label="Take action on threat"
          >
            <Shield className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar for Critical/High Threats */}
      {(threat.severity === 'critical' || threat.severity === 'high') && (
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5 }}
          {...({
            className: `
              absolute bottom-0 left-0 h-1 rounded-b-lg
              ${severityColors[threat.severity]}
              ${threat.severity === 'critical' ? 'animate-pulse' : ''}
              opacity-80
            `,
            style: { width: '100%' }
          } as any)}
        />
      )}
    </motion.div>
  );
};