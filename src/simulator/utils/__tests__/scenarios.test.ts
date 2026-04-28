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

    it('returns a matching difficulty scenario if available', async () => {
      const allScenarios = await getScenarios();
      // Ensure we leave at least one beginner scenario uncompleted
      const beginnerScenario = allScenarios.find(s => s.difficulty === 'beginner');
      if (beginnerScenario) {
        const completedIds = allScenarios
          .filter(s => s.id !== beginnerScenario.id)
          .map(s => s.id);
        const result = await getRecommendedScenario(completedIds, 'beginner');
        expect(result).not.toBeNull();
        expect(result?.id).toBe(beginnerScenario.id);
      }
    });
  });
});
