import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for MCP-integrated E2E tests
 *
 * This configuration extends the base Playwright configuration but adds
 * specific settings and handlers for MCP integration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/*mcp*.spec.ts'],
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env['CI'],
  /* Retry on CI only */
  retries: process.env['CI'] ? 2 : 0,
  /* Reporter to use. */
  reporter: [
    ['html', { outputFolder: './test-results/mcp-e2e-report' }],
    ['list'],
  ],
  /* Shared settings for all the projects below. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env['TEST_BASE_URL'] || 'http://localhost:3000',
    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',
    /* Take screenshot on test failure */
    screenshot: 'only-on-failure',
    /* Enable MCP-specific features */
    launchOptions: {
      args: ['--enable-features=NetworkService'],
    },
    /* Setup for MCP */
    contextOptions: {
      // Any context options needed for MCP
    },
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
  ],
  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env['CI'],
    stdout: 'pipe',
    stderr: 'pipe',
  },
  /* Global setup for MCP integration */
  globalSetup: './tests/mcp-global-setup.ts',
})
