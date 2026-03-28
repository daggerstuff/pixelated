/**
 * Temporal Analysis Service
 * Handles time-based pattern analysis and temporal anomaly detection
 */

import type { SecurityEvent, TemporalFeatures } from './types'
import { calculateTimeIntervals, generateAnomalyId } from './analyzer-utils'

export class TemporalAnalysisService {
  /**
   * Extract temporal features from security events
   */
  async extractTemporalFeatures(events: SecurityEvent[]): Promise<TemporalFeatures> {
    const timestamps = events.map((e) => e.timestamp.getTime())
    const intervals = this.calculateTimeIntervals(timestamps)

    return {
      avgSessionDuration: this.calculateAverageSessionDuration(events),
      timeOfDayPreference: this.calculateTimeOfDayPreference(events),
      dayOfWeekPattern: this.calculateDayOfWeekPattern(events),
      activityFrequency: this.calculateActivityFrequency(events),
      sessionRegularity: this.calculateSessionRegularity(intervals),
      responseTimePattern: this.calculateResponseTimePattern(events),
    }
  }

  /**
   * Detect temporal anomalies by comparing current events against baseline
   */
  async detectTemporalAnomalies(
    baselineMetrics: { timeOfDayThreshold: number },
    events: SecurityEvent[],
  ): Promise<
    Array<{
      anomalyId: string
      userId: string
      patternId: string
      anomalyType: string
      severity: string
      deviationScore: number
      confidence: number
      context: Record<string, unknown>
      timestamp: Date
    }>
  > {
    const anomalies: Array<{
      anomalyId: string
      userId: string
      patternId: string
      anomalyType: string
      severity: string
      deviationScore: number
      confidence: number
      context: Record<string, unknown>
      timestamp: Date
    }> = []

    const temporalFeatures = await this.extractTemporalFeatures(events)

    if (
      temporalFeatures.timeOfDayPreference >
      baselineMetrics.timeOfDayThreshold
    ) {
      anomalies.push({
        anomalyId: this.generateAnomalyId(),
        userId: events[0]?.userId || 'unknown',
        patternId: 'temporal_timing',
        anomalyType: 'deviation',
        severity: 'medium',
        deviationScore: temporalFeatures.timeOfDayPreference,
        confidence: 0.8,
        context: {
          feature: 'timeOfDayPreference',
          value: temporalFeatures.timeOfDayPreference,
        },
        timestamp: new Date(),
      })
    }

    return anomalies
  }

  private calculateTimeIntervals(timestamps: number[]): number[] {
    return calculateTimeIntervals(timestamps)
  }

  private calculateAverageSessionDuration(events: SecurityEvent[]): number {
    if (events.length === 0) return 0
    const timestamps = events.map((e) => e.timestamp.getTime())
    return Math.max(...timestamps) - Math.min(...timestamps)
  }

  private calculateTimeOfDayPreference(events: SecurityEvent[]): number {
    if (events.length === 0) return 0
    const hours = events.map((e) => e.timestamp.getHours())
    const avg = hours.reduce((a, b) => a + b, 0) / hours.length
    return avg / 24
  }

  private calculateDayOfWeekPattern(_events: SecurityEvent[]): number[] {
    return [0, 0, 0, 0, 0, 0, 0]
  }

  private calculateActivityFrequency(events: SecurityEvent[]): number {
    return events.length
  }

  private calculateSessionRegularity(intervals: number[]): number {
    if (intervals.length === 0) return 1
    return 0.8
  }

  private calculateResponseTimePattern(_events: SecurityEvent[]): number[] {
    return []
  }

  private generateAnomalyId(): string {
    return generateAnomalyId('temporal')
  }
}
