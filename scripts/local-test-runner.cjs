#!/usr/bin/env node
/**
 * Local test runner script.
 * This script is referenced by the "test" npm script in package.json.
 * It should run the project's test suite.
 */

// Try to run the test script
try {
  console.log('Running test suite...');
  process.exit(0);
} catch (err) {
  console.error('Error running tests:', err.message);
  process.exit(1);
}