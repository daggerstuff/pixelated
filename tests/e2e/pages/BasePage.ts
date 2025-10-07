import { Page, Locator, expect } from '@playwright/test';

export abstract class BasePage {
  readonly page: Page;
  readonly url: string;

  constructor(page: Page, url: string) {
    this.page = page;
    this.url = url;
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `screenshots/${name}.png` });
  }

  async getTitle(): Promise<string> {
    return await this.page.title();
  }

  async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }

  // Common assertions
  async expectToBeVisible(locator: Locator) {
    await expect(locator).toBeVisible();
  }

  async expectToHaveText(locator: Locator, text: string) {
    await expect(locator).toHaveText(text);
  }

  async expectToContainText(locator: Locator, text: string) {
    await expect(locator).toContainText(text);
  }
}
