import { test, expect } from '@playwright/test';
import { AccessibilityUtils } from '../utils/AccessibilityUtils';

test.describe('Accessibility Compliance', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should pass axe accessibility scan', async ({ page }) => {
    const results = await AccessibilityUtils.runAxeAnalysis(page);
    
    // Log violations for debugging
    if (results.violations.length > 0) {
      console.log('Accessibility violations found:', results.violations);
    }
    
    expect(results.violations).toHaveLength(0);
  });

  test('should have proper color contrast', async ({ page }) => {
    const results = await AccessibilityUtils.checkColorContrast(page);
    expect(results.violations).toHaveLength(0);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await AccessibilityUtils.checkKeyboardNavigation(page);
    
    // Test specific keyboard interactions
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
    
    // Test escape key functionality
    await page.keyboard.press('Escape');
    
    // Test enter key on buttons
    const firstButton = page.locator('button').first();
    if (await firstButton.count() > 0) {
      await firstButton.focus();
      await page.keyboard.press('Enter');
    }
  });

  test('should have proper ARIA labels and roles', async ({ page }) => {
    await AccessibilityUtils.checkAriaLabels(page);
  });

  test('should have proper heading structure', async ({ page }) => {
    const headingLevels = await AccessibilityUtils.checkHeadingStructure(page);
    
    // Should have at least one h1
    expect(headingLevels).toContain(1);
    
    // First heading should be h1
    expect(headingLevels[0]).toBe(1);
  });

  test('should have accessible forms', async ({ page }) => {
    await AccessibilityUtils.checkFormAccessibility(page);
  });

  test('should have proper image alt text', async ({ page }) => {
    await AccessibilityUtils.checkImageAltText(page);
  });

  test('should have descriptive link text', async ({ page }) => {
    await AccessibilityUtils.checkLinkPurpose(page);
  });

  test('should work with screen readers', async ({ page }) => {
    // Test landmark roles
    const landmarks = await page.locator('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"]').count();
    expect(landmarks).toBeGreaterThan(0);
    
    // Test skip links
    const skipLinks = page.locator('a[href*="#main"], a[href*="#content"], .skip-link');
    const skipLinkCount = await skipLinks.count();
    
    if (skipLinkCount > 0) {
      const firstSkipLink = skipLinks.first();
      await firstSkipLink.focus();
      await expect(firstSkipLink).toBeVisible();
    }
  });

  test('should have proper page title', async ({ page }) => {
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
    expect(title).not.toBe('Document'); // Default title
  });

  test('should have proper language attributes', async ({ page }) => {
    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBeTruthy();
    expect(htmlLang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/); // e.g., 'en' or 'en-US'
  });
});
