import { test, expect } from '@playwright/test'

import { TherapistSessionPage } from './pages/TherapistSessionPage'
import { login } from './test-utils'
import { THERAPIST_SESSION_WRITE_MESSAGE, generateClinicalSessionId } from '../fixtures/clinical-session'

test.describe('Therapist Session Memory Flow', () => {
  let sessionPage: TherapistSessionPage
  let sessionId: string

  test.beforeEach(async ({ page }) => {
    await login(page)
    sessionPage = new TherapistSessionPage(page)
    sessionId = generateClinicalSessionId()
  })

  test('therapist can write to memory during session and retrieve it on reopen', async ({
    page,
  }) => {
    // Open therapist memory-aware session
    await sessionPage.gotoForSession(sessionId)
    await expect(sessionPage.memoryStatsTitle).toBeVisible()

    // Send therapeutic note that should be stored in memory
    await sessionPage.chatInput.fill(THERAPIST_SESSION_WRITE_MESSAGE)
    await sessionPage.sendButton.click()

    // Wait for the assistant response and memory persistence to complete
    await page.waitForTimeout(5000)

    // Verify memory was written: user + assistant == 2 entries
    await sessionPage.expectSessionMemoryCount('2')

    // Close and reopen the same session
    await page.goto('/dashboard')
    await sessionPage.gotoForSession(sessionId)
    await page.waitForLoadState('networkidle')

    // Verify memory is retrievable in subsequent session context
    await sessionPage.expectSessionMemoryCount('2')
  })
})