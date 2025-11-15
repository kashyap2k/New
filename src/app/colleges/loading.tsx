/**
 * Professional Loading State for Colleges Page
 * Uses skeleton screens for better UX
 */

export default function CollegesLoading() {
  return (
    <div className="min-h-screen px-4 sm:px-8 py-16 md:py-24">
      {/* Header Skeleton */}
      <div className="text-center max-w-6xl mx-auto mb-12">
        <div className="h-16 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg w-96 mx-auto mb-6 animate-pulse"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-2/3 mx-auto mb-8 animate-pulse"></div>

        {/* Search Bar Skeleton */}
        <div className="h-14 bg-gray-200 dark:bg-gray-700 rounded-xl max-w-3xl mx-auto mb-8 animate-pulse"></div>

        {/* Filters Skeleton */}
        <div className="flex gap-2 justify-center mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>

      {/* Cards Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 p-6 animate-pulse"
          >
            {/* Icon */}
            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl mb-4"></div>

            {/* Title */}
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>

            {/* Subtitle */}
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>

            {/* Details */}
            <div className="space-y-2 mb-4">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>

            {/* Button */}
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        ))}
      </div>

      {/* Loading Text */}
      <div className="text-center mt-8">
        <p className="text-gray-600 dark:text-gray-400 animate-pulse">
          Loading colleges...
        </p>
      </div>
    </div>
  );
}
