/**
 * External threat intelligence helpers — pure transforms + DB/stat queries
 * extracted from external-threat-intelligence.ts.
 */

import type { AxiosInstance } from 'axios'
import type { MongoClient, Db } from 'mongodb'
import type { ThreatResponse } from '../response-orchestration'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type {
  ThreatIntelligenceConfig,
  ThreatIntelligenceFeed,
  ThreatIntelligence,
  ThreatIntelligenceQuery,
  ThreatIntelligenceResult,
} from './external-threat-intelligence.types'

const logger = createBuildSafeLogger('external-threat-intelligence')

export function addRateLimitingInterceptor(
  client: AxiosInstance,
  feed: ThreatIntelligenceFeed,
): void {
  let requestQueue: (() => Promise<void>)[] = []
  let processing = false

  const processQueue = async () => {
    if (processing || requestQueue.length === 0) {
      return
    }

    processing = true
    const request = requestQueue.shift()

    if (request) {
      try {
        await request()
      } catch (error: unknown) {
        logger.error('Rate limited request failed:', {
          error,
          feed: feed.name,
        })
      }
    }

    processing = false

    // Schedule next request
    const delay = 60000 / feed.rateLimit.requestsPerMinute // milliseconds between requests
    setTimeout(processQueue, delay)
  }

  client.interceptors.request.use(async (config) => {
    return new Promise((resolve) => {
      requestQueue.push(async () => {
        resolve(config)
      })

      void processQueue()
    })
  })
}

export function mapSeverity(severity: string): ThreatIntelligence['severity'] {
  const severityMap: Record<string, ThreatIntelligence['severity']> = {
    low: 'low',
    medium: 'medium',
    high: 'high',
    critical: 'critical',
    info: 'low',
    warning: 'medium',
    error: 'high',
    severe: 'critical',
  }

  return severityMap[severity.toLowerCase()] ?? 'medium'
}

export function extractConfidence(confidence: unknown): number {
  if (typeof confidence === 'number') {
    return Math.max(0, Math.min(1, confidence / 100)) // Convert percentage to 0-1
  }

  if (typeof confidence === 'string') {
    const num = parseFloat(confidence)
    if (!isNaN(num)) {
      return Math.max(0, Math.min(1, num / 100))
    }
  }

  return 0.5 // Default confidence
}

export async function queryDatabase(
  mongoClient: MongoClient,
  query: ThreatIntelligenceQuery,
): Promise<ThreatIntelligenceResult> {
  try {
    const db = mongoClient.db('threat_detection')
    const filter: Record<string, unknown> = {}

    // Build query filter
    if (query.iocType) {
      filter['iocType'] = query.iocType
    }

    if (query.iocValue) {
      filter['iocValue'] = query.iocValue
    }

    if (query.threatType) {
      filter['threatType'] = query.threatType
    }

    if (query.severity) {
      filter['severity'] = query.severity
    }

    if (query.tags && query.tags.length > 0) {
      filter['tags'] = { $in: query.tags }
    }

    if (query.source) {
      filter['source'] = query.source
    }

    if (query.timeRange) {
      filter['lastSeen'] = {
        $gte: query.timeRange.start,
        $lte: query.timeRange.end,
      }
    }

    // Add expiration filter
    filter['$or'] = [
      { expirationDate: { $exists: false } },
      { expirationDate: { $gt: new Date() } },
    ]

    const intelligence = await db
      .collection('threat_intelligence')
      .find(filter)
      .sort({ confidence: -1, lastSeen: -1 })
      .limit(100)
      .toArray()

    const sources = Array.from(
      new Set(
        intelligence.map(
          (i: Record<string, unknown>) => i['feedName'] as string,
        ),
      ),
    )

    return {
      intelligence: intelligence as unknown as ThreatIntelligence[],
      totalCount: intelligence.length,
      sources,
      queryTime: new Date(),
      cacheHit: false,
    }
  } catch (error: unknown) {
    logger.error('Failed to query database:', { error })
    return {
      intelligence: [],
      totalCount: 0,
      sources: [],
      queryTime: new Date(),
      cacheHit: false,
    }
  }
}

export function matchesQuery(
  intel: Partial<ThreatIntelligence>,
  query: ThreatIntelligenceQuery,
): boolean {
  if (query.threatType && intel.threatType !== query.threatType) {
    return false
  }

  if (query.severity && intel.severity !== query.severity) {
    return false
  }

  if (query.source && intel.source !== query.source) {
    return false
  }

  if (query.tags && query.tags.length > 0) {
    const intelTags = intel.tags ?? []
    const hasMatchingTag = query.tags.some((tag) => intelTags.includes(tag))
    if (!hasMatchingTag) {
      return false
    }
  }

  return true
}

export function extractIOCsFromResponse(
  threatResponse: ThreatResponse,
): Array<{ type: string; value: string }> {
  const iocs: Array<{ type: string; value: string }> = []

  try {
    // Extract from actions
    for (const action of threatResponse.actions) {
      if (action.actionType === 'ip_block' && action.parameters['sourceIp']) {
        iocs.push({
          type: 'ip',
          value: action.parameters['sourceIp'] as string,
        })
      }

      if (
        action.actionType === 'domain_block' &&
        action.parameters['domain']
      ) {
        iocs.push({
          type: 'domain',
          value: action.parameters['domain'] as string,
        })
      }
    }

    // Extract from metadata
    if (threatResponse.metadata?.['ip']) {
      iocs.push({
        type: 'ip',
        value: threatResponse.metadata['ip'] as string,
      })
    }

    if (threatResponse.metadata?.['userAgent']) {
      iocs.push({
        type: 'user_agent',
        value: threatResponse.metadata['userAgent'] as string,
      })
    }
  } catch (error: unknown) {
    logger.error('Failed to extract IOCs from response:', {
      error,
      responseId: threatResponse.responseId,
    })
  }

  return iocs
}

export async function getFeedStatistics(
  config: ThreatIntelligenceConfig,
  db: Db,
): Promise<
  Record<string, { total: number; active: number; lastUpdate: Date }>
> {
  const feedStats: Record<
    string,
    { total: number; active: number; lastUpdate: Date }
  > = {}

  for (const feed of config.feeds) {
    if (!feed.enabled) {
      continue
    }

    const [total, active, lastUpdate] = await Promise.all([
      db
        .collection('threat_intelligence')
        .countDocuments({ feedName: feed.name }),
      db.collection('threat_intelligence').countDocuments({
        feedName: feed.name,
        $or: [
          { expirationDate: { $exists: false } },
          { expirationDate: { $gt: new Date() } },
        ],
      }),
      db
        .collection('threat_intelligence')
        .findOne({ feedName: feed.name }, { sort: { lastSeen: -1 } }),
    ])

    feedStats[feed.name] = {
      total,
      active,
      lastUpdate: lastUpdate?.['lastSeen'] ?? new Date(0),
    }
  }

  return feedStats
}

export async function getTopThreatTypes(
  db: Db,
): Promise<Array<{ type: string; count: number }>> {
  const pipeline = [
    {
      $group: {
        _id: '$threatType',
        count: { $sum: 1 },
      },
    },
    {
      $sort: { count: -1 },
    },
    {
      $limit: 10,
    },
    {
      $project: {
        type: '$_id',
        count: 1,
        _id: 0,
      },
    },
  ]

  const results = (await db
    .collection('threat_intelligence')
    .aggregate(pipeline)
    .toArray()) as unknown as Array<{ type: string; count: number }>

  return results
}

export async function getSeverityDistribution(
  db: Db,
): Promise<Record<string, number>> {
  const pipeline = [
    {
      $group: {
        _id: '$severity',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        severity: '$_id',
        count: 1,
        _id: 0,
      },
    },
  ]

  const results = (await db
    .collection('threat_intelligence')
    .aggregate(pipeline)
    .toArray()) as unknown as Array<{ severity: string; count: number }>

  const distribution: Record<string, number> = {}
  for (const result of results) {
    distribution[result.severity] = result.count
  }

  return distribution
}

export async function syncWithVirusTotal(): Promise<void> {
  // Implementation for VirusTotal API integration
  logger.info('Syncing with VirusTotal')
}

export async function syncWithAbuseIPDB(): Promise<void> {
  // Implementation for AbuseIPDB API integration
  logger.info('Syncing with AbuseIPDB')
}

export async function syncWithAlienVault(): Promise<void> {
  // Implementation for AlienVault OTX API integration
  logger.info('Syncing with AlienVault OTX')
}
