import { test, expect, type Page } from '@playwright/test'

const CRISIS_INPUT = 'I want to kill myself right now'
const CRITICAL_BLOCK_REASON =
  'Critical crisis detected. Blocking ingestion.'
const SAFE_INPUT = 'I had a productive therapy session today.'

async function waitForTherapyGateHydration(page: Page) {
  await page.waitForFunction(() => {
    const island = document.querySelector(
      'astro-island[component-export="TherapyGate"]',
    )
    return island instanceof HTMLElement && !island.hasAttribute('ssr')
  })
}

test.describe('Chat safety gating', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat')
    await expect(page.getByTestId('therapy-gate-chat')).toBeVisible()
    await waitForTherapyGateHydration(page)
  })

  test('renders safety block within 500ms for crisis input', async ({
    page,
  }) => {
    const messageInput = page.getByTestId('message-input')
    const sendButton = page.getByTestId('send-button')

    await messageInput.fill(CRISIS_INPUT)

    const startedAt = Date.now()
    await sendButton.click()

    const safetyBlock = page.getByTestId('safety-block')
    await expect(safetyBlock).toBeVisible({ timeout: 500 })

    const elapsedMs = Date.now() - startedAt
    expect(elapsedMs).toBeLessThan(500)

    await expect(page.getByTestId('gate-result-reason')).toHaveText(
      CRITICAL_BLOCK_REASON,
    )
  })

  test('does not append blocked crisis text to chat history', async ({
    page,
  }) => {
    await page.getByTestId('message-input').fill(CRISIS_INPUT)
    await page.getByTestId('send-button').click()

    await expect(page.getByTestId('safety-block')).toBeVisible({
      timeout: 500,
    })

    const chatHistory = page.getByTestId('chat-history')
    await expect(chatHistory).not.toContainText(CRISIS_INPUT)
    await expect(page.getByTestId('message-user')).toHaveCount(0)
  })

  test('allows safe messages through the gate', async ({ page }) => {
    await page.getByTestId('message-input').fill(SAFE_INPUT)
    await page.getByTestId('send-button').click()

    await expect(page.getByTestId('safety-block')).toHaveCount(0)
    await expect(page.getByTestId('message-user')).toContainText(SAFE_INPUT)
  })
})
