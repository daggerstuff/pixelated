#!/usr/bin/env node
/**
 * Heavy-dependency audit — install-weight ratchet.
 *
 * Detects dependency weight regressions before they land: the gate fails when
 * the total install footprint of `node_modules` grows past a pinned budget
 * (×1.25), and prints the heaviest packages with their on-disk sizes so the
 * culprit of any regression is visible.
 *
 * Sizes are measured from `node_modules/.pnpm` (the pnpm content-addressed
 * store view of this install), which counts every installed version of every
 * package, so duplicate versions weigh in too.
 *
 * Usage:
 *   pnpm lint:heavy-deps             # measure and enforce the budget
 *   pnpm lint:heavy-deps -- --update # re-pin after an intentional change
 *
 * Exit codes: 0 = within budget, 1 = over budget, 2 = no node_modules to audit.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const PNPM_DIR = resolve(ROOT, 'node_modules/.pnpm')
const BASELINE_PATH = resolve(import.meta.dirname, 'heavy-deps-baseline.json')
const OUT_PATH = resolve(ROOT, '.deps-audit/heavy-deps.md')

/** Tolerance applied to the pinned total: CI disk layouts vary a little. */
const TOLERANCE = 1.25
/** How many packages to list in the report. */
const TOP_N = 25

function measure() {
  if (!existsSync(PNPM_DIR)) {
    console.error(`No ${PNPM_DIR} — run pnpm install first.`)
    process.exit(2)
  }
  /** @type {Map<string, number>} name -> KB */
  const sizes = new Map()
  for (const entry of readdirSync(PNPM_DIR)) {
    if (entry === 'lock.yaml') continue
    // Entries look like `name@version` or `@scope+name@version`.
    const at = entry.lastIndexOf('@')
    if (at <= 0) continue
    const name = entry.slice(0, at).replace(/\+/g, '/')
    const du = spawnSync('du', ['-sk', resolve(PNPM_DIR, entry)], { encoding: 'utf8' })
    const kb = Number((du.stdout ?? '').trim().split('\t')[0] ?? 0)
    if (!Number.isFinite(kb) || kb === 0) continue
    sizes.set(name, (sizes.get(name) ?? 0) + kb)
  }
  const totalKb = [...sizes.values()].reduce((a, b) => a + b, 0)
  const top = [...sizes.entries()]
    .map(([name, kb]) => ({ name, kb }))
    .sort((a, b) => b.kb - a.kb)
  return { totalKb, top }
}

function main() {
  const args = process.argv.slice(2)
  const update = args.includes('--update')

  const { totalKb, top } = measure()

  console.log('\n══════════════════════════════════════════════')
  console.log('  Heavy-dependency audit (install weight)')
  console.log('══════════════════════════════════════════════\n')
  console.log(`  node_modules total: ${(totalKb / 1024).toFixed(0)} MB`)
  console.log(`  Top ${TOP_N} packages by install size:\n`)
  for (const p of top.slice(0, TOP_N)) {
    console.log(`  ${String((p.kb / 1024).toFixed(0)).padStart(5)} MB  ${p.name}`)
  }

  if (update) {
    writeFileSync(
      BASELINE_PATH,
      `${JSON.stringify(
        {
          $schema: 'Heavy-dependency ratchet for scripts/ci/heavy-deps-audit.mjs',
          description:
            'Total install footprint of node_modules/.pnpm, in KB. The gate fails ' +
            'when the total exceeds 1.25x this value. Re-pin after an intentional ' +
            'dependency change with `pnpm lint:heavy-deps -- --update`.',
          generatedAt: new Date().toISOString(),
          totalKb,
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
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  const budgetKb = baseline.totalKb * TOLERANCE
  const ok = totalKb <= budgetKb
  console.log(`  Budget: ${(budgetKb / 1024).toFixed(0)} MB (baseline ${(baseline.totalKb / 1024).toFixed(0)} MB × ${TOLERANCE})`)

  const reportMd = [
    '## Heavy-dependency audit',
    '',
    `Total install footprint: **${(totalKb / 1024).toFixed(0)} MB** (budget ${(budgetKb / 1024).toFixed(0)} MB)`,
    '',
    '| Package | Install size |',
    '| --- | --- |',
    ...top.slice(0, TOP_N).map((p) => `| \`${p.name}\` | ${(p.kb / 1024).toFixed(0)} MB |`),
    '',
    ok ? '✅ Within the pinned budget.' : '❌ Over the pinned install-weight budget.',
    '',
  ].join('\n')
  try {
    mkdirSync(resolve(ROOT, '.deps-audit'), { recursive: true })
    writeFileSync(OUT_PATH, `${reportMd}\n`, 'utf8')
  } catch {
    // .deps-audit may not be creatable in some sandboxes; the gate result
    // below is what matters.
  }

  if (!ok) {
    console.error(
      '\n❌ Install weight regression. Check the new/heavier packages above — ' +
        'heavy dependencies slow every install and CI run. Remove them, or — ' +
        'after an intentional change — re-pin with `pnpm lint:heavy-deps -- --update`.',
    )
    process.exit(1)
  }
  console.log('\n✅ Within the pinned budget.')
}

main()
