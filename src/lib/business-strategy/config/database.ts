/**
 * Database Configuration for Business Strategy System
 * 
 * Integrates with existing Pixelated Empathy database infrastructure
 * while maintaining separation of concerns for business strategy data
 */

import type { MongoClient, Db } from 'mongodb'
import type { Pool } from 'pg'
import type { Redis } from 'ioredis'

// Re-use existing database connections from main system
import { getMongoClient } from '@/lib/database/mongodb'
import { getPostgresPool } from '@/lib/database/postgres'
import { getRedisClient } from '@/lib/database/redis'

export interface DatabaseConfig {
    mongodb: {
        client: MongoClient
        database: Db
        collections: {
            documents: string
            users: string
            workflows: string
            marketAnalysis: string
            competitors: string
            marketingTactics: string
            auditLogs: string
        }
    }
    postgresql: {
        pool: Pool
        schema: string
        tables: {
            users: string
            permissions: string
            sessions: string
            workflows: string
            approvals: string
        }
    }
    redis: {
        client: Redis
        keyPrefixes: {
            sessions: string
            cache: string
            locks: string
            queues: string
        }
    }
}

// Database configuration
const DB_CONFIG = {
    mongodb: {
        databaseName: process.env.BUSINESS_STRATEGY_DB_NAME || 'pixelated_business_strategy',
        collections: {
            documents: 'documents',
            users: 'users',
            workflows: 'workflow_executions',
            marketAnalysis: 'market_analysis',
            competitors: 'competitors',
            marketingTactics: 'marketing_tactics',
            auditLogs: 'audit_logs',
        },
    },
    postgresql: {
        schema: 'business_strategy',
        tables: {
            users: 'users',
            permissions: 'permissions',
            sessions: 'sessions',
            workflows: 'workflow_definitions',
            approvals: 'approvals',
        },
    },
    redis: {
        keyPrefixes: {
            sessions: 'bs:session:',
            cache: 'bs:cache:',
            locks: 'bs:lock:',
            queues: 'bs:queue:',
        },
    },
} as const

let databaseConfig: DatabaseConfig | null = null

/**
 * Initialize database connections for business strategy system
 */
export async function initializeDatabases(): Promise<DatabaseConfig> {
    if (databaseConfig) {
        return databaseConfig
    }

    try {
        // Get existing database connections
        const mongoClient = await getMongoClient()
        const postgresPool = await getPostgresPool()
        const redisClient = await getRedisClient()

        // Get MongoDB database instance
        const mongoDb = mongoClient.db(DB_CONFIG.mongodb.databaseName)

        // Ensure collections exist with proper indexes
        await ensureMongoCollections(mongoDb)

        // Ensure PostgreSQL schema and tables exist
        await ensurePostgresSchema(postgresPool)

        databaseConfig = {
            mongodb: {
                client: mongoClient,
                database: mongoDb,
                collections: DB_CONFIG.mongodb.collections,
            },
            postgresql: {
                pool: postgresPool,
                schema: DB_CONFIG.postgresql.schema,
                tables: DB_CONFIG.postgresql.tables,
            },
            redis: {
                client: redisClient,
                keyPrefixes: DB_CONFIG.redis.keyPrefixes,
            },
        }

        return databaseConfig
    } catch (error) {
        console.error('Failed to initialize business strategy databases:', error)
        throw new Error('Database initialization failed')
    }
}

/**
 * Get initialized database configuration
 */
export function getDatabaseConfig(): DatabaseConfig {
    if (!databaseConfig) {
        throw new Error('Database not initialized. Call initializeDatabases() first.')
    }
    return databaseConfig
}

/**
 * Ensure MongoDB collections exist with proper indexes
 */
async function ensureMongoCollections(db: Db): Promise<void> {
    const collections = DB_CONFIG.mongodb.collections

    // Create collections if they don't exist
    const existingCollections = await db.listCollections().toArray()
    const existingNames = existingCollections.map(c => c.name)

    for (const [key, collectionName] of Object.entries(collections)) {
        if (!existingNames.includes(collectionName)) {
            await db.createCollection(collectionName)
        }

        // Create indexes based on collection type
        const collection = db.collection(collectionName)

        switch (key) {
            case 'documents':
                await collection.createIndexes([
                    { key: { title: 'text', content: 'text' } },
                    { key: { createdBy: 1, createdAt: -1 } },
                    { key: { status: 1, type: 1 } },
                    { key: { 'category.id': 1 } },
                    { key: { tags: 1 } },
                    { key: { slug: 1 }, unique: true },
                ])
                break

            case 'users':
                await collection.createIndexes([
                    { key: { email: 1 }, unique: true },
                    { key: { role: 1, isActive: 1 } },
                    { key: { 'teams': 1 } },
                ])
                break

            case 'workflows':
                await collection.createIndexes([
                    { key: { workflowId: 1, status: 1 } },
                    { key: { documentId: 1 } },
                    { key: { 'context.triggeredBy': 1 } },
                    { key: { startedAt: -1 } },
                ])
                break

            case 'marketAnalysis':
                await collection.createIndexes([
                    { key: { marketId: 1 } },
                    { key: { analysisType: 1, analysisDate: -1 } },
                    { key: { 'recommendation.strategy': 1 } },
                ])
                break

            case 'competitors':
                await collection.createIndexes([
                    { key: { name: 1 } },
                    { key: { marketPosition: 1 } },
                    { key: { lastUpdated: -1 } },
                ])
                break

            case 'marketingTactics':
                await collection.createIndexes([
                    { key: { category: 1, effortLevel: 1 } },
                    { key: { status: 1 } },
                    { key: { expectedImpact: -1 } },
                ])
                break

            case 'auditLogs':
                await collection.createIndexes([
                    { key: { entityId: 1, entityType: 1 } },
                    { key: { userId: 1, timestamp: -1 } },
                    { key: { action: 1 } },
                    { key: { timestamp: -1 } },
                ])
                break
        }
    }
}

/**
 * Ensure PostgreSQL schema and tables exist
 */
async function ensurePostgresSchema(pool: Pool): Promise<void> {
    const client = await pool.connect()

    try {
        const schema = DB_CONFIG.postgresql.schema

        // Create schema if it doesn't exist
        await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`)

        // Create tables
        await client.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.workflow_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        is_active BOOLEAN NOT NULL DEFAULT true,
        definition JSONB NOT NULL,
        permissions JSONB NOT NULL DEFAULT '{}',
        analytics JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID NOT NULL,
        last_modified_by UUID NOT NULL
      )
    `)

        await client.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.approvals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_execution_id UUID NOT NULL,
        step_id VARCHAR(255) NOT NULL,
        approver_id UUID NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        decision VARCHAR(50),
        feedback TEXT,
        decided_at TIMESTAMP WITH TIME ZONE,
        delegated_to UUID,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `)

        // Create indexes
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_workflow_definitions_name 
      ON ${schema}.workflow_definitions(name)
    `)

        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_workflow_definitions_active 
      ON ${schema}.workflow_definitions(is_active, version)
    `)

        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_approvals_workflow_execution 
      ON ${schema}.approvals(workflow_execution_id, step_id)
    `)

        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_approvals_approver_status 
      ON ${schema}.approvals(approver_id, status)
    `)

    } finally {
        client.release()
    }
}

/**
 * Health check for all database connections
 */
export async function checkDatabaseHealth(): Promise<{
    mongodb: boolean
    postgresql: boolean
    redis: boolean
}> {
    const config = getDatabaseConfig()

    const results = {
        mongodb: false,
        postgresql: false,
        redis: false,
    }

    try {
        // Check MongoDB
        await config.mongodb.client.db('admin').command({ ping: 1 })
        results.mongodb = true
    } catch (error) {
        console.error('MongoDB health check failed:', error)
    }

    try {
        // Check PostgreSQL
        const client = await config.postgresql.pool.connect()
        await client.query('SELECT 1')
        client.release()
        results.postgresql = true
    } catch (error) {
        console.error('PostgreSQL health check failed:', error)
    }

    try {
        // Check Redis
        await config.redis.client.ping()
        results.redis = true
    } catch (error) {
        console.error('Redis health check failed:', error)
    }

    return results
}