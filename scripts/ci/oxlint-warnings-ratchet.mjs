#!/usr/bin/env node
/**
 * Oxlint warning ratchet.
 *
 * lint-chunked.sh fails the build on errors but exits 0 on warnings, so the
 * type-aware rules had no gate at all: no-unsafe-assignment, no-unsafe-call,
 * no-unsafe-argument, unbound-method and no-unnecessary-type-assertion account
 * for most of the warning surface. They cannot be mass-swept, because oxlint
 * emits no fix suggestion for any of them and resolving no-unsafe-* means
 * typing several hundred files. This pins the total so the debt stops growing.
 *
 * Fixes shrink the baseline naturally; only re-pin intentionally:
 *   node scripts/ci/oxlint-warnings-ratchet.mjs -- --update
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const ROOT = new URL('../..', import.meta.url).pathname
const BASELINE_PATH = new URL('./oxlint-warnings-baseline.json', import.meta.url).pathname
const OXLINT = './node_modules/.bin/oxlint'
const CONFIG = './.oxlintrc.json'
const BATCH_SIZE = 200

const update = process.argv.slice(2).includes('--update')

function run(args) {
  try {
    return execFileSync(OXLINT, args, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    })
  } catch (err) {
    if (!err.stdout) throw err
    return err.stdout.toString()
  }
}

function parseReport(output) {
  const start = output.indexOf('{')
  const end = output.lastIndexOf('}')
  if (start === -1 || end === -1) return { diagnostics: [] }
  return JSON.parse(output.slice(start, end + 1))
}

const files = run(['-c', CONFIG, '--debug=files', '.'])
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)

if (files.length === 0) {
  console.log('No lint targets found.')
  process.exit(0)
}

const byRule = {}
let warnings = 0
let errors = 0

for (let index = 0; index < files.length; index += BATCH_SIZE) {
  const batch = files.slice(index, index + BATCH_SIZE)
  const report = parseReport(run(['-c', CONFIG, '--format=json', ...batch]))
  for (const diagnostic of report.diagnostics ?? []) {
    if (diagnostic.severity === 'error') {
      errors += 1
      continue
    }
    warnings += 1
    const code = diagnostic.code ?? 'unknown'
    byRule[code] = (byRule[code] ?? 0) + 1
  }
}

if (errors > 0) {
  console.log(`oxlint reported ${errors} error(s); run scripts/ci/lint-chunked.sh for detail.`)
  process.exit(1)
}

if (update || !existsSync(BASELINE_PATH)) {
  const ordered = Object.fromEntries(
    Object.entries(byRule).sort(([a], [b]) => a.localeCompare(b)),
  )
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify({ total: warnings, rules: ordered }, null, 2) + '\n',
  )
  console.log(`Baseline written: ${warnings} warnings across ${Object.keys(ordered).length} rules`)
  process.exit(0)
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
const baseTotal = baseline.total ?? 0
const grown = []
for (const [rule, count] of Object.entries(byRule)) {
  const pinned = baseline.rules?.[rule] ?? 0
  if (count > pinned) grown.push([rule, pinned, count])
}

console.log('oxlint warning ratchet')
console.log(`  warnings  baseline ${baseTotal}  current ${warnings}`)

for (const [rule, pinned] of Object.entries(baseline.rules ?? {})) {
  const now = byRule[rule] ?? 0
  if (now < pinned) console.log(`  shrunk  ${rule}  ${pinned} -> ${now} (re-pin to bank it)`)
}

if (warnings > baseTotal || grown.length > 0) {
  console.log('')
  for (const [rule, pinned, now] of grown.sort((a, b) => b[2] - b[1] - (a[2] - a[1]))) {
    console.log(`  GREW  ${rule}  ${pinned} -> ${now}`)
  }
  console.log('\nFix the new warnings, or re-pin after an intentional change:')
  console.log('  node scripts/ci/oxlint-warnings-ratchet.mjs -- --update')
  process.exit(1)
}

console.log('\nOK: no rule grew past its pinned count.')
