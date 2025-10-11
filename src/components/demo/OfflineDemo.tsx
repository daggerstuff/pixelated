import type { FC } from 'react'
import React from 'react'
import { useOfflineManager } from '@/hooks/useOfflineManager'
import { OfflineIndicator } from '@/components/layout/OfflineIndicator'
import { AnimationWrapper, FadeIn } from '@/components/layout/AdvancedAnimations'
import { ResponsiveContainer, ResponsiveText } from '@/components/layout/ResponsiveUtils'

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
    isOffline,
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
        }
      )

      if (response.status === 202) {
        // Request was queued
        const newData: DemoData = {
          id: Date.now().toString(),
          message: `Request queued for sync (${isCritical ? 'critical' : 'normal'})`,
          timestamp: Date.now(),
        }
        setLocalData(prev => [newData, ...prev])
      } else {
        // Request succeeded
        const result = await response.json()
        const newData: DemoData = {
          id: Date.now().toString(),
          message: `Request succeeded: ${result.message || 'OK'}`,
          timestamp: Date.now(),
        }
        setLocalData(prev => [newData, ...prev])
      }
    } catch (error) {
      const newData: DemoData = {
        id: Date.now().toString(),
        message: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      }
      setLocalData(prev => [newData, ...prev])
    } finally {
      setIsLoading(false)
    }
  }

  const simulateOfflineMode = () => {
    setSimulatedOffline(!simulatedOffline)
    // In a real app, you'd trigger offline mode programmatically for testing
  }

  return (
    <ResponsiveContainer size="lg">
      <div className="space-y-8 p-8">
        <ResponsiveText size="xl" className="text-center mb-8">
          Offline Capabilities Demo
        </ResponsiveText>

        {/* Offline Indicator */}
        <OfflineIndicator showDetails position="top-right" />

        {/* Connection Status */}
        <FadeIn>
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold mb-4">Connection Status</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="font-medium">
                    Status: {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <div>Connection Quality: {connectionQuality}</div>
                  <div>Effective Type: {navigator.connection?.effectiveType || 'Unknown'}</div>
                  <div>Downlink: {navigator.connection?.downlink || 0} Mbps</div>
                  <div>RTT: {navigator.connection?.rtt || 0} ms</div>
                </div>
              </div>

              <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h3 className="font-medium">Queue Statistics</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <div>Total Requests: {queueStats.total}</div>
                  <div>Critical: {queueStats.byPriority.critical}</div>
                  <div>High: {queueStats.byPriority.high}</div>
                  <div>Normal: {queueStats.byPriority.normal}</div>
                  <div>Low: {queueStats.byPriority.low}</div>
                </div>

                {isSyncing && (
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Syncing...</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        </FadeIn>

        {/* Demo Controls */}
        <FadeIn>
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold mb-4">Demo Controls</h2>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => simulateApiCall(false)}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                {isLoading ? 'Sending...' : 'Send Normal Request'}
              </button>

              <button
                onClick={() => simulateApiCall(true)}
                disabled={isLoading}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                {isLoading ? 'Sending...' : 'Send Critical Request'}
              </button>

              <button
                onClick={sync}
                disabled={!hasPendingRequests || !isOnline || isSyncing}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                {isSyncing ? 'Syncing...' : 'Force Sync'}
              </button>

              <button
                onClick={clearQueue}
                disabled={!hasPendingRequests}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                Clear Queue
              </button>

              <button
                onClick={simulateOfflineMode}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
              >
                {simulatedOffline ? 'Exit Offline Mode' : 'Simulate Offline'}
              </button>
            </div>
          </section>
        </FadeIn>

        {/* Request Log */}
        <FadeIn>
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold mb-4">Request Log</h2>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {localData.map((item) => (
                <AnimationWrapper key={item.id} animation="slideLeft">
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{item.message}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {item.id}
                    </div>
                  </div>
                </AnimationWrapper>
              ))}

              {localData.length === 0 && (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No requests yet. Try sending some requests above!
                </div>
              )}
            </div>
          </section>
        </FadeIn>

        {/* Offline Features */}
        <FadeIn>
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold mb-4">Offline Features</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h3 className="font-medium text-blue-900 dark:text-blue-100">Request Queuing</h3>
                <p className="text-sm text-blue-700 dark:text-blue-200">
                  Network requests are automatically queued when offline and processed when connectivity returns.
                </p>
                <ul className="text-sm text-blue-700 dark:text-blue-200 space-y-1">
                  <li>• Critical requests get priority processing</li>
                  <li>• Automatic retry with exponential backoff</li>
                  <li>• Persistent queue across browser sessions</li>
                </ul>
              </div>

              <div className="space-y-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <h3 className="font-medium text-green-900 dark:text-green-100">Smart Fallbacks</h3>
                <p className="text-sm text-green-700 dark:text-green-200">
                  The system adapts to network conditions and user preferences automatically.
                </p>
                <ul className="text-sm text-green-700 dark:text-green-200 space-y-1">
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
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold mb-4">How to Test</h2>

            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <h3 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">Testing Offline Mode:</h3>
              <ol className="text-sm text-yellow-700 dark:text-yellow-200 space-y-1 list-decimal list-inside">
                <li>Disable your network connection or use browser dev tools to go offline</li>
                <li>Try sending requests - they'll be queued automatically</li>
                <li>Re-enable your connection to see requests sync automatically</li>
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