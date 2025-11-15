import { Loader2 } from 'lucide-react';

/**
 * Root Loading State
 * Displayed while pages are loading
 * Provides consistent loading UI across the application
 */
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        {/* Animated Spinner */}
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full mb-4">
          <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
        </div>

        {/* Loading Text */}
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Loading...
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Please wait while we fetch your content
        </p>
      </div>
    </div>
  );
}
