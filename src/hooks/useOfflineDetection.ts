import { useState, useEffect, useCallback } from 'react'

export interface OfflineState {
  isOnline: boolean
  isOffline: boolean
  connectionType: string
  effectiveType: string
  downlink: number
  rtt: number
  saveData: boolean
}

export interface UseOfflineDetectionOptions {
  onOnline?: () => void
  onOffline?: () => void
  enableNetworkInfo?: boolean
}

/**
 * Hook for detecting online/offline status and network conditions
 * Provides real-time network state and connection quality metrics
 */
export function useOfflineDetection({
  onOnline,
  onOffline,
  enableNetworkInfo = true,
}: UseOfflineDetectionOptions = {}) {
  const [networkState, setNetworkState] = useState<OfflineState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    connectionType: 'unknown',
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
    saveData: false,
  })

  const updateNetworkState = useCallback(() => {
    if (typeof navigator === 'undefined') return

    const isOnline = navigator.onLine
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection

    setNetworkState({
      isOnline,
      isOffline: !isOnline,
      connectionType: connection?.type || 'unknown',
      effectiveType: connection?.effectiveType || 'unknown',
      downlink: connection?.downlink || 0,
      rtt: connection?.rtt || 0,
      saveData: connection?.saveData || false,
    })

    // Trigger callbacks
    if (isOnline && onOnline) {
      onOnline()
    } else if (!isOnline && onOffline) {
      onOffline()
    }
  }, [onOnline, onOffline])

  useEffect(() => {
    updateNetworkState()

    // Listen for online/offline events
    window.addEventListener('online', updateNetworkState)
    window.addEventListener('offline', updateNetworkState)

    // Listen for connection changes if available
    if (enableNetworkInfo) {
      const connection = (navigator as any).connection
      if (connection) {
        connection.addEventListener('change', updateNetworkState)
      }
    }

    return () => {
      window.removeEventListener('online', updateNetworkState)
      window.removeEventListener('offline', updateNetworkState)

      if (enableNetworkInfo) {
        const connection = (navigator as any).connection
        if (connection) {
          connection.removeEventListener('change', updateNetworkState)
        }
      }
    }
  }, [updateNetworkState, enableNetworkInfo])

  const getConnectionQuality = useCallback(():
    | 'slow'
    | 'moderate'
    | 'fast'
    | 'unknown' => {
    if (!networkState.isOnline) return 'unknown'

    const { effectiveType, downlink, rtt } = networkState

    // Use effective type if available
    if (effectiveType === 'slow-2g') return 'slow'
    if (effectiveType === '2g') return 'slow'
    if (effectiveType === '3g') return 'moderate'
    if (effectiveType === '4g') return 'fast'

    // Fallback to downlink and RTT
    if (downlink > 0) {
      if (downlink < 0.5) return 'slow'
      if (downlink < 2) return 'moderate'
      return 'fast'
    }

    if (rtt > 0) {
      if (rtt > 300) return 'slow'
      if (rtt > 150) return 'moderate'
      return 'fast'
    }

    return 'unknown'
  }, [networkState])

  const isSlowConnection = useCallback((): boolean => {
    return getConnectionQuality() === 'slow'
  }, [getConnectionQuality])

  const shouldUseOfflineMode = useCallback((): boolean => {
    return !networkState.isOnline || isSlowConnection() || networkState.saveData
  }, [networkState, isSlowConnection])

  return {
    ...networkState,
    connectionQuality: getConnectionQuality(),
    isSlowConnection: isSlowConnection(),
    shouldUseOfflineMode: shouldUseOfflineMode(),
    refresh: updateNetworkState,
  }
}

export default useOfflineDetection
