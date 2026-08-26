import { EventEmitter } from 'events'

import { createClient } from '@clickhouse/client'
import { Client as CockroachDbClient } from 'cockroach'
import Redis from 'ioredis'
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'

import { getLogger, Logger } from '../../utils/logger'
import { ConfigurationManager } from './ConfigurationManager'
import { HealthMonitor } from './HealthMonitor'

type CockroachClient = {
  connect: () => Promise<void>
  query: (...args: unknown[]) => Promise<{
    rows: Array<Record<string, unknown>>
    rowCount?: number
  }>
  end?: () => Promise<void>
  close?: () => Promise<void>
}

type RedisClientWithHGetAll = Redis & {
  hgetall: (key: string) => Promise<unknown>
}

type CockroachDbSecrets = {
  connectionString?: string
  database?: string
  user?: string
  password?: string
  sslMode?: string
}

type MongoDbConfig = {
  connectionString: string
  [key: string]: unknown
}

type RedisDbSecrets = {
  url?: string
  host?: string
  port?: string | number
  password?: string
  database?: number
  [key: string]: unknown
}

type ClickHouseConfig = {
  host: string
  port: number
  username: string
  password: string
  database: string
  https: boolean
  [key: string]: unknown
}

type ClickhouseClient = ReturnType<typeof createClient> & {
  command: (params: {
    query: string
    clickhouse_settings?: Record<string, unknown>
  }) => Promise<unknown>
  close?: () => Promise<void>
}

/**
 * Cross-Region Data Synchronization Manager
 * Handles data synchronization across multiple regions using CockroachDB
 */
export class CrossRegionDataSyncManager extends EventEmitter {
  private readonly logger: Logger
  private readonly config: ConfigurationManager
  private readonly healthMonitor: HealthMonitor
  private cockroachClient: CockroachClient | null = null
  private readonly mongoClients: Map<string, MongoClient> = new Map()
  private readonly redisClients: Map<string, Redis> = new Map()
  private clickhouseClient: ClickhouseClient | null = null
  private syncInterval: NodeJS.Timeout | null = null
  private readonly syncStatus: Map<string, SyncStatus> = new Map()
  private readonly healthChecks: Map<
    string,
    () => Promise<{ status: 'healthy' | 'unhealthy'; message: string }>
  > = new Map()
  private isInitialized = false

  constructor(config: ConfigurationManager, healthMonitor: HealthMonitor) {
    super()
    this.config = config
    this.healthMonitor = healthMonitor
    this.logger = getLogger('CrossRegionDataSyncManager')
  }

  /**
   * Get configured regions
   */
  private getRegions(): string[] {
    const deploymentConfig = this.config.getConfig().deployment
    return deploymentConfig.regions.map((region) => region.id)
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object'
  }

  private isStringRecord(value: unknown): value is Record<string, string> {
    if (!this.isRecord(value)) return false

    return Object.entries(value).every(([, v]) => typeof v === 'string')
  }

  private isCockroachClient(value: unknown): value is CockroachClient {
    if (!this.isRecord(value)) return false

    return (
      typeof Reflect.get(value, 'connect') === 'function' &&
      typeof Reflect.get(value, 'query') === 'function'
    )
  }

  private isRedisClientWithHGetAll(
    client: Redis,
  ): client is RedisClientWithHGetAll {
    return typeof Reflect.get(client, 'hgetall') === 'function'
  }

  private toRecord(value: unknown): Record<string, unknown> | undefined {
    return this.isRecord(value) ? value : undefined
  }

  private toRecordArray(value: unknown): Array<Record<string, unknown>> {
    if (!Array.isArray(value)) return []

    return value.filter((item): item is Record<string, unknown> =>
      this.isRecord(item),
    )
  }

  private toLogString(value: unknown): string {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value)
    }

    if (value === null || value === undefined) {
      return ''
    }

    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }

  private getRecordValueAsString(
    record: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = record[key]
    if (typeof value === 'string') {
      return value
    }

    if (typeof value === 'number') {
      return String(value)
    }

    return undefined
  }

  private getRecordValueAsNumber(
    record: Record<string, unknown>,
    key: string,
    fallback: number,
  ): number {
    const value = this.getRecordValueAsString(record, key)
    const parsed = typeof value === 'string' ? Number(value) : NaN
    return Number.isNaN(parsed) ? fallback : parsed
  }

  private errorContext(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  private getCockroachClient(): CockroachClient {
    if (!this.cockroachClient) {
      throw new Error('CockroachDB client is not initialized')
    }
    return this.cockroachClient
  }

  private getClickhouseClient(): ClickhouseClient {
    if (!this.clickhouseClient) {
      throw new Error('ClickHouse client is not initialized')
    }
    return this.clickhouseClient
  }

  private toNumberOrUndefined(value: unknown): number | undefined {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number.parseFloat(value)
          : NaN
    return Number.isFinite(parsed) ? parsed : undefined
  }

  private toNumber(value: unknown, fallback: number): number {
    return this.toNumberOrUndefined(value) ?? fallback
  }

  /**
   * Get CockroachDB configuration
   */
  private getCockroachDBConfig(): {
    host: string
    port: number
    database: string
    user: string
    password: string
    sslCert: string | null
    sslMode?: string
  } {
    const configDatabases = this.isRecord(
      this.config.getConfig().secrets.databases,
    )
      ? (this.config.getConfig().secrets.databases as Record<string, unknown>)
      : {}
    const databaseSecrets = this.isRecord(configDatabases['cockroachdb'])
      ? configDatabases['cockroachdb']
      : {}
    const secrets = databaseSecrets as CockroachDbSecrets
    const connectionString =
      typeof secrets.connectionString === 'string'
        ? secrets.connectionString
        : (process.env['COCKROACH_CONNECTION_STRING'] ?? '')

    try {
      const parsed = connectionString ? new URL(connectionString) : null
      return {
        host: parsed?.hostname ?? 'localhost',
        port: this.toNumberOrUndefined(parsed?.port) ?? 26257,
        database:
          typeof parsed?.pathname === 'string' && parsed.pathname.length > 1
            ? parsed.pathname.replace('/', '')
            : typeof secrets.database === 'string'
              ? secrets.database
              : 'defaultdb',
        user:
          typeof parsed?.username === 'string' && parsed.username.length > 0
            ? parsed.username
            : typeof secrets.user === 'string'
              ? secrets.user
              : (process.env['COCKROACH_USER'] ?? 'root'),
        password:
          typeof parsed?.password === 'string' && parsed.password.length > 0
            ? parsed.password
            : typeof secrets.password === 'string' &&
                secrets.password.length > 0
              ? secrets.password
              : (process.env['COCKROACH_PASSWORD'] ?? ''),
        sslCert: process.env['COCKROACH_SSL_CERT'] ?? null,
        sslMode:
          typeof secrets.sslMode === 'string' ? secrets.sslMode : undefined,
      }
    } catch {
      return {
        sslMode:
          typeof secrets.sslMode === 'string' ? secrets.sslMode : undefined,
        host: 'localhost',
        port: 26257,
        database: 'defaultdb',
        user: process.env['COCKROACH_USER'] ?? 'root',
        password: process.env['COCKROACH_PASSWORD'] ?? '',
        sslCert: process.env['COCKROACH_SSL_CERT'] ?? null,
      }
    }
  }

  /**
   * Get MongoDB configuration for region
   */
  private getMongoDBConfig(_region = ''): MongoDbConfig {
    const configDatabases = this.isRecord(
      this.config.getConfig().secrets.databases,
    )
      ? (this.config.getConfig().secrets.databases as Record<string, unknown>)
      : {}
    const secrets = this.isRecord(configDatabases['mongo'])
      ? configDatabases['mongo']
      : {}
    return {
      connectionString:
        process.env['MONGODB_CONNECTION_STRING'] ??
        (typeof secrets['connectionString'] === 'string'
          ? secrets['connectionString']
          : undefined) ??
        'mongodb://localhost:27017/pixelated',
      ...secrets,
    }
  }

  /**
   * Get Redis configuration for region
   */
  private getRedisConfig(_region = ''): {
    host: string
    port: number
    password: string
    database: number
    [key: string]: unknown
  } {
    const configDatabases = this.isRecord(
      this.config.getConfig().secrets.databases,
    )
      ? (this.config.getConfig().secrets.databases as Record<string, unknown>)
      : {}
    const defaults = this.isRecord(configDatabases['redis'])
      ? configDatabases['redis']
      : {}
    const secrets: RedisDbSecrets = { ...defaults }
    const typedSecrets = {
      database: secrets.database,
      password: secrets.password,
      host: process.env['REDIS_HOST'] ?? secrets.host,
      port:
        process.env['REDIS_PORT'] ??
        (typeof secrets.port === 'number' || typeof secrets.port === 'string'
          ? `${secrets.port}`
          : undefined),
    }
    return {
      ...secrets,
      host:
        typeof typedSecrets.host === 'string' ? typedSecrets.host : 'localhost',
      port:
        this.toNumberOrUndefined(
          typedSecrets.port && typeof typedSecrets.port === 'string'
            ? typedSecrets.port
            : '6379',
        ) ?? 6379,
      password:
        process.env['REDIS_PASSWORD'] ??
        (typeof typedSecrets.password === 'string'
          ? typedSecrets.password
          : ''),
      database:
        typeof typedSecrets.database === 'number' ? typedSecrets.database : 0,
    }
  }

  /**
   * Get ClickHouse configuration
   */
  private getClickHouseConfig(): ClickHouseConfig {
    const configDatabases = this.isRecord(
      this.config.getConfig().secrets.databases,
    )
      ? (this.config.getConfig().secrets.databases as Record<string, unknown>)
      : {}
    const defaults = this.isRecord(configDatabases['clickhouse'])
      ? configDatabases['clickhouse']
      : {}

    return {
      host: process.env['CLICKHOUSE_HOST'] ?? 'localhost',
      port: this.toNumberOrUndefined(process.env['CLICKHOUSE_PORT']) ?? 8123,
      username: process.env['CLICKHOUSE_USERNAME'] ?? 'default',
      password: process.env['CLICKHOUSE_PASSWORD'] ?? '',
      database: process.env['CLICKHOUSE_DATABASE'] ?? 'default',
      https: process.env['CLICKHOUSE_HTTPS'] === 'true',
      ...defaults,
    }
  }

  /**
   * Get sync config defaults
   */
  private getSyncConfig(): {
    realTimeSyncInterval: number
    batchSyncInterval: number
    cleanupInterval: number
    userSyncInterval: number
  } {
    return {
      realTimeSyncInterval: 10_000,
      batchSyncInterval: 60_000,
      cleanupInterval: 300_000,
      userSyncInterval: 120_000,
    }
  }

  /**
   * Register a health check callback
   */
  private registerHealthCheck(
    name: string,
    check: () => Promise<{ status: 'healthy' | 'unhealthy'; message: string }>,
  ): void {
    this.healthChecks.set(name, check)

    void check()
      .then((result) => {
        if (result.status !== 'healthy') {
          this.healthMonitor.emit('health-check-failed', {
            component: name,
            message: result.message,
            status: result.status,
          })
        }
      })
      .catch((error: unknown) => {
        this.logger.error(`Health check failed for ${name}`, {
          error: this.errorContext(error),
        })
      })
  }

  /**
   * Normalize a record identifier into a string representation
   */
  private normalizeRecordId(id: unknown): string {
    if (typeof id === 'string') return id
    if (id && typeof id === 'object' && 'toString' in id) {
      const toStringMethod = id.toString.bind(id)
      if (
        typeof toStringMethod === 'function' &&
        toStringMethod !== Object.prototype.toString
      ) {
        const normalized = toStringMethod.call(id)
        if (typeof normalized === 'string') {
          return normalized
        }
      }

      try {
        const normalized = JSON.stringify(id)
        if (typeof normalized === 'string') {
          return normalized
        }
      } catch {
        // Fall through to fallback value
      }
      return '[object Object]'
    }
    return String(id)
  }

  /**
   * Initialize the data sync manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return
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
    } catch (error: unknown) {
      this.logger.error('Failed to initialize CrossRegionDataSyncManager', {
        error: this.errorContext(error),
      })
      throw error
    }
  }

  /**
   * Initialize CockroachDB connection
   */
  private async initializeCockroachDB(): Promise<void> {
    try {
      const cockroachConfig = this.getCockroachDBConfig()
      const cockroachClient = new CockroachDbClient({
        host: cockroachConfig.host,
        port: cockroachConfig.port,
        database: cockroachConfig.database,
        user: cockroachConfig.user,
        password: cockroachConfig.password,
      })
      if (!this.isCockroachClient(cockroachClient)) {
        throw new Error(
          'CockroachDB client initialization returned unexpected type',
        )
      }

      this.cockroachClient = cockroachClient

      await cockroachClient.connect()
      this.logger.info('CockroachDB connection established')

      // Create distributed tables
      await this.createDistributedTables()
    } catch (error: unknown) {
      this.logger.error('Failed to initialize CockroachDB connection', {
        error: this.errorContext(error),
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
        await this.getCockroachClient().query(table.schema)
        this.logger.info(`Created distributed table: ${table.name}`)
      } catch (error: unknown) {
        this.logger.error(`Failed to create table ${table.name}`, {
          error: this.errorContext(error),
        })
        throw error
      }
    }
  }

  /**
   * Initialize MongoDB connections for each region
   */
  private async initializeMongoDBConnections(): Promise<void> {
    const regions = this.getRegions()

    for (const region of regions) {
      try {
        const mongoConfig = this.getMongoDBConfig(region)

        const client = new MongoClient(mongoConfig.connectionString, {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        })

        await client.connect()
        this.mongoClients.set(region, client)

        this.logger.info(`MongoDB connection established for region: ${region}`)
      } catch (error: unknown) {
        this.logger.error(
          `Failed to initialize MongoDB for region: ${region}`,
          {
            error: this.errorContext(error),
          },
        )
        throw error
      }
    }
  }

  /**
   * Initialize Redis connections for caching
   */
  private async initializeRedisConnections(): Promise<void> {
    const regions = this.getRegions()

    for (const region of regions) {
      try {
        const redisConfig = this.getRedisConfig(region)

        const redisHost =
          typeof redisConfig.host === 'string' ? redisConfig.host : 'localhost'
        const redisPort = this.toNumber(redisConfig.port, 6379)
        const redisDb = this.toNumber(redisConfig.database, 0)
        const redisPassword =
          typeof redisConfig.password === 'string' &&
          redisConfig.password.length > 0
            ? `:${encodeURIComponent(redisConfig.password)}@`
            : ''
        const client = new Redis(
          `redis://${redisPassword}${redisHost}:${redisPort}/${redisDb}`,
          {
            maxRetriesPerRequest: 3,
            connectTimeout: 5000,
          },
        )

        // Test connection
        await client.ping()
        this.redisClients.set(region, client)

        this.logger.info(`Redis connection established for region: ${region}`)
      } catch (error: unknown) {
        this.logger.error(`Failed to initialize Redis for region: ${region}`, {
          error: this.errorContext(error),
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
      const clickhouseConfig = this.getClickHouseConfig()

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
    } catch (error: unknown) {
      this.logger.error('Failed to initialize ClickHouse', {
        error: this.errorContext(error),
      })
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
        await this.getClickhouseClient().command({
          query: table.schema,
          clickhouse_settings: {
            wait_end_of_query: 1,
          },
        })
        this.logger.info(`Created ClickHouse table: ${table.name}`)
      } catch (error: unknown) {
        this.logger.error(`Failed to create ClickHouse table ${table.name}`, {
          error: this.errorContext(error),
        })
        throw error
      }
    }
  }

  /**
   * Set up synchronization intervals
   */
  private setupSyncIntervals(): void {
    const syncConfig = this.getSyncConfig()

    // Real-time sync for critical data
    this.syncInterval = setInterval(() => {
      this.performRealTimeSync().catch((error) => {
        this.logger.error('Real-time sync failed', {
          error: this.errorContext(error),
        })
      })
    }, syncConfig.realTimeSyncInterval)

    // Batch sync for analytics data
    setInterval(() => {
      this.performBatchSync().catch((error) => {
        this.logger.error('Batch sync failed', {
          error: this.errorContext(error),
        })
      })
    }, syncConfig.batchSyncInterval)

    // Cleanup old sync logs
    setInterval(() => {
      this.cleanupSyncLogs().catch((error) => {
        this.logger.error('Sync log cleanup failed', {
          error: this.errorContext(error),
        })
      })
    }, syncConfig.cleanupInterval)

    this.logger.info('Sync intervals configured')
  }

  /**
   * Register health checks
   */
  private registerHealthChecks(): void {
    this.registerHealthCheck('cockroachdb', async () => {
      try {
        if (!this.cockroachClient)
          return {
            status: 'unhealthy',
            message: 'CockroachDB client not initialized',
          }

        await this.getCockroachClient().query('SELECT 1')
        return { status: 'healthy', message: 'CockroachDB connection active' }
      } catch (error: unknown) {
        return {
          status: 'unhealthy',
          message: `CockroachDB error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }
      }
    })

    this.registerHealthCheck('mongodb', async () => {
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
            } catch (error: unknown) {
              return {
                region,
                status: 'unhealthy',
                message: `MongoDB error: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      } catch (error: unknown) {
        return {
          status: 'unhealthy',
          message: `MongoDB health check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }
      }
    })

    this.registerHealthCheck('redis', async () => {
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
            } catch (error: unknown) {
              return {
                region,
                status: 'unhealthy',
                message: `Redis error: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      } catch (error: unknown) {
        return {
          status: 'unhealthy',
          message: `Redis health check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    } catch (error: unknown) {
      this.logger.error('Real-time sync failed', {
        error: this.errorContext(error),
      })
      throw error
    }
  }

  /**
   * Sync user data across regions
   */
  private async syncUserData(): Promise<void> {
    try {
      const regions = this.getRegions()
      const syncConfig = this.getSyncConfig()

      for (const region of regions) {
        const client = this.mongoClients.get(region)
        if (!client) continue

        const db = client.db()
        const usersCollection = db.collection<Record<string, unknown>>('users')

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
            await this.logSync(
              'users',
              'sync',
              this.normalizeRecordId(user._id),
              region,
              'completed',
            )
          } catch (error: unknown) {
            const userId = this.normalizeRecordId(user._id)
            this.logger.error(`Failed to sync user ${userId} from ${region}`, {
              error: this.errorContext(error),
            })
            await this.logSync(
              'users',
              'sync',
              userId,
              region,
              'failed',
              error instanceof Error ? error.message : 'Unknown error',
            )
          }
        }
      }
    } catch (error: unknown) {
      this.logger.error('User data sync failed', {
        error: this.errorContext(error),
      })
      throw error
    }
  }

  /**
   * Sync user to CockroachDB
   */
  private async syncUserToCockroachDB(
    user: Record<string, unknown>,
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
      this.normalizeRecordId(user['_id']),
      user['email'],
      user['username'],
      region,
      JSON.stringify(user['metadata'] ?? {}),
      user['createdAt'] ?? new Date(),
      user['updatedAt'] ?? new Date(),
    ]

    await this.getCockroachClient().query(query, values)
  }

  /**
   * Sync session data across regions
   */
  private async syncSessionData(): Promise<void> {
    try {
      const regions = this.getRegions()

      for (const region of regions) {
        const client = this.mongoClients.get(region)
        if (!client) continue

        const db = client.db()
        const sessionsCollection =
          db.collection<Record<string, unknown>>('sessions')

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
              this.normalizeRecordId(session._id),
              region,
              'completed',
            )
          } catch (error: unknown) {
            const sessionId = this.normalizeRecordId(session._id)
            this.logger.error(
              `Failed to sync session ${sessionId} from ${region}`,
              { error: this.errorContext(error) },
            )
            await this.logSync(
              'sessions',
              'sync',
              sessionId,
              region,
              'failed',
              error instanceof Error ? error.message : 'Unknown error',
            )
          }
        }
      }
    } catch (error: unknown) {
      this.logger.error('Session data sync failed', {
        error: this.errorContext(error),
      })
      throw error
    }
  }

  /**
   * Sync session to CockroachDB
   */
  private async syncSessionToCockroachDB(
    session: Record<string, unknown>,
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
      this.normalizeRecordId(session['_id']),
      this.normalizeRecordId(session['userId']),
      region,
      session['token'],
      session['expiresAt'],
      JSON.stringify(session['metadata'] ?? {}),
      session['createdAt'] ?? new Date(),
    ]

    await this.getCockroachClient().query(query, values)
  }

  /**
   * Sync conversation data across regions
   */
  private async syncConversationData(): Promise<void> {
    try {
      const regions = this.getRegions()

      for (const region of regions) {
        const client = this.mongoClients.get(region)
        if (!client) continue

        const db = client.db()
        const conversationsCollection =
          db.collection<Record<string, unknown>>('conversations')
        const messagesCollection =
          db.collection<Record<string, unknown>>('messages')

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
              const analysis = this.toRecord(message['aiAnalysis'])
              if (analysis) {
                await this.syncAIAnalysisToCockroachDB(
                  analysis,
                  this.normalizeRecordId(message._id),
                  this.normalizeRecordId(conversation['userId']),
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
              this.normalizeRecordId(conversation._id),
              region,
              'completed',
            )
          } catch (error: unknown) {
            const conversationId = this.normalizeRecordId(conversation._id)
            this.logger.error(
              `Failed to sync conversation ${conversationId} from ${region}`,
              {
                error: this.errorContext(error),
              },
            )
            await this.logSync(
              'conversations',
              'sync',
              conversationId,
              region,
              'failed',
              error instanceof Error ? error.message : 'Unknown error',
            )
          }
        }
      }
    } catch (error: unknown) {
      this.logger.error('Conversation data sync failed', {
        error: this.errorContext(error),
      })
      throw error
    }
  }

  /**
   * Sync conversation to CockroachDB
   */
  private async syncConversationToCockroachDB(
    conversation: Record<string, unknown>,
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
      this.normalizeRecordId(conversation['_id']),
      this.normalizeRecordId(conversation['userId']),
      region,
      conversation['title'],
      conversation['status'] ?? 'active',
      JSON.stringify(conversation['metadata'] ?? {}),
      conversation['createdAt'] ?? new Date(),
      conversation['updatedAt'] ?? new Date(),
    ]

    await this.getCockroachClient().query(query, values)
  }

  /**
   * Sync message to CockroachDB
   */
  private async syncMessageToCockroachDB(
    message: Record<string, unknown>,
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
      this.normalizeRecordId(message['_id']),
      this.normalizeRecordId(message['conversationId']),
      this.normalizeRecordId(message['userId']),
      region,
      message['content'],
      message['messageType'] ?? 'text',
      message['sentimentScore'] ?? null,
      JSON.stringify(message['metadata'] ?? {}),
      message['createdAt'] ?? new Date(),
    ]

    await this.getCockroachClient().query(query, values)
  }

  /**
   * Sync AI analysis to CockroachDB
   */
  private async syncAIAnalysisToCockroachDB(
    analysis: Record<string, unknown>,
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
      analysis['_id'] ?? uuidv4(),
      messageId,
      userId,
      region,
      analysis['analysisType'],
      analysis['biasScore'] ?? null,
      analysis['empathyScore'] ?? null,
      analysis['mentalHealthScore'] ?? null,
      JSON.stringify(analysis['recommendations'] ?? {}),
      analysis['createdAt'] ?? new Date(),
    ]

    await this.getCockroachClient().query(query, values)
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
      errorMessage ?? null,
    ]
    await this.getCockroachClient().query(query, values)
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

      const result = await this.getCockroachClient().query(query)
      const logRows = this.toRecordArray(result.rows)

      for (const log of logRows) {
        try {
          // Retry the failed operation
          await this.retrySyncOperation(log)

          // Update sync log
          await this.getCockroachClient().query(
            'UPDATE sync_log SET sync_status = $1, retry_count = retry_count + 1, updated_at = now() WHERE id = $2',
            ['completed', log['id']],
          )
        } catch (error: unknown) {
          this.logger.error(
            `Failed to retry sync operation ${this.toLogString(log['id'])}`,
            {
              error,
            },
          )

          // Update retry count
          await this.getCockroachClient().query(
            'UPDATE sync_log SET retry_count = retry_count + 1, error_message = $1, updated_at = now() WHERE id = $2',
            [
              error instanceof Error ? error.message : 'Unknown error',
              log['id'],
            ],
          )
        }
      }
    } catch (error: unknown) {
      this.logger.error(`Failed to process sync logs`, {
        error: this.errorContext(error),
      })
      throw error
    }
  }

  /**
   * Retry a failed sync operation
   */
  private async retrySyncOperation(
    log: Record<string, unknown>,
  ): Promise<void> {
    // Implementation depends on the specific operation
    const tableName = this.toLogString(log['table_name'])
    const recordId = this.toLogString(log['record_id'])
    this.logger.info(
      `Retrying sync operation for ${tableName} record ${recordId}`,
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
    } catch (error: unknown) {
      this.logger.error('Batch sync failed', {
        error: this.errorContext(error),
      })
      throw error
    }
  }

  /**
   * Sync performance metrics to ClickHouse
   */
  private async syncPerformanceMetrics(): Promise<void> {
    try {
      const regions = this.getRegions()
      const metrics: Array<{
        timestamp: Date
        region: string
        metric_name: string
        metric_value: number
        tags: string
      }> = []

      for (const region of regions) {
        const client = this.redisClients.get(region)
        if (!client) continue
        if (!this.isRedisClientWithHGetAll(client)) {
          continue
        }
        // Get performance metrics from Redis
        const rawMetrics = await client.hgetall(`metrics:${region}`)
        const regionMetrics = this.isStringRecord(rawMetrics) ? rawMetrics : {}

        for (const [metricName, metricValue] of Object.entries(regionMetrics)) {
          metrics.push({
            timestamp: new Date(),
            region,
            metric_name: metricName,
            metric_value: this.toNumberOrUndefined(metricValue) ?? 0,
            tags: JSON.stringify({ source: 'redis' }),
          })
        }
      }

      // Insert into ClickHouse
      if (metrics.length > 0) {
        await this.getClickhouseClient().insert({
          table: 'performance_metrics',
          values: metrics,
          format: 'JSONEachRow',
        })
      }

      this.logger.debug(`Synced ${metrics.length} performance metrics`)
    } catch (error: unknown) {
      this.logger.error('Failed to sync performance metrics', {
        error: this.errorContext(error),
      })
      throw error
    }
  }

  /**
   * Sync user analytics to ClickHouse
   */
  private async syncUserAnalytics(): Promise<void> {
    try {
      const regions = this.getRegions()
      const analytics: Array<{
        timestamp: Date
        user_id: string
        region: string
        event_type: string
        event_data: string
        session_id: string
        ip_address: string
        user_agent: string
      }> = []

      for (const region of regions) {
        const client = this.mongoClients.get(region)
        if (!client) continue

        const db = client.db()
        const analyticsCollection =
          db.collection<Record<string, unknown>>('user_analytics')

        // Get recent analytics data
        const recentAnalytics = await analyticsCollection
          .find({
            syncedAt: { $exists: false },
          })
          .limit(1000)
          .toArray()

        for (const analytic of recentAnalytics) {
          const userId = this.normalizeRecordId(analytic['userId'])
          const sessionId = this.normalizeRecordId(analytic['sessionId'])
          const eventType =
            typeof analytic['eventType'] === 'string'
              ? analytic['eventType']
              : ''
          const ipAddress =
            typeof analytic['ipAddress'] === 'string'
              ? analytic['ipAddress']
              : ''
          const userAgent =
            typeof analytic['userAgent'] === 'string'
              ? analytic['userAgent']
              : ''
          const eventData =
            typeof analytic['eventData'] === 'object'
              ? analytic['eventData']
              : {}

          analytics.push({
            timestamp:
              analytic['timestamp'] instanceof Date
                ? analytic['timestamp']
                : new Date(),
            user_id: userId || uuidv4(),
            region,
            event_type: eventType,
            event_data: JSON.stringify(eventData),
            session_id: sessionId || uuidv4(),
            ip_address: ipAddress,
            user_agent: userAgent,
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
        await this.getClickhouseClient().insert({
          table: 'user_analytics',
          values: analytics,
          format: 'JSONEachRow',
        })
      }

      this.logger.debug(`Synced ${analytics.length} user analytics events`)
    } catch (error: unknown) {
      this.logger.error('Failed to sync user analytics', {
        error: this.errorContext(error),
      })
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

      const result = await this.getCockroachClient().query(cleanupQuery)
      this.logger.debug(`Cleaned up ${result.rowCount} old sync logs`)
    } catch (error: unknown) {
      this.logger.error('Failed to cleanup old data', {
        error: this.errorContext(error),
      })
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

      const result = await this.getCockroachClient().query(query)
      this.logger.debug(`Cleaned up ${result.rowCount} old sync log entries`)
    } catch (error: unknown) {
      this.logger.error('Failed to cleanup sync logs', {
        error: this.errorContext(error),
      })
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

      const result = await this.getCockroachClient().query(query)

      const distribution: DataDistribution = {
        totalRecords: 0,
        pendingSync: 0,
        failedSync: 0,
        completedSync: 0,
        regions: {},
      }

      for (const row of result.rows) {
        const rowRecord = row
        const regionName = this.getRecordValueAsString(rowRecord, 'region')
        if (!regionName) continue

        distribution.regions[regionName] = {
          totalRecords: this.getRecordValueAsNumber(
            rowRecord,
            'total_records',
            0,
          ),
          pendingSync: this.getRecordValueAsNumber(
            rowRecord,
            'pending_sync',
            0,
          ),
          failedSync: this.getRecordValueAsNumber(rowRecord, 'failed_sync', 0),
          completedSync: this.getRecordValueAsNumber(
            rowRecord,
            'completed_sync',
            0,
          ),
        }

        distribution.totalRecords += this.getRecordValueAsNumber(
          rowRecord,
          'total_records',
          0,
        )
        distribution.pendingSync += this.getRecordValueAsNumber(
          rowRecord,
          'pending_sync',
          0,
        )
        distribution.failedSync += this.getRecordValueAsNumber(
          rowRecord,
          'failed_sync',
          0,
        )
        distribution.completedSync += this.getRecordValueAsNumber(
          rowRecord,
          'completed_sync',
          0,
        )
      }

      return distribution
    } catch (error: unknown) {
      this.logger.error('Failed to get data distribution', {
        error: this.errorContext(error),
      })
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
    } catch (error: unknown) {
      this.logger.error(`Force sync failed for ${tableName} in ${region}`, {
        error: this.errorContext(error),
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

      const result = await this.getCockroachClient().query(query, [region])
      if (result.rows.length > 0) {
        const row = result.rows[0]
        if (row !== undefined) {
          const lagSeconds = this.getRecordValueAsString(row, 'lag_seconds')
          if (typeof lagSeconds === 'string') {
            return parseFloat(lagSeconds)
          }
        }
      }

      return 0
    } catch (error: unknown) {
      this.logger.error(`Failed to get replication lag for ${region}`, {
        error: this.errorContext(error),
      })
      throw error
    }
  }

  /**
   * Shutdown the data sync manager
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return
    try {
      this.logger.info('Shutting down CrossRegionDataSyncManager...')

      // Clear sync intervals
      if (this.syncInterval) {
        clearInterval(this.syncInterval)
        this.syncInterval = null
      }

      // Close CockroachDB connection
      if (this.cockroachClient) {
        if (this.cockroachClient.end) {
          await this.cockroachClient.end()
        } else if (this.cockroachClient.close) {
          await this.cockroachClient.close()
        }
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
        await this.getClickhouseClient().close?.()
        this.clickhouseClient = null
      }

      this.isInitialized = false
      this.logger.info('CrossRegionDataSyncManager shutdown completed')

      this.emit('shutdown')
    } catch (error: unknown) {
      this.logger.error('Error during shutdown', {
        error: this.errorContext(error),
      })
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

export type { SyncStatus, DataDistribution }
