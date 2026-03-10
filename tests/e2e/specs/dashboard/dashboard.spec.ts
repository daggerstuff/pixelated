import { test, expect } from '@playwright/test'
import { LoginPage } from '../../pages/LoginPage'
import { DashboardPage } from '../../pages/DashboardPage'

test.describe('Dashboard Functionality', () => {
  let dashboardPage: DashboardPage

  test.beforeEach(async ({ page }) => {
    // Login before each test
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login('test@example.com', 'validpassword')
    await page.waitForURL('/dashboard')

    dashboardPage = new DashboardPage(page)
  })

  test('should display dashboard elements', async ({ page: _page }) => {
    // Verify main dashboard elements
    await expect(dashboardPage.welcomeMessage).toBeVisible()
    await expect(dashboardPage.navigationMenu).toBeVisible()
    await expect(dashboardPage.chatButton).toBeVisible()
    await expect(dashboardPage.settingsButton).toBeVisible()
    await expect(dashboardPage.userProfile).toBeVisible()
  })

  test('should navigate to different sections', async ({ page }) => {
    // Test navigation to chat
    await dashboardPage.navigateToChat()
    await expect(page).toHaveURL('/chat')

    // Navigate back to dashboard
    await page.goto('/dashboard')

    // Test navigation to settings
    await dashboardPage.navigateToSettings()
    await expect(page).toHaveURL('/settings')
  })

  test('should display user information', async ({ page }) => {
    // Verify user profile information
    await expect(dashboardPage.userProfile).toBeVisible()

    // Click on user profile
    await dashboardPage.userProfile.click()

    // Verify profile dropdown or modal
    const profileDropdown = page.locator('[data-testid="profile-dropdown"]')
    await expect(profileDropdown).toBeVisible()
  })

  test('should handle responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Verify mobile navigation
    const mobileMenu = page.locator('[data-testid="mobile-menu"]')
    const menuToggle = page.locator('[data-testid="menu-toggle"]')

    if (await menuToggle.isVisible()) {
      await menuToggle.click()
      await expect(mobileMenu).toBeVisible()
    }

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })

    // Verify tablet layout
    await expect(dashboardPage.navigationMenu).toBeVisible()

    // Reset to desktop
    await page.setViewportSize({ width: 1280, height: 720 })
  })
})
