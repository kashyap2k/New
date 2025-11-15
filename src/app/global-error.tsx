'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Global Error Boundary
 * Catches errors from the root layout
 * This is a last-resort error boundary for critical errors
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service
    console.error('Global error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
          <div className="max-w-md w-full">
            <div className="bg-gray-800 rounded-lg shadow-2xl p-8 text-center border border-gray-700">
              {/* Error Icon */}
              <div className="mx-auto w-20 h-20 bg-red-900/30 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle className="w-10 h-10 text-red-400" />
              </div>

              {/* Error Title */}
              <h1 className="text-3xl font-bold text-white mb-3">
                Critical Error
              </h1>

              {/* Error Message */}
              <p className="text-gray-300 mb-6">
                A critical error has occurred. Please try refreshing the page.
              </p>

              {/* Error Digest */}
              {error.digest && (
                <p className="text-sm text-gray-500 mb-6 font-mono">
                  Error ID: {error.digest}
                </p>
              )}

              {/* Reload Button */}
              <button
                onClick={reset}
                className="inline-flex items-center justify-center px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-semibold"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Reload Page
              </button>

              {/* Support Message */}
              <p className="text-gray-400 text-sm mt-6">
                If this issue persists, please contact support
              </p>

              {/* Development Details */}
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-6 text-left">
                  <summary className="cursor-pointer text-sm text-gray-400 hover:text-white">
                    View error details
                  </summary>
                  <pre className="mt-3 p-4 bg-gray-950 rounded text-xs overflow-auto max-h-64 text-red-300 border border-gray-700">
                    {error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
