import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { logger } from '../core/logger';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('UNCAUGHT_REACT_ERROR', error, {
      componentStack: errorInfo.componentStack
    });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-6">
          <div className="bg-neutral-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-neutral-700">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-neutral-400 mb-8">
              We've logged the error and are working on it. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-white text-black px-6 py-3 rounded-full font-semibold hover:bg-neutral-200 transition-colors w-full"
            >
              Refresh Page
            </button>
            {import.meta.env.MODE !== 'production' && this.state.error && (
              <div className="mt-6 text-left bg-neutral-900 p-4 rounded-lg overflow-x-auto text-xs text-red-400 font-mono">
                {this.state.error.toString()}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
