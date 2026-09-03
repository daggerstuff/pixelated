/**
 * ProductionThreatDetectionService — extracted from production-system.ts.
 */

import { mongoClient } from '../../../db/mongoClient'
import { createBuildSafeLogger } from '../../../logger'
import { redis } from '../../../redis'
import { asRedisOps } from '../../../redis-ops'

const logger = createBuildSafeLogger('threat-detection-system')

export class ProductionThreatDetectionService {
  private readonly enabled: boolean
  private readonly riskThresholds: {
    low: number
    medium: number
    high: number
    critical: number
  }

  constructor(config: Record<string, unknown> = {}) {
    this.enabled = (config['enabled'] as boolean) ?? true
    this.riskThresholds = (config[
      'riskThresholds'
    ] as typeof this.riskThresholds) ?? {
      low: 0.2,
      medium: 0.5,
      high: 0.7,
      critical: 0.9,
    }
  }

  async processRequest(
    request: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!this.enabled) {
      return { success: true, threat: null, action: 'allow', riskScore: 0 }
    }

    try {
      // Analyze request for threats
      const riskScore = await this.calculateRiskScore(request)
      const threatLevel = this.determineThreatLevel(riskScore)
      const action = this.determineAction(threatLevel)

      // Log threat detection
      await this.logThreatDetection(request, riskScore, threatLevel, action)

      return {
        success: true,
        threat: {
          riskScore,
          threatLevel,
          indicators: await this.getIndicators(request),
          timestamp: new Date(),
        },
        action,
        riskScore,
      }
    } catch (error: unknown) {
      logger.error('Threat detection failed:', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        riskScore: 0,
      }
    }
  }

  private async calculateRiskScore(
    request: Record<string, unknown>,
  ): Promise<number> {
    let score = 0

    // IP reputation check
    // IP reputation check
    if (request['ip']) {
      score += await this.checkIPReputation(request['ip'] as string)
    }

    // Rate limiting analysis
    if (request['ip']) {
      score += await this.analyzeRequestFrequency(request['ip'] as string)
    }

    // Payload analysis
    if (request['body'] || request['query']) {
      score += await this.analyzePayload(
        (request['body'] ?? request['query']) as Record<string, unknown>,
      )
    }

    // User agent analysis
    if (request['userAgent']) {
      score += await this.analyzeUserAgent(request['userAgent'] as string)
    }

    return Math.min(score, 1.0) // Cap at 1.0
  }

  private async checkIPReputation(ip: string): Promise<number> {
    try {
      // Check against known bad IPs in Redis
      const reputation = redis
        ? await asRedisOps(redis).get(`ip_reputation:${ip}`)
        : null
      if (reputation) {
        return parseFloat(reputation)
      }

      // Check against MongoDB threat intelligence
      const db = mongoClient.db
      const badIP = await db.collection('malicious_ips').findOne({ ip })

      if (badIP) {
        if (redis) {
          await asRedisOps(redis).setex(
            `ip_reputation:${ip}`,
            3600,
            (badIP['riskScore'] as number)?.toString() ?? '',
          )
        }
        return (badIP['riskScore'] as number) ?? 0
      }

      return 0
    } catch (error: unknown) {
      logger.warn('IP reputation check failed:', { error })
      return 0
    }
  }

  private async analyzeRequestFrequency(ip: string): Promise<number> {
    try {
      const key = `request_freq:${ip}`
      let count = 0
      if (redis) {
        const result = await asRedisOps(redis).hincrby(key, 'count', 1)
        count = typeof result === 'number' ? result : 0
        void asRedisOps(redis).expire(key, 60)
      }

      // Risk increases with frequency
      if (count > 100) return 0.8
      if (count > 50) return 0.5
      if (count > 20) return 0.3
      return 0
    } catch (error: unknown) {
      logger.warn('Request frequency analysis failed:', { error })
      return 0
    }
  }

  private async analyzePayload(
    payload: Record<string, unknown>,
  ): Promise<number> {
    if (!payload) return 0

    const payloadStr = JSON.stringify(payload).toLowerCase()
    let score = 0

    // SQL injection patterns
    const sqlPatterns = [
      'union select',
      'drop table',
      'insert into',
      '-- ',
      '/*',
    ]
    if (sqlPatterns.some((pattern) => payloadStr.includes(pattern))) {
      score += 0.7
    }

    // XSS patterns
    const xssPatterns = ['<script', 'javascript:', 'onerror=', 'onload=']
    if (xssPatterns.some((pattern) => payloadStr.includes(pattern))) {
      score += 0.6
    }

    // Command injection patterns
    const cmdPatterns = ['&&', '||', ';', '|', '`']
    if (cmdPatterns.some((pattern) => payloadStr.includes(pattern))) {
      score += 0.5
    }

    return Math.min(score, 1.0)
  }

  private async analyzeUserAgent(userAgent: string): Promise<number> {
    const ua = userAgent.toLowerCase()

    // Bot patterns
    const botPatterns = ['bot', 'crawler', 'spider', 'scraper']
    if (botPatterns.some((pattern) => ua.includes(pattern))) {
      return 0.3
    }

    // Suspicious patterns
    const suspiciousPatterns = ['curl', 'wget', 'python', 'scanner']
    if (suspiciousPatterns.some((pattern) => ua.includes(pattern))) {
      return 0.5
    }

    return 0
  }

  private determineThreatLevel(riskScore: number): string {
    if (riskScore >= this.riskThresholds.critical) return 'critical'
    if (riskScore >= this.riskThresholds.high) return 'high'
    if (riskScore >= this.riskThresholds.medium) return 'medium'
    if (riskScore >= this.riskThresholds.low) return 'low'
    return 'none'
  }

  private determineAction(threatLevel: string): string {
    switch (threatLevel) {
      case 'critical':
        return 'block'
      case 'high':
        return 'challenge'
      case 'medium':
        return 'monitor'
      case 'low':
        return 'log'
      default:
        return 'allow'
    }
  }

  private async getIndicators(
    request: Record<string, unknown>,
  ): Promise<string[]> {
    const indicators: string[] = []

    if (request['ip'] && redis) {
      const reputation = await asRedisOps(redis).get(
        `ip_reputation:${request['ip']}`,
      )
      if (reputation && parseFloat(reputation) > 0.5) {
        indicators.push('malicious_ip')
      }
    }

    return indicators
  }

  private async logThreatDetection(
    request: Record<string, unknown>,
    riskScore: number,
    threatLevel: string,
    action: string,
  ) {
    try {
      const db = mongoClient.db
      await db.collection('threat_detections').insertOne({
        timestamp: new Date(),
        ip: request['ip'],
        userAgent: request['userAgent'],
        endpoint: request['path'],
        method: request['method'],
        riskScore,
        threatLevel,
        action,
        request: {
          headers: request['headers'],
          query: request['query'],
          body: request['body'],
        },
      })
    } catch (error: unknown) {
      logger.error('Failed to log threat detection:', { error })
    }
  }

  async getHealthStatus(): Promise<Record<string, unknown>> {
    return {
      healthy: this.enabled,
      service: 'threat-detection',
      timestamp: new Date(),
    }
  }

  async getStatistics(): Promise<Record<string, unknown>> {
    try {
      const db = mongoClient.db
      const stats = await db
        .collection('threat_detections')
        .aggregate([
          {
            $group: {
              _id: null,
              totalThreats: { $sum: 1 },
              blockedRequests: {
                $sum: { $cond: [{ $eq: ['$action', 'block'] }, 1, 0] },
              },
              averageRiskScore: { $avg: '$riskScore' },
            },
          },
        ])
        .toArray()

      return (
        stats[0] ?? {
          totalThreats: 0,
          blockedRequests: 0,
          averageRiskScore: 0,
          threatDistribution: {},
        }
      )
    } catch (error: unknown) {
      logger.error('Failed to get statistics:', { error })
      return {
        totalThreats: 0,
        blockedRequests: 0,
        averageRiskScore: 0,
        threatDistribution: {},
      }
    }
  }
}

// Production-ready monitoring service
