#!/usr/bin/env node
/**
 * Python correctness ratchet (ruff).
 *
 * Fails when the count of correctness-class ruff findings outside the
 * submodules and the generated SDK grows past the pinned baseline.
 * Fixes shrink the baseline naturally; only re-pin intentionally:
 *   node scripts/ci/python-ruff-audit.mjs -- --update
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const ROOT = new URL('../..', import.meta.url).pathname
const BASELINE_PATH = new URL('./python-ruff-baseline.json', import.meta.url).pathname
const RULES = 'F821,F401,E722,B904'
const EXCLUDES = ['ai/', 'foresight/', 'packages/sdk-python/']

const args = process.argv.slice(2)
const update = args.includes('--update')

function countFindings(rule) {
  let stdout = '[]'
  try {
    stdout = execFileSync(
      'uv',
      ['run', 'ruff', 'check', '.', '--select', rule, '--output-format', 'json'],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    ).toString()
  } catch (err) {
    // ruff exits 1 when findings exist; the JSON report is on stdout
    if (err.status !== 1 || !err.stdout) throw err
    stdout = err.stdout.toString()
  }
  const findings = JSON.parse(stdout)
  const rel = (f) => f.filename.startsWith('/') ? f.filename.replace(ROOT, '') : f.filename
  return findings.filter((f) => !EXCLUDES.some((e) => rel(f).startsWith(e))).length
}

const current = {}
for (const rule of RULES.split(',')) {
  current[rule] = countFindings(rule)
}

if (update || !existsSync(BASELINE_PATH)) {
  writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + '\n')
  console.log('Baseline written:', JSON.stringify(current))
  process.exit(0)
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
let failed = false
console.log('Python correctness ratchet (ruff, excluding submodules + generated SDK)')
console.log('  rule   baseline  current')
for (const [rule, base] of Object.entries(baseline)) {
  const now = current[rule] ?? 0
  const mark = now > base ? '  <- REGRESSION' : ''
  console.log(`  ${rule}  ${String(base).padStart(6)}  ${String(now).padStart(6)}${mark}`)
  if (now > base) failed = true
}
if (failed) {
  console.log('\nFix the new findings, or re-pin after an intentional change:')
  console.log('  node scripts/ci/python-ruff-audit.mjs -- --update')
  process.exit(1)
}
console.log('\nOK: no new findings beyond baseline.')
