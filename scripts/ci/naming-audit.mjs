#!/usr/bin/env node
/**
 * Naming-convention ratchet — TypeScript/TSX naming enforcement.
 *
 * Runs ESLint with `.eslintrc.naming.mjs` over the TS/TSX source and pins the
 * per-file violation counts in `scripts/ci/naming-baseline.json`. The audit
 * fails when a file gains new naming violations, so the documented convention
 * (camelCase values/functions/params, PascalCase types, UPPER_CASE constants;
 * see AGENTS.md §3) is enforced for all new code while pre-existing snake_case
 * debt is burned down over time.
 *
 * Python naming is enforced separately by ruff's `N` (pep8-naming) rules,
 * which are already enabled in pyproject.toml.
 *
 * Usage:
 *   pnpm lint:naming               # check against baseline (CI gate)
 *   pnpm lint:naming -- --update   # re-pin after intentional changes
 *
 * Exit codes: 0 = at or below baseline, 1 = a regression above baseline.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const BASELINE_PATH = resolve(import.meta.dirname, 'naming-baseline.json')
const CONFIG = resolve(ROOT, '.eslintrc.naming.mjs')

const GLOBS = [
  'apps/web/src/**/*.ts',
  'apps/web/src/**/*.tsx',
  'agents/**/*.ts',
  'packages/**/*.ts',
]

/** @returns {Record<string, number>} */
function collectViolations() {
  let stdout = ''
  try {
    stdout = execFileSync(
      resolve(ROOT, 'node_modules/.bin/eslint'),
      ['--config', CONFIG, '--no-config-lookup', '--format', 'json', ...GLOBS],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 },
    )
  } catch (error) {
    // ESLint exits non-zero when violations are found; JSON is still on stdout.
    const err = /** @type {{stdout?: string, stderr?: string}} */ (error)
    stdout = err.stdout ?? ''
    if (!stdout.trimStart().startsWith('[')) {
      throw new Error(`ESLint did not return JSON: ${(err.stderr ?? '').slice(0, 2000)}`)
    }
  }

  const results = JSON.parse(stdout)
  /** @type {Record<string, number>} */
  const counts = {}
  for (const file of results) {
    const violations = (file.messages ?? []).filter((m) =>
      /naming-convention/.test(m.ruleId ?? ''),
    ).length
    if (violations === 0) continue
    counts[file.filePath.replace(`${ROOT}/`, '')] = violations
  }
  return counts
}

/** @param {Record<string, number>} counts */
function writeBaseline(counts) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
  const baseline = {
    $schema: 'Naming-convention baseline for .eslintrc.naming.mjs',
    description:
      'Per-file @typescript-eslint/naming-convention violation counts. The ' +
      'audit fails when a file regresses above its pinned count. Re-pin with ' +
      '`pnpm lint:naming -- --update` only after intentional changes.',
    generatedAt: new Date().toISOString(),
    total,
    files: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))),
  }
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
  console.log(`Naming baseline written to ${BASELINE_PATH} (${total} violations pinned)`)
}

function main() {
  const update = process.argv.slice(2).includes('--update')

  console.log('Checking naming conventions with ESLint...')
  const counts = collectViolations()

  if (update) {
    writeBaseline(counts)
    return
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error(
      'No baseline found at scripts/ci/naming-baseline.json. ' +
        'Run `pnpm lint:naming -- --update` to create it.',
    )
    process.exit(1)
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  const pinned = baseline.files ?? {}

  /** @type {string[]} */
  const regressions = []
  let improved = 0

  for (const [file, actual] of Object.entries(counts)) {
    const allowed = pinned[file] ?? 0
    if (actual > allowed) {
      regressions.push(`  ❌ ${file}: ${actual} (baseline ${allowed}, +${actual - allowed})`)
    }
  }
  for (const [file, allowed] of Object.entries(pinned)) {
    const actual = counts[file] ?? 0
    if (actual < allowed) improved += actual - allowed === 0 ? 0 : allowed - actual
  }

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
  console.log(`  ${total} naming violations across ${Object.keys(counts).length} files.`)
  if (improved > 0) console.log(`  ✅ ${improved} violation(s) resolved vs baseline.`)

  if (regressions.length > 0) {
    console.error('\nNaming-convention regressions detected:\n')
    console.error(regressions.join('\n'))
    console.error(
      '\nRename to camelCase / PascalCase / UPPER_CASE per AGENTS.md, or ' +
        're-pin with `pnpm lint:naming -- --update` if intentional.',
    )
    process.exit(1)
  }

  console.log('\n✅ No naming-convention regressions.')
}

main()
