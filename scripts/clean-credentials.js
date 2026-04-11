#!/usr/bin/env node

import { scanDirectory } from './utils/security-audit.js'

const args = new Set(process.argv.slice(2))
const checkOnly = args.has('--check-only')
const targets = ['src', 'scripts', '.github', 'config', 'docker']

console.log(
  checkOnly
    ? '🔍 Running credential exposure scan...'
    : '🧹 Running credential cleanup audit...',
)

const findings = targets.flatMap((target) => scanDirectory(target))

if (findings.length === 0) {
  console.log('✅ No hardcoded credentials detected.')
  process.exit(0)
}

console.error(`❌ Found ${findings.length} potential credential exposure(s):`)

for (const finding of findings) {
  console.error(
    `  [${finding.severity}] ${finding.file}:${finding.line} - ${finding.message}`,
  )
  console.error(`    ${finding.code}`)
}

if (checkOnly) {
  console.error(
    '\nRemove or rotate the exposed values and rerun pnpm security:check.',
  )
} else {
  console.error(
    '\nAutomatic credential rewriting is intentionally disabled. Review the findings above, rotate compromised values, and apply the needed source changes manually.',
  )
}

process.exit(1)
