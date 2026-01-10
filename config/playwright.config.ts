import { defineConfig, devices } from '@playwright/test'
// Detect CI environment to avoid running dev server with file watchers in CI (which can fail under low inotify limits).
const isCi = !!process.env['CI']

// Get base URL from environment or default to localhost
// Default to port 3000 for local dev, 4321 for CI (preview server)
const baseURL = process.env['BASE_URL'] || (isCi ? 'http://localhost:4321' : 'http://localhost:3000')

// Optional Cloudflare Access service token support for staging/prod runs
const cfAccessClientId = process.env['CF_ACCESS_CLIENT_ID']
const cfAccessClientSecret = process.env['CF_ACCESS_CLIENT_SECRET']
const extraHTTPHeaders =
  cfAccessClientId && cfAccessClientSecret
    ? {
      'CF-Access-Client-Id': cfAccessClientId,
      'CF-Access-Client-Secret': cfAccessClientSecret,
    }
    : undefined

// Parse URL to extract hostname and port
let webServerUrl: string | undefined
let webServerPort: number | undefined
let isRemoteUrl = false

try {
  const url = new URL(baseURL)
  const hostname = url.hostname.toLowerCase()

  // Extract port from URL, handling cases where port is not explicitly specified
  // If port is in URL (e.g., :3000), use it; otherwise, derive from protocol
  const explicitPort = url.port ? parseInt(url.port, 10) : null

  // Check if BASE_URL is a remote URL (not localhost) - case-insensitive check
  isRemoteUrl = Boolean(
    baseURL &&
      hostname !== 'localhost' &&
      hostname !== '127.0.0.1' &&
      !hostname.startsWith('127.') &&
      hostname !== '::1',
  )

  // If localhost, extract port for webServer configuration
  if (!isRemoteUrl) {
    // Use explicit port if provided, otherwise use default based on CI context
    // (3000 for dev, 4321 for preview/CI)
    webServerPort = explicitPort !== null ? explicitPort : (isCi ? 4321 : 3000)

    // Construct webServerUrl with the correct port
    // If the original URL had a port, use it; otherwise construct with the determined port
    if (explicitPort !== null) {
      webServerUrl = baseURL // URL already has the correct port
    } else {
      // Construct URL with the default port for the context
      webServerUrl = `${url.protocol}//${url.hostname}:${webServerPort}`
    }
  } else {
    webServerUrl = undefined
    webServerPort = undefined
  }
} catch {
  // Invalid URL format, treat as remote to be safe
  isRemoteUrl = true
  webServerUrl = undefined
  webServerPort = undefined
}

/**
 * Playwright configuration for Pixelated Empathy AI E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: '../tests',
  testIgnore: ['tests/accessibility/**'],
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env['CI'],
  /* Retry on CI only */
  retries: process.env['CI'] ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env['CI'] ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: '../playwright-report' }],
    ['json', { outputFile: '../test-results/results.json' }],
    ['junit', { outputFile: '../test-results/junit.xml' }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Include Cloudflare Access headers when provided (staging/prod) */
    extraHTTPHeaders,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',

    /* Global test timeout */
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'msedge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'Tablet Chrome',
      use: { ...devices['iPad'] },
    },
    {
      name: 'Tablet Safari',
      use: { ...devices['iPad'] },
    },
    /* Theme-specific testing */
    {
      name: 'theme-compatibility',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/theme-compatibility.spec.ts',
    },
  ],

  /* Run your local dev server before starting the tests */
  // Only start webServer if BASE_URL is localhost (not a remote URL)
  // When BASE_URL points to staging/production, skip webServer to avoid timeout
  webServer: isRemoteUrl
    ? undefined
    : isCi
      ? {
        // In CI, build and serve a production preview to avoid Vite/HMR file watcher issues.
        // Use port from BASE_URL if specified, otherwise default to 4321
        command: `pnpm run build && pnpm run preview -- --port ${webServerPort || 4321}`,
        url: webServerUrl || 'http://localhost:4321',
        reuseExistingServer: false,
        timeout: 10 * 60 * 1000, // allow time for build + preview start
        cwd: '..',
      }
      : {
        // Local/dev flow should keep the fast dev server with HMR.
        // Use port from BASE_URL if specified, otherwise use default (3000 from package.json dev script)
        // Astro dev command accepts --port flag and also respects PORT/ASTRO_PORT env vars
        command: webServerPort !== undefined && webServerPort !== 3000
          ? `ASTRO_PORT=${webServerPort} pnpm dev --port ${webServerPort}`
          : 'pnpm dev',
        url: webServerUrl || 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 180 * 1000,
        cwd: '..',
      },

  /* Global setup and teardown */
  // globalSetup: './tests/e2e/global-setup.ts',
  // globalTeardown: './tests/e2e/global-teardown.ts',

  /* Test output directories */
  outputDir: '../test-results/',

  /* Expect options */
  expect: {
    /* Maximum time expect() should wait for the condition to be met. */
    timeout: 10000,
    /* Screenshot comparison options */
    toHaveScreenshot: {
      /* Threshold for pixel comparisons */
      threshold: 0.2,
      /* Screenshot comparison mode */
      // mode: 'default' // Uncomment if needed and supported by your Playwright version
    },
    // ...other expect options if needed...
  },
})
