#!/usr/bin/env node
// Local test runner that respects SKIP_TESTS env var.
// If SKIP_TESTS is set to "true" (case-insensitive) or "1", the script exits 0 without running tests.
// Otherwise it forwards arguments to vitest.

import { spawn } from 'child_process'
import path from 'path'
import process from 'process'
import { fileURLToPath } from 'url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))

const skip = (process.env.SKIP_TESTS ?? '').toLowerCase()
if (skip === 'true' || skip === '1') {
  console.log('SKIP_TESTS is set - skipping tests (local only)')
  process.exit(0)
}

const vitestBin = path.resolve(
  scriptDir,
  '../../node_modules/.bin',
  process.platform === 'win32' ? 'vitest.cmd' : 'vitest',
)
const forwardedArgs = process.argv.slice(2)
const hasPositionalArg = forwardedArgs.some((arg) => !arg.startsWith('-'))
if (hasPositionalArg && !process.env.VITEST_COVERAGE_ENABLED) {
  process.env.VITEST_COVERAGE_ENABLED = 'false'
}
const args = [
  '--config',
  path.resolve(scriptDir, '../../config/vitest.config.ts'),
  ...forwardedArgs,
]

const child = spawn(vitestBin, args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV && process.env.NODE_ENV !== 'production'
      ? process.env.NODE_ENV
      : 'test',
  },
})

child.on('exit', (code) => process.exit(code ?? 0))
child.on('error', (err) => {
  console.error('Failed to run vitest:', err)
  process.exit(1)
})
