#!/usr/bin/env node
// Local test runner that respects SKIP_TESTS env var.
// If SKIP_TESTS is set to "true" (case-insensitive) or "1", the script exits 0 without running tests.
// Otherwise it forwards arguments to vitest.

import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const skip = (process.env.SKIP_TESTS ?? '').toLowerCase()
if (skip === 'true' || skip === '1') {
  console.log('SKIP_TESTS is set - skipping tests (local only)')
  process.exit(0)
}

const vitestBin = path.resolve(
  __dirname,
  '../../node_modules/.bin',
  process.platform === 'win32' ? 'vitest.cmd' : 'vitest',
)
const args = [
  '--config',
  path.resolve(__dirname, '../../config/vitest.config.ts'),
  ...process.argv.slice(2),
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
