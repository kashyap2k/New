'use client';

import Link from 'next/link';
import { FileQuestion, Home, Search, ArrowLeft } from 'lucide-react';

/**
 * Custom 404 Not Found Page
 * Displayed when a page or resource doesn't exist
 * Provides helpful navigation options
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-2xl w-full text-center">
        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-100 dark:bg-blue-900/20 rounded-full mb-6">
            <FileQuestion className="w-12 h-12 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-2">
            404
          </h1>
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Page Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved. Let's get you back on track.
          </p>
        </div>

        {/* Quick Navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Link
            href="/"
            className="flex flex-col items-center gap-2 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700 group"
          >
            <Home className="w-6 h-6 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
            <span className="font-medium text-gray-900 dark:text-white">Home</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Start fresh</span>
          </Link>

          <Link
            href="/search"
            className="flex flex-col items-center gap-2 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700 group"
          >
            <Search className="w-6 h-6 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
            <span className="font-medium text-gray-900 dark:text-white">Search</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Find colleges</span>
          </Link>

          <button
            onClick={() => window.history.back()}
            className="flex flex-col items-center gap-2 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700 group"
          >
            <ArrowLeft className="w-6 h-6 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
            <span className="font-medium text-gray-900 dark:text-white">Go Back</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Previous page</span>
          </button>
        </div>

        {/* Popular Pages */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Popular Pages
          </h3>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link
              href="/colleges"
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Colleges
            </Link>
            <Link
              href="/courses"
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Courses
            </Link>
            <Link
              href="/cutoffs"
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cutoffs
            </Link>
            <Link
              href="/counselling"
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Counselling
            </Link>
            <Link
              href="/dashboard"
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/about"
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              About
            </Link>
          </div>
        </div>

        {/* Help Text */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-6">
          Still can't find what you're looking for?{' '}
          <Link href="/about" className="text-blue-600 dark:text-blue-400 hover:underline">
            Contact us
          </Link>
        </p>
      </div>
    </div>
  );
}
