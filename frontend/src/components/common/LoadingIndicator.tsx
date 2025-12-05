import React from 'react';

/**
 * Loading Indicator component
 * Displays a spinner while content is loading
 */
const LoadingIndicator: React.FC = () => {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p className="loading-text">Loading...</p>
    </div>
  );
};

export default LoadingIndicator;