#!/usr/bin/env node
/**
 * Unused-dependency audit — knip ratchet.
 *
 * Why a ratchet
 * -------------
 * knip already flags unused dependencies, but the report at baseline contains
 * ~130 entries, many of which are false positives (tools used from scripts,
 * configs, or transitive expectations knip cannot see: `esbuild`, `lint-staged`,
 * node built-in polyfills, ...). Auditing them by hand is guesswork; deleting
 * the wrong one breaks the build.
 *
 * So the gate is a ratchet: the baseline pins every entry knip reports today,
 * and CI fails only when a NEW unused dependency appears. Entries that
 * disappear are reported as improvements and re-pinned with --update.
 *
 * Usage:
 *   pnpm lint:unused-deps             # run knip, compare against the baseline
 *   pnpm lint:unused-deps -- --update  # re-pin after cleanup
 *
 * Exit codes: 0 = no new unused dependencies, 1 = new entries appeared.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const OUT_DIR = resolve(ROOT, '.deps-audit')
const BASELINE_PATH = resolve(import.meta.dirname, 'unused-deps-baseline.json')

function runKnip() {
  mkdirSync(OUT_DIR, { recursive: true })
  const result = spawnSync(
    resolve(ROOT, 'node_modules/.bin/knip'),
    ['--dependencies', '--reporter', 'json'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  const stdout = result.stdout ?? ''
  const start = stdout.indexOf('{"issues"')
  if (start === -1) {
    console.error('knip produced no JSON dependency report. Raw output:')
    console.error(stdout.slice(0, 2000))
    process.exit(1)
  }
  // knip wraps the array: {"issues":[...]}. Trailing plugins may append noise,
  // so locate the end of the JSON document rather than parsing to EOF.
  let depth = 0
  let end = -1
  for (let i = start; i < stdout.length; i++) {
    const ch = stdout[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        end = i + 1
        break
      }
    }
  }
  if (end === -1) {
    console.error('knip report JSON is truncated.')
    process.exit(1)
  }
  return JSON.parse(stdout.slice(start, end)).issues ?? []
}

/** Normalize knip's report to a sorted list of `file :: kind :: name` keys. */
function collectEntries(report) {
  /** @type {Set<string>} */
  const entries = new Set()
  for (const file of report) {
    for (const kind of ['dependencies', 'devDependencies', 'optionalPeerDependencies', 'unlisted', 'unresolved']) {
      for (const item of file[kind] ?? []) entries.add(`${file.file} :: ${kind} :: ${item.name}`)
    }
  }
  return [...entries].sort()
}

function main() {
  const args = process.argv.slice(2)
  const update = args.includes('--update')

  console.log('Running knip dependency analysis...')
  const entries = collectEntries(runKnip())

  const baseline = existsSync(BASELINE_PATH)
    ? new Set(JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).entries)
    : null

  if (update) {
    writeFileSync(
      BASELINE_PATH,
      `${JSON.stringify(
        {
          $schema: 'Unused-dependency ratchet for scripts/ci/unused-deps-audit.mjs',
          description:
            'Unused dependencies knip reports. The gate fails when a NEW entry ' +
            'appears that is not pinned here. Cleanup shrinks this list via ' +
            '`pnpm lint:unused-deps -- --update`.',
          generatedAt: new Date().toISOString(),
          entries,
        },
        null,
        2,
      )}\n`,
      'utf8',
    )
    console.log(`Baseline re-pinned: ${entries.length} entries.`)
    return
  }

  if (!baseline) {
    console.error(`No baseline at ${BASELINE_PATH}. Run with --update first.`)
    process.exit(1)
  }

  const added = entries.filter((e) => !baseline.has(e))
  const removed = [...baseline].filter((e) => !entries.includes(e))

  console.log('\n══════════════════════════════════════════════')
  console.log('  Unused-dependency audit (knip ratchet)')
  console.log('══════════════════════════════════════════════\n')
  console.log(`  Pinned entries:   ${baseline.size}`)
  console.log(`  Currently found: ${entries.length}`)
  if (removed.length > 0) {
    console.log(`  Cleaned up:       ${removed.length}`)
    for (const r of removed) console.log(`    - ${r}`)
  }

  if (added.length > 0) {
    console.error(`\n❌ ${added.length} NEW unused dependenc${added.length === 1 ? 'y' : 'ies'}:`)
    for (const a of added) console.error(`  - ${a}`)
    console.error(
      '\nEither use the dependency, remove it, or — for known false ' +
        'positives — re-pin with `pnpm lint:unused-deps -- --update`.',
    )
    process.exit(1)
  }
  console.log('\n✅ No new unused dependencies.')
}

main()
