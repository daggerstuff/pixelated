import { describe, it, expect } from 'vitest'
import { isPartialBiasDashboardSummary } from '../dashboard-type-guards'

describe('isPartialBiasDashboardSummary', () => {
  it('should return true for valid partial dashboard summary', () => {
    const valid = {
      totalSessions: 42,
      trendDirection: 'up'
    }
    expect(isPartialBiasDashboardSummary(valid)).toBe(true)
  })

  it('should return false for invalid trendDirection', () => {
    const invalid = {
      trendDirection: 'left' // invalid string
    }
    expect(isPartialBiasDashboardSummary(invalid)).toBe(false)
  })

  it('should return false for non-objects', () => {
    expect(isPartialBiasDashboardSummary(null)).toBe(false)
    expect(isPartialBiasDashboardSummary(42)).toBe(false)
    expect(isPartialBiasDashboardSummary('string')).toBe(false)
  })
})
