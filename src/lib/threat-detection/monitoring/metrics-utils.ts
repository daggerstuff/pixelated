/**
 * Metrics Utilities Module
 * 
 * Provides utility functions for metrics calculation, anomaly detection,
 * and performance monitoring.
 */

import type { RedisClientType } from 'redis'

export interface MetricData {
  name: string
  value: number
  tags?: Record<string, string>
  timestamp: string
}

export interface MetricsSummary {
  average: number
  min: number
  max: number
  count: number
  stdDev: number
  percentiles: {
    p50: number
    p95: number
    p99: number
  }
}

export interface AnomalyResult {
  value: number
  isAnomaly: boolean
  confidence: number
  severity: 'low' | 'medium' | 'high'
  reason?: string
}

export interface PerformanceMetrics {
  system: {
    cpu: number
    memory: number
    disk: number
  }
  application: {
    responseTime: number
    throughput: number
    errorRate: number
  }
  database: {
    connections: number
    queryTime: number
    cacheHitRate: number
  }
}

/**
 * Calculate metrics summary statistics
 */
export async function calculateMetricsSummary(metrics: MetricData[]): Promise<MetricsSummary> {
  if (metrics.length === 0) {
    return {
      average: 0,
      min: 0,
      max: 0,
      count: 0,
      stdDev: 0,
      percentiles: { p50: 0, p95: 0, p99: 0 }
    }
  }

  const values = metrics.map(m => m.value).sort((a, b) => a - b)
  const count = values.length
  const sum = values.reduce((acc, val) => acc + val, 0)
  const average = sum / count
  const min = values[0]
  const max = values[count - 1]

  // Calculate standard deviation
  const variance = values.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / count
  const stdDev = Math.sqrt(variance)

  // Calculate percentiles
  const p50 = calculatePercentile(values, 0.5)
  const p95 = calculatePercentile(values, 0.95)
  const p99 = calculatePercentile(values, 0.99)

  return {
    average,
    min,
    max,
    count,
    stdDev,
    percentiles: { p50, p95, p99 }
  }
}

/**
 * Calculate percentile from sorted array
 */
function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0

  const index = Math.ceil(sortedValues.length * percentile) - 1
  return sortedValues[Math.max(0, index)]
}

/**
 * Detect anomalies in metrics using statistical methods
 */
export async function detectMetricAnomalies(
  metrics: MetricData[],
  aiService: {
    predictAnomaly: (data: any[]) => Promise<Array<{
      isAnomaly: boolean
      confidence: number
      severity: string
    }>>
  }
): Promise<AnomalyResult[]> {
  if (metrics.length === 0) {
    return []
  }

  try {
    // Use AI service for anomaly detection
    const anomalyResults = await aiService.predictAnomaly(metrics)

    // Ensure we have matching results, fallback if length mismatch
    if (!Array.isArray(anomalyResults) || anomalyResults.length !== metrics.length) {
      // Fallback logic if AI service returns incompatible data (e.g. single object)
      // For now, assuming expectation is per-item. If single object, we can't distinguish.
      return detectAnomaliesStatistical(metrics);
    }

    return metrics.map((metric, index) => ({
      value: metric.value,
      isAnomaly: anomalyResults[index].isAnomaly,
      confidence: anomalyResults[index].confidence,
      severity: anomalyResults[index].severity as 'low' | 'medium' | 'high',
      reason: anomalyResults[index].isAnomaly ? 'Statistical anomaly detected' : undefined
    })).filter(result => result.isAnomaly)
  } catch (error) {
    console.error('Error detecting anomalies:', error)

    // Fallback to simple statistical method
    return detectAnomaliesStatistical(metrics)
  }
}

/**
 * Simple statistical anomaly detection fallback
 */
function detectAnomaliesStatistical(metrics: MetricData[]): AnomalyResult[] {
  const values = metrics.map(m => m.value)
  const average = values.reduce((sum, val) => sum + val, 0) / values.length
  const variance = values.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)

  return metrics.map(metric => {
    const zScore = Math.abs((metric.value - average) / stdDev)
    const isAnomaly = zScore > 2.5 // More than 2.5 standard deviations

    return {
      value: metric.value,
      isAnomaly,
      confidence: Math.min(zScore / 4, 1), // Normalize confidence
      severity: zScore > 3.5 ? 'high' : zScore > 2.5 ? 'medium' : 'low',
      reason: isAnomaly ? `Z-score: ${zScore.toFixed(2)}` : undefined
    } as AnomalyResult
  }).filter(result => result.isAnomaly)
}

/**
 * Get performance metrics from Redis
 */
export async function getPerformanceMetrics(redis: RedisClientType): Promise<PerformanceMetrics> {
  try {
    const metricsData = await redis.hGetAll('performance:metrics') || {}

    return {
      system: {
        cpu: parseFloat(metricsData.cpu || '0'),
        memory: parseFloat(metricsData.memory || '0'),
        disk: parseFloat(metricsData.disk || '0')
      },
      application: {
        responseTime: parseFloat(metricsData.responseTime || '0'),
        throughput: parseFloat(metricsData.throughput || '0'),
        errorRate: parseFloat(metricsData.errorRate || '0')
      },
      database: {
        connections: parseInt(metricsData.connections || '0', 10),
        queryTime: parseFloat(metricsData.queryTime || '0'),
        cacheHitRate: parseFloat(metricsData.cacheHitRate || '0')
      }
    }
  } catch (error) {
    console.error('Error getting performance metrics:', error)

    // Return default metrics
    return {
      system: { cpu: 0, memory: 0, disk: 0 },
      application: { responseTime: 0, throughput: 0, errorRate: 0 },
      database: { connections: 0, queryTime: 0, cacheHitRate: 0 }
    }
  }
}

/**
 * Store performance metrics in Redis
 */
export async function storePerformanceMetrics(
  redis: RedisClientType,
  metrics: Partial<PerformanceMetrics>
): Promise<void> {
  try {
    const pipeline = redis.multi()

    if (metrics.system) {
      pipeline.hSet('performance:metrics', {
        cpu: metrics.system.cpu.toString(),
        memory: metrics.system.memory.toString(),
        disk: metrics.system.disk.toString()
      })
    }

    if (metrics.application) {
      pipeline.hSet('performance:metrics', {
        responseTime: metrics.application.responseTime.toString(),
        throughput: metrics.application.throughput.toString(),
        errorRate: metrics.application.errorRate.toString()
      })
    }

    if (metrics.database) {
      pipeline.hSet('performance:metrics', {
        connections: metrics.database.connections.toString(),
        queryTime: metrics.database.queryTime.toString(),
        cacheHitRate: metrics.database.cacheHitRate.toString()
      })
    }

    // Set expiration for metrics data (24 hours)
    pipeline.expire('performance:metrics', 86400)

    await pipeline.exec()
  } catch (error) {
    console.error('Error storing performance metrics:', error)
  }
}

/**
 * Calculate health score based on performance metrics
 */
export function calculateHealthScore(metrics: PerformanceMetrics): number {
  let score = 100

  // System health (30% weight)
  if (metrics.system.cpu > 80) score -= 15
  else if (metrics.system.cpu > 60) score -= 10

  if (metrics.system.memory > 85) score -= 15
  else if (metrics.system.memory > 70) score -= 10

  if (metrics.system.disk > 90) score -= 10
  else if (metrics.system.disk > 75) score -= 5

  // Application health (40% weight)
  if (metrics.application.responseTime > 1000) score -= 20 // > 1 second
  else if (metrics.application.responseTime > 500) score -= 10 // > 500ms

  if (metrics.application.errorRate > 0.05) score -= 20 // > 5% error rate
  else if (metrics.application.errorRate > 0.02) score -= 10 // > 2% error rate

  if (metrics.application.throughput < 100) score -= 10 // Low throughput

  // Database health (30% weight)
  if (metrics.database.connections > 80) score -= 15 // High connection count
  else if (metrics.database.connections > 50) score -= 10

  if (metrics.database.queryTime > 200) score -= 15 // Slow queries
  else if (metrics.database.queryTime > 100) score -= 10

  if (metrics.database.cacheHitRate < 0.7) score -= 10 // Poor cache performance
  else if (metrics.database.cacheHitRate < 0.85) score -= 5

  return Math.max(0, Math.min(100, score))
}

/**
 * Generate health status from score
 */
export function getHealthStatus(score: number): 'healthy' | 'degraded' | 'unhealthy' | 'critical' {
  if (score >= 90) return 'healthy'
  if (score >= 70) return 'degraded'
  if (score >= 50) return 'unhealthy'
  return 'critical'
}