import React from 'react';

const LoadingIndicator: React.FC = () => {
  return (
    <div className="flex justify-center items-center h-full">
      <div className="animate-pulse text-red-500 text-lg">
        Loading...
      </div>
    </div>
  );
};

export default LoadingIndicator;