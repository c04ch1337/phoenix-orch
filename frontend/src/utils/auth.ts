import Cookies from 'js-cookie';

// Types for authentication context
export interface AuthContext {
  userId: string;
  role: string;
  permissions: string[];
  sessionId: string;
  isValid: boolean;
  expiry: number;
}

/**
 * Create a default auth context for unauthenticated users
 */
export function createDefaultAuth(): AuthContext {
  return {
    userId: '',
    role: '',
    permissions: [],
    sessionId: '',
    isValid: false,
    expiry: 0
  };
}

/**
 * Extract authentication data from cookies or localStorage
 * This replaces the server-side middleware functionality
 */
export function getAuthContext(): AuthContext {
  try {
    // Try to get from cookie first
    const token = Cookies.get('phoenix_auth_token');
    if (!token) return createDefaultAuth();
    
    // Decode the JWT token
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('Invalid token format: token does not have 3 parts');
      return createDefaultAuth();
    }

    // Decode the base64-encoded payload
    const payload = parts[1];
    // Handle base64 padding issues by adding missing padding
    const paddedPayload = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');
    const decodedPayload = atob(paddedPayload);
    const decodedToken = JSON.parse(decodedPayload);
    
    // Check token expiration
    const now = Math.floor(Date.now() / 1000);
    if (decodedToken.exp && decodedToken.exp < now) {
      console.warn('Token expired');
      return createDefaultAuth();
    }
    
    return {
      userId: decodedToken.sub || '',
      role: decodedToken.role || '',
      permissions: decodedToken.permissions || [],
      sessionId: decodedToken.sessionId || decodedToken.jti || '',
      isValid: true,
      expiry: decodedToken.exp || 0
    };
  } catch (error) {
    console.error('Token validation error:', error);
    return createDefaultAuth();
  }
}

/**
 * Check if user's token is about to expire and needs refresh
 */
export function needsTokenRefresh(auth: AuthContext): boolean {
  if (!auth.isValid) return false;
  
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = auth.expiry - nowInSeconds;
  
  // Refresh if token expires in less than 5 minutes
  return timeUntilExpiry < 300;
}