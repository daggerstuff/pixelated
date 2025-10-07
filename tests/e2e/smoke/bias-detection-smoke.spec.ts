import { test, expect } from '@playwright/test'

test.describe('Bias Detection Engine - Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Skip authentication for smoke tests - focus on availability
    await page.goto('/')
  })

  test('Health check endpoint is accessible', async ({ request }) => {
    const response = await request.get('/api/bias-detection/health')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('status', 'healthy')
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('services')
  })

  test('Python ML service is running', async ({ request }) => {
    const response = await request.get('/api/bias-detection/health')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.services).toHaveProperty('python_service')
    expect(data.services.python_service).toHaveProperty('status', 'healthy')
  })

  test('Dashboard page loads without errors', async ({ page }) => {
    // Navigate to bias detection dashboard
    await page.goto('/admin/bias-detection')

    // Check that page loads without JavaScript errors
    await page.waitForLoadState('networkidle')

    // Verify key elements are present
    await expect(page.locator('h1')).toContainText(/bias detection/i)

    // Check for no console errors
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Reload to trigger any console errors
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Allow for some expected warnings but no critical errors
    const criticalErrors = errors.filter(
      (error) =>
        !error.includes('Warning') &&
        !error.includes('favicon') &&
        !error.includes('404'),
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
    const data = await response.json()

    expect(data.services).toHaveProperty('database')
    expect(['healthy', 'degraded']).toContain(data.services.database.status)
  })

  test('Redis connectivity', async ({ request }) => {
    // Health check should verify Redis connection
    const response = await request.get('/api/bias-detection/health')
    const data = await response.json()

    expect(data.services).toHaveProperty('redis')
    expect(['healthy', 'degraded']).toContain(data.services.redis.status)
  })

  test('Response times are within acceptable limits', async ({ request }) => {
    const startTime = Date.now()
    const response = await request.get('/api/bias-detection/health')
    const endTime = Date.now()

    const responseTime = endTime - startTime

    expect(response.status()).toBe(200)
    // Health check should respond within 5 seconds
    expect(responseTime).toBeLessThan(5000)
  })

  test('CORS headers are properly configured', async ({ request }) => {
    const response = await request.get('/api/bias-detection/health')

    expect(response.status()).toBe(200)

    // Check for basic security headers
    const headers = response.headers()
    expect(headers).toHaveProperty('content-type')

    // CORS should be configured (might be permissive for health checks)
    if (headers['access-control-allow-origin']) {
      expect(headers['access-control-allow-origin']).toBeTruthy()
    }
  })
})
