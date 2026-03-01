import type { FC } from 'react'
import React from 'react'

import {
  AnimationWrapper,
  FadeIn,
} from '@/components/layout/AdvancedAnimations'
import { OfflineIndicator } from '@/components/layout/OfflineIndicator'
import {
  ResponsiveContainer,
  ResponsiveText,
} from '@/components/layout/ResponsiveUtils'
import { useOfflineManager } from '@/hooks/useOfflineManager'

interface DemoData {
  id: string
  message: string
  timestamp: number
}

/**
 * Demonstration component showing offline capabilities
 */
export const OfflineDemo: FC = () => {
  const {
    isOnline,
    connectionQuality,
    hasPendingRequests,
    queueStats,
    isSyncing,
    offlineFetch,
    sync,
    clearQueue,
  } = useOfflineManager({
    criticalPaths: ['/api/important'],
    onRequestQueued: (request) => {
      console.log('Request queued for offline sync:', request)
    },
    onSyncComplete: () => {
      console.log('Offline sync completed')
    },
  })

  const [localData, setLocalData] = React.useState<DemoData[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [simulatedOffline, setSimulatedOffline] = React.useState(false)

  // Simulate API call
  const simulateApiCall = async (isCritical = false) => {
    setIsLoading(true)

    try {
      const response = await offlineFetch(
        isCritical ? '/api/important/data' : '/api/normal/data',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Demo message ${Date.now()}`,
            type: isCritical ? 'critical' : 'normal',
          }),
        },
      )

      if (response.status === 202) {
        // Request was queued
        const newData: DemoData = {
          id: Date.now().toString(),
          message: `Request queued for sync (${isCritical ? 'critical' : 'normal'})`,
          timestamp: Date.now(),
        }
        setLocalData((prev) => [newData, ...prev])
      } else {
        // Request succeeded
        const result = await response.json()
        const newData: DemoData = {
          id: Date.now().toString(),
          message: `Request succeeded: ${result.message || 'OK'}`,
          timestamp: Date.now(),
        }
        setLocalData((prev) => [newData, ...prev])
      }
    } catch (error) {
      const newData: DemoData = {
        id: Date.now().toString(),
        message: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      }
      setLocalData((prev) => [newData, ...prev])
    } finally {
      setIsLoading(false)
    }
  }

  const simulateOfflineMode = () => {
    setSimulatedOffline(!simulatedOffline)
    // In a real app, you'd trigger offline mode programmatically for testing
  }

  return (
    <ResponsiveContainer size='lg'>
      <div className='space-y-8 p-8'>
        <ResponsiveText size='xl' className='mb-8 text-center'>
          Offline Capabilities Demo
        </ResponsiveText>

        {/* Offline Indicator */}
        <OfflineIndicator showDetails position='top-right' />

        {/* Connection Status */}
        <FadeIn>
          <section className='space-y-4'>
            <h2 className='mb-4 text-2xl font-semibold'>Connection Status</h2>

            <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
              <div className='bg-gray-50 dark:bg-gray-800 space-y-3 rounded-lg p-4'>
                <div className='flex items-center gap-2'>
                  <div
                    className={`h-3 w-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}
                  />
                  <span className='font-medium'>
                    Status: {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>

                <div className='text-gray-600 dark:text-gray-400 text-sm'>
                  <div>Connection Quality: {connectionQuality}</div>
                </div>
              </div>

              <div className='bg-gray-50 dark:bg-gray-800 space-y-3 rounded-lg p-4'>
                <h3 className='font-medium'>Queue Statistics</h3>
                <div className='text-gray-600 dark:text-gray-400 text-sm'>
                  <div>Total Requests: {queueStats.total}</div>
                  <div>Critical: {queueStats.byPriority.critical}</div>
                  <div>High: {queueStats.byPriority.high}</div>
                  <div>Normal: {queueStats.byPriority.normal}</div>
                  <div>Low: {queueStats.byPriority.low}</div>
                </div>

                {isSyncing && (
                  <div className='text-blue-600 dark:text-blue-400 flex items-center gap-2'>
                    <div className='border-blue-600 border-t-transparent h-4 w-4 animate-spin rounded-full border-2' />
                    <span className='text-sm'>Syncing...</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        </FadeIn>

        {/* Demo Controls */}
        <FadeIn>
          <section className='space-y-4'>
            <h2 className='mb-4 text-2xl font-semibold'>Demo Controls</h2>

            <div className='flex flex-wrap gap-4'>
              <button
                onClick={() => simulateApiCall(false)}
                disabled={isLoading}
                className='bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg px-4 py-2 transition-colors'
              >
                {isLoading ? 'Sending...' : 'Send Normal Request'}
              </button>

              <button
                onClick={() => simulateApiCall(true)}
                disabled={isLoading}
                className='bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white rounded-lg px-4 py-2 transition-colors'
              >
                {isLoading ? 'Sending...' : 'Send Critical Request'}
              </button>

              <button
                onClick={sync}
                disabled={!hasPendingRequests || !isOnline || isSyncing}
                className='bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg px-4 py-2 transition-colors'
              >
                {isSyncing ? 'Syncing...' : 'Force Sync'}
              </button>

              <button
                onClick={clearQueue}
                disabled={!hasPendingRequests}
                className='bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white rounded-lg px-4 py-2 transition-colors'
              >
                Clear Queue
              </button>

              <button
                onClick={simulateOfflineMode}
                className='bg-purple-500 hover:bg-purple-600 text-white rounded-lg px-4 py-2 transition-colors'
              >
                {simulatedOffline ? 'Exit Offline Mode' : 'Simulate Offline'}
              </button>
            </div>
          </section>
        </FadeIn>

        {/* Request Log */}
        <FadeIn>
          <section className='space-y-4'>
            <h2 className='mb-4 text-2xl font-semibold'>Request Log</h2>

            <div className='max-h-64 space-y-2 overflow-y-auto'>
              {localData.map((item) => (
                <AnimationWrapper key={item.id} animation='slideLeft'>
                  <div className='bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 flex items-center justify-between rounded-lg border p-3'>
                    <div className='flex-1'>
                      <div className='font-medium'>{item.message}</div>
                      <div className='text-gray-500 dark:text-gray-400 text-sm'>
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className='text-gray-400 text-xs'>{item.id}</div>
                  </div>
                </AnimationWrapper>
              ))}

              {localData.length === 0 && (
                <div className='text-gray-500 dark:text-gray-400 p-8 text-center'>
                  No requests yet. Try sending some requests above!
                </div>
              )}
            </div>
          </section>
        </FadeIn>

        {/* Offline Features */}
        <FadeIn>
          <section className='space-y-4'>
            <h2 className='mb-4 text-2xl font-semibold'>Offline Features</h2>

            <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
              <div className='bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 space-y-3 rounded-lg border p-4'>
                <h3 className='text-blue-900 dark:text-blue-100 font-medium'>
                  Request Queuing
                </h3>
                <p className='text-blue-700 dark:text-blue-200 text-sm'>
                  Network requests are automatically queued when offline and
                  processed when connectivity returns.
                </p>
                <ul className='text-blue-700 dark:text-blue-200 space-y-1 text-sm'>
                  <li>• Critical requests get priority processing</li>
                  <li>• Automatic retry with exponential backoff</li>
                  <li>• Persistent queue across browser sessions</li>
                </ul>
              </div>

              <div className='bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 space-y-3 rounded-lg border p-4'>
                <h3 className='text-green-900 dark:text-green-100 font-medium'>
                  Smart Fallbacks
                </h3>
                <p className='text-green-700 dark:text-green-200 text-sm'>
                  The system adapts to network conditions and user preferences
                  automatically.
                </p>
                <ul className='text-green-700 dark:text-green-200 space-y-1 text-sm'>
                  <li>• Respects "Save Data" mode preferences</li>
                  <li>• Adjusts behavior for slow connections</li>
                  <li>• Provides user feedback about status</li>
                </ul>
              </div>
            </div>
          </section>
        </FadeIn>

        {/* Instructions */}
        <FadeIn>
          <section className='space-y-4'>
            <h2 className='mb-4 text-2xl font-semibold'>How to Test</h2>

            <div className='bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 rounded-lg border p-4'>
              <h3 className='text-yellow-900 dark:text-yellow-100 mb-2 font-medium'>
                Testing Offline Mode:
              </h3>
              <ol className='text-yellow-700 dark:text-yellow-200 list-inside list-decimal space-y-1 text-sm'>
                <li>
                  Disable your network connection or use browser dev tools to go
                  offline
                </li>
                <li>Try sending requests - they'll be queued automatically</li>
                <li>
                  Re-enable your connection to see requests sync automatically
                </li>
                <li>Use "Force Sync" to manually trigger synchronization</li>
              </ol>
            </div>
          </section>
        </FadeIn>
      </div>
    </ResponsiveContainer>
  )
}

export default OfflineDemo
