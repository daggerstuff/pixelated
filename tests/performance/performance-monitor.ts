import type { Page } from '@playwright/test'

/**
 * Augment window with performance metrics properties
 */
declare global {
  interface Window {
    largestContentfulPaint: number
    cumulativeLayoutShift: number
    totalBlockingTime: number
    firstInputDelay: number
  }
}

/**
 * Performance monitoring script to inject into pages during testing
 * Captures key Web Vitals metrics and makes them available globally for testing
 */

export const PERFORMANCE_MONITORING_SCRIPT = `
// Performance metrics observer initialization
(function() {
  // Store metrics in global window object for test access
  window.largestContentfulPaint = 0;
  window.cumulativeLayoutShift = 0;
  window.totalBlockingTime = 0;
  window.firstInputDelay = 0;

  // Observer for Largest Contentful Paint
  const lcpObserver = new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    const lastEntry = entries[entries.length - 1];
    window.largestContentfulPaint = lastEntry.startTime;
  });

  try {
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {
    console.error('LCP observation not supported', e);
  }

  // Observer for Cumulative Layout Shift
  const clsObserver = new PerformanceObserver((entryList) => {
    let clsValue = 0;

    for (const entry of entryList.getEntries()) {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
      }
    }

    window.cumulativeLayoutShift = clsValue;
  });

  try {
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch (e) {
    console.error('CLS observation not supported', e);
  }

  // Observer for Total Blocking Time (using long tasks as proxy)
  const tbtObserver = new PerformanceObserver((entryList) => {
    let totalBlockingTime = 0;

    // FCP timestamp (or fallback to navigation start)
    const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
    const fcpTime = fcpEntry ? fcpEntry.startTime : 0;

    for (const entry of entryList.getEntries()) {
      // Only count blocking time after FCP
      if (entry.startTime >= fcpTime) {
        // Blocking time is any time over 50ms
        const blockingTime = entry.duration - 50;
        if (blockingTime > 0) {
          totalBlockingTime += blockingTime;
        }
      }
    }

    window.totalBlockingTime = totalBlockingTime;
  });

  try {
    tbtObserver.observe({ type: 'longtask', buffered: true });
  } catch (e) {
    console.error('Long Task observation not supported', e);
  }

  // First Input Delay
  const fidObserver = new PerformanceObserver((entryList) => {
    for (const entry of entryList.getEntries()) {
      // We only need the first input
      if (window.firstInputDelay === 0) {
        window.firstInputDelay = entry.processingStart - entry.startTime;
      }
    }
  });

  try {
    fidObserver.observe({ type: 'first-input', buffered: true });
  } catch (e) {
    console.error('FID observation not supported', e);
  }
})();
`

/**
 * Helper to inject the performance monitoring script into a page
 */
export async function injectPerformanceMonitoring(page: Page) {
  await page.addInitScript(PERFORMANCE_MONITORING_SCRIPT)
}

/**
 * Helper to extract performance metrics from a page
 */
export async function extractPerformanceMetrics(page: Page) {
  return page.evaluate(() => {
    return {
      fcp:
        performance.getEntriesByName('first-contentful-paint')[0]?.startTime ||
        0,
      lcp: window.largestContentfulPaint || 0,
      cls: window.cumulativeLayoutShift || 0,
      tbt: window.totalBlockingTime || 0,
      fid: window.firstInputDelay || 0,
      // Navigation timing
      navigationTiming: performance.getEntriesByType('navigation')[0] || {},
      // Resource timing entries
      resources: performance.getEntriesByType('resource'),
    }
  })
}
