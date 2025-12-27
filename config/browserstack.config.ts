import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  timeout: 60000,
  expect: {
    timeout: 30000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 2 : 1,
  reporter: [['html', { open: 'never' }]],

  use: {
    baseURL: process.env['BROWSERSTACK_TEST_URL'] || 'http://localhost:3000',
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },

  projects: [
    // Desktop browsers
    {
      name: 'Chrome-Windows',
      use: {
        browserName: 'chromium',
        channel: 'chrome',
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'Firefox-Windows',
      use: {
        browserName: 'firefox',
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'Safari-Mac',
      use: {
        browserName: 'webkit',
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'Edge-Windows',
      use: {
        browserName: 'chromium',
        channel: 'msedge',
        viewport: { width: 1920, height: 1080 },
      },
    },

    // Mobile browsers
    {
      name: 'Chrome-Android',
      use: {
        browserName: 'chromium',
        channel: 'chrome',
        viewport: { width: 360, height: 800 },
      },
    },
    {
      name: 'Safari-iOS',
      use: {
        browserName: 'webkit',
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'Safari-iOS-small',
      use: {
        browserName: 'webkit',
        viewport: { width: 375, height: 667 },
      },
    },
    {
      name: 'iPad-Safari',
      use: {
        browserName: 'webkit',
        viewport: { width: 1024, height: 1366 },
      },
    },
  ],
})
