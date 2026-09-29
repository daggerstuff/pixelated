import type { FC } from 'react'
import { toast } from 'react-hot-toast'

import { useOffline } from '../../hooks/useOffline'

interface OfflineIndicatorProps {
  className?: string
  showToast?: boolean
  showIndicator?: boolean
}

/**
 * OfflineIndicator Component
 *
 * This component shows a notification when the user is offline and provides options
 * to retry the connection or switch to offline mode.
 */
export const OfflineIndicator: FC<OfflineIndicatorProps> = ({
  className = '',
  showToast = true,
  showIndicator = true,
}) => {
  const { isOffline, connectionInfo } = useOffline({
    onOffline: () => {
      if (showToast) {
        toast.error('You are offline. Some features may be limited.', {
          duration: 4000,
          position: 'bottom-right',
          id: 'offline-notification',
        })
      }
    },
    onOnline: () => {
      if (showToast) {
        toast.success('You are back online!', {
          duration: 2000,
          position: 'bottom-right',
          id: 'online-notification',
        })
      }
    },
  })

  // If we're online or not showing the indicator, return null
  if (!isOffline || !showIndicator) {
    return null
  }

  return (
    <div
      className={`fixed bottom-4 left-4 z-50 transform rounded-none border border-border bg-card p-4 transition-all duration-300 ${className} ${isOffline ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'} `}
    >
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          <svg
            className="h-6 w-6 text-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-medium text-foreground">
            You&apos;re Offline
          </h3>
          <div className="mt-1 text-sm text-muted-foreground">
            {connectionInfo.type && (
              <p>
                Connection: {connectionInfo.type}
                {connectionInfo.effectiveType &&
                  ` (${connectionInfo.effectiveType})`}
              </p>
            )}
            {connectionInfo.saveData && (
              <p className="text-xs">Data Saver is enabled</p>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-end space-x-2">
        <button
          onClick={() => window.location.reload()}
          className="border-transparent hover:bg-primary/90 inline-flex items-center rounded-none border bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Retry Connection
        </button>
        <a
          href="/offline"
          className="inline-flex items-center rounded-none border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Offline Mode
        </a>
      </div>
    </div>
  )
}
