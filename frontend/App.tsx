import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Layout components
import MainLayout from './src/components/layout/MainLayout';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import LoadingIndicator from './src/components/common/LoadingIndicator';

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
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;
