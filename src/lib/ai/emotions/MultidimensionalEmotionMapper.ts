/**
 * Multidimensional Emotion Mapper
 * Maps emotions to multidimensional spaces (valence, arousal, dominance)
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type {
  EmotionAnalysis,
  EmotionVector,
  EmotionDimensions,
  DimensionalMap,
  EmotionMappingConfig,
  EmotionCluster,
  EmotionTransition,
} from './types'

const logger = createBuildSafeLogger('multidimensional-emotion-mapper')

export class MultidimensionalEmotionMapper {
  private config: EmotionMappingConfig

  constructor(config?: Partial<EmotionMappingConfig>) {
    this.config = {
      timeWindow: 30,
      samplingRate: 2,
      smoothingFactor: 0.3,
      dimensions: ['valence', 'arousal', 'dominance'],
      ...config,
    }
  }

  /**
   * Map emotions to dimensional space using Russell's Circumplex Model
   * and additional dominance dimension
   */
  mapEmotionsToDimensions(emotion: EmotionAnalysis): DimensionalMap {
    const { emotions, timestamp, confidence } = emotion

    // Calculate valence (positive/negative emotional tone)
    const valence = this.calculateValence(emotions)

    // Calculate arousal (activation level)
    const arousal = this.calculateArousal(emotions)

    // Calculate dominance (control/power level)
    const dominance = this.calculateDominance(emotions)

    const dimensions: EmotionDimensions = { valence, arousal, dominance }

    // Find primary emotion
    const primaryEmotion = this.findPrimaryEmotion(emotions) ?? 'joy'

    // Calculate overall intensity
    const intensity = this.calculateIntensity(emotions)

    logger.debug('Mapped emotion to dimensions', {
      timestamp,
      dimensions,
      primaryEmotion,
      intensity,
    })

    return {
      timestamp,
      dimensions,
      primaryEmotion,
      intensity,
      confidence,
    }
  }

  /**
   * Calculate valence dimension (-1 to 1)
   * Positive emotions contribute positively, negative emotions negatively
   */
  private calculateValence(emotions: EmotionVector): number {
    const positive = emotions.joy + emotions.trust + emotions.surprise * 0.5
    const negative =
      emotions.sadness + emotions.anger + emotions.fear + emotions.disgust

    return Math.tanh((positive - negative) / 2) // Normalize to [-1, 1]
  }

  /**
   * Calculate arousal dimension (0 to 1)
   * High-energy emotions contribute to higher arousal
   */
  private calculateArousal(emotions: EmotionVector): number {
    const highArousal =
      emotions.anger + emotions.fear + emotions.surprise + emotions.joy * 0.7
    const lowArousal =
      emotions.sadness + emotions.trust + emotions.disgust * 0.5

    const arousal = (highArousal - lowArousal * 0.3) / 2
    return Math.max(0, Math.min(1, arousal)) // Normalize to [0, 1]
  }

  /**
   * Calculate dominance dimension (-1 to 1)
   * Emotions associated with control vs helplessness
   */
  private calculateDominance(emotions: EmotionVector): number {
    const dominant = emotions.anger + emotions.trust + emotions.anticipation
    const submissive =
      emotions.fear + emotions.sadness + emotions.surprise * 0.5
    return Math.tanh((dominant - submissive) / 2)
  }

  /**
   * Find the primary (strongest) emotion
   */
  private findPrimaryEmotion(
    emotions: EmotionVector,
  ): keyof EmotionVector | null {
    let maxEmotion: keyof EmotionVector | null = null
    let maxValue = -Infinity

    // Handle cases where emotions object might be empty or values are all zero/negative
    if (Object.keys(emotions).length === 0) {
      // Attempt to find a default or return null if truly empty
      const firstKey = Object.keys(this.getDummyEmotionVector())[0] as
        | keyof EmotionVector
        | undefined
      return firstKey || null
    }

    // Initialize with the first emotion in the vector as a baseline
    // This avoids issues if all emotion values are <= 0
    const emotionKeys = Object.keys(emotions) as Array<keyof EmotionVector>
    if (emotionKeys.length > 0 && emotionKeys[0]) {
      maxEmotion = emotionKeys[0]
      maxValue = emotions[emotionKeys[0]] ?? -Infinity
    }

    for (const [emotionStr, value] of Object.entries(emotions)) {
      const emotion = emotionStr as keyof EmotionVector
      if (value > maxValue) {
        maxValue = value
        maxEmotion = emotion
      }
    }

    // If all values were less than or equal to initial maxValue (e.g. all zero or negative)
    // and maxEmotion is still the initial pick or null, ensure a valid key or null.
    // This ensures that if all emotions have score 0, one is still picked.
    if (maxEmotion === null && emotionKeys.length > 0 && emotionKeys[0]) {
      return emotionKeys[0]
    }

    return maxEmotion
  }

  /**
   * Calculate overall emotional intensity
   */
  private calculateIntensity(emotions: EmotionVector): number {
    const sum = Object.values(emotions).reduce((acc, val) => acc + val, 0)
    return Math.min(1, sum / 4) // Normalize
  }

  /**
   * Cluster emotions in dimensional space
   */
  clusterEmotions(
    maps: DimensionalMap[],
    numClusters: number = 3,
  ): EmotionCluster[] {
    // Simple k-means clustering implementation
    const clusters: EmotionCluster[] = []

    // Return empty array if no clusters requested or no data
    if (numClusters <= 0 || maps.length === 0) {
      return clusters
    }

    // Initialize centroids randomly
    for (let i = 0; i < numClusters; i++) {
      clusters.push({
        id: `cluster-${i}`,
        centroid: {
          valence: Math.random() * 2 - 1,
          arousal: Math.random(),
          dominance: Math.random() * 2 - 1,
        },
        members: [],
        radius: 0,
        significance: 0,
      })
    }

    // Assign points to clusters and update centroids
    const maxIterations = 10
    for (let iter = 0; iter < maxIterations; iter++) {
      // Clear previous assignments
      clusters.forEach((cluster) => {
        cluster.members = []
      })

      // Assign each point to nearest cluster
      maps.forEach((map) => {
        let minDistance = Infinity
        let nearestClusterIndex = -1

        clusters.forEach((cluster, index) => {
          const distance = this.calculateDistance(
            map.dimensions,
            cluster.centroid,
          )
          if (distance < minDistance) {
            minDistance = distance
            nearestClusterIndex = index
          }
        })

        // Only proceed if we found a nearest cluster
        if (nearestClusterIndex >= 0) {
          const nearestCluster = clusters[nearestClusterIndex]

          if (nearestCluster) {
            // Create EmotionAnalysis from DimensionalMap for cluster members
            const emotionAnalysis: EmotionAnalysis = {
              id: `emotion-${map.timestamp}`,
              sessionId: 'unknown',
              timestamp: map.timestamp,
              emotions: this.getDummyEmotionVector(), // Placeholder
              dimensions: map.dimensions,
              confidence: map.confidence,
            }

            nearestCluster.members.push(emotionAnalysis)
          }
        }
      })

      // Update centroids
      clusters.forEach((cluster) => {
        if (cluster.members.length > 0) {
          const avgValence =
            cluster.members.reduce((sum, m) => sum + m.dimensions.valence, 0) /
            cluster.members.length
          const avgArousal =
            cluster.members.reduce((sum, m) => sum + m.dimensions.arousal, 0) /
            cluster.members.length
          const avgDominance =
            cluster.members.reduce(
              (sum, m) => sum + m.dimensions.dominance,
              0,
            ) / cluster.members.length

          cluster.centroid = {
            valence: avgValence,
            arousal: avgArousal,
            dominance: avgDominance,
          }
        }
      })
    }

    // Calculate cluster statistics
    clusters.forEach((cluster) => {
      if (cluster.members.length > 0) {
        cluster.radius = Math.max(
          ...cluster.members.map((m) =>
            this.calculateDistance(m.dimensions, cluster.centroid),
          ),
        )
        cluster.significance = cluster.members.length / maps.length
      }
    })

    return clusters.filter((cluster) => cluster.members.length > 0)
  }

  /**
   * Detect emotion transitions between dimensional maps
   */
  detectTransitions(
    maps: DimensionalMap[],
    threshold: number = 0.3,
  ): EmotionTransition[] {
    const transitions: EmotionTransition[] = []

    if (maps.length < 2) {
      return transitions
    }

    for (let i = 1; i < maps.length; i++) {
      const prev = maps[i - 1]
      const curr = maps[i]

      // Ensure both elements exist
      if (!prev || !curr) {
        continue
      }

      const distance = this.calculateDistance(prev.dimensions, curr.dimensions)

      if (distance > threshold) {
        const duration =
          new Date(curr.timestamp).getTime() -
          new Date(prev.timestamp).getTime()

        transitions.push({
          from: prev.dimensions,
          to: curr.dimensions,
          duration,
          intensity: distance,
          timestamp: curr.timestamp,
        })
      }
    }

    return transitions
  }

  /**
   * Calculate Euclidean distance between two dimensional points
   */
  private calculateDistance(
    dim1: EmotionDimensions,
    dim2: EmotionDimensions,
  ): number {
    const valenceDiff = dim1.valence - dim2.valence
    const arousalDiff = dim1.arousal - dim2.arousal
    const dominanceDiff = dim1.dominance - dim2.dominance

    return Math.sqrt(valenceDiff ** 2 + arousalDiff ** 2 + dominanceDiff ** 2)
  }

  /**
   * Helper method to create dummy emotion vector (for clustering)
   */
  private getDummyEmotionVector(): EmotionVector {
    return {
      joy: 0,
      sadness: 0,
      anger: 0,
      fear: 0,
      surprise: 0,
      disgust: 0,
      trust: 0,
      anticipation: 0,
    }
  }

  /**
   * Apply smoothing to dimensional data
   */
  smoothDimensions(maps: DimensionalMap[]): DimensionalMap[] {
    if (maps.length < 2) {
      return maps
    }

    const smoothed = [...maps]
    const alpha = this.config.smoothingFactor

    for (let i = 1; i < smoothed.length; i++) {
      const current = smoothed[i]
      const previous = smoothed[i - 1]

      if (!current || !previous) {
        continue
      }

      smoothed[i] = {
        timestamp: current.timestamp,
        primaryEmotion: current.primaryEmotion,
        intensity: current.intensity,
        confidence: current.confidence,
        dimensions: {
          valence:
            alpha * previous.dimensions.valence +
            (1 - alpha) * current.dimensions.valence,
          arousal:
            alpha * previous.dimensions.arousal +
            (1 - alpha) * current.dimensions.arousal,
          dominance:
            alpha * previous.dimensions.dominance +
            (1 - alpha) * current.dimensions.dominance,
        },
      }
    }

    return smoothed
  }
}
