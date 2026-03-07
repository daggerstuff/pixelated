// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((_registration) => {
        console.log('ServiceWorker registration successful')
      })
      .catch((_error) => {
        console.error('ServiceWorker registration failed:', _error)
      })
  })
}
!(function () {
  try {
    var e =
        'undefined' != typeof window
          ? window
          : 'undefined' != typeof global
            ? global
            : 'undefined' != typeof globalThis
              ? globalThis
              : 'undefined' != typeof self
                ? self
                : {},
      n = new e.Error().stack
    n &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[n] = '26908714-2da8-5e12-b5bd-ef33dfb6ddde'))
  } catch (e) {}
})()
//# debugId=26908714-2da8-5e12-b5bd-ef33dfb6ddde
