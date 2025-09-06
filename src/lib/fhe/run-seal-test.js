#!/usr/bin/env node

/**
 * SEAL Integration Test Runner
 *
 * This script runs the SEAL integration test to verify that the FHE implementation
 * is working correctly.
 *
 * Usage: node run-seal-test.js
 */

// First, compile the TypeScript file
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

console.log('SEAL FHE Integration Test Runner')
console.log('================================')

// Determine if we're running from the repo root or from the fhe directory
const currentDir = process.cwd()
const isInFheDir = currentDir.endsWith('fhe')
const repoRoot = isInFheDir ? path.resolve('../../') : currentDir
const fheDir = isInFheDir
  ? currentDir
  : path.join(currentDir, 'src', 'lib', 'fhe')

// Path to the test file
const testFilePath = path.join(fheDir, 'test-seal-integration.ts')
const outputDir = path.join(fheDir, '.test-output')

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

console.log('Compiling TypeScript test file...')

try {
  // Compile the TypeScript file
  execSync(
    `npx tsc --esModuleInterop --skipLibCheck ${testFilePath} --outDir ${outputDir}`,
    {
      stdio: 'inherit',
      cwd: repoRoot,
    },
  )

  console.log('Compilation successful')

  // Run the compiled test
  console.log('\nRunning SEAL integration test...')
  console.log('--------------------------------')

  execSync(`node ${path.join(outputDir, 'test-seal-integration.js')}`, {
    stdio: 'inherit',
    cwd: repoRoot,
  })

  console.log('\nSEAL integration test completed successfully')
} catch (error) {
  console.error('\nError running SEAL integration test:')
  console.error(error.message)
  process.exit(1)
} finally {
  // Clean up the output directory
  try {
    fs.rmSync(outputDir, { recursive: true, force: true })
  } catch {
    console.warn('Warning: Could not clean up test output directory')
  }
}
