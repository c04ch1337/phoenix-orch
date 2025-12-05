import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Ember route component
 * Protected route for Ember Unit functionality
 */
const EmberRoute: React.FC = () => {
  return (
    <div className="page-container">
      <h1>Ember Unit</h1>
      <p>Welcome to the Ember Unit control platform.</p>
      
      <div className="content-section">
        <h2>Ember Features</h2>
        <ul>
          <li>
            <Link to="/features/ember-unit">Ember Unit Dashboard</Link>
          </li>
          <li>
            <Link to="/ember/core">Core Operations</Link>
          </li>
        </ul>
      </div>
      
      <div className="ember-dashboard">
        <div className="ember-stats">
          <div className="stat-card">
            <h3>Unit Status</h3>
            <p className="status-active">Active</p>
          </div>
          
          <div className="stat-card">
            <h3>Deployments</h3>
            <p>12</p>
          </div>
          
          <div className="stat-card">
            <h3>Success Rate</h3>
            <p>98.7%</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmberRoute;