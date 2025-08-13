import { Page, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export class AccessibilityUtils {
  static async runAxeAnalysis(page: Page, options?: any) {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    
    return accessibilityScanResults;
  }

  static async checkColorContrast(page: Page) {
    const results = await new AxeBuilder({ page })
      .include('body')
      .withRules(['color-contrast'])
      .analyze();
    
    expect(results.violations).toHaveLength(0);
    return results;
  }

  static async checkKeyboardNavigation(page: Page) {
    // Test tab navigation
    const focusableElements = await page.locator(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ).all();
    
    for (let i = 0; i < Math.min(focusableElements.length, 10); i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(focused).toBeTruthy();
    }
  }

  static async checkAriaLabels(page: Page) {
    const results = await new AxeBuilder({ page })
      .withRules(['aria-labels', 'button-name', 'link-name', 'label'])
      .analyze();
    
    expect(results.violations).toHaveLength(0);
    return results;
  }

  static async checkHeadingStructure(page: Page) {
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    const headingLevels = [];
    
    for (const heading of headings) {
      const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
      const level = parseInt(tagName.charAt(1));
      headingLevels.push(level);
    }
    
    // Check heading hierarchy
    for (let i = 1; i < headingLevels.length; i++) {
      const currentLevel = headingLevels[i];
      const previousLevel = headingLevels[i - 1];
      
      // Heading levels should not skip more than one level
      if (currentLevel > previousLevel + 1) {
        throw new Error(`Heading hierarchy violation: h${previousLevel} followed by h${currentLevel}`);
      }
    }
    
    return headingLevels;
  }

  static async checkFormAccessibility(page: Page) {
    // Check for form labels
    const inputs = await page.locator('input[type="text"], input[type="email"], input[type="password"], textarea, select').all();
    
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        const labelExists = await label.count() > 0;
        
        if (!labelExists && !ariaLabel && !ariaLabelledBy) {
          throw new Error(`Input element missing accessible label: ${await input.getAttribute('name') || 'unnamed'}`);
        }
      }
    }
  }

  static async checkImageAltText(page: Page) {
    const images = await page.locator('img').all();
    
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');
      
      // Images should have alt text unless they are decorative
      if (alt === null && role !== 'presentation') {
        const src = await img.getAttribute('src');
        throw new Error(`Image missing alt text: ${src}`);
      }
    }
  }

  static async checkLinkPurpose(page: Page) {
    const links = await page.locator('a[href]').all();
    
    for (const link of links) {
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute('aria-label');
      const title = await link.getAttribute('title');
      
      const linkText = text?.trim() || ariaLabel || title;
      
      if (!linkText || linkText.length < 2) {
        const href = await link.getAttribute('href');
        throw new Error(`Link missing descriptive text: ${href}`);
      }
      
      // Check for generic link text
      const genericTexts = ['click here', 'read more', 'more', 'link'];
      if (genericTexts.includes(linkText.toLowerCase())) {
        console.warn(`Generic link text found: "${linkText}"`);
      }
    }
  }

  static async generateAccessibilityReport(page: Page, testName: string) {
    const results = await this.runAxeAnalysis(page);
    
    const report = {
      testName,
      url: page.url(),
      timestamp: new Date().toISOString(),
      violations: results.violations.length,
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      inapplicable: results.inapplicable.length,
      details: {
        violations: results.violations.map(violation => ({
          id: violation.id,
          impact: violation.impact,
          description: violation.description,
          help: violation.help,
          helpUrl: violation.helpUrl,
          nodes: violation.nodes.length
        }))
      }
    };
    
    // Save report
    const reportPath = `tests/usability/reports/accessibility-${testName}-${Date.now()}.json`;
    await page.context().browser()?.close();
    
    return report;
  }
}
