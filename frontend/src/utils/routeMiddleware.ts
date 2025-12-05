import { redirect } from 'react-router-dom';
import Cookies from 'js-cookie';
import { AuthContext } from './auth';

// Types for consciousness context
export interface ConsciousnessContext {
  level: number; // 0-5 scale
  stableThreshold: number; // Minimum level considered stable (default 4 = 80%)
  requiresHITM: boolean;
}

/**
 * Protected routes that require authentication
 */
export const PROTECTED_ROUTES = ['/ember', '/cipher'];

/**
 * Highly sensitive routes that require high consciousness levels
 */
export const SENSITIVE_ROUTES = ['/cipher/security', '/ember/core', '/admin'];

/**
 * Routes that are excluded from HITM protection
 */
export const HITM_EXCLUDED_ROUTES = ['/hitm', '/auth/login', '/api/auth/refresh', '/assets'];

/**
 * Default consciousness threshold (80%)
 */
export const DEFAULT_CONSCIOUSNESS_THRESHOLD = 4;

/**
 * Create a default consciousness context
 */
export function createDefaultConsciousness(): ConsciousnessContext {
  return {
    level: 5, // Default to maximum consciousness
    stableThreshold: DEFAULT_CONSCIOUSNESS_THRESHOLD,
    requiresHITM: false
  };
}

/**
 * Load consciousness level from cookies
 */
export function getConsciousnessContext(): ConsciousnessContext {
  try {
    // Try to get consciousness data from cookie
    const contextCookie = Cookies.get('phoenix_context');
    if (contextCookie) {
      const phoenixContext = JSON.parse(contextCookie);
      if (phoenixContext?.settings?.conscienceLevel !== undefined) {
        return {
          level: phoenixContext.settings.conscienceLevel,
          stableThreshold: DEFAULT_CONSCIOUSNESS_THRESHOLD,
          requiresHITM: phoenixContext.settings.conscienceLevel < DEFAULT_CONSCIOUSNESS_THRESHOLD
        };
      }
    }
    return createDefaultConsciousness();
  } catch (error) {
    console.error('Error parsing consciousness context:', error);
    return createDefaultConsciousness();
  }
}

/**
 * Check if a route requires HITM based on consciousness level
 */
export function requiresHITM(path: string, consciousness: ConsciousnessContext): boolean {
  // Skip HITM for excluded routes
  if (HITM_EXCLUDED_ROUTES.some(route => path.startsWith(route))) {
    return false;
  }
  
  // Always require HITM if consciousness is below threshold
  if (consciousness.level < consciousness.stableThreshold) {
    return true;
  }
  
  // Extra protection for sensitive routes - requires even higher consciousness
  if (SENSITIVE_ROUTES.some(route => path.startsWith(route))) {
    return consciousness.level < consciousness.stableThreshold + 1;
  }
  
  return false;
}

/**
 * React Router loader function to check for authentication
 * Use this in the route definitions for protected routes
 */
export function requireAuth(auth: AuthContext) {
  if (!auth.isValid) {
    // Store the attempted URL to redirect back after login
    // We only have access to the current window location
    const intendedPath = window.location.pathname;
    
    // Redirect to login page
    const searchParams = new URLSearchParams();
    searchParams.set('from', intendedPath);
    const redirectUrl = `/auth/login?${searchParams.toString()}`;
    
    console.log('Redirecting to login - Protected route access attempt');
    throw redirect(redirectUrl);
  }
  
  // Continue with the route if authenticated
  return null;
}

/**
 * React Router loader function to check consciousness levels
 * Use this in conjunction with requireAuth for sensitive routes
 */
export function checkConsciousness() {
  const consciousness = getConsciousnessContext();
  const currentPath = window.location.pathname;
  
  if (requiresHITM(currentPath, consciousness)) {
    // Redirect to HITM page
    const searchParams = new URLSearchParams();
    searchParams.set('from', currentPath);
    searchParams.set('level', consciousness.level.toString());
    const hitmUrl = `/hitm?${searchParams.toString()}`;
    
    console.log(`Redirecting to HITM - Consciousness level: ${consciousness.level}`);
    throw redirect(hitmUrl);
  }
  
  // Continue with the route if consciousness is sufficient
  return null;
}

/**
 * Add security headers to API requests
 * This replaces the server-side header functionality
 */
export function addSecurityHeaders(request: Request): Request {
  const newHeaders = new Headers(request.headers);
  
  newHeaders.set('X-Frame-Options', 'DENY');
  newHeaders.set('X-Content-Type-Options', 'nosniff');
  newHeaders.set('X-XSS-Protection', '1; mode=block');
  newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Generate a unique request ID
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  newHeaders.set('X-Request-ID', requestId);
  
  // Create a new request with updated headers
  return new Request(request.url, {
    method: request.method,
    headers: newHeaders,
    body: request.body,
    mode: request.mode,
    credentials: request.credentials,
    cache: request.cache,
    redirect: request.redirect,
    referrer: request.referrer,
    integrity: request.integrity,
  });
}

/**
 * Add auth headers to API requests
 * This replaces the server-side proxy functionality
 */
export function addAuthHeaders(request: Request, auth: AuthContext): Request {
  const newHeaders = new Headers(request.headers);
  
  if (auth.isValid) {
    newHeaders.set('X-Phoenix-User-ID', auth.userId);
    newHeaders.set('X-Phoenix-Role', auth.role);
    newHeaders.set('X-Phoenix-Session-ID', auth.sessionId);
  }
  
  // Create a new request with updated headers
  return new Request(request.url, {
    method: request.method,
    headers: newHeaders,
    body: request.body,
    mode: request.mode,
    credentials: request.credentials,
    cache: request.cache,
    redirect: request.redirect,
    referrer: request.referrer,
    integrity: request.integrity,
  });
}