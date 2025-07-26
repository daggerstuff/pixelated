import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// Get current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Configuration for End-to-End Tests
 *
 * This configuration extends the base Playwright config to focus specifically
 * on critical user journey tests.
 */

export default defineConfig({
  // Use this configuration in addition to playwright.config.ts
  // by running: npx playwright test --config=tests/e2e-config.ts

  testDir: resolve(__dirname, './e2e'),

  // Longer timeout for E2E tests that involve multiple pages and complex flows
  timeout: 60000,

  // Slow down tests for better visibility in debugging
  use: {
    actionTimeout: 10000,
    navigationTimeout: 30000,
    video: 'on',
    trace: 'on',
    baseURL: 'http://localhost:3000',
  },

  // Limit to smaller set of test browsers for faster iteration
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
    {
      name: 'Mobile Chrome',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
      },
    },
  ],

  // More detailed reporting for critical user journeys
  reporter: [
    [
      'html',
      {
        open: 'on-failure',
        outputFolder: resolve(__dirname, '../test-results/e2e-report'),
      },
    ],
    [
      'json',
      { outputFile: resolve(__dirname, '../test-results/e2e-results.json') },
    ],
  ],

  // Run your local dev server before starting tests
  webServer: {
    command: 'pnpm run dev',
    port: 3000,
    reuseExistingServer: true,
    timeout: 60000,
  },
})
