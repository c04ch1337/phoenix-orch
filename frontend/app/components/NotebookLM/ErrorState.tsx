"use client";

import React from 'react';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

/**
 * ErrorState Component
 * 
 * Reusable error display with optional retry action.
 */
const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  return (
    <div className="p-6 text-center border rounded-lg bg-red-50 border-red-100">
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="w-12 h-12 mx-auto text-red-500 mb-4" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
        />
      </svg>
      
      <h3 className="font-bold text-lg text-red-700 mb-2">Error</h3>
      <p className="text-red-600 mb-4">{message}</p>
      
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
};

export default ErrorState;