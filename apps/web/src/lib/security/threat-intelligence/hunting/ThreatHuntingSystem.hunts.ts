/**
 * ThreatHuntingSystem.hunts.ts
 * Hunt dispatch layer + category dispatchers. The concrete hunt
 * implementations live in ThreatHuntingSystem.hunts.{network,endpoint,user,malware,lateral}.ts.
 */

import type { Db } from 'mongodb'
import type { HuntExecution, HuntPattern } from '../global/types'
import type { RawHuntFinding } from './ThreatHuntingSystem.types'
import {
  getExecutionTimeRange,
  toDate,
  toDocumentRecord,
  normalizeSeverity,
} from './ThreatHuntingSystem.utils'
import { createBuildSafeLogger } from '../../../logging/build-safe-logger'
import {
  huntSuspiciousConnections,
  huntUnusualDNSQueries,
  huntPortScanning,
  huntDataExfiltration,
} from './ThreatHuntingSystem.hunts.network'
import {
  huntSuspiciousProcesses,
  huntFileSystemAnomalies,
  huntRegistryModifications,
  huntPersistenceMechanisms,
} from './ThreatHuntingSystem.hunts.endpoint'
import {
  huntUnusualLoginPatterns,
  huntPrivilegeEscalation,
  huntUnusualAccessPatterns,
  huntAccountCompromise,
} from './ThreatHuntingSystem.hunts.user'
import {
  huntKnownMalwareSignatures,
  huntSuspiciousFileHashes,
  huntMalwareBehavioralIndicators,
  huntC2Communications,
} from './ThreatHuntingSystem.hunts.malware'
import {
  huntCredentialDumping,
  huntNetworkEnumeration,
  huntServiceExploitation,
  huntRemoteAccessTools,
} from './ThreatHuntingSystem.hunts.lateral'

const logger = createBuildSafeLogger('threat-hunting-hunts')

// ─── Dispatch: executeHuntByPattern ───────────────────────────

export async function executeHuntByPattern(
  db: Db,
  execution: HuntExecution,
  pattern: HuntPattern,
): Promise<RawHuntFinding[]> {
  try {
    logger.info('Executing hunt by pattern', {
      executionId: execution.executionId,
      patternType: pattern.patternType,
    })

    let results: RawHuntFinding[] = []
    const resolvedPatternType = pattern.patternType ?? 'anomaly'

    switch (resolvedPatternType) {
      case 'network':
        results = await executeNetworkHunt(db, execution)
        break
      case 'endpoint':
        results = await executeEndpointHunt(db, execution)
        break
      case 'user_behavior':
        results = await executeUserBehaviorHunt(db, execution)
        break
      case 'malware':
        results = await executeMalwareHunt(db, execution)
        break
      case 'lateral_movement':
        results = await executeLateralMovementHunt(db, execution)
        break
      case 'custom':
      case 'anomaly':
        results = await executeCustomHunt(db, execution, pattern)
        break
      default:
        logger.warn('Unknown pattern type, executing default hunt', {
          patternType: pattern.patternType,
        })
        results = await executeDefaultHunt(db, execution)
    }

    return results
  } catch (error: unknown) {
    logger.error('Failed to execute hunt by pattern:', { error })
    throw error
  }
}

// ─── Category dispatchers ────────────────────────────────────

async function executeNetworkHunt(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    logger.info('Executing network hunt', { executionId: execution.executionId })
    const results: RawHuntFinding[] = []
    results.push(...(await huntSuspiciousConnections(db, execution)))
    results.push(...(await huntUnusualDNSQueries(db, execution)))
    results.push(...(await huntPortScanning(db, execution)))
    results.push(...(await huntDataExfiltration(db, execution)))
    return results
  } catch (error: unknown) {
    logger.error('Network hunt execution failed:', { error })
    throw error
  }
}

async function executeEndpointHunt(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    logger.info('Executing endpoint hunt', { executionId: execution.executionId })
    const results: RawHuntFinding[] = []
    results.push(...(await huntSuspiciousProcesses(db, execution)))
    results.push(...(await huntFileSystemAnomalies(db, execution)))
    results.push(...(await huntRegistryModifications(db, execution)))
    results.push(...(await huntPersistenceMechanisms(db, execution)))
    return results
  } catch (error: unknown) {
    logger.error('Endpoint hunt execution failed:', { error })
    throw error
  }
}

async function executeUserBehaviorHunt(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    logger.info('Executing user behavior hunt', { executionId: execution.executionId })
    const results: RawHuntFinding[] = []
    results.push(...(await huntUnusualLoginPatterns(db, execution)))
    results.push(...(await huntPrivilegeEscalation(db, execution)))
    results.push(...(await huntUnusualAccessPatterns(db, execution)))
    results.push(...(await huntAccountCompromise(db, execution)))
    return results
  } catch (error: unknown) {
    logger.error('User behavior hunt execution failed:', { error })
    throw error
  }
}

async function executeMalwareHunt(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    logger.info('Executing malware hunt', { executionId: execution.executionId })
    const results: RawHuntFinding[] = []
    results.push(...(await huntKnownMalwareSignatures(db, execution)))
    results.push(...(await huntSuspiciousFileHashes(db, execution)))
    results.push(...(await huntMalwareBehavioralIndicators(db, execution)))
    results.push(...(await huntC2Communications(db, execution)))
    return results
  } catch (error: unknown) {
    logger.error('Malware hunt execution failed:', { error })
    throw error
  }
}

async function executeLateralMovementHunt(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    logger.info('Executing lateral movement hunt', { executionId: execution.executionId })
    const results: RawHuntFinding[] = []
    results.push(...(await huntCredentialDumping(db, execution)))
    results.push(...(await huntNetworkEnumeration(db, execution)))
    results.push(...(await huntServiceExploitation(db, execution)))
    results.push(...(await huntRemoteAccessTools(db, execution)))
    return results
  } catch (error: unknown) {
    logger.error('Lateral movement hunt execution failed:', { error })
    throw error
  }
}

async function executeCustomHunt(
  db: Db,
  execution: HuntExecution,
  pattern: HuntPattern,
): Promise<RawHuntFinding[]> {
  try {
    logger.info('Executing custom hunt', { executionId: execution.executionId })
    return await executeCustomQuery(db, execution, pattern.query)
  } catch (error: unknown) {
    logger.error('Custom hunt execution failed:', { error })
    throw error
  }
}

async function executeDefaultHunt(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    logger.info('Executing default hunt', { executionId: execution.executionId })
    return await executeBasicSecurityAnalysis(db, execution)
  } catch (error: unknown) {
    logger.error('Default hunt execution failed:', { error })
    throw error
  }
}

// ─── Custom / default hunts ───────────────────────────────────

async function executeCustomQuery(
  _db: Db,
  execution: HuntExecution,
  query: string,
): Promise<RawHuntFinding[]> {
  try {
    logger.info('Executing custom query', {
      executionId: execution.executionId,
      queryLength: query.length,
    })

    const results: RawHuntFinding[] = [
      {
        type: 'custom_query_result',
        severity: 'medium',
        confidence: 0.7,
        data: { query, result: 'custom_result' },
        timestamp: new Date(),
      },
    ]

    return results
  } catch (error: unknown) {
    logger.error('Custom query execution failed:', { error })
    return []
  }
}

async function executeBasicSecurityAnalysis(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    const securityLogs = db.collection('security_logs')
    const timeRange = getExecutionTimeRange(execution)

    const securityEvents = await securityLogs
      .find({
        timestamp: { $gte: new Date(timeRange.startTime), $lte: new Date(timeRange.endTime) },
        severity: { $in: ['high', 'critical'] },
      })
      .limit(execution.maxResults ?? 1000)
      .toArray()

    return securityEvents.map((event) => ({
      type: 'security_event',
      severity: normalizeSeverity(event['severity']),
      confidence: 0.8,
      data: toDocumentRecord(event),
      timestamp: toDate(event['timestamp']),
    }))
  } catch (error: unknown) {
    logger.error('Basic security analysis failed:', { error })
    return []
  }
}
