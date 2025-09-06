import { FullConfig } from '@playwright/test';

async function globalTeardown(_config: FullConfig) {
  console.log('🧹 Starting global E2E test teardown...');
  
  try {
    // Perform any global cleanup tasks
    console.log('  Cleaning up test environment...');
    
    // Example cleanup tasks:
    // - Clear test databases
    // - Remove temporary files
    // - Reset application state
    
    console.log('  ✅ Global teardown completed');
    
  } catch (error: unknown) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
}

export default globalTeardown;
