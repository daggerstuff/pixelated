// Service Worker Registration — PIX-4061
// Registers SW with update detection. On new SW version: skipWaiting + reload.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        // Listen for new SW installations
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // New SW is waiting — tell it to skip waiting
              newWorker.postMessage('SKIP_WAITING')
            }
          })
        })
      })
      .catch((error) => {
        console.error('ServiceWorker registration failed:', error)
      })

    // Reload once when controller changes (new SW took over)
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  })
}
