/**
 * Endpoint hunts for the threat hunting system.
 * Extracted from ThreatHuntingSystem.hunts.ts — standalone functions querying MongoDB.
 */

import type { Db } from 'mongodb'
import type { HuntExecution } from '../global/types'
import type { RawHuntFinding } from './ThreatHuntingSystem.types'
import {
  getExecutionTimeRange,
  toDate,
} from './ThreatHuntingSystem.utils'
import { createBuildSafeLogger } from '../../../logging/build-safe-logger'

const logger = createBuildSafeLogger('threat-hunting-hunts')

// ─── Endpoint hunts ──────────────────────────────────────────

export async function huntSuspiciousProcesses(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    const processLogs = db.collection('process_logs')
    const timeRange = getExecutionTimeRange(execution)

    const suspiciousProcesses = await processLogs
      .find({
        timestamp: {
          $gte: new Date(timeRange.startTime),
          $lte: new Date(timeRange.endTime),
        },
        $or: [
          { processName: { $regex: /powershell|cmd\.exe|wscript|cscript/i } },
          { commandLine: { $regex: /-enc |base64|bypass|hidden/i } },
          { parentProcess: 'explorer.exe', processName: { $regex: /\.exe$/i } },
        ],
      })
      .limit(execution.maxResults ?? 1000)
      .toArray()

    return suspiciousProcesses.map((proc) => ({
      type: 'suspicious_process',
      severity: 'high',
      confidence: 0.8,
      data: proc,
      timestamp: toDate(proc['timestamp']),
    }))
  } catch (error: unknown) {
    logger.error('Suspicious processes hunt failed:', { error })
    return []
  }
}

export async function huntFileSystemAnomalies(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    const fileLogs = db.collection('file_system_logs')
    const timeRange = getExecutionTimeRange(execution)

    const fileAnomalies = await fileLogs
      .find({
        timestamp: {
          $gte: new Date(timeRange.startTime),
          $lte: new Date(timeRange.endTime),
        },
        $or: [
          { filePath: { $regex: /temp|tmp|appdata/i }, operation: 'CREATE', fileSize: { $gt: 1000000 } },
          { filePath: { $regex: /system32|syswow64/i }, operation: 'MODIFY', user: { $ne: 'SYSTEM' } },
          { fileExtension: { $in: ['.exe', '.dll', '.sys'] }, operation: 'CREATE', digitalSignature: { $exists: false } },
        ],
      })
      .limit(execution.maxResults ?? 1000)
      .toArray()

    return fileAnomalies.map((file) => ({
      type: 'file_system_anomaly',
      severity: 'medium',
      confidence: 0.7,
      data: file,
      timestamp: toDate(file['timestamp']),
    }))
  } catch (error: unknown) {
    logger.error('File system anomalies hunt failed:', { error })
    return []
  }
}

export async function huntRegistryModifications(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    const registryLogs = db.collection('registry_logs')
    const timeRange = getExecutionTimeRange(execution)

    const registryMods = await registryLogs
      .find({
        timestamp: {
          $gte: new Date(timeRange.startTime),
          $lte: new Date(timeRange.endTime),
        },
        $or: [
          { keyPath: { $regex: /run|runonce|services/i } },
          { keyPath: { $regex: /security|policy|audit/i } },
          { operation: 'CREATE', valueData: { $regex: /http|ftp|powershell/i } },
        ],
      })
      .limit(execution.maxResults ?? 1000)
      .toArray()

    return registryMods.map((reg) => ({
      type: 'registry_modification',
      severity: 'high',
      confidence: 0.8,
      data: reg,
      timestamp: toDate(reg['timestamp']),
    }))
  } catch (error: unknown) {
    logger.error('Registry modifications hunt failed:', { error })
    return []
  }
}

export async function huntPersistenceMechanisms(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    const persistenceLogs = db.collection('persistence_logs')
    const timeRange = getExecutionTimeRange(execution)

    const persistenceMechanisms = await persistenceLogs
      .find({
        timestamp: {
          $gte: new Date(timeRange.startTime),
          $lte: new Date(timeRange.endTime),
        },
        mechanismType: { $in: ['service', 'scheduled_task', 'registry', 'startup_folder'] },
      })
      .limit(execution.maxResults ?? 500)
      .toArray()

    return persistenceMechanisms.map((persist) => ({
      type: 'persistence_mechanism',
      severity: 'high',
      confidence: 0.9,
      data: persist,
      timestamp: toDate(persist['timestamp']),
    }))
  } catch (error: unknown) {
    logger.error('Persistence mechanisms hunt failed:', { error })
    return []
  }
}

