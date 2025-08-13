import { Page, expect } from '@playwright/test';

export class TestUtils {
  static async waitForNetworkIdle(page: Page, timeout = 30000) {
    await page.waitForLoadState('networkidle', { timeout });
  }

  static async takeFullPageScreenshot(page: Page, name: string) {
    await page.screenshot({ 
      path: `screenshots/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }

  static async scrollToElement(page: Page, selector: string) {
    await page.locator(selector).scrollIntoViewIfNeeded();
  }

  static async waitForElement(page: Page, selector: string, timeout = 10000) {
    await page.waitForSelector(selector, { timeout });
  }

  static async clearAndType(page: Page, selector: string, text: string) {
    await page.locator(selector).clear();
    await page.locator(selector).fill(text);
  }

  static async selectDropdownOption(page: Page, dropdownSelector: string, optionText: string) {
    await page.locator(dropdownSelector).click();
    await page.locator(`text=${optionText}`).click();
  }

  static async uploadFile(page: Page, inputSelector: string, filePath: string) {
    await page.setInputFiles(inputSelector, filePath);
  }

  static async waitForApiResponse(page: Page, urlPattern: string | RegExp) {
    return await page.waitForResponse(urlPattern);
  }

  static async mockApiResponse(page: Page, url: string, response: any) {
    await page.route(url, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      });
    });
  }

  static async interceptNetworkRequests(page: Page, urlPattern: string | RegExp) {
    const requests: any[] = [];
    
    page.on('request', request => {
      if (request.url().match(urlPattern)) {
        requests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData()
        });
      }
    });
    
    return requests;
  }

  static async verifyAccessibility(page: Page) {
    // Basic accessibility checks
    const title = await page.title();
    expect(title).toBeTruthy();
    
    // Check for alt text on images
    const images = await page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      expect(alt).toBeTruthy();
    }
    
    // Check for form labels
    const inputs = await page.locator('input[type="text"], input[type="email"], input[type="password"]').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        await expect(label).toBeVisible();
      }
    }
  }

  static async verifyPerformance(page: Page, maxLoadTime = 3000) {
    const startTime = Date.now();
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(maxLoadTime);
    console.log(`Page load time: ${loadTime}ms`);
  }
}
