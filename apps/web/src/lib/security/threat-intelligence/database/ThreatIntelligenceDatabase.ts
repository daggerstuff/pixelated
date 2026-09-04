/**
 * Threat Intelligence Database with STIX/TAXII Support
 * Provides comprehensive database operations for threat intelligence with STIX/TAXII compliance
 */

import { EventEmitter } from 'events'

import Redis from 'ioredis'
import { MongoClient, Db } from 'mongodb'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import {
  validateThreatData,
  buildSearchQuery,
  storeThreatIndicators,
  initializeTAXIICollections,
  checkMongoDBHealth,
  checkRedisHealth,
  cacheThreatIntelligence,
} from './ThreatIntelligenceDatabase.utils'
export type {
  SearchQuery,
  ThreatIntelligenceDatabase,
  HealthStatus,
  DatabaseStats,
  STIXObject,
  TAXIICollection,
} from './ThreatIntelligenceDatabase.types'
import {
  DatabaseConfig,
  GlobalThreatIntelligence,
  STIXConfig,
  TAXIIConfig,
  CorrelationData,
  PaginationParams,
  ApiResponse,
} from '../global/types'

const logger = createBuildSafeLogger('threat-intelligence-database')

export class ThreatIntelligenceDatabaseCore
  extends EventEmitter
  implements ThreatIntelligenceDatabase
{
  private mongoClient!: MongoClient
  private db!: Db
  private redis!: Redis
  private readonly stixConfig: STIXConfig
  private readonly taxiiConfig: TAXIIConfig

  constructor(private readonly config: DatabaseConfig) {
    super()
    this.stixConfig = config.stixSupport
    this.taxiiConfig = config.taxiiSupport
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Threat Intelligence Database')

      // Initialize MongoDB connection
      await this.initializeMongoDB()

      // Initialize Redis connection
      await this.initializeRedis()

      // Create database indexes
      await this.createIndexes()

      // Initialize STIX/TAXII collections if enabled
      if (this.stixConfig.enabled) {
        await this.initializeSTIXCollections()
      }

      if (this.taxiiConfig.enabled) {
        await initializeTAXIICollections(this.db)
      }

      // Start database maintenance tasks
      await this.startMaintenanceTasks()

      this.emit('database_initialized')
      logger.info('Threat Intelligence Database initialized successfully')
    } catch (error: unknown) {
      logger.error('Failed to initialize Threat Intelligence Database:', {
        error,
      })
      this.emit('initialization_error', { error })
      throw error
    }
  }

  private async initializeMongoDB(): Promise<void> {
    try {
      this.mongoClient = new MongoClient(this.config.primary.host, {
        auth: {
          username: this.config.primary.username,
          password: this.config.primary.password,
        },
        ssl: this.config.primary.ssl,
        maxPoolSize: this.config.primary.connectionPool.max,
        minPoolSize: this.config.primary.connectionPool.min,
        maxIdleTimeMS: this.config.primary.connectionPool.idleTimeout,
      })

      await this.mongoClient.connect()
      this.db = this.mongoClient.db(this.config.primary.database)

      logger.info('MongoDB connection established')
    } catch (error: unknown) {
      logger.error('Failed to connect to MongoDB:', { error })
      throw new Error('MongoDB connection failed', { cause: error })
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      const redisHost = process.env['REDIS_HOST'] ?? 'localhost'
      const redisPort = process.env['REDIS_PORT'] ?? '6379'
      const redisPassword = process.env['REDIS_PASSWORD']
      const redisUrl = redisPassword
        ? `redis://:${redisPassword}@${redisHost}:${redisPort}/1`
        : `redis://${redisHost}:${redisPort}/1`
      this.redis = new Redis(redisUrl)

      await this.redis.ping()
      logger.info(
        'Redis connection established for threat intelligence database',
      )
    } catch (error: unknown) {
      logger.error('Failed to connect to Redis:', { error })
      throw new Error('Redis connection failed', { cause: error })
    }
  }

  private async createIndexes(): Promise<void> {
    try {
      // Global threat intelligence indexes
      const threatsCollection = this.db.collection('global_threat_intelligence')
      await threatsCollection.createIndex({ threatId: 1 }, { unique: true })
      await threatsCollection.createIndex(
        { intelligenceId: 1 },
        { unique: true },
      )
      await threatsCollection.createIndex(
        { globalThreatId: 1 },
        { unique: true },
      )
      await threatsCollection.createIndex({ regions: 1 })
      await threatsCollection.createIndex({ severity: 1 })
      await threatsCollection.createIndex({ confidence: 1 })
      await threatsCollection.createIndex({ firstSeen: 1 })
      await threatsCollection.createIndex({ lastSeen: 1 })
      await threatsCollection.createIndex({
        'indicators.indicatorType': 1,
        'indicators.value': 1,
      })

      // Correlation data indexes
      const correlationsCollection = this.db.collection('correlation_data')
      await correlationsCollection.createIndex(
        { correlationId: 1 },
        { unique: true },
      )
      await correlationsCollection.createIndex({ correlatedThreats: 1 })
      await correlationsCollection.createIndex({ correlationStrength: 1 })
      await correlationsCollection.createIndex({ correlationType: 1 })
      await correlationsCollection.createIndex({ timestamp: 1 })

      // Validation status indexes
      const validationCollection = this.db.collection('validation_status')
      await validationCollection.createIndex(
        { validationId: 1 },
        { unique: true },
      )
      await validationCollection.createIndex({ status: 1 })
      await validationCollection.createIndex({ validationDate: 1 })

      logger.info('Database indexes created successfully')
    } catch (error: unknown) {
      logger.error('Failed to create database indexes:', { error })
      throw error
    }
  }

  private async initializeSTIXCollections(): Promise<void> {
    try {
      // Create collections for different STIX object types
      const stixObjectTypes = this.stixConfig.objects

      for (const objectType of stixObjectTypes) {
        const collectionName = `stix_${objectType.toLowerCase()}`
        const collection = this.db.collection(collectionName)

        // Create STIX-specific indexes
        await collection.createIndex({ id: 1 }, { unique: true })
        await collection.createIndex({ type: 1 })
        await collection.createIndex({ created: 1 })
        await collection.createIndex({ modified: 1 })
        await collection.createIndex({ labels: 1 })

        logger.info(`STIX collection initialized: ${collectionName}`)
      }

      logger.info('STIX collections initialized successfully')
    } catch (error: unknown) {
      logger.error('Failed to initialize STIX collections:', { error })
      throw error
    }
  }


  private async startMaintenanceTasks(): Promise<void> {
    // Start periodic maintenance tasks
    setInterval(async () => {
      try {
        await this.performDatabaseMaintenance()
      } catch (error: unknown) {
        logger.error('Database maintenance error:', { error })
      }
    }, 3600000) // Every hour

    // Start cache cleanup
    setInterval(async () => {
      try {
        await this.cleanupExpiredCache()
      } catch (error: unknown) {
        logger.error('Cache cleanup error:', { error })
      }
    }, 1800000) // Every 30 minutes
  }

  async storeThreatIntelligence(
    threat: GlobalThreatIntelligence,
  ): Promise<void> {
    try {
      logger.info('Storing threat intelligence', {
        threatId: threat.threatId,
        intelligenceId: threat.intelligenceId,
      })

      // Validate threat data
      validateThreatData(threat)

      // Store in main collection
      const threatsCollection = this.db.collection('global_threat_intelligence')
      await threatsCollection.replaceOne(
        { intelligenceId: threat.intelligenceId },
        threat,
        { upsert: true },
      )

      // Store indicators separately for faster queries
      await storeThreatIndicators(this.db, threat)

      // Update STIX objects if enabled
      if (this.stixConfig.enabled) {
        await this.updateSTIXObjects(threat)
      }

      // Cache for real-time access
      await cacheThreatIntelligence(this.redis, threat)

      this.emit('threat_stored', {
        threatId: threat.threatId,
        intelligenceId: threat.intelligenceId,
      })
    } catch (error: unknown) {
      logger.error('Failed to store threat intelligence:', { error })
      this.emit('storage_error', { error, threatId: threat.threatId })
      throw error
    }
  }



  private async updateSTIXObjects(
    threat: GlobalThreatIntelligence,
  ): Promise<void> {
    try {
      // Convert threat intelligence to STIX format
      const stixObjects = this.convertToSTIXFormat(threat)

      for (const stixObject of stixObjects) {
        const collectionName = `stix_${stixObject.type.toLowerCase()}`
        const collection = this.db.collection(collectionName)

        await collection.replaceOne({ id: stixObject.id }, stixObject, {
          upsert: true,
        })
      }
    } catch (error: unknown) {
      logger.error('Failed to update STIX objects:', { error })
      throw error
    }
  }

  private convertToSTIXFormat(threat: GlobalThreatIntelligence): STIXObject[] {
    const stixObjects: STIXObject[] = []

    // Create STIX Indicator objects for each threat indicator
    for (const indicator of threat.indicators) {
      const indicatorObject: STIXObject = {
        id: `indicator--${indicator.indicatorId}`,
        type: 'indicator',
        spec_version: this.stixConfig.version,
        created: indicator.firstSeen,
        modified: indicator.lastSeen,
        created_by_ref: 'threat-intelligence-system',
        labels: [threat.severity, indicator.indicatorType],
        name: `${indicator.indicatorType} Indicator`,
        description: `Threat indicator for ${threat.threatId}`,
        pattern: `[${indicator.indicatorType} = '${indicator.value}']`,
        valid_from: indicator.firstSeen,
        valid_until:
          indicator.expirationDate ??
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        confidence: Math.round(indicator.confidence * 100),
      }

      stixObjects.push(indicatorObject)
    }

    // Create STIX Malware object if applicable
    if (threat.attribution?.family) {
      const malwareObject: STIXObject = {
        id: `malware--${threat.globalThreatId}`,
        type: 'malware',
        spec_version: this.stixConfig.version,
        created: threat.firstSeen,
        modified: threat.lastSeen,
        created_by_ref: 'threat-intelligence-system',
        name: threat.attribution.family,
        labels: [threat.severity, 'threat-family'],
        description: `Malware family associated with threat ${threat.threatId}`,
      }

      stixObjects.push(malwareObject)
    }

    // Create STIX Threat Actor object if applicable
    if (threat.attribution?.actor) {
      const threatActorObject: STIXObject = {
        id: `threat-actor--${threat.attribution.actor.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'threat-actor',
        spec_version: this.stixConfig.version,
        created: threat.firstSeen,
        modified: threat.lastSeen,
        created_by_ref: 'threat-intelligence-system',
        name: threat.attribution.actor,
        labels: [threat.severity, 'threat-actor'],
        description: `Threat actor associated with threat ${threat.threatId}`,
      }

      stixObjects.push(threatActorObject)
    }

    return stixObjects
  }


  async updateThreatIntelligence(
    threat: GlobalThreatIntelligence,
  ): Promise<void> {
    try {
      logger.info('Updating threat intelligence', {
        threatId: threat.threatId,
        intelligenceId: threat.intelligenceId,
      })

      // Validate threat data
      validateThreatData(threat)

      // Update in main collection
      const threatsCollection = this.db.collection('global_threat_intelligence')
      const result = await threatsCollection.updateOne(
        { intelligenceId: threat.intelligenceId },
        { $set: threat },
      )

      if (result.matchedCount === 0) {
        throw new Error(
          `Threat intelligence not found: ${threat.intelligenceId}`,
        )
      }

      // Update indicators
      await storeThreatIndicators(this.db, threat)

      // Update STIX objects if enabled
      if (this.stixConfig.enabled) {
        await this.updateSTIXObjects(threat)
      }

      // Update cache
      await cacheThreatIntelligence(this.redis, threat)

      this.emit('threat_updated', {
        threatId: threat.threatId,
        intelligenceId: threat.intelligenceId,
      })
    } catch (error: unknown) {
      logger.error('Failed to update threat intelligence:', { error })
      this.emit('update_error', { error, threatId: threat.threatId })
      throw error
    }
  }

  async getThreatById(
    threatId: string,
  ): Promise<GlobalThreatIntelligence | null> {
    try {
      // Check cache first
      const cacheKey = `threat:${threatId}`
      const cached = await this.redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached) as GlobalThreatIntelligence
      }

      // Query database
      const threatsCollection = this.db.collection('global_threat_intelligence')
      const threat = await threatsCollection.findOne<GlobalThreatIntelligence>({
        threatId,
      })

      // Cache the result
      if (threat) {
        await this.redis.setex(cacheKey, 3600, JSON.stringify(threat))
      }

      return threat
    } catch (error: unknown) {
      logger.error('Failed to get threat by ID:', { error, threatId })
      throw error
    }
  }

  async getThreatByIntelligenceId(
    intelligenceId: string,
  ): Promise<GlobalThreatIntelligence | null> {
    try {
      // Check cache first
      const cacheKey = `intelligence:${intelligenceId}`
      const cached = await this.redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached) as GlobalThreatIntelligence
      }

      // Query database
      const threatsCollection = this.db.collection('global_threat_intelligence')
      const threat = await threatsCollection.findOne<GlobalThreatIntelligence>({
        intelligenceId,
      })

      // Cache the result
      if (threat) {
        await this.redis.setex(cacheKey, 3600, JSON.stringify(threat))
      }

      return threat
    } catch (error: unknown) {
      logger.error('Failed to get threat by intelligence ID:', {
        error,
        intelligenceId,
      })
      throw error
    }
  }

  async getThreatByIndicator(
    indicatorType: string,
    indicatorValue: string,
  ): Promise<GlobalThreatIntelligence | null> {
    try {
      // First find the indicator
      const indicatorsCollection = this.db.collection('threat_indicators')
      const indicator = await indicatorsCollection.findOne<{
        threatId: string
      }>({
        indicatorType,
        value: indicatorValue,
      })

      if (!indicator) {
        return null
      }

      // Then get the associated threat
      return await this.getThreatById(indicator.threatId)
    } catch (error: unknown) {
      logger.error('Failed to get threat by indicator:', {
        error,
        indicatorType,
        indicatorValue,
      })
      throw error
    }
  }

  async getThreatsByRegion(region?: string): Promise<Record<string, number>> {
    try {
      const threatsCollection = this.db.collection('global_threat_intelligence')
      const pipeline: Record<string, unknown>[] = []

      if (region) {
        pipeline.push({ $match: { regions: region } })
      }

      pipeline.push(
        { $unwind: '$regions' },
        { $group: { _id: '$regions', count: { $sum: 1 } } },
        { $project: { region: '$_id', count: 1, _id: 0 } },
      )

      const results = await threatsCollection
        .aggregate<{ region: string; count: number }>(pipeline)
        .toArray()

      const threatsByRegion: Record<string, number> = {}
      for (const result of results) {
        threatsByRegion[result.region] = result.count
      }

      return threatsByRegion
    } catch (error: unknown) {
      logger.error('Failed to get threats by region:', { error, region })
      throw error
    }
  }

  async getThreatsBySeverity(region?: string): Promise<Record<string, number>> {
    try {
      const threatsCollection = this.db.collection('global_threat_intelligence')
      const matchStage = region ? { $match: { regions: region } } : null

      const pipeline: Record<string, unknown>[] = [
        { $group: { _id: '$severity', count: { $sum: 1 } } },
        { $project: { severity: '$_id', count: 1, _id: 0 } },
      ]

      if (matchStage) {
        pipeline.unshift(matchStage)
      }

      const results = await threatsCollection
        .aggregate<{ severity: string; count: number }>(pipeline)
        .toArray()

      const threatsBySeverity: Record<string, number> = {}
      for (const result of results) {
        threatsBySeverity[result.severity] = result.count
      }

      return threatsBySeverity
    } catch (error: unknown) {
      logger.error('Failed to get threats by severity:', { error, region })
      throw error
    }
  }

  async getRecentThreats(
    region?: string,
    limit: number = 10,
  ): Promise<GlobalThreatIntelligence[]> {
    try {
      const threatsCollection = this.db.collection('global_threat_intelligence')
      const query = region ? { regions: region } : {}

      const threats = await threatsCollection
        .find<GlobalThreatIntelligence>(query)
        .sort({ firstSeen: -1 })
        .limit(limit)
        .toArray()

      return threats
    } catch (error: unknown) {
      logger.error('Failed to get recent threats:', { error, region, limit })
      throw error
    }
  }

  async getTotalThreatCount(region?: string): Promise<number> {
    try {
      const threatsCollection = this.db.collection('global_threat_intelligence')
      const query = region ? { regions: region } : {}

      return await threatsCollection.countDocuments(query)
    } catch (error: unknown) {
      logger.error('Failed to get total threat count:', { error, region })
      throw error
    }
  }

  async getActiveThreatCount(region?: string): Promise<number> {
    try {
      const threatsCollection = this.db.collection('global_threat_intelligence')
      const query: Record<string, unknown> = {
        $or: [
          { expirationDate: { $exists: false } },
          { expirationDate: { $gt: new Date() } },
        ],
      }

      if (region) {
        query['regions'] = region
      }

      return await threatsCollection.countDocuments(query)
    } catch (error: unknown) {
      logger.error('Failed to get active threat count:', { error, region })
      throw error
    }
  }

  async getCorrelationCount(region?: string): Promise<number> {
    try {
      const correlationsCollection = this.db.collection('correlation_data')
      let query: Record<string, unknown> = {}

      if (region) {
        // Find correlations that involve the specified region
        const threatsInRegion = await this.db
          .collection<GlobalThreatIntelligence>('global_threat_intelligence')
          .find({ regions: region })
          .project({ threatId: 1 })
          .toArray()

        const threatIds = threatsInRegion
          .map((t) => t['threatId'])
          .filter((id): id is string => typeof id === 'string')

        query = {
          correlatedThreats: { $in: threatIds },
        }
      }

      return await correlationsCollection.countDocuments(query)
    } catch (error: unknown) {
      logger.error('Failed to get correlation count:', { error, region })
      throw error
    }
  }

  async storeCorrelationData(correlation: CorrelationData): Promise<void> {
    try {
      logger.info('Storing correlation data', {
        correlationId: correlation.correlationId,
      })

      const correlationsCollection = this.db.collection('correlation_data')
      await correlationsCollection.insertOne(correlation)

      this.emit('correlation_stored', {
        correlationId: correlation.correlationId,
      })
    } catch (error: unknown) {
      logger.error('Failed to store correlation data:', { error })
      throw error
    }
  }

  async getSTIXObjects(
    objectType: string,
    filters?: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]> {
    try {
      if (!this.stixConfig.enabled) {
        throw new Error('STIX support is not enabled')
      }

      const collectionName = `stix_${objectType.toLowerCase()}`
      const collection = this.db.collection(collectionName)

      const query = filters ?? {}
      const objects = await collection.find(query).toArray()

      return objects
    } catch (error: unknown) {
      logger.error('Failed to get STIX objects:', { error, objectType })
      throw error
    }
  }

  async getTAXIICollections(): Promise<Record<string, unknown>[]> {
    try {
      if (!this.taxiiConfig.enabled) {
        throw new Error('TAXII support is not enabled')
      }

      const taxiiCollection = this.db.collection('taxii_collections')
      const collections = await taxiiCollection.find({}).toArray()

      return collections
    } catch (error: unknown) {
      logger.error('Failed to get TAXII collections:', { error })
      throw error
    }
  }

  async getTAXIIObjects(
    collectionId: string,
    filters?: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]> {
    try {
      if (!this.taxiiConfig.enabled) {
        throw new Error('TAXII support is not enabled')
      }

      // Verify collection exists
      const taxiiCollection = this.db.collection('taxii_collections')
      const collection = await taxiiCollection.findOne({ id: collectionId })

      if (!collection) {
        throw new Error(`TAXII collection not found: ${collectionId}`)
      }

      // Get objects from the collection
      const taxiiObjectsCollection = this.db.collection('taxii_objects')
      const query = { collection_id: collectionId, ...filters }
      const objects = await taxiiObjectsCollection.find(query).toArray()

      return objects
    } catch (error: unknown) {
      logger.error('Failed to get TAXII objects:', { error, collectionId })
      throw error
    }
  }

  async searchThreats(
    query: SearchQuery,
    pagination: PaginationParams,
  ): Promise<ApiResponse<GlobalThreatIntelligence[]>> {
    try {
      const threatsCollection = this.db.collection('global_threat_intelligence')

      // Build search query
      const searchQuery = buildSearchQuery(query)

      // Get total count

      // Get paginated results
      const threats = await threatsCollection
        .find<GlobalThreatIntelligence>(searchQuery)
        .sort({
          [pagination.sortBy ?? 'firstSeen']:
            pagination.sortOrder === 'desc' ? -1 : 1,
        })
        .skip((pagination.page - 1) * pagination.limit)
        .limit(pagination.limit)
        .toArray()

      return {
        success: true,
        data: threats,
        metadata: {
          timestamp: new Date(),
          requestId: `search_${Date.now()}`,
          processingTime: 0, // Will be calculated by the caller
        },
      }
    } catch (error: unknown) {
      logger.error('Failed to search threats:', { error, query })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
        metadata: {
          timestamp: new Date(),
          requestId: `search_${Date.now()}`,
          processingTime: 0,
        },
      }
    }
  }


  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const startTime = Date.now()

      // Check MongoDB connection
      const mongodbHealthy = await checkMongoDBHealth(this.db)
      if (!mongodbHealthy) {
        return {
          healthy: false,
          message: 'MongoDB connection failed',
        }
      }

      // Check Redis connection
      const redisHealthy = await checkRedisHealth(this.redis)
      if (!redisHealthy) {
        return {
          healthy: false,
          message: 'Redis connection failed',
        }
      }

      // Get database statistics
      const stats = await this.getDatabaseStats()

      const responseTime = Date.now() - startTime

      return {
        healthy: true,
        message: 'Threat Intelligence Database is healthy',
        responseTime,
        databaseStats: stats,
      }
    } catch (error: unknown) {
      logger.error('Health check failed:', { error })
      return {
        healthy: false,
        message: `Health check failed: ${String(error)}`,
      }
    }
  }



  private async getDatabaseStats(): Promise<DatabaseStats> {
    try {
      const [
        totalThreats,
        totalCorrelations,
        totalSTIXObjects,
        totalTAXIIObjects,
      ] = await Promise.all([
        this.db
          .collection('global_threat_intelligence')
          .estimatedDocumentCount(),
        this.db.collection('correlation_data').estimatedDocumentCount(),
        this.getTotalSTIXObjectsCount(),
        this.getTotalTAXIIObjectsCount(),
      ])

      return {
        totalThreats,
        totalCorrelations,
        totalSTIXObjects,
        totalTAXIIObjects,
        lastUpdate: new Date(),
      }
    } catch (error: unknown) {
      logger.error('Failed to get database stats:', { error })
      return {
        totalThreats: 0,
        totalCorrelations: 0,
        totalSTIXObjects: 0,
        totalTAXIIObjects: 0,
        lastUpdate: new Date(),
      }
    }
  }

  private async getTotalSTIXObjectsCount(): Promise<number> {
    if (!this.stixConfig.enabled) {
      return 0
    }

    let totalCount = 0

    for (const objectType of this.stixConfig.objects) {
      const collectionName = `stix_${objectType.toLowerCase()}`
      const collection = this.db.collection(collectionName)
      const count = await collection.estimatedDocumentCount()
      totalCount += count
    }

    return totalCount
  }

  private async getTotalTAXIIObjectsCount(): Promise<number> {
    if (!this.taxiiConfig.enabled) {
      return 0
    }

    const taxiiObjectsCollection = this.db.collection('taxii_objects')
    return await taxiiObjectsCollection.estimatedDocumentCount()
  }

  private async performDatabaseMaintenance(): Promise<void> {
    try {
      logger.info('Performing database maintenance')

      // Clean up expired threats
      const threatsCollection = this.db.collection('global_threat_intelligence')
      const expiredResult = await threatsCollection.deleteMany({
        expirationDate: { $lt: new Date() },
      })

      if (expiredResult.deletedCount > 0) {
        logger.info(`Cleaned up ${expiredResult.deletedCount} expired threats`)
      }

      // Clean up old correlation data
      const correlationsCollection = this.db.collection('correlation_data')
      const oldCorrelationsResult = await correlationsCollection.deleteMany({
        timestamp: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, // 90 days old
      })

      if (oldCorrelationsResult.deletedCount > 0) {
        logger.info(
          `Cleaned up ${oldCorrelationsResult.deletedCount} old correlations`,
        )
      }

      // Update statistics
      const stats = await this.getDatabaseStats()
      logger.info('Database maintenance completed', { stats })
    } catch (error: unknown) {
      logger.error('Database maintenance failed:', { error })
    }
  }

  private async cleanupExpiredCache(): Promise<void> {
    try {
      // Clean up expired cache entries
      const keys = await this.redis.keys('threat:*')
      let cleanedCount = 0

      for (const key of keys) {
        const ttl = await this.redis.ttl(key)
        if (ttl < 0) {
          await this.redis.del(key)
          cleanedCount++
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} expired cache entries`)
      }
    } catch (error: unknown) {
      logger.error('Cache cleanup failed:', { error })
    }
  }

  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Threat Intelligence Database')

      // Close database connections
      if (this.mongoClient) {
        await this.mongoClient.close()
      }

      if (this.redis) {
        await this.redis.quit()
      }

      this.emit('database_shutdown')
      logger.info('Threat Intelligence Database shutdown completed')
    } catch (error: unknown) {
      logger.error('Error during shutdown:', { error })
      throw error
    }
  }
}
