/**
 * ThreatHuntingSystem.hunts.ts
 * Extracted hunt execution methods - standalone functions querying MongoDB.
 * Each takes (db, execution) and returns RawHuntFinding[].
 */

import type { Db } from 'mongodb'
import type { HuntExecution, HuntPattern } from '../global/types'
import type {
  RawHuntFinding,
  PortScanAggregateResult,
  LoginAggregateResult,
  AccessAggregateResult,
  LateralAggregateResult,
} from './ThreatHuntingSystem.types'
import {
  getExecutionTimeRange,
  toDate,
  toDocumentRecord,
  normalizeSeverity,
  toStringValue,
} from './ThreatHuntingSystem.utils'
import { createBuildSafeLogger } from '../../../logging/build-safe-logger'

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

// ─── Network hunts ───────────────────────────────────────────

async function huntSuspiciousConnections(
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

async function huntUnusualDNSQueries(
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

async function huntPortScanning(
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

async function huntDataExfiltration(
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

// ─── Endpoint hunts ──────────────────────────────────────────

async function huntSuspiciousProcesses(
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

async function huntFileSystemAnomalies(
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

async function huntRegistryModifications(
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

async function huntPersistenceMechanisms(
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

// ─── User behavior hunts ─────────────────────────────────────

async function huntUnusualLoginPatterns(
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

async function huntPrivilegeEscalation(
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

async function huntUnusualAccessPatterns(
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

async function huntAccountCompromise(
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

// ─── Malware hunts ───────────────────────────────────────────

async function huntKnownMalwareSignatures(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    const fileLogs = db.collection('file_system_logs')
    const timeRange = getExecutionTimeRange(execution)

    const malwareCollection = db.collection('malware_signatures')
    const knownSignatures = await malwareCollection.find({}).toArray()
    const signatureHashes = knownSignatures
      .map((sig) => toStringValue(sig['hash']))
      .filter((hash): hash is string => typeof hash === 'string' && hash.length > 0)

    const malwareFiles = await fileLogs
      .find({
        timestamp: { $gte: new Date(timeRange.startTime), $lte: new Date(timeRange.endTime) },
        fileHash: { $in: signatureHashes },
        operation: 'CREATE',
      })
      .limit(execution.maxResults ?? 100)
      .toArray()

    return malwareFiles.map((file) => ({
      type: 'known_malware_signature',
      severity: 'critical',
      confidence: 1.0,
      data: file,
      timestamp: toDate(file['timestamp']),
    }))
  } catch (error: unknown) {
    logger.error('Known malware signatures hunt failed:', { error })
    return []
  }
}

async function huntSuspiciousFileHashes(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    const fileLogs = db.collection('file_system_logs')
    const timeRange = getExecutionTimeRange(execution)

    const suspiciousHashes = await fileLogs
      .find({
        timestamp: { $gte: new Date(timeRange.startTime), $lte: new Date(timeRange.endTime) },
        fileHash: { $exists: true },
        $or: [
          { digitalSignature: { $exists: false } },
          { fileSize: { $gt: 50000000 } },
          { fileExtension: '.exe', filePath: { $regex: /temp|tmp/i } },
        ],
      })
      .limit(execution.maxResults ?? 500)
      .toArray()

    return suspiciousHashes.map((file) => ({
      type: 'suspicious_file_hash',
      severity: 'medium',
      confidence: 0.6,
      data: file,
      timestamp: toDate(file['timestamp']),
    }))
  } catch (error: unknown) {
    logger.error('Suspicious file hashes hunt failed:', { error })
    return []
  }
}

async function huntMalwareBehavioralIndicators(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    const processLogs = db.collection('process_logs')
    const timeRange = getExecutionTimeRange(execution)

    const behavioralIndicators = await processLogs
      .find({
        timestamp: { $gte: new Date(timeRange.startTime), $lte: new Date(timeRange.endTime) },
        $or: [
          { processName: { $regex: /svchost|lsass|winlogon/i }, parentProcess: { $ne: 'services.exe' } },
          { commandLine: { $regex: /-nop|-windowstyle hidden|bypass/i } },
          { processName: { $regex: /\.exe$/i }, digitalSignature: { $exists: false } },
        ],
      })
      .limit(execution.maxResults ?? 1000)
      .toArray()

    return behavioralIndicators.map((indicator) => ({
      type: 'malware_behavioral_indicator',
      severity: 'high',
      confidence: 0.8,
      data: toDocumentRecord(indicator),
      timestamp: toDate(indicator['timestamp']),
    }))
  } catch (error: unknown) {
    logger.error('Malware behavioral indicators hunt failed:', { error })
    return []
  }
}

async function huntC2Communications(
  db: Db,
  execution: HuntExecution,
): Promise<RawHuntFinding[]> {
  try {
    const networkLogs = db.collection('network_logs')
    const timeRange = getExecutionTimeRange(execution)

    const c2Communications = await networkLogs
      .aggregate<LateralAggregateResult>([
        {
          $match: {
            timestamp: { $gte: new Date(timeRange.startTime), $lte: new Date(timeRange.endTime) },
            destinationIp: { $not: { $regex: /^10\.|^172\.|^192\.168\./ } },
          },
        },
        {
          $group: {
            _id: { sourceIp: '$sourceIp', destinationIp: '$destinationIp', destinationPort: '$destinationPort' },
            connectionCount: { $sum: 1 },
            timestamps: { $push: '$timestamp' },
            totalBytes: { $sum: '$bytesTransferred' },
          },
        },
        { $match: { connectionCount: { $gte: 10 }, totalBytes: { $lt: 10000 } } },
      ])
      .limit(execution.maxResults ?? 100)
      .toArray()

    return c2Communications.map((comm) => ({
      type: 'c2_communication',
      severity: 'critical',
      confidence: 0.9,
      data: toDocumentRecord(comm),
      timestamp: new Date(),
    }))
  } catch (error: unknown) {
    logger.error('C2 communications hunt failed:', { error })
    return []
  }
}

// ─── Lateral movement hunts ──────────────────────────────────

async function huntCredentialDumping(
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

async function huntNetworkEnumeration(
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

async function huntServiceExploitation(
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

async function huntRemoteAccessTools(
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
