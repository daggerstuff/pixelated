import { expect, test } from '@playwright/test'

import { TestData } from '../data/TestData'

test.describe('Evidence Assistant admin page', () => {
  test('page is accessible and includes the admin UI shell', async ({ page }) => {
    await page.goto('/admin/ai/evidence-assistant', {
      waitUntil: 'load',
      timeout: 30_000,
    })

    if (page.url().includes('/auth/sign-in')) {
      test.skip(
        'Admin authentication is required for this route in the current environment.',
      )
    }

    await expect(
      page.getByRole('heading', { name: 'AI Evidence Assistant' }),
    ).toBeVisible()
    await expect(
      page.getByText('Internal evidence-backed assistant for product'),
    ).toBeVisible()
  })

  test('search form renders response data with mocked API response', async ({ page }) => {
    await page.route('**/api/ai/evidence-assistant', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            query: 'How to escalate crisis risk?',
            answer:
              'Use the private escalation policy and handoff flow documented in internal operations docs.',
            providerUsed: 'local',
            results: [
              {
                id: 'docs/crisis-playbook',
                title: 'Crisis Playbook',
                content: 'Escalation policy for high risk cases.',
                url: '/docs/crisis-playbook',
                collection: 'docs',
                score: 24,
                excerpt: '...escalation policy for high risk cases...',
                matchedTerms: ['escalation'],
                tags: ['safety'],
                category: 'operations',
              },
            ],
            citations: [
              {
                index: 1,
                title: 'Crisis Playbook',
                url: '/docs/crisis-playbook',
                collection: 'docs',
              },
            ],
            warnings: [],
          }),
        })
        return
      }

      await route.continue()
    })

    await page.goto('/admin/ai/evidence-assistant', {
      waitUntil: 'load',
      timeout: 30_000,
    })

    if (page.url().includes('/auth/sign-in')) {
      test.skip(
        'Admin authentication is required for this route in the current environment.',
      )
    }

    const queryInput = page.getByPlaceholderText(
      'Example: Which internal docs define crisis sensitivity requirements and memory ordering?',
    )
    await expect(queryInput).toBeVisible()
    await queryInput.fill('How to escalate crisis risk?')

    const collectionSelect = page.getByRole('combobox')
    await collectionSelect.selectOption('docs')

    const submitButton = page.getByRole('button', { name: 'Run evidence search' })
    await expect(submitButton).toBeVisible()
    await submitButton.click()

    await expect(page.getByText('Grounded answer')).toBeVisible()
    await expect(
      page.getByText(
        'Use the private escalation policy and handoff flow documented in internal operations docs.',
      ),
    ).toBeVisible()
    await expect(page.getByText('[1] Crisis Playbook')).toBeVisible()
  })

  test('admin flow can be smoke-tested with configured test admin credentials', async ({ page }) => {
    const { email, password } = TestData.users.adminUser
    await page.goto('/auth/sign-in')

    if ((await page.locator('input[type="email"]').count()) === 0) {
      test.skip('No sign-in form present for admin smoke authentication.')
    }

    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')

    await page.waitForLoadState('networkidle')

    await page.goto('/admin/ai/evidence-assistant', {
      waitUntil: 'load',
      timeout: 30_000,
    })

    if (page.url().includes('/auth/sign-in')) {
      test.skip('Could not authenticate as admin in this environment.')
    }

    await expect(
      page.getByRole('heading', { name: 'AI Evidence Assistant' }),
    ).toBeVisible()
  })
})
