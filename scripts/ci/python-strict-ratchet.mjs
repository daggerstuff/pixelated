#!/usr/bin/env node
/**
 * Python strict-typing ratchet for the legacy-exempt trees.
 *
 * pyproject.toml [tool.mypy] runs strict mode project-wide but exempts
 * legacy trees (ai/, scripts/, foresight/, tools/, tests/) whose pre-strict
 * code has not been repaired yet — ~1000 errors at baseline. The pe
 * FastAPI service is fully enforced (scripts/ci/python-typecheck.sh).
 *
 * The ratchet pins two things, and both can only shrink:
 *
 * 1. Which files are legacy. Any NEW .py file in an exempt tree must pass
 *    `mypy --strict` or CI fails — the exemption never expands to new code.
 * 2. How many strict errors each legacy file carries, per error code. Any
 *    NEW error, or an increased count, fails CI. Fixes show up as
 *    "cleaned" entries; --update is required to raise anything, and every
 *    change is visible in review.
 *
 * This mirrors the TypeScript strict-mode tracker
 * (scripts/ci/ts-strict-mode-tracker.ts): strict where enforced today,
 * documented legacy, and a mechanism that guarantees the legacy debt only
 * gets smaller.
 *
 * Usage:
 *   node scripts/ci/python-strict-ratchet.mjs            # enforce
 *   node scripts/ci/python-strict-ratchet.mjs --update   # re-pin (deliberate)
 *   node scripts/ci/python-strict-ratchet.mjs --prune    # drop deleted files
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve, sep } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const BASELINE_PATH = join(ROOT, 'scripts/ci/python-strict-baseline.json')
const IGNORE_DIRS = new Set(['__pycache__', '.venv', 'venv', 'node_modules', '.git'])

/** Trees exempted from strict mode in pyproject.toml [tool.mypy.overrides]. */
const EXEMPT_TREES = ['scripts', 'tools']

const MYPY_CONFIG = `[mypy]
python_version = 3.13
ignore_missing_imports = True
mypy_path = stubs
strict = True
`

/** Recursively collect .py files, skipping build/venv directories. */
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
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify(
      {
        $schema: 'Legacy (pre-strict) Python debt, pinned by scripts/ci/python-strict-ratchet.mjs.',
        description:
          'files: legacy-exempt .py files. errors: "file :: code" → pinned strict-error count. ' +
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

/** Run mypy --strict on all tree files with the exemption-free config. */
function runStrictMypy() {
  const configDir = mkdtempSync(join(tmpdir(), 'mypy-strict-ratchet-'))
  const configPath = join(configDir, 'mypy.ini')
  writeFileSync(configPath, MYPY_CONFIG, 'utf8')

  return spawnSync(
    'uv',
    [
      'run',
      '--extra',
      'dev',
      'mypy',
      '--config-file',
      configPath,
      '--explicit-package-bases',
      '--follow-imports',
      'silent',
      '--no-error-summary',
      ...EXEMPT_TREES,
    ],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 20 * 60 * 1000 },
  )
}

/** Parse `path:line: error: msg [code]` lines into `file :: code` counts. */
function parseErrorCounts(output, treePrefixes) {
  const counts = new Map()
  const perFile = new Map()
  const lineRe = new RegExp(`^(${treePrefixes.join('|')})/[^:]+:\\d+(?::\\d+)?: error: .*\\[([a-z-]+)\\]$`)
  for (const line of output.split('\n')) {
    const m = line.match(lineRe)
    if (!m) continue
    // Paths contain no ':' — the first one separates the line number.
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

  const allFiles = EXEMPT_TREES.flatMap((tree) =>
    existsSync(join(ROOT, tree)) ? collectPythonFiles(join(ROOT, tree)) : [],
  ).map((f) => relative(ROOT, f).split(sep).join('/'))

  const baseline = readBaseline()
  const legacy = new Set(baseline.files)

  const stale = [...legacy].filter((f) => !allFiles.includes(f))
  const current = allFiles.filter((f) => legacy.has(f))
  const newFiles = allFiles.filter((f) => !legacy.has(f))

  console.log('══════════════════════════════════════════════')
  console.log('  Python strict ratchet (legacy-exempt trees)')
  console.log('══════════════════════════════════════════════')
  console.log(`  Trees:            ${EXEMPT_TREES.join(', ')}`)
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

  console.log('\n  Running mypy --strict across the exempt trees…')
  const result = runStrictMypy()
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  const { counts, perFile } = parseErrorCounts(output, EXEMPT_TREES)

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
    writeBaseline({ files: allFiles, errors: Object.fromEntries(counts) })
    console.log(`\n  Baseline re-pinned: ${allFiles.length} files, ${totalErrors} errors.`)
    console.log('  Review the diff — --update is for deliberate grandfathering only.')
    return 0
  }

  const failures = []
  if (newFileWithErrors.length > 0) {
    failures.push(
      `${newFileWithErrors.length} NEW file(s) have strict errors:\n` +
        newFileWithErrors.map((f) => `  - ${f} (${perFile.get(f)} errors)`).join('\n'),
    )
  }
  if (regressions.length > 0) {
    failures.push(`\n${regressions.length} regressed error count(s):\n  ${regressions.join('\n  ')}`)
  }

  if (cleaned.length > 0) {
    console.log(`\n  Cleaned up (can be re-pinned lower): ${cleaned.length}`)
  }

  if (failures.length > 0) {
    console.error(`\n❌ Strict debt grew:\n${failures.join('\n')}`)
    console.error(
      '\n   Fix the annotations. The legacy exemption only shrinks — never grows.',
    )
    return 1
  }

  console.log('\n✅ Strict debt did not grow — exemption is stable or shrinking.')
  return 0
}

process.exit(main())
