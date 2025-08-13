import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('test@example.com', 'validpassword');
    await page.waitForURL('/dashboard');
  });

  test('should start new chat conversation', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.navigateToChat();
    
    // Verify chat interface
    const messageInput = page.locator('[data-testid="message-input"]');
    const sendButton = page.locator('[data-testid="send-button"]');
    const chatHistory = page.locator('[data-testid="chat-history"]');
    
    await expect(messageInput).toBeVisible();
    await expect(sendButton).toBeVisible();
    await expect(chatHistory).toBeVisible();
  });

  test('should send and receive messages', async ({ page }) => {
    await page.goto('/chat');
    
    const messageInput = page.locator('[data-testid="message-input"]');
    const sendButton = page.locator('[data-testid="send-button"]');
    const chatHistory = page.locator('[data-testid="chat-history"]');
    
    // Send a test message
    const testMessage = 'Hello, I need some support today.';
    await messageInput.fill(testMessage);
    await sendButton.click();
    
    // Verify message appears in chat history
    await expect(chatHistory).toContainText(testMessage);
    
    // Wait for AI response (with timeout)
    await expect(chatHistory.locator('.ai-response')).toBeVisible({ timeout: 10000 });
    
    // Verify AI response is present
    const aiResponses = await chatHistory.locator('.ai-response').count();
    expect(aiResponses).toBeGreaterThan(0);
  });

  test('should handle empty message submission', async ({ page }) => {
    await page.goto('/chat');
    
    const messageInput = page.locator('[data-testid="message-input"]');
    const sendButton = page.locator('[data-testid="send-button"]');
    
    // Try to send empty message
    await sendButton.click();
    
    // Send button should be disabled or show validation error
    const errorMessage = page.locator('[data-testid="validation-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Please enter a message');
  });

  test('should save chat history', async ({ page }) => {
    await page.goto('/chat');
    
    // Send multiple messages
    const messages = ['First message', 'Second message', 'Third message'];
    
    for (const message of messages) {
      await page.fill('[data-testid="message-input"]', message);
      await page.click('[data-testid="send-button"]');
      await page.waitForTimeout(1000); // Wait between messages
    }
    
    // Refresh page
    await page.reload();
    
    // Verify messages are still there
    const chatHistory = page.locator('[data-testid="chat-history"]');
    for (const message of messages) {
      await expect(chatHistory).toContainText(message);
    }
  });
});
