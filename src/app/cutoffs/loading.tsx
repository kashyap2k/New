/**
 * Professional Loading State for Cutoffs Page
 */

export default function CutoffsLoading() {
  return (
    <div className="min-h-screen px-4 sm:px-8 py-16 md:py-24">
      {/* Header Skeleton */}
      <div className="text-center max-w-6xl mx-auto mb-12">
        <div className="h-16 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg w-96 mx-auto mb-6 animate-pulse"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-2/3 mx-auto mb-8 animate-pulse"></div>

        {/* Filters Skeleton */}
        <div className="flex gap-3 justify-center mb-8 flex-wrap">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-7xl mx-auto mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg mb-3 animate-pulse"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 animate-pulse"></div>
          </div>
        ))}
      </div>

      {/* Excel-Style Table Skeleton */}
      <div className="max-w-7xl mx-auto bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Sticky Header */}
        <div className="grid grid-cols-7 gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 border-b-2 border-blue-200 dark:border-blue-800">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-5 bg-blue-200 dark:bg-blue-800 rounded animate-pulse"></div>
          ))}
        </div>

        {/* Data Rows */}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <div
            key={i}
            className="grid grid-cols-7 gap-2 p-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((j) => (
              <div key={j} className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            ))}
          </div>
        ))}
      </div>

      <div className="text-center mt-8">
        <p className="text-gray-600 dark:text-gray-400 animate-pulse">
          Loading cutoff data...
        </p>
      </div>
    </div>
  );
}
