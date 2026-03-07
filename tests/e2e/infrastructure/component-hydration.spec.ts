import { test, expect } from '@playwright/test'

test.describe('Component Hydration Tests', () => {
  test('Theme toggle hydrates and functions correctly', async ({ page }) => {
    // Visit the homepage
    await page.goto('/')

    // Theme toggle uses client:load directive
    // Wait for hydration to complete
    await page.waitForSelector('button[aria-label="Toggle theme"]')

    // Check initial theme (likely system default or light)
    const initialTheme = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light'
    })

    // Click the theme toggle
    await page.click('button[aria-label="Toggle theme"]')

    // Check that the theme changed
    const newTheme = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light'
    })

    // Theme should have toggled
    expect(newTheme).not.toEqual(initialTheme)

    // Click again to toggle back
    await page.click('button[aria-label="Toggle theme"]')

    // Check that the theme changed back
    const finalTheme = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light'
    })

    // Should be back to the initial theme
    expect(finalTheme).toEqual(initialTheme)
  })

  test('AIChat component hydrates and accepts input', async ({ page }) => {
    // Visit the AI chat page
    await page.goto('/ai-chat')

    // Wait for hydration (input field becomes interactive)
    const chatInput = page.locator('#chat-input')
    await chatInput.waitFor({ state: 'visible' })

    // Enter a test message
    await chatInput.fill('Hello, AI assistant')

    // Click the send button
    await page.click('button[type="submit"]')

    // Check that the message appears in the chat
    await expect(page.locator('.message-user')).toContainText(
      'Hello, AI assistant',
    )

    // Check that the AI is responding (loading indicator appears)
    await expect(page.locator('.message-loading')).toBeVisible()

    // Wait for AI response (might take time, increase timeout)
    await expect(page.locator('.message-ai')).toBeVisible({ timeout: 30000 })
  })

  test('AdminDashboard component hydrates metrics with client:load', async ({
    page,
  }) => {
    // Visit the admin dashboard page
    await page.goto('/admin')

    // Wait for component hydration to complete
    await page.waitForSelector('.metrics-card', { state: 'visible' })

    // Check initial metrics are displayed
    await expect(page.locator('.active-users')).toBeVisible()
    await expect(page.locator('.system-load')).toBeVisible()

    // Refresh metrics
    await page.click('button[aria-label="Refresh Metrics"]')

    // Check for loading state
    await expect(page.locator('.metrics-loading')).toBeVisible()

    // Wait for updated metrics
    await expect(page.locator('.metrics-updated-time')).toBeVisible()

    // Check that metrics were updated (last update time should change)
    const updatedTime = await page
      .locator('.metrics-updated-time')
      .textContent()

    // Wait a moment
    await page.waitForTimeout(1000)

    // Refresh again
    await page.click('button[aria-label="Refresh Metrics"]')
    await expect(page.locator('.metrics-loading')).toBeVisible()
    await expect(page.locator('.metrics-updated-time')).toBeVisible()

    // Get new update time
    const newUpdatedTime = await page
      .locator('.metrics-updated-time')
      .textContent()

    // Times should be different after refresh
    expect(newUpdatedTime).not.toEqual(updatedTime)
  })

  test('Modal component hydrates with client:visible', async ({ page }) => {
    // Visit a page with a modal component
    await page.goto('/components/modal-demo')

    // Find the button to open the modal
    const openModalButton = page.locator('button:has-text("Open Modal")')
    await expect(openModalButton).toBeVisible()

    // Initially the modal should be closed
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()

    // Open the modal
    await openModalButton.click()

    // Modal should now be visible
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    // Check that modal overlay is present
    await expect(page.locator('.modal-overlay')).toBeVisible()

    // Check that modal content is present
    await expect(page.locator('.modal-content')).toBeVisible()

    // Close the modal
    await page.locator('button[aria-label="Close modal"]').click()

    // Modal should close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()
  })

  test('Forms submit and validate correctly', async ({ page }) => {
    // Visit a page with a form
    await page.goto('/contact')

    // Wait for the form to hydrate
    await page.waitForSelector('form', { state: 'visible' })

    // Try submitting without required fields
    await page.click('button[type="submit"]')

    // Validation error messages should appear
    await expect(page.locator('.form-error')).toBeVisible()

    // Fill in the required fields
    await page.fill('input[name="name"]', 'Test User')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('textarea[name="message"]', 'This is a test message')

    // Submit the form
    await page.click('button[type="submit"]')

    // Error messages should be gone
    await expect(page.locator('.form-error')).not.toBeVisible()

    // Success message should appear
    await expect(page.locator('.form-success')).toBeVisible()
    await expect(page.locator('.form-success')).toContainText('Message sent')
  })
})
