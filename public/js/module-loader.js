// Module Loader for Three.js components
;(function () {
  // Check if modules are supported
  const supportsModules = 'noModule' in document.createElement('script')

  // Create a module preloader for Three.js
  const preloadThreeModule = function () {
    // Skip if not supported

    if (!supportsModules) {
      return
    }

    // Only preload if we have a component that needs it
    const hasGlobe = document.getElementById('globe-container')
    const hasPlum = document.querySelector('bg-plum')

    if (hasGlobe || hasPlum) {
      // Create a preload link for Three.js
      const preloadLink = document.createElement('link')
      preloadLink.rel = 'modulepreload'
      preloadLink.href = '/_astro/three.module.js'
      document.head.appendChild(preloadLink)

      // Also preload the custom modules
      if (hasGlobe) {
        const globeModule = document.createElement('link')
        globeModule.rel = 'modulepreload'
        globeModule.href =
          '/_astro/SpinningGlobe.astro_astro_type_script_index_0.js'
        document.head.appendChild(globeModule)
      }
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preloadThreeModule)
  } else {
    preloadThreeModule()
  }
})()
