import React from 'react';
import { motion } from 'framer-motion';

interface SystemStatusProps {
  status: string;
}

const statusConfig = {
  operational: {
    color: 'bg-green-500',
    pulseColor: 'bg-green-500',
    text: 'System Operational',
    description: 'All systems functioning normally',
  },
  degraded: {
    color: 'bg-yellow-500',
    pulseColor: 'bg-yellow-500',
    text: 'Degraded Performance',
    description: 'Some systems experiencing issues',
  },
  critical: {
    color: 'bg-red-500',
    pulseColor: 'bg-red-500',
    text: 'Critical Alert',
    description: 'Immediate attention required',
  },
  maintenance: {
    color: 'bg-blue-500',
    pulseColor: 'bg-blue-500',
    text: 'Maintenance Mode',
    description: 'Scheduled maintenance in progress',
  },
};

const PulseIndicator: React.FC<{ color: string }> = ({ color }) => (
  <div className="relative flex h-3 w-3">
    <motion.span
      initial={{ opacity: 0.5, scale: 1 }}
      animate={{ opacity: 0, scale: 2 }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeOut",
      }}
      style={{ backgroundColor: color }}
      className="absolute inline-flex h-full w-full rounded-full opacity-75"
    />
    <motion.span
      initial={{ opacity: 0.5, scale: 1 }}
      animate={{ opacity: 0, scale: 2 }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeOut",
        delay: 0.5,
      }}
      style={{ backgroundColor: color }}
      className="absolute inline-flex h-full w-full rounded-full opacity-75"
    />
    <span
      style={{ backgroundColor: color }}
      className="relative inline-flex rounded-full h-3 w-3"
    />
  </div>
);

export const SystemStatus: React.FC<SystemStatusProps> = ({ status }) => {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.operational;
  const rgbColor = config.color.replace('bg-', '').split('-')[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center space-x-4 px-4 py-2 rounded-lg bg-gray-800">
        <PulseIndicator color={`var(--${rgbColor}-500)`} />
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-medium text-white">{config.text}</span>
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [1, 0.7, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <div className={`h-2 w-2 rounded-full ${config.color}`} />
            </motion.div>
          </div>
          <p className="text-sm text-gray-400">{config.description}</p>
        </div>
      </div>
    </motion.div>
  );
};

// CSS Variables for colors (add to your global CSS)
const cssVariables = `
:root {
  --green-500: #10B981;
  --yellow-500: #EAB308;
  --red-500: #EF4444;
  --blue-500: #3B82F6;
}
`;