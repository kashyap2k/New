'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react';

/**
 * Dashboard Error Boundary
 * Catches errors specific to dashboard pages
 * Provides dashboard-specific error recovery options
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          {/* Error Icon */}
          <div className="mx-auto w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
          </div>

          {/* Error Title */}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Dashboard Error
          </h1>

          {/* Error Message */}
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            We couldn't load your dashboard data. This might be a temporary issue.
          </p>

          {/* Common Dashboard Issues */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Common causes:
            </p>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Network connection issues</li>
              <li>• Session expired (try logging in again)</li>
              <li>• Database temporarily unavailable</li>
            </ul>
          </div>

          {/* Error Digest */}
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
              Reload Dashboard
            </button>

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Main Dashboard
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
      </div>
    </div>
  );
}
