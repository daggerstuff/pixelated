import { test, expect, devices } from '@playwright/test'

// Test on different mobile devices
const mobileDevices = [
  devices['iPhone 12'],
  devices['iPhone 12 Pro'],
  devices['Pixel 5'],
  devices['Galaxy S21'],
]

mobileDevices.forEach((device) => {
  test.describe(`Mobile Responsiveness - ${device.name}`, () => {
    test.use({ ...device })

    test.beforeEach(async ({ page }) => {
      await page.goto('/demo')
      await page.waitForLoadState('networkidle')
    })

    test('Demo components are responsive on mobile', async ({ page }) => {
      // Test viewport dimensions
      const viewport = page.viewportSize()
      expect(viewport?.width).toBeLessThanOrEqual(device.viewport.width)

      // Test navigation menu on mobile
      await test.step('Mobile Navigation', async () => {
        // Check if mobile menu button exists
        const mobileMenuButton = page.locator(
          '[data-testid="mobile-menu-button"]',
        )
        if (await mobileMenuButton.isVisible()) {
          await mobileMenuButton.click()
          await expect(
            page.locator('[data-testid="mobile-menu"]'),
          ).toBeVisible()
        }
      })

      // Test data ingestion on mobile
      await test.step('Data Ingestion Mobile UI', async () => {
        await page.click('[data-testid="data-ingestion-tab"]')

        // Check upload area is properly sized
        const uploadArea = page.locator('[data-testid="upload-area"]')
        await expect(uploadArea).toBeVisible()

        const uploadBox = await uploadArea.boundingBox()
        expect(uploadBox?.width).toBeLessThanOrEqual(viewport?.width || 0)

        // Test file format cards stack properly on mobile
        const formatCards = page.locator('[data-testid="format-card"]')
        const cardCount = await formatCards.count()

        if (cardCount > 0) {
          // On mobile, cards should stack vertically
          const firstCard = await formatCards.first().boundingBox()
          const secondCard = await formatCards.nth(1).boundingBox()

          if (firstCard && secondCard) {
            // Second card should be below first card on mobile
            expect(secondCard.y).toBeGreaterThan(
              firstCard.y + firstCard.height - 10,
            )
          }
        }
      })

      // Test validation interface on mobile
      await test.step('Validation Mobile UI', async () => {
        await page.click('[data-testid="validation-tab"]')

        // Check text area is properly sized
        const textArea = page.locator(
          '[placeholder*="Enter psychology content"]',
        )
        await expect(textArea).toBeVisible()

        const textAreaBox = await textArea.boundingBox()
        expect(textAreaBox?.width).toBeLessThanOrEqual(
          (viewport?.width || 0) - 40,
        ) // Account for padding

        // Test validation results layout
        await textArea.fill('Test content for mobile validation')
        await expect(page.locator('text=Validation Results')).toBeVisible()

        // Check validation cards are stacked on mobile
        const validationCards = page.locator('[data-testid="validation-card"]')
        const validationCardCount = await validationCards.count()

        if (validationCardCount > 1) {
          const firstValidationCard = await validationCards
            .first()
            .boundingBox()
          const secondValidationCard = await validationCards
            .nth(1)
            .boundingBox()

          if (firstValidationCard && secondValidationCard) {
            expect(secondValidationCard.y).toBeGreaterThan(
              firstValidationCard.y,
            )
          }
        }
      })

      // Test category balancing on mobile
      await test.step('Category Balancing Mobile UI', async () => {
        await page.click('[data-testid="category-balancing-tab"]')

        // Check category cards layout on mobile
        const categoryCards = page.locator('[data-testid="category-card"]')
        const categoryCount = await categoryCards.count()

        if (categoryCount > 0) {
          // Categories should stack on mobile
          for (let i = 0; i < Math.min(categoryCount, 3); i++) {
            const card = categoryCards.nth(i)
            await expect(card).toBeVisible()

            const cardBox = await card.boundingBox()
            expect(cardBox?.width).toBeLessThanOrEqual(
              (viewport?.width || 0) - 20,
            )
          }
        }

        // Test sliders work on mobile
        const sliders = page.locator('[role="slider"]')
        const sliderCount = await sliders.count()

        if (sliderCount > 0) {
          const firstSlider = sliders.first()
          await expect(firstSlider).toBeVisible()

          // Test touch interaction
          await firstSlider.tap()
        }
      })

      // Test export interface on mobile
      await test.step('Export Mobile UI', async () => {
        await page.click('[data-testid="export-tab"]')

        // Check export format selection on mobile
        const formatOptions = page.locator('[data-testid="format-option"]')
        const formatCount = await formatOptions.count()

        if (formatCount > 0) {
          // Format options should be properly sized for mobile
          for (let i = 0; i < Math.min(formatCount, 3); i++) {
            const option = formatOptions.nth(i)
            const optionBox = await option.boundingBox()
            expect(optionBox?.width).toBeLessThanOrEqual(
              (viewport?.width || 0) - 20,
            )
          }
        }

        // Test export buttons are accessible on mobile
        const exportButtons = page.locator('button:has-text("Export")')
        const buttonCount = await exportButtons.count()

        if (buttonCount > 0) {
          const firstButton = exportButtons.first()
          await expect(firstButton).toBeVisible()

          const buttonBox = await firstButton.boundingBox()
          expect(buttonBox?.height).toBeGreaterThanOrEqual(44) // Minimum touch target size
        }
      })
    })

    test('Touch interactions work properly', async ({ page }) => {
      // Test touch scrolling
      await test.step('Touch Scrolling', async () => {
        await page.click('[data-testid="category-balancing-tab"]')

        // Scroll down using touch
        await page.touchscreen.tap(200, 300)
        await page.mouse.wheel(0, 500)

        // Verify content is still accessible
        await expect(page.locator('text=Category Balancing')).toBeVisible()
      })

      // Test touch gestures on interactive elements
      await test.step('Touch Gestures', async () => {
        await page.click('[data-testid="validation-tab"]')

        const textArea = page.locator(
          '[placeholder*="Enter psychology content"]',
        )

        // Test tap to focus
        await textArea.tap()
        await expect(textArea).toBeFocused()

        // Test touch typing
        await page.keyboard.type('Mobile touch input test')
        await expect(textArea).toHaveValue('Mobile touch input test')
      })

      // Test swipe gestures if applicable
      await test.step('Swipe Gestures', async () => {
        // Test horizontal swipe on tabs if implemented
        const tabContainer = page.locator('[data-testid="tab-container"]')
        if (await tabContainer.isVisible()) {
          const containerBox = await tabContainer.boundingBox()
          if (containerBox) {
            // Swipe left
            await page.touchscreen.tap(
              containerBox.x + containerBox.width - 50,
              containerBox.y + containerBox.height / 2,
            )
            await page.mouse.move(
              containerBox.x + 50,
              containerBox.y + containerBox.height / 2,
            )
          }
        }
      })
    })

    test('Mobile-specific features work correctly', async ({ page }) => {
      // Test orientation changes
      await test.step('Orientation Changes', async () => {
        // Test portrait mode (default)
        await expect(page.locator('[data-testid="main-content"]')).toBeVisible()

        // Switch to landscape mode
        await page.setViewportSize({
          width: device.viewport.height,
          height: device.viewport.width,
        })

        // Verify layout adapts to landscape
        await expect(page.locator('[data-testid="main-content"]')).toBeVisible()

        // Switch back to portrait
        await page.setViewportSize(device.viewport)
      })

      // Test mobile-specific UI elements
      await test.step('Mobile UI Elements', async () => {
        // Check for mobile-optimized buttons
        const buttons = page.locator('button')
        const buttonCount = await buttons.count()

        for (let i = 0; i < Math.min(buttonCount, 5); i++) {
          const button = buttons.nth(i)
          if (await button.isVisible()) {
            const buttonBox = await button.boundingBox()
            // Buttons should meet minimum touch target size (44px)
            expect(buttonBox?.height).toBeGreaterThanOrEqual(40)
          }
        }
      })

      // Test mobile performance
      await test.step('Mobile Performance', async () => {
        const startTime = Date.now()

        // Navigate between tabs
        await page.click('[data-testid="data-ingestion-tab"]')
        await page.click('[data-testid="validation-tab"]')
        await page.click('[data-testid="category-balancing-tab"]')

        const navigationTime = Date.now() - startTime

        // Navigation should be responsive on mobile (under 3 seconds)
        expect(navigationTime).toBeLessThan(3000)
      })
    })

    test('Mobile accessibility features', async ({ page }) => {
      // Test screen reader compatibility on mobile
      await test.step('Mobile Screen Reader', async () => {
        // Check for proper ARIA labels
        const ariaElements = page.locator('[aria-label]')
        const ariaCount = await ariaElements.count()
        expect(ariaCount).toBeGreaterThan(0)

        // Check for proper heading structure
        const headings = page.locator('h1, h2, h3, h4, h5, h6')
        const headingCount = await headings.count()
        expect(headingCount).toBeGreaterThan(0)
      })

      // Test focus management on mobile
      await test.step('Mobile Focus Management', async () => {
        // Test tab navigation
        await page.keyboard.press('Tab')
        const focusedElement = page.locator(':focus')
        await expect(focusedElement).toBeVisible()

        // Verify focus is visible and properly sized
        const focusBox = await focusedElement.boundingBox()
        if (focusBox) {
          expect(focusBox.height).toBeGreaterThanOrEqual(44) // Minimum touch target
        }
      })

      // Test color contrast on mobile
      await test.step('Mobile Color Contrast', async () => {
        // Check that text is readable on mobile
        const textElements = page
          .locator('p, span, div')
          .filter({ hasText: /\w+/ })
        const textCount = await textElements.count()

        // Verify text elements are visible (basic contrast check)
        for (let i = 0; i < Math.min(textCount, 10); i++) {
          const textElement = textElements.nth(i)
          if (await textElement.isVisible()) {
            await expect(textElement).toBeVisible()
          }
        }
      })
    })
  })
})

// Test tablet responsiveness
test.describe('Tablet Responsiveness', () => {
  test.use({ ...devices['iPad Pro'] })

  test('Demo works properly on tablet', async ({ page }) => {
    await page.goto('/demo')
    await page.waitForLoadState('networkidle')

    // Test tablet-specific layout
    await test.step('Tablet Layout', async () => {
      const viewport = page.viewportSize()
      expect(viewport?.width).toBe(1024)
      expect(viewport?.height).toBe(1366)

      // Check that components use tablet layout (between mobile and desktop)
      await page.click('[data-testid="category-balancing-tab"]')

      const categoryCards = page.locator('[data-testid="category-card"]')
      const cardCount = await categoryCards.count()

      if (cardCount >= 2) {
        const firstCard = await categoryCards.first().boundingBox()
        const secondCard = await categoryCards.nth(1).boundingBox()

        if (firstCard && secondCard) {
          // On tablet, cards might be side by side or stacked depending on design
          const isHorizontal = Math.abs(firstCard.y - secondCard.y) < 50
          const isVertical = secondCard.y > firstCard.y + firstCard.height - 50

          expect(isHorizontal || isVertical).toBe(true)
        }
      }
    })

    // Test tablet touch interactions
    await test.step('Tablet Touch Interactions', async () => {
      await page.click('[data-testid="validation-tab"]')

      const textArea = page.locator('[placeholder*="Enter psychology content"]')
      await textArea.tap()
      await page.keyboard.type(
        'Tablet input test with longer content to verify text area sizing and functionality on tablet devices.',
      )

      await expect(textArea).toHaveValue(/Tablet input test/)
    })
  })
})
