import { describe, it, expect } from 'vitest';
import { getRecommendedScenario, getScenarios, ScenarioDifficulty } from '../scenarios';

describe('scenarios utility functions', () => {
  describe('getRecommendedScenario', () => {
    it('returns null if all available scenarios are completed', async () => {
      // Fetch all available scenarios dynamically so the test is robust
      // against data changes in the actual implementation.
      const allScenarios = await getScenarios();
      const allIds = allScenarios.map(s => s.id);
      const result = await getRecommendedScenario(allIds, ScenarioDifficulty.BEGINNER);
      expect(result).toBeNull();
    });

    it('returns a matching difficulty scenario if available', async () => {
      const allScenarios = await getScenarios();
      const beginnerScenario = allScenarios.find((s) => s.difficulty === ScenarioDifficulty.BEGINNER);
      expect(beginnerScenario).toBeDefined();
      const completedIds = allScenarios
        .filter((s) => s.id !== beginnerScenario!.id)
        .map((s) => s.id);
      const result = await getRecommendedScenario(completedIds, ScenarioDifficulty.BEGINNER);
      expect(result).not.toBeNull();
      expect(result?.difficulty).toBe(ScenarioDifficulty.BEGINNER);
    });
  });
});