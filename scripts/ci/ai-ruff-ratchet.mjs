#!/usr/bin/env node
/**
 * Style ratchet for the ai submodule (ruff).
 *
 * The submodule carries ~12.6k style findings that no gate covers. Most are
 * deliberate and documented per rule: line length inside composed prompt
 * strings, print() as the CLI output interface, lazy torch/transformers
 * imports, assertEqual because numpy comparisons break under plain assert.
 * None of that can be mass-swept, but nothing stopped the count from growing
 * either. This pins the per-rule count and fails CI when a rule grows.
 *
 * Fixes shrink the baseline naturally; only re-pin intentionally:
 *   node scripts/ci/ai-ruff-ratchet.mjs -- --update
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const ROOT = new URL('../..', import.meta.url).pathname
const BASELINE_PATH = new URL('./ai-ruff-baseline.json', import.meta.url).pathname
const LOCK_PATH = new URL('../../ai/uv.lock', import.meta.url).pathname
const TARGET = 'ai/'

const update = process.argv.slice(2).includes('--update')

/**
 * Read ruff's version out of the lockfile, so the gate runs the same ruff a
 * developer runs without resolving the project environment for a lint pass.
 */
function pinnedRuffVersion() {
  try {
    const lock = readFileSync(LOCK_PATH, 'utf8')
    return lock.match(/^name = "ruff"\nversion = "([^"]+)"/m)?.[1] ?? null
  } catch {
    return null
  }
}

function countByRule() {
  const version = pinnedRuffVersion()
  const args = version
    ? [
        'run',
        '--no-project',
        '--with',
        `ruff==${version}`,
        '--',
        'ruff',
        'check',
        TARGET,
        '--output-format',
        'json',
        '--no-cache',
      ]
    : ['run', 'ruff', 'check', TARGET, '--output-format', 'json', '--no-cache']
  let stdout
  try {
    stdout = execFileSync('uv', args, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    }).toString()
  } catch (err) {
    // ruff exits 1 when findings exist; the JSON report is still on stdout
    if (err.status !== 1 || !err.stdout) throw err
    stdout = err.stdout.toString()
  }
  const byRule = {}
  const filesByRule = {}
  for (const finding of JSON.parse(stdout)) {
    const rule = finding.code ?? 'unknown'
    byRule[rule] = (byRule[rule] ?? 0) + 1
    const file = finding.filename.replace(ROOT, '')
    if (!filesByRule[rule]) filesByRule[rule] = []
    if (filesByRule[rule].length < 5 && !filesByRule[rule].includes(file)) {
      filesByRule[rule].push(file)
    }
  }
  return { byRule, filesByRule }
}

const { byRule: current, filesByRule } = countByRule()
const total = Object.values(current).reduce((sum, n) => sum + n, 0)

if (update || !existsSync(BASELINE_PATH)) {
  const ordered = Object.fromEntries(
    Object.entries(current).sort(([a], [b]) => a.localeCompare(b)),
  )
  writeFileSync(BASELINE_PATH, JSON.stringify(ordered, null, 2) + '\n')
  console.log(`Baseline written: ${Object.keys(ordered).length} rules, ${total} findings`)
  process.exit(0)
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
const baseTotal = Object.values(baseline).reduce((sum, n) => sum + n, 0)

const grown = []
for (const [rule, count] of Object.entries(current)) {
  const pinned = baseline[rule] ?? 0
  if (count > pinned) grown.push([rule, pinned, count])
}

console.log('ai ruff style ratchet')
console.log(`  findings  baseline ${baseTotal}  current ${total}`)

for (const [rule, pinned] of Object.entries(baseline)) {
  const now = current[rule] ?? 0
  if (now < pinned) console.log(`  shrunk  ${rule}  ${pinned} -> ${now} (re-pin to bank it)`)
}

if (grown.length > 0) {
  console.log('')
  for (const [rule, pinned, now] of grown.sort((a, b) => b[2] - b[1] - (a[2] - a[1]))) {
    console.log(`  GREW  ${rule}  ${pinned} -> ${now}`)
    for (const file of filesByRule[rule] ?? []) console.log(`          ${file}`)
  }
  console.log('\nFix the new findings, or re-pin after an intentional change:')
  console.log('  node scripts/ci/ai-ruff-ratchet.mjs -- --update')
  process.exit(1)
}

console.log('\nOK: no rule grew past its pinned count.')
