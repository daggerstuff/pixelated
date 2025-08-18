import { Suspense, lazy } from 'react';

// Lazy load the heavy bias dashboard
const BiasDashboard = lazy(() => import('./BiasDashboard').then(module => ({ default: module.BiasDashboard })));

interface LazyBiasDashboardProps {
  [key: string]: unknown;
}

function BiasLoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-64 mb-2 animate-pulse"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-96 animate-pulse"></div>
            </div>
            <div className="flex space-x-2">
              <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded w-24 animate-pulse"></div>
              <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded w-24 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2 animate-pulse"></div>
                  <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-16 animate-pulse"></div>
                </div>
                <div className="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-48 mb-4 animate-pulse"></div>
              <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
          ))}
        </div>

        {/* Loading Message */}
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Loading Bias Detection Dashboard...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LazyBiasDashboard(props: LazyBiasDashboardProps) {
  return (
    <Suspense fallback={<BiasLoadingFallback />}>
      <BiasDashboard {...props} />
    </Suspense>
  );
}
