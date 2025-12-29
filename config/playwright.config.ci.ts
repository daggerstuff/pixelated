import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright CI configuration for Pixelated Empathy
 * Optimized for running specific browser tests in CI environment
 */
export default defineConfig({
  // Only run the specific test files mentioned in the CI command
  testDir: './tests',
  testMatch: [
    'browser/auth.spec.ts',
    'browser/cross-browser-compatibility.spec.ts',
    'browser/mobile-compatibility.spec.ts',
  ],

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Use only 1 worker as specified in the command */
  workers: 1,

  /* Maximum failures as specified in the command */
  maxFailures: 10,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:4321',

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
    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
    env: {
      NODE_ENV: 'test',
      DISABLE_AUTH: 'true',
      DISABLE_WEB_FONTS: 'true',
      SKIP_MSW: 'true',
      // Better-auth SSR requires absolute base URL for login forms to render
      PUBLIC_AUTH_URL: 'http://localhost:4321/api/auth',
      SITE_URL: 'http://localhost:4321',
    },
  },

  /* Test output directories */
  outputDir: 'test-results/',

  /* Expect options */
  expect: {
    /* Maximum time expect() should wait for the condition to be met. */
    timeout: 10000,
  },
})
