import { lazy, Suspense } from 'react';
import { Navigate, RouteObject } from 'react-router-dom';

// Layout components
import MainLayout from './components/layout/MainLayout';
import ErrorBoundary, { RouterErrorBoundary } from './components/common/ErrorBoundary';
import LoadingIndicator from './components/common/LoadingIndicator';

// Auth utils and context
import { getAuthContext } from './utils/auth';

// Middleware-style utilities
import { requireAuth, checkConsciousness } from './utils/routeMiddleware';

// Lazily loaded route components
const Home = lazy(() => import('./routes/index'));
const Login = lazy(() => import('./routes/auth/login'));
const Cipher = lazy(() => import('./routes/cipher'));
const Ember = lazy(() => import('./routes/ember'));
const FileExplorer = lazy(() => import('./pages/FileExplorer'));

// Features
const ChatFeature = lazy(() => import('./features/chat'));
const CipherGuardFeature = lazy(() => import('./features/cipher-guard'));
const CommunicationFeature = lazy(() => import('./features/communication'));
const EmberUnitFeature = lazy(() => import('./features/ember-unit'));
const EternalCovenantFeature = lazy(() => import('./features/eternal-covenant'));
const ForgeFeature = lazy(() => import('./features/forge'));
const ReportSquadFeature = lazy(() => import('./features/report-squad'));
const SubconsciousFeature = lazy(() => import('./features/subconscious'));
const SystemFeature = lazy(() => import('./features/system'));

// System modules
const EcosystemModule = lazy(() => import('./modules/ecosystem'));
const ToolsModule = lazy(() => import('./modules/tools'));
const WeaverModule = lazy(() => import('./modules/weaver'));
const ReportModule = lazy(() => import('./modules/report_squad'));

/**
 * Wrapper component that handles suspense loading state
 */
const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LoadingIndicator />}>
    <ErrorBoundary>{children}</ErrorBoundary>
  </Suspense>
);

/**
 * HITM (Human In The Middle) route for consciousness verification
 */
const HITMRoute = lazy(() => import('./routes/hitm'));

/**
 * Define all application routes
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <MainLayout />,
    errorElement: <RouterErrorBoundary />,
    children: [
      {
        index: true,
        element: (
          <SuspenseWrapper>
            <Home />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'auth/login',
        element: (
          <SuspenseWrapper>
            <Login />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'cipher',
        element: (
          <SuspenseWrapper>
            <Cipher />
          </SuspenseWrapper>
        ),
        loader: async () => requireAuth(getAuthContext()),
      },
      {
        path: 'ember',
        element: (
          <SuspenseWrapper>
            <Ember />
          </SuspenseWrapper>
        ),
        loader: async () => requireAuth(getAuthContext()),
      },
      {
        path: 'files',
        element: (
          <SuspenseWrapper>
            <FileExplorer />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'hitm',
        element: (
          <SuspenseWrapper>
            <HITMRoute />
          </SuspenseWrapper>
        ),
      },
      
      // Features section
      {
        path: 'features',
        children: [
          {
            path: 'chat',
            element: (
              <SuspenseWrapper>
                <ChatFeature />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'cipher-guard',
            element: (
              <SuspenseWrapper>
                <CipherGuardFeature />
              </SuspenseWrapper>
            ),
            loader: async () => requireAuth(getAuthContext()),
          },
          {
            path: 'communication',
            element: (
              <SuspenseWrapper>
                <CommunicationFeature />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'ember-unit',
            element: (
              <SuspenseWrapper>
                <EmberUnitFeature />
              </SuspenseWrapper>
            ),
            loader: async () => {
              // Check both authentication and consciousness level
              requireAuth(getAuthContext());
              return checkConsciousness();
            },
          },
          {
            path: 'eternal-covenant',
            element: (
              <SuspenseWrapper>
                <EternalCovenantFeature />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'forge',
            element: (
              <SuspenseWrapper>
                <ForgeFeature />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'report-squad',
            element: (
              <SuspenseWrapper>
                <ReportSquadFeature />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'subconscious',
            element: (
              <SuspenseWrapper>
                <SubconsciousFeature />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'system',
            element: (
              <SuspenseWrapper>
                <SystemFeature />
              </SuspenseWrapper>
            ),
          },
        ],
      },
      
      // Modules
      {
        path: 'modules',
        children: [
          {
            path: 'ecosystem',
            element: (
              <SuspenseWrapper>
                <EcosystemModule />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'tools',
            element: (
              <SuspenseWrapper>
                <ToolsModule />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'weaver',
            element: (
              <SuspenseWrapper>
                <WeaverModule />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'report',
            element: (
              <SuspenseWrapper>
                <ReportModule />
              </SuspenseWrapper>
            ),
          },
        ],
      },
      
      // Fallback route
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
];

export default routes;