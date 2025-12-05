import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';

/**
 * Human In The Middle (HITM) verification page
 * This route replaces the middleware redirect for consciousness verification
 */
const HITMRoute: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verificationComplete, setVerificationComplete] = useState(false);
  
  // Get the intended destination and current consciousness level from URL parameters
  const destinationPath = searchParams.get('from') || '/';
  const currentLevel = parseInt(searchParams.get('level') || '0', 10);
  
  // Handle verification process - use useCallback to prevent recreation on every render
  const handleVerification = useCallback(() => {
    // Update consciousness level in cookie
    try {
      const contextCookie = Cookies.get('phoenix_context');
      if (contextCookie) {
        const phoenixContext = JSON.parse(contextCookie);
        
        // Set consciousness to maximum level (5)
        if (phoenixContext.settings) {
          phoenixContext.settings.conscienceLevel = 5;
          
          // Update the cookie
          Cookies.set('phoenix_context', JSON.stringify(phoenixContext), { 
            expires: 1, // 1 day
            path: '/'
          });
          
          // Mark verification as complete
          setVerificationComplete(true);
          
          // Redirect back to the intended destination after a brief delay
          setTimeout(() => {
            navigate(destinationPath);
          }, 1500);
        }
      } else {
        // No existing context cookie, create a new one
        const newContext = {
          settings: {
            conscienceLevel: 5
          }
        };
        
        // Set the cookie
        Cookies.set('phoenix_context', JSON.stringify(newContext), { 
          expires: 1, // 1 day
          path: '/'
        });
        
        setVerificationComplete(true);
        setTimeout(() => {
          navigate(destinationPath);
        }, 1500);
      }
    } catch (error) {
      console.error('Error updating consciousness level:', error);
    }
  }, [destinationPath, navigate]);
  
  useEffect(() => {
    // Auto-trigger verification if user isn't involved
    // In a real app, this would likely involve actual user interaction
    handleVerification();
  }, [handleVerification]);
  
  return (
    <div className="hitm-container">
      <h1>Human Verification Required</h1>
      <p>Current consciousness level: {currentLevel}/5</p>
      <p>Accessing this section requires higher consciousness levels.</p>
      
      {verificationComplete ? (
        <div className="verification-complete">
          <p>Verification complete. Redirecting...</p>
          <div className="loading-spinner"></div>
        </div>
      ) : (
        <button 
          onClick={handleVerification}
          className="verify-button"
        >
          Verify Human Presence
        </button>
      )}
    </div>
  );
};

export default HITMRoute;