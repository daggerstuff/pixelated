import type {
  GovernancePolicy,
  PolicyEvaluationResult,
  PolicyEvaluationContext,
  RequiredCondition,
} from './types'

const logger = {
  info: (msg: string) => console.log(`[policy-engine] ${msg}`),
}

// Validate regex pattern for safety (prevents catastrophic backtracking)
function isValidRegexPattern(pattern: string): boolean {
  // Reject nested quantifiers which cause catastrophic backtracking
  // Examples of dangerous patterns: (a+)+, (a*)+, (a|b+)+, a{2,3}+
  if (/[+*][+*]|\{[0-9,]+\}[+*]|\([^)]*[+*][^)]*\)[+*]/.test(pattern)) {
    logger.info(`Rejected nested quantifier pattern: ${pattern}`)
    return false
  }
  // Reject patterns with excessive backreferences
  if ((pattern.match(/\\[1-9]/g) || []).length > 5) {
    logger.info(`Rejected pattern with too many backreferences: ${pattern}`)
    return false
  }
  return true
}

// Cache for compiled regex patterns
interface CompiledRule {
  id: string
  action: string
  conditions: Array<{ field: string; test: (value: unknown) => boolean }>
  required: RequiredCondition[]
}

interface CompiledPolicy {
  id: string
  version: string
  rules: CompiledRule[]
}

export class PolicyEngine {
  private policies: Map<string, CompiledPolicy> = new Map()
  private loadedVersion: string | null = null

  async loadPolicy(policy: GovernancePolicy): Promise<void> {
    // Pre-compile rules for performance and safety
    const compiledPolicy: CompiledPolicy = {
      id: policy.id,
      version: policy.version,
      rules: policy.rules.map((rule) => ({
        id: rule.id,
        action: rule.action,
        conditions: rule.conditions.map((cond) => {
          // Pre-compile regex ONCE during load
          let compiledRegex: RegExp | null = null
          if (cond.operator === 'regex') {
            if (isValidRegexPattern(cond.value)) {
              compiledRegex = new RegExp(cond.value)
            }
          }

          return {
            field: cond.field,
            test: (value: unknown) => {
              const strValue = String(value ?? '')
              switch (cond.operator) {
                case 'equals':
                  return value === cond.value
                case 'contains':
                  return strValue.includes(cond.value)
                case 'regex':
                  // Use pre-compiled regex (or reject if unsafe)
                  if (!compiledRegex) return false
                  return compiledRegex.test(strValue)
                default:
                  return false
              }
            },
          }
        }),
        required: rule.required,
      })),
    }
    this.policies.set(compiledPolicy.id, compiledPolicy)
    this.loadedVersion = policy.version
    logger.info(`Loaded policy ${policy.id} v${policy.version}`)
  }

  async evaluate(
    context: PolicyEvaluationContext,
  ): Promise<PolicyEvaluationResult> {
    for (const [, policy] of this.policies) {
      for (const rule of policy.rules) {
        if (rule.action !== context.action) continue

        // Check conditions
        const matches = rule.conditions.every((cond) =>
          cond.test(context.context[cond.field]),
        )
        if (!matches) continue

        // Check required security controls
        const missingRequired = this.checkRequiredControls(
          rule.required,
          context,
        )
        if (missingRequired.length > 0) {
          return {
            allowed: false,
            reason: `Missing required controls: ${missingRequired.join(', ')}`,
            policyId: policy.id,
            ruleId: rule.id,
          }
        }

        return {
          allowed: true,
          reason: 'Policy matched',
          policyId: policy.id,
          ruleId: rule.id,
        }
      }
    }
    return { allowed: false, reason: 'No matching policy', policyId: 'none' }
  }

  private checkRequiredControls(
    required: RequiredCondition[],
    context: PolicyEvaluationContext,
  ): string[] {
    const missing: string[] = []
    const ctx = context.context as Record<string, unknown>

    for (const req of required) {
      switch (req) {
        case 'fhe_encryption':
          if (!ctx.fheEncryptionActive) missing.push('FHE encryption')
          break
        case 'audit_logged':
          if (!ctx.auditEnabled) missing.push('audit logging')
          break
        case 'consent_verified':
          if (!ctx.consentVerified) missing.push('consent verification')
          break
      }
    }
    return missing
  }

  async reloadPolicies(): Promise<void> {
    // TODO: Hot-reload from MongoDB
    logger.info('Policy reload triggered')
  }

  getVersion(): string | null {
    return this.loadedVersion
  }
}

export interface PolicyEvaluationContext {
  action: string
  context: Record<string, unknown>
}
