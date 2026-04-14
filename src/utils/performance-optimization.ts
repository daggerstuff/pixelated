/**
 * Performance Optimization Utilities
 *
 * This file contains utilities to optimize Core Web Vitals and other performance metrics.
 */

/**
 * Instruments the application to collect and report Core Web Vitals and other key performance metrics.
 *
 * This function sets up side-effectful instrumentation. It initializes `PerformanceObserver`s for
 * Largest Contentful Paint (LCP), Cumulative Layout Shift (CLS), First Input Delay (FID - Legacy),
 * and First Contentful Paint (FCP). It also captures Time to First Byte (TTFB) from navigation entries.
 *
 * These metrics are crucial for monitoring the real-world user experience and identifying performance bottlenecks.
 *
 * @remarks
 * While instrumentation (observers) may be initialized, console logging is conditionally enabled.
 * It will only log metrics if the `NODE_ENV` environment variable is set to `"development"`,
 * or if the `ENABLE_METRICS` environment variable is set to `"true"`.
 *
 * Note: FID is considered a legacy metric; Interaction to Next Paint (INP) is the current primary
 * interaction metric for Core Web Vitals.
 *
 * @returns {void} This function performs side-effectful instrumentation and does not return a value.
 *
 * @example
 * ```typescript
 * // In a top-level application entry point:
 * import { reportWebVitals } from "./utils/performance-optimization";
 *
 * reportWebVitals();
 * ```
 */
export function reportWebVitals(): void {
  if (typeof window !== 'undefined') {
    try {
      // Only report in development or when explicitly enabled
      if (
        process.env['NODE_ENV'] === 'development' ||
        process.env['ENABLE_METRICS'] === 'true'
      ) {
        // Report Largest Contentful Paint (via PerformanceObserver)
        reportLCP()

        // Report Cumulative Layout Shift (via PerformanceObserver)
        reportCLS()

        // Report First Input Delay (Legacy - via PerformanceObserver)
        reportFID()

        // Report First Contentful Paint (via PerformanceObserver)
        reportFCP()

        // Report Time to First Byte (via navigation timing entries)
        reportTTFB()
      }
    } catch {
      console.error('Error initializing Web Vitals reporting')
    }
  }
}

// Define interfaces for Performance entries
interface LargestContentfulPaintEntry extends PerformanceEntry {
  element?: Element
  size: number
  renderTime?: number
  loadTime?: number
}

interface LayoutShiftEntry extends PerformanceEntry {
  value: number
  hadRecentInput: boolean
}

interface FirstInputEntry extends PerformanceEntry {
  processingStart: number
}

/**
 * Reports Largest Contentful Paint (LCP)
 * Uses PerformanceObserver to track the largest image or text block rendered in the viewport.
 */
function reportLCP() {
  try {
    const entryTypes = 'largest-contentful-paint'

    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries()
      const lastEntry = entries[
        entries.length - 1
      ] as LargestContentfulPaintEntry

      if (lastEntry) {
        const lcp = lastEntry.startTime
        const lcpElement = lastEntry.element?.tagName || 'unknown'
        const lcpSize = lastEntry.size || 0

        console.log('LCP:', {
          value: Math.round(lcp),
          rating: lcpRating(lcp),
          element: lcpElement,
          size: lcpSize,
        })
      }
    })

    observer.observe({ type: entryTypes, buffered: true })
  } catch {
    console.warn('LCP reporting not supported in this browser')
  }
}

/**
 * Reports Cumulative Layout Shift (CLS)
 * Uses PerformanceObserver to track unexpected layout shifts during the lifespan of the page.
 */
function reportCLS() {
  try {
    let clsValue = 0
    const clsEntries: LayoutShiftEntry[] = []

    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries()

      entries.forEach((entry) => {
        if (!(entry as LayoutShiftEntry).hadRecentInput) {
          const { value } = entry as LayoutShiftEntry
          clsValue += value
          clsEntries.push(entry as LayoutShiftEntry)
        }
      })

      console.log('CLS:', {
        value: clsValue,
        rating: clsRating(clsValue),
        entries: clsEntries.length,
      })
    })

    observer.observe({ type: 'layout-shift', buffered: true })
  } catch {
    console.warn('CLS reporting not supported in this browser')
  }
}

/**
 * Reports First Input Delay (FID)
 * Legacy metric. Measures the time from when a user first interacts with a page to the
 * time when the browser is actually able to begin processing event handlers in response to that interaction.
 */
function reportFID() {
  try {
    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries()
      const firstEntry = entries[0] as FirstInputEntry

      if (firstEntry) {
        const fid = firstEntry.processingStart - firstEntry.startTime

        console.log('FID (Legacy):', {
          value: Math.round(fid),
          rating: fidRating(fid),
          type: firstEntry.name,
        })
      }
    })

    observer.observe({ type: 'first-input', buffered: true })
  } catch {
    console.warn('FID reporting not supported in this browser')
  }
}

/**
 * Reports First Contentful Paint (FCP)
 * Uses PerformanceObserver to measure the time from when the page starts loading to when any part
 * of the page's content is rendered on the screen.
 */
function reportFCP() {
  try {
    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries()
      const firstEntry = entries[0]

      if (firstEntry) {
        const fcp = firstEntry.startTime

        console.log('FCP:', {
          value: Math.round(fcp),
          rating: fcpRating(fcp),
        })
      }
    })

    observer.observe({ type: 'paint', buffered: true })
  } catch {
    console.warn('FCP reporting not supported in this browser')
  }
}

/**
 * Reports Time to First Byte (TTFB)
 * Gathered directly from performance.getEntriesByType('navigation') timing entries.
 * Measures the time between the request for a resource and when the first byte of a response begins to arrive.
 */
function reportTTFB() {
  try {
    const navigationEntries = performance.getEntriesByType('navigation')

    if (navigationEntries.length > 0) {
      const navigationEntry =
        navigationEntries[0] as PerformanceNavigationTiming
      const ttfb = navigationEntry.responseStart

      console.log('TTFB:', {
        value: Math.round(ttfb),
        rating: ttfbRating(ttfb),
      })
    }
  } catch {
    console.warn('TTFB reporting not supported in this browser')
  }
}

/**
 * Optimizes LCP by preloading critical resources
 * @param resources Array of resources to preload
 */
export function optimizeLCP(resources: string[] = []): void {
  if (typeof window === 'undefined') {
    return
  }

  // Preload critical resources
  resources.forEach((resource) => {
    try {
      // First check if the resource exists
      fetch(resource, { method: 'HEAD' })
        .then((response) => {
          if (response.ok) {
            const link = document.createElement('link')
            link.rel = 'preload'

            if (resource.endsWith('.css')) {
              link.as = 'style'
            } else if (
              resource.endsWith('.woff') ||
              resource.endsWith('.woff2') ||
              resource.endsWith('.ttf')
            ) {
              link.as = 'font'
              link.crossOrigin = 'anonymous'
            } else if (
              resource.endsWith('.jpg') ||
              resource.endsWith('.jpeg') ||
              resource.endsWith('.png') ||
              resource.endsWith('.webp')
            ) {
              link.as = 'image'
            } else if (resource.endsWith('.js')) {
              link.as = 'script'
            }

            link.href = resource
            document.head.appendChild(link)
          } else {
            console.warn(`Resource not found: ${resource}`)
          }
        })
        .catch((error) => {
          console.warn(`Failed to check resource: ${resource}`, error)
        })
    } catch {
      console.warn(`Error preloading resource: ${resource}`)
    }
  })

  // Use fetchpriority for the main LCP image if the browser supports i
  const lcpImages = document.querySelectorAll('[data-lcp-image]')
  lcpImages.forEach((img) => {
    if (img instanceof HTMLImageElement) {
      // Add loading and fetchpriority attributes for better LCP
      img.loading = 'eager'
      img.fetchPriority = 'high'
    }
  })
}

/**
 * Optimizes FID by deferring non-critical scripts and styles
 */
export function optimizeFID() {
  if (typeof document === 'undefined') {
    return
  }

  // Defer non-critical JavaScript
  const scripts = document.querySelectorAll('script:not([data-critical])')
  scripts.forEach((script) => {
    if (!script.hasAttribute('defer') && !script.hasAttribute('async')) {
      ;(script as HTMLScriptElement).defer = true
    }
  })
}

/**
 * Optimizes CLS by setting explicit dimensions for media and placeholders
 */
export function optimizeCLS() {
  if (typeof document === 'undefined') {
    return
  }

  // Find images without dimensions and add styling to prevent layout shifts
  const images = document.querySelectorAll('img:not([width]):not([height])')
  images.forEach((img) => {
    ;(img as HTMLImageElement).style.aspectRatio = '16/9'
  })

  // Find iframes without dimensions
  const iframes = document.querySelectorAll('iframe:not([width]):not([height])')
  iframes.forEach((iframe) => {
    ;(iframe as HTMLIFrameElement).style.aspectRatio = '16/9'
  })
}

/**
 * Sets up CSS containment for improved rendering performance
 * @param selector CSS selector for elements to add containment to
 * @param containmentValue CSS containment value to use
 */
export function setupContainment(
  selector: string,
  containmentValue = 'content',
): void {
  if (typeof document === 'undefined') {
    return
  }

  const elements = document.querySelectorAll(selector)
  elements.forEach((el) => {
    ;(el as HTMLElement).style.contain = containmentValue
  })
}

/**
 * Initializes all performance optimizations
 * @param options Optimization options
 */
export function initializeOptimizations(
  options: {
    lcpResources?: string[]
    clsSelectors?: string[]
    containmentSelectors?: Record<string, string>
  } = {},
): void {
  if (typeof window === 'undefined') {
    return
  }

  // Report metrics
  reportWebVitals()

  // Run optimizations
  optimizeLCP(options.lcpResources)
  optimizeFID()
  optimizeCLS()

  // Setup containment
  if (options.containmentSelectors) {
    Object.entries(options.containmentSelectors).forEach(
      ([selector, value]) => {
        setupContainment(selector, value)
      },
    )
  }

  // Add event listener for when the page is fully loaded
  window.addEventListener('load', () => {
    // Run some optimizations after load
    setTimeout(() => {
      // Clear unnecessary listeners and garbage collection
      garbageCollection()
    }, 1000) // Wait 1 second after load
  })
}

/**
 * Cleans up listeners and runs garbage collection for better performance
 */
function garbageCollection() {
  // Remove unnecessary event listeners
  const cleanupElements = document.querySelectorAll(
    '[data-cleanup-events="true"]',
  )
  cleanupElements.forEach((el) => {
    // Clone the node to remove all listeners
    const clone = el.cloneNode(true)
    if (el.parentNode) {
      el.parentNode.replaceChild(clone, el)
    }
  })
}

// Rating functions for web vitals
function lcpRating(lcp: number): 'good' | 'needs-improvement' | 'poor' {
  if (lcp <= 2500) {
    return 'good'
  }
  if (lcp <= 4000) {
    return 'needs-improvement'
  }
  return 'poor'
}

function clsRating(cls: number): 'good' | 'needs-improvement' | 'poor' {
  if (cls <= 0.1) {
    return 'good'
  }
  if (cls <= 0.25) {
    return 'needs-improvement'
  }
  return 'poor'
}

function fidRating(fid: number): 'good' | 'needs-improvement' | 'poor' {
  if (fid <= 100) {
    return 'good'
  }
  if (fid <= 300) {
    return 'needs-improvement'
  }
  return 'poor'
}

function fcpRating(fcp: number): 'good' | 'needs-improvement' | 'poor' {
  if (fcp <= 1800) {
    return 'good'
  }
  if (fcp <= 3000) {
    return 'needs-improvement'
  }
  return 'poor'
}

function ttfbRating(ttfb: number): 'good' | 'needs-improvement' | 'poor' {
  if (ttfb <= 800) {
    return 'good'
  }
  if (ttfb <= 1800) {
    return 'needs-improvement'
  }
  return 'poor'
}
