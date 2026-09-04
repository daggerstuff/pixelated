/**
 * ThreatHuntingSystem.intelligence.ts
 * Extracted threat intelligence generation, storage, and notification functions.
 */

import type { Db } from 'mongodb'
import type Redis from 'ioredis'
import type {
  HuntExecution,
  HuntPattern,
  HuntResult,
  GlobalThreatIntelligence,
  ThreatIndicator,
} from '../global/types'
import type { RawHuntFinding, ThreatNotification } from './ThreatHuntingSystem.types'
import {
  generateThreatId,
  generateThreatKey,
  deduplicateThreats,
  mapResultToThreatType,
  normalizeSeverity,
  toDate,
  toStringValue,
} from './ThreatHuntingSystem.utils'
import { createBuildSafeLogger } from '../../../logging/build-safe-logger'

const logger = createBuildSafeLogger('threat-hunting-intelligence')

export async function generateThreatIntelligence(
  results: RawHuntFinding[],
  pattern: HuntPattern,
  execution: HuntExecution,
): Promise<GlobalThreatIntelligence[]> {
  try {
    logger.info('Generating threat intelligence from hunt results', {
      resultCount: results.length,
      patternId: pattern.patternId,
    })

    const threats: GlobalThreatIntelligence[] = []

    for (const result of results) {
      if (result.confidence >= 0.7) {
        const threat = await createThreatFromResult(result, pattern, execution)
        if (threat) {
          threats.push(threat)
        }
      }
    }

    const uniqueThreats = deduplicateThreats(threats)

    logger.info(`Generated ${uniqueThreats.length} unique threats from hunt results`)
    return uniqueThreats
  } catch (error: unknown) {
    logger.error('Threat intelligence generation failed:', { error })
    return []
  }
}

async function createThreatFromResult(
  result: RawHuntFinding,
  pattern: HuntPattern,
  execution: HuntExecution,
): Promise<GlobalThreatIntelligence | null> {
  try {
    const threatId = generateThreatId()
    const indicators = extractIndicatorsFromResult(result)

    if (indicators.length === 0) {
      return null
    }

    const threat: GlobalThreatIntelligence = {
      intelligenceId: threatId,
      threatId,
      threatType: mapResultToThreatType(result),
      severity: normalizeSeverity(result.severity),
      confidence: result.confidence,
      indicators,
      firstSeen: toDate(result.timestamp),
      lastSeen: toDate(result.timestamp),
      regions: execution.regions,
      impactAssessment: {
        geographicSpread: execution.regions.length,
        affectedRegions: execution.regions,
        affectedSectors: [],
        potentialImpact: result.confidence * 100,
      },
      correlationData: {
        correlationId: execution.executionId,
        correlatedThreats: [],
        correlationStrength: result.confidence,
        correlationType: 'hunting',
        confidence: result.confidence,
        analysisMethod: 'pattern_match',
        timestamp: toDate(result.timestamp),
      },
      validationStatus: {
        validationId: `validation_${execution.executionId}`,
        status: 'pending',
        accuracy: result.confidence,
        completeness: result.confidence,
        consistency: 1,
        timeliness: 1,
        relevance: result.confidence,
        validator: 'system',
        validationDate: toDate(result.timestamp),
        feedback: [],
      },
      attribution: {
        family: pattern.name,
        campaign: `hunt_${pattern.patternId}`,
        confidence: result.confidence,
      },
      metadata: {
        source: 'threat_hunting',
        huntId: execution.huntId,
        patternId: pattern.patternId,
        resultType: result.type,
        analysisMethod: 'automated',
      },
    }

    return threat
  } catch (error: unknown) {
    logger.error('Failed to create threat from result:', { error })
    return null
  }
}

function extractIndicatorsFromResult(result: RawHuntFinding): ThreatIndicator[] {
  const indicators: ThreatIndicator[] = []

  try {
    const sourceIp = toStringValue(result.data['sourceIp'])
    if (sourceIp) {
      indicators.push({
        indicatorType: 'ip',
        value: sourceIp,
        confidence: result.confidence,
        firstSeen: toDate(result.timestamp),
        lastSeen: toDate(result.timestamp),
      })
    }

    const destinationIp = toStringValue(result.data['destinationIp'])
    if (destinationIp) {
      indicators.push({
        indicatorType: 'ip',
        value: destinationIp,
        confidence: result.confidence,
        firstSeen: toDate(result.timestamp),
        lastSeen: toDate(result.timestamp),
      })
    }

    const fileHash = toStringValue(result.data['fileHash'])
    if (fileHash) {
      indicators.push({
        indicatorType: 'file_hash',
        value: fileHash,
        confidence: result.confidence,
        firstSeen: toDate(result.timestamp),
        lastSeen: toDate(result.timestamp),
      })
    }

    const domainName = toStringValue(result.data['domainName'])
    if (domainName) {
      indicators.push({
        indicatorType: 'domain',
        value: domainName,
        confidence: result.confidence,
        firstSeen: toDate(result.timestamp),
        lastSeen: toDate(result.timestamp),
      })
    }

    const url = toStringValue(result.data['url'])
    if (url) {
      indicators.push({
        indicatorType: 'url',
        value: url,
        confidence: result.confidence,
        firstSeen: toDate(result.timestamp),
        lastSeen: toDate(result.timestamp),
      })
    }

    const processName = toStringValue(result.data['processName'])
    if (processName) {
      indicators.push({
        indicatorType: 'process',
        value: processName,
        confidence: result.confidence,
        firstSeen: toDate(result.timestamp),
        lastSeen: toDate(result.timestamp),
      })
    }

    return indicators
  } catch (error: unknown) {
    logger.error('Failed to extract indicators from result:', { error })
    return []
  }
}

export async function storeHuntResults(
  db: Db,
  huntResult: HuntResult,
  threats: GlobalThreatIntelligence[],
): Promise<void> {
  try {
    const resultsCollection = db.collection<HuntResult>('hunt_results')
    await resultsCollection.insertOne(huntResult)

    if (threats.length > 0) {
      const threatsCollection = db.collection('discovered_threats')
      const mappedThreats = threats.map((threat) => ({
        ...threat,
        discoveryMethod: 'hunting',
        executionId: huntResult.executionId,
        storedAt: new Date(),
      }))
      await threatsCollection.insertMany(mappedThreats)
    }

    logger.info('Hunt results stored successfully', {
      executionId: huntResult.executionId,
      resultCount: 1,
      threatCount: threats.length,
    })
  } catch (error: unknown) {
    logger.error('Failed to store hunt results:', { error })
    throw error
  }
}

export async function storeHuntExecution(
  db: Db,
  execution: HuntExecution,
): Promise<void> {
  try {
    const executionsCollection = db.collection<HuntExecution>('hunt_executions')
    await executionsCollection.insertOne(execution)
  } catch (error: unknown) {
    logger.error('Failed to store hunt execution:', { error })
    throw error
  }
}

export async function updateHuntExecution(
  db: Db,
  execution: HuntExecution,
): Promise<void> {
  try {
    const executionsCollection = db.collection<HuntExecution>('hunt_executions')
    await executionsCollection.updateOne(
      { executionId: execution.executionId },
      { $set: execution },
    )
  } catch (error: unknown) {
    logger.error('Failed to update hunt execution:', { error })
    throw error
  }
}

export async function sendThreatNotifications(
  threats: GlobalThreatIntelligence[],
): Promise<void> {
  try {
    for (const threat of threats) {
      const notification: ThreatNotification = {
        type: 'threat_discovered',
        threatId: threat.threatId,
        severity: threat.severity,
        confidence: threat.confidence,
        indicatorCount: threat.indicators.length,
        timestamp: new Date(),
      }

      if (threat.severity === 'critical' || threat.severity === 'high') {
        await sendHighPriorityNotification(notification)
      } else {
        await sendStandardNotification(notification)
      }
    }
  } catch (error: unknown) {
    logger.error('Failed to send threat notifications:', { error })
  }
}

async function sendHighPriorityNotification(
  notification: ThreatNotification,
): Promise<void> {
  logger.info('Sending high priority threat notification', notification)
}

async function sendStandardNotification(
  notification: ThreatNotification,
): Promise<void> {
  logger.info('Sending standard threat notification', notification)
}

export async function integrateWithGlobalIntelligence(
  redis: Redis,
  threats: GlobalThreatIntelligence[],
): Promise<void> {
  try {
    for (const threat of threats) {
      await redis.publish('threat_intelligence', JSON.stringify(threat))
    }

    logger.info('Threats integrated with global intelligence', {
      threatCount: threats.length,
    })
  } catch (error: unknown) {
    logger.error('Failed to integrate with global intelligence:', { error })
  }
}
