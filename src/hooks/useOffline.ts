import { useEffect, useState } from 'react'

// Define NetworkInformation interface inline
interface NetworkInformation {
  type?: string
  effectiveType?: string
  downlink?: number
  rtt?: number
  saveData?: boolean
  addEventListener?: (type: string, listener: EventListener) => void
  removeEventListener?: (type: string, listener: EventListener) => void
}

interface UseOfflineOptions {
  onOffline?: () => void
  onOnline?: () => void
}

interface ConnectionInfo {
  type: string | undefined
  effectiveType: string | undefined
  downlink: number | undefined
  rtt: number | undefined
  saveData: boolean | undefined
}

/**
 * Hook to detect and manage offline status
 *
 * @param options Configuration options including callbacks for state changes
 * @returns Object with offline status and connection information
 */
export function useOffline(options: UseOfflineOptions = {}) {
  const [isOffline, setIsOffline] = useState<boolean>(false)
  const { onOffline, onOnline } = options

  useEffect(() => {
    // Initial offline check
    setIsOffline(!navigator.onLine)

    const handleOffline = () => {
      setIsOffline(true)
      onOffline?.()
    }

    const handleOnline = () => {
      setIsOffline(false)
      onOnline?.()
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    // Check connection status periodically with a more reliable method
    const checkConnection = async () => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch('/api/health-check', {
          method: 'HEAD',
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          setIsOffline(true)
        } else if (isOffline && navigator.onLine) {
          // Only update if we're marked as offline but the request succeeded
          setIsOffline(false)
          onOnline?.()
        }
      } catch {
        // If fetch fails, we're probably offline
        if (navigator.onLine) {
          setIsOffline(true)
          onOffline?.()
        }
      }
    }

    const connectionCheckInterval = setInterval(checkConnection, 30000) // Check every 30 seconds

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      clearInterval(connectionCheckInterval)
    }
  }, [onOffline, onOnline, isOffline])

  // Get network information if available
  const getConnectionInfo = (): ConnectionInfo => {
    if ('connection' in navigator) {
      const conn = navigator.connection as NetworkInformation
      return {
        type: conn?.type,
        effectiveType: conn?.effectiveType,
        downlink: conn?.downlink,
        rtt: conn?.rtt,
        saveData: conn?.saveData,
      }
    }

    return {
      type: undefined,
      effectiveType: undefined,
      downlink: undefined,
      rtt: undefined,
      saveData: undefined,
    }
  }

  return {
    isOffline,
    // Helper methods
    checkConnection: async () => {
      try {
        const response = await fetch('/api/health-check', {
          method: 'HEAD',
        })
        return response.ok
      } catch {
        return false
      }
    },
    // Additional network information if available
    connectionInfo: getConnectionInfo(),
  }
}
