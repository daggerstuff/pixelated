import { test, expect } from '@playwright/test';

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate through all focusable elements with Tab', async ({ page }) => {
    const focusableElements = await page.locator(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ).all();
    
    expect(focusableElements.length).toBeGreaterThan(0);
    
    // Test forward navigation
    for (let i = 0; i < Math.min(focusableElements.length, 20); i++) {
      await page.keyboard.press('Tab');
      
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tagName: el?.tagName,
          type: el?.getAttribute('type'),
          id: el?.id,
          className: el?.className
        };
      });
      
      expect(focusedElement.tagName).toBeTruthy();
    }
  });

  test('should navigate backwards with Shift+Tab', async ({ page }) => {
    // Navigate forward a few steps
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }
    
    const forwardElement = await page.evaluate(() => document.activeElement?.id);
    
    // Navigate backward
    await page.keyboard.press('Shift+Tab');
    
    const backwardElement = await page.evaluate(() => document.activeElement?.id);
    
    // Should be different elements
    expect(backwardElement).not.toBe(forwardElement);
  });

  test('should activate buttons with Enter and Space', async ({ page }) => {
    const buttons = await page.locator('button').all();
    
    if (buttons.length > 0) {
      const firstButton = buttons[0];
      await firstButton.focus();
      
      // Test Enter key
      await page.keyboard.press('Enter');
      
      // Test Space key
      await firstButton.focus();
      await page.keyboard.press('Space');
    }
  });

  test('should navigate forms with keyboard', async ({ page }) => {
    const forms = await page.locator('form').all();
    
    if (forms.length > 0) {
      const form = forms[0];
      const inputs = await form.locator('input, textarea, select').all();
      
      if (inputs.length > 0) {
        // Focus first input
        await inputs[0].focus();
        
        // Navigate through form fields
        for (let i = 1; i < inputs.length; i++) {
          await page.keyboard.press('Tab');
          
          const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
          expect(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']).toContain(focusedElement);
        }
      }
    }
  });

  test('should handle modal dialogs with keyboard', async ({ page }) => {
    // Look for modal triggers
    const modalTriggers = page.locator('[data-testid*="modal"], [aria-haspopup="dialog"], .modal-trigger');
    
    if (await modalTriggers.count() > 0) {
      const trigger = modalTriggers.first();
      await trigger.focus();
      await page.keyboard.press('Enter');
      
      // Wait for modal to appear
      await page.waitForTimeout(500);
      
      // Test Escape key closes modal
      await page.keyboard.press('Escape');
      
      // Modal should be closed
      const modal = page.locator('[role="dialog"], .modal');
      if (await modal.count() > 0) {
        await expect(modal).not.toBeVisible();
      }
    }
  });

  test('should handle dropdown menus with keyboard', async ({ page }) => {
    const dropdowns = page.locator('[role="button"][aria-haspopup], .dropdown-trigger, select');
    
    if (await dropdowns.count() > 0) {
      const dropdown = dropdowns.first();
      await dropdown.focus();
      
      // Open dropdown with Enter or Space
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      
      // Navigate options with arrow keys
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowUp');
      
      // Close with Escape
      await page.keyboard.press('Escape');
    }
  });

  test('should skip to main content with skip link', async ({ page }) => {
    const skipLinks = page.locator('a[href*="#main"], a[href*="#content"], .skip-link');
    
    if (await skipLinks.count() > 0) {
      const skipLink = skipLinks.first();
      
      // Focus skip link (usually first tab stop)
      await page.keyboard.press('Tab');
      
      // Activate skip link
      await page.keyboard.press('Enter');
      
      // Verify focus moved to main content
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          id: el?.id,
          tagName: el?.tagName,
          role: el?.getAttribute('role')
        };
      });
      
      expect(['main', 'MAIN']).toContain(focusedElement.id || focusedElement.tagName || focusedElement.role);
    }
  });

  test('should maintain visible focus indicators', async ({ page }) => {
    const focusableElements = await page.locator('button, a, input').all();
    
    if (focusableElements.length > 0) {
      for (const element of focusableElements.slice(0, 5)) {
        await element.focus();
        
        // Check if element has visible focus indicator
        const focusStyles = await element.evaluate(el => {
          const styles = window.getComputedStyle(el, ':focus');
          return {
            outline: styles.outline,
            outlineWidth: styles.outlineWidth,
            outlineStyle: styles.outlineStyle,
            boxShadow: styles.boxShadow
          };
        });
        
        // Should have some form of focus indicator
        const hasFocusIndicator = 
          focusStyles.outline !== 'none' ||
          focusStyles.outlineWidth !== '0px' ||
          focusStyles.boxShadow !== 'none';
        
        expect(hasFocusIndicator).toBe(true);
      }
    }
  });
});
