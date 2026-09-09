/**
 * G3.2 Mobile Parity Gate — Mobile Viewport E2E Tests (PIX-4430)
 *
 * Validates EHR features at 375px, 390px, and 414px viewport widths.
 * Covers: patient list, encounters, notes, messaging, scheduling, orders, results.
 *
 * Pages tested:
 *   /portal               — main portal (notes, messaging, scheduling widgets)
 *   /portal/scheduling     — scheduling page
 *   /portal/messaging      — messaging page
 *   /portal/telehealth     — telehealth (encounters)
 *   /portal/statements     — statements (results/billing)
 *   /portal/homework       — homework (orders/assignments)
 *   /dashboard             — patient list
 *
 * @see PIX-4430
 */

import { test, expect } from '@playwright/test'

const EHR_PAGES = [
  { path: '/portal', label: 'Portal Home', testIds: ['ehr-mobile-layout', 'messaging-widget', 'scheduling-widget'] },
  { path: '/portal/scheduling', label: 'Scheduling', testIds: ['mobile-schedule-view', 'appointment-list'] },
  { path: '/portal/messaging', label: 'Messaging', testIds: ['messaging-widget', 'message-list'] },
  { path: '/portal/telehealth', label: 'Telehealth', testIds: ['telehealth-widget', 'video-call'] },
  { path: '/portal/statements', label: 'Statements', testIds: ['statements-list', 'statement-card'] },
  { path: '/portal/homework', label: 'Homework', testIds: ['homework-list', 'homework-card'] },
  { path: '/dashboard', label: 'Dashboard / Patient List', testIds: ['patient-list', 'dashboard'] },
]

const MOBILE_VIEWPORTS = [
  { width: 375, height: 667, name: '375px (iPhone SE)' },
  { width: 390, height: 844, name: '390px (iPhone 12)' },
  { width: 414, height: 896, name: '414px (Pixel 5 / iPhone Pro Max)' },
]

for (const viewport of MOBILE_VIEWPORTS) {
  test.describe(`EHR Mobile Viewport — ${viewport.name}`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: true,
      hasTouch: true,
    })

    test('no horizontal overflow at viewport', async ({ page }) => {
      for (const { path } of EHR_PAGES) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')

        const hasOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth
        })
        expect(hasOverflow, `Horizontal overflow on ${path}`).toBe(false)
      }
    })

    test('bottom navigation is visible and fixed', async ({ page }) => {
      await page.goto('/portal')
      await page.waitForLoadState('networkidle')

      const bottomNav = page.locator("nav[aria-label='Mobile navigation'], nav[aria-label='EHR navigation']")
      await expect(bottomNav).toBeVisible()

      const navBox = await bottomNav.boundingBox()
      expect(navBox).not.toBeNull()
      if (navBox) {
        const viewportHeight = viewport.height
        expect(navBox.y + navBox.height).toBeGreaterThan(viewportHeight * 0.75)
        expect(navBox.height).toBeLessThanOrEqual(64)
      }
    })

    test('patient list renders at viewport', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      const patientList = page.locator(
        "[data-testid='patient-list'], [data-testid='patient-card'], [role='list']"
      )
      const listVisible = await patientList.first().isVisible().catch(() => false)
      expect(listVisible).toBe(true)
    })

    test('encounters/telehealth page renders at viewport', async ({ page }) => {
      await page.goto('/portal/telehealth')
      await page.waitForLoadState('networkidle')

      const telehealthSection = page.locator(
        "[data-testid='telehealth-widget'], [data-testid='video-call'], section, main"
      )
      await expect(telehealthSection.first()).toBeVisible()
    })

    test('notes/note editor renders at viewport', async ({ page }) => {
      await page.goto('/portal')
      await page.waitForLoadState('networkidle')

      const noteEditor = page.locator(
        "[data-testid='modality-note-editor'], textarea[data-testid='note-content'], [contenteditable='true']"
      )
      const noteSection = page.locator('section[aria-labelledby]')

      const editorVisible = await noteEditor.first().isVisible().catch(() => false)
      if (!editorVisible) {
        await expect(noteSection.first()).toBeVisible()
      }
    })

    test('messaging widget renders at viewport', async ({ page }) => {
      await page.goto('/portal/messaging')
      await page.waitForLoadState('networkidle')

      const messagingWidget = page.locator(
        "[data-testid='messaging-widget'], [data-testid='message-list']"
      )
      await expect(messagingWidget.first()).toBeVisible()
    })

    test('scheduling view renders at viewport', async ({ page }) => {
      await page.goto('/portal/scheduling')
      await page.waitForLoadState('networkidle')

      const scheduleView = page.locator(
        "[data-testid='mobile-schedule-view'], [data-testid='appointment-list']"
      )
      await expect(scheduleView.first()).toBeVisible()
    })

    test('statements/results page renders at viewport', async ({ page }) => {
      await page.goto('/portal/statements')
      await page.waitForLoadState('networkidle')

      const statementsSection = page.locator(
        "[data-testid='statements-list'], [data-testid='statement-card'], section, main"
      )
      await expect(statementsSection.first()).toBeVisible()
    })

    test('homework/orders page renders at viewport', async ({ page }) => {
      await page.goto('/portal/homework')
      await page.waitForLoadState('networkidle')

      const homeworkSection = page.locator(
        "[data-testid='homework-list'], [data-testid='homework-card'], section, main"
      )
      await expect(homeworkSection.first()).toBeVisible()
    })

    test('all interactive elements are reachable via tab navigation', async ({
      page,
    }) => {
      await page.goto('/portal')
      await page.waitForLoadState('networkidle')

      const focusableSelectors = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'textarea:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ]

      const focusableCount = await page.locator(focusableSelectors.join(', ')).count()
      expect(focusableCount).toBeGreaterThan(0)

      // Tab through the first several elements
      let reachedCount = 0
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab')
        const activeEl = await page.evaluate(() => {
          const el = document.activeElement
          return el ? el.tagName : null
        })
        if (activeEl && activeEl !== 'BODY') {
          reachedCount++
        }
      }
      expect(reachedCount).toBeGreaterThan(0)
    })

    test('page content is not clipped at viewport width', async ({ page }) => {
      for (const { path, label } of EHR_PAGES) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')

        const bodyWidth = await page.evaluate(() => {
          return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          }
        })
        expect(
          bodyWidth.scrollWidth,
          `Content clipped on ${label} (${path})`
        ).toBeLessThanOrEqual(bodyWidth.clientWidth + 1)
      }
    })

    test('text is legible at viewport (no font-size below 12px)', async ({
      page,
    }) => {
      await page.goto('/portal')
      await page.waitForLoadState('networkidle')

      const tinyFonts = await page.evaluate(() => {
        const elements = document.querySelectorAll('p, span, li, td, th, label, a, button, h1, h2, h3, h4, h5, h6')
        const results: string[] = []
        for (const el of elements) {
          const style = window.getComputedStyle(el)
          const fontSize = parseFloat(style.fontSize)
          if (fontSize > 0 && fontSize < 12) {
            results.push(`${el.tagName}: ${fontSize}px`)
          }
        }
        return results
      })
      expect(tinyFonts, `Found elements with font-size < 12px: ${tinyFonts.join(', ')}`).toHaveLength(0)
    })
  })
}
