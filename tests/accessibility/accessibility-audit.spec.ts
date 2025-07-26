import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility Audit and Compliance', () => {
  let page: Page

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage
    await page.goto('/demo')
    await page.waitForLoadState('networkidle')
  })

  test('WCAG 2.1 AA compliance audit', async () => {
    await test.step('Overall page accessibility scan', async () => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()

      // Log any violations for debugging
      if (accessibilityScanResults.violations.length > 0) {
        console.log('Accessibility violations found:')
        accessibilityScanResults.violations.forEach((violation) => {
          console.log(`- ${violation.id}: ${violation.description}`)
          violation.nodes.forEach((node) => {
            console.log(`  Target: ${node.target}`)
            console.log(`  HTML: ${node.html}`)
          })
        })
      }

      // Should have no WCAG violations
      expect(accessibilityScanResults.violations).toHaveLength(0)
    })

    await test.step('Data ingestion section accessibility', async () => {
      await page.click('[data-testid="data-ingestion-tab"]')

      const scanResults = await new AxeBuilder({ page })
        .include('[data-testid="data-ingestion-section"]')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()

      expect(scanResults.violations).toHaveLength(0)
    })

    await test.step('Validation section accessibility', async () => {
      await page.click('[data-testid="validation-tab"]')

      const scanResults = await new AxeBuilder({ page })
        .include('[data-testid="validation-section"]')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()

      expect(scanResults.violations).toHaveLength(0)
    })

    await test.step('Category balancing section accessibility', async () => {
      await page.click('[data-testid="category-balancing-tab"]')

      const scanResults = await new AxeBuilder({ page })
        .include('[data-testid="category-balancing-section"]')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()

      expect(scanResults.violations).toHaveLength(0)
    })

    await test.step('Export section accessibility', async () => {
      await page.click('[data-testid="export-tab"]')

      const scanResults = await new AxeBuilder({ page })
        .include('[data-testid="export-section"]')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()

      expect(scanResults.violations).toHaveLength(0)
    })
  })

  test('Keyboard navigation and focus management', async () => {
    await test.step('Tab navigation through all interactive elements', async () => {
      // Start from the beginning
      await page.keyboard.press('Tab')

      const interactiveElements = []
      let currentElement = await page.locator(':focus').first()

      // Navigate through all tabbable elements
      for (let i = 0; i < 50; i++) {
        // Limit to prevent infinite loop
        if (await currentElement.isVisible()) {
          const tagName = await currentElement.evaluate((el) =>
            el.tagName.toLowerCase(),
          )
          const role = await currentElement.getAttribute('role')
          const ariaLabel = await currentElement.getAttribute('aria-label')

          interactiveElements.push({
            tagName,
            role,
            ariaLabel,
            text: await currentElement.textContent(),
          })
        }

        await page.keyboard.press('Tab')
        const nextElement = await page.locator(':focus').first()

        // Check if we've cycled back to the beginning
        const isSameElement = await currentElement.evaluate(
          (el, other) => el === other,
          await nextElement.elementHandle(),
        )
        if (isSameElement && i > 10) {
          break
        }

        currentElement = nextElement
      }

      // Should have found multiple interactive elements
      expect(interactiveElements.length).toBeGreaterThan(10)

      console.log(`Found ${interactiveElements.length} tabbable elements`)
    })

    await test.step('Focus visibility and indicators', async () => {
      // Test focus visibility on different element types
      const focusableSelectors = [
        'button',
        'input',
        'textarea',
        '[role="button"]',
        '[role="tab"]',
        '[role="slider"]',
      ]

      for (const selector of focusableSelectors) {
        const elements = page.locator(selector)
        const count = await elements.count()

        if (count > 0) {
          const firstElement = elements.first()
          await firstElement.focus()

          // Check if focus is visible
          const focusedElement = page.locator(':focus')
          await expect(focusedElement).toBeVisible()

          // Check for focus indicators (outline, box-shadow, etc.)
          const styles = await focusedElement.evaluate((el) => {
            const computed = window.getComputedStyle(el)
            return {
              outline: computed.outline,
              outlineWidth: computed.outlineWidth,
              outlineStyle: computed.outlineStyle,
              boxShadow: computed.boxShadow,
            }
          })

          // Should have some form of focus indicator
          const hasFocusIndicator =
            styles.outline !== 'none' ||
            styles.outlineWidth !== '0px' ||
            styles.boxShadow !== 'none'

          expect(hasFocusIndicator).toBe(true)
        }
      }
    })

    await test.step('Keyboard shortcuts and access keys', async () => {
      // Test common keyboard shortcuts
      await page.keyboard.press('Escape') // Should close modals/dropdowns
      await page.keyboard.press('Enter') // Should activate focused element
      await page.keyboard.press('Space') // Should activate buttons/checkboxes

      // Test arrow key navigation for tab panels
      await page.click('[data-testid="data-ingestion-tab"]')
      await page.keyboard.press('ArrowRight')

      // Should navigate to next tab
      const activeTab = page.locator('[role="tab"][aria-selected="true"]')
      await expect(activeTab).toBeVisible()
    })
  })

  test('Screen reader compatibility', async () => {
    await test.step('ARIA labels and descriptions', async () => {
      // Check for proper ARIA labeling
      const elementsNeedingLabels = [
        'button',
        'input',
        'textarea',
        '[role="button"]',
        '[role="tab"]',
        '[role="tabpanel"]',
        '[role="slider"]',
        '[role="progressbar"]',
      ]

      for (const selector of elementsNeedingLabels) {
        const elements = page.locator(selector)
        const count = await elements.count()

        for (let i = 0; i < count; i++) {
          const element = elements.nth(i)

          if (await element.isVisible()) {
            const ariaLabel = await element.getAttribute('aria-label')
            const ariaLabelledby = await element.getAttribute('aria-labelledby')
            const title = await element.getAttribute('title')
            const textContent = await element.textContent()

            // Element should have some form of accessible name
            const hasAccessibleName =
              ariaLabel ||
              ariaLabelledby ||
              title ||
              (textContent && textContent.trim().length > 0)

            if (!hasAccessibleName) {
              const html = await element.innerHTML()
              console.warn(`Element without accessible name: ${html}`)
            }

            expect(hasAccessibleName).toBe(true)
          }
        }
      }
    })

    await test.step('Heading structure and hierarchy', async () => {
      const headings = page.locator('h1, h2, h3, h4, h5, h6')
      const headingCount = await headings.count()

      expect(headingCount).toBeGreaterThan(0)

      // Check heading hierarchy
      const headingLevels = []
      for (let i = 0; i < headingCount; i++) {
        const heading = headings.nth(i)
        const tagName = await heading.evaluate((el) => el.tagName.toLowerCase())
        const level = parseInt(tagName.charAt(1))
        const text = await heading.textContent()

        headingLevels.push({ level, text })
      }

      // Should start with h1 or h2
      if (headingLevels.length > 0) {
        expect(headingLevels[0]?.level).toBeLessThanOrEqual(2)

        // Check for proper nesting (no skipping levels)
        for (let i = 1; i < headingLevels.length; i++) {
          const currentLevel = headingLevels[i]?.level
          const previousLevel = headingLevels[i - 1]?.level

          if (currentLevel !== undefined && previousLevel !== undefined) {
            // Should not skip more than one level
            if (currentLevel > previousLevel) {
              expect(currentLevel - previousLevel).toBeLessThanOrEqual(1)
            }
          }
        }
      }

      console.log('Heading structure:', headingLevels)
    })

    await test.step('Form labels and associations', async () => {
      const formControls = page.locator('input, textarea, select')
      const controlCount = await formControls.count()

      for (let i = 0; i < controlCount; i++) {
        const control = formControls.nth(i)

        if (await control.isVisible()) {
          const id = await control.getAttribute('id')
          const ariaLabel = await control.getAttribute('aria-label')
          const ariaLabelledby = await control.getAttribute('aria-labelledby')

          // Check for associated label
          let hasLabel = false

          if (id) {
            const associatedLabel = page.locator(`label[for="${id}"]`)
            hasLabel = (await associatedLabel.count()) > 0
          }

          hasLabel = hasLabel || !!ariaLabel || !!ariaLabelledby

          expect(hasLabel).toBe(true)
        }
      }
    })

    await test.step('Live regions and dynamic content', async () => {
      // Check for live regions for dynamic content
      const liveRegions = page.locator(
        '[aria-live], [role="status"], [role="alert"]',
      )
      const liveRegionCount = await liveRegions.count()

      // Should have live regions for dynamic content updates
      expect(liveRegionCount).toBeGreaterThan(0)

      // Test live region updates
      await page.click('[data-testid="validation-tab"]')
      const textArea = page.locator('[placeholder*="Enter psychology content"]')
      await textArea.fill('Test content for live region updates')

      // Should announce validation results
      const statusRegion = page.locator('[role="status"], [aria-live="polite"]')
      await expect(statusRegion).toBeVisible()
    })
  })

  test('Color contrast and visual accessibility', async () => {
    await test.step('Color contrast ratios', async () => {
      // Test color contrast for text elements
      const textElements = page
        .locator('p, span, div, button, a')
        .filter({ hasText: /\w+/ })
      const textCount = await textElements.count()

      const contrastIssues = []

      for (let i = 0; i < Math.min(textCount, 20); i++) {
        // Test first 20 elements
        const element = textElements.nth(i)

        if (await element.isVisible()) {
          const styles = await element.evaluate((el) => {
            const computed = window.getComputedStyle(el)
            return {
              color: computed.color,
              backgroundColor: computed.backgroundColor,
              fontSize: computed.fontSize,
            }
          })

          // Basic contrast check (simplified)
          const hasGoodContrast = await element.evaluate((el) => {
            const computed = window.getComputedStyle(el)
            const { color } = computed
            const bgColor = computed.backgroundColor

            // Simple check: ensure text is not the same color as background
            return color !== bgColor && color !== 'rgba(0, 0, 0, 0)'
          })

          if (!hasGoodContrast) {
            const text = await element.textContent()
            contrastIssues.push({ text: text?.slice(0, 50), styles })
          }
        }
      }

      if (contrastIssues.length > 0) {
        console.log('Potential contrast issues:', contrastIssues)
      }

      // Should have minimal contrast issues
      expect(contrastIssues.length).toBeLessThan(textCount * 0.1) // Less than 10% of elements
    })

    await test.step('Focus indicators visibility', async () => {
      const focusableElements = page.locator(
        'button, input, textarea, [role="button"], [role="tab"]',
      )
      const focusableCount = await focusableElements.count()

      for (let i = 0; i < Math.min(focusableCount, 10); i++) {
        const element = focusableElements.nth(i)

        if (await element.isVisible()) {
          await element.focus()

          // Check focus indicator visibility
          const focusStyles = await element.evaluate((el) => {
            const computed = window.getComputedStyle(el)
            return {
              outline: computed.outline,
              outlineColor: computed.outlineColor,
              outlineWidth: computed.outlineWidth,
              boxShadow: computed.boxShadow,
            }
          })

          // Should have visible focus indicator
          const hasVisibleFocus =
            focusStyles.outline !== 'none' ||
            focusStyles.outlineWidth !== '0px' ||
            focusStyles.boxShadow !== 'none'

          expect(hasVisibleFocus).toBe(true)
        }
      }
    })

    await test.step('Image alt text and descriptions', async () => {
      const images = page.locator('img')
      const imageCount = await images.count()

      for (let i = 0; i < imageCount; i++) {
        const image = images.nth(i)

        if (await image.isVisible()) {
          const alt = await image.getAttribute('alt')
          const ariaLabel = await image.getAttribute('aria-label')
          const ariaLabelledby = await image.getAttribute('aria-labelledby')
          const role = await image.getAttribute('role')

          // Decorative images should have empty alt or role="presentation"
          // Content images should have descriptive alt text
          const isDecorative = alt === '' || role === 'presentation'
          const hasDescription = alt && alt.length > 0
          const hasAriaLabel = ariaLabel || ariaLabelledby

          // Image should either be marked as decorative or have description
          expect(isDecorative || hasDescription || hasAriaLabel).toBe(true)
        }
      }
    })
  })

  test('Motor accessibility and interaction', async () => {
    await test.step('Touch target sizes', async () => {
      const interactiveElements = page.locator(
        'button, input, [role="button"], [role="tab"], a',
      )
      const elementCount = await interactiveElements.count()

      for (let i = 0; i < elementCount; i++) {
        const element = interactiveElements.nth(i)

        if (await element.isVisible()) {
          const boundingBox = await element.boundingBox()

          if (boundingBox) {
            // WCAG recommends minimum 44x44 pixels for touch targets
            expect(boundingBox.width).toBeGreaterThanOrEqual(40) // Allow slight tolerance
            expect(boundingBox.height).toBeGreaterThanOrEqual(40)
          }
        }
      }
    })

    await test.step('Click target spacing', async () => {
      const buttons = page.locator('button')
      const buttonCount = await buttons.count()

      if (buttonCount > 1) {
        for (let i = 0; i < buttonCount - 1; i++) {
          const button1 = buttons.nth(i)
          const button2 = buttons.nth(i + 1)

          if ((await button1.isVisible()) && (await button2.isVisible())) {
            const box1 = await button1.boundingBox()
            const box2 = await button2.boundingBox()

            if (box1 && box2) {
              // Check if buttons are adjacent (same row/column)
              const sameRow = Math.abs(box1.y - box2.y) < 10
              const sameColumn = Math.abs(box1.x - box2.x) < 10

              if (sameRow || sameColumn) {
                const distance = Math.min(
                  Math.abs(box1.x + box1.width - box2.x),
                  Math.abs(box2.x + box2.width - box1.x),
                  Math.abs(box1.y + box1.height - box2.y),
                  Math.abs(box2.y + box2.height - box1.y),
                )

                // Should have adequate spacing between interactive elements
                expect(distance).toBeGreaterThanOrEqual(8)
              }
            }
          }
        }
      }
    })

    await test.step('Drag and drop accessibility', async () => {
      // Check for keyboard alternatives to drag and drop
      const draggableElements = page.locator('[draggable="true"]')
      const draggableCount = await draggableElements.count()

      for (let i = 0; i < draggableCount; i++) {
        const element = draggableElements.nth(i)

        if (await element.isVisible()) {
          // Should have keyboard alternative or ARIA instructions
          const ariaDescribedby = await element.getAttribute('aria-describedby')
          const ariaLabel = await element.getAttribute('aria-label')
          const title = await element.getAttribute('title')

          // Should provide keyboard instructions
          const hasKeyboardInstructions = ariaDescribedby || ariaLabel || title
          expect(hasKeyboardInstructions).toBe(true)
        }
      }
    })
  })

  test('Cognitive accessibility', async () => {
    await test.step('Error messages and validation', async () => {
      await page.click('[data-testid="validation-tab"]')

      const textArea = page.locator('[placeholder*="Enter psychology content"]')

      // Test with problematic content to trigger validation errors
      await textArea.fill('This content has issues')

      // Wait for validation results
      await expect(page.locator('text=Validation Results')).toBeVisible()

      // Check for clear error messages
      const errorMessages = page.locator(
        '[role="alert"], .error, [aria-invalid="true"]',
      )
      const errorCount = await errorMessages.count()

      if (errorCount > 0) {
        for (let i = 0; i < errorCount; i++) {
          const errorElement = errorMessages.nth(i)
          const errorText = await errorElement.textContent()

          // Error messages should be descriptive
          expect(errorText).toBeTruthy()
          expect(errorText!.length).toBeGreaterThan(10)
        }
      }
    })

    await test.step('Help text and instructions', async () => {
      // Check for help text and instructions
      const helpElements = page.locator(
        '[role="tooltip"], .help-text, [aria-describedby]',
      )
      const helpCount = await helpElements.count()

      expect(helpCount).toBeGreaterThan(0)

      // Help text should be clear and concise
      for (let i = 0; i < Math.min(helpCount, 5); i++) {
        const helpElement = helpElements.nth(i)

        if (await helpElement.isVisible()) {
          const helpText = await helpElement.textContent()
          expect(helpText).toBeTruthy()
          expect(helpText!.length).toBeGreaterThan(5)
        }
      }
    })

    await test.step('Progress indicators and feedback', async () => {
      await page.click('[data-testid="export-tab"]')

      // Select a format and start export
      await page.click('[data-testid="format-json"]')
      await page.click('button:has-text("Export Selected")')

      // Should show progress indicators
      const progressBars = page.locator('[role="progressbar"]')
      await expect(progressBars.first()).toBeVisible()

      // Progress bars should have accessible labels
      const progressBar = progressBars.first()
      const ariaLabel = await progressBar.getAttribute('aria-label')
      const ariaValueNow = await progressBar.getAttribute('aria-valuenow')
      const ariaValueMax = await progressBar.getAttribute('aria-valuemax')

      expect(ariaLabel || ariaValueNow).toBeTruthy()
      expect(ariaValueMax).toBeTruthy()
    })
  })

  test('Responsive accessibility', async () => {
    await test.step('Mobile accessibility', async () => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })

      // Re-run basic accessibility scan on mobile
      const mobileAccessibilityResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()

      expect(mobileAccessibilityResults.violations).toHaveLength(0)

      // Check touch target sizes on mobile
      const mobileButtons = page.locator('button')
      const mobileButtonCount = await mobileButtons.count()

      for (let i = 0; i < Math.min(mobileButtonCount, 10); i++) {
        const button = mobileButtons.nth(i)

        if (await button.isVisible()) {
          const boundingBox = await button.boundingBox()

          if (boundingBox) {
            // Mobile touch targets should be at least 44x44 pixels
            expect(boundingBox.width).toBeGreaterThanOrEqual(44)
            expect(boundingBox.height).toBeGreaterThanOrEqual(44)
          }
        }
      }
    })

    await test.step('High contrast mode compatibility', async () => {
      // Simulate high contrast mode
      await page.emulateMedia({ colorScheme: 'dark' })

      // Check that content is still visible and accessible
      const textElements = page
        .locator('p, span, div, button')
        .filter({ hasText: /\w+/ })
      const visibleTextCount = await textElements.count()

      expect(visibleTextCount).toBeGreaterThan(0)

      // Reset to normal mode
      await page.emulateMedia({ colorScheme: 'light' })
    })
  })
})
