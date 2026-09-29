#!/usr/bin/env node
/**
 * Test-isolation audit.
 *
 * Isolation means a test's outcome depends only on the code under test and
 * the fixtures it sets up — not on which tests ran before it. Order
 * dependence hides real bugs: a suite can pass in CI's fixed order while the
 * same tests fail (or falsely pass) in any other order.
 *
 * This audit enforces isolation behaviorally and structurally:
 *
 * 1. Behavioral: run the hermetic slice twice — once in vitest's default
 *    order and once with `--sequence.shuffle` — and compare per-test and
 *    per-file outcomes. Anything that passes one way and fails the other
 *    depends on execution order.
 * 2. Structural: verify the runner config keeps per-file process isolation
 *    (`isolate: true` with the forks pool), which is the mechanism that
 *    prevents module and jsdom state leaking between files.
 *
 * Usage:
 *   pnpm test:isolation              # run both passes, report, enforce
 *   pnpm test:isolation -- --no-run # re-analyze the existing reports
 *
 * Exit codes: 0 = isolated, 1 = order-dependent outcomes or config regression.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  HERMETIC_TEST_TARGETS,
  ROOT,
  readTestOutcomes,
  runVitestJson,
} from './hermetic-slice.mjs'

const OUT_DIR = resolve(ROOT, '.test-reliability')
const ORDERED_REPORT = resolve(OUT_DIR, 'isolation-ordered.json')
const SHUFFLED_REPORT = resolve(OUT_DIR, 'isolation-shuffled.json')
// The single source of truth is the ROOT config; config/vitest.config.ts is
// only a re-export (kept for the documented `-c config/...` invocation), so
// source-text checks must read the root file.
const VITEST_CONFIG = resolve(ROOT, 'vitest.config.ts')

/** Structural check: the runner must keep per-file isolation. */
function checkRunnerIsolation() {
  const config = readFileSync(VITEST_CONFIG, 'utf8')
  const problems = []
  if (!/pool:\s*'forks'/.test(config)) {
    problems.push('test pool is not `forks` (per-file process isolation)')
  }
  const isolateMatches = config.match(/isolate:\s*true/g)
  if (!isolateMatches || isolateMatches.length < 2) {
    problems.push(
      '`isolate: true` missing from the project-level test configs ' +
        '(module/jsdom state would leak between files)',
    )
  }
  return problems
}

function outcomeMap(reportPath) {
  const { tests, files } = readTestOutcomes(reportPath)
  /** @type {Map<string, string>} */
  const map = new Map()
  for (const t of tests) map.set(`${t.file} :: ${t.name}`, t.status)
  for (const f of files) map.set(`file :: ${f.file}`, f.status)
  return map
}

function main() {
  const args = process.argv.slice(2)
  const noRun = args.includes('--no-run')

  const structuralProblems = checkRunnerIsolation()

  if (!noRun) {
    console.log('\n━━━ isolation audit: default order ━━━')
    const orderedCode = runVitestJson(ORDERED_REPORT)
    if (orderedCode !== 0) {
      console.warn(`⚠️  ordered run exited ${orderedCode}; failures recorded for comparison`)
    }
    console.log('\n━━━ isolation audit: shuffled order ━━━')
    const shuffledCode = runVitestJson(SHUFFLED_REPORT, ['--sequence.shuffle'])
    if (shuffledCode !== 0) {
      console.warn(`⚠️  shuffled run exited ${shuffledCode}; failures recorded for comparison`)
    }
  }

  for (const path of [ORDERED_REPORT, SHUFFLED_REPORT]) {
    if (!existsSync(path)) {
      console.error(`Missing report at ${path}. Run without --no-run first.`)
      process.exit(1)
    }
  }

  const ordered = outcomeMap(ORDERED_REPORT)
  const shuffled = outcomeMap(SHUFFLED_REPORT)

  /** @type {Array<{key: string, ordered: string, shuffled: string}>} */
  const orderDependent = []
  /** @type {Array<{key: string, ordered: string, shuffled: string}>} */
  const brokenInBoth = []
  for (const [key, orderedStatus] of ordered) {
    const shuffledStatus = shuffled.get(key)
    if (shuffledStatus === undefined) continue
    if (orderedStatus === shuffledStatus) {
      if (orderedStatus === 'failed') brokenInBoth.push({ key, ordered: orderedStatus, shuffled: shuffledStatus })
      continue
    }
    orderDependent.push({ key, ordered: orderedStatus, shuffled: shuffledStatus })
  }

  console.log('\n══════════════════════════════════════════════')
  console.log('  Test-isolation audit')
  console.log('══════════════════════════════════════════════\n')
  console.log(`  Targets:            ${HERMETIC_TEST_TARGETS.join(', ')}`)
  console.log(`  Outcomes compared:  ${ordered.size}`)
  console.log(`  Order-dependent:    ${orderDependent.length}`)
  console.log(`  Broken in both:     ${brokenInBoth.length}`)

  if (orderDependent.length > 0) {
    console.log('\n────────── Outcome differs between orders ──────────\n')
    for (const o of orderDependent) {
      console.log(`  ❌ ${o.key}`)
      console.log(`     ordered: ${o.ordered} → shuffled: ${o.shuffled}`)
    }
  }

  if (brokenInBoth.length > 0) {
    console.log('\n──── Broken in both orders (not order-dependent) ────\n')
    for (const b of brokenInBoth) console.log(`  ⛔ ${b.key}`)
  }

  const structuralFailures = structuralProblems.length > 0
  if (structuralFailures) {
    console.log('\n────────────── Runner-config regressions ──────────────\n')
    for (const p of structuralProblems) console.log(`  ❌ ${p}`)
  }

  if (structuralFailures) {
    console.error(
      '\n❌ The runner no longer isolates test files. Restore per-file ' +
        'isolation before this can pass (see vitest.config.ts).',
    )
    process.exit(1)
  }
  if (orderDependent.length > 0) {
    console.error(
      '\n❌ Order-dependent outcomes found. These tests rely on execution ' +
        'order or on state left by other tests. Make each test set up its own ' +
        'fixtures and clean up in afterEach/afterAll.',
    )
    process.exit(1)
  }

  console.log('\n✅ Tests are isolated: no outcome depends on execution order.')
}

main()
