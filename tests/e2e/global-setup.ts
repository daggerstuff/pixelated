import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global E2E test setup...');
  
  // Launch browser for setup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Perform any global setup tasks
    console.log('  Setting up test environment...');
    
    // Example: Login and save authentication state
    // await page.goto('/login');
    // await page.fill('[data-testid="email"]', 'test@example.com');
    // await page.fill('[data-testid="password"]', 'testpassword');
    // await page.click('[data-testid="login-button"]');
    // await page.waitForURL('/dashboard');
    // await context.storageState({ path: 'tests/e2e/auth.json' });
    
    console.log('  ✅ Global setup completed');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
