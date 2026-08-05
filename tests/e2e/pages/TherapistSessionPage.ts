import { Page, Locator, expect } from '@playwright/test'

import { BasePage } from './BasePage'

export class TherapistSessionPage extends BasePage {
  readonly chatInput: Locator
  readonly sendButton: Locator
  readonly memoryStatsTitle: Locator
  readonly thisSessionCounter: Locator

  constructor(page: Page) {
    super(page, '/therapist-session')
    this.chatInput = page.getByPlaceholder(/Type your message/i)
    this.sendButton = page.locator('button[type="submit"]').first()
    this.memoryStatsTitle = page.getByText('Memory Statistics')
    this.thisSessionCounter = page
      .getByText('This Session')
      .locator('..')
      .locator('.font-semibold')
  }

  async gotoForSession(sessionId: string): Promise<void> {
    await this.page.goto(
      `${this.url}?sessionId=${encodeURIComponent(sessionId)}`,
    )
    await this.page.waitForLoadState('networkidle')
  }

  async expectSessionMemoryCount(count: number | string): Promise<void> {
    await expect(this.thisSessionCounter).toHaveText(String(count))
  }
}
