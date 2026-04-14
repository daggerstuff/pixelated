import { describe, expect, it } from 'vitest'

import { MLAnomalyDetector } from '../analyzers/ml-anomaly-detector'

describe('MLAnomalyDetector reconstruction threshold mapping', () => {
  it('prefers dedicated reconstruction baseline threshold', () => {
    const detector = new MLAnomalyDetector('/tmp/model') as any

    const threshold = detector.getReconstructionThreshold({
      baselineMetrics: {
        reconstructionThreshold: 0.35,
        sequentialThreshold: 0.9,
      },
      anomalyThresholds: {
        sequential: 0.7,
      },
    })

    expect(threshold).toBe(0.35)
  })

  it('falls back to anomaly threshold then sequential baseline', () => {
    const detector = new MLAnomalyDetector('/tmp/model') as any

    const fromAnomalyThreshold = detector.getReconstructionThreshold({
      baselineMetrics: {
        sequentialThreshold: 0.45,
      },
      anomalyThresholds: {
        sequential: 0.25,
      },
    })

    const fromSequentialBaseline = detector.getReconstructionThreshold({
      baselineMetrics: {
        sequentialThreshold: 0.42,
      },
      anomalyThresholds: {
        sequential: undefined,
      },
    })

    expect(fromAnomalyThreshold).toBe(0.25)
    expect(fromSequentialBaseline).toBe(0.42)
  })

  it('uses a safe default when profile thresholds are missing', () => {
    const detector = new MLAnomalyDetector('/tmp/model') as any

    const threshold = detector.getReconstructionThreshold({
      baselineMetrics: {},
      anomalyThresholds: {},
    })

    expect(threshold).toBe(0.1)
  })
})
