#!/usr/bin/env node

/**
 * Playwright Test Runner Scrip
 *
 * This script ensures Playwright is properly set up and can run tests.
 * It handles installing dependencies and executing tests.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const BROWSER_BINARY_PATH = join(
  process.cwd(),
  'node_modules',
  '.cache',
  'ms-playwright',
)

/**
 * Check if Playwright browsers are installed
 */
function checkPlaywrightInstallation() {
  console.log('Checking Playwright installation...')
  return existsSync(BROWSER_BINARY_PATH)
}

/**
 * Install Playwright browsers and dependencies
 */
function installPlaywright() {
  console.log('Installing Playwright browsers and dependencies...')
  const installResult = spawnSync(
    'pnpm',
    ['exec', 'playwright', 'install', '--with-deps'],
    {
      stdio: 'inherit',
    },
  )

  if (installResult.status !== 0) {
    throw new Error(
      `Failed to install Playwright browsers: ${installResult.stderr?.toString() || 'Unknown error'}`,
    )
  }

  console.log('✅ Playwright browsers installed successfully')
}

/**
 * Run Playwright tests
 */
function runTests(args: string[] = []) {
  console.log('Running Playwright tests...')

  // Build the command arguments
  const testArgs = ['exec', 'playwright', 'test', ...args]

  // Run the tests
  const testResult = spawnSync('pnpm', testArgs, {
    stdio: 'inherit',
    env: {
      ...process.env,
      // Ensure we use the installed browsers
      PLAYWRIGHT_BROWSERS_PATH: BROWSER_BINARY_PATH,
    },
  })

  if (testResult.status !== 0) {
    if (testResult.signal === 'SIGINT') {
      console.log('Tests were interrupted')
      process.exit(130) // Standard exit code for SIGINT
    }

    throw new Error(`Tests failed with exit code ${testResult.status}`)
  }

  console.log('✅ All tests passed successfully')
}

/**
 * Main function
 */
async function main() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2)
    const setupOnly = args.includes('--setup-only')

    // Remove our custom flags so they don't get passed to Playwrigh
    const filteredArgs = args.filter((arg) => arg !== '--setup-only')

    // Check if Playwright browsers are installed
    const isInstalled = checkPlaywrightInstallation()

    // Install if needed
    if (!isInstalled) {
      installPlaywright()
    } else {
      console.log('✅ Playwright browsers already installed')
    }

    // Exit early if only setup was requested
    if (setupOnly) {
      console.log('Setup only mode - skipping test execution')
      process.exit(0)
    }

    // Run the tests
    runTests(filteredArgs)

    process.exit(0)
  } catch {
    console.error('\n❌ Error')
    process.exit(1)
  }
}

// Run the scrip
main().catch(() => {
  console.error('Unhandled error')
  process.exit(1)
})
