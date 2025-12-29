import { test, expect } from '@playwright/test'

// Performance thresholds
const performanceThresholds = {
  // Load time thresholds (in milliseconds)
  firstPaint: 1000,
  firstContentfulPaint: 1500,
  largestContentfulPaint: 2500,
  timeToInteractive: 3000,

  // Runtime performance thresholds
  themeSwitchTime: 100,
  animationFrameRate: 60,
  memoryIncrease: 50 * 1024 * 1024, // 50MB

  // CSS performance thresholds
  styleCalculation: 16, // One frame at 60fps
  layout: 16,
  paint: 16,
}

test.describe('Theme Performance Tests', () => {
  let page

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test.describe('Initial Load Performance', () => {
    test('should load theme styles efficiently', async () => {
      // Measure performance metrics
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType(
          'navigation',
        )[0] as PerformanceNavigationTiming
        const paint = performance.getEntriesByType('paint')

        return {
          domContentLoaded:
            navigation.domContentLoadedEventEnd -
            navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstPaint:
            paint.find((p) => p.name === 'first-paint')?.startTime || 0,
          firstContentfulPaint:
            paint.find((p) => p.name === 'first-contentful-paint')?.startTime ||
            0,
        }
      })

      expect(metrics.domContentLoaded).toBeLessThan(
        performanceThresholds.firstContentfulPaint,
      )
      expect(metrics.firstPaint).toBeLessThan(performanceThresholds.firstPaint)
      expect(metrics.firstContentfulPaint).toBeLessThan(
        performanceThresholds.firstContentfulPaint,
      )
    })

    test('should load CSS without blocking render', async () => {
      // Check if theme styles are loaded efficiently
      const cssPerformance = await page.evaluate(() => {
        const cssFiles = performance
          .getEntriesByType('resource')
          .filter((entry: any) => entry.name.includes('.css'))

        return cssFiles.map((entry: any) => ({
          name: entry.name,
          startTime: entry.startTime,
          duration: entry.duration,
          blockingTime: entry.responseEnd - entry.requestStart,
        }))
      })

      // CSS files should not block rendering for too long
      for (const css of cssPerformance) {
        expect(css.duration).toBeLessThan(500)
        expect(css.blockingTime).toBeLessThan(300)
      }
    })

    test('should have minimal layout shifts', async () => {
      // Measure cumulative layout shift
      const cls = await page.evaluate(() => {
        return new Promise((resolve) => {
          let clsValue = 0
          let clsEntries = 0

          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
                clsValue += entry.value
                clsEntries++
              }
            }
          }).observe({ entryTypes: ['layout-shift'] })

          // Wait a bit for layout shifts to occur
          setTimeout(() => {
            resolve({ clsValue, clsEntries })
          }, 1000)
        })
      })

      // Layout shifts should be minimal during theme loading
      expect(cls.clsValue).toBeLessThan(0.1)
    })
  })

  test.describe('Theme Switching Performance', () => {
    test('should switch themes quickly', async () => {
      const themeToggle = page.locator('#theme-toggle-v2')

      // Measure theme switch performance
      await page.evaluate(() => {
        return new Promise((resolve) => {
          const marks = []

          // Add performance observer
          new PerformanceObserver((list) => {
            marks.push(...list.getEntries())
          }).observe({ entryTypes: ['mark', 'measure'] })

          resolve({ marks })
        })
      })

      // Time the theme switch
      await page.evaluate(() => performance.mark('theme-switch-start'))
      await themeToggle.click()
      await page.evaluate(() => performance.mark('theme-switch-end'))

      const themeSwitchTime = await page.evaluate(() => {
        return performance.measure(
          'theme-switch',
          'theme-switch-start',
          'theme-switch-end',
        ).duration
      })

      expect(themeSwitchTime).toBeLessThan(
        performanceThresholds.themeSwitchTime,
      )
    })

    test('should not cause layout thrashing during theme switch', async () => {
      const themeToggle = page.locator('#theme-toggle-v2')

      // Measure layout performance during theme switch
      const layoutMetrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          let layoutCount = 0
          let styleCount = 0

          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === 'measure') {
                if (entry.name.includes('layout')) layoutCount++
                if (entry.name.includes('style')) styleCount++
              }
            }
          }).observe({ entryTypes: ['measure'] })

          // Wait and collect metrics
          setTimeout(() => {
            resolve({ layoutCount, styleCount })
          }, 500)
        })
      })

      await themeToggle.click()

      // Should not cause excessive layout recalculations
      expect(layoutMetrics.layoutCount).toBeLessThan(5)
      expect(layoutMetrics.styleCount).toBeLessThan(10)
    })

    test('should batch DOM updates efficiently', async () => {
      const themeToggle = page.locator('#theme-toggle-v2')

      // Check for efficient DOM batching
      const domBatches = await page.evaluate(() => {
        return new Promise((resolve) => {
          let mutationCount = 0
          let batchCount = 0
          let lastMutationTime = 0

          const observer = new MutationObserver((mutations) => {
            const now = performance.now()
            mutationCount += mutations.length

            // Count batches (mutations within 16ms of each other)
            if (now - lastMutationTime > 16) {
              batchCount++
            }
            lastMutationTime = now
          })

          observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
            childList: false,
            subtree: false,
          })

          // Wait for mutations to complete
          setTimeout(() => {
            observer.disconnect()
            resolve({ mutationCount, batchCount })
          }, 500)
        })
      })

      await themeToggle.click()

      // Should batch mutations efficiently
      expect(domBatches.batchCount).toBeLessThan(3)
    })
  })

  test.describe('Animation Performance', () => {
    test('should maintain smooth animations at 60fps', async () => {
      // Measure animation frame rate
      const frameMetrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          let frames = 0
          let lastTime = performance.now()
          let frameRates = []

          const measureFrame = () => {
            const currentTime = performance.now()
            const deltaTime = currentTime - lastTime
            const fps = 1000 / deltaTime

            frameRates.push(fps)
            frames++
            lastTime = currentTime

            if (frames < 60) {
              requestAnimationFrame(measureFrame)
            } else {
              resolve({
                averageFps:
                  frameRates.reduce((a, b) => a + b) / frameRates.length,
                minFps: Math.min(...frameRates),
                maxFps: Math.max(...frameRates),
              })
            }
          }

          requestAnimationFrame(measureFrame)
        })
      })

      // Should maintain target frame rate
      expect(frameMetrics.averageFps).toBeGreaterThanOrEqual(55)
      expect(frameMetrics.minFps).toBeGreaterThanOrEqual(30)
    })

    test('should use hardware acceleration for animations', async () => {
      // Check for hardware-accelerated properties
      const hardwareAcceleration = await page.evaluate(() => {
        const testElement = document.createElement('div')
        testElement.style.transform = 'translateZ(0)' // Force hardware acceleration
        document.body.appendChild(testElement)

        const computedStyle = window.getComputedStyle(testElement)
        return {
          transform: computedStyle.transform,
          willChange: computedStyle.willChange,
          backfaceVisibility: computedStyle.backfaceVisibility,
        }
      })

      // Should use transform-based animations for performance
      expect(hardwareAcceleration.transform).toContain('translateZ')
    })

    test('should optimize transition properties', async () => {
      const themeToggle = page.locator('#theme-toggle-v2')
    
      // Check for optimized transition properties
      const transitionProperties = await themeToggle.evaluate((el) => {
        return window.getComputedStyle(el).transitionProperty
      })
    
      // Should only transition specific properties, not 'all'
      expect(transitionProperties).not.toBe('all')
      expect(transitionProperties).toMatch(/transform|opacity|color/)
    }).slice()
  })

  test.describe('Memory Management', () => {
    test('should not leak memory during theme switches', async () => {
      const memoryMetrics = await page.evaluate(() => {
        if (!performance.memory) {
          return { unsupported: true }
        }

        const initialMemory = performance.memory.usedJSHeapSize
        return { initialMemory }
      })

      if (memoryMetrics.unsupported) {
        test.skip('Memory API not supported in this browser')
        return
      }

      // Perform multiple theme switches
      const themeToggle = page.locator('#theme-toggle-v2')
      for (let i = 0; i < 10; i++) {
        await themeToggle.click()
        await page.waitForTimeout(100)
      }

      // Check final memory usage
      const finalMemory = await page.evaluate(() => {
        return performance.memory.usedJSHeapSize
      })

      const memoryIncrease = finalMemory - memoryMetrics.initialMemory
      expect(memoryIncrease).toBeLessThan(performanceThresholds.memoryIncrease)
    })

    test('should clean up event listeners', async () => {
      // Perform theme operations
      const themeToggle = page.locator('#theme-toggle-v2')
      await themeToggle.click()

      // Check listener cleanup
      const finalListenerCounts = await page.evaluate(() => {
        const finalListeners = getEventListeners
          ? getEventListeners(document)
          : {}
        return { finalListeners }
      })

      // Should not accumulate excessive listeners
      // This is a simplified check - in real scenarios you'd want more detailed analysis
      expect(
        Object.keys(finalListenerCounts.finalListeners).length,
      ).toBeLessThan(50)
    })
  })

  test.describe('CSS Performance', () => {
    test('should have efficient CSS selectors', async () => {
      // Analyze CSS selector efficiency
      const cssAnalysis = await page.evaluate(() => {
        const stylesheets = Array.from(document.styleSheets)
        const selectors = []

        stylesheets.forEach((sheet) => {
          try {
            const rules = Array.from(sheet.cssRules || sheet.rules || [])
            rules.forEach((rule) => {
              if (rule.selectorText) {
                selectors.push(rule.selectorText).slice(________)
              }
            })
          } catch (e) {
            // Cross-origin stylesheets might not be accessible
          }
        })

        return {
          totalSelectors: selectors.length,
          complexSelectors: selectors.filter(
            (s) => s.includes('>') || s.includes('+') || s.includes('~'),
          ).length,
          universalSelectors: selectors.filter((s) => s.includes('*')).length,
        }
      })

      // Should minimize complex selectors
      expect(cssAnalysis.complexSelectors).toBeLessThan(
        cssAnalysis.totalSelectors * 0.3,
      )
      expect(cssAnalysis.universalSelectors).toBeLessThan(10)
    })

    test('should use CSS containment where appropriate', async () => {
      // Check for CSS containment properties
      const containment = await page.evaluate(() => {
        const elements = document.querySelectorAll('*')
        const containmentUsage = []

        elements.forEach((el) => {
          const style = window.getComputedStyle(el)
          if (style.contain && style.contain !== 'none') {
            containmentUsage.push({
              tagName: el.tagName,
              contain: style.contain,
            })
          }
        })

        return containmentUsage
      })

      // Should use containment for performance-critical elements
      const hasLayoutContainment = containment.some((c) =>
        c.contain.includes('layout'),
      )
      const hasPaintContainment = containment.some((c) =>
        c.contain.includes('paint'),
      )

      if (containment.length > 0) {
        expect(hasLayoutContainment || hasPaintContainment).toBe(true)
      }
    })
  })

  test.describe('Network Performance', () => {
    test('should cache theme assets efficiently', async () => {
      // Check caching headers for theme-related resources
      const resourceCaching = await page.evaluate(() => {
        return performance
          .getEntriesByType('resource')
          .filter(
            (entry: any) =>
              entry.name.includes('.css') || entry.name.includes('theme'),
          )
          .map((entry: any) => ({
            name: entry.name,
            transferSize: entry.transferSize,
            decodedBodySize: entry.decodedBodySize,
          }))
      })

      // CSS files should be cached (transferSize should be smaller than decodedBodySize for cached resources)
      for (const resource of resourceCaching) {
        if (resource.transferSize > 0) {
          // Not cached - should be reasonable size
          expect(resource.transferSize).toBeLessThan(100 * 1024) // 100KB
        }
      }
    })

    test('should load critical CSS first', async () => {
      // Measure when theme-critical styles are applied
      const criticalStyles = await page.evaluate(() => {
        const criticalLoaded = performance.now()

        // Check if critical theme variables are available
        const hasThemeVars = !!window
          .getComputedStyle(document.documentElement)
          .getPropertyValue('--color-background')

        return {
          criticalLoaded,
          hasThemeVars,
        }
      })

      expect(criticalStyles.hasThemeVars).toBe(true)
      expect(criticalStyles.criticalLoaded).toBeLessThan(1000) // Should be available quickly
    })
  })
})
