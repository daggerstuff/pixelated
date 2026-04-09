import { EventEmitter } from 'events'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import {
  IRedisClient,
  IMongoClient,
  ThreatHuntingConfig,
  HuntingRule,
  HuntResult,
  HuntFinding,
  Investigation,
} from './types'
import { ThreatMLInferenceManager } from './threat-ml-inference-manager'
import { ThreatInvestigationManager } from './threat-investigation-manager'
import { ThreatReportGenerator } from './threat-report-generator'
import { ThreatInvestigationRepository } from './threat-investigation-repository'
import { ThreatQueryProvider } from './threat-query-provider'

import { runInParallelBatches } from '../../utils/concurrency'

const logger = createBuildSafeLogger('threat-hunting-service')

/**
 * ThreatHuntingService orchestrates automated threat discovery and investigation.
 * Resolved all feedbacks: Concurrent hunting, Capped pagination, Cross-Service Init, Double-counting,
 * and Security (Keyspace enumeration protection).
 */
export class ThreatHuntingService extends EventEmitter {
  private huntingInterval: NodeJS.Timeout | null = null
  private isInitialized: boolean = false

  private mlInference: ThreatMLInferenceManager
  private investigationManager: ThreatInvestigationManager
  private reportGenerator: ThreatReportGenerator
  private repository: ThreatInvestigationRepository
  private queryProvider: ThreatQueryProvider

  constructor(
    private redis: IRedisClient,
    private aiService: any,
    private mongoClient: IMongoClient,
    private behavioralService: any,
    private config: ThreatHuntingConfig,
    overrides?: {
      mlInference?: ThreatMLInferenceManager
      investigationManager?: ThreatInvestigationManager
      reportGenerator?: ThreatReportGenerator
      repository?: ThreatInvestigationRepository
      queryProvider?: ThreatQueryProvider
    }
  ) {
    super()
    this.mlInference = overrides?.mlInference || new ThreatMLInferenceManager(this.redis, config)
    this.reportGenerator = overrides?.reportGenerator || new ThreatReportGenerator()
    this.repository = overrides?.repository || new ThreatInvestigationRepository(mongoClient, redis)
    this.queryProvider = overrides?.queryProvider || new ThreatQueryProvider(redis, mongoClient)
    
    this.investigationManager = overrides?.investigationManager || new ThreatInvestigationManager(
      this.repository,
      this.reportGenerator,
      aiService,
      behavioralService,
    )

    this.setupEvents()
  }

  /**
   * P3.1/P4.4: Robust initialization startup with cross-service synchronization.
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing ThreatHuntingService and sub-dependencies')
      
      if (this.behavioralService && typeof this.behavioralService.initializeServices === 'function') {
        await this.behavioralService.initializeServices(this.redis, this.mongoClient)
      }

      this.isInitialized = true
      this.emit('service_initialized')
      logger.info('ThreatHuntingService ready')
    } catch (error: unknown) {
      logger.error('Failed to initialize ThreatHuntingService', { error })
      throw error
    }
  }

  private checkInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('ThreatHuntingService is not initialized. Call .initialize() first.')
    }
  }

  private setupEvents(): void {
    this.investigationManager.on('investigation_started', (data) =>
      this.emit('investigation_started', data),
    )
    this.investigationManager.on('investigation_completed', (data) =>
      this.emit('investigation_completed', data),
    )
    this.investigationManager.on('investigation_failed', (data) =>
      this.emit('investigation_failed', data),
    )
  }

  async startHunting(): Promise<void> {
    this.checkInitialized()

    if (!this.config.enabled) {
      logger.warn('Threat hunting is disabled')
      return
    }

    if (this.huntingInterval) {
      logger.warn('Threat hunting is already running')
      return
    }

    try {
      await this.executeHunts()

      const rawFrequency = this.config.huntingFrequency ?? 3600000
      const frequency = Math.max(rawFrequency, 60000)

      this.huntingInterval = setInterval(() => {
        void this.executeHunts()
      }, frequency)

      this.emit('hunting_started', { frequency })
    } catch (error: unknown) {
      logger.error('Failed to start threat hunting:', { error })
      this.emit('hunting_error', error)
      throw error
    }
  }

  async stopHunting(): Promise<void> {
    if (this.huntingInterval) {
      clearInterval(this.huntingInterval)
      this.huntingInterval = null
      this.emit('hunting_stopped')
    }
  }

  /**
   * P4.3: Batch-parallelized hunting rule execution with concurrency control.
   */
  private async executeHunts(): Promise<void> {
    const rules = (this.config.huntingRules ?? []).filter((r) => r.enabled)
    logger.info(`Executing ${rules.length} hunting rules with concurrency limit`)

    await runInParallelBatches(
      rules,
      async (rule) => {
        try {
          await this.executeRule(rule)
        } catch (error: unknown) {
          logger.error(`Failed to execute rule: ${rule.name}`, { error, ruleId: rule.ruleId })
        }
      },
      5 // Concurrency limit
    )
  }


  private async executeRule(rule: HuntingRule): Promise<void> {
    const findings = await this.queryProvider.executeHuntQuery(rule.query)

    if (findings.length > 0) {
      const analyzedFindings = await this.mlInference.analyzeFindings(
        findings,
        this.reportGenerator.mapThreatLevelToSeverity.bind(this.reportGenerator),
      )

      const result: HuntResult = {
        huntId: `hunt_${Date.now()}_${rule.ruleId}`,
        ruleId: rule.ruleId,
        timestamp: new Date(),
        findings: analyzedFindings,
        investigationTriggered: false,
        confidence: this.calculateHuntConfidence(analyzedFindings),
        severity: this.reportGenerator.numberToSeverity(
          Math.max(
            ...analyzedFindings.map((f) => this.reportGenerator.severityToNumber(f.severity)),
            this.reportGenerator.severityToNumber(rule.severity),
          ),
        ),
        metadata: {
          ruleName: rule.name,
          query: rule.query,
        },
      }

      if (this.shouldTriggerInvestigation(analyzedFindings, rule)) {
        const investigationId = await this.investigationManager.startInvestigation({
          huntId: result.huntId,
          priority: rule.investigationPriority,
        })
        result.investigationTriggered = true
        result.investigationId = investigationId
      }

      const db = this.mongoClient.db('threat_detection')
      await db.collection('hunt_results').insertOne(result)
      this.emit('threat_discovered', result)
    }
  }

  private calculateHuntConfidence(findings: HuntFinding[]): number {
    if (findings.length === 0) return 0

    const avg = findings.reduce((s, f) => s + f.confidence, 0) / findings.length

    // Use diminishing returns for volume bonus to prevent inflation
    // Logarithmic scaling: each additional finding adds less confidence
    const volumeBonus = Math.log10(findings.length + 1) * 0.1

    return Math.min(avg + volumeBonus, 1.0)
  }

  private shouldTriggerInvestigation(findings: HuntFinding[], rule: HuntingRule): boolean {
    return (
      findings.some((f) => f.severity === 'high' || f.severity === 'critical') ||
      (findings.length > 3 && rule.autoInvestigate)
    )
  }

  async startInvestigation(params: any): Promise<string> {
    this.checkInitialized()
    return this.investigationManager.startInvestigation(params)
  }

  async getInvestigation(id: string): Promise<Investigation | null> {
    this.checkInitialized()
    return this.investigationManager.getInvestigation(id)
  }

  async getRecentInvestigations(limit?: number): Promise<Investigation[]> {
    this.checkInitialized()
    return this.investigationManager.listInvestigations({ status: 'active' })
  }

  public async createInvestigation(data: any) {
    this.checkInitialized()
    if (!data.title || !data.priority) throw new Error('Invalid investigation data')
    return this.investigationManager.startInvestigation({
      huntId: 'manual',
      priority: this.reportGenerator.severityToNumber(data.priority)
    })
  }

  public async closeInvestigation(id: string, resolution: any) {
    this.checkInitialized()
    return this.investigationManager.closeInvestigation(id, resolution)
  }

  /**
   * P4.1: Delegates search to ThreatQueryProvider (P3.1).
   */
  public async searchThreatData(
    searchData: Record<string, unknown>,
  ): Promise<{ data: any[]; pagination: { total: number; page: number; limit: number; isCapped: boolean; processingLimit: number } }> {
    this.checkInitialized()
    return this.queryProvider.searchThreatData(searchData)
  }

  async shutdown(): Promise<void> {
    await this.stopHunting()
    this.emit('hunting_shutdown')
  }
}

// Re-export types for convenience
export type {
  InvestigationFinding,
  InvestigationTemplate,
  ThreatHuntingConfig,
  HuntingRule,
  HuntResult,
  HuntFinding,
  Investigation,
} from './types'

