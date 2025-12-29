import mongoose from 'mongoose'
import { Pool } from 'pg'
import { createClient } from 'redis'
import { logger } from '@/utils/logger'

// MongoDB connection
export const connectMongoDB = async (): Promise<void> => {
  try {
    const mongoUri =
      process.env.MONGODB_URI ||
      'mongodb://localhost:27017/business-strategy-cms'

    await mongoose.connect(mongoUri)

    logger.info('MongoDB connected successfully')

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err)
    })

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected')
    })

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected')
    })
  } catch (error) {
    logger.error('MongoDB connection failed:', error)
    throw error
  }
}

// PostgreSQL connection pool
export const postgresPool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'business_strategy_cms',
  user: process.env.POSTGRES_USER || 'admin',
  password: process.env.POSTGRES_PASSWORD || 'password',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Test PostgreSQL connection
export const testPostgresConnection = async (): Promise<void> => {
  try {
    const client = await postgresPool.connect()
    logger.info('PostgreSQL connected successfully')
    client.release()
  } catch (error) {
    logger.error('PostgreSQL connection failed:', error)
    throw error
  }
}

// Redis connection
export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
})

export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.connect()
    logger.info('Redis connected successfully')

    // Handle connection events
    redisClient.on('error', (err) => {
      logger.error('Redis connection error:', err)
    })

    redisClient.on('end', () => {
      logger.warn('Redis disconnected')
    })
  } catch (error) {
    logger.error('Redis connection failed:', error)
    throw error
  }
}

// Initialize all database connections
export const initializeDatabases = async (): Promise<void> => {
  try {
    await Promise.all([
      connectMongoDB(),
      testPostgresConnection(),
      connectRedis(),
    ])
    logger.info('All database connections established successfully')
  } catch (error) {
    logger.error('Failed to initialize database connections:', error)
    throw error
  }
}

// Graceful shutdown
export const closeDatabaseConnections = async (): Promise<void> => {
  try {
    await Promise.all([
      mongoose.connection.close(),
      postgresPool.end(),
      redisClient.quit(),
    ])
    logger.info('All database connections closed successfully')
  } catch (error) {
    logger.error('Error closing database connections:', error)
  }
}
