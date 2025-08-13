import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  readonly welcomeMessage: Locator;
  readonly navigationMenu: Locator;
  readonly chatButton: Locator;
  readonly settingsButton: Locator;
  readonly logoutButton: Locator;
  readonly userProfile: Locator;

  constructor(page: Page) {
    super(page, '/dashboard');
    this.welcomeMessage = page.locator('[data-testid="welcome-message"]');
    this.navigationMenu = page.locator('[data-testid="navigation-menu"]');
    this.chatButton = page.locator('[data-testid="chat-button"]');
    this.settingsButton = page.locator('[data-testid="settings-button"]');
    this.logoutButton = page.locator('[data-testid="logout-button"]');
    this.userProfile = page.locator('[data-testid="user-profile"]');
  }

  async expectWelcomeMessage(username: string) {
    await this.expectToBeVisible(this.welcomeMessage);
    await this.expectToContainText(this.welcomeMessage, `Welcome, ${username}`);
  }

  async navigateToChat() {
    await this.chatButton.click();
    await this.page.waitForURL('/chat');
  }

  async navigateToSettings() {
    await this.settingsButton.click();
    await this.page.waitForURL('/settings');
  }

  async logout() {
    await this.logoutButton.click();
    await this.page.waitForURL('/login');
  }
}
