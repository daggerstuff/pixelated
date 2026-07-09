#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const rawTargets = process.argv.slice(2)
const targets = rawTargets.filter((target) => target.trim().length > 0)

if (targets.length === 0) {
  console.log('No explicit targets provided; linting all markdown files in repo.')
  targets.push('**/*.md', '**/*.mdx')
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
