import { Suspense, lazy } from 'react'

import type { SecurityLevel } from '../../hooks/useSecurity'
import type { Message } from '../../types/chat'

// Lazy load the heavy analytics dashboard
const AnalyticsDashboardReact = lazy(() => import('./AnalyticsDashboardReact'))

interface LazyAnalyticsDashboardProps {
  messages: Message[]
  securityLevel: SecurityLevel
  encryptionEnabled: boolean
  scenario: string
}

function AnalyticsLoadingFallback() {
  return (
    <div className='bg-gray-900 text-gray-100 border-gray-800 overflow-hidden rounded-lg border'>
      {/* Header */}
      <div className='from-black via-purple-900 to-black flex items-center justify-between bg-gradient-to-r p-3'>
        <h2 className='text-lg font-medium'>Therapy Analytics</h2>
        <div className='flex items-center space-x-2'>
          <span className='text-blue-400 bg-black rounded bg-opacity-50 px-2 py-1 text-xs'>
            Loading...
          </span>
        </div>
      </div>

      {/* Loading Content */}
      <div className='p-6'>
        <div className='flex h-64 items-center justify-center'>
          <div className='flex flex-col items-center space-y-4'>
            <div className='border-purple-400 h-12 w-12 animate-spin rounded-full border-b-2'></div>
            <div className='text-center'>
              <p className='text-purple-300 text-lg font-medium'>
                Loading Analytics Dashboard
              </p>
              <p className='text-purple-300/70 mt-1 text-sm'>
                Initializing secure analytics engine...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LazyAnalyticsDashboard(
  props: LazyAnalyticsDashboardProps,
) {
  return (
    <Suspense fallback={<AnalyticsLoadingFallback />}>
      <AnalyticsDashboardReact {...props} />
    </Suspense>
  )
}
