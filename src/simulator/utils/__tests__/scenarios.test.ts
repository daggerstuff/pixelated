import { describe, it, expect } from 'vitest';
import { getRecommendedScenario, getScenarios } from '../scenarios';

describe('scenarios utility functions', () => {
  describe('getRecommendedScenario', () => {
    it('returns null if all available scenarios are completed', async () => {
      // Fetch all available scenarios dynamically so the test is robust
      // against data changes in the actual implementation.
      const allScenarios = await getScenarios();
      const allIds = allScenarios.map(s => s.id);

      const result = await getRecommendedScenario(allIds, 'beginner');

      expect(result).toBeNull();
    });
  });
});
