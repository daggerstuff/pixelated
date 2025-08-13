import { Page, expect } from '@playwright/test';

export class UsabilityUtils {
  static async measurePageLoadTime(page: Page): Promise<number> {
    const startTime = Date.now();
    await page.waitForLoadState('networkidle');
    const endTime = Date.now();
    return endTime - startTime;
  }

  static async checkResponsiveDesign(page: Page, breakpoints: Array<{width: number, height: number, name: string}>) {
    const results = [];
    
    for (const breakpoint of breakpoints) {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await page.waitForTimeout(500); // Allow layout to settle
      
      // Check for horizontal scrollbars
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      
      // Check if content is visible
      const mainContent = page.locator('main, [role="main"], .main-content').first();
      const isVisible = await mainContent.isVisible().catch(() => false);
      
      results.push({
        breakpoint: breakpoint.name,
        width: breakpoint.width,
        height: breakpoint.height,
        hasHorizontalScroll,
        mainContentVisible: isVisible,
        passed: !hasHorizontalScroll && isVisible
      });
    }
    
    return results;
  }

  static async testFormUsability(page: Page, formSelector: string) {
    const form = page.locator(formSelector);
    await expect(form).toBeVisible();
    
    const results = {
      formVisible: true,
      fieldsAccessible: true,
      validationWorks: true,
      submitWorks: true,
      errors: []
    };
    
    try {
      // Test form field accessibility
      const inputs = await form.locator('input, textarea, select').all();
      
      for (const input of inputs) {
        const type = await input.getAttribute('type');
        const required = await input.getAttribute('required');
        
        // Test focus
        await input.focus();
        const isFocused = await input.evaluate(el => el === document.activeElement);
        
        if (!isFocused) {
          results.fieldsAccessible = false;
          results.errors.push(`Input field not focusable: ${await input.getAttribute('name')}`);
        }
        
        // Test required field validation
        if (required !== null) {
          await input.fill('');
          await form.locator('[type="submit"]').click();
          
          const validationMessage = await input.evaluate(el => (el as HTMLInputElement).validationMessage);
          if (!validationMessage) {
            results.validationWorks = false;
            results.errors.push(`Required field validation not working: ${await input.getAttribute('name')}`);
          }
        }
      }
    } catch (error) {
      results.errors.push(`Form usability test error: ${error.message}`);
    }
    
    return results;
  }

  static async testNavigationUsability(page: Page) {
    const results = {
      mainNavVisible: false,
      breadcrumbsPresent: false,
      searchFunctional: false,
      skipLinksPresent: false,
      errors: []
    };
    
    try {
      // Check main navigation
      const mainNav = page.locator('nav[role="navigation"], .main-nav, header nav').first();
      results.mainNavVisible = await mainNav.isVisible().catch(() => false);
      
      // Check breadcrumbs
      const breadcrumbs = page.locator('[aria-label*="breadcrumb"], .breadcrumb, nav[aria-label*="Breadcrumb"]');
      results.breadcrumbsPresent = await breadcrumbs.count() > 0;
      
      // Check skip links
      const skipLinks = page.locator('a[href*="#main"], a[href*="#content"], .skip-link');
      results.skipLinksPresent = await skipLinks.count() > 0;
      
      // Test search functionality if present
      const searchInput = page.locator('input[type="search"], [role="search"] input');
      if (await searchInput.count() > 0) {
        await searchInput.first().fill('test');
        await page.keyboard.press('Enter');
        // Wait for search results or navigation
        await page.waitForTimeout(2000);
        results.searchFunctional = true;
      }
      
    } catch (error) {
      results.errors.push(`Navigation usability test error: ${error.message}`);
    }
    
    return results;
  }

  static async testMobileUsability(page: Page) {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    const results = {
      touchTargetsAdequate: true,
      textReadable: true,
      contentFitsViewport: true,
      mobileMenuWorks: true,
      errors: []
    };
    
    try {
      // Check touch target sizes (minimum 44px)
      const clickableElements = await page.locator('button, a, input[type="button"], input[type="submit"]').all();
      
      for (const element of clickableElements) {
        const box = await element.boundingBox();
        if (box && (box.width < 44 || box.height < 44)) {
          results.touchTargetsAdequate = false;
          results.errors.push(`Touch target too small: ${box.width}x${box.height}px`);
        }
      }
      
      // Check text readability (minimum 16px)
      const textElements = await page.locator('p, span, div, li').all();
      
      for (const element of textElements.slice(0, 10)) { // Check first 10 elements
        const fontSize = await element.evaluate(el => {
          return window.getComputedStyle(el).fontSize;
        });
        
        const fontSizeNum = parseFloat(fontSize);
        if (fontSizeNum < 16) {
          results.textReadable = false;
          results.errors.push(`Text too small: ${fontSize}`);
          break; // Don't spam errors
        }
      }
      
      // Check for horizontal scrolling
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      
      if (hasHorizontalScroll) {
        results.contentFitsViewport = false;
        results.errors.push('Horizontal scrolling detected on mobile');
      }
      
      // Test mobile menu if present
      const mobileMenuToggle = page.locator('[aria-label*="menu"], .menu-toggle, .hamburger');
      if (await mobileMenuToggle.count() > 0) {
        await mobileMenuToggle.first().click();
        await page.waitForTimeout(500);
        
        const mobileMenu = page.locator('.mobile-menu, [aria-expanded="true"]');
        const menuVisible = await mobileMenu.isVisible().catch(() => false);
        
        if (!menuVisible) {
          results.mobileMenuWorks = false;
          results.errors.push('Mobile menu toggle not working');
        }
      }
      
    } catch (error) {
      results.errors.push(`Mobile usability test error: ${error.message}`);
    }
    
    return results;
  }

  static async generateUsabilityReport(page: Page, testName: string, testResults: any) {
    const report = {
      testName,
      url: page.url(),
      timestamp: new Date().toISOString(),
      viewport: await page.viewportSize(),
      userAgent: await page.evaluate(() => navigator.userAgent),
      results: testResults,
      summary: {
        totalTests: Object.keys(testResults).length,
        passed: Object.values(testResults).filter(result => 
          typeof result === 'boolean' ? result : result.passed
        ).length,
        failed: Object.values(testResults).filter(result => 
          typeof result === 'boolean' ? !result : !result.passed
        ).length
      }
    };
    
    return report;
  }
}
