/**
 * Threat Validation System
 * Quality assurance and validation for threat intelligence data
 * Ensures accuracy, reliability, and compliance with standards
 */

import { EventEmitter } from 'events'
import { MongoClient, Db, Collection } from 'mongodb'
import { Redis } from 'ioredis'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../../logger'

// Types
export interface ThreatValidation {
  id: string
  threat_id: string
  validation_type:
    | 'accuracy'
    | 'completeness'
    | 'timeliness'
    | 'reliability'
    | 'compliance'
  status: 'pending' | 'in_progress' | 'validated' | 'rejected' | 'needs_review'
  validator_type: 'automated' | 'human' | 'hybrid'
  validation_criteria: ValidationCriteria
  validation_result: ValidationResult
  assigned_validators: string[]
  validation_history: ValidationHistoryEntry[]
  created_at: Date
  updated_at: Date
  completed_at?: Date
  due_date?: Date
  priority: 'low' | 'medium' | 'high' | 'critical'
}

export interface ValidationCriteria {
  accuracy_threshold: number // 0-1
  completeness_requirements: string[]
  timeliness_window: number // hours
  reliability_sources: string[]
  compliance_standards: string[] // STIX, TAXII, MISP, etc.
  custom_rules: ValidationRule[]
}

export interface ValidationRule {
  name: string
  description: string
  condition: string
  parameters: Record<string, any>
  weight: number // 0-1
  required: boolean
}

export interface ValidationResult {
  overall_score: number // 0-1
  accuracy_score: number
  completeness_score: number
  timeliness_score: number
  reliability_score: number
  compliance_score: number
  findings: ValidationFinding[]
  recommendations: string[]
  confidence_level: number // 0-1
  validation_methodology: string
  evidence: ValidationEvidence[]
}

export interface ValidationFinding {
  id: string
  type: 'error' | 'warning' | 'info'
  category: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  impact: string
  remediation: string
  evidence: ValidationEvidence[]
  validator: string
  timestamp: Date
}

export interface ValidationEvidence {
  type:
    | 'data_sample'
    | 'source_reference'
    | 'analysis_result'
    | 'external_validation'
  data: Record<string, any>
  source: string
  confidence: number // 0-1
  timestamp: Date
}

export interface ValidationHistoryEntry {
  timestamp: Date
  action: string
  performed_by: string
  details: Record<string, any>
  previous_status?: string
  new_status?: string
}

export interface ThreatData {
  id: string
  type:
    | 'indicator'
    | 'threat_actor'
    | 'campaign'
    | 'attack_pattern'
    | 'vulnerability'
  data: Record<string, any>
  source: string
  confidence: number
  timestamp: Date
  metadata: Record<string, any>
}

export interface ValidationQueueItem {
  id: string
  threat_data: ThreatData
  validation_types: string[]
  priority: 'low' | 'medium' | 'high' | 'critical'
  submitted_at: Date
  submitted_by: string
  assigned_validator?: string
  status: 'queued' | 'assigned' | 'processing' | 'completed'
}

export interface ThreatValidationSystemConfig {
  mongodb: {
    url: string
    database: string
  }
  redis: {
    url: string
    password?: string
  }
  validation_settings: {
    max_concurrent_validations: number
    validation_timeout: number
    auto_validation_threshold: number
    human_review_threshold: number
    quality_gates: QualityGate[]
  }
  ai_assistance: {
    enabled: boolean
    model: string
    confidence_threshold: number
  }
  compliance: {
    enabled_standards: string[]
    audit_logging: boolean
    data_retention_days: number
  }
}

export interface QualityGate {
  name: string
  description: string
  criteria: ValidationCriteria
  action: 'approve' | 'reject' | 'review' | 'escalate'
  notification_config?: NotificationConfig
}

export interface NotificationConfig {
  enabled: boolean
  channels: string[] // email, slack, webhook, etc.
  recipients: string[]
  templates: Record<string, string>
}

export class ThreatValidationSystem extends EventEmitter {
  private mongoClient: MongoClient
  private db: Db
  private validationsCollection: Collection<ThreatValidation>
  private queueCollection: Collection<ValidationQueueItem>
  private threatDataCollection: Collection<ThreatData>
  private validationHistoryCollection: Collection<ValidationHistoryEntry>
  private redis: Redis
  private isInitialized = false
  private validationQueue: ValidationQueueItem[] = []
  private isProcessing = false
  private activeValidations = new Map<string, ThreatValidation>()

  constructor(private config: ThreatValidationSystemConfig) {
    super()
    this.setMaxListeners(0)
  }

  /**
   * Initialize the threat validation system
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Threat Validation System')

      // Initialize MongoDB connection
      this.mongoClient = new MongoClient(this.config.mongodb.url)
      await this.mongoClient.connect()
      this.db = this.mongoClient.db(this.config.mongodb.database)

      // Initialize collections
      this.validationsCollection =
        this.db.collection<ThreatValidation>('threat_validations')
      this.queueCollection =
        this.db.collection<ValidationQueueItem>('validation_queue')
      this.threatDataCollection = this.db.collection<ThreatData>('threat_data')
      this.validationHistoryCollection =
        this.db.collection<ValidationHistoryEntry>('validation_history')

      // Create indexes for performance
      await this.createIndexes()

      // Initialize Redis connection
      this.redis = new Redis(this.config.redis.url, {
        password: this.config.redis.password,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
      })

      // Set up Redis pub/sub for real-time coordination
      await this.setupRedisPubSub()

      // Start background processing
      this.startValidationProcessing()

      this.isInitialized = true
      logger.info('Threat Validation System initialized successfully')

      this.emit('initialized', { timestamp: new Date() })
    } catch (error) {
      logger.error('Failed to initialize Threat Validation System', {
        error: (error as Error).message,
      })
      throw new Error(
        `Failed to initialize threat validation system: ${(error as Error).message}`,
        { cause: error },
      )
    }
  }

  /**
   * Create database indexes for optimal performance
   */
  private async createIndexes(): Promise<void> {
    try {
      await Promise.all([
        // Validations collection indexes
        this.validationsCollection.createIndex({ id: 1 }, { unique: true }),
        this.validationsCollection.createIndex({ threat_id: 1 }),
        this.validationsCollection.createIndex({ validation_type: 1 }),
        this.validationsCollection.createIndex({ status: 1 }),
        this.validationsCollection.createIndex({ priority: 1 }),
        this.validationsCollection.createIndex({ created_at: -1 }),
        this.validationsCollection.createIndex({ due_date: 1 }),

        // Queue collection indexes
        this.queueCollection.createIndex({ id: 1 }, { unique: true }),
        this.queueCollection.createIndex({ status: 1 }),
        this.queueCollection.createIndex({ priority: 1 }),
        this.queueCollection.createIndex({ submitted_at: -1 }),

        // Threat data collection indexes
        this.threatDataCollection.createIndex({ id: 1 }, { unique: true }),
        this.threatDataCollection.createIndex({ type: 1 }),
        this.threatDataCollection.createIndex({ source: 1 }),
        this.threatDataCollection.createIndex({ timestamp: -1 }),

        // Validation history collection indexes
        this.validationHistoryCollection.createIndex({ timestamp: -1 }),
        this.validationHistoryCollection.createIndex({ action: 1 }),
      ])

      logger.info('Database indexes created successfully')
    } catch (error) {
      logger.error('Failed to create database indexes', {
        error: (error as Error).message,
      })
      throw error
    }
  }

  /**
   * Set up Redis pub/sub for real-time coordination
   */
  private async setupRedisPubSub(): Promise<void> {
    try {
      const subscriber = this.redis.duplicate()
      await subscriber.connect()

      // Subscribe to validation requests
      await subscriber.subscribe('validation:request', async (message) => {
        try {
          const validationData = JSON.parse(message)
          await this.requestValidation(
            validationData.threat_data,
            validationData.validation_types,
          )
        } catch (error) {
          logger.error('Failed to process validation request', {
            error: (error as Error).message,
          })
        }
      })

      // Subscribe to validation completion events
      await subscriber.subscribe('validation:completed', async (message) => {
        try {
          const completionData = JSON.parse(message)
          await this.handleValidationCompletion(completionData)
        } catch (error) {
          logger.error('Failed to process validation completion', {
            error: (error as Error).message,
          })
        }
      })

      logger.info('Redis pub/sub setup completed')
    } catch (error) {
      logger.error('Failed to setup Redis pub/sub', {
        error: (error as Error).message,
      })
      throw error
    }
  }

  /**
   * Request validation for threat data
   */
  async requestValidation(
    threatData: ThreatData,
    validationTypes: string[] = ['accuracy', 'completeness', 'reliability'],
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Threat validation system not initialized')
    }

    try {
      const queueItemId = uuidv4()
      const now = new Date()

      // Store threat data
      await this.threatDataCollection.insertOne(threatData)

      // Create queue item
      const queueItem: ValidationQueueItem = {
        id: queueItemId,
        threat_data: threatData,
        validation_types: validationTypes,
        priority: priority,
        submitted_at: now,
        submitted_by: 'system', // In production, get from auth context
        status: 'queued',
      }

      await this.queueCollection.insertOne(queueItem)

      // Queue for processing
      await this.queueValidationForProcessing(queueItemId)

      logger.info('Validation requested', {
        queue_item_id: queueItemId,
        threat_id: threatData.id,
        validation_types: validationTypes,
      })

      this.emit('validation:requested', {
        queue_item_id: queueItemId,
        threat_id: threatData.id,
      })

      return queueItemId
    } catch (error) {
      logger.error('Failed to request validation', {
        error: (error as Error).message,
      })
      throw error
    }
  }

  /**
   * Queue validation for processing
   */
  private async queueValidationForProcessing(
    queueItemId: string,
  ): Promise<void> {
    try {
      this.validationQueue.push({
        id: queueItemId,
      } as ValidationQueueItem)

      // Limit queue size
      if (this.validationQueue.length > 1000) {
        this.validationQueue = this.validationQueue.slice(-500)
      }

      // Publish processing event
      await this.redis.publish(
        'validation:process',
        JSON.stringify({ queue_item_id: queueItemId }),
      )

      logger.debug('Validation queued for processing', {
        queue_item_id: queueItemId,
      })
    } catch (error) {
      logger.error('Failed to queue validation for processing', {
        error: (error as Error).message,
        queue_item_id: queueItemId,
      })
    }
  }

  /**
   * Start validation processing service
   */
  private startValidationProcessing(): void {
    // Process validation queue
    setInterval(async () => {
      if (this.validationQueue.length > 0 && !this.isProcessing) {
        await this.processValidationQueue()
      }
    }, 5000) // Check every 5 seconds

    // Process scheduled validations
    setInterval(async () => {
      await this.processScheduledValidations()
    }, 60000) // Check every minute
  }

  /**
   * Process validation queue
   */
  private async processValidationQueue(): Promise<void> {
    this.isProcessing = true

    try {
      const batchSize = Math.min(
        this.validationQueue.length,
        this.config.validation_settings.max_concurrent_validations,
      )

      const queueItems = this.validationQueue.splice(0, batchSize)
      logger.info('Processing validation batch', { count: queueItems.length })

      const validationPromises = queueItems.map(async (item) => {
        try {
          return await this.processValidation(item.id)
        } catch (error) {
          logger.error('Failed to process validation', {
            error: (error as Error).message,
            queue_item_id: item.id,
          })
          return null
        }
      })

      await Promise.allSettled(validationPromises)
    } catch (error) {
      logger.error('Failed to process validation queue', {
        error: (error as Error).message,
      })
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Process individual validation
   */
  private async processValidation(
    queueItemId: string,
  ): Promise<ThreatValidation> {
    const validationId = uuidv4()
    const startTime = Date.now()

    try {
      // Get queue item
      const queueItem = await this.queueCollection.findOne({ id: queueItemId })
      if (!queueItem) {
        throw new Error(`Queue item not found: ${queueItemId}`)
      }

      // Update queue item status
      await this.queueCollection.updateOne(
        { id: queueItemId },
        { $set: { status: 'processing' } },
      )

      logger.info('Processing validation', {
        validation_id: validationId,
        threat_id: queueItem.threat_data.id,
        validation_types: queueItem.validation_types,
      })

      // Create validation record
      const validation: ThreatValidation = {
        id: validationId,
        threat_id: queueItem.threat_data.id,
        validation_type: queueItem.validation_types[0] || 'accuracy',
        status: 'in_progress',
        validator_type: this.determineValidatorType(queueItem),
        validation_criteria: this.getValidationCriteria(
          queueItem.validation_types,
        ),
        validation_result: {
          overall_score: 0,
          accuracy_score: 0,
          completeness_score: 0,
          timeliness_score: 0,
          reliability_score: 0,
          compliance_score: 0,
          findings: [],
          recommendations: [],
          confidence_level: 0,
          validation_methodology: '',
          evidence: [],
        },
        assigned_validators: [],
        validation_history: [],
        created_at: new Date(),
        updated_at: new Date(),
        priority: queueItem.priority,
      }

      // Store validation record
      await this.validationsCollection.insertOne(validation)
      this.activeValidations.set(validationId, validation)

      // Perform validation based on type
      const result = await this.performValidation(
        queueItem.threat_data,
        validation,
      )

      // Update validation with results
      validation.validation_result = result
      validation.status = this.determineFinalStatus(result)
      validation.completed_at = new Date()
      validation.updated_at = new Date()

      // Add history entry
      validation.validation_history.push({
        timestamp: new Date(),
        action: 'validation_completed',
        performed_by: 'system',
        details: {
          overall_score: result.overall_score,
          status: validation.status,
        },
        previous_status: 'in_progress',
        new_status: validation.status,
      })

      // Update validation record
      await this.validationsCollection.replaceOne(
        { id: validationId },
        validation,
      )

      // Update queue item
      await this.queueCollection.updateOne(
        { id: queueItemId },
        { $set: { status: 'completed' } },
      )

      // Remove from active validations
      this.activeValidations.delete(validationId)

      logger.info('Validation completed', {
        validation_id: validationId,
        threat_id: queueItem.threat_data.id,
        overall_score: result.overall_score,
        status: validation.status,
        execution_time: Date.now() - startTime,
      })

      this.emit('validation:completed', {
        validation_id: validationId,
        threat_id: queueItem.threat_data.id,
        score: result.overall_score,
        status: validation.status,
      })

      return validation
    } catch (error) {
      logger.error('Failed to process validation', {
        error: (error as Error).message,
        validation_id: validationId,
      })

      // Update validation status to error
      if (this.activeValidations.has(validationId)) {
        const validation = this.activeValidations.get(validationId)!
        validation.status = 'needs_review'
        validation.updated_at = new Date()

        await this.validationsCollection.replaceOne(
          { id: validationId },
          validation,
        )
        this.activeValidations.delete(validationId)
      }

      throw error
    }
  }

  /**
   * Determine validator type based on queue item
   */
  private determineValidatorType(
    queueItem: ValidationQueueItem,
  ): 'automated' | 'human' | 'hybrid' {
    // Simple logic - in production, this would be more sophisticated
    if (
      queueItem.priority === 'critical' ||
      queueItem.validation_types.includes('compliance')
    ) {
      return 'hybrid'
    }
    return 'automated'
  }

  /**
   * Get validation criteria for validation types
   */
  private getValidationCriteria(_validationTypes: string[]): ValidationCriteria {
    return {
      accuracy_threshold: 0.8,
      completeness_requirements: ['value', 'type', 'source', 'timestamp'],
      timeliness_window: 24, // hours
      reliability_sources: ['trusted_feeds', 'manual_verification'],
      compliance_standards: this.config.compliance.enabled_standards,
      custom_rules: [
        {
          name: 'minimum_confidence',
          description: 'Minimum confidence level for threat data',
          condition: 'confidence >= 0.5',
          parameters: { min_confidence: 0.5 },
          weight: 1.0,
          required: true,
        },
      ],
    }
  }

  /**
   * Perform actual validation
   */
  private async performValidation(
    threatData: ThreatData,
    validation: ThreatValidation,
  ): Promise<ValidationResult> {
    logger.info('Performing validation', {
      validation_id: validation.id,
      threat_id: threatData.id,
      validation_type: validation.validation_type,
    })

    const findings: ValidationFinding[] = []
    const evidence: ValidationEvidence[] = []
    let overallScore = 0
    let methodology = ''

    // Accuracy validation
    if (validation.validation_types.includes('accuracy')) {
      const accuracyResult = await this.validateAccuracy(
        threatData,
        validation.validation_criteria,
      )
      findings.push(...accuracyResult.findings)
      evidence.push(...accuracyResult.evidence)
      overallScore += accuracyResult.score * 0.3
      methodology += 'Accuracy validation performed. '
    }

    // Completeness validation
    if (validation.validation_types.includes('completeness')) {
      const completenessResult = await this.validateCompleteness(
        threatData,
        validation.validation_criteria,
      )
      findings.push(...completenessResult.findings)
      evidence.push(...completenessResult.evidence)
      overallScore += completenessResult.score * 0.2
      methodology += 'Completeness validation performed. '
    }

    // Timeliness validation
    if (validation.validation_types.includes('timeliness')) {
      const timelinessResult = await this.validateTimeliness(
        threatData,
        validation.validation_criteria,
      )
      findings.push(...timelinessResult.findings)
      evidence.push(...timelinessResult.evidence)
      overallScore += timelinessResult.score * 0.2
      methodology += 'Timeliness validation performed. '
    }

    // Reliability validation
    if (validation.validation_types.includes('reliability')) {
      const reliabilityResult = await this.validateReliability(
        threatData,
        validation.validation_criteria,
      )
      findings.push(...reliabilityResult.findings)
      evidence.push(...reliabilityResult.evidence)
      overallScore += reliabilityResult.score * 0.2
      methodology += 'Reliability validation performed. '
    }

    // Compliance validation
    if (validation.validation_types.includes('compliance')) {
      const complianceResult = await this.validateCompliance(
        threatData,
        validation.validation_criteria,
      )
      findings.push(...complianceResult.findings)
      evidence.push(...complianceResult.evidence)
      overallScore += complianceResult.score * 0.1
      methodology += 'Compliance validation performed. '
    }

    // Apply AI assistance if enabled
    if (this.config.ai_assistance.enabled) {
      const aiResult = await this.applyAIAssistance(threatData, findings)
      findings.push(...aiResult.findings)
      evidence.push(...aiResult.evidence)
    }

    // Calculate final scores
    const scores = this.calculateValidationScores(findings, overallScore)

    return {
      overall_score: Math.min(1, Math.max(0, scores.overall)),
      accuracy_score: scores.accuracy,
      completeness_score: scores.completeness,
      timeliness_score: scores.timeliness,
      reliability_score: scores.reliability,
      compliance_score: scores.compliance,
      findings: findings,
      recommendations: this.generateRecommendations(findings),
      confidence_level: this.calculateConfidenceLevel(evidence),
      validation_methodology: methodology.trim(),
      evidence: evidence,
    }
  }

  /**
   * Validate accuracy of threat data
   */
  private async validateAccuracy(
    _threatData: ThreatData,
    _criteria: ValidationCriteria,
  ): Promise<{
    score: number
    findings: ValidationFinding[]
    evidence: ValidationEvidence[]
  }> {
    const findings: ValidationFinding[] = []
    const evidence: ValidationEvidence[] = []
    let score = 1.0

    try {
      // Check data consistency
      const consistencyCheck = await this.checkDataConsistency(threatData)
      if (!consistencyCheck.is_consistent) {
        score -= 0.3
        findings.push({
          id: uuidv4(),
          type: 'error',
          category: 'data_consistency',
          description: 'Inconsistent data detected in threat information',
          severity: 'high',
          impact: 'May lead to incorrect threat assessment',
          remediation: 'Review and correct inconsistent data fields',
          evidence: consistencyCheck.evidence,
          validator: 'system',
          timestamp: new Date(),
        })
      }

      // Cross-reference with external sources
      const crossRefCheck = await this.crossReferenceExternalSources(threatData)
      if (!crossRefCheck.is_verified) {
        score -= 0.2
        findings.push({
          id: uuidv4(),
          type: 'warning',
          category: 'external_verification',
          description:
            'Threat data could not be verified against external sources',
          severity: 'medium',
          impact: 'Reduced confidence in threat accuracy',
          remediation: 'Manually verify threat data against trusted sources',
          evidence: crossRefCheck.evidence,
          validator: 'system',
          timestamp: new Date(),
        })
      }

      // Validate against known patterns
      const patternCheck = await this.validateAgainstPatterns(threatData)
      if (!patternCheck.is_valid) {
        score -= 0.1
        findings.push({
          id: uuidv4(),
          type: 'info',
          category: 'pattern_validation',
          description: 'Threat data does not match known patterns',
          severity: 'low',
          impact: 'May indicate novel or modified threat',
          remediation: 'Consider additional analysis for novel patterns',
          evidence: patternCheck.evidence,
          validator: 'system',
          timestamp: new Date(),
        })
      }

      evidence.push({
        type: 'analysis_result',
        data: {
          accuracy_score: score,
          checks_performed: [
            'consistency',
            'cross_reference',
            'pattern_validation',
          ],
        },
        source: 'automated_validation',
        confidence: 0.9,
        timestamp: new Date(),
      })
    } catch (error) {
      logger.error('Error during accuracy validation', {
        error: (error as Error).message,
      })
      score = 0
      findings.push({
        id: uuidv4(),
        type: 'error',
        category: 'validation_error',
        description: 'Error occurred during accuracy validation',
        severity: 'high',
        impact: 'Unable to assess threat accuracy',
        remediation: 'Manual review required',
        evidence: [],
        validator: 'system',
        timestamp: new Date(),
      })
    }

    return { score: Math.max(0, score), findings, evidence }
  }

  /**
   * Validate completeness of threat data
   */
  private async validateCompleteness(
    threatData: ThreatData,
    criteria: ValidationCriteria,
  ): Promise<{
    score: number
    findings: ValidationFinding[]
    evidence: ValidationEvidence[]
  }> {
    const findings: ValidationFinding[] = []
    const evidence: ValidationEvidence[] = []
    let score = 1.0

    try {
      const requiredFields = criteria.completeness_requirements
      const missingFields: string[] = []

      for (const field of requiredFields) {
        if (!this.hasField(threatData.data, field)) {
          missingFields.push(field)
          score -= 0.2
        }
      }

      if (missingFields.length > 0) {
        findings.push({
          id: uuidv4(),
          type: 'error',
          category: 'missing_data',
          description: `Missing required fields: ${missingFields.join(', ')}`,
          severity: missingFields.length > 2 ? 'high' : 'medium',
          impact: 'Incomplete threat assessment possible',
          remediation: `Provide missing fields: ${missingFields.join(', ')}`,
          evidence: [
            {
              type: 'data_sample',
              data: {
                missing_fields: missingFields,
                available_fields: Object.keys(threatData.data),
              },
              source: 'data_analysis',
              confidence: 1.0,
              timestamp: new Date(),
            },
          ],
          validator: 'system',
          timestamp: new Date(),
        })
      }

      // Check for optional but recommended fields
      const recommendedFields = [
        'description',
        'confidence',
        'source_reliability',
      ]
      const missingRecommended = recommendedFields.filter(
        (field) => !this.hasField(threatData.data, field),
      )

      if (missingRecommended.length > 0) {
        findings.push({
          id: uuidv4(),
          type: 'warning',
          category: 'recommended_data',
          description: `Missing recommended fields: ${missingRecommended.join(', ')}`,
          severity: 'low',
          impact: 'Reduced threat context and understanding',
          remediation: `Consider adding recommended fields: ${missingRecommended.join(', ')}`,
          evidence: [],
          validator: 'system',
          timestamp: new Date(),
        })
      }

      evidence.push({
        type: 'analysis_result',
        data: {
          completeness_score: score,
          required_fields_checked: requiredFields.length,
          missing_fields: missingFields.length,
        },
        source: 'automated_validation',
        confidence: 0.95,
        timestamp: new Date(),
      })
    } catch (error) {
      logger.error('Error during completeness validation', {
        error: (error as Error).message,
      })
      score = 0
      findings.push({
        id: uuidv4(),
        type: 'error',
        category: 'validation_error',
        description: 'Error occurred during completeness validation',
        severity: 'high',
        impact: 'Unable to assess threat completeness',
        remediation: 'Manual review required',
        evidence: [],
        validator: 'system',
        timestamp: new Date(),
      })
    }

    return { score: Math.max(0, score), findings, evidence }
  }

  /**
   * Validate timeliness of threat data
   */
  private async validateTimeliness(
    threatData: ThreatData,
    criteria: ValidationCriteria,
  ): Promise<{
    score: number
    findings: ValidationFinding[]
    evidence: ValidationEvidence[]
  }> {
    const findings: ValidationFinding[] = []
    const evidence: ValidationEvidence[] = []
    let score = 1.0

    try {
      const dataAge = Date.now() - threatData.timestamp.getTime()
      const maxAge = criteria.timeliness_window * 60 * 60 * 1000 // Convert hours to milliseconds

      if (dataAge > maxAge) {
        score -= 0.5
        findings.push({
          id: uuidv4(),
          type: 'warning',
          category: 'data_freshness',
          description: `Threat data is ${Math.floor(dataAge / (24 * 60 * 60 * 1000))} days old`,
          severity: dataAge > maxAge * 2 ? 'high' : 'medium',
          impact: 'Threat intelligence may be outdated',
          remediation: 'Refresh threat data or verify current relevance',
          evidence: [
            {
              type: 'data_sample',
              data: {
                data_timestamp: threatData.timestamp,
                current_timestamp: new Date(),
                age_hours: Math.floor(dataAge / (60 * 60 * 1000)),
                max_age_hours: criteria.timeliness_window,
              },
              source: 'temporal_analysis',
              confidence: 1.0,
              timestamp: new Date(),
            },
          ],
          validator: 'system',
          timestamp: new Date(),
        })
      }

      // Check for recent updates or corroborating data
      const recentData = await this.checkForRecentData(threatData)
      if (recentData.has_recent_updates) {
        score += 0.1
        findings.push({
          id: uuidv4(),
          type: 'info',
          category: 'recent_updates',
          description: 'Recent updates available for this threat',
          severity: 'low',
          impact: 'Improved threat relevance and accuracy',
          remediation: 'Consider incorporating recent updates',
          evidence: recentData.evidence,
          validator: 'system',
          timestamp: new Date(),
        })
      }

      evidence.push({
        type: 'analysis_result',
        data: {
          timeliness_score: score,
          data_age_hours: Math.floor(dataAge / (60 * 60 * 1000)),
          freshness_threshold_hours: criteria.timeliness_window,
        },
        source: 'temporal_analysis',
        confidence: 0.9,
        timestamp: new Date(),
      })
    } catch (error) {
      logger.error('Error during timeliness validation', {
        error: (error as Error).message,
      })
      score = 0
      findings.push({
        id: uuidv4(),
        type: 'error',
        category: 'validation_error',
        description: 'Error occurred during timeliness validation',
        severity: 'high',
        impact: 'Unable to assess threat timeliness',
        remediation: 'Manual review required',
        evidence: [],
        validator: 'system',
        timestamp: new Date(),
      })
    }

    return { score: Math.min(1, Math.max(0, score)), findings, evidence }
  }

  /**
   * Validate reliability of threat data
   */
  private async validateReliability(
    threatData: ThreatData,
    _criteria: ValidationCriteria,
  ): Promise<{
    score: number
    findings: ValidationFinding[]
    evidence: ValidationEvidence[]
  }> {
    const findings: ValidationFinding[] = []
    const evidence: ValidationEvidence[] = []
    let score = 1.0

    try {
      // Check source reliability
      const sourceReliability = await this.assessSourceReliability(
        threatData.source,
      )
      score *= sourceReliability.score

      if (sourceReliability.score < 0.7) {
        findings.push({
          id: uuidv4(),
          type: 'warning',
          category: 'source_reliability',
          description: `Source reliability score is low: ${sourceReliability.score}`,
          severity: 'medium',
          impact: 'Reduced confidence in threat data reliability',
          remediation: 'Verify data through additional trusted sources',
          evidence: sourceReliability.evidence,
          validator: 'system',
          timestamp: new Date(),
        })
      }

      // Check for corroborating sources
      const corroboration = await this.checkCorroboratingSources(threatData)
      if (corroboration.corroborating_sources < 2) {
        score -= 0.2
        findings.push({
          id: uuidv4(),
          type: 'info',
          category: 'source_corroboration',
          description: `Limited corroborating sources found: ${corroboration.corroborating_sources}`,
          severity: 'low',
          impact: 'Reduced confidence without multiple source verification',
          remediation: 'Seek additional corroborating sources',
          evidence: corroboration.evidence,
          validator: 'system',
          timestamp: new Date(),
        })
      }

      // Check historical accuracy of source
      const historicalAccuracy = await this.checkHistoricalAccuracy(
        threatData.source,
      )
      score *= historicalAccuracy.score

      evidence.push({
        type: 'analysis_result',
        data: {
          reliability_score: score,
          source_assessment: sourceReliability,
          corroboration_count: corroboration.corroborating_sources,
          historical_accuracy: historicalAccuracy.score,
        },
        source: 'reliability_analysis',
        confidence: 0.85,
        timestamp: new Date(),
      })
    } catch (error) {
      logger.error('Error during reliability validation', {
        error: (error as Error).message,
      })
      score = 0
      findings.push({
        id: uuidv4(),
        type: 'error',
        category: 'validation_error',
        description: 'Error occurred during reliability validation',
        severity: 'high',
        impact: 'Unable to assess threat reliability',
        remediation: 'Manual review required',
        evidence: [],
        validator: 'system',
        timestamp: new Date(),
      })
    }

    return { score: Math.max(0, score), findings, evidence }
  }

  /**
   * Validate compliance with standards
   */
  private async validateCompliance(
    threatData: ThreatData,
    criteria: ValidationCriteria,
  ): Promise<{
    score: number
    findings: ValidationFinding[]
    evidence: ValidationEvidence[]
  }> {
    const findings: ValidationFinding[] = []
    const evidence: ValidationEvidence[] = []
    let score = 1.0

    try {
      for (const standard of criteria.compliance_standards) {
        const complianceCheck = await this.checkComplianceStandard(
          threatData,
          standard,
        )

        if (!complianceCheck.is_compliant) {
          score -= 0.2
          findings.push({
            id: uuidv4(),
            type: 'error',
            category: 'compliance_violation',
            description: `Non-compliant with ${standard}: ${complianceCheck.violation}`,
            severity: 'high',
            impact: 'May not meet regulatory or industry requirements',
            remediation: `Address compliance issues for ${standard}`,
            evidence: complianceCheck.evidence,
            validator: 'system',
            timestamp: new Date(),
          })
        }
      }

      evidence.push({
        type: 'analysis_result',
        data: {
          compliance_score: score,
          standards_checked: criteria.compliance_standards.length,
          violations_found: findings.filter(
            (f) => f.category === 'compliance_violation',
          ).length,
        },
        source: 'compliance_analysis',
        confidence: 0.9,
        timestamp: new Date(),
      })
    } catch (error) {
      logger.error('Error during compliance validation', {
        error: (error as Error).message,
      })
      score = 0
      findings.push({
        id: uuidv4(),
        type: 'error',
        category: 'validation_error',
        description: 'Error occurred during compliance validation',
        severity: 'high',
        impact: 'Unable to assess compliance',
        remediation: 'Manual compliance review required',
        evidence: [],
        validator: 'system',
        timestamp: new Date(),
      })
    }

    return { score: Math.max(0, score), findings, evidence }
  }

  /**
   * Apply AI assistance to validation
   */
  private async applyAIAssistance(
    threatData: ThreatData,
    _existingFindings: ValidationFinding[],
  ): Promise<{
    findings: ValidationFinding[]
    evidence: ValidationEvidence[]
  }> {
    const findings: ValidationFinding[] = []
    const evidence: ValidationEvidence[] = []

    try {
      // Simulate AI analysis
      const aiAnalysis = await this.simulateAIAnalysis(threatData)

      if (
        aiAnalysis.confidence > this.config.ai_assistance.confidence_threshold
      ) {
        findings.push({
          id: uuidv4(),
          type: 'info',
          category: 'ai_analysis',
          description: `AI analysis: ${aiAnalysis.insight}`,
          severity: 'low',
          impact: 'Additional context from AI analysis',
          remediation: 'Consider AI recommendations in validation decision',
          evidence: [
            {
              type: 'analysis_result',
              data: {
                ai_insight: aiAnalysis.insight,
                confidence: aiAnalysis.confidence,
              },
              source: 'ai_assistant',
              confidence: aiAnalysis.confidence,
              timestamp: new Date(),
            },
          ],
          validator: 'ai_assistant',
          timestamp: new Date(),
        })

        evidence.push({
          type: 'analysis_result',
          data: aiAnalysis,
          source: 'ai_assistant',
          confidence: aiAnalysis.confidence,
          timestamp: new Date(),
        })
      }
    } catch (error) {
      logger.error('AI assistance failed', { error: (error as Error).message })
    }

    return { findings, evidence }
  }

  /**
   * Simulate AI analysis (placeholder for actual AI integration)
   */
  private async simulateAIAnalysis(_threatData: ThreatData): Promise<any> {
    // Simulate AI processing delay
    await new Promise((resolve) => setTimeout(resolve, 100))

    return {
      confidence: 0.8,
      insight:
        'AI analysis suggests standard threat pattern with moderate risk',
      recommendations: [
        'Consider additional verification',
        'Monitor for pattern changes',
      ],
    }
  }

  /**
   * Helper methods for validation checks
   */
  private hasField(data: any, field: string): boolean {
    const value = this.getNestedValue(data, field)
    return value !== undefined && value !== null && value !== ''
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  private async checkDataConsistency(_threatData: ThreatData): Promise<{
    is_consistent: boolean
    evidence: ValidationEvidence[]
  }> {
    // Implement data consistency checks
    return {
      is_consistent: true,
      evidence: [],
    }
  }

  private async crossReferenceExternalSources(_threatData: ThreatData): Promise<{
    is_verified: boolean
    evidence: ValidationEvidence[]
  }> {
    // Implement external source cross-referencing
    return {
      is_verified: true,
      evidence: [],
    }
  }

  private async validateAgainstPatterns(_threatData: ThreatData): Promise<{
    is_valid: boolean
    evidence: ValidationEvidence[]
  }> {
    // Implement pattern validation
    return {
      is_valid: true,
      evidence: [],
    }
  }

  private async checkForRecentData(_threatData: ThreatData): Promise<{
    has_recent_updates: boolean
    evidence: ValidationEvidence[]
  }> {
    // Implement recent data checking
    return {
      has_recent_updates: false,
      evidence: [],
    }
  }

  private async assessSourceReliability(_source: string): Promise<{
    score: number
    evidence: ValidationEvidence[]
  }> {
    // Implement source reliability assessment
    return {
      score: 0.8,
      evidence: [],
    }
  }

  private async checkCorroboratingSources(_threatData: ThreatData): Promise<{
    corroborating_sources: number
    evidence: ValidationEvidence[]
  }> {
    // Implement corroborating source checking
    return {
      corroborating_sources: 1,
      evidence: [],
    }
  }

  private async checkHistoricalAccuracy(_source: string): Promise<{
    score: number
    evidence: ValidationEvidence[]
  }> {
    // Implement historical accuracy checking
    return {
      score: 0.9,
      evidence: [],
    }
  }

  private async checkComplianceStandard(
    _threatData: ThreatData,
    _standard: string,
  ): Promise<{
    is_compliant: boolean
    violation?: string
    evidence: ValidationEvidence[]
  }> {
    // Implement compliance standard checking
    return {
      is_compliant: true,
      evidence: [],
    }
  }

  /**
   * Calculate validation scores
   */
  private calculateValidationScores(
    findings: ValidationFinding[],
    baseScore: number,
  ): {
    overall: number
    accuracy: number
    completeness: number
    timeliness: number
    reliability: number
    compliance: number
  } {
    // Calculate weighted scores based on findings
    const scores = {
      overall: baseScore,
      accuracy: 0.8,
      completeness: 0.8,
      timeliness: 0.8,
      reliability: 0.8,
      compliance: 0.8,
    }

    // Adjust scores based on findings
    for (const finding of findings) {
      if (finding.category === 'data_consistency') {
        scores.accuracy = Math.max(0, scores.accuracy - 0.2)
      } else if (finding.category === 'missing_data') {
        scores.completeness = Math.max(0, scores.completeness - 0.2)
      }
      // Add more category-specific adjustments
    }

    return scores
  }

  /**
   * Generate recommendations based on findings
   */
  private generateRecommendations(findings: ValidationFinding[]): string[] {
    const recommendations: string[] = []

    for (const finding of findings) {
      if (
        finding.remediation &&
        !recommendations.includes(finding.remediation)
      ) {
        recommendations.push(finding.remediation)
      }
    }

    // Add general recommendations
    if (findings.some((f) => f.severity === 'high')) {
      recommendations.push('High-severity findings require immediate attention')
    }

    if (findings.some((f) => f.category === 'compliance_violation')) {
      recommendations.push('Address compliance violations before deployment')
    }

    return recommendations
  }

  /**
   * Calculate confidence level based on evidence
   */
  private calculateConfidenceLevel(evidence: ValidationEvidence[]): number {
    if (evidence.length === 0) return 0.5

    const totalConfidence = evidence.reduce((sum, ev) => sum + ev.confidence, 0)
    return Math.min(1, totalConfidence / evidence.length)
  }

  /**
   * Determine final validation status
   */
  private determineFinalStatus(
    result: ValidationResult,
  ): 'validated' | 'rejected' | 'needs_review' {
    if (result.overall_score >= 0.8) {
      return 'validated'
    } else if (result.overall_score >= 0.6) {
      return 'needs_review'
    } else {
      return 'rejected'
    }
  }

  /**
   * Process scheduled validations
   */
  private async processScheduledValidations(): Promise<void> {
    try {
      const now = new Date()
      const overdueValidations = await this.validationsCollection
        .find({
          status: { $in: ['pending', 'in_progress'] },
          due_date: { $lte: now },
        })
        .toArray()

      for (const validation of overdueValidations) {
        await this.queueValidationForProcessing(validation.id)
      }
    } catch (error) {
      logger.error('Failed to process scheduled validations', {
        error: (error as Error).message,
      })
    }
  }

  /**
   * Handle validation completion
   */
  private async handleValidationCompletion(completionData: any): Promise<void> {
    try {
      logger.info('Handling validation completion', {
        validation_id: completionData.validation_id,
      })

      // Trigger quality gates
      await this.applyQualityGates(completionData.validation_id)

      // Update related systems
      await this.notifyRelatedSystems(completionData)
    } catch (error) {
      logger.error('Failed to handle validation completion', {
        error: (error as Error).message,
      })
    }
  }

  /**
   * Apply quality gates
   */
  private async applyQualityGates(validationId: string): Promise<void> {
    try {
      const validation = await this.validationsCollection.findOne({
        id: validationId,
      })
      if (!validation) return

      for (const gate of this.config.validation_settings.quality_gates) {
        if (this.meetsQualityGateCriteria(validation, gate)) {
          await this.executeQualityGateAction(validation, gate)
        }
      }
    } catch (error) {
      logger.error('Failed to apply quality gates', {
        error: (error as Error).message,
      })
    }
  }

  /**
   * Check if validation meets quality gate criteria
   */
  private meetsQualityGateCriteria(
    validation: ThreatValidation,
    _gate: QualityGate,
  ): boolean {
    // Implement quality gate criteria checking
    return validation.validation_result.overall_score >= 0.7
  }

  /**
   * Execute quality gate action
   */
  private async executeQualityGateAction(
    validation: ThreatValidation,
    gate: QualityGate,
  ): Promise<void> {
    switch (gate.action) {
      case 'approve':
        logger.info('Quality gate approved validation', {
          validation_id: validation.id,
        })
        break
      case 'reject':
        validation.status = 'rejected'
        await this.validationsCollection.replaceOne(
          { id: validation.id },
          validation,
        )
        break
      case 'review':
        validation.status = 'needs_review'
        await this.validationsCollection.replaceOne(
          { id: validation.id },
          validation,
        )
        break
      case 'escalate':
        await this.escalateValidation(validation)
        break
    }
  }

  /**
   * Escalate validation for human review
   */
  private async escalateValidation(
    validation: ThreatValidation,
  ): Promise<void> {
    logger.info('Escalating validation for human review', {
      validation_id: validation.id,
    })

    // Add to human review queue
    validation.status = 'needs_review'
    validation.assigned_validators = ['human_reviewer'] // In production, assign to actual reviewers
    validation.updated_at = new Date()

    await this.validationsCollection.replaceOne(
      { id: validation.id },
      validation,
    )

    // Send notification
    if (
      this.config.validation_settings.quality_gates.find(
        (g) => g.name === 'escalation',
      )?.notification_config?.enabled
    ) {
      await this.sendEscalationNotification(validation)
    }
  }

  /**
   * Send escalation notification
   */
  private async sendEscalationNotification(
    validation: ThreatValidation,
  ): Promise<void> {
    // Implement notification sending logic
    logger.info('Sending escalation notification', {
      validation_id: validation.id,
    })
  }

  /**
   * Notify related systems
   */
  private async notifyRelatedSystems(completionData: any): Promise<void> {
    // Implement system notification logic
    logger.info('Notifying related systems', {
      validation_id: completionData.validation_id,
    })
  }

  /**
   * Get validation by ID
   */
  async getValidationById(
    validationId: string,
  ): Promise<ThreatValidation | null> {
    try {
      return await this.validationsCollection.findOne({ id: validationId })
    } catch (error) {
      logger.error('Failed to get validation by ID', {
        error: (error as Error).message,
        validation_id: validationId,
      })
      throw error
    }
  }

  /**
   * Get validation statistics
   */
  async getValidationStats(): Promise<{
    total_validations: number
    pending_validations: number
    validated_threats: number
    rejected_threats: number
    average_score: number
    by_validation_type: Record<string, number>
    by_status: Record<string, number>
  }> {
    try {
      const [
        totalValidations,
        pendingValidations,
        validatedThreats,
        rejectedThreats,
        allValidations,
      ] = await Promise.all([
        this.validationsCollection.countDocuments(),
        this.validationsCollection.countDocuments({
          status: { $in: ['pending', 'in_progress'] },
        }),
        this.validationsCollection.countDocuments({ status: 'validated' }),
        this.validationsCollection.countDocuments({ status: 'rejected' }),
        this.validationsCollection.find().toArray(),
      ])

      const byValidationType: Record<string, number> = {}
      const byStatus: Record<string, number> = {}
      let totalScore = 0

      for (const validation of allValidations) {
        byValidationType[validation.validation_type] =
          (byValidationType[validation.validation_type] || 0) + 1
        byStatus[validation.status] = (byStatus[validation.status] || 0) + 1
        totalScore += validation.validation_result.overall_score
      }

      const averageScore =
        allValidations.length > 0 ? totalScore / allValidations.length : 0

      return {
        total_validations: totalValidations,
        pending_validations: pendingValidations,
        validated_threats: validatedThreats,
        rejected_threats: rejectedThreats,
        average_score: averageScore,
        by_validation_type: byValidationType,
        by_status: byStatus,
      }
    } catch (error) {
      logger.error('Failed to get validation statistics', {
        error: (error as Error).message,
      })
      throw error
    }
  }

  /**
   * Get validation queue items
   */
  async getValidationQueue(
    status?: string,
    limit: number = 100,
  ): Promise<ValidationQueueItem[]> {
    try {
      const query: any = {}
      if (status) query.status = status

      return await this.queueCollection
        .find(query)
        .sort({ priority: -1, submitted_at: 1 })
        .limit(limit)
        .toArray()
    } catch (error) {
      logger.error('Failed to get validation queue', {
        error: (error as Error).message,
      })
      throw error
    }
  }

  /**
   * Assign validator to validation
   */
  async assignValidator(
    validationId: string,
    validatorId: string,
  ): Promise<void> {
    try {
      const validation = await this.validationsCollection.findOne({
        id: validationId,
      })
      if (!validation) {
        throw new Error(`Validation not found: ${validationId}`)
      }

      validation.assigned_validators.push(validatorId)
      validation.updated_at = new Date()

      await this.validationsCollection.replaceOne(
        { id: validationId },
        validation,
      )

      logger.info('Validator assigned', {
        validation_id: validationId,
        validator_id: validatorId,
      })
    } catch (error) {
      logger.error('Failed to assign validator', {
        error: (error as Error).message,
      })
      throw error
    }
  }

  /**
   * Submit human validation feedback
   */
  async submitHumanValidation(
    validationId: string,
    feedback: {
      overall_score: number
      findings: ValidationFinding[]
      recommendations: string[]
      status: 'validated' | 'rejected' | 'needs_review'
    },
    validatorId: string,
  ): Promise<void> {
    try {
      const validation = await this.validationsCollection.findOne({
        id: validationId,
      })
      if (!validation) {
        throw new Error(`Validation not found: ${validationId}`)
      }

      // Update validation result with human feedback
      validation.validation_result.overall_score = feedback.overall_score
      validation.validation_result.findings.push(...feedback.findings)
      validation.validation_result.recommendations.push(
        ...feedback.recommendations,
      )
      validation.status = feedback.status
      validation.completed_at = new Date()
      validation.updated_at = new Date()

      // Add history entry
      validation.validation_history.push({
        timestamp: new Date(),
        action: 'human_validation_submitted',
        performed_by: validatorId,
        details: {
          score: feedback.overall_score,
          findings_count: feedback.findings.length,
          status: feedback.status,
        },
      })

      await this.validationsCollection.replaceOne(
        { id: validationId },
        validation,
      )

      logger.info('Human validation submitted', {
        validation_id: validationId,
        validator_id: validatorId,
        status: feedback.status,
      })
    } catch (error) {
      logger.error('Failed to submit human validation', {
        error: (error as Error).message,
      })
      throw error
    }
  }

  /**
   * Shutdown the system
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Threat Validation System')

      // Wait for active validations to complete
      if (this.activeValidations.size > 0) {
        logger.info(
          `Waiting for ${this.activeValidations.size} active validations to complete`,
        )

        const maxWaitTime = 60000 // 60 seconds
        const startTime = Date.now()

        while (
          this.activeValidations.size > 0 &&
          Date.now() - startTime < maxWaitTime
        ) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }

        if (this.activeValidations.size > 0) {
          logger.warn(
            `Force shutting down with ${this.activeValidations.size} active validations`,
          )
        }
      }

      await this.redis.quit()
      await this.mongoClient.close()

      this.isInitialized = false
      this.emit('shutdown', { timestamp: new Date() })

      logger.info('Threat Validation System shutdown completed')
    } catch (error) {
      logger.error('Error during shutdown', { error: (error as Error).message })
      throw error
    }
  }

  /**
   * Get initialization status
   */
  get isReady(): boolean {
    return this.isInitialized
  }

  /**
   * Get current configuration
   */
  get config(): ThreatValidationSystemConfig {
    return this.config
  }
}

export default ThreatValidationSystem
