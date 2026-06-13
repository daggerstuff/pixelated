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
