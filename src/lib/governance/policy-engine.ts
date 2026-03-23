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
  operator: "equals" | "contains" | "regex";
  /** The value to compare against */
  value: string;
}

/**
 * An action to take when conditions match
 */
export interface PolicyAction {
  /** The type of action: 'allow' | 'deny' */
  type: "allow" | "deny";
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
  private loadedVersion: string | null = null;

  /**
   * Load a policy into the engine
   * @param policy The policy to load
   * @param version Optional version string for tracking
   */
  loadPolicy(policy: Policy, version?: string): void {
    this.policies.set(policy.policyId, policy);
    if (version) {
      this.loadedVersion = version;
    }
  }

  /**
   * Get the currently loaded policy version
   * @returns The version string or null if no policies loaded
   */
  getVersion(): string | null {
    return this.loadedVersion;
  }

  /**
   * Reload policies from PolicyStore
   * @param policyStore The PolicyStore instance to load from
   * @param policyId The policy ID to load
   */
  async reloadPolicies(
    policyStore: { getPolicy: (policyId: string) => Promise<any> },
    policyId: string,
  ): Promise<void> {
    const policy = await policyStore.getPolicy(policyId);
    if (policy) {
      // Convert GovernancePolicy to Policy format
      const convertedPolicy: Policy = {
        policyId: policy.id,
        rules: policy.rules.map((rule: any) => ({
          ruleId: rule.id || rule.ruleId,
          conditions: rule.conditions || [],
          action: {
            type:
              rule.action === "allow" || rule.action === "deny"
                ? (rule.action as "allow" | "deny")
                : ("allow" as const),
          },
        })),
      };
      this.loadPolicy(convertedPolicy, policy.version);
    }
    console.info(`Policy reload triggered for: ${policyId}`);
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
            allowed: rule.action.type === "allow",
            reason: `Policy ${policy.policyId} rule ${rule.ruleId} ${rule.action.type === "allow" ? "allowed" : "denied"}`,
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
      reason: "No matching policy rules found",
      policyId: firstPolicy?.policyId || "unknown",
      ruleId: "none",
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
        case "equals":
          return contextValue === condition.value;
        case "contains":
          return contextValue.includes(condition.value);
        case "regex": {
          const regex = new RegExp(condition.value);
          return regex.test(contextValue);
        }
        default:
          return false;
      }
    });
  }
}
