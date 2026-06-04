// Prevent console errors for missing source maps
window.addEventListener(
  'error',
  function (event) {
    if (event?.filename?.includes('.map')) {
      // Suppress source map loading errors
      event.preventDefault()
      return false
    }
    // Let other errors propagate normally
    return true
  },
  true,
)
