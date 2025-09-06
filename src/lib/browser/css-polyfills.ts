/**
 * CSS Polyfills and Feature Detection
 * This module provides utilities for detecting CSS feature support
 * and applying polyfills or fallbacks as needed.
 */

interface CSSFeature {
  name: string
  property: string
  value: string
  fallback?: {
    properties: Record<string, string>
  }
}

// Registry of CSS feature support status
const cssFeatureSupport = new Map<string, boolean>()

/**
 * List of CSS features to detect
 */
export const CSS_FEATURES: CSSFeature[] = [
  {
    name: 'grid',
    property: 'display',
    value: 'grid',
    fallback: {
      properties: {
        'display': 'flex',
        'flex-wrap': 'wrap',
      },
    },
  },
  {
    name: 'flexbox',
    property: 'display',
    value: 'flex',
    fallback: {
      properties: {
        display: 'block',
      },
    },
  },
  {
    name: 'customProperties',
    property: '--test',
    value: 'value',
    fallback: {
      properties: {},
    },
  },
  {
    name: 'clipPath',
    property: 'clip-path',
    value: 'inset(0)',
    fallback: {
      properties: {
        overflow: 'hidden',
      },
    },
  },
  {
    name: 'aspectRatio',
    property: 'aspect-ratio',
    value: '1/1',
    fallback: {
      properties: {
        'position': 'relative',
        'padding-top': '100%',
      },
    },
  },
  {
    name: 'backdrop-filter',
    property: 'backdrop-filter',
    value: 'blur(1px)',
    fallback: {
      properties: {
        'background-color': 'rgba(0, 0, 0, 0.5)',
      },
    },
  },
]

/**
 * Initialize CSS feature detection
 */
export function initializeCSSFeatureDetection() {
  if (typeof window === 'undefined' || !window.CSS || !window.CSS.supports) {
    // If CSS.supports is not available, assume no support for modern CSS
    CSS_FEATURES.forEach((feature) => {
      registerCSSFeature(feature.name, false)
    })
    return
  }

  // Test each feature
  CSS_FEATURES.forEach((feature) => {
    const isSupported = window.CSS.supports(feature.property, feature.value)
    registerCSSFeature(feature.name, isSupported)

    // Add appropriate class to document root for styling hooks
    if (!isSupported && typeof document !== 'undefined') {
      document.documentElement.classList.add(`no-${feature.name}`)
    }
  })
}

/**
 * Register a CSS feature's support status
 */
export function registerCSSFeature(
  featureName: string,
  isSupported: boolean,
): void {
  cssFeatureSupport.set(featureName, isSupported)
}

/**
 * Check if a specific CSS feature is supported
 */
export function supportsCSSFeature(featureName: string): boolean {
  return cssFeatureSupport.get(featureName) === true
}

/**
 * Apply CSS fallbacks to an element for unsupported features
 * This can be used to programmatically apply fallbacks
 */
export function applyCSSFallbacks(
  element: HTMLElement,
  requiredFeatures: string[],
): void {
  if (typeof window === 'undefined') {
    return
  }

  // Initialize detection if not already done
  if (cssFeatureSupport.size === 0) {
    initializeCSSFeatureDetection()
  }

  // Apply fallbacks for each unsupported feature
  requiredFeatures.forEach((featureName) => {
    if (!supportsCSSFeature(featureName)) {
      const feature = CSS_FEATURES.find((f) => f.name === featureName)
      if (feature?.fallback) {
        // Apply fallback properties
        Object.entries(feature.fallback.properties).forEach(
          ([property, value]) => {
            element.style.setProperty(property, value)
          },
        )
      }
    }
  })
}

/**
 * Generate fallback CSS for specific features
 * This can be used to generate CSS custom properties for fallbacks
 */
export function generateCSSFallbacks(): Record<string, string> {
  const fallbacks: Record<string, string> = {}

  // Generate CSS custom properties for fallbacks
  CSS_FEATURES.forEach((feature) => {
    if (feature.fallback) {
      Object.entries(feature.fallback.properties).forEach(
        ([property, value]) => {
          fallbacks[`--${feature.name}-fallback-${property}`] = value
        },
      )
    }
  })

  return fallbacks
}

/**
 * Initialize CSS feature detection and apply document-level classes
 * Call this early in the application lifecycle
 */
export function setupCSSPolyfills() {
  if (typeof document === 'undefined') {
    return
  }

  // Initialize feature detection
  initializeCSSFeatureDetection()

  // Add a global class that indicates polyfills are active
  document.documentElement.classList.add('css-polyfills-active')

  // Apply fallback CSS custom properties to document root
  const fallbacks = generateCSSFallbacks()
  Object.entries(fallbacks).forEach(([property, value]) => {
    document.documentElement.style.setProperty(property, value)
  })
}
