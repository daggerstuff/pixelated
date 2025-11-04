import { defineConfig, devices } from '@playwright/test'
// Detect CI environment to avoid running dev server with file watchers in CI (which can fail under low inotify limits).
const isCi = !!process.env['CI']

/**
 * Playwright configuration for Pixelated Empathy AI E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
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
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env['BASE_URL'] || 'http://localhost:4321',

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
  webServer: isCi
    ? {
        // In CI, build and serve a production preview to avoid Vite/HMR file watcher issues.
        command: 'pnpm run build && pnpm run preview -- --port 4321',
        url: 'http://localhost:4321',
        reuseExistingServer: false,
        timeout: 10 * 60 * 1000, // allow time for build + preview start
      }
    : {
        // Local/dev flow should keep the fast dev server with HMR.
        command: 'pnpm dev',
        url: 'http://localhost:4321',
        reuseExistingServer: true,
        timeout: 180 * 1000,
      },

  /* Global setup and teardown */
  // globalSetup: './tests/e2e/global-setup.ts',
  // globalTeardown: './tests/e2e/global-teardown.ts',

  /* Test output directories */
  outputDir: 'test-results/',

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
