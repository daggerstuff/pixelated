/**
 * Edge threat detection helpers — pure logic extracted from
 * EdgeThreatDetectionSystem.ts (no instance state).
 */

import * as tf from '@tensorflow/tfjs'
import type { AIModelConfig, RealTimeThreatData, ThreatIndicator } from '../global/types'
import type {
  ClassificationResult,
  CombinedResult,
  DetectionThresholds,
} from './edge-threat-detection.types'

export function buildAnomalyDetectionModel(
  model: tf.Sequential,
  _modelConfig: AIModelConfig,
): void {
  // Autoencoder architecture for anomaly detection
  model.add(
    tf.layers.dense({
      units: 64,
      activation: 'relu',
      inputShape: [10],
    }),
  )

  model.add(
    tf.layers.dense({
      units: 32,
      activation: 'relu',
    }),
  )

  model.add(
    tf.layers.dense({
      units: 16,
      activation: 'relu',
    }),
  )

  model.add(
    tf.layers.dense({
      units: 8,
      activation: 'relu',
    }),
  )

  // Decoder
  model.add(
    tf.layers.dense({
      units: 16,
      activation: 'relu',
    }),
  )

  model.add(
    tf.layers.dense({
      units: 32,
      activation: 'relu',
    }),
  )

  model.add(
    tf.layers.dense({
      units: 64,
      activation: 'relu',
    }),
  )

  model.add(
    tf.layers.dense({
      units: 10,
      activation: 'sigmoid',
    }),
  )
}

export function buildClassificationModel(
  model: tf.Sequential,
  _modelConfig: AIModelConfig,
): void {
  // Classification model for threat categorization
  model.add(
    tf.layers.dense({
      units: 128,
      activation: 'relu',
      inputShape: [10],
    }),
  )

  model.add(tf.layers.dropout({ rate: 0.3 }))

  model.add(
    tf.layers.dense({
      units: 64,
      activation: 'relu',
    }),
  )

  model.add(tf.layers.dropout({ rate: 0.2 }))

  model.add(
    tf.layers.dense({
      units: 32,
      activation: 'relu',
    }),
  )

  model.add(
    tf.layers.dense({
      units: 4, // 4 threat categories: low, medium, high, critical
      activation: 'softmax',
    }),
  )
}

export function buildClusteringModel(
  model: tf.Sequential,
  _modelConfig: AIModelConfig,
): void {
  // Clustering model for threat grouping
  model.add(
    tf.layers.dense({
      units: 64,
      activation: 'relu',
      inputShape: [10],
    }),
  )

  model.add(
    tf.layers.dense({
      units: 32,
      activation: 'relu',
    }),
  )

  model.add(
    tf.layers.dense({
      units: 16,
      activation: 'relu',
    }),
  )

  model.add(
    tf.layers.dense({
      units: 8,
      activation: 'relu',
    }),
  )
}

export function buildPredictionModel(
  model: tf.Sequential,
  _modelConfig: AIModelConfig,
): void {
  // Prediction model for threat forecasting
  model.add(
    tf.layers.dense({
      units: 100,
      activation: 'relu',
      inputShape: [10],
    }),
  )

  model.add(tf.layers.dropout({ rate: 0.2 }))

  model.add(
    tf.layers.dense({
      units: 50,
      activation: 'relu',
    }),
  )

  model.add(tf.layers.dropout({ rate: 0.2 }))

  model.add(
    tf.layers.dense({
      units: 25,
      activation: 'relu',
    }),
  )

  model.add(
    tf.layers.dense({
      units: 1,
      activation: 'sigmoid',
    }),
  )
}

export function getLossFunction(modelType: string): string {
  switch (modelType) {
    case 'anomaly':
      return 'meanSquaredError'
    case 'classification':
      return 'categoricalCrossentropy'
    case 'clustering':
      return 'meanSquaredError'
    case 'prediction':
      return 'binaryCrossentropy'
    default:
      return 'meanSquaredError'
  }
}

export function createFeatureVector(threatData: RealTimeThreatData): number[] {
  // Create numerical feature vector for ML models
  const features: number[] = []

  // Threat severity
  features.push(threatData.severity)

  // Confidence level
  features.push(threatData.confidence)

  // Number of indicators
  features.push(threatData.indicators.length / 10) // Normalize to 0-1

  // Time-based features
  const hour = threatData.timestamp.getHours()
  features.push(hour / 24) // Hour of day (0-1)
  features.push(hour >= 9 && hour <= 17 ? 1 : 0) // Business hours

  // Indicator type distribution
  const indicatorTypes = new Set(
    threatData.indicators.map((i) => i.indicatorType),
  )
  features.push(indicatorTypes.size / 5) // Normalize to 0-1

  // Geographic features (if available)
  if (threatData.context?.geographicLocation) {
    features.push(1) // Has location
  } else {
    features.push(0) // No location
  }

  // Pad or truncate to fixed size (10 features)
  while (features.length < 10) {
    features.push(0)
  }

  return features.slice(0, 10)
}

export function fallbackAnomalyDetection(features: number[]): number {
  // Simple statistical anomaly detection
  const mean = features.reduce((sum, val) => sum + val, 0) / features.length
  const variance =
    features.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    features.length
  const stdDev = Math.sqrt(variance)

  // Calculate z-score for the most anomalous feature
  const maxDeviation = Math.max(...features.map((f) => Math.abs(f - mean)))
  const zScore = maxDeviation / (stdDev || 1)

  // Normalize to 0-1 range
  return Math.min(zScore / 3, 1)
}

export function fallbackClassification(features: number[]): ClassificationResult {
  // Simple rule-based classification
  const avgFeature =
    features.reduce((sum, val) => sum + val, 0) / features.length

  if (avgFeature > 0.7) {
    return {
      threatType: 'critical',
      confidence: 0.8,
      probabilities: [0.1, 0.2, 0.3, 0.4],
    }
  } else if (avgFeature > 0.5) {
    return {
      threatType: 'high',
      confidence: 0.7,
      probabilities: [0.2, 0.3, 0.4, 0.1],
    }
  } else if (avgFeature > 0.3) {
    return {
      threatType: 'medium',
      confidence: 0.6,
      probabilities: [0.3, 0.4, 0.2, 0.1],
    }
  } else {
    return {
      threatType: 'low',
      confidence: 0.5,
      probabilities: [0.4, 0.3, 0.2, 0.1],
    }
  }
}

export function selectPrimaryModel(
  anomalyScore: number,
  classificationResult: ClassificationResult,
  predictionScore: number,
): string {
  const scores = {
    anomaly_detection: anomalyScore,
    threat_classification: classificationResult.confidence,
    threat_prediction: predictionScore,
  }

  let maxScore = 0
  let primaryModel = 'threat_classification' // Default

  for (const [model, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      primaryModel = model
    }
  }

  return primaryModel
}

export function extractIndicators(
  threatData: RealTimeThreatData,
  finalResult: CombinedResult,
): ThreatIndicator[] {
  // Extract and enhance indicators based on detection results
  const enhancedIndicators: ThreatIndicator[] = []

  for (const indicator of threatData.indicators) {
    enhancedIndicators.push({
      ...indicator,
      confidence: Math.min(indicator.confidence * finalResult.confidence, 1),
      metadata: {
        ...indicator.metadata,
        edgeDetectionScore: finalResult.scores.combined,
        primaryModel: finalResult.primaryModel,
      },
    })
  }

  return enhancedIndicators
}

export function validateThresholds(thresholds: DetectionThresholds): void {
  if (thresholds.anomaly < 0 || thresholds.anomaly > 1) {
    throw new Error('Anomaly threshold must be between 0 and 1')
  }

  if (thresholds.threat < 0 || thresholds.threat > 1) {
    throw new Error('Threat threshold must be between 0 and 1')
  }

  if (thresholds.confidence < 0 || thresholds.confidence > 1) {
    throw new Error('Confidence threshold must be between 0 and 1')
  }

  // Validate severity thresholds
  const severityThresholds = thresholds.severity
  if (
    severityThresholds.low < 0 ||
    severityThresholds.low > 1 ||
    severityThresholds.medium < 0 ||
    severityThresholds.medium > 1 ||
    severityThresholds.high < 0 ||
    severityThresholds.high > 1 ||
    severityThresholds.critical < 0 ||
    severityThresholds.critical > 1
  ) {
    throw new Error('Severity thresholds must be between 0 and 1')
  }
}
