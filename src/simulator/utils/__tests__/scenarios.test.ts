<<<<<<< HEAD
import { describe, it, expect } from 'vitest'

import {
  getRecommendedScenario,
  getScenarios,
  ScenarioDifficulty,
} from '../scenarios'
=======
import { describe, it, expect } from 'vitest';
import { getRecommendedScenario, getScenarios } from '../scenarios';
import { ScenarioDifficulty } from '../../types';
>>>>>>> a8591b08b (Fix scenarios test for getRecommendedScenario by using valid literal union types)

describe('scenarios utility functions', () => {
  describe('getRecommendedScenario', () => {
    it('returns null if all available scenarios are completed', async () => {
      // Fetch all available scenarios dynamically so the test is robust
      // against data changes in the actual implementation.
<<<<<<< HEAD
      const allScenarios = await getScenarios()
      const allIds = allScenarios.map((s) => s.id)
      const result = await getRecommendedScenario(
        allIds,
        ScenarioDifficulty.BEGINNER,
      )
      expect(result).toBeNull()
    })

    it('returns a matching difficulty scenario if available', async () => {
      const allScenarios = await getScenarios()
      const beginnerScenarios = allScenarios.filter(
        (s) => s.difficulty === ScenarioDifficulty.BEGINNER,
      )

      // Ensure we have at least 2 beginner scenarios to test properly
      expect(beginnerScenarios.length).toBeGreaterThanOrEqual(2)

      const beginnerScenario = beginnerScenarios[0]
      const completedIds = allScenarios
        .filter((s) => s.id !== beginnerScenario.id)
        .map((s) => s.id)
      const result = await getRecommendedScenario(
        completedIds,
        ScenarioDifficulty.BEGINNER,
      )
      expect(result).not.toBeNull()
      expect(result?.difficulty).toBe(ScenarioDifficulty.BEGINNER)
    })
  })
})
=======
      const allScenarios = await getScenarios();
      const allIds = allScenarios.map(s => s.id);
      const result = await getRecommendedScenario(allIds, 'beginner');
      expect(result).toBeNull();
    });

    it('returns a matching difficulty scenario if available', async () => {
      const allScenarios = await getScenarios();
      // Use intermediate since there are multiple intermediate scenarios in example data
      const intermediateScenarios = allScenarios.filter((s) => s.difficulty === ScenarioDifficulty.INTERMEDIATE);
      
      // Ensure we have at least 2 intermediate scenarios to test properly
      expect(intermediateScenarios.length).toBeGreaterThanOrEqual(2);
      
      const intermediateScenario = intermediateScenarios[0];
      const completedIds = allScenarios
        .filter((s) => s.id !== intermediateScenario.id)
        .map((s) => s.id);
      const result = await getRecommendedScenario(completedIds, 'intermediate');
      expect(result).not.toBeNull();
      expect(result?.difficulty).toBe(ScenarioDifficulty.INTERMEDIATE);
    });
  });
});
>>>>>>> a8591b08b (Fix scenarios test for getRecommendedScenario by using valid literal union types)
