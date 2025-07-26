import type { Browser, Page } from 'playwright'
import fs from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

// Browser performance types
interface PerformanceNavigationEntry extends PerformanceEntry {
  domContentLoadedEventEnd: number
  domContentLoadedEventStart: number
  domComplete: number
  loadEventEnd: number
  loadEventStart: number
}

interface PerformancePaintEntry extends PerformanceEntry {
  name: string
  startTime: number
}

// Not using these interfaces directly as we're using intermediate type casting
// Instead defining the types inline where they're used
interface PerformanceResourceEntry extends PerformanceEntry {
  encodedBodySize: number
}

// Define proper types for performance results
interface PageMetrics {
  url: string
  navigationTime: number
  LCP: number
  CLS: number
  FCP: number
  domContentLoaded: number
  domComplete: number
  loadEvent: number
  resourceCounttt: number
  resourceSize: number
  jsSize: number
  jsExecutionTime: number
  FID?: number
}

interface ApiMetrics {
  method: string
  responseTime: number
  status: number
}

interface PerformanceResults {
  timestamp: string
  environment: string
  pages: Record<string, PageMetrics>
  api: Record<string, ApiMetrics>
}

const PERFORMANCE_THRESHOLDS = {
  // Core Web Vitals thresholds
  LCP: 2500, // Largest Contentful Paint (ms) - 2.5s is "good"
  FID: 100, // First Input Delay (ms) - 100ms is "good"
  CLS: 0.1, // Cumulative Layout Shift - 0.1 is "good"

  // Additional metrics
  FCP: 1800, // First Contentful Paint (ms)
  TTI: 3800, // Time to Interactive (ms)
  TBT: 200, // Total Blocking Time (ms)

  // Resource metrics
  resourceCounttt: 100, // Maximum number of resources
  resourceSize: 3 * 1024 * 1024, // Maximum total resource size (_3MB)

  // JavaScript execution
  jsExecutionTime: 1000, // Maximum JS execution time (ms)

  // Response time
  apiResponseTime: 500, // Maximum API response time (ms)
}

// Performance metrics type
interface EvaluatedMetrics {
  LCP: number
  CLS: number
  FCP: number
  domContentLoaded: number
  domComplete: number
  loadEvent: number
  resourceCounttt: number
  resourceSize: number
}

// Pages to test
const TEST_PAGES = [
  { path: '/', name: 'Home Page' },
  { path: '/app/dashboard', name: 'Dashboard' },
  { path: '/app/chat', name: 'Chat' },
  { path: '/app/settings', name: 'Settings' },
]

// API endpoints to test
const API_ENDPOINTS = [
  {
    path: '/api/ai/completion',
    method: 'POST',
    payload: {
      model: 'Together-ai-default',
      messages: [{ role: 'user', content: 'Hello' }],
    },
  },
  { path: '/api/ai/usage', method: 'GET' },
]

describe('performance Tests', () => {
  let browser: Browser
  let page: Page
  let results: PerformanceResults = {
    timestamp: '',
    environment: '',
    pages: {},
    api: {},
  }

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true })
    results = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      pages: {},
      api: {},
    }
  })

  afterAll(async () => {
    await browser.close()

    // Save results to file for historical comparison
    const resultsDir = join(process.cwd(), 'performance-results')
    await fs.mkdir(resultsDir, { recursive: true })
    await fs.writeFile(
      join(
        resultsDir,
        `performance-${new Date().toISOString().replace(/:/g, '-')}.json`,
      ),
      JSON.stringify(results, null, 2),
    )
  })

  // Skip performance tests in CI environment
  const skipTests = process.env.SKIP_PERFORMANCE_TESTS === 'true'
  ;(skipTests ? describe.skip : describe)('core Web Vitals', () => {
    // Test Core Web Vitals and other metrics for each page
    TEST_PAGES.forEach(({ path, name }) => {
      it(`core Web Vitals - `, async () => {
        page = await browser.newPage()

        // Enable JS profiling
        await page.coverage.startJSCoverage()

        // Navigate to the page
        const startTime = performance.now()
        await page.goto(`http://localhost:3000${path}`, {
          waitUntil: 'networkidle',
        })
        const navigationTime = performance.now() - startTime

        // Collect performance metrics
        const metrics = await page.evaluate(() => {
          // Using type assertion with unknown as intermediate step for safer conversion
          const perfEntries = performance.getEntriesByType(
            'navigation',
          )[0] as unknown as PerformanceNavigationEntry
          const paintEntries = performance.getEntriesByType(
            'paint',
          ) as unknown as PerformancePaintEntry[]

          // Use type assertion for custom browser API methods
          const lcpEntry = (
            performance as unknown as {
              getEntriesByType: (type: string) => { startTime: number }[]
            }
          ).getEntriesByType('largest-contentful-paint')[0] || { startTime: 0 }

          const layoutShiftEntries =
            (
              performance as unknown as {
                getEntriesByType: (type: string) => { value: number }[]
              }
            ).getEntriesByType('layout-shift') || []

          const resources = performance.getEntriesByType(
            'resource',
          ) as unknown as PerformanceResourceEntry[]
          const resourceCounttt = resources.length
          const resourceSize = resources.reduce(
            (total, resource) => total + resource.encodedBodySize,
            0,
          )

          // Calculate CLS
          const cumulativeLayoutShift = layoutShiftEntries.reduce(
            (total: number, entry) => total + entry.value,
            0,
          )

          // Get FCP
          const firstContentfulPaint =
            paintEntries.find(
              (entry) => entry.name === 'first-contentful-paint',
            )?.startTime || 0

          return {
            // Core Web Vitals
            LCP: lcpEntry.startTime,
            CLS: cumulativeLayoutShift,
            // We'll measure FID through interaction in a separate test

            // Additional metrics
            FCP: firstContentfulPaint,
            domContentLoaded:
              perfEntries.domContentLoadedEventEnd -
              perfEntries.domContentLoadedEventStart,
            domComplete: perfEntries.domComplete,
            loadEvent: perfEntries.loadEventEnd - perfEntries.loadEventStart,

            // Resource metrics
            resourceCounttt,
            resourceSize,
          } as EvaluatedMetrics
        })

        // Stop JS coverage
        const jsCoverage = await page.coverage.stopJSCoverage()
        const jsSize = jsCoverage.reduce(
          (total, entry) => total + (entry.source?.length || 0),
          0,
        )
        const jsExecutionTime = jsCoverage.reduce((total, entry) => {
          const functions = entry.functions || []
          return (
            total +
            functions.reduce((sum, fn) => sum + (fn.ranges[0]?.count || 0), 0)
          )
        }, 0)

        // Store all results
        results.pages[name] = {
          url: path,
          navigationTime,
          ...metrics,
          jsSize,
          jsExecutionTime,
        }

        // Assert on key metrics
        expect(metrics.LCP).toBeLessThan(PERFORMANCE_THRESHOLDS.LCP)
        expect(metrics.CLS).toBeLessThan(PERFORMANCE_THRESHOLDS.CLS)
        expect(metrics.FCP).toBeLessThan(PERFORMANCE_THRESHOLDS.FCP)
        expect(metrics.resourceCounttt).toBeLessThan(
          PERFORMANCE_THRESHOLDS.resourceCounttt,
        )
        expect(metrics.resourceSize).toBeLessThan(
          PERFORMANCE_THRESHOLDS.resourceSize,
        )
        expect(jsExecutionTime).toBeLessThan(
          PERFORMANCE_THRESHOLDS.jsExecutionTime,
        )

        await page.close()
      })

      // Test First Input Delay through simulated user interaction
      it(`first Input Delay - `, async () => {
        page = await browser.newPage()
        await page.goto(`http://localhost:3000${path}`, { waitUntil: 'load' })

        // Wait for the page to be fully interactive
        await page.waitForTimeout(500)

        // Find a clickable element
        const button = await page.$('button, a, input, [role="button"]')

        if (button) {
          // Measure time to process click
          const inputDelayPromise = page.evaluate(() => {
            return new Promise<number>((resolve) => {
              let startTime: number

              const handlePointerDown = () => {
                startTime = performance.now()
                document.removeEventListener('pointerdown', handlePointerDown)
              }

              const handlePointerUp = () => {
                const endTime = performance.now()
                document.removeEventListener('pointerup', handlePointerUp)
                resolve(endTime - startTime)
              }

              document.addEventListener('pointerdown', handlePointerDown)
              document.addEventListener('pointerup', handlePointerUp)
            })
          })

          await button.click()
          const inputDelay = await inputDelayPromise

          // Store result
          results.pages[name].FID = inputDelay

          // Assert
          expect(inputDelay).toBeLessThan(PERFORMANCE_THRESHOLDS.FID)
        } else {
          // Skip if no clickable element found
          console.warn(`No clickable element found on ${name}`)
        }

        await page.close()
      })
    })
  })

  // Test API endpoint performance
  API_ENDPOINTS.forEach(({ path, method, payload }) => {
    it(`aPI Performance - `, async () => {
      page = await browser.newPage()

      // Set up request interception for timing
      let apiResponseTime = 0
      await page.route(`**${path}`, async (route, _request) => {
        const startTime = performance.now()
        await route.continue()
        apiResponseTime = performance.now() - startTime
      })

      // Execute request
      let response
      if (method === 'GET') {
        response = await page.evaluate(async (url: string) => {
          const response = await fetch(url)
          return {
            status: response.status,
            ok: response.ok,
          }
        }, `http://localhost:3000${path}`)
      } else if (method === 'POST') {
        response = await page.evaluate(
          ({ url, data }) => {
            return fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(data),
            }).then((response) => ({
              status: response.status,
              ok: response.ok,
            }))
          },
          {
            url: `http://localhost:3000${path}`,
            data: payload,
          },
        )
      }

      // Store result
      results.api[path] = {
        method,
        responseTime: apiResponseTime,
        status: response?.status ?? 0,
      }

      // Assert
      expect(apiResponseTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.apiResponseTime,
      )
      expect(response?.ok).toBe(true)

      await page.close()
    })
  })

  // Historical comparison test
  it('performance regression test', async () => {
    const resultsDir = join(process.cwd(), 'performance-results')

    try {
      // Get previous results if they exist
      const files = await fs.readdir(resultsDir)
      const jsonFiles = files.filter((file) => file.endsWith('.json'))

      if (jsonFiles.length > 0) {
        // Sort by date (newest first, excluding current test)
        jsonFiles.sort().reverse()

        // Load the most recent previous result
        const previousResults = JSON.parse(
          await fs.readFile(join(resultsDir, jsonFiles[0]), 'utf-8'),
        ) as { pages: Record<string, PageMetrics> }

        // Compare with current results
        for (const [pageName, pageMetrics] of Object.entries(results.pages)) {
          const previousPageMetrics = previousResults.pages[pageName]

          if (previousPageMetrics) {
            // Check for significant regressions (>20% worse)
            for (const metricName of ['LCP', 'FID', 'CLS', 'FCP']) {
              const current = pageMetrics[metricName as keyof PageMetrics]
              const previous =
                previousPageMetrics[metricName as keyof PageMetrics]

              if (current !== undefined && previous !== undefined) {
                const currentValue = current as number
                const previousValue = previous as number
                const percentChange =
                  ((currentValue - previousValue) / previousValue) * 100

                // Log warnings for significant regressions
                if (percentChange > 20) {
                  console.warn(
                    `Regression detected in ${pageName} - ${metricName}: ${previousValue} -> ${currentValue} (${percentChange.toFixed(2)}% worse)`,
                  )
                }

                // For critical metrics, fail the test on severe regressions (>50% worse)
                if (
                  ['LCP', 'FID', 'CLS'].includes(metricName) &&
                  percentChange > 50
                ) {
                  expect(percentChange).toBeLessThan(50)
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error in performance regression test:', err)
      throw err
    }
  })
})

export async function simulateUserInteraction(page: Page) {
  // Simulate scrolling
  await page.evaluate(() => {
    window.scrollBy(0, 500)
  })
  await page.waitForTimeout(200)

  // Find and click an interactive element
  const button = await page.$('button:not([disabled]), a:not([disabled])')
  if (button) {
    await button.click()
    await page.waitForTimeout(300)
  }

  // Type in an input if available
  const input = await page.$('input:not([disabled])')
  if (input) {
    await input.type('Test input')
    await page.waitForTimeout(200)
  }
}
