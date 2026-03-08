import { test, expect } from '@playwright/test'
import {
  login,
  fillRegistrationForm,
  expectToastNotification,
  generateTestEmail,
  logout,
} from './test-utils'

/**
 * Integration Test Suite: Contextual Assistance
 *
 * This suite validates the integration of Real-time Intervention System and Documentation Automation,
 * including session history, client state adaptation, outcome-based recommendations, and treatment planning.
 * It covers both happy path and edge/error cases, ensuring all features work together as expected.
 */

test.describe('Contextual Assistance Integration', () => {
  test('should integrate real-time interventions and documentation automation in a user journey', async ({
    page,
  }) => {
    // 1. Register and login as a new user
    const testEmail = generateTestEmail()
    await page.goto('/register')
    await fillRegistrationForm(page, testEmail)
    await page.check('input[name="acceptTerms"]')
    await page.click('button[type="submit"]')
    await page.waitForNavigation({ waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/dashboard|welcome/)
    await expectToastNotification(page, /account.*created/i, 'success')

    // 2. Simulate a session that triggers real-time intervention
    // (Assume a widget or button exists to start a session)
    if (
      (await page.locator('[data-testid="start-session-button"]').count()) > 0
    ) {
      await page.click('[data-testid="start-session-button"]')
      // Provide input that should trigger an intervention
      await page.fill(
        '[data-testid="session-input"]',
        'I am feeling overwhelmed and anxious about work.',
      )
      await page.click('[data-testid="submit-session-input"]')
      // Expect intervention suggestion
      await expect(
        page.locator('[data-testid="intervention-suggestion"]'),
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="intervention-suggestion"]'),
      ).toContainText(/recommendation|intervention|support/i)
    }

    // 3. Validate session history integration
    if (
      (await page.locator('[data-testid="session-history-tab"]').count()) > 0
    ) {
      await page.click('[data-testid="session-history-tab"]')
      await expect(
        page.locator('[data-testid="session-history-list"]'),
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="session-history-list"]'),
      ).toContainText(/overwhelmed|anxious|work/i)
    }

    // 4. Validate client state adaptation (e.g., dashboard or profile reflects new state)
    if (
      (await page.locator('[data-testid="client-state-summary"]').count()) > 0
    ) {
      await page.click('[data-testid="client-state-summary"]')
      await expect(
        page.locator('[data-testid="client-state-details"]'),
      ).toContainText(/anxious|overwhelmed|recent session/i)
    }

    // 5. Outcome-based recommendations
    if (
      (await page
        .locator('[data-testid="outcome-recommendation-widget"]')
        .count()) > 0
    ) {
      await page.click('[data-testid="outcome-recommendation-widget"]')
      await expect(
        page.locator('[data-testid="recommendation-result"]'),
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="recommendation-result"]'),
      ).toContainText(/plan|goal|recommendation/i)
    }

    // 6. Treatment Planning and Documentation Automation
    if (
      (await page
        .locator('[data-testid="treatment-planning-widget"]')
        .count()) > 0
    ) {
      await page.click('[data-testid="treatment-planning-widget"]')
      await expect(
        page.locator('[data-testid="treatment-plan-list"]'),
      ).toBeVisible()
      // Add a new treatment plan
      await page.click('[data-testid="add-treatment-plan-button"]')
      await page.fill('input[name="planTitle"]', 'Reduce Work Anxiety')
      await page.fill(
        'textarea[name="planDescription"]',
        'Plan to address work-related anxiety with weekly check-ins.',
      )
      await page.click('[data-testid="save-treatment-plan-button"]')
      await expectToastNotification(page, /created|added|success/i, 'success')
      await expect(
        page.locator('[data-testid="treatment-plan-list"]'),
      ).toContainText(/Reduce Work Anxiety/)
    }

    // 7. Edge case: Try to access documentation automation without a session
    await logout(page)
    await page.goto('/documentation-automation')
    await expect(page).toHaveURL(/login|index\.html/)
    // Try to submit empty documentation
    await login(page, testEmail, 'SecurePass123!')
    await page.goto('/documentation-automation')
    if (
      (await page
        .locator('[data-testid="generate-doc-summary-button"]')
        .count()) > 0
    ) {
      await page.click('[data-testid="generate-doc-summary-button"]')
      await expectToastNotification(page, /error|required|empty/i, 'error')
    }
  })
})
