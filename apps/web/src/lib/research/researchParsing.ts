import {
  ConsentLevel,
  ResearchDataPoint,
  ResearchQuery,
} from '@/lib/research/types/research-types'
import { type DiscoveryRequest } from './services/PatternDiscoveryService'
import { type EvidenceRequest } from './services/EvidenceGenerationService'

export function toBoolean(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function toRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

export function parseDate(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return date
    }
  }
  return undefined
}

export function parseDateString(value: unknown): string | undefined {
  const date = parseDate(value)
  return date ? date.toISOString() : undefined
}

export function toNumberRecord(value: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!isRecord(value)) return out
  for (const [key, v] of Object.entries(value)) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = v
    }
  }
  return out
}

export function normalizeResearchData(data: unknown[]): ResearchDataPoint[] {
  return data
    .map((entry) => parseResearchDataPoint(entry))
    .filter((entry): entry is ResearchDataPoint => entry !== undefined)
}

export function extractClientIdsFromUnknownData(data: unknown[]): string[] {
  return normalizeResearchData(data).map((entry) => entry.clientId)
}

export function parseResearchDataPoint(
  entry: unknown,
): ResearchDataPoint | undefined {
  if (!isRecord(entry)) return undefined

  const timestamp = parseDate(entry['timestamp'])
  const sessionDuration =
    typeof entry['sessionDuration'] === 'number'
      ? entry['sessionDuration']
      : undefined
  if (
    typeof entry['id'] !== 'string' ||
    typeof entry['clientId'] !== 'string' ||
    typeof entry['sessionId'] !== 'string' ||
    !timestamp ||
    typeof sessionDuration !== 'number'
  ) {
    return undefined
  }

  return {
    id: entry['id'],
    clientId: entry['clientId'],
    sessionId: entry['sessionId'],
    timestamp,
    emotionScores: toNumberRecord(entry['emotionScores']),
    techniqueEffectiveness: toNumberRecord(
      entry['techniqueEffectiveness'],
    ),
    sessionDuration,
    age: asString(entry['age']),
    gender: asString(entry['gender']),
    location: asString(entry['location']),
    therapeuticApproach: asString(entry['therapeuticApproach']),
    outcomeScore:
      typeof entry['outcomeScore'] === 'number'
        ? entry['outcomeScore']
        : undefined,
    metadata: toRecord(entry['metadata']),
  }
}

export function parseResearchQuery(query: unknown): ResearchQuery | undefined {
  if (!isRecord(query)) return undefined

  const type = asString(query['type'])
  if (!type || !isResearchQueryType(type)) {
    return undefined
  }

  const anonymizationLevel = asString(query['anonymizationLevel'])
  if (!anonymizationLevel || !isAnonymizationLevel(anonymizationLevel)) {
    return undefined
  }

  return {
    id: asString(query['id']) ?? crypto.randomUUID(),
    type,
    sql: asString(query['sql']),
    parameters: toRecord(query['parameters']) ?? {},
    description: asString(query['description']) ?? '',
    context: asString(query['context']),
    expectedOutput: asString(query['expectedOutput']),
    requiresApproval: toBoolean(query['requiresApproval']),
    anonymizationLevel: anonymizationLevel,
    createdAt:
      parseDateString(query['createdAt']) ?? new Date().toISOString(),
    createdBy: asString(query['createdBy']) ?? 'system',
    approvedBy: asString(query['approvedBy']),
    approvedAt: parseDateString(query['approvedAt']),
  }
}

export function isResearchQueryType(value: string): value is ResearchQuery['type'] {
  return (
    value === 'sql' ||
    value === 'pattern-discovery' ||
    value === 'longitudinal-analysis' ||
    value === 'cohort-comparison' ||
    value === 'aggregate-analysis'
  )
}

export function isAnonymizationLevel(
  value: string,
): value is ResearchQuery['anonymizationLevel'] {
  return (
    value === 'none' ||
    value === 'low' ||
    value === 'medium' ||
    value === 'high'
  )
}

export function parseDiscoveryRequest(
  request: unknown,
): DiscoveryRequest | undefined {
  if (!isRecord(request)) return undefined

  const patternTypes = request['patternTypes']
  if (!Array.isArray(patternTypes) || patternTypes.length === 0)
    return undefined
  const parsedPatternTypes = patternTypes
    .map((type) => asString(type))
    .filter(
      (type): type is 'correlation' | 'trend' | 'anomaly' | 'cluster' =>
        type === 'correlation' ||
        type === 'trend' ||
        type === 'anomaly' ||
        type === 'cluster',
    )

  const metrics = request['metrics']
  if (!Array.isArray(metrics) || metrics.length === 0) return undefined
  const parsedMetrics = metrics.flatMap((metric) => {
    const parsed = asString(metric)
    return parsed === undefined ? [] : [parsed]
  })

  const timeRange = request['timeRange']
  if (!isRecord(timeRange)) return undefined
  const start = parseDate(timeRange['start'])
  const end = parseDate(timeRange['end'])
  if (!start || !end) return undefined

  if (parsedPatternTypes.length === 0 || parsedMetrics.length === 0)
    return undefined

  return {
    patternTypes: parsedPatternTypes,
    metrics: parsedMetrics,
    timeRange: { start, end },
    demographicFilters: toRecord(request['demographicFilters']),
    techniqueFilters: toRecord(request['techniqueFilters']),
  }
}

export function parseHypothesis(value: unknown):
  | {
      id: string
      statement: string
      variables: string[]
      expectedDirection: 'positive' | 'negative' | 'neutral'
      nullHypothesis: string
      alternativeHypothesis: string
    }
  | undefined {
  if (!isRecord(value)) return undefined
  const id = asString(value['id'])
  const statement = asString(value['statement'])
  const nullHypothesis = asString(value['nullHypothesis'])
  const alternativeHypothesis = asString(value['alternativeHypothesis'])
  const variables = value['variables']
  if (
    !id ||
    !statement ||
    !Array.isArray(variables) ||
    variables.length === 0 ||
    !nullHypothesis ||
    !alternativeHypothesis
  ) {
    return undefined
  }

  const parsedVariables = variables.flatMap((v) => {
    const parsed = asString(v)
    return parsed === undefined ? [] : [parsed]
  })
  if (parsedVariables.length === 0) return undefined

  const expectedDirection = asString(value['expectedDirection'])
  if (
    expectedDirection !== 'positive' &&
    expectedDirection !== 'negative' &&
    expectedDirection !== 'neutral'
  ) {
    return undefined
  }

  return {
    id,
    statement,
    variables: parsedVariables,
    expectedDirection,
    nullHypothesis,
    alternativeHypothesis,
  }
}

export function parseEvidenceRequest(request: unknown): EvidenceRequest | undefined {
  if (!isRecord(request)) return undefined
  const hypotheses = request['hypotheses']
  if (!Array.isArray(hypotheses) || hypotheses.length === 0) return undefined

  const parsedHypotheses = hypotheses
    .map((hypothesis) => parseHypothesis(hypothesis))
    .filter(
      (hypothesis): hypothesis is EvidenceRequest['hypotheses'][number] =>
        hypothesis !== undefined,
    )

  if (parsedHypotheses.length === 0) return undefined

  return {
    hypotheses: parsedHypotheses,
    dataFilters: toRecord(request['dataFilters']),
    timeRange: isRecord(request['timeRange'])
      ? {
          start: parseDate(request['timeRange']['start']) ?? new Date(0),
          end: parseDate(request['timeRange']['end']) ?? new Date(0),
        }
      : undefined,
    demographicFilters: toRecord(request['demographicFilters']),
    techniqueFilters: toRecord(request['techniqueFilters']),
  }
}

export function mapConsentLevelForAnonymization(
  level: string,
): 'minimal' | 'limited' | 'full' {
  const mapped = mapConsentLevel(level)
  return mapped === 'none' ? 'minimal' : mapped
}

export function mapConsentLevel(level: string): ConsentLevel {
  if (
    level === 'none' ||
    level === 'minimal' ||
    level === 'limited' ||
    level === 'full'
  ) {
    return level
  }

  if (level === 'high') return 'full'
  return 'minimal'
}
