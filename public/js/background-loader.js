// Background and Custom Elements Loader
;(function () {
  // Make sure custom elements are properly initialized
  function initCustomElements() {
    // Force plum background to be visible
    const plumBg = document.querySelector('bg-plum')
    if (plumBg) {
      document.documentElement.classList.add('force-bg-visible')

      // If canvas is empty, force a repaint
      const canvas = plumBg.querySelector('canvas')
      if (canvas && !canvas.getContext('2d').getImageData(0, 0, 1, 1).data[3]) {
        // Force redraw
        plumBg.style.display = 'none'
        setTimeout(() => {
          plumBg.style.display = ''
        }, 10)
      }
    }

    // Ensure the globe is properly initialized
    const globeContainer = document.getElementById('globe-container')
    if (globeContainer) {
      const canvas = document.getElementById('globe-canvas')
      if (canvas && !canvas.width) {
        // Force initialization
        const event = new Event('scroll')
        window.dispatchEvent(event)
      }
    }
  }

  // Ensure fonts are loaded
  function checkFontLoading() {
    // Add a class to indicate fonts are loaded
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        document.documentElement.classList.add('fonts-loaded')
      })
    } else {
      // Fallback for browsers without font loading API
      setTimeout(() => {
        document.documentElement.classList.add('fonts-loaded')
      }, 300)
    }
  }

  // Initialize everything
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initCustomElements()
      checkFontLoading()
    })
  } else {
    initCustomElements()
    checkFontLoading()
  }

  // Also run after window load to catch any late initializations
  window.addEventListener('load', function () {
    setTimeout(initCustomElements, 100)
  })
})()
