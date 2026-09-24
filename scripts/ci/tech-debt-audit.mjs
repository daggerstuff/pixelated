#!/usr/bin/env node
/**
 * Technical-debt ratchet — TODO/FIXME marker tracking.
 *
 * Every TODO/FIXME/HACK/XXX comment should point at a tracking ticket, e.g.
 * `// TODO(PIX-1234): ...`. Untracked markers are debt that never gets found
 * again, so this audit records the current set of untracked markers in
 * `scripts/ci/tech-debt-baseline.json` and fails when a *new* untracked marker
 * appears. Existing markers are visible and can be burned down over time;
 * moving them into the baseline requires an explicit opt-in.
 *
 * Accepted ticket forms: `TODO(TICKET-123)`, `TODO(PIX-123)`, `TODO(#123)`,
 * `TODO(owner/repo#123)`.
 *
 * Usage:
 *   pnpm lint:tech-debt               # check against baseline (CI gate)
 *   pnpm lint:tech-debt -- --update   # re-pin after intentional changes
 *   pnpm lint:tech-debt -- --list     # print every untracked marker with location
 *
 * Exit codes: 0 = at or below baseline, 1 = new untracked markers found.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { readdirSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const BASELINE_PATH = resolve(import.meta.dirname, 'tech-debt-baseline.json')

const SCAN_ROOTS = [
  'apps/web/src',
  'agents',
  'packages',
  'scripts',
  'tools',
  'foresight',
  'ai',
]

const EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.astro',
  '.py',
  '.js',
  '.mjs',
  '.cjs',
  '.sh',
])

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
  '.git',
])

const IGNORE_PATTERNS = [
  /\.d\.ts$/,
  /\/vendor\//,
  /\/generated\//,
  /\.generated\./,
  // Anchored so the top-level submodule path matches — `relative()` never
  // yields a leading slash.
  /(^|\/)ai\/tools\//,
  /\/_libs\//,
  // This script's own regex/docstrings legitimately contain the marker words.
  /^scripts\/ci\/tech-debt-audit\.mjs$/,
]

// A tracked marker: TODO|FIXME|HACK|XXX followed by (TICKET) where TICKET is
// e.g. PIX-123, ABC-9, #123, or owner/repo#123.
const TRACKED_RE =
  /\b(TODO|FIXME|HACK|XXX)\(\s*(?:[A-Z][A-Z0-9]+-\d+|#\d+|[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#\d+)\s*\)/i

// An untracked marker: an UPPERCASE TODO|FIXME|HACK|XXX annotation. A
// marker immediately followed by `(` is a tracked `TODO(TICKET-123)`
// marker; otherwise it must start an annotation (whitespace, `:`, or end
// of line). Case-sensitive so lowercase identifiers (Spanish `todo`,
// `todo` variables, `todo-*` class names) are never mistaken for debt.
const UNTRACKED_RE = /\b(TODO|FIXME|HACK|XXX)\b(?!\()(?=\s|:|$)/g

/**
 * @typedef {{path: string, line: number, kind: string, text: string}} Marker
 */

/**
 * @param {string} dir
 * @param {Marker[]} out
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

    let content
    try {
      content = readFileSync(full, 'utf8')
    } catch {
      continue
    }

    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]
      // Skip lines that already carry a tracked marker.
      if (TRACKED_RE.test(line)) continue
      UNTRACKED_RE.lastIndex = 0
      const match = UNTRACKED_RE.exec(line)
      if (match) {
        out.push({
          path: rel,
          line: i + 1,
          kind: match[1].toUpperCase(),
          text: line.trim().slice(0, 160),
        })
      }
    }
  }
}

function collect() {
  /** @type {Marker[]} */
  const markers = []
  for (const root of SCAN_ROOTS) {
    const abs = resolve(ROOT, root)
    if (existsSync(abs) && statSync(abs).isDirectory()) walk(abs, markers)
  }
  return markers.sort(
    (a, b) => a.path.localeCompare(b.path) || a.line - b.line,
  )
}

/** Stable identity for a marker, used to diff against the baseline. */
function keyOf(marker) {
  return `${marker.path}:${marker.line}:${marker.kind}`
}

function main() {
  const args = process.argv.slice(2)
  const update = args.includes('--update')
  const list = args.includes('--list')

  const markers = collect()
  const counts = markers.reduce((acc, m) => {
    acc[m.kind] = (acc[m.kind] ?? 0) + 1
    return acc
  }, /** @type {Record<string, number>} */ ({}))

  console.log(
    `Scanned for untracked debt markers: ${markers.length} total ` +
      `(${Object.entries(counts)
        .map(([k, v]) => `${k}:${v}`)
        .join(', ') || 'none'}).`,
  )

  if (update) {
    const baseline = {
      $schema: 'Tech-debt baseline for scripts/ci/tech-debt-audit.mjs',
      description:
        'Keys of pre-existing untracked TODO/FIXME/HACK/XXX markers. The audit ' +
        'fails when a new untracked marker appears. Fix by adding a ticket ' +
        'reference, e.g. `TODO(PIX-123): ...`, or re-pin with ' +
        '`pnpm lint:tech-debt -- --update` if the marker is intentional.',
      generatedAt: new Date().toISOString(),
      counts,
      total: markers.length,
      markers: markers.map(keyOf),
    }
    writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
    console.log(`Tech-debt baseline written to ${BASELINE_PATH}`)
    return
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error(
      'No baseline found at scripts/ci/tech-debt-baseline.json. ' +
        'Run `pnpm lint:tech-debt -- --update` to create it.',
    )
    process.exit(1)
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  const known = new Set(baseline.markers ?? [])
  const current = new Set(markers.map(keyOf))

  const newMarkers = markers.filter((m) => !known.has(keyOf(m)))

  if (list) {
    console.log('\nUntracked debt markers:')
    for (const m of markers) {
      const flag = known.has(keyOf(m)) ? ' ' : '!'
      console.log(`${flag} ${m.path}:${m.line}  ${m.kind}: ${m.text}`)
    }
  }

  // Report burn-down: baseline markers that no longer exist.
  const removed = [...known].filter((key) => !current.has(key)).length
  if (removed > 0) {
    console.log(`  ✅ ${removed} baseline marker(s) resolved — nice.`)
  }

  if (newMarkers.length > 0) {
    console.error('\nNew untracked debt markers detected:\n')
    for (const m of newMarkers.slice(0, 50)) {
      console.error(`  ❌ ${m.path}:${m.line}  ${m.kind}: ${m.text}`)
    }
    if (newMarkers.length > 50) {
      console.error(`  ...and ${newMarkers.length - 50} more.`)
    }
    console.error(
      '\nLink each marker to a tracking ticket, e.g. ' +
        '`// TODO(PIX-1234): ...`, or re-pin with ' +
        '`pnpm lint:tech-debt -- --update` if it is intentional.',
    )
    process.exit(1)
  }

  console.log('\n✅ No new untracked debt markers.')
}

main()
