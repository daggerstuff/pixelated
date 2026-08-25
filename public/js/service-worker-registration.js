// Service Worker Registration — PIX-4061
// Registers SW with update detection. On new SW version: skipWaiting + reload.
if ('serviceWorker' in navigator) {
  const scriptUrl =
    document.currentScript instanceof HTMLScriptElement
      ? document.currentScript.src
      : document.querySelector(
          'script[src$="/js/service-worker-registration.js"]',
        )?.src

  if (!scriptUrl) {
    console.error('ServiceWorker registration failed: script URL unavailable')
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register(new URL('../sw.js', scriptUrl).toString(), {
          updateViaCache: 'none',
        })
        .then((registration) => {
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (!newWorker) return

            newWorker.addEventListener('statechange', () => {
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                newWorker.postMessage('SKIP_WAITING')
              }
            })
          })
        })
        .catch((error) => {
          console.error('ServiceWorker registration failed:', error)
        })

      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return
        refreshing = true
        window.location.reload()
      })
    })
  }
}
