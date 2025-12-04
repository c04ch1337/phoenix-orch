import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Layout components
import MainLayout from '@/components/layout/MainLayout';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import LoadingIndicator from '@/components/common/LoadingIndicator';

// Import routes using lazy loading to improve initial load time
const HomeRoute = lazy(() => import('@/routes/index'));
const LoginRoute = lazy(() => import('@/routes/auth/login'));
const CipherRoute = lazy(() => import('@/routes/cipher'));
const EmberRoute = lazy(() => import('@/routes/ember'));
const FileExplorerRoute = lazy(() => import('@/pages/FileExplorer'));

// Create a query client for TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 10, // 10 minutes
      staleTime: 1000 * 30, // 30 seconds
      retry: 3,
      refetchOnWindowFocus: true,
    },
  },
});

// Create router with file-based route definitions
const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      { 
        index: true, 
        element: (
          <Suspense fallback={<LoadingIndicator />}>
            <HomeRoute />
          </Suspense>
        )
      },
      {
        path: 'auth/login',
        element: (
          <Suspense fallback={<LoadingIndicator />}>
            <LoginRoute />
          </Suspense>
        )
      },
      {
        path: 'cipher',
        element: (
          <Suspense fallback={<LoadingIndicator />}>
            <CipherRoute />
          </Suspense>
        )
      },
      {
        path: 'ember',
        element: (
          <Suspense fallback={<LoadingIndicator />}>
            <EmberRoute />
          </Suspense>
        )
      },
      {
        path: 'files',
        element: (
          <Suspense fallback={<LoadingIndicator />}>
            <FileExplorerRoute />
          </Suspense>
        )
      }
    ]
  }
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}