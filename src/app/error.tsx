'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * Root Error Boundary
 * Catches errors from any page in the application
 * Provides user-friendly error messages and recovery options
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to error reporting service (e.g., Sentry)
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          {/* Error Icon */}
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>

          {/* Error Title */}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Oops! Something went wrong
          </h1>

          {/* Error Message */}
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {process.env.NODE_ENV === 'development'
              ? error.message || 'An unexpected error occurred'
              : 'We encountered an unexpected error. Our team has been notified.'}
          </p>

          {/* Error Digest (for support) */}
          {error.digest && (
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-6 font-mono">
              Error ID: {error.digest}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </button>

            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Link>
          </div>

          {/* Development Details */}
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-6 text-left">
              <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                View error details
              </summary>
              <pre className="mt-3 p-4 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto max-h-64">
                {error.stack}
              </pre>
            </details>
          )}
        </div>

        {/* Support Link */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
          Need help?{' '}
          <Link href="/about" className="text-blue-600 dark:text-blue-400 hover:underline">
            Contact Support
          </Link>
        </p>
      </div>
    </div>
  );
}
