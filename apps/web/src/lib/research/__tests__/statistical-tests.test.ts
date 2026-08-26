import { describe, it, expect, beforeEach } from 'vitest'

import {
  getStatisticalTestService,
  resetStatisticalTestService,
} from '../lib/services/StatisticalTestService'

describe('StatisticalTestService', () => {
  let service: ReturnType<typeof getStatisticalTestService>

  beforeEach(() => {
    resetStatisticalTestService()
    service = getStatisticalTestService()
  })

  describe('welchTTest', () => {
    it('should reject null for clearly different groups', () => {
      const group1 = [10, 12, 11, 13, 14, 10, 12, 11, 13, 12]
      const group2 = [20, 22, 21, 23, 24, 20, 22, 21, 23, 22]
      const result = service.welchTTest(group1, group2, 0.05)
      expect(result.pValue).toBeLessThan(0.001)
      expect(result.conclusion).toBe('reject_null')
      expect(Math.abs(result.effectSize)).toBeGreaterThan(2)
    })

    it('should fail to reject for similar groups', () => {
      const group1 = [12, 8, 11, 9, 13, 7, 10, 14, 6, 10]
      const group2 = [10, 11, 9, 12, 8, 13, 7, 10, 11, 9]
      const result = service.welchTTest(group1, group2, 0.05)
      expect(result.pValue).toBeGreaterThan(0.05)
      expect(result.conclusion).toBe('fail_to_reject')
    })

    it('should compute valid confidence interval', () => {
      const group1 = [1, 2, 3, 4, 5]
      const group2 = [6, 7, 8, 9, 10]
      const result = service.welchTTest(group1, group2, 0.05)
      expect(result.confidenceInterval[0]).toBeLessThan(
        result.confidenceInterval[1],
      )
      expect(result.confidenceInterval[0]).toBeLessThan(0)
      expect(result.confidenceInterval[1]).toBeLessThan(0)
    })

    it('should compute degrees of freedom', () => {
      const result = service.welchTTest([1, 2, 3], [4, 5, 6], 0.05)
      expect(result.degreesOfFreedom).toBeGreaterThan(0)
      expect(result.degreesOfFreedom).toBeLessThanOrEqual(4)
    })
  })

  describe('chiSquareGoodnessOfFit', () => {
    it('should reject for poor fit', () => {
      const observed = [100, 10, 10, 10]
      const expected = [32.5, 32.5, 32.5, 32.5]
      const result = service.chiSquareGoodnessOfFit(observed, expected, 0.05)
      expect(result.pValue).toBeLessThan(0.05)
      expect(result.conclusion).toBe('reject_null')
    })

    it('should fail to reject for good fit', () => {
      const observed = [30, 35, 32, 33]
      const expected = [32.5, 32.5, 32.5, 32.5]
      const result = service.chiSquareGoodnessOfFit(observed, expected, 0.05)
      expect(result.pValue).toBeGreaterThan(0.05)
      expect(result.conclusion).toBe('fail_to_reject')
    })

    it('should compute effect size', () => {
      const result = service.chiSquareGoodnessOfFit([10, 20], [15, 15], 0.05)
      expect(result.effectSize).toBeGreaterThanOrEqual(0)
      expect(result.effectSize).toBeLessThanOrEqual(1)
    })
  })

  describe('chiSquareIndependence', () => {
    it('should detect independence in balanced table', () => {
      const table = [
        [50, 50],
        [50, 50],
      ]
      const result = service.chiSquareIndependence(table, 0.05)
      expect(result.pValue).toBeGreaterThan(0.05)
      expect(result.conclusion).toBe('fail_to_reject')
    })

    it('should detect dependence in imbalanced table', () => {
      const table = [
        [100, 10],
        [10, 100],
      ]
      const result = service.chiSquareIndependence(table, 0.05)
      expect(result.pValue).toBeLessThan(0.001)
      expect(result.conclusion).toBe('reject_null')
    })
  })

  describe('pearsonCorrelation', () => {
    it('should compute strong positive correlation', () => {
      const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const y = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]
      const result = service.pearsonCorrelation(x, y, 0.05)
      expect(result.coefficient).toBeGreaterThan(0.99)
      expect(result.pValue).toBeLessThan(0.001)
      expect(result.conclusion).toBe('reject_null')
    })

    it('should compute zero correlation for random data', () => {
      const x = [1, 5, 3, 7, 2, 8, 4, 6, 9, 10]
      const y = [10, 2, 8, 4, 6, 1, 9, 3, 5, 7]
      const result = service.pearsonCorrelation(x, y, 0.05)
      expect(Math.abs(result.coefficient)).toBeLessThan(0.6)
    })

    it('should compute valid confidence interval', () => {
      const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const y = [3, 5, 6, 9, 10, 13, 14, 17, 20, 21]
      const result = service.pearsonCorrelation(x, y, 0.05)
      expect(result.confidenceInterval[0]).toBeLessThanOrEqual(
        result.confidenceInterval[1],
      )
    })
  })

  describe('spearmanCorrelation', () => {
    it('should compute monotonic correlation', () => {
      const x = [1, 2, 3, 4, 5]
      const y = [10, 20, 30, 40, 50]
      const result = service.spearmanCorrelation(x, y, 0.05)
      expect(result.coefficient).toBeGreaterThan(0.9)
    })
  })

  describe('cohenD', () => {
    it('should compute large effect size for distant groups', () => {
      const d = service.cohenD([1, 2, 3, 4, 5], [10, 11, 12, 13, 14])
      expect(Math.abs(d)).toBeGreaterThan(0.8)
    })

    it('should compute near-zero for identical groups', () => {
      const d = service.cohenD([1, 2, 3], [1, 2, 3])
      expect(d).toBe(0)
    })
  })

  describe('oddsRatio', () => {
    it('should compute odds ratio for 2x2 table', () => {
      const result = service.oddsRatio(100, 50, 30, 120, 0.95)
      expect(result.oddsRatio).toBeGreaterThan(1)
      expect(result.confidenceInterval[0]).toBeLessThan(
        result.confidenceInterval[1],
      )
    })
  })

  describe('meanConfidenceInterval', () => {
    it('should compute valid CI for normal data', () => {
      const data = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
      const result = service.meanConfidenceInterval(data, 0.95)
      expect(result.lower).toBeLessThan(result.upper)
      expect(result.margin).toBeGreaterThan(0)
    })
  })

  describe('singleton', () => {
    it('should return same instance', () => {
      const s1 = getStatisticalTestService()
      const s2 = getStatisticalTestService()
      expect(s1).toBe(s2)
    })

    it('should return new instance after reset', () => {
      const s1 = getStatisticalTestService()
      resetStatisticalTestService()
      const s2 = getStatisticalTestService()
      expect(s1).not.toBe(s2)
    })
  })
})
