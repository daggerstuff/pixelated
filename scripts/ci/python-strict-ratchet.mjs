#!/usr/bin/env node
/**
 * Python strict-typing ratchet for the legacy-exempt trees.
 *
 * pyproject.toml [tool.mypy] runs strict mode project-wide but exempts
 * legacy trees (ai/, scripts/, foresight/, tools/, tests/) whose pre-strict
 * code has not been repaired yet — 1000+ errors at last count. The pe
 * FastAPI service is fully enforced (scripts/ci/python-typecheck.sh).
 *
 * This ratchet makes the exemption non-expanding: every Python file that
 * exists in an exempt tree at baseline time is pinned as legacy, and any
 * NEW .py file in those trees must pass `mypy --strict` or CI fails. The
 * baseline can only shrink (via --prune); it never absorbs new files
 * silently (--update must be run deliberately, and each entry is visible
 * in review).
 *
 * This mirrors the TypeScript strict-mode tracker
 * (scripts/ci/ts-strict-mode-tracker.ts): strict where enforced today,
 * documented legacy, and a mechanism that guarantees the legacy set only
 * gets smaller.
 *
 * Usage:
 *   node scripts/ci/python-strict-ratchet.mjs            # enforce
 *   node scripts/ci/python-strict-ratchet.mjs --update   # pin new files
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
  if (!existsSync(BASELINE_PATH)) return { files: [] }
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
}

function writeBaseline(baseline) {
  const files = [...new Set(baseline.files)].sort()
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify(
      {
        $schema: 'Legacy (pre-strict) Python files, pinned by scripts/ci/python-strict-ratchet.mjs. New .py files in the exempt trees must pass mypy --strict.',
        description:
          'These files predate strict typing and remain exempt. The ratchet fails CI when a file NOT listed here has strict errors. --prune removes entries for deleted files.',
        generatedAt: new Date().toISOString(),
        files,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
}

/** Run mypy --strict on the given files with the exemption-free config. */
function runStrictMypy(files) {
  const configDir = mkdtempSync(join(tmpdir(), 'mypy-strict-ratchet-'))
  const configPath = join(configDir, 'mypy.ini')
  writeFileSync(configPath, MYPY_CONFIG, 'utf8')

  const result = spawnSync(
    'uv',
    [
      'run',
      '--extra',
      'dev',
      'mypy',
      '--config-file',
      configPath,
      '--explicit-package-bases',
      // Only report diagnostics for the files we pass, not the legacy
      // modules they import.
      '--follow-imports',
      'silent',
      '--no-error-summary',
      ...files,
    ],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 20 * 60 * 1000 },
  )
  return result
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
    writeBaseline({ files: current })
    console.log(`\n  Pruned ${stale.length} deleted files from the baseline.`)
    return 0
  }

  if (update) {
    writeBaseline({ files: allFiles })
    console.log(`\n  Baseline updated: pinned ${newFiles.length} new files as legacy.`)
    console.log('  Review the diff — --update is for deliberate grandfathering only.')
    return 0
  }

  if (stale.length > 0) {
    console.log('\n  Run with --prune to remove deleted files from the baseline.')
  }

  if (newFiles.length === 0) {
    console.log('\n✅ No new Python files in the exempt trees — exemption is not expanding.')
    return 0
  }

  console.log('\n  Running mypy --strict on new files…')
  const result = runStrictMypy(newFiles)
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`

  if (result.status === 0) {
    console.log(`\n✅ All ${newFiles.length} new file(s) are strict-clean.`)
    return 0
  }

  console.error(output)
  console.error(`❌ ${newFiles.length} new file(s) in the exempt trees are NOT strict-clean.`)
  console.error('   Add precise type annotations — the exemption never expands to new files.')
  console.error('   If this is a deliberate legacy import, discuss before using --update.')
  return 1
}

process.exit(main())
