/* @vitest-environment node */

/**
 * N+1 query detection tests.
 *
 * These exercise the query-counting instrumentation used to catch N+1 patterns
 * in DB-backed operations. They assert on the detector's behavior with real
 * recorded queries (both a bounded query set and a genuine N+1 pattern), so the
 * tooling is proven to fire on the bug it exists to catch.
 */

import { describe, expect, it } from 'vitest'

import {
  assertNoNPlusOne,
  createQueryReport,
  detectNPlusOne,
  isQueryScopeActive,
  normalizeSql,
  recordQuery,
  withQueryScope,
} from '../query-counting'

describe('normalizeSql', () => {
  it('collapses whitespace', () => {
    expect(normalizeSql('SELECT  *\n  FROM users')).toBe('select * from users')
  })

  it('replaces single-quoted literals with a placeholder', () => {
    expect(normalizeSql("SELECT * FROM users WHERE name = 'alice'")).toBe(
      'select * from users where name = ?',
    )
  })

  it('replaces numeric literals and positional placeholders', () => {
    expect(normalizeSql('SELECT * FROM users WHERE id = $1 AND age > 30')).toBe(
      'select * from users where id = ? and age > ?',
    )
  })

  it('groups queries that differ only by literal values', () => {
    const a = normalizeSql("SELECT * FROM sessions WHERE therapist_id = 't1'")
    const b = normalizeSql("SELECT * FROM sessions WHERE therapist_id = 't2'")
    expect(a).toBe(b)
  })
})

describe('withQueryScope / recordQuery', () => {
  it('records queries executed inside the scope', async () => {
    const { report } = await withQueryScope('list-users', async () => {
      recordQuery('SELECT * FROM users')
      recordQuery('SELECT * FROM institutions')
      return 'ok'
    })

    expect(report.name).toBe('list-users')
    expect(report.total).toBe(2)
    expect(report.counts['select * from users']).toBe(1)
  })

  it('returns the callback result unchanged', async () => {
    const { result } = await withQueryScope('compute', async () => 42)
    expect(result).toBe(42)
  })

  it('does not record queries outside a scope', () => {
    expect(isQueryScopeActive()).toBe(false)
    // Should be a safe no-op rather than throwing.
    expect(() => recordQuery('SELECT 1')).not.toThrow()
  })

  it('reports the active scope to callers', async () => {
    await withQueryScope('inner', async () => {
      expect(isQueryScopeActive()).toBe(true)
    })
  })

  it('isolates concurrent scopes from each other', async () => {
    const [a, b] = await Promise.all([
      withQueryScope('a', async () => {
        await Promise.resolve()
        recordQuery("SELECT * FROM users WHERE id = 'a'")
        await Promise.resolve()
        recordQuery('SELECT * FROM sessions')
      }),
      withQueryScope('b', async () => {
        await Promise.resolve()
        recordQuery("SELECT * FROM users WHERE id = 'b'")
      }),
    ])

    expect(a.report.name).toBe('a')
    expect(a.report.total).toBe(2)
    expect(b.report.name).toBe('b')
    expect(b.report.total).toBe(1)
  })
})

describe('detectNPlusOne', () => {
  it('returns no findings for a bounded query set', async () => {
    const { report } = await withQueryScope('bounded', async () => {
      recordQuery('SELECT * FROM users')
      recordQuery('SELECT * FROM institutions')
      recordQuery('SELECT * FROM scenarios')
    })

    expect(detectNPlusOne(report)).toEqual([])
  })

  it('flags a classic N+1 pattern (same query per row)', async () => {
    const { report } = await withQueryScope(
      'list-with-n-plus-one',
      async () => {
        recordQuery('SELECT * FROM users')
        for (let i = 0; i < 5; i += 1) {
          recordQuery(`SELECT * FROM sessions WHERE user_id = '${i}'`)
        }
      },
    )

    const findings = detectNPlusOne(report)
    expect(findings).toHaveLength(1)
    expect(findings[0]?.occurrences).toBe(5)
    // Literals differ but normalize to the same query.
    expect(findings[0]?.normalized).toContain(
      'select * from sessions where user_id = ?',
    )
    expect(findings[0]?.samples).toHaveLength(3)
  })

  it('respects a raised threshold for intentionally repeated queries', async () => {
    const { report } = await withQueryScope('batch-write', async () => {
      for (let i = 0; i < 3; i += 1)
        recordQuery(`INSERT INTO audit_log VALUES (${i})`)
    })

    expect(detectNPlusOne(report, 1)).toHaveLength(1)
    expect(detectNPlusOne(report, 3)).toEqual([])
  })

  it('orders findings by descending occurrence count', async () => {
    const { report } = await withQueryScope('mixed', async () => {
      for (let i = 0; i < 2; i += 1)
        recordQuery(`SELECT a FROM t WHERE id = ${i}`)
      for (let i = 0; i < 6; i += 1)
        recordQuery(`SELECT b FROM t WHERE id = ${i}`)
    })

    const findings = detectNPlusOne(report)
    expect(findings.map((f) => f.occurrences)).toEqual([6, 2])
  })
})

describe('assertNoNPlusOne', () => {
  it('passes for a bounded query set', async () => {
    const { report } = await withQueryScope('ok', async () => {
      recordQuery('SELECT * FROM users')
    })
    expect(() => assertNoNPlusOne(report)).not.toThrow()
  })

  it('throws a descriptive error naming the repeated query', async () => {
    const { report } = await withQueryScope('bad', async () => {
      recordQuery('SELECT * FROM users')
      for (let i = 0; i < 4; i += 1) {
        recordQuery(`SELECT * FROM sessions WHERE user_id = '${i}'`)
      }
    })

    expect(() => assertNoNPlusOne(report)).toThrowError(/N\+1 query pattern/)
    expect(() => assertNoNPlusOne(report)).toThrowError(/4x/)
  })
})

describe('createQueryReport', () => {
  it('creates an empty report with the given name', () => {
    const report = createQueryReport('empty')
    expect(report).toMatchObject({
      name: 'empty',
      total: 0,
      counts: {},
      queries: [],
    })
  })
})
