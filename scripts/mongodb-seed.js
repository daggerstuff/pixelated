#!/usr/bin/env node

/**
 * MongoDB Database Seeding Script
 * This script populates the MongoDB database with initial seed data
 */

import { config } from 'dotenv'
import { MongoClient } from 'mongodb'
import bcryptjs from 'bcryptjs'

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

async function seedDatabase() {
  try {
    console.log('🌱 Starting MongoDB database seeding...')

    // Connect to MongoDB
    const db = await mongodb.connect()
    console.log('✅ Connected to MongoDB')

    // Check if database already has data
    const userCount = await db.collection('users').countDocuments()
    if (userCount > 0) {
      console.log(
        '⚠️  Database already contains users. Skipping seeding to prevent duplicates.',
      )
      console.log(
        '   Use --force flag to seed anyway (this will create duplicates)',
      )
      return
    }

    // Create sample users
    const saltRounds = 12
    const hashedPassword = await bcryptjs.hash('password123', saltRounds)

    const sampleUsers = [
      {
        email: 'admin@pixelated.com',
        password: hashedPassword,
        role: 'admin',
        profile: {
          firstName: 'Admin',
          lastName: 'User',
          bio: 'System Administrator',
        },
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        email: 'therapist@pixelated.com',
        password: hashedPassword,
        role: 'therapist',
        profile: {
          firstName: 'Dr. Sarah',
          lastName: 'Johnson',
          bio: 'Licensed Clinical Psychologist specializing in AI-assisted therapy',
        },
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        email: 'user@pixelated.com',
        password: hashedPassword,
        role: 'user',
        profile: {
          firstName: 'Demo',
          lastName: 'User',
          bio: 'Sample user account for testing',
        },
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    const userInsertResult = await db
      .collection('users')
      .insertMany(sampleUsers)
    console.log(`✅ Created ${userInsertResult.insertedCount} sample users`)

    // Get the demo user ID for creating sample todos
    const demoUser = await db
      .collection('users')
      .findOne({ email: 'user@pixelated.com' })
    const therapistUser = await db
      .collection('users')
      .findOne({ email: 'therapist@pixelated.com' })

    if (demoUser) {
      // Create sample todos
      const sampleTodos = [
        {
          name: 'Learn Astro Framework',
          description:
            'Study the Astro framework for building modern web applications',
          completed: false,
          userId: demoUser._id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: 'Set up MongoDB Database',
          description: 'Configure and populate the new MongoDB database',
          completed: true,
          userId: demoUser._id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: 'Implement AI Chat Features',
          description: 'Add AI-powered chat functionality for therapy sessions',
          completed: false,
          userId: demoUser._id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: 'Create User Authentication',
          description:
            'Set up secure user login and registration system with MongoDB',
          completed: true,
          userId: demoUser._id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: 'Design UI Components',
          description: 'Build reusable UI components with proper styling',
          completed: false,
          userId: demoUser._id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: 'Write Unit Tests',
          description: 'Add comprehensive test coverage for all features',
          completed: false,
          userId: demoUser._id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: 'Deploy to Production',
          description: 'Deploy the application to production environment',
          completed: false,
          userId: demoUser._id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const todoInsertResult = await db
        .collection('todos')
        .insertMany(sampleTodos)
      console.log(`✅ Created ${todoInsertResult.insertedCount} sample todos`)
    }

    if (demoUser && therapistUser) {
      // Create sample treatment plan
      const sampleTreatmentPlan = {
        userId: demoUser._id,
        therapistId: therapistUser._id,
        title: 'Anxiety Management and Coping Strategies',
        description:
          'A comprehensive treatment plan focused on developing healthy coping mechanisms for anxiety and stress management.',
        goals: [
          'Reduce anxiety symptoms by 50% within 8 weeks',
          'Develop 3 effective coping strategies',
          'Improve sleep quality and duration',
          'Enhance emotional regulation skills',
        ],
        interventions: [
          'Cognitive Behavioral Therapy (CBT)',
          'Mindfulness and meditation practices',
          'Progressive muscle relaxation',
          'Journaling and thought recording',
          'AI-assisted mood tracking',
        ],
        status: 'active',
        startDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await db.collection('treatment_plans').insertOne(sampleTreatmentPlan)
      console.log('✅ Created sample treatment plan')

      // Create sample AI metrics
      const sampleAIMetrics = [
        {
          userId: demoUser._id,
          sessionId: 'session_001',
          modelName: 'gpt-4-turbo',
          requestType: 'chat_completion',
          tokensUsed: 150,
          responseTime: 1200,
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          metadata: {
            inputLength: 45,
            outputLength: 105,
            temperature: 0.7,
          },
        },
        {
          userId: demoUser._id,
          sessionId: 'session_002',
          modelName: 'gpt-4-turbo',
          requestType: 'sentiment_analysis',
          tokensUsed: 75,
          responseTime: 800,
          timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
          metadata: {
            sentiment: 'positive',
            confidence: 0.85,
          },
        },
      ]

      await db.collection('ai_metrics').insertMany(sampleAIMetrics)
      console.log(`✅ Created ${sampleAIMetrics.length} sample AI metrics`)

      // Create sample consent records
      const sampleConsents = [
        {
          userId: demoUser._id,
          consentType: 'data_processing',
          granted: true,
          version: '1.0',
          grantedAt: new Date(),
          ipAddress: '127.0.0.1',
        },
        {
          userId: demoUser._id,
          consentType: 'ai_analysis',
          granted: true,
          version: '1.0',
          grantedAt: new Date(),
          ipAddress: '127.0.0.1',
        },
        {
          userId: demoUser._id,
          consentType: 'marketing_communications',
          granted: false,
          version: '1.0',
          revokedAt: new Date(),
          ipAddress: '127.0.0.1',
        },
      ]

      await db.collection('consent_management').insertMany(sampleConsents)
      console.log(`✅ Created ${sampleConsents.length} sample consent records`)
    }

    console.log('\n🎉 Database seeding completed successfully!')
    console.log('\n📋 Sample accounts created:')
    console.log('   Admin: admin@pixelated.com / password123')
    console.log('   Therapist: therapist@pixelated.com / password123')
    console.log('   User: user@pixelated.com / password123')
    console.log('\n⚠️  Remember to change these passwords in production!')
  } catch (error) {
    console.error('❌ Database seeding failed:', error)
    process.exit(1)
  } finally {
    await mongodb.disconnect()
  }
}

// Run the seeding
seedDatabase()
