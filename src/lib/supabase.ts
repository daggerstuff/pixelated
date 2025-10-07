// MongoDB-based library utilities
// This file provides MongoDB connection and utilities to replace Supabase functionality

import mongodb from '../config/mongodb.config'
import { mongoAuthService } from '../services/mongoAuth.service'

// MongoDB client type
export type MongoDBClient = typeof mongodb

// Environment variable helpers
interface ProcessEnv {
  NODE_ENV?: string
  MONGODB_URI?: string
  MONGODB_DB_NAME?: string
  JWT_SECRET?: string
  [key: string]: string | undefined
}

const processEnv = (
  typeof process !== 'undefined' ? process.env : {}
) as ProcessEnv

// NODE_ENV was only used in a removed variable

/**
 * Get environment variable with fallbacks
 */
function getEnvVar(keys: string[], fallback?: string): string {
  for (const key of keys) {
    const value = processEnv[key]
    if (value) {
      return value
    }
  }

  if (fallback) {
    return fallback
  }

  const keyList = keys.join(', ')
  throw new Error(`Missing required environment variable(s): ${keyList}`)
}

/**
 * Get MongoDB connection URI
 */
export function getMongoDBUri(): string {
  return getEnvVar(['MONGODB_URI'], 'mongodb://localhost:27017')
}

/**
 * Get MongoDB database name
 */
export function getMongoDBName(): string {
  return getEnvVar(['MONGODB_DB_NAME'], 'pixelated_empathy')
}

/**
 * Get JWT secret for authentication
 */
export function getJWTSecret(): string {
  return getEnvVar(['JWT_SECRET'], 'development-secret-change-in-production')
}

/**
 * Initialize MongoDB connection
 */
export async function initializeDatabase() {
  try {
    await mongodb.connect()
    console.log('✅ MongoDB connected successfully')
    return true
  } catch (error: unknown) {
    console.error('❌ Failed to connect to MongoDB:', error)
    return false
  }
}

/**
 * Get MongoDB health status
 */
export async function getDatabaseHealth() {
  try {
    const isHealthy = await mongodb.healthCheck()
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      type: 'mongodb',
      database: getMongoDBName(),
    }
  } catch (error: unknown) {
    return {
      status: 'unhealthy',
      type: 'mongodb',
      error: error instanceof Error ? String(error) : 'Unknown error',
    }
  }
}

// Export MongoDB client instance
export const mongoClient = mongodb
// Prefer adapter-based auth exports for application code
export { default as authAdapter } from '@/adapters/betterAuthMongoAdapter'
export const authService = mongoAuthService // legacy export; prefer `authAdapter`

// Export commonly used utilities
export { mongodb as default, mongoAuthService }

console.log('📦 MongoDB library initialized')
