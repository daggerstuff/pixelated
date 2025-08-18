/**
 * Feature detection system for browser capabilities
 * This module provides utilities for detecting browser feature support
 * and conditionally loading polyfills or alternative implementations.
 */

export interface FeatureDefinition {
  name: string
  description: string
  detectionFn: () => boolean
}

// Registry of feature support status
const featureSupport = new Map<string, boolean>()

/**
 * Map of features to detect
 * Each feature has a name, description, and detection function
 */
export const FEATURES: Record<string, FeatureDefinition> = {
  IntersectionObserver: {
    name: 'IntersectionObserver',
    description: 'API for observing visibility of elements',
    detectionFn: () =>
      typeof window !== 'undefined' && 'IntersectionObserver' in window,
  },
  ResizeObserver: {
    name: 'ResizeObserver',
    description: 'API for observing element size changes',
    detectionFn: () =>
      typeof window !== 'undefined' && 'ResizeObserver' in window,
  },
  WebAnimationsAPI: {
    name: 'WebAnimationsAPI',
    description: 'JavaScript API for animations',
    detectionFn: () =>
      typeof Element !== 'undefined' && 'animate' in Element.prototype,
  },
  CustomElements: {
    name: 'CustomElements',
    description: 'API for defining custom HTML elements',
    detectionFn: () =>
      typeof window !== 'undefined' && 'customElements' in window,
  },
  ShadowDOM: {
    name: 'ShadowDOM',
    description: 'API for encapsulated DOM and styling',
    detectionFn: () =>
      typeof Element !== 'undefined' && 'attachShadow' in Element.prototype,
  },
  CSSVariables: {
    name: 'CSSVariables',
    description: 'Support for CSS custom properties',
    detectionFn: () =>
      typeof window !== 'undefined' &&
      window.CSS &&
      window.CSS.supports &&
      window.CSS.supports('--a', '0'),
  },
  Fetch: {
    name: 'Fetch',
    description: 'Modern API for network requests',
    detectionFn: () => typeof window !== 'undefined' && 'fetch' in window,
  },
  Promise: {
    name: 'Promise',
    description: 'Support for promises',
    detectionFn: () => typeof window !== 'undefined' && 'Promise' in window,
  },
  ObjectFromEntries: {
    name: 'ObjectFromEntries',
    description: 'Object.fromEntries method',
    detectionFn: () => typeof Object !== 'undefined' && 'fromEntries' in Object,
  },
  Intl: {
    name: 'Intl',
    description: 'Internationalization API',
    detectionFn: () => typeof window !== 'undefined' && 'Intl' in window,
  },
  WebGL: {
    name: 'WebGL',
    description: '3D graphics API',
    detectionFn: () => {
      try {
        if (typeof window === 'undefined' || !document) {
          return false
        }
        const canvas = document.createElement('canvas')
        return (
          !!window.WebGLRenderingContext &&
          !!(
            canvas.getContext('webgl') ||
            canvas.getContext('experimental-webgl')
          )
        )
      } catch {
        return false
      }
    },
  },
  WebP: {
    name: 'WebP',
    description: 'WebP image format support',
    detectionFn: () => {
      if (typeof document === 'undefined') {
        return false
      }
      const elem = document.createElement('canvas')
      if (elem.getContext && elem.getContext('2d')) {
        // Check if webp dataURL can be created
        return elem.toDataURL('image/webp').indexOf('data:image/webp') === 0
      }
      return false
    },
  },
  PointerEvents: {
    name: 'PointerEvents',
    description: 'Pointer Events API',
    detectionFn: () =>
      typeof window !== 'undefined' && 'PointerEvent' in window,
  },
  ServiceWorker: {
    name: 'ServiceWorker',
    description: 'Service Worker API',
    detectionFn: () =>
      typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  },
  AbortController: {
    name: 'AbortController',
    description: 'API for aborting async operations',
    detectionFn: () =>
      typeof window !== 'undefined' && 'AbortController' in window,
  },
  WebShare: {
    name: 'WebShare',
    description: 'Web Share API',
    detectionFn: () => typeof navigator !== 'undefined' && 'share' in navigator,
  },
  WebShareFiles: {
    name: 'WebShareFiles',
    description: 'Web Share API file sharing',
    detectionFn: () => {
      try {
        return (
          typeof navigator !== 'undefined' &&
          'share' in navigator &&
          navigator.canShare &&
          navigator.canShare({ files: [] })
        )
      } catch {
        return false
      }
    },
  },
  URLPattern: {
    name: 'URLPattern',
    description: 'URL pattern matching',
    detectionFn: () => typeof window !== 'undefined' && 'URLPattern' in window,
  },
  WebAssembly: {
    name: 'WebAssembly',
    description: 'WebAssembly support',
    detectionFn: () => typeof WebAssembly === 'object',
  },
  WebCrypto: {
    name: 'WebCrypto',
    description: 'Web Cryptography API',
    detectionFn: () =>
      typeof window !== 'undefined' &&
      'crypto' in window &&
      'subtle' in window.crypto,
  },
  ES2024Features: {
    name: 'ES2024Features',
    description: 'ES2024 features like Promise.withResolvers',
    detectionFn: () => {
      try {
        return (
          typeof Promise.withResolvers === 'function' &&
          'groupBy' in Array.prototype &&
          typeof Array.prototype.findLast === 'function'
        )
      } catch {
        return false
      }
    },
  },
  SharedArrayBuffer: {
    name: 'SharedArrayBuffer',
    description: 'SharedArrayBuffer for multi-threading',
    detectionFn: () => typeof SharedArrayBuffer === 'function',
  },
  LocalStorage: {
    name: 'LocalStorage',
    description: 'LocalStorage API',
    detectionFn: () => {
      try {
        return typeof window !== 'undefined' && 'localStorage' in window
      } catch {
        return false
      }
    },
  },
  MediaQueries: {
    name: 'MediaQueries',
    description: 'Media Query API',
    detectionFn: () => typeof window !== 'undefined' && 'matchMedia' in window,
  },
}

/**
 * Initialize the feature detection system
 * Tests all defined features and registers their support status
 */
export function initializeFeatureDetection() {
  if (typeof window === 'undefined') {
    return // Skip on server-side
  }

  for (const [featureKey, feature] of Object.entries(FEATURES)) {
    try {
      const isSupported = feature.detectionFn()
      registerFeature(featureKey, isSupported)
    } catch (error: unknown) {
      console.error(`Error detecting feature ${featureKey}:`, error)
      registerFeature(featureKey, false) // Assume not supported on error
    }
  }

  // Expose features to window for debugging and testing
  if (process.env['NODE_ENV'] !== 'production') {
    ;(
      window as Window & { __FEATURES__?: Record<string, boolean> }
    ).__FEATURES__ = Object.fromEntries(featureSupport)
  }
}

/**
 * Register a feature's support status
 */
export function registerFeature(
  featureName: string,
  isSupported: boolean,
): void {
  featureSupport.set(featureName, isSupported)
}

/**
 * Check if a specific feature is supported
 */
export function supportsFeature(featureName: string): boolean {
  return featureSupport.get(featureName) === true
}

/**
 * Get all registered features and their support status
 */
export function getAllFeatures(): Record<string, boolean> {
  return Object.fromEntries(featureSupport)
}

/**
 * Conditionally execute code based on feature support
 * @param featureName The feature to check
 * @param supportedCallback Function to run if feature is supported
 * @param fallbackCallback Function to run if feature is not supported
 */
export function withFeature<T>(
  featureName: string,
  supportedCallback: () => T,
  fallbackCallback?: () => T,
): T {
  const isSupported = supportsFeature(featureName)

  if (isSupported) {
    return supportedCallback()
  } else if (fallbackCallback) {
    return fallbackCallback()
  }

  throw new Error(
    `Feature "${featureName}" is not supported and no fallback provided`,
  )
}

// Helper function to dynamically import a module
// This adds a layer of abstraction that helps TypeScript
// ignore the actual import path at compile time
function dynamicImport(modulePath: string): Promise<unknown> {
  return import(modulePath)
}

/**
 * Load polyfills based on feature detection
 * Returns a promise that resolves when all polyfills are loaded
 */
export async function loadPolyfills(): Promise<void> {
  const polyfillsToLoad: Promise<unknown>[] = []

  // Only load polyfills in the browser
  if (typeof window === 'undefined') {
    return
  }

  // Initialize feature detection if not already done
  if (featureSupport.size === 0) {
    initializeFeatureDetection()
  }

  // IntersectionObserver
  if (!supportsFeature('IntersectionObserver')) {
    polyfillsToLoad.push(dynamicImport('intersection-observer'))
  }

  // ResizeObserver
  if (!supportsFeature('ResizeObserver')) {
    polyfillsToLoad.push(dynamicImport('resize-observer-polyfill'))
  }

  // Fetch API
  if (!supportsFeature('Fetch')) {
    polyfillsToLoad.push(dynamicImport('whatwg-fetch'))
  }

  // Promise
  if (!supportsFeature('Promise')) {
    polyfillsToLoad.push(dynamicImport('promise-polyfill/lib/polyfill'))
  }

  // Web Animations API
  if (!supportsFeature('WebAnimationsAPI')) {
    polyfillsToLoad.push(dynamicImport('web-animations-js'))
  }

  // URL Pattern API
  if (!supportsFeature('URLPattern')) {
    polyfillsToLoad.push(dynamicImport('url-polyfill'))
  }

  // Custom Elements
  if (!supportsFeature('CustomElements')) {
    polyfillsToLoad.push(dynamicImport('@webcomponents/custom-elements'))
  }

  // Load core-js for broader ES features if needed
  const needsCoreJS =
    !supportsFeature('ObjectFromEntries') ||
    !supportsFeature('ES2024Features') ||
    !supportsFeature('AbortController')

  if (needsCoreJS) {
    // Load a minimal set of core-js polyfills
    polyfillsToLoad.push(dynamicImport('core-js/features/object/from-entries'))
    polyfillsToLoad.push(dynamicImport('core-js/features/array/find-last'))
    polyfillsToLoad.push(dynamicImport('core-js/features/string/replace-all'))
  }

  // Wait for all polyfills to load
  await Promise.all(polyfillsToLoad)
}

// Example PHI audit logging - uncomment and customize as needed
// logger.info('Accessing PHI data', {
//   userId: 'user-id-here',
//   action: 'read',
//   dataType: 'patient-record',
//   recordId: 'record-id-here'
// });
