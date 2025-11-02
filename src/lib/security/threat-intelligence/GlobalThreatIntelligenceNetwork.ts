/**
 * Global Threat Intelligence Network
 * Comprehensive threat intelligence sharing system with real-time propagation
 * Integrates with Pixelated's multi-region infrastructure
 */

import { EventEmitter } from 'events'
import { Redis } from 'ioredis'
import { MongoClient, Db, Collection } from 'mongodb'

import { logger } from '../../logger'

import { encrypt, decrypt } from '../encryption'
import { auditLog } from '../audit-logging'

// Types
export interface ThreatIntelligence {
  id: string
  type:
    | 'malware'
    | 'phishing'
    | 'ddos'
    | 'data_breach'
    | 'insider_threat'
    | 'ai_bias'
    | 'privacy_violation'
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number // 0-100
  source: string
  region: string
  timestamp: Date
  data: Record<string, any>
  indicators: ThreatIndicator[]
  attribution?: ThreatAttribution
  validation_status: 'pending' | 'validated' | 'invalidated'
  sharing_status: 'private' | 'regional' | 'global'
}

export interface ThreatIndicator {
  type: 'ip' | 'domain' | 'hash' | 'url' | 'email' | 'file' | 'behavior'
  value: string
  confidence: number
  metadata?: Record<string, any>
}

export interface ThreatAttribution {
  actor?: string
  campaign?: string
  motivation?: string
  sophistication?: string
  region?: string
}

export interface ThreatSharingConfig {
  regions: string[]
  sharing_level: 'none' | 'regional' | 'global'
  filters: {
    min_severity: string
    min_confidence: number
    threat_types: string[]
  }
  propagation_delay: number // milliseconds
  batch_size: number
  retry_attempts: number
}

export interface GlobalThreatNetworkConfig {
  redis: {
    url: string
    cluster?: boolean
    password?: string
  }
  mongodb: {
    url: string
    database: string
  }
  jwt: {
    secret: string
    expiresIn: string
  }
  regions: string[]
  sharing: ThreatSharingConfig
  encryption: {
    enabled: boolean
    key: string
  }
  rate_limiting: {
    windowMs: number
    maxRequests: number
  }
}

export class GlobalThreatIntelligenceNetwork extends EventEmitter {
  private redis: Redis
  private mongoClient: MongoClient
  private db: Db
  private threatsCollection: Collection<ThreatIntelligence>
  private sharingCollection: Collection<any>
  private config: GlobalThreatNetworkConfig
  private isInitialized = false
  private propagationInterval: NodeJS.Timeout | null = null
  private healthCheckInterval: NodeJS.Timeout | null = null
  private region: string

  constructor(config: GlobalThreatNetworkConfig, region: string = 'us-east-1') {
    super()
    this.config = config
    this.region = region
    this.setMaxListeners(0) // Unlimited listeners for scalability
  }

  /**
   * Initialize the global threat intelligence network
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Global Threat Intelligence Network', {
        region: this.region,
      })

      // Initialize Redis connection
      this.redis = new Redis(this.config.redis.url, {
        password: this.config.redis.password,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableOfflineQueue: false,
      })

      // Initialize MongoDB connection
      this.mongoClient = new MongoClient(this.config.mongodb.url)
      await this.mongoClient.connect()
      this.db = this.mongoClient.db(this.config.mongodb.database)

      // Initialize collections
      this.threatsCollection = this.db.collection<ThreatIntelligence>(
        'threat_intelligence',
      )
      this.sharingCollection = this.db.collection('threat_sharing_log')

      // Create indexes for performance
      await this.createIndexes()

      // Set up Redis pub/sub for real-time sharing
      await this.setupRedisPubSub()

      // Start background processes
      this.startPropagationService()
      this.startHealthCheckService()

      this.isInitialized = true
      logger.info(
        'Global Threat Intelligence Network initialized successfully',
        { region: this.region },
      )

      this.emit('initialized', { region: this.region, timestamp: new Date() })
    } catch (error) {
      logger.error('Failed to initialize Global Threat Intelligence Network', {
        error: error.message,
        region: this.region,
      })
      throw new Error(
        `Failed to initialize threat intelligence network: ${error.message}`,
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
        // Threat intelligence indexes
        this.threatsCollection.createIndex({ id: 1 }, { unique: true }),
        this.threatsCollection.createIndex({ type: 1, severity: 1 }),
        this.threatsCollection.createIndex({ region: 1, timestamp: -1 }),
        this.threatsCollection.createIndex({ 'indicators.value': 1 }),
        this.threatsCollection.createIndex({ validation_status: 1 }),
        this.threatsCollection.createIndex({ sharing_status: 1 }),
        this.threatsCollection.createIndex(
          { timestamp: -1 },
          { expireAfterSeconds: 7776000 },
        ), // 90 days TTL

        // Sharing log indexes
        this.sharingCollection.createIndex(
          { threat_id: 1, region: 1 },
          { unique: true },
        ),
        this.sharingCollection.createIndex({ timestamp: -1 }),
        this.sharingCollection.createIndex({ status: 1 }),
      ])

      logger.info('Database indexes created successfully', {
        region: this.region,
      })
    } catch (error) {
      logger.error('Failed to create database indexes', {
        error: error.message,
        region: this.region,
      })
      throw error
    }
  }

  /**
   * Set up Redis pub/sub for real-time threat sharing
   */
  private async setupRedisPubSub(): Promise<void> {
    try {
      const subscriber = this.redis.duplicate()
      await subscriber.connect()

      // Subscribe to global threat intelligence channel
      await subscriber.subscribe('threat-intelligence-global', (message) => {
        this.handleIncomingThreat(message)
      })

      // Subscribe to regional channels
      for (const region of this.config.regions) {
        await subscriber.subscribe(
          `threat-intelligence-${region}`,
          (message) => {
            if (region !== this.region) {
              this.handleIncomingThreat(message)
            }
          },
        )
      }

      logger.info('Redis pub/sub setup completed', { region: this.region })
    } catch (error) {
      logger.error('Failed to setup Redis pub/sub', {
        error: error.message,
        region: this.region,
      })
      throw error
    }
  }

  /**
   * Handle incoming threat intelligence from other regions
   */
  private async handleIncomingThreat(message: string): Promise<void> {
    try {
      const threatData = JSON.parse(message)
      const threat: ThreatIntelligence = threatData.threat

      // Validate the threat data
      if (!this.validateThreatData(threat)) {
        logger.warn('Invalid threat data received', {
          threatId: threat.id,
          region: this.region,
        })
        return
      }

      // Check if threat should be processed based on sharing configuration
      if (!this.shouldProcessThreat(threat)) {
        logger.debug('Threat filtered out based on sharing configuration', {
          threatId: threat.id,
          region: this.region,
        })
        return
      }

      // Decrypt if necessary
      let processedThreat = threat
      if (this.config.encryption.enabled && threatData.encrypted) {
        processedThreat = await this.decryptThreat(threat)
      }

      // Store the threat in local database
      await this.storeThreat(processedThreat)

      // Emit event for further processing
      this.emit('threat:received', {
        threat: processedThreat,
        sourceRegion: threat.region,
        localRegion: this.region,
        timestamp: new Date(),
      })

      logger.info('Threat intelligence processed successfully', {
        threatId: threat.id,
        sourceRegion: threat.region,
        region: this.region,
      })
    } catch (error) {
      logger.error('Failed to handle incoming threat', {
        error: error.message,
        region: this.region,
      })
    }
  }

  /**
   * Validate threat data structure
   */
  private validateThreatData(threat: any): boolean {
    const requiredFields = [
      'id',
      'type',
      'severity',
      'confidence',
      'source',
      'region',
      'timestamp',
      'indicators',
    ]

    for (const field of requiredFields) {
      if (!threat[field]) {
        return false
      }
    }

    // Validate confidence range
    if (threat.confidence < 0 || threat.confidence > 100) {
      return false
    }

    // Validate severity
    const validSeverities = ['low', 'medium', 'high', 'critical']
    if (!validSeverities.includes(threat.severity)) {
      return false
    }

    // Validate threat types
    const validTypes = [
      'malware',
      'phishing',
      'ddos',
      'data_breach',
      'insider_threat',
      'ai_bias',
      'privacy_violation',
    ]
    if (!validTypes.includes(threat.type)) {
      return false
    }

    return true
  }

  /**
   * Check if threat should be processed based on sharing configuration
   */
  private shouldProcessThreat(threat: ThreatIntelligence): boolean {
    const config = this.config.sharing

    // Check minimum severity
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 }
    const minSeverityLevel =
      severityLevels[
        config.filters.min_severity as keyof typeof severityLevels
      ] || 1
    const threatSeverityLevel = severityLevels[threat.severity]

    if (threatSeverityLevel < minSeverityLevel) {
      return false
    }

    // Check minimum confidence
    if (threat.confidence < config.filters.min_confidence) {
      return false
    }

    // Check threat type filter
    if (
      config.filters.threat_types.length > 0 &&
      !config.filters.threat_types.includes(threat.type)
    ) {
      return false
    }

    return true
  }

  /**
   * Store threat intelligence in local database
   */
  private async storeThreat(threat: ThreatIntelligence): Promise<void> {
    try {
      const existingThreat = await this.threatsCollection.findOne({
        id: threat.id,
      })

      if (existingThreat) {
        // Update existing threat with new information
        await this.threatsCollection.updateOne(
          { id: threat.id },
          {
            $set: {
              ...threat,
              updated_at: new Date(),
            },
          },
        )
      } else {
        // Insert new threat
        await this.threatsCollection.insertOne({
          ...threat,
          created_at: new Date(),
          updated_at: new Date(),
        })
      }

      // Log the sharing activity
      await this.logSharingActivity(threat.id, threat.region, 'received')
    } catch (error) {
      logger.error('Failed to store threat', {
        error: error.message,
        threatId: threat.id,
        region: this.region,
      })
      throw error
    }
  }

  /**
   * Share threat intelligence with other regions
   */
  async shareThreat(
    threat: ThreatIntelligence,
    options?: {
      regions?: string[]
      sharingLevel?: 'regional' | 'global'
      encrypt?: boolean
    },
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Threat intelligence network not initialized')
    }

    try {
      // Validate threat data
      if (!this.validateThreatData(threat)) {
        throw new Error('Invalid threat data')
      }

      // Determine sharing scope
      const sharingLevel =
        options?.sharingLevel || this.config.sharing.sharing_level
      const targetRegions =
        options?.regions || this.getTargetRegions(sharingLevel)
      const shouldEncrypt = options?.encrypt ?? this.config.encryption.enabled

      // Prepare threat data for sharing
      let threatData = { threat, encrypted: false }

      if (shouldEncrypt) {
        threatData = {
          threat: await this.encryptThreat(threat),
          encrypted: true,
        }
      }

      // Share with target regions
      const sharingPromises = targetRegions.map(async (region) => {
        if (region === this.region) return // Don't share with self

        try {
          await this.redis.publish(
            `threat-intelligence-${region}`,
            JSON.stringify(threatData),
          )

          // Log sharing activity
          await this.logSharingActivity(threat.id, region, 'shared')

          logger.info('Threat shared successfully', {
            threatId: threat.id,
            targetRegion: region,
            sourceRegion: this.region,
          })
        } catch (error) {
          logger.error('Failed to share threat with region', {
            error: error.message,
            threatId: threat.id,
            targetRegion: region,
            sourceRegion: this.region,
          })
        }
      })

      await Promise.all(sharingPromises)

      // Emit sharing event
      this.emit('threat:shared', {
        threat,
        targetRegions,
        sharingLevel,
        timestamp: new Date(),
      })
    } catch (error) {
      logger.error('Failed to share threat', {
        error: error.message,
        threatId: threat.id,
        region: this.region,
      })
      throw error
    }
  }

  /**
   * Get target regions based on sharing level
   */
  private getTargetRegions(sharingLevel: string): string[] {
    switch (sharingLevel) {
      case 'regional': {
        // Share only with regions in the same geographic area
        const regionalGroups = {
          'us-east-1': ['us-east-1', 'us-west-2'],
          'eu-west-1': ['eu-west-1', 'eu-central-1'],
          'ap-southeast-1': ['ap-southeast-1', 'ap-northeast-1'],
        }
        return regionalGroups[this.region] || [this.region]
      }

      case 'global':
        return this.config.regions

      default:
        return []
    }
  }

  /**
   * Encrypt threat data for secure sharing
   */
  private async encryptThreat(
    threat: ThreatIntelligence,
  ): Promise<ThreatIntelligence> {
    try {
      const encryptedData = await encrypt(
        JSON.stringify(threat),
        this.config.encryption.key,
      )
      return {
        ...threat,
        data: { encrypted: encryptedData },
      } as ThreatIntelligence
    } catch (error) {
      logger.error('Failed to encrypt threat', {
        error: error.message,
        threatId: threat.id,
        region: this.region,
      })
      throw error
    }
  }

  /**
   * Decrypt threat data
   */
  private async decryptThreat(
    threat: ThreatIntelligence,
  ): Promise<ThreatIntelligence> {
    try {
      if (threat.data?.encrypted) {
        const decryptedData = await decrypt(
          threat.data.encrypted,
          this.config.encryption.key,
        )
        return JSON.parse(decryptedData)
      }
      return threat
    } catch (error) {
      logger.error('Failed to decrypt threat', {
        error: error.message,
        threatId: threat.id,
        region: this.region,
      })
      throw error
    }
  }

  /**
   * Log threat sharing activity
   */
  private async logSharingActivity(
    threatId: string,
    targetRegion: string,
    action: 'shared' | 'received',
  ): Promise<void> {
    try {
      await this.sharingCollection.insertOne({
        threat_id: threatId,
        region: targetRegion,
        action,
        timestamp: new Date(),
        local_region: this.region,
      })

      // Audit log for compliance
      await auditLog({
        action: `threat_intelligence_${action}`,
        resource: `threat:${threatId}`,
        details: { targetRegion, sourceRegion: this.region },
        userId: 'system',
        ip: 'internal',
      })
    } catch (error) {
      logger.error('Failed to log sharing activity', {
        error: error.message,
        threatId,
        region: this.region,
      })
    }
  }

  /**
   * Start the threat propagation service
   */
  private startPropagationService(): void {
    this.propagationInterval = setInterval(async () => {
      await this.propagatePendingThreats()
    }, this.config.sharing.propagation_delay)
  }

  /**
   * Propagate pending threats to other regions
   */
  private async propagatePendingThreats(): Promise<void> {
    try {
      // Get threats that need to be propagated
      const pendingThreats = await this.threatsCollection
        .find({
          region: this.region,
          sharing_status: { $in: ['regional', 'global'] },
          validation_status: 'validated',
        })
        .limit(this.config.sharing.batch_size)
        .toArray()

      for (const threat of pendingThreats) {
        await this.shareThreat(threat)
      }

      logger.debug('Threat propagation completed', {
        count: pendingThreats.length,
        region: this.region,
      })
    } catch (error) {
      logger.error('Failed to propagate threats', {
        error: error.message,
        region: this.region,
      })
    }
  }

  /**
   * Start health check service
   */
  private startHealthCheckService(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck()
    }, 30000) // Every 30 seconds
  }

  /**
   * Perform health check of the network
   */
  private async performHealthCheck(): Promise<void> {
    try {
      // Check Redis connection
      const redisHealth = await this.redis.ping()

      // Check MongoDB connection
      const mongoHealth = await this.mongoClient.db().admin().ping()

      // Check database connectivity
      const dbStats = await this.db.stats()

      const healthStatus = {
        region: this.region,
        timestamp: new Date(),
        redis: redisHealth === 'PONG',
        mongodb: !!mongoHealth,
        database: dbStats.ok === 1,
        threats_count: await this.threatsCollection.countDocuments(),
      }

      // Store health status in Redis for monitoring
      await this.redis.setex(
        `threat-intelligence-health:${this.region}`,
        300, // 5 minutes TTL
        JSON.stringify(healthStatus),
      )

      this.emit('health:check', healthStatus)
    } catch (error) {
      logger.error('Health check failed', {
        error: error.message,
        region: this.region,
      })
      this.emit('health:error', { error: error.message, region: this.region })
    }
  }

  /**
   * Get threat intelligence by ID
   */
  async getThreatById(threatId: string): Promise<ThreatIntelligence | null> {
    try {
      return await this.threatsCollection.findOne({ id: threatId })
    } catch (error) {
      logger.error('Failed to get threat by ID', {
        error: error.message,
        threatId,
        region: this.region,
      })
      throw error
    }
  }

  /**
   * Search threat intelligence
   */
  async searchThreats(query: {
    type?: string
    severity?: string
    region?: string
    indicator?: string
    startDate?: Date
    endDate?: Date
    limit?: number
  }): Promise<ThreatIntelligence[]> {
    try {
      const filter: any = {}

      if (query.type) filter.type = query.type
      if (query.severity) filter.severity = query.severity
      if (query.region) filter.region = query.region
      if (query.indicator) filter['indicators.value'] = query.indicator
      if (query.startDate || query.endDate) {
        filter.timestamp = {}
        if (query.startDate) filter.timestamp.$gte = query.startDate
        if (query.endDate) filter.timestamp.$lte = query.endDate
      }

      return await this.threatsCollection
        .find(filter)
        .sort({ timestamp: -1 })
        .limit(query.limit || 100)
        .toArray()
    } catch (error) {
      logger.error('Failed to search threats', {
        error: error.message,
        query,
        region: this.region,
      })
      throw error
    }
  }

  /**
   * Get network health status
   */
  async getNetworkHealth(): Promise<any> {
    try {
      const healthData = await this.redis.get(
        `threat-intelligence-health:${this.region}`,
      )
      return healthData ? JSON.parse(healthData) : null
    } catch (error) {
      logger.error('Failed to get network health', {
        error: error.message,
        region: this.region,
      })
      throw error
    }
  }

  /**
   * Shutdown the network gracefully
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Global Threat Intelligence Network', {
        region: this.region,
      })

      if (this.propagationInterval) {
        clearInterval(this.propagationInterval)
      }

      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval)
      }

      await this.redis.quit()
      await this.mongoClient.close()

      this.isInitialized = false
      this.emit('shutdown', { region: this.region, timestamp: new Date() })

      logger.info('Global Threat Intelligence Network shutdown completed', {
        region: this.region,
      })
    } catch (error) {
      logger.error('Error during shutdown', {
        error: error.message,
        region: this.region,
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
   * Get current region
   */
  get currentRegion(): string {
    return this.region
  }
}

export default GlobalThreatIntelligenceNetwork
