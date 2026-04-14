// Governance policy schema

export interface GovernancePolicy {
  id: string
  version: string
  rules: GovernanceRule[]
}

export interface GovernanceRule {
  id: string
  action: 'encrypt' | 'access' | 'delete' | 'share'
  conditions: Condition[]
  required: RequiredCondition[]
}

export interface Condition {
  field: string
  operator: 'equals' | 'contains' | 'regex'
  value: string
}

export type RequiredCondition =
  | 'fhe_encryption'
  | 'audit_logged'
  | 'consent_verified'

export interface PolicyEvaluationResult {
  allowed: boolean
  reason: string
  policyId: string
  ruleId?: string
}

export interface PolicyEvaluationContext {
  action: string
  context: Record<string, unknown>
}
