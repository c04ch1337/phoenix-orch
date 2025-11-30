import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Incident {
  id: string;
  threat: {
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
  };
  status: string;
  actions_taken: string[];
}

interface ResponseActionsProps {
  incidents: Incident[];
  onExecute: (incidentId: string, action: string) => Promise<void>;
}

const availableActions = {
  containment: [
    { id: 'isolate', label: 'Network Isolation', icon: '🔒' },
    { id: 'block', label: 'Block Traffic', icon: '🚫' },
    { id: 'suspend', label: 'Suspend Process', icon: '⏸️' },
  ],
  mitigation: [
    { id: 'patch', label: 'Apply Patch', icon: '🔧' },
    { id: 'update', label: 'Update Signatures', icon: '🔄' },
    { id: 'scan', label: 'Deep Scan', icon: '🔍' },
  ],
  recovery: [
    { id: 'restore', label: 'Restore Backup', icon: '📦' },
    { id: 'reset', label: 'Reset State', icon: '🔄' },
    { id: 'verify', label: 'Verify Integrity', icon: '✅' },
  ],
};

export const ResponseActions: React.FC<ResponseActionsProps> = ({
  incidents,
  onExecute,
}) => {
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const handleExecute = async (incidentId: string, action: string) => {
    setIsExecuting(true);
    try {
      await onExecute(incidentId, action);
      setSelectedAction(null);
    } catch (error) {
      console.error('Failed to execute action:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const activeIncidents = incidents.filter(
    incident => incident.status !== 'resolved'
  );

  return (
    <div className="space-y-4">
      {/* Incident Selector */}
      {activeIncidents.length > 0 ? (
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Select Incident</label>
          <select
            value={selectedIncident || ''}
            onChange={(e) => setSelectedIncident(e.target.value)}
            className="w-full bg-gray-700 text-white rounded-md px-3 py-2 text-sm"
          >
            <option value="">Select an incident...</option>
            {activeIncidents.map((incident) => (
              <option key={incident.id} value={incident.id}>
                {incident.threat.description}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="text-center py-4 text-gray-500">
          No active incidents
        </div>
      )}

      {/* Action Categories */}
      <AnimatePresence mode="wait">
        {selectedIncident && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            {Object.entries(availableActions).map(([category, actions]) => (
              <div key={category} className="space-y-2">
                <h3 className="text-sm font-medium text-gray-300 capitalize">
                  {category} Actions
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {actions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleExecute(selectedIncident, action.id)}
                      disabled={isExecuting || selectedAction === action.id}
                      className={`
                        flex items-center space-x-2 w-full px-3 py-2 rounded-md
                        text-sm font-medium transition-colors duration-150
                        ${
                          isExecuting && selectedAction === action.id
                            ? 'bg-blue-500/50 text-white cursor-wait'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                        }
                      `}
                    >
                      <span className="text-lg">{action.icon}</span>
                      <span>{action.label}</span>
                      {isExecuting && selectedAction === action.id && (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                          className="ml-auto"
                        >
                          ⚡
                        </motion.div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action History */}
      {selectedIncident && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">
            Action History
          </h3>
          <div className="bg-gray-700 rounded-md p-2 max-h-32 overflow-y-auto">
            {incidents
              .find((i) => i.id === selectedIncident)
              ?.actions_taken.map((action, index) => (
                <div
                  key={index}
                  className="text-sm text-gray-300 py-1 border-b border-gray-600 last:border-0"
                >
                  {action}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};