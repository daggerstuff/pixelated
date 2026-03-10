/**
 * Browser environment setup
 * This module handles browser feature detection, polyfill loading,
 * and initializes browser-specific functionality
 */

import {
  initializeFeatureDetection,
  loadPolyfills,
  getAllFeatures,
} from './feature-detection'
import { setupCSSPolyfills } from './css-polyfills'

/**
 * Setup browser environment
 * Initializes feature detection, loads polyfills, and sets up browser-specific functionality
 */
export async function setupBrowserEnvironment(): Promise<void> {
  try {
    logger.info('Setting up browser environment')

    // Initialize feature detection
    initializeFeatureDetection()

    // Initialize CSS polyfills in parallel with JS polyfills
    setupCSSPolyfills()

    // Load polyfills based on feature detection
    await loadPolyfills()

    // Log detected features in development
    if (import.meta.env.DEV) {
      const features = getAllFeatures()
      logger.debug('Detected browser features:', features)

      // Check for critical missing features
      const criticalFeatures = [
        'Promise',
        'Fetch',
        'IntersectionObserver',
        'CustomElements',
        'ResizeObserver',
      ]
      const missingCritical = criticalFeatures.filter(
        (feature) => !features[feature],
      )

      if (missingCritical.length > 0) {
        logger.warn('Missing critical browser features:', missingCritical)
      }
    }

    // Set up additional browser-specific functionality
    setupViewportHeightFix()
    setupTouchDeviceDetection()
    setupPrefersReducedMotion()
    setupReducedDataDetection()
    setupHighContrastDetection()

    // Set up device-specific fixes
    setupDeviceSpecificFixes()

    logger.info('Browser environment setup complete')
  } catch (error: unknown) {
    logger.error('Error setting up browser environment:', error)
  }
}

/**
 * Fix viewport height issues on mobile devices
 * This addresses the iOS viewport height issue with the virtual keyboard
 */
function setupViewportHeightFix() {
  if (typeof window === 'undefined') {
    return
  }

  // Fix for mobile viewport height (especially iOS)
  const setVhProperty = () => {
    // First we get the viewport height and we multiply it by 1% to get a value for a vh unit
    const vh = window.innerHeight * 0.01
    // Then we set the value in the --vh custom property to the root of the document
    document.documentElement.style.setProperty('--vh', `${vh}px`)
  }

  // Set the initial value
  setVhProperty()

  // Update on resize and orientation change
  window.addEventListener('resize', setVhProperty)
  window.addEventListener('orientationchange', setVhProperty)
}

/**
 * Detect touch-capable devices and add appropriate class to document
 */
function setupTouchDeviceDetection() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return
  }

  const isTouchDevice =
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    ((navigator as unknown as { msMaxTouchPoints?: number }).msMaxTouchPoints ??
      0) > 0

  if (isTouchDevice) {
    document.documentElement.classList.add('touch-device')
  } else {
    document.documentElement.classList.add('no-touch')
  }
}

/**
 * Detect reduced motion preference and add appropriate class to document
 */
function setupPrefersReducedMotion() {
  if (typeof window === 'undefined') {
    return
  }

  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

  const updateReducedMotionClass = () => {
    if (mediaQuery.matches) {
      document.documentElement.classList.add('reduced-motion')
    } else {
      document.documentElement.classList.remove('reduced-motion')
    }
  }

  // Set initial state
  updateReducedMotionClass()

  // Watch for changes
  mediaQuery.addEventListener('change', updateReducedMotionClass)
}

/**
 * Detect save-data preference for users on limited data plans
 */
function setupReducedDataDetection() {
  if (typeof navigator === 'undefined') {
    return
  }

  // Check if the Save-Data header is present
  const { connection } = navigator as unknown as {
    connection?: { saveData?: boolean }
  }
  const saveData =
    connection?.saveData ||
    /save-data=on/.test(document.cookie) ||
    /save-data=on/.test(navigator.userAgent)

  if (saveData) {
    document.documentElement.classList.add('save-data')
  }
}

/**
 * Detect high contrast mode / forced colors mode
 */
function setupHighContrastDetection() {
  if (typeof window === 'undefined') {
    return
  }

  const mediaQuery = window.matchMedia('(forced-colors: active)')

  const updateHighContrastClass = () => {
    if (mediaQuery.matches) {
      document.documentElement.classList.add('high-contrast')
    } else {
      document.documentElement.classList.remove('high-contrast')
    }
  }

  // Set initial state
  updateHighContrastClass()

  // Watch for changes
  mediaQuery.addEventListener('change', updateHighContrastClass)
}

/**
 * Apply fixes specific to certain devices or browsers
 */
function setupDeviceSpecificFixes() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return
  }

  const userAgent = navigator.userAgent.toLowerCase()

  // iOS specific fixes
  if (/iphone|ipad|ipod/.test(userAgent)) {
    document.documentElement.classList.add('ios')

    // Fix for overscroll behavior
    document.body.style.overscrollBehavior = 'none'

    // Fix for 100vh issue
    document.documentElement.classList.add('ios-viewport-fix')
  }

  // Safari specific fixes (including macOS)
  if (/safari/.test(userAgent) && !/chrome/.test(userAgent)) {
    document.documentElement.classList.add('safari')

    // Fix for position:sticky support
    document.documentElement.classList.add('safari-sticky-fix')
  }

  // Firefox specific fixes
  if (/firefox/.test(userAgent)) {
    document.documentElement.classList.add('firefox')
  }
}

/**
 * Initialize the browser environment as soon as possible
 * but wait for DOM to be ready
 */
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupBrowserEnvironment()
    })
  } else {
    setupBrowserEnvironment()
  }
}
