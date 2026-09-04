/**
 * Threat Validation System
 * Validates threat intelligence for quality assurance and accuracy
 */

import { EventEmitter } from 'events'

import Redis from 'ioredis'
import { MongoClient, Db } from 'mongodb'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import {
  ValidationConfig,
  ValidationRule,
  ValidationResult,
  ThreatValidation,
  GlobalThreatIntelligence,
  ThreatIndicator,
} from '../global/types'
import {
  applyValidationRule,
  calculateOverallValidationScore,
  generateValidationId,
  validateAttribution,
  validateIndicators,
  validateMetadata,
  validateThreatStructure,
  validateValidationRule,
} from './validationHelpers'

const logger = createBuildSafeLogger('threat-validation-system')

export interface ThreatValidationSystem {
  initialize(): Promise<void>
  validateThreat(threat: GlobalThreatIntelligence): Promise<ThreatValidation>
  validateIndicators(indicators: ThreatIndicator[]): Promise<ValidationResult>
  validateAttribution(
    attribution: Record<string, unknown>,
  ): Promise<ValidationResult>
  validateMetadata(metadata: Record<string, unknown>): Promise<ValidationResult>
  getValidationHistory(
    threatId: string,
    limit?: number,
  ): Promise<ThreatValidation[]>
  updateValidationRule(rule: ValidationRule): Promise<boolean>
  getValidationMetrics(): Promise<ValidationMetrics>
  getHealthStatus(): Promise<HealthStatus>
  shutdown(): Promise<void>
}

export interface ValidationMetrics {
  totalValidations: number
  validThreats: number
  invalidThreats: number
  validationBySeverity: Record<string, number>
  validationByType: Record<string, number>
  averageValidationTime: number
  falsePositives: number
  falseNegatives: number
}

export interface HealthStatus {
  healthy: boolean
  message: string
  responseTime?: number
  activeValidations?: number
  successRate?: number
}

export class ThreatValidationSystemCore
  extends EventEmitter
  implements ThreatValidationSystem
{
  private redis!: Redis
  private mongoClient!: MongoClient
  private db!: Db
  private readonly validationRules: Map<string, ValidationRule> = new Map()
  private readonly activeValidations: Map<string, ThreatValidation> = new Map()
  private readonly threatIntelligenceCache: Map<
    string,
    GlobalThreatIntelligence
  > = new Map()

  constructor(private readonly config: ValidationConfig) {
    super()
    this.initializeValidationRules()
  }

  private initializeValidationRules(): void {
    for (const rule of this.config.validationRules) {
      this.validationRules.set(rule.ruleId, rule)
    }
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Threat Validation System')

      // Initialize Redis connection
      await this.initializeRedis()

      // Initialize MongoDB connection
      await this.initializeMongoDB()

      // Load validation rules from database
      await this.loadValidationRules()

      // Start validation monitoring
      await this.startValidationMonitoring()

      // Start metrics collection
      await this.startMetricsCollection()

      this.emit('validation_system_initialized')
      logger.info('Threat Validation System initialized successfully')
    } catch (error: unknown) {
      logger.error('Failed to initialize Threat Validation System:', {
        error: error instanceof Error ? error.message : String(error),
      })
      this.emit('initialization_error', { error })
      throw error
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redis = new Redis(
        process.env['REDIS_URL'] ?? 'redis://localhost:6379',
      )
      await this.redis.ping()
      logger.info('Redis connection established for threat validation')
    } catch (error: unknown) {
      logger.error('Failed to connect to Redis:', { error })
      throw new Error('Redis connection failed', { cause: error })
    }
  }

  private async initializeMongoDB(): Promise<void> {
    try {
      this.mongoClient = new MongoClient(
        process.env['MONGODB_URI'] ??
          'mongodb://localhost:27017/threat_validation',
      )
      await this.mongoClient.connect()
      this.db = this.mongoClient.db('threat_validation')
      logger.info('MongoDB connection established for threat validation')
    } catch (error: unknown) {
      logger.error('Failed to connect to MongoDB:', { error })
      throw new Error('MongoDB connection failed', { cause: error })
    }
  }

  private async loadValidationRules(): Promise<void> {
    try {
      const rulesCollection =
        this.db.collection<ValidationRule>('validation_rules')
      const rules = await rulesCollection.find({ enabled: true }).toArray()

      for (const rule of rules) {
        this.validationRules.set(rule.ruleId, rule)
      }

      logger.info(`Loaded ${rules.length} validation rules from database`)
    } catch (error: unknown) {
      logger.error('Failed to load validation rules:', { error })
    }
  }

  private async startValidationMonitoring(): Promise<void> {
    // Monitor active validations every 30 seconds
    setInterval(async () => {
      try {
        await this.monitorActiveValidations()
      } catch (error: unknown) {
        logger.error('Validation monitoring error:', { error })
      }
    }, 30000)
  }

  private async startMetricsCollection(): Promise<void> {
    // Collect metrics every 5 minutes
    setInterval(async () => {
      try {
        await this.collectMetrics()
      } catch (error: unknown) {
        logger.error('Metrics collection error:', { error })
      }
    }, 300000)
  }

  async validateThreat(
    threat: GlobalThreatIntelligence,
  ): Promise<ThreatValidation> {
    try {
      logger.info('Validating threat', {
        threatId: threat.threatId,
        severity: threat.severity,
        confidence: threat.confidence,
      })

      // Step 1: Create validation record
      const validation = await this.createValidationRecord(threat)

      // Step 2: Validate basic threat structure
      const structureValidation = await validateThreatStructure(threat)
      validation.results.push(structureValidation)

      // Step 3: Validate indicators
      const indicatorValidation = await validateIndicators(
        threat.indicators,
      )
      validation.results.push(indicatorValidation)

      // Step 4: Validate attribution
      if (threat.attribution) {
        const attributionValidation = await validateAttribution(
          threat.attribution as unknown as Record<string, unknown>,
        )
        validation.results.push(attributionValidation)
      }

      // Step 5: Validate metadata
      if (threat.metadata) {
        const metadataValidation = await validateMetadata(threat.metadata)
        validation.results.push(metadataValidation)
      }

      // Step 6: Apply custom validation rules
      const customValidations = await this.applyCustomValidationRules(threat)
      validation.results.push(...customValidations)

      // Step 7: Cross-reference with known threats
      const crossReferenceValidation =
        await this.crossReferenceWithKnownThreats(threat)
      validation.results.push(crossReferenceValidation)

      // Step 8: Calculate overall validation score
      const overallScore = calculateOverallValidationScore(
        validation.results,
      )
      validation.overallScore = overallScore
      validation.isValid = overallScore >= this.config.validationThreshold!

      // Step 9: Determine final status
      validation.status = validation.isValid ? 'valid' : 'invalid'
      validation.completedAt = new Date()

      // Step 10: Store validation result
      await this.storeValidationResult(validation)

      // Step 11: Cache validated threat
      if (validation.isValid) {
        await this.cacheValidatedThreat(threat)
      }

      // Step 12: Send notifications for critical issues
      if (!validation.isValid && threat.severity === 'critical') {
        await this.sendValidationAlert(validation)
      }

      this.emit('threat_validated', {
        threatId: threat.threatId,
        validationId: validation.validationId,
        isValid: validation.isValid,
        score: validation.overallScore,
      })

      return validation
    } catch (error: unknown) {
      logger.error('Failed to validate threat:', {
        error,
        threatId: threat.threatId,
      })
      this.emit('validation_error', { error, threatId: threat.threatId })
      throw error
    }
  }

  private async createValidationRecord(
    threat: GlobalThreatIntelligence,
  ): Promise<ThreatValidation> {
    const validationId = generateValidationId()

    return {
      validationId,
      threatId: threat.threatId,
      threatType: threat.threatType,
      severity: threat.severity,
      confidence: threat.confidence,
      status: 'pending',
      overallScore: 0,
      isValid: false,
      results: [],
      createdAt: new Date(),
      completedAt: undefined,
      metadata: {
        validationVersion: '1.0',
        rulesApplied: Array.from(this.validationRules.keys()),
      },
    }
  }













  private async applyCustomValidationRules(
    threat: GlobalThreatIntelligence,
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = []

    for (const rule of this.validationRules.values()) {
      try {
        const result = await applyValidationRule(rule, threat)
        results.push(result)
      } catch (error: unknown) {
        logger.error('Custom validation rule failed:', {
          error,
          ruleId: rule.ruleId,
        })
        results.push({
          ruleId: rule.ruleId,
          ruleName: rule.name,
          passed: false,
          score: 0,
          issues: [
            'Rule execution error: ' +
              (error instanceof Error ? error.message : 'Unknown error'),
          ],
          details: {},
        })
      }
    }

    return results
  }









  private async crossReferenceWithKnownThreats(
    threat: GlobalThreatIntelligence,
  ): Promise<ValidationResult> {
    try {
      const issues: string[] = []
      let score = 100

      // Check against known false positives
      const isKnownFalsePositive = await this.checkKnownFalsePositives(threat)
      if (isKnownFalsePositive) {
        issues.push('Threat matches known false positive patterns')
        score -= 50
      }

      // Check against whitelisted indicators
      const hasWhitelistedIndicators = await this.checkWhitelistedIndicators(
        threat.indicators,
      )
      if (hasWhitelistedIndicators) {
        issues.push('Threat contains whitelisted indicators')
        score -= 30
      }

      // Check for similarity with existing threats
      const similarityScore = await this.calculateThreatSimilarity(threat)
      if (similarityScore > 0.9) {
        issues.push(
          'Threat is very similar to existing threats (possible duplicate)',
        )
        score -= 20
      }

      // Check reputation of indicators
      const reputationScore = await this.checkIndicatorReputation(
        threat.indicators,
      )
      if (reputationScore < 0.3) {
        issues.push('Indicators have poor reputation scores')
        score -= 25
      }

      return {
        ruleId: 'cross_reference_validation',
        ruleName: 'Cross-Reference Validation',
        passed: issues.length === 0,
        score: Math.max(0, score),
        issues,
        details: {
          isKnownFalsePositive,
          hasWhitelistedIndicators,
          similarityScore,
          reputationScore,
        },
      }
    } catch (error: unknown) {
      logger.error('Cross-reference validation failed:', { error })
      return {
        ruleId: 'cross_reference_validation',
        ruleName: 'Cross-Reference Validation',
        passed: false,
        score: 0,
        issues: [
          'Cross-reference validation error: ' +
            (error instanceof Error ? error.message : 'Unknown error'),
        ],
        details: {},
      }
    }
  }

  private async checkKnownFalsePositives(
    threat: GlobalThreatIntelligence,
  ): Promise<boolean> {
    try {
      // Check against known false positive patterns
      const falsePositivesCollection = this.db.collection(
        'known_false_positives',
      )

      // Check by indicator values
      for (const indicator of threat.indicators) {
        const match = await falsePositivesCollection.findOne({
          type: 'indicator',
          value: indicator.value,
          isFalsePositive: true,
        })

        if (match) return true
      }

      // Check by threat patterns
      const patternMatch = await falsePositivesCollection.findOne({
        type: 'pattern',
        threatType: threat.threatType,
        severity: threat.severity,
        isFalsePositive: true,
      })

      return !!patternMatch
    } catch (error: unknown) {
      logger.error('Known false positive check failed:', { error })
      return false
    }
  }

  private async checkWhitelistedIndicators(
    indicators: ThreatIndicator[],
  ): Promise<boolean> {
    try {
      const whitelistCollection = this.db.collection('indicator_whitelist')

      for (const indicator of indicators) {
        const match = await whitelistCollection.findOne({
          indicatorType: indicator.indicatorType,
          value: indicator.value,
        })

        if (match) return true
      }

      return false
    } catch (error: unknown) {
      logger.error('Whitelisted indicator check failed:', { error })
      return false
    }
  }

  private async calculateThreatSimilarity(
    threat: GlobalThreatIntelligence,
  ): Promise<number> {
    try {
      // Simple similarity calculation based on indicators and type
      const threatsCollection = this.db.collection('threats')

      // Find threats with similar indicators
      const similarThreats = await threatsCollection
        .find({
          'threatId': { $ne: threat.threatId },
          'threatType': threat.threatType,
          'indicators.value': { $in: threat.indicators.map((i) => i.value) },
        })
        .limit(10)
        .toArray()

      if (similarThreats.length === 0) {
        return 0
      }

      // Calculate average similarity based on indicator overlap
      let totalSimilarity = 0
      for (const similarThreat of similarThreats) {
        const commonIndicators = similarThreat['indicators'].filter(
          (i: ThreatIndicator) =>
            threat.indicators.some((ti) => ti.value === i.value),
        )

        const similarity =
          commonIndicators.length /
          Math.max(similarThreat['indicators'].length, threat.indicators.length)
        totalSimilarity += similarity
      }

      return totalSimilarity / similarThreats.length
    } catch (error: unknown) {
      logger.error('Threat similarity calculation failed:', { error })
      return 0
    }
  }

  private async checkIndicatorReputation(
    indicators: ThreatIndicator[],
  ): Promise<number> {
    try {
      const reputationCollection = this.db.collection('indicator_reputation')
      let totalReputation = 0
      let reputationCount = 0

      for (const indicator of indicators) {
        const reputation = await reputationCollection.findOne({
          indicatorType: indicator.indicatorType,
          value: indicator.value,
        })

        if (reputation) {
          totalReputation += reputation['score']
          reputationCount++
        }
      }

      return reputationCount > 0 ? totalReputation / reputationCount : 0.5 // Default neutral score
    } catch (error: unknown) {
      logger.error('Indicator reputation check failed:', { error })
      return 0.5 // Default neutral score
    }
  }



  private async storeValidationResult(
    validation: ThreatValidation,
  ): Promise<void> {
    try {
      const validationsCollection = this.db.collection('threat_validations')
      await validationsCollection.insertOne(validation)

      this.activeValidations.set(validation.validationId, validation)

      // Cache validation result for quick lookup
      await this.redis.setex(
        `validation:${validation.threatId}`,
        3600, // 1 hour expiration
        JSON.stringify(validation),
      )
    } catch (error: unknown) {
      logger.error('Failed to store validation result:', { error })
      throw error
    }
  }

  private async cacheValidatedThreat(
    threat: GlobalThreatIntelligence,
  ): Promise<void> {
    try {
      this.threatIntelligenceCache.set(threat.threatId, threat)

      // Store in Redis with expiration
      await this.redis.setex(
        `validated_threat:${threat.threatId}`,
        7200, // 2 hours expiration
        JSON.stringify(threat),
      )
    } catch (error: unknown) {
      logger.error('Failed to cache validated threat:', { error })
    }
  }

  private async sendValidationAlert(
    validation: ThreatValidation,
  ): Promise<void> {
    try {
      const alert = {
        type: 'validation_failure',
        threatId: validation.threatId,
        validationId: validation.validationId,
        severity: validation.severity,
        score: validation.overallScore,
        issues: validation.results
          .filter((r) => !r.passed)
          .map((r) => r.issues)
          .flat(),
        timestamp: new Date(),
      }

      // Publish to Redis for real-time alerts
      await this.redis.publish('validation_alerts', JSON.stringify(alert))

      logger.warn('Validation alert sent for critical threat', {
        threatId: validation.threatId,
        score: validation.overallScore,
      })
    } catch (error: unknown) {
      logger.error('Failed to send validation alert:', { error })
    }
  }

  async getValidationHistory(
    threatId: string,
    limit: number = 50,
  ): Promise<ThreatValidation[]> {
    try {
      const validationsCollection = this.db.collection('threat_validations')
      const validations = await validationsCollection
        .find<ThreatValidation>({ threatId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray()

      return validations
    } catch (error: unknown) {
      logger.error('Failed to get validation history:', { error, threatId })
      throw error
    }
  }

  async updateValidationRule(rule: ValidationRule): Promise<boolean> {
    try {
      logger.info('Updating validation rule', { ruleId: rule.ruleId })

      // Validate rule
      validateValidationRule(rule)

      // Update in memory
      this.validationRules.set(rule.ruleId, rule)

      // Update in database
      const rulesCollection = this.db.collection('validation_rules')
      await rulesCollection.replaceOne({ ruleId: rule.ruleId }, rule, {
        upsert: true,
      })

      this.emit('validation_rule_updated', { ruleId: rule.ruleId })

      return true
    } catch (error: unknown) {
      logger.error('Failed to update validation rule:', { error })
      return false
    }
  }


  async getValidationMetrics(): Promise<ValidationMetrics> {
    try {
      const validationsCollection = this.db.collection('threat_validations')

      const [
        totalValidations,
        validThreats,
        averageValidationTime,
        falsePositives,
        falseNegatives,
        validationsBySeverity,
        validationsByType,
      ] = await Promise.all([
        validationsCollection.countDocuments(),
        validationsCollection.countDocuments({ isValid: true }),
        this.calculateAverageValidationTime(),
        this.calculateFalsePositives(),
        this.calculateFalseNegatives(),
        this.getValidationsBySeverity(),
        this.getValidationsByType(),
      ])

      return {
        totalValidations,
        validThreats,
        invalidThreats: totalValidations - validThreats,
        averageValidationTime,
        validationBySeverity: validationsBySeverity,
        validationByType: validationsByType,
        falsePositives,
        falseNegatives,
      }
    } catch (error: unknown) {
      logger.error('Failed to get validation metrics:', { error })
      return {
        totalValidations: 0,
        validThreats: 0,
        invalidThreats: 0,
        averageValidationTime: 0,
        validationBySeverity: {},
        validationByType: {},
        falsePositives: 0,
        falseNegatives: 0,
      }
    }
  }

  private async calculateAverageValidationTime(): Promise<number> {
    try {
      const validationsCollection = this.db.collection('threat_validations')
      const completedValidations = await validationsCollection
        .find({
          createdAt: { $exists: true },
          completedAt: { $exists: true },
        })
        .project({ createdAt: 1, completedAt: 1 })
        .limit(100)
        .toArray()

      if (completedValidations.length === 0) {
        return 0
      }

      let totalTime = 0
      for (const validation of completedValidations) {
        const timeDiff =
          validation['completedAt'].getTime() -
          validation['createdAt'].getTime()
        totalTime += timeDiff
      }

      return totalTime / completedValidations.length
    } catch (error: unknown) {
      logger.error('Failed to calculate average validation time:', { error })
      return 0
    }
  }

  private async calculateFalsePositives(): Promise<number> {
    try {
      const validationsCollection = this.db.collection('threat_validations')

      // Count validations that marked threats as invalid but were later confirmed as valid
      const falsePositives = await validationsCollection.countDocuments({
        'isValid': false,
        'metadata.confirmedValid': true,
        'createdAt': {
          $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      })

      return falsePositives
    } catch (error: unknown) {
      logger.error('Failed to calculate false positives:', { error })
      return 0
    }
  }

  private async calculateFalseNegatives(): Promise<number> {
    try {
      const validationsCollection = this.db.collection('threat_validations')

      // Count validations that marked threats as valid but were later confirmed as invalid
      const falseNegatives = await validationsCollection.countDocuments({
        'isValid': true,
        'metadata.confirmedInvalid': true,
        'createdAt': {
          $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      })

      return falseNegatives
    } catch (error: unknown) {
      logger.error('Failed to calculate false negatives:', { error })
      return 0
    }
  }

  private async getValidationsBySeverity(): Promise<Record<string, number>> {
    try {
      const validationsCollection = this.db.collection('threat_validations')
      const pipeline = [
        { $group: { _id: '$severity', count: { $sum: 1 } } },
        { $project: { severity: '$_id', count: 1, _id: 0 } },
      ]

      const results = await validationsCollection
        .aggregate<{ severity: string; count: number }>(pipeline)
        .toArray()

      const validationsBySeverity: Record<string, number> = {}
      for (const result of results) {
        validationsBySeverity[result.severity] = result.count
      }

      return validationsBySeverity
    } catch (error: unknown) {
      logger.error('Failed to get validations by severity:', { error })
      return {}
    }
  }

  private async getValidationsByType(): Promise<Record<string, number>> {
    try {
      const validationsCollection = this.db.collection('threat_validations')
      const pipeline = [
        { $group: { _id: '$threatType', count: { $sum: 1 } } },
        { $project: { threatType: '$_id', count: 1, _id: 0 } },
      ]

      const results = await validationsCollection
        .aggregate<{ threatType: string; count: number }>(pipeline)
        .toArray()

      const validationsByType: Record<string, number> = {}
      for (const result of results) {
        validationsByType[result.threatType] = result.count
      }

      return validationsByType
    } catch (error: unknown) {
      logger.error('Failed to get validations by type:', { error })
      return {}
    }
  }

  private async monitorActiveValidations(): Promise<void> {
    try {
      // Check for validations that have been running for too long
      const now = new Date()
      const timeoutThreshold = 10 * 60 * 1000 // 10 minutes

      for (const [validationId, validation] of this.activeValidations) {
        if (validation.status === 'pending') {
          const validationTime = now.getTime() - validation.createdAt.getTime()

          if (validationTime > timeoutThreshold) {
            logger.warn('Validation timeout detected', {
              validationId,
              validationTime,
            })

            // Update validation status
            validation.status = 'timeout'
            validation.completedAt = now
            await this.storeValidationResult(validation)

            this.emit('validation_timeout', { validationId, validationTime })
          }
        }
      }
    } catch (error: unknown) {
      logger.error('Active validation monitoring failed:', { error })
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.getValidationMetrics()

      this.emit('metrics_collected', metrics)
    } catch (error: unknown) {
      logger.error('Metrics collection failed:', { error })
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const startTime = Date.now()

      // Check Redis connection
      const redisHealthy = await this.checkRedisHealth()
      if (!redisHealthy) {
        return {
          healthy: false,
          message: 'Redis connection failed',
        }
      }

      // Check MongoDB connection
      const mongodbHealthy = await this.checkMongoDBHealth()
      if (!mongodbHealthy) {
        return {
          healthy: false,
          message: 'MongoDB connection failed',
        }
      }

      // Calculate success rate
      const metrics = await this.getValidationMetrics()
      const successRate =
        metrics.totalValidations > 0
          ? (metrics.validThreats / metrics.totalValidations) * 100
          : 0

      const responseTime = Date.now() - startTime

      return {
        healthy: true,
        message: 'Threat Validation System is healthy',
        responseTime,
        activeValidations: this.activeValidations.size,
        successRate,
      }
    } catch (error: unknown) {
      logger.error('Health check failed:', { error })
      return {
        healthy: false,
        message: `Health check failed: ${String(error)}`,
      }
    }
  }

  private async checkRedisHealth(): Promise<boolean> {
    try {
      const result = await this.redis.ping()
      return result === 'PONG'
    } catch (error: unknown) {
      logger.error('Redis health check failed:', { error })
      return false
    }
  }

  private async checkMongoDBHealth(): Promise<boolean> {
    try {
      await this.db.admin().ping()
      return true
    } catch (error: unknown) {
      logger.error('MongoDB health check failed:', { error })
      return false
    }
  }




  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Threat Validation System')

      // Close database connections
      if (this.mongoClient) {
        await this.mongoClient.close()
      }

      if (this.redis) {
        await this.redis.quit()
      }

      this.emit('validation_system_shutdown')
      logger.info('Threat Validation System shutdown completed')
    } catch (error: unknown) {
      logger.error('Error during shutdown:', { error })
      throw error
    }
  }
}
