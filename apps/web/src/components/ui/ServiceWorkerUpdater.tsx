import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'

import { serviceWorkerManager } from '../../utils/serviceWorkerRegistration'

interface ServiceWorkerUpdaterProps {
  onUpdateAvailable?: () => void
  onUpdateComplete?: () => void
}

/**
 * ServiceWorkerUpdater Component
 *
 * This component manages service worker registration and updates.
 * It doesn't render anything visible but handles the service worker lifecycle
 * and shows notifications when updates are available.
 */
export const ServiceWorkerUpdater: FC<ServiceWorkerUpdaterProps> = ({
  onUpdateAvailable,
  onUpdateComplete,
}) => {
  const [, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!serviceWorkerManager.isSupported()) {
      return () => {}
    }

    // Register service worker
    serviceWorkerManager.register().catch(() => {
      console.error('Service Worker registration failed')
    })

    // Listen for updates
    const handleUpdateAvailable = () => {
      setUpdateAvailable(true)
      onUpdateAvailable?.()

      toast.custom(
        (t) => (
          <div
            className={` ${t.visible ? 'animate-enter' : 'animate-leave'} pointer-events-auto flex w-full max-w-md rounded-none border border-border bg-card`}
          >
            <div className="w-0 flex-1 p-4">
              <div className="flex items-start">
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Update Available
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    A new version is available. Refresh to update.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-border">
              <button
                onClick={() => {
                  toast.dismiss(t.id)
                  onUpdateComplete?.()
                  window.location.reload()
                }}
                className="border-transparent flex w-full items-center justify-center rounded-none border p-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring"
              >
                Refresh
              </button>
            </div>
          </div>
        ),

        {
          duration: Infinity,
          position: 'bottom-right',
        },
      )
    }

    window.addEventListener(
      'serviceWorkerUpdateAvailable',
      handleUpdateAvailable,
    )

    // Check for updates periodically
    const checkForUpdates = (): void => {
      serviceWorkerManager.update().catch(() => {
        console.error('Service Worker update check failed')
      })
    }

    // Check after component mounts and then periodically
    checkForUpdates()
    const updateInterval = setInterval(checkForUpdates, 60 * 60 * 1000) // Check every hour

    return () => {
      window.removeEventListener(
        'serviceWorkerUpdateAvailable',
        handleUpdateAvailable,
      )
      clearInterval(updateInterval)
    }
  }, [onUpdateAvailable, onUpdateComplete])

  // Request notification permission if needed
  useEffect(() => {
    const requestNotificationPermission = async () => {
      if ('Notification' in window && Notification.permission === 'default') {
        try {
          await Notification.requestPermission()
          toast.success('Notifications enabled')
        } catch {
          console.error('Failed to request notification permission')
        }
      }
    }

    void requestNotificationPermission()
  }, [])

  return null // This is a utility component, it doesn't render anything
}
