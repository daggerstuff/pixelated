#!/usr/bin/env node
/**
 * Strict-typing ratchet for the ai submodule's live research surface.
 *
 * The parent repo's mypy gate (scripts/ci/python-typecheck.sh) enforces
 * --strict on the pe service, scripts/, and tools/, but the ai/ submodule
 * tree is exempted — the research/ tree alone carries ~1250 strict errors
 * in legacy code. This ratchet makes that debt visible and shrink-only.
 *
 * It pins two things, and both can only shrink:
 *
 * 1. Which files are legacy. Any NEW .py file under ai/research must pass
 *    `mypy --strict` or CI fails — the exemption never expands.
 * 2. How many strict errors each legacy file carries, per error code. Any
 *    NEW error, or an increased count, fails CI. Fixes show up as
 *    "cleaned" entries; --update is required to re-pin, and every change
 *    is visible in review.
 *
 * mypy runs dependency-light on purpose: `uv run --no-project --with mypy`
 * with --ignore-missing-imports and --no-site-packages, so CI does not
 * need the submodule's heavy ML dependency tree (torch, transformers) to
 * enforce typing, and the pinned counts are identical on dev machines
 * and bare CI runners. Third-party imports resolve to Any; the pinned
 * counts reflect the submodule's own code, consistently everywhere.
 *
 * Usage:
 *   node scripts/ci/ai-strict-ratchet.mjs            # enforce
 *   node scripts/ci/ai-strict-ratchet.mjs --update   # re-pin (deliberate)
 *   node scripts/ci/ai-strict-ratchet.mjs --prune    # drop deleted files
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve, sep } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const AI_DIR = join(ROOT, 'ai')
const BASELINE_PATH = join(ROOT, 'scripts/ci/ai-strict-baseline.json')
const IGNORE_DIRS = new Set(['__pycache__', '.venv', 'venv', 'node_modules', '.git', 'data', 'wandb'])

/** The live research surface the parent imports (ai.research.quadit etc.). */
const TREES = ['research']

const MYPY_CONFIG = `[mypy]
python_version = 3.13
strict = True
ignore_missing_imports = True
exclude = __main__\\.py$
`

if (!existsSync(AI_DIR)) {
  console.error('❌ ai submodule not checked out (git submodule update --init ai).')
  process.exit(1)
}

/** Recursively collect .py files, skipping build/venv/data directories. */
function collectPythonFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue
      collectPythonFiles(join(dir, entry.name), acc)
    } else if (entry.name.endsWith('.py')) {
      acc.push(join(dir, entry.name))
    }
  }
  return acc
}

function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return { files: [], errors: {} }
  const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  return { files: raw.files ?? [], errors: raw.errors ?? {} }
}

function writeBaseline(baseline) {
  const files = [...new Set(baseline.files)].sort()
  const errors = {}
  for (const key of Object.keys(baseline.errors).sort()) {
    errors[key] = baseline.errors[key]
  }
  writeBaselineContent(files, errors)
}

function writeBaselineContent(files, errors) {
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify(
      {
        $schema:
          'Legacy strict-typing debt in the ai submodule research tree, pinned by scripts/ci/ai-strict-ratchet.mjs.',
        description:
          'files: legacy .py files under ai/research. errors: "file :: code" → pinned strict-error count. ' +
          'The ratchet fails CI on any new file with strict errors, any new error key, or any ' +
          'increased count. Fixes shrink these maps; --update re-pins deliberately.',
        generatedAt: new Date().toISOString(),
        files,
        errors,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
}

/** Run dependency-light mypy --strict on the pinned trees. */
function runStrictMypy() {
  const configDir = mkdtempSync(join(tmpdir(), 'ai-strict-ratchet-'))
  const configPath = join(configDir, 'mypy.ini')
  writeFileSync(configPath, MYPY_CONFIG, 'utf8')

  return spawnSync(
    'uv',
    [
      'run',
      '--no-project',
      // Pin the interpreter: unpinned, uv picks the newest available and
      // runners diverge from dev machines, shifting mypy's error set.
      '--python',
      '3.13',
      '--with',
      'mypy',
      '--',
      'mypy',
      '--config-file',
      configPath,
      // Isolated analysis: without this, mypy searches the target
      // interpreter's site-packages, so dev machines with pytest et al.
      // installed type third-party decorators that CI's bare interpreter
      // cannot — the error set diverges between environments.
      '--no-site-packages',
      '--explicit-package-bases',
      '--follow-imports',
      'silent',
      '--no-error-summary',
      ...TREES,
    ],
    { cwd: AI_DIR, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 20 * 60 * 1000 },
  )
}

/** Parse `path:line: error: msg [code]` lines into `file :: code` counts. */
function parseErrorCounts(output, treePrefixes) {
  const counts = new Map()
  const perFile = new Map()
  const lineRe = new RegExp(
    `^(${treePrefixes.join('|')})/[^:]+:\\d+(?::\\d+)?: error: .*\\[([a-z-]+)\\]$`,
  )
  for (const line of output.split('\n')) {
    const m = line.match(lineRe)
    if (!m) continue
    const file = line.slice(0, line.indexOf(':'))
    const code = m[2]
    const key = `${file} :: ${code}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
    perFile.set(file, (perFile.get(file) ?? 0) + 1)
  }
  return { counts, perFile }
}

function main() {
  const args = process.argv.slice(2)
  const update = args.includes('--update')
  const prune = args.includes('--prune')

  const allFiles = TREES.flatMap((tree) =>
    existsSync(join(AI_DIR, tree)) ? collectPythonFiles(join(AI_DIR, tree)) : [],
  ).map((f) => relative(AI_DIR, f).split(sep).join('/'))

  const baseline = readBaseline()
  const legacy = new Set(baseline.files)

  const stale = [...legacy].filter((f) => !allFiles.includes(f))
  const current = allFiles.filter((f) => legacy.has(f))
  const newFiles = allFiles.filter((f) => !legacy.has(f))

  console.log('═════════════════════════════════════════════════════')
  console.log('  ai submodule strict-typing ratchet (research tree)')
  console.log('═════════════════════════════════════════════════════')
  console.log(`  Trees:            ${TREES.join(', ')} (in the ai submodule)`)
  console.log(`  Total .py files:  ${allFiles.length}`)
  console.log(`  Legacy (exempt):  ${current.length}`)
  if (stale.length > 0) console.log(`  Deleted since:    ${stale.length}`)
  console.log(`  New (must be strict-clean): ${newFiles.length}`)

  if (prune && stale.length > 0) {
    const errors = {}
    for (const [key, count] of Object.entries(baseline.errors)) {
      if (!stale.some((f) => key.startsWith(`${f} ::`))) errors[key] = count
    }
    writeBaseline({ files: current, errors })
    console.log(`\n  Pruned ${stale.length} deleted file(s) from the baseline.`)
    return 0
  }

  if (stale.length > 0 && !update) {
    console.log('\n  Run with --prune to remove deleted files from the baseline.')
  }

  console.log('\n  Running dependency-light mypy --strict on the research tree…')
  const result = runStrictMypy()
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  const { counts, perFile } = parseErrorCounts(output, TREES)

  if (result.status !== 0 && counts.size === 0 && !/^\S+:\d+.*error:/m.test(output)) {
    // mypy itself broke (bad config, syntax crash) — surface raw output.
    console.error(output)
    console.error('❌ mypy did not produce a usable error report.')
    return 1
  }

  const pinned = baseline.errors
  const totalErrors = [...counts.values()].reduce((a, b) => a + b, 0)
  const pinnedTotal = Object.values(pinned).reduce((a, b) => a + b, 0)
  console.log(`\n  Strict errors now:  ${totalErrors} (pinned: ${pinnedTotal})`)

  // Rule 1: no new files may carry errors.
  const newFileWithErrors = [...new Set([...perFile.keys()])].filter((f) => !legacy.has(f))

  // Rule 2: no new error keys, no increased counts.
  const regressions = []
  const cleaned = []
  for (const [key, count] of counts) {
    const pinnedCount = pinned[key]
    if (pinnedCount === undefined) regressions.push(`NEW     ${key} (x${count})`)
    else if (count > pinnedCount) regressions.push(`GREW    ${key} ${pinnedCount} → ${count}`)
    else if (count < pinnedCount) cleaned.push(`${key} ${pinnedCount} → ${count}`)
  }
  for (const key of Object.keys(pinned)) {
    if (!counts.has(key)) cleaned.push(`${key} ${pinned[key]} → 0`)
  }

  if (update) {
    writeBaselineContent(allFiles, Object.fromEntries(counts))
    console.log(`\n  Baseline re-pinned: ${allFiles.length} files, ${totalErrors} errors.`)
    return 0
  }

  if (newFileWithErrors.length > 0) {
    console.log('\n  New files with strict errors (must be fixed, not pinned):')
    for (const file of newFileWithErrors) console.log(`    ${file} (${perFile.get(file)})`)
  }
  if (regressions.length > 0) {
    console.log('\n  Regressions (new keys or grown counts):')
    for (const r of regressions.slice(0, 25)) console.log(`    ${r}`)
    if (regressions.length > 25) console.log(`    … and ${regressions.length - 25} more`)
  }
  if (cleaned.length > 0) {
    console.log(`\n  Cleaned (${cleaned.length}) — re-pin with --update to bank the fixes:`)
    for (const c of cleaned.slice(0, 10)) console.log(`    ${c}`)
    if (cleaned.length > 10) console.log(`    … and ${cleaned.length - 10} more`)
  }

  if (regressions.length > 0 || newFileWithErrors.length > 0) {
    console.error('\n❌ Strict-typing ratchet failed: debt grew.')
    return 1
  }

  console.log('\n✅ Strict-typing ratchet held (debt did not grow).')
  return 0
}

process.exit(main())
