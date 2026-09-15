#!/usr/bin/env node
/**
 * Large-file ratchet — language-agnostic oversized-file detection.
 *
 * Walks the source tree (TS/TSX/Astro/Python) and counts files whose line
 * count exceeds a threshold. oxlint's `max-lines` rule only covers JS/TS, so
 * this script exists to also cover `.astro` and `.py` and to give a single,
 * legible report. Counts are pinned in
 * `scripts/ci/large-file-baseline.json` so the current debt is visible and
 * cannot grow.
 *
 * Usage:
 *   pnpm lint:file-size               # check against baseline (CI gate)
 *   pnpm lint:file-size -- --update   # re-pin after intentional changes
 *   pnpm lint:file-size -- --list     # print the largest offending files
 *
 * Exit codes: 0 = at or below baseline, 1 = a regression above baseline.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { readdirSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const BASELINE_PATH = resolve(import.meta.dirname, 'large-file-baseline.json')

const THRESHOLDS = {
  // Hard limit — any file above this is a new violation.
  hard: 800,
  // Soft limit — reported but not gated on its own.
  soft: 500,
}

const SCAN_ROOTS = [
  'apps/web/src',
  'agents',
  'packages',
  'scripts',
  'tools',
  'foresight',
]

const EXTENSIONS = new Set(['.ts', '.tsx', '.astro', '.py', '.js', '.mjs', '.cjs'])

const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  '.venv',
  'venv',
  '__pycache__',
  '.astro',
  '.turbo',
  '.next',
  '.output',
  '.eve',
  '.wrangler',
  '.vercel',
])

/** Path fragments that mark generated or vendored files. */
const IGNORE_PATTERNS = [
  /\.d\.ts$/,
  /\.test\./,
  /\.spec\./,
  /__tests__\//,
  /__mocks__\//,
  /\/tests?\//,
  /(^|\/)test_[^/]*\.py$/,
  /\.generated\./,
  /\/generated\//,
  /\/vendor\//,
  /\/ai\/tools\//,
  /\/\.output\//,
  /\/_libs\//,
]

/**
 * @param {string} dir
 * @param {Array<{path: string, lines: number}>} out
 */
function walk(dir, out) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const full = resolve(dir, entry.name)
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue
      walk(full, out)
      continue
    }
    if (!entry.isFile()) continue

    const ext = entry.name.slice(entry.name.lastIndexOf('.'))
    if (!EXTENSIONS.has(ext)) continue

    const rel = relative(ROOT, full)
    if (IGNORE_PATTERNS.some((re) => re.test(rel))) continue

    let lines
    try {
      lines = readFileSync(full, 'utf8').split('\n').length
    } catch {
      continue
    }
    if (lines > THRESHOLDS.soft) out.push({ path: rel, lines })
  }
}

function collect() {
  /** @type {Array<{path: string, lines: number}>} */
  const files = []
  for (const root of SCAN_ROOTS) {
    const abs = resolve(ROOT, root)
    if (existsSync(abs) && statSync(abs).isDirectory()) walk(abs, files)
  }
  return files.sort((a, b) => b.lines - a.lines)
}

function main() {
  const args = process.argv.slice(2)
  const update = args.includes('--update')
  const list = args.includes('--list')

  const files = collect()
  const overSoft = files.filter((f) => f.lines > THRESHOLDS.soft)
  const overHard = files.filter((f) => f.lines > THRESHOLDS.hard)

  console.log(
    `Scanned for large files (>${THRESHOLDS.soft} lines): ` +
      `${overSoft.length} soft, ${overHard.length} over the ${THRESHOLDS.hard}-line hard limit.`,
  )

  if (update) {
    const baseline = {
      $schema: 'Large-file baseline for scripts/ci/large-file-audit.mjs',
      description:
        'Line-count thresholds and the current list of files over the hard ' +
        'limit. The audit fails when a file not in this list exceeds the hard ' +
        'limit, or a listed file grows. Re-pin with ' +
        '`pnpm lint:file-size -- --update` after intentional changes.',
      generatedAt: new Date().toISOString(),
      thresholds: THRESHOLDS,
      oversizedFiles: overHard.map((f) => f.path),
      oversizedCount: overHard.length,
    }
    writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
    console.log(`Large-file baseline written to ${BASELINE_PATH}`)
    return
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error(
      'No baseline found at scripts/ci/large-file-baseline.json. ' +
        'Run `pnpm lint:file-size -- --update` to create it.',
    )
    process.exit(1)
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  const known = new Set(baseline.oversizedFiles ?? [])

  /** @type {string[]} */
  const regressions = []
  for (const file of overHard) {
    if (!known.has(file.path)) {
      regressions.push(`  ❌ new oversized file: ${file.path} (${file.lines} lines)`)
    }
  }
  // A file may leave the list (improvement) — that is fine and should shrink
  // the baseline on the next --update.
  for (const path of known) {
    if (!overHard.some((f) => f.path === path)) {
      console.log(`  ✅ ${path}: now at or below the hard limit (improved)`)
    }
  }

  if (list) {
    console.log('\nLargest files:')
    for (const f of files.slice(0, 25)) {
      console.log(`  ${String(f.lines).padStart(6)}  ${f.path}`)
    }
  }

  if (regressions.length > 0) {
    console.error('\nLarge-file regressions detected:\n')
    console.error(regressions.join('\n'))
    console.error(
      `\nSplit the file into smaller modules (hard limit ${THRESHOLDS.hard} ` +
        'lines) or, if intentional, re-pin with ' +
        '`pnpm lint:file-size -- --update`.',
    )
    process.exit(1)
  }

  console.log('\n✅ No new oversized files.')
}

main()
