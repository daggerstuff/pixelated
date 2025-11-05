/**
 * Threat Validation System
 * Validates threat intelligence for quality assurance and accuracy
 */

import { EventEmitter } from 'events'
import { Redis } from 'ioredis'
import { MongoClient, Db } from 'mongodb'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

import {
  ValidationConfig,
  ValidationRule,
  ValidationResult,
  ThreatValidation,
  GlobalThreatIntelligence,
  ThreatIndicator,
  ValidationMetrics,
} from '../global/types'

const logger = createBuildSafeLogger('threat-validation-system')

export interface ThreatValidationSystem {
  initialize(): Promise<void>
  validateThreat(threat: GlobalThreatIntelligence): Promise<ThreatValidation>
  validateIndicators(indicators: ThreatIndicator[]): Promise<ValidationResult>
  validateAttribution(attribution: any): Promise<ValidationResult>
  validateMetadata(metadata: any): Promise<ValidationResult>
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
  private redis: Redis
  private mongoClient: MongoClient
  private db: Db
  private validationRules: Map<string, ValidationRule> = new Map()
  private activeValidations: Map<string, ThreatValidation> = new Map()
  private threatIntelligenceCache: Map<string, GlobalThreatIntelligence> =
    new Map()

  constructor(private config: ValidationConfig) {
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
    } catch (error) {
      logger.error('Failed to initialize Threat Validation System:', { error })
      this.emit('initialization_error', { error })
      throw error
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
      await this.redis.ping()
      logger.info('Redis connection established for threat validation')
    } catch (error) {
      logger.error('Failed to connect to Redis:', { error })
      throw new Error('Redis connection failed', { cause: error })
    }
  }

  private async initializeMongoDB(): Promise<void> {
    try {
      this.mongoClient = new MongoClient(
        process.env.MONGODB_URI ||
          'mongodb://localhost:27017/threat_validation',
      )
      await this.mongoClient.connect()
      this.db = this.mongoClient.db('threat_validation')
      logger.info('MongoDB connection established for threat validation')
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', { error })
      throw new Error('MongoDB connection failed', { cause: error })
    }
  }

  private async loadValidationRules(): Promise<void> {
    try {
      const rulesCollection = this.db.collection('validation_rules')
      const rules = await rulesCollection.find({ enabled: true }).toArray()

      for (const rule of rules) {
        this.validationRules.set(rule.ruleId, rule)
      }

      logger.info(`Loaded ${rules.length} validation rules from database`)
    } catch (error) {
      logger.error('Failed to load validation rules:', { error })
    }
  }

  private async startValidationMonitoring(): Promise<void> {
    // Monitor active validations every 30 seconds
    setInterval(async () => {
      try {
        await this.monitorActiveValidations()
      } catch (error) {
        logger.error('Validation monitoring error:', { error })
      }
    }, 30000)
  }

  private async startMetricsCollection(): Promise<void> {
    // Collect metrics every 5 minutes
    setInterval(async () => {
      try {
        await this.collectMetrics()
      } catch (error) {
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
      const structureValidation = await this.validateThreatStructure(threat)
      validation.results.push(structureValidation)

      // Step 3: Validate indicators
      const indicatorValidation = await this.validateIndicators(
        threat.indicators,
      )
      validation.results.push(indicatorValidation)

      // Step 4: Validate attribution
      if (threat.attribution) {
        const attributionValidation = await this.validateAttribution(
          threat.attribution,
        )
        validation.results.push(attributionValidation)
      }

      // Step 5: Validate metadata
      if (threat.metadata) {
        const metadataValidation = await this.validateMetadata(threat.metadata)
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
      const overallScore = this.calculateOverallValidationScore(
        validation.results,
      )
      validation.overallScore = overallScore
      validation.isValid = overallScore >= this.config.validationThreshold

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
    } catch (error) {
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
    const validationId = this.generateValidationId()

    return {
      validationId,
      threatId: threat.threatId,
      threatType: threat.threatType,
      severity: threat.severity,
      confidence: threat.confidence,
      status: 'pending',
      overallScore: 0,
      results: [],
      createdAt: new Date(),
      completedAt: undefined,
      metadata: {
        validationVersion: '1.0',
        rulesApplied: Array.from(this.validationRules.keys()),
      },
    }
  }

  private async validateThreatStructure(
    threat: GlobalThreatIntelligence,
  ): Promise<ValidationResult> {
    try {
      const issues: string[] = []
      let score = 100

      // Check required fields
      if (!threat.threatId) {
        issues.push('Missing threatId')
        score -= 20
      }

      if (!threat.threatType) {
        issues.push('Missing threatType')
        score -= 20
      }

      if (
        !threat.severity ||
        !['low', 'medium', 'high', 'critical'].includes(threat.severity)
      ) {
        issues.push('Invalid or missing severity')
        score -= 15
      }

      if (
        threat.confidence === undefined ||
        threat.confidence < 0 ||
        threat.confidence > 1
      ) {
        issues.push('Invalid confidence value')
        score -= 15
      }

      if (!threat.indicators || threat.indicators.length === 0) {
        issues.push('No indicators provided')
        score -= 30
      }

      // Check timestamp consistency
      if (
        threat.firstSeen &&
        threat.lastSeen &&
        threat.firstSeen > threat.lastSeen
      ) {
        issues.push('firstSeen is after lastSeen')
        score -= 10
      }

      return {
        ruleId: 'structure_validation',
        ruleName: 'Threat Structure Validation',
        passed: issues.length === 0,
        score: Math.max(0, score),
        issues,
        details: {
          fieldCount: Object.keys(threat).length,
          hasAttribution: !!threat.attribution,
          hasMetadata: !!threat.metadata,
          indicatorCount: threat.indicators?.length || 0,
        },
      }
    } catch (error) {
      logger.error('Threat structure validation failed:', { error })
      return {
        ruleId: 'structure_validation',
        ruleName: 'Threat Structure Validation',
        passed: false,
        score: 0,
        issues: ['Validation error: ' + error.message],
        details: {},
      }
    }
  }

  async validateIndicators(
    indicators: ThreatIndicator[],
  ): Promise<ValidationResult> {
    try {
      const issues: string[] = []
      let score = 100
      let validIndicators = 0

      for (let i = 0; i < indicators.length; i++) {
        const indicator = indicators[i]
        const indicatorIssues: string[] = []

        // Check required fields
        if (!indicator.indicatorType) {
          indicatorIssues.push(`Indicator ${i}: Missing indicatorType`)
        }

        if (!indicator.value) {
          indicatorIssues.push(`Indicator ${i}: Missing value`)
        }

        if (
          indicator.confidence === undefined ||
          indicator.confidence < 0 ||
          indicator.confidence > 1
        ) {
          indicatorIssues.push(`Indicator ${i}: Invalid confidence value`)
        }

        // Validate indicator format based on type
        if (indicator.indicatorType && indicator.value) {
          const formatValidation = this.validateIndicatorFormat(indicator)
          if (!formatValidation.valid) {
            indicatorIssues.push(`Indicator ${i}: ${formatValidation.error}`)
          }
        }

        if (indicatorIssues.length === 0) {
          validIndicators++
        } else {
          issues.push(...indicatorIssues)
          score -= (20 / indicators.length) * indicatorIssues.length
        }
      }

      // Check for duplicate indicators
      const duplicates = this.findDuplicateIndicators(indicators)
      if (duplicates.length > 0) {
        issues.push(`Duplicate indicators found: ${duplicates.join(', ')}`)
        score -= 10
      }

      return {
        ruleId: 'indicator_validation',
        ruleName: 'Indicator Validation',
        passed: issues.length === 0,
        score: Math.max(0, score),
        issues,
        details: {
          totalIndicators: indicators.length,
          validIndicators,
          duplicateCount: duplicates.length,
          indicatorTypes: [...new Set(indicators.map((i) => i.indicatorType))],
        },
      }
    } catch (error) {
      logger.error('Indicator validation failed:', { error })
      return {
        ruleId: 'indicator_validation',
        ruleName: 'Indicator Validation',
        passed: false,
        score: 0,
        issues: ['Validation error: ' + error.message],
        details: {},
      }
    }
  }

  private validateIndicatorFormat(indicator: ThreatIndicator): {
    valid: boolean
    error?: string
  } {
    try {
      switch (indicator.indicatorType) {
        case 'ip':
          return this.validateIPFormat(indicator.value)
        case 'domain':
          return this.validateDomainFormat(indicator.value)
        case 'url':
          return this.validateURLFormat(indicator.value)
        case 'file_hash':
          return this.validateFileHashFormat(indicator.value)
        case 'email':
          return this.validateEmailFormat(indicator.value)
        case 'process':
          return this.validateProcessFormat(indicator.value)
        default:
          return { valid: true } // Unknown types are allowed
      }
    } catch (error) {
      return {
        valid: false,
        error: 'Format validation error: ' + error.message,
      }
    }
  }

  private validateIPFormat(ip: string): { valid: boolean; error?: string } {
    const ipv4Regex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    const ipv6Regex =
      /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/

    if (ipv4Regex.test(ip) || ipv6Regex.test(ip)) {
      return { valid: true }
    }

    return { valid: false, error: 'Invalid IP address format' }
  }

  private validateDomainFormat(domain: string): {
    valid: boolean
    error?: string
  } {
    const domainRegex =
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/

    if (domainRegex.test(domain) && domain.length <= 253) {
      return { valid: true }
    }

    return { valid: false, error: 'Invalid domain format' }
  }

  private validateURLFormat(url: string): { valid: boolean; error?: string } {
    try {
      new URL(url)
      return { valid: true }
    } catch {
      return { valid: false, error: 'Invalid URL format' }
    }
  }

  private validateFileHashFormat(hash: string): {
    valid: boolean
    error?: string
  } {
    // Check for common hash formats (MD5, SHA1, SHA256)
    const md5Regex = /^[a-fA-F0-9]{32}$/
    const sha1Regex = /^[a-fA-F0-9]{40}$/
    const sha256Regex = /^[a-fA-F0-9]{64}$/

    if (md5Regex.test(hash) || sha1Regex.test(hash) || sha256Regex.test(hash)) {
      return { valid: true }
    }

    return {
      valid: false,
      error: 'Invalid file hash format (expected MD5, SHA1, or SHA256)',
    }
  }

  private validateEmailFormat(email: string): {
    valid: boolean
    error?: string
  } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (emailRegex.test(email)) {
      return { valid: true }
    }

    return { valid: false, error: 'Invalid email format' }
  }

  private validateProcessFormat(process: string): {
    valid: boolean
    error?: string
  } {
    if (process.length > 0 && process.length <= 255) {
      return { valid: true }
    }

    return { valid: false, error: 'Invalid process name format' }
  }

  private findDuplicateIndicators(indicators: ThreatIndicator[]): string[] {
    const seen = new Map<string, number>()
    const duplicates: string[] = []

    for (const indicator of indicators) {
      const key = `${indicator.indicatorType}:${indicator.value}`
      seen.set(key, (seen.get(key) || 0) + 1)
    }

    for (const [key, count] of seen) {
      if (count > 1) {
        duplicates.push(key)
      }
    }

    return duplicates
  }

  async validateAttribution(attribution: any): Promise<ValidationResult> {
    try {
      const issues: string[] = []
      let score = 100

      if (!attribution) {
        return {
          ruleId: 'attribution_validation',
          ruleName: 'Attribution Validation',
          passed: true,
          score: 100,
          issues: [],
          details: { hasAttribution: false },
        }
      }

      // Validate attribution fields
      if (attribution.family && typeof attribution.family !== 'string') {
        issues.push('Attribution family must be a string')
        score -= 20
      }

      if (attribution.campaign && typeof attribution.campaign !== 'string') {
        issues.push('Attribution campaign must be a string')
        score -= 20
      }

      if (attribution.confidence !== undefined) {
        if (attribution.confidence < 0 || attribution.confidence > 1) {
          issues.push('Attribution confidence must be between 0 and 1')
          score -= 20
        }
      }

      if (attribution.actor && typeof attribution.actor !== 'string') {
        issues.push('Attribution actor must be a string')
        score -= 15
      }

      if (attribution.country && typeof attribution.country !== 'string') {
        issues.push('Attribution country must be a string')
        score -= 15
      }

      return {
        ruleId: 'attribution_validation',
        ruleName: 'Attribution Validation',
        passed: issues.length === 0,
        score: Math.max(0, score),
        issues,
        details: {
          hasAttribution: true,
          hasFamily: !!attribution.family,
          hasCampaign: !!attribution.campaign,
          hasConfidence: attribution.confidence !== undefined,
          hasActor: !!attribution.actor,
          hasCountry: !!attribution.country,
        },
      }
    } catch (error) {
      logger.error('Attribution validation failed:', { error })
      return {
        ruleId: 'attribution_validation',
        ruleName: 'Attribution Validation',
        passed: false,
        score: 0,
        issues: ['Validation error: ' + error.message],
        details: {},
      }
    }
  }

  async validateMetadata(metadata: any): Promise<ValidationResult> {
    try {
      const issues: string[] = []
      let score = 100

      if (!metadata) {
        return {
          ruleId: 'metadata_validation',
          ruleName: 'Metadata Validation',
          passed: true,
          score: 100,
          issues: [],
          details: { hasMetadata: false },
        }
      }

      // Validate metadata structure
      if (typeof metadata !== 'object') {
        issues.push('Metadata must be an object')
        score -= 30
      }

      // Check for suspicious metadata patterns
      const metadataStr = JSON.stringify(metadata)
      if (metadataStr.length > 10000) {
        // 10KB limit
        issues.push('Metadata size exceeds 10KB limit')
        score -= 20
      }

      // Validate specific metadata fields if present
      if (metadata.source && typeof metadata.source !== 'string') {
        issues.push('Metadata source must be a string')
        score -= 10
      }

      if (metadata.tags && !Array.isArray(metadata.tags)) {
        issues.push('Metadata tags must be an array')
        score -= 10
      }

      return {
        ruleId: 'metadata_validation',
        ruleName: 'Metadata Validation',
        passed: issues.length === 0,
        score: Math.max(0, score),
        issues,
        details: {
          hasMetadata: true,
          metadataSize: metadataStr.length,
          hasSource: !!metadata.source,
          hasTags: !!metadata.tags,
        },
      }
    } catch (error) {
      logger.error('Metadata validation failed:', { error })
      return {
        ruleId: 'metadata_validation',
        ruleName: 'Metadata Validation',
        passed: false,
        score: 0,
        issues: ['Validation error: ' + error.message],
        details: {},
      }
    }
  }

  private async applyCustomValidationRules(
    threat: GlobalThreatIntelligence,
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = []

    for (const rule of this.validationRules.values()) {
      try {
        const result = await this.applyValidationRule(rule, threat)
        results.push(result)
      } catch (error) {
        logger.error('Custom validation rule failed:', {
          error,
          ruleId: rule.ruleId,
        })
        results.push({
          ruleId: rule.ruleId,
          ruleName: rule.name,
          passed: false,
          score: 0,
          issues: ['Rule execution error: ' + error.message],
          details: {},
        })
      }
    }

    return results
  }

  private async applyValidationRule(
    rule: ValidationRule,
    threat: GlobalThreatIntelligence,
  ): Promise<ValidationResult> {
    try {
      const issues: string[] = []
      let score = 100

      // Apply rule conditions
      for (const condition of rule.conditions) {
        const conditionResult = await this.evaluateValidationCondition(
          condition,
          threat,
        )
        if (!conditionResult.passed) {
          issues.push(conditionResult.message)
          score -= condition.weight || 10
        }
      }

      return {
        ruleId: rule.ruleId,
        ruleName: rule.name,
        passed: issues.length === 0,
        score: Math.max(0, score),
        issues,
        details: {
          ruleType: rule.ruleType,
          conditionsApplied: rule.conditions.length,
          severity: rule.severity,
        },
      }
    } catch (error) {
      logger.error('Validation rule application failed:', {
        error,
        ruleId: rule.ruleId,
      })
      return {
        ruleId: rule.ruleId,
        ruleName: rule.name,
        passed: false,
        score: 0,
        issues: ['Rule application error: ' + error.message],
        details: {},
      }
    }
  }

  private async evaluateValidationCondition(
    condition: any,
    threat: GlobalThreatIntelligence,
  ): Promise<{ passed: boolean; message: string }> {
    try {
      switch (condition.type) {
        case 'field_exists':
          return this.evaluateFieldExistsCondition(condition, threat)
        case 'field_value':
          return this.evaluateFieldValueCondition(condition, threat)
        case 'regex_match':
          return this.evaluateRegexMatchCondition(condition, threat)
        case 'range_check':
          return this.evaluateRangeCheckCondition(condition, threat)
        case 'whitelist':
          return this.evaluateWhitelistCondition(condition, threat)
        case 'blacklist':
          return this.evaluateBlacklistCondition(condition, threat)
        default:
          return { passed: true, message: 'Unknown condition type' }
      }
    } catch (error) {
      return {
        passed: false,
        message: 'Condition evaluation error: ' + error.message,
      }
    }
  }

  private evaluateFieldExistsCondition(
    condition: any,
    threat: GlobalThreatIntelligence,
  ): { passed: boolean; message: string } {
    const value = this.getNestedValue(threat, condition.field)
    const exists = value !== undefined && value !== null

    return {
      passed: condition.required ? exists : !exists,
      message: condition.required
        ? `Field ${condition.field} must exist`
        : `Field ${condition.field} must not exist`,
    }
  }

  private evaluateFieldValueCondition(
    condition: any,
    threat: GlobalThreatIntelligence,
  ): { passed: boolean; message: string } {
    const value = this.getNestedValue(threat, condition.field)

    if (condition.operator === 'equals') {
      const passed = value === condition.value
      return {
        passed,
        message: passed
          ? ''
          : `Field ${condition.field} must equal ${condition.value}`,
      }
    }

    if (condition.operator === 'not_equals') {
      const passed = value !== condition.value
      return {
        passed,
        message: passed
          ? ''
          : `Field ${condition.field} must not equal ${condition.value}`,
      }
    }

    return { passed: true, message: 'Unknown operator' }
  }

  private evaluateRegexMatchCondition(
    condition: any,
    threat: GlobalThreatIntelligence,
  ): { passed: boolean; message: string } {
    const value = this.getNestedValue(threat, condition.field)

    if (typeof value !== 'string') {
      return {
        passed: false,
        message: `Field ${condition.field} must be a string for regex matching`,
      }
    }

    const regex = new RegExp(condition.pattern)
    const passed = regex.test(value)

    return {
      passed,
      message: passed
        ? ''
        : `Field ${condition.field} must match pattern ${condition.pattern}`,
    }
  }

  private evaluateRangeCheckCondition(
    condition: any,
    threat: GlobalThreatIntelligence,
  ): { passed: boolean; message: string } {
    const value = this.getNestedValue(threat, condition.field)
    const numValue = Number(value)

    if (isNaN(numValue)) {
      return {
        passed: false,
        message: `Field ${condition.field} must be a number for range check`,
      }
    }

    if (condition.min !== undefined && numValue < condition.min) {
      return {
        passed: false,
        message: `Field ${condition.field} must be >= ${condition.min}`,
      }
    }

    if (condition.max !== undefined && numValue > condition.max) {
      return {
        passed: false,
        message: `Field ${condition.field} must be <= ${condition.max}`,
      }
    }

    return { passed: true, message: '' }
  }

  private evaluateWhitelistCondition(
    condition: any,
    threat: GlobalThreatIntelligence,
  ): { passed: boolean; message: string } {
    const value = this.getNestedValue(threat, condition.field)

    if (!condition.values.includes(value)) {
      return {
        passed: false,
        message: `Field ${condition.field} must be one of: ${condition.values.join(', ')}`,
      }
    }

    return { passed: true, message: '' }
  }

  private evaluateBlacklistCondition(
    condition: any,
    threat: GlobalThreatIntelligence,
  ): { passed: boolean; message: string } {
    const value = this.getNestedValue(threat, condition.field)

    if (condition.values.includes(value)) {
      return {
        passed: false,
        message: `Field ${condition.field} must not be one of: ${condition.values.join(', ')}`,
      }
    }

    return { passed: true, message: '' }
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
    } catch (error) {
      logger.error('Cross-reference validation failed:', { error })
      return {
        ruleId: 'cross_reference_validation',
        ruleName: 'Cross-Reference Validation',
        passed: false,
        score: 0,
        issues: ['Cross-reference validation error: ' + error.message],
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
    } catch (error) {
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
    } catch (error) {
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
        const commonIndicators = similarThreat.indicators.filter(
          (i: ThreatIndicator) =>
            threat.indicators.some((ti) => ti.value === i.value),
        )

        const similarity =
          commonIndicators.length /
          Math.max(similarThreat.indicators.length, threat.indicators.length)
        totalSimilarity += similarity
      }

      return totalSimilarity / similarThreats.length
    } catch (error) {
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
          totalReputation += reputation.score
          reputationCount++
        }
      }

      return reputationCount > 0 ? totalReputation / reputationCount : 0.5 // Default neutral score
    } catch (error) {
      logger.error('Indicator reputation check failed:', { error })
      return 0.5 // Default neutral score
    }
  }

  private calculateOverallValidationScore(results: ValidationResult[]): number {
    if (results.length === 0) return 0

    const totalScore = results.reduce((sum, result) => sum + result.score, 0)
    const averageScore = totalScore / results.length

    // Apply weights based on rule importance
    const weightedScore = this.applyValidationWeights(results, averageScore)

    return Math.max(0, Math.min(100, weightedScore))
  }

  private applyValidationWeights(
    results: ValidationResult[],
    baseScore: number,
  ): number {
    // Critical rules that should heavily impact the score
    const criticalRules = ['structure_validation', 'indicator_validation']
    const criticalFailures = results.filter(
      (r) => criticalRules.includes(r.ruleId) && !r.passed,
    )

    if (criticalFailures.length > 0) {
      // Reduce score significantly for critical failures
      return baseScore * 0.3
    }

    return baseScore
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
        .find({ threatId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray()

      return validations
    } catch (error) {
      logger.error('Failed to get validation history:', { error, threatId })
      throw error
    }
  }

  async updateValidationRule(rule: ValidationRule): Promise<boolean> {
    try {
      logger.info('Updating validation rule', { ruleId: rule.ruleId })

      // Validate rule
      this.validateValidationRule(rule)

      // Update in memory
      this.validationRules.set(rule.ruleId, rule)

      // Update in database
      const rulesCollection = this.db.collection('validation_rules')
      await rulesCollection.replaceOne({ ruleId: rule.ruleId }, rule, {
        upsert: true,
      })

      this.emit('validation_rule_updated', { ruleId: rule.ruleId })

      return true
    } catch (error) {
      logger.error('Failed to update validation rule:', { error })
      return false
    }
  }

  private validateValidationRule(rule: ValidationRule): void {
    if (!rule.ruleId || !rule.name || !rule.ruleType) {
      throw new Error('Invalid validation rule: missing required fields')
    }

    if (
      rule.severity &&
      !['low', 'medium', 'high', 'critical'].includes(rule.severity)
    ) {
      throw new Error(
        'Invalid validation rule: severity must be low, medium, high, or critical',
      )
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
    } catch (error) {
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
          validation.completedAt.getTime() - validation.createdAt.getTime()
        totalTime += timeDiff
      }

      return totalTime / completedValidations.length
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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

      const results = await validationsCollection.aggregate(pipeline).toArray()

      const validationsBySeverity: Record<string, number> = {}
      for (const result of results) {
        validationsBySeverity[result.severity] = result.count
      }

      return validationsBySeverity
    } catch (error) {
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

      const results = await validationsCollection.aggregate(pipeline).toArray()

      const validationsByType: Record<string, number> = {}
      for (const result of results) {
        validationsByType[result.threatType] = result.count
      }

      return validationsByType
    } catch (error) {
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
    } catch (error) {
      logger.error('Active validation monitoring failed:', { error })
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.getValidationMetrics()

      this.emit('metrics_collected', metrics)
    } catch (error) {
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
    } catch (error) {
      logger.error('Health check failed:', { error })
      return {
        healthy: false,
        message: `Health check failed: ${error}`,
      }
    }
  }

  private async checkRedisHealth(): Promise<boolean> {
    try {
      const result = await this.redis.ping()
      return result === 'PONG'
    } catch (error) {
      logger.error('Redis health check failed:', { error })
      return false
    }
  }

  private async checkMongoDBHealth(): Promise<boolean> {
    try {
      await this.db.admin().ping()
      return true
    } catch (error) {
      logger.error('MongoDB health check failed:', { error })
      return false
    }
  }

  private generateValidationId(): string {
    return `validation_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
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
    } catch (error) {
      logger.error('Error during shutdown:', { error })
      throw error
    }
  }
}
