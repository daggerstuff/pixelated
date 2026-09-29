#!/usr/bin/env node
/**
 * Build-performance tracker — measures and monitors production build time.
 *
 * Why this exists
 * ---------------
 * Build duration is the single biggest contributor to CI wall-clock time, but
 * nothing noticed it when it grew. This tracker times `pnpm build` (the same
 * command CI and developers run) and:
 *   - writes `.build-perf/summary.json` (machine-readable, for trend tooling),
 *   - writes `.build-perf/summary.md`  (GitHub Actions step summary),
 *   - enforces a regression gate against a pinned baseline.
 *
 * What is gated, and why
 * ----------------------
 * Wall-clock build time only, with a generous tolerance (×1.25) plus an
 * absolute floor, because build times vary with CI runner contention. The gate
 * exists to catch material regressions — a new heavy dependency, an accidental
 * bundle explosion, a plugin misconfiguration — not to police a few seconds.
 *
 * Usage:
 *   pnpm build:perf                  # run the build, report, enforce the gate
 *   pnpm build:perf -- --update      # re-pin the baseline after a deliberate change
 *   pnpm build:perf -- --no-run      # analyze the existing .build-perf/summary.json
 *
 * Exit codes: 0 = within budget, 1 = regression above the pinned budget, 2 =
 * build itself failed.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const OUT_DIR = resolve(ROOT, '.build-perf')
const SUMMARY_JSON = resolve(OUT_DIR, 'summary.json')
const SUMMARY_MD = resolve(OUT_DIR, 'summary.md')
const BASELINE_PATH = resolve(import.meta.dirname, 'build-perf-baseline.json')

/** Multiplier applied to the baseline to form the gate. */
const TOLERANCE = 1.25
/** Absolute floor so a tiny baseline cannot produce a hair-trigger gate. */
const MIN_BUDGET_MS = 60_000

function runBuild() {
  mkdirSync(OUT_DIR, { recursive: true })
  console.log('Running pnpm build and timing it...\n')
  const started = Date.now()
  const result = spawnSync('pnpm', ['build'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, CI: 'true' },
  })
  const buildMs = Date.now() - started
  if (result.status !== 0) {
    console.error(`\nBuild failed (exit ${result.status}); duration ${buildMs}ms not recorded.`)
    process.exit(2)
  }
  const summary = {
    command: 'pnpm build',
    buildMs,
    measuredAt: new Date().toISOString(),
    node: process.version,
  }
  writeFileSync(SUMMARY_JSON, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  return summary
}

function main() {
  const args = process.argv.slice(2)
  const update = args.includes('--update')
  const noRun = args.includes('--no-run')

  const summary = noRun
    ? existsSync(SUMMARY_JSON)
      ? JSON.parse(readFileSync(SUMMARY_JSON, 'utf8'))
      : null
    : runBuild()

  if (!summary) {
    console.error(`No build summary at ${SUMMARY_JSON}. Run without --no-run first.`)
    process.exit(1)
  }

  const baseline = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    : null

  console.log('\n══════════════════════════════════════════════')
  console.log('  Build performance gate')
  console.log('══════════════════════════════════════════════\n')
  console.log(`  Command:   ${summary.command}`)
  console.log(`  Duration:  ${(summary.buildMs / 1000).toFixed(1)}s`)

  if (update) {
    const pinned = {
      $schema: 'Build-time ratchet for scripts/ci/build-perf-tracker.mjs',
      description:
        'Wall-clock duration of `pnpm build`. The gate fails when a build takes ' +
        'more than 1.25× the pinned value (or the absolute floor, whichever is ' +
        'larger). Re-pin after a deliberate build-time change with ' +
        '`pnpm build:perf -- --update`.',
      generatedAt: new Date().toISOString(),
      command: 'pnpm build',
      buildMs: summary.buildMs,
    }
    writeFileSync(BASELINE_PATH, `${JSON.stringify(pinned, null, 2)}\n`, 'utf8')
    console.log(`\nBaseline written to ${BASELINE_PATH}`)
    return
  }

  if (!baseline?.buildMs) {
    console.error(`No baseline at ${BASELINE_PATH}. Run with --update first.`)
    process.exit(1)
  }

  const budgetMs = Math.max(baseline.buildMs * TOLERANCE, MIN_BUDGET_MS)
  const ok = summary.buildMs <= budgetMs
  console.log(`  Budget:    ${(budgetMs / 1000).toFixed(1)}s (baseline ${(baseline.buildMs / 1000).toFixed(1)}s × ${TOLERANCE})`)
  console.log(`  ${ok ? '✅ Within the pinned budget.' : '❌ Build slower than the pinned budget.'}\n`)

  const summaryMd = [
    '## Build performance gate',
    '',
    `| Command | Duration | Budget | Baseline |`,
    `| --- | --- | --- | --- |`,
    `| \`${summary.command}\` | ${(summary.buildMs / 1000).toFixed(1)}s | ${(budgetMs / 1000).toFixed(1)}s | ${(baseline.buildMs / 1000).toFixed(1)}s |`,
    '',
    ok
      ? '✅ Build within the pinned budget.'
      : '❌ Build slower than the pinned budget — investigate before re-pinning.',
    '',
  ].join('\n')
  writeFileSync(SUMMARY_MD, `${summaryMd}\n`, 'utf8')

  if (!ok) {
    console.error(
      '\n❌ Build-time regression. Find the cause (new dependency, bundle growth, ' +
        'plugin change) or — after a deliberate change — re-pin with ' +
        '`pnpm build:perf -- --update`.',
    )
    process.exit(1)
  }
}

main()
