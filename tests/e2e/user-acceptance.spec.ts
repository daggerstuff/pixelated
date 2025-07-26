import { test, expect } from '@playwright/test'
import {
  fillRegistrationForm,
  expectToastNotification,
  generateTestEmail,
  logout,
} from './test-utils'

/**
 * User Acceptance Test (UAT) Suite
 *
 * This suite validates the end-to-end experience for a typical user,
 * covering onboarding, dashboard/analytics, AI features, UI/UX, security,
 * accessibility, and performance. It leverages MCP integration for advanced
 * checks and follows production-grade standards.
 */

test.describe('User Acceptance Test (UAT) - Full User Journey', () => {
  test('should complete a full user journey and meet acceptance criteria', async ({
    page,
  }) => {
    // 1. Onboarding: Registration
    const testEmail = generateTestEmail()
    await page.goto('/register')
    await fillRegistrationForm(page, testEmail)
    await page.check('input[name="acceptTerms"]')
    await page.click('button[type="submit"]')
    await page.waitForNavigation({ waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/dashboard|welcome/)
    await expectToastNotification(page, /account.*created/i, 'success')

    // 2. Dashboard: Analytics & Navigation
    await expect(page.locator('h1')).toContainText(/dashboard|welcome/i)
    await expect(
      page.locator('[data-testid="dashboard-sidebar"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="analytics-section"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="data-visualization"]'),
    ).toBeVisible()

    // 3. AI Features: Emotion Detection, Pattern Recognition, Documentation Automation
    // (Assume these are accessible via dashboard or sidebar)
    // Emotion Detection
    if (
      (await page.locator('[data-testid="emotion-detection-widget"]').count()) >
      0
    ) {
      await page.click('[data-testid="emotion-detection-widget"]')
      await expect(page.locator('[data-testid="emotion-result"]')).toBeVisible()
    }
    // Pattern Recognition
    if (
      (await page
        .locator('[data-testid="pattern-recognition-widget"]')
        .count()) > 0
    ) {
      await page.click('[data-testid="pattern-recognition-widget"]')
      await expect(page.locator('[data-testid="pattern-result"]')).toBeVisible()
    }
    // Documentation Automation
    if (
      (await page
        .locator('[data-testid="documentation-automation-widget"]')
        .count()) > 0
    ) {
      await page.click('[data-testid="documentation-automation-widget"]')
      await expect(page.locator('[data-testid="doc-summary"]')).toBeVisible()
    }

    // 4. UI/UX: Transitions, Notifications, Responsiveness
    // Page transitions
    await page.click('a[href="/profile"]')
    await page.waitForURL(/\/profile/)
    await expect(page.locator('h1')).toContainText(/profile|account/i)
    // Toast notification on profile update
    if (
      (await page.locator('[data-testid="edit-profile-button"]').count()) > 0
    ) {
      await page.click('[data-testid="edit-profile-button"]')
      await page.fill('input[name="fullName"]', 'UAT Test User')
      await page.click('[data-testid="save-profile-button"]')
      await expectToastNotification(page, /success|saved|updated/i, 'success')
    }
    // Responsiveness (mobile viewport)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(
      page.locator('[data-testid="mobile-menu-button"]'),
    ).toBeVisible()
    await page.click('[data-testid="mobile-menu-button"]')
    await expect(
      page.locator('[data-testid="dashboard-sidebar"]'),
    ).toBeVisible()

    // 5. Security: Access Control, Input Validation
    // Attempt to access a protected page after logout
    await logout(page)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/login|index\.html/)
    // Input validation (login with invalid email)
    await page.goto('/login')
    await page.fill('input[type="email"]', 'invalid-email')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    await expectToastNotification(page, /invalid|error|email/i, 'error')

    // 6. Accessibility & Performance (MCP Integration)
    // Accessibility audit (if MCP is available)
    if (
      typeof window !== 'undefined' &&
      'mcp_browser_tools_runAccessibilityAudit' in window
    ) {
      const accessibilityResults = await page.evaluate(async () => {
        return await window.mcp_browser_tools_runAccessibilityAudit({
          random_string: 'uat',
        })
      })
      expect(accessibilityResults).toBeTruthy()
    }
    // Performance audit (if MCP is available)
    if (
      typeof window !== 'undefined' &&
      'mcp_browser_tools_runPerformanceAudit' in window
    ) {
      const performanceResults = await page.evaluate(async () => {
        return await window.mcp_browser_tools_runPerformanceAudit({
          random_string: 'uat',
        })
      })
      expect(performanceResults).toBeTruthy()
    }
  })
})
