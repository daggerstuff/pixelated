import { test, expect } from '@playwright/test'

/**
 * E2E tests for Journal Research Discovery workflow
 * 
 * These tests verify the complete user flow for discovering research sources.
 */

test.describe('Journal Research Discovery Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to discovery page
    await page.goto('/journal-research/discovery')
    
    // Wait for page to load
    await page.waitForSelector('h1', { timeout: 10000 })
  })

  test('displays discovery interface', async ({ page }) => {
    // Check that discovery interface is displayed
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('text=Discovery')).toBeVisible()
  })

  test('initiates discovery process', async ({ page }) => {
    // Fill in discovery form
    await page.fill('input[name="keywords"]', 'depression, anxiety')
    await page.selectOption('select[name="sourceType"]', 'journal_article')
    
    // Click start discovery button
    await page.click('button:has-text("Start Discovery")')
    
    // Wait for discovery to start
    await page.waitForSelector('text=Discovering', { timeout: 5000 })
    
    // Verify progress indicator is shown
    await expect(page.locator('text=Progress')).toBeVisible()
  })

  test('displays discovered sources', async ({ page }) => {
    // Wait for sources list to load
    await page.waitForSelector('table, [data-testid="source-list"]', {
      timeout: 10000,
    })
    
    // Verify sources are displayed
    const sourceList = page.locator('table tbody tr, [data-testid="source-item"]')
    const sourceCount = await sourceList.count()
    
    expect(sourceCount).toBeGreaterThan(0)
  })

  test('filters sources by type', async ({ page }) => {
    // Wait for sources list
    await page.waitForSelector('select', { timeout: 5000 })
    
    // Select source type filter
    await page.selectOption('select[name="sourceType"]', 'journal_article')
    
    // Wait for filter to apply
    await page.waitForTimeout(500)
    
    // Verify filtered results
    const sourceList = page.locator('table tbody tr')
    const rowCount = await sourceList.count()
    
    // All visible sources should be journal articles
    for (let i = 0; i < rowCount; i++) {
      const typeCell = sourceList.nth(i).locator('td').nth(2) // Assuming type is 3rd column
      const typeText = await typeCell.textContent()
      expect(typeText?.toLowerCase()).toContain('journal')
    }
  })

  test('views source details', async ({ page }) => {
    // Wait for sources list
    await page.waitForSelector('table a, [data-testid="source-link"]', {
      timeout: 5000,
    })
    
    // Click on first source
    const firstSourceLink = page.locator('table a, [data-testid="source-link"]').first()
    
    if (await firstSourceLink.count() > 0) {
      await firstSourceLink.click()
      
      // Verify source detail page
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.locator('text=Abstract')).toBeVisible()
      await expect(page.locator('text=Authors')).toBeVisible()
    }
  })

  test('searches sources', async ({ page }) => {
    // Wait for search input
    await page.waitForSelector('input[placeholder*="Search"]', { timeout: 5000 })
    
    // Enter search term
    await page.fill('input[placeholder*="Search"]', 'depression')
    
    // Wait for search to apply
    await page.waitForTimeout(500)
    
    // Verify search results
    const sourceList = page.locator('table tbody tr')
    const rowCount = await sourceList.count()
    
    // All visible sources should match search term
    for (let i = 0; i < rowCount; i++) {
      const titleCell = sourceList.nth(i).locator('td').first()
      const title = await titleCell.textContent()
      expect(title?.toLowerCase()).toContain('depression')
    }
  })
})

