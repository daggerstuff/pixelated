/**
 * Query-count instrumentation and N+1 detection.
 *
 * Problem: N+1 query patterns (one query to fetch a list, then one query per
 * item) are invisible in unit tests and only show up as latency in production.
 * This module makes them detectable in tests and at runtime by counting the
 * queries executed inside a named logical operation and flagging repeats of the
 * same normalized query.
 *
 * Design:
 * - `withQueryScope(name, fn)` runs a callback and records every query the
 *   callback (and anything it awaits) executes via `recordQuery`.
 * - `recordQuery(sql)` normalizes the SQL (whitespace + literal values
 *   collapsed) and increments the counter for the active scope.
 * - `detectNPlusOne(report, threshold)` returns the queries that repeated more
 *   often than `threshold` inside a single scope.
 *
 * The scope is tracked with `AsyncLocalStorage` so concurrent async operations
 * do not bleed into each other, and so callers do not have to thread a context
 * object through every function.
 *
 * Usage in a test:
 *
 *   const report = await withQueryScope('listUsers', async () =>
 *     userManager.getAll(),
 *   )
 *   expect(detectNPlusOne(report)).toEqual([])
 */

import { AsyncLocalStorage } from 'node:async_hooks'

/** A single occurrence of a query recorded within a scope. */
export interface RecordedQuery {
  /** Normalized SQL — literals replaced with `?`, whitespace collapsed. */
  normalized: string
  /** The original SQL text, for diagnostics. */
  sql: string
  /** Monotonic sequence number within the scope. */
  sequence: number
}

/** Aggregated report for one query scope. */
export interface QueryReport {
  /** Scope name supplied by the caller. */
  name: string
  /** Every query recorded, in execution order. */
  queries: RecordedQuery[]
  /** Total number of queries executed in the scope. */
  total: number
  /** Normalized query -> number of executions. */
  counts: Record<string, number>
  /** Wall-clock duration in milliseconds. */
  durationMs: number
}

/** A suspected N+1 pattern: the same normalized query repeated many times. */
export interface NPlusOneFinding {
  normalized: string
  occurrences: number
  /** Up to 3 example SQL strings for the repeated query. */
  samples: string[]
}

const storage = new AsyncLocalStorage<{
  name: string
  queries: RecordedQuery[]
  startedAt: number
}>()

/**
 * Normalize SQL so that queries differing only in their literal parameters
 * group together. Collapses whitespace and replaces string / numeric literals
 * with `?`.
 */
export function normalizeSql(sql: string): string {
  return sql
    .replace(/'[^']*'/g, '?') // single-quoted string literals
    .replace(/\$\d+/g, '?') // $1, $2 placeholders (pg native)
    .replace(/\b\d+\b/g, '?') // numeric literals
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Record a query against the currently active scope. No-op when called outside
 * a `withQueryScope` block, so it is safe to call unconditionally from the DB
 * layer with negligible overhead.
 */
export function recordQuery(sql: string): void {
  const scope = storage.getStore()
  if (!scope) return
  scope.queries.push({
    normalized: normalizeSql(sql),
    sql,
    sequence: scope.queries.length,
  })
}

/** True when a query scope is currently active on this async context. */
export function isQueryScopeActive(): boolean {
  return storage.getStore() !== undefined
}

/**
 * Run `fn` inside a named query scope, recording every query executed via
 * `recordQuery`, and return both the callback result and the query report.
 */
export async function withQueryScope<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<{ result: T; report: QueryReport }> {
  const scope = { name, queries: [] as RecordedQuery[], startedAt: Date.now() }
  const result = await storage.run(scope, fn)
  return {
    result,
    report: {
      name,
      queries: scope.queries,
      total: scope.queries.length,
      counts: countByNormalized(scope.queries),
      durationMs: Date.now() - scope.startedAt,
    },
  }
}

function countByNormalized(queries: RecordedQuery[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const query of queries) {
    counts[query.normalized] = (counts[query.normalized] ?? 0) + 1
  }
  return counts
}

/**
 * Identify N+1 patterns in a report: any normalized query executed more than
 * `threshold` times within the single scope. Default threshold is 1, meaning a
 * query that runs twice or more is flagged — appropriate for a call that is
 * expected to issue a bounded number of distinct queries.
 *
 * Callers that legitimately repeat a query (e.g. batched writes) can raise the
 * threshold explicitly.
 */
export function detectNPlusOne(
  report: QueryReport,
  threshold = 1,
): NPlusOneFinding[] {
  const findings: NPlusOneFinding[] = []
  for (const [normalized, occurrences] of Object.entries(report.counts)) {
    if (occurrences <= threshold) continue
    const samples = report.queries
      .filter((query) => query.normalized === normalized)
      .slice(0, 3)
      .map((query) => query.sql.trim())
    findings.push({ normalized, occurrences, samples })
  }
  return findings.sort((a, b) => b.occurrences - a.occurrences)
}

/**
 * Assert-friendly helper: throws when an N+1 pattern is detected, with a
 * message that names the repeated query and its count.
 */
export function assertNoNPlusOne(report: QueryReport, threshold = 1): void {
  const findings = detectNPlusOne(report, threshold)
  if (findings.length === 0) return
  const details = findings
    .map((f) => `  ${f.occurrences}x  ${f.normalized}`)
    .join('\n')
  throw new Error(
    `N+1 query pattern detected in scope "${report.name}" ` +
      `(${report.total} queries total):\n${details}\n` +
      'Batch the repeated query with an IN (...) clause or a JOIN.',
  )
}

/** Reset helper for tests that need to assert on a clean slate. */
export function createQueryReport(name: string): QueryReport {
  return {
    name,
    queries: [],
    total: 0,
    counts: {},
    durationMs: 0,
  }
}
