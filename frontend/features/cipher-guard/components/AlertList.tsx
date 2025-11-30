import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Alert {
  id: string;
  severity: string;
  message: string;
  timestamp: string;
  source: string;
}

interface AlertListProps {
  alerts: Alert[];
}

const severityIcons = {
  critical: (
    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  high: (
    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  medium: (
    <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  low: (
    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const severityStyles = {
  critical: 'bg-red-500/10 border-red-500/50 text-red-500',
  high: 'bg-orange-500/10 border-orange-500/50 text-orange-500',
  medium: 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500',
  low: 'bg-blue-500/10 border-blue-500/50 text-blue-500',
};

const AlertItem: React.FC<{ alert: Alert }> = ({ alert }) => {
  const formattedTime = new Date(alert.timestamp).toLocaleTimeString();
  const severityStyle = severityStyles[alert.severity as keyof typeof severityStyles] || severityStyles.low;
  const icon = severityIcons[alert.severity as keyof typeof severityIcons] || severityIcons.low;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className={`
          relative rounded-lg border px-4 py-3 mb-3
          ${severityStyle}
        `}
      >
        <div className="flex items-start">
          <div className="flex-shrink-0">{icon}</div>
          <div className="ml-3 w-0 flex-1">
            <div className="text-sm font-medium">{alert.message}</div>
            <div className="mt-1 flex items-center space-x-2 text-xs">
              <span>{alert.source}</span>
              <span>•</span>
              <span>{formattedTime}</span>
            </div>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              type="button"
              className="rounded-md inline-flex text-gray-400 hover:text-gray-300 focus:outline-none"
            >
              <span className="sr-only">Close</span>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const AlertList: React.FC<AlertListProps> = ({ alerts }) => {
  const sortedAlerts = [...alerts].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
      <AnimatePresence initial={false}>
        {sortedAlerts.map((alert) => (
          <AlertItem key={alert.id} alert={alert} />
        ))}
      </AnimatePresence>
      {sortedAlerts.length === 0 && (
        <div className="text-center py-4 text-gray-500">
          No active alerts
        </div>
      )}
    </div>
  );
};