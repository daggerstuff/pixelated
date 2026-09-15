#!/usr/bin/env node
/**
 * Test-performance tracker — measures and monitors test suite duration.
 *
 * Why this exists
 * ---------------
 * A slow test suite is invisible until it blocks a release. This tracker runs a
 * hermetic, dependency-free slice of the Vitest suite with the JSON reporter and
 * turns the raw timings into:
 *   - a console table of the slowest files and individual tests,
 *   - `.test-perf/summary.json` (machine-readable, for trend tooling),
 *   - `.test-perf/summary.md`   (pasted into the GitHub Actions step summary),
 *   - a regression gate against a pinned baseline.
 *
 * What is gated, and why
 * ----------------------
 * Only *parallelism-independent* metrics are gated:
 *   - the slowest single test (`maxTestMs`), and
 *   - total test CPU time (`totalTestMs`, the sum of per-test durations).
 * Wall-clock suite time is reported but deliberately not gated, because CI runs
 * the suite at `maxWorkers: 1` while local runs use 8 — the same suite has very
 * different wall times on the same commit. Per-test durations are stable across
 * both, so they catch real regressions (a new heavy dependency, an accidental
 * `sleep`, a quadratic loop) without flapping on worker-count differences.
 *
 * Scope
 * -----
 * The full Vitest corpus is not hermetic (it needs Redis/Mongo/Auth0 and hangs
 * in CI — see .github/workflows/ci.yml). This tracker therefore runs a bounded
 * slice of pure unit-test directories that run anywhere.
 *
 * Usage:
 *   pnpm test:perf                  # run the slice, report, enforce the gate
 *   pnpm test:perf -- --update      # re-pin the baseline after a deliberate change
 *   pnpm test:perf -- --no-run      # analyze the existing .test-perf/vitest-report.json
 *
 * Exit codes: 0 = within budget, 1 = regression above the pinned budget.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const OUT_DIR = resolve(ROOT, '.test-perf')
const RAW_REPORT = resolve(OUT_DIR, 'vitest-report.json')
const SUMMARY_JSON = resolve(OUT_DIR, 'summary.json')
const SUMMARY_MD = resolve(OUT_DIR, 'summary.md')
const BASELINE_PATH = resolve(import.meta.dirname, 'test-perf-baseline.json')

/**
 * Hermetic slice of pure unit-test directories. Chosen because they run without
 * Redis/Mongo/Auth0 and cover the heaviest pure-JS work (image processing,
 * logging, audit chains).
 */
const PERF_TEST_TARGETS = [
  'apps/web/src/lib/db',
  'apps/web/src/lib/logging',
  'apps/web/src/lib/audit',
  'apps/web/src/lib/utils',
]

/** Multipliers applied to the baseline to form the gate. Generous on purpose:
 *  tests are noisy under CI contention, so only material regressions trip it. */
const TOTAL_TOLERANCE = 1.5
const MAX_TEST_TOLERANCE = 2.0
/** Absolute floor so a tiny baseline cannot produce a hair-trigger gate. */
const MIN_TOTAL_BUDGET_MS = 20_000
const MIN_MAX_TEST_BUDGET_MS = 10_000

function runVitest() {
  mkdirSync(OUT_DIR, { recursive: true })
  console.log('Running test-performance slice with the JSON reporter...')
  console.log(`  Targets: ${PERF_TEST_TARGETS.join(', ')}`)
  try {
    execFileSync(
      resolve(ROOT, 'node_modules/.bin/vitest'),
      [
        'run',
        '-c',
        'config/vitest.config.ts',
        ...PERF_TEST_TARGETS,
        '--coverage.enabled=false',
        '--reporter=json',
        `--outputFile=${RAW_REPORT}`,
      ],
      { cwd: ROOT, encoding: 'utf8', stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test' } },
    )
  } catch (error) {
    // A failing test is a separate signal (CI runs the test suite elsewhere).
    // Here we only care about timings, so warn but continue if a report exists.
    if (!existsSync(RAW_REPORT)) throw error
    console.warn('⚠️  Vitest reported failures; continuing with the timing report.')
  }
}

/** @returns {{files: Array<{path: string, ms: number, tests: number}>, tests: Array<{name: string, file: string, ms: number}>, totals: {fileCount: number, testCount: number, failedTests: number, totalTestMs: number, maxTestMs: number, wallClockMs: number}}} */
function analyze() {
  const report = JSON.parse(readFileSync(RAW_REPORT, 'utf8'))
  const results = report.testResults ?? []

  /** @type {Array<{path: string, ms: number, tests: number}>} */
  const files = []
  /** @type {Array<{name: string, file: string, ms: number}>} */
  const tests = []
  let earliestStart = Number.POSITIVE_INFINITY
  let latestEnd = 0

  for (const file of results) {
    const rel = String(file.name).replace(`${ROOT}/`, '')
    const start = Number(file.startTime ?? 0)
    const end = Number(file.endTime ?? 0)
    const fileMs = Number.isFinite(end - start) && end >= start ? end - start : 0
    const assertions = file.assertionResults ?? []
    files.push({ path: rel, ms: Math.round(fileMs), tests: assertions.length })

    if (start > 0) earliestStart = Math.min(earliestStart, start)
    if (end > 0) latestEnd = Math.max(latestEnd, end)

    for (const assertion of assertions) {
      tests.push({
        name: assertion.fullName ?? assertion.title ?? '(unnamed)',
        file: rel,
        ms: Math.round(Number(assertion.duration ?? 0)),
      })
    }
  }

  // Count per-test failures. `testResults[].status` is file-level; only
  // `assertionResults[].status` is per-test.
  const failedTests = results.reduce(
    (sum, file) =>
      sum + (file.assertionResults ?? []).filter((a) => a.status === 'failed').length,
    0,
  )

  const totalTestMs = tests.reduce((sum, t) => sum + t.ms, 0)
  const maxTestMs = tests.reduce((max, t) => Math.max(max, t.ms), 0)
  const wallClockMs =
    Number.isFinite(earliestStart) && latestEnd > earliestStart
      ? Math.round(latestEnd - earliestStart)
      : 0

  files.sort((a, b) => b.ms - a.ms)
  tests.sort((a, b) => b.ms - a.ms)

  return {
    files,
    tests,
    totals: {
      fileCount: files.length,
      testCount: tests.length,
      failedTests,
      totalTestMs,
      maxTestMs,
      wallClockMs,
    },
  }
}

/** @param {ReturnType<typeof analyze>} analysis */
function budgetFor(analysis) {
  const baseline = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    : null
  const baseTotal = Math.max(
    Number(baseline?.baseline?.totalTestMs ?? analysis.totals.totalTestMs),
    MIN_TOTAL_BUDGET_MS,
  )
  const baseMax = Math.max(
    Number(baseline?.baseline?.maxTestMs ?? analysis.totals.maxTestMs),
    MIN_MAX_TEST_BUDGET_MS,
  )
  return {
    baseline,
    totalBudgetMs: Math.round(baseTotal * TOTAL_TOLERANCE),
    maxTestBudgetMs: Math.round(baseMax * MAX_TEST_TOLERANCE),
  }
}

/** @param {ReturnType<typeof analyze>} analysis */
function renderConsole(analysis, budget) {
  console.log('\n══════════════════════════════════════════════')
  console.log('  Test Performance Report')
  console.log('══════════════════════════════════════════════\n')
  console.log(`  Files:            ${analysis.totals.fileCount}`)
  console.log(`  Tests:            ${analysis.totals.testCount} (${analysis.totals.failedTests} failed)`)
  console.log(`  Total test time:  ${(analysis.totals.totalTestMs / 1000).toFixed(2)}s`)
  console.log(`  Slowest test:     ${(analysis.totals.maxTestMs / 1000).toFixed(2)}s`)
  console.log(`  Wall clock:       ${(analysis.totals.wallClockMs / 1000).toFixed(2)}s (informational)`)
  console.log(
    `  Budgets:          total ≤ ${(budget.totalBudgetMs / 1000).toFixed(1)}s, ` +
      `slowest test ≤ ${(budget.maxTestBudgetMs / 1000).toFixed(1)}s`,
  )

  console.log('\n────────────────── Slowest files ──────────────────\n')
  console.table(
    analysis.files.slice(0, 10).map((f) => ({
      File: f.path,
      'Time (s)': (f.ms / 1000).toFixed(2),
      Tests: f.tests,
    })),
  )

  console.log('\n────────────────── Slowest tests ──────────────────\n')
  console.table(
    analysis.tests.slice(0, 10).map((t) => ({
      Test: t.name.length > 70 ? `${t.name.slice(0, 67)}...` : t.name,
      'Time (s)': (t.ms / 1000).toFixed(2),
    })),
  )
}

/** @param {ReturnType<typeof analyze>} analysis */
function renderMarkdown(analysis, budget, regressions) {
  const lines = [
    '## Test performance',
    '',
    '| Metric | Value | Budget |',
    '| --- | --- | --- |',
    `| Tests | ${analysis.totals.testCount} | — |`,
    `| Total test time | ${(analysis.totals.totalTestMs / 1000).toFixed(2)}s | ≤ ${(budget.totalBudgetMs / 1000).toFixed(1)}s |`,
    `| Slowest single test | ${(analysis.totals.maxTestMs / 1000).toFixed(2)}s | ≤ ${(budget.maxTestBudgetMs / 1000).toFixed(1)}s |`,
    `| Wall clock (informational) | ${(analysis.totals.wallClockMs / 1000).toFixed(2)}s | — |`,
    '',
  ]

  lines.push('### Slowest tests', '', '| Test | Time (s) |', '| --- | --- |')
  for (const t of analysis.tests.slice(0, 10)) {
    const name = t.name.replaceAll('|', '\\|')
    lines.push(`| ${name.length > 80 ? `${name.slice(0, 77)}...` : name} | ${(t.ms / 1000).toFixed(2)} |`)
  }
  lines.push('')

  if (regressions.length > 0) {
    lines.push('### ❌ Regressions', '')
    for (const r of regressions) lines.push(`- ${r}`)
    lines.push('')
  } else {
    lines.push('✅ Within the pinned test-performance budget.', '')
  }

  return `${lines.join('\n')}\n`
}

function main() {
  const args = process.argv.slice(2)
  const update = args.includes('--update')
  const noRun = args.includes('--no-run')

  if (!noRun) {
    runVitest()
  } else if (!existsSync(RAW_REPORT)) {
    console.error(`No report at ${RAW_REPORT}. Run without --no-run first.`)
    process.exit(1)
  }

  const analysis = analyze()
  const budget = budgetFor(analysis)
  renderConsole(analysis, budget)

  const summary = {
    timestamp: new Date().toISOString(),
    tool: 'test-perf-tracker',
    targets: PERF_TEST_TARGETS,
    totals: analysis.totals,
    budgets: { totalBudgetMs: budget.totalBudgetMs, maxTestBudgetMs: budget.maxTestBudgetMs },
    slowestFiles: analysis.files.slice(0, 20),
    slowestTests: analysis.tests.slice(0, 20),
  }
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(SUMMARY_JSON, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')

  if (update) {
    const baseline = {
      $schema: 'Test-performance baseline for scripts/ci/test-perf-tracker.mjs',
      description:
        'Pinned test-duration metrics for the hermetic perf slice. The gate ' +
        'allows totalTestMs * 1.5 and maxTestMs * 2.0. Re-pin with ' +
        '`pnpm test:perf -- --update` after an intentional change.',
      generatedAt: new Date().toISOString(),
      targets: PERF_TEST_TARGETS,
      tolerances: { totalTestMs: TOTAL_TOLERANCE, maxTestMs: MAX_TEST_TOLERANCE },
      baseline: {
        totalTestMs: analysis.totals.totalTestMs,
        maxTestMs: analysis.totals.maxTestMs,
        wallClockMs: analysis.totals.wallClockMs,
        testCount: analysis.totals.testCount,
      },
    }
    writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
    writeFileSync(SUMMARY_MD, renderMarkdown(analysis, budget, []), 'utf8')
    console.log(`\nTest-performance baseline written to ${BASELINE_PATH}`)
    return
  }

  /** @type {string[]} */
  const regressions = []
  if (analysis.totals.totalTestMs > budget.totalBudgetMs) {
    regressions.push(
      `Total test time ${(analysis.totals.totalTestMs / 1000).toFixed(2)}s exceeds the ` +
        `${(budget.totalBudgetMs / 1000).toFixed(2)}s budget.`,
    )
  }
  if (analysis.totals.maxTestMs > budget.maxTestBudgetMs) {
    regressions.push(
      `Slowest test ${(analysis.totals.maxTestMs / 1000).toFixed(2)}s exceeds the ` +
        `${(budget.maxTestBudgetMs / 1000).toFixed(2)}s budget.`,
    )
  }

  writeFileSync(SUMMARY_MD, renderMarkdown(analysis, budget, regressions), 'utf8')
  console.log(`\nReports written to ${OUT_DIR}/ (summary.json, summary.md)`)

  if (regressions.length > 0) {
    console.error('\n❌ Test-performance regressions detected:\n')
    for (const r of regressions) console.error(`  - ${r}`)
    console.error(
      '\nProfile the slow test and reduce its cost (fewer fixtures, smaller ' +
        'inputs, mocked I/O), or re-pin with `pnpm test:perf -- --update` if the ' +
        'increase is intentional.',
    )
    process.exit(1)
  }

  console.log('\n✅ Test performance within budget.')
}

main()
