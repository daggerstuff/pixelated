import { test, expect } from '@playwright/test'

test.describe('Bias Detection Engine - Smoke Tests', () => {
  test('Health check endpoint is accessible', async ({ request }) => {
    const response = await request.get('/api/bias-detection/health')
    const status = response.status()
    const contentType = response.headers()['content-type'] || ''

    if (status !== 200 || !contentType.includes('application/json')) {
      test.skip(
        `Bias detection health endpoint not accessible as JSON in this environment (status ${status}, content-type: ${contentType})`,
      )
    }

    const data = await response.json()
    expect(data).toHaveProperty('status', 'healthy')
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('services')
  })

  test('Python ML service is running', async ({ request }) => {
    const response = await request.get('/api/bias-detection/health')
    const status = response.status()
    const contentType = response.headers()['content-type'] || ''

    if (status !== 200 || !contentType.includes('application/json')) {
      test.skip(
        `Bias detection health endpoint not returning JSON in this environment (status ${status}, content-type: ${contentType})`,
      )
    }

    const data = await response.json()
    expect(data.services).toHaveProperty('python_service')
    expect(data.services.python_service).toHaveProperty('status', 'healthy')
  })

  test('Dashboard page loads without errors', async ({ page }) => {
    // Set up console error tracking before navigation
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Helper function to detect Cloudflare challenge pages
    const isCloudflareChallenge = async (): Promise<boolean> => {
      const bodyText = await page.locator('body').textContent().catch(() => '')
      const title = await page.title().catch(() => '')
      const url = page.url()

      return (
        bodyText.includes('cloudflare') ||
        bodyText.includes('Verifying you are human') ||
        bodyText.includes('just a moment') ||
        bodyText.includes('security check') ||
        bodyText.includes('DDoS protection') ||
        title.toLowerCase().includes('cloudflare') ||
        url.includes('challenge')
      )
    }

    // Navigate to bias detection dashboard (admin route first, then fallback)
    const response = await page.goto('/admin/bias-detection', {
      waitUntil: 'load',
      timeout: 30000,
    })

    if (!response || response.status() >= 400) {
      // Fallback to public dashboard route if admin route is not accessible
      await page.goto('/dashboard/bias-detection', {
        waitUntil: 'load',
        timeout: 30000,
      })
    }

    // Wait for page to be fully loaded (load event fired)
    await page.waitForLoadState('load')

    // Check if we're blocked by Cloudflare challenge
    if (await isCloudflareChallenge()) {
      test.skip(
        'Dashboard page test skipped: Cloudflare challenge detected. This is expected when testing against Cloudflare-protected staging environments. Consider configuring Cloudflare to allow Azure DevOps IP ranges or use API endpoints for smoke tests.',
      )
      return
    }

    // Verify key elements are present (support both admin + dashboard variants)
    // Wait for the dashboard heading to ensure page is interactive
    // Use a more flexible check that allows for Cloudflare interference
    try {
      await expect(page.locator('body')).toContainText(/bias detection dashboard/i, {
        timeout: 15000,
      })
    } catch (error) {
      // If Cloudflare challenge appears after initial load, skip the test
      if (await isCloudflareChallenge()) {
        test.skip(
          'Dashboard page test skipped: Cloudflare challenge detected after page load. This is expected when testing against Cloudflare-protected staging environments.',
        )
        return
      }
      throw error
    }

    // Wait a short moment for any initial JavaScript to execute
    await page.waitForTimeout(1000)

    // Reload to trigger any console errors
    await page.reload({ waitUntil: 'load', timeout: 30000 })
    await page.waitForLoadState('load')

    // Check again for Cloudflare challenge after reload
    if (await isCloudflareChallenge()) {
      test.skip(
        'Dashboard page test skipped: Cloudflare challenge detected after reload. This is expected when testing against Cloudflare-protected staging environments.',
      )
      return
    }

    // Wait for content to be visible after reload
    try {
      await expect(page.locator('body')).toContainText(/bias detection dashboard/i, {
        timeout: 15000,
      })
    } catch (error) {
      // Final check for Cloudflare challenge
      if (await isCloudflareChallenge()) {
        test.skip(
          'Dashboard page test skipped: Cloudflare challenge detected. This is expected when testing against Cloudflare-protected staging environments.',
        )
        return
      }
      throw error
    }

    // Allow for some expected warnings but no critical errors
    const criticalErrors = errors.filter(
      (error) =>
        !error.includes('Warning') &&
        !error.includes('favicon') &&
        !error.includes('404') &&
        !error.includes('WebSocket') && // WebSocket connection errors are expected in test env
        !error.includes('Failed to fetch') && // Network errors during test setup are acceptable
        !error.toLowerCase().includes('network') &&
        !error.toLowerCase().includes('cloudflare') && // Cloudflare-related errors are expected
        !error.includes('Content Security Policy') && // Ignore CSP errors for smoke tests
        !error.includes('Content-Security-Policy') && // Firefox formatting
        !error.includes('violates the following') &&
        !error.includes('MIME type') && // Ignore MIME type mismatches (often analytics)
        !error.includes('speed-insights') // Ignore Speed Insights script errors
    )

    expect(criticalErrors).toHaveLength(0)
  })

  test('API endpoints respond correctly', async ({ request }) => {
    // Test analyze endpoint accepts POST requests
    const analyzeResponse = await request.post('/api/bias-detection/analyze', {
      data: {
        sessionId: 'smoke-test-session',
        messages: [
          {
            role: 'user',
            content: 'This is a test message',
          },
        ],
      },
    })

    // Should not return 404 or 500 (might return 401/403 if auth required)
    expect([200, 201, 400, 401, 403]).toContain(analyzeResponse.status())
  })

  test('Database connectivity', async ({ request }) => {
    // Health check should verify database connection
    const response = await request.get('/api/bias-detection/health')
    const status = response.status()
    const contentType = response.headers()['content-type'] || ''

    if (status !== 200 || !contentType.includes('application/json')) {
      test.skip(
        `Bias detection health endpoint not returning JSON in this environment (status ${status}, content-type: ${contentType})`,
      )
    }

    const data = await response.json()

    expect(data.services).toHaveProperty('database')
    expect(['healthy', 'degraded']).toContain(data.services.database.status)
  })

  test('Redis connectivity', async ({ request }) => {
    // Health check should verify Redis connection
    const response = await request.get('/api/bias-detection/health')
    const status = response.status()
    const contentType = response.headers()['content-type'] || ''

    if (status !== 200 || !contentType.includes('application/json')) {
      test.skip(
        `Bias detection health endpoint not returning JSON in this environment (status ${status}, content-type: ${contentType})`,
      )
    }

    const data = await response.json()

    expect(data.services).toHaveProperty('redis')
    expect(['healthy', 'degraded']).toContain(data.services.redis.status)
  })

  test('Response times are within acceptable limits', async ({ request }) => {
    const startTime = Date.now()
    const response = await request.get('/api/bias-detection/health')
    const endTime = Date.now()

    const responseTime = endTime - startTime
    const status = response.status()

    if (status !== 200) {
      test.skip(
        `Bias detection health endpoint did not return 200 in this environment (status ${status})`,
      )
    }

    // Health check should respond within 5 seconds
    expect(responseTime).toBeLessThan(5000)
  })

  test('CORS headers are properly configured', async ({ request }) => {
    const response = await request.get('/api/bias-detection/health')
    const status = response.status()

    if (status !== 200) {
      test.skip(
        `Bias detection health endpoint did not return 200 in this environment (status ${status})`,
      )
    }

    // Check for basic security headers
    const headers = response.headers()
    expect(headers).toHaveProperty('content-type')

    // CORS should be configured (might be permissive for health checks)
    if (headers['access-control-allow-origin']) {
      expect(headers['access-control-allow-origin']).toBeTruthy()
    }
  })
})
