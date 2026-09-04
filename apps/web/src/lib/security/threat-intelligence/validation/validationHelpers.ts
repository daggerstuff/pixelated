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

export async function applyValidationRule(
  rule: ValidationRule,
  threat: GlobalThreatIntelligence,
): Promise<ValidationResult> {
  try {
    const issues: string[] = []
    let score = 100

    // Apply rule conditions
    for (const condition of rule.conditions) {
      const conditionResult = await evaluateValidationCondition(
        condition as unknown as Record<string, unknown>,
        threat,
      )
      if (!conditionResult.passed) {
        issues.push(conditionResult.message)
        score -= condition.weight ?? 10
      }
    }

    return {
      ruleId: rule.ruleId,
      ruleName: rule.name,
      passed: issues.length === 0,
      score: Math.max(0, score),
      issues,
      details: {
        ruleType: rule.ruleType,
        conditionsApplied: rule.conditions.length,
        severity: rule.severity,
      },
    }
  } catch (error: unknown) {
    logger.error('Validation rule application failed:', {
      error,
      ruleId: rule.ruleId,
    })
    return {
      ruleId: rule.ruleId,
      ruleName: rule.name,
      passed: false,
      score: 0,
      issues: [
        'Rule application error: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      ],
      details: {},
    }
  }
}

export async function evaluateValidationCondition(
  condition: Record<string, unknown>,
  threat: GlobalThreatIntelligence,
): Promise<{ passed: boolean; message: string }> {
  try {
    const conditionType = condition['type']
    if (typeof conditionType !== 'string') {
      return { passed: true, message: 'Unknown condition type' }
    }
    switch (conditionType) {
      case 'field_exists':
        return evaluateFieldExistsCondition(condition, threat)
      case 'field_value':
        return evaluateFieldValueCondition(condition, threat)
      case 'regex_match':
        return evaluateRegexMatchCondition(condition, threat)
      case 'range_check':
        return evaluateRangeCheckCondition(condition, threat)
      case 'whitelist':
        return evaluateWhitelistCondition(condition, threat)
      case 'blacklist':
        return evaluateBlacklistCondition(condition, threat)
      default:
        return { passed: true, message: 'Unknown condition type' }
    }
  } catch (error: unknown) {
    return {
      passed: false,
      message:
        'Condition evaluation error: ' +
        (error instanceof Error ? error.message : 'Unknown error'),
    }
  }
}

export function evaluateFieldExistsCondition(
  condition: Record<string, unknown>,
  threat: GlobalThreatIntelligence,
): { passed: boolean; message: string } {
  const value = getNestedValue(threat, condition['field'] as string)
  const exists = value !== undefined && value !== null

  return {
    passed: (condition['required'] as boolean) ? exists : !exists,
    message: (condition['required'] as boolean)
      ? `Field ${condition['field'] as string} must exist`
      : `Field ${condition['field'] as string} must not exist`,
  }
}

export function evaluateFieldValueCondition(
  condition: Record<string, unknown>,
  threat: GlobalThreatIntelligence,
): { passed: boolean; message: string } {
  const value = getNestedValue(threat, condition['field'] as string)

  if (condition['operator'] === 'equals') {
    const passed = value === condition['value']
    return {
      passed,
      message: passed
        ? ''
        : `Field ${condition['field'] as string} must equal ${condition['value']}`,
    }
  }

  if (condition['operator'] === 'not_equals') {
    const passed = value !== condition['value']
    return {
      passed,
      message: passed
        ? ''
        : `Field ${condition['field'] as string} must not equal ${condition['value']}`,
    }
  }

  return { passed: true, message: 'Unknown operator' }
}

export function evaluateRegexMatchCondition(
  condition: Record<string, unknown>,
  threat: GlobalThreatIntelligence,
): { passed: boolean; message: string } {
  const value = getNestedValue(threat, condition['field'] as string)

  if (typeof value !== 'string') {
    return {
      passed: false,
      message: `Field ${condition['field'] as string} must be a string for regex matching`,
    }
  }

  const regex = new RegExp(condition['pattern'] as string)
  const passed = regex.test(value)

  return {
    passed,
    message: passed
      ? ''
      : `Field ${condition['field'] as string} must match pattern ${condition['pattern'] as string}`,
  }
}

export function evaluateRangeCheckCondition(
  condition: Record<string, unknown>,
  threat: GlobalThreatIntelligence,
): { passed: boolean; message: string } {
  const value = getNestedValue(threat, condition['field'] as string)
  const numValue = Number(value)

  if (isNaN(numValue)) {
    return {
      passed: false,
      message: `Field ${condition['field'] as string} must be a number for range check`,
    }
  }

  if (
    condition['min'] !== undefined &&
    numValue < (condition['min'] as number)
  ) {
    return {
      passed: false,
      message: `Field ${condition['field'] as string} must be >= ${condition['min'] as number}`,
    }
  }

  if (
    condition['max'] !== undefined &&
    numValue > (condition['max'] as number)
  ) {
    return {
      passed: false,
      message: `Field ${condition['field'] as string} must be <= ${condition['max'] as number}`,
    }
  }

  return { passed: true, message: '' }
}

export function evaluateWhitelistCondition(
  condition: Record<string, unknown>,
  threat: GlobalThreatIntelligence,
): { passed: boolean; message: string } {
  const value = getNestedValue(threat, condition['field'] as string)
  const values = condition['values'] as unknown[]

  if (!values.includes(value)) {
    return {
      passed: false,
      message: `Field ${condition['field'] as string} must be one of: ${(values as string[]).join(', ')}`,
    }
  }

  return { passed: true, message: '' }
}

export function evaluateBlacklistCondition(
  condition: Record<string, unknown>,
  threat: GlobalThreatIntelligence,
): { passed: boolean; message: string } {
  const value = getNestedValue(threat, condition['field'] as string)
  const values = condition['values'] as unknown[]

  if (values.includes(value)) {
    return {
      passed: false,
      message: `Field ${condition['field'] as string} must not be one of: ${(values as string[]).join(', ')}`,
    }
  }

  return { passed: true, message: '' }
}

export function calculateOverallValidationScore(results: ValidationResult[]): number {
  if (results.length === 0) return 0

  const totalScore = results.reduce((sum, result) => sum + result.score, 0)
  const averageScore = totalScore / results.length

  // Apply weights based on rule importance
  const weightedScore = applyValidationWeights(results, averageScore)

  return Math.max(0, Math.min(100, weightedScore))
}

export function applyValidationWeights(
  results: ValidationResult[],
  baseScore: number,
): number {
  // Critical rules that should heavily impact the score
  const criticalRules = ['structure_validation', 'indicator_validation']
  const criticalFailures = results.filter(
    (r) => criticalRules.includes(r.ruleId) && !r.passed,
  )

  if (criticalFailures.length > 0) {
    // Reduce score significantly for critical failures
    return baseScore * 0.3
  }

  return baseScore
}

export function validateValidationRule(rule: ValidationRule): void {
  if (!rule.ruleId || !rule.name || !rule.ruleType) {
    throw new Error('Invalid validation rule: missing required fields')
  }

  if (
    rule.severity &&
    !['low', 'medium', 'high', 'critical'].includes(rule.severity)
  ) {
    throw new Error(
      'Invalid validation rule: severity must be low, medium, high, or critical',
    )
  }
}

export function generateValidationId(): string {
  return `validation_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export function getNestedValue(obj: unknown, path: string): unknown {
  if (!isRecord(obj)) {
    return undefined
  }

  return path.split('.').reduce<unknown>((current, key) => {
    if (!isRecord(current)) {
      return undefined
    }

    return current[key]
  }, obj)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
