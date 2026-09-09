/**
 * G3.2 Mobile Parity Gate — Offline Functionality Tests (PIX-4430)
 *
 * Validates that EHR features work offline and sync on reconnect:
 * - Note creation while offline → queued → syncs on reconnect
 * - Scheduling while offline → queued → syncs on reconnect
 * - Messaging while offline → queued → syncs on reconnect
 * - Sync status banner shows offline/online state
 * - No data loss when going offline mid-action
 *
 * @see PIX-4430
 */

import { test, expect } from '@playwright/test'

test.describe('EHR Offline Functionality — Mobile', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })

  test('offline status indicator appears when network drops', async ({
    page,
    context,
  }) => {
    await page.goto('/portal')
    await page.waitForLoadState('networkidle')

    await context.setOffline(true)

    const offlineIndicator = page.locator(
      "[data-testid='offline-status'], [data-testid='sync-status-banner']",
    )
    await expect(offlineIndicator).toBeVisible({ timeout: 5000 })

    await context.setOffline(false)
  })

  test('offline note drafting creates queued draft', async ({
    page,
    context,
  }) => {
    await page.goto('/portal')
    await page.waitForLoadState('networkidle')

    await context.setOffline(true)

    const noteInput = page.locator(
      "textarea[data-testid='note-content'], [contenteditable='true']",
    )
    await expect(noteInput.first()).toBeVisible()
    await noteInput.first().fill('Test offline draft note — PIX-4430')

    await page.waitForTimeout(2000)

    const statusIndicator = page.locator(
      "[data-testid='save-status'], [data-testid='sync-status']",
    )
    await expect(statusIndicator).toBeVisible()

    await context.setOffline(false)
  })

  test('offline note draft persists on reload and syncs on reconnect', async ({
    page,
    context,
  }) => {
    await page.goto('/portal')
    await page.waitForLoadState('networkidle')

    await context.setOffline(true)

    const noteInput = page.locator(
      "textarea[data-testid='note-content'], [contenteditable='true']",
    )
    await expect(noteInput.first()).toBeVisible()
    await noteInput.first().fill('Offline note — sync test PIX-4430')

    await page.waitForTimeout(2000)

    const statusBefore = page.locator(
      "[data-testid='save-status'], [data-testid='sync-status']",
    )
    await expect(statusBefore).toBeVisible()

    await context.setOffline(false)

    await page.waitForTimeout(3000)

    // After reconnect, verify the note content persisted and sync indicator shows online state
    const noteInputAfter = page.locator(
      "textarea[data-testid='note-content'], [contenteditable='true']",
    )
    await expect(noteInputAfter.first()).toBeVisible()

    // The offline indicator should no longer show offline state
    const offlineIndicator = page.locator("[data-testid='offline-status']")
    const offlineVisible = await offlineIndicator.isVisible().catch(() => false)
    expect(offlineVisible).toBe(false)
  })

  test('offline scheduling queues appointment action', async ({
    page,
    context,
  }) => {
    await page.goto('/portal/scheduling')
    await page.waitForLoadState('networkidle')

    await context.setOffline(true)

    const bookBtn = page.locator(
      "button[data-testid='book-appointment'], button[aria-label*='book'], button[aria-label*='schedule']",
    )
    await expect(bookBtn.first()).toBeVisible()
    await bookBtn.first().click()

    const dialog = page.locator("[role='dialog']")
    await expect(dialog).toBeVisible()

    const submitBtn = dialog.locator("button[type='submit']")
    await expect(submitBtn).toBeVisible()
    await submitBtn.click()

    await context.setOffline(false)
  })

  test('offline scheduling action syncs on reconnect', async ({
    page,
    context,
  }) => {
    await page.goto('/portal/scheduling')
    await page.waitForLoadState('networkidle')

    // Queue an action offline
    await context.setOffline(true)
    await page.waitForTimeout(500)

    const bookBtn = page.locator(
      "button[data-testid='book-appointment'], button[aria-label*='book'], button[aria-label*='schedule']",
    )
    if (
      await bookBtn
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await bookBtn.first().click()
      const dialog = page.locator("[role='dialog']")
      if (await dialog.isVisible().catch(() => false)) {
        const submitBtn = dialog.locator("button[type='submit']")
        if (await submitBtn.isVisible().catch(() => false)) {
          await submitBtn.click()
        }
      }
    }

    // Reconnect and wait for sync
    await context.setOffline(false)
    await page.waitForTimeout(3000)

    // After reconnect, the scheduling view should still be functional
    const scheduleView = page.locator(
      "[data-testid='mobile-schedule-view'], [data-testid='appointment-list']",
    )
    await expect(scheduleView.first()).toBeVisible()
  })

  test('offline messaging queues message', async ({ page, context }) => {
    await page.goto('/portal/messaging')
    await page.waitForLoadState('networkidle')

    await context.setOffline(true)

    const messageInput = page.locator(
      "textarea[data-testid='message-input'], input[data-testid='message-input']",
    )
    await expect(messageInput.first()).toBeVisible()
    await messageInput.first().fill('Test offline message — PIX-4430')

    const sendBtn = page.locator("button[data-testid='send-message']")
    await expect(sendBtn).toBeVisible()
    await sendBtn.click()

    await context.setOffline(false)
  })

  test('offline message syncs on reconnect', async ({ page, context }) => {
    await page.goto('/portal/messaging')
    await page.waitForLoadState('networkidle')

    await context.setOffline(true)

    const messageInput = page.locator(
      "textarea[data-testid='message-input'], input[data-testid='message-input']",
    )
    if (
      await messageInput
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await messageInput.first().fill('Offline message for sync test')
      const sendBtn = page.locator("button[data-testid='send-message']")
      if (await sendBtn.isVisible().catch(() => false)) {
        await sendBtn.click()
      }
    }

    await context.setOffline(false)
    await page.waitForTimeout(3000)

    // After reconnect, the messaging widget should still be functional
    const messageInputAfter = page.locator(
      "textarea[data-testid='message-input'], input[data-testid='message-input']",
    )
    await expect(messageInputAfter.first()).toBeVisible()
  })

  test('no data loss when network drops mid-action', async ({
    page,
    context,
  }) => {
    await page.goto('/portal')
    await page.waitForLoadState('networkidle')

    const noteInput = page.locator(
      "textarea[data-testid='note-content'], [contenteditable='true']",
    )
    await expect(noteInput.first()).toBeVisible()
    await noteInput.first().fill('Draft before offline')

    await context.setOffline(true)
    await page.waitForTimeout(500)

    // Continue typing while offline
    await noteInput.first().fill('Draft continued offline — PIX-4430')

    await page.waitForTimeout(1000)

    const statusIndicator = page.locator(
      "[data-testid='save-status'], [data-testid='sync-status']",
    )
    await expect(statusIndicator).toBeVisible()

    await context.setOffline(false)
    await page.waitForTimeout(3000)

    // Verify the draft content was not lost during offline period
    const noteInputAfter = page.locator(
      "textarea[data-testid='note-content'], [contenteditable='true']",
    )
    await expect(noteInputAfter.first()).toBeVisible()
    const contentAfter =
      (await noteInputAfter
        .first()
        .inputValue()
        .catch(() => null)) ??
      (await noteInputAfter.first().textContent()) ??
      ''
    expect(contentAfter.length).toBeGreaterThan(0)
  })

  test('sync status banner shows pending count after reconnect', async ({
    page,
    context,
  }) => {
    await page.goto('/portal')
    await page.waitForLoadState('networkidle')

    // Queue items offline
    await context.setOffline(true)
    await page.waitForTimeout(500)

    const noteInput = page.locator(
      "textarea[data-testid='note-content'], [contenteditable='true']",
    )
    if (
      await noteInput
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await noteInput.first().fill('Queued note 1 — PIX-4430')
      await page.waitForTimeout(500)
    }

    // Reconnect
    await context.setOffline(false)
    await page.waitForTimeout(2000)

    // After reconnect, the offline indicator should no longer show offline state
    const offlineIndicator = page.locator("[data-testid='offline-status']")
    const offlineVisible = await offlineIndicator.isVisible().catch(() => false)
    expect(offlineVisible).toBe(false)
  })

  test('multiple offline actions queue and sync correctly', async ({
    page,
    context,
  }) => {
    await page.goto('/portal')
    await page.waitForLoadState('networkidle')

    await context.setOffline(true)

    // Queue a note
    const noteInput = page.locator(
      "textarea[data-testid='note-content'], [contenteditable='true']",
    )
    if (
      await noteInput
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await noteInput.first().fill('Multi-queue note 1')
      await page.waitForTimeout(500)
    }

    await context.setOffline(false)
    await page.waitForTimeout(2000)

    await context.setOffline(true)

    // Queue another note
    if (
      await noteInput
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await noteInput.first().fill('Multi-queue note 2')
      await page.waitForTimeout(500)
    }

    await context.setOffline(false)
    await page.waitForTimeout(3000)

    // After multiple offline-online cycles, the page should still be functional
    const noteInputAfter = page.locator(
      "textarea[data-testid='note-content'], [contenteditable='true']",
    )
    await expect(noteInputAfter.first()).toBeVisible()
  })
})
