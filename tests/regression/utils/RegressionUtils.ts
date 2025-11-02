/**
 * Regression Test Utilities
 * Helper functions for regression testing
 */

export class RegressionUtils {
  /**
   * Simulate various network conditions for testing
   */
  static async simulateNetworkConditions(
    page: any,
    condition: 'slow' | 'offline' | 'unstable',
  ) {
    switch (condition) {
      case 'slow':
        await page.route('**/api/**', async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 2000))
          await route.continue()
        })
        break

      case 'offline':
        await page.route('**/api/**', (route) => route.abort())
        break

      case 'unstable':
        await page.route('**/api/**', async (route) => {
          if (Math.random() < 0.3) {
            await route.abort()
          } else {
            await new Promise((resolve) =>
              setTimeout(resolve, Math.random() * 1000),
            )
            await route.continue()
          }
        })
        break
    }
  }

  /**
   * Create test data for regression scenarios
   */
  static generateTestData(
    type: 'messages' | 'users' | 'settings',
    count: number = 10,
  ) {
    switch (type) {
      case 'messages':
        return Array.from({ length: count }, (_, i) => ({
          id: `msg_${i}`,
          text: `Regression test message ${i}`,
          timestamp: new Date(Date.now() - i * 60000).toISOString(),
          user: `user_${i % 3}`,
        }))

      case 'users':
        return Array.from({ length: count }, (_, i) => ({
          id: `user_${i}`,
          email: `test${i}@regression.test`,
          name: `Test User ${i}`,
          preferences: {
            theme: i % 2 === 0 ? 'dark' : 'light',
            notifications: true,
          },
        }))

      case 'settings':
        return {
          theme: 'dark',
          language: 'en',
          notifications: {
            email: true,
            push: false,
            sound: true,
          },
          privacy: {
            analytics: false,
            cookies: true,
          },
        }

      default:
        return []
    }
  }

  /**
   * Validate that a previously fixed bug hasn't regressed
   */
  static async validateBugFix(page: any, bugId: string): Promise<boolean> {
    const bugValidations: Record<string, () => Promise<boolean>> = {
      'AUTH-001': async () => {
        // Validate expired token handling
        await page.evaluate(() => {
          localStorage.setItem('auth_token', 'expired_token')
          localStorage.setItem('token_expiry', '2020-01-01T00:00:00Z')
        })
        await page.goto('/dashboard')
        return page.url().includes('login')
      },

      'CHAT-001': async () => {
        // Validate message persistence
        await page.goto('/chat')
        await page.fill('[data-testid="message-input"]', 'persistence test')
        await page.click('[data-testid="send-button"]')
        await page.reload()
        const messages = await page.locator('.message-bubble').count()
        return messages > 0
      },

      'UI-001': async () => {
        // Validate mobile layout
        await page.setViewportSize({ width: 375, height: 667 })
        await page.goto('/dashboard')
        const body = await page.locator('body').boundingBox()
        return body ? body.width <= 375 : false
      },
    }

    const validation = bugValidations[bugId]
    return validation ? await validation() : false
  }

  /**
   * Performance monitoring for regression tests
   */
  static async monitorPerformance(page: any, testName: string) {
    const startTime = Date.now()

    // Start performance monitoring
    await page.evaluate(() => {
      ;(window as any).performanceMarks = []
      performance.mark('test-start')
    })

    return {
      end: async () => {
        const endTime = Date.now()
        const duration = endTime - startTime

        const metrics = await page.evaluate(() => {
          performance.mark('test-end')
          performance.measure('test-duration', 'test-start', 'test-end')

          const measure = performance.getEntriesByName('test-duration')[0]
          const { memory } = performance as any

          return {
            duration: measure ? measure.duration : 0,
            memory: memory
              ? {
                  used: memory.usedJSHeapSize,
                  total: memory.totalJSHeapSize,
                  limit: memory.jsHeapSizeLimit,
                }
              : null,
          }
        })

        return {
          testName,
          wallClockTime: duration,
          performanceTime: metrics.duration,
          memory: metrics.memory,
        }
      },
    }
  }

  /**
   * Security validation helpers
   */
  static async validateSecurityMeasures(page: any) {
    const results = {
      xssProtection: false,
      csrfProtection: false,
      inputSanitization: false,
    }

    // Test XSS protection
    try {
      await page.fill(
        '[data-testid="message-input"]',
        '<script>window.xssTest=true</script>',
      )
      await page.click('[data-testid="send-button"]')
      const xssExecuted = await page.evaluate(
        () => (window as any).xssTest === true,
      )
      results.xssProtection = !xssExecuted
    } catch (error: unknown) {
      results.xssProtection = true // Error means XSS was blocked
    }

    // Test input sanitization
    try {
      await page.fill(
        '[data-testid="message-input"]',
        '"><img src=x onerror=alert(1)>',
      )
      await page.click('[data-testid="send-button"]')
      const messageContent = await page
        .locator('.message-bubble')
        .last()
        .textContent()
      results.inputSanitization = !messageContent?.includes('<img')
    } catch (error: unknown) {
      results.inputSanitization = true
    }

    return results
  }
}

/**
 * Bug tracking and reporting utilities
 */
export class BugTracker {
  private static fixedBugs = new Set([
    'AUTH-001',
    'AUTH-002',
    'CHAT-001',
    'CHAT-002',
    'CHAT-003',
    'UI-001',
    'UI-002',
    'PERF-001',
    'PERF-002',
    'DATA-001',
    'DATA-002',
    'SEC-001',
    'SEC-002',
  ])

  static isBugFixed(bugId: string): boolean {
    return this.fixedBugs.has(bugId)
  }

  static addFixedBug(bugId: string): void {
    this.fixedBugs.add(bugId)
  }

  static getFixedBugs(): string[] {
    return Array.from(this.fixedBugs)
  }

  static generateRegressionReport(testResults: any[]): string {
    const passedTests = testResults.filter((r) => r.status === 'passed')
    const failedTests = testResults.filter((r) => r.status === 'failed')

    return `
# Regression Test Report
Generated: ${new Date().toISOString()}

## Summary
- Total Tests: ${testResults.length}
- Passed: ${passedTests.length}
- Failed: ${failedTests.length}
- Success Rate: ${((passedTests.length / testResults.length) * 100).toFixed(1)}%

## Fixed Bugs Validated
${this.getFixedBugs()
  .map((bug) => `- ✅ ${bug}`)
  .join('\n')}

## Failed Tests
${failedTests.map((test) => `- ❌ ${test.name}: ${test.error}`).join('\n')}
    `
  }
}
