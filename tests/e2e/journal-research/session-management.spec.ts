import { test, expect } from '@playwright/test'

/**
 * E2E tests for Journal Research Session Management workflow
 * 
 * These tests verify the complete user flow for managing research sessions.
 * 
 * Prerequisites:
 * - Backend API server must be running
 * - Test user must be authenticated
 * 
 * To run these tests:
 * 1. Start the development server: pnpm dev
 * 2. Start the backend API server
 * 3. Run: pnpm e2e tests/e2e/journal-research/session-management.spec.ts
 */

test.describe('Journal Research Session Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to journal research dashboard
    await page.goto('/journal-research')
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Journal Research Dashboard")', {
      timeout: 10000,
    })
  })

  test('displays dashboard with session list', async ({ page }) => {
    // Check that dashboard is displayed
    await expect(page.locator('h1:has-text("Journal Research Dashboard")')).toBeVisible()
    
    // Check that session list is displayed
    await expect(page.locator('text=Recent Sessions')).toBeVisible()
    await expect(page.locator('text=All Sessions')).toBeVisible()
  })

  test('creates a new session', async ({ page }) => {
    // Click "New Session" button
    await page.click('button:has-text("New Session")')
    
    // Wait for session form to appear
    await page.waitForSelector('form', { timeout: 5000 })
    
    // Fill in session form
    await page.fill('input[name="targetSources"]', 'PubMed, arXiv')
    await page.fill('textarea[name="searchKeywords"]', 'depression, anxiety')
    await page.fill('input[name="weeklyTargets.sources"]', '10')
    await page.fill('input[name="weeklyTargets.datasets"]', '5')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Wait for session to be created and redirect
    await page.waitForURL(/\/journal-research\/sessions\/.*/, { timeout: 10000 })
    
    // Verify session detail page is displayed
    await expect(page.locator('h1')).toContainText('Session')
  })

  test('views session details', async ({ page }) => {
    // Navigate to sessions list
    await page.goto('/journal-research/sessions')
    
    // Wait for sessions list to load
    await page.waitForSelector('table', { timeout: 5000 })
    
    // Click on first session (if available)
    const firstSessionLink = page.locator('table a').first()
    
    if (await firstSessionLink.count() > 0) {
      await firstSessionLink.click()
      
      // Verify session detail page
      await expect(page.locator('h1')).toContainText('Session')
      await expect(page.locator('text=Progress')).toBeVisible()
    }
  })

  test('filters sessions by phase', async ({ page }) => {
    // Navigate to sessions list
    await page.goto('/journal-research/sessions')
    
    // Wait for sessions list to load
    await page.waitForSelector('select', { timeout: 5000 })
    
    // Select phase filter
    await page.selectOption('select', 'discovery')
    
    // Wait for filter to apply
    await page.waitForTimeout(500)
    
    // Verify filtered results (implementation dependent)
    const tableRows = page.locator('table tbody tr')
    const rowCount = await tableRows.count()
    
    // All visible rows should be in discovery phase
    for (let i = 0; i < rowCount; i++) {
      const phaseCell = tableRows.nth(i).locator('td').nth(2) // Assuming phase is 3rd column
      const phaseText = await phaseCell.textContent()
      expect(phaseText?.toLowerCase()).toContain('discovery')
    }
  })

  test('searches sessions', async ({ page }) => {
    // Navigate to sessions list
    await page.goto('/journal-research/sessions')
    
    // Wait for search input
    await page.waitForSelector('input[placeholder*="Search"]', { timeout: 5000 })
    
    // Enter search term
    await page.fill('input[placeholder*="Search"]', 'test')
    
    // Wait for search to apply
    await page.waitForTimeout(500)
    
    // Verify search results (implementation dependent)
    const tableRows = page.locator('table tbody tr')
    const rowCount = await tableRows.count()
    
    // All visible rows should match search term
    for (let i = 0; i < rowCount; i++) {
      const sessionIdCell = tableRows.nth(i).locator('td').first()
      const sessionId = await sessionIdCell.textContent()
      expect(sessionId?.toLowerCase()).toContain('test')
    }
  })

  test('updates session', async ({ page }) => {
    // Navigate to a session detail page
    await page.goto('/journal-research/sessions')
    
    // Wait for sessions list
    await page.waitForSelector('table', { timeout: 5000 })
    
    // Click on first session
    const firstSessionLink = page.locator('table a').first()
    
    if (await firstSessionLink.count() > 0) {
      await firstSessionLink.click()
      
      // Wait for session detail page
      await page.waitForSelector('h1', { timeout: 5000 })
      
      // Click edit button (if available)
      const editButton = page.locator('button:has-text("Edit")')
      if (await editButton.count() > 0) {
        await editButton.click()
        
        // Update session
        await page.fill('input[name="currentPhase"]', 'evaluation')
        
        // Save changes
        await page.click('button[type="submit"]')
        
        // Verify update
        await expect(page.locator('text=evaluation')).toBeVisible()
      }
    }
  })

  test('deletes session', async ({ page }) => {
    // Navigate to a session detail page
    await page.goto('/journal-research/sessions')
    
    // Wait for sessions list
    await page.waitForSelector('table', { timeout: 5000 })
    
    // Click on first session
    const firstSessionLink = page.locator('table a').first()
    
    if (await firstSessionLink.count() > 0) {
      await firstSessionLink.click()
      
      // Wait for session detail page
      await page.waitForSelector('h1', { timeout: 5000 })
      
      // Click delete button (if available)
      const deleteButton = page.locator('button:has-text("Delete")')
      if (await deleteButton.count() > 0) {
        // Confirm deletion
        page.on('dialog', (dialog) => dialog.accept())
        await deleteButton.click()
        
        // Verify redirect to sessions list
        await page.waitForURL(/\/journal-research\/sessions/, { timeout: 5000 })
        await expect(page.locator('h1')).toContainText('Sessions')
      }
    }
  })
})

