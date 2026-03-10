import { calculateScore } from './compliance'
import * as MachineLearning from './ml'
import * as NotificationEffectiveness from './notifications'
import * as RiskScoring from './risk'
import { StatisticalAnalysis } from './statistics'
import * as SecurityTrends from './trends'
import { fheService } from '../fhe'
import { logger } from '../logger'
import { redis } from '../redis'
import { listRecentBreaches } from '../security/breach-notification'
import type { BreachDetails } from '../security/breach-notification'

// Adapter function to convert BreachDetails to SecurityBreach
function convertToSecurityBreach(
  breach: BreachDetails,
): RiskScoring.SecurityBreach {
  return {
    id: breach.id,
    severity: breach.severity as RiskScoring.BreachSeverity,
    timestamp: new Date(breach.timestamp),
    affectedUsers: breach.affectedUsers,
    dataTypes: breach.affectedData, // Map affectedData to dataTypes
    attackVector: breach.detectionMethod, // Use detectionMethod as attackVector
    detectionTime: new Date(breach.timestamp),
    responseTime: new Date(breach.timestamp + 3600000), // Add 1 hour default response time
    remediationStatus:
      breach.notificationStatus === 'completed'
        ? 'completed'
        : breach.notificationStatus === 'in_progress'
          ? 'in_progress'
          : 'pending',
    description: breach.description,
    metadata: {},
  }
}

// Adapter function to convert BreachDetails to Breach (for notifications)
function convertToBreach(
  breach: BreachDetails,
): NotificationEffectiveness.Breach {
  return {
    id: breach.id,
    timestamp: new Date(breach.timestamp),
    severity: {
      level: breach.severity as 'critical' | 'high' | 'medium' | 'low',
      score:
        breach.severity === 'critical'
          ? 1.0
          : breach.severity === 'high'
            ? 0.8
            : breach.severity === 'medium'
              ? 0.6
              : 0.4,
    },
    notificationStatus:
      breach.notificationStatus === 'in_progress'
        ? 'in-progress'
        : (breach.notificationStatus as 'pending' | 'completed' | 'failed'),
    notifications: {
      total: 1,
      delivered: 1,
      failed: 0,
      acknowledged: breach.notificationStatus === 'completed' ? 1 : 0,
      actioned: breach.notificationStatus === 'completed' ? 1 : 0,
      timeToNotify: 1,
      timeToAcknowledge: 2,
    },
    regulatoryFrameworks: ['GDPR'], // Default regulatory framework
  }
}

interface AnalyticsTimeframe {
  from: Date
  to: Date
}

interface BreachMetrics {
  totalBreaches: number
  bySeverity: Record<string, number>
  byType: Record<string, number>
  averageResponseTime: number
  notificationEffectiveness: number
  riskScore: number
  complianceScore: number
}

interface TrendPoint {
  timestamp: number
  breaches: number
  affectedUsers: number
  notificationRate: number
  responseTime: number
  riskScore: number
  anomalyScore: number
}

interface BreachPrediction {
  timestamp: number
  predictedBreaches: number
  confidence: number
  factors: string[]
}

interface RiskFactor {
  name: string
  weight: number
  score: number
  trend: 'increasing' | 'decreasing' | 'stable'
}

interface SecurityInsight {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  recommendation: string
  relatedMetrics: string[]
}

// Define a breach interface for better type safety
interface Breach {
  id: string
  timestamp: number
  severity: string
  type: string
  affectedUsers: string[]
  notificationStatus?: string
}

const ANALYTICS_KEY_PREFIX = 'analytics:breach:'
// 7 days
const TREND_INTERVAL = 24 * 60 * 60 * 1000 // 1 day

function getAnalyticsKey(metric: string, timestamp: number): string {
  return `${ANALYTICS_KEY_PREFIX}${metric}:${timestamp}`
}

export async function generateMetrics(
  timeframe: AnalyticsTimeframe,
): Promise<BreachMetrics> {
  try {
    // Get breaches within timeframe
    const breaches = await listRecentBreaches()
    const filteredBreaches = breaches.filter(
      (breach) =>
        breach.timestamp >= timeframe.from.getTime() &&
        breach.timestamp <= timeframe.to.getTime(),
    )

    // Calculate basic metrics
    const metrics = await calculateBasicMetrics(filteredBreaches)

    // Calculate advanced metrics
    const riskScore = await RiskScoring.calculateOverallRisk(
      filteredBreaches.map(convertToSecurityBreach),
    )
    const complianceScore = await calculateScore(filteredBreaches)
    const notificationEffectiveness = await NotificationEffectiveness.calculate(
      filteredBreaches.map(convertToBreach),
    )

    return {
      ...metrics,
      riskScore: riskScore.overallScore,
      complianceScore,
      notificationEffectiveness: notificationEffectiveness.overall,
    }
  } catch (error: unknown) {
    logger.error('Failed to generate breach metrics:', error)
    throw error
  }
}

async function calculateBasicMetrics(
  breaches: Breach[],
): Promise<
  Omit<
    BreachMetrics,
    'riskScore' | 'complianceScore' | 'notificationEffectiveness'
  >
> {
  const bySeverity: Record<string, number> = {}
  const byType: Record<string, number> = {}
  let totalResponseTime = 0

  for (const breach of breaches) {
    // Count by severity
    bySeverity[breach.severity] = (bySeverity[breach.severity] || 0) + 1

    // Count by type
    byType[breach.type] = (byType[breach.type] || 0) + 1

    // Calculate response time
    const responseTime = await calculateResponseTime(breach)
    totalResponseTime += responseTime
  }

  return {
    totalBreaches: breaches.length,
    bySeverity,
    byType,
    averageResponseTime: breaches.length
      ? totalResponseTime / breaches.length
      : 0,
  }
}

async function calculateResponseTime(breach: Breach): Promise<number> {
  const notifications = await redis.get(
    getAnalyticsKey('notifications', breach.timestamp),
  )

  if (!notifications) {
    return 0
  }

  const notificationData = JSON.parse(notifications) as unknown
  return notificationData.completedAt - breach.timestamp
}

export async function analyzeTrends(
  timeframe: AnalyticsTimeframe,
): Promise<TrendPoint[]> {
  try {
    const trends: TrendPoint[] = []
    let currentTime = timeframe.from.getTime()

    while (currentTime <= timeframe.to.getTime()) {
      const trendPoint = await calculateTrendPoint(new Date(currentTime))
      trends.push(trendPoint)
      currentTime += TREND_INTERVAL
    }

    // Analyze trends using machine learning
    const anomalies = await MachineLearning.detectAnomalies(trends)

    // Merge anomaly scores into trends
    return trends.map((point, index) => ({
      ...point,
      anomalyScore: anomalies[index] || 0,
    }))
  } catch (error: unknown) {
    logger.error('Failed to analyze breach trends:', error)
    throw error
  }
}

async function calculateTrendPoint(timestamp: Date): Promise<TrendPoint> {
  const breaches = await listRecentBreaches()
  const dayBreaches = breaches.filter(
    (breach) =>
      breach.timestamp >= timestamp.getTime() &&
      breach.timestamp < timestamp.getTime() + TREND_INTERVAL,
  )

  const riskScore = await RiskScoring.calculateDailyRisk(
    dayBreaches.map(convertToSecurityBreach),
  )

  return {
    timestamp: timestamp.getTime(),
    breaches: dayBreaches.length,
    affectedUsers: dayBreaches.reduce(
      (sum, breach) => sum + breach.affectedUsers.length,
      0,
    ),
    notificationRate: (
      await NotificationEffectiveness.calculateDaily(
        dayBreaches.map(convertToBreach),
      )
    ).overall,
    responseTime: await calculateAverageResponseTime(dayBreaches),
    riskScore: riskScore.overallScore,
    anomalyScore: 0, // Will be filled in later
  }
}

async function calculateAverageResponseTime(
  breaches: Breach[],
): Promise<number> {
  if (!breaches.length) {
    return 0
  }

  const responseTimes = await Promise.all(
    breaches.map((breach) => calculateResponseTime(breach)),
  )

  return responseTimes.reduce((sum, time) => sum + time, 0) / breaches.length
}

export async function predictBreaches(
  days: number = 7,
): Promise<BreachPrediction[]> {
  try {
    // Get historical data
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days

    const trends = await analyzeTrends({ from: startDate, to: endDate })

    // Use machine learning to predict future breaches
    const predictions = await MachineLearning.predictBreaches(trends, days)

    // Analyze factors contributing to predictions
    const factors = await analyzeRiskFactors()

    return predictions.map(
      (prediction: { value: number; confidence: number }, index: number) => ({
        timestamp: endDate.getTime() + index * 24 * 60 * 60 * 1000,
        predictedBreaches: prediction.value,
        confidence: prediction.confidence,
        factors: factors
          .filter((factor) => factor.weight * factor.score > 0.7)
          .map((factor) => factor.name),
      }),
    )
  } catch (error: unknown) {
    logger.error('Failed to predict breaches:', error)
    throw error
  }
}

export async function analyzeRiskFactors(): Promise<RiskFactor[]> {
  try {
    const factors = await RiskScoring.getFactors()
    const trends = await SecurityTrends.analyze(factors)

    return factors.map(
      (
        factor: { name: string; weight: number; score: number },
        index: number,
      ) => ({
        name: factor.name,
        weight: factor.weight,
        score: factor.score,
        trend: trends[index] || 'stable',
      }),
    )
  } catch (error: unknown) {
    logger.error('Failed to analyze risk factors:', error)
    throw error
  }
}

export async function generateInsights(): Promise<SecurityInsight[]> {
  try {
    const insights: SecurityInsight[] = []

    // Get recent metrics
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days
    const metrics = await generateMetrics({
      from: startDate,
      to: endDate,
    })

    // Analyze trends
    const trends = await analyzeTrends({ from: startDate, to: endDate })

    // Get risk factors
    const riskFactors = await analyzeRiskFactors()

    // Generate insights based on metrics
    if (metrics.notificationEffectiveness < 0.95) {
      insights.push({
        type: 'notification_effectiveness',
        severity: 'high',
        description: 'Notification effectiveness has dropped below 95%',
        recommendation:
          'Review notification delivery system and user contact information',
        relatedMetrics: ['notificationEffectiveness', 'averageResponseTime'],
      })
    }

    // Analyze severity distribution
    const criticalBreaches = metrics.bySeverity['critical'] || 0
    if (criticalBreaches > 0) {
      insights.push({
        type: 'critical_breaches',
        severity: 'critical',
        description: `${criticalBreaches} critical breaches detected in the last 7 days`,
        recommendation:
          'Review security measures and incident response procedures',
        relatedMetrics: ['bySeverity', 'riskScore'],
      })
    }

    // Analyze response time trends
    const responseTimeTrend = StatisticalAnalysis.calculateTrend(
      trends.map((t) => t.responseTime),
    )
    if (responseTimeTrend > 0.1) {
      insights.push({
        type: 'response_time',
        severity: 'medium',
        description: 'Response time is showing an increasing trend',
        recommendation: 'Review incident response procedures and team capacity',
        relatedMetrics: ['averageResponseTime'],
      })
    }

    // Analyze risk factors
    const highRiskFactors = riskFactors.filter(
      (factor) => factor.weight * factor.score > 0.8,
    )
    if (highRiskFactors.length > 0) {
      insights.push({
        type: 'risk_factors',
        severity: 'high',
        description: `${highRiskFactors.length} high-risk factors identified`,
        recommendation: `Address identified risk factors: ${highRiskFactors
          .map((f) => f.name)
          .join(', ')}`,
        relatedMetrics: ['riskScore'],
      })
    }

    // Check compliance score
    if (metrics.complianceScore < 0.98) {
      insights.push({
        type: 'compliance',
        severity: 'high',
        description: 'Compliance score is below threshold',
        recommendation: 'Review and address compliance gaps',
        relatedMetrics: ['complianceScore'],
      })
    }

    return insights
  } catch (error: unknown) {
    logger.error('Failed to generate insights:', error)
    throw error
  }
}

// Define interface for the analytics report
interface BreachAnalyticsReport {
  timeframe: {
    from: string
    to: string
  }
  metrics: BreachMetrics & {
    encryptedData: string
  }
  trends: TrendPoint[]
  predictions: BreachPrediction[]
  riskFactors: RiskFactor[]
  insights: SecurityInsight[]
  generatedAt: string
}

export async function generateReport(
  timeframe: AnalyticsTimeframe,
): Promise<BreachAnalyticsReport> {
  try {
    // Gather all analytics data
    const [metrics, trends, predictions, riskFactors, insights] =
      await Promise.all([
        generateMetrics(timeframe),
        analyzeTrends(timeframe),
        predictBreaches(),
        analyzeRiskFactors(),
        generateInsights(),
      ])

    // Encrypt sensitive data
    const encryptedData = await fheService.encrypt(
      JSON.stringify({
        metrics: {
          totalBreaches: metrics.totalBreaches,
          bySeverity: metrics.bySeverity,
          byType: metrics.byType,
        },
        affectedUsers: trends.reduce((sum, t) => sum + t.affectedUsers, 0),
      }),
    )

    return {
      timeframe: {
        from: timeframe.from.toISOString(),
        to: timeframe.to.toISOString(),
      },
      metrics: {
        ...metrics,
        encryptedData,
      },
      trends,
      predictions,
      riskFactors,
      insights,
      generatedAt: new Date().toISOString(),
    }
  } catch (error: unknown) {
    logger.error('Failed to generate analytics report:', error)
    throw error
  }
}
