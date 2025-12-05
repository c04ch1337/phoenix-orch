import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Cipher route component
 * Protected route for Cipher Guard functionality
 */
const CipherRoute: React.FC = () => {
  return (
    <div className="page-container">
      <h1>Cipher Guard</h1>
      <p>Welcome to Cipher Guard security platform.</p>
      
      <div className="content-section">
        <h2>Security Features</h2>
        <ul>
          <li>
            <Link to="/features/cipher-guard">Cipher Guard Dashboard</Link>
          </li>
          <li>
            <Link to="/cipher/security">Advanced Security Controls</Link>
          </li>
        </ul>
      </div>
      
      <div className="cipher-dashboard">
        <div className="cipher-stats">
          <div className="stat-card">
            <h3>Security Status</h3>
            <p className="status-active">Active</p>
          </div>
          
          <div className="stat-card">
            <h3>Encryption</h3>
            <p className="status-secure">Secure</p>
          </div>
          
          <div className="stat-card">
            <h3>Threats Blocked</h3>
            <p>147</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CipherRoute;