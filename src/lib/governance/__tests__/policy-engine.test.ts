import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngine, PolicyEvaluationResult } from '../policy-engine';

describe('PolicyEngine', () => {
  let policyEngine: PolicyEngine;

  beforeEach(() => {
    policyEngine = new PolicyEngine();
  });

  describe('evaluate', () => {
    it('evaluates policy with matching conditions and returns allowed: true', async () => {
      // Create a policy that allows operations where dataClassification equals 'public'
      const policy = {
        policyId: 'test-policy-1',
        rules: [
          {
            ruleId: 'rule-1',
            conditions: [
              {
                field: 'dataClassification',
                operator: 'equals' as const,
                value: 'public',
              },
            ],
            action: {
              type: 'allow' as const,
            },
          },
        ],
      };

      policyEngine.loadPolicy(policy);

      const context = { dataClassification: 'public' };
      const result: PolicyEvaluationResult = await policyEngine.evaluate(context);

      expect(result.allowed).toBe(true);
      expect(result.policyId).toBe('test-policy-1');
      expect(result.ruleId).toBe('rule-1');
    });

    it('denies policy with non-matching conditions and returns allowed: false', async () => {
      // Create a policy that allows operations where dataClassification equals 'public'
      const policy = {
        policyId: 'test-policy-2',
        rules: [
          {
            ruleId: 'rule-1',
            conditions: [
              {
                field: 'dataClassification',
                operator: 'equals' as const,
                value: 'public',
              },
            ],
            action: {
              type: 'allow' as const,
            },
          },
        ],
      };

      policyEngine.loadPolicy(policy);

      // Context doesn't match the condition (confidential !== public)
      const context = { dataClassification: 'confidential' };
      const result: PolicyEvaluationResult = await policyEngine.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.policyId).toBe('test-policy-2');
    });
  });
});
