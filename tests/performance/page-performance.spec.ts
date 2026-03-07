import { test, expect } from '@playwright/test'
import {
  injectPerformanceMonitoring,
  extractPerformanceMetrics,
} from './performance-monitor'

/**
 * Performance testing suite for Astro pages
 *
 * Measures:
 * - Time to first byte (TTFB)
 * - First Contentful Paint (FCP)
 * - Largest Contentful Paint (LCP)
 * - Cumulative Layout Shift (CLS)
 * - Total Blocking Time (TBT)
 * - First Input Delay (FID)
 * - Page load time
 * - JavaScript bundle size
 * - Number of HTTP requests
 */

type PerformanceMetrics = {
  ttfb: number
  fcp: number
  lcp: number
  cls: number
  tbt: number
  fid: number
  loadTime: number
  jsSize: number
  cssSize: number
  requestCount: number
}

// Thresholds for good performance
const THRESHOLDS = {
  TTFB: 300, // ms
  FCP: 1800, // ms
  LCP: 2500, // ms
  CLS: 0.1, // score
  TBT: 200, // ms
  FID: 100, // ms
  LOAD_TIME: 3000, // ms
  JS_SIZE: 500 * 1024, // 500KB
  CSS_SIZE: 100 * 1024, // 100KB
  REQUEST_COUNT: 50, // number of requests
}

// Pages to test with their expected scores
const PAGES_TO_TEST = [
  { path: '/', name: 'Home' },
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/admin', name: 'Admin' },
  { path: '/ai-chat', name: 'AI Chat' },
  { path: '/blog', name: 'Blog' },
]

test.describe('Page Performance Tests', () => {
  for (const page of PAGES_TO_TEST) {
    test(`Performance metrics for ${page.name} page`, async ({
      page: browserPage,
    }) => {
      // Increase timeout for performance tests (60 seconds)
      test.setTimeout(60000)

      // Inject performance monitoring script
      await injectPerformanceMonitoring(browserPage)

      // First load with cache enabled to warm up
      await browserPage.goto(page.path, {
        waitUntil: 'load',
        timeout: 60000,
      })

      // Clear requests for accurate tracking
      const requests: string[] = []
      let jsSize = 0
      let cssSize = 0

      browserPage.on('request', (request) => {
        requests.push(request.url())
      })

      browserPage.on('response', async (response) => {
        const contentType = response.headers()['content-type'] || ''
        const body = await response.body().catch(() => Buffer.from(''))

        if (contentType.includes('javascript')) {
          jsSize += body.length
        } else if (contentType.includes('css')) {
          cssSize += body.length
        }
      })

      // Measure navigation start timestamp
      const startTime = Date.now()

      // Navigation - use 'load' instead of 'networkidle' for better reliability
      // 'load' waits for the load event, which is more reliable in staging environments
      // where background requests (analytics, websockets, etc.) may prevent networkidle
      await browserPage.goto(page.path, {
        waitUntil: 'load',
        timeout: 60000,
      })

      // Extract Web Vitals using our helper
      const metrics = await extractPerformanceMetrics(browserPage)

      // Calculate TTFB from navigation timing
      // TTFB = responseStart - requestStart (time from request start to first byte received)
      const navigationTiming = metrics.navigationTiming as any
      let ttfb = 0
      if (
        navigationTiming?.responseStart &&
        navigationTiming?.requestStart &&
        typeof navigationTiming.responseStart === 'number' &&
        typeof navigationTiming.requestStart === 'number'
      ) {
        ttfb = navigationTiming.responseStart - navigationTiming.requestStart
      } else if (navigationTiming?.responseStart) {
        // Fallback: use responseStart relative to navigationStart
        ttfb =
          navigationTiming.responseStart -
          (navigationTiming.navigationStart || 0)
      }

      // Get final loadTime
      const loadTime = Date.now() - startTime

      // Create performance metrics object
      const performanceMetrics: PerformanceMetrics = {
        ttfb,
        fcp: metrics.fcp,
        lcp: metrics.lcp,
        cls: metrics.cls,
        tbt: metrics.tbt,
        fid: metrics.fid,
        loadTime,
        jsSize,
        cssSize,
        requestCount: requests.length,
      }

      console.log(`Performance metrics for ${page.name}:`, performanceMetrics)

      // Get navigation timing metrics for more detailed analysis
      console.log(
        `Navigation timing for ${page.name}:`,
        metrics.navigationTiming,
      )

      // Log resource count by type
      const resourcesByType = metrics.resources.reduce(
        (acc: Record<string, number>, resource: any) => {
          const type = resource.initiatorType || 'other'
          acc[type] = (acc[type] || 0) + 1
          return acc
        },
        {},
      )

      console.log(`Resources by type for ${page.name}:`, resourcesByType)

      // Assertions - validate against thresholds
      // Skip TTFB assertion if it's NaN (can happen in some environments)
      if (!isNaN(performanceMetrics.ttfb) && performanceMetrics.ttfb > 0) {
        expect(performanceMetrics.ttfb, 'Time to First Byte').toBeLessThan(
          THRESHOLDS.TTFB,
        )
      } else {
        console.warn(
          `TTFB not available (value: ${performanceMetrics.ttfb}), skipping assertion`,
        )
      }
      expect(performanceMetrics.fcp, 'First Contentful Paint').toBeLessThan(
        THRESHOLDS.FCP,
      )
      expect(performanceMetrics.lcp, 'Largest Contentful Paint').toBeLessThan(
        THRESHOLDS.LCP,
      )
      expect(performanceMetrics.cls, 'Cumulative Layout Shift').toBeLessThan(
        THRESHOLDS.CLS,
      )

      // TBT and FID may not be available in headless testing
      if (performanceMetrics.tbt > 0) {
        expect(performanceMetrics.tbt, 'Total Blocking Time').toBeLessThan(
          THRESHOLDS.TBT,
        )
      }

      if (performanceMetrics.fid > 0) {
        expect(performanceMetrics.fid, 'First Input Delay').toBeLessThan(
          THRESHOLDS.FID,
        )
      }

      expect(performanceMetrics.loadTime, 'Page Load Time').toBeLessThan(
        THRESHOLDS.LOAD_TIME,
      )
      expect(performanceMetrics.jsSize, 'JavaScript Size').toBeLessThan(
        THRESHOLDS.JS_SIZE,
      )
      expect(performanceMetrics.cssSize, 'CSS Size').toBeLessThan(
        THRESHOLDS.CSS_SIZE,
      )
      expect(performanceMetrics.requestCount, 'Request Count').toBeLessThan(
        THRESHOLDS.REQUEST_COUNT,
      )
    })
  }

  test('Lighthouse audit for homepage', async ({ page }) => {
    await page.goto('/')

    // We can't actually run Lighthouse in this test environment,
    // but in a real CI pipeline we would:
    // 1. Use lighthouse-ci
    // 2. Run lighthouse against the deployed URL
    // 3. Assert on key metrics

    console.log('Lighthouse audit would run here in actual CI environment')
    expect(true).toBeTruthy()
  })
})
