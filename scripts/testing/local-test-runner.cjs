#!/usr/bin/env node
// Local test runner that respects SKIP_TESTS env var.
// If SKIP_TESTS is set to "true" (case-insensitive) or "1", the script exits 0 without running tests.
// Otherwise it forwards arguments to vitest.

const { spawn } = require('child_process');
const path = require('path');

const skip = (process.env.SKIP_TESTS || '').toString().toLowerCase();
if (skip === 'true' || skip === '1') {
    console.log('SKIP_TESTS is set - skipping tests (local only)');
    process.exit(0);
}

// Forward to vitest binary in project root node_modules/.bin if available, else try global
const vitestBin = path.resolve(__dirname, '../../node_modules/.bin', process.platform === 'win32' ? 'vitest.cmd' : 'vitest');
const args = process.argv.slice(2);

const cmd = vitestBin;
const child = spawn(cmd, args, { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code));
child.on('error', (err) => {
    console.error('Failed to run vitest:', err);
    process.exit(1);
});
