#!/usr/bin/env node
/**
 * Version-drift audit — duplicate-version ratchet.
 *
 * A pnpm install can legitimately resolve the same package to several
 * versions, but every extra version is a distinct copy shipped in
 * node_modules: bigger installs, slower CI, and behavior differences across
 * module boundaries. Nothing noticed when drift accumulated.
 *
 * This audit parses pnpm-lock.yaml, counts the distinct versions resolved per
 * package, and fails when a package's version count GROWS beyond the pinned
 * baseline. Consolidation (count shrinking) is reported as an improvement.
 *
 * Usage:
 *   pnpm lint:version-drift             # audit and enforce the ratchet
 *   pnpm lint:version-drift -- --update  # re-pin after an intentional change
 *
 * Exit codes: 0 = no new drift, 1 = version multiplicity grew.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { parse } from 'yaml'

const ROOT = resolve(import.meta.dirname, '../..')
const LOCKFILE = resolve(ROOT, 'pnpm-lock.yaml')
const BASELINE_PATH = resolve(import.meta.dirname, 'version-drift-baseline.json')

function countVersions() {
  const lock = parse(readFileSync(LOCKFILE, 'utf8'))
  /** @type {Map<string, Set<string>>} name -> versions */
  const versions = new Map()
  for (const key of Object.keys(lock.packages ?? {})) {
    // Keys look like `name@version` or `@scope/name@version`, with optional
    // peer-suffixes in parens.
    const base = key.replace(/\([^)]*\)$/, '')
    const at = base.lastIndexOf('@')
    if (at <= 0) continue
    const name = base.slice(0, at)
    const version = base.slice(at + 1)
    const set = versions.get(name) ?? new Set()
    set.add(version)
    versions.set(name, set)
  }
  /** @type {Record<string, string[]>} only packages with more than one version */
  const drifted = {}
  for (const [name, set] of versions) {
    if (set.size > 1) drifted[name] = [...set].sort()
  }
  return drifted
}

function main() {
  const args = process.argv.slice(2)
  const update = args.includes('--update')

  if (!existsSync(LOCKFILE)) {
    console.error(`No lockfile at ${LOCKFILE}.`)
    process.exit(1)
  }
  const drifted = countVersions()
  const names = Object.keys(drifted).sort()

  console.log('\n══════════════════════════════════════════════')
  console.log('  Version-drift audit (duplicate versions)')
  console.log('══════════════════════════════════════════════\n')
  console.log(`  Packages resolved to multiple versions: ${names.length}\n`)
  const shown = names.slice(0, 20)
  for (const name of shown) console.log(`  ${name.padEnd(42)} ${drifted[name].length} versions`)
  if (names.length > shown.length) console.log(`  ... and ${names.length - shown.length} more`)

  if (update) {
    writeFileSync(
      BASELINE_PATH,
      `${JSON.stringify(
        {
          $schema: 'Version-drift ratchet for scripts/ci/version-drift-audit.mjs',
          description:
            'Distinct-version count per package in pnpm-lock.yaml (only packages ' +
            'with >1 version). The gate fails when a package resolves to MORE ' +
            'versions than pinned. Consolidations re-pin via ' +
            '`pnpm lint:version-drift -- --update`.',
          generatedAt: new Date().toISOString(),
          versionCounts: Object.fromEntries(names.map((n) => [n, drifted[n].length])),
        },
        null,
        2,
      )}\n`,
      'utf8',
    )
    console.log(`\nBaseline written to ${BASELINE_PATH}`)
    return
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error(`No baseline at ${BASELINE_PATH}. Run with --update first.`)
    process.exit(1)
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).versionCounts ?? {}

  /** @type {string[]} */
  const regressions = []
  /** @type {string[]} */
  const improvements = []
  for (const name of names) {
    const pinned = baseline[name]
    if (pinned === undefined) regressions.push(`${name}: NEW multi-version package (${drifted[name].length} versions: ${drifted[name].join(', ')})`)
    else if (drifted[name].length > pinned) regressions.push(`${name}: version count grew ${pinned} → ${drifted[name].length}`)
    else if (drifted[name].length < pinned) improvements.push(`${name}: version count shrank ${pinned} → ${drifted[name].length}`)
  }
  for (const name of Object.keys(baseline)) {
    if (!(name in drifted)) improvements.push(`${name}: consolidated back to a single version`)
  }

  if (improvements.length > 0) {
    console.log('\n  Improvements since baseline:')
    for (const i of improvements) console.log(`    - ${i}`)
  }

  if (regressions.length > 0) {
    console.error(`\n❌ ${regressions.length} version-drift regression(s):`)
    for (const r of regressions) console.error(`  - ${r}`)
    console.error(
      '\nEach duplicate version is a separate copy in node_modules. Consolidate ' +
        'via pnpm overrides, or — if unavoidable — re-pin with ' +
        '`pnpm lint:version-drift -- --update`.',
    )
    process.exit(1)
  }
  console.log('\n✅ No new version drift.')
}

main()
