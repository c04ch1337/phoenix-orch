/**
 * Error boundary component for handling route errors
 * Uses Tailwind for styling - no inline styles
 */

import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';

export default function ErrorBoundary() {
  const error = useRouteError();
  
  let errorMessage: string;
  let statusCode: number = 500;
  
  // Type check the error to provide appropriate feedback
  if (isRouteErrorResponse(error)) {
    statusCode = error.status;
    errorMessage = error.statusText;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else {
    errorMessage = 'Unknown error occurred';
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-phoenix-void text-white" role="alert">
      <h1 className="text-red-600 text-6xl mb-4">{statusCode}</h1>
      <div className="text-white text-xl mb-8">{errorMessage}</div>
      <Link to="/" className="text-red-600 hover:text-red-400 transition-colors">
        Return to Control Center
      </Link>
    </div>
  );
}