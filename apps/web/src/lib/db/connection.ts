// Database Connection Management
// Centralized MongoDB and PostgreSQL connection setup

import Redis from 'ioredis'
import mongoose from 'mongoose'
import type { Connection } from 'mongoose'
import { Pool } from 'pg'

import { getPool as getDbPool, initializeDatabase } from '../db'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
const logger = createBuildSafeLogger('connection')

// ============================================================================
// CONNECTION INSTANCES
// ============================================================================

type MongoConnection = Connection
let mongoConnection: MongoConnection | null = null
let postgresPool: Pool | null = null
/** Whether `connectPostgreSQL()` has completed at least once. */
let postgresConnected = false
let redisClient: Redis | null = null

// ============================================================================
// MONGODB CONNECTION
// ============================================================================

export async function connectMongoDB(): Promise<MongoConnection> {
  if (mongoConnection) {
    return mongoConnection
  }

  try {
    const mongoUri = process.env['MONGODB_URI']
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables')
    }

    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: 'majority',
    })
    mongoConnection = mongoose.connection

    // Event listeners
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connected event')
    })

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err)
    })

    mongoose.connection.on('disconnected', () => {
      logger.info('MongoDB disconnected')
    })

    return mongoConnection
  } catch (error: unknown) {
    logger.error('MongoDB connection failed:', error)
    throw error
  }
}

// ============================================================================
// POSTGRESQL CONNECTION
// ============================================================================

export async function connectPostgreSQL(): Promise<Pool> {
  // Resolve the pool the db module owns right now. It discards and rebuilds
  // its pool on a transient connection failure, so a reference cached at
  // connect time can be an ended pool.
  initializeDatabase()
  const sharedPool = getDbPool()
  if (postgresPool !== sharedPool) {
    postgresPool = sharedPool
    // Event listeners belong to the instance, not the module: a rebuilt pool
    // needs its own.
    sharedPool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err)
    })
  }

  try {
    // Test connection
    const client = await sharedPool.connect()
    const result = await client.query('SELECT NOW()')
    logger.info('PostgreSQL connection test:', result.rows[0])
    client.release()
    postgresConnected = true
    return sharedPool
  } catch (error: unknown) {
    logger.error('PostgreSQL connection failed:', error)
    throw error
  }
}

// ============================================================================
// REDIS CONNECTION
// ============================================================================

export async function connectRedis(): Promise<Redis> {
  if (redisClient) {
    return redisClient
  }

  try {
    const redisUrl = process.env['REDIS_URL']
    if (!redisUrl) {
      throw new Error('REDIS_URL is not defined in environment variables')
    }
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => {
        return Math.min(times * 50, 2000)
      },
    })

    redisClient.on('connect', () => {
      logger.info('Redis connected')
    })

    redisClient.on('error', (err) => {
      logger.error('Redis connection error:', err)
    })

    // Test connection
    await redisClient.ping()
    logger.info('Redis connection test: PONG')

    return redisClient
  } catch (error: unknown) {
    logger.error('Redis connection failed:', error)
    throw error
  }
}

// ============================================================================
// SETTERS
// ============================================================================

export function setPostgresPool(pool: Pool | null): void {
  postgresPool = pool
  postgresConnected = pool !== null
}

export function setRedisClient(client: Redis | null): void {
  redisClient = client
}

// ============================================================================
// GETTERS
// ============================================================================

export function getMongoConnection(): MongoConnection {
  if (!mongoConnection) {
    throw new Error('MongoDB not connected. Call connectMongoDB() first.')
  }
  return mongoConnection
}

export function getPostgresPool(): Pool {
  if (!postgresConnected) {
    throw new Error(
      'PostgreSQL pool not created. Call connectPostgreSQL() first.',
    )
  }
  // Hand out the pool the db module owns now: after a rebuild the cached
  // reference is an ended instance, and ten consumers hold this getter.
  const sharedPool = getDbPool()
  postgresPool = sharedPool
  return sharedPool
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error('Redis not connected. Call connectRedis() first.')
  }
  return redisClient
}

// ============================================================================
// DISCONNECT FUNCTIONS
// ============================================================================

export async function disconnectMongoDB(): Promise<void> {
  if (mongoConnection) {
    await mongoose.disconnect()
    mongoConnection = null
    logger.info('MongoDB disconnected')
  }
}

export async function disconnectPostgreSQL(): Promise<void> {
  const pool = postgresPool
  postgresPool = null
  postgresConnected = false
  if (pool) {
    await pool.end()
    logger.info('PostgreSQL pool closed')
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
    logger.info('Redis disconnected')
  }
}
