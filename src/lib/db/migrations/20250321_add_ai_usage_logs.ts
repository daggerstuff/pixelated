import { Db, MongoClient } from 'mongodb'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
const logger = createBuildSafeLogger('add_ai_usage_logs')

// Initialize MongoDB client
const client = new MongoClient(
  process.env['DATABASE_URL'] ?? process.env['MONGODB_URI'] ?? '',
)

export async function up(): Promise<void> {
  try {
    await client.connect()
    const db: Db = client.db()

    // Create ai_usage_logs collection
    const collection = db.collection('ai_usage_logs')

    // Create indexes for performance
    await collection.createIndex({ user_id: 1 })
    await collection.createIndex({ created_at: -1 })
    await collection.createIndex({ model: 1 })
    await collection.createIndex({ user_id: 1, created_at: -1 })

    logger.info('✅ Created ai_usage_logs collection with indexes')
  } catch (error: unknown) {
    logger.error('❌ Migration failed:', error)
    throw error
  } finally {
    await client.close()
  }
}

export async function down(): Promise<void> {
  try {
    await client.connect()
    const db: Db = client.db()

    // Drop the collection
    await db.collection('ai_usage_logs').drop()

    logger.info('✅ Dropped ai_usage_logs collection')
  } catch (error: unknown) {
    logger.error('❌ Rollback failed:', error)
    throw error
  } finally {
    await client.close()
  }
}
