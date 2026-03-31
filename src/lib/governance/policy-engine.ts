import type { GovernancePolicy, PolicyEvaluationResult, PolicyEvaluationContext } from './types'

const logger = {
  info: (msg: string) => console.log(`[policy-engine] ${msg}`)
}

export class PolicyEngine {
  private policies: Map<string, GovernancePolicy> = new Map()
  private loadedVersion: string | null = null

  async loadPolicy(policy: GovernancePolicy): Promise<void> {
    this.policies.set(policy.id, policy)
    this.loadedVersion = policy.version
    logger.info(`Loaded policy ${policy.id} v${policy.version}`)
  }

  async evaluate(context: PolicyEvaluationContext): Promise<PolicyEvaluationResult> {
    for (const [, policy] of this.policies) {
      for (const rule of policy.rules) {
        if (rule.action !== context.action) continue

        const matches = rule.conditions.every(cond => {
          const contextValue = context.context[cond.field]
          switch (cond.operator) {
            case 'equals': return contextValue === cond.value
            case 'contains': return String(contextValue).includes(cond.value)
            case 'regex': return new RegExp(cond.value).test(String(contextValue))
            default: return false
          }
        })

        if (matches) {
          return { allowed: true, reason: 'Policy matched', policyId: policy.id, ruleId: rule.id }
        }
      }
    }
    return { allowed: false, reason: 'No matching policy', policyId: 'none' }
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
