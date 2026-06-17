import { test, expect } from '@playwright/test'

const CRISIS_INPUT = 'I want to kill myself right now'
const CRITICAL_BLOCK_REASON = 'Immediate crisis intervention required'
const SAFE_INPUT = 'I had a productive therapy session today.'

test.describe('Chat safety gating', () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push('[console.error] ' + msg.text())
    })
    page.on('pageerror', (err) => errors.push('[pageerror] ' + err.message))
    page.on('requestfailed', (req) => {
      if (!req.url().includes('favicon')) {
        errors.push(
          '[requestfailed] ' + req.url() + ' ' + req.failure()?.errorText,
        )
      }
    })

    await page.goto('/chat', { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)
  })

  test('renders safety block within 500ms for crisis input', async ({
    page,
  }) => {
    await page.route('**/api/ingestion/gate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accepted: false,
          report: {
            blocked: true,
            passed: false,
            gates: {
              gate1: {
                decision: 'block',
                reason: CRITICAL_BLOCK_REASON,
              },
            },
          },
        }),
      })
    })

    const startedAt = Date.now()
    await page.getByTestId('message-input').fill(CRISIS_INPUT)

    await page.evaluate(() => {
      const fn = (window as any).pixelatedSubmit
      if (typeof fn === 'function') {
        fn()
      }
    })

    await expect(page.getByTestId('safety-block')).toBeVisible({
      timeout: 5000,
    })
    const elapsedMs = Date.now() - startedAt
    expect(elapsedMs).toBeLessThan(500)
    await expect(page.getByTestId('gate-result-reason')).toHaveText(
      CRITICAL_BLOCK_REASON,
    )
  })

  test('does not append blocked crisis text to chat history', async ({
    page,
  }) => {
    await page.route('**/api/ingestion/gate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accepted: false,
          report: {
            blocked: true,
            passed: false,
            gates: {
              gate1: {
                decision: 'block',
                reason: CRITICAL_BLOCK_REASON,
              },
            },
          },
        }),
      })
    })

    await page.getByTestId('message-input').fill(CRISIS_INPUT)

    await page.evaluate(() => {
      const fn = (window as any).pixelatedSubmit
      if (typeof fn === 'function') {
        fn()
      }
    })

    await expect(page.getByTestId('safety-block')).toBeVisible({
      timeout: 5000,
    })

    const chatHistory = page.getByTestId('chat-history')
    await expect(chatHistory).not.toContainText(CRISIS_INPUT)
    await expect(page.getByTestId('message-user')).toHaveCount(0)
  })

  test('allows safe messages through the gate', async ({ page }) => {
    await page.route('**/api/ingestion/gate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accepted: true,
          report: {
            blocked: false,
            passed: true,
            gates: {
              gate1: {
                decision: 'pass',
                reason: 'No crisis detected.',
              },
            },
          },
        }),
      })
    })

    await page.getByTestId('message-input').fill(SAFE_INPUT)

    await page.evaluate(() => {
      const fn = (window as any).pixelatedSubmit
      if (typeof fn === 'function') {
        fn()
      }
    })

    await expect(page.getByTestId('safety-block')).toHaveCount(0)
    await expect(page.getByTestId('message-user')).toContainText(SAFE_INPUT)
  })
})
