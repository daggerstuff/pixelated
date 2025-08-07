#!/usr/bin/env node

/**
 * MongoDB Database Initialization Script
 * This script sets up the initial MongoDB database structure, indexes, and collections
 */

import { config } from 'dotenv'
import { MongoClient } from 'mongodb'

// Load environment variables
config()

class MongoDB {
  constructor() {
    this.uri = process.env.MONGODB_URI || 'mongodb://localhost:27017'
    this.dbName = process.env.MONGODB_DB_NAME || 'pixelated_empathy'
    this.client = null
    this.db = null
  }

  async connect() {
    if (this.db) {
      return this.db
    }

    try {
      this.client = new MongoClient(this.uri, {
        maxPoolSize: 10,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000,
      })
      await this.client.connect()
      this.db = this.client.db(this.dbName)

      console.log(`Connected to MongoDB database: ${this.dbName}`)
      return this.db
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error)
      throw error
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close()
      this.client = null
      this.db = null
      console.log('Disconnected from MongoDB')
    }
  }
}

const mongodb = new MongoDB()

async function initializeDatabase() {
  try {
    console.log('🚀 Starting MongoDB database initialization...')

    // Connect to MongoDB
    const db = await mongodb.connect()
    console.log('✅ Connected to MongoDB')

    // Create collections with validation schemas
    const collections = [
      {
        name: 'users',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: [
              'email',
              'password',
              'role',
              'emailVerified',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              email: {
                bsonType: 'string',
                pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
              },
              password: { bsonType: 'string', minLength: 8 },
              role: {
                bsonType: 'string',
                enum: ['admin', 'user', 'therapist'],
              },
              emailVerified: { bsonType: 'bool' },
              profile: {
                bsonType: 'object',
                properties: {
                  firstName: { bsonType: 'string' },
                  lastName: { bsonType: 'string' },
                  avatarUrl: { bsonType: 'string' },
                  bio: { bsonType: 'string' },
                },
              },
              createdAt: { bsonType: 'date' },
              updatedAt: { bsonType: 'date' },
            },
          },
        },
      },
      {
        name: 'sessions',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['userId', 'token', 'expiresAt', 'createdAt'],
            properties: {
              userId: { bsonType: 'objectId' },
              token: { bsonType: 'string' },
              expiresAt: { bsonType: 'date' },
              createdAt: { bsonType: 'date' },
            },
          },
        },
      },
      {
        name: 'todos',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['name', 'completed', 'createdAt', 'updatedAt'],
            properties: {
              name: { bsonType: 'string', minLength: 1 },
              description: { bsonType: 'string' },
              completed: { bsonType: 'bool' },
              userId: { bsonType: 'objectId' },
              createdAt: { bsonType: 'date' },
              updatedAt: { bsonType: 'date' },
            },
          },
        },
      },
      {
        name: 'ai_metrics',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: [
              'userId',
              'sessionId',
              'modelName',
              'requestType',
              'tokensUsed',
              'responseTime',
              'timestamp',
            ],
            properties: {
              userId: { bsonType: 'objectId' },
              sessionId: { bsonType: 'string' },
              modelName: { bsonType: 'string' },
              requestType: { bsonType: 'string' },
              tokensUsed: { bsonType: 'int', minimum: 0 },
              responseTime: { bsonType: 'int', minimum: 0 },
              timestamp: { bsonType: 'date' },
            },
          },
        },
      },
      {
        name: 'bias_detection',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: [
              'userId',
              'sessionId',
              'detectedBias',
              'biasType',
              'confidence',
              'contextSnippet',
              'timestamp',
            ],
            properties: {
              userId: { bsonType: 'objectId' },
              sessionId: { bsonType: 'string' },
              detectedBias: { bsonType: 'string' },
              biasType: { bsonType: 'string' },
              confidence: { bsonType: 'double', minimum: 0, maximum: 1 },
              contextSnippet: { bsonType: 'string' },
              timestamp: { bsonType: 'date' },
            },
          },
        },
      },
      {
        name: 'treatment_plans',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: [
              'userId',
              'therapistId',
              'title',
              'goals',
              'interventions',
              'status',
              'startDate',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              userId: { bsonType: 'objectId' },
              therapistId: { bsonType: 'objectId' },
              title: { bsonType: 'string', minLength: 1 },
              description: { bsonType: 'string' },
              goals: { bsonType: 'array', items: { bsonType: 'string' } },
              interventions: {
                bsonType: 'array',
                items: { bsonType: 'string' },
              },
              status: {
                bsonType: 'string',
                enum: ['active', 'completed', 'paused'],
              },
              startDate: { bsonType: 'date' },
              endDate: { bsonType: 'date' },
              createdAt: { bsonType: 'date' },
              updatedAt: { bsonType: 'date' },
            },
          },
        },
      },
      {
        name: 'crisis_session_flags',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: [
              'userId',
              'sessionId',
              'flagType',
              'severity',
              'description',
              'resolved',
              'createdAt',
            ],
            properties: {
              userId: { bsonType: 'objectId' },
              sessionId: { bsonType: 'string' },
              flagType: {
                bsonType: 'string',
                enum: ['suicide_risk', 'self_harm', 'crisis'],
              },
              severity: {
                bsonType: 'string',
                enum: ['low', 'medium', 'high', 'critical'],
              },
              description: { bsonType: 'string', minLength: 1 },
              resolved: { bsonType: 'bool' },
              resolvedAt: { bsonType: 'date' },
              resolvedBy: { bsonType: 'objectId' },
              createdAt: { bsonType: 'date' },
            },
          },
        },
      },
      {
        name: 'consent_management',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['userId', 'consentType', 'granted', 'version'],
            properties: {
              userId: { bsonType: 'objectId' },
              consentType: { bsonType: 'string' },
              granted: { bsonType: 'bool' },
              version: { bsonType: 'string' },
              grantedAt: { bsonType: 'date' },
              revokedAt: { bsonType: 'date' },
              ipAddress: { bsonType: 'string' },
            },
          },
        },
      },
    ]

    // Create collections
    for (const collection of collections) {
      try {
        await db.createCollection(collection.name, {
          validator: collection.validator,
        })
        console.log(`✅ Created collection: ${collection.name}`)
      } catch (error) {
        if (error.code === 48) {
          console.log(`⚠️  Collection ${collection.name} already exists`)
        } else {
          throw error
        }
      }
    }

    // Create indexes
    const indexes = [
      // Users collection indexes
      { collection: 'users', index: { email: 1 }, options: { unique: true } },
      { collection: 'users', index: { role: 1 } },
      { collection: 'users', index: { createdAt: 1 } },
      {
        collection: 'users',
        index: { emailVerificationToken: 1 },
        options: { sparse: true },
      },
      {
        collection: 'users',
        index: { passwordResetToken: 1 },
        options: { sparse: true },
      },

      // Sessions collection indexes
      { collection: 'sessions', index: { userId: 1 } },
      {
        collection: 'sessions',
        index: { token: 1 },
        options: { unique: true },
      },
      {
        collection: 'sessions',
        index: { expiresAt: 1 },
        options: { expireAfterSeconds: 0 },
      },

      // Todos collection indexes
      { collection: 'todos', index: { userId: 1 } },
      { collection: 'todos', index: { completed: 1 } },
      { collection: 'todos', index: { createdAt: 1 } },

      // AI Metrics collection indexes
      { collection: 'ai_metrics', index: { userId: 1 } },
      { collection: 'ai_metrics', index: { sessionId: 1 } },
      { collection: 'ai_metrics', index: { timestamp: 1 } },
      { collection: 'ai_metrics', index: { modelName: 1 } },

      // Bias Detection collection indexes
      { collection: 'bias_detection', index: { userId: 1 } },
      { collection: 'bias_detection', index: { sessionId: 1 } },
      { collection: 'bias_detection', index: { biasType: 1 } },
      { collection: 'bias_detection', index: { timestamp: 1 } },

      // Treatment Plans collection indexes
      { collection: 'treatment_plans', index: { userId: 1 } },
      { collection: 'treatment_plans', index: { therapistId: 1 } },
      { collection: 'treatment_plans', index: { status: 1 } },
      { collection: 'treatment_plans', index: { startDate: 1 } },

      // Crisis Session Flags collection indexes
      { collection: 'crisis_session_flags', index: { userId: 1 } },
      { collection: 'crisis_session_flags', index: { sessionId: 1 } },
      { collection: 'crisis_session_flags', index: { flagType: 1 } },
      { collection: 'crisis_session_flags', index: { severity: 1 } },
      { collection: 'crisis_session_flags', index: { resolved: 1 } },
      { collection: 'crisis_session_flags', index: { createdAt: 1 } },

      // Consent Management collection indexes
      {
        collection: 'consent_management',
        index: { userId: 1, consentType: 1 },
        options: { unique: true },
      },
      { collection: 'consent_management', index: { granted: 1 } },
      { collection: 'consent_management', index: { grantedAt: 1 } },
    ]

    for (const indexDef of indexes) {
      try {
        await db
          .collection(indexDef.collection)
          .createIndex(indexDef.index, indexDef.options || {})
        console.log(
          `✅ Created index on ${indexDef.collection}: ${JSON.stringify(indexDef.index)}`,
        )
      } catch (error) {
        if (error.code === 85) {
          console.log(
            `⚠️  Index already exists on ${indexDef.collection}: ${JSON.stringify(indexDef.index)}`,
          )
        } else {
          throw error
        }
      }
    }

    console.log('🎉 MongoDB database initialization completed successfully!')
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    process.exit(1)
  } finally {
    await mongodb.disconnect()
  }
}

// Run the initialization
initializeDatabase()
