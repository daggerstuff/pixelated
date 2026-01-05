import { createAuditLog } from '../../audit/log'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { initializeSecurityTables } from './schema'

const logger = createBuildSafeLogger('default')

/**
 * Initialize the security database tables
 * This should be called during application startup
 */
export async function initializeSecurityDatabase() {
  try {
    logger.info('Initializing security database tables...')

    // Initialize tables
    await initializeSecurityTables()

    // Log successful initialization
    await createAuditLog({
      userId: 'system',
      action: 'system.security.database.initialize',
      resource: 'database',
      metadata: {
        timestamp: new Date().toISOString(),
      },
    })

    logger.info('Security database tables initialized successfully')
    return true
  } catch (error: unknown) {
    logger.error(
      'Failed to initialize security database',
      error instanceof Error ? error : new Error(String(error)),
    )

    // Log initialization failure
    await createAuditLog({
      userId: 'system',
      action: 'system.security.database.initialize.error',
      resource: 'database',
      metadata: {
        error: error instanceof Error ? error?.message : String(error),
        timestamp: new Date().toISOString(),
      },
    })

    throw error instanceof Error ? error : new Error(String(error))
  }
}
