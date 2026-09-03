import type { ResearchQuery } from '../types/research-types'

export interface QueryFilter {
  sessionType?: string
  dateRange?: { start: string; end: string }
  outcomeMetric?: string
  demographicSegment?: {
    ageRange?: [number, number]
    gender?: string
    ethnicity?: string
    culturalBackground?: string
  }
  techniqueType?: string
  minConfidence?: number
}

export interface QueryDSL {
  filters: QueryFilter
  aggregations: QueryAggregation[]
  groupBy?: string[]
  sortBy?: { field: string; direction: 'asc' | 'desc' }
  limit?: number
}

export interface QueryAggregation {
  field: string
  function: 'avg' | 'sum' | 'count' | 'min' | 'max' | 'stddev' | 'median'
  alias?: string
}

export interface ResearchQueryRequest {
  description: string
  dsl?: QueryDSL
  type?: ResearchQuery['type']
  anonymizationLevel?: ResearchQuery['anonymizationLevel']
  epsilon?: number
  outputFormat?: 'json' | 'csv' | 'summary'
  requiresApproval?: boolean
}

const ALLOWED_AGG_FUNCTIONS = new Set([
  'avg',
  'sum',
  'count',
  'min',
  'max',
  'stddev',
  'median',
])

const ALLOWED_FIELDS = new Set([
  'session_type',
  'outcome_metric',
  'age',
  'gender',
  'ethnicity',
  'cultural_background',
  'technique_type',
  'confidence',
  'created_at',
  'session_id',
  'user_id',
  'emotion_scores',
  'technique_effectiveness',
])

const ALLOWED_SORT_DIRECTIONS = new Set(['asc', 'desc'])

function validateFieldName(field: string): string {
  if (!ALLOWED_FIELDS.has(field)) {
    throw new Error(`Disallowed field name in query: ${field}`)
  }
  return field
}

function validateIdentifier(name: string, label: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid ${label}: ${name}`)
  }
  return name
}

export function dslToSQL(dsl: QueryDSL): string {
  const selectParts: string[] = []
  const whereParts: string[] = []
  const params: string[] = []
  let paramIdx = 1

  for (const agg of dsl.aggregations) {
    if (!ALLOWED_AGG_FUNCTIONS.has(agg.function)) {
      throw new Error(`Disallowed aggregation function: ${agg.function}`)
    }
    validateFieldName(agg.field)
    const alias = agg.alias
      ? validateIdentifier(agg.alias, 'alias')
      : `${agg.function}_${agg.field}`
    selectParts.push(`${agg.function.toUpperCase()}(${agg.field}) AS ${alias}`)
  }

  if (dsl.groupBy) {
    for (const field of dsl.groupBy) {
      validateFieldName(field)
      selectParts.unshift(field)
    }
  }

  const f = dsl.filters
  if (f.sessionType) {
    whereParts.push(`session_type = $${paramIdx++}`)
    params.push(f.sessionType)
  }
  if (f.dateRange) {
    whereParts.push(`created_at >= $${paramIdx++}`)
    params.push(f.dateRange.start)
    whereParts.push(`created_at <= $${paramIdx++}`)
    params.push(f.dateRange.end)
  }
  if (f.outcomeMetric) {
    whereParts.push(`outcome_metric = $${paramIdx++}`)
    params.push(f.outcomeMetric)
  }
  if (f.demographicSegment?.ageRange) {
    whereParts.push(`age BETWEEN $${paramIdx++} AND $${paramIdx++}`)
    params.push(String(f.demographicSegment.ageRange[0]))
    params.push(String(f.demographicSegment.ageRange[1]))
  }
  if (f.demographicSegment?.gender) {
    whereParts.push(`gender = $${paramIdx++}`)
    params.push(f.demographicSegment.gender)
  }
  if (f.demographicSegment?.ethnicity) {
    whereParts.push(`ethnicity = $${paramIdx++}`)
    params.push(f.demographicSegment.ethnicity)
  }
  if (f.demographicSegment?.culturalBackground) {
    whereParts.push(`cultural_background = $${paramIdx++}`)
    params.push(f.demographicSegment.culturalBackground)
  }
  if (f.techniqueType) {
    whereParts.push(`technique_type = $${paramIdx++}`)
    params.push(f.techniqueType)
  }
  if (f.minConfidence !== undefined) {
    whereParts.push(`confidence >= $${paramIdx++}`)
    params.push(String(f.minConfidence))
  }

  const selectClause = selectParts.length > 0 ? selectParts.join(', ') : '*'
  const whereClause =
    whereParts.length > 0 ? ' WHERE ' + whereParts.join(' AND ') : ''

  let sql = `SELECT ${selectClause} FROM research_data${whereClause}`

  if (dsl.groupBy) {
    for (const field of dsl.groupBy) {
      validateFieldName(field)
    }
    sql += ` GROUP BY ${dsl.groupBy.join(', ')}`
  }

  if (dsl.sortBy) {
    validateFieldName(dsl.sortBy.field)
    const direction = ALLOWED_SORT_DIRECTIONS.has(dsl.sortBy.direction)
      ? dsl.sortBy.direction.toUpperCase()
      : 'ASC'
    sql += ` ORDER BY ${dsl.sortBy.field} ${direction}`
  }

  if (dsl.limit !== undefined && dsl.limit > 0) {
    sql += ` LIMIT ${Math.min(Math.floor(dsl.limit), 10000)}`
  }

  return sql
}

export function createQueryFromRequest(
  req: ResearchQueryRequest,
  userId: string,
): ResearchQuery {
  const type = req.type ?? 'aggregate-analysis'
  const anonymizationLevel = req.anonymizationLevel ?? 'high'
  const epsilon = req.epsilon
  const outputFormat = req.outputFormat ?? 'json'

  const parameters: Record<string, unknown> = {}
  if (req.dsl) {
    parameters['dsl'] = req.dsl
    parameters['outputFormat'] = outputFormat
    if (epsilon !== undefined) {
      parameters['epsilon'] = epsilon
    }
  }
  if (epsilon !== undefined) {
    parameters['epsilon'] = epsilon
  }
  parameters['outputFormat'] = outputFormat

  return {
    id: crypto.randomUUID(),
    type,
    sql: req.dsl ? dslToSQL(req.dsl) : undefined,
    parameters,
    description: req.description,
    requiresApproval: req.requiresApproval ?? true,
    anonymizationLevel,
    createdAt: new Date().toISOString(),
    createdBy: userId,
  }
}
