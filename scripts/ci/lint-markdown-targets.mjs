#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const rawTargets = process.argv.slice(2)
const targets = rawTargets.filter((target) => target.trim().length > 0)

if (targets.length === 0) {
  console.error('Usage: pnpm lint:markdown <file.md> [more.md|dir|glob ...]')
  console.error('Refusing to lint the entire repo by default. Pass explicit markdown paths.')
  process.exit(1)
}

const result = spawnSync(
  'pnpm',
  [
    'exec',
    'markdownlint',
    '--config',
    '.markdownlint.json',
    '--ignore',
    'node_modules',
    '--ignore',
    '**/node_modules/**',
    ...targets,
  ],
  {
    stdio: 'inherit',
    shell: false,
  },
)

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
