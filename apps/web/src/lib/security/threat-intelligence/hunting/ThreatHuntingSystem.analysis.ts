/**
 * ThreatHuntingSystem.analysis.ts
 * Extracted analysis methods — standalone functions for analyzing hunt results.
 */

import type { HuntPattern } from '../global/types'
import type { RawHuntFinding } from './ThreatHuntingSystem.types'
import { groupBy, increaseSeverity, toDate, toStringValue, getNestedValue } from './ThreatHuntingSystem.utils'
import { createBuildSafeLogger } from '../../../logging/build-safe-logger'

const logger = createBuildSafeLogger('threat-hunting-analysis')

export async function analyzeHuntResults(
  results: RawHuntFinding[],
  pattern: HuntPattern,
): Promise<RawHuntFinding[]> {
  try {
    logger.info('Analyzing hunt results', {
      resultCount: results.length,
      patternId: pattern.patternId,
    })

    const analyzedResults: RawHuntFinding[] = []

    for (const result of results) {
      const analyzedResult = await analyzeIndividualResult(result, pattern)
      analyzedResults.push(analyzedResult)
    }

    const patternAnalyzedResults = await applyPatternAnalysis(analyzedResults, pattern)
    return patternAnalyzedResults
  } catch (error: unknown) {
    logger.error('Hunt result analysis failed:', { error })
    return results
  }
}

async function analyzeIndividualResult(
  result: RawHuntFinding,
  pattern: HuntPattern,
): Promise<RawHuntFinding> {
  try {
    let confidence = result.confidence

    if (result.severity === 'critical') {
      confidence = Math.min(confidence * 1.2, 1.0)
    } else if (result.severity === 'high') {
      confidence = Math.min(confidence * 1.1, 1.0)
    }

    const analyzedResult = {
      ...result,
      confidence,
      analysisTimestamp: new Date(),
      patternId: pattern.patternId,
      analysisMethod: 'automated',
    }

    return analyzedResult
  } catch (error: unknown) {
    logger.error('Individual result analysis failed:', { error })
    return result
  }
}

async function applyPatternAnalysis(
  results: RawHuntFinding[],
  pattern: HuntPattern,
): Promise<RawHuntFinding[]> {
  try {
    const resolvedPatternType = pattern.patternType ?? 'anomaly'
    switch (resolvedPatternType) {
      case 'network':
        return await analyzeNetworkResults(results)
      case 'endpoint':
        return await analyzeEndpointResults(results)
      case 'user_behavior':
        return await analyzeUserBehaviorResults(results)
      case 'malware':
        return await analyzeMalwareResults(results)
      case 'lateral_movement':
        return await analyzeLateralMovementResults(results)
      case 'anomaly':
      case 'custom':
        return results
    }
    return results
  } catch (error: unknown) {
    logger.error('Pattern analysis failed:', { error })
    return results
  }
}

async function analyzeNetworkResults(
  results: RawHuntFinding[],
): Promise<RawHuntFinding[]> {
  try {
    const groupedBySource = groupBy(results, 'data.sourceIp')

    for (const [_sourceIp, sourceResults] of Object.entries(groupedBySource)) {
      if (sourceResults.length >= 5) {
        sourceResults.forEach((result) => {
          result.confidence = Math.min(result.confidence * 1.3, 1.0)
          result.severity = increaseSeverity(result.severity)
        })
      }
    }

    return results
  } catch (error: unknown) {
    logger.error('Network results analysis failed:', { error })
    return results
  }
}

async function analyzeEndpointResults(
  results: RawHuntFinding[],
): Promise<RawHuntFinding[]> {
  try {
    const processResults = results.filter((r) => r.type === 'suspicious_process')
    const fileResults = results.filter((r) => r.type === 'file_system_anomaly')

    for (const processResult of processResults) {
      const relatedFiles = fileResults.filter(
        (file) =>
          Math.abs(
            toDate(file.timestamp).getTime() - toDate(processResult.timestamp).getTime(),
          ) < 60000,
      )

      if (relatedFiles.length > 0) {
        processResult.confidence = Math.min(processResult.confidence * 1.2, 1.0)
        processResult['relatedFindings'] = relatedFiles
          .map((f) => toStringValue(f.data['filePath']))
          .filter((path): path is string => path !== undefined)
      }
    }

    return results
  } catch (error: unknown) {
    logger.error('Endpoint results analysis failed:', { error })
    return results
  }
}

async function analyzeUserBehaviorResults(
  results: RawHuntFinding[],
): Promise<RawHuntFinding[]> {
  try {
    const loginResults = results.filter((r) => r.type === 'unusual_login_pattern')
    const accessResults = results.filter((r) => r.type === 'unusual_access_pattern')

    for (const loginResult of loginResults) {
      const loginDataId = toStringValue(loginResult.data['_id'])
      const userAccess = accessResults.filter(
        (access) => toStringValue(access.data['_id']) === loginDataId,
      )

      if (userAccess.length > 0) {
        loginResult.confidence = Math.min(loginResult.confidence * 1.2, 1.0)
        loginResult['relatedFindings'] = userAccess.map((a) => a.type)
      }
    }

    return results
  } catch (error: unknown) {
    logger.error('User behavior results analysis failed:', { error })
    return results
  }
}

async function analyzeMalwareResults(
  results: RawHuntFinding[],
): Promise<RawHuntFinding[]> {
  try {
    const signatureResults = results.filter((r) => r.type === 'known_malware_signature')
    const behavioralResults = results.filter((r) => r.type === 'malware_behavioral_indicator')

    signatureResults.forEach((result) => {
      result.confidence = 1.0
      result.severity = 'critical'
    })

    for (const behavioralResult of behavioralResults) {
      const behavioralSourceIp = toStringValue(behavioralResult.data['sourceIp'])
      const behavioralProcessId = toStringValue(behavioralResult.data['processId'])

      const relatedSignatures = signatureResults.filter((sig) => {
        if (toStringValue(sig.data['sourceIp']) === behavioralSourceIp) {
          return true
        }
        return toStringValue(sig.data['processId']) === behavioralProcessId
      })

      if (relatedSignatures.length > 0) {
        behavioralResult.confidence = Math.min(behavioralResult.confidence * 1.3, 1.0)
      }
    }

    return results
  } catch (error: unknown) {
    logger.error('Malware results analysis failed:', { error })
    return results
  }
}

async function analyzeLateralMovementResults(
  results: RawHuntFinding[],
): Promise<RawHuntFinding[]> {
  try {
    const credentialResults = results.filter((r) => r.type === 'credential_dumping')
    const enumerationResults = results.filter((r) => r.type === 'network_enumeration')
    const remoteResults = results.filter((r) => r.type === 'remote_access_tool')

    for (const credentialResult of credentialResults) {
      const relatedEnumeration = enumerationResults.filter(
        (enumResult) =>
          toStringValue(getNestedValue(enumResult.data, '_id.sourceIp')) ===
          toStringValue(credentialResult.data['sourceIp']),
      )

      const relatedRemote = remoteResults.filter(
        (remoteResult) =>
          toStringValue(remoteResult.data['sourceIp']) ===
          toStringValue(credentialResult.data['sourceIp']),
      )

      if (relatedEnumeration.length > 0 || relatedRemote.length > 0) {
        credentialResult.confidence = Math.min(credentialResult.confidence * 1.4, 1.0)
        credentialResult.severity = 'critical'
      }
    }

    return results
  } catch (error: unknown) {
    logger.error('Lateral movement results analysis failed:', { error })
    return results
  }
}
