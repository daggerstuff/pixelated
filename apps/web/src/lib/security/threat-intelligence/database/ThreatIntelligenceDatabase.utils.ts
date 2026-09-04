/**
 * Threat intelligence database helpers — validation, query building, and
 * single-field DB/Redis operations extracted from ThreatIntelligenceDatabase.ts.
 */

import type { Db } from 'mongodb'
import type Redis from 'ioredis'
import type { GlobalThreatIntelligence } from '../global/types'
import type { SearchQuery } from './threat-intelligence-database.types'

export function validateThreatData(threat: GlobalThreatIntelligence): void {
  if (!threat.threatId || !threat.intelligenceId || !threat.globalThreatId) {
    throw new Error('Invalid threat data: missing required IDs')
  }

  if (!threat.regions || threat.regions.length === 0) {
    throw new Error('Invalid threat data: no regions specified')
  }

  if (!['low', 'medium', 'high', 'critical'].includes(threat.severity)) {
    throw new Error('Invalid threat data: invalid severity level')
  }

  if (threat.confidence < 0 || threat.confidence > 1) {
    throw new Error('Invalid threat data: confidence must be between 0 and 1')
  }
}

export function buildSearchQuery(query: SearchQuery): Record<string, unknown> {
  const searchQuery: Record<string, unknown> = {}

  if (query.threatId) {
    searchQuery['threatId'] = query.threatId
  }

  if (query.intelligenceId) {
    searchQuery['intelligenceId'] = query.intelligenceId
  }

  if (query.globalThreatId) {
    searchQuery['globalThreatId'] = query.globalThreatId
  }

  if (query.regions && query.regions.length > 0) {
    searchQuery['regions'] = { $in: query.regions }
  }

  if (query.severity) {
    searchQuery['severity'] = query.severity
  }

  if (
    query.confidence &&
    (query.confidence.min !== undefined || query.confidence.max !== undefined)
  ) {
    const confidenceFilter: Record<string, number> = {}
    if (query.confidence.min !== undefined) {
      confidenceFilter['$gte'] = query.confidence.min
    }
    if (query.confidence.max !== undefined) {
      confidenceFilter['$lte'] = query.confidence.max
    }
    searchQuery['confidence'] = confidenceFilter
  }

  if (query.timeRange) {
    const firstSeenFilter: Record<string, Date> = {}
    if (query.timeRange.start) {
      firstSeenFilter['$gte'] = new Date(query.timeRange.start)
    }
    if (query.timeRange.end) {
      firstSeenFilter['$lte'] = new Date(query.timeRange.end)
    }
    searchQuery['firstSeen'] = firstSeenFilter
  }

  if (
    query.indicators &&
    (query.indicators.types || query.indicators.values)
  ) {
    const orConditions: Record<string, unknown>[] = []

    if (query.indicators.types && query.indicators.types.length > 0) {
      orConditions.push({
        'indicators.indicatorType': { $in: query.indicators.types },
      })
    }

    if (query.indicators.values && query.indicators.values.length > 0) {
      orConditions.push({
        'indicators.value': { $in: query.indicators.values },
      })
    }

    searchQuery['$or'] = orConditions
  }

  return searchQuery
}

export async function storeThreatIndicators(
  db: Db,
  threat: GlobalThreatIntelligence,
): Promise<void> {
  try {
    const indicatorsCollection = db.collection('threat_indicators')

    // Store each indicator separately for efficient querying
    for (const indicator of threat.indicators) {
      const indicatorDoc = {
        ...indicator,
        threatId: threat.threatId,
        intelligenceId: threat.intelligenceId,
        globalThreatId: threat.globalThreatId,
        storedAt: new Date(),
      }

      await indicatorsCollection.replaceOne(
        {
          threatId: threat.threatId,
          indicatorId: indicator.indicatorId,
        },
        indicatorDoc,
        { upsert: true },
      )
    }
  } catch (error: unknown) {
    logger.error('Failed to store threat indicators:', { error })
    throw error
  }
}

export async function initializeTAXIICollections(
  db: Db,): Promise<void> {
  try {
    const taxiiCollection = db.collection('taxii_collections')

    // Create default TAXII collections
    const defaultCollections = [
      {
        id: 'threat-intelligence',
        title: 'Threat Intelligence',
        description: 'General threat intelligence data',
        can_read: true,
        can_write: false,
        media_types: ['application/stix+json;version=2.1'],
        created: new Date(),
        modified: new Date(),
      },
      {
        id: 'malware-indicators',
        title: 'Malware Indicators',
        description: 'Indicators of compromise and malware signatures',
        can_read: true,
        can_write: false,
        media_types: ['application/stix+json;version=2.1'],
        created: new Date(),
        modified: new Date(),
      },
      {
        id: 'attack-patterns',
        title: 'Attack Patterns',
        description: 'Common attack patterns and techniques',
        can_read: true,
        can_write: false,
        media_types: ['application/stix+json;version=2.1'],
        created: new Date(),
        modified: new Date(),
      },
    ]

    for (const collection of defaultCollections) {
      await taxiiCollection.replaceOne({ id: collection.id }, collection, {
        upsert: true,
      })
    }

    // Create TAXII objects collection
    const taxiiObjectsCollection = db.collection('taxii_objects')
    await taxiiObjectsCollection.createIndex({ id: 1 }, { unique: true })
    await taxiiObjectsCollection.createIndex({ collection_id: 1 })
    await taxiiObjectsCollection.createIndex({ type: 1 })
    await taxiiObjectsCollection.createIndex({ created: 1 })

    logger.info('TAXII collections initialized successfully')
  } catch (error: unknown) {
    logger.error('Failed to initialize TAXII collections:', { error })
    throw error
  }
}

export async function checkMongoDBHealth(
  db: Db,): Promise<boolean> {
  try {
    await db.admin().ping()
    return true
  } catch (error: unknown) {
    logger.error('MongoDB health check failed:', { error })
    return false
  }
}

export async function checkRedisHealth(
  redis: Redis,): Promise<boolean> {
  try {
    const result = await redis.ping()
    return result === 'PONG'
  } catch (error: unknown) {
    logger.error('Redis health check failed:', { error })
    return false
  }
}

export async function cacheThreatIntelligence(
  redis: Redis,
  threat: GlobalThreatIntelligence,
): Promise<void> {
  try {
    // Cache main threat data
    const cacheKey = `threat:${threat.threatId}`
    const cacheData = {
      threatId: threat.threatId,
      intelligenceId: threat.intelligenceId,
      globalThreatId: threat.globalThreatId,
      severity: threat.severity,
      confidence: threat.confidence,
      regions: threat.regions,
      firstSeen: threat.firstSeen,
      lastSeen: threat.lastSeen,
    }

    await redis.setex(cacheKey, 3600, JSON.stringify(cacheData)) // 1 hour TTL

    // Cache by intelligence ID
    const intelligenceCacheKey = `intelligence:${threat.intelligenceId}`
    await redis.setex(
      intelligenceCacheKey,
      3600,
      JSON.stringify(cacheData),
    )

    // Cache by global threat ID
    const globalCacheKey = `global_threat:${threat.globalThreatId}`
    await redis.setex(globalCacheKey, 3600, JSON.stringify(cacheData))
  } catch (error: unknown) {
    logger.error('Failed to cache threat intelligence:', { error })
  }
}
