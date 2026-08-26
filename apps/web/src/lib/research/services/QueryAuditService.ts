import { getLogger } from '@/lib/utils/logger'

import type { ResearchQuery, QueryResult } from '../types/research-types'

const logger = getLogger('QueryAuditService')

export interface QueryAuditEntry {
  auditId: string
  queryId: string
  userId: string
  userRole: string
  queryType: ResearchQuery['type']
  queryDescription: string
  parameters: Record<string, unknown>
  timestamp: string
  status: QueryResult['status']
  resultShape: {
    rowCount: number
    fields: string[]
    dataTypes: string[]
  }
  anonymizationLevel: ResearchQuery['anonymizationLevel']
  epsilon: number
  executionTime: number
  cacheHit: boolean
  error?: string
}

export class QueryAuditService {
  private readonly entries: QueryAuditEntry[] = []
  private readonly maxEntries = 10000

  logQuery(
    query: ResearchQuery,
    userId: string,
    userRole: string,
    result: QueryResult,
    epsilon: number,
    executionTime: number,
    cacheHit: boolean,
  ): QueryAuditEntry {
    const data = result.data
    const isArray = Array.isArray(data)
    const rowCount = isArray ? data.length : data ? 1 : 0

    const fields: string[] = []
    const dataTypes: string[] = []

    if (isArray && data.length > 0 && typeof data[0] === 'object' && data[0]) {
      const firstRow = data[0] as Record<string, unknown>
      for (const [key, value] of Object.entries(firstRow)) {
        fields.push(key)
        dataTypes.push(typeof value)
      }
    } else if (data && typeof data === 'object' && !isArray) {
      for (const [key, value] of Object.entries(
        data as Record<string, unknown>,
      )) {
        fields.push(key)
        dataTypes.push(typeof value)
      }
    }

    const entry: QueryAuditEntry = {
      auditId: crypto.randomUUID(),
      queryId: query.id,
      userId,
      userRole,
      queryType: query.type,
      queryDescription: query.description,
      parameters: this.sanitizeParameters(query.parameters),
      timestamp: new Date().toISOString(),
      status: result.status,
      resultShape: { rowCount, fields, dataTypes },
      anonymizationLevel: query.anonymizationLevel,
      epsilon,
      executionTime,
      cacheHit,
      error: result.error,
    }

    this.entries.push(entry)

    if (this.entries.length > this.maxEntries) {
      this.entries.shift()
    }

    logger.info('Query audit logged', {
      auditId: entry.auditId,
      queryId: entry.queryId,
      userId,
      status: entry.status,
    })

    return entry
  }

  getAuditTrail(filter?: {
    userId?: string
    queryId?: string
    queryType?: ResearchQuery['type']
    startDate?: string
    endDate?: string
  }): QueryAuditEntry[] {
    let results = [...this.entries]

    if (filter?.userId) {
      results = results.filter((e) => e.userId === filter.userId)
    }
    if (filter?.queryId) {
      results = results.filter((e) => e.queryId === filter.queryId)
    }
    if (filter?.queryType) {
      results = results.filter((e) => e.queryType === filter.queryType)
    }
    if (filter?.startDate) {
      results = results.filter((e) => e.timestamp >= filter.startDate!)
    }
    if (filter?.endDate) {
      results = results.filter((e) => e.timestamp <= filter.endDate!)
    }

    return results.sort((a, b) => {
      const cmp = b.timestamp.localeCompare(a.timestamp)
      return cmp !== 0 ? cmp : b.auditId.localeCompare(a.auditId)
    })
  }

  getAuditStats(): {
    totalQueries: number
    successfulQueries: number
    failedQueries: number
    pendingApprovals: number
    cacheHits: number
    avgExecutionTime: number
    queriesByType: Record<string, number>
    queriesByUser: Record<string, number>
  } {
    const total = this.entries.length
    const successful = this.entries.filter((e) => e.status === 'success').length
    const failed = this.entries.filter((e) => e.status === 'error').length
    const pending = this.entries.filter(
      (e) => e.status === 'pending-approval',
    ).length
    const cached = this.entries.filter((e) => e.cacheHit).length

    const byType: Record<string, number> = {}
    const byUser: Record<string, number> = {}
    let totalExecTime = 0

    for (const entry of this.entries) {
      byType[entry.queryType] = (byType[entry.queryType] ?? 0) + 1
      byUser[entry.userId] = (byUser[entry.userId] ?? 0) + 1
      totalExecTime += entry.executionTime
    }

    return {
      totalQueries: total,
      successfulQueries: successful,
      failedQueries: failed,
      pendingApprovals: pending,
      cacheHits: cached,
      avgExecutionTime: total > 0 ? Math.round(totalExecTime / total) : 0,
      queriesByType: byType,
      queriesByUser: byUser,
    }
  }

  private sanitizeParameters(
    params: Record<string, unknown>,
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        sanitized[key] =
          value.length > 100 ? value.slice(0, 100) + '...' : value
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value
      } else if (Array.isArray(value)) {
        sanitized[key] = `array[${value.length}]`
      } else if (value && typeof value === 'object') {
        sanitized[key] = 'object'
      } else {
        sanitized[key] = String(value)
      }
    }
    return sanitized
  }

  clear(): void {
    this.entries.length = 0
  }
}

let singleton: QueryAuditService | null = null

export function getQueryAuditService(): QueryAuditService {
  singleton ??= new QueryAuditService()
  return singleton
}

export function resetQueryAuditService(): void {
  singleton = null
}
