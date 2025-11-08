import { Logger } from '../../utils/logger'
import { ConfigurationManager } from './ConfigurationManager'
import { HealthMonitor } from './HealthMonitor'
import { EventEmitter } from 'events'
import { createClient } from '@clickhouse/client'
import { MongoClient } from 'mongodb'
import { Redis } from 'ioredis'
import * as cockroach from 'cockroach'
import { v4 as uuidv4 } from 'uuid'

/**
 * Cross-Region Data Synchronization Manager
 * Handles data synchronization across multiple regions using CockroachDB
 */
export class CrossRegionDataSyncManager extends EventEmitter {
  private logger: Logger
  private config: ConfigurationManager
  private healthMonitor: HealthMonitor
  private cockroachClient: cockroach.Client | null = null
  private mongoClients: Map<string, MongoClient> = new Map()
  private redisClients: Map<string, Redis> = new Map()
  private clickhouseClient: any = null
  private syncInterval: NodeJS.Timeout | null = null
  private isInitialized = false
  private syncStatus: Map<string, SyncStatus> = new Map()

  constructor(config: ConfigurationManager, healthMonitor: HealthMonitor) {
    super()
    this.config = config
    this.healthMonitor = healthMonitor
    this.logger = new Logger('CrossRegionDataSyncManager')
  }

  /**
   * Initialize the data sync manager
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing CrossRegionDataSyncManager...')

      // Initialize CockroachDB connection
      await this.initializeCockroachDB()

      // Initialize MongoDB connections for each region
      await this.initializeMongoDBConnections()

      // Initialize Redis connections for caching
      await this.initializeRedisConnections()

      // Initialize ClickHouse for analytics
      await this.initializeClickHouse()

      // Set up sync intervals
      this.setupSyncIntervals()

      // Register health checks
      this.registerHealthChecks()

      this.isInitialized = true
      this.logger.info('CrossRegionDataSyncManager initialized successfully')

      this.emit('initialized')
    } catch (error) {
      this.logger.error('Failed to initialize CrossRegionDataSyncManager', {
        error,
      })
      throw error
    }
  }

  /**
   * Initialize CockroachDB connection
   */
  private async initializeCockroachDB(): Promise<void> {
    try {
      const cockroachConfig = this.config.getCockroachDBConfig()

      this.cockroachClient = new cockroach.Client({
        host: cockroachConfig.host,
        port: cockroachConfig.port,
        database: cockroachConfig.database,
        user: cockroachConfig.user,
        password: cockroachConfig.password,
        ssl: {
          rejectUnauthorized: false,
          ca: cockroachConfig.sslCert,
        },
        max: 20, // Maximum number of connections
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      })

      await this.cockroachClient.connect()
      this.logger.info('CockroachDB connection established')

      // Create distributed tables
      await this.createDistributedTables()
    } catch (error) {
      this.logger.error('Failed to initialize CockroachDB connection', {
        error,
      })
      throw error
    }
  }

  /**
   * Create distributed tables in CockroachDB
   */
  private async createDistributedTables(): Promise<void> {
    const tables = [
      {
        name: 'users',
        schema: `
          CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email STRING NOT NULL UNIQUE,
            username STRING NOT NULL UNIQUE,
            region STRING NOT NULL,
            created_at TIMESTAMP DEFAULT now(),
            updated_at TIMESTAMP DEFAULT now(),
            metadata JSONB,
            INDEX idx_email (email),
            INDEX idx_username (username),
            INDEX idx_region (region)
          ) LOCALITY REGIONAL BY ROW
        `,
      },
      {
        name: 'sessions',
        schema: `
          CREATE TABLE IF NOT EXISTS sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id),
            region STRING NOT NULL,
            token STRING NOT NULL UNIQUE,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT now(),
            metadata JSONB,
            INDEX idx_user_id (user_id),
            INDEX idx_token (token),
            INDEX idx_region (region)
          ) LOCALITY REGIONAL BY ROW
        `,
      },
      {
        name: 'conversations',
        schema: `
          CREATE TABLE IF NOT EXISTS conversations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id),
            region STRING NOT NULL,
            title STRING,
            status STRING DEFAULT 'active',
            created_at TIMESTAMP DEFAULT now(),
            updated_at TIMESTAMP DEFAULT now(),
            metadata JSONB,
            INDEX idx_user_id (user_id),
            INDEX idx_region (region),
            INDEX idx_status (status)
          ) LOCALITY REGIONAL BY ROW
        `,
      },
      {
        name: 'messages',
        schema: `
          CREATE TABLE IF NOT EXISTS messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            conversation_id UUID NOT NULL REFERENCES conversations(id),
            user_id UUID NOT NULL REFERENCES users(id),
            region STRING NOT NULL,
            content STRING NOT NULL,
            message_type STRING DEFAULT 'text',
            sentiment_score FLOAT,
            created_at TIMESTAMP DEFAULT now(),
            metadata JSONB,
            INDEX idx_conversation_id (conversation_id),
            INDEX idx_user_id (user_id),
            INDEX idx_region (region),
            INDEX idx_created_at (created_at)
          ) LOCALITY REGIONAL BY ROW
        `,
      },
      {
        name: 'ai_analyses',
        schema: `
          CREATE TABLE IF NOT EXISTS ai_analyses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            message_id UUID NOT NULL REFERENCES messages(id),
            user_id UUID NOT NULL REFERENCES users(id),
            region STRING NOT NULL,
            analysis_type STRING NOT NULL,
            bias_score FLOAT,
            empathy_score FLOAT,
            mental_health_score FLOAT,
            recommendations JSONB,
            created_at TIMESTAMP DEFAULT now(),
            INDEX idx_message_id (message_id),
            INDEX idx_user_id (user_id),
            INDEX idx_region (region),
            INDEX idx_analysis_type (analysis_type)
          ) LOCALITY REGIONAL BY ROW
        `,
      },
      {
        name: 'sync_log',
        schema: `
          CREATE TABLE IF NOT EXISTS sync_log (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            table_name STRING NOT NULL,
            operation STRING NOT NULL,
            record_id UUID NOT NULL,
            region STRING NOT NULL,
            sync_status STRING DEFAULT 'pending',
            retry_count INT DEFAULT 0,
            error_message STRING,
            created_at TIMESTAMP DEFAULT now(),
            updated_at TIMESTAMP DEFAULT now(),
            INDEX idx_table_name (table_name),
            INDEX idx_sync_status (sync_status),
            INDEX idx_region (region),
            INDEX idx_created_at (created_at)
          ) LOCALITY GLOBAL
        `,
      },
    ]

    for (const table of tables) {
      try {
        await this.cockroachClient!.query(table.schema)
        this.logger.info(`Created distributed table: ${table.name}`)
      } catch (error) {
        this.logger.error(`Failed to create table ${table.name}`, { error })
        throw error
      }
    }
  }

  /**
   * Initialize MongoDB connections for each region
   */
  private async initializeMongoDBConnections(): Promise<void> {
    const regions = this.config.getRegions()

    for (const region of regions) {
      try {
        const mongoConfig = this.config.getMongoDBConfig(region)

        const client = new MongoClient(mongoConfig.connectionString, {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        })

        await client.connect()
        this.mongoClients.set(region, client)

        this.logger.info(`MongoDB connection established for region: ${region}`)
      } catch (error) {
        this.logger.error(
          `Failed to initialize MongoDB for region: ${region}`,
          { error },
        )
        throw error
      }
    }
  }

  /**
   * Initialize Redis connections for caching
   */
  private async initializeRedisConnections(): Promise<void> {
    const regions = this.config.getRegions()

    for (const region of regions) {
      try {
        const redisConfig = this.config.getRedisConfig(region)

        const client = new Redis({
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password,
          db: redisConfig.database,
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          enableReadyCheck: true,
          maxmemoryPolicy: 'allkeys-lru',
        })

        // Test connection
        await client.ping()
        this.redisClients.set(region, client)

        this.logger.info(`Redis connection established for region: ${region}`)
      } catch (error) {
        this.logger.error(`Failed to initialize Redis for region: ${region}`, {
          error,
        })
        throw error
      }
    }
  }

  /**
   * Initialize ClickHouse for analytics
   */
  private async initializeClickHouse(): Promise<void> {
    try {
      const clickhouseConfig = this.config.getClickHouseConfig()

      this.clickhouseClient = createClient({
        host: clickhouseConfig.host,
        port: clickhouseConfig.port,
        username: clickhouseConfig.username,
        password: clickhouseConfig.password,
        database: clickhouseConfig.database,
        application: 'pixelated-multi-region',
        max_open_connections: 10,
        request_timeout: 30000,
      })

      // Create analytics tables
      await this.createAnalyticsTables()

      this.logger.info('ClickHouse connection established')
    } catch (error) {
      this.logger.error('Failed to initialize ClickHouse', { error })
      throw error
    }
  }

  /**
   * Create analytics tables in ClickHouse
   */
  private async createAnalyticsTables(): Promise<void> {
    const tables = [
      {
        name: 'user_analytics',
        schema: `
          CREATE TABLE IF NOT EXISTS user_analytics (
            timestamp DateTime,
            user_id UUID,
            region String,
            event_type String,
            event_data String,
            session_id UUID,
            ip_address String,
            user_agent String
          ) ENGINE = MergeTree()
          PARTITION BY toYYYYMM(timestamp)
          ORDER BY (timestamp, user_id)
          TTL timestamp + INTERVAL 90 DAY
        `,
      },
      {
        name: 'performance_metrics',
        schema: `
          CREATE TABLE IF NOT EXISTS performance_metrics (
            timestamp DateTime,
            region String,
            metric_name String,
            metric_value Float64,
            tags String
          ) ENGINE = MergeTree()
          PARTITION BY toYYYYMM(timestamp)
          ORDER BY (timestamp, region, metric_name)
          TTL timestamp + INTERVAL 30 DAY
        `,
      },
    ]

    for (const table of tables) {
      try {
        await this.clickhouseClient.exec({
          query: table.schema,
          clickhouse_settings: {
            wait_end_of_query: 1,
          },
        })
        this.logger.info(`Created ClickHouse table: ${table.name}`)
      } catch (error) {
        this.logger.error(`Failed to create ClickHouse table ${table.name}`, {
          error,
        })
        throw error
      }
    }
  }

  /**
   * Set up synchronization intervals
   */
  private setupSyncIntervals(): void {
    const syncConfig = this.config.getSyncConfig()

    // Real-time sync for critical data
    this.syncInterval = setInterval(() => {
      this.performRealTimeSync().catch((error) => {
        this.logger.error('Real-time sync failed', { error })
      })
    }, syncConfig.realTimeSyncInterval)

    // Batch sync for analytics data
    setInterval(() => {
      this.performBatchSync().catch((error) => {
        this.logger.error('Batch sync failed', { error })
      })
    }, syncConfig.batchSyncInterval)

    // Cleanup old sync logs
    setInterval(() => {
      this.cleanupSyncLogs().catch((error) => {
        this.logger.error('Sync log cleanup failed', { error })
      })
    }, syncConfig.cleanupInterval)

    this.logger.info('Sync intervals configured')
  }

  /**
   * Register health checks
   */
  private registerHealthChecks(): void {
    this.healthMonitor.registerCheck('cockroachdb', async () => {
      try {
        if (!this.cockroachClient)
          return {
            status: 'unhealthy',
            message: 'CockroachDB client not initialized',
          }

        const _result = await this.cockroachClient.query('SELECT 1')
        return { status: 'healthy', message: 'CockroachDB connection active' }
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `CockroachDB error: ${error.message}`,
        }
      }
    })

    this.healthMonitor.registerCheck('mongodb', async () => {
      try {
        const regions = Array.from(this.mongoClients.keys())
        const results = await Promise.all(
          regions.map(async (region) => {
            const client = this.mongoClients.get(region)
            if (!client)
              return {
                region,
                status: 'unhealthy',
                message: 'Client not found',
              }

            try {
              await client.db().admin().ping()
              return {
                region,
                status: 'healthy',
                message: 'MongoDB connection active',
              }
            } catch (error) {
              return {
                region,
                status: 'unhealthy',
                message: `MongoDB error: ${error.message}`,
              }
            }
          }),
        )

        const unhealthy = results.filter((r) => r.status === 'unhealthy')
        if (unhealthy.length > 0) {
          return {
            status: 'unhealthy',
            message: `MongoDB issues in regions: ${unhealthy.map((r) => r.region).join(', ')}`,
          }
        }

        return { status: 'healthy', message: 'All MongoDB connections active' }
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `MongoDB health check error: ${error.message}`,
        }
      }
    })

    this.healthMonitor.registerCheck('redis', async () => {
      try {
        const regions = Array.from(this.redisClients.keys())
        const results = await Promise.all(
          regions.map(async (region) => {
            const client = this.redisClients.get(region)
            if (!client)
              return {
                region,
                status: 'unhealthy',
                message: 'Client not found',
              }

            try {
              await client.ping()
              return {
                region,
                status: 'healthy',
                message: 'Redis connection active',
              }
            } catch (error) {
              return {
                region,
                status: 'unhealthy',
                message: `Redis error: ${error.message}`,
              }
            }
          }),
        )

        const unhealthy = results.filter((r) => r.status === 'unhealthy')
        if (unhealthy.length > 0) {
          return {
            status: 'unhealthy',
            message: `Redis issues in regions: ${unhealthy.map((r) => r.region).join(', ')}`,
          }
        }

        return { status: 'healthy', message: 'All Redis connections active' }
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Redis health check error: ${error.message}`,
        }
      }
    })
  }

  /**
   * Perform real-time synchronization
   */
  private async performRealTimeSync(): Promise<void> {
    try {
      this.logger.debug('Performing real-time sync...')

      // Sync user data
      await this.syncUserData()

      // Sync session data
      await this.syncSessionData()

      // Sync conversation data
      await this.syncConversationData()

      // Process pending sync logs
      await this.processSyncLogs()

      this.logger.debug('Real-time sync completed')
    } catch (error) {
      this.logger.error('Real-time sync failed', { error })
      throw error
    }
  }

  /**
   * Sync user data across regions
   */
  private async syncUserData(): Promise<void> {
    try {
      const regions = this.config.getRegions()
      const syncConfig = this.config.getSyncConfig()

      for (const region of regions) {
        const client = this.mongoClients.get(region)
        if (!client) continue

        const db = client.db()
        const usersCollection = db.collection('users')

        // Find users that need syncing
        const pendingUsers = await usersCollection
          .find({
            $or: [
              { lastSyncedAt: { $exists: false } },
              {
                lastSyncedAt: {
                  $lt: new Date(Date.now() - syncConfig.userSyncInterval),
                },
              },
              { syncStatus: 'pending' },
            ],
          })
          .limit(100)
          .toArray()

        for (const user of pendingUsers) {
          try {
            // Sync to CockroachDB
            await this.syncUserToCockroachDB(user, region)

            // Update sync status
            await usersCollection.updateOne(
              { _id: user._id },
              {
                $set: {
                  lastSyncedAt: new Date(),
                  syncStatus: 'synced',
                },
              },
            )

            // Log sync
            await this.logSync('users', 'sync', user._id, region, 'completed')
          } catch (error) {
            this.logger.error(
              `Failed to sync user ${user._id} from ${region}`,
              { error },
            )
            await this.logSync(
              'users',
              'sync',
              user._id,
              region,
              'failed',
              error.message,
            )
          }
        }
      }
    } catch (error) {
      this.logger.error('User data sync failed', { error })
      throw error
    }
  }

  /**
   * Sync user to CockroachDB
   */
  private async syncUserToCockroachDB(
    user: any,
    region: string,
  ): Promise<void> {
    const query = `
      INSERT INTO users (id, email, username, region, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        username = EXCLUDED.username,
        metadata = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at
    `

    const values = [
      user._id.toString(),
      user.email,
      user.username,
      region,
      JSON.stringify(user.metadata || {}),
      user.createdAt || new Date(),
      user.updatedAt || new Date(),
    ]

    await this.cockroachClient!.query(query, values)
  }

  /**
   * Sync session data across regions
   */
  private async syncSessionData(): Promise<void> {
    try {
      const regions = this.config.getRegions()

      for (const region of regions) {
        const client = this.mongoClients.get(region)
        if (!client) continue

        const db = client.db()
        const sessionsCollection = db.collection('sessions')

        // Find sessions that need syncing
        const pendingSessions = await sessionsCollection
          .find({
            syncStatus: 'pending',
          })
          .limit(50)
          .toArray()

        for (const session of pendingSessions) {
          try {
            // Sync to CockroachDB
            await this.syncSessionToCockroachDB(session, region)

            // Update sync status
            await sessionsCollection.updateOne(
              { _id: session._id },
              { $set: { syncStatus: 'synced' } },
            )

            // Log sync
            await this.logSync(
              'sessions',
              'sync',
              session._id,
              region,
              'completed',
            )
          } catch (error) {
            this.logger.error(
              `Failed to sync session ${session._id} from ${region}`,
              { error },
            )
            await this.logSync(
              'sessions',
              'sync',
              session._id,
              region,
              'failed',
              error.message,
            )
          }
        }
      }
    } catch (error) {
      this.logger.error('Session data sync failed', { error })
      throw error
    }
  }

  /**
   * Sync session to CockroachDB
   */
  private async syncSessionToCockroachDB(
    session: any,
    region: string,
  ): Promise<void> {
    const query = `
      INSERT INTO sessions (id, user_id, region, token, expires_at, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        expires_at = EXCLUDED.expires_at,
        metadata = EXCLUDED.metadata
    `

    const values = [
      session._id.toString(),
      session.userId.toString(),
      region,
      session.token,
      session.expiresAt,
      JSON.stringify(session.metadata || {}),
      session.createdAt || new Date(),
    ]

    await this.cockroachClient!.query(query, values)
  }

  /**
   * Sync conversation data across regions
   */
  private async syncConversationData(): Promise<void> {
    try {
      const regions = this.config.getRegions()

      for (const region of regions) {
        const client = this.mongoClients.get(region)
        if (!client) continue

        const db = client.db()
        const conversationsCollection = db.collection('conversations')
        const messagesCollection = db.collection('messages')

        // Sync conversations
        const pendingConversations = await conversationsCollection
          .find({
            syncStatus: 'pending',
          })
          .limit(20)
          .toArray()

        for (const conversation of pendingConversations) {
          try {
            // Sync conversation to CockroachDB
            await this.syncConversationToCockroachDB(conversation, region)

            // Sync related messages
            const messages = await messagesCollection
              .find({
                conversationId: conversation._id,
                syncStatus: 'pending',
              })
              .toArray()

            for (const message of messages) {
              await this.syncMessageToCockroachDB(message, region)

              // Sync AI analyses if available
              if (message.aiAnalysis) {
                await this.syncAIAnalysisToCockroachDB(
                  message.aiAnalysis,
                  message._id,
                  conversation.userId,
                  region,
                )
              }
            }

            // Update sync status
            await conversationsCollection.updateOne(
              { _id: conversation._id },
              { $set: { syncStatus: 'synced' } },
            )

            // Update message sync status
            await messagesCollection.updateMany(
              { conversationId: conversation._id },
              { $set: { syncStatus: 'synced' } },
            )

            // Log sync
            await this.logSync(
              'conversations',
              'sync',
              conversation._id,
              region,
              'completed',
            )
          } catch (error) {
            this.logger.error(
              `Failed to sync conversation ${conversation._id} from ${region}`,
              { error },
            )
            await this.logSync(
              'conversations',
              'sync',
              conversation._id,
              region,
              'failed',
              error.message,
            )
          }
        }
      }
    } catch (error) {
      this.logger.error('Conversation data sync failed', { error })
      throw error
    }
  }

  /**
   * Sync conversation to CockroachDB
   */
  private async syncConversationToCockroachDB(
    conversation: any,
    region: string,
  ): Promise<void> {
    const query = `
      INSERT INTO conversations (id, user_id, region, title, status, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        status = EXCLUDED.status,
        metadata = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at
    `

    const values = [
      conversation._id.toString(),
      conversation.userId.toString(),
      region,
      conversation.title,
      conversation.status || 'active',
      JSON.stringify(conversation.metadata || {}),
      conversation.createdAt || new Date(),
      conversation.updatedAt || new Date(),
    ]

    await this.cockroachClient!.query(query, values)
  }

  /**
   * Sync message to CockroachDB
   */
  private async syncMessageToCockroachDB(
    message: any,
    region: string,
  ): Promise<void> {
    const query = `
      INSERT INTO messages (id, conversation_id, user_id, region, content, message_type, sentiment_score, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        content = EXCLUDED.content,
        sentiment_score = EXCLUDED.sentiment_score,
        metadata = EXCLUDED.metadata
    `

    const values = [
      message._id.toString(),
      message.conversationId.toString(),
      message.userId.toString(),
      region,
      message.content,
      message.messageType || 'text',
      message.sentimentScore || null,
      JSON.stringify(message.metadata || {}),
      message.createdAt || new Date(),
    ]

    await this.cockroachClient!.query(query, values)
  }

  /**
   * Sync AI analysis to CockroachDB
   */
  private async syncAIAnalysisToCockroachDB(
    analysis: any,
    messageId: string,
    userId: string,
    region: string,
  ): Promise<void> {
    const query = `
      INSERT INTO ai_analyses (id, message_id, user_id, region, analysis_type, bias_score, empathy_score, mental_health_score, recommendations, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        bias_score = EXCLUDED.bias_score,
        empathy_score = EXCLUDED.empathy_score,
        mental_health_score = EXCLUDED.mental_health_score,
        recommendations = EXCLUDED.recommendations
    `

    const values = [
      analysis._id || uuidv4(),
      messageId,
      userId,
      region,
      analysis.analysisType,
      analysis.biasScore || null,
      analysis.empathyScore || null,
      analysis.mentalHealthScore || null,
      JSON.stringify(analysis.recommendations || {}),
      analysis.createdAt || new Date(),
    ]

    await this.cockroachClient!.query(query, values)
  }

  /**
   * Log synchronization operation
   */
  private async logSync(
    tableName: string,
    operation: string,
    recordId: string,
    region: string,
    status: string,
    errorMessage?: string,
  ): Promise<void> {
    const query = `
      INSERT INTO sync_log (table_name, operation, record_id, region, sync_status, error_message)
      VALUES ($1, $2, $3, $4, $5, $6)
    `

    const values = [
      tableName,
      operation,
      recordId,
      region,
      status,
      errorMessage || null,
    ]
    await this.cockroachClient!.query(query, values)
  }

  /**
   * Process pending sync logs
   */
  private async processSyncLogs(): Promise<void> {
    try {
      const query = `
        SELECT * FROM sync_log
        WHERE sync_status = 'failed' AND retry_count < 3
        ORDER BY created_at ASC
        LIMIT 50
      `

      const result = await this.cockroachClient!.query(query)

      for (const log of result.rows) {
        try {
          // Retry the failed operation
          await this.retrySyncOperation(log)

          // Update sync log
          await this.cockroachClient!.query(
            'UPDATE sync_log SET sync_status = $1, retry_count = retry_count + 1, updated_at = now() WHERE id = $2',
            ['completed', log.id],
          )
        } catch (error) {
          this.logger.error(`Failed to retry sync operation ${log.id}`, {
            error,
          })

          // Update retry count
          await this.cockroachClient!.query(
            'UPDATE sync_log SET retry_count = retry_count + 1, error_message = $1, updated_at = now() WHERE id = $2',
            [error.message, log.id],
          )
        }
      }
    } catch (error) {
      this.logger.error('Failed to process sync logs', { error })
    }
  }

  /**
   * Retry a failed sync operation
   */
  private async retrySyncOperation(log: any): Promise<void> {
    // Implementation depends on the specific operation
    this.logger.info(
      `Retrying sync operation for ${log.table_name} record ${log.record_id}`,
    )

    // Add retry logic based on table and operation type
    // This is a placeholder - implement specific retry logic as needed
  }

  /**
   * Perform batch synchronization for analytics
   */
  private async performBatchSync(): Promise<void> {
    try {
      this.logger.debug('Performing batch sync for analytics...')

      // Sync performance metrics to ClickHouse
      await this.syncPerformanceMetrics()

      // Sync user analytics
      await this.syncUserAnalytics()

      // Cleanup old data
      await this.cleanupOldData()

      this.logger.debug('Batch sync completed')
    } catch (error) {
      this.logger.error('Batch sync failed', { error })
      throw error
    }
  }

  /**
   * Sync performance metrics to ClickHouse
   */
  private async syncPerformanceMetrics(): Promise<void> {
    try {
      const regions = this.config.getRegions()
      const metrics = []

      for (const region of regions) {
        const client = this.redisClients.get(region)
        if (!client) continue

        // Get performance metrics from Redis
        const regionMetrics = await client.hgetall(`metrics:${region}`)

        for (const [metricName, metricValue] of Object.entries(regionMetrics)) {
          metrics.push({
            timestamp: new Date(),
            region,
            metric_name: metricName,
            metric_value: parseFloat(metricValue) || 0,
            tags: JSON.stringify({ source: 'redis' }),
          })
        }
      }

      // Insert into ClickHouse
      if (metrics.length > 0) {
        await this.clickhouseClient.insert({
          table: 'performance_metrics',
          values: metrics,
          format: 'JSONEachRow',
        })
      }

      this.logger.debug(`Synced ${metrics.length} performance metrics`)
    } catch (error) {
      this.logger.error('Failed to sync performance metrics', { error })
      throw error
    }
  }

  /**
   * Sync user analytics to ClickHouse
   */
  private async syncUserAnalytics(): Promise<void> {
    try {
      const regions = this.config.getRegions()
      const analytics = []

      for (const region of regions) {
        const client = this.mongoClients.get(region)
        if (!client) continue

        const db = client.db()
        const analyticsCollection = db.collection('user_analytics')

        // Get recent analytics data
        const recentAnalytics = await analyticsCollection
          .find({
            syncedAt: { $exists: false },
          })
          .limit(1000)
          .toArray()

        for (const analytic of recentAnalytics) {
          analytics.push({
            timestamp: analytic.timestamp || new Date(),
            user_id: analytic.userId?.toString() || uuidv4(),
            region,
            event_type: analytic.eventType,
            event_data: JSON.stringify(analytic.eventData || {}),
            session_id: analytic.sessionId?.toString() || uuidv4(),
            ip_address: analytic.ipAddress || '',
            user_agent: analytic.userAgent || '',
          })
        }

        // Mark as synced
        await analyticsCollection.updateMany(
          { _id: { $in: recentAnalytics.map((a) => a._id) } },
          { $set: { syncedAt: new Date() } },
        )
      }

      // Insert into ClickHouse
      if (analytics.length > 0) {
        await this.clickhouseClient.insert({
          table: 'user_analytics',
          values: analytics,
          format: 'JSONEachRow',
        })
      }

      this.logger.debug(`Synced ${analytics.length} user analytics events`)
    } catch (error) {
      this.logger.error('Failed to sync user analytics', { error })
      throw error
    }
  }

  /**
   * Cleanup old data
   */
  private async cleanupOldData(): Promise<void> {
    try {
      // Cleanup old sync logs
      const cleanupQuery = `
        DELETE FROM sync_log
        WHERE created_at < now() - INTERVAL '30 days'
        AND sync_status = 'completed'
      `

      const result = await this.cockroachClient!.query(cleanupQuery)
      this.logger.debug(`Cleaned up ${result.rowCount} old sync logs`)
    } catch (error) {
      this.logger.error('Failed to cleanup old data', { error })
      throw error
    }
  }

  /**
   * Cleanup sync logs
   */
  private async cleanupSyncLogs(): Promise<void> {
    try {
      const query = `
        DELETE FROM sync_log
        WHERE created_at < now() - INTERVAL '7 days'
        AND sync_status IN ('completed', 'failed')
        AND retry_count >= 3
      `

      const result = await this.cockroachClient!.query(query)
      this.logger.debug(`Cleaned up ${result.rowCount} old sync log entries`)
    } catch (error) {
      this.logger.error('Failed to cleanup sync logs', { error })
    }
  }

  /**
   * Get sync status for all regions
   */
  async getSyncStatus(): Promise<Map<string, SyncStatus>> {
    return new Map(this.syncStatus)
  }

  /**
   * Get data distribution across regions
   */
  async getDataDistribution(): Promise<DataDistribution> {
    try {
      const query = `
        SELECT 
          region,
          COUNT(*) as total_records,
          COUNT(CASE WHEN sync_status = 'pending' THEN 1 END) as pending_sync,
          COUNT(CASE WHEN sync_status = 'failed' THEN 1 END) as failed_sync,
          COUNT(CASE WHEN sync_status = 'completed' THEN 1 END) as completed_sync
        FROM sync_log
        WHERE created_at > now() - INTERVAL '24 hours'
        GROUP BY region
        ORDER BY region
      `

      const result = await this.cockroachClient!.query(query)

      const distribution: DataDistribution = {
        totalRecords: 0,
        pendingSync: 0,
        failedSync: 0,
        completedSync: 0,
        regions: {},
      }

      for (const row of result.rows) {
        distribution.regions[row.region] = {
          totalRecords: parseInt(row.total_records),
          pendingSync: parseInt(row.pending_sync),
          failedSync: parseInt(row.failed_sync),
          completedSync: parseInt(row.completed_sync),
        }

        distribution.totalRecords += parseInt(row.total_records)
        distribution.pendingSync += parseInt(row.pending_sync)
        distribution.failedSync += parseInt(row.failed_sync)
        distribution.completedSync += parseInt(row.completed_sync)
      }

      return distribution
    } catch (error) {
      this.logger.error('Failed to get data distribution', { error })
      throw error
    }
  }

  /**
   * Force sync for specific table and region
   */
  async forceSync(tableName: string, region: string): Promise<void> {
    try {
      this.logger.info(`Force syncing ${tableName} for region ${region}...`)

      switch (tableName) {
        case 'users':
          await this.syncUserData()
          break
        case 'sessions':
          await this.syncSessionData()
          break
        case 'conversations':
          await this.syncConversationData()
          break
        default:
          throw new Error(`Unsupported table: ${tableName}`)
      }

      this.logger.info(`Force sync completed for ${tableName} in ${region}`)
    } catch (error) {
      this.logger.error(`Force sync failed for ${tableName} in ${region}`, {
        error,
      })
      throw error
    }
  }

  /**
   * Get replication lag for a region
   */
  async getReplicationLag(region: string): Promise<number> {
    try {
      const query = `
        SELECT 
          EXTRACT(EPOCH FROM (now() - MAX(updated_at))) as lag_seconds
        FROM sync_log
        WHERE region = $1
        AND sync_status = 'completed'
      `

      const result = await this.cockroachClient!.query(query, [region])

      if (result.rows.length > 0 && result.rows[0].lag_seconds !== null) {
        return parseFloat(result.rows[0].lag_seconds)
      }

      return 0
    } catch (error) {
      this.logger.error(`Failed to get replication lag for ${region}`, {
        error,
      })
      throw error
    }
  }

  /**
   * Shutdown the data sync manager
   */
  async shutdown(): Promise<void> {
    try {
      this.logger.info('Shutting down CrossRegionDataSyncManager...')

      // Clear sync intervals
      if (this.syncInterval) {
        clearInterval(this.syncInterval)
        this.syncInterval = null
      }

      // Close CockroachDB connection
      if (this.cockroachClient) {
        await this.cockroachClient.end()
        this.cockroachClient = null
      }

      // Close MongoDB connections
      for (const [region, client] of this.mongoClients) {
        await client.close()
        this.logger.info(`MongoDB connection closed for region: ${region}`)
      }
      this.mongoClients.clear()

      // Close Redis connections
      for (const [region, client] of this.redisClients) {
        await client.quit()
        this.logger.info(`Redis connection closed for region: ${region}`)
      }
      this.redisClients.clear()

      // Close ClickHouse connection
      if (this.clickhouseClient) {
        await this.clickhouseClient.close()
        this.clickhouseClient = null
      }

      this.isInitialized = false
      this.logger.info('CrossRegionDataSyncManager shutdown completed')

      this.emit('shutdown')
    } catch (error) {
      this.logger.error('Error during shutdown', { error })
      throw error
    }
  }
}

// Types
interface SyncStatus {
  region: string
  tableName: string
  lastSync: Date
  pendingRecords: number
  failedRecords: number
  status: 'syncing' | 'idle' | 'error'
}

interface DataDistribution {
  totalRecords: number
  pendingSync: number
  failedSync: number
  completedSync: number
  regions: {
    [region: string]: {
      totalRecords: number
      pendingSync: number
      failedSync: number
      completedSync: number
    }
  }
}

export { SyncStatus, DataDistribution }
