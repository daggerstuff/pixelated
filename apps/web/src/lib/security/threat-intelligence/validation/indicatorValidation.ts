import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type {
  GlobalThreatIntelligence,
  ThreatIndicator,
  ValidationResult,
  ValidationRule,
} from '../global/types'

const logger = createBuildSafeLogger('threat-validation-system')

export async function validateThreatStructure(
  threat: GlobalThreatIntelligence,
): Promise<ValidationResult> {
  try {
    const issues: string[] = []
    let score = 100

    // Check required fields
    if (!threat.threatId) {
      issues.push('Missing threatId')
      score -= 20
    }

    if (!threat.threatType) {
      issues.push('Missing threatType')
      score -= 20
    }

    if (
      !threat.severity ||
      !['low', 'medium', 'high', 'critical'].includes(threat.severity)
    ) {
      issues.push('Invalid or missing severity')
      score -= 15
    }

    if (
      threat.confidence === undefined ||
      threat.confidence < 0 ||
      threat.confidence > 1
    ) {
      issues.push('Invalid confidence value')
      score -= 15
    }

    if (!threat.indicators || threat.indicators.length === 0) {
      issues.push('No indicators provided')
      score -= 30
    }

    // Check timestamp consistency
    if (
      threat.firstSeen &&
      threat.lastSeen &&
      threat.firstSeen > threat.lastSeen
    ) {
      issues.push('firstSeen is after lastSeen')
      score -= 10
    }

    return {
      ruleId: 'structure_validation',
      ruleName: 'Threat Structure Validation',
      passed: issues.length === 0,
      score: Math.max(0, score),
      issues,
      details: {
        fieldCount: Object.keys(threat).length,
        hasAttribution: !!threat.attribution,
        hasMetadata: !!threat.metadata,
        indicatorCount: threat.indicators?.length || 0,
      },
    }
  } catch (error: unknown) {
    logger.error('Threat structure validation failed:', { error })
    return {
      ruleId: 'structure_validation',
      ruleName: 'Threat Structure Validation',
      passed: false,
      score: 0,
      issues: [
        'Validation error: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      ],
      details: {},
    }
  }
}

export async function validateIndicators(
  indicators: ThreatIndicator[],
): Promise<ValidationResult> {
  try {
    const issues: string[] = []
    let score = 100
    let validIndicators = 0

    for (let i = 0; i < indicators.length; i++) {
      const indicator = indicators[i]
      const indicatorIssues: string[] = []

      // Check required fields
      if (!indicator.indicatorType) {
        indicatorIssues.push(`Indicator ${i}: Missing indicatorType`)
      }

      if (!indicator.value) {
        indicatorIssues.push(`Indicator ${i}: Missing value`)
      }

      if (
        indicator.confidence === undefined ||
        indicator.confidence < 0 ||
        indicator.confidence > 1
      ) {
        indicatorIssues.push(`Indicator ${i}: Invalid confidence value`)
      }

      // Validate indicator format based on type
      if (indicator.indicatorType && indicator.value) {
        const formatValidation = validateIndicatorFormat(indicator)
        if (!formatValidation.valid) {
          indicatorIssues.push(`Indicator ${i}: ${formatValidation.error}`)
        }
      }

      if (indicatorIssues.length === 0) {
        validIndicators++
      } else {
        issues.push(...indicatorIssues)
        score -= (20 / indicators.length) * indicatorIssues.length
      }
    }

    // Check for duplicate indicators
    const duplicates = findDuplicateIndicators(indicators)
    if (duplicates.length > 0) {
      issues.push(`Duplicate indicators found: ${duplicates.join(', ')}`)
      score -= 10
    }

    return {
      ruleId: 'indicator_validation',
      ruleName: 'Indicator Validation',
      passed: issues.length === 0,
      score: Math.max(0, score),
      issues,
      details: {
        totalIndicators: indicators.length,
        validIndicators,
        duplicateCount: duplicates.length,
        indicatorTypes: [...new Set(indicators.map((i) => i.indicatorType))],
      },
    }
  } catch (error: unknown) {
    logger.error('Indicator validation failed:', { error })
    return {
      ruleId: 'indicator_validation',
      ruleName: 'Indicator Validation',
      passed: false,
      score: 0,
      issues: [
        'Validation error: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      ],
      details: {},
    }
  }
}

export function validateIndicatorFormat(indicator: ThreatIndicator): {
  valid: boolean
  error?: string
} {
  try {
    switch (indicator.indicatorType) {
      case 'ip':
        return validateIPFormat(indicator.value)
      case 'domain':
        return validateDomainFormat(indicator.value)
      case 'url':
        return validateURLFormat(indicator.value)
      case 'file_hash':
        return validateFileHashFormat(indicator.value)
      case 'email':
        return validateEmailFormat(indicator.value)
      case 'process':
        return validateProcessFormat(indicator.value)
      default:
        return { valid: true } // Unknown types are allowed
    }
  } catch (error: unknown) {
    return {
      valid: false,
      error:
        'Format validation error: ' +
        (error instanceof Error ? error.message : 'Unknown error'),
    }
  }
}

export function validateIPFormat(ip: string): { valid: boolean; error?: string } {
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  const ipv6Regex =
    /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/

  if (ipv4Regex.test(ip) || ipv6Regex.test(ip)) {
    return { valid: true }
  }

  return { valid: false, error: 'Invalid IP address format' }
}

export function validateDomainFormat(domain: string): {
  valid: boolean
  error?: string
} {
  const domainRegex =
    /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/

  if (domainRegex.test(domain) && domain.length <= 253) {
    return { valid: true }
  }

  return { valid: false, error: 'Invalid domain format' }
}

export function validateURLFormat(url: string): { valid: boolean; error?: string } {
  try {
    new URL(url)
    return { valid: true }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
}

export function validateFileHashFormat(hash: string): {
  valid: boolean
  error?: string
} {
  // Check for common hash formats (MD5, SHA1, SHA256)
  const md5Regex = /^[a-fA-F0-9]{32}$/
  const sha1Regex = /^[a-fA-F0-9]{40}$/
  const sha256Regex = /^[a-fA-F0-9]{64}$/

  if (md5Regex.test(hash) || sha1Regex.test(hash) || sha256Regex.test(hash)) {
    return { valid: true }
  }

  return {
    valid: false,
    error: 'Invalid file hash format (expected MD5, SHA1, or SHA256)',
  }
}

export function validateEmailFormat(email: string): {
  valid: boolean
  error?: string
} {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (emailRegex.test(email)) {
    return { valid: true }
  }

  return { valid: false, error: 'Invalid email format' }
}

export function validateProcessFormat(process: string): {
  valid: boolean
  error?: string
} {
  if (process.length > 0 && process.length <= 255) {
    return { valid: true }
  }

  return { valid: false, error: 'Invalid process name format' }
}

export function findDuplicateIndicators(indicators: ThreatIndicator[]): string[] {
  const seen = new Map<string, number>()
  const duplicates: string[] = []

  for (const indicator of indicators) {
    const key = `${indicator.indicatorType}:${indicator.value}`
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }

  for (const [key, count] of seen) {
    if (count > 1) {
      duplicates.push(key)
    }
  }

  return duplicates
}

export async function validateAttribution(
  attribution: Record<string, unknown>,
): Promise<ValidationResult> {
  try {
    const issues: string[] = []
    let score = 100

    if (!attribution) {
      return {
        ruleId: 'attribution_validation',
        ruleName: 'Attribution Validation',
        passed: true,
        score: 100,
        issues: [],
        details: { hasAttribution: false },
      }
    }

    // Validate attribution fields
    if (attribution['family'] && typeof attribution['family'] !== 'string') {
      issues.push('Attribution family must be a string')
      score -= 20
    }

    if (
      attribution['campaign'] &&
      typeof attribution['campaign'] !== 'string'
    ) {
      issues.push('Attribution campaign must be a string')
      score -= 20
    }

    if (attribution['confidence'] !== undefined) {
      const conf = Number(attribution['confidence'])
      if (isNaN(conf) || conf < 0 || conf > 1) {
        issues.push('Attribution confidence must be between 0 and 1')
        score -= 20
      }
    }

    if (attribution['actor'] && typeof attribution['actor'] !== 'string') {
      issues.push('Attribution actor must be a string')
      score -= 15
    }

    if (
      attribution['country'] &&
      typeof attribution['country'] !== 'string'
    ) {
      issues.push('Attribution country must be a string')
      score -= 15
    }

    return {
      ruleId: 'attribution_validation',
      ruleName: 'Attribution Validation',
      passed: issues.length === 0,
      score: Math.max(0, score),
      issues,
      details: {
        hasAttribution: true,
        hasFamily: !!attribution['family'],
        hasCampaign: !!attribution['campaign'],
        hasConfidence: attribution['confidence'] !== undefined,
        hasActor: !!attribution['actor'],
        hasCountry: !!attribution['country'],
      },
    }
  } catch (error: unknown) {
    logger.error('Attribution validation failed:', { error })
    return {
      ruleId: 'attribution_validation',
      ruleName: 'Attribution Validation',
      passed: false,
      score: 0,
      issues: [
        'Validation error: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      ],
      details: {},
    }
  }
}

export async function validateMetadata(
  metadata: Record<string, unknown>,
): Promise<ValidationResult> {
  try {
    const issues: string[] = []
    let score = 100

    if (!metadata) {
      return {
        ruleId: 'metadata_validation',
        ruleName: 'Metadata Validation',
        passed: true,
        score: 100,
        issues: [],
        details: { hasMetadata: false },
      }
    }

    // Validate metadata structure
    if (typeof metadata !== 'object') {
      issues.push('Metadata must be an object')
      score -= 30
    }

    // Check for suspicious metadata patterns
    const metadataStr = JSON.stringify(metadata)
    if (metadataStr.length > 10000) {
      // 10KB limit
      issues.push('Metadata size exceeds 10KB limit')
      score -= 20
    }

    // Validate specific metadata fields if present
    if (metadata['source'] && typeof metadata['source'] !== 'string') {
      issues.push('Metadata source must be a string')
      score -= 10
    }

    if (metadata['tags'] && !Array.isArray(metadata['tags'])) {
      issues.push('Metadata tags must be an array')
      score -= 10
    }

    return {
      ruleId: 'metadata_validation',
      ruleName: 'Metadata Validation',
      passed: issues.length === 0,
      score: Math.max(0, score),
      issues,
      details: {
        hasMetadata: true,
        metadataSize: metadataStr.length,
        hasSource: !!metadata['source'],
        hasTags: !!metadata['tags'],
      },
    }
  } catch (error: unknown) {
    logger.error('Metadata validation failed:', { error })
    return {
      ruleId: 'metadata_validation',
      ruleName: 'Metadata Validation',
      passed: false,
      score: 0,
      issues: [
        'Validation error: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      ],
      details: {},
    }
  }
}

