/**
 * Professional Loading State for Courses Page
 */

export default function CoursesLoading() {
  return (
    <div className="min-h-screen px-4 sm:px-8 py-16 md:py-24">
      {/* Header Skeleton */}
      <div className="text-center max-w-6xl mx-auto mb-12">
        <div className="h-16 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg w-96 mx-auto mb-6 animate-pulse"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-2/3 mx-auto mb-8 animate-pulse"></div>
      </div>

      {/* Table Skeleton */}
      <div className="max-w-7xl mx-auto bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-5 gap-4 p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          ))}
        </div>

        {/* Table Rows */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="grid grid-cols-5 gap-4 p-4 border-b border-gray-100 dark:border-gray-800">
            {[1, 2, 3, 4, 5].map((j) => (
              <div key={j} className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            ))}
          </div>
        ))}
      </div>

      <div className="text-center mt-8">
        <p className="text-gray-600 dark:text-gray-400 animate-pulse">
          Loading courses...
        </p>
      </div>
    </div>
  );
}
