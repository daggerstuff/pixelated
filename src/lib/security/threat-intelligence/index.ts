/**
 * Global Threat Intelligence Network - Main Integration
 * Orchestrates all threat intelligence components
 */

import { EventEmitter } from 'events'

import Redis from 'ioredis'

import { logger } from '../../logger'
import { AutomatedThreatResponseOrchestrator } from './AutomatedThreatResponseOrchestrator'
import type { ResponseOrchestratorConfig } from './AutomatedThreatResponseOrchestrator'
// Import configuration
import { getCurrentConfig } from './config'
import { EdgeThreatDetectionSystem } from './EdgeThreatDetectionSystem'
import type { EdgeDetectionConfig } from './EdgeThreatDetectionSystem'
import {
  ExternalThreatFeedIntegration,
  ExternalThreatFeedIntegrationConfig,
} from './ExternalThreatFeedIntegration'
// Import all threat intelligence components
import { GlobalThreatIntelligenceNetwork } from './GlobalThreatIntelligenceNetwork'
import type { GlobalThreatNetworkConfig } from './GlobalThreatIntelligenceNetwork'
import { ThreatCorrelationEngine } from './ThreatCorrelationEngine'
import type { CorrelationEngineConfig } from './ThreatCorrelationEngine'
import { ThreatHuntingSystem } from './ThreatHuntingSystem'
import type { ThreatHuntingSystemConfig } from './ThreatHuntingSystem'
import { ThreatIntelligenceDatabase } from './ThreatIntelligenceDatabase'
import type { ThreatIntelligenceDatabaseConfig } from './ThreatIntelligenceDatabase'
import { ThreatValidationSystem } from './ThreatValidationSystem'
import type { ThreatValidationSystemConfig } from './ThreatValidationSystem'

// Types
interface ComponentMethods {
  on: EventEmitter['on']
  correlateThreat(id: string): Promise<unknown>
  requestValidation(
    data: unknown,
    types: string[],
    priority?: string,
  ): Promise<unknown>
  processThreat(data: unknown): Promise<unknown>
  processValidatedThreat(id: string): Promise<unknown>
  orchestrateResponse(data: unknown): Promise<unknown>
  getValidationStats(): Promise<unknown>
  getThreatIndicators(opts: Record<string, unknown>): Promise<unknown[]>
  getHuntResults(id: string, limit: number): Promise<unknown[]>
  analyzeThreat(data: unknown): Promise<unknown>
  shutdown(): Promise<void>
  isReady: boolean
}

export interface ThreatIntelligenceNetworkConfig {
  global: GlobalThreatNetworkConfig
  edge: EdgeDetectionConfig
  correlation: CorrelationEngineConfig
  database: ThreatIntelligenceDatabaseConfig
  response: ResponseOrchestratorConfig
  hunting: ThreatHuntingSystemConfig
  feeds: ExternalThreatFeedIntegrationConfig
  validation: ThreatValidationSystemConfig
}

export interface ThreatIntelligenceMetrics {
  totalThreatsProcessed: number
  threatsBySeverity: Record<string, number>
  threatsByType: Record<string, number>
  detectionAccuracy: number
  falsePositiveRate: number
  responseTime: number
  systemHealth: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    components: Record<string, 'up' | 'down' | 'warning'>
  }
}

export interface ThreatIntelligenceEvent {
  type:
    | 'threat_detected'
    | 'threat_correlated'
    | 'threat_validated'
    | 'response_triggered'
    | 'system_alert'
  timestamp: Date
  severity: 'low' | 'medium' | 'high' | 'critical'
  data: Record<string, unknown>
  source: string
}

export class ThreatIntelligenceNetwork extends EventEmitter {
  private readonly components: Map<string, unknown> = new Map()
  private isInitialized = false
  private readonly metrics: ThreatIntelligenceMetrics
  private readonly networkConfig: ThreatIntelligenceNetworkConfig

  constructor(config?: Partial<ThreatIntelligenceNetworkConfig>) {
    super()
    this.setMaxListeners(0)

    // Merge provided config with default config
    const currentConfig = getCurrentConfig()
    this.networkConfig = {
      global: { ...currentConfig.global, ...config?.global },
      edge: { ...currentConfig.edge, ...config?.edge },
      correlation: { ...currentConfig.correlation, ...config?.correlation },
      database: { ...currentConfig.database, ...config?.database },
      response: { ...currentConfig.response, ...config?.response },
      hunting: { ...currentConfig.hunting, ...config?.hunting },
      feeds: { ...currentConfig.feeds, ...config?.feeds },
      validation: { ...currentConfig.validation, ...config?.validation },
    }

    // Initialize metrics
    this.metrics = {
      totalThreatsProcessed: 0,
      threatsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      threatsByType: {},
      detectionAccuracy: 0,
      falsePositiveRate: 0,
      responseTime: 0,
      systemHealth: {
        status: 'healthy',
        components: {},
      },
    }
  }

  /**
   * Initialize the complete threat intelligence network
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Global Threat Intelligence Network')

      // Initialize components in dependency order
      await this.initializeDatabase()
      await this.initializeGlobalNetwork()
      await this.initializeEdgeDetection()
      await this.initializeCorrelationEngine()
      await this.initializeResponseOrchestrator()
      await this.initializeHuntingSystem()
      await this.initializeFeedIntegration()
      await this.initializeValidationSystem()

      // Set up cross-component communication
      await this.setupComponentIntegration()

      // Start health monitoring
      this.startHealthMonitoring()

      this.isInitialized = true
      logger.info('Global Threat Intelligence Network initialized successfully')

      this.emit('initialized', { timestamp: new Date() })
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error('Failed to initialize Threat Intelligence Network', {
        error: errMsg,
      })
      throw new Error(
        `Failed to initialize threat intelligence network: ${errMsg}`,
        { cause: error },
      )
    }
  }

  /**
   * Initialize threat intelligence database
   */
  private async initializeDatabase(): Promise<void> {
    try {
      logger.info('Initializing Threat Intelligence Database')
      const database = new ThreatIntelligenceDatabase(
        this.networkConfig.database,
      )
      await database.initialize()
      this.components.set('database', database)
      logger.info('Threat Intelligence Database initialized')
    } catch (error: unknown) {
      logger.error('Failed to initialize database', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Initialize global threat intelligence network
   */
  private async initializeGlobalNetwork(): Promise<void> {
    try {
      logger.info('Initializing Global Threat Intelligence Network')
      const globalNetwork = new GlobalThreatIntelligenceNetwork(
        this.networkConfig.global,
      )
      await globalNetwork.initialize()
      this.components.set('global', globalNetwork)
      logger.info('Global Threat Intelligence Network initialized')
    } catch (error: unknown) {
      logger.error('Failed to initialize global network', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Initialize edge threat detection system
   */
  private async initializeEdgeDetection(): Promise<void> {
    try {
      logger.info('Initializing Edge Threat Detection System')
      const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
      const redis = new Redis(redisUrl)
      const edgeDetection = new EdgeThreatDetectionSystem(
        this.networkConfig.edge,
        redis,
      )
      await edgeDetection.initialize()
      this.components.set('edge', edgeDetection)
      logger.info('Edge Threat Detection System initialized')
    } catch (error: unknown) {
      logger.error('Failed to initialize edge detection', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Initialize threat correlation engine
   */
  private async initializeCorrelationEngine(): Promise<void> {
    try {
      logger.info('Initializing Threat Correlation Engine')
      const correlationEngine = new ThreatCorrelationEngine(
        this.networkConfig.correlation,
      )
      await correlationEngine.initialize()
      this.components.set('correlation', correlationEngine)
      logger.info('Threat Correlation Engine initialized')
    } catch (error: unknown) {
      logger.error('Failed to initialize correlation engine', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Initialize automated threat response orchestrator
   */
  private async initializeResponseOrchestrator(): Promise<void> {
    try {
      logger.info('Initializing Automated Threat Response Orchestrator')
      const responseOrchestrator = new AutomatedThreatResponseOrchestrator(
        this.networkConfig.response,
      )
      await responseOrchestrator.initialize()
      this.components.set('response', responseOrchestrator)
      logger.info('Automated Threat Response Orchestrator initialized')
    } catch (error: unknown) {
      logger.error('Failed to initialize response orchestrator', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Initialize threat hunting system
   */
  private async initializeHuntingSystem(): Promise<void> {
    try {
      logger.info('Initializing Threat Hunting System')
      const huntingSystem = new ThreatHuntingSystem(this.networkConfig.hunting)
      await huntingSystem.initialize()
      this.components.set('hunting', huntingSystem)
      logger.info('Threat Hunting System initialized')
    } catch (error: unknown) {
      logger.error('Failed to initialize hunting system', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Initialize external threat feed integration
   */
  private async initializeFeedIntegration(): Promise<void> {
    try {
      logger.info('Initializing External Threat Feed Integration')
      const feedIntegration = new ExternalThreatFeedIntegration(
        this.networkConfig.feeds,
      )
      await feedIntegration.initialize()
      this.components.set('feeds', feedIntegration)
      logger.info('External Threat Feed Integration initialized')
    } catch (error: unknown) {
      logger.error('Failed to initialize feed integration', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Initialize threat validation system
   */
  private async initializeValidationSystem(): Promise<void> {
    try {
      logger.info('Initializing Threat Validation System')
      const validationSystem = new ThreatValidationSystem(
        this.networkConfig.validation,
      )
      await validationSystem.initialize()
      this.components.set('validation', validationSystem)
      logger.info('Threat Validation System initialized')
    } catch (error: unknown) {
      logger.error('Failed to initialize validation system', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Set up cross-component integration
   */
  private async setupComponentIntegration(): Promise<void> {
    try {
      logger.info('Setting up component integration')

      // Get components

      // Set up event listeners for cross-component communication
      this.setupEventListeners()

      // Configure data flow between components
      await this.configureDataFlow()

      logger.info('Component integration setup completed')
    } catch (error: unknown) {
      logger.error('Failed to setup component integration', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Set up event listeners for cross-component communication
   */
  private setupEventListeners(): void {
    const globalNetwork = this.components.get('global') as EventEmitter
    const edgeDetection = this.components.get('edge') as EventEmitter
    const responseOrchestrator = this.components.get('response') as EventEmitter
    const huntingSystem = this.components.get('hunting') as EventEmitter
    const feedIntegration = this.components.get('feeds') as EventEmitter
    const validationSystem = this.components.get('validation') as EventEmitter

    // Global network events
    globalNetwork.on(
      'threat:detected',
      async (event: Record<string, unknown>) => {
        await this.handleThreatDetected(event)
      },
    )

    globalNetwork.on(
      'threat:correlated',
      async (event: Record<string, unknown>) => {
        await this.handleThreatCorrelated(event)
      },
    )

    // Edge detection events
    edgeDetection.on(
      'threat:detected',
      async (event: Record<string, unknown>) => {
        await this.handleEdgeThreatDetected(event)
      },
    )

    // Feed integration events
    feedIntegration.on(
      'feed:sync_completed',
      async (event: Record<string, unknown>) => {
        await this.handleFeedSyncCompleted(event)
      },
    )

    // Validation events
    validationSystem.on(
      'validation:completed',
      async (event: Record<string, unknown>) => {
        await this.handleValidationCompleted(event)
      },
    )

    // Hunting events
    huntingSystem.on(
      'hunt:completed',
      async (event: Record<string, unknown>) => {
        await this.handleHuntCompleted(event)
      },
    )

    // Response orchestrator events
    responseOrchestrator.on(
      'response:triggered',
      async (event: Record<string, unknown>) => {
        await this.handleResponseTriggered(event)
      },
    )
  }

  /**
   * Configure data flow between components
   */
  private async configureDataFlow(): Promise<void> {
    // Set up data pipelines between components
    // This would include configuring data sources, sinks, and transformation pipelines
    logger.info('Data flow configuration completed')
  }

  /**
   * Handle threat detected event
   */
  private async handleThreatDetected(
    event: Record<string, unknown>,
  ): Promise<void> {
    try {
      const tid = event['threat_id'] as string | undefined
      logger.info('Handling threat detected event', {
        threat_id: tid,
      })

      // Update metrics
      this.metrics.totalThreatsProcessed++
      const severity = event['severity'] as string
      this.metrics.threatsBySeverity[severity] =
        (this.metrics.threatsBySeverity[severity] ?? 0) + 1

      // Emit system event
      this.emit('threat:detected', {
        type: 'threat_detected',
        timestamp: new Date(),
        severity,
        data: event,
        source: 'global_network',
      })

      // Trigger correlation analysis
      const correlationEngine = this.components.get(
        'correlation',
      ) as ComponentMethods
      if (correlationEngine) {
        await correlationEngine.correlateThreat(tid!)
      }

      // Validate threat data
      const validationSystem = this.components.get(
        'validation',
      ) as ComponentMethods
      if (validationSystem) {
        await validationSystem.requestValidation(
          {
            id: tid,
            type: 'indicator',
            data: event,
            source: 'global_network',
            confidence: (event['confidence'] as number) ?? 0.5,
            timestamp: new Date(),
            metadata: {},
          },
          ['accuracy', 'completeness', 'reliability'],
        )
      }
    } catch (error: unknown) {
      logger.error('Error handling threat detected event', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Handle edge threat detected event
   */
  private async handleEdgeThreatDetected(
    event: Record<string, unknown>,
  ): Promise<void> {
    try {
      logger.info('Handling edge threat detected event', {
        threat_id: event['threat_id'],
      })

      // Forward to global network for processing
      const globalNetwork = this.components.get('global') as ComponentMethods
      if (globalNetwork) {
        await globalNetwork.processThreat(event)
      }
    } catch (error: unknown) {
      logger.error('Error handling edge threat detected event', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Handle threat correlated event
   */
  private async handleThreatCorrelated(
    event: Record<string, unknown>,
  ): Promise<void> {
    try {
      logger.info('Handling threat correlated event', {
        correlation_id: event['correlation_id'],
      })

      // Trigger response orchestration if correlation confidence is high
      if ((event['confidence'] as number) > 0.8) {
        const responseOrchestrator = this.components.get(
          'response',
        ) as ComponentMethods
        if (responseOrchestrator) {
          await responseOrchestrator.orchestrateResponse({
            threat_id: event['threat_id'],
            severity: event['severity'],
            confidence: event['confidence'],
            affected_regions: event['affected_regions'],
            correlation_data: event,
          })
        }
      }

      // Emit system event
      this.emit('threat:correlated', {
        type: 'threat_correlated',
        timestamp: new Date(),
        severity: event['severity'],
        data: event,
        source: 'correlation_engine',
      })
    } catch (error: unknown) {
      logger.error('Error handling threat correlated event', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Handle feed sync completed event
   */
  private async handleFeedSyncCompleted(
    event: Record<string, unknown>,
  ): Promise<void> {
    try {
      logger.info('Handling feed sync completed event', {
        feed_id: event['feed_id'],
        indicators_processed: event['indicators_processed'],
      })

      // Process new indicators through the pipeline
      const feedIntegration = this.components.get('feeds') as ComponentMethods
      if (feedIntegration && (event['indicators_processed'] as number) > 0) {
        const indicators = (await feedIntegration.getThreatIndicators({
          feed_id: event['feed_id'],
          limit: 100,
        })) as Record<string, unknown>[]

        for (const indicator of indicators) {
          // Validate new indicators
          const validationSystem = this.components.get(
            'validation',
          ) as ComponentMethods
          if (validationSystem) {
            await validationSystem.requestValidation(
              {
                id: indicator['id'],
                type: indicator['type'],
                data: indicator,
                source: indicator['feed_id'],
                confidence: indicator['confidence'],
                timestamp: new Date(),
                metadata: indicator['attributes'],
              },
              ['accuracy', 'reliability'],
            )
          }
        }
      }
    } catch (error: unknown) {
      logger.error('Error handling feed sync completed event', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Handle validation completed event
   */
  private async handleValidationCompleted(
    event: Record<string, unknown>,
  ): Promise<void> {
    try {
      logger.info('Handling validation completed event', {
        validation_id: event['validation_id'],
        status: event['status'],
      })

      // If validation passed, proceed with threat processing
      if (event['status'] === 'validated' && (event['score'] as number) > 0.7) {
        const globalNetwork = this.components.get('global') as ComponentMethods
        if (globalNetwork) {
          await globalNetwork.processValidatedThreat(
            event['threat_id'] as string,
          )
        }
      }

      // Update metrics
      if (event['status'] === 'validated') {
        this.metrics.detectionAccuracy =
          (this.metrics.detectionAccuracy * this.metrics.totalThreatsProcessed +
            1) /
          (this.metrics.totalThreatsProcessed + 1)
      }
    } catch (error: unknown) {
      logger.error('Error handling validation completed event', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Handle hunt completed event
   */
  private async handleHuntCompleted(
    event: Record<string, unknown>,
  ): Promise<void> {
    try {
      logger.info('Handling hunt completed event', {
        hunt_id: event['hunt_id'],
        findings_count: event['findings_count'],
      })

      if ((event['findings_count'] as number) > 0) {
        const huntingSystem = this.components.get('hunting') as ComponentMethods
        if (huntingSystem) {
          const results = (await huntingSystem.getHuntResults(
            event['hunt_id'] as string,
            10,
          )) as Record<string, unknown>[]

          for (const result of results) {
            const findings = result['findings'] as Record<string, unknown>[]
            for (const finding of findings) {
              const threatData = {
                id: finding['id'],
                type: finding['type'],
                data: finding,
                source: 'threat_hunt',
                confidence: finding['confidence'],
                timestamp: finding['timestamp'],
                metadata: {
                  hunt_id: event['hunt_id'],
                  finding_type: finding['type'],
                },
              }

              const globalNetwork = this.components.get(
                'global',
              ) as ComponentMethods
              if (globalNetwork) {
                await globalNetwork.processThreat(threatData)
              }
            }
          }
        }
      }
    } catch (error: unknown) {
      logger.error('Error handling hunt completed event', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Handle response triggered event
   */
  private async handleResponseTriggered(
    event: Record<string, unknown>,
  ): Promise<void> {
    try {
      logger.info('Handling response triggered event', {
        response_id: event['response_id'],
        action: event['action'],
      })

      // Update response time metrics
      if (event['response_time']) {
        this.metrics.responseTime = event['response_time'] as number
      }

      // Emit system alert
      this.emit('system_alert', {
        type: 'response_triggered',
        timestamp: new Date(),
        severity: (event['severity'] as string) ?? 'medium',
        data: event,
        source: 'response_orchestrator',
      })
    } catch (error: unknown) {
      logger.error('Error handling response triggered event', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    // Monitor component health
    setInterval(async () => {
      await this.checkSystemHealth()
    }, 30000) // Check every 30 seconds

    // Update metrics
    setInterval(async () => {
      await this.updateMetrics()
    }, 60000) // Update every minute
  }

  /**
   * Check system health
   */
  private async checkSystemHealth(): Promise<void> {
    try {
      const healthStatus: Record<string, 'up' | 'down' | 'warning'> = {}

      for (const [name, component] of this.components) {
        try {
          if ((component as { isReady: boolean })?.isReady) {
            healthStatus[name] = 'up'
          } else {
            healthStatus[name] = 'warning'
          }
        } catch (error: unknown) {
          healthStatus[name] = 'down'
          logger.error(`Component ${name} health check failed`, {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      const downComponents = Object.values(healthStatus).filter(
        (status) => status === 'down',
      ).length
      const warningComponents = Object.values(healthStatus).filter(
        (status) => status === 'warning',
      ).length

      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
      if (downComponents > 0) {
        overallStatus = 'unhealthy'
      } else if (warningComponents > 0) {
        overallStatus = 'degraded'
      }

      this.metrics.systemHealth = {
        status: overallStatus,
        components: healthStatus,
      }

      // Emit health status event
      this.emit('health_status', {
        timestamp: new Date(),
        status: overallStatus,
        components: healthStatus,
      })
    } catch (error: unknown) {
      logger.error('Error checking system health', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Update system metrics
   */
  private async updateMetrics(): Promise<void> {
    try {
      // Calculate detection accuracy
      const validationSystem = this.components.get(
        'validation',
      ) as ComponentMethods
      if (validationSystem) {
        const stats = (await validationSystem.getValidationStats()) as Record<
          string,
          unknown
        >
        this.metrics.detectionAccuracy = stats['average_score'] as number
        this.metrics.falsePositiveRate =
          (stats['rejected_threats'] as number) /
          Math.max(1, stats['total_validations'] as number)
      }

      // Emit metrics update
      this.emit('metrics_updated', {
        timestamp: new Date(),
        metrics: this.metrics,
      })
    } catch (error: unknown) {
      logger.error('Error updating metrics', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Process threat through the complete pipeline
   */
  async processThreat(threatData: Record<string, unknown>): Promise<{
    threat_id: string
    status: string
    pipeline_results: Record<string, unknown>
  }> {
    if (!this.isInitialized) {
      throw new Error('Threat Intelligence Network not initialized')
    }

    try {
      const threatId = (threatData['id'] as string) ?? `threat-${Date.now()}`
      const pipelineResults: Record<string, unknown> = {}

      logger.info('Processing threat through complete pipeline', {
        threat_id: threatId,
      })

      const edgeDetection = this.components.get('edge') as ComponentMethods
      if (edgeDetection && threatData['source'] === 'edge') {
        pipelineResults['edge'] = await edgeDetection.analyzeThreat(threatData)
      }

      const globalNetwork = this.components.get('global') as ComponentMethods
      if (globalNetwork) {
        pipelineResults['global'] =
          await globalNetwork.processThreat(threatData)
      }

      const correlationEngine = this.components.get(
        'correlation',
      ) as ComponentMethods
      if (correlationEngine) {
        pipelineResults['correlation'] =
          await correlationEngine.correlateThreat(threatId)
      }

      const validationSystem = this.components.get(
        'validation',
      ) as ComponentMethods
      if (validationSystem) {
        const validationId = (await validationSystem.requestValidation(
          {
            id: threatId,
            type: (threatData['type'] as string) ?? 'unknown',
            data: threatData,
            source: (threatData['source'] as string) ?? 'unknown',
            confidence: (threatData['confidence'] as number) ?? 0.5,
            timestamp: new Date(),
            metadata: (threatData['metadata'] as Record<string, unknown>) ?? {},
          },
          ['accuracy', 'completeness', 'reliability'],
        )) as string
        pipelineResults['validation'] = {
          validation_id: validationId,
          status: 'pending',
        }
      }

      if (
        (threatData['confidence'] as number) > 0.8 ||
        (
          (pipelineResults as Record<string, unknown>)['correlation'] as Record<
            string,
            unknown
          >
        )?.['confidence'] > 0.8
      ) {
        const responseOrchestrator = this.components.get(
          'response',
        ) as ComponentMethods
        if (responseOrchestrator) {
          pipelineResults['response'] =
            await responseOrchestrator.orchestrateResponse({
              threat_id: threatId,
              severity: (threatData['severity'] as string) ?? 'medium',
              confidence: (threatData['confidence'] as number) ?? 0.5,
              affected_regions: (threatData['regions'] as string[]) ?? [
                'global',
              ],
              correlation_data: pipelineResults['correlation'],
            })
        }
      }

      return {
        threat_id: threatId,
        status: 'processing',
        pipeline_results: pipelineResults,
      }
    } catch (error: unknown) {
      logger.error('Error processing threat through pipeline', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Get threat intelligence metrics
   */
  getMetrics(): ThreatIntelligenceMetrics {
    return { ...this.metrics }
  }

  /**
   * Get system health status
   */
  getSystemHealth(): ThreatIntelligenceMetrics['systemHealth'] {
    return { ...this.metrics.systemHealth }
  }

  /**
   * Get component by name
   */
  getComponent(name: string): unknown | undefined {
    return this.components.get(name)
  }

  /**
   * Get all components
   */
  getComponents(): Map<string, unknown> {
    return new Map(this.components)
  }

  /**
   * Shutdown the threat intelligence network
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Threat Intelligence Network')

      // Shutdown components in reverse order
      const shutdownOrder = [
        'validation',
        'feeds',
        'hunting',
        'response',
        'correlation',
        'edge',
        'global',
        'database',
      ]

      for (const componentName of shutdownOrder) {
        const component = this.components.get(componentName)
        const comp = component as { shutdown?: () => Promise<void> } | undefined
        if (comp?.shutdown) {
          logger.info(`Shutting down ${componentName} component`)
          await comp.shutdown()
        }
      }

      this.components.clear()
      this.isInitialized = false

      this.emit('shutdown', { timestamp: new Date() })
      logger.info('Threat Intelligence Network shutdown completed')
    } catch (error: unknown) {
      logger.error('Error during shutdown', {
        error: error instanceof Error ? error.message : String(error),
      })
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
  get config(): ThreatIntelligenceNetworkConfig {
    return this.networkConfig
  }
}

// Export individual components for direct access
export {
  GlobalThreatIntelligenceNetwork,
  EdgeThreatDetectionSystem,
  ThreatCorrelationEngine,
  ThreatIntelligenceDatabase,
  AutomatedThreatResponseOrchestrator,
  ThreatHuntingSystem,
  ExternalThreatFeedIntegration,
  ThreatValidationSystem,
}

// Export types - explicitly re-export each type to avoid ambiguous re-export errors.
// Types like ThreatIndicator exist in 5 modules, ExecutionLogEntry in 2, and ThreatData in 2,
// so export * cannot be used safely. Each type is listed from its canonical module.
export type {
  ThreatIntelligence,
  ThreatAttribution,
  ThreatSharingConfig,
  GlobalThreatNetworkConfig,
} from './GlobalThreatIntelligenceNetwork'
export type {
  EdgeDetectionConfig,
  ModelConfig,
  ThreatDetection,
  DetectionInput,
  ModelResult,
  BiasAnalysis,
  DetectionResult,
} from './EdgeThreatDetectionSystem'
export type {
  ThreatCorrelation,
  CorrelatedThreat,
  ThreatPattern,
  CorrelationAnalysis,
  MLInsight,
  CorrelationEngineConfig,
  AlgorithmConfig,
  TimeGroup,
  SpatialGroup,
  BehavioralGroup,
  AttributionGroup,
  SpatialCorrelationResult,
} from './ThreatCorrelationEngine'
export type {
  STIXObject,
  STIXIndicator,
  STIXMalware,
  STIXThreatActor,
  STIXAttackPattern,
  STIXVulnerability,
  KillChainPhase,
  TAXIICollection,
  TAXIIManifestEntry,
  ThreatIntelligenceDatabaseConfig,
  DatabaseThreatIntelligence,
  DatabaseCollection,
} from './ThreatIntelligenceDatabase'
export type {
  ThreatResponse,
  ResponseTarget,
  ResponseAction,
  ResponseCondition,
  ExecutionLogEntry,
  ResponseResult,
  ResponseOrchestratorConfig,
  ResponseStrategy,
  EscalationRule,
} from './AutomatedThreatResponseOrchestrator'
export type {
  ThreatHunt,
  HuntScope,
  HuntQuery,
  HuntSchedule,
  HuntResult,
  HuntFinding,
  Evidence,
  HuntStatistics,
  FalsePositive,
  ThreatHuntingSystemConfig,
  HuntTemplate,
} from './ThreatHuntingSystem'
export type {
  ThreatFeed,
  FeedAuthentication,
  FeedConfiguration,
  FeedFilters,
  DataTransformation,
  DeduplicationRule,
  RateLimitConfig,
  DataQualityMetrics,
  ThreatRelationship,
  FeedSyncResult,
  SyncError,
  SyncPerformanceMetrics,
  ExternalThreatFeedIntegrationConfig,
  OAuth2Credentials,
} from './ExternalThreatFeedIntegration'
export type {
  ThreatValidation,
  ValidationCriteria,
  ValidationRule,
  ValidationResult,
  ValidationFinding,
  ValidationEvidence,
  ValidationHistoryEntry,
  ThreatValidationSystemConfig,
  QualityGate,
  NotificationConfig,
} from './ThreatValidationSystem'
export * from './config'

export default ThreatIntelligenceNetwork
