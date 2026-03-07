// Prevent console errors for missing source maps
window.addEventListener(
  'error',
  function (event) {
    if (event && event.filename && event.filename.includes('.map')) {
      // Suppress source map loading errors
      event.preventDefault()
      return false
    }
  },
  true,
)
