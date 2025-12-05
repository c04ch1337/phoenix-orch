import React from 'react';

/**
 * Home route component
 * Main landing page for the application
 */
const HomeRoute: React.FC = () => {
  return (
    <div className="page-container">
      <h1>Phoenix Orchestrator</h1>
      <p>Welcome to the Phoenix Orchestrator platform.</p>
      
      <div className="feature-grid">
        <div className="feature-card">
          <h2>Forge</h2>
          <p>Access the Forge feature.</p>
          <a href="/features/forge" className="feature-link">Open Forge</a>
        </div>
        
        <div className="feature-card">
          <h2>System</h2>
          <p>Monitor system resources and status.</p>
          <a href="/features/system" className="feature-link">System Dashboard</a>
        </div>
        
        <div className="feature-card">
          <h2>Subconscious</h2>
          <p>Access the Subconscious features.</p>
          <a href="/features/subconscious" className="feature-link">Open Subconscious</a>
        </div>
      </div>
    </div>
  );
};

export default HomeRoute;