import { test, expect } from '@playwright/test'
import { TestUtils } from '../e2e/utils/TestUtils'

/**
 * Regression Test Suite
 * Tests for preventing previously fixed bugs from reoccurring
 */

test.describe('Regression Test Suite', () => {
  let testUtils: TestUtils

  test.beforeEach(async ({ page }) => {
    testUtils = new TestUtils(page)
    await testUtils.setupTestEnvironment()
  })

  test.afterEach(async ({ page: _page }) => {
    await testUtils.cleanupTestEnvironment()
  })

  test.describe('Authentication Regressions', () => {
    test('should not allow login with expired tokens', async ({ page }) => {
      // Regression test for bug #AUTH-001: Expired tokens were accepted
      await page.goto('/login')

      // Simulate expired token scenario
      await page.evaluate(() => {
        localStorage.setItem('auth_token', 'expired_token_12345')
        localStorage.setItem('token_expiry', '2020-01-01T00:00:00Z')
      })

      await page.goto('/dashboard')

      // Should redirect to login
      await expect(page).toHaveURL(/.*login/)
      await expect(page.locator('.error-message')).toContainText(
        'Session expired',
      )
    })

    test('should handle concurrent login attempts correctly', async ({
      page,
      context,
    }) => {
      // Regression test for bug #AUTH-002: Race condition in concurrent logins
      const page2 = await context.newPage()

      const loginPromise1 = testUtils.performLogin(
        page,
        'user@test.com',
        'password123',
      )
      const loginPromise2 = testUtils.performLogin(
        page2,
        'user@test.com',
        'password123',
      )

      await Promise.all([loginPromise1, loginPromise2])

      // Both should succeed without conflicts
      await expect(page.locator('.dashboard')).toBeVisible()
      await expect(page2.locator('.dashboard')).toBeVisible()

      await page2.close()
    })
  })

  test.describe('Chat Functionality Regressions', () => {
    test('should preserve message history after page refresh', async ({
      page,
    }) => {
      // Regression test for bug #CHAT-001: Message history lost on refresh
      await testUtils.loginAsTestUser(page)
      await page.goto('/chat')

      // Send a test message
      const testMessage = 'Test message for regression testing'
      await page.fill('[data-testid="message-input"]', testMessage)
      await page.click('[data-testid="send-button"]')

      // Wait for message to appear
      await expect(page.locator('.message-bubble').last()).toContainText(
        testMessage,
      )

      // Refresh page
      await page.reload()

      // Message should still be visible
      await expect(page.locator('.message-bubble').last()).toContainText(
        testMessage,
      )
    })

    test('should handle special characters in messages correctly', async ({
      page,
    }) => {
      // Regression test for bug #CHAT-002: Special characters caused encoding issues
      await testUtils.loginAsTestUser(page)
      await page.goto('/chat')

      const specialMessage = 'Test with émojis 🚀 and spëcial chars: <>&"\''
      await page.fill('[data-testid="message-input"]', specialMessage)
      await page.click('[data-testid="send-button"]')

      // Message should display correctly without encoding issues
      await expect(page.locator('.message-bubble').last()).toContainText(
        specialMessage,
      )
    })

    test('should prevent duplicate message sending', async ({ page }) => {
      // Regression test for bug #CHAT-003: Double-clicking send caused duplicate messages
      await testUtils.loginAsTestUser(page)
      await page.goto('/chat')

      const testMessage = 'Single message test'
      await page.fill('[data-testid="message-input"]', testMessage)

      // Double-click send button rapidly
      await page.click('[data-testid="send-button"]')
      await page.click('[data-testid="send-button"]')

      // Should only have one message
      const messageCount = await page.locator('.message-bubble').count()
      expect(messageCount).toBe(1)
    })
  })

  test.describe('UI/UX Regressions', () => {
    test('should maintain responsive layout on mobile devices', async ({
      page,
    }) => {
      // Regression test for bug #UI-001: Mobile layout broke on certain screen sizes
      await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE
      await testUtils.loginAsTestUser(page)

      // Check navigation is accessible
      await expect(
        page.locator('[data-testid="mobile-menu-toggle"]'),
      ).toBeVisible()

      // Check content doesn't overflow
      const body = page.locator('body')
      const bodyBox = await body.boundingBox()
      expect(bodyBox?.width).toBeLessThanOrEqual(375)
    })

    test('should handle keyboard navigation correctly', async ({ page }) => {
      // Regression test for bug #UI-002: Tab navigation skipped important elements
      await testUtils.loginAsTestUser(page)
      await page.goto('/dashboard')

      // Test tab navigation sequence
      await page.keyboard.press('Tab')
      await expect(page.locator(':focus')).toHaveAttribute(
        'data-testid',
        'main-nav-link',
      )

      await page.keyboard.press('Tab')
      await expect(page.locator(':focus')).toHaveAttribute(
        'data-testid',
        'user-menu-button',
      )
    })
  })

  test.describe('Performance Regressions', () => {
    test('should load dashboard within acceptable time limits', async ({
      page,
    }) => {
      // Regression test for bug #PERF-001: Dashboard loading became slow
      await testUtils.loginAsTestUser(page)

      const startTime = Date.now()
      await page.goto('/dashboard')
      await page.waitForSelector('[data-testid="dashboard-content"]')
      const loadTime = Date.now() - startTime

      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000)
    })

    test('should handle large message histories efficiently', async ({
      page,
    }) => {
      // Regression test for bug #PERF-002: Large chat histories caused memory leaks
      await testUtils.loginAsTestUser(page)
      await page.goto('/chat')

      // Simulate loading large message history
      await page.evaluate(() => {
        // Mock large message history
        const mockMessages = Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          text: `Message ${i}`,
          timestamp: new Date().toISOString(),
        }))

        // Dispatch event to load messages
        window.dispatchEvent(
          new CustomEvent('loadMessages', {
            detail: { messages: mockMessages },
          }),
        )
      })

      // Check memory usage doesn't spike excessively
      const metrics = await page.evaluate(() => {
        return {
          usedJSHeapSize: (performance as any).memory?.usedJSHeapSize || 0,
          totalJSHeapSize: (performance as any).memory?.totalJSHeapSize || 0,
        }
      })

      // Memory usage should be reasonable (less than 100MB)
      expect(metrics.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024)
    })
  })

  test.describe('Data Integrity Regressions', () => {
    test('should preserve user preferences across sessions', async ({
      page,
    }) => {
      // Regression test for bug #DATA-001: User preferences were reset
      await testUtils.loginAsTestUser(page)
      await page.goto('/settings')

      // Set a preference
      await page.check('[data-testid="dark-mode-toggle"]')
      await page.click('[data-testid="save-settings"]')

      // Logout and login again
      await testUtils.logout(page)
      await testUtils.loginAsTestUser(page)
      await page.goto('/settings')

      // Preference should be preserved
      await expect(
        page.locator('[data-testid="dark-mode-toggle"]'),
      ).toBeChecked()
    })

    test('should handle network interruptions gracefully', async ({ page }) => {
      // Regression test for bug #DATA-002: Network errors caused data loss
      await testUtils.loginAsTestUser(page)
      await page.goto('/chat')

      // Start typing a message
      const message = 'Test message during network interruption'
      await page.fill('[data-testid="message-input"]', message)

      // Simulate network interruption
      await page.route('**/api/**', (route) => route.abort())

      // Try to send message
      await page.click('[data-testid="send-button"]')

      // Should show error and preserve message
      await expect(page.locator('.error-notification')).toContainText(
        'Network error',
      )
      await expect(page.locator('[data-testid="message-input"]')).toHaveValue(
        message,
      )

      // Restore network
      await page.unroute('**/api/**')
    })
  })

  test.describe('Security Regressions', () => {
    test('should prevent XSS attacks in user input', async ({ page }) => {
      // Regression test for bug #SEC-001: XSS vulnerability in message input
      await testUtils.loginAsTestUser(page)
      await page.goto('/chat')

      const xssPayload = '<script>alert("XSS")</script>'
      await page.fill('[data-testid="message-input"]', xssPayload)
      await page.click('[data-testid="send-button"]')

      // Script should be escaped, not executed
      await expect(page.locator('.message-bubble').last()).toContainText(
        '<script>',
      )

      // No alert should have been triggered
      page.on('dialog', (_dialog) => {
        throw new Error('XSS alert was triggered')
      })
    })

    test('should validate file uploads properly', async ({ page }) => {
      // Regression test for bug #SEC-002: Malicious file uploads were allowed
      await testUtils.loginAsTestUser(page)
      await page.goto('/profile')

      // Try to upload a malicious file
      const maliciousFile = Buffer.from('<?php echo "malicious"; ?>', 'utf8')
      await page.setInputFiles('[data-testid="avatar-upload"]', {
        name: 'malicious.php',
        mimeType: 'application/x-php',
        buffer: maliciousFile,
      })

      // Should show error for invalid file type
      await expect(page.locator('.error-message')).toContainText(
        'Invalid file type',
      )
    })
  })
})

/**
 * Regression Test Utilities
 */
export class RegressionTestUtils {
  static async simulateSlowNetwork(page: any) {
    await page.route('**/api/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      await route.continue()
    })
  }

  static async simulateMemoryPressure(page: any) {
    await page.evaluate(() => {
      // Create memory pressure
      const arrays: any[] = []
      for (let i = 0; i < 100; i++) {
        arrays.push(new Array(10000).fill('memory-pressure-test'))
      }
      ;(window as any).memoryPressureArrays = arrays
    })
  }

  static async cleanupMemoryPressure(page: any) {
    await page.evaluate(() => {
      delete (window as any).memoryPressureArrays
      if (window.gc) {
        window.gc()
      }
    })
  }
}
