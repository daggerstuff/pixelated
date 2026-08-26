import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  QueryAuditService,
  getQueryAuditService,
  resetQueryAuditService,
  type QueryAuditEntry,
} from '../lib/services/QueryAuditService'
import type { ResearchQuery, QueryResult } from '../types/research-types'

vi.mock('@/lib/utils/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

function makeQuery(overrides: Partial<ResearchQuery> = {}): ResearchQuery {
  return {
    id: 'q-test-001',
    type: 'aggregate-analysis',
    parameters: { test: 'value' },
    description: 'Test query',
    requiresApproval: false,
    anonymizationLevel: 'high',
    createdAt: new Date().toISOString(),
    createdBy: 'admin',
    ...overrides,
  }
}

function makeResult(overrides: Partial<QueryResult> = {}): QueryResult {
  return {
    queryId: 'q-test-001',
    status: 'success',
    data: [
      { emotion: 'joy', avg_score: 0.75, count: 120 },
      { emotion: 'sadness', avg_score: 0.32, count: 85 },
    ],
    metadata: {
      executionTime: 42,
      resultSize: 2,
      complexityScore: 15,
      cacheHit: false,
    },
    ...overrides,
  }
}

describe('QueryAuditService', () => {
  let service: QueryAuditService

  beforeEach(() => {
    resetQueryAuditService()
    service = new QueryAuditService()
  })

  describe('logQuery', () => {
    it('should log a query with all fields', () => {
      const query = makeQuery()
      const result = makeResult()

      const entry = service.logQuery(
        query,
        'admin',
        'admin',
        result,
        0.1,
        42,
        false,
      )

      expect(entry.auditId).toBeDefined()
      expect(entry.queryId).toBe('q-test-001')
      expect(entry.userId).toBe('admin')
      expect(entry.userRole).toBe('admin')
      expect(entry.queryType).toBe('aggregate-analysis')
      expect(entry.queryDescription).toBe('Test query')
      expect(entry.status).toBe('success')
      expect(entry.epsilon).toBe(0.1)
      expect(entry.executionTime).toBe(42)
      expect(entry.cacheHit).toBe(false)
    })

    it('should capture result shape with fields and data types', () => {
      const entry = service.logQuery(
        makeQuery(),
        'admin',
        'admin',
        makeResult(),
        0.1,
        42,
        false,
      )

      expect(entry.resultShape.rowCount).toBe(2)
      expect(entry.resultShape.fields).toContain('emotion')
      expect(entry.resultShape.fields).toContain('avg_score')
      expect(entry.resultShape.fields).toContain('count')
      expect(entry.resultShape.dataTypes).toContain('string')
      expect(entry.resultShape.dataTypes).toContain('number')
    })

    it('should handle empty result data', () => {
      const result = makeResult({ data: [] })
      const entry = service.logQuery(
        makeQuery(),
        'admin',
        'admin',
        result,
        0.1,
        10,
        false,
      )

      expect(entry.resultShape.rowCount).toBe(0)
      expect(entry.resultShape.fields).toHaveLength(0)
    })

    it('should handle null data', () => {
      const result = makeResult({ data: null })
      const entry = service.logQuery(
        makeQuery(),
        'admin',
        'admin',
        result,
        0.1,
        10,
        false,
      )

      expect(entry.resultShape.rowCount).toBe(0)
    })

    it('should handle object data (non-array)', () => {
      const result = makeResult({
        data: { total: 100, average: 0.55 },
      })
      const entry = service.logQuery(
        makeQuery(),
        'admin',
        'admin',
        result,
        0.1,
        10,
        false,
      )

      expect(entry.resultShape.rowCount).toBe(1)
      expect(entry.resultShape.fields).toContain('total')
      expect(entry.resultShape.fields).toContain('average')
    })

    it('should log error status', () => {
      const result = makeResult({
        status: 'error',
        error: 'Query failed',
        data: null,
      })
      const entry = service.logQuery(
        makeQuery(),
        'admin',
        'admin',
        result,
        0.1,
        5,
        false,
      )

      expect(entry.status).toBe('error')
      expect(entry.error).toBe('Query failed')
    })

    it('should log pending-approval status', () => {
      const result = makeResult({ status: 'pending-approval', data: null })
      const entry = service.logQuery(
        makeQuery(),
        'admin',
        'admin',
        result,
        0.1,
        3,
        false,
      )

      expect(entry.status).toBe('pending-approval')
    })

    it('should sanitize long parameter values', () => {
      const longValue = 'x'.repeat(200)
      const query = makeQuery({ parameters: { description: longValue } })
      const entry = service.logQuery(
        query,
        'admin',
        'admin',
        makeResult(),
        0.1,
        10,
        false,
      )

      expect(entry.parameters['description']).toHaveLength(103)
      expect(entry.parameters['description']).toContain('...')
    })

    it('should sanitize array parameters as array[length]', () => {
      const query = makeQuery({ parameters: { ids: ['a', 'b', 'c'] } })
      const entry = service.logQuery(
        query,
        'admin',
        'admin',
        makeResult(),
        0.1,
        10,
        false,
      )

      expect(entry.parameters['ids']).toBe('array[3]')
    })

    it('should sanitize object parameters as object', () => {
      const query = makeQuery({ parameters: { config: { nested: true } } })
      const entry = service.logQuery(
        query,
        'admin',
        'admin',
        makeResult(),
        0.1,
        10,
        false,
      )

      expect(entry.parameters['config']).toBe('object')
    })

    it('should record cache hit', () => {
      const entry = service.logQuery(
        makeQuery(),
        'admin',
        'admin',
        makeResult({ metadata: { cacheHit: true } }),
        0.1,
        5,
        true,
      )

      expect(entry.cacheHit).toBe(true)
    })

    it('should record custom epsilon', () => {
      const entry = service.logQuery(
        makeQuery(),
        'admin',
        'admin',
        makeResult(),
        0.5,
        10,
        false,
      )

      expect(entry.epsilon).toBe(0.5)
    })
  })

  describe('FIFO eviction', () => {
    it('should evict oldest entries when maxEntries exceeded', () => {
      for (let i = 0; i < 10001; i++) {
        const query = makeQuery({ id: 'q-' + i })
        service.logQuery(
          query,
          'admin',
          'admin',
          makeResult({ queryId: query.id }),
          0.1,
          1,
          false,
        )
      }

      const trail = service.getAuditTrail()
      expect(trail).toHaveLength(10000)
      // q-0 should have been evicted (oldest), q-10000 should be present (newest)
      expect(trail.find((e) => e.queryId === 'q-0')).toBeUndefined()
      expect(trail.find((e) => e.queryId === 'q-10000')).toBeDefined()
    })
  })

  describe('getAuditTrail', () => {
    it('should return entries sorted by timestamp descending', async () => {
      service.logQuery(
        makeQuery({ id: 'q1' }),
        'admin',
        'admin',
        makeResult(),
        0.1,
        1,
        false,
      )
      await new Promise((r) => setTimeout(r, 10))
      service.logQuery(
        makeQuery({ id: 'q2' }),
        'admin',
        'admin',
        makeResult(),
        0.1,
        1,
        false,
      )

      const trail = service.getAuditTrail()
      expect(trail[0].queryId).toBe('q2')
      expect(trail[1].queryId).toBe('q1')
    })

    it('should filter by userId', () => {
      service.logQuery(
        makeQuery({ id: 'q1' }),
        'admin',
        'admin',
        makeResult(),
        0.1,
        1,
        false,
      )
      service.logQuery(
        makeQuery({ id: 'q2' }),
        'researcher',
        'researcher',
        makeResult(),
        0.1,
        1,
        false,
      )

      const trail = service.getAuditTrail({ userId: 'admin' })
      expect(trail).toHaveLength(1)
      expect(trail[0].queryId).toBe('q1')
    })

    it('should filter by queryType', () => {
      service.logQuery(
        makeQuery({ id: 'q1', type: 'sql' }),
        'admin',
        'admin',
        makeResult(),
        0.1,
        1,
        false,
      )
      service.logQuery(
        makeQuery({ id: 'q2', type: 'pattern-discovery' }),
        'admin',
        'admin',
        makeResult(),
        0.1,
        1,
        false,
      )

      const trail = service.getAuditTrail({ queryType: 'sql' })
      expect(trail).toHaveLength(1)
      expect(trail[0].queryId).toBe('q1')
    })

    it('should filter by queryId', () => {
      service.logQuery(
        makeQuery({ id: 'target-id' }),
        'admin',
        'admin',
        makeResult(),
        0.1,
        1,
        false,
      )
      service.logQuery(
        makeQuery({ id: 'other-id' }),
        'admin',
        'admin',
        makeResult(),
        0.1,
        1,
        false,
      )

      const trail = service.getAuditTrail({ queryId: 'target-id' })
      expect(trail).toHaveLength(1)
      expect(trail[0].queryId).toBe('target-id')
    })

    it('should filter by date range', () => {
      const oldDate = '2020-01-01T00:00:00.000Z'
      const newDate = '2025-01-01T00:00:00.000Z'

      service.logQuery(
        makeQuery({ id: 'q-old' }),
        'admin',
        'admin',
        makeResult(),
        0.1,
        1,
        false,
      )
      const entries = (service as any).entries as QueryAuditEntry[]
      entries[0].timestamp = oldDate

      service.logQuery(
        makeQuery({ id: 'q-new' }),
        'admin',
        'admin',
        makeResult(),
        0.1,
        1,
        false,
      )
      entries[1].timestamp = newDate

      const trail = service.getAuditTrail({
        startDate: '2024-01-01T00:00:00.000Z',
      })
      expect(trail).toHaveLength(1)
      expect(trail[0].queryId).toBe('q-new')
    })
  })

  describe('getAuditStats', () => {
    it('should compute statistics from logged entries', () => {
      service.logQuery(
        makeQuery({ id: 'q1', type: 'sql' }),
        'admin',
        'admin',
        makeResult(),
        0.1,
        100,
        false,
      )
      service.logQuery(
        makeQuery({ id: 'q2', type: 'sql' }),
        'admin',
        'admin',
        makeResult({ metadata: { cacheHit: true } }),
        0.1,
        50,
        true,
      )
      service.logQuery(
        makeQuery({ id: 'q3', type: 'pattern-discovery' }),
        'admin',
        'admin',
        makeResult({ status: 'error', data: null }),
        0.2,
        10,
        false,
      )

      const stats = service.getAuditStats()

      expect(stats.totalQueries).toBe(3)
      expect(stats.successfulQueries).toBe(2)
      expect(stats.failedQueries).toBe(1)
      expect(stats.cacheHits).toBe(1)
      expect(stats.avgExecutionTime).toBe(53)
      expect(stats.queriesByType['sql']).toBe(2)
      expect(stats.queriesByType['pattern-discovery']).toBe(1)
      expect(stats.queriesByUser['admin']).toBe(3)
    })

    it('should handle empty audit trail', () => {
      const stats = service.getAuditStats()

      expect(stats.totalQueries).toBe(0)
      expect(stats.successfulQueries).toBe(0)
      expect(stats.avgExecutionTime).toBe(0)
    })

    it('should count pending approvals', () => {
      service.logQuery(
        makeQuery({ id: 'q1' }),
        'admin',
        'admin',
        makeResult({ status: 'pending-approval', data: null }),
        0.1,
        5,
        false,
      )

      const stats = service.getAuditStats()
      expect(stats.pendingApprovals).toBe(1)
    })
  })

  describe('clear', () => {
    it('should clear all entries', () => {
      service.logQuery(
        makeQuery(),
        'admin',
        'admin',
        makeResult(),
        0.1,
        10,
        false,
      )
      expect(service.getAuditTrail()).toHaveLength(1)

      service.clear()
      expect(service.getAuditTrail()).toHaveLength(0)
    })
  })

  describe('singleton', () => {
    it('should return same instance', () => {
      const a = getQueryAuditService()
      const b = getQueryAuditService()
      expect(a).toBe(b)
    })

    it('should reset singleton', () => {
      const a = getQueryAuditService()
      resetQueryAuditService()
      const b = getQueryAuditService()
      expect(a).not.toBe(b)
    })
  })
})

describe('QueryOutputFormatter', () => {
  let formatter: any

  beforeEach(async () => {
    const { getQueryOutputFormatter, resetQueryOutputFormatter } =
      await import('../lib/services/QueryOutputFormatter')
    resetQueryOutputFormatter()
    formatter = getQueryOutputFormatter()
  })

  it('should format as JSON', async () => {
    const result = makeResult()
    const formatted = formatter.format(result, 'json')

    expect(formatted.format).toBe('json')
    expect(formatted.mimeType).toBe('application/json')
    expect(formatted.filename).toContain('.json')
    const parsed = JSON.parse(formatted.content)
    expect(parsed.queryId).toBe('q-test-001')
  })

  it('should format as CSV', async () => {
    const result = makeResult()
    const formatted = formatter.format(result, 'csv')

    expect(formatted.format).toBe('csv')
    expect(formatted.mimeType).toBe('text/csv')
    expect(formatted.filename).toContain('.csv')
    expect(formatted.content).toContain('emotion')
    expect(formatted.content).toContain('avg_score')
    expect(formatted.content).toContain('count')
    expect(formatted.content).toContain('joy')
    expect(formatted.content).toContain('0.75')
  })

  it('should handle empty CSV data', async () => {
    const result = makeResult({ data: [] })
    const formatted = formatter.format(result, 'csv')

    expect(formatted.content).toContain('No data')
  })

  it('should escape CSV special characters', async () => {
    const result = makeResult({
      data: [{ text: 'hello, "world"', value: 1 }],
    })
    const formatted = formatter.format(result, 'csv')

    expect(formatted.content).toContain('"hello, ""world"""')
  })

  it('should format as summary', async () => {
    const result = makeResult()
    const formatted = formatter.format(result, 'summary', 'Test description')

    expect(formatted.format).toBe('summary')
    expect(formatted.mimeType).toBe('text/plain')
    expect(formatted.filename).toContain('.txt')
    expect(formatted.content).toContain('Research Query Summary')
    expect(formatted.content).toContain('Test description')
    expect(formatted.content).toContain('Query ID: q-test-001')
    expect(formatted.content).toContain('Status: success')
    expect(formatted.content).toContain('Record Count: 2')
    expect(formatted.content).toContain('HIPAA Compliance')
  })

  it('should include anonymization metrics in summary', async () => {
    const result = makeResult({
      metadata: {
        anonymizationAudit: {
          kAnonymity: 5,
          differentialPrivacyEpsilon: 0.1,
          noiseLevel: 0.05,
          suppressionRate: 12,
        },
      },
    })
    const formatted = formatter.format(result, 'summary')

    expect(formatted.content).toContain('K-Anonymity: 5')
    expect(formatted.content).toContain('Differential Privacy Epsilon: 0.1')
    expect(formatted.content).toContain('Suppression Rate: 12%')
  })

  it('should include error in summary', async () => {
    const result = makeResult({
      status: 'error',
      error: 'Something went wrong',
      data: null,
    })
    const formatted = formatter.format(result, 'summary')

    expect(formatted.content).toContain('Error: Something went wrong')
  })

  it('should include pending-approval note in summary', async () => {
    const result = makeResult({ status: 'pending-approval', data: null })
    const formatted = formatter.format(result, 'summary')

    expect(formatted.content).toContain('requires approval')
  })

  it('should compute numeric statistics in summary', async () => {
    const result = makeResult({
      data: [
        { score: 10, name: 'a' },
        { score: 20, name: 'b' },
        { score: 30, name: 'c' },
      ],
    })
    const formatted = formatter.format(result, 'summary')

    expect(formatted.content).toContain('avg=20.00')
    expect(formatted.content).toContain('min=10')
    expect(formatted.content).toContain('max=30')
  })

  it('should default to JSON for unknown format', async () => {
    const result = makeResult()
    const formatted = formatter.format(result, 'unknown' as any)

    expect(formatted.format).toBe('json')
  })
})

describe('QueryDSL', () => {
  beforeEach(async () => {
    const { resetQueryAuditService } =
      await import('../lib/services/QueryAuditService')
    resetQueryAuditService()
  })

  it('should convert DSL to SQL with filters', async () => {
    const { dslToSQL } = await import('../lib/services/QueryDSL')

    const sql = dslToSQL({
      filters: {
        sessionType: 'individual',
        dateRange: { start: '2024-01-01', end: '2024-12-31' },
        demographicSegment: { gender: 'female', ageRange: [25, 45] },
      },
      aggregations: [
        { field: 'emotion_score', function: 'avg', alias: 'avg_emotion' },
        { field: '*', function: 'count', alias: 'total' },
      ],
      groupBy: ['technique_type'],
      limit: 100,
    })

    expect(sql).toContain(
      'SELECT technique_type, AVG(emotion_score) AS avg_emotion',
    )
    expect(sql).toContain('FROM research_data')
    expect(sql).toContain('session_type = $1')
    expect(sql).toContain('created_at >= $2')
    expect(sql).toContain('created_at <= $3')
    expect(sql).toContain('age BETWEEN $4 AND $5')
    expect(sql).toContain('gender = $6')
    expect(sql).toContain('GROUP BY technique_type')
    expect(sql).toContain('LIMIT 100')
  })

  it('should create query from request with per-query epsilon', async () => {
    const { createQueryFromRequest } = await import('../lib/services/QueryDSL')

    const query = createQueryFromRequest(
      {
        description: 'Test query with custom epsilon',
        epsilon: 0.25,
        outputFormat: 'csv',
        anonymizationLevel: 'medium',
        dsl: {
          filters: { sessionType: 'group' },
          aggregations: [{ field: 'score', function: 'avg' }],
        },
      },
      'researcher-001',
    )

    expect(query.id).toBeDefined()
    expect(query.description).toBe('Test query with custom epsilon')
    expect(query.parameters['epsilon']).toBe(0.25)
    expect(query.parameters['outputFormat']).toBe('csv')
    expect(query.anonymizationLevel).toBe('medium')
    expect(query.type).toBe('aggregate-analysis')
    expect(query.createdBy).toBe('researcher-001')
    expect(query.sql).toContain('FROM research_data')
  })

  it('should use default values when not specified', async () => {
    const { createQueryFromRequest } = await import('../lib/services/QueryDSL')

    const query = createQueryFromRequest(
      { description: 'Minimal query' },
      'admin',
    )

    expect(query.type).toBe('aggregate-analysis')
    expect(query.anonymizationLevel).toBe('high')
    expect(query.parameters['outputFormat']).toBe('json')
    expect(query.requiresApproval).toBe(true)
  })

  it('should generate SQL with all filter types', async () => {
    const { dslToSQL } = await import('../lib/services/QueryDSL')

    const sql = dslToSQL({
      filters: {
        sessionType: 'individual',
        dateRange: { start: '2024-01-01', end: '2024-06-30' },
        outcomeMetric: 'improvement',
        demographicSegment: {
          ageRange: [18, 65],
          gender: 'all',
          ethnicity: 'sample',
          culturalBackground: 'western',
        },
        techniqueType: 'CBT',
        minConfidence: 0.8,
      },
      aggregations: [{ field: 'score', function: 'sum' }],
    })

    expect(sql).toContain('session_type')
    expect(sql).toContain('created_at')
    expect(sql).toContain('outcome_metric')
    expect(sql).toContain('age BETWEEN')
    expect(sql).toContain('gender')
    expect(sql).toContain('ethnicity')
    expect(sql).toContain('cultural_background')
    expect(sql).toContain('technique_type')
    expect(sql).toContain('confidence')
  })
})
