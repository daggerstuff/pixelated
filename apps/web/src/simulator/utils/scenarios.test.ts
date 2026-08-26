import { describe, it, expect } from 'vitest'

import { ScenarioDifficulty, TherapeuticDomain } from '../types'
import { getRecommendedScenario, filterScenarios } from './scenarios'

describe('scenarios utilities', () => {
  describe('filterScenarios', () => {
    it('returns scenarios filtered by a specific domain', async () => {
      const result = await filterScenarios(TherapeuticDomain.ANXIETY)
      expect(result.length).toBeGreaterThan(0)
      result.forEach((scenario) => {
        expect(scenario.domain).toBe(TherapeuticDomain.ANXIETY)
      })
    })

    it('returns scenarios filtered by difficulty only', async () => {
      const result = await filterScenarios(
        undefined,
        ScenarioDifficulty.BEGINNER,
      )
      expect(result.length).toBeGreaterThan(0)
      result.forEach((scenario) => {
        expect(scenario.difficulty).toBe(ScenarioDifficulty.BEGINNER)
      })
    })

    it('returns scenarios filtered by both domain and difficulty', async () => {
      const result = await filterScenarios(
        TherapeuticDomain.DEPRESSION,
        ScenarioDifficulty.BEGINNER,
      )
      expect(result.length).toBeGreaterThan(0)
      result.forEach((scenario) => {
        expect(scenario.domain).toBe(TherapeuticDomain.DEPRESSION)
        expect(scenario.difficulty).toBe(ScenarioDifficulty.BEGINNER)
      })
    })

    it('returns all scenarios when no filter params provided', async () => {
      const result = await filterScenarios()
      expect(result.length).toBe(5)
    })
  })

  describe('getRecommendedScenario', () => {
    it('returns null if all available scenarios are completed', async () => {
      const completedIds = [
        'anxiety-001',
        'depression-001',
        'trauma-001',
        'family-001',
        'addiction-001',
      ]
      const result = await getRecommendedScenario(completedIds, 'beginner')
      expect(result).toBeNull()
    })

    it('returns a scenario with matching difficulty if available', async () => {
      const result = await getRecommendedScenario([], 'beginner')
      expect(result?.difficulty).toBe(ScenarioDifficulty.BEGINNER)
    })
  })
})
