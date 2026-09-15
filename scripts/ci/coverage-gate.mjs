#!/usr/bin/env node
/**
 * Coverage gate.
 *
 * Enforces, in CI, that coverage of the hermetic test slice does not regress.
 *
 * Why a ratchet and not the config thresholds
 * ------------------------------------------
 * `config/vitest.config.ts` sets global thresholds (55/55/45/55) tuned for a
 * FULL test run (~60% measured). The full corpus is not hermetic — it needs
 * Redis/Mongo/Auth0 and hangs in CI — so those thresholds were never enforced
 * anywhere: CI sets `VITEST_COVERAGE_ENABLED: false` and skips coverage
 * entirely, and until the coverage-provider version was fixed (see below)
 * coverage could not even be collected. The config thresholds are left in
 * place for full runs.
 *
 * This gate enforces a no-regression floor over the hermetic slice instead:
 * each metric must stay within 5% of its pinned baseline and above an
 * absolute floor, so coverage cannot silently erode, and improvements re-pin
 * upward naturally.
 *
 * Coverage was silently broken before: @vitest/coverage-v8 was at 5.x while
 * vitest was at 4.x, and every coverage run aborted with
 * "AssertionError: coverageFilesDirectory is required" while still printing
 * 0% tables. The two packages must stay on the same major.
 *
 * Usage:
 *   pnpm test:coverage:gate             # run, report, enforce
 *   pnpm test:coverage:gate -- --update # re-pin after an intentional change
 *   pnpm test:coverage:gate -- --no-run # analyze the existing coverage-summary.json
 *
 * Exit codes: 0 = within budget, 1 = regression below the pinned budget.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  HERMETIC_COVERAGE_INCLUDES,
  HERMETIC_TEST_TARGETS,
  ROOT,
  runVitest,
} from './hermetic-slice.mjs'

const COVERAGE_SUMMARY = resolve(ROOT, 'coverage/coverage-summary.json')
const OUT_DIR = resolve(ROOT, '.test-reliability')
const BASELINE_PATH = resolve(import.meta.dirname, 'coverage-baseline.json')

const METRICS = ['lines', 'statements', 'functions', 'branches']
/** Relative slack below the baseline, so deterministic-but-noisy counters do
 *  not flap across Node/OS versions. */
const TOLERANCE = 0.05

function runCoverage() {
  return runVitest([
    'run',
    '-c',
    'config/vitest.config.ts',
    ...HERMETIC_TEST_TARGETS,
    // Neutralize the config's full-run thresholds here; this gate enforces its
    // own slice-scoped budget below instead.
    '--coverage.enabled',
    '--coverage.reporter=json-summary',
    '--coverage.reporter=text',
    ...HERMETIC_COVERAGE_INCLUDES,
    '--coverage.thresholds.lines=0',
    '--coverage.thresholds.statements=0',
    '--coverage.thresholds.functions=0',
    '--coverage.thresholds.branches=0',
    '--bail=0',
  ])
}

/** @returns {Record<string, number>} percentage per metric */
function readCoverage() {
  const summary = JSON.parse(readFileSync(COVERAGE_SUMMARY, 'utf8'))
  const total = summary.total ?? {}
  /** @type {Record<string, number>} */
  const pct = {}
  for (const metric of METRICS) pct[metric] = Number(total[metric]?.pct ?? 0)
  return pct
}

/** Per-directory lines coverage, for the report table. */
function readPerDirectory() {
  const summary = JSON.parse(readFileSync(COVERAGE_SUMMARY, 'utf8'))
  /** @type {Map<string, {lines: number, covered: number, files: number}>} */
  const dirs = new Map()
  for (const [file, entry] of Object.entries(summary)) {
    if (file === 'total') continue
    const match = file.match(/apps\/web\/src\/lib\/([a-z]+)\//)
    const dir = match ? match[1] : '(other)'
    const acc = dirs.get(dir) ?? { lines: 0, covered: 0, files: 0 }
    acc.lines += Number(entry.lines?.total ?? 0)
    acc.covered += Number(entry.lines?.covered ?? 0)
    acc.files += 1
    dirs.set(dir, acc)
  }
  return [...dirs.entries()]
    .map(([dir, acc]) => ({
      dir,
      files: acc.files,
      pct: acc.lines > 0 ? Math.round((acc.covered / acc.lines) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.pct - a.pct)
}

function main() {
  const args = process.argv.slice(2)
  const update = args.includes('--update')
  const noRun = args.includes('--no-run')

  if (!noRun) {
    console.log('\n━━━ coverage gate: run with coverage ━━━')
    const code = runCoverage()
    if (code !== 0 && !existsSync(COVERAGE_SUMMARY)) {
      console.error(`Coverage run failed (exit ${code}) and no summary was produced.`)
      process.exit(1)
    }
  }
  if (!existsSync(COVERAGE_SUMMARY)) {
    console.error(`No coverage summary at ${COVERAGE_SUMMARY}.`)
    process.exit(1)
  }

  const current = readCoverage()
  const baseline = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    : null
  const perDirectory = readPerDirectory()

  console.log('\n══════════════════════════════════════════════')
  console.log('  Coverage gate (hermetic slice)')
  console.log('══════════════════════════════════════════════\n')
  console.log(`  Scope: ${HERMETIC_TEST_TARGETS.join(', ')}\n`)

  if (update) {
    // Floors keep a downward re-pin from gutting the gate later.
    const floors = {}
    for (const metric of METRICS) {
      floors[metric] = Math.floor((current[metric] * 0.75) / 5) * 5
    }
    const pinned = {
      $schema: 'Coverage ratchet for scripts/ci/coverage-gate.mjs',
      description:
        'Per-metric coverage of the hermetic slice. The gate fails when a ' +
        'metric drops more than 5% below its pinned value, or below its ' +
        'absolute floor. Re-pin upward after adding tests with ' +
        '`pnpm test:coverage:gate -- --update`. The global thresholds in ' +
        'config/vitest.config.ts target full (non-hermetic) runs.',
      generatedAt: new Date().toISOString(),
      scope: HERMETIC_TEST_TARGETS,
      coverage: { ...current },
      floors,
    }
    writeFileSync(BASELINE_PATH, `${JSON.stringify(pinned, null, 2)}\n`, 'utf8')
    console.log(`Coverage baseline written to ${BASELINE_PATH}`)
    return
  }

  if (!baseline?.coverage) {
    console.error(`No baseline at ${BASELINE_PATH}. Run with --update first.`)
    process.exit(1)
  }

  /** @type {string[]} */
  const regressions = []
  console.log('  Metric      Current   Budget    Floor')
  console.log('  ─────────   ───────   ──────    ─────')
  for (const metric of METRICS) {
    const pinned = Number(baseline.coverage[metric] ?? 0)
    const floor = Number(baseline.floors?.[metric] ?? 0)
    const budget = Math.round(pinned * (1 - TOLERANCE) * 100) / 100
    const ok = current[metric] >= budget && current[metric] >= floor
    console.log(
      `  ${metric.padEnd(11)} ${String(current[metric]).padEnd(9)} ` +
        `${String(budget).padEnd(9)} ${String(floor).padEnd(9)} ${ok ? '✅' : '❌'}`,
    )
    if (!ok) {
      regressions.push(
        `${metric}: ${current[metric]}% is below the ${(budget)}% budget ` +
          `(floor ${floor}%, pinned ${pinned}%).`,
      )
    }
  }

  console.log('\n──────────────── Per-directory lines ────────────────\n')
  for (const d of perDirectory) {
    console.log(`  ${d.dir.padEnd(10)} ${String(d.pct).padStart(6)}%  (${d.files} files)`)
  }

  const summaryMd = [
    '## Coverage gate (hermetic slice)',
    '',
    '| Metric | Current | Budget | Floor |',
    '| --- | --- | --- | --- |',
    ...METRICS.map(
      (m) =>
        `| ${m} | ${current[m]}% | ${Math.round((baseline.coverage[m] ?? 0) * (1 - TOLERANCE) * 100) / 100}% | ${baseline.floors?.[m] ?? 0}% |`,
    ),
    '',
    'Per-directory lines coverage:',
    '',
    '| Directory | Lines | Files |',
    '| --- | --- | --- |',
    ...perDirectory.map((d) => `| ${d.dir} | ${d.pct}% | ${d.files} |`),
    '',
    regressions.length
      ? '### ❌ Coverage regressions\n' + regressions.map((r) => `- ${r}`).join('\n')
      : '✅ Coverage within the pinned budget.',
    '',
  ].join('\n')
  writeFileSync(resolve(OUT_DIR, 'coverage-summary.md'), `${summaryMd}\n`, 'utf8')

  if (regressions.length > 0) {
    console.error('\n❌ Coverage regressions detected:\n')
    for (const r of regressions) console.error(`  - ${r}`)
    console.error(
      '\nAdd tests for the affected code, or — after an intentional change — ' +
        're-pin with `pnpm test:coverage:gate -- --update`.',
    )
    process.exit(1)
  }

  console.log('\n✅ Coverage within the pinned budget.')
}

main()
