#!/usr/bin/env node
/**
 * Coverage Audit — Per-Module Coverage Report Generator
 *
 * Reads vitest coverage output and generates a per-module breakdown
 * matching the 18 modules tracked in PIX-1901.
 *
 * Usage:
 *   pnpm tsx scripts/ci/coverage-audit.ts
 *   pnpm tsx scripts/ci/coverage-audit.ts --write-json
 *
 * Prerequisites:
 *   Run `VITEST_COVERAGE_ENABLED=true pnpm vitest run -c config/vitest.config.ts`
 *   to generate coverage/coverage-final.json first.
 *
 * Output: console table + optional scripts/ci/coverage-audit-report.json
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const COVERAGE_FILE = resolve(ROOT, 'coverage/coverage-final.json')

const MODULES = [
  { name: 'lib/encryption', pattern: 'apps/web/src/lib/encryption', priority: 'P0' },
  { name: 'lib/security', pattern: 'apps/web/src/lib/security', priority: 'P0' },
  { name: 'lib/logging', pattern: 'apps/web/src/lib/logging', priority: 'P0' },
  { name: 'middleware', pattern: 'apps/web/src/middleware', priority: 'P0' },
  { name: 'config', pattern: 'apps/web/src/config', priority: 'P0' },
  { name: 'lib/auth', pattern: 'apps/web/src/lib/auth', priority: 'P1' },
  { name: 'lib/audit', pattern: 'apps/web/src/lib/audit', priority: 'P1' },
  { name: 'lib/db', pattern: 'apps/web/src/lib/db', priority: 'P1' },
  { name: 'lib/memory', pattern: 'apps/web/src/lib/memory', priority: 'P1' },
  { name: 'types', pattern: 'apps/web/src/types', priority: 'P1' },
  { name: 'lib/ehr-native', pattern: 'apps/web/src/lib/ehr-native', priority: 'P2' },
  { name: 'lib/fhe', pattern: 'apps/web/src/lib/fhe', priority: 'P2' },
  { name: 'hooks', pattern: 'apps/web/src/hooks', priority: 'P2' },
  { name: 'utils', pattern: 'apps/web/src/utils', priority: 'P2' },
  { name: 'lib/ai', pattern: 'apps/web/src/lib/ai', priority: 'P3' },
  { name: 'lib/services', pattern: 'apps/web/src/lib/services', priority: 'P3' },
  { name: 'components', pattern: 'apps/web/src/components', priority: 'P3' },
  { name: 'pages/api', pattern: 'apps/web/src/pages/api', priority: 'P3' },
]

interface ModuleCoverage {
  name: string
  priority: string
  files: number
  statements: { total: number; covered: number; pct: number }
  functions: { total: number; covered: number; pct: number }
  branches: { total: number; covered: number; pct: number }
  lines: { total: number; covered: number; pct: number }
}

function calculateModuleCoverage(
  coverageData: Record<string, {
    s?: Record<string, number>
    f?: Record<string, number>
    b?: Record<string, number[]>
  }>,
  modulePattern: string,
): ModuleCoverage {
  const moduleFiles = Object.keys(coverageData).filter(
    (file) => file.includes(modulePattern) && !file.includes('.test.') && !file.includes('__tests__'),
  )

  let totalStatements = 0
  let coveredStatements = 0
  let totalFunctions = 0
  let coveredFunctions = 0
  let totalBranches = 0
  let coveredBranches = 0

  for (const file of moduleFiles) {
    const fileData = coverageData[file]
    if (!fileData) continue

    const statements = fileData.s ?? {}
    const statementCounts = Object.values(statements)
    totalStatements += statementCounts.length
    coveredStatements += statementCounts.filter((c) => c > 0).length

    const functions = fileData.f ?? {}
    const functionCounts = Object.values(functions)
    totalFunctions += functionCounts.length
    coveredFunctions += functionCounts.filter((c) => c > 0).length

    const branches = fileData.b ?? {}
    for (const branchArr of Object.values(branches)) {
      if (Array.isArray(branchArr)) {
        totalBranches += branchArr.length
        coveredBranches += branchArr.filter((c) => c > 0).length
      }
    }
  }

  const pct = (covered: number, total: number) =>
    total > 0 ? Math.round((covered / total) * 1000) / 10 : 0

  return {
    name: modulePattern.replace('apps/web/src/', ''),
    priority: MODULES.find((m) => m.pattern === modulePattern)?.priority ?? 'P3',
    files: moduleFiles.length,
    statements: {
      total: totalStatements,
      covered: coveredStatements,
      pct: pct(coveredStatements, totalStatements),
    },
    functions: {
      total: totalFunctions,
      covered: coveredFunctions,
      pct: pct(coveredFunctions, totalFunctions),
    },
    branches: {
      total: totalBranches,
      covered: coveredBranches,
      pct: pct(coveredBranches, totalBranches),
    },
    lines: {
      total: totalStatements,
      covered: coveredStatements,
      pct: pct(coveredStatements, totalStatements),
    },
  }
}

function generateReport(modules: ModuleCoverage[]): void {
  console.log('\n══════════════════════════════════════════════')
  console.log('  Coverage Audit — Per-Module Breakdown')
  console.log('══════════════════════════════════════════════\n')

  const totalFiles = modules.reduce((s, m) => s + m.files, 0)
  const totalStatements = modules.reduce((s, m) => s + m.statements.total, 0)
  const coveredStatements = modules.reduce((s, m) => s + m.statements.covered, 0)
  const overallPct = totalStatements > 0
    ? Math.round((coveredStatements / totalStatements) * 1000) / 10
    : 0

  console.log(`  Total Files: ${totalFiles}`)
  console.log(`  Overall Coverage: ${overallPct}%`)
  console.log(`  Target: ≥70% (security baseline)`)
  console.log('\n────────────────── Module Breakdown ──────────────────\n')

  const tableData = modules.map((m) => ({
    Module: m.name,
    Priority: m.priority,
    Files: m.files,
    Statements: `${m.statements.pct}%`,
    Functions: `${m.functions.pct}%`,
    Branches: `${m.branches.pct}%`,
  }))
  console.table(tableData)

  const passing = modules.filter((m) => m.statements.pct >= 55)
  const failing = modules.filter((m) => m.statements.pct < 55 && m.files > 0)

  console.log('\n────────────────── Summary ──────────────────\n')
  console.log(`  ✅ Passing (≥55%): ${passing.length} modules`)
  console.log(`  ❌ Failing (<55%): ${failing.length} modules`)

  if (failing.length > 0) {
    console.log('\n  Failing modules:')
    for (const m of failing) {
      console.log(`    - ${m.name} (${m.priority}): ${m.statements.pct}%`)
    }
  }

  console.log('\n══════════════════════════════════════════════\n')
}

function writeReportJson(modules: ModuleCoverage[]): void {
  const report = {
    timestamp: new Date().toISOString(),
    tool: 'coverage-audit',
    coverageFile: COVERAGE_FILE,
    summary: {
      totalModules: modules.length,
      totalFiles: modules.reduce((s, m) => s + m.files, 0),
      overallCoveragePct: modules.reduce((s, m) => s + m.statements.covered, 0) /
        Math.max(1, modules.reduce((s, m) => s + m.statements.total, 0)) * 100,
      passingModules: modules.filter((m) => m.statements.pct >= 55).length,
      failingModules: modules.filter((m) => m.statements.pct < 55 && m.files > 0).length,
    },
    modules: modules.map((m) => ({
      name: m.name,
      priority: m.priority,
      files: m.files,
      statements: m.statements,
      functions: m.functions,
      branches: m.branches,
    })),
  }

  const outPath = resolve(import.meta.dirname, 'coverage-audit-report.json')
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')
  console.log(`Report written to ${outPath}`)
}

function main(): void {
  const writeJson = process.argv.slice(2).includes('--write-json')

  if (!existsSync(COVERAGE_FILE)) {
    console.error(`Error: Coverage file not found at ${COVERAGE_FILE}`)
    console.error('Run: VITEST_COVERAGE_ENABLED=true pnpm vitest run -c config/vitest.config.ts')
    process.exit(1)
  }

  console.log('Reading coverage data...')
  const coverageData = JSON.parse(readFileSync(COVERAGE_FILE, 'utf8'))

  const modules = MODULES.map((mod) =>
    calculateModuleCoverage(coverageData, mod.pattern),
  )

  generateReport(modules)

  if (writeJson) {
    writeReportJson(modules)
  }
}

main()