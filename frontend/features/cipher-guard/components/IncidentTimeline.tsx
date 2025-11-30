import React from 'react';
import { motion } from 'framer-motion';

interface Incident {
  id: string;
  threat: {
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    timestamp: string;
    source: string;
  };
  status: string;
  actions_taken: string[];
  evidence: Array<{
    id: string;
    data_type: string;
    content: string;
    timestamp: string;
  }>;
  timestamp: string;
}

interface IncidentTimelineProps {
  incidents: Incident[];
}

const statusColors = {
  analyzing: 'bg-blue-500',
  contained: 'bg-yellow-500',
  mitigated: 'bg-green-500',
  resolved: 'bg-gray-500',
};

const TimelineItem: React.FC<{ incident: Incident; isLast: boolean }> = ({ incident, isLast }) => {
  const formattedTime = new Date(incident.timestamp).toLocaleTimeString();
  const statusColor = statusColors[incident.status as keyof typeof statusColors] || 'bg-gray-500';

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="relative pb-8"
    >
      {/* Timeline Line */}
      {!isLast && (
        <div
          className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-700"
          aria-hidden="true"
        />
      )}

      <div className="relative flex items-start space-x-3">
        {/* Status Dot */}
        <div className="relative">
          <div className={`
            h-8 w-8 rounded-full ${statusColor} flex items-center justify-center
            ring-4 ring-gray-900
          `}>
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="bg-gray-800 rounded-lg p-4 shadow">
            {/* Header */}
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm font-medium text-gray-200">
                {incident.threat.description}
              </div>
              <div className="text-xs text-gray-400">
                {formattedTime}
              </div>
            </div>

            {/* Status and Source */}
            <div className="flex items-center space-x-2 mb-2">
              <span className={`
                px-2 py-1 text-xs rounded-full
                ${statusColor} bg-opacity-20 text-white
              `}>
                {incident.status}
              </span>
              <span className="text-xs text-gray-400">
                from {incident.threat.source}
              </span>
            </div>

            {/* Actions Taken */}
            {incident.actions_taken.length > 0 && (
              <div className="mt-2">
                <h4 className="text-xs font-medium text-gray-400 mb-1">
                  Actions Taken:
                </h4>
                <ul className="space-y-1">
                  {incident.actions_taken.map((action, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className="text-xs text-gray-300 flex items-center space-x-2"
                    >
                      <svg
                        className="h-3 w-3 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span>{action}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            {/* Evidence Count */}
            {incident.evidence.length > 0 && (
              <div className="mt-2 flex items-center space-x-2 text-xs text-gray-400">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>{incident.evidence.length} pieces of evidence collected</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const IncidentTimeline: React.FC<IncidentTimelineProps> = ({ incidents }) => {
  const sortedIncidents = [...incidents].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="flow-root">
      <ul className="space-y-4">
        {sortedIncidents.map((incident, index) => (
          <li key={incident.id}>
            <TimelineItem
              incident={incident}
              isLast={index === sortedIncidents.length - 1}
            />
          </li>
        ))}
      </ul>
    </div>
  );
};