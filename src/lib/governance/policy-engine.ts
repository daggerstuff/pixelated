/**
 * Policy Engine for Data Governance
 *
 * Evaluates policies against context to determine if operations are allowed.
 * Supports condition operators: 'equals', 'contains', 'regex'
 */

/**
 * Result of evaluating a policy
 */
export interface PolicyEvaluationResult {
  /** Whether the operation is allowed */
  allowed: boolean;
  /** Reason for the decision */
  reason: string;
  /** ID of the policy that was evaluated */
  policyId: string;
  /** ID of the rule that matched (or failed to match) */
  ruleId: string;
}

/**
 * A condition that checks a field against a value
 */
export interface PolicyCondition {
  /** The field to check in the context */
  field: string;
  /** The operator to use: 'equals' | 'contains' | 'regex' */
  operator: 'equals' | 'contains' | 'regex';
  /** The value to compare against */
  value: string;
}

/**
 * An action to take when conditions match
 */
export interface PolicyAction {
  /** The type of action: 'allow' | 'deny' */
  type: 'allow' | 'deny';
}

/**
 * A rule within a policy
 */
export interface PolicyRule {
  /** Unique identifier for the rule */
  ruleId: string;
  /** Conditions to evaluate */
  conditions: PolicyCondition[];
  /** Action to take if conditions match */
  action: PolicyAction;
}

/**
 * A policy definition
 */
export interface Policy {
  /** Unique identifier for the policy */
  policyId: string;
  /** Rules within the policy */
  rules: PolicyRule[];
}

/**
 * Context for policy evaluation
 */
export type PolicyContext = Record<string, string>;

/**
 * PolicyEngine evaluates policies against context
 */
export class PolicyEngine {
  private policies: Map<string, Policy> = new Map();

  /**
   * Load a policy into the engine
   * @param policy The policy to load
   */
  loadPolicy(policy: Policy): void {
    this.policies.set(policy.policyId, policy);
  }

  /**
   * Evaluate context against all loaded policies
   * @param context The context to evaluate
   * @returns The evaluation result
   */
  async evaluate(context: PolicyContext): Promise<PolicyEvaluationResult> {
    // Iterate through all policies and rules
    for (const policy of this.policies.values()) {
      for (const rule of policy.rules) {
        const matches = this.evaluateConditions(rule.conditions, context);

        if (matches) {
          // Conditions matched - return the action
          return {
            allowed: rule.action.type === 'allow',
            reason: `Policy ${policy.policyId} rule ${rule.ruleId} ${rule.action.type === 'allow' ? 'allowed' : 'denied'}`,
            policyId: policy.policyId,
            ruleId: rule.ruleId,
          };
        }
      }
    }

    // No rules matched - default deny
    const firstPolicy = this.policies.values().next().value;
    return {
      allowed: false,
      reason: 'No matching policy rules found',
      policyId: firstPolicy?.policyId || 'unknown',
      ruleId: 'none',
    };
  }

  /**
   * Evaluate conditions against context
   * @param conditions The conditions to evaluate
   * @param context The context to check against
   * @returns true if all conditions match
   */
  private evaluateConditions(conditions: PolicyCondition[], context: PolicyContext): boolean {
    return conditions.every((condition) => {
      const contextValue = context[condition.field];

      if (contextValue === undefined) {
        return false;
      }

      switch (condition.operator) {
        case 'equals':
          return contextValue === condition.value;
        case 'contains':
          return contextValue.includes(condition.value);
        case 'regex':
          const regex = new RegExp(condition.value);
          return regex.test(contextValue);
        default:
          return false;
      }
    });
  }
}
