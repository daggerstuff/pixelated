#!/usr/bin/env node
/**
 * Cyclomatic-complexity ratchet — oxlint complexity baseline enforcement.
 *
 * Runs oxlint with `.oxlintrc.complexity.json` (complexity / max-depth /
 * max-lines-per-function / max-lines) over the source tree and pins the
 * per-rule diagnostic counts in `scripts/ci/complexity-baseline.json`. The
 * audit fails when a rule's count grows, so high-complexity functions and
 * oversized units become visible and cannot proliferate while existing ones are
 * refactored down.
 *
 * Usage:
 *   pnpm lint:complexity               # check against baseline (CI gate)
 *   pnpm lint:complexity -- --update   # re-pin after intentional changes
 *
 * Exit codes: 0 = at or below baseline, 1 = a rule regressed above baseline.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const BASELINE_PATH = resolve(import.meta.dirname, 'complexity-baseline.json')
const CONFIG = resolve(ROOT, '.oxlintrc.complexity.json')
const TARGETS = ['apps/web/src', 'agents', 'packages']

/** @returns {Record<string, number>} */
function collectCounts() {
  let stdout = ''
  try {
    stdout = execFileSync(
      resolve(ROOT, 'node_modules/.bin/oxlint'),
      ['-c', CONFIG, '--format', 'json', ...TARGETS],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
    )
  } catch (error) {
    // oxlint exits non-zero when it finds warnings; the JSON is still on stdout.
    stdout = /** @type {{stdout?: string}} */ (error).stdout ?? ''
    const stderr = /** @type {{stderr?: string}} */ (error).stderr ?? ''
    if (!stdout || !stdout.trimStart().startsWith('{')) {
      throw new Error(
        `oxlint did not return JSON. stderr: ${stderr.slice(0, 2000)}`,
      )
    }
  }

  const result = JSON.parse(stdout)
  /** @type {Record<string, number>} */
  const counts = {}
  for (const diagnostic of result.diagnostics ?? []) {
    const code = diagnostic.code ?? 'unknown'
    counts[code] = (counts[code] ?? 0) + 1
  }
  return counts
}

/** @param {Record<string, number>} counts */
function writeBaseline(counts) {
  const sorted = Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
  )
  const baseline = {
    $schema: 'Complexity baseline for .oxlintrc.complexity.json',
    description:
      'Per-rule oxlint complexity diagnostic counts. The audit fails when a ' +
      'rule regresses above this count; re-pin with ' +
      '`pnpm lint:complexity -- --update` only after intentional changes.',
    generatedAt: new Date().toISOString(),
    thresholds: {
      complexity: 20,
      'max-depth': 4,
      'max-lines-per-function': 120,
      'max-lines': 800,
    },
    rules: sorted,
  }
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
  console.log(`Complexity baseline written to ${BASELINE_PATH}`)
}

function main() {
  const update = process.argv.slice(2).includes('--update')

  console.log('Analyzing complexity with oxlint...')
  const counts = collectCounts()

  if (update) {
    writeBaseline(counts)
    for (const [rule, count] of Object.entries(counts)) {
      console.log(`  ${rule}: ${count}`)
    }
    return
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error(
      'No baseline found at scripts/ci/complexity-baseline.json. ' +
        'Run `pnpm lint:complexity -- --update` to create it.',
    )
    process.exit(1)
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  /** @type {string[]} */
  const regressions = []
  const allRules = new Set([
    ...Object.keys(counts),
    ...Object.keys(baseline.rules ?? {}),
  ])

  for (const rule of [...allRules].sort()) {
    const actual = counts[rule] ?? 0
    const pinned = baseline.rules?.[rule] ?? 0
    const delta = actual - pinned
    if (delta > 0) {
      regressions.push(`  ❌ ${rule}: ${actual} (baseline ${pinned}, +${delta})`)
    } else if (delta < 0) {
      console.log(`  ✅ ${rule}: ${actual} (baseline ${pinned}, improved by ${-delta})`)
    } else {
      console.log(`  ✅ ${rule}: ${actual} (at baseline)`)
    }
  }

  if (regressions.length > 0) {
    console.error('\nComplexity regressions detected:\n')
    console.error(regressions.join('\n'))
    console.error(
      '\nReduce the complexity (extract a helper or flatten nesting) or, if ' +
        'intentional, re-pin with `pnpm lint:complexity -- --update`.',
    )
    process.exit(1)
  }

  console.log('\n✅ No complexity regressions.')
}

main()
