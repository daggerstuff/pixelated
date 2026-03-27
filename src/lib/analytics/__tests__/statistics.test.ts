import { describe, it, expect } from 'vitest'
import { StatisticalAnalysis } from '../statistics'

describe('StatisticalAnalysis', () => {
  describe('calculateTrend', () => {
    it('returns 0 for empty array or less than 2 elements', () => {
      expect(StatisticalAnalysis.calculateTrend([])).toBe(0)
      expect(StatisticalAnalysis.calculateTrend([5])).toBe(0)
    })

    it('returns a positive trend for increasing values', () => {
      const data = [1, 2, 3, 4, 5]
      const trend = StatisticalAnalysis.calculateTrend(data)
      expect(trend).toBeGreaterThan(0)
    })

    it('returns a negative trend for decreasing values', () => {
      const data = [5, 4, 3, 2, 1]
      const trend = StatisticalAnalysis.calculateTrend(data)
      expect(trend).toBeLessThan(0)
    })

    it('returns 0 for stable values', () => {
      const data = [3, 3, 3, 3, 3]
      const trend = StatisticalAnalysis.calculateTrend(data)
      expect(trend).toBe(0)
    })
  })
})
