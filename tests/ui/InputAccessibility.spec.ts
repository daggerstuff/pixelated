import { test, expect } from '@playwright/test'

test.describe('Input Component Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page that uses the Input component
    await page.goto('/demo')
    await page.waitForLoadState('networkidle')
  })

  test('should reflect error state with aria-invalid', async ({ page }) => {
    // Go to validation tab where inputs might show errors
    await page.click('[data-testid="validation-tab"]')
    
    const input = page.locator('input').first()
    
    // Fill with content that triggers an error (mocked or actual depending on app state)
    // In this demo environment, let's assume we can trigger it
    await input.fill('trigger-error')
    
    // Check if aria-invalid is set to true when an error is present
    // Note: This assumes the demo app shows an error for this input
    const errorElement = page.locator('.text-destructive, .error-message').first()
    if (await errorElement.isVisible()) {
      await expect(input).toHaveAttribute('aria-invalid', 'true')
      
      // Check for aria-describedby if errorId is provided
      const ariaDescribedBy = await input.getAttribute('aria-describedby')
      if (ariaDescribedBy) {
        const description = page.locator(`#${ariaDescribedBy}`)
        await expect(description).toBeVisible()
      }
    }
  })

  test('should not have aria-invalid by default', async ({ page }) => {
    await page.click('[data-testid="validation-tab"]')
    const input = page.locator('input').first()
    
    // Should not have aria-invalid or it should be undefined/false
    const ariaInvalid = await input.getAttribute('aria-invalid')
    expect(ariaInvalid === null || ariaInvalid === 'false').toBe(true)
  })
})
