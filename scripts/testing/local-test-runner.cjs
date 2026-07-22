#!/usr/bin/env node
// Thin shim that forwards to the canonical `local-test-runner.mjs`.
// All test suite + bucket logic lives in the .mjs implementation.
// Added: forward VITEST_BUCKET to control per-shard glob selection.

const { spawn } = require('child_process')

const skip = (process.env.SKIP_TESTS ?? '').toLowerCase()
if (skip === 'true' || skip === '1') {
  console.log('SKIP_TESTS is set - skipping tests (local only)')
  process.exit(0)
}

const mjsEntry = require('path').resolve(__dirname, 'local-test-runner.mjs')

const child = spawn(
  process.execPath,
  ['--experimental-vm-modules', mjsEntry, ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' },
  },
)
child.on('exit', (code) => process.exit(code ?? 0))
child.on('error', (err) => {
  console.error('Failed to start local test runner:', err)
  process.exit(1)
})
