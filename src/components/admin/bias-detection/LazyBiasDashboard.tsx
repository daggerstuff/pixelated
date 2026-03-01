import { Suspense, lazy } from 'react'

// Lazy load the heavy bias dashboard
const BiasDashboard = lazy(() =>
  import('./BiasDashboard').then((module) => ({
    default: module.BiasDashboard,
  })),
)

interface LazyBiasDashboardProps {
  [key: string]: unknown
}

function BiasLoadingFallback() {
  return (
    <div className='from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 min-h-screen bg-gradient-to-br'>
      <div className='container mx-auto px-4 py-8'>
        {/* Header */}
        <div className='mb-8'>
          <div className='flex items-center justify-between'>
            <div>
              <div className='bg-gray-300 dark:bg-gray-600 mb-2 h-8 w-64 animate-pulse rounded'></div>
              <div className='bg-gray-200 dark:bg-gray-700 h-4 w-96 animate-pulse rounded'></div>
            </div>
            <div className='flex space-x-2'>
              <div className='bg-gray-300 dark:bg-gray-600 h-10 w-24 animate-pulse rounded'></div>
              <div className='bg-gray-300 dark:bg-gray-600 h-10 w-24 animate-pulse rounded'></div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className='mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className='bg-white dark:bg-gray-800 rounded-lg p-6 shadow'
            >
              <div className='flex items-center justify-between'>
                <div>
                  <div className='bg-gray-200 dark:bg-gray-700 mb-2 h-4 w-20 animate-pulse rounded'></div>
                  <div className='bg-gray-300 dark:bg-gray-600 h-8 w-16 animate-pulse rounded'></div>
                </div>
                <div className='bg-gray-300 dark:bg-gray-600 h-8 w-8 animate-pulse rounded'></div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className='bg-white dark:bg-gray-800 rounded-lg p-6 shadow'
            >
              <div className='bg-gray-300 dark:bg-gray-600 mb-4 h-6 w-48 animate-pulse rounded'></div>
              <div className='bg-gray-100 dark:bg-gray-700 h-64 animate-pulse rounded'></div>
            </div>
          ))}
        </div>

        {/* Loading Message */}
        <div className='bg-blue-600 text-white fixed bottom-4 right-4 rounded-lg px-4 py-2 shadow-lg'>
          <div className='flex items-center space-x-2'>
            <div className='border-white h-4 w-4 animate-spin rounded-full border-b-2'></div>
            <span>Loading Bias Detection Dashboard...</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LazyBiasDashboard(props: LazyBiasDashboardProps) {
  return (
    <Suspense fallback={<BiasLoadingFallback />}>
      <BiasDashboard {...props} />
    </Suspense>
  )
}
