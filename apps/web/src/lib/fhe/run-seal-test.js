#!/usr/bin/env node
/// <reference path="./run-seal-test.d.ts" />

/**
 * SEAL Integration Test Runner
 *
 * This script runs the SEAL integration test to verify that the FHE implementation
 * is working correctly.
 *
 * Usage: node run-seal-test.js
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const toErrorMessage = (error) => {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  try {
    const serialized = JSON.stringify(error)
    return serialized || 'Unknown error'
  } catch {
    return String(error)
  }
}

// First, compile the TypeScript file

console.log('SEAL FHE Integration Test Runner')
console.log('================================')

// Determine if we're running from the repo root or from the fhe directory
/** @type {string} */
const currentDir = process.cwd()
const isInFheDir = currentDir.endsWith('fhe')
/** @type {string} */
const repoRoot = isInFheDir ? path.resolve('../../') : currentDir
/** @type {string} */
const fheDir = isInFheDir
  ? currentDir
  : path.join(currentDir, 'src', 'lib', 'fhe')

// Path to the test file
/** @type {string} */
const testFilePath = path.join(fheDir, 'test-seal-integration.ts')
/** @type {string} */
const outputDir = path.join(fheDir, '.test-output')
/** @type {string} */
const compiledTestPath = path.join(outputDir, 'test-seal-integration.js')

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

  execSync(`node ${compiledTestPath}`, {
    stdio: 'inherit',
    cwd: repoRoot,
  })

  console.log('\nSEAL integration test completed successfully')
} catch (error) {
  console.error('\nError running SEAL integration test:')
  const errorMessage = toErrorMessage(error)
  console.error(errorMessage)
  process.exit(1)
} finally {
  // Clean up the output directory
  try {
    fs.rmSync(outputDir, { recursive: true, force: true })
  } catch {
    console.warn('Warning: Could not clean up test output directory')
  }
}
