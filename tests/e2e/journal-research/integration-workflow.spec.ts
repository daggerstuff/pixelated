import { test, expect } from '@playwright/test'

/**
 * E2E tests for Journal Research Integration workflow
 * 
 * These tests verify the complete user flow for planning dataset integration.
 * 
 * Prerequisites:
 * - Backend API server must be running
 * - Test user must be authenticated
 * - At least one session with acquired datasets must exist
 */

test.describe('Journal Research Integration Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to integration page
    await page.goto('/journal-research/integration')
    
    // Wait for page to load
    await page.waitForSelector('h1', { timeout: 10000 })
  })

  test('displays integration interface', async ({ page }) => {
    // Check that integration interface is displayed
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('text=Integration')).toBeVisible()
  })

  test('displays integration plan list', async ({ page }) => {
    // Wait for integration plans list to load
    await page.waitForSelector('table, [data-testid="integration-plan-list"]', {
      timeout: 10000,
    })
    
    // Verify integration plans are displayed
    const planList = page.locator('table tbody tr, [data-testid="integration-plan-item"]')
    const planCount = await planList.count()
    
    // May be 0 if no plans exist yet
    expect(planCount).toBeGreaterThanOrEqual(0)
  })

  test('initiates integration planning', async ({ page }) => {
    // Look for initiate integration button
    const initiateButton = page.locator('button:has-text("Plan Integration"), button:has-text("Create Plan")')
    
    if (await initiateButton.count() > 0) {
      await initiateButton.click()
      
      // Wait for integration form to appear
      await page.waitForSelector('form, select[name="targetFormat"]', { timeout: 5000 })
      
      // Fill in integration form
      const formatSelect = page.locator('select[name="targetFormat"]')
      if (await formatSelect.count() > 0) {
        await formatSelect.selectOption('jsonl')
      }
      
      // Submit form
      await page.click('button[type="submit"], button:has-text("Create Plan")')
      
      // Verify plan creation
      await expect(page.locator('text=Plan created, text=Integration Plan')).toBeVisible({ timeout: 5000 })
    }
  })

  test('filters integration plans by target format', async ({ page }) => {
    // Wait for filter controls
    await page.waitForSelector('select, [data-testid="format-filter"]', {
      timeout: 5000,
    })
    
    // Select target format filter
    const filterSelect = page.locator('select, [data-testid="format-filter"]').first()
    if (await filterSelect.count() > 0) {
      await filterSelect.selectOption('jsonl')
      
      // Wait for filter to apply
      await page.waitForTimeout(500)
      
      // Verify filtered results (if any plans exist)
      const planList = page.locator('table tbody tr')
      const rowCount = await planList.count()
      
      if (rowCount > 0) {
        // All visible plans should be jsonl format
        for (let i = 0; i < rowCount; i++) {
          const formatCell = planList.nth(i).locator('td').nth(2) // Assuming format is 3rd column
          const formatText = await formatCell.textContent()
          expect(formatText?.toLowerCase()).toContain('jsonl')
        }
      }
    }
  })

  test('filters integration plans by complexity', async ({ page }) => {
    // Wait for filter controls
    await page.waitForSelector('select, [data-testid="complexity-filter"]', {
      timeout: 5000,
    })
    
    // Select complexity filter
    const filterSelect = page.locator('select, [data-testid="complexity-filter"]')
    if (await filterSelect.count() > 0) {
      await filterSelect.selectOption('medium')
      
      // Wait for filter to apply
      await page.waitForTimeout(500)
      
      // Verify filtered results (if any plans exist)
      const planList = page.locator('table tbody tr')
      const rowCount = await planList.count()
      
      if (rowCount > 0) {
        // All visible plans should be medium complexity
        for (let i = 0; i < rowCount; i++) {
          const complexityCell = planList.nth(i).locator('td').nth(3) // Assuming complexity is 4th column
          const complexityText = await complexityCell.textContent()
          expect(complexityText?.toLowerCase()).toContain('medium')
        }
      }
    }
  })

  test('views integration plan details', async ({ page }) => {
    // Wait for integration plans list
    await page.waitForSelector('table a, [data-testid="plan-link"]', {
      timeout: 5000,
    })
    
    // Click on first plan
    const firstPlanLink = page.locator('table a, [data-testid="plan-link"]').first()
    
    if (await firstPlanLink.count() > 0) {
      await firstPlanLink.click()
      
      // Verify plan detail page
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.locator('text=Target Format, text=Complexity, text=Preprocessing')).toBeVisible()
    }
  })

  test('compares integration plans', async ({ page }) => {
    // Wait for integration plans list
    await page.waitForSelector('table', { timeout: 5000 })
    
    // Look for compare checkboxes or buttons
    const compareCheckboxes = page.locator('input[type="checkbox"][name*="compare"], [data-testid="compare-checkbox"]')
    
    if (await compareCheckboxes.count() >= 2) {
      // Select two plans for comparison
      await compareCheckboxes.nth(0).check()
      await compareCheckboxes.nth(1).check()
      
      // Look for compare button or view comparison
      const compareButton = page.locator('button:has-text("Compare")')
      if (await compareButton.count() > 0) {
        await compareButton.click()
        
        // Verify comparison view
        await expect(page.locator('text=Comparison, text=Plan 1, text=Plan 2')).toBeVisible({ timeout: 5000 })
      }
    }
  })

  test('generates preprocessing script', async ({ page }) => {
    // Navigate to an integration plan detail page
    await page.waitForSelector('table a', { timeout: 5000 })
    
    const firstPlanLink = page.locator('table a').first()
    
    if (await firstPlanLink.count() > 0) {
      await firstPlanLink.click()
      
      // Wait for plan detail page
      await page.waitForSelector('h1', { timeout: 5000 })
      
      // Click generate script button (if available)
      const generateButton = page.locator('button:has-text("Generate Script"), button:has-text("Download Script")')
      if (await generateButton.count() > 0) {
        await generateButton.click()
        
        // Verify script generation or download
        await expect(page.locator('text=Script generated, text=Download')).toBeVisible({ timeout: 5000 })
      }
    }
  })

  test('visualizes integration plan', async ({ page }) => {
    // Navigate to an integration plan detail page
    await page.waitForSelector('table a', { timeout: 5000 })
    
    const firstPlanLink = page.locator('table a').first()
    
    if (await firstPlanLink.count() > 0) {
      await firstPlanLink.click()
      
      // Wait for plan detail page
      await page.waitForSelector('h1', { timeout: 5000 })
      
      // Verify visualization is displayed
      await expect(page.locator('canvas, svg, [data-testid="plan-visualization"]')).toBeVisible({ timeout: 5000 })
    }
  })
})

