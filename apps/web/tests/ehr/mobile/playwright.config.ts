/**
 * Playwright configuration for EHR Mobile Parity Gate tests (G3.2 / PIX-4430)
 *
 * Dedicated config for mobile viewport tests at 375px, 390px, 414px.
 * These viewports cover the most common mobile device widths:
 *   375px — iPhone SE / iPhone 12 mini
 *   390px — iPhone 12 / 13 / 14 base
 *   414px — iPhone 11 Pro Max / Pixel 5 / Galaxy S21
 *
 * Usage:
 *   pnpm playwright test --config apps/web/tests/ehr/mobile/playwright.config.ts
 *
 * @see https://playwright.dev/docs/test-configuration
 */

import { defineConfig } from '@playwright/test'

const isCi = !!process.env['CI']
const shouldSkipWebServer =
  process.env['DISABLE_PLAYWRIGHT_WEBSERVER'] === '1' ||
  process.env['DISABLE_PLAYWRIGHT_WEBSERVER'] === 'true'

const baseURL =
  process.env['BASE_URL'] ??
  (isCi ? 'http://localhost:4321' : 'http://localhost:5173')

let webServerUrl: string | undefined
let webServerPort: number | undefined
let isRemoteUrl = false

try {
  const url = new URL(baseURL)
  const hostname = url.hostname.toLowerCase()
  const explicitPort = url.port ? parseInt(url.port, 10) : null

  isRemoteUrl =
    hostname !== 'localhost' &&
    hostname !== '127.0.0.1' &&
    !hostname.startsWith('127.') &&
    hostname !== '::1'

  if (!isRemoteUrl) {
    webServerPort = explicitPort ?? (isCi ? 4321 : 5173)
    webServerUrl = explicitPort
      ? baseURL
      : `${url.protocol}//${url.hostname}:${webServerPort}`
  }
} catch {
  isRemoteUrl = true
}

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: '../../../test-results/ehr-mobile-report' }],
    ['json', { outputFile: '../../../test-results/ehr-mobile-results.json' }],
    ['junit', { outputFile: '../../../test-results/ehr-mobile-junit.xml' }],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'mobile-375',
      use: {
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      },
    },
    {
      name: 'mobile-390',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
    },
    {
      name: 'mobile-414',
      use: {
        viewport: { width: 414, height: 896 },
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      },
    },
  ],
  webServer:
    isRemoteUrl || shouldSkipWebServer
      ? undefined
      : isCi
        ? {
            command: `pnpm run build && pnpm run preview -- --port ${webServerPort ?? 4321}`,
            url: webServerUrl ?? 'http://localhost:4321',
            reuseExistingServer: false,
            timeout: 10 * 60 * 1000,
          }
        : {
            command:
              webServerPort !== undefined && webServerPort !== 5173
                ? `ASTRO_PORT=${webServerPort} pnpm dev --port ${webServerPort}`
                : 'pnpm dev',
            url: webServerUrl ?? 'http://localhost:5173',
            reuseExistingServer: true,
            timeout: 180 * 1000,
          },
  outputDir: '../../../test-results/',
  expect: {
    timeout: 10000,
  },
})
