import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PolicyEngine, Policy, PolicyEvaluationResult } from '../policy-engine';

describe('PolicyEngine - Hot Reload', () => {
  let policyEngine: PolicyEngine;

  beforeEach(() => {
    policyEngine = new PolicyEngine();
  });

  describe('getVersion', () => {
    it('returns null when no policies loaded', () => {
      const version = policyEngine.getVersion();
      expect(version).toBeNull();
    });

    it('returns the loaded version after loading policies', () => {
      const policy: Policy = {
        policyId: 'test-policy',
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

      policyEngine.loadPolicy(policy, 'v1.0.0');
      const version = policyEngine.getVersion();

      expect(version).toBe('v1.0.0');
    });
  });

  describe('reloadPolicies', () => {
    it('reloads policies from PolicyStore and updates version', async () => {
      // Mock PolicyStore
      const mockPolicyStore = {
        getPolicy: vi.fn(),
      };

      const mockPolicy = {
        id: 'reload-test-policy',
        version: 'v2.0.0',
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

      mockPolicyStore.getPolicy.mockResolvedValue(mockPolicy);

      // Load initial policy
      const initialPolicy: Policy = {
        policyId: 'initial-policy',
        rules: [
          {
            ruleId: 'rule-1',
            conditions: [
              {
                field: 'dataClassification',
                operator: 'equals' as const,
                value: 'confidential',
              },
            ],
            action: {
              type: 'allow' as const,
            },
          },
        ],
      };

      policyEngine.loadPolicy(initialPolicy, 'v0.0.1');

      // Reload with new policy from store
      await policyEngine.reloadPolicies(mockPolicyStore as any, 'reload-test-policy');

      // Verify version updated
      expect(policyEngine.getVersion()).toBe('v2.0.0');

      // Verify policy was reloaded - should now allow 'public' classification
      const context = { dataClassification: 'public' };
      const result: PolicyEvaluationResult = await policyEngine.evaluate(context);

      expect(result.allowed).toBe(true);
      expect(result.policyId).toBe('reload-test-policy');
    });

    it('logs info message when reload triggered', async () => {
      const mockPolicyStore = {
        getPolicy: vi.fn().mockResolvedValue(null),
      };

      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      await policyEngine.reloadPolicies(mockPolicyStore as any, 'test-policy');

      expect(consoleSpy).toHaveBeenCalledWith('Policy reload triggered for: test-policy');

      consoleSpy.mockRestore();
    });
  });
});
