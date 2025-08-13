import { test, expect } from '@playwright/test';
import { UsabilityUtils } from '../utils/UsabilityUtils';

test.describe('Mobile Usability', () => {
  const mobileViewports = [
    { width: 375, height: 667, name: 'iPhone SE' },
    { width: 390, height: 844, name: 'iPhone 12' },
    { width: 360, height: 640, name: 'Android Small' },
    { width: 412, height: 915, name: 'Android Large' }
  ];

  mobileViewports.forEach(viewport => {
    test(`should be usable on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const results = await UsabilityUtils.testMobileUsability(page);
      
      expect(results.touchTargetsAdequate).toBe(true);
      expect(results.textReadable).toBe(true);
      expect(results.contentFitsViewport).toBe(true);
      
      if (results.errors.length > 0) {
        console.log(`Mobile usability issues on ${viewport.name}:`, results.errors);
      }
    });
  });

  test('should have adequate touch target sizes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    const touchTargets = await page.locator('button, a, input[type="button"], input[type="submit"], [role="button"]').all();
    
    for (const target of touchTargets) {
      const box = await target.boundingBox();
      if (box) {
        // WCAG recommends minimum 44x44px touch targets
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('should have readable text on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    const textElements = await page.locator('p, span, div, li, h1, h2, h3, h4, h5, h6').all();
    
    for (const element of textElements.slice(0, 10)) {
      const fontSize = await element.evaluate(el => {
        return parseFloat(window.getComputedStyle(el).fontSize);
      });
      
      // Minimum 16px for body text on mobile
      expect(fontSize).toBeGreaterThanOrEqual(16);
    }
  });

  test('should not require horizontal scrolling', async ({ page }) => {
    const viewports = [320, 375, 414]; // Common mobile widths
    
    for (const width of viewports) {
      await page.setViewportSize({ width, height: 667 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      
      expect(hasHorizontalScroll).toBe(false);
    }
  });

  test('should have working mobile navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Look for mobile menu toggle
    const menuToggle = page.locator('[aria-label*="menu"], .menu-toggle, .hamburger, [data-testid="mobile-menu-toggle"]');
    
    if (await menuToggle.count() > 0) {
      // Test menu toggle
      await menuToggle.click();
      await page.waitForTimeout(500);
      
      // Check if menu is visible
      const mobileMenu = page.locator('.mobile-menu, [aria-expanded="true"], .nav-open');
      await expect(mobileMenu.first()).toBeVisible();
      
      // Test menu close
      await menuToggle.click();
      await page.waitForTimeout(500);
      
      // Menu should be hidden
      await expect(mobileMenu.first()).not.toBeVisible();
    }
  });

  test('should support touch gestures', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Test swipe gestures if carousel or swipeable content exists
    const swipeableElements = page.locator('[data-swipeable], .carousel, .slider');
    
    if (await swipeableElements.count() > 0) {
      const element = swipeableElements.first();
      const box = await element.boundingBox();
      
      if (box) {
        // Simulate swipe left
        await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
        await page.mouse.up();
        
        await page.waitForTimeout(500);
      }
    }
  });

  test('should handle orientation changes', async ({ page }) => {
    // Test portrait mode
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    let hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
    
    // Test landscape mode
    await page.setViewportSize({ width: 667, height: 375 });
    await page.waitForTimeout(500);
    
    hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });

  test('should have appropriate spacing for mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Check spacing between interactive elements
    const buttons = await page.locator('button, a').all();
    
    for (let i = 0; i < buttons.length - 1; i++) {
      const currentBox = await buttons[i].boundingBox();
      const nextBox = await buttons[i + 1].boundingBox();
      
      if (currentBox && nextBox) {
        // Calculate distance between elements
        const distance = Math.abs(nextBox.y - (currentBox.y + currentBox.height));
        
        // Should have at least 8px spacing between interactive elements
        if (distance < 100) { // Only check if elements are close vertically
          expect(distance).toBeGreaterThanOrEqual(8);
        }
      }
    }
  });
});
