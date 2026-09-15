#!/usr/bin/env node
/**
 * Module boundary ratchet — dependency-cruiser baseline enforcement.
 *
 * `dependency-cruiser` reports every architectural violation in the repo. On a
 * codebase this size there is always existing debt, so a hard fail would block
 * all work. Instead we pin the current per-rule counts in
 * `scripts/ci/boundaries-baseline.json` and this script fails when a count
 * *grows*. That makes structural debt visible and prevents new violations,
 * while letting teams pay the debt down over time.
 *
 * Usage:
 *   pnpm lint:boundaries            # check against the baseline (CI gate)
 *   pnpm lint:boundaries -- --update  # rewrite the baseline after intentional changes
 *
 * Exit codes: 0 = at or below baseline, 1 = a rule regressed above baseline.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const BASELINE_PATH = resolve(import.meta.dirname, 'boundaries-baseline.json')
const CONFIG = resolve(ROOT, '.dependency-cruiser.cjs')
const TARGET = 'apps/web/src'

/** Run dependency-cruiser and return per-rule violation counts. */
function collectViolations() {
  const stdout = execFileSync(
    'pnpm',
    ['exec', 'depcruise', '--config', CONFIG, '--output-type', 'json', TARGET],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 },
  )

  const result = JSON.parse(stdout)
  /** @type {Record<string, number>} */
  const counts = {}
  for (const violation of result.summary?.violations ?? []) {
    const rule = violation.rule?.name ?? 'unknown'
    counts[rule] = (counts[rule] ?? 0) + 1
  }
  return { counts, summary: result.summary ?? {} }
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
}

/** @param {Record<string, number>} counts */
function writeBaseline(counts) {
  const report = {
    $schema: 'Boundary violation baseline for .dependency-cruiser.cjs',
    description:
      'Per-rule dependency-cruiser violation counts. Lower is better. The ' +
      'audit fails when a rule regresses above its pinned count; update with ' +
      '`pnpm lint:boundaries -- --update` only after intentionally changing ' +
      'the architecture.',
    generatedAt: new Date().toISOString(),
    target: TARGET,
    rules: Object.fromEntries(
      Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
    ),
  }
  writeFileSync(BASELINE_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(`Boundary baseline written to ${BASELINE_PATH}`)
}

function main() {
  const update = process.argv.slice(2).includes('--update')

  console.log('Cruising module boundaries with dependency-cruiser...')
  const { counts, summary } = collectViolations()

  console.log(
    `  Cruised ${summary.totalCruised ?? '?'} modules, ` +
      `${summary.totalDependenciesCruised ?? '?'} dependencies.`,
  )

  if (update) {
    writeBaseline(counts)
    for (const [rule, count] of Object.entries(counts)) {
      console.log(`  ${rule}: ${count}`)
    }
    return
  }

  const baseline = loadBaseline()
  if (!baseline) {
    console.error(
      'No baseline found at scripts/ci/boundaries-baseline.json. ' +
        'Run `pnpm lint:boundaries -- --update` to create it.',
    )
    process.exit(1)
  }

  /** @type {string[]} */
  const regressions = []
  const allRules = new Set([...Object.keys(counts), ...Object.keys(baseline.rules)])

  for (const rule of [...allRules].sort()) {
    const actual = counts[rule] ?? 0
    const pinned = baseline.rules[rule] ?? 0
    const delta = actual - pinned
    if (delta > 0) {
      regressions.push(`  ❌ ${rule}: ${actual} (baseline ${pinned}, +${delta})`)
    } else if (delta < 0) {
      console.log(
        `  ✅ ${rule}: ${actual} (baseline ${pinned}, improved by ${-delta})`,
      )
    } else {
      console.log(`  ✅ ${rule}: ${actual} (at baseline)`)
    }
  }

  if (regressions.length > 0) {
    console.error('\nModule boundary regressions detected:\n')
    console.error(regressions.join('\n'))
    console.error(
      '\nFix the new violation (see .dependency-cruiser.cjs for each rule) or, ' +
        'if intentional, re-pin with `pnpm lint:boundaries -- --update`.',
    )
    process.exit(1)
  }

  console.log('\n✅ No module boundary regressions.')
}

main()
