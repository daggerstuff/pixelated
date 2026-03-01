import React, { useEffect, useState } from 'react'
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
      return
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
            className={` ${t.visible ? 'animate-enter' : 'animate-leave'} bg-white dark:bg-gray-800 ring-black pointer-events-auto flex w-full max-w-md rounded-lg shadow-lg ring-1 ring-opacity-5`}
          >
            <div className='w-0 flex-1 p-4'>
              <div className='flex items-start'>
                <div className='ml-3 flex-1'>
                  <p className='text-gray-900 dark:text-gray-100 text-sm font-medium'>
                    Update Available
                  </p>
                  <p className='text-gray-500 dark:text-gray-400 mt-1 text-sm'>
                    A new version is available. Refresh to update.
                  </p>
                </div>
              </div>
            </div>
            <div className='border-gray-200 dark:border-gray-700 flex border-l'>
              <button
                onClick={() => {
                  window.location.reload()
                  toast.dismiss(t.id)
                  onUpdateComplete?.()
                }}
                className='border-transparent text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 focus:ring-indigo-500 flex w-full items-center justify-center rounded-none rounded-r-lg border p-4 text-sm font-medium focus:outline-none focus:ring-2'
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
    const checkForUpdates = () => {
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
