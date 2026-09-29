#!/usr/bin/env node
/**
 * Duplicate-code (DRY) ratchet — jscpd baseline enforcement.
 *
 * Runs jscpd as configured in .jscpd.json over the app source and compares the
 * duplicated-line percentage against a pinned baseline in
 * scripts/ci/duplication-baseline.json. This makes copy-paste visible and stops
 * new duplication from accumulating, without forcing a big-bang refactor of
 * pre-existing clones.
 *
 * Usage:
 *   pnpm lint:duplication               # check against baseline (CI gate)
 *   pnpm lint:duplication -- --update   # re-pin after intentional changes
 *
 * Exit codes: 0 = at or below baseline (within tolerance), 1 = regression.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const BASELINE_PATH = resolve(import.meta.dirname, 'duplication-baseline.json')
const REPORT_PATH = resolve(ROOT, '.jscpd-report/jscpd-report.json')
// Allow a small absolute drift so run-to-run/tool-version noise does not flap CI.
const TOLERANCE_PERCENT = 0.1

/**
 * Run jscpd and return its summary statistics.
 * @returns {{percentage: number, duplicatedLines: number, totalLines: number, clones: number}}
 */
function runJscpd() {
  execFileSync('pnpm', ['exec', 'jscpd', '--config', resolve(ROOT, '.jscpd.json')], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  })

  if (!existsSync(REPORT_PATH)) {
    throw new Error(
      `jscpd did not produce a report at ${REPORT_PATH}. Check .jscpd.json.`,
    )
  }

  const report = JSON.parse(readFileSync(REPORT_PATH, 'utf8'))
  const stats = report.statistics ?? {}
  const total = stats.total ?? {}
  return {
    percentage: Number(total.percentage ?? 0),
    duplicatedLines: Number(total.duplicatedLines ?? total.duplicated_lines ?? 0),
    totalLines: Number(total.lines ?? 0),
    clones: Number(total.clones ?? 0),
  }
}

function main() {
  const update = process.argv.slice(2).includes('--update')

  console.log('Scanning for duplicate code with jscpd...')
  const current = runJscpd()
  console.log(
    `  ${current.clones} clones, ${current.duplicatedLines} duplicated lines, ` +
      `${current.percentage.toFixed(2)}% duplication.`,
  )

  if (update) {
    const baseline = {
      $schema: 'Duplicated-code baseline for .jscpd.json',
      description:
        'Pinned jscpd duplication percentage. The audit fails when the current ' +
        'percentage exceeds this value plus a small tolerance. Lower is better; ' +
        're-pin with `pnpm lint:duplication -- --update`.',
      generatedAt: new Date().toISOString(),
      minLines: 20,
      minTokens: 100,
      percentage: Number(current.percentage.toFixed(2)),
      duplicatedLines: current.duplicatedLines,
      totalLines: current.totalLines,
      clones: current.clones,
    }
    writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
    console.log(`Duplication baseline written to ${BASELINE_PATH}`)
    return
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error(
      'No baseline found at scripts/ci/duplication-baseline.json. ' +
        'Run `pnpm lint:duplication -- --update` to create it.',
    )
    process.exit(1)
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  const allowed = Number(baseline.percentage) + TOLERANCE_PERCENT

  console.log(
    `  Baseline ${Number(baseline.percentage).toFixed(2)}% ` +
      `(+${TOLERANCE_PERCENT}% tolerance = ${allowed.toFixed(2)}% allowed).`,
  )

  if (current.percentage > allowed) {
    console.error(
      `\n❌ Duplication regressed: ${current.percentage.toFixed(2)}% > ` +
        `${allowed.toFixed(2)}% allowed.\n` +
        'Remove the new duplicate code (extract a shared helper) or, if the ' +
        'duplication is intentional, re-pin with ' +
        '`pnpm lint:duplication -- --update`.',
    )
    process.exit(1)
  }

  console.log('\n✅ Duplication within baseline.')
}

main()
