#!/usr/bin/env node

/**
 * MongoDB Migration Script
 * This script handles database migrations and schema updates for MongoDB
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

// ...existing migrations array and functions...
