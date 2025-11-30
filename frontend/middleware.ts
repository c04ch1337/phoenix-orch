import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
// Using built-in methods instead of jose library

// Types for authentication context
interface AuthContext {
  userId: string;
  role: string;
  permissions: string[];
  sessionId: string;
  isValid: boolean;
  expiry: number;
}

// Types for consciousness context
interface ConsciousnessContext {
  level: number; // 0-5 scale
  stableThreshold: number; // Minimum level considered stable (default 4 = 80%)
  requiresHITM: boolean;
}

// Enhanced middleware context that contains auth and consciousness data
interface MiddlewareContext {
  auth: AuthContext;
  consciousness: ConsciousnessContext;
  path: string;
  requestId: string;
}

// Protected routes that require authentication
const PROTECTED_ROUTES = ['/ember', '/cipher'];

// Highly sensitive routes that require high consciousness levels
const SENSITIVE_ROUTES = ['/cipher/security', '/ember/core', '/admin'];

// Routes that are excluded from HITM protection
const HITM_EXCLUDED_ROUTES = ['/hitm', '/auth/login', '/api/auth/refresh', '/assets'];

// Default consciousness threshold (80%)
const DEFAULT_CONSCIOUSNESS_THRESHOLD = 4;

/**
 * Create a default consciousness context
 */
function createDefaultConsciousness(): ConsciousnessContext {
  return {
    level: 5, // Default to maximum consciousness
    stableThreshold: DEFAULT_CONSCIOUSNESS_THRESHOLD,
    requiresHITM: false
  };
}

/**
 * Create a default auth context for unauthenticated users
 */
function createDefaultAuth(): AuthContext {
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
 * Extract auth token from request
 * Checks both cookies and Authorization header
 */
function getAuthToken(req: NextRequest): string | null {
  // Try to get from cookie first
  const token = req.cookies.get('phoenix_auth_token')?.value;
  if (token) return token;
  
  // Fall back to Authorization header
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

/**
 * Validates the authentication token and builds auth context
 * Returns default auth context if token is invalid
 */
async function validateAuthToken(token: string | null): Promise<AuthContext> {
  if (!token) return createDefaultAuth();
  
  try {
    // Extract the payload section of the JWT
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('Invalid token format: token does not have 3 parts');
      return createDefaultAuth();
    }

    // Decode the base64-encoded payload
    const payload = parts[1];
    // Handle base64 padding issues by adding missing padding
    const paddedPayload = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');
    const decodedPayload = Buffer.from(paddedPayload, 'base64').toString();
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
 * Load consciousness level from cookies or default to 5
 */
function getConsciousnessContext(req: NextRequest): ConsciousnessContext {
  try {
    // Try to get consciousness data from cookie
    const contextCookie = req.cookies.get('phoenix_context');
    if (contextCookie) {
      const phoenixContext = JSON.parse(contextCookie.value);
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
function requiresHITM(path: string, context: MiddlewareContext): boolean {
  // Skip HITM for excluded routes
  if (HITM_EXCLUDED_ROUTES.some(route => path.startsWith(route))) {
    return false;
  }
  
  // Always require HITM if consciousness is below threshold
  if (context.consciousness.level < context.consciousness.stableThreshold) {
    return true;
  }
  
  // Extra protection for sensitive routes - requires even higher consciousness
  if (SENSITIVE_ROUTES.some(route => path.startsWith(route))) {
    return context.consciousness.level < context.consciousness.stableThreshold + 1;
  }
  
  return false;
}

/**
 * Check if user's token is about to expire and needs refresh
 */
function needsTokenRefresh(auth: AuthContext): boolean {
  if (!auth.isValid) return false;
  
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = auth.expiry - nowInSeconds;
  
  // Refresh if token expires in less than 5 minutes
  return timeUntilExpiry < 300;
}

/**
 * Add auth headers to proxied requests
 */
function addAuthHeaders(headers: Headers, auth: AuthContext): Headers {
  const newHeaders = new Headers(headers);
  
  if (auth.isValid) {
    newHeaders.set('X-Phoenix-User-ID', auth.userId);
    newHeaders.set('X-Phoenix-Role', auth.role);
    newHeaders.set('X-Phoenix-Session-ID', auth.sessionId);
  }
  
  return newHeaders;
}

/**
 * Main middleware function
 */
export async function middleware(request: NextRequest) {
  // Skip middleware for static files and assets to improve performance
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/assets') ||
    request.nextUrl.pathname.includes('.') // Simple check for file extensions
  ) {
    return NextResponse.next();
  }

  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const path = request.nextUrl.pathname;
  
  try {
    // Step 1: Build middleware context
    const token = getAuthToken(request);
    const auth = await validateAuthToken(token);
    const consciousness = getConsciousnessContext(request);
    
    const context: MiddlewareContext = {
      auth,
      consciousness,
      path,
      requestId
    };
    
    // Log request for debugging (in production, use proper logging)
    console.log(`[${requestId}] ${request.method} ${path} - Auth: ${auth.isValid ? 'valid' : 'invalid'} - Consciousness: ${consciousness.level}`);
    
    // Step 2: Check for protected routes
    const isProtectedRoute = PROTECTED_ROUTES.some(route => 
      path.startsWith(route)
    );
    
    if (isProtectedRoute && !auth.isValid) {
      // Store the attempted URL to redirect back after login
      const redirectUrl = new URL('/auth/login', request.url);
      redirectUrl.searchParams.set('from', request.nextUrl.pathname);
      
      console.log(`[${requestId}] Redirecting to login - Protected route access attempt`);
      return NextResponse.redirect(redirectUrl);
    }
    
    // Step 3: Check for HITM requirements
    if (requiresHITM(path, context)) {
      const hitmUrl = new URL('/hitm', request.url);
      hitmUrl.searchParams.set('from', request.nextUrl.pathname);
      hitmUrl.searchParams.set('level', context.consciousness.level.toString());
      
      console.log(`[${requestId}] Redirecting to HITM - Consciousness level: ${context.consciousness.level}`);
      return NextResponse.redirect(hitmUrl);
    }
    
    // Step 4: Check if token needs refresh and set header for client to handle
    const response = NextResponse.next();
    
    if (needsTokenRefresh(auth)) {
      response.headers.set('X-Phoenix-Auth-Refresh-Required', 'true');
    }
    
    // Step 5: Add security headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-Request-ID', requestId);
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
    );
    
    // Step 6: Proxy requests to API with authentication
    if (path.startsWith('/api/')) {
      try {
        // Add auth headers to the request
        const proxyHeaders = addAuthHeaders(request.headers, auth);
        
        // Determine API endpoint based on environment
        // In a production app, this would come from environment variables or config
        const apiBase = 'http://localhost:5001';
        
        // Create rewrite URL for the API backend
        const apiPath = path.substring(4); // Remove /api prefix
        const apiUrl = new URL(apiBase + apiPath, request.url);
        
        // Preserve query parameters
        request.nextUrl.searchParams.forEach((value, key) => {
          apiUrl.searchParams.set(key, value);
        });
        
        console.log(`[${requestId}] Proxying request to: ${apiUrl.toString()}`);
        
        // Return a rewritten request to the API
        return NextResponse.rewrite(apiUrl, {
          headers: proxyHeaders
        });
      } catch (error) {
        console.error(`[${requestId}] API proxy error:`, error);
        
        // Fall back to continuing the request without proxying
        Object.entries(Object.fromEntries(addAuthHeaders(request.headers, auth).entries())).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      }
    }
    
    return response;
  } catch (error) {
    // Enhanced error handling with more details
    console.error(`[${requestId}] Middleware error:`, error);
    console.error(`[${requestId}] Path: ${path}, Method: ${request.method}`);
    
    // For critical errors, we could redirect to an error page
    if (path.startsWith('/api/')) {
      // For API routes, return a proper JSON error
      return new NextResponse(
        JSON.stringify({
          error: 'Internal Server Error',
          message: 'An error occurred processing your request',
          requestId
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'X-Phoenix-Error': 'middleware_failure',
            'X-Request-ID': requestId
          }
        }
      );
    } else {
      // For UI routes, continue but add error headers
      const response = NextResponse.next();
      response.headers.set('X-Phoenix-Error', 'middleware_failure');
      response.headers.set('X-Request-ID', requestId);
      return response;
    }
  }
}

// Export the config for Next.js middleware
export const config = {
  // Matcher for routes that should trigger this middleware
  matcher: [
    '/ember/:path*',
    '/cipher/:path*',
    '/api/:path*',
    '/hitm/:path*',
    // Add more routes as needed
  ],
};