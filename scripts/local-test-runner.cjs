#!/usr/bin/env node
/**
 * Local test runner script.
 * This script is referenced by the "test" npm script in package.json.
 * It should run the project's test suite.
 */

const { execSync } = require('child_process');
const path = require('path');

// Determine which test command to run
// Use the primary test script defined in package.json
const TEST_SCRIPT = 'pnpm test';

// Try to run the test script
try {
  console.log('Running test suite...');
  const result = execSync(TEST_SCRIPT, { stdio: 'inherit' });
  process.exit(result.status || 0);
} catch (err) {
  console.error('Error running tests:', err.message);
  process.exit(1);
}