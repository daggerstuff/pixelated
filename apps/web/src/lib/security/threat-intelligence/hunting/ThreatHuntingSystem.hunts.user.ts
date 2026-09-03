/**
 * User behavior hunts for the threat hunting system.
 * Extracted from ThreatHuntingSystem.hunts.ts — standalone functions querying MongoDB.
 */

import type { Db } from 'mongodb'
import type { HuntExecution } from '../global/types'
import type { RawHuntFinding, LoginAggregateResult, AccessAggregateResult } from './ThreatHuntingSystem.types'
import {
  getExecutionTimeRange,
  toDate,
  toDocumentRecord,
} from './ThreatHuntingSystem.utils'
import { createBuildSafeLogger } from '../../../logging/build-safe-logger'

const logger = createBuildSafeLogger('threat-hunting-hunts')

// ─── User behavior hunts ─────────────────────────────────────

export async function huntUnusualLoginPatterns(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    const authLogs = db.collection('authentication_logs')
    const timeRange = getExecutionTimeRange(execution)

    const unusualLogins = await authLogs
      .aggregate<LoginAggregateResult>([
        {
          $match: {
            timestamp: { $gte: new Date(timeRange.startTime), $lte: new Date(timeRange.endTime) },
            eventType: 'login',
          },
        },
        {
          $group: {
            _id: '$userId',
            loginCount: { $sum: 1 },
            uniqueLocations: { $addToSet: '$sourceIp' },
            failureCount: { $sum: { $cond: [{ $eq: ['$status', 'failure'] }, 1, 0] } },
            timestamps: { $push: '$timestamp' },
          },
        },
        {
          $match: {
            $or: [{ failureCount: { $gte: 5 } }, { uniqueLocations: { $size: { $gte: 3 } } }],
          },
        },
      ])
      .limit(execution.maxResults ?? 100)
      .toArray()

    return unusualLogins.map((login) => ({
      type: 'unusual_login_pattern',
      severity: 'medium',
      confidence: 0.7,
      data: toDocumentRecord(login),
      timestamp: new Date(),
    }))
  } catch (error: unknown) {
    logger.error('Unusual login patterns hunt failed:', { error })
    return []
  }
}

export async function huntPrivilegeEscalation(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    const authLogs = db.collection('authentication_logs')
    const timeRange = getExecutionTimeRange(execution)

    const privilegeEscalations = await authLogs
      .find({
        timestamp: { $gte: new Date(timeRange.startTime), $lte: new Date(timeRange.endTime) },
        eventType: 'privilege_change',
        $or: [
          { oldRole: 'user', newRole: { $in: ['admin', 'root'] } },
          { oldRole: { $in: ['guest', 'limited'] }, newRole: 'user' },
        ],
      })
      .limit(execution.maxResults ?? 500)
      .toArray()

    return privilegeEscalations.map((escalation) => ({
      type: 'privilege_escalation',
      severity: 'high',
      confidence: 0.8,
      data: escalation,
      timestamp: toDate(escalation['timestamp']),
    }))
  } catch (error: unknown) {
    logger.error('Privilege escalation hunt failed:', { error })
    return []
  }
}

export async function huntUnusualAccessPatterns(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    const accessLogs = db.collection('access_logs')
    const timeRange = getExecutionTimeRange(execution)

    const unusualAccess = await accessLogs
      .aggregate<AccessAggregateResult>([
        {
          $match: {
            timestamp: { $gte: new Date(timeRange.startTime), $lte: new Date(timeRange.endTime) },
          },
        },
        {
          $group: {
            _id: '$userId',
            accessCount: { $sum: 1 },
            uniqueResources: { $addToSet: '$resource' },
            accessTimes: { $push: { $hour: '$timestamp' } },
          },
        },
        {
          $match: {
            $or: [{ accessCount: { $gte: 100 } }, { uniqueResources: { $size: { $gte: 20 } } }],
          },
        },
      ])
      .limit(execution.maxResults ?? 100)
      .toArray()

    return unusualAccess.map((access) => ({
      type: 'unusual_access_pattern',
      severity: 'low',
      confidence: 0.6,
      data: toDocumentRecord(access),
      timestamp: new Date(),
    }))
  } catch (error: unknown) {
    logger.error('Unusual access patterns hunt failed:', { error })
    return []
  }
}

export async function huntAccountCompromise(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    const authLogs = db.collection('authentication_logs')
    const timeRange = getExecutionTimeRange(execution)

    const compromisedAccounts = await authLogs
      .aggregate([
        {
          $match: {
            timestamp: { $gte: new Date(timeRange.startTime), $lte: new Date(timeRange.endTime) },
            eventType: 'login',
            status: 'success',
          },
        },
        {
          $group: {
            _id: '$userId',
            loginLocations: { $addToSet: '$sourceIp' },
            loginTimes: { $push: '$timestamp' },
            deviceTypes: { $addToSet: '$deviceType' },
          },
        },
        {
          $match: {
            $or: [{ loginLocations: { $size: { $gte: 5 } } }, { deviceTypes: { $size: { $gte: 3 } } }],
          },
        },
      ])
      .limit(execution.maxResults ?? 100)
      .toArray()

    return compromisedAccounts.map((account) => ({
      type: 'account_compromise',
      severity: 'critical',
      confidence: 0.9,
      data: account,
      timestamp: new Date(),
    }))
  } catch (error: unknown) {
    logger.error('Account compromise hunt failed:', { error })
    return []
  }
}

