/**
 * Dynamic Polyfill Loader
 *
 * This module provides a client-side polyfill loading system that:
 * 1. Detects browser capabilities
 * 2. Loads only necessary polyfills
 * 3. Reports polyfill usage for analytics
 * 4. Handles both critical and non-critical polyfills
 */

// Track which polyfills were loaded for analytics
const loadedPolyfills = []

// Feature detection helpers
const features = {
  IntersectionObserver: () => 'IntersectionObserver' in window,
  ResizeObserver: () => 'ResizeObserver' in window,
  CustomElements: () => 'customElements' in window,
  ShadowDOM: () => Element.prototype.attachShadow !== undefined,
  Fetch: () => 'fetch' in window,
  Promise: () => 'Promise' in window,
  URLPattern: () => 'URLPattern' in window,
  WebAnimations: () => Element.prototype.animate !== undefined,
  AbortController: () => 'AbortController' in window,
  ObjectFromEntries: () => 'fromEntries' in Object,
  ArrayFindLast: () => 'findLast' in Array.prototype,
  ArrayAt: () => 'at' in Array.prototype,
  StringReplaceAll: () => 'replaceAll' in String.prototype,
  PromiseWithResolvers: () => 'withResolvers' in Promise,
  LocalStorage: () => {
    try {
      return 'localStorage' in window
    } catch {
      return false
    }
  },
  CSSVariables: () => {
    try {
      return (
        window.CSS && window.CSS.supports && window.CSS.supports('--a', '0')
      )
    } catch {
      return false
    }
  },
}

// Load a script dynamically
function loadScript(src, async = true) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = async
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}

// Load critical polyfills first - these are needed for core functionality
async function loadCriticalPolyfills() {
  const polyfillsToLoad = []

  // These are required for the application to function at all
  if (!features.Promise()) {
    polyfillsToLoad.push(
      loadScript('/polyfills/promise-polyfill.min.js', false),
    )
    loadedPolyfills.push('Promise')
  }

  if (!features.Fetch()) {
    polyfillsToLoad.push(loadScript('/polyfills/fetch.umd.js', false))
    loadedPolyfills.push('Fetch')
  }

  // Wait for all critical polyfills to load
  await Promise.all(polyfillsToLoad)

  // Signal that critical polyfills are loaded
  window.__CRITICAL_POLYFILLS_LOADED = true

  // Dispatch an event that other code can listen for
  if (typeof CustomEvent === 'function') {
    document.dispatchEvent(new CustomEvent('criticalPolyfillsLoaded'))
  }
}

// Load non-critical polyfills that improve functionality but aren't essential
async function loadEnhancementPolyfills() {
  const polyfillsToLoad = []

  // For modern DOM APIs
  if (!features.IntersectionObserver()) {
    polyfillsToLoad.push(loadScript('/polyfills/intersection-observer.js'))
    loadedPolyfills.push('IntersectionObserver')
  }

  if (!features.ResizeObserver()) {
    polyfillsToLoad.push(loadScript('/polyfills/resize-observer-polyfill.js'))
    loadedPolyfills.push('ResizeObserver')
  }

  if (!features.CustomElements()) {
    polyfillsToLoad.push(loadScript('/polyfills/custom-elements.min.js'))
    loadedPolyfills.push('CustomElements')
  }

  if (!features.WebAnimations()) {
    polyfillsToLoad.push(loadScript('/polyfills/web-animations.min.js'))
    loadedPolyfills.push('WebAnimations')
  }

  if (!features.ObjectFromEntries()) {
    polyfillsToLoad.push(loadScript('/polyfills/object-fromentries.js'))
    loadedPolyfills.push('ObjectFromEntries')
  }

  // Wait for enhancement polyfills
  await Promise.all(polyfillsToLoad)

  // Signal that enhancement polyfills are loaded
  window.__ENHANCEMENT_POLYFILLS_LOADED = true

  // Dispatch event
  if (typeof CustomEvent === 'function') {
    document.dispatchEvent(new CustomEvent('enhancementPolyfillsLoaded'))
  }
}

// Function to use service-based polyfills (polyfill.io) for less critical features
function loadServicePolyfills() {
  // Create an array of features to load from polyfill.io service
  const serviceFeatures = []

  // Check for ES2022+ features
  if (!features.ArrayAt()) {
    serviceFeatures.push('Array.prototype.at')
  }
  if (!features.StringReplaceAll()) {
    serviceFeatures.push('String.prototype.replaceAll')
  }
  if (!features.PromiseWithResolvers()) {
    serviceFeatures.push('Promise.withResolvers')
  }
  if (!features.ArrayFindLast()) {
    serviceFeatures.push('Array.prototype.findLast')
  }

  // Only load if needed
  if (serviceFeatures.length > 0) {
    // Build URL
    const polyfillUrl = `https://polyfill.io/v3/polyfill.min.js?features=${serviceFeatures.join(',')}`

    // Load via service
    loadScript(polyfillUrl)

    // Track what we loaded
    loadedPolyfills.push(...serviceFeatures)
  }
}

// Report polyfill usage for analytics
function reportPolyfillUsage() {
  if (
    loadedPolyfills.length > 0 &&
    'navigator' in window &&
    'sendBeacon' in navigator
  ) {
    try {
      const data = {
        userAgent: navigator.userAgent,
        polyfills: loadedPolyfills,
        timestamp: new Date().toISOString(),
        url: window.location.pathname,
      }

      // Using sendBeacon to avoid blocking page unload
      navigator.sendBeacon('/api/analytics/polyfills', JSON.stringify(data))
    } catch (e) {
      console.error('Error reporting polyfill usage:', e)
    }
  }
}

// Initialize polyfill loading
async function initPolyfills() {
  // Load critical polyfills first and wait for them
  await loadCriticalPolyfills()

  // Load enhancement polyfills in parallel - don't wait
  loadEnhancementPolyfills()

  // Load service polyfills in parallel - don't wait
  loadServicePolyfills()

  // Report usage before page unload
  window.addEventListener('unload', reportPolyfillUsage)
}

// Export for module use
export {
  initPolyfills,
  loadCriticalPolyfills,
  loadEnhancementPolyfills,
  features,
}

// Auto-run if loaded directly (not as module)
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPolyfills)
  } else {
    initPolyfills()
  }
}
