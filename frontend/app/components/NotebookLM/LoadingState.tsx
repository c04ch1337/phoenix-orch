"use client";

import React from 'react';

interface LoadingStateProps {
  message?: string;
}

/**
 * LoadingState Component
 * 
 * Reusable loading indicator with optional custom message.
 */
const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading...' }) => {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
      <p className="text-gray-600">{message}</p>
    </div>
  );
};

export default LoadingState;