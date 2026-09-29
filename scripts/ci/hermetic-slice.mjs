#!/usr/bin/env node
/**
 * Shared runner for the hermetic test-slice audits.
 *
 * The full Vitest corpus is not hermetic: it needs Redis/Mongo/Auth0 and hangs
 * in CI (see .github/workflows/ci.yml). The reliability audits — flaky-test
 * detection, isolation/order-independence, and the coverage ratchet — all run
 * the same bounded slice of pure unit-test directories instead, so they can
 * run anywhere, repeatedly, and their results stay comparable.
 *
 * This module is the single definition of that slice and of how a run is
 * executed and parsed, so the audits cannot drift apart.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const ROOT = resolve(import.meta.dirname, '../..')
export const VITEST_BIN = resolve(ROOT, 'node_modules/.bin/vitest')

/**
 * Hermetic slice of pure unit-test directories. Chosen because they run
 * without Redis/Mongo/Auth0 and cover the heaviest pure-JS work (image
 * processing, logging, audit chains, DB helpers).
 */
export const HERMETIC_TEST_TARGETS = [
  'apps/web/src/lib/db',
  'apps/web/src/lib/logging',
  'apps/web/src/lib/audit',
  'apps/web/src/lib/utils',
]

/** Coverage scopes matching the slice, for the coverage ratchet. */
export const HERMETIC_COVERAGE_INCLUDES = HERMETIC_TEST_TARGETS.map(
  (target) => `--coverage.include=${target}/**`,
)

/**
 * Run vitest. Returns the process exit code instead of throwing on failure:
 * the audits need the report even when tests fail, because a failing test is
 * data (it may be the flake or the order-dependence under investigation).
 */
export function runVitest(args) {
  try {
    execFileSync(VITEST_BIN, args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test' },
    })
    return 0
  } catch (error) {
    return Number(error.status ?? 1)
  }
}

/**
 * Run the slice and write a JSON report.
 *
 * `--bail=0` matters in CI, where the config sets `bail: 10` for the main
 * test job; bail would truncate the report after 10 failures and hide the
 * remaining outcomes the audits need to compare.
 */
export function runVitestJson(reportPath, extraArgs = []) {
  mkdirSync(resolve(reportPath, '..'), { recursive: true })
  return runVitest([
    'run',
    '-c',
    'config/vitest.config.ts',
    ...HERMETIC_TEST_TARGETS,
    '--coverage.enabled=false',
    '--reporter=json',
    `--outputFile=${reportPath}`,
    '--bail=0',
    ...extraArgs,
  ])
}

/**
 * Read per-test and per-file outcomes from a vitest JSON report.
 *
 * File-level outcomes are included separately: a file that fails to import
 * produces no assertion results, and import-order dependence is exactly the
 * kind of isolation violation the isolation audit looks for.
 *
 * @returns {{ tests: Array<{name: string, file: string, status: string}>, files: Array<{file: string, status: string}> }}
 */
export function readTestOutcomes(reportPath) {
  const report = JSON.parse(readFileSync(reportPath, 'utf8'))
  /** @type {Array<{name: string, file: string, status: string}>} */
  const tests = []
  /** @type {Array<{file: string, status: string}>} */
  const files = []
  for (const file of report.testResults ?? []) {
    const rel = String(file.name).replace(`${ROOT}/`, '')
    files.push({ file: rel, status: String(file.status ?? 'unknown') })
    for (const assertion of file.assertionResults ?? []) {
      tests.push({
        name: assertion.fullName ?? assertion.title ?? '(unnamed)',
        file: rel,
        status: String(assertion.status ?? 'unknown'),
      })
    }
  }
  return { tests, files }
}
