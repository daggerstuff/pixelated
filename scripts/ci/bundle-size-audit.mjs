#!/usr/bin/env node
/**
 * Bundle-size audit — client build output ratchet.
 *
 * Fails when the total shipped client JavaScript (dist/client) grows past a
 * pinned budget (×1.25) or when any single chunk exceeds the hard cap, and
 * always prints the heaviest chunks so the culprit of a regression is
 * visible. Run after `pnpm build`.
 *
 * Usage:
 *   node scripts/ci/bundle-size-audit.mjs            # audit and enforce
 *   node scripts/ci/bundle-size-audit.mjs --update   # re-pin the baseline
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { readdirSync, statSync } from 'node:fs'

const ROOT = resolve(import.meta.dirname, '../..')
const BASELINE_PATH = resolve(import.meta.dirname, 'bundle-size-baseline.json')
const DIST_CLIENT = join(ROOT, 'dist', 'client')

// A single JS chunk above this is worth a look before it lands, regardless of
// the total budget.
const SINGLE_CHUNK_HARD_LIMIT_BYTES = 1_500_000

// Budget multiplier over the pinned total: small intentional growth is fine,
// silent runaway is not.
const BUDGET_FACTOR = 1.25

const updating = process.argv.includes('--update')
const { totalBytes } = updating ? { totalBytes: 0 } : loadBaseline()

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) {
    console.error(`No baseline at scripts/ci/bundle-size-baseline.json. Run with --update after a successful build.`)
    process.exit(3)
  }
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
}

function listJsFiles(dir, acc = []) {
  if (!existsSync(dir)) {
    console.error(`Missing build output at ${relative(ROOT, dir)} — run a build first.`)
    process.exit(3)
  }
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) listJsFiles(full, acc)
    else if (entry.endsWith('.js')) acc.push(full)
  }
  return acc
}

const files = listJsFiles(DIST_CLIENT)
  .map((p) => ({ path: relative(ROOT, p), bytes: statSync(p).size }))
  .sort((a, b) => b.bytes - a.bytes)

const currentTotal = files.reduce((sum, f) => sum + f.bytes, 0)
const budget = Math.round(totalBytes * BUDGET_FACTOR)

console.log(`Client JS: ${files.length} chunks, ${(currentTotal / 1e6).toFixed(2)} MB total (baseline ${(totalBytes / 1e6).toFixed(2)} MB, budget ${(budget / 1e6).toFixed(2)} MB).`)
console.log('\nHeaviest chunks:')
for (const f of files.slice(0, 10)) console.log(`  ${(f.bytes / 1024).toFixed(0).padStart(7)} KB  ${f.path}`)
if (files.length > 10) console.log(`  … and ${files.length - 10} more`)

if (updating) {
  writeFileSync(BASELINE_PATH, JSON.stringify({ totalBytes: currentTotal, singleChunkHardLimitBytes: SINGLE_CHUNK_HARD_LIMIT_BYTES }, null, 2) + '\n')
  console.log(`\nBaseline written: ${(currentTotal / 1e6).toFixed(2)} MB.`)
  process.exit(0)
}

let failed = false

if (currentTotal > budget) {
  console.error(`\n❌ Client bundle grew past budget: ${(currentTotal / 1e6).toFixed(2)} MB > ${(budget / 1e6).toFixed(2)} MB (baseline × ${BUDGET_FACTOR}).`)
  console.error('Shrink it, or — if the growth is an intentional feature — re-pin with `node scripts/ci/bundle-size-audit.mjs --update`.')
  failed = true
}

const overLimit = files.filter((f) => f.bytes > SINGLE_CHUNK_HARD_LIMIT_BYTES)
if (overLimit.length > 0) {
  console.error(`\n❌ ${overLimit.length} chunk(s) exceed the ${(SINGLE_CHUNK_HARD_LIMIT_BYTES / 1e6).toFixed(1)} MB single-chunk cap:`)
  for (const f of overLimit) console.error(`  ${f.path}`)
  failed = true
}

if (failed) process.exit(1)
console.log('\n✅ Client bundle within budget.')
