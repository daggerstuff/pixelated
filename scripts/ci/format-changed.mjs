#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const EXCLUDED_FROM_OXFMT = new Set([
  'src/lib/auth/__tests__/integration.test.ts',
  'src/types/index.ts',
  'tests/unit/auth0/auth0-jwt-service.test.ts',
])

const OXFMT_APPLICABLE_EXTENSIONS = new Set([
  '.js',
  '.ts',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
])

function dedupeAndFilterExisting(files) {
  const seen = new Set()
  const results = []

  for (const filePath of files) {
    if (!filePath || !existsSync(filePath)) {
      continue
    }
    if (seen.has(filePath)) {
      continue
    }

    seen.add(filePath)
    results.push(filePath)
  }

  return results
}

function runCommand(command, args) {
  const result = spawnSync('pnpm', ['-s', command, ...args], {
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status)
  }
}

function readFilesFromPath(filePath) {
  if (!existsSync(filePath)) {
    return []
  }

  return readFileSync(filePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function readChangedFilesFromGit() {
  const result = spawnSync('git', [
    'diff',
    '--name-only',
    '--diff-filter=ACMRTUXB',
    '--',
  ], { encoding: 'utf8' })

  if (result.status !== 0) {
    console.error('Failed to read changed files from git')
    process.exit(result.status)
  }

  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

const explicitFileListPath = process.argv[2]
const rawChangedFiles = explicitFileListPath
  ? readFilesFromPath(explicitFileListPath)
  : readChangedFilesFromGit()
const changedFiles = dedupeAndFilterExisting(rawChangedFiles)

if (changedFiles.length === 0) {
  console.log('No files to format-check.')
  process.exit(0)
}

runCommand('prettier', ['--check', '--ignore-unknown', ...changedFiles])

const oxfmtFiles = changedFiles.filter((filePath) => {
  if (EXCLUDED_FROM_OXFMT.has(filePath)) {
    return false
  }

  const extension = filePath.slice(filePath.lastIndexOf('.'))
  return OXFMT_APPLICABLE_EXTENSIONS.has(extension)
})

if (oxfmtFiles.length > 0) {
  runCommand('oxfmt', ['--check', ...oxfmtFiles])
}
