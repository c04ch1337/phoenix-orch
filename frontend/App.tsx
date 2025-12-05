import React, { useState, useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Fixed import path - direct import since we're already at the frontend level
import { SplashPage } from './components/SplashPage';
import { AnimatePresence } from 'framer-motion';

// Layout components
import MainLayout from './src/components/layout/MainLayout';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import LoadingIndicator from './src/components/common/LoadingIndicator';

// Add console log to confirm imports
console.log('MainLayout imported:', MainLayout);
console.log('SplashPage imported:', SplashPage);

// Import routes using lazy loading
const HomeRoute = lazy(() => import('./src/routes/index'));
const LoginRoute = lazy(() => import('./src/routes/auth/login'));
const CipherRoute = lazy(() => import('./src/routes/cipher'));
const EmberRoute = lazy(() => import('./src/routes/ember'));

// Create a query client for TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 10, // 10 minutes
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Define routes
const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <MainLayout>
        <Suspense fallback={<LoadingIndicator />}>
          <ErrorBoundary>
            <HomeRoute />
          </ErrorBoundary>
        </Suspense>
      </MainLayout>
    ),
  },
  {
    path: '/auth/login',
    element: (
      <MainLayout>
        <Suspense fallback={<LoadingIndicator />}>
          <ErrorBoundary>
            <LoginRoute />
          </ErrorBoundary>
        </Suspense>
      </MainLayout>
    ),
  },
  {
    path: '/cipher',
    element: (
      <MainLayout>
        <Suspense fallback={<LoadingIndicator />}>
          <ErrorBoundary>
            <CipherRoute />
          </ErrorBoundary>
        </Suspense>
      </MainLayout>
    ),
  },
  {
    path: '/ember',
    element: (
      <MainLayout>
        <Suspense fallback={<LoadingIndicator />}>
          <ErrorBoundary>
            <EmberRoute />
          </ErrorBoundary>
        </Suspense>
      </MainLayout>
    ),
  },
]);

function App() {
  const [showSplash, setShowSplash] = useState(true);
  
  // Check localStorage for splash preference on mount
  useEffect(() => {
    console.log("Checking splash preference");
    // Check if user has chosen to skip splash
    const splashPreference = localStorage.getItem('phoenix-splash-preference');
    console.log("Splash preference:", splashPreference);
    
    if (splashPreference === 'skip') {
      console.log("Skipping splash screen due to user preference");
      setShowSplash(false);
    } else {
      console.log("Showing splash screen");
      setShowSplash(true);
    }
  }, []); // Empty dependency array so it only runs on mount

  // Handler for when splash screen completes or is skipped
  const handleSplashComplete = () => {
    setShowSplash(false);
  };
  
  // Add debugging for render
  console.log("Rendering App, showSplash =", showSplash);
  
  return (
    <QueryClientProvider client={queryClient}>
      <AnimatePresence mode="wait">
        {showSplash ? (
          <div>
            <div style={{position: 'fixed', top: 0, left: 0, right: 0, padding: '10px', background: 'red', color: 'white', zIndex: 9999}}>
              DEBUG: Splash should be visible
            </div>
            <SplashPage
              key="splash"
              onIgnite={handleSplashComplete}
            />
          </div>
        ) : (
          <RouterProvider key="router" router={router} />
        )}
      </AnimatePresence>
    </QueryClientProvider>
  );
}

export default App;
