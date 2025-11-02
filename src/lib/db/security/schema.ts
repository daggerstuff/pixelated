import mongodb from '@/config/mongodb.config'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

// Initialize logger
const logger = createBuildSafeLogger('security-schema')

const mongoUri = process.env['MONGODB_URI']
const mongoDbName = process.env.MONGODB_DB_NAME

// Create mock client for builds without proper credentials
function createMockClient() {
  const message =
    process.env['NODE_ENV'] === 'production'
      ? 'CRITICAL: Using mock MongoDB client in production. This should never happen.'
      : 'Using mock MongoDB client for security schema in development.'

  logger.warn(message)

  return {
    connect: () =>
      Promise.resolve({
        collection: () => ({
          createIndex: () => Promise.resolve(),
          insertOne: () => Promise.resolve(),
        }),
      }),
  }
}

// Create MongoDB client only if we have valid credentials
const mongoAdmin = mongoUri && mongoDbName ? mongodb : createMockClient()

/**
 * Initialize security collections in the database
 */
export async function initializeSecurityTables(): Promise<void> {
  try {
    const db = await mongoAdmin.connect()

    // Create security_events collection with indexes
    const securityEventsCollection = db.collection('security_events')

    // Create indexes for better query performance
    await securityEventsCollection.createIndex({ type: 1 })
    await securityEventsCollection.createIndex({ user_id: 1 })
    await securityEventsCollection.createIndex({ severity: 1 })
    await securityEventsCollection.createIndex({ created_at: 1 })
    await securityEventsCollection.createIndex({ ip_address: 1 })

    console.warn('Security collections and indexes initialized successfully')
  } catch (error: unknown) {
    console.error(
      'Failed to initialize security collections:',
      error instanceof Error ? error : new Error(String(error)),
    )
    throw error instanceof Error ? error : new Error(String(error))
  }
}

/**
 * Initialize security database
 */
export async function initializeSecurityDatabase(): Promise<void> {
  try {
    await initializeSecurityTables()
  } catch (error: unknown) {
    console.error(
      'Failed to initialize security database:',
      error instanceof Error ? error : new Error(String(error)),
    )
    throw error instanceof Error ? error : new Error(String(error))
  }
}
