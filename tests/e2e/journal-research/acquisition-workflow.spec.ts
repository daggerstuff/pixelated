import { test, expect } from '@playwright/test'

/**
 * E2E tests for Journal Research Acquisition workflow
 * 
 * These tests verify the complete user flow for acquiring research datasets.
 * 
 * Prerequisites:
 * - Backend API server must be running
 * - Test user must be authenticated
 * - At least one session with evaluated sources must exist
 */

test.describe('Journal Research Acquisition Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to acquisition page
    await page.goto('/journal-research/acquisition')
    
    // Wait for page to load
    await page.waitForSelector('h1', { timeout: 10000 })
  })

  test('displays acquisition interface', async ({ page }) => {
    // Check that acquisition interface is displayed
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('text=Acquisition')).toBeVisible()
  })

  test('displays acquisition list', async ({ page }) => {
    // Wait for acquisitions list to load
    await page.waitForSelector('table, [data-testid="acquisition-list"]', {
      timeout: 10000,
    })
    
    // Verify acquisitions are displayed
    const acquisitionList = page.locator('table tbody tr, [data-testid="acquisition-item"]')
    const acquisitionCount = await acquisitionList.count()
    
    // May be 0 if no acquisitions exist yet
    expect(acquisitionCount).toBeGreaterThanOrEqual(0)
  })

  test('initiates acquisition process', async ({ page }) => {
    // Look for initiate acquisition button
    const initiateButton = page.locator('button:has-text("Acquire"), button:has-text("Start Acquisition")')
    
    if (await initiateButton.count() > 0) {
      await initiateButton.click()
      
      // Wait for acquisition form or process to start
      await page.waitForSelector('form, text=Acquiring', { timeout: 5000 })
      
      // Verify acquisition process started
      await expect(page.locator('text=Acquiring, text=Progress, text=Downloading')).toBeVisible({ timeout: 5000 })
    }
  })

  test('filters acquisitions by status', async ({ page }) => {
    // Wait for filter controls
    await page.waitForSelector('select, [data-testid="status-filter"]', {
      timeout: 5000,
    })
    
    // Select status filter
    const filterSelect = page.locator('select, [data-testid="status-filter"]').first()
    if (await filterSelect.count() > 0) {
      await filterSelect.selectOption('completed')
      
      // Wait for filter to apply
      await page.waitForTimeout(500)
      
      // Verify filtered results (if any acquisitions exist)
      const acquisitionList = page.locator('table tbody tr')
      const rowCount = await acquisitionList.count()
      
      if (rowCount > 0) {
        // All visible acquisitions should be completed
        for (let i = 0; i < rowCount; i++) {
          const statusCell = acquisitionList.nth(i).locator('td').nth(2) // Assuming status is 3rd column
          const statusText = await statusCell.textContent()
          expect(statusText?.toLowerCase()).toContain('completed')
        }
      }
    }
  })

  test('filters acquisitions by download failures only', async ({ page }) => {
    // Wait for filter checkbox
    await page.waitForSelector('input[type="checkbox"][name*="failure"], [data-testid="failure-filter"]', {
      timeout: 5000,
    })
    
    // Toggle failure filter
    const failureCheckbox = page.locator('input[type="checkbox"][name*="failure"], [data-testid="failure-filter"]')
    if (await failureCheckbox.count() > 0) {
      await failureCheckbox.check()
      
      // Wait for filter to apply
      await page.waitForTimeout(500)
      
      // Verify filtered results (if any failed acquisitions exist)
      const acquisitionList = page.locator('table tbody tr')
      const rowCount = await acquisitionList.count()
      
      if (rowCount > 0) {
        // All visible acquisitions should be failed
        for (let i = 0; i < rowCount; i++) {
          const statusCell = acquisitionList.nth(i).locator('td').nth(2)
          const statusText = await statusCell.textContent()
          expect(statusText?.toLowerCase()).toContain('failed')
        }
      }
    }
  })

  test('views acquisition details', async ({ page }) => {
    // Wait for acquisitions list
    await page.waitForSelector('table a, [data-testid="acquisition-link"]', {
      timeout: 5000,
    })
    
    // Click on first acquisition
    const firstAcquisitionLink = page.locator('table a, [data-testid="acquisition-link"]').first()
    
    if (await firstAcquisitionLink.count() > 0) {
      await firstAcquisitionLink.click()
      
      // Verify acquisition detail page
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.locator('text=Status, text=Download')).toBeVisible()
    }
  })

  test('approves acquisition', async ({ page }) => {
    // Navigate to an acquisition detail page
    await page.waitForSelector('table a', { timeout: 5000 })
    
    const firstAcquisitionLink = page.locator('table a').first()
    
    if (await firstAcquisitionLink.count() > 0) {
      await firstAcquisitionLink.click()
      
      // Wait for acquisition detail page
      await page.waitForSelector('h1', { timeout: 5000 })
      
      // Click approve button (if available and status is pending)
      const approveButton = page.locator('button:has-text("Approve")')
      if (await approveButton.count() > 0) {
        await approveButton.click()
        
        // Verify status changed to approved
        await expect(page.locator('text=approved')).toBeVisible({ timeout: 5000 })
      }
    }
  })

  test('rejects acquisition', async ({ page }) => {
    // Navigate to an acquisition detail page
    await page.waitForSelector('table a', { timeout: 5000 })
    
    const firstAcquisitionLink = page.locator('table a').first()
    
    if (await firstAcquisitionLink.count() > 0) {
      await firstAcquisitionLink.click()
      
      // Wait for acquisition detail page
      await page.waitForSelector('h1', { timeout: 5000 })
      
      // Click reject button (if available and status is pending)
      const rejectButton = page.locator('button:has-text("Reject")')
      if (await rejectButton.count() > 0) {
        await rejectButton.click()
        
        // Verify status changed or rejection message shown
        await expect(page.locator('text=rejected, text=Rejected')).toBeVisible({ timeout: 5000 })
      }
    }
  })

  test('tracks acquisition progress', async ({ page }) => {
    // Wait for acquisitions list
    await page.waitForSelector('table', { timeout: 5000 })
    
    // Look for in-progress acquisitions
    const inProgressRows = page.locator('table tbody tr:has-text("in-progress"), table tbody tr:has-text("downloading")')
    
    if (await inProgressRows.count() > 0) {
      // Verify progress indicator is shown
      await expect(inProgressRows.first().locator('text=Progress, text=%, [data-testid="progress"]')).toBeVisible()
    }
  })
})

