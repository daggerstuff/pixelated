import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';

test.describe('Authentication Flow', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
  });

  test('should login with valid credentials', async ({ page }) => {
    await loginPage.goto();
    await loginPage.login('test@example.com', 'validpassword');
    
    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard');
    
    // Verify dashboard elements
    await dashboardPage.expectWelcomeMessage('Test User');
    await expect(dashboardPage.navigationMenu).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await loginPage.goto();
    await loginPage.login('invalid@example.com', 'wrongpassword');
    
    // Should stay on login page and show error
    await expect(page).toHaveURL('/login');
    await loginPage.expectLoginError('Invalid credentials');
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    // Try to access dashboard without authentication
    await page.goto('/dashboard');
    
    // Should redirect to login
    await page.waitForURL('/login');
    await expect(loginPage.emailInput).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await loginPage.goto();
    await loginPage.login('test@example.com', 'validpassword');
    await page.waitForURL('/dashboard');
    
    // Logout
    await dashboardPage.logout();
    
    // Should redirect to login
    await page.waitForURL('/login');
    await expect(loginPage.emailInput).toBeVisible();
  });
});
