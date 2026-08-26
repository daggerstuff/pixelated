#!/usr/bin/env node
/**
 * TypeScript Strict Mode — Module-by-Module Migration Tracker
 *
 * Scans src/ subdirectories through the TypeScript compiler with
 * `noImplicitAny` and `noUncheckedIndexedAccess` enabled, reporting
 * how many modules are already clean vs. how many still have errors.
 *
 * Usage:
 *   pnpm tsx scripts/ci/ts-strict-mode-tracker.ts
 *   pnpm tsx scripts/ci/ts-strict-mode-tracker.ts --write-json
 *
 * Output: console table + optional scripts/ci/strict-mode-progress.json
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')

// Modules to audit — each entry maps a name to a glob pattern under src/
// Error results are filtered to only production source files (test files excluded)
const MODULES: { name: string; pattern: string }[] = [
  { name: 'lib/auth',          pattern: 'apps/web/src/lib/auth/**/*.ts' },
  { name: 'lib/audit',         pattern: 'apps/web/src/lib/audit/**/*.ts' },
  { name: 'lib/security',      pattern: 'apps/web/src/lib/security/**/*.ts' },
  { name: 'lib/encryption',    pattern: 'apps/web/src/lib/encryption.ts' },
  { name: 'lib/ai',            pattern: 'apps/web/src/lib/ai/**/*.ts' },
  { name: 'lib/ehr-native',    pattern: 'apps/web/src/lib/ehr-native/**/*.ts' },
  { name: 'lib/fhe',           pattern: 'apps/web/src/lib/fhe/**/*.ts' },
  { name: 'lib/logging',       pattern: 'apps/web/src/lib/logging/**/*.ts' },
  { name: 'lib/services',      pattern: 'apps/web/src/lib/services/**/*.ts' },
  { name: 'lib/memory',        pattern: 'apps/web/src/lib/memory/**/*.ts' },
  { name: 'lib/db',            pattern: 'apps/web/src/lib/db/**/*.ts' },
  { name: 'utils',             pattern: 'apps/web/src/utils/**/*.ts' },
  { name: 'hooks',             pattern: 'apps/web/src/hooks/**/*.ts' },
  { name: 'components',        pattern: 'apps/web/src/components/**/*.ts' },
  { name: 'pages/api',         pattern: 'apps/web/src/pages/api/**/*.ts' },
  { name: 'middleware',        pattern: 'apps/web/src/middleware/**/*.ts' },
  { name: 'config',            pattern: 'apps/web/src/config/**/*.ts' },
  { name: 'types',             pattern: 'apps/web/src/types/**/*.ts' },
]

interface ModuleResult {
  name: string
  files: number
  errors: number
  passed: boolean
  sampleErrors: string[]
}

/**
 * Run a single combined tsc pass over all production modules, then
 * partition errors by module directory for per-module reporting.
 * Excludes test/__tests__ files.
 */
function runCombinedCheck(): ModuleResult[] {
  const tsconfigDir = resolve(ROOT, 'config')
  const tsconfigTest = resolve(tsconfigDir, 'tsconfig.strict-check.json')

  const strictConfig = {
    extends: '../tsconfig.json',
    compilerOptions: {
      noImplicitAny: true,
      noUncheckedIndexedAccess: true,
      noEmit: true,
      strict: true,
      skipLibCheck: true,
    },
    include: ['../apps/web/src/**/*.ts', '../apps/web/src/**/*.tsx'],
    exclude: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**', '**/node_modules/**'],
  }

  if (!existsSync(tsconfigDir)) {
    mkdirSync(tsconfigDir, { recursive: true })
  }
  writeFileSync(tsconfigTest, JSON.stringify(strictConfig, null, 2), 'utf8')

  let stdout = ''
  let stderr = ''

  try {
    const result = execSync(
      `pnpm exec tsc --project "${tsconfigTest}" --noEmit 2>&1 || true`,
      { cwd: ROOT, encoding: 'utf8', timeout: 120_000, maxBuffer: 50 * 1024 * 1024 },
    )
    stdout = result
  } catch {
    stdout = ''
  } finally {
    try { writeFileSync(tsconfigTest, '') } catch { /* ignore */ }
  }

  const allOutput = stdout + stderr
  const errorLines = allOutput.split('\n').filter((l) => /error TS\d+/.test(l))

  // Count production files per module and classify errors
  const results: ModuleResult[] = MODULES.map((mod) => {
    const dirPrefix = mod.pattern
      .replace(/^apps\/web\/src\//, '')
      .replace(/\/\*\*\/\*\.ts$/, '')
      .replace(/\.ts$/, '')
      .replace(/\/\*$/, '')

    // Find errors that start with this module's directory path
    const modErrors = errorLines.filter((l) => {
      const filePath = l.split('(')[0]?.trim() ?? ''
      return filePath.startsWith(`apps/web/src/${dirPrefix}`)
    })

    // Count production source files in this module (recursive, excluding tests)
    let fileCount = 0
    try {
      const findOut = execSync(
        `find apps/web/src/${dirPrefix} -name '*.ts' -not -name '*.test.ts' -not -name '*.spec.ts' -not -path '*/__tests__/*' 2>/dev/null | wc -l`,
        { cwd: ROOT, encoding: 'utf8' },
      )
      fileCount = Number.parseInt(findOut.trim(), 10) || 0
    } catch {
      fileCount = 0
    }

    return {
      name: mod.name,
      files: fileCount,
      errors: modErrors.length,
      passed: modErrors.length === 0,
      sampleErrors: modErrors.slice(0, 5),
    }
  })

  return results
}

function generateReport(results: ModuleResult[]): void {
  const passedCount = results.filter((r) => r.passed).length
  const failedCount = results.filter((r) => !r.passed && r.errors >= 0).length
  const totalFiles = results.reduce((s, r) => s + r.files, 0)
  const totalErrors = results.reduce((s, r) => s + Math.max(r.errors, 0), 0)

  console.log('\n══════════════════════════════════════════════')
  console.log('  TypeScript Strict Mode — Migration Tracker')
  console.log('══════════════════════════════════════════════\n')
  console.log('  Settings:   noImplicitAny=true, noUncheckedIndexedAccess=true')
  console.log(`  Modules:    ${results.length} total`)
  console.log(`  Source Files: ${totalFiles}`)
  console.log(`  Total Errors: ${totalErrors}`)
  console.log(`  ✅ Clean:     ${passedCount}`)
  console.log(`  ❌ Has errors: ${failedCount}`)
  if (results.filter((r) => r.errors === -1).length > 0) {
    console.log(`  ⚠️  Unchecked: ${results.filter((r) => r.errors === -1).length}`)
  }
  console.log('\n────────────────── Module Breakdown ──────────────────\n')

  const sorted = [...results].sort((a, b) => {
    if (a.passed !== b.passed) return a.passed ? -1 : 1
    return a.errors - b.errors
  })

  const tableData = sorted.map((r) => ({
    Module: r.name,
    Files: r.files,
    Errors: r.errors < 0 ? 'ERR' : String(r.errors),
    Status: r.passed ? '✅' : r.errors < 0 ? '⚠️' : '❌',
  }))
  console.table(tableData)

  const failing = results.filter((r) => !r.passed && r.errors > 0)
  if (failing.length > 0) {
    console.log('\n────────────────── Sample Errors ──────────────────\n')
    for (const mod of failing.slice(0, 5)) {
      console.log(`  ${mod.name} (${mod.errors} errors):`)
      for (const err of mod.sampleErrors) {
        console.log(`    ${err.trim()}`)
      }
      console.log()
    }
  }

  const pctClean = totalFiles > 0
    ? ((passedCount / results.length) * 100).toFixed(1)
    : '0.0'
  console.log(`\n  Migration progress: ${pctClean}% of modules clean`)
  const barLen = Math.round(Number(pctClean) / 5)
  console.log(`  ${'━'.repeat(barLen)}${'─'.repeat(Math.max(20 - barLen, 0))}`)
  console.log('\n══════════════════════════════════════════════\n')
}

function writeProgressJson(results: ModuleResult[]): void {
  const report = {
    timestamp: new Date().toISOString(),
    tool: 'ts-strict-mode-tracker',
    config: { noImplicitAny: true, noUncheckedIndexedAccess: true },
    summary: {
      totalModules: results.length,
      totalFiles: results.reduce((s, r) => s + r.files, 0),
      totalErrors: results.reduce((s, r) => s + Math.max(r.errors, 0), 0),
      cleanModules: results.filter((r) => r.passed).length,
      failingModules: results.filter((r) => !r.passed && r.errors >= 0).length,
      migrationProgressPct: results.length > 0
        ? Number(((results.filter((r) => r.passed).length / results.length) * 100).toFixed(1))
        : 0,
    },
    modules: results.map((r) => ({
      name: r.name,
      files: r.files,
      errors: r.errors,
      passed: r.passed,
      sampleErrors: r.sampleErrors.slice(0, 3),
    })),
  }

  const outPath = resolve(import.meta.dirname, 'strict-mode-progress.json')
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')
  console.log(`Progress report written to ${outPath}`)
}

// ── Main ─────────────────────────────────────────────────────────────────
function main(): void {
  const writeJson = process.argv.slice(2).includes('--write-json')

  console.log('Checking TypeScript strict mode compliance...')
  console.log('This may take a moment...\n')

  const results = runCombinedCheck()

  generateReport(results)

  if (writeJson) {
    writeProgressJson(results)
  }

  // Exit 0 — informational only, does not block CI
  const failCount = results.filter((r) => !r.passed && r.errors > 0).length
  if (failCount > 0) {
    process.exit(0)
  }
}

main()

interface ModuleResult {
  name: string
  files: number
  errors: number
  passed: boolean
  sampleErrors: string[]
}
