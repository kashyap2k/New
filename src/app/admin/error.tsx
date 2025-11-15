'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ShieldAlert, RefreshCw, Settings, AlertCircle } from 'lucide-react';

/**
 * Admin Panel Error Boundary
 * Catches errors specific to admin pages
 * Provides admin-specific troubleshooting and recovery options
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin panel error:', error);

    // Send to error tracking (Sentry, etc.)
    // TODO: Implement proper error tracking
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          {/* Error Icon */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Admin Panel Error
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                An error occurred in the admin panel. Please review the details below.
              </p>
            </div>
          </div>

          {/* Error Details */}
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900 dark:text-red-300 mb-1">
                  Error Message:
                </p>
                <p className="text-sm text-red-800 dark:text-red-400 font-mono">
                  {error.message || 'An unexpected error occurred'}
                </p>
              </div>
            </div>
          </div>

          {/* Troubleshooting Guide */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Troubleshooting Steps:
            </p>
            <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
              <li>Check your admin permissions and session status</li>
              <li>Verify database connection is working</li>
              <li>Review recent configuration changes</li>
              <li>Check browser console for additional errors</li>
              <li>Try clearing cache and reloading</li>
            </ol>
          </div>

          {/* Error Digest */}
          {error.digest && (
            <div className="mb-6">
              <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">
                Error Reference ID (for support):
              </p>
              <code className="text-sm bg-gray-100 dark:bg-gray-900 px-3 py-1 rounded border border-gray-200 dark:border-gray-700">
                {error.digest}
              </code>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Operation
            </button>

            <Link
              href="/admin"
              className="inline-flex items-center justify-center px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4 mr-2" />
              Admin Dashboard
            </Link>

            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              Return to Home
            </Link>
          </div>

          {/* Stack Trace (Development Only) */}
          {process.env.NODE_ENV === 'development' && (
            <details className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <summary className="cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white mb-3">
                Stack Trace (Development Mode)
              </summary>
              <pre className="p-4 bg-gray-900 text-gray-100 rounded text-xs overflow-auto max-h-96 border border-gray-700">
                {error.stack}
              </pre>
            </details>
          )}
        </div>

        {/* Admin Support Info */}
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Critical admin issue?{' '}
            <span className="text-red-600 dark:text-red-400 font-semibold">
              Contact system administrator immediately
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
