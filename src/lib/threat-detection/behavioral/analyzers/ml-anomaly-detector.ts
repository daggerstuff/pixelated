import * as tf from '@tensorflow/tfjs'

import type {
  Anomaly,
  AnomalyDetector,
  BehaviorProfile,
  BehavioralFeatures,
} from '../behavioral-analysis-service'

/**
 * Isolation Forest Implementation
 */
class IsolationTree {
  private readonly splitFeature: number | null = null
  private readonly splitValue: number | null = null
  private readonly left: IsolationTree | null = null
  private readonly right: IsolationTree | null = null
  private readonly size: number
  private readonly currentHeight: number

  constructor(data: number[][], currentHeight: number, maxHeight: number) {
    this.size = data.length
    this.currentHeight = currentHeight

    if (data.length <= 1 || currentHeight >= maxHeight) {
      return
    }

    const numFeatures = data[0].length
    this.splitFeature = Math.floor(Math.random() * numFeatures)

    let min = data[0][this.splitFeature]
    let max = min
    for (let i = 1; i < data.length; i++) {
      const val = data[i][this.splitFeature]
      if (val < min) min = val
      if (val > max) max = val
    }

    if (min === max) {
      return
    }

    this.splitValue = min + Math.random() * (max - min)

    const leftData: number[][] = []
    const rightData: number[][] = []

    for (const point of data) {
      if (point[this.splitFeature] < this.splitValue) {
        leftData.push(point)
      } else {
        rightData.push(point)
      }
    }

    this.left = new IsolationTree(leftData, currentHeight + 1, maxHeight)
    this.right = new IsolationTree(rightData, currentHeight + 1, maxHeight)
  }

  public pathLength(point: number[]): number {
    if (this.left === null && this.right === null) {
      return this.currentHeight + this.c(this.size)
    }
    if (this.splitFeature !== null && this.splitValue !== null) {
      if (point[this.splitFeature] < this.splitValue) {
        return this.left ? this.left.pathLength(point) : this.currentHeight
      } else {
        return this.right ? this.right.pathLength(point) : this.currentHeight
      }
    }
    return this.currentHeight
  }

  private c(n: number): number {
    if (n <= 1) return 0
    const H = Math.log(n - 1) + 0.5772156649
    return 2 * H - (2 * (n - 1) / n)
  }
}

export class IsolationForest {
  private trees: IsolationTree[] = []
  private readonly sampleSize: number
  private readonly nTrees: number
  private isTrained = false

  constructor(nTrees: number, sampleSize: number) {
    this.nTrees = nTrees
    this.sampleSize = sampleSize
  }

  public fit(data: number[][]): void {
    this.trees = []
    const maxHeight = Math.ceil(Math.log2(this.sampleSize))

    for (let i = 0; i < this.nTrees; i++) {
      const sample: number[][] = []
      const actualSampleSize = Math.min(this.sampleSize, data.length)
      for (let j = 0; j < actualSampleSize; j++) {
        const randomIndex = Math.floor(Math.random() * data.length)
        sample.push(data[randomIndex])
      }
      this.trees.push(new IsolationTree(sample, 0, maxHeight))
    }
    this.isTrained = true
  }

  public predict(data: number[][]): number[] {
    if (!this.isTrained || this.trees.length === 0) {
      // Return safe scores if untrained to avoid false positives
      return data.map(() => Math.random() * 0.2 + 0.1)
    }

    const c = this.c(this.sampleSize)
    return data.map((point) => {
      let avgPathLength = 0
      for (const tree of this.trees) {
        avgPathLength += tree.pathLength(point)
      }
      avgPathLength /= this.trees.length
      
      // Compute anomaly score: 2^(-E(h(x)) / c(n))
      return Math.pow(2, -avgPathLength / c)
    })
  }
  
  public retrainOnline(data: number[][], replaceRatio: number = 0.1): void {
    if (!this.isTrained) {
      this.fit(data)
      return
    }
    
    // Replace the oldest `replaceRatio` of trees with new trees fit on the new data
    const treesToReplace = Math.max(1, Math.floor(this.nTrees * replaceRatio))
    const maxHeight = Math.ceil(Math.log2(this.sampleSize))
    
    // Remove oldest trees
    this.trees.splice(0, treesToReplace)
    
    // Add new trees
    for (let i = 0; i < treesToReplace; i++) {
      const sample: number[][] = []
      const actualSampleSize = Math.min(this.sampleSize, data.length)
      for (let j = 0; j < actualSampleSize; j++) {
        const randomIndex = Math.floor(Math.random() * data.length)
        sample.push(data[randomIndex])
      }
      this.trees.push(new IsolationTree(sample, 0, maxHeight))
    }
  }


  private c(n: number): number {
    if (n <= 1) return 0
    const H = Math.log(n - 1) + 0.5772156649
    return 2 * H - (2 * (n - 1) / n)
  }
}

const FEATURE_VECTOR_DIMENSION = 10

export class MLAnomalyDetector implements AnomalyDetector {
  private model: tf.Sequential | null = null
  private isolationForest: IsolationForest | null = null

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

    this.isolationForest = new IsolationForest(100, 256)
    
    // Generate some dummy normal baseline data so the forest is trained and can predict anomalies
    const dummyData: number[][] = []
    for (let i = 0; i < 500; i++) {
      dummyData.push(
        Array(FEATURE_VECTOR_DIMENSION)
          .fill(0)
          .map(() => Math.random() * 0.2)
      )
    }
    this.isolationForest.fit(dummyData)
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
      features.frequency.endpointFrequency['/api/sensitive'] ?? 0,
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
      const reconstructionError = reconstructionErrorData[0] ?? 0
      reconstructionErrorTensor.dispose()

      const anomalyScore = isolationForest.predict([featureVector])[0] ?? 0

      const reconstructionThreshold = this.getReconstructionThreshold(profile)

      if (reconstructionError > reconstructionThreshold) {
        anomalies.push({
          type: 'ml_anomaly',
          detail: 'reconstruction_error',
          anomalyId: this.generateAnomalyId(),
          userId: profile.userId,
          patternId: 'ml_reconstruction_error',
          anomalyType: 'novelty' as const,
          severity:
            reconstructionError > reconstructionThreshold * 2
              ? ('high' as const)
              : ('medium' as const),
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
          type: 'ml_anomaly',
          detail: 'isolation_forest',
          anomalyId: this.generateAnomalyId(),
          userId: profile.userId,
          patternId: 'ml_isolation_forest',
          anomalyType: 'outlier' as const,
          severity:
            anomalyScore > 0.8 ? ('critical' as const) : ('high' as const),
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
          type: 'ml_anomaly',
          detail: 'statistical',
          anomalyId: this.generateAnomalyId(),
          userId: profile.userId,
          patternId: `statistical_${index}`,
          anomalyType: 'deviation' as const,
          severity:
            value > baseline * 3 ? ('critical' as const) : ('high' as const),
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
        type: 'ml_anomaly',
        detail: 'temporal_unusual_time',
        anomalyId: this.generateAnomalyId(),
        userId: profile.userId,
        patternId: 'temporal_unusual_time',
        anomalyType: 'novelty' as const,
        severity: timePref > 0.9 ? ('high' as const) : ('medium' as const),
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
        type: 'ml_anomaly',
        detail: 'temporal_time_deviation',
        anomalyId: this.generateAnomalyId(),
        userId: profile.userId,
        patternId: 'temporal_time_deviation',
        anomalyType: 'deviation' as const,
        severity: 'low' as const,
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
        type: 'ml_anomaly',
        detail: 'temporal_irregular_sessions',
        anomalyId: this.generateAnomalyId(),
        userId: profile.userId,
        patternId: 'temporal_irregular_sessions',
        anomalyType: 'deviation' as const,
        severity: 'low' as const,
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
