import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Protected routes that require authentication
const PROTECTED_ROUTES = ['/ember', '/cipher'];

// Function to check if user is authenticated
function isAuthenticated(request: NextRequest) {
  const token = request.cookies.get('phoenix_auth_token');
  return !!token; // In a real app, you'd verify the token's validity
}

export function middleware(request: NextRequest) {
  // Check if the requested path is protected
  const isProtectedRoute = PROTECTED_ROUTES.some(route => 
    request.nextUrl.pathname.startsWith(route)
  );

  if (isProtectedRoute && !isAuthenticated(request)) {
    // Store the attempted URL to redirect back after login
    const redirectUrl = new URL('/auth/login', request.url);
    redirectUrl.searchParams.set('from', request.nextUrl.pathname);

    // Redirect to login page
    return NextResponse.redirect(redirectUrl);
  }

  // Add security headers
  const response = NextResponse.next();
  
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  );

  return response;
}

export const config = {
  // Matcher for routes that should trigger this middleware
  matcher: [
    '/ember/:path*',
    '/cipher/:path*',
    // Add more protected routes as needed
  ],
};