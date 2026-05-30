import { describe, it, expect } from 'vitest'
import { getRecommendedScenario } from './scenarios'
import { ScenarioDifficulty } from '../types'

describe('scenarios utilities', () => {
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
