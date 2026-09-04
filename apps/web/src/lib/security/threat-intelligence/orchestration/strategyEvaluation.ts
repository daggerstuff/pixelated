import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type {
  GlobalThreatIntelligence,
  ResponseAction,
  ResponseCondition,
  ResponseStrategy,
} from '../global/types'

const logger = createBuildSafeLogger('automated-threat-response-orchestrator')

export function inferThreatType(threat: GlobalThreatIntelligence): string {
  // Infer threat type based on indicators and context
  if (threat.indicators.some((i) => i.indicatorType === 'ip')) {
    return 'network'
  }
  if (threat.indicators.some((i) => i.indicatorType === 'file_hash')) {
    return 'malware'
  }
  if (threat.attribution?.family) {
    return 'attributed'
  }
  return 'general'
}

export function evaluateThresholdCondition(
  condition: ResponseCondition,
  threat: GlobalThreatIntelligence,
): boolean {
  const value = getThreatValue(threat, condition.condition)

  switch (condition.operator) {
    case 'greater_than':
      return value > (condition.value as number)
    case 'less_than':
      return value < (condition.value as number)
    case 'equals':
      return value === (condition.value as number)
    case 'contains': {
      throw new Error('Not implemented yet: "contains" case')
    }
    case 'matches': {
      throw new Error('Not implemented yet: "matches" case')
    }
    default:
      return false
  }
}

export function evaluatePatternCondition(
  condition: ResponseCondition,
  threat: GlobalThreatIntelligence,
): boolean {
  const value = getThreatValue(threat, condition.condition)

  if (condition.operator === 'contains') {
    return String(value).includes(String(condition.value))
  }

  if (condition.operator === 'matches') {
    const regex = new RegExp(String(condition.value))
    return regex.test(String(value))
  }

  return false
}

export function evaluateTimeCondition(
  condition: ResponseCondition,
  _threat: GlobalThreatIntelligence,
): boolean {
  const currentTime = new Date()
  const conditionTime = new Date(condition.value as string)

  switch (condition.operator) {
    case 'greater_than':
      return currentTime > conditionTime
    case 'less_than':
      return currentTime < conditionTime
    case 'contains': {
      throw new Error('Not implemented yet: "contains" case')
    }
    case 'equals': {
      throw new Error('Not implemented yet: "equals" case')
    }
    case 'matches': {
      throw new Error('Not implemented yet: "matches" case')
    }
    default:
      return false
  }
}

export function evaluateLocationCondition(
  condition: ResponseCondition,
  threat: GlobalThreatIntelligence,
): boolean {
  const regions = threat.regions
  const targetRegions = condition.value as string[]

  switch (condition.operator) {
    case 'contains':
      return regions.some((region) => targetRegions.includes(region))
    case 'equals':
      return (
        regions.length === targetRegions.length &&
        regions.every((region) => targetRegions.includes(region))
      )
    case 'greater_than': {
      throw new Error('Not implemented yet: "greater_than" case')
    }
    case 'less_than': {
      throw new Error('Not implemented yet: "less_than" case')
    }
    case 'matches': {
      throw new Error('Not implemented yet: "matches" case')
    }
    default:
      return false
  }
}

export function getThreatValue(threat: GlobalThreatIntelligence, path: string): any {
  const keys = path.split('.')
  let value: any = threat

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key]
    } else {
      return undefined
    }
  }

  return value
}

export function getDefaultStrategy(
  threat: GlobalThreatIntelligence,
): ResponseStrategy {
  // Return a default strategy based on threat severity
  const severity = threat.severity

  const defaultStrategies: Record<string, ResponseStrategy> = {
    critical: {
      strategyId: 'default_critical',
      threatTypes: [],
      severityLevels: ['critical'],
      responseActions: [
        {
          actionId: 'block_ip',
          actionType: 'block',
          target: 'firewall',
          parameters: { duration: '24h' },
          priority: 10,
          timeout: 30000,
          rollbackStrategy: 'unblock_ip',
        },
        {
          actionId: 'escalate_security',
          actionType: 'alert',
          target: 'security_team',
          parameters: { priority: 'critical' },
          priority: 9,
          timeout: 10000,
        },
      ],
      conditions: [],
      priority: 100,
    },
    high: {
      strategyId: 'default_high',
      threatTypes: [],
      severityLevels: ['high'],
      responseActions: [
        {
          actionId: 'rate_limit',
          actionType: 'rate_limit',
          target: 'rate_limiter',
          parameters: { limit: 10, windowMs: 60000 },
          priority: 8,
          timeout: 15000,
          rollbackStrategy: 'remove_rate_limit',
        },
        {
          actionId: 'increase_monitoring',
          actionType: 'investigate',
          target: 'monitoring_system',
          parameters: { level: 'high' },
          priority: 7,
          timeout: 20000,
        },
      ],
      conditions: [],
      priority: 80,
    },
    medium: {
      strategyId: 'default_medium',
      threatTypes: [],
      severityLevels: ['medium'],
      responseActions: [
        {
          actionId: 'log_analysis',
          actionType: 'investigate',
          target: 'security_logs',
          parameters: { depth: 'detailed' },
          priority: 6,
          timeout: 30000,
        },
        {
          actionId: 'user_notification',
          actionType: 'alert',
          target: 'user_management',
          parameters: { priority: 'medium' },
          priority: 5,
          timeout: 10000,
        },
      ],
      conditions: [],
      priority: 60,
    },
    low: {
      strategyId: 'default_low',
      threatTypes: [],
      severityLevels: ['low'],
      responseActions: [
        {
          actionId: 'log_threat',
          actionType: 'alert',
          target: 'audit_system',
          parameters: { level: 'info' },
          priority: 3,
          timeout: 5000,
        },
      ],
      conditions: [],
      priority: 40,
    },
  }

  return defaultStrategies[severity] ?? defaultStrategies['medium']
}

export async function generateResponseActions(
  threat: GlobalThreatIntelligence,
  strategy: ResponseStrategy,
): Promise<ResponseAction[]> {
  try {
    const actions: ResponseAction[] = []

    for (const action of strategy.responseActions) {
      // Customize action parameters based on threat characteristics
      const customizedAction = await customizeAction(action, threat)
      actions.push(customizedAction)
    }

    // Sort by priority (highest first)
    return actions.sort((a, b) => b.priority - a.priority)
  } catch (error: unknown) {
    logger.error('Failed to generate response actions:', { error })
    return strategy.responseActions
  }
}

export async function customizeAction(
  action: ResponseAction,
  threat: GlobalThreatIntelligence,
): Promise<ResponseAction> {
  try {
    const customizedAction = { ...action }

    // Customize parameters based on threat
    switch (action.actionType) {
      case 'block':
        customizedAction.parameters = {
          ...action.parameters,
          threatId: threat.threatId,
          severity: threat.severity,
          confidence: threat.confidence,
        }
        break

      case 'rate_limit':
        customizedAction.parameters = {
          ...action.parameters,
          severity: threat.severity,
          confidence: threat.confidence,
          regions: threat.regions,
        }
        break

      case 'alert':
        customizedAction.parameters = {
          ...action.parameters,
          threatId: threat.threatId,
          severity: threat.severity,
          indicators: threat.indicators.length,
        }
        break

      case 'investigate':
        customizedAction.parameters = {
          ...action.parameters,
          threatId: threat.threatId,
          severity: threat.severity,
          regions: threat.regions,
        }
        break
      case 'isolate': {
        throw new Error('Not implemented yet: "isolate" case')
      }
      case 'mitigate': {
        throw new Error('Not implemented yet: "mitigate" case')
      }
    }

    return customizedAction
  } catch (error: unknown) {
    logger.error('Failed to customize action:', { error })
    return action
  }
}

export async function validateAction(action: ResponseAction): Promise<boolean> {
  try {
    // Validate action parameters
    if (!action.actionId || !action.actionType || !action.target) {
      return false
    }

    // Validate timeout
    if (action.timeout <= 0 || action.timeout > 300000) {
      // Max 5 minutes
      return false
    }

    // Validate priority
    if (action.priority < 0 || action.priority > 10) {
      return false
    }

    // Check if target system is available
    const isTargetAvailable = await checkTargetAvailability(
      action.target,
    )
    if (!isTargetAvailable) {
      return false
    }

    return true
  } catch (error: unknown) {
    logger.error('Action validation error:', {
      error,
      actionId: action.actionId,
    })
    return false
  }
}

export async function checkTargetAvailability(target: string): Promise<boolean> {
  try {
    // Check if the target system is available
    // This would typically involve health checks or API calls
    // For now, we'll assume all targets are available
    return true
  } catch (error: unknown) {
    logger.error('Target availability check failed:', { error, target })
    return false
  }
}

export async function calculateEstimatedImpact(
  threat: GlobalThreatIntelligence,
  actions: ResponseAction[],
): Promise<number> {
  try {
    // Calculate estimated impact based on threat severity and response actions
    let baseImpact = 0

    switch (threat.severity) {
      case 'critical':
        baseImpact = 0.9
        break
      case 'high':
        baseImpact = 0.7
        break
      case 'medium':
        baseImpact = 0.5
        break
      case 'low':
        baseImpact = 0.3
        break
    }

    // Adjust based on number and type of actions
    const actionImpact = Math.min(actions.length * 0.1, 0.3)

    // Adjust based on threat confidence
    const confidenceImpact = threat.confidence * 0.2

    return Math.min(baseImpact + actionImpact + confidenceImpact, 1)
  } catch (error: unknown) {
    logger.error('Failed to calculate estimated impact:', { error })
    return 0.5
  }
}

export function validateResponseStrategy(strategy: ResponseStrategy): void {
  if (
    !strategy.strategyId ||
    !strategy.responseActions ||
    strategy.responseActions.length === 0
  ) {
    throw new Error('Invalid response strategy: missing required fields')
  }

  if (strategy.priority < 0 || strategy.priority > 100) {
    throw new Error(
      'Invalid response strategy: priority must be between 0 and 100',
    )
  }
}
