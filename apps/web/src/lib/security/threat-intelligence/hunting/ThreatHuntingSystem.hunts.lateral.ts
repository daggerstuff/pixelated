/**
 * Lateral movement hunts for the threat hunting system.
 * Extracted from ThreatHuntingSystem.hunts.ts — standalone functions querying MongoDB.
 */

import type { Db } from 'mongodb'
import type { HuntExecution } from '../global/types'
import type { RawHuntFinding, LateralAggregateResult } from './ThreatHuntingSystem.types'
import {
  getExecutionTimeRange,
  toDate,
  toDocumentRecord,
} from './ThreatHuntingSystem.utils'
import { createBuildSafeLogger } from '../../../logging/build-safe-logger'

const logger = createBuildSafeLogger('threat-hunting-hunts')

// ─── Lateral movement hunts ──────────────────────────────────

export async function huntCredentialDumping(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    const processLogs = db.collection('process_logs')
    const timeRange = getExecutionTimeRange(execution)

    const credentialDumping = await processLogs
      .find({
        timestamp: { $gte: new Date(timeRange.startTime), $lte: new Date(timeRange.endTime) },
        $or: [
          { processName: { $regex: /mimikatz|sekurlsa|lsadump/i } },
          { commandLine: { $regex: /sekurlsa::|lsadump::|hashdump/i } },
          { processName: 'lsass.exe', accessType: { $regex: /read|full/i } },
        ],
      })
      .limit(execution.maxResults ?? 100)
      .toArray()

    return credentialDumping.map((dump) => ({
      type: 'credential_dumping',
      severity: 'critical',
      confidence: 0.95,
      data: dump,
      timestamp: toDate(dump['timestamp']),
    }))
  } catch (error: unknown) {
    logger.error('Credential dumping hunt failed:', { error })
    return []
  }
}

export async function huntNetworkEnumeration(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    const networkLogs = db.collection('network_logs')
    const timeRange = getExecutionTimeRange(execution)

    const networkEnumeration = await networkLogs
      .aggregate<LateralAggregateResult>([
        {
          $match: {
            timestamp: { $gte: new Date(timeRange.startTime), $lte: new Date(timeRange.endTime) },
          },
        },
        {
          $group: {
            _id: {
              sourceIp: '$sourceIp',
              hour: { $dateToString: { format: '%Y-%m-%d %H:00', date: '$timestamp' } },
            },
            uniqueDestinations: { $addToSet: '$destinationIp' },
            connectionCount: { $sum: 1 },
            portsScanned: { $addToSet: '$destinationPort' },
          },
        },
        {
          $match: {
            $or: [
              { uniqueDestinations: { $size: { $gte: 20 } } },
              { portsScanned: { $size: { $gte: 15 } } },
            ],
          },
        },
      ])
      .limit(execution.maxResults ?? 100)
      .toArray()

    return networkEnumeration.map((enumeration) => ({
      type: 'network_enumeration',
      severity: 'medium',
      confidence: 0.7,
      data: toDocumentRecord(enumeration),
      timestamp: toDate(enumeration._id.hour),
    }))
  } catch (error: unknown) {
    logger.error('Network enumeration hunt failed:', { error })
    return []
  }
}

export async function huntServiceExploitation(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    const systemLogs = db.collection('system_logs')
    const timeRange = getExecutionTimeRange(execution)

    const serviceExploitation = await systemLogs
      .find({
        timestamp: { $gte: new Date(timeRange.startTime), $lte: new Date(timeRange.endTime) },
        eventType: 'service',
        $or: [
          { message: { $regex: /exploit|buffer overflow|injection/i } },
          { serviceName: { $in: ['smb', 'rdp', 'ssh', 'ftp'] }, status: 'crashed' },
        ],
      })
      .limit(execution.maxResults ?? 200)
      .toArray()

    return serviceExploitation.map((exploit) => ({
      type: 'service_exploitation',
      severity: 'critical',
      confidence: 0.85,
      data: exploit,
      timestamp: toDate(exploit['timestamp']),
    }))
  } catch (error: unknown) {
    logger.error('Service exploitation hunt failed:', { error })
    return []
  }
}

export async function huntRemoteAccessTools(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    const processLogs = db.collection('process_logs')
    const timeRange = getExecutionTimeRange(execution)

    const remoteAccessTools = await processLogs
      .find({
        timestamp: { $gte: new Date(timeRange.startTime), $lte: new Date(timeRange.endTime) },
        processName: {
          $in: [
            'teamviewer.exe', 'anydesk.exe', 'logmein.exe',
            'gotomypc.exe', 'vncserver.exe', 'radmin.exe', 'dameware.exe',
          ],
        },
      })
      .limit(execution.maxResults ?? 100)
      .toArray()

    return remoteAccessTools.map((tool) => ({
      type: 'remote_access_tool',
      severity: 'medium',
      confidence: 0.8,
      data: tool,
      timestamp: toDate(tool['timestamp']),
    }))
  } catch (error: unknown) {
    logger.error('Remote access tools hunt failed:', { error })
    return []
  }
}

