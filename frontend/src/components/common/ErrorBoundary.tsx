import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useRouteError } from 'react-router-dom';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary component for catching and displaying errors
 */
class ErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <h1>Something went wrong</h1>
          <p>{this.state.error?.toString()}</p>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error?.stack}
            <br />
            {this.state.errorInfo?.componentStack}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Error boundary wrapper that can be used directly in components
 */
export default function ErrorBoundary(props: Props): JSX.Element {
  return <ErrorBoundaryClass {...props} />;
}

/**
 * Error boundary component that can be used as errorElement in React Router v6.4+
 */
export function RouterErrorBoundary(): JSX.Element {
  const error = useRouteError();
  
  return (
    <div className="error-container">
      <h1>Oops! Something went wrong</h1>
      <p>
        {error instanceof Error ? error.message : 'An unexpected error occurred'}
      </p>
      {error instanceof Error && (
        <details style={{ whiteSpace: 'pre-wrap' }}>
          {error.stack}
        </details>
      )}
    </div>
  );
}