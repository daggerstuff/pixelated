import { Pool, type PoolClient } from 'pg'
import mongoose, { type Connection as MongoConnection } from 'mongoose'
import Redis from 'ioredis'
import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('db-client')

let pgPool: Pool | null = null
let mongoConn: MongoConnection | null = null
let redisClient: Redis | null = null

export interface PgClient {
  query(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>
}

export function getPostgresPool(): Pool {
  if (!pgPool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set')
    }
    pgPool = new Pool({
      connectionString,
      max: parseInt(process.env.PG_POOL_MAX ?? '20', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
    pgPool.on('error', (err) => {
      logger.error('PostgreSQL pool error', { error: err.message })
    })
  }
  return pgPool
}

export async function getPostgresClient(): Promise<PgClient> {
  return getPostgresPool()
}

export async function withPostgresClient<T>(
  fn: (client: PgClient) => Promise<T>,
): Promise<T> {
  const pool = getPostgresPool()
  const client = await pool.connect()
  try {
    return await fn(client as unknown as PgClient)
  } finally {
    client.release()
  }
}

export async function getMongoConnection(): Promise<MongoConnection> {
  if (!mongoConn) {
    const uri = process.env.MONGODB_URI
    if (!uri) {
      throw new Error('MONGODB_URI is not set')
    }
    mongoose.set('strictQuery', true)
    await mongoose.connect(uri)
    mongoConn = mongoose.connection
    mongoConn.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err.message })
    })
  }
  return mongoConn
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    const url = process.env.REDIS_URL
    if (!url) {
      throw new Error('REDIS_URL is not set')
    }
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    })
    redisClient.on('error', (err) => {
      logger.error('Redis connection error', { error: err.message })
    })
  }
  return redisClient
}

export async function closeAllConnections(): Promise<void> {
  const tasks: Promise<unknown>[] = []
  if (pgPool) { tasks.push(pgPool.end()) }
  if (mongoConn) { tasks.push(mongoose.disconnect()) }
  if (redisClient) { tasks.push(redisClient.quit()) }
  await Promise.allSettled(tasks)
  pgPool = null
  mongoConn = null
  redisClient = null
}

export { mongoose }
