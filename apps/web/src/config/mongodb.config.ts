import { Db, MongoClient } from 'mongodb'

interface MongoConfig {
  uri: string
  dbName: string
  options?: {
    maxPoolSize?: number
    minPoolSize?: number
    maxIdleTimeMS?: number
    serverSelectionTimeoutMS?: number
    connectTimeoutMS?: number
    socketTimeoutMS?: number
    heartbeatFrequencyMS?: number
    retryWrites?: boolean
    retryReads?: boolean
    compressors?: ('zlib' | 'none' | 'snappy' | 'zstd')[]
    directConnection?: boolean
  }
}

class MongoDB {
  private static instance: MongoDB | null = null
  private client: MongoClient | null = null
  private db: Db | null = null
  private readonly config: MongoConfig

  private constructor() {
    // Build MongoDB URI from environment variables
    const mongoUri = this.buildMongoDBUri()

    this.config = {
      uri: mongoUri,
      dbName: process.env['MONGODB_DB_NAME'] ?? 'pixelated_empathy',
      options: {
        // Connection pool settings
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,

        // Timeout settings
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 0, // No timeout for socket operations

        // Monitoring and reliability
        heartbeatFrequencyMS: 10000,
        retryWrites: true,
        retryReads: true,

        // Compression for better performance
        compressors: ['zlib'],
      },
    }
  }

  /**
   * Build MongoDB URI from environment variables
   */
  private buildMongoDBUri(): string {
    const metaEnv = import.meta.env?.['MONGODB_URI']

    if (metaEnv && process.env['MONGODB_URI'] === undefined) {
      process.env['MONGODB_URI'] = metaEnv
    }
    const mongoUri = process.env['MONGODB_URI']

    if (mongoUri) {
      return mongoUri
    }

    // Build URI from components for MongoDB Atlas
    const username = process.env['MONGODB_USERNAME']
    const password = process.env['MONGODB_PASSWORD']
    const cluster = process.env['MONGODB_CLUSTER']

    if (username && password && cluster) {
      return `mongodb+srv://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${cluster}/?retryWrites=true&w=majority`
    }

    // Fallback to localhost for development
    return 'mongodb://localhost:27017'
  }

  public static getInstance(): MongoDB {
    MongoDB.instance ??= new MongoDB()
    return MongoDB.instance
  }

  public async connect(): Promise<Db> {
    if (this.db) {
      return this.db
    }

    this.client = new MongoClient(this.config.uri, this.config.options)
    await this.client.connect()
    this.db = this.client.db(this.config.dbName)

    return this.db
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
      this.db = null
    }
  }

  public getDb(): Db {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.')
    }
    return this.db
  }

  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.db) {
        await this.connect()
      }

      const db = this.db
      if (!db) {
        return false
      }

      await db.admin().ping()
      return true
    } catch (error: unknown) {
      return false
    }
  }

  public getConnectionInfo(): {
    uri: string
    dbName: string
    connected: boolean
  } {
    return {
      uri: this.config.uri,
      dbName: this.config.dbName,
      connected: this.db !== null,
    }
  }
}

export const mongodb = MongoDB.getInstance()
export default mongodb
