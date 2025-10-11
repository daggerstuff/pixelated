import type { FC } from 'react'
import React from 'react'
import { useOfflineDetection } from '@/hooks/useOfflineDetection'
import offlineManager from '@/utils/offline/offlineManager'
import { AnimationWrapper } from './AdvancedAnimations'

interface OfflineIndicatorProps {
  showDetails?: boolean
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'inline'
  className?: string
}

/**
 * Offline indicator component that shows connection status
 * Provides visual feedback about network state and queued requests
 */
export const OfflineIndicator: FC<OfflineIndicatorProps> = ({
  showDetails = false,
  position = 'top-right',
  className = '',
}) => {
  const networkState = useOfflineDetection()
  const [queueStats, setQueueStats] = React.useState(() => offlineManager.getStatus().queueStats)
  const [isVisible, setIsVisible] = React.useState(false)

  // Update queue stats periodically
  React.useEffect(() => {
    const updateStats = () => {
      setQueueStats(offlineManager.getStatus().queueStats)
    }

    const interval = setInterval(updateStats, 2000)
    updateStats() // Initial update

    return () => clearInterval(interval)
  }, [])

  // Auto-show when offline or when there are pending requests
  React.useEffect(() => {
    setIsVisible(networkState.isOffline || queueStats.total > 0)
  }, [networkState.isOffline, queueStats.total])

  // Listen to offline manager events
  React.useEffect(() => {
    const unsubscribeOnline = offlineManager.on('online', () => {
      setTimeout(() => setIsVisible(false), 3000) // Hide after 3 seconds online
    })

    const unsubscribeOffline = offlineManager.on('offline', () => {
      setIsVisible(true)
    })

    return () => {
      unsubscribeOnline()
      unsubscribeOffline()
    }
  }, [])

  if (!isVisible) return null

  const positionClasses = {
    'top-left': 'fixed top-4 left-4 z-50',
    'top-right': 'fixed top-4 right-4 z-50',
    'bottom-left': 'fixed bottom-4 left-4 z-50',
    'bottom-right': 'fixed bottom-4 right-4 z-50',
    'inline': 'inline-flex',
  }

  const getStatusColor = () => {
    if (networkState.isOffline) return 'bg-red-500'
    if (networkState.isSlowConnection) return 'bg-yellow-500'
    if (queueStats.total > 0) return 'bg-blue-500'
    return 'bg-green-500'
  }

  const getStatusText = () => {
    if (networkState.isOffline) return 'Offline'
    if (networkState.isSlowConnection) return 'Slow Connection'
    if (queueStats.total > 0) return `${queueStats.total} pending`
    return 'Online'
  }

  const getStatusIcon = () => {
    if (networkState.isOffline) {
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      )
    }

    if (networkState.isSlowConnection) {
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      )
    }

    if (queueStats.total > 0) {
      return (
        <svg className="w-4 h-4 animate-spin" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
        </svg>
      )
    }

    return (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    )
  }

  return (
    <AnimationWrapper animation="slideDown" className={`${positionClasses[position]} ${className}`}>
      <div className={`
        flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-white text-sm font-medium
        ${getStatusColor()}
        backdrop-blur-sm bg-opacity-90
      `}>
        {getStatusIcon()}
        <span>{getStatusText()}</span>

        {showDetails && (networkState.isOffline || queueStats.total > 0) && (
          <span className="text-xs opacity-75">
            {networkState.isOffline ? '• No connection' : `• ${queueStats.total} queued`}
          </span>
        )}
      </div>
    </AnimationWrapper>
  )
}

export default OfflineIndicator