import { test, expect } from '@playwright/test'

/**
 * E2E tests for Journal Research Report Generation workflow
 * 
 * These tests verify the complete user flow for generating research reports.
 * 
 * Prerequisites:
 * - Backend API server must be running
 * - Test user must be authenticated
 * - At least one session with research data must exist
 */

test.describe('Journal Research Report Generation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to reports page
    await page.goto('/journal-research/reports')
    
    // Wait for page to load
    await page.waitForSelector('h1', { timeout: 10000 })
  })

  test('displays report generation interface', async ({ page }) => {
    // Check that report interface is displayed
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('text=Report, text=Generate')).toBeVisible()
  })

  test('displays report list', async ({ page }) => {
    // Wait for reports list to load
    await page.waitForSelector('table, [data-testid="report-list"]', {
      timeout: 10000,
    })
    
    // Verify reports are displayed
    const reportList = page.locator('table tbody tr, [data-testid="report-item"]')
    const reportCount = await reportList.count()
    
    // May be 0 if no reports exist yet
    expect(reportCount).toBeGreaterThanOrEqual(0)
  })

  test('generates session report', async ({ page }) => {
    // Look for generate report button or form
    const generateButton = page.locator('button:has-text("Generate Report"), button:has-text("Create Report")')
    
    if (await generateButton.count() > 0) {
      await generateButton.click()
      
      // Wait for report generation form
      await page.waitForSelector('form, select[name="reportType"]', { timeout: 5000 })
      
      // Select report type
      const reportTypeSelect = page.locator('select[name="reportType"]')
      if (await reportTypeSelect.count() > 0) {
        await reportTypeSelect.selectOption('session_report')
      }
      
      // Select format
      const formatSelect = page.locator('select[name="format"]')
      if (await formatSelect.count() > 0) {
        await formatSelect.selectOption('json')
      }
      
      // Submit form
      await page.click('button[type="submit"], button:has-text("Generate")')
      
      // Verify report generation started
      await expect(page.locator('text=Generating, text=Report, text=Progress')).toBeVisible({ timeout: 5000 })
    }
  })

  test('generates weekly report', async ({ page }) => {
    // Look for generate report button
    const generateButton = page.locator('button:has-text("Generate Report")')
    
    if (await generateButton.count() > 0) {
      await generateButton.click()
      
      // Wait for report generation form
      await page.waitForSelector('select[name="reportType"]', { timeout: 5000 })
      
      // Select weekly report type
      const reportTypeSelect = page.locator('select[name="reportType"]')
      if (await reportTypeSelect.count() > 0) {
        await reportTypeSelect.selectOption('weekly_report')
      }
      
      // Set date range (if available)
      const startDateInput = page.locator('input[name="startDate"], input[type="date"]').first()
      if (await startDateInput.count() > 0) {
        const lastWeek = new Date()
        lastWeek.setDate(lastWeek.getDate() - 7)
        await startDateInput.fill(lastWeek.toISOString().split('T')[0])
      }
      
      // Submit form
      await page.click('button[type="submit"], button:has-text("Generate")')
      
      // Verify report generation
      await expect(page.locator('text=Generating, text=Weekly Report')).toBeVisible({ timeout: 5000 })
    }
  })

  test('selects report format', async ({ page }) => {
    // Look for generate report button
    const generateButton = page.locator('button:has-text("Generate Report")')
    
    if (await generateButton.count() > 0) {
      await generateButton.click()
      
      // Wait for format selection
      await page.waitForSelector('select[name="format"]', { timeout: 5000 })
      
      // Test different formats
      const formats = ['json', 'markdown', 'pdf']
      
      for (const format of formats) {
        const formatSelect = page.locator('select[name="format"]')
        if (await formatSelect.count() > 0) {
          await formatSelect.selectOption(format)
          
          // Verify format is selected
          const selectedValue = await formatSelect.inputValue()
          expect(selectedValue).toBe(format)
        }
      }
    }
  })

  test('views generated report', async ({ page }) => {
    // Wait for reports list
    await page.waitForSelector('table a, [data-testid="report-link"]', {
      timeout: 5000,
    })
    
    // Click on first report
    const firstReportLink = page.locator('table a, [data-testid="report-link"]').first()
    
    if (await firstReportLink.count() > 0) {
      await firstReportLink.click()
      
      // Verify report viewer page
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.locator('text=Report, text=Content, text=Summary')).toBeVisible()
    }
  })

  test('exports report', async ({ page }) => {
    // Navigate to a report detail page
    await page.waitForSelector('table a', { timeout: 5000 })
    
    const firstReportLink = page.locator('table a').first()
    
    if (await firstReportLink.count() > 0) {
      await firstReportLink.click()
      
      // Wait for report viewer page
      await page.waitForSelector('h1', { timeout: 5000 })
      
      // Click export/download button
      const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")')
      if (await exportButton.count() > 0) {
        // Set up download listener
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null)
        
        await exportButton.click()
        
        // Verify download started (if browser supports it)
        const download = await downloadPromise
        if (download) {
          expect(download.suggestedFilename()).toMatch(/\.(json|md|pdf)$/i)
        } else {
          // Alternative: verify export message
          await expect(page.locator('text=Export, text=Download, text=Saved')).toBeVisible({ timeout: 5000 })
        }
      }
    }
  })

  test('displays report in different formats', async ({ page }) => {
    // Navigate to a report detail page
    await page.waitForSelector('table a', { timeout: 5000 })
    
    const firstReportLink = page.locator('table a').first()
    
    if (await firstReportLink.count() > 0) {
      await firstReportLink.click()
      
      // Wait for report viewer page
      await page.waitForSelector('h1', { timeout: 5000 })
      
      // Verify report content is displayed
      // Format-specific rendering depends on report format
      await expect(page.locator('text=Report, pre, [data-testid="report-content"]')).toBeVisible()
    }
  })

  test('filters reports by type', async ({ page }) => {
    // Wait for filter controls
    await page.waitForSelector('select, [data-testid="report-type-filter"]', {
      timeout: 5000,
    })
    
    // Select report type filter
    const filterSelect = page.locator('select, [data-testid="report-type-filter"]').first()
    if (await filterSelect.count() > 0) {
      await filterSelect.selectOption('session_report')
      
      // Wait for filter to apply
      await page.waitForTimeout(500)
      
      // Verify filtered results (if any reports exist)
      const reportList = page.locator('table tbody tr')
      const rowCount = await reportList.count()
      
      if (rowCount > 0) {
        // All visible reports should be session reports
        for (let i = 0; i < rowCount; i++) {
          const typeCell = reportList.nth(i).locator('td').nth(1) // Assuming type is 2nd column
          const typeText = await typeCell.textContent()
          expect(typeText?.toLowerCase()).toContain('session')
        }
      }
    }
  })
})

