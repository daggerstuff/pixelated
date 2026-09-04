import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type {
  GlobalThreatIntelligence,
  ValidationResult,
  ValidationRule,
} from '../global/types'

const logger = createBuildSafeLogger('threat-validation-system')

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

