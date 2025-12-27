// Database Connection Management
// Centralized MongoDB and PostgreSQL connection setup

import mongoose from 'mongoose'
import { Pool, Client } from 'pg'
import Redis from 'ioredis'

// ============================================================================
// CONNECTION INSTANCES
// ============================================================================

let mongoConnection: typeof mongoose | null = null
let postgresPool: Pool | null = null
let redisClient: Redis | null = null

// ============================================================================
// MONGODB CONNECTION
// ============================================================================

export async function connectMongoDB() {
    if (mongoConnection) {
        return mongoConnection
    }

    try {
        const mongoUri = process.env.MONGODB_URI
        if (!mongoUri) {
            throw new Error('MONGODB_URI is not defined in environment variables')
        }

        mongoConnection = await mongoose.connect(mongoUri, {
            maxPoolSize: 10,
            minPoolSize: 2,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            retryWrites: true,
            w: 'majority'
        })

        // Event listeners
        mongoose.connection.on('connected', () => {
            console.log('MongoDB connected event')
        })

        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err)
        })

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected')
        })

        return mongoConnection
    } catch (error) {
        console.error('MongoDB connection failed:', error)
        throw error
    }
}

// ============================================================================
// POSTGRESQL CONNECTION
// ============================================================================

export async function connectPostgreSQL() {
    if (postgresPool) {
        return postgresPool
    }

    try {
        const postgresUri = process.env.DATABASE_URL
        if (!postgresUri) {
            throw new Error('DATABASE_URL is not defined in environment variables')
        }

        postgresPool = new Pool({
            connectionString: postgresUri,
            max: 20, // Maximum number of connections in pool
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000
        })

        // Test connection
        const client = await postgresPool.connect()
        const result = await client.query('SELECT NOW()')
        console.log('PostgreSQL connection test:', result.rows[0])
        client.release()

        // Event listeners
        postgresPool.on('error', (err) => {
            console.error('Unexpected error on idle client', err)
        })

        return postgresPool
    } catch (error) {
        console.error('PostgreSQL connection failed:', error)
        throw error
    }
}

// ============================================================================
// REDIS CONNECTION
// ============================================================================

export async function connectRedis() {
    if (redisClient) {
        return redisClient
    }

    try {
        const redisUrl = process.env.REDIS_URL
        if (!redisUrl) {
            throw new Error('REDIS_URL is not defined in environment variables')
        }

        redisClient = new Redis(redisUrl, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            retryStrategy: (times) => {
                return Math.min(times * 50, 2000);
            }
        })

        redisClient.on('connect', () => {
            console.log('Redis connected')
        })

        redisClient.on('error', (err) => {
            console.error('Redis connection error:', err)
        })

        // Test connection
        await redisClient.ping()
        console.log('Redis connection test: PONG')

        return redisClient
    } catch (error) {
        console.error('Redis connection failed:', error)
        throw error
    }
}

// ============================================================================
// GETTERS
// ============================================================================

export function getMongoConnection() {
    if (!mongoConnection) {
        throw new Error('MongoDB not connected. Call connectMongoDB() first.')
    }
    return mongoConnection
}

export function getPostgresPool() {
    if (!postgresPool) {
        throw new Error('PostgreSQL pool not created. Call connectPostgreSQL() first.')
    }
    return postgresPool
}

export function getRedisClient() {
    if (!redisClient) {
        throw new Error('Redis not connected. Call connectRedis() first.')
    }
    return redisClient
}

// ============================================================================
// DISCONNECT FUNCTIONS
// ============================================================================

export async function disconnectMongoDB() {
    if (mongoConnection) {
        await mongoose.disconnect()
        mongoConnection = null
        console.log('MongoDB disconnected')
    }
}

export async function disconnectPostgreSQL() {
    if (postgresPool) {
        await postgresPool.end()
        postgresPool = null
        console.log('PostgreSQL pool closed')
    }
}

export async function disconnectRedis() {
    if (redisClient) {
        await redisClient.quit()
        redisClient = null
        console.log('Redis disconnected')
    }
}

export async function disconnectAll() {
    await Promise.all([
        disconnectMongoDB(),
        disconnectPostgreSQL(),
        disconnectRedis()
    ])
}

// ============================================================================
// TRANSACTION HELPERS
// ============================================================================

export async function withPostgresTransaction<T>(
    callback: (client: Client) => Promise<T>
): Promise<T> {
    const pool = getPostgresPool()
    const client = await pool.connect()

    try {
        await client.query('BEGIN')
        const result = await callback(client)
        await client.query('COMMIT')
        return result
    } catch (error) {
        await client.query('ROLLBACK')
        throw error
    } finally {
        client.release()
    }
}

export async function withMongoSession<T>(
    callback: (session: any) => Promise<T>
): Promise<T> {
    const connection = getMongoConnection()
    const session = await connection.startSession()

    try {
        session.startTransaction()
        const result = await callback(session)
        await session.commitTransaction()
        return result
    } catch (error) {
        await session.abortTransaction()
        throw error
    } finally {
        await session.endSession()
    }
}
