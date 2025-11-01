#!/usr/bin/env node
/**
 * Consolidated test runner for Pixelated Empathy platform
 * Manages TypeScript, Python, and integration tests
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color codes for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, description) {
  log(`\n${colors.bold}=== ${description} ===${colors.reset}`, 'blue');
  try {
    const output = execSync(command, { 
      stdio: 'inherit', 
      cwd: process.cwd(),
      encoding: 'utf8'
    });
    log(`✅ ${description} completed successfully`, 'green');
    return true;
  } catch (error) {
    log(`❌ ${description} failed with exit code ${error.status}`, 'red');
    return false;
  }
}

function checkFileExists(filePath) {
  return fs.existsSync(path.resolve(filePath));
}

// Test suite configurations
const testSuites = {
  typescript: {
    description: 'TypeScript Type Checking',
    command: 'pnpm typecheck',
    required: true
  },
  lint: {
    description: 'Code Linting',
    command: 'pnpm lint',
    required: true
  },
  format: {
    description: 'Code Formatting Check',
    command: 'pnpm format:check',
    required: false
  },
  vitest: {
    description: 'Vitest Unit Tests',
    command: 'pnpm vitest run',
    required: true
  },
  python: {
    description: 'Python Tests',
    command: 'uv run pytest tests/python/ -v',
    required: true,
    condition: () => checkFileExists('tests/python')
  },
  e2e: {
    description: 'End-to-End Tests',
    command: 'pnpm test:e2e',
    required: false,
    condition: () => checkFileExists('tests/e2e')
  },
  integration: {
    description: 'Integration Tests',
    command: 'pnpm test:integration',
    required: false
  }
};

function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'all';
  
  log(`${colors.bold}Pixelated Empathy Test Runner${colors.reset}`, 'blue');
  log(`Running: ${testType}`, 'yellow');
  
  let results = [];
  let totalTests = 0;
  let passedTests = 0;
  
  // Determine which tests to run
  let suitesToRun = [];
  if (testType === 'all') {
    suitesToRun = Object.keys(testSuites);
  } else if (testSuites[testType]) {
    suitesToRun = [testType];
  } else {
    log(`Unknown test type: ${testType}`, 'red');
    log('Available options: all, typescript, lint, format, vitest, python, e2e, integration', 'yellow');
    process.exit(1);
  }
  
  // Run tests
  for (const suite of suitesToRun) {
    const config = testSuites[suite];
    
    // Check conditions
    if (config.condition && !config.condition()) {
      log(`⏭️  Skipping ${config.description} (condition not met)`, 'yellow');
      continue;
    }
    
    totalTests++;
    const success = runCommand(config.command, config.description);
    
    if (success) {
      passedTests++;
    } else if (config.required) {
      log(`\n${colors.bold}❌ Required test failed: ${config.description}${colors.reset}`, 'red');
      if (testType === 'all') {
        log('Continuing with remaining tests...', 'yellow');
      }
    }
    
    results.push({
      suite,
      description: config.description,
      success,
      required: config.required
    });
  }
  
  // Summary
  log(`\n${colors.bold}=== Test Summary ===${colors.reset}`, 'blue');
  log(`Total: ${totalTests}, Passed: ${passedTests}, Failed: ${totalTests - passedTests}`);
  
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    const req = result.required ? '(required)' : '(optional)';
    log(`${icon} ${result.description} ${req}`);
  });
  
  // Exit code
  const requiredFailures = results.filter(r => r.required && !r.success).length;
  if (requiredFailures > 0) {
    log(`\n${colors.bold}❌ ${requiredFailures} required test(s) failed${colors.reset}`, 'red');
    process.exit(1);
  } else {
    log(`\n${colors.bold}✅ All required tests passed!${colors.reset}`, 'green');
    process.exit(0);
  }
}

if (import.meta.url === `file://${__filename}`) {
  main();
}