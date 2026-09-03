/**
 * Network hunts for the threat hunting system.
 * Extracted from ThreatHuntingSystem.hunts.ts — standalone functions querying MongoDB.
 */

import type { Db } from 'mongodb'
import type { HuntExecution } from '../global/types'
import type { RawHuntFinding, PortScanAggregateResult } from './ThreatHuntingSystem.types'
import {
  getExecutionTimeRange,
  toDate,
  toDocumentRecord,
} from './ThreatHuntingSystem.utils'
import { createBuildSafeLogger } from '../../../logging/build-safe-logger'

const logger = createBuildSafeLogger('threat-hunting-hunts')

// ─── Network hunts ───────────────────────────────────────────

export async function huntSuspiciousConnections(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    const networkLogs = db.collection('network_logs')
    const timeRange = getExecutionTimeRange(execution)

    const suspiciousConnections = await networkLogs
      .find({
        timestamp: {
          $gte: new Date(timeRange.startTime),
          $lte: new Date(timeRange.endTime),
        },
        $or: [
          { destinationPort: { $in: [22, 23, 135, 139, 445, 1433, 3389] } },
          { connectionState: 'ESTABLISHED', bytesTransferred: { $gt: 1000000 } },
          {
            sourceIp: { $regex: /^10\.|^172\.|^192\.168\./ },
            destinationIp: { $not: { $regex: /^10\.|^172\.|^192\.168\./ } },
          },
        ],
      })
      .limit(execution.maxResults ?? 1000)
      .toArray()

    return suspiciousConnections.map((conn) => ({
      type: 'suspicious_connection',
      severity: 'medium',
      confidence: 0.7,
      data: conn,
      timestamp: toDate(conn['timestamp']),
    }))
  } catch (error: unknown) {
    logger.error('Suspicious connections hunt failed:', { error })
    return []
  }
}

export async function huntUnusualDNSQueries(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    const dnsLogs = db.collection('dns_logs')
    const timeRange = getExecutionTimeRange(execution)

    const unusualQueries = await dnsLogs
      .find({
        timestamp: {
          $gte: new Date(timeRange.startTime),
          $lte: new Date(timeRange.endTime),
        },
        $or: [
          { queryType: 'TXT', responseLength: { $gt: 100 } },
          { domainName: { $regex: /[0-9]{4,}\./ } },
          { domainName: { $regex: /base64|hex|encode/ } },
        ],
      })
      .limit(execution.maxResults ?? 1000)
      .toArray()

    return unusualQueries.map((query) => ({
      type: 'unusual_dns_query',
      severity: 'high',
      confidence: 0.8,
      data: query,
      timestamp: toDate(query['timestamp']),
    }))
  } catch (error: unknown) {
    logger.error('Unusual DNS queries hunt failed:', { error })
    return []
  }
}

export async function huntPortScanning(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    const networkLogs = db.collection('network_logs')
    const timeRange = getExecutionTimeRange(execution)

    const portScanCandidates = await networkLogs
      .aggregate<PortScanAggregateResult>([
        {
          $match: {
            timestamp: {
              $gte: new Date(timeRange.startTime),
              $lte: new Date(timeRange.endTime),
            },
          },
        },
        {
          $group: {
            _id: {
              sourceIp: '$sourceIp',
              hour: { $dateToString: { format: '%Y-%m-%d %H:00', date: '$timestamp' } },
            },
            uniquePorts: { $addToSet: '$destinationPort' },
            connectionCount: { $sum: 1 },
            timestamps: { $push: '$timestamp' },
          },
        },
        { $match: { $expr: { $gte: [{ $size: '$uniquePorts' }, 10] } } },
      ])
      .limit(execution.maxResults ?? 100)
      .toArray()

    return portScanCandidates.map((scan) => ({
      type: 'port_scanning',
      severity: 'high',
      confidence: 0.9,
      data: toDocumentRecord(scan),
      timestamp: toDate(scan['_id'].hour),
    }))
  } catch (error: unknown) {
    logger.error('Port scanning hunt failed:', { error })
    return []
  }
}

export async function huntDataExfiltration(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    const networkLogs = db.collection('network_logs')
    const timeRange = getExecutionTimeRange(execution)

    const exfilPatterns = await networkLogs
      .find({
        timestamp: {
          $gte: new Date(timeRange.startTime),
          $lte: new Date(timeRange.endTime),
        },
        bytesTransferred: { $gt: 10000000 },
        destinationIp: { $not: { $regex: /^10\.|^172\.|^192\.168\./ } },
      })
      .sort({ bytesTransferred: -1 })
      .limit(execution.maxResults ?? 100)
      .toArray()

    return exfilPatterns.map((exfil) => ({
      type: 'data_exfiltration',
      severity: 'critical',
      confidence: 0.8,
      data: exfil,
      timestamp: toDate(exfil['timestamp']),
    }))
  } catch (error: unknown) {
    logger.error('Data exfiltration hunt failed:', { error })
    return []
  }
}

