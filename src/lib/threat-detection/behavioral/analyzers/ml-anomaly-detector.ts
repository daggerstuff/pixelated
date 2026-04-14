import * as tf from '@tensorflow/tfjs'

import type {
  Anomaly,
  AnomalyDetector,
  BehaviorProfile,
  BehavioralFeatures,
} from '../behavioral-analysis-service'

/**
 * MockIsolationForest - Placeholder until real Isolation Forest implementation is integrated.
 * Returns random scores in 0.1-0.3 range (normal behavior) to avoid false positives.
 * TODO: Replace with actual Isolation Forest implementation
 */
class MockIsolationForest {
  constructor(_nTrees: number, _sampleSize: number) {}

  predict(data: number[][]): number[] {
    // Return random scores in low range - real implementation needed for actual detection
    return data.map(() => Math.random() * 0.2 + 0.1) // 0.1 to 0.3 range
  }
}

const FEATURE_VECTOR_DIMENSION = 10

export class MLAnomalyDetector implements AnomalyDetector {
  private model: tf.Sequential | null = null
  private isolationForest: MockIsolationForest | null = null

  constructor(private readonly modelPath: string) {
    void this.modelPath
  }

  async detectAnomalies(
    profile: BehaviorProfile,
    features: BehavioralFeatures,
  ): Promise<Anomaly[]> {
    try {
      const anomalies: Anomaly[] = []

      await this.initializeModels()

      const featureVector = this.featuresToVector(features)

      const mlAnomalies = await this.detectMLAnomalies(profile, featureVector)
      anomalies.push(...mlAnomalies)

      const statisticalAnomalies = await this.detectStatisticalAnomalies(
        profile,
        features,
      )
      anomalies.push(...statisticalAnomalies)

      const temporalAnomalies = await this.detectTemporalAnomalies(
        profile,
        features,
      )
      anomalies.push(...temporalAnomalies)

      return this.filterAndRankAnomalies(anomalies)
    } catch (error: unknown) {
      console.error('Error in ML anomaly detection:', error)
      return []
    }
  }

  private async initializeModels(): Promise<void> {
    if (this.model && this.isolationForest) {
      return
    }

    this.model = tf.sequential()
    this.model.add(
      tf.layers.dense({
        units: 32,
        activation: 'relu',
        inputShape: [FEATURE_VECTOR_DIMENSION],
      }),
    )
    this.model.add(tf.layers.dropout({ rate: 0.2 }))
    this.model.add(
      tf.layers.dense({
        units: 16,
        activation: 'relu',
      }),
    )
    this.model.add(
      tf.layers.dense({
        units: 10,
        activation: 'linear',
      }),
    )

    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
    })

    this.isolationForest = new MockIsolationForest(100, 256)
  }

  private featuresToVector(features: BehavioralFeatures): number[] {
    const vector = [
      features.temporal.avgSessionDuration / 3600,
      features.temporal.timeOfDayPreference,
      features.temporal.activityFrequency,
      features.temporal.sessionRegularity,
      features.spatial.ipDiversity,
      features.spatial.geographicSpread,
      features.sequential.sequenceEntropy,
      features.frequency.eventFrequency / 100,
      features.frequency.endpointFrequency['/api/sensitive'] || 0,
      features.contextual.deviceCharacteristics.deviceType === 'mobile' ? 1 : 0,
    ]

    if (vector.length !== FEATURE_VECTOR_DIMENSION) {
      throw new Error(
        `Feature vector dimension mismatch: expected ${FEATURE_VECTOR_DIMENSION}, got ${vector.length}`,
      )
    }

    return vector
  }

  private async detectMLAnomalies(
    profile: BehaviorProfile,
    featureVector: number[],
  ): Promise<Anomaly[]> {
    if (!this.model || !this.isolationForest) {
      return []
    }

    const anomalies: Anomaly[] = []

    try {
      const { model, isolationForest } = this
      if (!model || !isolationForest) {
        return []
      }

      const reconstructionErrorTensor = tf.tidy(() => {
        const inputTensor = tf.tensor2d([featureVector])
        const reconstruction = model.predict(inputTensor) as tf.Tensor
        return tf.mean(tf.abs(tf.sub(inputTensor, reconstruction)))
      })

      const reconstructionErrorData = await reconstructionErrorTensor.data()
      const reconstructionError = reconstructionErrorData[0]
      reconstructionErrorTensor.dispose()

      const anomalyScore = isolationForest.predict([featureVector])[0]

      const reconstructionThreshold = this.getReconstructionThreshold(profile)

      if (reconstructionError > reconstructionThreshold) {
        anomalies.push({
          anomalyId: this.generateAnomalyId(),
          userId: profile.userId,
          patternId: 'ml_reconstruction_error',
          anomalyType: 'novelty',
          severity:
            reconstructionError > reconstructionThreshold * 2
              ? 'high'
              : 'medium',
          deviationScore: reconstructionError,
          confidence: 0.85,
          context: {
            type: 'autoencoder',
            error: reconstructionError,
            threshold: reconstructionThreshold,
          },
          timestamp: new Date(),
        })
      }

      const isolationThreshold = 0.6

      if (anomalyScore > isolationThreshold) {
        anomalies.push({
          anomalyId: this.generateAnomalyId(),
          userId: profile.userId,
          patternId: 'ml_isolation_forest',
          anomalyType: 'outlier',
          severity: anomalyScore > 0.8 ? 'critical' : 'high',
          deviationScore: anomalyScore,
          confidence: 0.9,
          context: {
            type: 'isolation_forest',
            score: anomalyScore,
            threshold: isolationThreshold,
          },
          timestamp: new Date(),
        })
      }
    } catch (error: unknown) {
      console.error('Error in ML anomaly detection:', error)
    }

    return anomalies
  }

  private async detectStatisticalAnomalies(
    profile: BehaviorProfile,
    features: BehavioralFeatures,
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = []

    const numericalFeatures = [
      features.temporal.activityFrequency,
      features.spatial.geographicSpread,
      features.sequential.sequenceEntropy,
    ]

    const baselineValues = [
      profile.baselineMetrics.frequencyThreshold,
      profile.baselineMetrics.geographicThreshold,
      profile.baselineMetrics.sequentialThreshold,
    ]

    numericalFeatures.forEach((value, index) => {
      const baseline = baselineValues[index]
      if (baseline && value > baseline * 2) {
        anomalies.push({
          anomalyId: this.generateAnomalyId(),
          userId: profile.userId,
          patternId: `statistical_${index}`,
          anomalyType: 'deviation',
          severity: value > baseline * 3 ? 'critical' : 'high',
          deviationScore: value / baseline,
          confidence: 0.75,
          context: {
            type: 'statistical',
            feature: ['activity', 'geographic', 'entropy'][index],
            value,
            baseline,
          },
          timestamp: new Date(),
        })
      }
    })

    return anomalies
  }

  private async detectTemporalAnomalies(
    profile: BehaviorProfile,
    features: BehavioralFeatures,
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = []

    const timePref = features.temporal.timeOfDayPreference
    const baselineTimeThreshold =
      profile.baselineMetrics.timeOfDayThreshold ?? 0.5

    if (timePref > 0.8) {
      anomalies.push({
        anomalyId: this.generateAnomalyId(),
        userId: profile.userId,
        patternId: 'temporal_unusual_time',
        anomalyType: 'novelty',
        severity: timePref > 0.9 ? 'high' : 'medium',
        deviationScore: timePref,
        confidence: 0.8,
        context: {
          type: 'temporal',
          timeOfDayPreference: timePref,
          baselineThreshold: baselineTimeThreshold,
        },
        timestamp: new Date(),
      })
    } else if (timePref > baselineTimeThreshold) {
      anomalies.push({
        anomalyId: this.generateAnomalyId(),
        userId: profile.userId,
        patternId: 'temporal_time_deviation',
        anomalyType: 'deviation',
        severity: 'low',
        deviationScore: timePref / baselineTimeThreshold,
        confidence: 0.65,
        context: {
          type: 'temporal',
          timeOfDayPreference: timePref,
          baselineThreshold: baselineTimeThreshold,
        },
        timestamp: new Date(),
      })
    }

    if (features.temporal.sessionRegularity < 0.3) {
      anomalies.push({
        anomalyId: this.generateAnomalyId(),
        userId: profile.userId,
        patternId: 'temporal_irregular_sessions',
        anomalyType: 'deviation',
        severity: 'low',
        deviationScore: 1 - features.temporal.sessionRegularity,
        confidence: 0.7,
        context: {
          type: 'temporal',
          sessionRegularity: features.temporal.sessionRegularity,
        },
        timestamp: new Date(),
      })
    }

    return anomalies
  }

  private filterAndRankAnomalies(anomalies: Anomaly[]): Anomaly[] {
    return anomalies
      .filter((anomaly) => anomaly.confidence > 0.6)
      .sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
        const severityDiff =
          severityOrder[b.severity] - severityOrder[a.severity]
        if (severityDiff !== 0) {
          return severityDiff
        }
        return b.confidence - a.confidence
      })
      .slice(0, 20)
  }

  private generateAnomalyId(): string {
    return `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getReconstructionThreshold(profile: BehaviorProfile): number {
    return (
      profile.baselineMetrics.reconstructionThreshold ??
      profile.anomalyThresholds.sequential ??
      profile.baselineMetrics.sequentialThreshold ??
      0.1
    )
  }
}
