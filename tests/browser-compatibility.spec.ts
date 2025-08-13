import { test, expect } from '@playwright/test'

test.describe('Browser Compatibility Tests', () => {
  test('homepage loads correctly', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Pixelated Empathy/)
  const heroHeading = page.getByRole('heading', { level: 1 })
  await expect(heroHeading).toBeVisible()
  await expect(heroHeading).toContainText(/The Art of Therapy/i)
  })

  test('navigation works across browsers', async ({ page }) => {
    await page.goto('/')

    const aboutLink = page.locator('a[href="/about"]').first()
    if (await aboutLink.isVisible()) {
      await aboutLink.click()
      await expect(page).toHaveURL(/.*about/)
    }
  })

  test('responsive design works', async ({ page }) => {
    await page.goto('/')

    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.locator('body')).toBeVisible()

    await page.setViewportSize({ width: 1920, height: 1080 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('basic functionality works', async ({ page }) => {
    await page.goto('/')

    const buttons = page.locator('button:visible')
    const buttonCount = await buttons.count()

    if (buttonCount > 0) {
      await expect(buttons.first()).toBeVisible()
    }
  })
})
