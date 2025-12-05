import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';

/**
 * Login route component
 * Handles user authentication
 */
const LoginRoute: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // Get the "from" parameter that indicates where the user was trying to go
  const from = searchParams.get('from') || '/';
  
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Simple validation
    if (!username || !password) {
      setError('Username and password are required');
      return;
    }
    
    // For demo purposes, just set a mock auth token
    // In a real app, this would call an API endpoint
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwicm9sZSI6ImFkbWluIiwicGVybWlzc2lvbnMiOlsicmVhZCIsIndyaXRlIl0sInNlc3Npb25JZCI6InNlc3Npb24xMjMiLCJleHAiOjE3MTk5OTAwMDB9.aBcDeFgHiJkLmNoPqRsTuVwXyZ';
    
    // Set the auth token in a cookie
    Cookies.set('phoenix_auth_token', mockToken, { 
      expires: 1, // 1 day
      path: '/'
    });
    
    // Set consciousness level to maximum (5)
    const newContext = {
      settings: {
        conscienceLevel: 5
      }
    };
    
    Cookies.set('phoenix_context', JSON.stringify(newContext), { 
      expires: 1, // 1 day
      path: '/'
    });
    
    // Redirect to the original destination
    navigate(from);
  };
  
  return (
    <div className="login-container">
      <h1>Login</h1>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
        </div>
        
        <button type="submit" className="login-button">
          Login
        </button>
      </form>
      
      <div className="login-footer">
        <p>Attempting to access: {from}</p>
      </div>
    </div>
  );
};

export default LoginRoute;