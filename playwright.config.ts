import { defineConfig, devices } from '@playwright/test'

const isCi = !!process.env['CI']
const shouldSkipWebServer =
  process.env['DISABLE_PLAYWRIGHT_WEBSERVER'] === '1' ||
  process.env['DISABLE_PLAYWRIGHT_WEBSERVER'] === 'true'

const baseURL = process.env['BASE_URL'] ?? 'http://127.0.0.1:5173'

let webServerUrl: string | undefined
let webServerPort: number | undefined
let isRemoteUrl = false

try {
  const url = new URL(baseURL)
  const hostname = url.hostname.toLowerCase()
  const explicitPort = url.port ? Number.parseInt(url.port, 10) : null

  isRemoteUrl =
    hostname !== 'localhost' &&
    hostname !== '127.0.0.1' &&
    !hostname.startsWith('127.') &&
    hostname !== '::1'

  if (!isRemoteUrl) {
    webServerPort = explicitPort ?? (isCi ? 4321 : 5173)
    webServerUrl =
      explicitPort !== null
        ? baseURL
        : `${url.protocol}//${url.hostname}:${webServerPort}`
  }
} catch {
  isRemoteUrl = true
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: isCi ? 1 : undefined,
  reporter: 'html',
  timeout: 30_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer:
    isRemoteUrl || shouldSkipWebServer
      ? undefined
      : isCi
        ? {
            command: `NODE_ENV=test pnpm run build && NODE_ENV=test pnpm run preview -- --host 127.0.0.1 --port ${webServerPort ?? 4321}`,
            url: webServerUrl ?? 'http://127.0.0.1:4321',
            reuseExistingServer: false,
            timeout: 10 * 60 * 1000,
          }
        : {
            command:
              webServerPort !== undefined && webServerPort !== 5173
                ? `NODE_ENV=development ./node_modules/.bin/astro dev --host 127.0.0.1 --port ${webServerPort}`
                : 'NODE_ENV=development ./node_modules/.bin/astro dev --host 127.0.0.1 --port 5173',
            url: webServerUrl ?? 'http://127.0.0.1:5173',
            reuseExistingServer: true,
            timeout: 180_000,
          },
})
