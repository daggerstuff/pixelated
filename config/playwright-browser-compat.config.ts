import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '../tests',
  fullyParallel: true,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  timeout: 30000, // 30 seconds per test
  reporter: [
    [
      'html',
      {
        open: 'never',
        outputFolder: '../playwright-report-browser-compat',
      },
    ],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
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
  webServer: {
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:4321',
    reuseExistingServer: true,
    timeout: 300 * 1000,
    cwd: '..',
    env: {
      NODE_ENV: 'test',
      DISABLE_WEB_FONTS: 'true',
      PUBLIC_SITE_URL: 'http://localhost:4321',
    },
  },
})
