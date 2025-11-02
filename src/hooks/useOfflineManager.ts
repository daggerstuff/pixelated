import { useState, useEffect, useCallback } from 'react'
import offlineManager from '@/utils/offline/offlineManager'
import requestQueue from '@/utils/offline/requestQueue'
import { useOfflineDetection } from './useOfflineDetection'

export interface UseOfflineManagerOptions {
  enableQueue?: boolean
  criticalPaths?: string[]
  onRequestQueued?: (request: any) => void
  onSyncComplete?: () => void
}

/**
 * React hook for comprehensive offline management
 * Combines offline detection, request queuing, and synchronization
 */
export function useOfflineManager({
  enableQueue = true,
  criticalPaths = [],
  onRequestQueued,
  onSyncComplete,
}: UseOfflineManagerOptions = {}) {
  const networkState = useOfflineDetection()
  const [queueStats, setQueueStats] = useState(() => requestQueue.getStats())
  const [isSyncing, setIsSyncing] = useState(false)

  // Update queue stats
  const updateQueueStats = useCallback(() => {
    setQueueStats(requestQueue.getStats())
  }, [])

  // Set up event listeners
  useEffect(() => {
    const unsubscribeOnline = offlineManager.on('online', updateQueueStats)
    const unsubscribeOffline = offlineManager.on('offline', updateQueueStats)
    const unsubscribeSyncStart = offlineManager.on('syncStart', () =>
      setIsSyncing(true),
    )
    const unsubscribeSyncComplete = offlineManager.on('syncComplete', () => {
      setIsSyncing(false)
      updateQueueStats()
      onSyncComplete?.()
    })

    // Update stats periodically
    const interval = setInterval(updateQueueStats, 1000)

    return () => {
      unsubscribeOnline()
      unsubscribeOffline()
      unsubscribeSyncStart()
      unsubscribeSyncComplete()
      clearInterval(interval)
    }
  }, [updateQueueStats, onSyncComplete])

  // Enhanced fetch function that handles offline scenarios
  const offlineFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      if (!enableQueue) {
        return fetch(url, options)
      }

      const isCriticalPath = criticalPaths.some((path) => url.includes(path))

      try {
        const response = await fetch(url, options)

        if (response.ok) {
          return response
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      } catch (error) {
        if (!networkState.isOnline) {
          // Queue the request for later
          const priority = isCriticalPath ? 'critical' : 'normal'

          const queued = requestQueue.add({
            url,
            method: (options.method as any) || 'GET',
            headers: (options.headers as Record<string, string>) || {},
            body: options.body,
            priority,
            maxRetries: isCriticalPath ? 5 : 3,
          })

          if (queued) {
            onRequestQueued?.({
              id: `req_${Date.now()}`,
              url,
              method: (options.method as any) || 'GET',
              headers: (options.headers as Record<string, string>) || {},
              body: options.body,
              timestamp: Date.now(),
              retryCount: 0,
              priority,
              maxRetries: isCriticalPath ? 5 : 3,
            })
          }

          // Return a mock response indicating the request was queued
          return new Response(
            JSON.stringify({
              error: 'Request queued for offline sync',
              queued: true,
              willRetry: true,
            }),
            {
              status: 202,
              statusText: 'Queued',
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        throw error
      }
    },
    [enableQueue, criticalPaths, networkState.isOnline, onRequestQueued],
  )

  // Manual sync trigger
  const sync = useCallback(async () => {
    if (!networkState.isOnline || !queueStats.total) return

    setIsSyncing(true)
    try {
      await offlineManager.sync()
    } finally {
      setIsSyncing(false)
    }
  }, [networkState.isOnline, queueStats.total])

  // Clear all queued requests
  const clearQueue = useCallback(() => {
    requestQueue.clear()
    updateQueueStats()
  }, [updateQueueStats])

  return {
    // Network state
    ...networkState,

    // Queue state
    queueStats,
    hasPendingRequests: queueStats.total > 0,
    isSyncing,

    // Actions
    offlineFetch,
    sync,
    clearQueue,
    updateQueueStats,

    // Utilities
    isOfflineMode:
      networkState.isOffline ||
      (networkState.isSlowConnection && networkState.saveData),
    canMakeRequests: networkState.isOnline && !networkState.isSlowConnection,
  }
}

export default useOfflineManager
