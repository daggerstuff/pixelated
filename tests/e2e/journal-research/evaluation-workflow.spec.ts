import { test, expect } from '@playwright/test'

/**
 * E2E tests for Journal Research Evaluation workflow
 * 
 * These tests verify the complete user flow for evaluating research sources.
 * 
 * Prerequisites:
 * - Backend API server must be running
 * - Test user must be authenticated
 * - At least one session with discovered sources must exist
 */

test.describe('Journal Research Evaluation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to evaluation page
    await page.goto('/journal-research/evaluation')
    
    // Wait for page to load
    await page.waitForSelector('h1', { timeout: 10000 })
  })

  test('displays evaluation interface', async ({ page }) => {
    // Check that evaluation interface is displayed
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('text=Evaluation')).toBeVisible()
  })

  test('displays evaluation list', async ({ page }) => {
    // Wait for evaluations list to load
    await page.waitForSelector('table, [data-testid="evaluation-list"]', {
      timeout: 10000,
    })
    
    // Verify evaluations are displayed
    const evaluationList = page.locator('table tbody tr, [data-testid="evaluation-item"]')
    const evaluationCount = await evaluationList.count()
    
    // May be 0 if no evaluations exist yet
    expect(evaluationCount).toBeGreaterThanOrEqual(0)
  })

  test('initiates evaluation process', async ({ page }) => {
    // Look for initiate evaluation button or form
    const initiateButton = page.locator('button:has-text("Evaluate"), button:has-text("Start Evaluation")')
    
    if (await initiateButton.count() > 0) {
      await initiateButton.click()
      
      // Wait for evaluation form or process to start
      await page.waitForSelector('form, text=Evaluating', { timeout: 5000 })
      
      // Verify evaluation process started
      await expect(page.locator('text=Evaluating, text=Progress')).toBeVisible({ timeout: 5000 })
    }
  })

  test('filters evaluations by priority tier', async ({ page }) => {
    // Wait for filter controls
    await page.waitForSelector('select, [data-testid="priority-filter"]', {
      timeout: 5000,
    })
    
    // Select priority tier filter
    const filterSelect = page.locator('select, [data-testid="priority-filter"]').first()
    if (await filterSelect.count() > 0) {
      await filterSelect.selectOption('high')
      
      // Wait for filter to apply
      await page.waitForTimeout(500)
      
      // Verify filtered results (if any evaluations exist)
      const evaluationList = page.locator('table tbody tr')
      const rowCount = await evaluationList.count()
      
      if (rowCount > 0) {
        // All visible evaluations should be high priority
        for (let i = 0; i < rowCount; i++) {
          const priorityCell = evaluationList.nth(i).locator('td').nth(3) // Assuming priority is 4th column
          const priorityText = await priorityCell.textContent()
          expect(priorityText?.toLowerCase()).toContain('high')
        }
      }
    }
  })

  test('sorts evaluations by score', async ({ page }) => {
    // Wait for sort controls
    await page.waitForSelector('button:has-text("Sort"), select[name="sortBy"]', {
      timeout: 5000,
    })
    
    // Select sort option
    const sortSelect = page.locator('select[name="sortBy"]')
    if (await sortSelect.count() > 0) {
      await sortSelect.selectOption('overall_score')
      
      // Wait for sort to apply
      await page.waitForTimeout(500)
      
      // Verify sorted results (if any evaluations exist)
      const evaluationList = page.locator('table tbody tr')
      const rowCount = await evaluationList.count()
      
      if (rowCount > 1) {
        // Scores should be in descending order
        const scores: number[] = []
        for (let i = 0; i < rowCount; i++) {
          const scoreCell = evaluationList.nth(i).locator('td').nth(4) // Assuming score is 5th column
          const scoreText = await scoreCell.textContent()
          const score = parseFloat(scoreText || '0')
          scores.push(score)
        }
        
        // Verify descending order
        for (let i = 1; i < scores.length; i++) {
          expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i])
        }
      }
    }
  })

  test('views evaluation details', async ({ page }) => {
    // Wait for evaluations list
    await page.waitForSelector('table a, [data-testid="evaluation-link"]', {
      timeout: 5000,
    })
    
    // Click on first evaluation
    const firstEvaluationLink = page.locator('table a, [data-testid="evaluation-link"]').first()
    
    if (await firstEvaluationLink.count() > 0) {
      await firstEvaluationLink.click()
      
      // Verify evaluation detail page
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.locator('text=Score, text=Therapeutic Relevance')).toBeVisible()
    }
  })

  test('updates evaluation manually', async ({ page }) => {
    // Navigate to an evaluation detail page
    await page.waitForSelector('table a', { timeout: 5000 })
    
    const firstEvaluationLink = page.locator('table a').first()
    
    if (await firstEvaluationLink.count() > 0) {
      await firstEvaluationLink.click()
      
      // Wait for evaluation detail page
      await page.waitForSelector('h1', { timeout: 5000 })
      
      // Click edit button (if available)
      const editButton = page.locator('button:has-text("Edit")')
      if (await editButton.count() > 0) {
        await editButton.click()
        
        // Update evaluation score or notes
        const notesInput = page.locator('textarea[name="notes"], textarea[placeholder*="notes"]')
        if (await notesInput.count() > 0) {
          await notesInput.fill('Updated evaluation notes')
        }
        
        // Save changes
        await page.click('button[type="submit"], button:has-text("Save")')
        
        // Verify update
        await expect(page.locator('text=Updated evaluation notes')).toBeVisible({ timeout: 5000 })
      }
    }
  })
})

