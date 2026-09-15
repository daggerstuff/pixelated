#!/usr/bin/env node
/**
 * Dead-feature-flag audit.
 *
 * A feature flag that nothing reads is dead config: it ships as an env var and
 * a registry entry but gates no behavior. This audit fails when:
 *   - a NEW flag is added to the registry with zero references (born dead), or
 *   - a flag that was referenced at baseline time loses all its references.
 *
 * Flags that are declared but not yet consumed anywhere can be marked as
 * "staged" in the baseline, which lets work land in two steps (registry +
 * consumer) without disabling the audit; a staged flag that gains references
 * flips to "live" on the next --update.
 *
 * Usage:
 *   node scripts/ci/flag-audit.mjs            # audit and enforce
 *   node scripts/ci/flag-audit.mjs --update   # re-pin the baseline
 *
 * Exit codes: 0 = no dead flags, 1 = dead flags found.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { globSync } from 'glob'

const ROOT = resolve(import.meta.dirname, '../..')
const FLAGS_PATH = resolve(ROOT, 'apps/web/src/lib/config/feature-flags.ts')
const BASELINE_PATH = resolve(import.meta.dirname, 'flag-baseline.json')
const SEARCH_ROOT = resolve(ROOT, 'apps/web/src')

function sourceFiles() {
  return globSync('apps/web/src/**/*.{ts,tsx,astro}', {
    cwd: ROOT,
    ignore: ['**/*.test.*', 'apps/web/src/lib/config/feature-flags.ts'],
  })
}

/** Registry keys are the property names in FEATURE_FLAG_REGISTRY. */
function registryFlagNames() {
  const source = readFileSync(FLAGS_PATH, 'utf8')
  const start = source.indexOf('FEATURE_FLAG_REGISTRY = {')
  if (start === -1) throw new Error('FEATURE_FLAG_REGISTRY not found in feature-flags.ts')
  const body = source.slice(start, source.indexOf('\n}', start))
  /** @type {string[]} */
  const names = []
  for (const line of body.split('\n')) {
    const match = line.match(/^\s{2}([a-zA-Z][a-zA-Z0-9]*):\s*{/)
    if (match) names.push(match[1])
  }
  if (names.length === 0) throw new Error('No flag entries found in FEATURE_FLAG_REGISTRY')
  return names
}

/**
 * Count production references to a flag: direct evaluation calls and
 * config.features.<name> access. Test files and the registry itself do not count.
 */
function countReferences(name, files) {
  const patterns = [
    `isFeatureEnabled('${name}')`,
    `isFeatureEnabled("${name}")`,
    `resolveFeatureFlag('${name}'`,
    `features.${name}`,
  ]
  let count = 0
  for (const file of files) {
    const source = readFileSync(resolve(ROOT, file), 'utf8')
    if (patterns.some((p) => source.includes(p))) count += 1
  }
  return count
}

function main() {
  const args = process.argv.slice(2)
  const update = args.includes('--update')

  const names = registryFlagNames()
  const files = sourceFiles()
  /** @type {Record<string, {references: number}>} */
  const current = {}
  for (const name of names) current[name] = { references: countReferences(name, files) }

  console.log('\n══════════════════════════════════════════════')
  console.log('  Dead-feature-flag audit')
  console.log('══════════════════════════════════════════════\n')
  for (const name of names) {
    const refs = current[name].references
    console.log(`  ${name.padEnd(22)} ${refs === 0 ? 'staged (no references)' : `live (${refs} reference${refs === 1 ? '' : 's'})`}`)
  }

  if (update) {
    writeFileSync(
      BASELINE_PATH,
      `${JSON.stringify(
        {
          $schema: 'Feature-flag liveness ratchet for scripts/ci/flag-audit.mjs',
          description:
            'Reference counts per registry flag. The gate fails when a new flag ' +
            'has zero references, or when a live flag (references > 0 at pin ' +
            'time) loses all references. Staged flags (0 references) must gain ' +
            'references eventually — re-pin with `node scripts/ci/flag-audit.mjs ' +
            '--update` after wiring or retiring them.',
          generatedAt: new Date().toISOString(),
          flags: current,
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
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).flags ?? {}

  /** @type {string[]} */
  const dead = []
  for (const name of names) {
    const refs = current[name].references
    const wasLive = (baseline[name]?.references ?? 0) > 0
    if (refs === 0) {
      if (name in baseline) {
        if (wasLive) dead.push(`${name}: was live at baseline, now has zero references.`)
      } else {
        dead.push(`${name}: added to the registry with no references (born dead).`)
      }
    }
  }
  for (const name of Object.keys(baseline)) {
    if (!names.includes(name)) console.log(`  (retired flag removed from registry: ${name})`)
  }

  if (dead.length > 0) {
    console.error(`\n❌ ${dead.length} dead flag(s):`)
    for (const d of dead) console.error(`  - ${d}`)
    console.error('\nWire the flag into the code it gates, or remove it from the registry.')
    process.exit(1)
  }
  console.log('\n✅ No dead feature flags.')
}

main()
