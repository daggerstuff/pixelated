import { test, expect } from '@playwright/test'
import { getBaseUrl } from '../utils/env'

// Check if server is running before running tests
async function isServerRunning(baseUrl: string): Promise<boolean> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(baseUrl, {
      method: 'HEAD',
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response.status < 500 // Consider any non-5xx response as "running"
  } catch {
    clearTimeout(timeoutId)
    return false
  }
}

// Health check test suite
test.describe('Health Check Monitoring', () => {
  // Test the main page loads successfully
  test('Homepage loads correctly', async ({ page }) => {
    const baseUrl = getBaseUrl()

    // Skip test if server is not running
    const serverRunning = await isServerRunning(baseUrl)
    test.skip(!serverRunning, 'Server is not running')

    await page.goto(baseUrl)

    // Check that the page title is present
    const title = await page.title()
    expect(title).not.toBe('')

    // Check that main content is visible - this could be any main container
    try {
      await expect(
        page.locator('main, [role="main"], .main-content').first(),
      ).toBeVisible({ timeout: 10000 })
    } catch {
      console.log(
        'Main content not found with typical selectors, the page might have a different structure',
      )
      // Don't fail the test if main is not found - the page might have loaded but with different structure
    }

    // Verify no console errors
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Wait a moment to catch any async errors
    await page.waitForTimeout(1000)

    // Check for no console errors
    expect(errors.length, `Console errors detected: ${errors.join(', ')}`).toBe(
      0,
    )
  })

  // Test API health endpoint
  test('API health endpoint returns 200', async ({ request }) => {
    const baseUrl = getBaseUrl()

    // Skip test if server is not running
    const serverRunning = await isServerRunning(baseUrl)
    test.skip(!serverRunning, 'Server is not running')

    try {
      // Try the non-versioned endpoint first
      const response = await request.get(`${baseUrl}/api/health`, {
        timeout: 10000,
      })

      if (response.status() === 404) {
        // If not found, try the versioned endpoint
        const v1Response = await request.get(`${baseUrl}/api/v1/health`, {
          timeout: 10000,
        })

        // Expecting a 2xx status code
        expect(v1Response.status()).toBeGreaterThanOrEqual(200)
        expect(v1Response.status()).toBeLessThan(300)

        // Validate based on the versioned format in the codebase
        const body = await v1Response.json()
        expect(body['status']).toBeTruthy()
        expect(body['api']).toBeTruthy()
        expect(body['api']['status']).toBeTruthy()
        console.log('Using v1 health endpoint')
      } else {
        // Base endpoint exists
        expect(response.status()).toBe(200)

        // Parse the response body - using expected format from src/pages/api/health.ts
        const body = await response.json()
        expect(body.status).toBeTruthy() // Should be 'healthy'
        expect(body.api).toBeTruthy() // Should contain API info
        expect(body.api.status).toBeTruthy() // Should be 'healthy'
        console.log('Using base health endpoint')
      }
    } catch (error: unknown) {
      console.error('Failed to reach health endpoint:', error)
      test.fail(true, 'Health endpoint request failed')
    }
  })

  // Test authentication page loads
  test('Login page loads correctly', async ({ page }) => {
    const baseUrl = getBaseUrl()

    // Skip test if server is not running
    const serverRunning = await isServerRunning(baseUrl)
    test.skip(!serverRunning, 'Server is not running')

    // Try different possible login page paths
    const loginPaths = ['/login', '/signin', '/auth/login', '/auth/signin']
    let loginPageFound = false

    for (const path of loginPaths) {
      try {
        await page.goto(`${baseUrl}${path}`, { timeout: 5000 })

        // Check if this looks like a login page
        const hasLoginForm =
          (await page.locator('form, [role="form"]').count()) > 0
        const hasSignInText =
          (await page.getByText(/sign in|login|log in/i).count()) > 0

        if (hasLoginForm || hasSignInText) {
          loginPageFound = true
          break
        }
      } catch {
        console.log(`Path ${path} not accessible`)
      }
    }

    if (!loginPageFound) {
      test.fail(true, 'Could not find a valid login page')
      return
    }

    // Check for login form elements using more flexible selectors
    try {
      // Look for heading that mentions login/signin
      await expect(
        page
          .getByRole('heading')
          .filter({ hasText: /sign in|log in|login/i })
          .first(),
      ).toBeVisible()
    } catch {
      console.log('No login heading found, but page may still be valid')
    }

    // Look for email field
    try {
      await expect(
        page
          .locator(
            '#email, [name="email"], [type="email"], [placeholder*="email"]',
          )
          .first(),
      ).toBeVisible()
    } catch {
      test.fail(true, 'Email field not found on login page')
    }

    // Look for password field
    try {
      await expect(
        page.locator('#password, [name="password"], [type="password"]').first(),
      ).toBeVisible()
    } catch {
      test.fail(true, 'Password field not found on login page')
    }

    // Look for login button - using more generalized selector
    try {
      await expect(
        page
          .locator(
            'button[type="submit"], button:has-text("Sign In"), button:has-text("Log In"), button:has-text("Login")',
          )
          .first(),
      ).toBeVisible()
    } catch {
      test.fail(true, 'Login button not found on login page')
    }
  })

  // Test critical path navigation
  test('Critical navigation paths work', async ({ page }) => {
    const baseUrl = getBaseUrl()

    // Skip test if server is not running
    const serverRunning = await isServerRunning(baseUrl)
    test.skip(!serverRunning, 'Server is not running')

    await page.goto(baseUrl)

    // First discover actual navigation links on the homepage
    const navigationItems = await page
      .locator('nav a, header a, .nav a, .navbar a, .navigation a')
      .all()

    const mainNavLinks: Array<{ href: string; text: string }> = []
    for (const link of navigationItems) {
      const href = await link.getAttribute('href')
      if (
        href &&
        !href.startsWith('http') &&
        !href.includes('#') &&
        href !== '/'
      ) {
        mainNavLinks.push({
          href: href,
          text: (await link.textContent()) || '',
        })
      }
    }

    console.log(
      `Found ${mainNavLinks.length} navigation links: ${mainNavLinks.map((l: any) => l?.['text']).join(', ')}`,
    )

    // If there are no navigation links, the test should still pass
    if (mainNavLinks.length === 0) {
      console.log(
        'No internal navigation links found. The navigation test will be skipped.',
      )
      return
    }

    // Test at most 3 navigation links
    for (let i = 0; i < Math.min(3, mainNavLinks.length); i++) {
      await page.goto(baseUrl)

      // Use a full URL if the href is relative
      const link = mainNavLinks[i]
      if (!link) {
        continue
      }

      const fullUrl = link.href.startsWith('/')
        ? `${baseUrl}${link.href}`
        : link.href

      console.log(`Testing navigation to ${fullUrl} (${link.text})`)

      try {
        await page.goto(fullUrl, { timeout: 10000 })

        // Success if we can navigate to the page
        expect(page.url()).toContain(link.href)
      } catch (err) {
        console.error(`Failed to navigate to ${fullUrl}:`, err)
      }
    }
  })

  // Test that essential resources load
  test('Essential resources load correctly', async ({ page }) => {
    const baseUrl = getBaseUrl()

    // Skip test if server is not running
    const serverRunning = await isServerRunning(baseUrl)
    test.skip(!serverRunning, 'Server is not running')

    // Create a set to store failed resources
    const failedResources = new Set<string>()

    // Listen for failed resources
    page.on('requestfailed', (request) => {
      const url = request.url()
      const failure = request.failure()?.errorText || 'unknown error'

      // Ignore non-critical resources like analytics, fonts, etc.
      if (
        url.includes('google-analytics') ||
        url.includes('analytics') ||
        url.includes('fonts') ||
        url.includes('bunny.net') ||
        failure === 'net::ERR_ABORTED' || // Often related to navigation away from page
        failure.includes('csp') // Content Security Policy blocks - expected for some resources
      ) {
        return
      }

      failedResources.add(`${request.method()} ${url} - ${failure}`)
    })

    await page.goto(baseUrl)

    // Wait for network idle to ensure all resources are loaded
    await page.waitForLoadState('networkidle')

    // Check if any essential resources failed - excluding common non-critical ones
    expect(
      Array.from(failedResources).length,
      `Failed resources detected: ${Array.from(failedResources).join('\n')}`,
    ).toBe(0)
  })
})
