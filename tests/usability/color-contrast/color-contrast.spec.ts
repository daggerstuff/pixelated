import { test, expect } from '@playwright/test';
import { AccessibilityUtils } from '../utils/AccessibilityUtils';

test.describe('Color Contrast Compliance', () => {
  const testPages = [
    { path: '/', name: 'Home Page' },
    { path: '/login', name: 'Login Page' },
    { path: '/dashboard', name: 'Dashboard' },
    { path: '/chat', name: 'Chat Interface' }
  ];

  testPages.forEach(({ path, name }) => {
    test(`${name} should meet WCAG AA color contrast requirements`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      
      const results = await AccessibilityUtils.checkColorContrast(page);
      
      if (results.violations.length > 0) {
        console.log(`Color contrast violations on ${name}:`, results.violations);
      }
      
      expect(results.violations).toHaveLength(0);
    });
  });

  test('should maintain contrast in dark mode', async ({ page }) => {
    await page.goto('/');
    
    // Toggle dark mode if available
    const darkModeToggle = page.locator('[data-testid="theme-toggle"], .dark-mode-toggle');
    if (await darkModeToggle.count() > 0) {
      await darkModeToggle.click();
      await page.waitForTimeout(500);
      
      const results = await AccessibilityUtils.checkColorContrast(page);
      expect(results.violations).toHaveLength(0);
    }
  });

  test('should maintain contrast with custom themes', async ({ page }) => {
    await page.goto('/');
    
    // Test different theme options if available
    const themeSelectors = await page.locator('[data-testid*="theme"], .theme-selector option').all();
    
    for (const selector of themeSelectors.slice(0, 3)) { // Test first 3 themes
      await selector.click();
      await page.waitForTimeout(500);
      
      const results = await AccessibilityUtils.checkColorContrast(page);
      expect(results.violations).toHaveLength(0);
    }
  });
});
