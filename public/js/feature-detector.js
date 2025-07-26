/**
 * Feature Detector
 *
 * Detects browser feature support and conditionally loads polyfills
 * for unsupported features. This provides progressive enhancement
 * while minimizing unnecessary code for modern browsers.
 */

// Feature Detection for critical browser features
;(function () {
  'use strict'

  // Prevent duplicate execution
  if (window.__FEATURE_DETECTOR_LOADED) {
    return
  }
  window.__FEATURE_DETECTOR_LOADED = true

  // Initialize global feature detection object
  window.featureDetection = window.featureDetection || {
    loadedPolyfills: [],
    features: {},
  }

  // Polyfill map - defines which files to load for each feature
  const polyfillMap = {
    webgl: null, // WebGL can't be polyfilled
    intersectionObserver: '/polyfills/intersection-observer.js',
    resizeObserver: '/polyfills/resize-observer-polyfill.js',
    customElements: '/polyfills/custom-elements.min.js',
    fetch: '/polyfills/fetch.umd.js',
    promise: '/polyfills/promise-polyfill.min.js',
    buffer: '/polyfills/buffer-polyfill.js',
  }

  // Load script helper function
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.async = true
      script.onload = () => {
        window.featureDetection.loadedPolyfills.push(src)
        resolve()
      }
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  // Basic Buffer polyfill implementation
  const BufferPolyfill = {
    from: function (data) {
      if (typeof data === 'string') {
        return new Uint8Array([...data].map((char) => char.charCodeAt(0)))
      }
      return new Uint8Array(data)
    },
    isBuffer: function (obj) {
      return obj instanceof Uint8Array
    },
  }

  // Feature detection functions
  const features = {
    webgl: (function () {
      try {
        const canvas = document.createElement('canvas')
        return !!(
          window.WebGLRenderingContext &&
          (canvas.getContext('webgl') ||
            canvas.getContext('experimental-webgl'))
        )
      } catch {
        return false
      }
    })(),
    intersectionObserver: 'IntersectionObserver' in window,
    resizeObserver: 'ResizeObserver' in window,
    customElements: 'customElements' in window,
    fetch: 'fetch' in window,
    promise: 'Promise' in window,
    buffer: 'Buffer' in window,
  }

  // Store feature detection results
  window.featureDetection.features = features

  // Determine which features are unsupported
  const unsupportedFeatures = {}
  const polyfillsToLoad = []

  for (const [feature, isSupported] of Object.entries(features)) {
    if (!isSupported) {
      unsupportedFeatures[feature] = true

      // Add polyfill to load list if available
      if (
        polyfillMap[feature] &&
        !polyfillsToLoad.includes(polyfillMap[feature])
      ) {
        polyfillsToLoad.push(polyfillMap[feature])
      }
    }
  }

  // Handle Buffer polyfill specially
  let bufferPolyfillPromise = Promise.resolve()
  if (unsupportedFeatures.buffer) {
    const bufferPolyfillUrl = polyfillMap.buffer
    if (bufferPolyfillUrl) {
      bufferPolyfillPromise = loadScript(bufferPolyfillUrl).catch((err) => {
        console.error('Failed to load Buffer polyfill', err)
        // Fallback to inline BufferPolyfill if import fails
        window.Buffer = BufferPolyfill
        window.featureDetection.loadedPolyfills.push(
          'inline-buffer-polyfill-fallback',
        )
        console.log('Using inline Buffer polyfill as fallback')
      })
    } else {
      // No external polyfill, use inline immediately
      window.Buffer = BufferPolyfill
      window.featureDetection.loadedPolyfills.push('inline-buffer-polyfill')
      console.log('Buffer polyfill loaded successfully (inline)')
    }
  }

  // Log which polyfills are being loaded
  if (polyfillsToLoad.length > 0) {
    console.log('Loading polyfills for unsupported features:', polyfillsToLoad)

    // Send analytics if available
    if (window.navigator && window.navigator.sendBeacon) {
      try {
        const polyfillData = {
          unsupportedFeatures: Object.keys(unsupportedFeatures).filter(
            (f) => unsupportedFeatures[f],
          ),
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }
        const analyticsEndpoint =
          window.ANALYTICS_ENDPOINT || '/api/analytics/polyfill-usage'
        navigator.sendBeacon(analyticsEndpoint, JSON.stringify(polyfillData))
      } catch (error) {
        console.error('Failed to send polyfill analytics', error)
      }
    }
  }

  // Load all polyfills in parallel
  Promise.all([...polyfillsToLoad.map(loadScript), bufferPolyfillPromise])
    .then(() => {
      console.log('All polyfills loaded successfully')
      window.dispatchEvent(new CustomEvent('polyfills-loaded'))
    })
    .catch((error) => {
      console.error('Failed to load some polyfills', error)
      window.dispatchEvent(
        new CustomEvent('polyfills-loaded', { detail: { error } }),
      )
    })
})()
