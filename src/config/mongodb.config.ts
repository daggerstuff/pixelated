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
    compressors?: string[]
    directConnection?: boolean
  }
}

class MongoDB {
  [x: string]: any
  private static instance: MongoDB
  private client: MongoClient | null = null
  private db: Db | null = null
  private config: MongoConfig

  private constructor() {
    this.config = {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
      dbName: process.env.MONGODB_DB_NAME || 'pixelated_empathy',
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

  public static getInstance(): MongoDB {
    if (!MongoDB.instance) {
      MongoDB.instance = new MongoDB()
    }
    return MongoDB.instance
  }

  public async connect(): Promise<Db> {
    if (this.db) {
      return this.db
    }

    try {
      this.client = new MongoClient(this.config.uri, this.config.options)
      await this.client.connect()
      this.db = this.client.db(this.config.dbName)

      console.log(`✅ Connected to MongoDB database: ${this.config.dbName}`)
      return this.db
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error)
      throw error
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
      this.db = null
      console.log('🔌 Disconnected from MongoDB')
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
      await this.db.admin().ping()
      return true
    } catch (error) {
      console.error('MongoDB health check failed:', error)
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
