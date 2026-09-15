#!/usr/bin/env node
/**
 * Flaky-test detection.
 *
 * A flaky test is one whose outcome changes between identical runs of the
 * same code. Flakes erode trust: people re-run until green, and real failures
 * get dismissed as "just flaky". This audit runs the hermetic slice several
 * times and fails when any test — or any file — reports different outcomes
 * across those runs.
 *
 * Repeated identical runs are the only reliable way to see a flake; a single
 * run, however green, proves nothing.
 *
 * Usage:
 *   pnpm test:flaky                 # 3 runs, report, enforce the gate
 *   pnpm test:flaky -- --runs=5    # more runs for a suspected flake
 *   pnpm test:flaky -- --update    # pin current flakes as tolerated
 *   pnpm test:flaky -- --no-run    # re-analyze the existing reports
 *
 * Exit codes: 0 = no new flakes, 1 = a test changed outcome across runs.
 *
 * A test that fails in *every* run is broken, not flaky — reported, but not
 * gated here, because pass/fail of the suite is the main test job's signal.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  HERMETIC_TEST_TARGETS,
  ROOT,
  readTestOutcomes,
  runVitestJson,
} from './hermetic-slice.mjs'

const OUT_DIR = resolve(ROOT, '.test-reliability')
const BASELINE_PATH = resolve(import.meta.dirname, 'flaky-baseline.json')

function reportPath(runIndex) {
  return resolve(OUT_DIR, `flaky-run-${runIndex}.json`)
}

/** Collect outcome maps: key -> { kind, name, file, statuses[] } across runs. */
function collectRuns(runCount) {
  /** @type {Map<string, {kind: string, name: string, file: string, statuses: string[]}>} */
  const outcomes = new Map()
  const seen = []

  for (let i = 0; i < runCount; i++) {
    const path = reportPath(i)
    if (!existsSync(path)) continue
    const { tests, files } = readTestOutcomes(path)
    seen.push(i)

    for (const t of tests) {
      const key = `${t.file} :: ${t.name}`
      if (!outcomes.has(key)) {
        outcomes.set(key, { kind: 'test', name: t.name, file: t.file, statuses: [] })
      }
      outcomes.get(key).statuses.push(t.status)
    }
    for (const f of files) {
      const key = `file :: ${f.file}`
      if (!outcomes.has(key)) {
        outcomes.set(key, { kind: 'file', name: f.file, file: f.file, statuses: [] })
      }
      outcomes.get(key).statuses.push(f.status)
    }
  }
  return { outcomes, seen }
}

function main() {
  const args = process.argv.slice(2)
  const update = args.includes('--update')
  const noRun = args.includes('--no-run')
  const runsArg = args.find((a) => a.startsWith('--runs='))
  const runCount = Math.max(2, Number(runsArg?.slice('--runs='.length) ?? 3))

  if (!noRun) {
    for (let i = 0; i < runCount; i++) {
      console.log(`\n━━━ flaky audit: run ${i + 1}/${runCount} ━━━`)
      const code = runVitestJson(reportPath(i))
      if (code !== 0) {
        console.warn(`⚠️  run ${i + 1} exited ${code}; failures are recorded for comparison`)
      }
    }
  }

  const { outcomes, seen } = collectRuns(runCount)
  if (seen.length < 2) {
    console.error(`Need at least 2 run reports to compare (found ${seen.length}).`)
    process.exit(1)
  }

  /** @type {Array<{kind: string, name: string, file: string, statuses: string[]}>} */
  const flaky = []
  /** @type {Array<{kind: string, name: string, file: string, statuses: string[]}>} */
  const broken = []
  for (const entry of outcomes.values()) {
    const distinct = new Set(entry.statuses)
    if (distinct.size > 1) flaky.push(entry)
    else if (entry.statuses[0] === 'failed') broken.push(entry)
  }
  flaky.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name))
  broken.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name))

  /** Stable key used both for the tolerance list and the gate comparison. */
  const entryKey = (entry) =>
    entry.kind === 'file' ? `file :: ${entry.file}` : `${entry.file} :: ${entry.name}`

  console.log('\n══════════════════════════════════════════════')
  console.log('  Flaky-test audit')
  console.log('══════════════════════════════════════════════\n')
  console.log(`  Runs compared:     ${seen.length}`)
  console.log(`  Targets:           ${HERMETIC_TEST_TARGETS.join(', ')}`)
  console.log(
    `  Tests compared:    ${[...outcomes.values()].filter((o) => o.kind === 'test').length}`,
  )
  console.log(`  Flaky:             ${flaky.length}`)
  console.log(`  Broken (all runs): ${broken.length}`)

  if (flaky.length > 0) {
    console.log('\n────────────── Outcome changed between runs ──────────────\n')
    for (const f of flaky) {
      console.log(`  ❌ ${f.kind}: ${f.name}`)
      console.log(`     ${f.file}`)
      console.log(`     statuses: [${f.statuses.join(', ')}]`)
    }
  }

  if (broken.length > 0) {
    console.log('\n──── Broken in every run (not flaky — the suite is red) ────\n')
    for (const b of broken) console.log(`  ⛔ ${b.kind}: ${b.name}  (${b.file})`)
  }

  const baseline = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    : { tolerated: [] }
  const tolerated = new Set(baseline.tolerated ?? [])

  if (update) {
    const pinned = {
      $schema: 'Flaky-test tolerance list for scripts/ci/flaky-test-audit.mjs',
      description:
        'Tests whose outcomes are known to vary between runs. The gate fails ' +
        'on any flaky test NOT listed here. Adding an entry means deciding a ' +
        'flake is tolerable; prefer fixing the test. Re-pin with ' +
        '`pnpm test:flaky -- --update`.',
      generatedAt: new Date().toISOString(),
      tolerated: flaky.map(entryKey),
    }
    writeFileSync(BASELINE_PATH, `${JSON.stringify(pinned, null, 2)}\n`, 'utf8')
    console.log(
      `\nTolerance list written to ${BASELINE_PATH} (${pinned.tolerated.length} entries).`,
    )
    return
  }

  const newFlakes = flaky.filter((entry) => !tolerated.has(entryKey(entry)))

  if (newFlakes.length > 0) {
    console.error(`\n❌ ${newFlakes.length} flaky outcome(s) not in the tolerance list.`)
    console.error('   Fix the test (seed randomness, stub timers, isolate state), or —')
    console.error('   if genuinely tolerable — record it with `pnpm test:flaky -- --update`.')
    process.exit(1)
  }

  console.log('\n✅ No flaky tests detected.')
}

main()
